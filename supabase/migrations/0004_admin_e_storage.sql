-- =============================================================================
-- EstudeVet v11 - Migration 0004 - Admin e Storage
--
-- Duas coisas:
--   1. bucket de imagem das materias (16:9), com escrita restrita a admin;
--   2. RPCs que salvam questao, alternativas, assertivas e assuntos EM UMA
--      TRANSACAO. Salvar em quatro chamadas separadas deixa questao pela
--      metade quando a terceira falha - foi assim que o banco da v10 juntou
--      questao sem alternativa e alternativa orfa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Storage
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materias',
  'materias',
  true,                                   -- leitura publica: e capa de card
  2 * 1024 * 1024,                        -- 2 MB; o corte no cliente entrega bem menos
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists materias_imagem_leitura on storage.objects;
create policy materias_imagem_leitura on storage.objects
  for select to public
  using (bucket_id = 'materias');

drop policy if exists materias_imagem_escrita on storage.objects;
create policy materias_imagem_escrita on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materias' and public.is_admin());

drop policy if exists materias_imagem_atualizacao on storage.objects;
create policy materias_imagem_atualizacao on storage.objects
  for update to authenticated
  using (bucket_id = 'materias' and public.is_admin())
  with check (bucket_id = 'materias' and public.is_admin());

drop policy if exists materias_imagem_remocao on storage.objects;
create policy materias_imagem_remocao on storage.objects
  for delete to authenticated
  using (bucket_id = 'materias' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. admin_salvar_questao - tudo ou nada
-- -----------------------------------------------------------------------------

create or replace function public.admin_salvar_questao(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status public.status_revisao;
  v_alternativas jsonb;
  v_assertivas jsonb;
  v_assuntos jsonb;
  v_letras text[];
  v_corretas int;
begin
  if not public.is_admin() then
    raise exception 'restrito a administrador' using errcode = '42501';
  end if;

  v_id           := nullif(p_dados->>'id', '')::uuid;
  v_status       := coalesce(p_dados->>'status', 'rascunho')::public.status_revisao;
  v_alternativas := coalesce(p_dados->'alternativas', '[]'::jsonb);
  v_assertivas   := coalesce(p_dados->'assertivas', '[]'::jsonb);
  v_assuntos     := coalesce(p_dados->'assunto_ids', '[]'::jsonb);

  -- Validacao antes de escrever qualquer coisa.
  select array_agg(a->>'letra'), count(*) filter (where (a->>'correta')::boolean)
    into v_letras, v_corretas
    from jsonb_array_elements(v_alternativas) a;

  if v_status = 'publicada' then
    if coalesce(array_length(v_letras, 1), 0) <> 5 then
      raise exception 'para publicar sao necessarias 5 alternativas, recebidas %',
        coalesce(array_length(v_letras, 1), 0) using errcode = '23514';
    end if;
    if v_corretas <> 1 then
      raise exception 'para publicar e necessaria exatamente 1 alternativa correta, recebidas %',
        v_corretas using errcode = '23514';
    end if;
  end if;

  if v_letras is not null
     and (select count(distinct l) from unnest(v_letras) l) <> array_length(v_letras, 1) then
    raise exception 'letras de alternativa repetidas' using errcode = '23505';
  end if;

  -- Questao.
  if v_id is null then
    insert into public.questoes
      (materia_id, tipo, dificuldade, enunciado, comentario, status,
       livro_id, capitulo_id, pagina, fonte_livre, criado_por)
    values (
      (p_dados->>'materia_id')::uuid,
      coalesce(p_dados->>'tipo', 'multipla_escolha')::public.tipo_questao,
      coalesce(p_dados->>'dificuldade', 'medio')::public.dificuldade,
      p_dados->>'enunciado',
      nullif(p_dados->>'comentario', ''),
      v_status,
      nullif(p_dados->>'livro_id', '')::uuid,
      nullif(p_dados->>'capitulo_id', '')::uuid,
      nullif(p_dados->>'pagina', ''),
      nullif(p_dados->>'fonte_livre', ''),
      auth.uid()
    )
    returning id into v_id;
  else
    update public.questoes
       set materia_id  = coalesce((p_dados->>'materia_id')::uuid, materia_id),
           tipo        = coalesce((p_dados->>'tipo')::public.tipo_questao, tipo),
           dificuldade = coalesce((p_dados->>'dificuldade')::public.dificuldade, dificuldade),
           enunciado   = coalesce(p_dados->>'enunciado', enunciado),
           comentario  = nullif(p_dados->>'comentario', ''),
           pagina      = nullif(p_dados->>'pagina', ''),
           fonte_livre = nullif(p_dados->>'fonte_livre', ''),
           status      = v_status
     where id = v_id;

    if not found then
      raise exception 'questao nao encontrada' using errcode = 'P0002';
    end if;
  end if;

  -- Filhas: substitui por completo. Simples e previsivel - o editor sempre
  -- manda o conjunto inteiro, nunca um patch parcial.
  delete from public.alternativas where questao_id = v_id;
  insert into public.alternativas (questao_id, letra, texto, correta)
  select v_id, a->>'letra', a->>'texto', coalesce((a->>'correta')::boolean, false)
    from jsonb_array_elements(v_alternativas) a;

  delete from public.assertivas where questao_id = v_id;
  insert into public.assertivas (questao_id, ordem, numeral, texto, correta)
  select v_id,
         (a->>'ordem')::smallint,
         a->>'numeral',
         a->>'texto',
         (a->>'correta')::boolean
    from jsonb_array_elements(v_assertivas) a;

  delete from public.questao_assuntos where questao_id = v_id;
  insert into public.questao_assuntos (questao_id, assunto_id)
  select v_id, x::uuid from jsonb_array_elements_text(v_assuntos) x
  on conflict do nothing;

  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- 3. admin_publicar_questao
-- O trigger da 0001 e quem manda: se a questao estiver incompleta, o erro
-- sobe e a transacao inteira volta atras.
-- -----------------------------------------------------------------------------

create or replace function public.admin_publicar_questao(p_questao uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_status public.status_revisao;
begin
  if not public.is_admin() then
    raise exception 'restrito a administrador' using errcode = '42501';
  end if;

  update public.questoes set status = 'publicada' where id = p_questao
  returning status into v_status;

  if v_status is null then
    raise exception 'questao nao encontrada' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', p_questao, 'status', v_status);
end $$;

-- -----------------------------------------------------------------------------
-- 4. admin_resumo - numeros da tela inicial do admin
-- -----------------------------------------------------------------------------

create or replace function public.admin_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'restrito a administrador' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'materias_ativas',    (select count(*) from public.materias where ativa),
    'materias_total',     (select count(*) from public.materias),
    'materias_sem_imagem',(select count(*) from public.materias where ativa and imagem_url is null),
    'questoes_publicadas',(select count(*) from public.questoes where status = 'publicada'),
    'questoes_revisao',   (select count(*) from public.questoes where status = 'precisa_revisao'),
    'questoes_rascunho',  (select count(*) from public.questoes where status = 'rascunho'),
    'assuntos',           (select count(*) from public.assuntos),
    'alunos',             (select count(*) from public.usuarios where papel = 'aluno')
  );
end $$;

-- -----------------------------------------------------------------------------
-- 5. Permissoes
-- -----------------------------------------------------------------------------

revoke all on function public.admin_salvar_questao(jsonb) from public, anon;
revoke all on function public.admin_publicar_questao(uuid) from public, anon;
revoke all on function public.admin_resumo() from public, anon;

grant execute on function public.admin_salvar_questao(jsonb) to authenticated;
grant execute on function public.admin_publicar_questao(uuid) to authenticated;
grant execute on function public.admin_resumo() to authenticated;
