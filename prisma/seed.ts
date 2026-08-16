import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

const MISSIONS = [
  { name: "Sede Sóbrio", slug: "sede-sobrio" },
  { name: "Casais", slug: "casais" },
  { name: "Leigos", slug: "leigos" },
  { name: "Juventude", slug: "juventude" },
];

const MINISTRIES = [
  { name: "Teatro", slug: "teatro" },
  { name: "Intercessão", slug: "intercessao" },
  { name: "Música", slug: "musica" },
  { name: "Comunicação", slug: "comunicacao" },
];

async function main() {
  for (const mission of MISSIONS) {
    await prisma.mission.upsert({
      where: { slug: mission.slug },
      update: {},
      create: mission,
    });
  }

  for (const ministry of MINISTRIES) {
    await prisma.ministry.upsert({
      where: { slug: ministry.slug },
      update: {},
      create: ministry,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
