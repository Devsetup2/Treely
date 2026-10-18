// Treely — küçük bir link kısaltma sunucusu (Express, JSON dosya deposu) 
//muammeraltunkan
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '../data/links.json');
const DIST = path.join(__dirname, '../dist');
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''); // örn. https://kisa.site
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CODE_LEN = 7;

/* ---------- depolama ---------- */
const byCode = new Map(); // code -> { url, hits, createdAt }
const byUrl = new Map(); // url  -> code

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const [code, rec] of Object.entries(raw)) {
      byCode.set(code, rec);
      byUrl.set(rec.url, code);
    }
  } catch {
    /* ilk çalıştırma */
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(byCode)));
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('Kayıt hatası:', err.message);
    }
  }, 300);
}

function makeCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < CODE_LEN; i++) c += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!byCode.has(c)) return c;
  }
}

/* ---------- yardımcılar ---------- */
const hits = new Map(); // ip -> zaman damgaları
function rateLimited(ip, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < 60_000)) hits.delete(ip);
}, 60_000).unref();

function normalizeUrl(input) {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s || s.length > 2048) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
  return u;
}

/* ---------- uygulama ---------- */
load();
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY);
app.use(express.json({ limit: '8kb' }));

app.post('/api/shorten', (req, res) => {
  if (rateLimited(req.ip)) return res.status(429).json({ error: 'rate_limited' });

  const u = normalizeUrl(req.body?.url);
  if (!u) return res.status(400).json({ error: 'invalid_url' });

  const base = PUBLIC_BASE || `${req.protocol}://${req.get('host')}`;
  if (u.origin === new URL(base).origin) return res.status(400).json({ error: 'already_short' });

  const url = u.toString();
  let code = byUrl.get(url);
  if (!code) {
    code = makeCode();
    byCode.set(code, { url, hits: 0, createdAt: Date.now() });
    byUrl.set(url, code);
    save();
  }
  res.json({ code, short: `${base}/${code}`, url });
});

app.get('/api/stats/:code', (req, res) => {
  const rec = byCode.get(req.params.code);
  if (!rec) return res.status(404).json({ error: 'not_found' });
  res.json({ code: req.params.code, url: rec.url, hits: rec.hits, createdAt: rec.createdAt });
});

// Üretimde derlenmiş arayüzü sun
if (fs.existsSync(DIST)) app.use(express.static(DIST, { index: 'index.html', maxAge: '1h' }));

// /aB3xY9z  ->  asıl adrese yönlendir
app.get(new RegExp(`^/([A-Za-z0-9]{${CODE_LEN}})$`), (req, res) => {
  const rec = byCode.get(req.params[0]);
  if (!rec) return res.redirect(302, '/?notfound=1');
  rec.hits++;
  save();
  res.redirect(302, rec.url);
});

app.use((_req, res) => res.status(404).type('text/plain').send('Bulunamadı'));

app.listen(PORT, () => console.log(`Treely sunucusu hazır → http://localhost:${PORT}`));

