import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearNumero, formatearPesos } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { ApiError } from '@/lib/errors'
import { obtenerVenta } from '@/server/ventas'

export const dynamic = 'force-dynamic'

const nombrePago: Record<string, string> = {
  contado: 'Contado',
  tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
}

export default async function Comprobante({ params }: { params: Promise<{ id: string }> }) {
  const { id: texto } = await params
  const id = Number(texto)

  if (!Number.isInteger(id) || id <= 0) notFound()

  let venta
  try {
    venta = await obtenerVenta(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const { factura, items } = venta
  const unidades = items.reduce((suma, item) => suma + item.cantidad, 0)

  return (
    <div className="max-w-3xl">
      <Link
        href="/ventas"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Ventas
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-stone-500">Comprobante interno</p>
          <h1 className="mt-1 font-mono text-3xl font-semibold tracking-tight">
            {formatearNumero(factura.puntoVenta, factura.numero)}
          </h1>
          <p className="mt-2 text-stone-600">{formatearFecha(factura.fecha)}</p>
        </div>
        <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">
          {factura.estado === 'emitida' ? 'Emitida' : 'Anulada'}
        </span>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-500">Cliente</p>
          {factura.clienteId ? (
            <Link
              href={`/clientes/${factura.clienteId}`}
              className="mt-1 block font-medium underline-offset-4 hover:underline"
            >
              {factura.clienteNombre}
            </Link>
          ) : (
            <p className="mt-1 font-medium">Consumidor final</p>
          )}
          {factura.clienteDocumento ? (
            <p className="font-mono text-xs text-stone-500">{factura.clienteDocumento}</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-500">Forma de pago</p>
          <p className="mt-1 font-medium">{nombrePago[factura.formaPago] ?? factura.formaPago}</p>
          <p className="text-xs text-stone-500">Registró {factura.usuarioNombre ?? 'un usuario'}</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <th className="px-4 py-2.5 font-medium">Descripción</th>
              <th className="px-4 py-2.5 font-medium">Código</th>
              <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
              <th className="px-4 py-2.5 text-right font-medium">Precio</th>
              <th className="px-4 py-2.5 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5 font-medium">{item.descripcion}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-stone-500">{item.codigo}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{item.cantidad}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap tabular-nums">
                  {formatearPesos(item.precioUnitario)}
                </td>
                <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">
                  {formatearPesos(item.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <dl className="w-full max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-stone-500">Unidades</dt>
            <dd className="tabular-nums">{unidades}</dd>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatearPesos(factura.total)}</dd>
          </div>
          {factura.formaPago === 'contado' && factura.montoRecibido !== null ? (
            <>
              <div className="flex justify-between text-stone-600">
                <dt>Recibido</dt>
                <dd className="tabular-nums">{formatearPesos(factura.montoRecibido)}</dd>
              </div>
              <div className="flex justify-between text-stone-600">
                <dt>Vuelto</dt>
                <dd className="tabular-nums">{formatearPesos(factura.vuelto ?? 0)}</dd>
              </div>
            </>
          ) : null}
          {factura.formaPago === 'cuenta_corriente' ? (
            <p className="border-t border-stone-200 pt-2 text-xs text-stone-500">
              La deuda quedó registrada en la cuenta corriente del cliente.
            </p>
          ) : null}
        </dl>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 border-t border-stone-200 pt-5">
        <Link
          href="/ventas/nueva"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nueva venta
        </Link>
        <Link
          href="/ventas"
          className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium hover:bg-stone-100"
        >
          Ver todas las ventas
        </Link>
        {factura.clienteId ? (
          <Link
            href={`/clientes/${factura.clienteId}`}
            className="rounded-md px-4 py-2.5 text-sm text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Ver cuenta del cliente
          </Link>
        ) : null}
      </div>
    </div>
  )
}
