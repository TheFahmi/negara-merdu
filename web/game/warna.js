/* Negara Merdu — modul game "warna": manajemen warna three r128.
   WAJIB diimpor paling awal (baris pertama main.js), sebelum modul lain
   membuat THREE.Color / CanvasTexture.

   Masalah yang diperbaiki: renderer memakai outputEncoding = sRGB, tetapi
   three r128 belum punya ColorManagement — warna hex material (0x63ac4e,
   "#b5533c", setHSL) dan tekstur kanvas diperlakukan sebagai nilai LINEAR,
   lalu di-encode sRGB lagi saat output. Akibatnya semua warna "dua kali
   terang": rumput, jalan, atap, plaza tampak pucat keputihan, kontras
   bayangan hilang, kota terlihat seperti tertutup kabut.

   Solusi global (tanpa menyentuh ratusan baris warna):
   - Color.setHex / setStyle / setHSL: nilai masukan dianggap sRGB lalu
     dikonversi ke linear (seperti ColorManagement.enabled di three baru).
   - Color.getHex / getStyle: dikonversi balik ke sRGB, jadi pola
     getHex() -> setHex() tetap bolak-balik tanpa bergeser.
   - CanvasTexture: encoding = sRGBEncoding (tekstur prosedural & label).
   ShaderMaterial kubah langit meng-encode sendiri lewat linearToOutputTexel. */
const T = typeof window !== "undefined" ? window.THREE : undefined;
if (T && !T.__warnaLinear) {
  T.__warnaLinear = true;
  const P = T.Color.prototype;
  const asliHex = P.setHex, asliStyle = P.setStyle, asliHSL = P.setHSL;
  const asliGetHex = P.getHex, asliGetStyle = P.getStyle;
  let dalam = 0; // setStyle("red") memanggil setHex di dalamnya: konversi sekali saja
  const bungkus = (fn) => function () {
    dalam++;
    try { fn.apply(this, arguments); } finally { dalam--; }
    if (dalam === 0) this.convertSRGBToLinear();
    return this;
  };
  P.setHex = bungkus(asliHex);
  P.setStyle = bungkus(asliStyle);
  P.setHSL = bungkus(asliHSL);
  const _c = new T.Color();
  P.getHex = function () {
    const r = this.r, g = this.g, b = this.b;
    _c.r = r; _c.g = g; _c.b = b; _c.convertLinearToSRGB();
    return asliGetHex.call(_c);
  };
  P.getStyle = function () {
    _c.r = this.r; _c.g = this.g; _c.b = this.b; _c.convertLinearToSRGB();
    return asliGetStyle.call(_c);
  };
  const CanvasAsli = T.CanvasTexture;
  class CanvasSRGB extends CanvasAsli {
    constructor(...a) { super(...a); this.encoding = T.sRGBEncoding; }
  }
  T.CanvasTexture = CanvasSRGB;
}
export const WARNA_LINEAR = true;
