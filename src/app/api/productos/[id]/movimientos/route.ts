import type { NextRequest } from 'next/server'
import { movimientoApiSchema } from '@/lib/api-schemas'
import { leerPaginacion } from '@/lib/paginacion'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { listarMovimientos, moverStock, obtenerMovimiento } from '@/server/productos'

export async function GET(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, params }) => {
    const id = idDe(params)
    const { page, pageSize } = leerPaginacion(new URL(req.url).searchParams)
    return json(await listarMovimientos(id, { page, pageSize }))
  })
}

export async function POST(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const datos = await cuerpo(req, movimientoApiSchema)
    const movimiento = await moverStock(sesion, id, {
      tipo: datos.tipo,
      cantidad: datos.cantidad,
      motivo: datos.motivo,
      observacion: datos.observacion ?? null,
    })
    return json(await obtenerMovimiento(movimiento.id), 201)
  }, { admin: true })
}
