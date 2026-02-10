import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type ReceiptItem } from "../db";
import { useState, useEffect } from "react";

export default function Review() {
  const { draftId } = useParams<{ draftId: string }>();
  const navigate = useNavigate();
  const receipt = useLiveQuery(
    () => (draftId ? db.receipts.get(draftId) : undefined),
    [draftId],
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (receipt) setItems([...receipt.items]);
  }, [receipt]);

  if (!receipt) {
    return <div className="p-4 text-slate-400">Yükleniyor...</div>;
  }

  function updateItem(idx: number, field: keyof ReceiptItem, value: string | number | null) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    await db.receipts.update(receipt!.id, { items });
    setSaved(true);
    setTimeout(() => navigate("/"), 600);
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Fiş Detayı</h1>

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
          {receipt.total != null ? `€${receipt.total.toFixed(2)}` : "—"}
        </p>
        {receipt.taxTotal != null && (
          <p>
            <span className="text-slate-400">KDV:</span>{" "}
            €{receipt.taxTotal.toFixed(2)}
          </p>
        )}
        <p>
          <span className="text-slate-400">Güven:</span>{" "}
          %{(receipt.parseConfidence * 100).toFixed(0)}
        </p>
      </div>

      {receipt.warnings.length > 0 && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-xl p-3 mb-4">
          <p className="font-semibold text-yellow-300 text-sm mb-1">Uyarılar</p>
          <ul className="text-yellow-200 text-xs list-disc list-inside">
            {receipt.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="text-lg font-semibold mb-2">
        Kalemler ({items.length})
      </h2>
      <div className="space-y-3 mb-6">
        {items.map((item, idx) => (
          <div key={idx} className="bg-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex justify-between">
              <span className="font-medium text-sm">{item.name}</span>
              <span className="text-sm">€{item.lineTotal.toFixed(2)}</span>
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
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm"
            >
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saved}
        className="w-full bg-green-500 active:bg-green-600 disabled:bg-green-800 text-white rounded-xl py-4 text-lg font-semibold"
      >
        {saved ? "Kaydedildi ✓" : "Kaydet"}
      </button>
    </div>
  );
}
