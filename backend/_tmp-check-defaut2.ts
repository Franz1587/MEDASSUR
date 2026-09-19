import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const a = await prisma.accordPrealable.findFirst({ where: { description: "Test defaut Accorde" } });
  console.log(JSON.stringify(a));
}
main().finally(() => prisma.$disconnect());
