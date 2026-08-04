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
