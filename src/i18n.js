const dict = {
  tr: {
    pill: 'link kısaltıcı',
    placeholder: 'Uzun bir bağlantıyı yapıştır…',
    shorten: 'Kısalt',
    hint: 'QR kodu görmek için ağaca dokun',
    spring: 'İlkbahar',
    summer: 'Yaz',
    autumn: 'Sonbahar',
    copy: 'Bağlantıyı kopyala',
    download: "QR'ı indir",
    shareX: "X'te paylaş",
    shareFb: "Facebook'ta paylaş",
    shareWa: "WhatsApp'ta paylaş",
    close: 'Kapat',
    share: 'Paylaş',
    sound: 'Ses',
    info: 'Bilgi',
    copied: 'Bağlantı kopyalandı',
    shortened: 'Kısaltıldı ve kopyalandı',
    invalid: 'Geçerli bir bağlantı gir',
    already: 'Bu zaten kısa bir bağlantı',
    rate: 'Çok hızlı! Biraz bekle',
    saved: 'QR kod indirildi',
    notfound: 'Bu kısa bağlantı bulunamadı',
    demo: 'Sunucu yok: yerel demo modu',
    infoTitle: 'Treely nedir?',
    infoBody1:
      'Uzun bir bağlantıyı yapıştır, “Kısalt”a bas. Kısa bağlantın hazır; ağaç da aynı bağlantının taranabilir QR koduna dönüşür.',
    infoBody2:
      'Mevsimi seç, ağacın renkleri değişsin. Sesi açarsan rüzgâr ve kuş sesleriyle biraz nefes alırsın.',
  },
  en: {
    pill: 'link shortener',
    placeholder: 'Paste a long link…',
    shorten: 'Shorten',
    hint: 'Tap the tree to see QR code',
    spring: 'Spring',
    summer: 'Summer',
    autumn: 'Autumn',
    copy: 'Copy Link',
    download: 'Download QR',
    shareX: 'Share on X',
    shareFb: 'Share on Facebook',
    shareWa: 'Share on WhatsApp',
    close: 'Close',
    share: 'Share',
    sound: 'Sound',
    info: 'Info',
    copied: 'Link copied',
    shortened: 'Shortened & copied',
    invalid: 'Enter a valid link',
    already: 'That is already a short link',
    rate: 'Slow down a little',
    saved: 'QR code downloaded',
    notfound: 'This short link was not found',
    demo: 'No server: local demo mode',
    infoTitle: 'What is Treely?',
    infoBody1:
      'Paste a long link and press “Shorten”. Your short link is ready, and the tree turns into a scannable QR code of the same link.',
    infoBody2: 'Pick a season and the tree changes colour. Turn the sound on for a little wind and birdsong.',
  },
};

export function detectLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && dict[q]) return q;
    const saved = localStorage.getItem('treely.lang');
    if (saved && dict[saved]) return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || 'tr').slice(0, 2).toLowerCase();
  return dict[nav] ? nav : 'tr';
}

export function createI18n(lang) {
  const t = (key) => dict[lang][key] ?? dict.tr[key] ?? key;

  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    root
      .querySelectorAll('[data-i18n-placeholder]')
      .forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)));
    root
      .querySelectorAll('[data-i18n-aria]')
      .forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  }
  return { t, apply, lang };
}
