import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit lee .env por su cuenta. Local usa un archivo SQLite; en
 * produccion la misma configuracion apunta a Turso con el token.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./local.db',
    // drizzle-kit exige un token con dialecto turso. Un archivo local lo ignora.
    authToken: process.env.DATABASE_AUTH_TOKEN || 'local',
  },
  verbose: true,
  strict: true,
})
