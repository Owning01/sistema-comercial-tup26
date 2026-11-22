import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { categorias, clientes, facturas, productos, usuarios } from '@/db/schema'

export const dynamic = 'force-dynamic'

async function resumen() {
  const [u] = await db.select({ n: sql<number>`count(*)` }).from(usuarios)
  const [c] = await db.select({ n: sql<number>`count(*)` }).from(categorias)
  const [p] = await db.select({ n: sql<number>`count(*)` }).from(productos)
  const [cl] = await db.select({ n: sql<number>`count(*)` }).from(clientes)
  const [f] = await db.select({ n: sql<number>`count(*)` }).from(facturas)
  return [
    { tabla: 'usuarios', n: Number(u.n) },
    { tabla: 'categorias', n: Number(c.n) },
    { tabla: 'productos', n: Number(p.n) },
    { tabla: 'clientes', n: Number(cl.n) },
    { tabla: 'facturas', n: Number(f.n) },
  ]
}

export default async function Inicio() {
  const filas = await resumen()
  const url = process.env.DATABASE_URL ?? 'file:./local.db'
  const remota = url.startsWith('libsql://')

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">
        Programación IV · Segundo parcial
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Sistema de Gestión Comercial
      </h1>
      <p className="mt-3 max-w-prose text-stone-600">
        La base está montada: Next.js con App Router, Drizzle sobre libSQL y el esquema
        migrado. Esta pantalla lee una consulta real a la base en cada pedido.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
          Conexión
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-stone-200 bg-stone-200 sm:grid-cols-2">
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-stone-500">Motor</dt>
            <dd className="mt-1 font-mono text-sm">{remota ? 'Turso (libSQL remoto)' : 'SQLite local'}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs text-stone-500">URL</dt>
            <dd className="mt-1 truncate font-mono text-sm" title={url}>
              {url}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">
          Tablas
        </h2>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
              <th className="py-2 font-medium">Tabla</th>
              <th className="py-2 text-right font-medium">Filas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.tabla} className="border-b border-stone-100">
                <td className="py-2 font-mono text-stone-700">{fila.tabla}</td>
                <td className="py-2 text-right tabular-nums">{fila.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="mt-10 text-sm text-stone-500">
        Siguiente paso: autenticación con sesión firmada y el módulo de productos.
      </p>
    </main>
  )
}
