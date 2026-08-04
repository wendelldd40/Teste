'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Botao } from '@/components/ui'
import { getBrowserClient } from '@/lib/supabase/client'

export function Sair() {
  const router = useRouter()
  const [saindo, iniciar] = useTransition()

  return (
    <Botao
      variante="perigo"
      carregando={saindo}
      onClick={() =>
        iniciar(async () => {
          await getBrowserClient().auth.signOut()
          router.push('/entrar')
          router.refresh()
        })
      }
    >
      Sair da conta
    </Botao>
  )
}
