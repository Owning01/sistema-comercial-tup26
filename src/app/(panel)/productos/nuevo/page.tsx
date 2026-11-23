import Link from 'next/link'
import { guardarProducto } from '@/server/actions/productos'
import { listarCategorias } from '@/server/productos'
import { FormularioProducto } from '../form'

export const metadata = {
  title: 'Nuevo producto · Sistema de Gestión Comercial',
}

export default async function NuevoProducto() {
  const categorias = await listarCategorias()

  return (
    <div className="max-w-3xl">
      <Link
        href="/productos"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Productos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nuevo producto</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        El código identifica al producto y no se puede repetir. El stock inicial queda registrado como
        una entrada en el historial.
      </p>

      <div className="mt-8">
        <FormularioProducto accion={guardarProducto} categorias={categorias} />
      </div>
    </div>
  )
}
