/**
 * Guardas de servidor.
 *
 * Esconder o item de menu nao e protecao: qualquer pessoa digita a URL. Estas
 * funcoes rodam no servidor e sao chamadas DUAS vezes - no layout da rota e
 * dentro de cada Server Action. A rota barra a navegacao; a action barra a
 * chamada direta, que e o caminho que um menu escondido nao cobre.
 *
 * A RLS continua sendo a ultima linha: mesmo que as duas falhem, o banco
 * recusa.
 */
import { redirect } from 'next/navigation'
import { getUsuarioAtual } from './session'
import { AppError } from '@/lib/errors'
import type { Usuario } from '@/types/database'

/** Para uso em layout e page: redireciona quem nao pode estar ali. */
export async function requireAdminPagina(): Promise<Usuario> {
  const usuario = await getUsuarioAtual()
  if (!usuario) redirect('/entrar')
  if (usuario.papel !== 'admin') redirect('/dashboard')
  return usuario
}

/** Para uso em Server Action: lanca, porque nao ha navegacao a fazer. */
export async function requireAdmin(): Promise<Usuario> {
  const usuario = await getUsuarioAtual()
  if (!usuario) {
    throw new AppError('sem_sessao', 'Sua sessao expirou. Entre novamente.')
  }
  if (usuario.papel !== 'admin') {
    throw new AppError('sem_permissao', 'Voce nao tem permissao para isso.')
  }
  return usuario
}

export async function requireUsuario(): Promise<Usuario> {
  const usuario = await getUsuarioAtual()
  if (!usuario) {
    throw new AppError('sem_sessao', 'Sua sessao expirou. Entre novamente.')
  }
  return usuario
}
