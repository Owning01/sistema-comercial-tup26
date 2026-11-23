import { z } from 'zod'
import { aCentavos } from './dinero'

/** Lo que entra por el formulario de login. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Ingresá tu email.')
    .max(120)
    .refine((valor) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor), 'El email no tiene formato válido.'),
  password: z.string().min(1, 'Ingresá tu contraseña.').max(200),
})

export type Login = z.infer<typeof loginSchema>

/**
 * Precio escrito en pesos. Se convierte a centavos acá, una sola vez, para que
 * el servicio y la base trabajen siempre con enteros.
 */
const precioEnPesos = z
  .string()
  .trim()
  .min(1, 'Ingresá el precio.')
  .transform((valor) => aCentavos(valor))
  .refine((valor): valor is number => valor !== null && valor > 0, 'El precio tiene que ser mayor que cero.')

const enteroNoNegativo = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? 0 : Number(valor)))
  .refine((valor) => Number.isInteger(valor) && valor >= 0, 'Tiene que ser un número entero mayor o igual a cero.')

const enteroPositivo = z
  .string()
  .trim()
  .transform((valor) => Number(valor))
  .refine((valor) => Number.isInteger(valor) && valor > 0, 'Tiene que ser un número entero mayor que cero.')

const casilla = z
  .string()
  .nullish()
  .transform((valor) => valor === 'on' || valor === 'true')

export const productoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(1, 'Ingresá el código.')
    .max(20, 'El código no puede superar los 20 caracteres.')
    .transform((valor) => valor.toUpperCase()),
  descripcion: z
    .string()
    .trim()
    .min(2, 'La descripción tiene que tener al menos 2 caracteres.')
    .max(120, 'La descripción no puede superar los 120 caracteres.'),
  categoriaId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : Number(valor)))
    .refine((valor) => valor === null || (Number.isInteger(valor) && valor > 0), 'Categoría inválida.'),
  precio: precioEnPesos,
  stockMinimo: enteroNoNegativo,
  stockInicial: enteroNoNegativo,
  activo: casilla,
})

export const editarProductoSchema = productoSchema.omit({ stockInicial: true })

export type ProductoForm = z.infer<typeof productoSchema>
export type EditarProductoForm = z.infer<typeof editarProductoSchema>

export const movimientoSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso'], { message: 'Elegí entrada o salida.' }),
  cantidad: enteroPositivo,
  motivo: z.string().trim().min(2, 'Escribí el motivo.').max(120, 'El motivo es demasiado largo.'),
  observacion: z
    .string()
    .trim()
    .max(200, 'La observación es demasiado larga.')
    .transform((valor) => (valor === '' ? null : valor)),
})

export type MovimientoForm = z.infer<typeof movimientoSchema>

// ---------------------------------------------------------------------------
// Clientes, usuarios y ventas
// ---------------------------------------------------------------------------

const textoOpcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo, `No puede superar los ${maximo} caracteres.`)
    .nullish()
    .transform((valor) => (valor ? valor : null))

const emailOpcional = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .nullish()
  .transform((valor) => (valor ? valor : null))
  .refine(
    (valor) => valor === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor),
    'El email no tiene formato válido.',
  )

/** Importe escrito en pesos. Vacío significa "sin límite" (null). */
const pesosOpcional = z
  .string()
  .trim()
  .nullish()
  .transform((valor) => {
    if (!valor) return null
    const centavos = aCentavos(valor)
    return centavos === null ? Number.NaN : centavos
  })
  .refine(
    (valor) => valor === null || (Number.isFinite(valor) && valor > 0),
    'El límite tiene que ser un importe mayor que cero.',
  )

const documento = z
  .string()
  .trim()
  .min(5, 'Ingresá el documento.')
  .max(20, 'El documento no puede superar los 20 caracteres.')
  .transform((valor) => valor.replace(/[.\s]/g, '').toUpperCase())

export const clienteSchema = z
  .object({
    tipoDoc: z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE'], { message: 'Elegí el tipo de documento.' }),
    nroDoc: documento,
    nombre: z
      .string()
      .trim()
      .min(2, 'El nombre tiene que tener al menos 2 caracteres.')
      .max(120, 'El nombre no puede superar los 120 caracteres.'),
    domicilio: textoOpcional(200),
    telefono: textoOpcional(40),
    email: emailOpcional,
    cuentaCorriente: casilla,
    limiteCredito: pesosOpcional,
  })
  .refine((datos) => Boolean(datos.telefono || datos.email), {
    message: 'Ingresá un teléfono o un email de contacto.',
    path: ['telefono'],
  })

export const editarClienteSchema = clienteSchema.extend({
  activo: casilla,
})

export type ClienteForm = z.infer<typeof clienteSchema>
export type EditarClienteForm = z.infer<typeof editarClienteSchema>

export const usuarioSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre tiene que tener al menos 2 caracteres.')
    .max(120, 'El nombre no puede superar los 120 caracteres.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Ingresá el email.')
    .max(120)
    .refine((valor) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor), 'El email no tiene formato válido.'),
  rol: z.enum(['admin', 'vendedor'], { message: 'Elegí el rol.' }),
  password: z
    .string()
    .min(8, 'La contraseña necesita al menos 8 caracteres.')
    .max(100, 'La contraseña es demasiado larga.'),
})

export const editarUsuarioSchema = usuarioSchema.extend({
  password: z
    .string()
    .max(100)
    .nullish()
    .transform((valor) => (valor ? valor : null))
    .refine(
      (valor) => valor === null || valor.length >= 8,
      'La contraseña nueva necesita al menos 8 caracteres.',
    ),
  activo: casilla,
})

export type UsuarioForm = z.infer<typeof usuarioSchema>
export type EditarUsuarioForm = z.infer<typeof editarUsuarioSchema>

export const pagoSchema = z.object({
  importe: precioEnPesos,
  medio: z.enum(['efectivo', 'transferencia', 'tarjeta_debito'], {
    message: 'Elegí el medio de pago.',
  }),
  observacion: textoOpcional(200),
})

export type PagoForm = z.infer<typeof pagoSchema>

export const tarjetaSchema = z.object({
  tipo: z.enum(['debito', 'credito'], { message: 'Elegí débito o crédito.' }),
  marca: z.string().trim().min(2, 'Elegí la marca de la tarjeta.').max(40),
  ultimos4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Los últimos 4 dígitos tienen que ser exactamente 4 números.'),
})

export const ventaSchema = z
  .object({
    clienteId: z.number().int().positive().nullable(),
    formaPago: z.enum(['contado', 'tarjeta', 'cuenta_corriente'], {
      message: 'Elegí la forma de pago.',
    }),
    montoRecibido: z.number().int().nonnegative().nullable(),
    tarjeta: tarjetaSchema.nullable(),
    items: z
      .array(
        z.object({
          productoId: z.number().int().positive(),
          cantidad: z.number().int().positive().max(9999, 'La cantidad es demasiado grande.'),
        }),
      )
      .min(1, 'Agregá al menos un producto.')
      .max(50, 'La venta no puede tener más de 50 renglones.'),
  })
  .refine(
    (datos) => new Set(datos.items.map((item) => item.productoId)).size === datos.items.length,
    'Hay productos repetidos en la venta.',
  )

export type VentaForm = z.infer<typeof ventaSchema>
export type TarjetaForm = z.infer<typeof tarjetaSchema>

export const categoriaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre tiene que tener al menos 2 caracteres.')
    .max(80, 'El nombre no puede superar los 80 caracteres.'),
})

export const cambioPasswordSchema = z
  .object({
    actual: z.string().min(1, 'Ingresá la contraseña actual.').max(200),
    nueva: z.string().min(8, 'La contraseña nueva necesita al menos 8 caracteres.').max(100),
    repetir: z.string().min(8, 'Repetí la contraseña nueva.').max(100),
  })
  .refine((datos) => datos.nueva === datos.repetir, {
    message: 'Las contraseñas nuevas no coinciden.',
    path: ['repetir'],
  })

