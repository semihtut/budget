import { db, type Category } from "./index";

const DEFAULT_CATEGORIES: Category[] = [
  { id: "market", name: "Market", icon: "🛒" },
  { id: "food", name: "Yeme/İçme", icon: "🍽️" },
  { id: "transport", name: "Ulaşım", icon: "🚌" },
  { id: "health", name: "Sağlık", icon: "💊" },
  { id: "entertainment", name: "Eğlence", icon: "🎬" },
  { id: "bills", name: "Faturalar", icon: "📄" },
  { id: "other", name: "Diğer", icon: "📦" },
];

export async function seedCategories() {
  const count = await db.categories.count();
  if (count === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }
}
