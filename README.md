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
- Tailwind CSS 4 + shadcn/ui
- Chart.js con `react-chartjs-2` para los gráficos del tablero
- Drizzle ORM + libSQL (`@libsql/client`)
- SQLite local en desarrollo, Turso en producción
- Zod para validación compartida
- `jose` para la sesión firmada y `bcryptjs` para las contraseñas
- Route Handlers de Next.js para la API REST bajo `/api`

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

El seed deja datos suficientes para la defensa: 2 usuarios, 5 categorías, 30
productos, 10 clientes, 50 facturas emitidas en los últimos 30 días (una anulada),
3 pagos y 4 productos por debajo del stock mínimo. Las ventas y los pagos se crean
con `registrarVenta()` y `registrarPago()`, no con SQL crudo, para que el stock y
la cuenta corriente queden consistentes.

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
| `/` | tablero: ventas de hoy y del mes, deuda, stock bajo, gráficos y últimas ventas |
| `/ventas` | historial de comprobantes con búsqueda y resumen del día |
| `/ventas/nueva` | punto de venta con carrito, pago y alta rápida de cliente |
| `/ventas/[id]` | comprobante con renglones, totales, forma de pago y anulación |
| `/productos` | catálogo con búsqueda, precios, existencias y estado |
| `/productos/nuevo` | alta de producto con stock inicial |
| `/productos/[id]` | detalle, edición, movimientos e historial |
| `/productos/categorias` | alta y activación de categorías, solo administrador |
| `/productos/movimientos` | historial global de stock con filtros |
| `/productos/movimientos/nuevo` | entrada o salida manual de stock |
| `/clientes` | listado, búsqueda, saldo y estado de cuenta corriente |
| `/clientes/nuevo` | alta de cliente |
| `/clientes/[id]` | datos, historial de cuenta y registro de pagos |
| `/usuarios` | administración de cuentas, solo para el administrador |
| `/usuarios/nuevo` | alta de usuario |
| `/usuarios/[id]` | edición, rol y estado |
| `/perfil` | cambio de contraseña del usuario conectado |

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

### Anulación de facturas

Solo el administrador puede anular. La operación es un reverso completo dentro de
una transacción:

1. Marca la factura como `anulada` y guarda motivo, autor y fecha.
2. Reingresa el stock de cada renglón con un movimiento de tipo `anulacion`.
3. Si la venta fue en cuenta corriente, graba un crédito por el total.
4. No borra la factura ni reutiliza el número.

Una segunda anulación devuelve `409 FACTURA_ANULADA`. En la interfaz, el
formulario pide el motivo y una confirmación explícita; el vendedor no ve el
bloque.

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

Cada usuario puede cambiar su contraseña desde `/perfil`: se verifica la actual
y se guarda el hash nuevo con `bcrypt`. El administrador también puede generar
una contraseña temporal desde la ficha de un usuario.

### Tablero

El tablero calcula los indicadores en cada request, sin tablas de resumen. Muestra
ventas del día y del mes, deuda total, productos bajo mínimo y las últimas ventas.
Tres gráficos de Chart.js completan la portada: la serie de ventas de los últimos
30 días, la torta de formas de pago del mes y las barras de productos más vendidos.

## API REST

La API vive bajo `/api` con Route Handlers de Next.js: 23 archivos `route.ts`
publican 31 endpoints. Los formularios de administración siguen usando Server
Actions; el POS confirma la venta contra `POST /api/facturas` y busca productos
contra `GET /api/productos?q=…`. Las dos puertas llaman a los mismos servicios:
ninguna regla vive en el adaptador.

| Módulo | Endpoints |
| --- | --- |
| Sesión | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/password` |
| Usuarios | `GET/POST /api/usuarios`, `PATCH /api/usuarios/[id]`, `POST /api/usuarios/[id]/reset-password` |
| Categorías | `GET/POST /api/categorias`, `PATCH /api/categorias/[id]` |
| Productos | `GET/POST /api/productos`, `GET/PATCH /api/productos/[id]`, `GET/POST /api/productos/[id]/movimientos` |
| Stock | `GET /api/movimientos-stock` |
| Clientes | `GET/POST /api/clientes`, `GET/PATCH /api/clientes/[id]`, `GET /api/clientes/[id]/cuenta` |
| Pagos | `POST /api/clientes/[id]/pagos`, `GET /api/pagos/[id]` |
| Facturas | `GET/POST /api/facturas`, `GET /api/facturas/[id]`, `POST /api/facturas/[id]/anulacion`, `GET /api/facturas/proximo-numero` |
| Tablero | `GET /api/tablero` |

Los importes viajan en centavos y los esquemas Zod son estrictos: un campo
desconocido devuelve `422 VALIDACION`. Los errores usan el formato
`{ error: { code, message, details } }` con los códigos del enunciado:
`STOCK_INSUFICIENTE` (409), `CUENTA_CORRIENTE_NO_HABILITADA` (422),
`LIMITE_CREDITO_EXCEDIDO` (422), `PAGO_SUPERA_DEUDA` (422),
`MONTO_INSUFICIENTE` (422), `FACTURA_ANULADA` (409), `OPERACION_SOBRE_SI_MISMO`
(422), `SIN_PERMISO` (403) y `NO_ENCONTRADO` (404).

## Reglas de negocio

1. **Una venta es una transacción.** Comprobante, renglones, stock, deuda y
   numeración se escriben juntos o no se escribe nada.
2. **El stock se descuenta con una condición en la base.** El `UPDATE` lleva
   `existencia >= cantidad`; dos ventas simultáneas no pueden dejar stock
   negativo.
3. **El saldo se calcula.** No hay una columna `saldo` que pueda desincronizarse.
4. **El rol se verifica en el servidor.** Ocultar un botón es comodidad; cada
   acción de administración vuelve a exigir `requerirAdmin()`, y la API responde
   `403 SIN_PERMISO`.
5. **La anulación es un reverso, no un borrado.** La factura queda con estado
   `anulada`, el stock vuelve y la deuda se acredita en la misma transacción.

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
- `src/app/api`: Route Handlers de la API REST. Validan con Zod, llaman al
  servicio y traducen el error al formato común.
- `src/server/actions`: Server Actions. Validan el formulario, llaman al
  servicio, revalidan y redirigen.
- `src/server`: servicios con las reglas y las transacciones.
- `src/lib`: dinero, fechas, errores, validación Zod y restauración de formularios.
- `src/db`: esquema Drizzle, conexión y seed.

`src/server/api.ts` concentra el envoltorio de la API: sesión, lectura del JSON,
paginación y traducción de errores. Una ruta declara si exige administrador y
delega; no repite reglas de negocio.

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
- Anulación desde la interfaz: estado `Anulada`, stock reingresado y segunda
  anulación rechazada.
- API REST probada contra el servidor local: login, `403` del vendedor, `409` de
  documento duplicado, `422` de campo desconocido, `409` de stock insuficiente,
  venta `201`, anulación `200`, `400` de JSON inválido, pago `201`, búsqueda por
  documento y tablero.
- Cambio de contraseña en `/perfil` y login con la contraseña nueva.
- `pnpm build` compila las 31 rutas de API y las 18 páginas sin errores de tipos.

## Publicación

La base remota vive en Turso y la aplicación en Vercel. Las variables de
producción son `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET` y
`PUNTO_VENTA`. El seed remoto se corrió una vez con `pnpm db:seed --forzar`.

La guía publicada está en
<https://tup-2do.web.app/sistema-parcial/guia-defensa>.
