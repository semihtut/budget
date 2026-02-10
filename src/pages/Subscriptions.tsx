import { useLiveQuery } from "dexie-react-hooks";
import { db, type Subscription, type BillingCycle } from "../db";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, Pause, Play, Pencil, X, RefreshCw } from "lucide-react";
import PageTransition from "../components/PageTransition";
import EmptyState from "../components/EmptyState";
import Button from "../components/Button";

const POPULAR_SUBS = [
  { name: "Netflix", icon: "🎬" },
  { name: "Spotify", icon: "🎵" },
  { name: "YouTube Premium", icon: "▶️" },
  { name: "iCloud+", icon: "☁️" },
  { name: "ChatGPT Plus", icon: "🤖" },
  { name: "Apple Music", icon: "🎧" },
  { name: "Disney+", icon: "🏰" },
  { name: "Amazon Prime", icon: "📦" },
];

function getMonthlyAmount(amount: number, cycle: BillingCycle) {
  return cycle === "yearly" ? amount / 12 : amount;
}

export default function Subscriptions() {
  const subscriptions = useLiveQuery(() => db.subscriptions.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [categoryId, setCategoryId] = useState("subscriptions");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (!subscriptions || !categories) {
    return <div className="p-4 text-slate-400">Yükleniyor...</div>;
  }

  function resetForm() {
    setName("");
    setIcon("");
    setAmount("");
    setCycle("monthly");
    setCategoryId("subscriptions");
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(sub: Subscription) {
    setEditId(sub.id);
    setName(sub.name);
    setIcon(sub.icon || "");
    setAmount(String(sub.amount));
    setCycle(sub.cycle);
    setCategoryId(sub.categoryId);
    setShowForm(true);
  }

  function pickPopular(p: { name: string; icon: string }) {
    setName(p.name);
    setIcon(p.icon);
  }

  async function handleSave() {
    const val = parseFloat(amount);
    if (!name.trim() || isNaN(val) || val <= 0) return;

    if (editId) {
      await db.subscriptions.update(editId, {
        name: name.trim(),
        icon: icon || undefined,
        amount: val,
        cycle,
        categoryId,
      });
    } else {
      await db.subscriptions.add({
        id: uuidv4(),
        name: name.trim(),
        icon: icon || undefined,
        amount: val,
        cycle,
        categoryId,
        startDate: new Date().toISOString().slice(0, 10),
        isActive: true,
      });
    }

    resetForm();
  }

  async function toggleActive(sub: Subscription) {
    await db.subscriptions.update(sub.id, { isActive: !sub.isActive });
  }

  async function handleDelete(id: string) {
    await db.subscriptions.delete(id);
    setDeleteId(null);
  }

  const activeSubs = subscriptions.filter((s) => s.isActive);
  const pausedSubs = subscriptions.filter((s) => !s.isActive);
  const monthlyTotal = activeSubs.reduce(
    (sum, s) => sum + getMonthlyAmount(s.amount, s.cycle),
    0,
  );
  const yearlyTotal = monthlyTotal * 12;

  return (
    <PageTransition>
      <div className="p-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Abonelikler</h1>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="bg-blue-500 active:bg-blue-600 rounded-full w-9 h-9 flex items-center justify-center
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label="Yeni abonelik ekle"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Summary */}
        {activeSubs.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-4 mb-5">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-slate-400 text-xs">Aylık Toplam</p>
                <p className="text-2xl font-bold tabular-nums">€{monthlyTotal.toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Yıllık</p>
                <p className="text-sm text-slate-300 tabular-nums">€{yearlyTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-slate-800 rounded-xl p-4 mb-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                {editId ? "Aboneliği Düzenle" : "Yeni Abonelik"}
              </h2>
              <button
                onClick={resetForm}
                className="p-1.5 rounded-lg text-slate-400 active:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Popular suggestions */}
            {!editId && (
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_SUBS.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => pickPopular(p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                      ${name === p.name
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-slate-600 text-slate-400 active:border-slate-500"
                      }`}
                  >
                    {p.icon} {p.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="İkon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-14 bg-slate-700 rounded-lg px-2 py-2.5 text-center text-lg
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                  placeholder:text-slate-500 placeholder:text-sm"
              />
              <input
                type="text"
                placeholder="Abonelik adı"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-slate-700 rounded-lg px-3 py-2.5 text-white
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                  placeholder:text-slate-500"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-slate-300 text-lg">€</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="Tutar"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-slate-700 rounded-lg px-3 py-2.5 text-white tabular-nums
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
                    placeholder:text-slate-500"
                />
              </div>
              <div className="flex rounded-lg overflow-hidden border border-slate-600">
                <button
                  onClick={() => setCycle("monthly")}
                  className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                    cycle === "monthly"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  Aylık
                </button>
                <button
                  onClick={() => setCycle("yearly")}
                  className={`px-3 py-2.5 text-xs font-medium transition-colors ${
                    cycle === "yearly"
                      ? "bg-blue-500 text-white"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  Yıllık
                </button>
              </div>
            </div>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-3 py-2.5 text-sm text-white
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>

            <Button onClick={handleSave}>
              {editId ? "Güncelle" : "Ekle"}
            </Button>
          </div>
        )}

        {/* Active Subscriptions */}
        {subscriptions.length === 0 && !showForm ? (
          <EmptyState
            icon={RefreshCw}
            title="Henüz abonelik yok"
            description="Netflix, Spotify gibi aylık aboneliklerinizi ekleyin"
            action={
              <Button
                onClick={() => setShowForm(true)}
                icon={<Plus className="w-5 h-5" />}
                className="mt-2 w-auto px-6"
              >
                Abonelik Ekle
              </Button>
            }
          />
        ) : (
          <>
            {activeSubs.length > 0 && (
              <div className="space-y-2 mb-5">
                {activeSubs.map((sub) => {
                  const monthly = getMonthlyAmount(sub.amount, sub.cycle);
                  const cat = categories.find((c) => c.id === sub.categoryId);

                  return (
                    <div key={sub.id} className="relative">
                      <div className="bg-slate-800 rounded-xl p-3.5 flex items-center gap-3">
                        <span className="text-xl shrink-0">{sub.icon || cat?.icon || "📋"}</span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.name}</p>
                          <p className="text-xs text-slate-400">
                            {cat?.name}
                            {sub.cycle === "yearly" && " · Yıllık"}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold tabular-nums">€{sub.amount.toFixed(2)}</p>
                          {sub.cycle === "yearly" && (
                            <p className="text-[10px] text-slate-400 tabular-nums">
                              ~€{monthly.toFixed(2)}/ay
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(sub)}
                            className="p-1.5 rounded-lg text-slate-500 active:text-blue-400
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                            aria-label="Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => toggleActive(sub)}
                            className="p-1.5 rounded-lg text-slate-500 active:text-yellow-400
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
                            aria-label="Duraklat"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                          {deleteId === sub.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleDelete(sub.id)}
                                className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg"
                              >
                                Sil
                              </button>
                              <button
                                onClick={() => setDeleteId(null)}
                                className="text-xs bg-slate-600 text-white px-2 py-1 rounded-lg"
                              >
                                İptal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteId(sub.id)}
                              className="p-1.5 rounded-lg text-slate-500 active:text-red-400
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                              aria-label="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paused Subscriptions */}
            {pausedSubs.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Duraklatılmış
                </h2>
                <div className="space-y-2">
                  {pausedSubs.map((sub) => {
                    const cat = categories.find((c) => c.id === sub.categoryId);

                    return (
                      <div key={sub.id} className="bg-slate-800/60 rounded-xl p-3.5 flex items-center gap-3 opacity-60">
                        <span className="text-xl shrink-0">{sub.icon || cat?.icon || "📋"}</span>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sub.name}</p>
                          <p className="text-xs text-slate-500">Duraklatıldı</p>
                        </div>

                        <p className="text-sm text-slate-400 tabular-nums shrink-0">€{sub.amount.toFixed(2)}</p>

                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => toggleActive(sub)}
                            className="p-1.5 rounded-lg text-slate-500 active:text-green-400
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                            aria-label="Devam ettir"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(sub.id)}
                            className="p-1.5 rounded-lg text-slate-500 active:text-red-400
                              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                            aria-label="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
