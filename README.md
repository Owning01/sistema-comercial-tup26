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

En desarrollo. La guía de estudio y defensa está en [`docs/guia-defensa.html`](docs/guia-defensa.html).

## Stack previsto

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Drizzle ORM + SQLite local / Turso en producción
- Zod para validación compartida
- Chart.js para el tablero
- Vercel para el despliegue

## Puesta en marcha (se completa al implementar)

```bash
pnpm install
cp .env.example .env
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

## Usuarios de prueba (se completan al implementar)

| Rol | Email | Contraseña |
| --- | --- | --- |
| Administrador | — | — |
| Vendedor | — | — |
