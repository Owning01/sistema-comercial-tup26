import { z } from 'zod'

/**
 * Esquemas de la API REST. A diferencia de los formularios, acá los importes
 * llegan en centavos y los cuerpos son JSON. Los objetos son estrictos: un
 * campo desconocido (por ejemplo `existencia` o el número completo de una
 * tarjeta) se rechaza con 422 VALIDACION.
 */

const enteroPositivo = z.number().int().positive()
const centavos = z.number().int().nonnegative()

const texto = (minimo: number, maximo: number) => z.string().trim().min(minimo).max(maximo)

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(120)
  .refine((valor) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor), 'El email no tiene formato válido.')

const documento = z
  .string()
  .trim()
  .min(5, 'Ingresá el documento.')
  .max(20, 'El documento no puede superar los 20 caracteres.')
  .transform((valor) => valor.replace(/[.\s]/g, '').toUpperCase())

export const loginApiSchema = z
  .object({
    email,
    password: z.string().min(1, 'Ingresá tu contraseña.').max(200),
  })
  .strict()

export const passwordApiSchema = z
  .object({
    actual: z.string().min(1, 'Ingresá la contraseña actual.').max(200),
    nueva: z.string().min(8, 'La contraseña nueva necesita al menos 8 caracteres.').max(100),
  })
  .strict()

export const usuarioApiSchema = z
  .object({
    nombre: texto(2, 120),
    email,
    rol: z.enum(['admin', 'vendedor']),
    password: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.').max(100),
  })
  .strict()

export const usuarioPatchSchema = z
  .object({
    nombre: texto(2, 120).optional(),
    email: email.optional(),
    rol: z.enum(['admin', 'vendedor']).optional(),
    activo: z.boolean().optional(),
  })
  .strict()

export const categoriaApiSchema = z.object({ nombre: texto(2, 80) }).strict()

export const categoriaPatchSchema = z
  .object({
    nombre: texto(2, 80).optional(),
    activa: z.boolean().optional(),
  })
  .strict()

export const productoApiSchema = z
  .object({
    codigo: texto(1, 20).transform((valor) => valor.toUpperCase()),
    descripcion: texto(2, 120),
    categoriaId: enteroPositivo.nullable().optional(),
    precio: enteroPositivo,
    stockMinimo: centavos,
    stockInicial: centavos.optional(),
    activo: z.boolean().optional(),
  })
  .strict()

export const productoPatchSchema = z
  .object({
    codigo: texto(1, 20).transform((valor) => valor.toUpperCase()).optional(),
    descripcion: texto(2, 120).optional(),
    categoriaId: enteroPositivo.nullable().optional(),
    precio: enteroPositivo.optional(),
    stockMinimo: centavos.optional(),
    activo: z.boolean().optional(),
  })
  .strict()

const motivosIngreso = ['Reposición', 'Stock inicial', 'Devolución de cliente'] as const
const motivosEgreso = ['Rotura', 'Vencimiento', 'Ajuste de inventario', 'Uso interno'] as const

export const movimientoApiSchema = z
  .object({
    tipo: z.enum(['ingreso', 'egreso']),
    cantidad: enteroPositivo,
    motivo: texto(2, 120),
    observacion: texto(0, 200).optional(),
  })
  .strict()
  .superRefine((datos, ctx) => {
    const permitidos: readonly string[] = datos.tipo === 'ingreso' ? motivosIngreso : motivosEgreso
    if (!permitidos.includes(datos.motivo)) {
      ctx.addIssue({
        code: 'custom',
        path: ['motivo'],
        message: `Para un ${datos.tipo} el motivo tiene que ser: ${permitidos.join(', ')}.`,
      })
    }
  })

const clienteBase = {
  tipoDoc: z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE']),
  nroDoc: documento,
  nombre: texto(2, 120),
  domicilio: texto(0, 200).nullish(),
  telefono: texto(0, 40).nullish(),
  email: email.nullish(),
  cuentaCorriente: z.boolean().optional(),
  limiteCredito: centavos.nullable().optional(),
}

export const clienteApiSchema = z.object(clienteBase).strict()

export const clientePatchSchema = z
  .object({
    ...clienteBase,
    activo: z.boolean().optional(),
  })
  .partial()
  .strict()

export const pagoApiSchema = z
  .object({
    importe: enteroPositivo,
    medio: z.enum(['efectivo', 'transferencia', 'tarjeta_debito']),
    observacion: texto(0, 200).nullish(),
  })
  .strict()

const itemVenta = z
  .object({
    productoId: enteroPositivo,
    cantidad: enteroPositivo.max(9999),
  })
  .strict()

const pagoVenta = z.discriminatedUnion('forma', [
  z
    .object({
      forma: z.literal('contado'),
      montoRecibido: centavos.optional(),
    })
    .strict(),
  z
    .object({
      forma: z.literal('tarjeta'),
      tarjeta: z
        .object({
          tipo: z.enum(['debito', 'credito']),
          marca: texto(2, 40),
          ultimos4: z.string().regex(/^\d{4}$/, 'Los últimos 4 dígitos tienen que ser exactamente 4 números.'),
        })
        .strict(),
    })
    .strict(),
  z.object({ forma: z.literal('cuenta_corriente') }).strict(),
])

export const ventaApiSchema = z
  .object({
    clienteId: enteroPositivo.nullable(),
    items: z
      .array(itemVenta)
      .min(1, 'Agregá al menos un producto.')
      .max(50, 'La venta no puede tener más de 50 renglones.')
      .refine(
        (items) => new Set(items.map((item) => item.productoId)).size === items.length,
        'Hay productos repetidos en la venta.',
      ),
    pago: pagoVenta,
  })
  .strict()

export const anulacionApiSchema = z
  .object({
    motivo: texto(3, 200),
  })
  .strict()
