import QRCode from "qrcode";

// Pix "copia e cola" estático (BR Code / EMV) com valor, conforme o manual do
// Banco Central. Não depende de banco nem de API de pagamento: qualquer app de
// banco lê o código e preenche chave, valor e identificador.

function field(id: string, value: string) {
  return id + String(value.length).padStart(2, "0") + value;
}

// Nome e cidade do recebedor: só ASCII maiúsculo, com o tamanho máximo do padrão.
function ascii(value: string, max: number) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63.
function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixParams {
  key: string;
  receiverName: string;
  city: string;
  amount: number;
  // Identificador que aparece no extrato do recebedor (até 25 letras/números).
  txid: string;
}

export function pixCopiaECola({ key, receiverName, city, amount, txid }: PixParams) {
  const merchantAccount = field("00", "br.gov.bcb.pix") + field("01", key.trim());
  const payload =
    field("00", "01") +
    field("26", merchantAccount) +
    field("52", "0000") +
    field("53", "986") +
    (amount > 0 ? field("54", amount.toFixed(2)) : "") +
    field("58", "BR") +
    field("59", ascii(receiverName, 25) || "RECEBEDOR") +
    field("60", ascii(city, 15) || "BRASIL") +
    field("62", field("05", txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) +
    "6304";
  return payload + crc16(payload);
}

export function pixQrCodeDataUrl(code: string) {
  return QRCode.toDataURL(code, { margin: 1, width: 320, errorCorrectionLevel: "M" });
}
