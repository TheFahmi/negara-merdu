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
    rambutBelakang: new THREE.SphereGeometry(0.455, 18, 12, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.35),
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

export function buatKarakter(opsi) {
  const GEO = geoKarakter();
  const g = new THREE.Group();
  const kulit = parseInt((opsi.kulit || "#f1c27d").slice(1), 16);
  const bajuHex = opsi.baju || "#2e9e5b";
  const baju = parseInt(bajuHex.slice(1), 16);
  const celana = warnaCelana(bajuHex);
  const matKulit = matKarakter(kulit), matBaju = matKarakter(baju), matCelana = matKarakter(celana);

  function bagian(geo, mat, x, y, z, bayangan) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !!bayangan;
    return m;
  }

  // Kaki: pivot di pinggul y=0.52, telapak sepatu tepat di y=0
  const matLipat = matKarakter(warnaSkala(celana, 1.3));
  const matSepatu = matKarakter(0x2f2c28);
  const matSol = matKarakter(0xe6dfd0);
  function buatKaki(sx) {
    const kaki = new THREE.Group(); kaki.position.set(sx, 0.52, 0);
    kaki.add(bagian(GEO.celana, matCelana, 0, -0.20, 0, true));
    kaki.add(bagian(GEO.lipatCelana, matLipat, 0, -0.37, 0, false));
    // Sepatu rounded
    kaki.add(bagian(GEO.sepatuBelakang, matSepatu, 0, -0.455, -0.01, false));
    const ujung = bagian(GEO.sepatuUjung, matSepatu, 0, -0.465, 0.085, false);
    ujung.scale.set(1, 0.55, 1.15); kaki.add(ujung);
    kaki.add(bagian(GEO.solSepatu, matSol, 0, -0.502, 0.02, false));
    kaki.add(bagian(GEO.solUjung, matSol, 0, -0.502, 0.11, false));
    return kaki;
  }
  const kakiK = buatKaki(-0.155), kakiR = buatKaki(0.155);
  g.add(kakiK); g.add(kakiR);

  // Pinggul & Torso
  const pinggul = bagian(GEO.pinggul, matCelana, 0, 0.56, 0, true);
  pinggul.scale.z = 0.78; g.add(pinggul);

  const badan = bagian(GEO.badan, matBaju, 0, 0.87, 0, true);
  badan.scale.z = 0.78; g.add(badan);

  // Leher
  g.add(bagian(GEO.leher, matKulit, 0, 1.22, 0, false));

  // Detail Kemeja (kerah, plaket, kancing, saku dada kiri)
  const matKerahGelap = matKarakter(warnaSkala(baju, 0.72));
  const kerah = bagian(GEO.kerah, matKerahGelap, 0, 1.15, 0, false);
  kerah.scale.z = 0.78; g.add(kerah);

  for (const s of [-1, 1]) {
    const bahu = bagian(GEO.bahu, matBaju, s * 0.37, 1.12, 0, false);
    bahu.scale.set(1, 0.92, 0.78); g.add(bahu);
    const lidah = bagian(GEO.kerahDepan, matKerahGelap, s * 0.085, 1.10, 0.258, false);
    lidah.rotation.set(0.10, 0, -s * 0.42); g.add(lidah);
  }
  const plaket = bagian(GEO.plaket, matKarakter(warnaSkala(baju, 0.86)), 0, 0.88, 0.242, false);
  plaket.rotation.x = 0.11; g.add(plaket);

  const saku = bagian(GEO.saku, matKarakter(warnaSkala(baju, 0.88)), 0.14, 0.95, 0.232, false);
  saku.rotation.set(0.10, 0.18, 0); g.add(saku);

  const matKancing = matKarakter(0x2a2320);
  for (const ky of [1.03, 0.88, 0.73]) {
    g.add(bagian(GEO.kancing, matKancing, 0, ky, 0.264 + (ky - 0.88) * 0.11, false));
  }

  // Lengan & Tangan beribu jari
  function buatLengan(sx) {
    const lengan = new THREE.Group(); lengan.position.set(sx, 1.12, 0);
    lengan.rotation.z = sx < 0 ? -0.10 : 0.10;
    lengan.add(bagian(GEO.lenganAtas, matBaju, 0, -0.16, 0, true));
    lengan.add(bagian(GEO.manset, matKarakter(warnaSkala(baju, 0.8)), 0, -0.34, 0, false));
    lengan.add(bagian(GEO.lenganBawah, matKulit, 0, -0.47, 0, false));
    const tangan = bagian(GEO.tangan, matKulit, 0, -0.65, 0.01, false);
    tangan.scale.set(0.85, 1.12, 0.95);
    lengan.add(tangan);
    lengan.add(bagian(GEO.jempol, matKulit, sx < 0 ? 0.048 : -0.048, -0.63, 0.045, false));
    return lengan;
  }
  const lenganK = buatLengan(-0.40), lenganR = buatLengan(0.40);
  g.add(lenganK); g.add(lenganR);

  // Kepala & Wajah
  const kepalaGrup = new THREE.Group(); kepalaGrup.position.y = 1.32; g.add(kepalaGrup);
  const kepalaMesh = bagian(GEO.kepala, matKulit, 0, 0.24, 0, true);
  kepalaMesh.scale.set(1, 1, 0.92); kepalaGrup.add(kepalaMesh);

  const matWajah = matKarakter(0x2a2320);
  const matPutih = matKarakter(0xffffff);
  const matPipi = matKarakter(0xf2a097);
  if (!matPipi.polygonOffset) { matPipi.polygonOffset = true; matPipi.polygonOffsetFactor = -2; matPipi.polygonOffsetUnits = -2; }

  const mataK = [], mataR = [];
  for (const s of [-1, 1]) {
    const putih = bagian(GEO.mataPutih, matPutih, s * 0.155, 0.285, 0.362, false);
    putih.scale.set(1.04, 1.28, 0.48); kepalaGrup.add(putih);
    const pup = bagian(GEO.pupil, matWajah, s * 0.155, 0.28, 0.396, false);
    pup.scale.set(1, 1.25, 0.52); kepalaGrup.add(pup);
    const sorot = bagian(GEO.highlight, matPutih, s * 0.155 - 0.02, 0.318, 0.422, false);
    kepalaGrup.add(sorot);
    for (const m of [putih, pup, sorot]) m.userData.sy = m.scale.y;
    (s < 0 ? mataK : mataR).push(putih, pup, sorot);

    const alis = bagian(GEO.alis, matWajah, s * 0.155, 0.415, 0.342, false);
    alis.rotation.z = s * 0.14; alis.rotation.x = -0.12; kepalaGrup.add(alis);

    const tel = bagian(GEO.telinga, matKulit, s * 0.43, 0.26, -0.01, false);
    tel.scale.set(0.45, 1.05, 0.72); kepalaGrup.add(tel);

    const pipi = bagian(GEO.pipi, matPipi, s * 0.245, 0.185, 0.334, false);
    pipi.rotation.y = s * 0.45; pipi.rotation.x = 0.10; kepalaGrup.add(pipi);
  }

  // Hidung bulat stylized
  const hidung = bagian(GEO.hidung, matKulit, 0, 0.20, 0.405, false);
  hidung.scale.set(1.05, 0.82, 1.15); kepalaGrup.add(hidung);

  // Senyum
  const mulut = bagian(GEO.mulut, matKarakter(0x7c4030), 0, 0.095, 0.372, false);
  mulut.rotation.z = Math.PI; kepalaGrup.add(mulut);
  const gigi = bagian(GEO.gigi, matPutih, 0, 0.099, 0.368, false);
  gigi.rotation.z = Math.PI; kepalaGrup.add(gigi);

  // Rambut / Peci / Topi
  const matRambut = matKarakter(0x281f1c);
  if (opsi.topi === "peci") {
    const matPeci = matKarakter(0x1c1c1e);
    kepalaGrup.add(bagian(GEO.peci, matPeci, 0, 0.61, 0, true));
    kepalaGrup.add(bagian(GEO.peciSabuk, matKarakter(0x2e2e34), 0, 0.48, 0, false));
    const kubahPeci = bagian(GEO.peciAtas, matPeci, 0, 0.745, 0, false);
    kubahPeci.scale.set(1, 0.24, 1); kepalaGrup.add(kubahPeci);
    // Sedikit rambut di samping & belakang bawah peci
    for (const s of [-1, 1]) kepalaGrup.add(bagian(GEO.sampingRambut, matRambut, s * 0.40, 0.36, -0.06, false));
  } else if (opsi.topi === "topi") {
    const matTopi = matKarakter(warnaTopi(bajuHex));
    const kubah = bagian(GEO.topiAtas, matTopi, 0, 0.25, 0, true);
    kubah.scale.set(1.03, 1.03, 0.95); kepalaGrup.add(kubah);
    const lidah = bagian(GEO.topiLidah, matTopi, 0, 0.42, 0.33, false);
    lidah.rotation.x = 0.08; kepalaGrup.add(lidah);
    for (const s of [-1, 1]) kepalaGrup.add(bagian(GEO.sampingRambut, matRambut, s * 0.40, 0.33, -0.06, false));
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
  }

  g.userData.lenganK = lenganK; g.userData.lenganR = lenganR;
  g.userData.kakiK = kakiK; g.userData.kakiR = kakiR;
  g.userData.kepala = kepalaGrup;
  g.userData.badan = badan;
  g.userData.mataK = mataK; g.userData.mataR = mataR;
  g.userData.geserHidup = Math.random() * 10;
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
  return Math.abs(Math.sin(u.faseJalan)) * u.ayunKuat;
}

export function skalaKedip(t, geser) {
  const SIKLUS = 3.9, LAMA = 0.17;
  let f = (t + (geser || 0)) % SIKLUS;
  if (f < 0) f += SIKLUS;
  if (f >= LAMA) return 1;
  return 1 - Math.sin((f / LAMA) * Math.PI) * 0.92;
}

export function animasiHidup(kar, t, diam) {
  const u = kar.userData;
  if (!u.mataK || !u.mataR) return;
  const s = skalaKedip(t, u.geserHidup);
  for (const m of u.mataK) m.scale.y = m.userData.sy * s;
  for (const m of u.mataR) m.scale.y = m.userData.sy * s;
  if (u.badan) {
    const napas = diam ? 1 + Math.sin(t * 1.7 + (u.geserHidup || 0)) * 0.018 : 1;
    u.badan.scale.x = napas;
    u.badan.scale.z = 0.78 * napas;
  }
  if (diam && u.lenganK && u.lenganR) {
    const ayun = Math.sin(t * 1.7 + (u.geserHidup || 0) + 0.7) * 0.045;
    u.lenganK.rotation.x = ayun; u.lenganR.rotation.x = ayun;
  }
}
