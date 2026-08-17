const { PrismaClient } = require("./generated/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEMO_ACCOUNTS = [
  { label: "Root", email: "root.demo@fraternidade.local", profileLevel: "ROOT" },
  { label: "Coordenação Geral", email: "coordenacao.demo@fraternidade.local", profileLevel: "COORDENACAO_GERAL" },
  { label: "Coordenador", email: "coordenador.demo@fraternidade.local", profileLevel: "COORDENADOR" },
  { label: "Membro", email: "membro.demo@fraternidade.local", profileLevel: "MEMBRO" },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  
  for (const acc of DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: acc.email },
      update: {
        passwordHash,
        profileLevel: acc.profileLevel
      },
      create: {
        email: acc.email,
        passwordHash,
        profileLevel: acc.profileLevel,
        member: {
          create: {
            fullName: acc.label
          }
        }
      }
    });
    console.log(`Created/Updated ${acc.email}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
