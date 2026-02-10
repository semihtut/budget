# Fis Butce Takip - Receipt Budget PWA

iOS odakli, fis tarayici ve butce takip uygulamasi. Fisinizi cekin, Gemini AI ile parse edin, kategorilere ayirin ve aylik butcenizi takip edin.

## Teknoloji

- **Frontend:** React + Vite + TypeScript + TailwindCSS + Dexie (IndexedDB)
- **Backend:** Vercel Serverless Function + Gemini AI
- **PWA:** vite-plugin-pwa (offline cache, ana ekrana ekle)

## Proje Yapisi

```
receipt-budget-pwa/
  apps/
    web/          # React PWA (Vite)
      src/
        components/   # Layout, ortak bilesenler
        pages/        # Dashboard, Scan, Review, Budgets, History
        db/           # Dexie IndexedDB semasi
        utils/        # Kategori tahmin motoru
    api/          # Vercel Serverless Functions
      api/
        receipt/
          parse.ts    # POST /api/receipt/parse
```

## Kurulum

### Gereksinimler

- Node.js >= 18
- pnpm >= 8 (`npm install -g pnpm`)
- Vercel CLI (`npm install -g vercel`)

### 1. Bagimliliklari Yukle

```bash
cd receipt-budget-pwa
pnpm install
```

### 2. Gemini API Key

Gemini API key'inizi [Google AI Studio](https://aistudio.google.com/app/apikey) adresinden ucretsiz alin.

API icin `.env.local` dosyasi olusturun:

```bash
# apps/api/.env.local
GEMINI_API_KEY=your_api_key_here
```

> **ONEMLI:** API key sadece backend'de kalir, frontend bundle'a asla dahil edilmez.

### 3. Local Calistirma

Iki terminalde paralel calistirin:

```bash
# Terminal 1 - API (port 3001)
cd apps/api
vercel dev --listen 3001

# Terminal 2 - Web (port 5173)
cd apps/web
pnpm dev
```

Veya root'tan:

```bash
pnpm dev:web   # ayri terminalde
pnpm dev:api   # ayri terminalde
```

Tarayicida acin: **http://localhost:5173**

## iOS'ta Ana Ekrana Ekleme

1. iPhone'da **Safari** ile uygulamanizi acin (deploy edilen URL veya local IP)
2. Alttaki **paylasim butonuna** (kare + ok yukari) dokunun
3. Asagi kaydin ve **"Ana Ekrana Ekle"** secin
4. Uygulamanin adini onaylayin ve **"Ekle"** dokunun
5. Ana ekranda uygulama ikonu gorunecek - tam ekran, standalone modda calisir

> **Not:** PWA ozellikleri yalnizca HTTPS uzerinden veya localhost'ta calisir.

## Vercel Deploy

### Frontend (apps/web)

```bash
cd apps/web
vercel --prod
```

### Backend (apps/api)

```bash
cd apps/api
vercel --prod
```

Deploy sonrasi frontend'in API URL'sini guncellemeniz gerekebilir.
Environment variable olarak `GEMINI_API_KEY` degiskenini Vercel dashboard'dan ekleyin.

> **Onemli:** Frontend ve API ayni domain'de olmalir veya CORS ayarlari yapilmalidir.
> En basit yontem: Her ikisini de ayni Vercel projesinde deploy edin veya
> frontend'deki API URL'sini environment variable ile ayarlayin.

## Placeholder Ikonlar

`apps/web/public/` altindaki `icon-192.png` ve `icon-512.png` placeholder SVG dosyalardir.
Gercek uygulama ikonu icin bu dosyalari uygun PNG dosyalariyla degistirin.

## Ekranlar

| Yol | Ekran | Aciklama |
|-----|-------|----------|
| `/` | Dashboard | Aylik harcama ozeti, kategori bazli ilerleme cubugu |
| `/scan` | Tara | Kamera/galeri ile fis fotografi al |
| `/review/:id` | Inceleme | Parse edilen fis kalemlerini gor ve kategorize et |
| `/budgets` | Butce | Aylik kategori limitleri belirle |
| `/history` | Gecmis | Tum fisleri listele ve filtrele |

## Veri Modeli

Tum veri IndexedDB'de (Dexie) saklanir - local-first yaklasim.

- **Category:** id, name, icon
- **Receipt:** id, merchantName, receiptDate, total, items[], warnings[]
- **ReceiptItem:** name, quantity, unitPrice, lineTotal, categoryId
- **Budget:** month (YYYY-MM), categoryId, limitAmount, alertThreshold

## Otomatik Kategori Tahmini

Magaza adi ve urun adina gore kural tabanli eslestirme:

| Anahtar Kelimeler | Kategori |
|---|---|
| migros, a101, bim, sok, carrefour | Market |
| starbucks, kahve, cafe, restaurant | Yeme/Icme |
| uber, iett, metro, taksi | Ulasim |
| eczane, hastane | Saglik |
| sinema, netflix, spotify | Eglence |
| elektrik, su, dogalgaz, internet | Faturalar |
| (diger) | Diger |

Kullanici dropdown ile kategoriyi degistirebilir.
