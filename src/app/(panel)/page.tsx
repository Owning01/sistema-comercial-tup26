import Link from 'next/link'
import { formatearNumero, formatearPesos } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { requerirSesion } from '@/server/auth'
import { resumenVentas } from '@/server/ventas'

export const dynamic = 'force-dynamic'

const nombrePago: Record<string, string> = {
  contado: 'Contado',
  tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
}

export default async function Inicio() {
  const sesion = await requerirSesion()
  const resumen = await resumenVentas()

  const hoy = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())

  return (
    <div className="max-w-5xl">
      <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Panel · {hoy}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hola, {sesion.nombre}</h1>
      <p className="mt-2 text-stone-600">
        Resumen del comercio y accesos rápidos. Los números salen de la base en este momento.
      </p>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white px-4 py-4">
          <dt className="text-xs text-stone-500">Ventas de hoy</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{resumen.hoy.cantidad}</dd>
          <dd className="text-xs text-stone-500 tabular-nums">{formatearPesos(resumen.hoy.total)}</dd>
        </div>
        <div className="bg-white px-4 py-4">
          <dt className="text-xs text-stone-500">Facturado este mes</dt>
          <dd className="mt-1 truncate text-2xl font-semibold tabular-nums">
            {formatearPesos(resumen.mes.total)}
          </dd>
          <dd className="text-xs text-stone-500 tabular-nums">
            {resumen.mes.cantidad} {resumen.mes.cantidad === 1 ? 'venta' : 'ventas'}
          </dd>
        </div>
        <div className="bg-white px-4 py-4">
          <dt className="text-xs text-stone-500">Deuda en cuentas</dt>
          <dd className="mt-1 truncate text-2xl font-semibold tabular-nums">
            {formatearPesos(resumen.deuda)}
          </dd>
          <dd className="text-xs text-stone-500">
            <Link href="/clientes" className="underline-offset-4 hover:underline">
              Ver clientes
            </Link>
          </dd>
        </div>
        <div className="bg-white px-4 py-4">
          <dt className="text-xs text-stone-500">Bajo mínimo</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{resumen.bajoMinimoTotal}</dd>
          <dd className="text-xs text-stone-500">
            <Link href="/productos" className="underline-offset-4 hover:underline">
              Reponer stock
            </Link>
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/ventas/nueva"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
        >
          Nueva venta
        </Link>
        <Link
          href="/productos/nuevo"
          className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium hover:bg-stone-100"
        >
          Nuevo producto
        </Link>
        <Link
          href="/clientes/nuevo"
          className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium hover:bg-stone-100"
        >
          Nuevo cliente
        </Link>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
              Productos bajo mínimo
            </h2>
            <Link href="/productos" className="text-xs text-stone-500 underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>

          {resumen.bajoMinimo.length === 0 ? (
            <p className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
              Todos los productos están por encima del mínimo.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {resumen.bajoMinimo.map((producto) => (
                <li key={producto.id}>
                  <Link
                    href={`/productos/${producto.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{producto.descripcion}</span>
                      <span className="font-mono text-xs text-stone-500">{producto.codigo}</span>
                    </span>
                    <span className="shrink-0 text-right text-sm tabular-nums">
                      <span className="block font-medium">{producto.existencia}</span>
                      <span className="text-xs text-stone-500">mín. {producto.stockMinimo}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
              Últimas ventas
            </h2>
            <Link href="/ventas" className="text-xs text-stone-500 underline-offset-4 hover:underline">
              Ver todas
            </Link>
          </div>

          {resumen.ultimas.length === 0 ? (
            <p className="mt-3 rounded-lg border border-stone-200 bg-white px-4 py-6 text-sm text-stone-600">
              Todavía no hay ventas registradas.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
              {resumen.ultimas.map((venta) => (
                <li key={venta.id}>
                  <Link
                    href={`/ventas/${venta.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-sm font-medium">
                        {formatearNumero(venta.puntoVenta, venta.numero)}
                      </span>
                      <span className="block truncate text-xs text-stone-500">
                        {venta.clienteNombre ?? 'Consumidor final'} · {formatearFecha(venta.fecha)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-medium tabular-nums">
                        {formatearPesos(venta.total)}
                      </span>
                      <span className="text-xs text-stone-500">
                        {nombrePago[venta.formaPago] ?? venta.formaPago}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-10 border-t border-stone-200 pt-4 text-xs text-stone-500">
        Base {process.env.DATABASE_URL?.startsWith('libsql://') ? 'Turso (libSQL remoto)' : 'SQLite local'} ·
        sesión de {sesion.rol === 'admin' ? 'administrador' : 'vendedor'}
      </p>
    </div>
  )
}
