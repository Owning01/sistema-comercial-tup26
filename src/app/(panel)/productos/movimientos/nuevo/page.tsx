import Link from 'next/link'
import { requerirAdmin } from '@/server/auth'
import { listarProductos } from '@/server/productos'
import { FormularioMovimientoGlobal } from './form'

export const metadata = {
  title: 'Registrar movimiento · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function NuevoMovimiento() {
  await requerirAdmin()
  const { data: productos } = await listarProductos({ activo: 'todos', pageSize: 100 })

  return (
    <div className="max-w-3xl">
      <Link
        href="/productos/movimientos"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Movimientos
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Registrar movimiento</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        Las entradas suman unidades y las salidas las descuentan. Una salida no puede dejar el stock
        en negativo.
      </p>

      <div className="mt-8">
        <FormularioMovimientoGlobal productos={productos} />
      </div>
    </div>
  )
}
