import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearPesos, formatearNumero } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { ApiError } from '@/lib/errors'
import { actualizarCliente } from '@/server/actions/clientes'
import { listarMovimientosCuenta, obtenerCliente } from '@/server/clientes'
import { FormularioCliente } from '../form'
import { FormularioPago } from './pago-form'

export const dynamic = 'force-dynamic'

export default async function DetalleCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id: texto } = await params
  const id = Number(texto)

  if (!Number.isInteger(id) || id <= 0) notFound()

  let cliente
  try {
    cliente = await obtenerCliente(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const movimientos = await listarMovimientosCuenta(id)
  const excedido =
    cliente.cuentaCorriente &&
    cliente.limiteCredito !== null &&
    cliente.saldo > cliente.limiteCredito

  return (
    <div className="max-w-5xl">
      <Link
        href="/clientes"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Clientes
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-stone-500">
            {cliente.tipoDoc} {cliente.nroDoc}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{cliente.nombre}</h1>
          <p className="mt-2 text-stone-600">
            {cliente.telefono ?? cliente.email ?? 'Sin datos de contacto'}
            {cliente.activo ? '' : ' · Cliente inactivo'}
            {cliente.cuentaCorriente ? '' : ' · Sin cuenta corriente'}
          </p>
        </div>

        <div
          className={
            excedido
              ? 'rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-right'
              : 'rounded-lg border border-stone-200 bg-white px-4 py-3 text-right'
          }
        >
          <p className="text-xs text-stone-500">Saldo deudor</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{formatearPesos(cliente.saldo)}</p>
          <p className="text-xs text-stone-500">
            {cliente.cuentaCorriente
              ? cliente.limiteCredito === null
                ? 'sin límite'
                : `límite ${formatearPesos(cliente.limiteCredito)}`
              : 'cuenta no habilitada'}
          </p>
        </div>
      </div>

      {excedido ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          El saldo supera el límite de crédito. No se pueden registrar nuevas ventas en cuenta
          corriente hasta que se acredite un pago.
        </p>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Editar cliente</h2>
          <div className="mt-4">
            <FormularioCliente accion={actualizarCliente} cliente={cliente} />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Registrar pago</h2>
          <p className="mt-1 mb-4 text-sm text-stone-600">
            El pago acredita el saldo global del cliente. No se asigna a una factura concreta.
          </p>
          <FormularioPago clienteId={cliente.id} saldo={cliente.saldo} />
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
          Historial de cuenta corriente
        </h2>

        {movimientos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Todavía no hay movimientos en la cuenta.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 sm:hidden">
              {movimientos.map((movimiento) => (
                <li key={movimiento.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={
                        movimiento.tipo === 'debito'
                          ? 'inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800'
                          : 'inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
                      }
                    >
                      {movimiento.tipo === 'debito' ? 'Deuda' : 'Pago'}
                    </span>
                    <span
                      className={
                        movimiento.tipo === 'debito'
                          ? 'text-sm font-medium text-red-700 tabular-nums'
                          : 'text-sm font-medium text-emerald-700 tabular-nums'
                      }
                    >
                      {movimiento.tipo === 'debito' ? '+' : '−'}
                      {formatearPesos(movimiento.importe)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{movimiento.descripcion ?? 'Movimiento'}</p>
                  <p className="mt-2 flex justify-between gap-3 text-xs text-stone-500">
                    <span className="tabular-nums">{formatearFecha(movimiento.fecha)}</span>
                    {movimiento.facturaId ? (
                      <Link
                        href={`/ventas/${movimiento.facturaId}`}
                        className="underline underline-offset-4"
                      >
                        Ver comprobante
                      </Link>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Detalle</th>
                    <th className="px-4 py-2.5 text-right font-medium">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 whitespace-nowrap text-stone-600 tabular-nums">
                        {formatearFecha(movimiento.fecha)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={
                            movimiento.tipo === 'debito'
                              ? 'inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-xs text-red-800'
                              : 'inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
                          }
                        >
                          {movimiento.tipo === 'debito' ? 'Deuda' : 'Pago'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {movimiento.facturaId ? (
                          <Link
                            href={`/ventas/${movimiento.facturaId}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {movimiento.descripcion ??
                              `Factura ${formatearNumero(
                                movimiento.facturaPuntoVenta ?? 1,
                                movimiento.facturaNumero ?? 0,
                              )}`}
                          </Link>
                        ) : (
                          (movimiento.descripcion ?? 'Movimiento')
                        )}
                        {movimiento.pagoId && movimiento.pagoNumero ? (
                          <span className="block text-xs text-stone-500">
                            Recibo {String(movimiento.pagoNumero).padStart(8, '0')}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={
                          movimiento.tipo === 'debito'
                            ? 'px-4 py-2.5 text-right font-medium text-red-700 tabular-nums'
                            : 'px-4 py-2.5 text-right font-medium text-emerald-700 tabular-nums'
                        }
                      >
                        {movimiento.tipo === 'debito' ? '+' : '−'}
                        {formatearPesos(movimiento.importe)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
