import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

async function main() {
  const phone = process.env.ADMIN_PHONE;

  if (!phone) {
    throw new Error(
      "ADMIN_PHONE is not set in your environment. " +
      "Add it to .env.local before running the seed."
    );
  }

  const existing = await prisma.admin.findUnique({ where: { phone } });

  if (existing) {
    console.log(`Admin with phone ${phone} already exists (id: ${existing.id}). Skipping.`);
    return;
  }

  const admin = await prisma.admin.create({
    data: {
      name:  "Admin",
      phone,
    },
  });

  console.log(`Admin created successfully:`);
  console.log(`  id:    ${admin.id}`);
  console.log(`  name:  ${admin.name}`);
  console.log(`  phone: ${admin.phone}`);
  console.log();
  console.log("Additional admins can be added via the Neon SQL editor:");
  console.log(`  INSERT INTO "Admin" (id, name, phone, role, "createdAt")`);
  console.log(`  VALUES (gen_random_uuid(), 'Name', '94xxxxxxxxx', 'ADMIN', now());`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
