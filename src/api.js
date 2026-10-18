// Link kısaltma istemcisi.
// Sunucu (Express) varsa /api/shorten kullanılır; yoksa tarayıcıda çalışan demo moduna düşer.

const LS_KEY = 'treely.links.v1';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export function normalizeUrl(input) {
  let s = String(input ?? '').trim();
  if (!s || s.length > 2048 || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeStore(obj) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(obj));
  } catch {
    /* depolama kapalı olabilir */
  }
}

function localShorten(url) {
  const store = readStore();
  let code = Object.keys(store).find((c) => store[c] === url);
  if (!code) {
    do {
      code = Array.from(crypto.getRandomValues(new Uint8Array(7)), (b) => ALPHABET[b % 62]).join('');
    } while (store[code]);
    store[code] = url;
    writeStore(store);
  }
  return { short: `${location.origin}/#/${code}`, demo: true };
}

/** @returns {Promise<{short:string, demo?:boolean}>} */
export async function shorten(url) {
  let res;
  try {
    res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch {
    return localShorten(url); // sunucuya ulaşılamıyor
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* JSON değil: büyük ihtimalle statik barındırma */
  }
  if (res.ok && data?.short) return { short: data.short };
  if (data?.error) throw Object.assign(new Error(data.error), { code: data.error });
  return localShorten(url);
}

/** Demo modunda #/kod adreslerini çöz ve yönlendir. */
export function resolveHashRedirect() {
  const m = location.hash.match(/^#\/([A-Za-z0-9]{7})$/);
  if (!m) return false;
  const target = readStore()[m[1]];
  if (!target) return false;
  location.replace(target);
  return true;
}
