import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

/**
 * Modelo de datos del sistema comercial.
 *
 * Tres decisiones que conviene tener presentes al leer el esquema:
 * 1. El dinero se guarda en centavos, siempre entero. Nunca un float.
 * 2. La factura copia descripcion y precio: el comprobante no cambia si
 *    despues cambia el catalogo.
 * 3. El saldo de la cuenta corriente no se guarda: se deriva de
 *    movimientos_cuenta (debitos menos creditos).
 */

const ahora = () => new Date()

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export const usuarios = sqliteTable(
  'usuarios',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    hash: text('hash').notNull(),
    rol: text('rol', { enum: ['admin', 'vendedor'] }).notNull().default('vendedor'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    creadoEn: integer('creado_en', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
  },
  (t) => [uniqueIndex('ux_usuarios_email').on(t.email)],
)

// ---------------------------------------------------------------------------
// Catalogo
// ---------------------------------------------------------------------------

export const categorias = sqliteTable(
  'categorias',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    nombre: text('nombre').notNull(),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('ux_categorias_nombre').on(t.nombre)],
)

export const productos = sqliteTable(
  'productos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigo: text('codigo').notNull(),
    descripcion: text('descripcion').notNull(),
    categoriaId: integer('categoria_id').references(() => categorias.id),
    /** Precio de venta en centavos. */
    precio: integer('precio').notNull(),
    /** Existencia actual. La escribe solo un movimiento de stock. */
    existencia: integer('existencia').notNull().default(0),
    stockMinimo: integer('stock_minimo').notNull().default(0),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    creadoEn: integer('creado_en', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
  },
  (t) => [
    uniqueIndex('ux_productos_codigo').on(t.codigo),
    index('ix_productos_descripcion').on(t.descripcion),
    index('ix_productos_categoria').on(t.categoriaId),
  ],
)

export const movimientosStock = sqliteTable(
  'movimientos_stock',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    /** ingreso, egreso, ajuste, venta o anulacion. */
    tipo: text('tipo').notNull(),
    /** Positivo suma, negativo resta. Nunca cero. */
    cantidad: integer('cantidad').notNull(),
    /** Foto de la existencia despues del movimiento. Sirve para auditar. */
    existenciaResultante: integer('existencia_resultante').notNull(),
    motivo: text('motivo'),
    observacion: text('observacion'),
    facturaId: integer('factura_id'),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
    fecha: integer('fecha', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
  },
  (t) => [
    index('ix_movstock_producto').on(t.productoId),
    index('ix_movstock_factura').on(t.facturaId),
  ],
)

// ---------------------------------------------------------------------------
// Clientes y cuenta corriente
// ---------------------------------------------------------------------------

export const clientes = sqliteTable(
  'clientes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tipoDoc: text('tipo_doc').notNull().default('DNI'),
    nroDoc: text('nro_doc').notNull(),
    nombre: text('nombre').notNull(),
    domicilio: text('domicilio'),
    telefono: text('telefono'),
    email: text('email'),
    /** Solo los clientes habilitados pueden comprar en cuenta corriente. */
    cuentaCorriente: integer('cuenta_corriente', { mode: 'boolean' }).notNull().default(false),
    /** Limite en centavos. null = sin limite. */
    limiteCredito: integer('limite_credito'),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    creadoEn: integer('creado_en', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
  },
  (t) => [
    uniqueIndex('ux_clientes_documento').on(t.nroDoc),
    index('ix_clientes_nombre').on(t.nombre),
  ],
)

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export const facturas = sqliteTable(
  'facturas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    puntoVenta: integer('punto_venta').notNull(),
    numero: integer('numero').notNull(),
    fecha: integer('fecha', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
    /** null = consumidor final. */
    clienteId: integer('cliente_id').references(() => clientes.id),
    /** Copia del cliente al momento de la venta. */
    clienteNombre: text('cliente_nombre'),
    clienteDocumento: text('cliente_documento'),
    /** Total en centavos. */
    total: integer('total').notNull(),
    formaPago: text('forma_pago', {
      enum: ['contado', 'tarjeta', 'cuenta_corriente'],
    }).notNull(),
    /** Efectivo entregado, en centavos. Solo contado. */
    montoRecibido: integer('monto_recibido'),
    /** Vuelto, en centavos. Se muestra tal como se entrego. */
    vuelto: integer('vuelto'),
    estado: text('estado', { enum: ['emitida', 'anulada'] })
      .notNull()
      .default('emitida'),
    tarjetaTipo: text('tarjeta_tipo'),
    tarjetaMarca: text('tarjeta_marca'),
    tarjetaUltimos4: text('tarjeta_ultimos4'),
    motivoAnulacion: text('motivo_anulacion'),
    anuladaEn: integer('anulada_en', { mode: 'timestamp' }),
    anuladaPorId: integer('anulada_por_id').references(() => usuarios.id),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
  },
  (t) => [
    uniqueIndex('ux_facturas_numero').on(t.puntoVenta, t.numero),
    index('ix_facturas_fecha').on(t.fecha),
    index('ix_facturas_cliente').on(t.clienteId),
  ],
)

export const facturaItems = sqliteTable(
  'factura_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    facturaId: integer('factura_id')
      .notNull()
      .references(() => facturas.id),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    /** Copia del codigo del producto. */
    codigo: text('codigo').notNull(),
    /** Copia de la descripcion del producto. */
    descripcion: text('descripcion').notNull(),
    cantidad: integer('cantidad').notNull(),
    /** Precio unitario en centavos, copiado del catalogo. */
    precioUnitario: integer('precio_unitario').notNull(),
    /** cantidad * precioUnitario, guardado para no recalcular. */
    subtotal: integer('subtotal').notNull(),
  },
  (t) => [
    index('ix_items_factura').on(t.facturaId),
    index('ix_items_producto').on(t.productoId),
  ],
)

// ---------------------------------------------------------------------------
// Cuenta corriente
// ---------------------------------------------------------------------------

export const pagos = sqliteTable(
  'pagos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    numero: integer('numero').notNull(),
    /** Importe en centavos. */
    importe: integer('importe').notNull(),
    medio: text('medio').notNull(),
    observacion: text('observacion'),
    fecha: integer('fecha', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
  },
  (t) => [
    uniqueIndex('ux_pagos_numero').on(t.numero),
    index('ix_pagos_cliente').on(t.clienteId),
  ],
)

export const movimientosCuenta = sqliteTable(
  'movimientos_cuenta',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    /** debito = deuda del cliente, credito = pago. */
    tipo: text('tipo', { enum: ['debito', 'credito'] }).notNull(),
    /** Importe en centavos, siempre positivo. El signo lo da el tipo. */
    importe: integer('importe').notNull(),
    descripcion: text('descripcion'),
    facturaId: integer('factura_id').references(() => facturas.id),
    pagoId: integer('pago_id').references(() => pagos.id),
    fecha: integer('fecha', { mode: 'timestamp' }).notNull().$defaultFn(ahora),
  },
  (t) => [
    index('ix_movcuenta_cliente').on(t.clienteId),
    index('ix_movcuenta_factura').on(t.facturaId),
  ],
)

// ---------------------------------------------------------------------------
// Contadores
// ---------------------------------------------------------------------------

/**
 * Ultimo numero usado por serie. Se incrementa dentro de la misma transaccion
 * que emite el comprobante: si la venta falla, el numero no se consume.
 * El nombre lleva el punto de venta: "factura:0001".
 */
export const contadores = sqliteTable('contadores', {
  nombre: text('nombre').primaryKey(),
  valor: integer('valor').notNull().default(0),
})

// ---------------------------------------------------------------------------
// Tipos derivados
// ---------------------------------------------------------------------------

export type Usuario = typeof usuarios.$inferSelect
export type Categoria = typeof categorias.$inferSelect
export type Producto = typeof productos.$inferSelect
export type MovimientoStock = typeof movimientosStock.$inferSelect
export type Cliente = typeof clientes.$inferSelect
export type Factura = typeof facturas.$inferSelect
export type FacturaItem = typeof facturaItems.$inferSelect
export type Pago = typeof pagos.$inferSelect
export type MovimientoCuenta = typeof movimientosCuenta.$inferSelect
