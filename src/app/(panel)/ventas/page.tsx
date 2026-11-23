import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { formatearPesos, formatearNumero } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { listarVentas, resumenVentas } from '@/server/ventas'

export const metadata = {
  title: 'Ventas · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

const nombrePago: Record<string, string> = {
  contado: 'Contado',
  tarjeta: 'Tarjeta',
  cuenta_corriente: 'Cuenta corriente',
}

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [{ data: ventas }, resumen] = await Promise.all([
    listarVentas({ q }, { page: 1, pageSize: 100 }),
    resumenVentas(),
  ])

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Ventas</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Comprobantes</h1>
          <p className="mt-2 max-w-prose text-stone-600">
            Cada venta conserva el detalle y los precios del momento. No se edita: se anula con
            motivo y queda registrada.
          </p>
        </div>
        <Link
          href="/ventas/nueva"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          Nueva venta
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Ventas de hoy</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{resumen.hoy.cantidad}</dd>
          <dd className="text-xs text-stone-500 tabular-nums">{formatearPesos(resumen.hoy.total)}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">En cuenta corriente</dt>
          <dd className="mt-1 truncate text-lg font-medium tabular-nums">
            {formatearPesos(resumen.hoyCuenta)}
          </dd>
          <dd className="text-xs text-stone-500">Ventas de hoy</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Último comprobante</dt>
          <dd className="mt-1 font-mono text-lg font-medium tabular-nums">
            {resumen.ultimas[0]
              ? formatearNumero(resumen.ultimas[0].puntoVenta, resumen.ultimas[0].numero)
              : '—'}
          </dd>
          <dd className="text-xs text-stone-500">
            {resumen.ultimas[0] ? formatearFecha(resumen.ultimas[0].fecha) : 'Sin ventas'}
          </dd>
        </div>
      </dl>

      <form method="get" action="/ventas" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar venta
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por cliente o número"
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
            href="/ventas"
            className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      {ventas.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">{q ? 'Ninguna venta coincide' : 'Todavía no hay ventas'}</p>
          <p className="mt-1 text-sm text-stone-600">
            {q ? (
              <>
                No hay resultados para <span className="font-mono">{q}</span>.{' '}
                <Link href="/ventas" className="underline underline-offset-4">
                  Ver todas
                </Link>
              </>
            ) : (
              <>
                Empezá con{' '}
                <Link href="/ventas/nueva" className="underline underline-offset-4">
                  Nueva venta
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2 sm:hidden">
            {ventas.map((venta) => (
              <li key={venta.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/ventas/${venta.id}`}
                    className="font-mono text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {formatearNumero(venta.puntoVenta, venta.numero)}
                  </Link>
                  <span className="text-sm font-medium tabular-nums">{formatearPesos(venta.total)}</span>
                </div>
                <p className="mt-1 text-sm">{venta.clienteNombre ?? 'Consumidor final'}</p>
                <p className="mt-1 flex justify-between gap-3 text-xs text-stone-500">
                  <span>{formatearFecha(venta.fecha)}</span>
                  <span>
                    {nombrePago[venta.formaPago] ?? venta.formaPago}
                    {venta.estado === 'anulada' ? ' · Anulada' : ''}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Comprobante</th>
                  <th className="px-4 py-2.5 font-medium">Fecha</th>
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Pago</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((venta) => (
                  <tr
                    key={venta.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <Link
                        href={`/ventas/${venta.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {formatearNumero(venta.puntoVenta, venta.numero)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-stone-600 tabular-nums">
                      {formatearFecha(venta.fecha)}
                    </td>
                    <td className="px-4 py-2.5">{venta.clienteNombre ?? 'Consumidor final'}</td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {nombrePago[venta.formaPago] ?? venta.formaPago}
                    </td>
                    <td className="px-4 py-2.5">
                      {venta.estado === 'anulada' ? (
                        <Badge variant="destructive">Anulada</Badge>
                      ) : (
                        <Badge variant="secondary">Emitida</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {formatearPesos(venta.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
