/** Forma común de todos los listados de la API. */
export type Pagina<T> = {
  data: T[]
  page: number
  pageSize: number
  total: number
}

export type Paginacion = {
  page: number
  pageSize: number
}

export function leerPaginacion(params: URLSearchParams): Paginacion {
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? 20) || 20))
  return { page, pageSize }
}

export function recortar<T>(filas: T[], total: number, paginacion: Paginacion): Pagina<T> {
  return {
    data: filas,
    page: paginacion.page,
    pageSize: paginacion.pageSize,
    total: Number(total),
  }
}
