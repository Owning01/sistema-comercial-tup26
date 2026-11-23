import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // La base local y Turso comparten el mismo driver. El cliente libSQL usa
  // modulos nativos opcionales, asi que Next lo deja fuera del bundle.
  serverExternalPackages: ['@libsql/client'],
  // El indicador flotante tapa la barra lateral en desarrollo.
  devIndicators: false,
}

export default nextConfig
