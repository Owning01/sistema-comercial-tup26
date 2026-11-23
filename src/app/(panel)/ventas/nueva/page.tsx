import Link from 'next/link'
import { clientesParaVenta } from '@/server/clientes'
import { listarProductos } from '@/server/productos'
import { PuntoDeVenta } from './pos'

export const metadata = {
  title: 'Nueva venta · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function NuevaVenta() {
  const [{ data: productos }, clientes] = await Promise.all([
    listarProductos({ activo: true, pageSize: 100 }),
    clientesParaVenta(),
  ])

  return (
    <div className="max-w-6xl">
      <Link
        href="/ventas"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Ventas
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nueva venta</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        Armá el carrito, elegí la forma de pago y confirmá. El comprobante copia los datos del
        catálogo en ese momento.
      </p>

      <div className="mt-8">
        <PuntoDeVenta productos={productos} clientesBase={clientes} />
      </div>
    </div>
  )
}
