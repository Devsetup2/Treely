# 🌳 Treely — Sakin Link Kısaltıcı

Uzun bağlantıyı yapıştır, **Kısalt**'a bas. Ağaç, kısa bağlantının taranabilir QR koduna dönüşür.
Üç mevsim (İlkbahar / Yaz / Sonbahar), ortam sesi, kopyala / QR indir / X · Facebook · WhatsApp paylaşımı içerir.

**Teknoloji:** Vite · Three.js (3D ağaç) · qrcode · Express (link kısaltma API'si) · saf HTML5 / CSS3 / JS

## Kurulum

```bash
npm install
npm run dev        # geliştirme: arayüz http://localhost:5173  (API :3000)
```

## Üretim

```bash
npm run build      # dist/ klasörünü üretir
npm start          # http://localhost:3000  (arayüz + API + yönlendirme)
```

Ortam değişkenleri: `PORT`, `PUBLIC_BASE_URL` (örn. `https://kisa.site`), `DATA_FILE`, `TRUST_PROXY`.
Linkler `data/links.json` içinde saklanır. Alan adının arkasında çalışacaksan `PUBLIC_BASE_URL` ver.

## API

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| POST | `/api/shorten` | `{ "url": "https://..." }` → `{ code, short, url }` |
| GET | `/:kod` | 302 ile asıl adrese yönlendirir |
| GET | `/api/stats/:kod` | tıklama sayısı |

> Sunucu olmadan (statik barındırma) çalışırsa uygulama otomatik olarak **yerel demo moduna** geçer:
> kısa linkler yalnızca aynı tarayıcıda çalışır (`/#/kod`).

## Dosyalar

- `src/tree.js` — 3D sahne, mevsim geçişleri, düşen yapraklar, kelebekler
- `src/qr.js` — yuvarlak noktalı QR çizimi
- `src/audio.js` — Web Audio ile rüzgâr + kuş sesi
- `src/main.js` — arayüz mantığı · `src/i18n.js` — TR/EN metinler (`?lang=en`)
- `server/index.js` — Express kısaltma servisi

Başka bir mevsimle açmak için: `/?season=autumn`
