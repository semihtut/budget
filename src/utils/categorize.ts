const RULES: [RegExp, string][] = [
  [/migros|a101|bim|şok|carrefour|market|süpermarket/i, "market"],
  [/starbucks|kahve|cafe|restaurant|restoran|yemek|döner|pizza|burger|mcdonalds/i, "food"],
  [/uber|iett|metro|taksi|otobüs|bilet|benzin|shell|opet/i, "transport"],
  [/eczane|hastane|klinik|sağlık|pharmacy/i, "health"],
  [/sinema|netflix|spotify|eğlence|oyun/i, "entertainment"],
  [/elektrik|su|doğalgaz|internet|telefon|fatura|turkcell|vodafone/i, "bills"],
];

export function guessCategory(text: string): string {
  const combined = text.toLowerCase();
  for (const [pattern, categoryId] of RULES) {
    if (pattern.test(combined)) return categoryId;
  }
  return "other";
}
