import { PrismaClient } from '@prisma/client';

// In development Next.js reloads modules on every edit; without the global the
// dev server accumulates a new pool per reload until Postgres refuses more.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * The Postgres schema Prisma is writing to.
 *
 * Prisma qualifies its own queries, but it does not set `search_path`, so any
 * `$queryRaw` / `$executeRaw` has to qualify table and type names itself.
 * Reading it from the connection string keeps raw SQL correct whether the app
 * is pointed at `quranminds`, `public`, or a per-tenant schema.
 */
export const DB_SCHEMA = readSchemaName();

function readSchemaName() {
  const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || '';
  let name = 'public';
  try {
    name = new URL(url).searchParams.get('schema') || 'public';
  } catch {
    // Malformed or absent URL - Prisma will fail loudly on its own.
  }
  // Identifiers reach SQL through Prisma.raw, so nothing but a plain name.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to use "${name}" as a Postgres schema name`);
  }
  return name;
}

export default prisma;
