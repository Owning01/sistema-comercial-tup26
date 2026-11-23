import Link from 'next/link'
import { formatearPesos } from '@/lib/dinero'
import { listarProductos } from '@/server/productos'

export const metadata = {
  title: 'Productos · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

function EstadoStock({ existencia, minimo }: { existencia: number; minimo: number }) {
  if (existencia === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-red-700">
        <span className="size-1.5 rounded-full bg-red-600" />
        Sin stock
      </span>
    )
  }

  if (existencia <= minimo) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
        <span className="size-1.5 rounded-full bg-amber-500" />
        Bajo mínimo
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
      <span className="size-1.5 rounded-full bg-emerald-600" />
      Disponible
    </span>
  )
}

export default async function Productos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const productos = await listarProductos({ q })

  const valor = productos.reduce((total, p) => total + p.precio * p.existencia, 0)
  const bajoMinimo = productos.filter((p) => p.activo && p.existencia <= p.stockMinimo).length

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Productos</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Catálogo y stock</h1>
          <p className="mt-2 max-w-prose text-stone-600">
            La existencia cambia solo con movimientos. Editar un producto no toca el stock.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/productos/movimientos"
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
          >
            Ver movimientos
          </Link>
          <Link
            href="/productos/movimientos/nuevo"
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
          >
            Registrar movimiento
          </Link>
          <Link
            href="/productos/nuevo"
            className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
          >
            Nuevo producto
          </Link>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Productos</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{productos.length}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Bajo mínimo</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{bajoMinimo}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Valor del stock</dt>
          <dd className="mt-1 truncate text-lg font-medium tabular-nums">{formatearPesos(valor)}</dd>
        </div>
      </dl>

      <form method="get" action="/productos" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar producto
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por código o descripción"
          autoComplete="off"
          className="w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
        />
        <button
          type="submit"
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-100"
        >
          Buscar
        </button>
        {q ? (
          <Link
            href="/productos"
            className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      {productos.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">{q ? 'Ningún producto coincide' : 'Todavía no hay productos'}</p>
          <p className="mt-1 text-sm text-stone-600">
            {q ? (
              <>
                No hay resultados para <span className="font-mono">{q}</span>.{' '}
                <Link href="/productos" className="underline underline-offset-4">
                  Ver todos
                </Link>
              </>
            ) : (
              <>
                Creá el primero con{' '}
                <Link href="/productos/nuevo" className="underline underline-offset-4">
                  Nuevo producto
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2 sm:hidden">
            {productos.map((producto) => (
              <li key={producto.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/productos/${producto.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {producto.descripcion}
                  </Link>
                  <span className="shrink-0 text-sm tabular-nums">{formatearPesos(producto.precio)}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-stone-500">
                  {producto.codigo} · {producto.categoria ?? 'Sin categoría'}
                  {producto.activo ? '' : ' · Inactivo'}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <EstadoStock existencia={producto.existencia} minimo={producto.stockMinimo} />
                  <span className="text-sm text-stone-600 tabular-nums">
                    {producto.existencia} / mín. {producto.stockMinimo}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Código</th>
                  <th className="px-4 py-2.5 font-medium">Descripción</th>
                  <th className="px-4 py-2.5 font-medium">Categoría</th>
                  <th className="px-4 py-2.5 text-right font-medium">Precio</th>
                  <th className="px-4 py-2.5 text-right font-medium">Existencia</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => (
                  <tr
                    key={producto.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link href={`/productos/${producto.id}`} className="underline-offset-4 hover:underline">
                        {producto.codigo}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/productos/${producto.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {producto.descripcion}
                      </Link>
                      {!producto.activo ? (
                        <span className="ml-2 rounded border border-stone-300 px-1.5 py-0.5 text-[10px] tracking-wide text-stone-500 uppercase">
                          Inactivo
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">{producto.categoria ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatearPesos(producto.precio)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="tabular-nums">{producto.existencia}</span>
                      <span className="text-stone-400"> / {producto.stockMinimo}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <EstadoStock existencia={producto.existencia} minimo={producto.stockMinimo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
