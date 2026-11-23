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

Productos y stock funcionando. La aplicación pide sesión, administra el catálogo
y registra cada entrada o salida con usuario, fecha y motivo. Falta la cuenta
corriente de clientes y el flujo de venta.

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
`DATABASE_AUTH_TOKEN`. La misma migración corre contra Turso. Las credenciales
de Turso de este equipo quedan en `.env.turso.local`, que no se versiona.

`pnpm db:seed` borra todas las filas y se niega a correr contra una base remota.
Si de verdad hay que sembrar Turso, se pide con `pnpm db:seed --forzar`.

## Acceso

| Ruta | Quién entra |
| --- | --- |
| `/login` | público |
| `/` | solo con sesión; si no hay, redirige a `/login` |
| `/productos` | listado, búsqueda y alta |
| `/productos/[id]` | detalle, edición, movimientos e historial |

La sesión es un JWT HS256 firmado con `AUTH_SECRET` y guardado en una cookie
`httpOnly` de ocho horas. El rol viaja en el token y el servicio lo vuelve a
verificar contra la base.

## Productos y stock

La existencia no se edita: cambia solo por un movimiento. Cada movimiento
actualiza `productos.existencia` e inserta la fila en `movimientos_stock` dentro
de la misma transacción. Una salida mayor a la existencia se rechaza con un
mensaje que indica cuántas unidades quedan.

El stock inicial de un alta se registra como una entrada de tipo `ingreso`. El
precio se escribe en pesos, se convierte a centavos una sola vez y se guarda como
entero. El código de producto es único y se guarda en mayúsculas.

## Usuarios de prueba

| Rol | Nombre | Email | Contraseña |
| --- | --- | --- | --- |
| Administrador | Ana Pérez | `admin@comercial.test` | `admin1234` |
| Vendedor | Bruno Díaz | `vendedor@comercial.test` | `vendedor1234` |

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
