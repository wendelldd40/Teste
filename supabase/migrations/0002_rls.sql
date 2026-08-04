-- =============================================================================
-- EstudeVet v11 - Migration 0002 - Row Level Security
-- Toda tabela nasce com RLS habilitada e politica declarada explicitamente.
-- Regra de negocio central: o aluno VE todas as materias, mas so ACESSA
-- questoes e materiais das materias que ele assinou.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Funcoes auxiliares
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.papel = 'admin'
  );
$$;

create or replace function public.tem_acesso_materia(p_materia uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.acessos_materia a
    where a.usuario_id = auth.uid()
      and a.materia_id = p_materia
      and a.ativo
      and (a.expira_em is null or a.expira_em > now())
  );
$$;

create or replace function public.tem_acesso_questao(p_questao uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.tem_acesso_materia((select materia_id from public.questoes where id = p_questao));
$$;

revoke execute on function public.is_admin() from public;
grant  execute on function public.is_admin() to authenticated;
grant  execute on function public.tem_acesso_materia(uuid) to authenticated;
grant  execute on function public.tem_acesso_questao(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Habilitar RLS em tudo
-- -----------------------------------------------------------------------------

alter table public.periodos              enable row level security;
alter table public.materias              enable row level security;
alter table public.materia_prerequisitos enable row level security;
alter table public.assuntos              enable row level security;
alter table public.livros                enable row level security;
alter table public.capitulos             enable row level security;
alter table public.materiais             enable row level security;
alter table public.conteudo_secoes       enable row level security;
alter table public.questoes              enable row level security;
alter table public.questao_assuntos      enable row level security;
alter table public.assertivas            enable row level security;
alter table public.alternativas          enable row level security;
alter table public.usuarios              enable row level security;
alter table public.acessos_materia       enable row level security;
alter table public.metas_usuario         enable row level security;
alter table public.sessoes_simulado      enable row level security;
alter table public.sessao_questoes       enable row level security;
alter table public.respostas             enable row level security;
alter table public.atividade_diaria      enable row level security;
alter table public.conquistas            enable row level security;
alter table public.usuario_conquistas    enable row level security;
alter table public.turmas                enable row level security;
alter table public.turma_membros         enable row level security;

-- -----------------------------------------------------------------------------
-- CATALOGO: visivel para todo autenticado, escrita so admin
-- -----------------------------------------------------------------------------

create policy periodos_leitura on public.periodos
  for select to authenticated using (true);
create policy periodos_admin on public.periodos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy materias_leitura on public.materias
  for select to authenticated using (ativa or public.is_admin());
create policy materias_admin on public.materias
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy prereq_leitura on public.materia_prerequisitos
  for select to authenticated using (true);
create policy prereq_admin on public.materia_prerequisitos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assuntos_leitura on public.assuntos
  for select to authenticated using (true);
create policy assuntos_admin on public.assuntos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy livros_leitura on public.livros
  for select to authenticated using (true);
create policy livros_admin on public.livros
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy capitulos_leitura on public.capitulos
  for select to authenticated using (true);
create policy capitulos_admin on public.capitulos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- CONTEUDO: exige acesso a materia
-- -----------------------------------------------------------------------------

create policy materiais_leitura on public.materiais
  for select to authenticated
  using (status = 'publicada' and public.tem_acesso_materia(materia_id));
create policy materiais_admin on public.materiais
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy conteudo_leitura on public.conteudo_secoes
  for select to authenticated
  using (exists (
    select 1 from public.materiais m
    where m.id = material_id
      and m.status = 'publicada'
      and public.tem_acesso_materia(m.materia_id)
  ));
create policy conteudo_admin on public.conteudo_secoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- QUESTOES: publicadas + acesso a materia. Gabarito nao vaza para materia nao paga.
-- -----------------------------------------------------------------------------

create policy questoes_leitura on public.questoes
  for select to authenticated
  using (status = 'publicada' and public.tem_acesso_materia(materia_id));
create policy questoes_admin on public.questoes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy questao_assuntos_leitura on public.questao_assuntos
  for select to authenticated using (public.tem_acesso_questao(questao_id));
create policy questao_assuntos_admin on public.questao_assuntos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy assertivas_leitura on public.assertivas
  for select to authenticated
  using (exists (
    select 1 from public.questoes q
    where q.id = questao_id
      and q.status = 'publicada'
      and public.tem_acesso_materia(q.materia_id)
  ));
create policy assertivas_admin on public.assertivas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy alternativas_leitura on public.alternativas
  for select to authenticated
  using (exists (
    select 1 from public.questoes q
    where q.id = questao_id
      and q.status = 'publicada'
      and public.tem_acesso_materia(q.materia_id)
  ));
create policy alternativas_admin on public.alternativas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- USUARIO: so o proprio dono (admin le tudo)
-- -----------------------------------------------------------------------------

create policy usuarios_proprio_select on public.usuarios
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy usuarios_proprio_update on public.usuarios
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy usuarios_admin on public.usuarios
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- O aluno le seus acessos mas NUNCA os cria. Liberacao e admin ou service role.
create policy acessos_proprio_select on public.acessos_materia
  for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
create policy acessos_admin on public.acessos_materia
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy metas_proprio on public.metas_usuario
  for all to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- SIMULADO E PROGRESSO: so o proprio dono
-- -----------------------------------------------------------------------------

create policy sessoes_proprio on public.sessoes_simulado
  for all to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid());

create policy sessao_questoes_proprio on public.sessao_questoes
  for all to authenticated
  using (exists (
    select 1 from public.sessoes_simulado s
    where s.id = sessao_id and (s.usuario_id = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.sessoes_simulado s
    where s.id = sessao_id and s.usuario_id = auth.uid()
  ));

create policy respostas_proprio on public.respostas
  for all to authenticated
  using (usuario_id = auth.uid() or public.is_admin())
  with check (usuario_id = auth.uid());

create policy atividade_proprio_select on public.atividade_diaria
  for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
-- Escrita so pelo trigger (security definer). Nenhuma politica de insert/update:
-- o cliente nao pode forjar streak.

-- -----------------------------------------------------------------------------
-- CONQUISTAS
-- -----------------------------------------------------------------------------

create policy conquistas_leitura on public.conquistas
  for select to authenticated using (ativa or public.is_admin());
create policy conquistas_admin on public.conquistas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy usuario_conquistas_select on public.usuario_conquistas
  for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
create policy usuario_conquistas_admin on public.usuario_conquistas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- TURMAS: criadas e dormentes. Leitura so de quem e membro.
-- -----------------------------------------------------------------------------

create policy turmas_membro_select on public.turmas
  for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.turma_membros m
    where m.turma_id = id and m.usuario_id = auth.uid()
  ));
create policy turmas_admin on public.turmas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy turma_membros_select on public.turma_membros
  for select to authenticated using (usuario_id = auth.uid() or public.is_admin());
create policy turma_membros_admin on public.turma_membros
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
