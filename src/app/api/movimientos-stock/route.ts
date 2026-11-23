import type { NextRequest } from 'next/server'
import { leerPaginacion } from '@/lib/paginacion'
import { fechaDe, json, manejar, numeroDe, textoDe } from '@/server/api'
import { listarMovimientosGlobal } from '@/server/productos'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ req }) => {
    const params = new URL(req.url).searchParams
    const { page, pageSize } = leerPaginacion(params)

    const resultado = await listarMovimientosGlobal(
      {
        q: textoDe(params, 'q'),
        tipo: textoDe(params, 'tipo'),
        productoId: numeroDe(params, 'productoId'),
        desde: fechaDe(params, 'desde'),
        hasta: fechaDe(params, 'hasta', true),
      },
      { page, pageSize },
    )

    return json(resultado)
  })
}
