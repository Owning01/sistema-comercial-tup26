import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Paginador } from '@/components/paginador'
import { formatearPesos, formatearNumero } from '@/lib/dinero'
import { formatearFecha } from '@/lib/fechas'
import { listarClientes } from '@/server/clientes'
import { leerSesion } from '@/server/auth'
import { listarUsuarios } from '@/server/usuarios'
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

type Busqueda = {
  q?: string
  desde?: string
  hasta?: string
  clienteId?: string
  vendedorId?: string
  forma?: string
  estado?: string
  page?: string
}

function aNumero(valor?: string) {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : undefined
}

function aFecha(valor: string | undefined, finDelDia = false) {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return undefined
  const fecha = new Date(`${valor}T${finDelDia ? '23:59:59.999' : '00:00:00'}-03:00`)
  return Number.isNaN(fecha.getTime()) ? undefined : fecha
}

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<Busqueda>
}) {
  const { q, desde, hasta, clienteId, vendedorId, forma, estado, page } = await searchParams
  const pagina = Math.max(1, Number(page ?? 1) || 1)
  const sesion = await leerSesion()
  const esAdmin = sesion?.rol === 'admin'

  const [listado, resumen, clientes, vendedores] = await Promise.all([
    listarVentas(
      {
        q,
        desde: aFecha(desde),
        hasta: aFecha(hasta, true),
        clienteId: aNumero(clienteId),
        vendedorId: esAdmin ? aNumero(vendedorId) : undefined,
        forma: forma || undefined,
        estado: estado || undefined,
      },
      { page: pagina, pageSize: 20 },
    ),
    resumenVentas(),
    listarClientes({ pageSize: 100, orden: 'nombre' }),
    esAdmin && sesion
      ? listarUsuarios(sesion, { pageSize: 100 })
      : Promise.resolve({ data: [] as { id: number; nombre: string }[] }),
  ])
  const ventas = listado.data

  const hayFiltros = Boolean(
    q || desde || hasta || clienteId || vendedorId || forma || estado,
  )


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

      <form
        method="get"
        action="/ventas"
        className="mt-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="sm:col-span-2">
          <label htmlFor="q" className="mb-1 block text-xs font-medium text-stone-600">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Cliente o número de comprobante"
            autoComplete="off"
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          />
        </div>
        <div>
          <label htmlFor="desde" className="mb-1 block text-xs font-medium text-stone-600">
            Desde
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            defaultValue={desde ?? ''}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          />
        </div>
        <div>
          <label htmlFor="hasta" className="mb-1 block text-xs font-medium text-stone-600">
            Hasta
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={hasta ?? ''}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          />
        </div>
        <div>
          <label htmlFor="clienteId" className="mb-1 block text-xs font-medium text-stone-600">
            Cliente
          </label>
          <select
            id="clienteId"
            name="clienteId"
            defaultValue={clienteId ?? ''}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="">Todos</option>
            {clientes.data.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="forma" className="mb-1 block text-xs font-medium text-stone-600">
            Forma de pago
          </label>
          <select
            id="forma"
            name="forma"
            defaultValue={forma ?? ''}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="">Todas</option>
            <option value="contado">Contado</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="cuenta_corriente">Cuenta corriente</option>
          </select>
        </div>
        <div>
          <label htmlFor="estado" className="mb-1 block text-xs font-medium text-stone-600">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado ?? ''}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          >
            <option value="">Todos</option>
            <option value="emitida">Emitida</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>
        {esAdmin ? (
          <div>
            <label htmlFor="vendedorId" className="mb-1 block text-xs font-medium text-stone-600">
              Vendedor
            </label>
            <select
              id="vendedorId"
              name="vendedorId"
              defaultValue={vendedorId ?? ''}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
            >
              <option value="">Todos</option>
              {vendedores.data.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.nombre}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <Link
              href="/ventas"
              className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
            >
              Limpiar filtros
            </Link>
          ) : null}
        </div>
      </form>

      {ventas.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">{hayFiltros ? 'Ninguna venta coincide' : 'Todavía no hay ventas'}</p>
          <p className="mt-1 text-sm text-stone-600">
            {hayFiltros ? (
              <>
                No hay resultados para esos filtros.{' '}
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

      <Paginador
        pagina={listado}
        basePath="/ventas"
        params={{
          q,
          desde,
          hasta,
          clienteId,
          vendedorId: esAdmin ? vendedorId : undefined,
          forma,
          estado,
        }}
      />
    </div>
  )
}
