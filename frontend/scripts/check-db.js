// Simple DB connectivity check using @prisma/client
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
async function main() {
  const dbUrl = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/hoshid';
  console.log('Using DATABASE_URL=', dbUrl.replace(/:[^:@]+@/, ':*****@'));
  try {
    const connectionString = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/hoshid';
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });
    await prisma.$connect();
    const res = await prisma.$queryRaw`SELECT 1 as ok`;
    console.log('Query result:', res);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(2);
  }
}

main();
