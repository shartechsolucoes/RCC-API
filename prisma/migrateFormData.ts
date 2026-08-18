import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const registrations = await prisma.registration.findMany({
    where: {
      formData: {
        not: "null",
      },
    },
  });

  console.log(`Encontradas ${registrations.length} inscrições com formData para avaliar.`);

  let count = 0;
  for (const reg of registrations) {
    if (!reg.formData || Object.keys(reg.formData).length === 0) continue;
    const data = reg.formData as any;
    
    // Converte temParenteNoEncontro de "sim"/"nao" para boolean
    const parenteVal = data.temParenteNoEncontro;
    const parenteBool = parenteVal === "sim" ? true : (parenteVal === "nao" ? false : (typeof parenteVal === "boolean" ? parenteVal : null));

    await prisma.registration.update({
      where: { id: reg.id },
      data: {
        nomeCracha: data.nomeCracha ?? null,
        sexo: data.sexo ?? null,
        dataNascimento: data.dataNascimento ?? null,
        instagram: data.instagram ?? null,
        escolaridade: data.escolaridade ?? null,
        profissao: data.profissao ?? null,
        
        rua: data.endereco?.rua ?? null,
        numero: data.endereco?.numero ?? null,
        bairro: data.endereco?.bairro ?? null,
        cidade: data.endereco?.cidade ?? null,
        cep: data.endereco?.cep ?? null,
        estado: data.endereco?.estado ?? null,
        complemento: data.endereco?.complemento ?? null,
        
        sacramentoBatismo: data.sacramentos?.batismo ?? null,
        sacramentoEucaristia: data.sacramentos?.eucaristia ?? null,
        sacramentoCrisma: data.sacramentos?.crisma ?? null,
        sacramentoNenhum: data.sacramentos?.nenhum ?? null,
        
        participouMovimento: data.participouMovimento ?? null,
        quaisMovimentos: data.quaisMovimentos ?? null,
        incentivadoPor: data.incentivadoPor ?? null,
        motivoEncontro: data.motivoEncontro ?? null,
        
        usaMedicamentoContinuo: data.medicamentoContinuo?.usa ?? null,
        qualMedicamento: data.medicamentoContinuo?.qual ?? null,
        temAlergiaMedicamento: data.alergiaMedicamento?.tem ?? null,
        quaisAlergiaMedicamento: data.alergiaMedicamento?.quais ?? null,
        temAlergiaAlimentar: data.alergiaAlimentar?.tem ?? null,
        quaisAlergiaAlimentar: data.alergiaAlimentar?.quais ?? null,
        precisaCuidadoEspecial: data.cuidadoEspecial?.precisa ?? null,
        qualCuidadoEspecial: data.cuidadoEspecial?.qual ?? null,
        
        isCasado: data.casado?.sim ?? null,
        dataCasamento: data.casado?.dataCasamento ?? null,
        nomeConjuge: data.casado?.nomeConjuge ?? null,
        temFilhos: data.temFilhos?.sim ?? null,
        idadesFilhos: data.temFilhos?.idades ?? null,
        temParenteNoEncontro: parenteBool,
        nomeParentesco: data.nomeParentesco ?? null,
        
        emergencia1Nome: data.contatosEmergencia?.[0]?.nome ?? null,
        emergencia1Telefone: data.contatosEmergencia?.[0]?.telefone ?? null,
        emergencia2Nome: data.contatosEmergencia?.[1]?.nome ?? null,
        emergencia2Telefone: data.contatosEmergencia?.[1]?.telefone ?? null,
        emergencia3Nome: data.contatosEmergencia?.[2]?.nome ?? null,
        emergencia3Telefone: data.contatosEmergencia?.[2]?.telefone ?? null,
        
        encontrosResgataMe: data.encontrosAnteriores?.resgataMe ?? null,
        encontrosResgatao: data.encontrosAnteriores?.resgatao ?? null,
        encontrosResgataMeConjugal: data.encontrosAnteriores?.resgataMeConjugal ?? null,
        encontrosOutros: data.encontrosAnteriores?.outros ?? null,
        encontrosOutrosQual: data.encontrosAnteriores?.outrosQual ?? null,
        encontrosNenhum: data.encontrosAnteriores?.nenhum ?? null,
      }
    });
    count++;
  }
  
  console.log(`Migração concluída com sucesso para ${count} inscrições.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
