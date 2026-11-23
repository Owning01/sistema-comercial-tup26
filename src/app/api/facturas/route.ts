import type { NextRequest } from 'next/server'
import { ventaApiSchema } from '@/lib/api-schemas'
import { leerPaginacion } from '@/lib/paginacion'
import { cuerpo, fechaDe, json, manejar, numeroDe, textoDe } from '@/server/api'
import { listarVentas, obtenerFacturaPublica, registrarVenta } from '@/server/ventas'

const FORMAS = ['contado', 'tarjeta', 'cuenta_corriente']
const ESTADOS = ['emitida', 'anulada']

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ req }) => {
    const params = new URL(req.url).searchParams
    const { page, pageSize } = leerPaginacion(params)
    const forma = textoDe(params, 'forma')
    const estado = textoDe(params, 'estado')

    return json(
      await listarVentas(
        {
          q: textoDe(params, 'q'),
          desde: fechaDe(params, 'desde'),
          hasta: fechaDe(params, 'hasta', true),
          clienteId: numeroDe(params, 'clienteId'),
          vendedorId: numeroDe(params, 'vendedorId'),
          forma: forma && FORMAS.includes(forma) ? forma : undefined,
          estado: estado && ESTADOS.includes(estado) ? estado : undefined,
        },
        { page, pageSize },
      ),
    )
  })
}

export async function POST(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const datos = await cuerpo(req, ventaApiSchema)

    const factura = await registrarVenta(sesion, {
      clienteId: datos.clienteId,
      formaPago: datos.pago.forma,
      montoRecibido: datos.pago.forma === 'contado' ? (datos.pago.montoRecibido ?? null) : null,
      tarjeta: datos.pago.forma === 'tarjeta' ? datos.pago.tarjeta : null,
      items: datos.items,
    })

    return json(await obtenerFacturaPublica(factura.id), 201)
  })
}
