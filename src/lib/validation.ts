import { z } from 'zod'

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
