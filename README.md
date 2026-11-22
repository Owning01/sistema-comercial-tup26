# Sistema de Gestión Comercial

Segundo parcial de **Programación IV** — 2026.

Sistema de facturación, control de stock y cuenta corriente para un comercio minorista.

## Integrantes

| Legajo | Nombre |
| --- | --- |
| 63717 | González, Octavio |
| 63352 | Cordero, Leonel Rodrigo |
| 63321 | Zottola Caram, Ignacio |

## Estado

Base montada y verificada. La aplicación arranca, migra la base y muestra una
consulta real en la portada. Falta la interfaz de los módulos, la autenticación
y el flujo de venta.

La guía de estudio y defensa está en [`docs/guia-defensa.html`](docs/guia-defensa.html).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Drizzle ORM + libSQL (`@libsql/client`)
- SQLite local en desarrollo, Turso en producción
- Zod para validación compartida
- `jose` para la sesión firmada y `bcryptjs` para las contraseñas

## Puesta en marcha

```bash
pnpm install
cp .env.example .env       # completar AUTH_SECRET
pnpm db:migrate            # crea local.db con las 10 tablas
pnpm db:seed               # datos de prueba
pnpm dev                   # http://localhost:3000
```

Para producción, cambiar `DATABASE_URL` por la URL de Turso y completar
`DATABASE_AUTH_TOKEN`. La misma migración corre contra Turso.

## Usuarios de prueba

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | `admin@comercial.test` | `admin1234` |
| Vendedor | `vendedor@comercial.test` | `vendedor1234` |

## Modelo de datos

| Tabla | Para qué |
| --- | --- |
| `usuarios` | acceso al sistema, con rol `admin` o `vendedor` |
| `categorias` | agrupación del catálogo |
| `productos` | código, precio, existencia, stock mínimo y estado |
| `movimientos_stock` | ingresos, egresos, ajustes y ventas, con existencia resultante |
| `clientes` | datos, habilitación de cuenta corriente y límite de crédito |
| `facturas` | comprobante con número por punto de venta, total y forma de pago |
| `factura_items` | renglones con descripción y precio copiados del catálogo |
| `pagos` | recibos de la cuenta corriente |
| `movimientos_cuenta` | débitos y créditos que forman el saldo |
| `contadores` | último número usado por serie, sin huecos |

Tres decisiones del esquema:

1. El dinero se guarda en centavos, siempre entero.
2. La factura copia descripción y precio: el comprobante no cambia si después
   cambia el catálogo.
3. El saldo de la cuenta corriente no se guarda: se deriva de
   `movimientos_cuenta`, débitos menos créditos.
