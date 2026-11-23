import type { NextRequest } from 'next/server'
import { clienteApiSchema } from '@/lib/api-schemas'
import { leerPaginacion } from '@/lib/paginacion'
import {
  booleanoDe,
  cuerpo,
  json,
  manejar,
  textoDe,
} from '@/server/api'
import { crearCliente, listarClientes } from '@/server/clientes'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ req }) => {
    const params = new URL(req.url).searchParams
    const { page, pageSize } = leerPaginacion(params)
    const orden = params.get('orden') === 'saldo' ? 'saldo' : 'nombre'

    return json(
      await listarClientes({
        q: textoDe(params, 'q'),
        conDeuda: booleanoDe(params, 'conDeuda'),
        orden,
        page,
        pageSize,
      }),
    )
  })
}

export async function POST(req: NextRequest) {
  return manejar(req, {}, async ({ req }) => {
    const datos = await cuerpo(req, clienteApiSchema)
    const creado = await crearCliente({
      tipoDoc: datos.tipoDoc,
      nroDoc: datos.nroDoc,
      nombre: datos.nombre,
      domicilio: datos.domicilio ?? null,
      telefono: datos.telefono ?? null,
      email: datos.email ?? null,
      cuentaCorriente: datos.cuentaCorriente ?? false,
      limiteCredito: datos.limiteCredito ?? null,
    })
    return json(creado, 201)
  })
}
