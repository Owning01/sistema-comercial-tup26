import type { NextRequest } from 'next/server'
import { clientePatchSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { editarCliente, obtenerCliente } from '@/server/clientes'

type TipoDocumento = 'DNI' | 'CUIT' | 'CUIL' | 'PASAPORTE'

export async function GET(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ params }) => {
    const id = idDe(params)
    return json(await obtenerCliente(id))
  })
}

export async function PATCH(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, params }) => {
    const id = idDe(params)
    const actual = await obtenerCliente(id)
    const datos = await cuerpo(req, clientePatchSchema)

    const completo = {
      tipoDoc: (datos.tipoDoc ?? actual.tipoDoc) as TipoDocumento,
      nroDoc: datos.nroDoc ?? actual.nroDoc,
      nombre: datos.nombre ?? actual.nombre,
      domicilio: datos.domicilio === undefined ? actual.domicilio : datos.domicilio,
      telefono: datos.telefono === undefined ? actual.telefono : datos.telefono,
      email: datos.email === undefined ? actual.email : datos.email,
      cuentaCorriente: datos.cuentaCorriente ?? actual.cuentaCorriente,
      limiteCredito:
        datos.limiteCredito === undefined ? actual.limiteCredito : datos.limiteCredito,
      activo: datos.activo ?? actual.activo,
    }

    return json(await editarCliente(id, completo))
  })
}
