/**
 * Client com service role: passa POR CIMA da RLS.
 *
 * NUNCA importe este arquivo em codigo que roda no browser. Ele so pode
 * aparecer em Server Action, route handler ou script. O import de
 * 'server-only' faz o build quebrar se alguem tentar.
 *
 * A chave nao tem valor embutido, ao contrario da anon: ela e secreta de
 * verdade e so existe no .env.local.
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { SUPABASE_URL } from './config'

export function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ausente. Ela vive so no .env.local, nunca no repositorio.'
    )
  }

  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false } })
}
