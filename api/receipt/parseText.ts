/**
 * Parses raw OCR text from a receipt into structured data.
 * Designed for Turkish receipts but handles common international formats.
 */

interface ParsedItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number;
  rawText: string;
}

interface ParsedReceipt {
  merchantName: string | null;
  receiptDate: string | null;
  currency: string | null;
  total: number | null;
  taxTotal: number | null;
  items: ParsedItem[];
  confidence: number;
  warnings: string[];
}

const DATE_PATTERNS = [
  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/,
  // YYYY-MM-DD
  /(\d{4})-(\d{2})-(\d{2})/,
  // DD/MM/YY or DD.MM.YY
  /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{2})\b/,
];

const TOTAL_KEYWORDS = [
  /toplam/i, /total/i, /genel\s*toplam/i, /g\.?\s*toplam/i,
  /nakit/i, /ödeme/i, /tutar/i, /yekun/i,
];

const TAX_KEYWORDS = [
  /kdv/i, /tax/i, /vergi/i, /topkdv/i,
];

const SKIP_KEYWORDS = [
  /toplam/i, /total/i, /kdv/i, /tax/i, /vergi/i, /nakit/i,
  /ödeme/i, /tutar/i, /yekun/i, /fiş\s*no/i, /tarih/i,
  /kasa/i, /saat/i, /kasiyer/i, /eft\s*pos/i, /visa/i,
  /mastercard/i, /banka/i, /kart/i, /pos/i, /iade/i,
  /teşekkür/i, /iyi\s*günler/i, /hoş\s*geldiniz/i,
];

function extractNumber(text: string): number | null {
  // Handle Turkish number format: 1.234,56 → 1234.56
  // Also handle standard: 1,234.56 or 1234.56
  const cleaned = text.replace(/\s/g, "");

  // Turkish format: comma as decimal separator
  const turkishMatch = cleaned.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})\b/);
  if (turkishMatch) {
    const num = parseFloat(turkishMatch[0].replace(/\./g, "").replace(",", "."));
    if (!isNaN(num)) return num;
  }

  // Standard format or plain number
  const stdMatch = cleaned.match(/(\d+(?:[.,]\d+)?)/);
  if (stdMatch) {
    const num = parseFloat(stdMatch[1].replace(",", "."));
    if (!isNaN(num)) return num;
  }

  return null;
}

function extractPrice(line: string): number | null {
  // Find price-like patterns at the end of a line
  // Patterns: *12,50  %8 12,50  12.50  12,50TL  €12.50
  const pricePatterns = [
    /[*%]?\s*(\d{1,3}(?:\.\d{3})*[,]\d{2})\s*(?:TL|₺|EUR|€|USD|\$)?\s*$/i,
    /[*%]?\s*(\d+[.]\d{2})\s*(?:TL|₺|EUR|€|USD|\$)?\s*$/i,
    /(?:TL|₺|EUR|€|USD|\$)\s*(\d{1,3}(?:[.,]\d{2,3})*)\s*$/i,
  ];

  for (const pattern of pricePatterns) {
    const match = line.match(pattern);
    if (match) {
      return extractNumber(match[1]);
    }
  }

  return null;
}

function detectCurrency(fullText: string): string | null {
  if (/₺|TL\b/i.test(fullText)) return "TRY";
  if (/€|EUR\b/i.test(fullText)) return "EUR";
  if (/\$|USD\b/i.test(fullText)) return "USD";
  if (/£|GBP\b/i.test(fullText)) return "GBP";
  return null;
}

function extractDate(fullText: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = fullText.match(pattern);
    if (match) {
      // Check if YYYY-MM-DD format
      if (match[1].length === 4) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }
      // DD/MM/YYYY
      if (match[3].length === 4) {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
      // DD/MM/YY → assume 20xx
      if (match[3].length === 2) {
        const year = parseInt(match[3]) > 50 ? `19${match[3]}` : `20${match[3]}`;
        return `${year}-${match[2]}-${match[1]}`;
      }
    }
  }
  return null;
}

function extractMerchantName(lines: string[]): string | null {
  // Merchant name is usually in the first few non-empty lines
  // Skip lines that are just numbers, dates, or addresses
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].trim();
    if (!line || line.length < 2) continue;
    // Skip if it's just numbers
    if (/^\d+$/.test(line.replace(/[\s\-\/\.]/g, ""))) continue;
    // Skip if it's a date
    if (DATE_PATTERNS.some((p) => p.test(line))) continue;
    // Skip if it looks like an address (contains common address words)
    if (/^\d+\s/.test(line) && /sokak|cadde|mah|apt|no/i.test(line)) continue;
    // This is likely the merchant name
    return line;
  }
  return null;
}

function isSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;
  // Pure number lines
  if (/^[\d\s\.\-\/\:]+$/.test(trimmed)) return true;
  // Lines that are just keywords we should skip
  for (const kw of SKIP_KEYWORDS) {
    if (kw.test(trimmed) && trimmed.length < 30) return true;
  }
  return false;
}

export function parseReceiptText(fullText: string): ParsedReceipt {
  const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
  const warnings: string[] = [];

  const merchantName = extractMerchantName(lines);
  const receiptDate = extractDate(fullText);
  const currency = detectCurrency(fullText);

  // Extract total
  let total: number | null = null;
  for (const line of lines) {
    for (const kw of TOTAL_KEYWORDS) {
      if (kw.test(line)) {
        const num = extractNumber(line);
        if (num !== null && (total === null || num > total)) {
          total = num;
        }
      }
    }
  }

  // Extract tax
  let taxTotal: number | null = null;
  for (const line of lines) {
    for (const kw of TAX_KEYWORDS) {
      if (kw.test(line)) {
        const num = extractNumber(line);
        if (num !== null) {
          taxTotal = num;
          break;
        }
      }
    }
    if (taxTotal !== null) break;
  }

  // Extract items
  const items: ParsedItem[] = [];
  for (const line of lines) {
    // Skip total/tax/header lines
    if (TOTAL_KEYWORDS.some((kw) => kw.test(line))) continue;
    if (TAX_KEYWORDS.some((kw) => kw.test(line))) continue;
    if (isSkipLine(line)) continue;

    const price = extractPrice(line);
    if (price !== null && price > 0) {
      // Extract item name (everything before the price)
      let name = line
        .replace(/[*%]\s*\d.*$/, "")
        .replace(/\d{1,3}(?:\.\d{3})*[,]\d{2}\s*(?:TL|₺|EUR|€|USD|\$)?$/i, "")
        .replace(/\d+[.]\d{2}\s*(?:TL|₺|EUR|€|USD|\$)?$/i, "")
        .trim();

      // Try to extract quantity: "2 x Ekmek" or "Ekmek x2" or "2 AD EKMEK"
      let quantity: number | null = null;
      let unitPrice: number | null = null;

      const qtyMatch = name.match(/^(\d+)\s*[xX*]\s*/);
      const qtyMatch2 = name.match(/\s*[xX*]\s*(\d+)$/);
      const qtyMatch3 = name.match(/^(\d+)\s*(?:AD|ad|adet)\s+/i);

      if (qtyMatch) {
        quantity = parseInt(qtyMatch[1]);
        name = name.replace(qtyMatch[0], "").trim();
        unitPrice = price / quantity;
      } else if (qtyMatch2) {
        quantity = parseInt(qtyMatch2[1]);
        name = name.replace(qtyMatch2[0], "").trim();
        unitPrice = price / quantity;
      } else if (qtyMatch3) {
        quantity = parseInt(qtyMatch3[1]);
        name = name.replace(qtyMatch3[0], "").trim();
        unitPrice = price / quantity;
      }

      if (name.length >= 1) {
        items.push({
          name,
          quantity,
          unitPrice,
          lineTotal: price,
          rawText: line,
        });
      }
    }
  }

  // Validate total vs items sum
  if (total !== null && items.length > 0) {
    const itemsSum = items.reduce((sum, it) => sum + it.lineTotal, 0);
    const diff = Math.abs(total - itemsSum);
    if (diff > 0.5) {
      warnings.push(
        `Kalem toplamı (${itemsSum.toFixed(2)}) ile genel toplam (${total.toFixed(2)}) uyuşmuyor`,
      );
    }
  }

  // Calculate confidence
  let confidence = 0.5;
  if (merchantName) confidence += 0.1;
  if (receiptDate) confidence += 0.1;
  if (total !== null) confidence += 0.1;
  if (items.length > 0) confidence += 0.1;
  if (warnings.length === 0 && items.length > 0) confidence += 0.1;
  confidence = Math.min(confidence, 1);

  return {
    merchantName,
    receiptDate,
    currency,
    total,
    taxTotal,
    items,
    confidence,
    warnings,
  };
}
