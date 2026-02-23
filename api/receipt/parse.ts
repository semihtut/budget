import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as formidable from "formidable";
import type { Fields, Files } from "formidable";
import * as fs from "fs";
import * as crypto from "crypto";
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

const VISION_API_URL =
  "https://vision.googleapis.com/v1/images:annotate";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-vision";

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const credentialsBase64 = process.env.GOOGLE_CREDENTIALS_BASE64;
  if (!credentialsBase64) {
    throw new Error("GOOGLE_CREDENTIALS_BASE64 tanimli degil");
  }

  const creds = JSON.parse(
    Buffer.from(credentialsBase64, "base64").toString("utf-8"),
  );

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
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

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

function parseForm(
  req: VercelRequest,
): Promise<{ file: formidable.File; locale: string }> {
  return new Promise((resolve, reject) => {
    const form = (formidable as any)({ maxFileSize: MAX_FILE_SIZE });
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
    const base64Image = imageBuffer.toString("base64");

    const accessToken = await getAccessToken();

    const visionResponse = await fetch(VISION_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: {
              languageHints: [locale === "tr-TR" ? "tr" : "en"],
            },
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errBody = await visionResponse.text();
      console.error("Vision API HTTP error:", visionResponse.status, errBody);
      throw new Error(`Vision API hatasi: ${visionResponse.status}`);
    }

    const visionData = await visionResponse.json();
    const annotation = visionData.responses?.[0];

    if (annotation?.error) {
      throw new Error(annotation.error.message || "Vision API hatasi");
    }

    const fullText =
      annotation?.fullTextAnnotation?.text ||
      annotation?.textAnnotations?.[0]?.description ||
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
