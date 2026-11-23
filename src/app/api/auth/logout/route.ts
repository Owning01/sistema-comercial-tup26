import type { NextRequest } from 'next/server'
import { borrarSesion } from '@/server/auth'
import { manejar, sinContenido } from '@/server/api'

export async function POST(req: NextRequest) {
  return manejar(req, {}, async () => {
    await borrarSesion()
    return sinContenido()
  })
}
