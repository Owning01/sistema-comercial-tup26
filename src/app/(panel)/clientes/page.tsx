import Link from 'next/link'
import { Paginador } from '@/components/paginador'
import { formatearPesos } from '@/lib/dinero'
import { listarClientes } from '@/server/clientes'

export const metadata = {
  title: 'Clientes · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function Clientes({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q, page } = await searchParams
  const pagina = Math.max(1, Number(page ?? 1) || 1)
  const [listado, todos] = await Promise.all([
    listarClientes({ q, page: pagina, pageSize: 20 }),
    listarClientes({ pageSize: 100 }),
  ])
  const clientes = listado.data

  const conCuenta = todos.data.filter((cliente) => cliente.cuentaCorriente).length
  const deuda = todos.data.reduce((total, cliente) => total + cliente.saldo, 0)

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Clientes</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Clientes y cuentas</h1>
          <p className="mt-2 max-w-prose text-stone-600">
            El saldo se calcula con las ventas en cuenta corriente menos los pagos. No se guarda en
            el cliente.
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
        >
          Nuevo cliente
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-3">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Clientes</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{listado.total}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Con cuenta corriente</dt>
          <dd className="mt-1 text-lg font-medium tabular-nums">{conCuenta}</dd>
        </div>
        <div className="bg-white px-4 py-3">
          <dt className="text-xs text-stone-500">Deuda total</dt>
          <dd className="mt-1 truncate text-lg font-medium tabular-nums">{formatearPesos(deuda)}</dd>
        </div>
      </dl>

      <form method="get" action="/clientes" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar cliente
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Buscar por nombre o documento"
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
            href="/clientes"
            className="rounded-md px-3 py-2 text-sm text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
          >
            Limpiar
          </Link>
        ) : null}
      </form>

      {clientes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-stone-300 px-6 py-12 text-center">
          <p className="font-medium">{q ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}</p>
          <p className="mt-1 text-sm text-stone-600">
            {q ? (
              <>
                No hay resultados para <span className="font-mono">{q}</span>.{' '}
                <Link href="/clientes" className="underline underline-offset-4">
                  Ver todos
                </Link>
              </>
            ) : (
              <>
                Creá el primero con{' '}
                <Link href="/clientes/nuevo" className="underline underline-offset-4">
                  Nuevo cliente
                </Link>
                .
              </>
            )}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-2 sm:hidden">
            {clientes.map((cliente) => (
              <li key={cliente.id} className="rounded-lg border border-stone-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {cliente.nombre}
                  </Link>
                  <span
                    className={
                      cliente.saldo > 0
                        ? 'shrink-0 text-sm font-medium tabular-nums'
                        : 'shrink-0 text-sm text-stone-500 tabular-nums'
                    }
                  >
                    {formatearPesos(cliente.saldo)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-stone-500">
                  {cliente.tipoDoc} {cliente.nroDoc}
                  {cliente.cuentaCorriente ? ' · cuenta corriente' : ''}
                  {cliente.activo ? '' : ' · inactivo'}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-stone-200 sm:block">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                  <th className="px-4 py-2.5 font-medium">Cliente</th>
                  <th className="px-4 py-2.5 font-medium">Documento</th>
                  <th className="px-4 py-2.5 font-medium">Contacto</th>
                  <th className="px-4 py-2.5 font-medium">Cuenta</th>
                  <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="border-b border-stone-100 last:border-0 hover:bg-stone-50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/clientes/${cliente.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {cliente.nombre}
                      </Link>
                      {!cliente.activo ? (
                        <span className="ml-2 rounded border border-stone-300 px-1.5 py-0.5 text-[10px] tracking-wide text-stone-500 uppercase">
                          Inactivo
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-600">
                      {cliente.tipoDoc} {cliente.nroDoc}
                    </td>
                    <td className="px-4 py-2.5 text-stone-600">
                      {cliente.telefono ?? cliente.email ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {cliente.cuentaCorriente ? (
                        <span className="text-sm text-emerald-700">
                          Habilitada
                          {cliente.limiteCredito !== null
                            ? ` · ${formatearPesos(cliente.limiteCredito)}`
                            : ' · sin límite'}
                        </span>
                      ) : (
                        <span className="text-sm text-stone-400">No</span>
                      )}
                    </td>
                    <td
                      className={
                        cliente.saldo > 0
                          ? 'px-4 py-2.5 text-right font-medium tabular-nums'
                          : 'px-4 py-2.5 text-right text-stone-500 tabular-nums'
                      }
                    >
                      {formatearPesos(cliente.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Paginador pagina={listado} basePath="/clientes" params={{ q }} />
    </div>
  )
}
