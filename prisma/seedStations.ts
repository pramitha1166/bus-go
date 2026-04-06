import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Prisma v7 requires the adapter to be passed explicitly even in seed scripts.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const stations = [
  // ── Western Province ────────────────────────────────────────────────────────
  { name: "Colombo Fort",  nameLocal: "Kolomba Kotuwa", district: "Colombo",  province: "Western" },
  { name: "Pettah",        nameLocal: "Pitakotte",       district: "Colombo",  province: "Western" },
  { name: "Borella",       nameLocal: "Borella",         district: "Colombo",  province: "Western" },
  { name: "Maharagama",    nameLocal: "Maharagama",      district: "Colombo",  province: "Western" },
  { name: "Nugegoda",      nameLocal: "Nugegoda",        district: "Colombo",  province: "Western" },
  { name: "Kaduwela",      nameLocal: "Kaduwela",        district: "Colombo",  province: "Western" },
  { name: "Moratuwa",      nameLocal: "Moratuwa",        district: "Colombo",  province: "Western" },
  { name: "Avissawella",   nameLocal: "Avissawella",     district: "Colombo",  province: "Western" },
  { name: "Panadura",      nameLocal: "Panadura",        district: "Kalutara", province: "Western" },
  { name: "Kalutara",      nameLocal: "Kalutara",        district: "Kalutara", province: "Western" },
  { name: "Horana",        nameLocal: "Horana",          district: "Kalutara", province: "Western" },
  { name: "Aluthgama",     nameLocal: "Aluthgama",       district: "Kalutara", province: "Western" },
  { name: "Negombo",       nameLocal: "Migemuwa",        district: "Gampaha",  province: "Western" },
  { name: "Ja-Ela",        nameLocal: "Ja-Ela",          district: "Gampaha",  province: "Western" },
  { name: "Wattala",       nameLocal: "Wattala",         district: "Gampaha",  province: "Western" },
  { name: "Katunayake",    nameLocal: "Katunayake",      district: "Gampaha",  province: "Western" },
  { name: "Minuwangoda",   nameLocal: "Minuwangoda",     district: "Gampaha",  province: "Western" },
  { name: "Gampaha",       nameLocal: "Gampaha",         district: "Gampaha",  province: "Western" },
  { name: "Veyangoda",     nameLocal: "Veyangoda",       district: "Gampaha",  province: "Western" },

  // ── Central Province ────────────────────────────────────────────────────────
  { name: "Kandy",         nameLocal: "Maha Nuwara",    district: "Kandy",       province: "Central" },
  { name: "Peradeniya",    nameLocal: "Peradeniya",     district: "Kandy",       province: "Central" },
  { name: "Gampola",       nameLocal: "Gampola",        district: "Kandy",       province: "Central" },
  { name: "Nawalapitiya",  nameLocal: "Nawalapitiya",   district: "Kandy",       province: "Central" },
  { name: "Matale",        nameLocal: "Matale",         district: "Matale",      province: "Central" },
  { name: "Dambulla",      nameLocal: "Dambulla",       district: "Matale",      province: "Central" },
  { name: "Sigiriya",      nameLocal: "Sigiriya",       district: "Matale",      province: "Central" },
  { name: "Nuwara Eliya",  nameLocal: "Nuwara Eliya",   district: "Nuwara Eliya", province: "Central" },
  { name: "Hatton",        nameLocal: "Hatton",         district: "Nuwara Eliya", province: "Central" },
  { name: "Talawakele",    nameLocal: "Talawakele",     district: "Nuwara Eliya", province: "Central" },

  // ── Southern Province ───────────────────────────────────────────────────────
  { name: "Galle",         nameLocal: "Galle",         district: "Galle",      province: "Southern" },
  { name: "Hikkaduwa",     nameLocal: "Hikkaduwa",     district: "Galle",      province: "Southern" },
  { name: "Ambalangoda",   nameLocal: "Ambalangoda",   district: "Galle",      province: "Southern" },
  { name: "Matara",        nameLocal: "Matara",        district: "Matara",     province: "Southern" },
  { name: "Weligama",      nameLocal: "Weligama",      district: "Matara",     province: "Southern" },
  { name: "Tangalle",      nameLocal: "Tangalle",      district: "Hambantota", province: "Southern" },
  { name: "Hambantota",    nameLocal: "Hambantota",    district: "Hambantota", province: "Southern" },
  { name: "Tissamaharama", nameLocal: "Tissamaharama", district: "Hambantota", province: "Southern" },

  // ── North Western Province ──────────────────────────────────────────────────
  { name: "Kurunegala",  nameLocal: "Kurunegala",  district: "Kurunegala", province: "North Western" },
  { name: "Chilaw",      nameLocal: "Chilaw",      district: "Puttalam",   province: "North Western" },
  { name: "Puttalam",    nameLocal: "Puttalam",    district: "Puttalam",   province: "North Western" },
  { name: "Wariyapola",  nameLocal: "Wariyapola",  district: "Kurunegala", province: "North Western" },
  { name: "Kuliyapitiya",nameLocal: "Kuliyapitiya",district: "Kurunegala", province: "North Western" },

  // ── North Central Province ──────────────────────────────────────────────────
  { name: "Anuradhapura", nameLocal: "Anuradhapura", district: "Anuradhapura", province: "North Central" },
  { name: "Polonnaruwa",  nameLocal: "Polonnaruwa",  district: "Polonnaruwa",  province: "North Central" },
  { name: "Habarana",     nameLocal: "Habarana",     district: "Anuradhapura", province: "North Central" },
  { name: "Kekirawa",     nameLocal: "Kekirawa",     district: "Anuradhapura", province: "North Central" },

  // ── Uva Province ────────────────────────────────────────────────────────────
  { name: "Badulla",     nameLocal: "Badulla",     district: "Badulla",   province: "Uva" },
  { name: "Bandarawela", nameLocal: "Bandarawela", district: "Badulla",   province: "Uva" },
  { name: "Haputale",    nameLocal: "Haputale",    district: "Badulla",   province: "Uva" },
  { name: "Ella",        nameLocal: "Ella",        district: "Badulla",   province: "Uva" },
  { name: "Wellawaya",   nameLocal: "Wellawaya",   district: "Monaragala", province: "Uva" },
  { name: "Monaragala",  nameLocal: "Monaragala",  district: "Monaragala", province: "Uva" },

  // ── Sabaragamuwa Province ───────────────────────────────────────────────────
  { name: "Ratnapura",    nameLocal: "Ratnapura",    district: "Ratnapura", province: "Sabaragamuwa" },
  { name: "Kegalle",      nameLocal: "Kegalle",      district: "Kegalle",   province: "Sabaragamuwa" },
  { name: "Balangoda",    nameLocal: "Balangoda",    district: "Ratnapura", province: "Sabaragamuwa" },
  { name: "Embilipitiya", nameLocal: "Embilipitiya", district: "Ratnapura", province: "Sabaragamuwa" },

  // ── Eastern Province ────────────────────────────────────────────────────────
  { name: "Trincomalee",  nameLocal: "Trincomalee",  district: "Trincomalee", province: "Eastern" },
  { name: "Batticaloa",   nameLocal: "Batticaloa",   district: "Batticaloa",  province: "Eastern" },
  { name: "Ampara",       nameLocal: "Ampara",       district: "Ampara",      province: "Eastern" },
  { name: "Kalmunai",     nameLocal: "Kalmunai",     district: "Ampara",      province: "Eastern" },
  { name: "Akkaraipattu", nameLocal: "Akkaraipattu", district: "Ampara",      province: "Eastern" },

  // ── Northern Province ───────────────────────────────────────────────────────
  { name: "Jaffna",          nameLocal: "Yaalpaanam",    district: "Jaffna",     province: "Northern" },
  { name: "Vavuniya",        nameLocal: "Vavuniya",      district: "Vavuniya",   province: "Northern" },
  { name: "Mannar",          nameLocal: "Mannar",        district: "Mannar",     province: "Northern" },
  { name: "Kilinochchi",     nameLocal: "Kilinochchi",   district: "Kilinochchi",province: "Northern" },
  { name: "Mullaitivu",      nameLocal: "Mullaitivu",    district: "Mullaitivu", province: "Northern" },
  { name: "Chavakachcheri",  nameLocal: "Chavakachcheri",district: "Jaffna",     province: "Northern" },
  { name: "Point Pedro",     nameLocal: "Paranthan",     district: "Jaffna",     province: "Northern" },
];

async function main() {
  console.log("Seeding stations...");
  let seeded = 0;

  for (const s of stations) {
    await prisma.busStation.upsert({
      where:  { name: s.name },
      update: {
        nameLocal: s.nameLocal,
        district:  s.district,
        province:  s.province,
        isActive:  true,
      },
      create: {
        name:      s.name,
        nameLocal: s.nameLocal,
        district:  s.district,
        province:  s.province,
        isActive:  true,
      },
    });
    seeded++;
  }

  console.log(`Seeding stations... ${seeded} stations seeded successfully.`);

  const total = await prisma.busStation.count();
  console.log(`Total stations in database: ${total}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
