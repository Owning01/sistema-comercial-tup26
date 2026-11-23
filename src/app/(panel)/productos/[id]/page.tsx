import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearPesos } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { ApiError } from '@/lib/errors'
import { actualizarProducto } from '@/server/actions/productos'
import { listarCategorias, listarMovimientos, obtenerProducto } from '@/server/productos'
import { FormularioProducto } from '../form'
import { FormularioMovimiento } from './movimiento-form'

export const dynamic = 'force-dynamic'

const nombreTipo: Record<string, string> = {
  ingreso: 'Entrada',
  egreso: 'Salida',
  ajuste: 'Ajuste',
  venta: 'Venta',
  anulacion: 'Anulación',
}

function TipoMovimiento({ tipo }: { tipo: string }) {
  const positivo = tipo === 'ingreso' || tipo === 'ajuste'

  return (
    <span
      className={
        positivo
          ? 'inline-flex rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800'
          : 'inline-flex rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-xs text-stone-700'
      }
    >
      {nombreTipo[tipo] ?? tipo}
    </span>
  )
}

export default async function DetalleProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id: texto } = await params
  const id = Number(texto)

  if (!Number.isInteger(id) || id <= 0) notFound()

  let producto
  try {
    producto = await obtenerProducto(id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const [categorias, { data: movimientos }] = await Promise.all([
    listarCategorias(),
    listarMovimientos(id, { page: 1, pageSize: 50 }),
  ])
  const bajoMinimo = producto.existencia <= producto.stockMinimo

  return (
    <div className="max-w-5xl">
      <Link
        href="/productos"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Productos
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-stone-500">{producto.codigo}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{producto.descripcion}</h1>
          <p className="mt-2 text-stone-600">
            {producto.categoria?.nombre ?? 'Sin categoría'}
            {producto.activo ? null : ' · Producto inactivo, no se puede vender'}
          </p>
        </div>

        <div
          className={
            bajoMinimo
              ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-right'
              : 'rounded-lg border border-stone-200 bg-white px-4 py-3 text-right'
          }
        >
          <p className="text-xs text-stone-500">Existencia</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{producto.existencia}</p>
          <p className="text-xs text-stone-500">mínimo {producto.stockMinimo}</p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Precio de venta</dt>
          <dd className="mt-1 font-medium tabular-nums">{formatearPesos(producto.precio)}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Valor del stock</dt>
          <dd className="mt-1 font-medium tabular-nums">
            {formatearPesos(producto.precio * producto.existencia)}
          </dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Estado</dt>
          <dd className="mt-1 font-medium">
            {producto.activo ? 'Activo' : 'Inactivo'}
            {bajoMinimo ? ' · reponer' : ''}
          </dd>
        </div>
      </dl>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Editar producto</h2>
          <div className="mt-4">
            <FormularioProducto
              accion={actualizarProducto}
              categorias={categorias}
              producto={producto}
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Mover stock</h2>
          <p className="mt-1 mb-4 text-sm text-stone-600">
            Cada movimiento guarda quién lo hizo, cuándo y cómo quedó la existencia.
          </p>
          <FormularioMovimiento productoId={producto.id} existencia={producto.existencia} />
        </section>
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
          Historial de movimientos
        </h2>

        {movimientos.length === 0 ? (
          <p className="mt-3 text-sm text-stone-600">Todavía no hay movimientos registrados.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2 sm:hidden">
              {movimientos.map((movimiento) => (
                <li key={movimiento.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <TipoMovimiento tipo={movimiento.tipo} />
                    <span
                      className={
                        movimiento.cantidad > 0
                          ? 'text-sm font-medium text-emerald-700 tabular-nums'
                          : 'text-sm font-medium text-red-700 tabular-nums'
                      }
                    >
                      {movimiento.cantidad > 0 ? '+' : ''}
                      {movimiento.cantidad}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{movimiento.motivo ?? 'Sin motivo'}</p>
                  {movimiento.observacion ? (
                    <p className="text-xs text-stone-500">{movimiento.observacion}</p>
                  ) : null}
                  <p className="mt-2 flex justify-between gap-3 text-xs text-stone-500">
                    <span className="tabular-nums">{formatearFecha(movimiento.fecha)}</span>
                    <span className="tabular-nums">quedó en {movimiento.existenciaResultante}</span>
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
                    <th className="px-4 py-2.5 text-right font-medium">Cantidad</th>
                    <th className="px-4 py-2.5 text-right font-medium">Quedó en</th>
                    <th className="px-4 py-2.5 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 whitespace-nowrap text-stone-600 tabular-nums">
                        {formatearFecha(movimiento.fecha)}
                      </td>
                      <td className="px-4 py-2.5">
                        <TipoMovimiento tipo={movimiento.tipo} />
                      </td>
                      <td
                        className={
                          movimiento.cantidad > 0
                            ? 'px-4 py-2.5 text-right font-medium text-emerald-700 tabular-nums'
                            : 'px-4 py-2.5 text-right font-medium text-red-700 tabular-nums'
                        }
                      >
                        {movimiento.cantidad > 0 ? '+' : ''}
                        {movimiento.cantidad}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {movimiento.existenciaResultante}
                      </td>
                      <td className="px-4 py-2.5">
                        {movimiento.motivo ?? '—'}
                        {movimiento.observacion ? (
                          <span className="block text-xs text-stone-500">{movimiento.observacion}</span>
                        ) : null}
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
