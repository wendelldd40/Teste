/**
 * Sessao e usuario atual, sempre pelo servidor.
 */
import { getServerClient } from '@/lib/supabase/server'
import type { Usuario } from '@/types/database'

export async function getUsuarioAtual(): Promise<Usuario | null> {
  const sb = await getServerClient()

  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return null

  const { data } = await sb.from('usuarios').select('*').eq('id', user.id).single()
  return data ?? null
}

export async function estaAutenticado(): Promise<boolean> {
  const sb = await getServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  return user !== null
}
