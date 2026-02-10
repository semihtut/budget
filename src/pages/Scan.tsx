import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { guessCategory } from "../utils/categorize";

export default function Scan() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(false);
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
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
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
          className="w-full bg-slate-800 rounded-xl py-8 text-center border-2 border-dashed border-slate-600 active:border-blue-500"
        >
          <span className="text-4xl block mb-2">📷</span>
          <span className="text-slate-300">Fotoğraf Çek / Galeriden Seç</span>
        </button>

        {preview && (
          <div className="relative">
            <img
              src={preview}
              alt="Fiş önizleme"
              className="w-full rounded-xl max-h-[50vh] object-contain bg-slate-800"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
            <button
              onClick={rotate}
              className="absolute top-2 right-2 bg-black/60 rounded-full w-10 h-10 text-lg"
            >
              🔄
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {preview && (
          <button
            onClick={handleParse}
            disabled={loading}
            className="w-full bg-blue-500 active:bg-blue-600 disabled:bg-slate-600 text-white rounded-xl py-4 text-lg font-semibold"
          >
            {loading ? "Analiz ediliyor..." : "Fişi Analiz Et"}
          </button>
        )}
      </div>
    </div>
  );
}
