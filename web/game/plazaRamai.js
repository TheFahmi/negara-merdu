/* Negara Merdu — modul game "plazaRamai": isi plaza supaya hidup
   (permintaan Diah 24 Nov 2026: "plaza terlalu sepi").

   Koordinat LOKAL grup `pusat` (istana.js): plaza x ±130, z ±65; istana
   |x| < 41 di z -43..-5; pita tengah z -5..45; busway z 47..61.
     BARAT  : Kolam air mancur menari (-85,-22) · taman bunga (z 12..30)
              · anak-anak bermain kejar-kejaran (-58,-26)
     TIMUR  : Panggung Rakyat Merdu (95,-22) + band 3 orang & penonton
              · deretan gerobak kaki lima + meja payung (z 12..40)
     TENGAH : penjual balon, kawanan merpati
     KELILING: umbul-umbul warna-warni di sepanjang pagar · lampu taman
   Orang = buatKarakter (sama dengan pasar), dianimasikan perbaruiPlazaRamai(). */
import { LAMPU_TAMAN, M, kotak } from "./bersama.js";
import { PLAZA_D, PLAZA_W } from "./inti.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";
import { teksturPapanNama } from "./fasilitas.js";

const Y0 = 0.32; // puncak slab plaza
const HW = PLAZA_W / 2, HD = PLAZA_D / 2;
const ORANG = [];   // {kar, jenis, ...}
let JET = [], LAMPU_PANGGUNG = [], UMBUL = null, UMBUL_DATA = [], MERPATI = null, MERPATI_DATA = [], BALON = [];
const BAJU = ["#c8102e", "#1d5a8f", "#2e9e5b", "#e8943a", "#7b2ff7", "#f2c230", "#e85d75", "#3aa6b9", "#ffffff", "#4a4a4a"];
const KULIT = ["#f1c27d", "#c68642", "#e0ac69", "#8d5524"];
const _d = new THREE.Object3D();

function orang(induk, i, x, z, rotY, jenis, ekstra) {
  const k = buatKarakter({ baju: BAJU[i % BAJU.length], kulit: KULIT[(i * 7) % KULIT.length], topi: i % 4 === 1 ? "hijab" : "tanpa" });
  k.position.set(x, Y0, z); k.rotation.y = rotY; k.userData.geserHidup = i * 0.73; induk.add(k);
  ORANG.push({ kar: k, jenis, x, z, fase: i * 1.3, ...(ekstra || {}) });
  return k;
}
function teksPapan(judul, sub, latar, w, h) {
  const cv = document.createElement("canvas"); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext("2d");
  const gr = c.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, latar[0]); gr.addColorStop(1, latar[1]);
  c.fillStyle = gr; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = "#f2c230"; c.textAlign = "center"; c.font = "bold " + Math.round(cv.height * 0.3) + "px sans-serif"; c.fillText(judul, 512, cv.height * 0.48);
  c.fillStyle = "#ffffff"; c.font = "bold " + Math.round(cv.height * 0.14) + "px sans-serif"; c.fillText(sub, 512, cv.height * 0.78);
  return new THREE.CanvasTexture(cv);
}

/* ---------- panggung rakyat (timur, menghadap barat / -x) ---------- */
function panggung(g, rint) {
  const cx = 95, cz = -22, P = new THREE.Group(); P.position.set(cx, Y0, cz); g.add(P);
  P.add(kotak(12, 1.3, 22, 0x3b2b22, 0, 0.65, 0));                  // lantai panggung
  P.add(kotak(12.2, 0.12, 22.2, 0x1d1d22, 0, 1.36, 0));
  for (let i = 0; i < 3; i++) P.add(kotak(1.2, 0.3 + i * 0.4, 4, 0x55595e, -6.6 - (2 - i) * 1.2 + 1.2, (0.3 + i * 0.4) / 2, 0)); // tangga depan
  // rangka truss + atap
  for (const [x, z] of [[-6, -11], [-6, 11], [6, -11], [6, 11]]) P.add(kotak(0.5, 9, 0.5, 0x9aa0a6, x, 4.5, z));
  for (const x of [-6, 6]) P.add(kotak(0.5, 0.6, 22.5, 0x9aa0a6, x, 9, 0));
  for (const z of [-11, 11]) P.add(kotak(12.5, 0.6, 0.5, 0x9aa0a6, 0, 9, z));
  const atap = kotak(13.5, 0.3, 23.5, 0x22262b, 0, 9.5, 0); P.add(atap);
  // latar belakang berspanduk
  P.add(kotak(0.4, 7.4, 22, 0x1d1d22, 5.8, 5.0, 0));
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(20, 5.6), new THREE.MeshBasicMaterial({ map: teksPapan("PANGGUNG RAKYAT", "Malam Seni Negara Merdu", ["#7a1f1f", "#c8102e"], 20, 5.6) }));
  sp.rotation.y = -Math.PI / 2; sp.position.set(5.55, 5.2, 0); P.add(sp);
  // lampu sorot warna-warni di truss depan
  const WL = [0xff3355, 0x33aaff, 0xffd23f, 0x44ff88, 0xff66dd, 0x33aaff];
  WL.forEach((w, i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: w, emissiveIntensity: 1 }));
    m.rotation.z = Math.PI / 2 - 0.5; m.position.set(-6, 8.4, -9 + i * 3.6); P.add(m); LAMPU_PANGGUNG.push({ m, fase: i * 1.1 }); });
  // pengeras suara
  for (const z of [-13, 13]) { P.add(kotak(1.6, 3.6, 1.6, 0x15171a, -6.5, 1.8, z)); P.add(kotak(1.3, 1.4, 1.3, 0x15171a, -6.5, 4.3, z));
    for (const y of [1.2, 2.6, 4.3]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), M(0x444a50)); c.rotation.y = -Math.PI / 2; c.position.set(-7.32, y, z); P.add(c); } }
  // band: penyanyi + gitaris + drummer
  const drum = new THREE.Group(); drum.position.set(2.5, 1.42, 0); P.add(drum);
  for (const [x, z, r, h] of [[0.6, 0, 0.6, 0.6], [-0.2, -0.9, 0.3, 0.3], [-0.2, 0.9, 0.3, 0.3]]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), M(0xc8102e)); d.position.set(x, h / 2 + 0.4, z); drum.add(d); }
  const simbal = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 0.7, roughness: 0.3 })); simbal.position.set(-0.4, 1.7, 1.4); drum.add(simbal);
  const tiangMik = kotak(0.05, 1.5, 0.05, 0x222222, -3.2, 2.1, 0); P.add(tiangMik);
  const yP = Y0 + 1.42;
  const penyanyi = orang(g, 1, cx - 2.6, cz, -Math.PI / 2, "penyanyi"); penyanyi.position.y = yP;
  const gitaris = orang(g, 4, cx - 1.6, cz - 4.5, -Math.PI / 2 - 0.3, "gitaris"); gitaris.position.y = yP;
  const gitar = kotak(0.9, 0.35, 0.12, 0x9c5a2a, 0, 1.05, 0.32); gitar.rotation.z = 0.5; gitaris.add(gitar);
  const drummer = orang(g, 9, cx + 1.4, cz, -Math.PI / 2, "drummer"); drummer.position.y = yP + 0.1;
  for (const o of ORANG.slice(-3)) o.y = o.kar.position.y;
  // penonton
  for (let i = 0; i < 14; i++) {
    const x = cx - 15 - (i % 3) * 2.6 - (i * 0.37 % 1), z = cz - 9 + Math.floor(i / 3) * 4.2 + (i % 2) * 1.2;
    orang(g, i + 11, x, z, Math.PI / 2 + Math.sin(i) * 0.2, "penonton", { y: Y0 });
  }
  rint({ minX: cx - 7.5, maxX: cx + 6.3, minZ: cz - 14, maxZ: cz + 14 });
}

/* ---------- kolam air mancur menari (barat) ---------- */
function kolam(g, rint) {
  const cx = -85, cz = -22, W = 36, D = 16;
  const air = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, D), new THREE.MeshStandardMaterial({ color: 0x3e9cc4, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.9 }));
  air.position.set(cx, Y0 + 0.35, cz); g.add(air);
  g.add(kotak(W, 0.12, D, 0x2a6f8e, cx, Y0 + 0.08, cz));
  for (const s of [-1, 1]) { g.add(kotak(W + 1.2, 0.7, 0.6, 0xe8e0cc, cx, Y0 + 0.35, cz + s * (D / 2 + 0.3))); g.add(kotak(0.6, 0.7, D, 0xe8e0cc, cx + s * (W / 2 + 0.3), Y0 + 0.35, cz)); }
  const matJet = new THREE.MeshStandardMaterial({ color: 0xe6f6ff, emissive: 0x88ccff, emissiveIntensity: 0.25, transparent: true, opacity: 0.75, roughness: 0.1 });
  const geoJet = new THREE.CylinderGeometry(0.12, 0.28, 1, 8); geoJet.translate(0, 0.5, 0);
  for (let i = 0; i < 9; i++) for (const r of [-1, 1]) {
    const x = cx - 14 + i * 3.5, z = cz + r * 3.2;
    const j = new THREE.Mesh(geoJet, matJet); j.position.set(x, Y0 + 0.4, z); g.add(j);
    const busa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), matJet); busa.position.set(x, Y0 + 1, z); g.add(busa);
    JET.push({ j, busa, i, r });
  }
  const pusatJet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.45, 1, 10), matJet); pusatJet.geometry.translate(0, 0.5, 0); pusatJet.position.set(cx, Y0 + 0.4, cz); g.add(pusatJet);
  JET.push({ j: pusatJet, busa: null, i: -1, r: 0 });
  rint({ minX: cx - W / 2 - 0.6, maxX: cx + W / 2 + 0.6, minZ: cz - D / 2 - 0.6, maxZ: cz + D / 2 + 0.6 });
  // anak-anak bermain kejar-kejaran (lingkaran) di timur kolam
  for (let i = 0; i < 5; i++) { const k = orang(g, i + 30, 0, 0, 0, "anak", { pusatX: -58, pusatZ: -26, rad: 4.5, sudut: (i / 5) * Math.PI * 2 }); k.scale.setScalar(0.68); }
}

/* ---------- taman bunga (barat, z 12..32) ---------- */
function tamanBunga(g) {
  const bunga = [], WB = [0xe63946, 0xf2c230, 0xff7eb6, 0xffffff, 0xb07cff, 0xff9f1c];
  for (const [bx, bz, bw, bd] of [[-110, 20, 14, 12], [-90, 22, 14, 14], [-70, 20, 14, 12]]) {
    g.add(kotak(bw + 1, 0.45, bd + 1, 0x8a5a3a, bx, Y0 + 0.22, bz));                       // bedeng tanah
    for (const s of [-1, 1]) { g.add(kotak(bw + 1.6, 0.8, 0.6, 0x3f8c3a, bx, Y0 + 0.4, bz + s * (bd / 2 + 0.8))); g.add(kotak(0.6, 0.8, bd + 1.6, 0x3f8c3a, bx + s * (bw / 2 + 0.8), Y0 + 0.4, bz)); } // pagar tanaman
    for (let a = 0; a < 7; a++) for (let b = 0; b < 6; b++) {
      const h = Math.sin(a * 12.9898 + b * 78.233 + bx) * 43758.5453; const f = h - Math.floor(h);
      bunga.push({ x: bx - bw / 2 + 1 + a * (bw - 2) / 6, z: bz - bd / 2 + 1 + b * (bd - 2) / 5, w: WB[Math.floor(f * WB.length)], s: 0.8 + f * 0.5 });
    }
  }
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), bunga.length);
  const c = new THREE.Color();
  bunga.forEach((b, i) => { _d.position.set(b.x, Y0 + 0.75, b.z); _d.scale.setScalar(b.s); _d.updateMatrix(); im.setMatrixAt(i, _d.matrix); im.setColorAt(i, c.setHex(b.w)); });
  im.castShadow = true; g.add(im);
  // beringin besar di sudut barat-daya taman
  for (const [x, z] of [[-122, 36], [-48, 36]]) {
    const p = new THREE.Group(); p.position.set(x, Y0, z); g.add(p);
    p.add(kotak(1.1, 4, 1.1, 0x6b4a2b, 0, 2, 0));
    for (const [dx, dy, dz, r] of [[0, 6, 0, 3.6], [2.4, 5.2, 1, 2.6], [-2.3, 5.4, -0.8, 2.6], [0.5, 7.6, -0.5, 2.4]]) { const d = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(0x3f8a3a)); d.position.set(dx, dy, dz); d.castShadow = true; p.add(d); }
  }
}

/* ---------- kuliner kaki lima (timur, z 12..40) ---------- */
function kuliner(g, rint) {
  const NAMA = ["Bakso", "Sate Ayam", "Es Teh", "Martabak", "Siomay", "Kopi"], WG = [0xc8102e, 0xe8943a, 0x2e9e5b, 0x7b2ff7, 0x1d5a8f, 0x6b4a2b];
  NAMA.forEach((n, i) => {
    const x = 56 + i * 12, z = 38, G = new THREE.Group(); G.position.set(x, Y0, z); G.rotation.y = Math.PI; g.add(G);
    G.add(kotak(3, 1.1, 1.4, WG[i], 0, 1.0, 0)); G.add(kotak(3.1, 0.08, 1.5, 0xf4f4f2, 0, 1.6, 0));
    const kaca = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.1), new THREE.MeshStandardMaterial({ color: 0xcfe8f2, transparent: true, opacity: 0.45 })); kaca.position.set(0, 2.0, 0); G.add(kaca);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.15, 12), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(s * 1.1, 0.4, 0.75); G.add(r); }
    G.add(kotak(0.08, 2.8, 0.08, 0x8a8f94, 0, 2.6, -0.4));
    const payung = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.8, 8), M(i % 2 ? 0xf2c230 : 0xe63946)); payung.position.set(0, 4.1, -0.4); payung.castShadow = true; G.add(payung);
    const papan = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: teksturPapanNama(n, "Kaki Lima Merdu") })); papan.position.set(0, 1.0, -0.72); papan.rotation.y = Math.PI; G.add(papan);
    orang(g, i + 40, x, z + 1.4, Math.PI, "pedagang");                              // pedagang di balik gerobak
    orang(g, i + 50, x + (i % 2 ? 0.7 : -0.6), z - 2.2, 0, "pembeli");               // pembeli antre
    if (i % 2 === 0) orang(g, i + 60, x - 0.4, z - 3.6, 0.15, "pembeli");
    rint({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 0.8, maxZ: z + 0.8 });
  });
  // meja payung + kursi
  for (let i = 0; i < 5; i++) {
    const x = 62 + i * 13, z = 22, T = new THREE.Group(); T.position.set(x, Y0, z); g.add(T);
    const meja = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 16), M(0xf4f4f2)); meja.position.y = 1.0; T.add(meja);
    T.add(kotak(0.12, 1.0, 0.12, 0x8a8f94, 0, 0.5, 0)); T.add(kotak(0.06, 2.6, 0.06, 0x8a8f94, 0, 2.2, 0));
    const p = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 10), M([0x2e9e5b, 0x1d5a8f, 0xe8943a][i % 3])); p.position.y = 3.6; p.castShadow = true; T.add(p);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; T.add(kotak(0.5, 0.5, 0.5, 0xa9743f, Math.cos(a) * 1.7, 0.25, Math.sin(a) * 1.7)); }
    orang(g, i + 70, x + 1.6, z + (i % 2 ? 1.2 : -1.2), -Math.PI / 2, "makan");
    rint({ minX: x - 1.2, maxX: x + 1.2, minZ: z - 1.2, maxZ: z + 1.2 });
  }
}

/* ---------- penjual balon + merpati (tengah) ---------- */
function tengah(g) {
  const bx = -14, bz = 36;
  orang(g, 80, bx, bz, 0.3, "balon");
  const WB = [0xe63946, 0xf2c230, 0x2e9e5b, 0x1d5a8f, 0xff7eb6, 0xb07cff, 0xff9f1c, 0xffffff];
  WB.forEach((w, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({ color: w, roughness: 0.3 }));
    b.scale.y = 1.2; const a = i / WB.length * Math.PI * 2, r = 0.6 + (i % 2) * 0.4;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r, oy = 4.4 + (i % 3) * 0.5;
    b.position.set(bx + ox, Y0 + oy, bz + oz); g.add(b);
    const tali = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, oy - 1.4, 3), M(0xdddddd)); tali.position.set(bx + ox / 2 + 0.35, Y0 + 1.4 + (oy - 1.4) / 2, bz + oz / 2); g.add(tali);
    BALON.push({ b, y: Y0 + oy, fase: i });
  });
  // kawanan merpati di pita tengah
  const N = 26;
  MERPATI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8e939c, roughness: 0.8 }), N);
  for (let i = 0; i < N; i++) {
    const h = Math.sin(i * 91.7) * 1e4, f = h - Math.floor(h);
    MERPATI_DATA.push({ x: -12 + f * 24, z: 14 + ((i * 37) % 17) * 0.8, rot: f * 6.28, fase: f * 10, vx: 0, vz: 0 });
  }
  MERPATI.castShadow = true; g.add(MERPATI);
}

/* ---------- umbul-umbul & lampu taman keliling ---------- */
function keliling(g) {
  const pos = [];
  const tambah = (x, z) => pos.push({ x, z });
  for (let x = -HW + 10; x <= HW - 10; x += 16) { if (Math.abs(x) > 12) tambah(x, HD - 1.4); if (Math.abs(x) > 44) tambah(x, -HD + 1.4); }
  for (let z = -HD + 10; z <= 40; z += 16) { if (Math.abs(z) > 10) { tambah(-HW + 1.4, z); tambah(HW + -1.4, z); } }
  const tiang = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 8, 6), M(0xc9a25a), pos.length);
  pos.forEach((p, i) => { _d.position.set(p.x, Y0 + 4, p.z); _d.rotation.set(0, 0, 0); _d.scale.set(1, 1, 1); _d.updateMatrix(); tiang.setMatrixAt(i, _d.matrix); });
  g.add(tiang);
  const geoBendera = new THREE.PlaneGeometry(0.9, 4.2); geoBendera.translate(0.45, -2.1, 0); // berpangkal di tepi kiri-atas
  UMBUL = new THREE.InstancedMesh(geoBendera, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), pos.length);
  const W = [0xc8102e, 0xf2c230, 0x2e9e5b, 0x1d5a8f, 0xffffff, 0xe8943a], c = new THREE.Color();
  pos.forEach((p, i) => { UMBUL.setColorAt(i, c.setHex(W[i % W.length])); UMBUL_DATA.push({ ...p, fase: i * 0.7 }); });
  g.add(UMBUL);
  // lampu taman
  const matKepala = LAMPU_TAMAN.mat || new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd27a, emissiveIntensity: 0.6 });
  for (const [x, z] of [[-45, 0], [45, 0], [-45, 40], [45, 40], [-120, -5], [120, -5], [-62, -40], [62, -40], [-120, 40], [120, 40], [0, 42], [-80, 4], [80, 4]]) {
    g.add(kotak(0.22, 4.2, 0.22, 0x2b3035, x, Y0 + 2.1, z));
    const kp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), matKepala); kp.position.set(x, Y0 + 4.5, z); g.add(kp);
  }
}

export function bangunPlazaRamai(pusat, rintanganPusat) {
  const g = new THREE.Group(); pusat.add(g);
  panggung(g, rintanganPusat); kolam(g, rintanganPusat); tamanBunga(g); kuliner(g, rintanganPusat); tengah(g); keliling(g);
  return g;
}

export function perbaruiPlazaRamai(dt, t) {
  for (const o of ORANG) {
    const k = o.kar, u = k.userData;
    if (o.jenis === "anak") {
      o.sudut += dt * 1.1; const nx = o.pusatX + Math.cos(o.sudut) * o.rad, nz = o.pusatZ + Math.sin(o.sudut) * o.rad;
      const jarak = Math.hypot(nx - k.position.x, nz - k.position.z);
      const bob = animasiJalan(k, jarak, dt); animasiHidup(k, t, false);
      k.position.set(nx, Y0 + bob * 0.08, nz); k.rotation.y = Math.atan2(-Math.sin(o.sudut), Math.cos(o.sudut));
      continue;
    }
    animasiHidup(k, t, true);
    if (o.jenis === "penonton") { // bergoyang & sesekali mengangkat tangan
      const b = Math.max(0, Math.sin(t * 4 + o.fase)); k.position.y = o.y + b * 0.18;
      if (u.lenganK && u.lenganR && Math.sin(t * 0.7 + o.fase) > 0.3) { u.lenganK.rotation.x = -2.6 + b * 0.3; u.lenganR.rotation.x = -2.6 + b * 0.3; }
    } else if (o.jenis === "penyanyi") {
      k.rotation.y = -Math.PI / 2 + Math.sin(t * 0.9) * 0.4;
      if (u.lenganR) u.lenganR.rotation.x = -1.4 + Math.sin(t * 3) * 0.2; if (u.lenganK) u.lenganK.rotation.x = -0.4 + Math.sin(t * 1.5) * 0.5;
    } else if (o.jenis === "gitaris") {
      if (u.lenganR) u.lenganR.rotation.x = -0.9 + Math.sin(t * 12) * 0.25; k.position.y = o.y + Math.abs(Math.sin(t * 4)) * 0.06;
    } else if (o.jenis === "drummer") {
      if (u.lenganK) u.lenganK.rotation.x = -1.0 + Math.sin(t * 14) * 0.45; if (u.lenganR) u.lenganR.rotation.x = -1.0 + Math.sin(t * 14 + Math.PI) * 0.45;
    } else if (o.jenis === "pedagang") {
      if (u.lenganR) u.lenganR.rotation.x = -0.8 + Math.sin(t * 5 + o.fase) * 0.35;
    } else if (o.jenis === "makan") {
      if (u.lenganR) u.lenganR.rotation.x = -1.2 + Math.max(0, Math.sin(t * 2.2 + o.fase)) * -0.8;
    } else if (o.jenis === "balon") {
      if (u.lenganK) u.lenganK.rotation.x = -1.6;
    }
  }
  // air mancur menari: gelombang tinggi berjalan sepanjang kolam
  for (const J of JET) {
    const h = J.i < 0 ? 5 + Math.sin(t * 1.3) * 2.5 : 1.2 + Math.max(0, Math.sin(t * 2.2 - J.i * 0.6 + J.r * 1.2)) * 3.6;
    J.j.scale.y = h; if (J.busa) { J.busa.position.y = Y0 + 0.4 + h; J.busa.scale.setScalar(0.7 + h * 0.12); }
  }
  for (const L of LAMPU_PANGGUNG) L.m.material.emissiveIntensity = 0.3 + Math.max(0, Math.sin(t * 3 + L.fase)) * 1.4;
  for (const B of BALON) B.b.position.y = B.y + Math.sin(t * 1.4 + B.fase) * 0.12;
  if (UMBUL) {
    UMBUL_DATA.forEach((p, i) => { _d.position.set(p.x, Y0 + 7.9, p.z); _d.rotation.set(0, Math.sin(t * 1.6 + p.fase) * 0.5 + 0.6, Math.sin(t * 2.3 + p.fase) * 0.06); _d.scale.set(1, 1, 1); _d.updateMatrix(); UMBUL.setMatrixAt(i, _d.matrix); });
    UMBUL.instanceMatrix.needsUpdate = true;
  }
  if (MERPATI) {
    MERPATI_DATA.forEach((m, i) => {
      const patuk = Math.max(0, Math.sin(t * 6 + m.fase)) > 0.85 ? 0.08 : 0;
      if (Math.sin(t * 0.5 + m.fase) > 0.97) { m.x += Math.cos(m.rot) * dt * 1.5; m.z += Math.sin(m.rot) * dt * 1.5; }
      m.x = Math.max(-14, Math.min(14, m.x)); m.z = Math.max(12, Math.min(27, m.z));
      _d.position.set(m.x, Y0 + 0.22 - patuk, m.z); _d.rotation.set(0, m.rot, 0); _d.scale.set(1, 0.8, 1.5); _d.updateMatrix(); MERPATI.setMatrixAt(i, _d.matrix);
    });
    MERPATI.instanceMatrix.needsUpdate = true;
  }
}
