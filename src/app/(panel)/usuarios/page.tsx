import Link from 'next/link'
import { Paginador } from '@/components/paginador'
import { requerirAdmin } from '@/server/auth'
import { listarUsuarios } from '@/server/usuarios'

export const metadata = {
  title: 'Usuarios · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function Usuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const pagina = Math.max(1, Number(page ?? 1) || 1)
  const sesion = await requerirAdmin()
  const [listado, todos] = await Promise.all([
    listarUsuarios(sesion, { q, page: pagina, pageSize: 20 }),
    listarUsuarios(sesion, { pageSize: 100 }),
  ])
  const usuarios = listado.data
  const activos = todos.data.filter((usuario) => usuario.activo).length

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Usuarios</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Acceso al sistema</h1>
          <p className="mt-2 max-w-prose text-stone-600">
            Solo el administrador puede crear, editar, activar o desactivar usuarios. Un usuario
            inactivo no puede iniciar sesión.
          </p>
        </div>
        <Link
          href="/usuarios/nuevo"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          Nuevo usuario
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Usuarios</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{listado.total}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Activos</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{activos}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Administradores</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">
            {todos.data.filter((usuario) => usuario.rol === 'admin' && usuario.activo).length}
          </dd>
        </div>
      </dl>

      <form method="get" action="/usuarios" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar usuario
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre o email"
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
            href="/usuarios"
            className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      <ul className="mt-6 space-y-2 sm:hidden">
        {usuarios.map((usuario) => (
          <li key={usuario.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/usuarios/${usuario.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {usuario.nombre}
              </Link>
              <span className="text-xs text-stone-500">
                {usuario.rol === 'admin' ? 'Administrador' : 'Vendedor'}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-stone-500">{usuario.email}</p>
            <p className="mt-2 text-xs">
              {usuario.activo ? (
                <span className="text-emerald-700">Activo</span>
              ) : (
                <span className="text-stone-400">Inactivo</span>
              )}
              {usuario.id === sesion.id ? <span className="text-stone-500"> · vos</span> : null}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-6 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
        <table className="w-full min-w-[620px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
              <th className="px-4 py-2.5 font-medium">Nombre</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Rol</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/usuarios/${usuario.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {usuario.nombre}
                  </Link>
                  {usuario.id === sesion.id ? (
                    <span className="ml-2 rounded border border-stone-300 px-1.5 py-0.5 text-[10px] tracking-wide text-stone-500 uppercase">
                      vos
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-stone-600">{usuario.email}</td>
                <td className="px-4 py-2.5 text-stone-600">
                  {usuario.rol === 'admin' ? 'Administrador' : 'Vendedor'}
                </td>
                <td className="px-4 py-2.5">
                  {usuario.activo ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-600" />
                      Activo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
                      <span className="size-1.5 rounded-full bg-stone-400" />
                      Inactivo
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginador pagina={listado} basePath="/usuarios" params={{ q }} />
    </div>
  )
}
