import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'assets/brand');
mkdirSync(out, { recursive: true });
// A book whose lifted pages become a pair of leaves. All geometry is authored here.
const mark = (paper = '#F4E9CA', leaf = '#B8CD91', stem = '#E3CD92') => `
  <path d="M244 445 C336 426 435 447 494 508 L494 688 C428 632 329 614 244 630 Z" fill="${paper}"/>
  <path d="M530 508 C589 447 688 426 780 445 L780 630 C695 614 596 632 530 688 Z" fill="${paper}"/>
  <path d="M229 650 C322 634 415 655 494 715 M795 650 C702 634 609 655 530 715" fill="none" stroke="${leaf}" stroke-width="15" stroke-linecap="round"/>
  <path d="M504 462 C418 445 360 368 371 277 C462 281 520 354 504 462Z" fill="${leaf}"/>
  <path d="M523 446 C504 349 565 268 662 251 C679 349 620 430 523 446Z" fill="${paper}"/>
  <path d="M512 679 L512 480 M512 480 C494 431 449 369 415 334 M512 480 C536 415 582 346 621 303" fill="none" stroke="${stem}" stroke-width="13" stroke-linecap="round"/>
`;
const svg = (inside) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inside}</svg>`;
const bg =
  '<defs><linearGradient id="forest" x2="0.85" y2="1"><stop stop-color="#315B46"/><stop offset="1" stop-color="#153B2C"/></linearGradient></defs><path fill="url(#forest)" d="M0 0H1024V1024H0Z"/>';
const icon = svg(bg + `<g transform="translate(-72 -58) scale(1.14)">${mark()}</g>`);
const foreground = svg(mark());
const mono = svg(mark('#FFFFFF', '#FFFFFF', '#FFFFFF'));
const light = svg(mark('#315B46', '#819962', '#AD8B4E'));
const dark = svg(mark());
writeFileSync(resolve(out, 'logo-source.svg'), foreground);
writeFileSync(resolve(out, 'icon-source.svg'), icon);
for (const [name, source, size] of [
  ['icon.png', icon, 1024],
  ['adaptive-foreground.png', foreground, 1024],
  ['adaptive-monochrome.png', mono, 1024],
  ['logo.png', light, 1024],
  ['logo-dark.png', dark, 1024],
  ['favicon.png', icon, 64],
  ['logo-header.png', icon, 128],
]) {
  let raster = sharp(Buffer.from(source)).resize(size, size);
  if (['icon.png', 'favicon.png', 'logo-header.png'].includes(name)) raster = raster.removeAlpha();
  await raster.png().toFile(resolve(out, name));
}
// Identity preview, separate from app assets.
const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760"><rect width="1200" height="760" fill="#F5F2EB"/><text x="75" y="84" font-family="Segoe UI, sans-serif" font-size="17" letter-spacing="5" fill="#798077">MOC / APP IDENTITY</text><rect x="82" y="175" width="350" height="350" rx="78" fill="#234B38"/><g transform="translate(82 175) scale(.342)">${mark()}</g><text x="520" y="310" font-family="Georgia, serif" font-size="112" fill="#315B46">mộc.</text><text x="524" y="375" font-family="Segoe UI, sans-serif" font-size="27" fill="#798077">ĐỌC CHẬM, ĐI THẬT XA.</text><path d="M525 420H1110" stroke="#DCDDD0"/><text x="524" y="469" font-family="Segoe UI, sans-serif" font-size="21" fill="#315B46">Sách mở · Lá non · Một khoảng bình yên</text><text x="82" y="662" font-family="Segoe UI, sans-serif" font-size="17" fill="#798077">ANDROID ICON / ADAPTIVE ICON / SPLASH / IN-APP LOGO</text></svg>`;
await sharp(Buffer.from(preview)).png().toFile(resolve(out, 'brand-preview.png'));
console.log('Created 7 PNG assets + SVG sources and identity preview in assets/brand.');
