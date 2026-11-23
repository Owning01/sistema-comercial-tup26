import type { NextRequest } from 'next/server'
import { idDe, json, manejar, type Contexto } from '@/server/api'
import { resetPassword } from '@/server/usuarios'

export async function POST(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ sesion, params }) => {
    const id = idDe(params)
    const resultado = await resetPassword(sesion, id)
    return json(resultado)
  }, { admin: true })
}
