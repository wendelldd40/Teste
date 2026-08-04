/**
 * Repositorio de materiais de estudo.
 *
 * O conteudo da v11 nasce de apostilas e mapas mentais, nao de capitulos de
 * livro - por isso `materiais` e nao `conteudo_estudo`. A RLS so devolve
 * material publicado de materia com acesso ativo.
 */

import type { Material, ConteudoSecao } from '@/types/database'
import { consulta, type ClienteSupabase, type Resultado } from './base'

export async function materiaisDaMateria(
  materiaId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<Material[]>> {
  return consulta<Material[]>(
    'materiais.daMateria',
    (sb) =>
      sb
        .from('materiais')
        .select('*')
        .eq('materia_id', materiaId)
        .eq('status', 'publicada')
        .order('ordem'),
    cliente
  )
}

export async function secoesDoMaterial(
  materialId: string,
  cliente?: ClienteSupabase
): Promise<Resultado<ConteudoSecao[]>> {
  return consulta<ConteudoSecao[]>(
    'materiais.secoes',
    (sb) =>
      sb
        .from('conteudo_secoes')
        .select('*')
        .eq('material_id', materialId)
        .order('ordem'),
    cliente
  )
}
