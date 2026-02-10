import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ReceiptItem } from "../db";
import { useState, useEffect } from "react";
import { Trash2, Check, AlertTriangle } from "lucide-react";
import { ReviewSkeleton } from "../components/Skeleton";
import PageTransition from "../components/PageTransition";
import Button from "../components/Button";

export default function Review() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const receipt = useLiveQuery(
    () => (draftId ? db.receipts.get(draftId) : undefined),
    [draftId],
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    if (receipt) setItems([...receipt.items]);
  }, [receipt]);

  if (!receipt || !categories) {
    return <ReviewSkeleton />;
  }

  function updateItem(idx: number, field: keyof ReceiptItem, value: string | number | null) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setSaved(false);
    setSaveError(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await db.receipts.update(receipt!.id, { items });
      setSaved(true);
      setTimeout(() => navigate("/"), 1200);
    } catch {
      setSaveError("Kaydetme sırasında bir hata oluştu.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await db.receipts.delete(receipt!.id);
      navigate("/");
    } catch {
      setSaveError("Silme sırasında bir hata oluştu.");
    }
  }

  const computedTotal = items.reduce((s, i) => s + i.lineTotal, 0);

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Fiş Detayı</h1>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-lg text-slate-400 active:text-red-400 active:bg-slate-800
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            aria-label="Fişi sil"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {showDeleteConfirm && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-4 mb-4">
            <p className="text-red-200 text-sm mb-3">Bu fişi silmek istediğinize emin misiniz?</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDelete} className="flex-1 !py-2 !text-sm">
                Evet, Sil
              </Button>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="flex-1 !py-2 !text-sm">
                İptal
              </Button>
            </div>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-1 text-sm">
          <p>
            <span className="text-slate-400">Mağaza:</span>{" "}
            {receipt.merchantName || "—"}
          </p>
          <p>
            <span className="text-slate-400">Tarih:</span>{" "}
            {receipt.receiptDate || "—"}
          </p>
          <p>
            <span className="text-slate-400">Para Birimi:</span>{" "}
            {receipt.currency || "—"}
          </p>
          <p>
            <span className="text-slate-400">Toplam:</span>{" "}
            <span className="tabular-nums">
              {receipt.total != null ? `€${receipt.total.toFixed(2)}` : "—"}
            </span>
          </p>
          {receipt.taxTotal != null && (
            <p>
              <span className="text-slate-400">KDV:</span>{" "}
              <span className="tabular-nums">€{receipt.taxTotal.toFixed(2)}</span>
            </p>
          )}
          <p>
            <span className="text-slate-400">Güven:</span>{" "}
            %{(receipt.parseConfidence * 100).toFixed(0)}
          </p>
        </div>

        {receipt.warnings.length > 0 && (
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-300 text-sm mb-1">Uyarılar</p>
              <ul className="text-yellow-200 text-xs list-disc list-inside">
                {receipt.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Kalemler ({items.length})
          </h2>
          <span className="text-sm text-slate-400 tabular-nums">
            Toplam: €{computedTotal.toFixed(2)}
          </span>
        </div>

        <div className="space-y-3 mb-6">
          {items.map((item, idx) => (
            <div key={idx} className="bg-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-center">
                {editingIdx === idx ? (
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(idx, "name", e.target.value)}
                    onBlur={() => setEditingIdx(null)}
                    autoFocus
                    className="flex-1 bg-slate-700 rounded-lg px-2 py-1 text-sm text-white mr-2
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                ) : (
                  <button
                    onClick={() => setEditingIdx(idx)}
                    className="font-medium text-sm text-left hover:text-blue-300 transition-colors"
                  >
                    {item.name}
                  </button>
                )}
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-slate-400">€</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={item.lineTotal}
                    onChange={(e) => updateItem(idx, "lineTotal", parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-700 rounded-lg px-2 py-1 text-sm text-right tabular-nums text-white
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  />
                </div>
              </div>
              {item.quantity != null && (
                <p className="text-xs text-slate-400">
                  {item.quantity} adet
                  {item.unitPrice != null
                    ? ` × €${item.unitPrice.toFixed(2)}`
                    : ""}
                </p>
              )}
              <select
                value={item.categoryId}
                onChange={(e) => updateItem(idx, "categoryId", e.target.value)}
                className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {saveError && (
          <div className="bg-red-900/50 border border-red-500 rounded-xl p-3 mb-3 text-red-200 text-sm">
            {saveError}
          </div>
        )}

        <Button
          variant="success"
          onClick={handleSave}
          loading={saving}
          disabled={saved}
          icon={saved ? <Check className="w-5 h-5" /> : undefined}
        >
          {saved ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>
    </PageTransition>
  );
}
