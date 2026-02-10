import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { guessCategory } from "../utils/categorize";
import { Camera, RotateCw, Upload, AlertCircle } from "lucide-react";
import PageTransition from "../components/PageTransition";
import Button from "../components/Button";

const PARSE_STEPS = [
  "Görüntü yükleniyor...",
  "Fiş analiz ediliyor...",
  "Kalemler çıkarılıyor...",
];

export default function Scan() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
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
      const form = new FormData();
      form.append("image", file);
      form.append("locale", "tr-TR");

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
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/heic"
          capture="environment"
          onChange={handleFile}
          className="hidden"
        />

        <div className="space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-slate-800 rounded-xl py-8 text-center border-2 border-dashed border-slate-600 active:border-blue-500 transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <Camera className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <span className="text-slate-300">Fotoğraf Çek / Galeriden Seç</span>
          </button>

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
