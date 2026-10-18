import QRCode from 'qrcode';

export const QR_COLORS = {
  spring: '#8c3f60',
  summer: '#2d5a2a',
  autumn: '#8c3a14',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Yuvarlak noktalı, mevsim renkli QR çizer. */
export function drawQR(canvas, text, { fg = '#2d5a2a', bg = '#fffaf1', size = canvas.width, quiet = 2 } = {}) {
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const qr = QRCode.create(text || ' ', { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const cell = size / (n + quiet * 2);
  const off = quiet * cell;

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fg;

  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!data[r * n + c] || inFinder(r, c)) continue;
      ctx.beginPath();
      ctx.arc(off + (c + 0.5) * cell, off + (r + 0.5) * cell, cell * 0.43, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Göz (finder) desenleri: yuvarlatılmış kare halka + dolu iç kare
  const finder = (r0, c0) => {
    const x = off + c0 * cell;
    const y = off + r0 * cell;
    ctx.fillStyle = fg;
    roundRect(ctx, x, y, cell * 7, cell * 7, cell * 2.2);
    ctx.fill();
    ctx.fillStyle = bg;
    roundRect(ctx, x + cell, y + cell, cell * 5, cell * 5, cell * 1.5);
    ctx.fill();
    ctx.fillStyle = fg;
    roundRect(ctx, x + cell * 2, y + cell * 2, cell * 3, cell * 3, cell * 1.05);
    ctx.fill();
  };
  finder(0, 0);
  finder(0, n - 7);
  finder(n - 7, 0);
}

export function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}
