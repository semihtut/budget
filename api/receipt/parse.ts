import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable, { type Fields, type Files } from "formidable";
import { readFileSync, unlinkSync } from "node:fs";
import { createSign } from "node:crypto";

export const config = {
  api: { bodyParser: false },
};

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/heic", "image/heif"];

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-vision";

/* ─── JWT + Access Token ─── */

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS_BASE64 tanimli degil");

  const creds = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"));

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));

  const signInput = `${header}.${payload}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signInput);
  const signature = base64url(sign.sign(creds.private_key));
  const jwt = `${signInput}.${signature}`;

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Token alinamadi: ${tokenRes.status} ${errText}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

/* ─── Form Parser ─── */

function parseForm(req: VercelRequest): Promise<{ file: formidable.File; locale: string }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE });
    form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
      if (err) return reject(err);
      const file = Array.isArray(files.image) ? files.image[0] : files.image;
      if (!file) return reject(new Error("image alani gerekli"));
      const locale = (Array.isArray(fields.locale) ? fields.locale[0] : fields.locale) || "tr-TR";
      resolve({ file: file as formidable.File, locale: locale as string });
    });
  });
}

/* ─── Receipt Text Parser (inline) ─── */

const DATE_PATTERNS = [
  /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{4})/,
  /(\d{4})-(\d{2})-(\d{2})/,
  /(\d{2})[\/\.\-](\d{2})[\/\.\-](\d{2})\b/,
];
const TOTAL_KW = [/toplam/i, /total/i, /genel\s*toplam/i, /g\.?\s*toplam/i, /nakit/i, /ödeme/i, /tutar/i, /yekun/i];
const TAX_KW = [/kdv/i, /tax/i, /vergi/i, /topkdv/i];
const SKIP_KW = [/toplam/i, /total/i, /kdv/i, /tax/i, /vergi/i, /nakit/i, /ödeme/i, /tutar/i, /yekun/i, /fiş\s*no/i, /tarih/i, /kasa/i, /saat/i, /kasiyer/i, /eft\s*pos/i, /visa/i, /mastercard/i, /banka/i, /kart/i, /pos/i, /iade/i, /teşekkür/i, /iyi\s*günler/i, /hoş\s*geldiniz/i];

function extractNumber(text: string): number | null {
  const cleaned = text.replace(/\s/g, "");
  const tm = cleaned.match(/(\d{1,3}(?:\.\d{3})*),(\d{2})\b/);
  if (tm) { const n = parseFloat(tm[0].replace(/\./g, "").replace(",", ".")); if (!isNaN(n)) return n; }
  const sm = cleaned.match(/(\d+(?:[.,]\d+)?)/);
  if (sm) { const n = parseFloat(sm[1].replace(",", ".")); if (!isNaN(n)) return n; }
  return null;
}

function extractPrice(line: string): number | null {
  const pp = [
    /[*%]?\s*(\d{1,3}(?:\.\d{3})*[,]\d{2})\s*(?:TL|₺|EUR|€|USD|\$)?\s*$/i,
    /[*%]?\s*(\d+[.]\d{2})\s*(?:TL|₺|EUR|€|USD|\$)?\s*$/i,
    /(?:TL|₺|EUR|€|USD|\$)\s*(\d{1,3}(?:[.,]\d{2,3})*)\s*$/i,
  ];
  for (const p of pp) { const m = line.match(p); if (m) return extractNumber(m[1]); }
  return null;
}

function extractDate(text: string): string | null {
  for (const p of DATE_PATTERNS) {
    const m = text.match(p);
    if (m) {
      if (m[1].length === 4) return `${m[1]}-${m[2]}-${m[3]}`;
      if (m[3].length === 4) return `${m[3]}-${m[2]}-${m[1]}`;
      if (m[3].length === 2) return `${parseInt(m[3]) > 50 ? "19" : "20"}${m[3]}-${m[2]}-${m[1]}`;
    }
  }
  return null;
}

function parseReceiptText(fullText: string) {
  const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
  const warnings: string[] = [];

  // Merchant name
  let merchantName: string | null = null;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i].trim();
    if (!l || l.length < 2) continue;
    if (/^\d+$/.test(l.replace(/[\s\-\/\.]/g, ""))) continue;
    if (DATE_PATTERNS.some(p => p.test(l))) continue;
    merchantName = l; break;
  }

  const receiptDate = extractDate(fullText);
  const currency = /₺|TL\b/i.test(fullText) ? "TRY" : /€|EUR\b/i.test(fullText) ? "EUR" : /\$|USD\b/i.test(fullText) ? "USD" : null;

  let total: number | null = null;
  for (const line of lines) { for (const kw of TOTAL_KW) { if (kw.test(line)) { const n = extractNumber(line); if (n !== null && (total === null || n > total)) total = n; } } }

  let taxTotal: number | null = null;
  for (const line of lines) { for (const kw of TAX_KW) { if (kw.test(line)) { const n = extractNumber(line); if (n !== null) { taxTotal = n; break; } } } if (taxTotal !== null) break; }

  const items: { name: string; quantity: number | null; unitPrice: number | null; lineTotal: number; rawText: string }[] = [];
  for (const line of lines) {
    if (TOTAL_KW.some(kw => kw.test(line))) continue;
    if (TAX_KW.some(kw => kw.test(line))) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2 || /^[\d\s\.\-\/\:]+$/.test(trimmed)) continue;
    if (SKIP_KW.some(kw => kw.test(trimmed) && trimmed.length < 30)) continue;

    const price = extractPrice(line);
    if (price !== null && price > 0) {
      let name = line.replace(/[*%]\s*\d.*$/, "").replace(/\d{1,3}(?:\.\d{3})*[,]\d{2}\s*(?:TL|₺|EUR|€|USD|\$)?$/i, "").replace(/\d+[.]\d{2}\s*(?:TL|₺|EUR|€|USD|\$)?$/i, "").trim();
      let quantity: number | null = null;
      let unitPrice: number | null = null;
      const q1 = name.match(/^(\d+)\s*[xX*]\s*/);
      const q2 = name.match(/\s*[xX*]\s*(\d+)$/);
      const q3 = name.match(/^(\d+)\s*(?:AD|ad|adet)\s+/i);
      if (q1) { quantity = parseInt(q1[1]); name = name.replace(q1[0], "").trim(); unitPrice = price / quantity; }
      else if (q2) { quantity = parseInt(q2[1]); name = name.replace(q2[0], "").trim(); unitPrice = price / quantity; }
      else if (q3) { quantity = parseInt(q3[1]); name = name.replace(q3[0], "").trim(); unitPrice = price / quantity; }
      if (name.length >= 1) items.push({ name, quantity, unitPrice, lineTotal: price, rawText: line });
    }
  }

  if (total !== null && items.length > 0) {
    const s = items.reduce((a, i) => a + i.lineTotal, 0);
    if (Math.abs(total - s) > 0.5) warnings.push(`Kalem toplami (${s.toFixed(2)}) ile genel toplam (${total.toFixed(2)}) uyusmuyor`);
  }

  let confidence = 0.5;
  if (merchantName) confidence += 0.1;
  if (receiptDate) confidence += 0.1;
  if (total !== null) confidence += 0.1;
  if (items.length > 0) confidence += 0.1;
  if (warnings.length === 0 && items.length > 0) confidence += 0.1;

  return { merchantName, receiptDate, currency, total, taxTotal, items, confidence: Math.min(confidence, 1), warnings };
}

/* ─── Handler ─── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Top-level try to always return JSON
  try {
    if (req.method === "GET") {
      return res.status(200).json({ status: "ok", hasCredentials: !!process.env.GOOGLE_CREDENTIALS_BASE64 });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Sadece POST desteklenir" });
    }

    if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
      return res.status(500).json({ error: "GOOGLE_CREDENTIALS_BASE64 tanimli degil" });
    }

    let file: formidable.File;
    let locale: string;

    try {
      ({ file, locale } = await parseForm(req));
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : "Form ayristirilamadi" });
    }

    const mime = file.mimetype || "";
    if (!ALLOWED_MIMES.includes(mime)) {
      return res.status(400).json({ error: `Desteklenmeyen dosya tipi: ${mime}` });
    }

    try {
      const imageBuffer = readFileSync(file.filepath);
      const base64Image = imageBuffer.toString("base64");
      const accessToken = await getAccessToken();

      const visionRes = await fetch(VISION_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: [locale === "tr-TR" ? "tr" : "en"] },
          }],
        }),
      });

      if (!visionRes.ok) {
        const errBody = await visionRes.text();
        throw new Error(`Vision API hatasi: ${visionRes.status} - ${errBody.slice(0, 200)}`);
      }

      const visionData = await visionRes.json() as Record<string, unknown>;
      const responses = visionData.responses as Array<Record<string, unknown>> | undefined;
      const annotation = responses?.[0];

      if ((annotation as any)?.error) {
        throw new Error((annotation as any).error.message || "Vision API hatasi");
      }

      const fullText =
        (annotation as any)?.fullTextAnnotation?.text ||
        ((annotation as any)?.textAnnotations as any[])?.[0]?.description ||
        "";

      if (!fullText.trim()) {
        return res.status(200).json({
          parsedReceipt: { merchantName: null, receiptDate: null, currency: null, total: null, taxTotal: null, items: [], confidence: 0, warnings: ["Goruntude metin bulunamadi"] },
        });
      }

      return res.status(200).json({ parsedReceipt: parseReceiptText(fullText) });
    } finally {
      try { unlinkSync(file!.filepath); } catch { /* ignore */ }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("API error:", msg);
    return res.status(500).json({ error: "Fis analiz edilemedi: " + msg });
  }
}
