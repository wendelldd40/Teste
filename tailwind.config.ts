import type { Config } from 'tailwindcss'

/**
 * Tokens da marca. Nenhuma cor solta no JSX: se nao esta aqui, nao existe.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        casca: '#0C3328',      // verde profundo, shell
        acao: '#12876C',       // teal, acao
        ouro: '#C99D66',       // XP, streak, conquistas
        'ouro-tinta': '#7A5C33', // texto sobre fundo dourado claro (contraste AA)
        creme: '#F7F5F0',      // fundo
        cartao: '#FFFFFF',
        tinta: {
          forte: '#14231D',
          media: '#44594E',
          fraca: '#75887D',
        },
      },
      fontFamily: {
        titulo: ['var(--fonte-titulo)', 'Plus Jakarta Sans', 'sans-serif'],
        corpo: ['var(--fonte-corpo)', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '16px',
        cartao: '16px',
        pequeno: '10px',
      },
      boxShadow: {
        cartao: '0 1px 2px rgba(12, 51, 40, 0.04), 0 8px 24px rgba(12, 51, 40, 0.06)',
        flutuante: '0 12px 32px rgba(12, 51, 40, 0.14)',
      },
    },
  },
  plugins: [],
} satisfies Config
