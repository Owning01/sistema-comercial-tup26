# Sistema de Gestión Comercial

Segundo parcial de **Programación IV** — 2026.

Sistema de facturación, control de stock y cuenta corriente para un comercio minorista.

**En línea:** <https://sistema-comercial-tup26.vercel.app>

## Integrantes

| Legajo | Nombre |
| --- | --- |
| 63717 | González, Octavio |
| 63352 | Cordero, Leonel Rodrigo |
| 63321 | Zottola Caram, Ignacio |

## Estado

Sistema completo. Los cinco módulos del enunciado están implementados y probados:
ventas y facturación, productos y stock, clientes y cuenta corriente, usuarios y
tablero. `pnpm build` compila sin errores de tipos.

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

En Windows, `Copy-Item .env.example .env` hace lo mismo que `cp`.

Para producción, cambiar `DATABASE_URL` por la URL de Turso y completar
`DATABASE_AUTH_TOKEN`. La misma migración corre contra Turso. Las credenciales
de Turso de este equipo quedan en `.env.turso.local`, que no se versiona.

`pnpm db:seed` borra todas las filas y se niega a correr contra una base remota.
Si de verdad hay que sembrar Turso, se pide con `pnpm db:seed --forzar`.

## Acceso

| Rol | Nombre | Email | Contraseña |
| --- | --- | --- | --- |
| Administrador | Ana Pérez | `admin@comercial.test` | `admin1234` |
| Vendedor | Bruno Díaz | `vendedor@comercial.test` | `vendedor1234` |

`/login` es la única pantalla pública. Sin sesión, cualquier ruta del panel
redirige al login. La sesión es un JWT HS256 firmado con `AUTH_SECRET` y
guardado en una cookie `httpOnly` de ocho horas.

## Rutas

| Ruta | Qué hay |
| --- | --- |
| `/` | tablero: ventas de hoy y del mes, deuda, stock bajo y últimas ventas |
| `/ventas` | historial de comprobantes con búsqueda y resumen del día |
| `/ventas/nueva` | punto de venta con carrito, pago y alta rápida de cliente |
| `/ventas/[id]` | comprobante con renglones, totales y forma de pago |
| `/productos` | catálogo con búsqueda, precios, existencias y estado |
| `/productos/nuevo` | alta de producto con stock inicial |
| `/productos/[id]` | detalle, edición, movimientos e historial |
| `/productos/movimientos` | historial global de stock con filtros |
| `/productos/movimientos/nuevo` | entrada o salida manual de stock |
| `/clientes` | listado, búsqueda, saldo y estado de cuenta corriente |
| `/clientes/nuevo` | alta de cliente |
| `/clientes/[id]` | datos, historial de cuenta y registro de pagos |
| `/usuarios` | administración de cuentas, solo para el administrador |
| `/usuarios/nuevo` | alta de usuario |
| `/usuarios/[id]` | edición, rol y estado |

## Funcionalidades

### Ventas y facturación

El POS busca productos por código o descripción, arma el carrito con cantidades
y subtotales, y calcula el total. El pago puede ser de contado con vuelto, con
tarjeta simulada (tipo, marca y últimos cuatro dígitos) o en cuenta corriente.

Al confirmar, una sola transacción:

1. Lee el precio actual del catálogo y congela una copia en el renglón.
2. Reserva el próximo número del punto de venta.
3. Inserta el comprobante y sus renglones.
4. Descuenta el stock de cada producto con la condición `existencia >= cantidad`.
5. Si es cuenta corriente, registra el débito del cliente.

Si algo falla, no queda ni el comprobante ni el número. El cliente nunca envía
precios ni totales: solo `productoId` y `cantidad`.

### Productos y stock

La existencia no se edita: cambia solo por un movimiento. Cada movimiento
actualiza `productos.existencia` e inserta la fila en `movimientos_stock` dentro
de la misma transacción. Una salida mayor a la existencia se rechaza con un
mensaje que indica cuántas unidades quedan.

El stock inicial de un alta se registra como una entrada de tipo `ingreso`. El
precio se escribe en pesos, se convierte a centavos una sola vez y se guarda como
entero. El código de producto es único y se guarda en mayúsculas. Un producto
inactivo no aparece en el POS, pero sigue visible en los comprobantes viejos.

### Clientes y cuenta corriente

El saldo se deriva de `movimientos_cuenta`: débitos menos créditos. Un pago
graba un recibo numerado y un crédito en la misma transacción, y se rechaza si
supera la deuda. Una venta en cuenta corriente se rechaza si supera el límite de
crédito o si el cliente está inactivo.

### Usuarios y acceso

El administrador da de alta vendedores, cambia roles y activa o desactiva
cuentas. No puede desactivar su propia cuenta ni el último administrador activo.
El vendedor no ve la sección Usuarios y el servidor la bloquea igual.

## Reglas de negocio

1. **Una venta es una transacción.** Comprobante, renglones, stock, deuda y
   numeración se escriben juntos o no se escribe nada.
2. **El stock se descuenta con una condición en la base.** El `UPDATE` lleva
   `existencia >= cantidad`; dos ventas simultáneas no pueden dejar stock
   negativo.
3. **El saldo se calcula.** No hay una columna `saldo` que pueda desincronizarse.
4. **El rol se verifica en el servidor.** Ocultar un botón es comodidad; cada
   acción de administración vuelve a exigir `requerirAdmin()`.

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

## Arquitectura

- `src/app`: rutas y pantallas. Los listados y fichas son Server Components; el
  POS y los formularios interactivos son Client Components.
- `src/server/actions`: Server Actions. Validan el formulario, llaman al
  servicio, revalidan y redirigen.
- `src/server`: servicios con las reglas y las transacciones.
- `src/lib`: dinero, fechas, errores, validación Zod y restauración de formularios.
- `src/db`: esquema Drizzle, conexión y seed.

No hay una API REST: el enunciado pide una aplicación web y los formularios
llaman directo a las Server Actions. Los servicios quedan separados para poder
exponer una API más adelante sin duplicar reglas.

## Pruebas realizadas

- Login, cierre de sesión y redirección sin cookie.
- Alta, edición y activación de productos; salida mayor al stock rechazada.
- Alta de cliente, edición y validación de contacto.
- Venta de contado con vuelto y venta en cuenta corriente.
- Venta con stock insuficiente rechazada sin consumir número.
- Pago de cuenta corriente, pago parcial y pago mayor a la deuda rechazado.
- Alta rápida de cliente desde el POS sin perder el carrito.
- Numeración consecutiva sin huecos después de una venta fallida.
- Usuario vendedor bloqueado de `/usuarios`; último admin protegido.
- Layout sin desborde horizontal a 390 px.

## Publicación

La base remota vive en Turso y la aplicación en Vercel. Las variables de
producción son `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET` y
`PUNTO_VENTA`. El seed remoto se corrió una vez con `pnpm db:seed --forzar`.

La guía publicada está en
<https://tup-2do.web.app/sistema-parcial/guia-defensa>.
