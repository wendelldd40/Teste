/**
 * Client de browser. Importado SO por repositorios.
 * Nenhum componente deve importar este arquivo.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

let instancia: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getBrowserClient() {
  if (!instancia) {
    instancia = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return instancia
}
