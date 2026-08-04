/**
 * Client de server component e route handler.
 * Le a sessao dos cookies: a RLS continua valendo, o usuario e o mesmo.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export async function getServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component nao pode escrever cookie. O supabase-js renova a
          // sessao pelo navegador; aqui o silencio e proposital.
        }
      },
    },
  })
}
