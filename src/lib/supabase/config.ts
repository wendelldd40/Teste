/**
 * Configuracao de conexao com o Supabase.
 *
 * A URL e a chave `anon` estao embutidas aqui de proposito. Elas sao
 * PUBLICAS por natureza: vao para o bundle do navegador em qualquer app
 * Next, e qualquer pessoa consegue le-las abrindo o DevTools. Nao ha nada a
 * esconder nelas - quem protege os dados e a RLS no banco, nao o segredo
 * destes dois valores.
 *
 * O ganho e concreto: o app sobe sem depender de variavel de ambiente
 * cadastrada no painel. Esquecer de cadastrar era o que derrubava o deploy
 * inteiro com 500 em todas as rotas.
 *
 * A variavel de ambiente continua tendo prioridade. Quando existir, ela
 * vence - entao da para apontar para outro projeto (staging, um fork da
 * turma) sem tocar no codigo.
 *
 * ATENCAO: a chave `service_role` NAO entra aqui, nem em nenhum arquivo
 * versionado. Ela passa por cima da RLS. Vive so no .env.local e nos
 * scripts que rodam na sua maquina.
 */

const URL_PADRAO = 'https://gfshmgllnrzjxuutqrte.supabase.co'

const ANON_PADRAO =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdmc2htZ2xsbnJ6anh1dXRxcnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1Mjc2ODAsImV4cCI6MjEwMTEwMzY4MH0.8LLyndO4rHqJWq5BkdfgqOLGERQ3JSmLRuD6q4IzQC4'

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || URL_PADRAO

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ANON_PADRAO

/** Indica se a conexao veio do ambiente ou do valor embutido. */
export const CONFIG_VEIO_DO_AMBIENTE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
