import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { guessCategory } from "../utils/categorize";
import { Camera, Image, RotateCw, Upload, AlertCircle } from "lucide-react";
import PageTransition from "../components/PageTransition";
import Button from "../components/Button";

const PARSE_STEPS = [
  "Görüntü yükleniyor...",
  "Fiş analiz ediliyor...",
  "Kalemler çıkarılıyor...",
];

const MAX_UPLOAD_SIZE = 3.5 * 1024 * 1024; // 3.5 MB (Vercel limit ~4.5MB)
const MAX_DIMENSION = 2048;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // If already small enough, skip compression
    if (file.size <= MAX_UPLOAD_SIZE && !file.type.includes("heic")) {
      return resolve(file);
    }

    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas desteklenmiyor"));
      ctx.drawImage(img, 0, 0, width, height);

      // Start with quality 0.8, reduce until under limit
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Sıkıştırma başarısız"));
            if (blob.size > MAX_UPLOAD_SIZE && quality > 0.3) {
              quality -= 0.15;
              tryCompress();
            } else {
              resolve(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          quality,
        );
      };
      tryCompress();
    };
    img.onerror = () => reject(new Error("Görüntü yüklenemedi"));
    img.src = URL.createObjectURL(file);
  });
}

export default function Scan() {
  const navigate = useNavigate();
  const cameraId = "camera-input";
  const galleryId = "gallery-input";
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [parseStep, setParseStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setRotation(0);
    setError(null);
  }

  function rotate() {
    setRotation((r) => (r + 90) % 360);
  }

  async function handleParse() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setParseStep(0);

    const stepTimer = setInterval(() => {
      setParseStep((s) => Math.min(s + 1, PARSE_STEPS.length - 1));
    }, 1500);

    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("image", compressed);
      form.append("locale", "fi-FI");

      const res = await fetch("/api/receipt/parse", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Sunucu hatası: ${res.status}`);
      }

      const data = await res.json();
      const parsed = data.parsedReceipt;

      const draftId = uuidv4();
      const items = (parsed.items || []).map((item: Record<string, unknown>) => ({
        name: item.name || "",
        quantity: item.quantity ?? null,
        unitPrice: item.unitPrice ?? null,
        lineTotal: Number(item.lineTotal) || 0,
        rawText: item.rawText ?? null,
        categoryId: guessCategory(
          `${parsed.merchantName || ""} ${item.name || ""}`,
        ),
      }));

      await db.receipts.add({
        id: draftId,
        createdAt: new Date().toISOString(),
        merchantName: parsed.merchantName,
        receiptDate: parsed.receiptDate,
        currency: parsed.currency || "EUR",
        total: parsed.total,
        taxTotal: parsed.taxTotal,
        items,
        parseConfidence: parsed.confidence || 0,
        warnings: parsed.warnings || [],
      });

      navigate(`/review/${draftId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
    }
  }

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <h1 className="text-2xl font-bold mb-4">Fiş Tara</h1>

        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />
        <input
          id={galleryId}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label
              htmlFor={cameraId}
              className="bg-slate-800 rounded-xl py-6 text-center border-2 border-dashed border-slate-600 active:border-blue-500 transition-colors cursor-pointer
                focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-400"
            >
              <Camera className="w-9 h-9 text-slate-400 mx-auto mb-2" />
              <span className="text-slate-300 text-sm">Fotoğraf Çek</span>
            </label>
            <label
              htmlFor={galleryId}
              className="bg-slate-800 rounded-xl py-6 text-center border-2 border-dashed border-slate-600 active:border-green-500 transition-colors cursor-pointer
                focus-within:outline-none focus-within:ring-2 focus-within:ring-green-400"
            >
              <Image className="w-9 h-9 text-slate-400 mx-auto mb-2" />
              <span className="text-slate-300 text-sm">Galeriden Seç</span>
            </label>
          </div>

          {preview && (
            <div className="relative overflow-hidden rounded-xl bg-slate-800">
              <img
                src={preview}
                alt="Fiş önizleme"
                className="w-full max-h-[50vh] object-contain rotate-smooth"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
              <button
                onClick={rotate}
                className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full w-10 h-10 flex items-center justify-center
                  active:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                aria-label="Döndür"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 text-sm font-medium">Hata</p>
                <p className="text-red-300 text-xs mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-slate-800 rounded-xl p-4">
              <div className="space-y-2">
                {PARSE_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      i < parseStep ? "bg-green-400" :
                      i === parseStep ? "bg-blue-400 animate-pulse" :
                      "bg-slate-600"
                    }`} />
                    <span className={
                      i <= parseStep ? "text-white" : "text-slate-500"
                    }>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && !loading && (
            <Button
              onClick={handleParse}
              icon={<Upload className="w-5 h-5" />}
            >
              Fişi Analiz Et
            </Button>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
