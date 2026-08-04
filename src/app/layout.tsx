import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const titulo = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--fonte-titulo',
  display: 'swap',
})

const corpo = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-corpo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EstudeVet',
  description: 'Plataforma de estudos para Medicina Veterinaria.',
}

export const viewport: Viewport = {
  themeColor: '#0C3328',
}

export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${titulo.variable} ${corpo.variable}`}>
      <body>{children}</body>
    </html>
  )
}
