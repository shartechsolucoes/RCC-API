// Catálogo dos campos configuráveis do formulário de inscrição. A coordenação
// geral escolhe, por evento, se cada campo não aparece, é opcional ou obrigatório
// (Event.formConfig). Nome, e-mail e celular sempre aparecem e são obrigatórios.
//
// `default` reproduz o formulário fixo que existia antes desta configuração.
// `kind` diz como verificar o "obrigatório":
//   text    → as colunas `columns` precisam vir preenchidas
//   yesno   → a pergunta sim/não (`columns[0]`) precisa ter resposta
//   choices → ao menos uma das opções (`columns`) marcada

export type FieldMode = "hidden" | "optional" | "required";

export interface FormField {
  key: string;
  label: string;
  section: string;
  kind: "text" | "yesno" | "choices";
  columns: string[];
  default: FieldMode;
}

export const FORM_FIELDS: FormField[] = [
  { key: "photo", label: "Foto", section: "Dados pessoais", kind: "text", columns: ["photoUrl"], default: "optional" },
  { key: "nomeCracha", label: "Nome no crachá", section: "Dados pessoais", kind: "text", columns: ["nomeCracha"], default: "required" },
  { key: "sexo", label: "Sexo", section: "Dados pessoais", kind: "text", columns: ["sexo"], default: "required" },
  { key: "dataNascimento", label: "Data de nascimento", section: "Dados pessoais", kind: "text", columns: ["dataNascimento"], default: "required" },
  { key: "cpf", label: "CPF", section: "Dados pessoais", kind: "text", columns: ["cpf"], default: "required" },

  { key: "cep", label: "CEP", section: "Endereço", kind: "text", columns: ["cep"], default: "required" },
  { key: "rua", label: "Rua / Avenida", section: "Endereço", kind: "text", columns: ["rua"], default: "required" },
  { key: "numero", label: "Número", section: "Endereço", kind: "text", columns: ["numero"], default: "required" },
  { key: "complemento", label: "Complemento", section: "Endereço", kind: "text", columns: ["complemento"], default: "hidden" },
  { key: "bairro", label: "Bairro", section: "Endereço", kind: "text", columns: ["bairro"], default: "required" },
  { key: "cidade", label: "Cidade", section: "Endereço", kind: "text", columns: ["cidade"], default: "required" },
  { key: "estado", label: "Estado", section: "Endereço", kind: "text", columns: ["estado"], default: "hidden" },

  { key: "instagram", label: "Instagram / rede social", section: "Contato", kind: "text", columns: ["instagram"], default: "optional" },

  { key: "escolaridade", label: "Grau de escolaridade", section: "Formação e profissão", kind: "text", columns: ["escolaridade"], default: "required" },
  { key: "profissao", label: "Profissão", section: "Formação e profissão", kind: "text", columns: ["profissao"], default: "required" },

  {
    key: "sacramentos",
    label: "Situação sacramental",
    section: "Vida de fé",
    kind: "choices",
    columns: ["sacramentoBatismo", "sacramentoEucaristia", "sacramentoCrisma", "sacramentoNenhum"],
    default: "optional",
  },
  { key: "movimentos", label: "Já participou de movimento de igreja", section: "Vida de fé", kind: "yesno", columns: ["participouMovimento", "quaisMovimentos"], default: "optional" },
  { key: "incentivadoPor", label: "Quem incentivou a participar", section: "Vida de fé", kind: "text", columns: ["incentivadoPor"], default: "optional" },
  { key: "parente", label: "Parentes/amigos que já fizeram o encontro", section: "Vida de fé", kind: "yesno", columns: ["temParenteNoEncontro", "nomeParentesco"], default: "optional" },
  { key: "motivoEncontro", label: "Por que deseja fazer o encontro", section: "Vida de fé", kind: "text", columns: ["motivoEncontro"], default: "optional" },

  { key: "medicamento", label: "Medicamento contínuo", section: "Saúde", kind: "yesno", columns: ["usaMedicamentoContinuo", "qualMedicamento"], default: "required" },
  { key: "alergiaMedicamento", label: "Alergia a medicamentos", section: "Saúde", kind: "yesno", columns: ["temAlergiaMedicamento", "quaisAlergiaMedicamento"], default: "required" },
  { key: "alergiaAlimentar", label: "Alergia alimentar", section: "Saúde", kind: "yesno", columns: ["temAlergiaAlimentar", "quaisAlergiaAlimentar"], default: "required" },
  { key: "cuidadoEspecial", label: "Cuidado especial", section: "Saúde", kind: "yesno", columns: ["precisaCuidadoEspecial", "qualCuidadoEspecial"], default: "required" },

  { key: "casado", label: "É casado(a)", section: "Situação familiar", kind: "yesno", columns: ["isCasado", "dataCasamento", "nomeConjuge"], default: "required" },
  { key: "filhos", label: "Tem filhos", section: "Situação familiar", kind: "yesno", columns: ["temFilhos", "idadesFilhos"], default: "required" },

  { key: "emergencia1", label: "Contato de emergência 1", section: "Contatos de emergência", kind: "text", columns: ["emergencia1Nome", "emergencia1Telefone"], default: "required" },
  { key: "emergencia2", label: "Contato de emergência 2", section: "Contatos de emergência", kind: "text", columns: ["emergencia2Nome", "emergencia2Telefone"], default: "optional" },
  { key: "emergencia3", label: "Contato de emergência 3", section: "Contatos de emergência", kind: "text", columns: ["emergencia3Nome", "emergencia3Telefone"], default: "optional" },

  {
    key: "encontros",
    label: "Encontros anteriores",
    section: "Encontros anteriores",
    kind: "choices",
    columns: ["encontrosResgataMe", "encontrosResgatao", "encontrosResgataMeConjugal", "encontrosOutros", "encontrosNenhum"],
    default: "optional",
  },
];

const MODES: FieldMode[] = ["hidden", "optional", "required"];

// Configuração efetiva de um evento: padrão do catálogo sobreposto pelo que foi salvo.
export function resolveFormConfig(saved: unknown): Record<string, FieldMode> {
  const stored = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(
    FORM_FIELDS.map((field) => {
      const value = stored[field.key];
      return [field.key, MODES.includes(value as FieldMode) ? (value as FieldMode) : field.default];
    }),
  );
}

// Aceita só chaves do catálogo e modos válidos (o que vier além disso é descartado).
export function sanitizeFormConfig(input: Record<string, unknown>): Record<string, FieldMode> {
  return Object.fromEntries(
    FORM_FIELDS.filter((f) => MODES.includes(input[f.key] as FieldMode)).map((f) => [f.key, input[f.key] as FieldMode]),
  );
}

function filled(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

// Labels dos campos obrigatórios que ficaram sem resposta.
export function missingRequiredFields(config: Record<string, FieldMode>, data: Record<string, unknown>) {
  return FORM_FIELDS.filter((field) => config[field.key] === "required")
    .filter((field) => {
      if (field.kind === "yesno") return typeof data[field.columns[0]] !== "boolean";
      if (field.kind === "choices") return !field.columns.some((c) => data[c] === true);
      return !field.columns.every((c) => filled(data[c]));
    })
    .map((field) => field.label);
}

// Remove do payload o que o evento não pede (campo escondido não é gravado).
export function stripHiddenFields(config: Record<string, FieldMode>, data: Record<string, unknown>) {
  const result = { ...data };
  for (const field of FORM_FIELDS) {
    if (config[field.key] === "hidden") field.columns.forEach((c) => delete result[c]);
  }
  return result;
}
