import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'
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
import { crearCategoria } from '../server/categorias'
import { crearProducto, moverStock, obtenerProducto } from '../server/productos'
import { crearCliente, obtenerCliente, registrarPago } from '../server/clientes'
import { anularVenta, registrarVenta } from '../server/ventas'
import type { Sesion } from '../server/auth'

/**
 * Carga inicial para desarrollo y para la demo. Borra y vuelve a crear todo.
 *
 *   pnpm db:seed
 *
 * Las facturas y los pagos se crean con los mismos servicios que usa la
 * aplicación (sección 10.7): el stock, los saldos y la numeración quedan
 * validados por las mismas reglas.
 */

const PUNTO_VENTA = Number(process.env.PUNTO_VENTA ?? 1)

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
  // Orden inverso a las claves foráneas.
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

/** Generador reproducible: el mismo seed da siempre las mismas ventas. */
function creadorAzar(semillaInicial: number) {
  let semilla = semillaInicial >>> 0
  return () => {
    semilla = (semilla * 1664525 + 1013904223) >>> 0
    return semilla / 0x100000000
  }
}

const azar = creadorAzar(20261122)

function elegir<T>(filas: T[]): T {
  return filas[Math.floor(azar() * filas.length)]
}

function enteroEntre(minimo: number, maximo: number) {
  return Math.floor(azar() * (maximo - minimo + 1)) + minimo
}

function barajar<T>(filas: T[]) {
  const copia = [...filas]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

async function main() {
  revisarDestino()
  await limpiar()

  const [admin] = await db
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

  const sesionAdmin: Sesion = { id: admin.id, nombre: admin.nombre, rol: 'admin' }

  // 5 categorías (sección 8: datos de prueba).
  const nombresCategorias = ['Almacén', 'Bebidas', 'Limpieza', 'Ferretería', 'Electricidad']
  const categoriasCreadas = []
  for (const nombre of nombresCategorias) {
    categoriasCreadas.push(await crearCategoria(sesionAdmin, nombre))
  }
  const porNombre = new Map(categoriasCreadas.map((categoria) => [categoria.nombre, categoria.id]))

  // 30 productos: seis por categoría.
  const catalogo: { codigo: string; descripcion: string; categoria: string; precio: number; stockMinimo: number }[] = [
    { codigo: 'A001', descripcion: 'Yerba mate 1 kg', categoria: 'Almacén', precio: 480000, stockMinimo: 10 },
    { codigo: 'A002', descripcion: 'Azúcar 1 kg', categoria: 'Almacén', precio: 165000, stockMinimo: 12 },
    { codigo: 'A003', descripcion: 'Arroz largo fino 1 kg', categoria: 'Almacén', precio: 210000, stockMinimo: 10 },
    { codigo: 'A004', descripcion: 'Aceite de girasol 1,5 L', categoria: 'Almacén', precio: 395000, stockMinimo: 8 },
    { codigo: 'A005', descripcion: 'Fideos tallarín 500 g', categoria: 'Almacén', precio: 145000, stockMinimo: 15 },
    { codigo: 'A006', descripcion: 'Café molido 250 g', categoria: 'Almacén', precio: 520000, stockMinimo: 6 },
    { codigo: 'B001', descripcion: 'Agua mineral 1,5 L', categoria: 'Bebidas', precio: 120000, stockMinimo: 18 },
    { codigo: 'B002', descripcion: 'Gaseosa cola 2,25 L', categoria: 'Bebidas', precio: 320000, stockMinimo: 12 },
    { codigo: 'B003', descripcion: 'Jugo de naranja 1 L', categoria: 'Bebidas', precio: 285000, stockMinimo: 10 },
    { codigo: 'B004', descripcion: 'Cerveza rubia lata 473 ml', categoria: 'Bebidas', precio: 260000, stockMinimo: 24 },
    { codigo: 'B005', descripcion: 'Vino tinto malbec 750 ml', categoria: 'Bebidas', precio: 540000, stockMinimo: 6 },
    { codigo: 'B006', descripcion: 'Energizante 500 ml', categoria: 'Bebidas', precio: 310000, stockMinimo: 12 },
    { codigo: 'L001', descripcion: 'Detergente 750 ml', categoria: 'Limpieza', precio: 245000, stockMinimo: 8 },
    { codigo: 'L002', descripcion: 'Lavandina 1 L', categoria: 'Limpieza', precio: 135000, stockMinimo: 10 },
    { codigo: 'L003', descripcion: 'Jabón en polvo 800 g', categoria: 'Limpieza', precio: 420000, stockMinimo: 8 },
    { codigo: 'L004', descripcion: 'Papel higiénico 4 rollos', categoria: 'Limpieza', precio: 380000, stockMinimo: 12 },
    { codigo: 'L005', descripcion: 'Limpiador de pisos 900 ml', categoria: 'Limpieza', precio: 290000, stockMinimo: 6 },
    { codigo: 'L006', descripcion: 'Esponja multiuso', categoria: 'Limpieza', precio: 65000, stockMinimo: 20 },
    { codigo: 'F001', descripcion: 'Martillo carpintero 500 g', categoria: 'Ferretería', precio: 1250000, stockMinimo: 4 },
    { codigo: 'F002', descripcion: 'Destornillador Phillips', categoria: 'Ferretería', precio: 480000, stockMinimo: 6 },
    { codigo: 'F003', descripcion: 'Cinta métrica 5 m', categoria: 'Ferretería', precio: 390000, stockMinimo: 6 },
    { codigo: 'F004', descripcion: 'Clavos 2 pulgadas 1 kg', categoria: 'Ferretería', precio: 220000, stockMinimo: 10 },
    { codigo: 'F005', descripcion: 'Llave ajustable 8 pulgadas', categoria: 'Ferretería', precio: 890000, stockMinimo: 4 },
    { codigo: 'F006', descripcion: 'Guantes de trabajo', categoria: 'Ferretería', precio: 175000, stockMinimo: 12 },
    { codigo: 'E001', descripcion: 'Lámpara LED 12 W', categoria: 'Electricidad', precio: 320000, stockMinimo: 10 },
    { codigo: 'E002', descripcion: 'Cinta aisladora 20 m', categoria: 'Electricidad', precio: 190000, stockMinimo: 15 },
    { codigo: 'E003', descripcion: 'Tomacorriente doble', categoria: 'Electricidad', precio: 275000, stockMinimo: 10 },
    { codigo: 'E004', descripcion: 'Cable unipolar 2,5 mm x 10 m', categoria: 'Electricidad', precio: 640000, stockMinimo: 5 },
    { codigo: 'E005', descripcion: 'Llave de luz simple', categoria: 'Electricidad', precio: 185000, stockMinimo: 12 },
    { codigo: 'E006', descripcion: 'Tubo LED 18 W', categoria: 'Electricidad', precio: 450000, stockMinimo: 8 },
  ]

  const productosCreados = []
  for (const item of catalogo) {
    const creado = await crearProducto(sesionAdmin, {
      codigo: item.codigo,
      descripcion: item.descripcion,
      categoriaId: porNombre.get(item.categoria) ?? null,
      precio: item.precio,
      stockMinimo: item.stockMinimo,
      stockInicial: 300,
      activo: true,
    })
    productosCreados.push(creado)
  }

  // 10 clientes. Cinco con cuenta corriente y límite; uno sin contacto extra.
  const clientesDemo = [
    { nombre: 'Almacén Don Pedro', tipoDoc: 'CUIT' as const, nroDoc: '20123456789', telefono: '3425551234', email: 'pedro@correo.test', domicilio: 'San Martín 1234', cuentaCorriente: true, limiteCredito: 80000000 },
    { nombre: 'Mariana López', tipoDoc: 'DNI' as const, nroDoc: '28456123', telefono: '3425552210', email: 'mariana.lopez@correo.test', domicilio: 'Las Heras 455', cuentaCorriente: true, limiteCredito: 40000000 },
    { nombre: 'Carlos Benítez', tipoDoc: 'DNI' as const, nroDoc: '30555111', telefono: '3425557766', email: 'carlos.benitez@correo.test', domicilio: 'Rivadavia 88', cuentaCorriente: true, limiteCredito: 25000000 },
    { nombre: 'Lucía Fernández', tipoDoc: 'DNI' as const, nroDoc: '35666777', telefono: '3425558899', email: 'lucia.fernandez@correo.test', domicilio: 'Belgrano 202', cuentaCorriente: true, limiteCredito: 60000000 },
    { nombre: 'Comercio El Sol', tipoDoc: 'CUIT' as const, nroDoc: '30712345678', telefono: '3425553344', email: 'elsol@correo.test', domicilio: 'Mitre 750', cuentaCorriente: true, limiteCredito: 120000000 },
    { nombre: 'María Gómez', tipoDoc: 'DNI' as const, nroDoc: '27876543', telefono: '3425559876', email: 'maria.gomez@correo.test', domicilio: 'Urquiza 12', cuentaCorriente: false, limiteCredito: null },
    { nombre: 'Jorge Ríos', tipoDoc: 'DNI' as const, nroDoc: '22333444', telefono: '3425551122', email: 'jorge.rios@correo.test', domicilio: 'Catamarca 310', cuentaCorriente: false, limiteCredito: null },
    { nombre: 'Sofía Peralta', tipoDoc: 'DNI' as const, nroDoc: '39111222', telefono: '3425554455', email: 'sofia.peralta@correo.test', domicilio: 'Moreno 99', cuentaCorriente: false, limiteCredito: null },
    { nombre: 'Diego Sosa', tipoDoc: 'DNI' as const, nroDoc: '33444555', telefono: '3425556677', email: 'diego.sosa@correo.test', domicilio: 'Sarmiento 640', cuentaCorriente: false, limiteCredito: null },
    { nombre: 'Valentina Ruiz', tipoDoc: 'DNI' as const, nroDoc: '40999888', telefono: '3425557788', email: 'valentina.ruiz@correo.test', domicilio: '9 de Julio 145', cuentaCorriente: false, limiteCredito: null },
  ]

  const clientesCreados = []
  for (const item of clientesDemo) {
    clientesCreados.push(await crearCliente(item))
  }

  const conCuenta = clientesCreados.filter((cliente) => cliente.cuentaCorriente)

  // Existencias locales para decidir cuándo reponer y calcular el efectivo.
  const stock = new Map(
    productosCreados.map((producto) => [
      producto.id,
      { precio: producto.precio, existencia: producto.existencia },
    ]),
  )

  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const base = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate())

  function fechaDeVenta(diasAtras: number) {
    const dia = base - diasAtras * 24 * 60 * 60 * 1000
    const hora = enteroEntre(9, 19)
    const minuto = enteroEntre(0, 59)
    return new Date(dia + (hora + 3) * 60 * 60 * 1000 + minuto * 60 * 1000)
  }

  const facturasCreadas: { id: number; formaPago: string; clienteId: number | null }[] = []

  // 50 facturas repartidas en los últimos 30 días. Las tres primeras son de hoy
  // para que el tablero tenga datos desde el primer arranque.
  for (let indice = 0; indice < 50; indice++) {
    const diasAtras = indice < 3 ? 0 : enteroEntre(0, 29)
    const fecha = fechaDeVenta(diasAtras)

    const disponibles = barajar(productosCreados)
    const cantidadRenglones = enteroEntre(1, 4)
    const elegidos = disponibles.slice(0, cantidadRenglones)
    const items = elegidos.map((producto) => ({
      productoId: producto.id,
      cantidad: enteroEntre(1, 3),
    }))

    const total = items.reduce((suma, item) => {
      const dato = stock.get(item.productoId)
      return suma + (dato?.precio ?? 0) * item.cantidad
    }, 0)

    const suerte = azar()
    const formaPago = suerte < 0.5 ? 'contado' : suerte < 0.8 ? 'tarjeta' : 'cuenta_corriente'

    let clienteId: number | null = null
    if (formaPago === 'cuenta_corriente') {
      clienteId = elegir(conCuenta).id
    } else if (azar() < 0.45) {
      clienteId = elegir(clientesCreados).id
    }

    const tarjeta =
      formaPago === 'tarjeta'
        ? {
            tipo: azar() < 0.7 ? ('debito' as const) : ('credito' as const),
            marca: elegir(['Visa', 'Mastercard', 'American Express', 'Cabal']),
            ultimos4: String(enteroEntre(1000, 9999)),
          }
        : null

    const montoRecibido =
      formaPago === 'contado' && azar() < 0.5 ? total + enteroEntre(0, 20) * 10000 : null

    const factura = await registrarVenta(
      sesionAdmin,
      {
        clienteId,
        formaPago,
        montoRecibido,
        tarjeta,
        items,
      },
      { fecha },
    )

    facturasCreadas.push({ id: factura.id, formaPago, clienteId })

    for (const item of items) {
      const dato = stock.get(item.productoId)
      if (!dato) continue
      dato.existencia -= item.cantidad

      if (dato.existencia < 40) {
        await moverStock(sesionAdmin, item.productoId, {
          tipo: 'ingreso',
          cantidad: 250,
          motivo: 'Reposición',
          observacion: 'Reposición del seed',
        })
        const actualizado = await obtenerProducto(item.productoId)
        dato.existencia = actualizado.existencia
      }
    }
  }

  // Una factura anulada para que el estado y el reingreso de stock se vean en la demo.
  const paraAnular = facturasCreadas.find(
    (factura) => factura.formaPago === 'cuenta_corriente' && factura.clienteId !== null,
  )
  if (paraAnular) {
    await anularVenta(sesionAdmin, paraAnular.id, 'Error en la carga de cantidades')
  }

  // Cuatro productos quedan por debajo del mínimo para que el tablero muestre
  // la alerta de reposición desde el primer arranque.
  for (const producto of productosCreados.slice(0, 4)) {
    const actual = await obtenerProducto(producto.id)
    const objetivo = Math.max(0, actual.stockMinimo - 1)
    const cantidad = actual.existencia - objetivo
    if (cantidad > 0) {
      await moverStock(sesionAdmin, producto.id, {
        tipo: 'egreso',
        cantidad,
        motivo: 'Ajuste de inventario',
        observacion: 'Stock bajo para la demo',
      })
    }
  }

  // Pagos parciales de tres clientes con deuda.
  const conDeuda = []
  for (const cliente of conCuenta) {
    const actual = await obtenerCliente(cliente.id)
    if (actual.saldo > 0 && actual.id !== paraAnular?.clienteId) conDeuda.push(actual)
  }

  let pagosCreados = 0
  for (const cliente of conDeuda.slice(0, 3)) {
    const importe = Math.floor(cliente.saldo * 0.4)
    if (importe <= 0) continue
    await registrarPago(
      sesionAdmin,
      cliente.id,
      {
        importe,
        medio: elegir(['efectivo', 'transferencia', 'tarjeta_debito']),
        observacion: 'Pago parcial de la cuenta corriente',
      },
      { fecha: new Date(Date.now() - enteroEntre(0, 5) * 24 * 60 * 60 * 1000) },
    )
    pagosCreados += 1
  }

  const [{ total: totalFacturas }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(facturas)

  console.log('Base cargada.')
  console.log(`  usuarios   ${admin.email} / vendedor@comercial.test`)
  console.log(`  categorias ${nombresCategorias.join(', ')}`)
  console.log(`  productos  ${productosCreados.length}`)
  console.log(`  clientes   ${clientesCreados.length}`)
  console.log(`  facturas   ${Number(totalFacturas)} (${paraAnular ? 1 : 0} anulada)`)
  console.log(`  pagos      ${pagosCreados}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
