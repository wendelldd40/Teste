'use client'

/**
 * Entrar.
 *
 * Fica fora do shell (grupo (auth)), porque quem nao entrou nao tem menu.
 * O `proximo` da URL preserva para onde a pessoa estava indo - quem clicou
 * num link de simulado e caiu no login volta para o simulado, nao para o
 * dashboard.
 */

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBrowserClient } from '@/lib/supabase/client'
import { normalizaErro } from '@/lib/errors'
import { Botao, Campo, Entrada, Erro } from '@/components/ui'

type Modo = 'entrar' | 'criar'

function Formulario() {
  const router = useRouter()
  const parametros = useSearchParams()
  const proximo = parametros.get('proximo') ?? '/dashboard'

  const [modo, setModo] = useState<Modo>('entrar')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<{ mensagem: string; detalhe?: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  async function enviar() {
    setErro(null)
    setAviso(null)

    if (!email.trim() || senha.length < 6) {
      setErro({
        mensagem: 'Confira os campos.',
        detalhe: 'A senha precisa de pelo menos 6 caracteres.',
      })
      return
    }

    setEnviando(true)
    const sb = getBrowserClient()

    try {
      if (modo === 'criar') {
        const { error } = await sb.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        })
        if (error) throw error
        setAviso('Conta criada. Confira seu email para confirmar o cadastro.')
        setEnviando(false)
        return
      }

      const { error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (error) throw error

      router.push(proximo)
      router.refresh()
    } catch (e) {
      const normalizado = normalizaErro(e, 'entrar')
      setErro({
        mensagem:
          modo === 'entrar'
            ? 'Email ou senha não conferem.'
            : 'Não foi possível criar a conta.',
        detalhe: normalizado.detalhe,
      })
      setEnviando(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <p className="font-titulo text-2xl font-extrabold tracking-tight text-white">
          EstudeVet
        </p>
        <p className="mt-0.5 font-corpo text-sm text-white/50">Universo ZeloVet</p>
      </div>

      <div className="rounded-cartao bg-cartao p-6 shadow-flutuante">
        <h1 className="font-titulo text-lg font-bold text-tinta-forte">
          {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
        </h1>

        <div className="mt-5 space-y-4">
          {modo === 'criar' && (
            <Campo rotulo="Nome">
              <Entrada
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Como você quer ser chamado"
              />
            </Campo>
          )}

          <Campo rotulo="Email">
            <Entrada
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
            />
          </Campo>

          <Campo rotulo="Senha" dica={modo === 'criar' ? 'Ao menos 6 caracteres.' : undefined}>
            <Entrada
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void enviar()
              }}
            />
          </Campo>

          {erro && <Erro mensagem={erro.mensagem} detalhe={erro.detalhe} />}
          {aviso && (
            <p role="status" className="font-corpo text-sm font-semibold text-acao">
              {aviso}
            </p>
          )}

          <Botao carregando={enviando} className="w-full" onClick={() => void enviar()}>
            {modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Botao>
        </div>

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'entrar' ? 'criar' : 'entrar')
            setErro(null)
            setAviso(null)
          }}
          className="mt-5 w-full font-corpo text-sm text-tinta-media transition-colors hover:text-acao focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acao"
        >
          {modo === 'entrar' ? 'Não tem conta? Criar uma.' : 'Ja tem conta? Entrar.'}
        </button>
      </div>
    </div>
  )
}

export default function PaginaEntrar() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-casca px-5 py-10">
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </div>
  )
}
