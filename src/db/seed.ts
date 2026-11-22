import bcrypt from 'bcryptjs'
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
  await limpiar()

  const [admin, vendedor] = await db
    .insert(usuarios)
    .values([
      {
        nombre: 'Administrador',
        email: 'admin@comercial.test',
        hash: await bcrypt.hash('admin1234', 10),
        rol: 'admin',
      },
      {
        nombre: 'Vendedor Mostrador',
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
    { codigo: 'A003', descripcion: 'Arroz 1 kg', categoriaId: almacen.id, precio: 210000, existencia: 30, stockMinimo: 8 },
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

  console.log('Base cargada.')
  console.log(`  usuarios   ${admin.email} / vendedor: ${vendedor.email}`)
  console.log(`  categorias ${[almacen, bebidas, limpieza].map((c) => c.nombre).join(', ')}`)
  console.log(`  productos  ${creados.length}`)
  console.log(`  clientes   ${mayorista.nombre}, ${consumidor.nombre}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
