-- =============================================================================
-- EstudeVet v11 - Migration 0003 - Gabarito protegido e resposta pelo servidor
--
-- Problema que esta migration resolve:
--   1. Na 0002, o aluno com acesso a materia lia a tabela `alternativas`
--      inteira, incluindo a coluna `correta`. Dava para ver o gabarito pela
--      API antes de responder.
--   2. A politica de `respostas` permitia insert do proprio dono, entao o
--      cliente podia gravar `correta = true` em tudo e inflar streak,
--      conquistas e taxa de acerto sem responder nada.
--
-- Correcao: o gabarito deixa de ser legivel e a correcao passa a acontecer
-- no servidor, em funcoes security definer. O cliente informa o que marcou
-- e recebe de volta se acertou - nunca o contrario.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Gabarito fora do alcance do cliente
-- -----------------------------------------------------------------------------

-- Postgres nao tem RLS por coluna, mas tem GRANT por coluna.
revoke select on public.alternativas from authenticated, anon;
grant select (id, questao_id, letra, texto) on public.alternativas to authenticated;

revoke select on public.assertivas from authenticated, anon;
grant select (id, questao_id, ordem, numeral, texto) on public.assertivas to authenticated;

comment on column public.alternativas.correta is
  'Nao legivel pelo cliente. Chegue nela por registrar_resposta, resultado_sessao ou admin_questao_completa.';

-- -----------------------------------------------------------------------------
-- 2. Resposta deixa de ser insert direto
-- -----------------------------------------------------------------------------

drop policy if exists respostas_proprio on public.respostas;

-- O aluno le as proprias respostas, mas nao escreve: quem escreve e a RPC.
create policy respostas_leitura on public.respostas
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.respostas from authenticated, anon;

-- Sessao continua sendo criada pelo cliente, mas placar e status nao:
-- ficam a cargo das funcoes abaixo.
drop policy if exists sessoes_proprio on public.sessoes_simulado;

create policy sessoes_leitura on public.sessoes_simulado
  for select to authenticated
  using (usuario_id = auth.uid() or public.is_admin());

create policy sessoes_criacao on public.sessoes_simulado
  for insert to authenticated
  with check (usuario_id = auth.uid());

-- Update so do ponteiro de navegacao. Placar e status nao passam por aqui.
create policy sessoes_navegacao on public.sessoes_simulado
  for update to authenticated
  using (usuario_id = auth.uid() and status = 'em_andamento')
  with check (usuario_id = auth.uid() and status = 'em_andamento');

revoke update on public.sessoes_simulado from authenticated;
grant update (indice_atual, atualizada_em) on public.sessoes_simulado to authenticated;

-- -----------------------------------------------------------------------------
-- 3. registrar_resposta - unica porta de entrada de uma resposta
-- -----------------------------------------------------------------------------

create or replace function public.registrar_resposta(
  p_sessao uuid,
  p_questao uuid,
  p_alternativa uuid,
  p_tempo_segundos integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_materia uuid;
  v_correta_id uuid;
  v_acertou boolean;
  v_comentario text;
  v_ja_respondeu boolean;
begin
  if v_usuario is null then
    raise exception 'sem sessao de usuario' using errcode = '42501';
  end if;

  -- A sessao e minha e esta aberta?
  if not exists (
    select 1 from public.sessoes_simulado s
    where s.id = p_sessao and s.usuario_id = v_usuario and s.status = 'em_andamento'
  ) then
    raise exception 'sessao inexistente, de outro usuario ou ja encerrada'
      using errcode = '42501';
  end if;

  -- A questao faz parte desta sessao? Impede responder questao de fora.
  if not exists (
    select 1 from public.sessao_questoes sq
    where sq.sessao_id = p_sessao and sq.questao_id = p_questao
  ) then
    raise exception 'questao nao pertence a esta sessao' using errcode = '42501';
  end if;

  select q.materia_id, q.comentario into v_materia, v_comentario
    from public.questoes q where q.id = p_questao;

  if not public.tem_acesso_materia(v_materia) then
    raise exception 'sem acesso a esta materia' using errcode = '42501';
  end if;

  select a.id into v_correta_id
    from public.alternativas a
   where a.questao_id = p_questao and a.correta
   limit 1;

  -- Alternativa marcada tem que ser desta questao.
  if p_alternativa is not null and not exists (
    select 1 from public.alternativas a
    where a.id = p_alternativa and a.questao_id = p_questao
  ) then
    raise exception 'alternativa nao pertence a questao' using errcode = '22023';
  end if;

  v_acertou := p_alternativa is not null and p_alternativa = v_correta_id;

  select exists (
    select 1 from public.respostas r
    where r.sessao_id = p_sessao and r.questao_id = p_questao
  ) into v_ja_respondeu;

  -- Idempotente: reenviar a mesma questao nao conta duas vezes no streak.
  if not v_ja_respondeu then
    insert into public.respostas
      (sessao_id, usuario_id, questao_id, alternativa_id, correta, tempo_segundos)
    values
      (p_sessao, v_usuario, p_questao, p_alternativa, v_acertou,
       greatest(coalesce(p_tempo_segundos, 0), 0));

    update public.sessoes_simulado
       set acertos = acertos + case when v_acertou then 1 else 0 end,
           tempo_segundos = tempo_segundos + greatest(coalesce(p_tempo_segundos, 0), 0),
           atualizada_em = now()
     where id = p_sessao;
  end if;

  -- O gabarito so aparece agora, depois da resposta gravada.
  return jsonb_build_object(
    'acertou', v_acertou,
    'alternativa_correta_id', v_correta_id,
    'comentario', v_comentario,
    'ja_respondida', v_ja_respondeu
  );
end $$;

-- -----------------------------------------------------------------------------
-- 4. finalizar_sessao
-- -----------------------------------------------------------------------------

create or replace function public.finalizar_sessao(p_sessao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_total smallint;
  v_respondidas smallint;
  v_acertos smallint;
begin
  if not exists (
    select 1 from public.sessoes_simulado s
    where s.id = p_sessao and s.usuario_id = v_usuario
  ) then
    raise exception 'sessao inexistente ou de outro usuario' using errcode = '42501';
  end if;

  select s.total_questoes into v_total
    from public.sessoes_simulado s where s.id = p_sessao;

  select count(*), count(*) filter (where correta)
    into v_respondidas, v_acertos
    from public.respostas where sessao_id = p_sessao;

  update public.sessoes_simulado
     set status = 'concluida',
         acertos = v_acertos,
         finalizada_em = now(),
         atualizada_em = now()
   where id = p_sessao;

  return jsonb_build_object(
    'total', v_total,
    'respondidas', v_respondidas,
    'acertos', v_acertos
  );
end $$;

-- -----------------------------------------------------------------------------
-- 5. resultado_sessao - gabarito completo, so depois de encerrada
-- -----------------------------------------------------------------------------

create or replace function public.resultado_sessao(p_sessao uuid)
returns table (
  questao_id uuid,
  enunciado text,
  comentario text,
  alternativa_marcada uuid,
  alternativa_correta uuid,
  acertou boolean,
  ordem smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    q.id,
    q.enunciado,
    q.comentario,
    r.alternativa_id,
    (select a.id from public.alternativas a where a.questao_id = q.id and a.correta limit 1),
    coalesce(r.correta, false),
    sq.ordem
  from public.sessao_questoes sq
  join public.questoes q on q.id = sq.questao_id
  left join public.respostas r
    on r.sessao_id = sq.sessao_id and r.questao_id = q.id
  where sq.sessao_id = p_sessao
    and exists (
      select 1 from public.sessoes_simulado s
      where s.id = p_sessao
        and (s.usuario_id = auth.uid() or public.is_admin())
        and s.status <> 'em_andamento'
    )
  order by sq.ordem;
$$;

-- -----------------------------------------------------------------------------
-- 6. admin_questao_completa - fila de revisao precisa ver o gabarito
-- -----------------------------------------------------------------------------

create or replace function public.admin_questao_completa(p_questao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_saida jsonb;
begin
  if not public.is_admin() then
    raise exception 'restrito a administrador' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'questao', to_jsonb(q),
    'alternativas', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.letra)
         from public.alternativas a where a.questao_id = q.id), '[]'::jsonb),
    'assertivas', coalesce(
      (select jsonb_agg(to_jsonb(x) order by x.ordem)
         from public.assertivas x where x.questao_id = q.id), '[]'::jsonb)
  )
  into v_saida
  from public.questoes q
  where q.id = p_questao;

  if v_saida is null then
    raise exception 'questao nao encontrada' using errcode = 'P0002';
  end if;

  return v_saida;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Permissoes
-- -----------------------------------------------------------------------------

revoke all on function public.registrar_resposta(uuid, uuid, uuid, integer) from public, anon;
revoke all on function public.finalizar_sessao(uuid) from public, anon;
revoke all on function public.resultado_sessao(uuid) from public, anon;
revoke all on function public.admin_questao_completa(uuid) from public, anon;

grant execute on function public.registrar_resposta(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.finalizar_sessao(uuid) to authenticated;
grant execute on function public.resultado_sessao(uuid) to authenticated;
grant execute on function public.admin_questao_completa(uuid) to authenticated;
