-- =============================================================================
-- EstudeVet v11 - INSTALACAO COMPLETA
--
-- Cole ESTE ARQUIVO INTEIRO no SQL Editor do Supabase e rode uma vez so.
-- Ele monta o banco do zero: tabelas, seguranca, funcoes, storage e o
-- catalogo de materias.
--
-- Projeto de destino: o NOVO. Este script nao toca no banco antigo.
--
-- Tempo esperado: poucos segundos. Se der erro, NADA foi aplicado pela
-- metade - cada bloco roda em transacao.
--
-- Ordem interna (nao reordene):
--   1. schema      tabelas, enums, indices, triggers
--   2. RLS         seguranca por linha, tabela por tabela
--   3. gabarito    revoga leitura do gabarito e cria as RPCs de resposta
--   4. admin       storage das capas e RPCs transacionais do admin
--   5. progresso   destaques com opt-in, conquistas, evolucao
--   6. seed        10 periodos, 67 materias, 50 pre-requisitos, 12 conquistas
-- =============================================================================


-- #############################################################################
-- #
-- #  PARTE 1/6 - SCHEMA
-- #
-- #############################################################################

-- =============================================================================
-- EstudeVet v11 - Migration 0001 - Schema inicial
-- Projeto Supabase NOVO. O banco antigo nao e tocado por esta migration.
-- Convencao: nomes de dominio em portugues, nomes tecnicos em ingles.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

create type public.papel_usuario as enum ('aluno', 'admin');

create type public.dificuldade as enum ('facil', 'medio', 'dificil');

-- Substitui o antigo campo `ativo`, que fazia papel de status e de visibilidade
-- ao mesmo tempo. Agora status e ciclo editorial; visibilidade e RLS.
create type public.status_revisao as enum (
  'rascunho',        -- em producao, invisivel para aluno
  'precisa_revisao', -- importada ou incompleta, invisivel para aluno
  'publicada',       -- visivel para quem tem acesso a materia
  'arquivada'        -- retirada de circulacao, historico preservado
);

create type public.tipo_questao as enum (
  'multipla_escolha', -- enunciado + 5 alternativas
  'assertivas',       -- enunciado + assertivas numeradas + 5 alternativas sobre elas
  'julgamento'        -- enunciado + assertivas julgadas individualmente (certo/errado)
);

create type public.tipo_material as enum ('apostila', 'mapa_mental', 'resumo', 'link');

create type public.escopo_simulado as enum ('materia', 'assunto', 'geral');

create type public.status_sessao as enum ('em_andamento', 'concluida', 'abandonada');

create type public.origem_acesso as enum ('compra', 'cortesia', 'bolsa', 'turma');

create type public.papel_turma as enum ('aluno', 'monitor');

-- =============================================================================
-- 2. ESTRUTURA ACADEMICA
-- =============================================================================

create table public.periodos (
  id          uuid primary key default gen_random_uuid(),
  numero      smallint not null unique check (numero between 1 and 10),
  nome        text not null,
  created_at  timestamptz not null default now()
);
comment on table public.periodos is 'Periodos da matriz curricular. Nunca hardcoded no front.';

create table public.materias (
  id           uuid primary key default gen_random_uuid(),
  periodo_id   uuid not null references public.periodos(id) on delete restrict,
  codigo       text,                  -- codigo da matriz (MV200206). NAO e unico:
                                      -- a matriz 2023/1 repete MV200246 no 8o periodo.
  nome         text not null,
  slug         text not null unique,
  descricao    text,
  creditos     smallint check (creditos >= 0),
  ch_total     smallint check (ch_total >= 0),
  ch_teorica   smallint check (ch_teorica >= 0),
  ch_pratica   smallint check (ch_pratica >= 0),
  ch_afec      smallint check (ch_afec >= 0),
  -- Sem constraint de soma: a matriz oficial traz Farmacologia com CH/P 80 e TEO 100.
  imagem_url   text,                  -- 16:9, Supabase Storage. Preenchida na S4.
  imagem_alt   text,
  ativa        boolean not null default false, -- aparece no catalogo do aluno
  ordem        smallint not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index materias_periodo_idx on public.materias (periodo_id);
create index materias_codigo_idx  on public.materias (codigo);
create index materias_ativa_idx   on public.materias (ativa) where ativa;

create table public.materia_prerequisitos (
  materia_id      uuid not null references public.materias(id) on delete cascade,
  prerequisito_id uuid not null references public.materias(id) on delete cascade,
  primary key (materia_id, prerequisito_id),
  constraint prerequisito_nao_circular check (materia_id <> prerequisito_id)
);
create index materia_prereq_inverso_idx on public.materia_prerequisitos (prerequisito_id);

-- Assuntos com hierarquia (adjacency list). Os modulos serao definidos depois;
-- o parent_id ja permite modulo -> assunto -> subassunto sem nova migration.
create table public.assuntos (
  id          uuid primary key default gen_random_uuid(),
  materia_id  uuid not null references public.materias(id) on delete cascade,
  parent_id   uuid references public.assuntos(id) on delete cascade,
  nome        text not null,
  slug        text not null,
  descricao   text,
  ordem       smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (materia_id, slug),
  constraint assunto_nao_e_pai_de_si check (id <> parent_id)
);
create index assuntos_materia_idx on public.assuntos (materia_id);
create index assuntos_parent_idx  on public.assuntos (parent_id);

-- O pai de um assunto tem que ser da mesma materia.
create or replace function public.valida_assunto_pai()
returns trigger language plpgsql as $$
declare v_materia uuid;
begin
  if new.parent_id is null then return new; end if;
  select materia_id into v_materia from public.assuntos where id = new.parent_id;
  if v_materia is distinct from new.materia_id then
    raise exception 'Assunto pai pertence a outra materia';
  end if;
  return new;
end $$;

create trigger trg_valida_assunto_pai
  before insert or update on public.assuntos
  for each row execute function public.valida_assunto_pai();

-- =============================================================================
-- 3. FONTE BIBLIOGRAFICA (opcional)
-- Normalizada: livro e autor deixam de ser repetidos em cada linha de conteudo.
-- =============================================================================

create table public.livros (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  autores    text not null,
  edicao     text,
  ano        smallint,
  editora    text,
  created_at timestamptz not null default now(),
  unique (titulo, edicao)
);

create table public.capitulos (
  id         uuid primary key default gen_random_uuid(),
  livro_id   uuid not null references public.livros(id) on delete cascade,
  numero     text not null,
  titulo     text not null,
  unique (livro_id, numero)
);
create index capitulos_livro_idx on public.capitulos (livro_id);

-- =============================================================================
-- 4. CONTEUDO DE ESTUDO
-- Modelado para apostilas e mapas mentais, nao para capitulos de livro.
-- =============================================================================

create table public.materiais (
  id          uuid primary key default gen_random_uuid(),
  materia_id  uuid not null references public.materias(id) on delete cascade,
  assunto_id  uuid references public.assuntos(id) on delete set null,
  tipo        public.tipo_material not null,
  titulo      text not null,
  descricao   text,
  storage_path text,   -- arquivo no Supabase Storage (PDF de apostila, imagem de mapa)
  url_externa  text,
  status      public.status_revisao not null default 'rascunho',
  ordem       smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index materiais_materia_idx on public.materiais (materia_id);
create index materiais_assunto_idx on public.materiais (assunto_id);

create table public.conteudo_secoes (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais(id) on delete cascade,
  titulo      text not null,
  corpo       text not null,   -- markdown
  ordem       smallint not null default 0,
  created_at  timestamptz not null default now(),
  unique (material_id, ordem)
);
create index conteudo_secoes_material_idx on public.conteudo_secoes (material_id);

-- =============================================================================
-- 5. QUESTOES
-- =============================================================================

create table public.questoes (
  id           uuid primary key default gen_random_uuid(),
  materia_id   uuid not null references public.materias(id) on delete restrict,
  tipo         public.tipo_questao not null default 'multipla_escolha',
  dificuldade  public.dificuldade not null default 'medio',
  enunciado    text not null check (length(btrim(enunciado)) > 0),
  comentario   text,
  status       public.status_revisao not null default 'rascunho',
  -- Fonte opcional (decisao do usuario). Serve para importacao do legado.
  livro_id     uuid references public.livros(id) on delete set null,
  capitulo_id  uuid references public.capitulos(id) on delete set null,
  pagina       text,
  fonte_livre  text,
  origem_legado_id text,      -- id da questao no banco antigo, para a S2
  criado_por   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index questoes_materia_idx     on public.questoes (materia_id);
create index questoes_status_idx      on public.questoes (status);
create index questoes_dificuldade_idx on public.questoes (dificuldade);
create index questoes_materia_pub_idx on public.questoes (materia_id) where status = 'publicada';
create unique index questoes_origem_legado_idx on public.questoes (origem_legado_id)
  where origem_legado_id is not null;

-- Uma questao pode pertencer a varios assuntos.
create table public.questao_assuntos (
  questao_id uuid not null references public.questoes(id) on delete cascade,
  assunto_id uuid not null references public.assuntos(id) on delete cascade,
  primary key (questao_id, assunto_id)
);
create index questao_assuntos_assunto_idx on public.questao_assuntos (assunto_id);

-- Assertivas numeradas (I, II, III...). `correta` so e usada em tipo 'julgamento';
-- em 'assertivas' ela e opcional e serve de apoio ao comentario.
create table public.assertivas (
  id         uuid primary key default gen_random_uuid(),
  questao_id uuid not null references public.questoes(id) on delete cascade,
  ordem      smallint not null check (ordem between 1 and 10),
  numeral    text not null,
  texto      text not null check (length(btrim(texto)) > 0),
  correta    boolean,
  unique (questao_id, ordem)
);
create index assertivas_questao_idx on public.assertivas (questao_id);

-- Sempre 5 alternativas (a-e), exatamente uma correta.
create table public.alternativas (
  id         uuid primary key default gen_random_uuid(),
  questao_id uuid not null references public.questoes(id) on delete cascade,
  letra      char(1) not null check (letra in ('a','b','c','d','e')),
  texto      text not null check (length(btrim(texto)) > 0),
  correta    boolean not null default false,
  unique (questao_id, letra)
);
create index alternativas_questao_idx on public.alternativas (questao_id);
-- No maximo uma correta por questao.
create unique index alternativas_uma_correta_idx
  on public.alternativas (questao_id) where correta;

-- Publicar exige questao completa. Rascunho e precisa_revisao podem ficar incompletos.
create or replace function public.valida_publicacao_questao()
returns trigger language plpgsql as $$
declare
  n_alt smallint;
  n_cor smallint;
  n_ass smallint;
begin
  if new.status <> 'publicada' then return new; end if;

  select count(*), count(*) filter (where correta)
    into n_alt, n_cor
    from public.alternativas where questao_id = new.id;

  if n_alt <> 5 then
    raise exception 'Questao % nao pode ser publicada: tem % alternativas, exige 5', new.id, n_alt;
  end if;
  if n_cor <> 1 then
    raise exception 'Questao % nao pode ser publicada: tem % alternativa correta, exige 1', new.id, n_cor;
  end if;

  if new.tipo in ('assertivas', 'julgamento') then
    select count(*) into n_ass from public.assertivas where questao_id = new.id;
    if n_ass < 2 then
      raise exception 'Questao % do tipo % exige ao menos 2 assertivas', new.id, new.tipo;
    end if;
    if new.tipo = 'julgamento'
       and exists (select 1 from public.assertivas where questao_id = new.id and correta is null) then
      raise exception 'Questao % do tipo julgamento exige gabarito em toda assertiva', new.id;
    end if;
  end if;

  return new;
end $$;

create constraint trigger trg_valida_publicacao_questao
  after insert or update of status on public.questoes
  deferrable initially deferred
  for each row execute function public.valida_publicacao_questao();

-- =============================================================================
-- 6. USUARIOS, ACESSO E METAS
-- =============================================================================

create table public.usuarios (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null default '',
  email         text not null,
  avatar_url    text,
  papel         public.papel_usuario not null default 'aluno',
  periodo_id    uuid references public.periodos(id) on delete set null,
  instituicao   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index usuarios_papel_idx on public.usuarios (papel);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.usuarios (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', ''))
  on conflict (id) do nothing;

  insert into public.metas_usuario (usuario_id) values (new.id)
  on conflict (usuario_id) do nothing;

  return new;
end $$;

-- Regra: o aluno VE todas as materias, mas so ACESSA as que assinou.
create table public.acessos_materia (
  id         uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  materia_id uuid not null references public.materias(id) on delete cascade,
  origem     public.origem_acesso not null default 'compra',
  liberado_em timestamptz not null default now(),
  expira_em  timestamptz,
  ativo      boolean not null default true,
  observacao text,
  unique (usuario_id, materia_id)
);
create index acessos_usuario_idx on public.acessos_materia (usuario_id) where ativo;
create index acessos_materia_idx on public.acessos_materia (materia_id);

create table public.metas_usuario (
  usuario_id             uuid primary key references public.usuarios(id) on delete cascade,
  meta_semanal_questoes  smallint not null default 100 check (meta_semanal_questoes between 5 and 2000),
  minimo_diario_questoes smallint not null default 5 check (minimo_diario_questoes between 1 and 200),
  updated_at             timestamptz not null default now()
);
comment on column public.metas_usuario.minimo_diario_questoes is
  'Quantas questoes contam o dia no streak. Padrao 5, decisao do produto.';

-- =============================================================================
-- 7. SIMULADOS
-- =============================================================================

create table public.sessoes_simulado (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  escopo         public.escopo_simulado not null,
  materia_id     uuid references public.materias(id) on delete set null,
  assunto_id     uuid references public.assuntos(id) on delete set null,
  total_questoes smallint not null check (total_questoes between 1 and 200),
  indice_atual   smallint not null default 0,
  status         public.status_sessao not null default 'em_andamento',
  acertos        smallint not null default 0,
  tempo_segundos integer not null default 0,
  iniciada_em    timestamptz not null default now(),
  atualizada_em  timestamptz not null default now(),
  finalizada_em  timestamptz,
  constraint escopo_coerente check (
    (escopo = 'materia' and materia_id is not null) or
    (escopo = 'assunto' and assunto_id is not null) or
    (escopo = 'geral')
  )
);
create index sessoes_usuario_idx on public.sessoes_simulado (usuario_id, iniciada_em desc);
create index sessoes_abertas_idx on public.sessoes_simulado (usuario_id)
  where status = 'em_andamento';

-- Ordem das questoes e das alternativas fica gravada para a sessao poder ser retomada
-- exatamente como estava.
create table public.sessao_questoes (
  id                  uuid primary key default gen_random_uuid(),
  sessao_id           uuid not null references public.sessoes_simulado(id) on delete cascade,
  questao_id          uuid not null references public.questoes(id) on delete restrict,
  ordem               smallint not null,
  ordem_alternativas  uuid[] not null,
  unique (sessao_id, ordem),
  unique (sessao_id, questao_id)
);
create index sessao_questoes_sessao_idx on public.sessao_questoes (sessao_id);

create table public.respostas (
  id              uuid primary key default gen_random_uuid(),
  sessao_id       uuid not null references public.sessoes_simulado(id) on delete cascade,
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  questao_id      uuid not null references public.questoes(id) on delete restrict,
  alternativa_id  uuid references public.alternativas(id) on delete set null,
  correta         boolean not null default false,
  tempo_segundos  integer not null default 0 check (tempo_segundos >= 0),
  respondida_em   timestamptz not null default now(),
  unique (sessao_id, questao_id)
);
create index respostas_usuario_idx  on public.respostas (usuario_id, respondida_em desc);
create index respostas_questao_idx  on public.respostas (questao_id);
create index respostas_erradas_idx  on public.respostas (usuario_id) where not correta;

-- =============================================================================
-- 8. PROGRESSO E STREAK
-- =============================================================================

create table public.atividade_diaria (
  usuario_id           uuid not null references public.usuarios(id) on delete cascade,
  dia                  date not null,
  questoes_respondidas smallint not null default 0,
  acertos              smallint not null default 0,
  tempo_segundos       integer not null default 0,
  conta_streak         boolean not null default false,
  primary key (usuario_id, dia)
);
create index atividade_streak_idx on public.atividade_diaria (usuario_id, dia desc)
  where conta_streak;

-- Toda resposta alimenta a atividade do dia e reavalia o streak.
create or replace function public.registra_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_minimo smallint;
begin
  select minimo_diario_questoes into v_minimo
    from public.metas_usuario where usuario_id = new.usuario_id;
  v_minimo := coalesce(v_minimo, 5);

  insert into public.atividade_diaria (usuario_id, dia, questoes_respondidas, acertos, tempo_segundos)
  values (new.usuario_id, (new.respondida_em at time zone 'America/Bahia')::date,
          1, case when new.correta then 1 else 0 end, new.tempo_segundos)
  on conflict (usuario_id, dia) do update
    set questoes_respondidas = public.atividade_diaria.questoes_respondidas + 1,
        acertos              = public.atividade_diaria.acertos + case when new.correta then 1 else 0 end,
        tempo_segundos       = public.atividade_diaria.tempo_segundos + new.tempo_segundos;

  update public.atividade_diaria
     set conta_streak = (questoes_respondidas >= v_minimo)
   where usuario_id = new.usuario_id
     and dia = (new.respondida_em at time zone 'America/Bahia')::date;

  return new;
end $$;

create trigger trg_registra_atividade
  after insert on public.respostas
  for each row execute function public.registra_atividade();

-- =============================================================================
-- 9. CONQUISTAS
-- =============================================================================

create table public.conquistas (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nome       text not null,
  descricao  text not null,
  criterio   jsonb not null,   -- { "tipo": "streak_dias", "valor": 7 }
  ordem      smallint not null default 0,
  ativa      boolean not null default true
);

create table public.usuario_conquistas (
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  conquista_id   uuid not null references public.conquistas(id) on delete cascade,
  conquistada_em timestamptz not null default now(),
  primary key (usuario_id, conquista_id)
);
create index usuario_conquistas_usuario_idx on public.usuario_conquistas (usuario_id);

-- =============================================================================
-- 10. TURMAS (criadas, sem uso ate haver modelo de turma)
-- =============================================================================

create table public.turmas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  codigo     text not null unique,
  periodo_id uuid references public.periodos(id) on delete set null,
  criada_por uuid references public.usuarios(id) on delete set null,
  ativa      boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.turma_membros (
  turma_id   uuid not null references public.turmas(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  papel      public.papel_turma not null default 'aluno',
  entrou_em  timestamptz not null default now(),
  primary key (turma_id, usuario_id)
);
create index turma_membros_usuario_idx on public.turma_membros (usuario_id);

-- =============================================================================
-- 11. updated_at automatico
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_touch_materias    before update on public.materias
  for each row execute function public.touch_updated_at();
create trigger trg_touch_materiais   before update on public.materiais
  for each row execute function public.touch_updated_at();
create trigger trg_touch_questoes    before update on public.questoes
  for each row execute function public.touch_updated_at();
create trigger trg_touch_usuarios    before update on public.usuarios
  for each row execute function public.touch_updated_at();
create trigger trg_touch_metas       before update on public.metas_usuario
  for each row execute function public.touch_updated_at();

-- =============================================================================
-- 12. Criacao automatica do perfil ao cadastrar no Auth
-- =============================================================================

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- #############################################################################
-- #
-- #  PARTE 2/6 - ROW LEVEL SECURITY
-- #
-- #############################################################################

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


-- #############################################################################
-- #
-- #  PARTE 3/6 - GABARITO PROTEGIDO E RESPOSTAS
-- #
-- #############################################################################

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


-- #############################################################################
-- #
-- #  PARTE 4/6 - ADMIN E STORAGE
-- #
-- #############################################################################

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


-- #############################################################################
-- #
-- #  PARTE 5/6 - PROGRESSO E CONQUISTAS
-- #
-- #############################################################################

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


-- #############################################################################
-- #
-- #  PARTE 6/6 - SEED (MATRIZ CURRICULAR E CONQUISTAS)
-- #
-- #############################################################################

-- =============================================================================
-- EstudeVet v11 - Seed
-- Matriz Curricular 2023/1 - Medicina Veterinaria - Faculdade Pio Decimo.
-- Catalogo completo dos 10 periodos. `ativa = true` apenas nas materias que
-- entram no ar agora; as demais ficam cadastradas e desligadas.
-- Idempotente: pode rodar mais de uma vez.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- PERIODOS
-- ---------------------------------------------------------------------------
insert into public.periodos (numero, nome) values
  (1, '1o Periodo'),
  (2, '2o Periodo'),
  (3, '3o Periodo'),
  (4, '4o Periodo'),
  (5, '5o Periodo'),
  (6, '6o Periodo'),
  (7, '7o Periodo'),
  (8, '8o Periodo'),
  (9, '9o Periodo'),
  (10, '10o Periodo')
on conflict (numero) do nothing;

-- ---------------------------------------------------------------------------
-- MATERIAS
-- `codigo` nao e unico de proposito: a matriz repete MV200246 no 8o periodo.
-- Sem constraint de soma de carga horaria: a matriz traz Farmacologia com
-- CH/P 80 e TEO 100.
-- ---------------------------------------------------------------------------
insert into public.materias
  (periodo_id, codigo, nome, slug, creditos, ch_total, ch_teorica, ch_pratica, ch_afec, ativa, ordem)
values
  ((select id from public.periodos where numero = 1), 'MV200262', 'Anatomia Veterinária I', 'anatomia-veterinaria-i', 5, 100, 20, 60, 20, false, 1),
  ((select id from public.periodos where numero = 1), 'MV200178', 'Biofísica', 'biofisica', 2, 40, 36, 4, null, false, 2),
  ((select id from public.periodos where numero = 1), 'MV200177', 'Biologia Celular e Molecular', 'biologia-celular-e-molecular', 4, 80, 40, 20, 20, false, 3),
  ((select id from public.periodos where numero = 1), 'MV200252', 'Bioquímica Veterinária', 'bioquimica-veterinaria', 4, 80, 40, 40, null, false, 4),
  ((select id from public.periodos where numero = 1), 'MV200195', 'Informática Veterinária', 'informatica-veterinaria', 2, 40, 40, null, null, false, 5),
  ((select id from public.periodos where numero = 1), 'MV200173', 'Introdução à Medicina Veterinária', 'introducao-a-medicina-veterinaria', 1, 20, 16, 4, null, false, 6),
  ((select id from public.periodos where numero = 1), 'MV200269', 'Metodologia do Trabalho Científico', 'metodologia-do-trabalho-cientifico', 2, 40, 40, null, null, false, 7),
  ((select id from public.periodos where numero = 1), 'MV200254', 'Práticas Hospitalares', 'praticas-hospitalares', 2, 40, null, 20, 20, false, 8),
  ((select id from public.periodos where numero = 2), 'MV200263', 'Anatomia Veterinária II', 'anatomia-veterinaria-ii', 5, 100, 20, 60, 20, false, 1),
  ((select id from public.periodos where numero = 2), 'MV200253', 'Bioestatística', 'bioestatistica', 3, 60, 60, null, null, false, 2),
  ((select id from public.periodos where numero = 2), 'MV200255', 'Sociedade, Políticas Públicas e Extensão Rural', 'sociedade-politicas-publicas-e-extensao-rural', 2, 40, 40, null, null, false, 3),
  ((select id from public.periodos where numero = 2), 'MV200182', 'Histologia e Embriologia Veterinária', 'histologia-e-embriologia-veterinaria', 4, 80, 40, 40, null, false, 4),
  ((select id from public.periodos where numero = 2), 'MV200193', 'Imunologia Veterinária', 'imunologia-veterinaria', 3, 60, 60, null, null, false, 5),
  ((select id from public.periodos where numero = 2), 'MV200094', 'Parasitologia Veterinária', 'parasitologia-veterinaria', 4, 80, 50, 20, 10, false, 6),
  ((select id from public.periodos where numero = 3), 'MV200192', 'Bioclimatologia e Bem Estar Animal', 'bioclimatologia-e-bem-estar-animal', 2, 40, 36, 4, null, false, 1),
  ((select id from public.periodos where numero = 3), 'MV200188', 'Fisiologia Veterinária I', 'fisiologia-veterinaria-i', 4, 80, 80, null, null, false, 2),
  ((select id from public.periodos where numero = 3), 'MV200189', 'Microbiologia Veterinária', 'microbiologia-veterinaria', 5, 100, 40, 20, 20, false, 3),
  ((select id from public.periodos where numero = 3), 'MV200183', 'Genética Aplicada', 'genetica-aplicada', 3, 60, 40, null, 20, false, 4),
  ((select id from public.periodos where numero = 3), 'MV200190', 'Plantas Forrageiras e Pastagens', 'plantas-forrageiras-e-pastagens', 3, 60, 30, 20, 10, false, 5),
  ((select id from public.periodos where numero = 3), 'MV200202', 'Nutrição Animal', 'nutricao-animal', 3, 60, 60, null, null, false, 6),
  ((select id from public.periodos where numero = 3), 'MV200198', 'Doenças Parasitárias dos Animais Domésticos', 'doencas-parasitarias-dos-animais-domesticos', 4, 80, 60, null, 20, false, 7),
  ((select id from public.periodos where numero = 4), 'MV200217', 'Semiologia Básica', 'semiologia-basica', 3, 60, 40, 20, null, true, 1),
  ((select id from public.periodos where numero = 4), 'MV200264', 'Economia e Gestão Aplicada ao Agronegócio', 'economia-e-gestao-aplicada-ao-agronegocio', 2, 40, 30, null, 10, false, 2),
  ((select id from public.periodos where numero = 4), 'MV200258', 'Tecnologia de Produtos de Origem Animal', 'tecnologia-de-produtos-de-origem-animal', 3, 60, 60, null, null, false, 3),
  ((select id from public.periodos where numero = 4), 'MV200197', 'Fisiologia Veterinária II', 'fisiologia-veterinaria-ii', 5, 100, 100, null, null, false, 4),
  ((select id from public.periodos where numero = 4), 'MV200203', 'Melhoramento Animal', 'melhoramento-animal', 3, 60, 40, null, 20, false, 5),
  ((select id from public.periodos where numero = 4), 'MV200211', 'Alimentos e Alimentação', 'alimentos-e-alimentacao', 2, 40, 40, null, null, false, 6),
  ((select id from public.periodos where numero = 4), 'MV200213', 'Doenças Infecto-Contagiosas dos Animais Domésticos', 'doencas-infecto-contagiosas-dos-animais-domesticos', 4, 80, 40, 20, 20, false, 7),
  ((select id from public.periodos where numero = 5), 'MV200259', 'Zootecnia I', 'zootecnia-i', 3, 60, 50, 10, null, true, 1),
  ((select id from public.periodos where numero = 5), 'MV200206', 'Análises Clínicas Veterinárias', 'analises-clinicas-veterinarias', 3, 60, 40, 20, null, true, 2),
  ((select id from public.periodos where numero = 5), 'MV200265', 'Empreendedorismo e Gestão de Carreira Aplicada à Medicina Veterinária', 'empreendedorismo-e-gestao-de-carreira-aplicada-a-medicina-veterinaria', 3, 60, 40, null, 20, false, 3),
  ((select id from public.periodos where numero = 5), 'MV200257', 'Farmacologia Veterinária e Toxicologia', 'farmacologia-veterinaria-e-toxicologia', 4, 80, 100, null, null, true, 4),
  ((select id from public.periodos where numero = 5), 'MV200207', 'Patologia Veterinária Geral', 'patologia-veterinaria-geral', 4, 80, 40, 40, null, true, 5),
  ((select id from public.periodos where numero = 5), 'MV200235', 'Inspeção de Leite, Produtos Lácteos e Mel', 'inspecao-de-leite-produtos-lacteos-e-mel', 3, 60, 40, 10, 10, true, 6),
  ((select id from public.periodos where numero = 5), 'MV200256', 'Diagnóstico por Imagem', 'diagnostico-por-imagem', 3, 60, 40, 20, null, false, 7),
  ((select id from public.periodos where numero = 6), 'MV200230', 'Anestesiologia Veterinária', 'anestesiologia-veterinaria', 3, 60, 40, 10, 10, false, 1),
  ((select id from public.periodos where numero = 6), 'MV200214', 'Patologia Veterinária Especial', 'patologia-veterinaria-especial', 5, 100, 40, 60, null, false, 2),
  ((select id from public.periodos where numero = 6), 'MV200224', 'Técnica Cirúrgica', 'tecnica-cirurgica', 4, 80, 40, 40, null, false, 3),
  ((select id from public.periodos where numero = 6), 'MV2002015', 'Terapêutica Veterinária', 'terapeutica-veterinaria', 3, 60, 50, 10, null, false, 4),
  ((select id from public.periodos where numero = 6), 'MV200260', 'Zootecnia II', 'zootecnia-ii', 3, 60, 50, 10, null, false, 5),
  ((select id from public.periodos where numero = 6), 'MV200236', 'Inspeção de Carne, Pescados, Ovos e Derivados', 'inspecao-de-carne-pescados-ovos-e-derivados', 3, 60, 45, 5, 10, false, 6),
  ((select id from public.periodos where numero = 6), 'MV200266', 'Práticas Extensionistas', 'praticas-extensionistas', 2, 40, null, null, 40, false, 7),
  ((select id from public.periodos where numero = 7), 'MV200261', 'Clínica Cirúrgica de Cães e Gatos', 'clinica-cirurgica-de-caes-e-gatos', 4, 80, 40, 30, 10, false, 1),
  ((select id from public.periodos where numero = 7), 'MV200228', 'Ginecologia e Andrologia Veterinária', 'ginecologia-e-andrologia-veterinaria', 4, 80, 70, 10, null, false, 2),
  ((select id from public.periodos where numero = 7), 'MV200227', 'Epidemiologia, Zoonoses e Saúde Pública', 'epidemiologia-zoonoses-e-saude-publica', 4, 80, 50, 10, 20, false, 3),
  ((select id from public.periodos where numero = 7), 'MV200270', 'Semiologia e Clínica de Animais Silvestres', 'semiologia-e-clinica-de-animais-silvestres', 4, 80, 50, 10, 20, false, 4),
  ((select id from public.periodos where numero = 7), 'MV200229', 'Semiologia e Clínica Médica de Cães e Gatos I', 'semiologia-e-clinica-medica-de-caes-e-gatos-i', 3, 60, 40, 10, 10, false, 5),
  ((select id from public.periodos where numero = 7), 'MV200234', 'Semiologia e Clínica Médica de Ruminantes I', 'semiologia-e-clinica-medica-de-ruminantes-i', 3, 60, 40, 10, 10, false, 6),
  ((select id from public.periodos where numero = 8), 'MV200246', 'Clínica Médica de Ruminantes II', 'clinica-medica-de-ruminantes-ii', 3, 60, 50, 10, null, false, 1),
  ((select id from public.periodos where numero = 8), 'MV200246', 'Defesa Sanitária Animal', 'defesa-sanitaria-animal', 3, 60, 50, null, 10, false, 2),
  ((select id from public.periodos where numero = 8), 'MV200231', 'Obstetrícia Veterinária', 'obstetricia-veterinaria', 3, 60, 50, 10, null, false, 3),
  ((select id from public.periodos where numero = 8), 'MV200238', 'Ornitopatologia', 'ornitopatologia', 3, 60, 55, 5, null, false, 4),
  ((select id from public.periodos where numero = 8), 'MV200225', 'Aquicultura', 'aquicultura', 3, 60, 30, 10, 20, true, 5),
  ((select id from public.periodos where numero = 8), 'MV200267', 'Semiologia e Clínica Médica de Cães e Gatos II', 'semiologia-e-clinica-medica-de-caes-e-gatos-ii', 3, 60, 40, 10, 10, false, 6),
  ((select id from public.periodos where numero = 8), 'MV200242', 'Semiologia e Clínica Médica de Equídeos', 'semiologia-e-clinica-medica-de-equideos', 4, 80, 40, 20, 20, false, 7),
  ((select id from public.periodos where numero = 9), 'MV200243', 'Biotecnologia', 'biotecnologia', 3, 60, 40, 20, null, false, 1),
  ((select id from public.periodos where numero = 9), 'MV200244', 'Clínica Cirúrgica de Equídeos e Ruminantes', 'clinica-cirurgica-de-equideos-e-ruminantes', 4, 80, 70, 10, null, false, 2),
  ((select id from public.periodos where numero = 9), 'MV200240', 'Deontologia e Legislação Veterinária', 'deontologia-e-legislacao-veterinaria', 2, 40, 30, null, 10, false, 3),
  ((select id from public.periodos where numero = 9), 'MV200271', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Grandes Animais', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 4),
  ((select id from public.periodos where numero = 9), 'MV200274', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Pequenos Animais', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 5),
  ((select id from public.periodos where numero = 9), 'MV200275', 'Estágio Curricular Prático Hospitalar em Anestesiologia, Clínica Médica e Cirúrgica e Métodos Diagnósticos em Animais Silvestres', 'estagio-curricular-pratico-hospitalar-em-anestesiologia-clinica-medica', 2, 40, null, 40, null, false, 6),
  ((select id from public.periodos where numero = 9), 'MV200276', 'Estágio Curricular Prático Hospitalar em Produção, Reprodução e Obstetrícia', 'estagio-curricular-pratico-hospitalar-em-producao-reproducao-e-obstetr', 2, 40, null, 40, null, false, 7),
  ((select id from public.periodos where numero = 9), 'MV200277', 'Estágio Curricular Prático Hospitalar em Tecnologia, Inspeção Sanitária, Zoonoses, Epidemiologia e Saúde Pública', 'estagio-curricular-pratico-hospitalar-em-tecnologia-inspecao-sanitaria', 2, 40, null, 40, null, false, 8),
  ((select id from public.periodos where numero = 10), 'MV200247', 'Estágio Supervisionado II', 'estagio-supervisionado-ii', 10, 200, null, 200, null, false, 1),
  ((select id from public.periodos where numero = 10), 'MV200273', 'Trabalho de Conclusão de Curso', 'trabalho-de-conclusao-de-curso', 3, 60, 20, 40, null, false, 2),
  ((select id from public.periodos where numero = 10), 'MV200168', 'Língua Brasileira de Sinais', 'lingua-brasileira-de-sinais', 2, 40, null, 40, null, false, 3),
  ((select id from public.periodos where numero = 10), 'MV200251', 'Optativa I', 'optativa-i', 2, 40, 40, null, null, false, 4)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- PRE-REQUISITOS
-- "Vestibular" na matriz significa ausencia de pre-requisito: nao vira linha.
-- ---------------------------------------------------------------------------
insert into public.materia_prerequisitos (materia_id, prerequisito_id)
select m.id, p.id from (values
  ('anatomia-veterinaria-ii', 'anatomia-veterinaria-i'),
  ('histologia-e-embriologia-veterinaria', 'biologia-celular-e-molecular'),
  ('fisiologia-veterinaria-i', 'bioquimica-veterinaria'),
  ('fisiologia-veterinaria-i', 'histologia-e-embriologia-veterinaria'),
  ('nutricao-animal', 'bioquimica-veterinaria'),
  ('doencas-parasitarias-dos-animais-domesticos', 'parasitologia-veterinaria'),
  ('semiologia-basica', 'anatomia-veterinaria-ii'),
  ('tecnologia-de-produtos-de-origem-animal', 'microbiologia-veterinaria'),
  ('fisiologia-veterinaria-ii', 'fisiologia-veterinaria-i'),
  ('melhoramento-animal', 'bioestatistica'),
  ('melhoramento-animal', 'genetica-aplicada'),
  ('alimentos-e-alimentacao', 'nutricao-animal'),
  ('doencas-infecto-contagiosas-dos-animais-domesticos', 'microbiologia-veterinaria'),
  ('zootecnia-i', 'alimentos-e-alimentacao'),
  ('analises-clinicas-veterinarias', 'biologia-celular-e-molecular'),
  ('farmacologia-veterinaria-e-toxicologia', 'bioquimica-veterinaria'),
  ('patologia-veterinaria-geral', 'fisiologia-veterinaria-ii'),
  ('patologia-veterinaria-geral', 'anatomia-veterinaria-ii'),
  ('inspecao-de-leite-produtos-lacteos-e-mel', 'tecnologia-de-produtos-de-origem-animal'),
  ('diagnostico-por-imagem', 'anatomia-veterinaria-ii'),
  ('anestesiologia-veterinaria', 'farmacologia-veterinaria-e-toxicologia'),
  ('patologia-veterinaria-especial', 'patologia-veterinaria-geral'),
  ('tecnica-cirurgica', 'anatomia-veterinaria-ii'),
  ('terapeutica-veterinaria', 'farmacologia-veterinaria-e-toxicologia'),
  ('zootecnia-ii', 'alimentos-e-alimentacao'),
  ('inspecao-de-carne-pescados-ovos-e-derivados', 'tecnologia-de-produtos-de-origem-animal'),
  ('clinica-cirurgica-de-caes-e-gatos', 'tecnica-cirurgica'),
  ('ginecologia-e-andrologia-veterinaria', 'patologia-veterinaria-especial'),
  ('epidemiologia-zoonoses-e-saude-publica', 'doencas-infecto-contagiosas-dos-animais-domesticos'),
  ('epidemiologia-zoonoses-e-saude-publica', 'doencas-parasitarias-dos-animais-domesticos'),
  ('semiologia-e-clinica-de-animais-silvestres', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-de-animais-silvestres', 'semiologia-basica'),
  ('semiologia-e-clinica-de-animais-silvestres', 'terapeutica-veterinaria'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-i', 'terapeutica-veterinaria'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-ruminantes-i', 'terapeutica-veterinaria'),
  ('clinica-medica-de-ruminantes-ii', 'semiologia-e-clinica-medica-de-ruminantes-i'),
  ('defesa-sanitaria-animal', 'epidemiologia-zoonoses-e-saude-publica'),
  ('obstetricia-veterinaria', 'ginecologia-e-andrologia-veterinaria'),
  ('ornitopatologia', 'patologia-veterinaria-especial'),
  ('aquicultura', 'alimentos-e-alimentacao'),
  ('semiologia-e-clinica-medica-de-caes-e-gatos-ii', 'semiologia-e-clinica-medica-de-caes-e-gatos-i'),
  ('semiologia-e-clinica-medica-de-equideos', 'patologia-veterinaria-especial'),
  ('semiologia-e-clinica-medica-de-equideos', 'semiologia-basica'),
  ('semiologia-e-clinica-medica-de-equideos', 'terapeutica-veterinaria'),
  ('biotecnologia', 'ginecologia-e-andrologia-veterinaria'),
  ('clinica-cirurgica-de-equideos-e-ruminantes', 'tecnica-cirurgica')
) as v(materia_slug, prereq_slug)
join public.materias m on m.slug = v.materia_slug
join public.materias p on p.slug = v.prereq_slug
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- CONQUISTAS
-- Sem emoji. O desenho da medalha e feito em SVG na paleta da marca (S6).
-- ---------------------------------------------------------------------------
insert into public.conquistas (codigo, nome, descricao, criterio, ordem) values
  ('primeiro_simulado', 'Primeiro passo', 'Concluiu o primeiro simulado.',
   '{"tipo":"simulados_concluidos","valor":1}', 1),
  ('streak_3',   'Tres dias seguidos', 'Bateu o minimo diario por 3 dias seguidos.',
   '{"tipo":"streak_dias","valor":3}', 2),
  ('streak_7',   'Uma semana inteira', 'Bateu o minimo diario por 7 dias seguidos.',
   '{"tipo":"streak_dias","valor":7}', 3),
  ('streak_30',  'Um mes de constancia', 'Bateu o minimo diario por 30 dias seguidos.',
   '{"tipo":"streak_dias","valor":30}', 4),
  ('meta_semanal_1', 'Meta batida', 'Cumpriu a meta semanal de questoes uma vez.',
   '{"tipo":"metas_semanais","valor":1}', 5),
  ('meta_semanal_4', 'Mes no alvo', 'Cumpriu a meta semanal quatro semanas seguidas.',
   '{"tipo":"metas_semanais_seguidas","valor":4}', 6),
  ('questoes_100',  'Cem questoes', 'Respondeu 100 questoes.',
   '{"tipo":"questoes_respondidas","valor":100}', 7),
  ('questoes_500',  'Quinhentas questoes', 'Respondeu 500 questoes.',
   '{"tipo":"questoes_respondidas","valor":500}', 8),
  ('questoes_1000', 'Mil questoes', 'Respondeu 1000 questoes.',
   '{"tipo":"questoes_respondidas","valor":1000}', 9),
  ('acerto_80',  'Mira calibrada', 'Fechou um simulado de 30 questoes com 80% ou mais.',
   '{"tipo":"acerto_simulado","valor":80,"minimo_questoes":30}', 10),
  ('materia_dominada', 'Materia dominada', 'Atingiu 85% de acerto em uma materia com ao menos 100 questoes respondidas.',
   '{"tipo":"acerto_materia","valor":85,"minimo_questoes":100}', 11),
  ('virada_de_erro', 'Erro corrigido', 'Acertou 20 questoes que ja tinha errado antes.',
   '{"tipo":"erros_revertidos","valor":20}', 12)
on conflict (codigo) do nothing;


-- =============================================================================
-- FIM. Confira com as consultas abaixo (rode separadamente).
--
--   select count(*) as materias from public.materias;            -- 67
--   select count(*) as ativas from public.materias where ativa;  --  7
--   select count(*) as conquistas from public.conquistas;        -- 12
--   select tablename from pg_tables
--     where schemaname = 'public' and not rowsecurity;           -- zero linhas
-- =============================================================================
