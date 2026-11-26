/* Negara Merdu — modul game "karakter" (dirombak: proporsi stylized halus, rambut berponi, sepatu & tangan detail).
   Kontrak ekspor, pivot animasi, y=0 di telapak sepatu, dan cache SUMBER_BERSAMA dipertahankan 100%. */
import { M } from "./bersama.js";

export function buatLabel(teks, besar, jabatan) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = jabatan ? 176 : 128;
  const c = cv.getContext("2d");
  c.fillStyle = "rgba(255,251,240,0.92)";
  c.beginPath();
  if (c.roundRect) c.roundRect(56, 22, 400, jabatan ? 132 : 84, 44); else c.rect(56, 22, 400, jabatan ? 132 : 84);
  c.fill();
  c.fillStyle = "#21332a"; c.font = "bold 46px system-ui, sans-serif";
  c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(teks, 256, jabatan ? 60 : 66, 380);
  if (jabatan) {
    c.fillStyle = "#9a6b00"; c.font = "bold 36px system-ui, sans-serif";
    c.fillText(jabatan, 256, 116, 380);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(besar || 3.6, (besar || 3.6) * cv.height / 512, 1);
  return sp;
}

export const SUMBER_BERSAMA = new Set();

export function taperKepala(t) {
  if (t < 0) return 1 - 0.24 * Math.pow(-t, 1.55); // rahang -> dagu lebih lembut
  return 1 - 0.05 * t * t;
}

export function bentukKepala(geo) {
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const t = v.y / 0.44, f = taperKepala(t);
    const rata = t > 0.58 ? 1 - 0.05 * (t - 0.58) / 0.42 : 1;
    p.setXYZ(i, v.x * f * 1.03, v.y * rata, v.z * f);
  }
  geo.computeVertexNormals();
  return geo;
}

export const RK = { x: 0.4532, y: 0.44, z: 0.4048 };
export function mukaZ(x, y) {
  const q = 1 - (x * x) / (RK.x * RK.x) - (y * y) / (RK.y * RK.y);
  return RK.z * Math.sqrt(Math.max(0.02, q)) * taperKepala(y / RK.y);
}

export let GEO_KARAKTER = null;
export function geoKarakter() {
  if (GEO_KARAKTER) return GEO_KARAKTER;
  const def = {
    // Kaki & Sepatu (berujung bulat)
    celana: new THREE.CylinderGeometry(0.105, 0.088, 0.40, 14),
    lipatCelana: new THREE.CylinderGeometry(0.098, 0.106, 0.08, 14),
    sepatuBelakang: new THREE.BoxGeometry(0.19, 0.095, 0.18),
    sepatuUjung: new THREE.SphereGeometry(0.095, 14, 10),
    solSepatu: new THREE.BoxGeometry(0.21, 0.036, 0.28),
    solUjung: new THREE.CylinderGeometry(0.105, 0.105, 0.036, 14),
    // Torso, Pinggul, Leher & Detail Kemeja
    pinggul: new THREE.CylinderGeometry(0.265, 0.255, 0.14, 14),
    badan: new THREE.CylinderGeometry(0.34, 0.265, 0.56, 16),
    leher: new THREE.CylinderGeometry(0.115, 0.135, 0.16, 14),
    kerah: new THREE.CylinderGeometry(0.22, 0.29, 0.10, 16),
    plaket: new THREE.BoxGeometry(0.09, 0.44, 0.03),
    saku: new THREE.BoxGeometry(0.13, 0.13, 0.025),
    kancing: new THREE.SphereGeometry(0.02, 12, 10),
    // Lengan & Tangan
    lenganAtas: new THREE.CylinderGeometry(0.08, 0.068, 0.32, 14),
    lenganBawah: new THREE.CylinderGeometry(0.062, 0.052, 0.29, 14),
    tangan: new THREE.SphereGeometry(0.068, 14, 12),
    jempol: new THREE.SphereGeometry(0.028, 10, 8),
    bahu: new THREE.SphereGeometry(0.112, 14, 12),
    kerahDepan: new THREE.BoxGeometry(0.095, 0.16, 0.025),
    manset: new THREE.CylinderGeometry(0.072, 0.075, 0.075, 14),
    // Kepala & Wajah
    kepala: bentukKepala(new THREE.SphereGeometry(0.44, 32, 24)),
    mataPutih: new THREE.SphereGeometry(0.086, 16, 12),
    pupil: new THREE.SphereGeometry(0.052, 16, 12),
    highlight: new THREE.SphereGeometry(0.02, 12, 10),
    alis: new THREE.BoxGeometry(0.18, 0.044, 0.032),
    hidung: new THREE.SphereGeometry(0.052, 14, 10), // hidung bulat stylized
    telinga: new THREE.SphereGeometry(0.092, 14, 12),
    mulut: new THREE.TorusGeometry(0.115, 0.019, 6, 12, Math.PI),
    gigi: new THREE.TorusGeometry(0.085, 0.014, 6, 12, Math.PI),
    pipi: new THREE.CircleGeometry(0.068, 12),
    // Rambut (berponi + sisi samping) & Penutup Kepala
    rambut: new THREE.SphereGeometry(0.462, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.48),
    rambutBelakang: new THREE.SphereGeometry(0.455, 18, 12, Math.PI / 2 + 1.15, Math.PI * 2 - 2.3, Math.PI * 0.35, Math.PI * 0.35),
    poni: new THREE.SphereGeometry(0.13, 12, 10),
    sampingRambut: new THREE.BoxGeometry(0.07, 0.22, 0.14),
    peci: new THREE.CylinderGeometry(0.34, 0.385, 0.27, 18),
    peciSabuk: new THREE.CylinderGeometry(0.392, 0.40, 0.065, 18),
    peciAtas: new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    topiAtas: new THREE.SphereGeometry(0.464, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
    topiLidah: new THREE.CylinderGeometry(0.24, 0.26, 0.04, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
  };
  for (const k in def) SUMBER_BERSAMA.add(def[k]);
  GEO_KARAKTER = def;
  return def;
}

export const CACHE_MAT_KARAKTER = new Map();
export function matKarakter(warna) {
  let m = CACHE_MAT_KARAKTER.get(warna);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: warna, roughness: 0.72, metalness: 0.02, flatShading: false });
    CACHE_MAT_KARAKTER.set(warna, m); SUMBER_BERSAMA.add(m);
  }
  return m;
}

export function hashWarna(teks) {
  let h = 0;
  for (let i = 0; i < teks.length; i++) h = (h * 31 + teks.charCodeAt(i)) >>> 0;
  return h;
}
export const PALET_CELANA = [0x37474f, 0x2e4053, 0x4e342e, 0x556052, 0x3e3a34];
export const PALET_TOPI = [0xd95f43, 0x3f6fb5, 0xe8c268, 0x43a06a];
export function warnaCelana(bajuHex) { return PALET_CELANA[hashWarna(bajuHex || "") % PALET_CELANA.length]; }
export function warnaTopi(bajuHex) { return PALET_TOPI[(hashWarna(bajuHex || "") + 2) % PALET_TOPI.length]; }
export function warnaSkala(hex, faktor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(faktor);
  return c.getHex();
}

/* ===================== KARAKTER REALISTIS (rombak 26 Nov 2026) =====================
   Anatomi dibangun dari profil LATHE (bukan tabung/bola polos): paha-betis
   berotot, pinggang-dada-bahu, lengan atas + SIKU + lengan bawah, telapak &
   jari, sepatu berbentuk. Wajah proporsional: mata kecil beriris + garis
   bulu mata, hidung berbatang, bibir atas/bawah. Postur pria/wanita berbeda
   (bahu, pinggang, pinggul). Pakaian bervariasi per warga (deterministik dari
   data): kemeja panjang/pendek, kaos, polo; celana, jeans, celana pendek,
   rok (pendek / panjang untuk berhijab). Kontrak tetap: y=0 di telapak,
   pinggul (pivot kaki) 0,85, lutut 0,43, bahu (pivot lengan) ±1,42, pusat
   kepalaGrup 1,61 berskala SKALA_KEPALA (satuan kepala lama -> topi/baret
   di keamanan.js tetap pas), userData sama seperti sebelumnya. */
export const PINGGUL = 0.85, NAIK = 0.33, SKALA_KEPALA = 0.34;
const CACHE_GEO_VAR = new Map();
function geoVar(kunci, buat) {
  let g = CACHE_GEO_VAR.get(kunci);
  if (!g) { g = buat(); CACHE_GEO_VAR.set(kunci, g); SUMBER_BERSAMA.add(g); }
  return g;
}
/* profil [[r, y], ...] urut y naik -> LatheGeometry */
function bubut(kunci, titik, seg) {
  return geoVar(kunci, () => new THREE.LatheGeometry(titik.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), seg || 14));
}
const BOLA = () => geoVar("bola", () => new THREE.SphereGeometry(1, 14, 10));
const BALOK = () => geoVar("balok", () => new THREE.BoxGeometry(1, 1, 1));
export function buatKarakter(opsi) {
  const GEO = geoKarakter();
  const g = new THREE.Group();
  const kulitHex = opsi.kulit || "#f1c27d";
  const kulit = parseInt(kulitHex.slice(1), 16);
  const bajuHex = opsi.baju || "#2e9e5b";
  const baju = parseInt(bajuHex.slice(1), 16);
  const R = opsi.rupa || {}; // kustom karakter dari pendaftaran (rambut, warna rambut/celana, kacamata, alis)
  const hexKe = (h, cadangan) => (typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h) ? parseInt(h.slice(1), 16) : cadangan);
  const gaya = R.rambut || "pendek";
  const wanita = (opsi.gender || R.gender) === "P" || ((opsi.gender || R.gender) !== "L" && (opsi.topi === "hijab" || gaya === "panjang" || gaya === "kuncir"));
  const h = hashWarna(bajuHex + kulitHex + (opsi.topi || "") + gaya);
  const resmi = opsi.topi === "peci" || R.rambut === "botak" && R.warna_celana; // pejabat/petugas berseragam -> kemeja
  const atasan = R.atasan || opsi.atasan || (resmi ? "kemeja" : ["kemeja", "kaos", "polo", "kemejaPendek", "kaos", "kemeja"][h % 6]);
  const bawahan = R.bawahan || opsi.bawahan || (resmi ? "celana" : wanita
    ? (opsi.topi === "hijab" ? ["rokPanjang", "celana", "rokPanjang"][(h >>> 3) % 3] : ["rok", "celana", "jeans"][(h >>> 3) % 3])
    : atasan === "kemeja" ? ["celana", "jeans", "celana"][(h >>> 3) % 3] : ["celana", "jeans", "celana", "pendek", "jeans"][(h >>> 3) % 5]);
  let celana = hexKe(R.warna_celana, warnaCelana(bajuHex));
  if (bawahan === "jeans" && !R.warna_celana) celana = [0x3b5578, 0x2c3e5c, 0x52698c][h % 3];
  const matKulit = matKarakter(kulit), matBaju = matKarakter(baju), matCelana = matKarakter(celana);
  const matBajuGelap = matKarakter(warnaSkala(baju, 0.78));
  const lenganPanjang = atasan === "kemeja";

  function bagian(geo, mat, x, y, z, bayangan) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !!bayangan;
    return m;
  }
  const bola = (mat, x, y, z, sx, sy, sz) => { const m = bagian(BOLA(), mat, x, y, z, false); m.scale.set(sx, sy, sz); return m; };
  const balok = (mat, x, y, z, sx, sy, sz) => { const m = bagian(BALOK(), mat, x, y, z, false); m.scale.set(sx, sy, sz); return m; };

  const tubuh = new THREE.Group(); g.add(tubuh); // semua bagian; turun saat duduk supaya pinggul tetap di tinggi dudukan lama (0,52)
  const W = wanita ? 1 : 0;
  const lebarBahu = wanita ? 0.18 : 0.195, xLengan = wanita ? 0.198 : 0.218;

  /* ---------- KAKI: paha (pivot pinggul) -> lutut -> betis -> sepatu ---------- */
  const sepatuMat = matKarakter(lenganPanjang || bawahan === "rokPanjang" ? 0x1e1b18 : [0x2f2c28, 0xf1efe9, 0x6b4a2e, 0x24324a][(h >>> 5) % 4]);
  const solMat = matKarakter(sepatuMat === matKarakter(0x1e1b18) ? 0x15120f : 0xeae4d6);
  const geoPaha = bubut("paha" + W, wanita
    ? [[0.056, -0.44], [0.06, -0.4], [0.072, -0.28], [0.088, -0.1], [0.095, 0.0], [0.07, 0.05], [0.001, 0.07]]
    : [[0.058, -0.44], [0.062, -0.4], [0.072, -0.3], [0.085, -0.1], [0.09, 0.0], [0.065, 0.05], [0.001, 0.07]]);
  const geoPahaAtas = bubut("pahaAtas2" + W, [[0.08, -0.33], [0.083, -0.25], [0.088, -0.1], [0.093, 0.0], [0.068, 0.05], [0.001, 0.07]]);
  const geoBetisCelana = bubut("betisC", [[0.054, -0.355], [0.054, -0.3], [0.058, -0.15], [0.062, -0.04], [0.06, 0.03]]);
  const geoBetisKulit = bubut("betisK" + W, [[0.033, -0.37], [0.036, -0.3], [0.05, -0.18], [0.059, -0.09], [0.056, 0.0], [0.054, 0.03]]);
  const pakaiCelanaPanjang = bawahan === "celana" || bawahan === "jeans";
  function buatKaki(sx) {
    const kaki = new THREE.Group(); kaki.position.set(sx, PINGGUL, 0);
    if (pakaiCelanaPanjang) kaki.add(bagian(geoPaha, matCelana, 0, 0, 0, true));
    else {
      kaki.add(bagian(geoPaha, matKulit, 0, 0, 0, true));
      if (bawahan === "pendek") kaki.add(bagian(geoPahaAtas, matCelana, 0, 0, 0, true));
    }
    if (bawahan === "rok" || bawahan === "rokPanjang") { // rok menempel di paha -> ikut saat duduk/berjalan
      const rok = bubut("rokPaha", [[0.13, -0.42], [0.125, -0.3], [0.11, -0.12], [0.1, 0.02], [0.09, 0.07]], 16);
      const r = bagian(rok, matCelana, -sx * 0.35, 0, 0, true); r.scale.set(1, 1, 0.95); kaki.add(r);
    }
    const lutut = new THREE.Group(); lutut.position.y = -0.42; kaki.add(lutut); kaki.userData.lutut = lutut;
    if (pakaiCelanaPanjang) {
      lutut.add(bagian(geoBetisCelana, matCelana, 0, 0, 0, true));
      lutut.add(bagian(geoBetisKulit, matKarakter(0x2a2a2a), 0, 0, 0, false)); // kaus kaki di bawah ujung celana
    } else lutut.add(bagian(geoBetisKulit, matKulit, 0, 0, 0, true));
    if (bawahan === "rokPanjang") {
      const rp = bagian(bubut("rokBetis", [[0.135, -0.36], [0.13, -0.2], [0.13, 0.02]], 16), matCelana, -sx * 0.35, 0, 0, true); rp.scale.set(1, 1, 0.95); lutut.add(rp);
    }
    // sepatu: badan lonjong + tumit + sol, ujung ke depan (+z), telapak tepat y=0
    lutut.add(bola(sepatuMat, 0, -0.388, 0.035, 0.052, 0.042, 0.125));
    lutut.add(balok(sepatuMat, 0, -0.38, -0.035, 0.092, 0.07, 0.09));
    lutut.add(balok(solMat, 0, -0.4185, 0.025, 0.1, 0.023, 0.27));
    return kaki;
  }
  const kakiK = buatKaki(-0.093), kakiR = buatKaki(0.093);
  tubuh.add(kakiK); tubuh.add(kakiR);

  /* ---------- PANGGUL, TORSO, LEHER ---------- */
  const pinggul = bagian(bubut("panggul2" + W, wanita
    ? [[0.06, -0.1], [0.13, -0.075], [0.17, -0.03], [0.175, 0.03], [0.15, 0.11]]
    : [[0.06, -0.1], [0.13, -0.075], [0.162, -0.03], [0.165, 0.04], [0.155, 0.11]], 18), matCelana, 0, PINGGUL, 0, true);
  pinggul.scale.set(1, 1, 0.68); tubuh.add(pinggul);
  if (bawahan === "rok" || bawahan === "rokPanjang") { // pangkal rok mengembang dari pinggang
    const pr = bagian(bubut("pangkalRok", [[0.205, -0.1], [0.185, 0.0], [0.155, 0.1]], 18), matCelana, 0, PINGGUL, 0, true); pr.scale.set(1, 1, 0.72); tubuh.add(pr);
  }
  const dimasukkan = atasan === "kemeja" || atasan === "kemejaPendek" && resmi;
  const yBadan = PINGGUL + 0.08;
  const profilBadan = wanita
    ? [[0.148, -0.02], [0.13, 0.1], [0.135, 0.18], [0.158, 0.27], [0.162, 0.35], [0.156, 0.43], [0.142, 0.48], [0.1, 0.52], [0.064, 0.55]]
    : [[0.158, -0.02], [0.148, 0.08], [0.153, 0.16], [0.172, 0.28], [0.182, 0.38], [0.18, 0.44], [0.165, 0.49], [0.115, 0.535], [0.068, 0.56]];
  if (!dimasukkan) profilBadan.unshift([wanita ? 0.16 : 0.165, -0.11]); // baju dikeluarkan menutup pinggang
  const badan = bagian(bubut("badan" + W + (dimasukkan ? "m" : "k"), profilBadan, 18), matBaju, 0, yBadan, 0, true);
  badan.scale.set(1, 1, 0.64); badan.userData.skala = { x: 1, z: 0.64 }; tubuh.add(badan);
  if (dimasukkan) { // ikat pinggang + gesper
    const sabuk = bagian(geoVar("sabuk", () => new THREE.TorusGeometry(0.152, 0.016, 6, 22)), matKarakter(0x2a1d14), 0, yBadan - 0.005, 0, false);
    sabuk.rotation.x = Math.PI / 2; sabuk.scale.set(1, 0.66, 1); tubuh.add(sabuk);
    tubuh.add(balok(matKarakter(0xb8a26a), 0, yBadan - 0.005, 0.104, 0.04, 0.028, 0.01));
  }
  for (const s of [-1, 1]) tubuh.add(bola(matBaju, s * lebarBahu, PINGGUL + 0.565, 0, 0.06, 0.05, 0.058)); // bahu membulat
  { const lh = bagian(bubut("leher2", [[0.066, 0.0], [0.058, 0.07], [0.056, 0.14]]), matKulit, 0, PINGGUL + 0.58, 0.005, false); tubuh.add(lh); }

  // Detail atasan
  const zDepan = (yRel) => { // permukaan depan badan pada ketinggian yRel di atas yBadan
    for (let i = 1; i < profilBadan.length; i++) { const [r1, y1] = profilBadan[i - 1], [r2, y2] = profilBadan[i]; if (yRel <= y2) return (r1 + (r2 - r1) * (yRel - y1) / (y2 - y1)) * 0.64; }
    return 0.05;
  };
  if (atasan === "kemeja" || atasan === "kemejaPendek" || atasan === "polo") {
    for (const s of [-1, 1]) { // kerah lancip
      const k = balok(matBajuGelap, s * 0.04, PINGGUL + 0.565, zDepan(0.47) + 0.005, 0.045, 0.06, 0.01);
      k.rotation.set(-0.35, 0, -s * 0.5); tubuh.add(k);
    }
    const kb = bagian(geoVar("kerahBelakang", () => new THREE.CylinderGeometry(0.058, 0.07, 0.05, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8 + Math.PI)), matBajuGelap, 0, PINGGUL + 0.6, -0.005, false);
    tubuh.add(kb);
    const nKancing = atasan === "polo" ? 2 : 5, yAtas = atasan === "polo" ? 0.44 : 0.43, yBawah = atasan === "polo" ? 0.36 : 0.04;
    const plaket = balok(matKarakter(warnaSkala(baju, 0.9)), 0, yBadan + (yAtas + yBawah) / 2, (zDepan(yAtas) + zDepan(yBawah)) / 2 + 0.003, 0.032, yAtas - yBawah, 0.006);
    plaket.rotation.x = Math.atan2(zDepan(yAtas) - zDepan(yBawah), yAtas - yBawah); tubuh.add(plaket);
    for (let i = 0; i < nKancing; i++) {
      const yy = yAtas - 0.02 - i * (yAtas - yBawah - 0.04) / Math.max(1, nKancing - 1);
      tubuh.add(bola(matKarakter(0xe9e4da), 0, yBadan + yy, zDepan(yy) + 0.008, 0.008, 0.008, 0.004));
    }
    if (atasan !== "polo") { const saku = balok(matKarakter(warnaSkala(baju, 0.9)), wanita ? -0.07 : 0.075, yBadan + 0.33, zDepan(0.33) + 0.004, 0.06, 0.07, 0.006); saku.rotation.x = 0.12; tubuh.add(saku); }
  } else { // kaos: kerah bulat rib
    const rib = bagian(geoVar("ribKaos", () => new THREE.TorusGeometry(0.062, 0.011, 6, 16)), matBajuGelap, 0, PINGGUL + 0.585, 0.008, false);
    rib.rotation.x = Math.PI / 2 - 0.25; tubuh.add(rib);
  }

  /* ---------- LENGAN: bahu -> SIKU -> tangan ---------- */
  const geoLenganAtas = bubut("lenganAtas" + W, wanita
    ? [[0.036, -0.29], [0.039, -0.2], [0.043, -0.08], [0.046, 0.0], [0.03, 0.035]]
    : [[0.039, -0.29], [0.043, -0.2], [0.05, -0.08], [0.052, 0.0], [0.032, 0.035]]);
  const geoLenganBawah = bubut("lenganBawah" + W, wanita
    ? [[0.024, -0.255], [0.027, -0.2], [0.036, -0.08], [0.037, 0.0], [0.035, 0.02]]
    : [[0.027, -0.255], [0.03, -0.2], [0.041, -0.08], [0.042, 0.0], [0.039, 0.02]]);
  const geoLengan = bubut("lenganBaju", [[0.056, -0.15], [0.058, -0.05], [0.058, 0.035]], 14);
  function buatLengan(sx) {
    const lengan = new THREE.Group(); lengan.position.set(sx, PINGGUL + 0.565, 0);
    lengan.rotation.z = sx < 0 ? -0.07 : 0.07;
    if (lenganPanjang) lengan.add(bagian(geoLenganAtas, matBaju, 0, 0, 0, true));
    else { lengan.add(bagian(geoLenganAtas, matKulit, 0, 0, 0, true)); const lb = bagian(geoLengan, matBaju, 0, 0, 0, true); lb.scale.set(wanita ? 0.9 : 1, 1, 1); lengan.add(lb); }
    const siku = new THREE.Group(); siku.position.y = -0.285; siku.rotation.x = -0.14; lengan.add(siku); lengan.userData.siku = siku;
    if (lenganPanjang) {
      const lb = bagian(geoLenganBawah, matBaju, 0, 0, 0, false); lb.scale.set(1.15, 1, 1.15); siku.add(lb);
      siku.add(bagian(geoVar("manset", () => new THREE.CylinderGeometry(0.036, 0.036, 0.05, 12)), matBajuGelap, 0, -0.23, 0, false));
    } else siku.add(bagian(geoLenganBawah, matKulit, 0, 0, 0, false));
    // tangan: telapak + jari + ibu jari (menghadap ke paha)
    const tangan = new THREE.Group(); tangan.position.y = -0.26; siku.add(tangan);
    tangan.add(bola(matKulit, 0, -0.042, 0.004, 0.026, 0.05, 0.042));
    const jari = bola(matKulit, 0, -0.094, 0.012, 0.022, 0.045, 0.038); jari.rotation.x = -0.25; tangan.add(jari);
    const jempol = bola(matKulit, -Math.sign(sx) * 0.016, -0.045, 0.034, 0.012, 0.03, 0.012); jempol.rotation.set(-0.5, 0, Math.sign(sx) * 0.4); tangan.add(jempol);
    return lengan;
  }
  const lenganK = buatLengan(-xLengan), lenganR = buatLengan(xLengan);
  tubuh.add(lenganK); tubuh.add(lenganR);

  /* ---------- KEPALA & WAJAH (satuan kepala; pusat kepala mesh di y 0,24) ---------- */
  const kepalaGrup = new THREE.Group(); kepalaGrup.position.y = 1.32 + NAIK - 0.04; kepalaGrup.scale.setScalar(SKALA_KEPALA); tubuh.add(kepalaGrup);
  const kepalaMesh = bagian(GEO.kepala, matKulit, 0, 0.24, 0, true);
  kepalaMesh.scale.set(wanita ? 0.96 : 1, 1, 0.92); kepalaGrup.add(kepalaMesh);
  const fz = (x, y) => mukaZ(x, y - 0.24) * 0.92; // permukaan wajah (sudah termasuk skala z kepala)

  const matWajah = matKarakter(0x1d1714);
  const matPutih = matKarakter(0xf4f1ea);
  const matIris = matKarakter([0x3b2416, 0x4a2f1f, 0x2b1a10][h % 3]);
  const matBibir = matKarakter(new THREE.Color(kulit).lerp(new THREE.Color(0xa0453c), wanita ? 0.55 : 0.32).getHex());
  const matKulitGelap = matKarakter(warnaSkala(kulit, 0.86));
  const mataK = [], mataR = [];
  for (const s of [-1, 1]) {
    const ex = s * 0.148, ey = 0.275, ez = fz(ex, ey);
    const putih = bola(matPutih, ex, ey, ez - 0.004, 0.06, 0.036, 0.03);
    const iris = bola(matIris, ex, ey - 0.002, ez + 0.02, 0.027, 0.029, 0.012);
    const pup = bola(matWajah, ex, ey - 0.002, ez + 0.029, 0.013, 0.014, 0.006);
    const sorot = bola(matPutih, ex - 0.01, ey + 0.01, ez + 0.033, 0.006, 0.006, 0.003);
    for (const m of [putih, iris, pup, sorot]) { kepalaGrup.add(m); m.userData.sy = m.scale.y; }
    (s < 0 ? mataK : mataR).push(putih, iris, pup, sorot);
    // kelopak atas (kulit) + garis bulu mata -> mata tampak tertanam, tidak melotot
    const kelopak = bola(matKulit, ex, ey + 0.032, ez - 0.002, 0.066, 0.022, 0.032); kepalaGrup.add(kelopak);
    const bulu = balok(matWajah, ex, ey + 0.036, ez + 0.026, 0.11, wanita ? 0.014 : 0.01, 0.01); bulu.rotation.z = s * -0.08; kepalaGrup.add(bulu);
    const alis = balok(matKarakter(hexKe(R.warna_rambut, 0x281f1c)), s * 0.15, 0.37, fz(s * 0.15, 0.37) + 0.012, 0.15, R.alis === "tebal" ? 0.036 : wanita ? 0.018 : 0.026, 0.02);
    alis.rotation.set(-0.15, s * 0.25, s * (wanita ? -0.12 : -0.06)); kepalaGrup.add(alis);
    const tel = bagian(GEO.telinga, matKulit, s * 0.42, 0.24, -0.01, false);
    tel.scale.set(0.4, 0.95, 0.66); kepalaGrup.add(tel);
  }
  // hidung: batang + ujung + cuping
  { const nb = bola(matKulit, 0, 0.19, fz(0, 0.19) + 0.008, 0.032, 0.095, 0.03); nb.rotation.x = -0.35; kepalaGrup.add(nb);
    kepalaGrup.add(bola(matKulit, 0, 0.125, fz(0, 0.125) + 0.036, 0.04, 0.034, 0.034));
    for (const s of [-1, 1]) kepalaGrup.add(bola(matKulitGelap, s * 0.04, 0.115, fz(s * 0.04, 0.115) + 0.018, 0.026, 0.022, 0.022)); }
  // bibir atas/bawah + garis mulut
  const mulut = new THREE.Group(); kepalaGrup.add(mulut);
  { const zm = fz(0, 0.035);
    mulut.add(bola(matBibir, 0, 0.045, zm + 0.01, 0.085, 0.02, 0.03));
    mulut.add(bola(matBibir, 0, 0.012, zm + 0.008, 0.075, 0.024, 0.03));
    mulut.add(balok(matKarakter(0x4a2422), 0, 0.03, zm + 0.03, 0.13, 0.008, 0.008)); }
  // dagu & rahang pria sedikit tegas
  if (!wanita) kepalaGrup.add(bola(matKulit, 0, -0.1, fz(0, -0.1) - 0.04, 0.12, 0.07, 0.07));

  // Rambut / Peci / Topi
  const matRambut = matKarakter(hexKe(R.warna_rambut, 0x281f1c));
  // Kacamata (opsional): 2 bingkai bulat + jembatan + gagang
  if (R.kacamata === "ya") {
    const matKaca = matKarakter(0x1b1b1d);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 8, 20), matKaca); b.position.set(s * 0.155, 0.285, 0.418); kepalaGrup.add(b);
      const gg = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.32), matKaca); gg.position.set(s * 0.25, 0.3, 0.27); kepalaGrup.add(gg);
    }
    const jb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.012), matKaca); jb.position.set(0, 0.3, 0.425); kepalaGrup.add(jb);
  }
  // Rambut tambahan per gaya (dipasang juga di bawah topi/peci kecuali hijab & botak)
  function rambutGaya() {
    if (gaya === "panjang") { // tergerai sampai bahu
      const ur = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.62, 18, 1, true, 1.55, Math.PI * 2 - 3.1), matRambut); // hanya separuh belakang: wajah & rahang tetap terbuka
      ur.position.set(0, 0.06, -0.02); kepalaGrup.add(ur);
    } else if (gaya === "kuncir") { // kuncir kuda di belakang + ikat rambut
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), matRambut); k.scale.set(0.9, 1.6, 0.9); k.position.set(0, 0.22, -0.5); kepalaGrup.add(k);
      const ikat = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 14), matKarakter(0xe14b6f)); ikat.position.set(0, 0.42, -0.47); ikat.rotation.x = Math.PI / 2.4; kepalaGrup.add(ikat);
    } else if (gaya === "ikal") { // gumpal ikal di ubun-ubun
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2, r = i % 2 ? 0.3 : 0.18;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), matRambut); b.position.set(Math.cos(a) * r, 0.6 + (i % 3) * 0.03, Math.sin(a) * r - 0.04); kepalaGrup.add(b);
      }
    }
  }
  if (opsi.topi === "hijab") { // kerudung menutup kepala & leher, wajah terbuka
    const matHijab = matKarakter(hexKe(R.warna_rambut && R.warna_rambut !== "#281f1c" ? R.warna_rambut : null, warnaSkala(baju, 0.85)));
    // mahkota (menutup dahi sampai atas alis) + bungkus samping/belakang yang TERBUKA di depan wajah
    const mahkota = new THREE.Mesh(geoVar("hijabMahkota", () => new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.36)), matHijab);
    mahkota.position.set(0, 0.24, -0.01); mahkota.scale.set(1, 1.02, 0.98); mahkota.castShadow = true; kepalaGrup.add(mahkota);
    const bungkus = new THREE.Mesh(geoVar("hijabBungkus", () => new THREE.SphereGeometry(0.5, 24, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.34, Math.PI * 0.42)), matHijab);
    bungkus.position.set(0, 0.24, -0.01); bungkus.scale.set(1, 1.02, 0.98); bungkus.castShadow = true; kepalaGrup.add(bungkus);
    const bingkai = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.06, 10, 28, Math.PI * 1.25), matHijab);
    bingkai.position.set(0, 0.22, 0.2); bingkai.rotation.z = -Math.PI * 0.125 - Math.PI / 2 + Math.PI; bingkai.rotation.z = Math.PI * 1.375; kepalaGrup.add(bingkai);
    const jubah = new THREE.Mesh(geoVar("hijabJubah", () => new THREE.LatheGeometry([[0.62, -0.62], [0.6, -0.5], [0.5, -0.3], [0.4, -0.1], [0.36, 0.05]].map(([r, y]) => new THREE.Vector2(r, y)), 24)), matHijab);
    jubah.scale.set(1, 1, 0.8); kepalaGrup.add(jubah);
  } else if (opsi.topi === "peci") {
    const matPeci = matKarakter(0x1c1c1e);
    kepalaGrup.add(bagian(GEO.peci, matPeci, 0, 0.61, 0, true));
    kepalaGrup.add(bagian(GEO.peciSabuk, matKarakter(0x2e2e34), 0, 0.48, 0, false));
    const kubahPeci = bagian(GEO.peciAtas, matPeci, 0, 0.745, 0, false);
    kubahPeci.scale.set(1, 0.24, 1); kepalaGrup.add(kubahPeci);
    // Sedikit rambut di samping & belakang bawah peci
    if (gaya !== "botak") { for (const s of [-1, 1]) kepalaGrup.add(bagian(GEO.sampingRambut, matRambut, s * 0.40, 0.36, -0.06, false)); if (gaya !== "ikal") rambutGaya(); }
  } else if (opsi.topi === "topi") {
    const matTopi = matKarakter(warnaTopi(bajuHex));
    const kubah = bagian(GEO.topiAtas, matTopi, 0, 0.25, 0, true);
    kubah.scale.set(1.03, 1.03, 0.95); kepalaGrup.add(kubah);
    const lidah = bagian(GEO.topiLidah, matTopi, 0, 0.42, 0.33, false);
    lidah.rotation.x = 0.08; kepalaGrup.add(lidah);
    if (gaya !== "botak") { for (const s of [-1, 1]) kepalaGrup.add(bagian(GEO.sampingRambut, matRambut, s * 0.40, 0.33, -0.06, false)); if (gaya !== "ikal") rambutGaya(); }
  } else if (gaya === "botak") {
    // botak: tanpa rambut
  } else {
    // Rambut penuh dengan volume belakang, sisi samping, dan poni
    const rambut = bagian(GEO.rambut, matRambut, 0, 0.25, -0.03, true);
    rambut.scale.set(1.03, 1.03, 0.95); rambut.rotation.x = -0.26; kepalaGrup.add(rambut);
    const belakang = bagian(GEO.rambutBelakang, matRambut, 0, 0.23, -0.05, false);
    belakang.scale.set(1.01, 1.0, 0.95); kepalaGrup.add(belakang);
    for (const s of [-1, 1]) kepalaGrup.add(bagian(GEO.sampingRambut, matRambut, s * 0.40, 0.33, -0.04, false));
    for (const [px, py, pz, sx, sy] of [[-0.14, 0.51, 0.31, 1.1, 0.75], [0.02, 0.53, 0.33, 1.25, 0.8], [0.17, 0.50, 0.30, 1.0, 0.7]]) {
      const p = bagian(GEO.poni, matRambut, px, py, pz, false);
      p.scale.set(sx, sy, 0.85); kepalaGrup.add(p);
    }
    rambutGaya();
  }

  g.userData.tubuh = tubuh; g.userData.lututK = kakiK.userData.lutut; g.userData.lututR = kakiR.userData.lutut;
  g.userData.lenganK = lenganK; g.userData.lenganR = lenganR; g.userData.sikuK = lenganK.userData.siku; g.userData.sikuR = lenganR.userData.siku;
  g.userData.kakiK = kakiK; g.userData.kakiR = kakiR;
  g.userData.kepala = kepalaGrup;
  g.userData.badan = badan;
  g.userData.mataK = mataK; g.userData.mataR = mataR;
  g.userData.geserHidup = Math.random() * 10;
  g.userData.pakaian = atasan + "/" + bawahan;
  return g;
}

export const AYUN_KAKI = 0.55, AYUN_LENGAN = 0.4;
export function animasiJalan(kar, jarak, dt) {
  const u = kar.userData;
  if (!u.kakiK || !u.kakiR) return 0;
  if (u.faseJalan === undefined) { u.faseJalan = u.fase || 0; u.ayunKuat = 0; }
  jarak = Math.min(Math.max(jarak || 0, 0), 3);
  const kec = dt > 0 ? jarak / dt : 0;
  const siklus = Math.max(2.2, kec / 2.2);
  u.faseJalan += jarak / siklus * Math.PI * 2;
  const target = jarak > 0.0001 ? Math.min(1, 0.35 + kec / 6) : 0;
  u.ayunKuat += (target - u.ayunKuat) * (1 - Math.exp(-dt * 7));
  if (target === 0 && u.ayunKuat < 0.002) u.ayunKuat = 0;
  const s = Math.sin(u.faseJalan) * u.ayunKuat;
  u.kakiK.rotation.x = s * AYUN_KAKI;
  u.kakiR.rotation.x = -s * AYUN_KAKI;
  if (u.lenganK && u.lenganR) { u.lenganK.rotation.x = -s * AYUN_LENGAN; u.lenganR.rotation.x = s * AYUN_LENGAN; }
  // Pantulan badan HALUS: (1 - cos 2φ)/2 — frekuensi sama dengan |sin φ| (2x per
  // siklus langkah) tetapi tanpa "patahan" tajam di titik terendah, jadi
  // karakter tidak lagi tampak tersentak-sentak saat berjalan.
  return (1 - Math.cos(u.faseJalan * 2)) * 0.5 * u.ayunKuat;
}

export function skalaKedip(t, geser) {
  const SIKLUS = 3.9, LAMA = 0.17;
  let f = (t + (geser || 0)) % SIKLUS;
  if (f < 0) f += SIKLUS;
  if (f >= LAMA) return 1;
  return 1 - Math.sin((f / LAMA) * Math.PI) * 0.92;
}

/* Pose duduk (paha diputar ke depan): tubuh turun supaya pinggul di 0,52
   (tinggi dudukan yang dipakai kode lama) & betis ditekuk ke bawah. */
export function aturDuduk(kar) {
  const u = kar.userData; if (!u.tubuh || !u.kakiK) return;
  const duduk = u.kakiK.rotation.x < -1.0 && u.kakiR.rotation.x < -1.0;
  u.tubuh.position.y = duduk ? 0.52 - PINGGUL : 0;
  if (u.lututK) { u.lututK.rotation.x = duduk ? -u.kakiK.rotation.x : 0; u.lututR.rotation.x = duduk ? -u.kakiR.rotation.x : 0; }
}
export function animasiHidup(kar, t, diam) {
  const u = kar.userData;
  if (!u.mataK || !u.mataR) return;
  const s = skalaKedip(t, u.geserHidup);
  for (const m of u.mataK) m.scale.y = m.userData.sy * s;
  for (const m of u.mataR) m.scale.y = m.userData.sy * s;
  if (u.badan) {
    const napas = diam ? 1 + Math.sin(t * 1.7 + (u.geserHidup || 0)) * 0.018 : 1, sk = u.badan.userData.skala || { x: 1, z: 0.78 };
    u.badan.scale.x = sk.x * napas;
    u.badan.scale.z = sk.z * napas;
  }
  aturDuduk(kar);
  if (diam && u.lenganK && u.lenganR) {
    const ayun = Math.sin(t * 1.7 + (u.geserHidup || 0) + 0.7) * 0.045;
    u.lenganK.rotation.x = ayun; u.lenganR.rotation.x = ayun;
  }
}
