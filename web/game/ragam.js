/* Negara Merdu — modul game "ragam": variasi bentang lahan supaya kota
   tidak monoton kotak-kotak (permintaan Diah 23 Nov 2026).

   Grid jalan & alamat warga (blok/kavling dari server) TIDAK diubah.
   Yang berubah hanya blok KOSONG yang masih jauh dari garis tumbuh desa:
   dulu semuanya petak rumput berpagar yang sama persis, kini bentang
   alam pedesaan yang bergerombol mengikuti noise halus (wilayah sawah,
   kebun, padang gembala, hutan, danau) sehingga dari atas terbaca
   sebagai petak-petak alami yang melintasi garis grid. Saat desa tumbuh
   (warga baru mengisi blok), blok di dekat garis tumbuh otomatis kembali
   jadi petak kavling siap bangun — klasifikasi dihitung ulang setiap
   bangunKotaMassal().

   Ditambah: pegunungan rendah-poli di cakrawala luar kota. Semua dekorasi
   instanced (beberapa draw call untuk seluruh kota) dan pohon/sapi ikut
   kepadatan kualitas lewat IM_LINGKUNGAN. Dekorasi tidak ditabrak pemain,
   sama seperti dekorasi kavling. */
import { BLOK_BARIS, BLOK_KOLOM, JALAN, KOTA_D, KOTA_W, PITCH, RESERVASI, TAMAN, hashInt, sudutBlok } from "./inti.js";
import { IM_LINGKUNGAN, PARAM, gabungBerwarna, rumahTerisi } from "./bersama.js";

/* ---------- klasifikasi (murni) ---------- */
function noise(x, y, s) { // value noise halus 0..1
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const h = (a, b) => hashInt(((a * 73856093) ^ (b * 19349663) ^ (s * 83492791)) >>> 0);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * sx;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * sx;
  return a + (b - a) * sy;
}
export const JARAK_TUMBUH = 28; // blok cadangan petak kavling di depan garis tumbuh desa
/* Map "kol,bar" -> jenis ("sawah"|"sawahKuning"|"kebun"|"padang"|"hutan"|"danau").
   Blok yang tidak ada di map = blok kota (perumahan/petak/fasilitas). */
export function klasifikasiBlok(terisi) {
  const blokIsi = new Set();
  for (const k of terisi) blokIsi.add(+k.split(",")[0]);
  // urutan tumbuh = urutan server (jarak kuadrat ke plaza, tie nomor blok)
  const urut = [];
  for (let bar = 0; bar < BLOK_BARIS; bar++) for (let kol = 0; kol < BLOK_KOLOM; kol++) {
    if (RESERVASI.has(kol + "," + bar) || TAMAN.has(kol + "," + bar)) continue;
    const dx = 2 * kol - (BLOK_KOLOM - 1), dz = 2 * bar - (BLOK_BARIS - 1);
    urut.push({ kol, bar, d2: dx * dx + dz * dz, no: bar * BLOK_KOLOM + kol + 1 });
  }
  urut.sort((a, b) => a.d2 - b.d2 || a.no - b.no);
  let pos = -1; urut.forEach((u, i) => { if (blokIsi.has(u.no)) pos = i; });
  const batas = Math.max(blokIsi.size, pos + 1) + JARAK_TUMBUH;
  const hasil = new Map();
  urut.forEach((u, i) => {
    if (i < batas || blokIsi.has(u.no)) return;
    const n = noise(u.kol / 6.5, u.bar / 6.5, 1) * 0.75 + noise(u.kol / 2.2, u.bar / 2.2, 2) * 0.25;
    const m = noise(u.kol / 4, u.bar / 4, 3);
    let j;
    if (n < 0.36) j = m > 0.58 ? "sawahKuning" : "sawah";
    else if (n < 0.46) j = "kebun";
    else if (n < 0.6) j = "padang";
    else j = "hutan";
    if ((j === "padang" || j === "hutan") && hashInt(u.no * 97 + 5) < 0.09) j = "danau";
    hasil.set(u.kol + "," + u.bar, j);
  });
  return hasil;
}

/* Jalan arteri (mobil kota.js) & rute bus tetap jalan kota beraspal penuh. */
export const ARTERI_KOL = new Set([20, 32, 36, 44, 48, 60]), ARTERI_BAR = new Set([10, 18, 20, 30, 36, 40]);
const blokDesaDari = (kl) => (k, b) => k < 0 || b < 0 || k >= BLOK_KOLOM || b >= BLOK_BARIS || kl.has(k + "," + b);
/* Persimpangan (kol,bar) = sudut barat-laut blok (kol,bar). Tetap "kota"
   (berlampu + marka) bila di jalan arteri atau menyentuh blok kota mana pun. */
export function saringPersimpangan(kl) {
  const desa = blokDesaDari(kl);
  return (p) => ARTERI_KOL.has(p.kol) || ARTERI_BAR.has(p.bar) ||
    !(desa(p.kol - 1, p.bar - 1) && desa(p.kol, p.bar - 1) && desa(p.kol - 1, p.bar) && desa(p.kol, p.bar));
}

/* ---------- tekstur lahan ---------- */
function kanvas(f) { const cv = document.createElement("canvas"); cv.width = cv.height = 256; f(cv.getContext("2d")); const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t; }
function teksturSawah(kuning) {
  return kanvas((c) => {
    c.fillStyle = "#8a7a4a"; c.fillRect(0, 0, 256, 256); // pematang
    const n = 4, w = 256 / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const h = hashInt(i * 7 + j * 13 + (kuning ? 50 : 0));
      const L = 34 + h * 10;
      c.fillStyle = kuning ? `hsl(${48 + h * 8},${55 + h * 10}%,${L + 10}%)` : `hsl(${95 + h * 15},${45 + h * 15}%,${L}%)`;
      c.fillRect(i * w + 3, j * w + 3, w - 6, w - 6);
      c.fillStyle = kuning ? "rgba(120,90,20,0.18)" : "rgba(20,60,20,0.2)";
      for (let r = 6; r < w - 6; r += 5) c.fillRect(i * w + 5, j * w + r, w - 10, 1.5); // larik padi
      if (!kuning && h > 0.7) { c.fillStyle = "rgba(160,210,230,0.35)"; c.fillRect(i * w + 6, j * w + 6, w * 0.5, w * 0.3); } // genangan air
    }
    c.fillStyle = "#6d5f39"; c.fillRect(126, 0, 4, 256); // saluran irigasi
  });
}
function teksturKebun() {
  return kanvas((c) => {
    c.fillStyle = "#8b6a43"; c.fillRect(0, 0, 256, 256);
    for (let y = 6; y < 256; y += 12) {
      const h = hashInt(y);
      c.fillStyle = `hsl(${90 + h * 30},48%,${32 + h * 10}%)`;
      for (let x = 4; x < 252; x += 7) { c.beginPath(); c.arc(x, y + 3, 3 + hashInt(x * 3 + y) * 1.5, 0, 7); c.fill(); }
    }
  });
}
function teksturPadang() {
  return kanvas((c) => {
    c.fillStyle = "#86b85a"; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const x = hashInt(i * 3 + 1) * 256, y = hashInt(i * 5 + 2) * 256;
      c.fillStyle = i % 9 === 0 ? "#f5f0d8" : i % 13 === 0 ? "#f2c94c" : i % 17 === 0 ? "#e89ab0" : i % 2 ? "rgba(40,90,30,0.25)" : "rgba(220,240,160,0.25)";
      c.fillRect(x, y, i % 9 && i % 13 && i % 17 ? 6 : 2.5, i % 9 && i % 13 && i % 17 ? 4 : 2.5);
    }
    c.strokeStyle = "rgba(150,120,70,0.5)"; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 180); c.bezierCurveTo(80, 120, 160, 230, 256, 150); c.stroke(); // jalan setapak
  });
}
function teksturHutan() {
  return kanvas((c) => {
    c.fillStyle = "#4d7f37"; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 200; i++) { c.fillStyle = i % 2 ? "rgba(30,60,20,0.25)" : "rgba(120,100,50,0.2)"; c.beginPath(); c.arc(hashInt(i * 7) * 256, hashInt(i * 11) * 256, 4 + hashInt(i) * 10, 0, 7); c.fill(); }
  });
}

/* Jalan desa: ruas jalan di antara dua blok desa ditutup lapisan rumput
   dengan jalan tanah sempit berbekas roda di tengah — grid aspal abu
   tidak lagi menyapu seluruh peta. Panjang ruas mengikuti sumbu v tekstur. */
function teksturJalanDesa() {
  const cv = document.createElement("canvas"); cv.width = 64; cv.height = 256; const c = cv.getContext("2d");
  c.fillStyle = "#6aa24c"; c.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 120; i++) { c.fillStyle = i % 2 ? "rgba(30,70,20,0.18)" : "rgba(230,240,170,0.15)"; c.fillRect(hashInt(i * 5) * 64, hashInt(i * 9) * 256, 3 + hashInt(i) * 5, 2 + hashInt(i + 3) * 4); }
  for (let y = 0; y < 256; y++) {
    const off = Math.sin(y / 256 * Math.PI * 2) * 2.2, w = 15 + Math.sin(y / 40) * 1.2;
    c.fillStyle = "#a98b5c"; c.fillRect(32 - w / 2 + off, y, w, 1);
    c.fillStyle = "rgba(90,70,40,0.35)"; c.fillRect(32 - w / 2 + off + 3, y, 2, 1); c.fillRect(32 + w / 2 + off - 5, y, 2, 1); // bekas roda
    c.fillStyle = "rgba(110,160,70,0.6)"; c.fillRect(31 + off, y, 2, 1); // rumput tengah
  }
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
function teksturSimpangDesa() {
  return kanvas((c) => {
    c.fillStyle = "#6aa24c"; c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) { c.fillStyle = i % 2 ? "rgba(30,70,20,0.18)" : "rgba(230,240,170,0.15)"; c.fillRect(hashInt(i * 5) * 256, hashInt(i * 9) * 256, 6, 4); }
    c.fillStyle = "#a98b5c"; c.fillRect(98, 0, 60, 256); c.fillRect(0, 98, 256, 60);
    c.beginPath(); c.arc(128, 128, 46, 0, 7); c.fill();
  });
}

/* ---------- geometri dekorasi (vertex color, digabung) ---------- */
const COK = 0x7a5230;
function geoPohonBulat() {
  return gabungBerwarna([
    { geo: new THREE.CylinderGeometry(0.3, 0.45, 3, 6), y: 1.5, warna: COK },
    { geo: new THREE.IcosahedronGeometry(2.3, 0), y: 4.2, warna: 0x4f9a42 },
    { geo: new THREE.IcosahedronGeometry(1.6, 0), x: 1.2, y: 3.6, z: 0.5, warna: 0x5aa64a },
    { geo: new THREE.IcosahedronGeometry(1.5, 0), x: -1, y: 3.8, z: -0.6, warna: 0x468c3b },
  ]);
}
function geoCemara() {
  return gabungBerwarna([
    { geo: new THREE.CylinderGeometry(0.25, 0.35, 2, 6), y: 1, warna: COK },
    { geo: new THREE.ConeGeometry(2.4, 3.4, 7), y: 3.2, warna: 0x2f6b3a },
    { geo: new THREE.ConeGeometry(1.9, 3, 7), y: 4.9, warna: 0x357a40 },
    { geo: new THREE.ConeGeometry(1.3, 2.6, 7), y: 6.5, warna: 0x3d8746 },
  ]);
}
function geoKelapa() {
  const d = [{ geo: new THREE.CylinderGeometry(0.18, 0.28, 7, 6), x: 0.4, y: 3.5, rz: -0.12, warna: 0x8e6b45 }];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    d.push({ geo: new THREE.BoxGeometry(3.2, 0.08, 0.7), x: 0.85 + Math.cos(a) * 1.4, y: 6.8, z: Math.sin(a) * 1.4, ry: -a, rz: -0.35, warna: i % 2 ? 0x4f9a3a : 0x5fae44 });
  }
  d.push({ geo: new THREE.IcosahedronGeometry(0.45, 0), x: 0.85, y: 6.7, warna: 0x7a5a2a });
  return gabungBerwarna(d);
}
function geoSapi() {
  const d = [
    { geo: new THREE.BoxGeometry(1.0, 0.9, 2.0), y: 1.2, warna: 0xffffff },
    { geo: new THREE.BoxGeometry(0.6, 0.6, 0.7), y: 1.5, z: 1.25, warna: 0xffffff },
    { geo: new THREE.BoxGeometry(0.62, 0.3, 0.3), y: 1.35, z: 1.62, warna: 0xe8b8a8 },
    { geo: new THREE.BoxGeometry(0.5, 0.5, 0.6), x: 0.26, y: 1.45, z: -0.3, warna: 0x3a2a20 }, // belang
  ];
  for (const [x, z] of [[-0.35, 0.75], [0.35, 0.75], [-0.35, -0.75], [0.35, -0.75]]) d.push({ geo: new THREE.BoxGeometry(0.22, 0.8, 0.22), x, y: 0.4, z, warna: 0xd9d4cc });
  for (const s of [-1, 1]) d.push({ geo: new THREE.BoxGeometry(0.08, 0.25, 0.08), x: s * 0.22, y: 1.9, z: 1.2, warna: 0xe8dcc0 });
  return gabungBerwarna(d);
}
function geoGubuk() {
  const d = [{ geo: new THREE.BoxGeometry(3, 0.2, 3), y: 0.9, warna: 0xa9743f }];
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) d.push({ geo: new THREE.BoxGeometry(0.18, 2.6, 0.18), x, y: 1.3, z, warna: 0x8a5a30 });
  const atap = new THREE.ConeGeometry(2.8, 1.6, 4); atap.rotateY(Math.PI / 4);
  d.push({ geo: atap, y: 3.3, warna: 0xc9a25a });
  return gabungBerwarna(d);
}

/* ---------- bangun ---------- */
const _d = new THREE.Object3D(), _w = new THREE.Color();
function instans(geo, mat, daftar, grup, ikutKepadatan, warnaFn) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, daftar.length));
  daftar.forEach((p, i) => {
    _d.position.set(p.x, p.y || 0, p.z); _d.rotation.set(0, p.ry || 0, 0); const s = p.s || 1; _d.scale.set(s, p.sy || s, s);
    _d.updateMatrix(); im.setMatrixAt(i, _d.matrix);
    if (warnaFn) im.setColorAt(i, warnaFn(p, _w));
  });
  if (warnaFn && !daftar.length) im.setColorAt(0, _w.setHex(0xffffff)); // jaga instanceColor tidak null (material bersama)
  im.count = daftar.length; im.frustumCulled = false; im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = false; im.receiveShadow = true;
  if (!daftar.length) im.visible = false;
  if (ikutKepadatan) { im.count = Math.floor(daftar.length * PARAM.kepadatan); IM_LINGKUNGAN.push({ mesh: im, penuh: daftar.length }); }
  grup.add(im); return im;
}
/* Pohon ditaruh berurut HASH supaya pemotongan kepadatan merata sekota. */
const urutHash = (a) => a.sort((p, q) => p.h - q.h);

export function bangunRagamLahan(grup) {
  const kl = klasifikasiBlok(rumahTerisi);
  const LAHAN = PITCH - JALAN, ISI = LAHAN - 5.4; // petak dalam trotoar
  const lantai = { sawah: [], sawahKuning: [], kebun: [], padang: [], hutan: [], danau: [] };
  const bulat = [], cemara = [], kelapa = [], sapi = [], gubuk = [];
  const air = [], pasir = [];
  for (const [kunci, j] of kl) {
    const [kol, bar] = kunci.split(",").map(Number), s = sudutBlok(kol, bar);
    const cx = s.x + JALAN + LAHAN / 2, cz = s.z + JALAN + LAHAN / 2, no = bar * BLOK_KOLOM + kol + 1;
    const H = (i) => hashInt(no * 131 + i * 17);
    const acak = (i, r) => ({ x: cx + (H(i) - 0.5) * r, z: cz + (H(i + 500) - 0.5) * r });
    lantai[j === "danau" ? "padang" : j].push({ x: cx, z: cz, ry: Math.floor(H(1) * 4) * Math.PI / 2 });
    if (j === "hutan") {
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const k = a * 4 + b; if (H(k + 40) < 0.12) continue;
        const p = { x: cx - ISI / 2 + (a + 0.2 + H(k) * 0.6) * ISI / 4, z: cz - ISI / 2 + (b + 0.2 + H(k + 9) * 0.6) * ISI / 4, ry: H(k + 3) * 6.28, s: 1 + H(k + 7) * 0.8, h: H(k + 77) };
        (H(k + 21) < 0.45 ? cemara : bulat).push(p);
      }
    } else if (j === "sawah" || j === "sawahKuning") {
      for (let i = 0; i < 3; i++) { const t = (i + H(i + 60)) / 3; kelapa.push({ x: cx - ISI / 2 + 1, z: cz - ISI / 2 + t * ISI, ry: H(i + 61) * 6.28, s: 0.9 + H(i + 62) * 0.4, h: H(i + 63) }); }
      if (H(70) < 0.6) gubuk.push({ x: cx + (H(71) - 0.5) * 30, z: cz + (H(72) - 0.5) * 30, ry: H(73) * 6.28, h: H(74) });
    } else if (j === "kebun") {
      for (let i = 0; i < 9; i++) kelapa.push({ x: cx - ISI / 2 + 2 + i * (ISI - 4) / 8, z: cz + ISI / 2 - 2, ry: H(i + 80) * 6.28, s: 0.45 + H(i + 81) * 0.15, h: H(i + 82) }); // deret pisang
      gubuk.push({ x: cx + ISI / 2 - 5, z: cz - ISI / 2 + 5, ry: 0, h: H(90) });
    } else if (j === "padang") {
      const nPohon = 1 + Math.floor(H(100) * 3);
      for (let i = 0; i < nPohon; i++) bulat.push({ ...acak(i + 101, ISI - 8), ry: H(i + 102) * 6.28, s: 1.1 + H(i + 103) * 0.6, h: H(i + 104) });
      const nSapi = 2 + Math.floor(H(110) * 4);
      for (let i = 0; i < nSapi; i++) sapi.push({ ...acak(i + 111, ISI - 14), ry: H(i + 112) * 6.28, s: 1, h: H(i + 113), w: H(i + 114) });
    } else if (j === "danau") {
      const n = 28, R = 17 + H(120) * 7, titik = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, r = R * (0.78 + noise(i / 4, no, 9) * 0.44); titik.push([Math.cos(a) * r * (1 + H(121) * 0.3), Math.sin(a) * r]); }
      const bentuk = (sk) => { const sh = new THREE.Shape(); titik.forEach(([x, z], i) => (i ? sh.lineTo(x * sk, z * sk) : sh.moveTo(x * sk, z * sk))); const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2); return g; };
      air.push({ geo: bentuk(1), x: cx, y: 0.1, z: cz, ry: H(122) * 6.28, warna: 0xffffff });
      pasir.push({ geo: bentuk(1.14), x: cx, y: 0.07, z: cz, ry: H(122) * 6.28, warna: 0xffffff });
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + H(i + 130), r = R * 1.35 + 2; (i % 3 ? bulat : kelapa).push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, ry: H(i + 131) * 6.28, s: 0.9 + H(i + 132) * 0.5, h: H(i + 133) }); }
    }
  }
  /* lantai lahan: 1 InstancedMesh per jenis (tekstur sendiri), diputar kelipatan 90° per blok */
  const geoLantai = new THREE.PlaneGeometry(LAHAN - 5.2, LAHAN - 5.2); geoLantai.rotateX(-Math.PI / 2);
  const TEX = { sawah: teksturSawah(false), sawahKuning: teksturSawah(true), kebun: teksturKebun(), padang: teksturPadang(), hutan: teksturHutan() };
  for (const j of Object.keys(TEX)) {
    const mat = new THREE.MeshStandardMaterial({ map: TEX[j], roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    instans(geoLantai, mat, lantai[j].map((p) => ({ ...p, y: 0.04 })), grup, false);
  }
  const matVC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const tint = (p, w) => w.setHSL(0, 0, 0.82 + p.h * 0.18);
  instans(geoPohonBulat(), matVC, urutHash(bulat), grup, true, tint);
  instans(geoCemara(), matVC, urutHash(cemara), grup, true, tint);
  instans(geoKelapa(), matVC, urutHash(kelapa), grup, true, tint);
  instans(geoGubuk(), matVC, gubuk, grup, false, (p, w) => w.setHex(0xffffff)); // WAJIB berwarna instans: matVC dipakai bersama (lihat catatan atap kosong di kota.js)
  instans(geoSapi(), matVC, urutHash(sapi), grup, true, (p, w) => (p.w < 0.5 ? w.setHex(0xffffff) : p.w < 0.8 ? w.setHex(0xb07a4a) : w.setHex(0x55504a)));
  if (air.length) {
    const mAir = new THREE.Mesh(gabungBerwarna(air), new THREE.MeshStandardMaterial({ color: 0x3e8fb0, roughness: 0.15, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const mPasir = new THREE.Mesh(gabungBerwarna(pasir), new THREE.MeshStandardMaterial({ color: 0xd8c690, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mAir.receiveShadow = mPasir.receiveShadow = true; grup.add(mPasir); grup.add(mAir);
  }
  /* lapisan jalan desa: ruas & simpang yang seluruh tetangganya blok desa */
  const desa = blokDesaDari(kl), saring = saringPersimpangan(kl), LEBAR = JALAN + 5.2;
  const ruasV = [], ruasH = [], simpang = [];
  for (let kol = 0; kol < BLOK_KOLOM; kol++) for (let bar = 0; bar < BLOK_BARIS; bar++) {
    const s = sudutBlok(kol, bar);
    if (!ARTERI_KOL.has(kol) && desa(kol - 1, bar) && desa(kol, bar)) ruasV.push({ x: s.x + JALAN / 2, z: s.z + JALAN + LAHAN / 2, y: 0.06 });
    if (!ARTERI_BAR.has(bar) && desa(kol, bar - 1) && desa(kol, bar)) ruasH.push({ x: s.x + JALAN + LAHAN / 2, z: s.z + JALAN / 2, y: 0.06, ry: Math.PI / 2 });
    if (!saring({ kol, bar })) simpang.push({ x: s.x + JALAN / 2, z: s.z + JALAN / 2, y: 0.061 });
  }
  const geoRuas = new THREE.PlaneGeometry(LEBAR, LAHAN - 5.2 + 0.02); geoRuas.rotateX(-Math.PI / 2);
  const matRuas = new THREE.MeshStandardMaterial({ map: teksturJalanDesa(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  instans(geoRuas, matRuas, ruasV.concat(ruasH), grup, false);
  /* ruas memanjang sampai ke trotoar blok (LAHAN-5,2 = isi blok); celah
     trotoar di ujung ruas ditutup simpang yang lebih lebar */
  const geoSimpang = new THREE.PlaneGeometry(LEBAR, LEBAR); geoSimpang.rotateX(-Math.PI / 2);
  instans(geoSimpang, new THREE.MeshStandardMaterial({ map: teksturSimpangDesa(), roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), simpang, grup, false);
  return kl;
}

/* ---------- pegunungan di cakrawala (dibangun sekali) ---------- */
export function bangunPegunungan(scene) {
  const pos = [], col = [], c = new THREE.Color();
  const W = KOTA_W / 2, D = KOTA_D / 2, keliling = 2 * (KOTA_W + KOTA_D), N = 70;
  for (let i = 0; i < N; i++) {
    const h0 = hashInt(i * 7919 + 3);
    let t = ((i + h0 * 0.6) / N) * keliling, x, z, nx, nz;
    if (t < KOTA_W) { x = -W + t; z = -D; nx = 0; nz = -1; }
    else if ((t -= KOTA_W) < KOTA_D) { x = W; z = -D + t; nx = 1; nz = 0; }
    else if ((t -= KOTA_D) < KOTA_W) { x = W - t; z = D; nx = 0; nz = 1; }
    else { t -= KOTA_W; x = -W; z = D - t; nx = -1; nz = 0; }
    const jauh = 650 + hashInt(i * 31 + 1) * 700, R = 260 + hashInt(i * 17 + 2) * 300, T = 160 + hashInt(i * 13 + 5) * 420;
    const gx = x + nx * jauh, gz = z + nz * jauh;
    const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed(), p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      let vx = p.getX(v), vy = p.getY(v), vz = p.getZ(v);
      const kas = 0.85 + noise(vx * 2 + i, vz * 2, 11) * 0.3;
      vy = Math.max(-0.15, vy);
      const y = vy * T * kas, tinggiRel = Math.max(0, vy);
      const runcing = 1 - Math.max(0, vy) * 0.55; // lereng mengerucut ke puncak, tidak membulat
      pos.push(gx + vx * R * kas * runcing, y - 8, gz + vz * R * kas * runcing);
      if (tinggiRel > 0.82 && T > 420) c.setHex(0xe9ece8);       // puncak pucat
      else if (tinggiRel > 0.55) c.setHex(0x6f7f62);             // batu berlumut
      else if (tinggiRel > 0.25) c.setHex(0x4d7d3e);             // hutan lereng
      else c.setHex(0x5e9346);                                   // kaki bukit
      col.push(c.r, c.g, c.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  m.frustumCulled = false; scene.add(m);
  return m;
}
