import Link from 'next/link'
import { requerirAdmin } from '@/server/auth'
import { listarTodasCategorias } from '@/server/categorias'
import { FormularioCategorias } from './form'

export const metadata = {
  title: 'Categorías · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function Categorias() {
  const sesion = await requerirAdmin()
  const categorias = await listarTodasCategorias(sesion)

  return (
    <div className="max-w-3xl">
      <Link
        href="/productos"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Productos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Categorías</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        Agrupan el catálogo. Una categoría con productos activos no se puede desactivar.
      </p>

      <div className="mt-8">
        <FormularioCategorias categorias={categorias} />
      </div>
    </div>
  )
}
