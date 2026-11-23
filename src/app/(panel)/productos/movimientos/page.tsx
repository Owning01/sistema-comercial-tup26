import Link from 'next/link'
import { Paginador } from '@/components/paginador'
import { formatearFecha } from '@/lib/fechas'
import { listarMovimientosGlobal } from '@/server/productos'

export const metadata = {
  title: 'Movimientos de stock · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

const nombreTipo: Record<string, string> = {
  ingreso: 'Entrada',
  egreso: 'Salida',
  ajuste: 'Ajuste',
  venta: 'Venta',
  anulacion: 'Anulación',
}

function TipoMovimiento({ tipo }: { tipo: string }) {
  const clase =
    tipo === 'ingreso'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : tipo === 'venta'
        ? 'border-sky-200 bg-sky-50 text-sky-800'
        : tipo === 'anulacion'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'

  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${clase}`}>
      {nombreTipo[tipo] ?? tipo}
    </span>
  )
}

export default async function Movimientos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; page?: string }>
}) {
  const { q, tipo, page } = await searchParams
  const pagina = Math.max(1, Number(page ?? 1) || 1)
  const [listado, todos] = await Promise.all([
    listarMovimientosGlobal({ q, tipo }, { page: pagina, pageSize: 20 }),
    listarMovimientosGlobal({}, { page: 1, pageSize: 500 }),
  ])
  const movimientos = listado.data

  const entradas = todos.data.filter((movimiento) => movimiento.cantidad > 0).length
  const salidas = todos.data.length - entradas

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
          <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">
            Productos / Historial
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Movimientos de stock</h1>
          <p className="mt-2 max-w-prose text-stone-600">
            Entradas manuales, salidas, ajustes y ventas. Cada fila guarda la existencia resultante.
          </p>
        </div>
        <Link
          href="/productos/movimientos/nuevo"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          Registrar movimiento
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Movimientos</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{listado.total}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Entradas</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{entradas}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Salidas</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{salidas}</dd>
        </div>
      </dl>

      <form method="get" action="/productos/movimientos" className="mt-6 flex flex-wrap gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar por producto
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por código o descripción"
          autoComplete="off"
          className="w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
        />
        <select
          name="tipo"
          defaultValue={tipo ?? ''}
          aria-label="Tipo de movimiento"
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900"
        >
          <option value="">Todos los tipos</option>
          <option value="ingreso">Entradas</option>
          <option value="egreso">Salidas</option>
          <option value="venta">Ventas</option>
          <option value="ajuste">Ajustes</option>
          <option value="anulacion">Anulaciones</option>
        </select>
        <button
          type="submit"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Filtrar
        </button>
        {q || tipo ? (
          <Link
            href="/productos/movimientos"
            className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      {movimientos.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">No hay movimientos que coincidan</p>
          <p className="mt-1 text-sm text-stone-600">
            Probá con otro filtro o{' '}
            <Link href="/productos/movimientos/nuevo" className="underline underline-offset-4">
              registrá un movimiento
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2 sm:hidden">
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
                <Link
                  href={`/productos/${movimiento.producto.id}`}
                  className="mt-2 block text-sm font-medium underline-offset-4 hover:underline"
                >
                  {movimiento.producto.descripcion}
                </Link>
                <p className="font-mono text-xs text-stone-500">{movimiento.producto.codigo}</p>
                <p className="mt-1 text-sm text-stone-600">{movimiento.motivo ?? 'Sin motivo'}</p>
                <p className="mt-2 flex justify-between gap-3 text-xs text-stone-500">
                  <span className="tabular-nums">{formatearFecha(movimiento.fecha)}</span>
                  <span className="tabular-nums">quedó en {movimiento.existenciaResultante}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Producto</th>
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
                      <Link
                        href={`/productos/${movimiento.producto.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {movimiento.producto.descripcion}
                      </Link>
                      <span className="block font-mono text-xs text-stone-500">{movimiento.producto.codigo}</span>
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
                      {movimiento.referencia ? (
                        <Link
                          href={`/ventas/${movimiento.referencia.facturaId}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {movimiento.motivo ?? 'Venta'}
                        </Link>
                      ) : (
                        (movimiento.motivo ?? '—')
                      )}
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

      <Paginador
        pagina={listado}
        basePath="/productos/movimientos"
        params={{ q, tipo }}
      />
    </div>
  )
}
