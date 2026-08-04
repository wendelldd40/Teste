/**
 * Repositorio de conquistas.
 *
 * A concessao acontece no servidor (avaliar_conquistas). Aqui so lemos o
 * catalogo e o que a pessoa ja ganhou.
 */

import type { Conquista, UsuarioConquista } from '@/types/database'
import { consulta, type ClienteSupabase, type Resultado } from './base'

export async function listar(cliente?: ClienteSupabase): Promise<Resultado<Conquista[]>> {
  return consulta<Conquista[]>(
    'conquistas.listar',
    (sb) => sb.from('conquistas').select('*').eq('ativa', true).order('ordem'),
    cliente
  )
}

export async function minhas(
  cliente?: ClienteSupabase
): Promise<Resultado<Pick<UsuarioConquista, 'conquista_id' | 'conquistada_em'>[]>> {
  return consulta<Pick<UsuarioConquista, 'conquista_id' | 'conquistada_em'>[]>(
    'conquistas.minhas',
    (sb) => sb.from('usuario_conquistas').select('conquista_id, conquistada_em'),
    cliente
  )
}
