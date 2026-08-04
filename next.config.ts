import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Capas das materias vem do Storage do proprio projeto. O host e lido do
  // ambiente para nao ficar hardcoded aqui.
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? [
          {
            protocol: 'https',
            hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
}

export default config
