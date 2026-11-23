import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from './client'
import {
  categorias,
  clientes,
  contadores,
  facturaItems,
  facturas,
  movimientosCuenta,
  movimientosStock,
  pagos,
  productos,
  usuarios,
} from './schema'

/**
 * Carga inicial para desarrollo. Borra y vuelve a crear todo, asi que se puede
 * correr las veces que haga falta y siempre queda en el mismo estado.
 *
 *   pnpm db:seed
 */

const PUNTO_VENTA = Number(process.env.PUNTO_VENTA ?? 1)

/**
 * El seed borra todas las filas. Si la URL es remota, se niega salvo que se
 * pida con --forzar: nunca conviene vaciar una base de produccion por error.
 */
function revisarDestino() {
  const url = process.env.DATABASE_URL ?? 'file:./local.db'
  if (url.startsWith('libsql://') && !process.argv.includes('--forzar')) {
    console.error('La base es remota:', url)
    console.error('El seed borra todo. Si es lo que querés, corré: pnpm db:seed --forzar')
    process.exit(1)
  }
  console.log('Sembrando en', url)
}

async function limpiar() {
  // Orden inverso a las claves foraneas.
  await db.delete(movimientosCuenta)
  await db.delete(movimientosStock)
  await db.delete(facturaItems)
  await db.delete(pagos)
  await db.delete(facturas)
  await db.delete(productos)
  await db.delete(categorias)
  await db.delete(clientes)
  await db.delete(contadores)
  await db.delete(usuarios)
}

async function main() {
  revisarDestino()
  await limpiar()

  const [admin, vendedor] = await db
    .insert(usuarios)
    .values([
      {
        nombre: 'Ana Pérez',
        email: 'admin@comercial.test',
        hash: await bcrypt.hash('admin1234', 10),
        rol: 'admin',
      },
      {
        nombre: 'Bruno Díaz',
        email: 'vendedor@comercial.test',
        hash: await bcrypt.hash('vendedor1234', 10),
        rol: 'vendedor',
      },
    ])
    .returning()

  const [almacen, bebidas, limpieza] = await db
    .insert(categorias)
    .values([{ nombre: 'Almacén' }, { nombre: 'Bebidas' }, { nombre: 'Limpieza' }])
    .returning()

  const catalogo = [
    { codigo: 'A001', descripcion: 'Yerba mate 1 kg', categoriaId: almacen.id, precio: 480000, existencia: 24, stockMinimo: 6 },
    { codigo: 'A002', descripcion: 'Azúcar 1 kg', categoriaId: almacen.id, precio: 165000, existencia: 40, stockMinimo: 10 },
    { codigo: 'A003', descripcion: 'Arroz 1 kg', categoriaId: almacen.id, precio: 210000, existencia: 9, stockMinimo: 8 },
    { codigo: 'B001', descripcion: 'Agua mineral 1,5 L', categoriaId: bebidas.id, precio: 120000, existencia: 60, stockMinimo: 12 },
    { codigo: 'B002', descripcion: 'Gaseosa cola 2,25 L', categoriaId: bebidas.id, precio: 320000, existencia: 36, stockMinimo: 12 },
    { codigo: 'L001', descripcion: 'Detergente 750 ml', categoriaId: limpieza.id, precio: 245000, existencia: 18, stockMinimo: 6 },
  ]

  const creados = await db.insert(productos).values(catalogo).returning()

  // La existencia inicial se registra como una entrada, no como un numero suelto.
  await db.insert(movimientosStock).values(
    creados
      .filter((p) => p.existencia > 0)
      .map((p) => ({
        productoId: p.id,
        tipo: 'ingreso',
        cantidad: p.existencia,
        existenciaResultante: p.existencia,
        motivo: 'Stock inicial',
        usuarioId: admin.id,
      })),
  )

  const [mayorista, consumidor] = await db
    .insert(clientes)
    .values([
      {
        nombre: 'Almacén Don Pedro',
        tipoDoc: 'CUIT',
        nroDoc: '20123456789',
        telefono: '3425551234',
        email: 'pedro@correo.test',
        domicilio: 'San Martín 1234',
        cuentaCorriente: true,
        limiteCredito: 5000000,
      },
      {
        nombre: 'María Gómez',
        tipoDoc: 'DNI',
        nroDoc: '27876543',
        telefono: '3425559876',
        cuentaCorriente: false,
      },
    ])
    .returning()

  await db.insert(contadores).values([
    { nombre: `factura:${String(PUNTO_VENTA).padStart(4, '0')}`, valor: 0 },
    { nombre: 'recibo', valor: 0 },
  ])

  // Ventas de ejemplo: una de contado, una en cuenta corriente y una con tarjeta.
  // Se insertan con el mismo criterio que el servicio: comprobante, renglones,
  // movimiento de stock y, si corresponde, débito en la cuenta del cliente.
  const porCodigo = new Map(creados.map((producto) => [producto.codigo, producto]))
  const ventasDemo = [
    {
      formaPago: 'contado' as const,
      cliente: null,
      montoRecibido: 800000,
      lineas: [
        { codigo: 'A001', cantidad: 1 },
        { codigo: 'B001', cantidad: 2 },
      ],
    },
    {
      formaPago: 'cuenta_corriente' as const,
      cliente: mayorista,
      montoRecibido: null,
      lineas: [
        { codigo: 'A002', cantidad: 2 },
        { codigo: 'L001', cantidad: 1 },
      ],
    },
    {
      formaPago: 'tarjeta' as const,
      cliente: consumidor,
      montoRecibido: null,
      lineas: [
        { codigo: 'B002', cantidad: 1 },
        { codigo: 'A003', cantidad: 1 },
      ],
    },
  ]

  let numero = 0
  for (const venta of ventasDemo) {
    numero += 1
    const lineas = venta.lineas.map((linea) => {
      const producto = porCodigo.get(linea.codigo)
      if (!producto) throw new Error(`Falta el producto ${linea.codigo} en el seed`)
      return {
        producto,
        cantidad: linea.cantidad,
        subtotal: producto.precio * linea.cantidad,
      }
    })
    const total = lineas.reduce((suma, linea) => suma + linea.subtotal, 0)
    const comprobante = `${String(PUNTO_VENTA).padStart(4, '0')}-${String(numero).padStart(8, '0')}`

    const [factura] = await db
      .insert(facturas)
      .values({
        puntoVenta: PUNTO_VENTA,
        numero,
        clienteId: venta.cliente?.id ?? null,
        clienteNombre: venta.cliente?.nombre ?? null,
        clienteDocumento: venta.cliente?.nroDoc ?? null,
        total,
        formaPago: venta.formaPago,
        montoRecibido: venta.montoRecibido,
        vuelto: venta.montoRecibido !== null ? venta.montoRecibido - total : null,
        usuarioId: admin.id,
      })
      .returning()

    await db.insert(facturaItems).values(
      lineas.map((linea) => ({
        facturaId: factura.id,
        productoId: linea.producto.id,
        codigo: linea.producto.codigo,
        descripcion: linea.producto.descripcion,
        cantidad: linea.cantidad,
        precioUnitario: linea.producto.precio,
        subtotal: linea.subtotal,
      })),
    )

    for (const linea of lineas) {
      const existencia = linea.producto.existencia - linea.cantidad
      await db.update(productos).set({ existencia }).where(eq(productos.id, linea.producto.id))
      linea.producto.existencia = existencia

      await db.insert(movimientosStock).values({
        productoId: linea.producto.id,
        tipo: 'venta',
        cantidad: -linea.cantidad,
        existenciaResultante: existencia,
        motivo: `Venta ${comprobante}`,
        facturaId: factura.id,
        usuarioId: admin.id,
      })
    }

    if (venta.formaPago === 'cuenta_corriente' && venta.cliente) {
      await db.insert(movimientosCuenta).values({
        clienteId: venta.cliente.id,
        tipo: 'debito',
        importe: total,
        descripcion: `Factura ${comprobante}`,
        facturaId: factura.id,
      })
    }
  }

  await db
    .update(contadores)
    .set({ valor: numero })
    .where(eq(contadores.nombre, `factura:${String(PUNTO_VENTA).padStart(4, '0')}`))

  console.log('Base cargada.')
  console.log(`  usuarios   ${admin.email} / vendedor: ${vendedor.email}`)
  console.log(`  categorias ${[almacen, bebidas, limpieza].map((c) => c.nombre).join(', ')}`)
  console.log(`  productos  ${creados.length}`)
  console.log(`  clientes   ${mayorista.nombre}, ${consumidor.nombre}`)
  console.log(`  ventas     ${numero} de ejemplo`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
