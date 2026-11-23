import { requerirSesion } from '@/server/auth'
import { cerrarSesion } from '@/server/actions/auth'
import { NavLateral } from './nav'

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // La barrera: sin sesión válida no se renderiza nada del panel.
  const sesion = await requerirSesion()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-b border-stone-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center bg-stone-900 font-mono text-xs font-bold text-white">
              SC
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium">Sistema Comercial</p>
              <p className="text-xs text-stone-500">Programación IV</p>
            </div>
          </div>

          <div className="flex items-center gap-3 lg:hidden">
            <span className="max-w-24 truncate text-xs text-stone-500">{sesion.nombre}</span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="rounded-md border border-stone-300 px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-100"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        <NavLateral />

        <div className="mt-auto hidden border-t border-stone-200 px-5 py-4 lg:block">
          <p className="truncate text-sm font-medium">{sesion.nombre}</p>
          <p className="text-xs text-stone-500 capitalize">
            {sesion.rol === 'admin' ? 'Administrador' : 'Vendedor'}
          </p>
          <form action={cerrarSesion} className="mt-3">
            <button
              type="submit"
              className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  )
}
