'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const enlaces = [
  { href: '/', etiqueta: 'Inicio', listo: true },
  { href: '/ventas', etiqueta: 'Ventas', listo: false },
  { href: '/productos', etiqueta: 'Productos', listo: true },
  { href: '/clientes', etiqueta: 'Clientes', listo: false },
  { href: '/cuentas', etiqueta: 'Cuenta corriente', listo: false },
  { href: '/usuarios', etiqueta: 'Usuarios', listo: false },
]

export function NavLateral() {
  const ruta = usePathname()

  return (
    <nav aria-label="Secciones" className="border-t border-stone-200 px-3 py-3 lg:border-t-0">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {enlaces.map((enlace) => {
          const activo = enlace.href === '/' ? ruta === '/' : ruta.startsWith(enlace.href)

          if (!enlace.listo) {
            return (
              <li key={enlace.href} className="flex-none">
                <span className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-stone-400">
                  {enlace.etiqueta}
                  <span className="rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[9px] tracking-wide uppercase">
                    pronto
                  </span>
                </span>
              </li>
            )
          }

          return (
            <li key={enlace.href} className="flex-none lg:w-full">
              <Link
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={
                  activo
                    ? 'flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white'
                    : 'flex items-center rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100'
                }
              >
                {enlace.etiqueta}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
