// Noktalı (dot-matrix) "TREELY" yazısı — SVG olarak üretilir
const G = {
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};

export function logoSVG(text = 'TREELY') {
  const letters = [...text];
  const cols = letters.length * 6 - 1;
  const rows = 7;
  const pad = 2.2;
  const W = cols + pad * 2;
  const H = rows + pad * 2;
  let dots = '';
  letters.forEach((ch, li) => {
    G[ch].forEach((row, r) => {
      [...row].forEach((v, c) => {
        if (v === '1') dots += `<circle cx="${pad + li * 6 + c + 0.5}" cy="${pad + r + 0.5}" r="0.43"/>`;
      });
    });
  });
  const b = 1.4; // köşe parantez uzunluğu
  const o = 0.35;
  const br =
    `M${o} ${o + b}V${o + 0.6}Q${o} ${o} ${o + 0.6} ${o}H${o + b}` +
    `M${W - o - b} ${o}H${W - o - 0.6}Q${W - o} ${o} ${W - o} ${o + 0.6}V${o + b}` +
    `M${W - o} ${H - o - b}V${H - o - 0.6}Q${W - o} ${H - o} ${W - o - 0.6} ${H - o}H${W - o - b}` +
    `M${o + b} ${H - o}H${o + 0.6}Q${o} ${H - o} ${o} ${H - o - 0.6}V${H - o - b}`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${text}">
    <g fill="#2b2118">${dots}</g>
    <path d="${br}" fill="none" stroke="var(--accent)" stroke-width="0.5" stroke-linecap="round"/>
  </svg>`;
}
