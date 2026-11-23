import Link from 'next/link'
import type { Pagina } from '@/lib/paginacion'

type Props<T> = {
  pagina: Pagina<T>
  basePath: string
  params: Record<string, string | undefined>
}

/** Enlaces de anterior y siguiente que conservan los filtros activos. */
export function Paginador<T>({ pagina, basePath, params }: Props<T>) {
  if (pagina.total === 0) return null

  const totalPaginas = Math.max(1, Math.ceil(pagina.total / pagina.pageSize))
  const actual = Math.min(Math.max(1, pagina.page), totalPaginas)
  const desde = pagina.total === 0 ? 0 : (actual - 1) * pagina.pageSize + 1
  const hasta = Math.min(actual * pagina.pageSize, pagina.total)

  function enlace(destino: number) {
    const busqueda = new URLSearchParams()
    for (const [clave, valor] of Object.entries(params)) {
      if (valor) busqueda.set(clave, valor)
    }
    if (destino > 1) busqueda.set('page', String(destino))
    const texto = busqueda.toString()
    return texto ? `${basePath}?${texto}` : basePath
  }

  return (
    <nav
      aria-label="Paginación"
      className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600"
    >
      <p className="tabular-nums">
        Mostrando {desde}–{hasta} de {pagina.total}
      </p>
      <div className="flex items-center gap-2">
        {actual > 1 ? (
          <Link
            href={enlace(actual - 1)}
            className="rounded-md border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-100"
          >
            Anterior
          </Link>
        ) : (
          <span className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-400">
            Anterior
          </span>
        )}
        <span className="px-1 tabular-nums">
          {actual} / {totalPaginas}
        </span>
        {actual < totalPaginas ? (
          <Link
            href={enlace(actual + 1)}
            className="rounded-md border border-stone-300 px-3 py-1.5 font-medium hover:bg-stone-100"
          >
            Siguiente
          </Link>
        ) : (
          <span className="rounded-md border border-stone-200 px-3 py-1.5 text-stone-400">
            Siguiente
          </span>
        )}
      </div>
    </nav>
  )
}
