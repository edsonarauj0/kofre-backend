import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Não empacotar firebase-admin — tratar como dependência externa de servidor.
  // Isso garante que o módulo seja carregado em runtime, não em build time.
  serverExternalPackages: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/auth', 'firebase-admin/firestore'],

  // Ignorar erros de TypeScript no build (já validamos com tsc --noEmit)
  typescript: {
    ignoreBuildErrors: false,
  },
}

export default nextConfig
