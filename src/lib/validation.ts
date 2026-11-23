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
})

export const editarProductoSchema = productoSchema.omit({ stockInicial: true }).extend({
  // Un checkbox desmarcado no viaja en el FormData: null tambien es "no".
  activo: z
    .string()
    .nullish()
    .transform((valor) => valor === 'on' || valor === 'true'),
})

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
