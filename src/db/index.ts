import Dexie, { type Table } from "dexie";

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number;
  categoryId: string;
  rawText?: string | null;
}

export interface Receipt {
  id: string;
  createdAt: string;
  merchantName: string | null;
  receiptDate: string | null;
  currency: string | null;
  total: number | null;
  taxTotal: number | null;
  items: ReceiptItem[];
  parseConfidence: number;
  warnings: string[];
}

export interface Budget {
  id?: number;
  month: string; // YYYY-MM
  categoryId: string;
  limitAmount: number;
  alertThreshold: number;
}

export type BillingCycle = "monthly" | "yearly";

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  categoryId: string;
  cycle: BillingCycle;
  startDate: string; // YYYY-MM-DD
  isActive: boolean;
  icon?: string;
}

class AppDB extends Dexie {
  categories!: Table<Category, string>;
  receipts!: Table<Receipt, string>;
  budgets!: Table<Budget, number>;
  subscriptions!: Table<Subscription, string>;

  constructor() {
    super("ReceiptBudgetDB");
    this.version(1).stores({
      categories: "id",
      receipts: "id, createdAt, receiptDate",
      budgets: "++id, [month+categoryId]",
    });
    this.version(2).stores({
      categories: "id",
      receipts: "id, createdAt, receiptDate",
      budgets: "++id, [month+categoryId]",
      subscriptions: "id, categoryId, isActive",
    });
  }
}

export const db = new AppDB();
