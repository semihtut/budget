import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import formidable, { type Fields, type Files } from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];

const ReceiptItemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
  lineTotal: z.number(),
  rawText: z.string().nullable().optional(),
});

const ParsedReceiptSchema = z.object({
  merchantName: z.string().nullable(),
  receiptDate: z.string().nullable(),
  currency: z.string().nullable(),
  total: z.number().nullable(),
  taxTotal: z.number().nullable(),
  items: z.array(ReceiptItemSchema),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
});

function parseForm(
  req: VercelRequest,
): Promise<{ file: formidable.File; locale: string }> {
  return new Promise((resolve, reject) => {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE });
    form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
      if (err) return reject(err);
      const file = Array.isArray(files.image) ? files.image[0] : files.image;
      if (!file) return reject(new Error("image alani gerekli"));
      const locale =
        (Array.isArray(fields.locale) ? fields.locale[0] : fields.locale) ||
        "tr-TR";
      resolve({ file: file as formidable.File, locale: locale as string });
    });
  });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Sadece POST desteklenir" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY tanimli degil" });
  }

  let file: formidable.File;
  let locale: string;

  try {
    ({ file, locale } = await parseForm(req));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Form ayristirilamadi";
    return res.status(400).json({ error: msg });
  }

  const mime = file.mimetype || "";
  if (!ALLOWED_MIMES.includes(mime)) {
    return res.status(400).json({
      error: `Desteklenmeyen dosya tipi: ${mime}. Desteklenen: JPEG, PNG, HEIC`,
    });
  }

  try {
    const imageBuffer = fs.readFileSync(file.filepath);
    const base64 = imageBuffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

    const prompt = `Sen bir fis/fatura OCR asistanisin. Bu gorseldeki fisi analiz et ve asagidaki JSON formatinda dondur. Sadece JSON dondur, baska aciklama yazma.

Kurallar:
- Emin olmadigin alanlari null yap, uydurma.
- receiptDate formati: YYYY-MM-DD
- Satir toplamlari ile genel toplam tutarsizsa warnings dizisine ekle.
- confidence 0-1 arasi, ne kadar eminsen o kadar yuksek.
- Locale: ${locale}

JSON formati:
{
  "merchantName": "string|null",
  "receiptDate": "YYYY-MM-DD|null",
  "currency": "string|null",
  "total": number|null,
  "taxTotal": number|null,
  "items": [
    {"name": "string", "quantity": number|null, "unitPrice": number|null, "lineTotal": number, "rawText": "string|null"}
  ],
  "confidence": number,
  "warnings": ["string"]
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mime,
          data: base64,
        },
      },
    ]);

    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res
        .status(500)
        .json({ error: "Gemini yanitindan JSON cikarilamadi" });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return res.status(500).json({ error: "Gemini yaniti gecersiz JSON" });
    }

    const validation = ParsedReceiptSchema.safeParse(parsed);
    if (!validation.success) {
      const raw = parsed as Record<string, unknown>;
      const fallback = {
        merchantName: raw.merchantName ?? null,
        receiptDate: raw.receiptDate ?? null,
        currency: raw.currency ?? null,
        total: typeof raw.total === "number" ? raw.total : null,
        taxTotal: typeof raw.taxTotal === "number" ? raw.taxTotal : null,
        items: Array.isArray(raw.items) ? raw.items : [],
        confidence: Math.min(
          typeof raw.confidence === "number" ? raw.confidence : 0,
          0.3,
        ),
        warnings: [
          ...(Array.isArray(raw.warnings) ? raw.warnings : []),
          "Yanit dogrulamasi basarisiz, guvenilirlik dusuruldu",
        ],
      };
      return res.status(200).json({ parsedReceipt: fallback });
    }

    return res.status(200).json({ parsedReceipt: validation.data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("Gemini parse error:", msg);
    return res
      .status(500)
      .json({ error: "Fis analiz edilemedi: " + msg });
  } finally {
    try {
      fs.unlinkSync(file.filepath);
    } catch {
      // ignore cleanup errors
    }
  }
}
