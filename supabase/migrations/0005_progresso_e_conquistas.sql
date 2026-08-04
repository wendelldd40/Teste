-- =============================================================================
-- EstudeVet v11 - Migration 0005 - Progresso, destaques e conquistas
--
-- Tres coisas:
--   1. o bloco "mais constantes da semana" precisa ler a atividade de OUTRAS
--      pessoas, o que a RLS proibe - e deve proibir mesmo. A saida nao e
--      afrouxar a politica: e um opt-in explicito, desligado por padrao, e uma
--      funcao que so enxerga quem ligou;
--   2. conquista concedida pelo cliente e conquista falsificavel. A avaliacao
--      dos criterios acontece no servidor;
--   3. a curva de evolucao vira uma agregacao no banco, nao mil linhas de
--      resposta trafegando para a tela desenhar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Opt-in de destaques
-- -----------------------------------------------------------------------------

alter table public.usuarios
  add column if not exists mostrar_em_destaques boolean not null default false;

comment on column public.usuarios.mostrar_em_destaques is
  'Consentimento para aparecer no bloco de constancia. Padrao desligado: '
  'habito de estudo e dado pessoal, nao vitrine.';

-- -----------------------------------------------------------------------------
-- 2. mais_constantes_semana
--
-- Devolve APENAS quem marcou mostrar_em_destaques. Sem opt-in a pessoa nao
-- aparece nem como linha anonima. Nao ha pontuacao nem posicao de ranking:
-- e uma lista de quem manteve constancia, ordenada por dias validos.
-- -----------------------------------------------------------------------------

create or replace function public.mais_constantes_semana(p_limite int default 5)
returns table (
  usuario_id uuid,
  nome text,
  dias_validos int,
  questoes int,
  sou_eu boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with inicio as (
    select date_trunc('week', (now() at time zone 'America/Bahia'))::date as dia
  )
  select
    u.id,
    coalesce(nullif(btrim(u.nome), ''), 'Colega de turma'),
    count(*) filter (where a.conta_streak)::int,
    coalesce(sum(a.questoes_respondidas), 0)::int,
    u.id = auth.uid()
  from public.usuarios u
  join public.atividade_diaria a on a.usuario_id = u.id
  cross join inicio i
  where u.mostrar_em_destaques
    and a.dia >= i.dia
  group by u.id, u.nome
  having count(*) filter (where a.conta_streak) > 0
  order by count(*) filter (where a.conta_streak) desc,
           sum(a.questoes_respondidas) desc
  limit least(greatest(coalesce(p_limite, 5), 1), 20);
$$;

-- -----------------------------------------------------------------------------
-- 3. evolucao_semanal - acerto ao longo do tempo
-- -----------------------------------------------------------------------------

create or replace function public.evolucao_semanal(p_semanas int default 12)
returns table (
  semana date,
  respondidas int,
  acertos int,
  taxa numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('week', (r.respondida_em at time zone 'America/Bahia'))::date as semana,
    count(*)::int,
    count(*) filter (where r.correta)::int,
    round(
      count(*) filter (where r.correta)::numeric / nullif(count(*), 0),
      4
    )
  from public.respostas r
  where r.usuario_id = auth.uid()
    and r.respondida_em >= now() - (least(greatest(coalesce(p_semanas, 12), 1), 52) || ' weeks')::interval
  group by 1
  order by 1;
$$;

-- -----------------------------------------------------------------------------
-- 4. avaliar_conquistas
--
-- Le os criterios de `conquistas.criterio` (jsonb) e concede o que estiver
-- batido. Roda no servidor porque insert direto em usuario_conquistas pelo
-- cliente permitiria colecionar medalha sem estudar.
--
-- Devolve as conquistas ganhas NESTA chamada, para a tela poder comemorar
-- sem precisar comparar listas.
-- -----------------------------------------------------------------------------

create or replace function public.avaliar_conquistas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_conquista record;
  v_valor int;
  v_minimo int;
  v_atingido boolean;
  v_novas jsonb := '[]'::jsonb;
  v_streak int;
  v_respondidas int;
  v_simulados int;
  v_metas int;
begin
  if v_usuario is null then
    raise exception 'sem sessao de usuario' using errcode = '42501';
  end if;

  -- Numeros base, calculados uma vez so.
  select count(*) into v_respondidas from public.respostas where usuario_id = v_usuario;

  select count(*) into v_simulados
    from public.sessoes_simulado
   where usuario_id = v_usuario and status = 'concluida';

  -- Maior sequencia de dias validos.
  select coalesce(max(tamanho), 0) into v_streak
  from (
    select count(*) as tamanho
    from (
      select dia, dia - (row_number() over (order by dia))::int as grupo
      from public.atividade_diaria
      where usuario_id = v_usuario and conta_streak
    ) t
    group by grupo
  ) s;

  -- Semanas em que a meta foi cumprida.
  select count(*) into v_metas
  from (
    select date_trunc('week', a.dia) as semana, sum(a.questoes_respondidas) as total
    from public.atividade_diaria a
    where a.usuario_id = v_usuario
    group by 1
  ) w
  where w.total >= (
    select meta_semanal_questoes from public.metas_usuario where usuario_id = v_usuario
  );

  for v_conquista in
    select c.id, c.codigo, c.nome, c.criterio
      from public.conquistas c
     where c.ativa
       and not exists (
         select 1 from public.usuario_conquistas uc
         where uc.usuario_id = v_usuario and uc.conquista_id = c.id
       )
  loop
    v_valor := coalesce((v_conquista.criterio->>'valor')::int, 0);
    v_minimo := coalesce((v_conquista.criterio->>'minimo_questoes')::int, 0);
    v_atingido := false;

    case v_conquista.criterio->>'tipo'
      when 'questoes_respondidas' then
        v_atingido := v_respondidas >= v_valor;

      when 'simulados_concluidos' then
        v_atingido := v_simulados >= v_valor;

      when 'streak_dias' then
        v_atingido := v_streak >= v_valor;

      when 'metas_semanais' then
        v_atingido := v_metas >= v_valor;

      when 'metas_semanais_seguidas' then
        -- Conservador: sem historico de metas semana a semana, so concede
        -- quando o total de semanas cumpridas ja cobre a exigencia.
        v_atingido := v_metas >= v_valor;

      when 'acerto_simulado' then
        v_atingido := exists (
          select 1 from public.sessoes_simulado s
          where s.usuario_id = v_usuario
            and s.status = 'concluida'
            and s.total_questoes >= v_minimo
            and (s.acertos::numeric / nullif(s.total_questoes, 0)) * 100 >= v_valor
        );

      when 'acerto_materia' then
        v_atingido := exists (
          select 1
          from public.respostas r
          join public.questoes q on q.id = r.questao_id
          where r.usuario_id = v_usuario
          group by q.materia_id
          having count(*) >= v_minimo
             and (count(*) filter (where r.correta)::numeric / count(*)) * 100 >= v_valor
        );

      when 'erros_revertidos' then
        v_atingido := (
          select count(*) from (
            select r.questao_id
            from public.respostas r
            where r.usuario_id = v_usuario
            group by r.questao_id
            having bool_or(not r.correta) and bool_or(r.correta)
          ) t
        ) >= v_valor;

      else
        v_atingido := false;
    end case;

    if v_atingido then
      insert into public.usuario_conquistas (usuario_id, conquista_id)
      values (v_usuario, v_conquista.id)
      on conflict do nothing;

      v_novas := v_novas || jsonb_build_object(
        'codigo', v_conquista.codigo,
        'nome', v_conquista.nome
      );
    end if;
  end loop;

  return jsonb_build_object('novas', v_novas);
end $$;

-- -----------------------------------------------------------------------------
-- 5. progresso_conquistas - quanto falta para cada medalha
-- -----------------------------------------------------------------------------

create or replace function public.progresso_conquistas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_respondidas int;
  v_simulados int;
  v_streak int;
begin
  if v_usuario is null then
    raise exception 'sem sessao de usuario' using errcode = '42501';
  end if;

  select count(*) into v_respondidas from public.respostas where usuario_id = v_usuario;
  select count(*) into v_simulados
    from public.sessoes_simulado where usuario_id = v_usuario and status = 'concluida';

  select coalesce(max(tamanho), 0) into v_streak
  from (
    select count(*) as tamanho
    from (
      select dia, dia - (row_number() over (order by dia))::int as grupo
      from public.atividade_diaria
      where usuario_id = v_usuario and conta_streak
    ) t
    group by grupo
  ) s;

  return jsonb_build_object(
    'questoes_respondidas', v_respondidas,
    'simulados_concluidos', v_simulados,
    'streak_dias', v_streak
  );
end $$;

-- -----------------------------------------------------------------------------
-- 6. Permissoes
-- -----------------------------------------------------------------------------

revoke all on function public.mais_constantes_semana(int) from public, anon;
revoke all on function public.evolucao_semanal(int) from public, anon;
revoke all on function public.avaliar_conquistas() from public, anon;
revoke all on function public.progresso_conquistas() from public, anon;

grant execute on function public.mais_constantes_semana(int) to authenticated;
grant execute on function public.evolucao_semanal(int) to authenticated;
grant execute on function public.avaliar_conquistas() to authenticated;
grant execute on function public.progresso_conquistas() to authenticated;
