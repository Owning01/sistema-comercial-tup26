'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const enlaces = [
  { href: '/', etiqueta: 'Inicio' },
  { href: '/ventas', etiqueta: 'Ventas' },
  { href: '/productos', etiqueta: 'Productos y stock' },
  { href: '/clientes', etiqueta: 'Clientes' },
  { href: '/usuarios', etiqueta: 'Usuarios', soloAdmin: true },
  { href: '/perfil', etiqueta: 'Mi cuenta' },
]

export function NavLateral({ esAdmin }: { esAdmin: boolean }) {
  const ruta = usePathname()
  const visibles = enlaces.filter((enlace) => !enlace.soloAdmin || esAdmin)

  return (
    <nav aria-label="Secciones" className="border-t border-stone-200 px-3 py-3 lg:border-t-0">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {visibles.map((enlace) => {
          const activo = enlace.href === '/' ? ruta === '/' : ruta.startsWith(enlace.href)

          return (
            <li key={enlace.href} className="flex-none lg:w-full">
              <Link
                href={enlace.href}
                aria-current={activo ? 'page' : undefined}
                className={
                  activo
                    ? 'flex items-center rounded-md bg-stone-900 px-3 py-2 text-sm font-medium whitespace-nowrap text-white'
                    : 'flex items-center rounded-md px-3 py-2 text-sm whitespace-nowrap text-stone-700 hover:bg-stone-100'
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
