import type { VercelRequest, VercelResponse } from "@vercel/node";
import vision from "@google-cloud/vision";
import formidable, { type Fields, type Files } from "formidable";
import fs from "fs";
import { parseReceiptText } from "./parseText";

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

function getVisionClient(): vision.ImageAnnotatorClient {
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credentialsBase64) {
    throw new Error("GOOGLE_CREDENTIALS_BASE64 tanimli degil");
  }

  const credentials = JSON.parse(
    Buffer.from(credentialsBase64, "base64").toString("utf-8"),
  );

  return new vision.ImageAnnotatorClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });
}

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

  if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
    return res
      .status(500)
      .json({ error: "GOOGLE_CREDENTIALS_BASE64 tanimli degil" });
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

    const client = getVisionClient();

    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
      imageContext: {
        languageHints: [locale === "tr-TR" ? "tr" : "en"],
      },
    });

    const fullText =
      result.fullTextAnnotation?.text ||
      result.textAnnotations?.[0]?.description ||
      "";

    if (!fullText.trim()) {
      return res.status(200).json({
        parsedReceipt: {
          merchantName: null,
          receiptDate: null,
          currency: null,
          total: null,
          taxTotal: null,
          items: [],
          confidence: 0,
          warnings: ["Goruntude metin bulunamadi"],
        },
      });
    }

    const parsedReceipt = parseReceiptText(fullText);

    return res.status(200).json({ parsedReceipt });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    console.error("Vision API error:", msg);
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
