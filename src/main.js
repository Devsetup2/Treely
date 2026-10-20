import './style.css';
import { createTree } from './tree.js';
import { Ambience } from './audio.js';
import { drawQR, canvasToBlob, QR_COLORS } from './qr.js';
import { logoSVG } from './logo.js';
import { createI18n, detectLang } from './i18n.js';
import { shorten, normalizeUrl, resolveHashRedirect } from './api.js';

// Demo modunda #/kod adresi → yönlendir
resolveHashRedirect(); // eşleşirse sayfa zaten yönleniyor

const $ = (s, r = document) => r.querySelector(s);
const i18n = createI18n(detectLang());
const { t } = i18n;
i18n.apply();

$('#logo').innerHTML = logoSVG('TREELY');

/* ---------- durum ---------- */
const input = $('#urlInput');
const field = $('#field');
const stage = $('.stage');
const qrLayer = $('#qrLayer');
const qrCanvas = $('#qrCanvas');
const menu = $('#menu');
const shareBtn = $('#shareBtn');
const toastEl = $('#toast');
const shortenBtn = $('#shortenBtn');

const state = { season: 'summer', short: null, qrOpen: false };
input.value = location.origin + '/';

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ---------- 3D ağaç ---------- */
const tree = createTree($('#scene'), { onTap: () => toggleQR() });

/* ---------- ses ---------- */
const sound = new Ambience();
const soundBtn = $('#soundBtn');
soundBtn.addEventListener('click', async () => {
  if (sound.on) {
    sound.stop();
    soundBtn.setAttribute('aria-pressed', 'false');
  } else {
    const ok = await sound.start();
    soundBtn.setAttribute('aria-pressed', ok ? 'true' : 'false');
  }
});

/* ---------- mevsimler ---------- */
const seasonBtns = [...document.querySelectorAll('.season')];
function setSeason(s) {
  state.season = s;
  document.documentElement.dataset.season = s;
  seasonBtns.forEach((b) => b.classList.toggle('active', b.dataset.season === s));
  tree.setSeason(s);
  sound.setSeason(s);
  if (state.qrOpen) renderQR();
  try { localStorage.setItem('treely.season', s); } catch { /* yoksay */ }
}
seasonBtns.forEach((b) => b.addEventListener('click', () => setSeason(b.dataset.season)));
try {
  const saved = localStorage.getItem('treely.season');
  if (saved && ['spring', 'summer', 'autumn'].includes(saved)) setSeason(saved);
} catch { /* yoksay */ }
const qs = new URLSearchParams(location.search).get('season');
if (qs && ['spring', 'summer', 'autumn'].includes(qs)) setSeason(qs);

/* ---------- QR ---------- */
function currentLink() {
  return normalizeUrl(input.value) || location.origin + '/';
}
function renderQR(size = 640) {
  drawQR(qrCanvas, currentLink(), { fg: QR_COLORS[state.season], size });
  $('#qrUrl').textContent = currentLink().replace(/^https?:\/\//, '');
}
function openQR() {
  state.qrOpen = true;
  renderQR();
  qrLayer.classList.remove('closing');
  qrLayer.hidden = false;
  stage.classList.add('qr-open');
}
function closeQR() {
  if (!state.qrOpen) return;
  state.qrOpen = false;
  stage.classList.remove('qr-open');
  qrLayer.classList.add('closing');
  setTimeout(() => {
    if (!state.qrOpen) qrLayer.hidden = true;
  }, 260);
}
function toggleQR() {
  state.qrOpen ? closeQR() : openQR();
}
$('#hint').addEventListener('click', toggleQR);
$('#qrClose').addEventListener('click', closeQR);
qrLayer.addEventListener('click', (e) => {
  if (!e.target.closest('.qr-card')) closeQR();
});

async function downloadQR() {
  const c = document.createElement('canvas');
  drawQR(c, currentLink(), { fg: QR_COLORS[state.season], size: 1024 });
  const blob = await canvasToBlob(c);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'treely-qr.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('saved'));
}
$('#qrDownload').addEventListener('click', downloadQR);

/* ---------- kısaltma ---------- */
function bad(msg) {
  field.classList.remove('shake');
  void field.offsetWidth;
  field.classList.add('shake');
  toast(msg);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* yoksay */ }
    ta.remove();
    return ok;
  }
}

/** Girilen bağlantıyı kısaltır; zaten bizim adresimizse olduğu gibi döner. */
async function ensureShort({ quiet = false } = {}) {
  const url = normalizeUrl(input.value);
  if (!url) {
    bad(t('invalid'));
    return null;
  }
  if (state.short && input.value === state.short) return state.short;
  if (new URL(url).origin === location.origin) {
    if (!quiet) bad(t('already'));
    return url;
  }
  shortenBtn.classList.add('busy');
  try {
    const res = await shorten(url);
    state.short = res.short;
    input.value = res.short;
    tree.pulse();
    if (state.qrOpen) renderQR();
    if (res.demo) toast(t('demo'));
    return res.short;
  } catch (e) {
    bad(e.code === 'rate_limited' ? t('rate') : e.code === 'already_short' ? t('already') : t('invalid'));
    return e.code === 'already_short' ? url : null;
  } finally {
    shortenBtn.classList.remove('busy');
  }
}

$('#linkForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  input.blur();
  const before = input.value;
  const short = await ensureShort();
  if (short && short !== before) {
    const ok = await copyText(short);
    toast(ok ? t('shortened') : short);
  }
});

let qrDebounce = 0;
input.addEventListener('input', () => {
  state.short = null;
  clearTimeout(qrDebounce);
  qrDebounce = setTimeout(() => {
    if (state.qrOpen) renderQR();
    if (normalizeUrl(input.value)) tree.pulse();
  }, 220);
});
input.addEventListener('focus', () => input.select());

/* ---------- paylaşım menüsü ---------- */
function openMenu() {
  menu.hidden = false;
  shareBtn.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  menu.hidden = true;
  shareBtn.setAttribute('aria-expanded', 'false');
}
shareBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menu.hidden ? openMenu() : closeMenu();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.share-wrap')) closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeMenu();
    closeQR();
  }
});

menu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  closeMenu();

  if (act === 'download') {
    await ensureShort({ quiet: true });
    return downloadQR();
  }

  const link = (await ensureShort({ quiet: true })) || null;
  if (!link) return;

  if (act === 'copy') {
    const ok = await copyText(link);
    toast(ok ? t('copied') : link);
    return;
  }
  const enc = encodeURIComponent(link);
  const urls = {
    x: `https://twitter.com/intent/tweet?url=${enc}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    whatsapp: `https://wa.me/?text=${enc}`,
  };
  window.open(urls[act], '_blank', 'noopener,noreferrer');
});

/* ---------- bilgi ---------- */
const info = $('#info');
$('#infoBtn').addEventListener('click', () => info.showModal());
info.addEventListener('click', (e) => {
  if (e.target === info) info.close();
});

/* ---------- bulunamadı bildirimi ---------- */
if (new URLSearchParams(location.search).has('notfound')) {
  toast(t('notfound'));
  history.replaceState(null, '', location.pathname);
}
/* ---------- popcash ---------- */
<script type="text/javascript">
   var uid = '448737';
   var wid = '758726';
   var pop_tag = document.createElement('script');pop_tag.src='//cdn.popcash.net/show.js';document.body.appendChild(pop_tag);
   pop_tag.onerror = function() {pop_tag = document.createElement('script');pop_tag.src='//cdn2.popcash.net/show.js';document.body.appendChild(pop_tag)};
</script>
