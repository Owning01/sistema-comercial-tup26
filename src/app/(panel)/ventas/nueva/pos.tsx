'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { aCentavos, formatearPesos } from '@/lib/dinero'
import { NuevoClienteRapido } from './nuevo-cliente'

type ProductoVenta = {
  id: number
  codigo: string
  descripcion: string
  precio: number
  existencia: number
  activo: boolean
  categoria: { id: number; nombre: string } | null
}

type ClienteVenta = {
  id: number
  nombre: string
  nroDoc: string
  cuentaCorriente: boolean
  limiteCredito: number | null
  saldo: number
}

type FormaPago = 'contado' | 'tarjeta' | 'cuenta_corriente'

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const formas: { valor: FormaPago; etiqueta: string; detalle: string }[] = [
  { valor: 'contado', etiqueta: 'Contado', detalle: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta', detalle: 'Pago simulado' },
  { valor: 'cuenta_corriente', etiqueta: 'Cuenta corriente', detalle: 'Queda como deuda' },
]

export function PuntoDeVenta({
  productos,
  clientesBase,
}: {
  productos: ProductoVenta[]
  clientesBase: ClienteVenta[]
}) {
  const [carrito, setCarrito] = useState<{ productoId: number; cantidad: number }[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [formaPago, setFormaPago] = useState<FormaPago>('contado')
  const [clienteId, setClienteId] = useState('')
  const [montoRecibido, setMontoRecibido] = useState('')
  const [tarjetaTipo, setTarjetaTipo] = useState<'debito' | 'credito'>('debito')
  const [tarjetaMarca, setTarjetaMarca] = useState('Visa')
  const [tarjetaUltimos4, setTarjetaUltimos4] = useState('')
  const [nuevos, setNuevos] = useState<ClienteVenta[]>([])
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [catalogo, setCatalogo] = useState<ProductoVenta[]>(productos)
  const [confirmando, setConfirmando] = useState(false)
  const [errorVenta, setErrorVenta] = useState<string | null>(null)
  const router = useRouter()

  const porId = new Map(
    [...productos, ...catalogo].map((producto) => [producto.id, producto]),
  )
  const clientes = [
    ...new Map([...clientesBase, ...nuevos].map((cliente) => [cliente.id, cliente])).values(),
  ]
  const cliente = clientes.find((c) => String(c.id) === clienteId) ?? null

  const renglones = carrito
    .map((item) => {
      const producto = porId.get(item.productoId)
      if (!producto) return null
      return { ...item, producto, subtotal: producto.precio * item.cantidad }
    })
    .filter((renglon): renglon is NonNullable<typeof renglon> => renglon !== null)

  const total = renglones.reduce((suma, renglon) => suma + renglon.subtotal, 0)
  const unidades = renglones.reduce((suma, renglon) => suma + renglon.cantidad, 0)

  const filtrados = catalogo
    .filter((producto) => producto.activo)
    .slice(0, 12)

  // La búsqueda en vivo consulta la API REST, no una copia local.
  useEffect(() => {
    const texto = busqueda.trim()
    if (!texto) {
      setCatalogo(productos)
      return
    }

    let vigente = true
    const temporizador = setTimeout(async () => {
      try {
        const respuesta = await fetch(
          `/api/productos?q=${encodeURIComponent(texto)}&activo=true&pageSize=12`,
        )
        if (!respuesta.ok) return
        const datos = (await respuesta.json()) as { data: ProductoVenta[] }
        if (vigente) setCatalogo(datos.data)
      } catch {
        // Si la red falla, queda el catálogo que ya estaba en pantalla.
      }
    }, 250)

    return () => {
      vigente = false
      clearTimeout(temporizador)
    }
  }, [busqueda, productos])

  const recibido = aCentavos(montoRecibido)
  const vuelto = recibido !== null && recibido >= total ? recibido - total : null
  const falta = recibido !== null && recibido < total ? total - recibido : null

  const disponible =
    cliente?.cuentaCorriente && cliente.limiteCredito !== null
      ? cliente.limiteCredito - cliente.saldo
      : null
  const excedeLimite = disponible !== null && total > disponible

  function agregar(productoId: number) {
    const producto = porId.get(productoId)
    if (!producto || !producto.activo || producto.existencia <= 0) return

    setCarrito((previo) => {
      const existe = previo.find((item) => item.productoId === productoId)
      if (existe) {
        return previo.map((item) =>
          item.productoId === productoId
            ? { ...item, cantidad: Math.min(item.cantidad + 1, producto.existencia) }
            : item,
        )
      }
      return [...previo, { productoId, cantidad: 1 }]
    })
  }

  function cambiarCantidad(productoId: number, valor: number) {
    const producto = porId.get(productoId)
    if (!producto) return
    const cantidad = Math.max(1, Math.min(Number.isFinite(valor) ? valor : 1, producto.existencia))
    setCarrito((previo) =>
      previo.map((item) => (item.productoId === productoId ? { ...item, cantidad } : item)),
    )
  }

  function quitar(productoId: number) {
    setCarrito((previo) => previo.filter((item) => item.productoId !== productoId))
  }

  function elegirForma(valor: FormaPago) {
    setFormaPago(valor)
    if (valor === 'cuenta_corriente' && cliente && !cliente.cuentaCorriente) {
      setClienteId('')
    }
  }

  const agregarNuevo = useCallback((creado: ClienteVenta) => {
    setNuevos((previo) =>
      previo.some((cliente) => cliente.id === creado.id) ? previo : [...previo, creado],
    )
    setClienteId(String(creado.id))
    setNuevoAbierto(false)
  }, [])

  const items = renglones.map((renglon) => ({
    productoId: renglon.productoId,
    cantidad: renglon.cantidad,
  }))

  const faltanDatos =
    renglones.length === 0 ||
    (formaPago === 'cuenta_corriente' && (!cliente || !cliente.cuentaCorriente)) ||
    (formaPago === 'tarjeta' && (!tarjetaMarca.trim() || !/^\d{4}$/.test(tarjetaUltimos4)))

  async function confirmar() {
    if (faltanDatos || confirmando) return
    setErrorVenta(null)
    setConfirmando(true)

    const pago =
      formaPago === 'contado'
        ? { forma: 'contado', ...(recibido === null ? {} : { montoRecibido: recibido }) }
        : formaPago === 'tarjeta'
          ? {
              forma: 'tarjeta',
              tarjeta: { tipo: tarjetaTipo, marca: tarjetaMarca, ultimos4: tarjetaUltimos4 },
            }
          : { forma: 'cuenta_corriente' }

    try {
      const respuesta = await fetch('/api/facturas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clienteId: cliente?.id ?? null, items, pago }),
      })
      const datos = (await respuesta.json()) as {
        id?: number
        error?: { message?: string; details?: { mensaje?: string; message?: string }[] }
      }

      if (!respuesta.ok) {
        const detalles = (datos.error?.details ?? [])
          .map((detalle) => detalle.mensaje ?? detalle.message ?? '')
          .filter(Boolean)
          .join(' ')
        setErrorVenta([datos.error?.message, detalles].filter(Boolean).join(' ') || 'No se pudo confirmar la venta.')
        return
      }

      if (datos.id) {
        router.push(`/ventas/${datos.id}`)
        router.refresh()
      }
    } catch {
      setErrorVenta('No se pudo conectar con el servidor. Revisá la conexión y volvé a intentar.')
    } finally {
      setConfirmando(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Productos</h2>
            <p className="mt-1 text-sm text-stone-600">Buscá y agregá al carrito.</p>
          </div>
          <input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Código o descripción"
            aria-label="Buscar producto"
            autoComplete="off"
            className="w-48 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 sm:w-64"
          />
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {filtrados.map((producto) => (
            <li key={producto.id}>
              <button
                type="button"
                onClick={() => agregar(producto.id)}
                disabled={producto.existencia === 0}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{producto.descripcion}</span>
                  <span className="mt-0.5 block font-mono text-xs text-stone-500">
                    {producto.codigo} · {producto.existencia === 0 ? 'sin stock' : `${producto.existencia} disponibles`}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums">{formatearPesos(producto.precio)}</span>
              </button>
            </li>
          ))}
        </ul>

        {filtrados.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
            No hay productos que coincidan con la búsqueda.
          </p>
        ) : null}

        <div className="mt-8">
          <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Carrito</h2>

          {renglones.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-600">
              Agregá productos para armar la venta.
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-lg border border-stone-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">
                    <th className="px-3 py-2 font-medium">Producto</th>
                    <th className="px-3 py-2 text-right font-medium">Precio</th>
                    <th className="px-3 py-2 text-center font-medium">Cantidad</th>
                    <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {renglones.map((renglon) => (
                    <tr key={renglon.productoId} className="border-b border-stone-100 last:border-0">
                      <td className="px-3 py-2">
                        <span className="block font-medium">{renglon.producto.descripcion}</span>
                        <span className="font-mono text-xs text-stone-500">
                          {renglon.producto.codigo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                        {formatearPesos(renglon.producto.precio)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              cambiarCantidad(renglon.productoId, renglon.cantidad - 1)
                            }
                            aria-label={`Quitar una unidad de ${renglon.producto.descripcion}`}
                            className="grid size-6 place-items-center rounded border border-stone-300 text-stone-600 hover:bg-stone-100"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={renglon.producto.existencia}
                            value={renglon.cantidad}
                            onChange={(evento) =>
                              cambiarCantidad(renglon.productoId, Number(evento.target.value))
                            }
                            aria-label={`Cantidad de ${renglon.producto.descripcion}`}
                            className="w-14 rounded border border-stone-300 px-2 py-1 text-center text-sm tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              cambiarCantidad(renglon.productoId, renglon.cantidad + 1)
                            }
                            aria-label={`Agregar una unidad de ${renglon.producto.descripcion}`}
                            className="grid size-6 place-items-center rounded border border-stone-300 text-stone-600 hover:bg-stone-100"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                        {formatearPesos(renglon.subtotal)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => quitar(renglon.productoId)}
                          className="text-xs text-stone-500 underline-offset-4 hover:text-red-700 hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium tracking-wide text-stone-500 uppercase">Cobro</h2>
            <span className="text-xs text-stone-500">
              {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          </div>

          <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{formatearPesos(total)}</p>

          <div className="mt-5">
            <p className="text-sm font-medium text-stone-700">Cliente</p>
            <select
              value={clienteId}
              onChange={(evento) => setClienteId(evento.target.value)}
              className={campo}
            >
              <option value="">Consumidor final</option>
              {clientes.map((opcion) => (
                <option
                  key={opcion.id}
                  value={opcion.id}
                  disabled={formaPago === 'cuenta_corriente' && !opcion.cuentaCorriente}
                >
                  {opcion.nombre} · {opcion.nroDoc}
                  {opcion.cuentaCorriente ? '' : ' (sin cuenta)'}
                </option>
              ))}
            </select>

            {cliente ? (
              <p className="mt-1 text-xs text-stone-500">
                {cliente.cuentaCorriente
                  ? `Saldo ${formatearPesos(cliente.saldo)}${
                      cliente.limiteCredito !== null
                        ? ` · límite ${formatearPesos(cliente.limiteCredito)}`
                        : ' · sin límite'
                    }`
                  : 'Sin cuenta corriente'}
              </p>
            ) : null}

            {nuevoAbierto ? (
              <div className="mt-3">
                <NuevoClienteRapido
                  onCreado={agregarNuevo}
                  onCancelar={() => setNuevoAbierto(false)}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNuevoAbierto(true)}
                className="mt-2 text-xs text-stone-600 underline underline-offset-4 hover:text-stone-900"
              >
                + Alta rápida de cliente
              </button>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-stone-700">Forma de pago</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {formas.map((forma) => (
                <button
                  key={forma.valor}
                  type="button"
                  onClick={() => elegirForma(forma.valor)}
                  aria-pressed={formaPago === forma.valor}
                  className={
                    formaPago === forma.valor
                      ? 'rounded-md bg-stone-900 px-2 py-2 text-center text-xs font-medium text-white'
                      : 'rounded-md border border-stone-300 px-2 py-2 text-center text-xs text-stone-700 hover:bg-stone-100'
                  }
                >
                  <span className="block">{forma.etiqueta}</span>
                  <span
                    className={
                      formaPago === forma.valor
                        ? 'block text-[10px] text-stone-300'
                        : 'block text-[10px] text-stone-500'
                    }
                  >
                    {forma.detalle}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {formaPago === 'contado' ? (
            <div className="mt-4">
              <label htmlFor="montoRecibido" className="block text-sm font-medium text-stone-700">
                Efectivo recibido
              </label>
              <input
                id="montoRecibido"
                value={montoRecibido}
                onChange={(evento) => setMontoRecibido(evento.target.value)}
                inputMode="decimal"
                autoComplete="off"
                placeholder={total > 0 ? (total / 100).toFixed(2).replace('.', ',') : '0,00'}
                className={`${campo} tabular-nums`}
              />
              {vuelto !== null ? (
                <p className="mt-1 text-xs text-emerald-700">Vuelto: {formatearPesos(vuelto)}</p>
              ) : null}
              {falta !== null ? (
                <p className="mt-1 text-xs text-red-700">Faltan {formatearPesos(falta)}</p>
              ) : null}
            </div>
          ) : null}

          {formaPago === 'tarjeta' ? (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="tarjetaTipo" className="block text-xs font-medium text-stone-700">
                    Tipo
                  </label>
                  <select
                    id="tarjetaTipo"
                    value={tarjetaTipo}
                    onChange={(evento) =>
                      setTarjetaTipo(evento.target.value === 'credito' ? 'credito' : 'debito')
                    }
                    className={campo}
                  >
                    <option value="debito">Débito</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="tarjetaMarca" className="block text-xs font-medium text-stone-700">
                    Marca
                  </label>
                  <select
                    id="tarjetaMarca"
                    value={tarjetaMarca}
                    onChange={(evento) => setTarjetaMarca(evento.target.value)}
                    className={campo}
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="American Express">American Express</option>
                    <option value="Cabal">Cabal</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="tarjetaUltimos4" className="block text-xs font-medium text-stone-700">
                  Últimos 4 dígitos
                </label>
                <input
                  id="tarjetaUltimos4"
                  value={tarjetaUltimos4}
                  onChange={(evento) =>
                    setTarjetaUltimos4(evento.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  placeholder="1234"
                  className={`${campo} tabular-nums`}
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Solo se guardan tipo, marca y últimos 4 dígitos. Nunca el número completo.
                </p>
              </div>
            </div>
          ) : null}

          {formaPago === 'cuenta_corriente' ? (
            <div className="mt-4">
              {!cliente ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Elegí un cliente registrado para vender a cuenta.
                </p>
              ) : !cliente.cuentaCorriente ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {cliente.nombre} no tiene la cuenta corriente habilitada.
                </p>
              ) : excedeLimite ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  La venta supera el crédito disponible de {formatearPesos(Math.max(0, disponible ?? 0))}.
                </p>
              ) : (
                <p className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                  La deuda se suma al saldo de {cliente.nombre}.
                  {disponible !== null ? ` Crédito disponible: ${formatearPesos(disponible)}.` : ''}
                </p>
              )}
            </div>
          ) : null}

          {errorVenta ? (
            <p role="alert" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {errorVenta}
            </p>
          ) : null}

          <button
            type="button"
            onClick={confirmar}
            disabled={confirmando || faltanDatos}
            className="mt-5 w-full rounded-md bg-stone-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmando ? 'Confirmando…' : `Confirmar venta · ${formatearPesos(total)}`}
          </button>

          <p className="mt-3 text-xs text-stone-500">
            Al confirmar se descuenta el stock y se emite el comprobante. Si algo falla, no se
            descuenta nada.
          </p>
        </div>
      </aside>
    </div>
  )
}
