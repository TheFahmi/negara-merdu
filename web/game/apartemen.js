/* Negara Merdu — modul game "apartemen": APARTEMEN yang bisa dimasuki.
   Eksterior: 4 menara apartemen 10 lantai di lahan dekat pusat kota
   (APARTEMEN_BLOK) — fasad berjendela & balkon (menyala malam), lobi kaca
   berkanopi, atap dengan tandon air, kolam renang, parkir bermobil, taman.
   Interior (pola INT seperti rumah/istana — dibangun di bawah peta):
     LOBI   : resepsionis, sofa tunggu, kotak surat, LIFT di dinding utara
     LIFT   : kabin bisa dimasuki; pilih lantai -> ANIMASI: pintu geser
              menutup, layar lantai berhitung naik/turun + kabin bergetar
              halus, ding, pintu membuka di lantai tujuan
     KORIDOR: lantai 1..10, 6 pintu unit bernomor (L01..L06) + lift
     UNIT   : kamar apartemen — ruang tamu, dapur, kamar tidur bersekat,
              jendela kaca besar berpemandangan kota, balkon
   Keluar gedung hanya dari lobi (pintu selatan) atau tombol Keluar. */
import { $, APARTEMEN_BLOK, hashInt, sudutBlok, JALAN, PITCH } from "./inti.js";
import { M, kotak, scene, wkt } from "./bersama.js";
import { bangkuTaman, pagarSemak, pohonKecil, teksturPapanNama } from "./fasilitas.js";
import { WARNA_MOBIL } from "./kendaraan.js";

export const JUMLAH_LANTAI = 10;
export const apartemenKlik = [];        // grup menara (diketuk = kartu "Masuk Apartemen")
export const pintuApartemen = [];       // titik pintu lobi dunia {x, z, data}
const MAT_JENDELA_APT = [];             // material fasad bercahaya malam

/* ================= EKSTERIOR ================= */
function kanvasFasad() { // 1 ubin = 1 lantai x 2 bay: jendela + balkon berpagar
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
  const c = cv.getContext("2d");
  c.fillStyle = "#eee6d6"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#d9cfbb"; c.fillRect(0, 116, 256, 12); // pelat lantai
  for (const bx of [12, 140]) {
    c.fillStyle = "#3d5566"; c.fillRect(bx, 18, 104, 80);           // kaca
    c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(bx + 6, 22, 30, 72);
    c.fillStyle = "#e9e3d6"; c.fillRect(bx + 50, 18, 5, 80);        // kusen tengah
    c.fillStyle = "#8a8f94"; c.fillRect(bx - 4, 82, 112, 5);        // pagar balkon
    for (let i = 0; i < 9; i++) c.fillRect(bx - 2 + i * 13, 86, 3, 26);
    c.fillStyle = "#c8bfae"; c.fillRect(bx - 6, 110, 116, 6);       // lantai balkon
  }
  return cv;
}
function kanvasFasadMalam() { // emissive: jendela sebagian menyala hangat
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
  const c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, 256, 128);
  c.fillStyle = "#ffd58a"; c.fillRect(12, 18, 104, 66); c.fillStyle = "#ffcf7a"; c.fillRect(140, 18, 104, 66);
  return cv;
}
function bangunMenara(g, data) {
  const W = 22, D = 16, TL = 3.2, TLOBI = 4.6, H = TLOBI + JUMLAH_LANTAI * TL;
  const texF = new THREE.CanvasTexture(kanvasFasad()), texM = new THREE.CanvasTexture(kanvasFasadMalam());
  for (const t of [texF, texM]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  const matF = (rx) => {
    const a = texF.clone(), b = texM.clone(); a.needsUpdate = b.needsUpdate = true;
    a.repeat.set(rx, JUMLAH_LANTAI); b.repeat.set(rx, JUMLAH_LANTAI);
    const m = new THREE.MeshStandardMaterial({ map: a, emissive: 0xffffff, emissiveMap: b, emissiveIntensity: 0, roughness: 0.7 });
    MAT_JENDELA_APT.push(m); return m;
  };
  const polos = M(0xe6dccb);
  const badan = new THREE.Mesh(new THREE.BoxGeometry(W, JUMLAH_LANTAI * TL, D),
    [matF(D / 8), matF(D / 8), polos, polos, matF(W / 8), matF(W / 8)]);
  badan.position.set(0, TLOBI + JUMLAH_LANTAI * TL / 2, -6); badan.castShadow = true; badan.receiveShadow = true; g.add(badan);
  // lantai dasar: lobi kaca + kolom
  g.add(kotak(W + 1, 0.5, D + 1, 0xcfc6b0, 0, 0.25, -6));
  g.add(kotak(W - 1, TLOBI - 0.5, D - 1, 0x9fc9d8, 0, TLOBI / 2 + 0.25, -6)); // kaca lobi
  for (const x of [-W / 2, -W / 4, 0, W / 4, W / 2]) for (const z of [-6 - D / 2, -6 + D / 2]) g.add(kotak(0.8, TLOBI, 0.8, 0xe6dccb, x, TLOBI / 2, z));
  g.add(kotak(W + 0.6, 0.6, D + 0.6, 0xd9cfbb, 0, TLOBI, -6));
  // kanopi pintu + papan nama + pintu kaca
  g.add(kotak(9, 0.4, 5, 0x2f3b45, 0, 4.0, 4.4)); for (const s of [-1, 1]) g.add(kotak(0.3, 4, 0.3, 0x2f3b45, s * 4.2, 2, 6.6));
  g.add(kotak(3.6, 3.2, 0.2, 0x2f3b45, 0, 1.85, 2.05)); g.add(kotak(1.6, 3.0, 0.24, 0xbfe2ee, -0.85, 1.75, 2.08)); g.add(kotak(1.6, 3.0, 0.24, 0xbfe2ee, 0.85, 1.75, 2.08));
  const papan = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama.toUpperCase(), "Apartemen · " + JUMLAH_LANTAI + " lantai"), roughness: 0.8 }));
  papan.position.set(0, 4.85, 6.85); g.add(papan);
  // atap: parapet, tandon, ruang mesin lift, AC
  const yA = H;
  g.add(kotak(W + 0.4, 1.1, D + 0.4, 0xd9cfbb, 0, yA + 0.55, -6));
  g.add(kotak(W - 1, 0.2, D - 1, 0x8a8f94, 0, yA + 0.15, -6));
  g.add(kotak(5, 3, 4, 0xe6dccb, -5, yA + 1.5, -9)); // ruang mesin lift
  for (const x of [5, 8]) { const tn = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 16), M(0x5b88a8)); tn.position.set(x, yA + 1.6, -10); g.add(tn); }
  for (let i = 0; i < 4; i++) g.add(kotak(1.2, 0.8, 1, 0xb8bcc2, -8 + i * 2.2, yA + 0.6, -1));
  return { W, D, H };
}
export function bangunApartemen() {
  const grup = new THREE.Group();
  for (const data of APARTEMEN_BLOK) {
    const s = sudutBlok(data.kol, data.bar);
    const cx = s.x + JALAN + (PITCH - JALAN) / 2, cz = s.z + JALAN + (PITCH - JALAN) / 2;
    const g = new THREE.Group(); g.position.set(cx, 0.245, cz); g.userData.apartemen = data;
    bangunMenara(g, data);
    pagarSemak(g, 33.6, { s: [[-5, 5]] });
    g.add(kotak(8, 0.1, 26, 0xcfc6b0, 0, 0.06, 20)); // jalan masuk
    // kolom renang + kursi berjemur (timur)
    g.add(kotak(13, 0.4, 8, 0xe9e2d3, 20, 0.2, 14));
    const air = new THREE.Mesh(new THREE.BoxGeometry(11, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x3fb5d8, roughness: 0.08 })); air.position.set(20, 0.42, 14); g.add(air);
    for (let i = 0; i < 3; i++) { g.add(kotak(0.9, 0.3, 2, 0xffffff, 15.5 + i * 3, 0.5, 20.5)); }
    const payung = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.6, 8), M(0xe86a5e)); payung.position.set(26, 2.6, 20.5); g.add(payung);
    g.add(kotak(0.08, 2.4, 0.08, 0x7a4a21, 26, 1.2, 20.5));
    // parkir + mobil (barat)
    g.add(kotak(12, 0.08, 22, 0x5c6066, -20, 0.06, 14));
    for (let i = 0; i < 6; i++) {
      g.add(kotak(5, 0.1, 0.15, 0xf4f1e6, -23, 0.07, 4.2 + i * 3.6)); g.add(kotak(5, 0.1, 0.15, 0xf4f1e6, -17, 0.07, 4.2 + i * 3.6));
      if (hashInt(data.kol * 7 + i) > 0.3) { // mobil penghuni
        const m = new THREE.Group(), w = WARNA_MOBIL[(i + data.kol) % WARNA_MOBIL.length];
        m.add(kotak(4.2, 0.7, 1.9, w, 0, 0.7, 0)); m.add(kotak(2.3, 0.65, 1.7, w, -0.2, 1.35, 0)); m.add(kotak(2.0, 0.5, 1.75, 0x24323d, -0.2, 1.37, 0));
        m.position.set(i % 2 ? -23 : -17, 0, 6 + i * 3.6); g.add(m);
      }
    }
    for (const [x, z] of [[-30, -30], [-30, -15], [30, -30], [30, -15], [-12, 30], [12, 30], [30, 28], [-30, 28]]) g.add(pohonKecil(x, z, 1.0));
    g.add(bangkuTaman(-8, 14, Math.PI / 2)); g.add(bangkuTaman(8, 14, -Math.PI / 2));
    grup.add(g); apartemenKlik.push(g);
    pintuApartemen.push({ x: cx, z: cz + 4.6, data });
  }
  scene.add(grup);
  return grup;
}
/* Tapak tabrakan menara (dunia) — dipanggil pemanggil untuk rintanganFasilitas. */
export function tapakApartemen() {
  return APARTEMEN_BLOK.map((d) => {
    const s = sudutBlok(d.kol, d.bar), cx = s.x + JALAN + (PITCH - JALAN) / 2, cz = s.z + JALAN + (PITCH - JALAN) / 2;
    return { minX: cx - 11.5, maxX: cx + 11.5, minZ: cz - 14.5, maxZ: cz + 2.2 };
  });
}
export function perbaruiApartemenLuar() {
  const malam = Math.min(1, Math.max(0, (wkt.jendela || 0) / 2.2));
  for (const m of MAT_JENDELA_APT) m.emissiveIntensity = malam * 1.1;
}

/* ================= INTERIOR (lobi / koridor / unit) + LIFT ================= */
const LIFT = { x: 0, lebar: 3.2, dalam: 3.0 };   // kabin di balik dinding utara (lokal ruang)
export const AP = {                               // keadaan apartemen yang sedang dikunjungi
  data: null, mode: "lobi", lantai: 0, unit: 0, goyang: 0, ruang: null,
  lift: { buka: 1, sasaranBuka: 1, keadaan: "diam", lantaiTujuan: 0, waktu: 0, tampil: 0 },
  pintuKiri: null, pintuKanan: null, layar: [], kanvasLayar: null, texLayar: null,
};
function gambarLayar(teks, arah) {
  const c = AP.kanvasLayar.getContext("2d");
  c.fillStyle = "#0b0f12"; c.fillRect(0, 0, 128, 64);
  c.fillStyle = "#ff9b3b"; c.font = "bold 40px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText((arah > 0 ? "▲" : arah < 0 ? "▼" : "") + teks, 64, 34);
  AP.texLayar.needsUpdate = true;
}
const labelLantai = (l) => (l === 0 ? "L" : String(l));

/* Bangun satu "ruang" apartemen: mengembalikan {grup, sw, sd, halang[]}. */
function ruangDasar(sw, sd, T, warnaDinding, warnaLantai, pintuSelatan, denganLift = true) {
  const g = new THREE.Group(), daftar = [];
  const halang = (a, b, c, d) => daftar.push([a, b, c, d]); halang.daftar = daftar;
  const K = (l, t, d, w, x, y, z) => { const m = kotak(l, t, d, w, x, y, z); m.castShadow = false; g.add(m); return m; };
  K(sw * 2 + 0.8, 0.3, sd * 2 + 0.8, warnaLantai, 0, -0.15, 0);
  K(sw * 2 + 0.8, 0.3, sd * 2 + 0.8, 0xf6f2ea, 0, T + 0.15, 0);
  if (!denganLift) { // ruang tanpa lift (unit): dinding utara utuh
    K(sw * 2 + 0.8, T, 0.4, warnaDinding, 0, T / 2, -sd - 0.2);
    K(0.4, T, sd * 2 + 0.8, warnaDinding, -sw - 0.2, T / 2, 0);
    K(0.4, T, sd * 2 + 0.8, warnaDinding, sw + 0.2, T / 2, 0);
    const s2 = sw - 1.2;
    K(s2, T, 0.4, warnaDinding, -(1.2 + s2 / 2), T / 2, sd + 0.2); K(s2, T, 0.4, warnaDinding, 1.2 + s2 / 2, T / 2, sd + 0.2);
    K(2.4, T - 2.8, 0.4, warnaDinding, 0, (2.8 + T) / 2, sd + 0.2);
    AP.pintuKiri = AP.pintuKanan = null;
    g.add(new THREE.HemisphereLight(0xfffaf0, 0x8a8070, 0.6));
    return { g, K, halang };
  }
  // dinding utara berlubang lift (lebar LIFT.lebar)
  const sisi = (sw * 2 + 0.8 - LIFT.lebar) / 2;
  K(sisi, T, 0.4, warnaDinding, -(LIFT.lebar / 2 + sisi / 2), T / 2, -sd - 0.2);
  K(sisi, T, 0.4, warnaDinding, LIFT.lebar / 2 + sisi / 2, T / 2, -sd - 0.2);
  K(LIFT.lebar, T - 3.0, 0.4, warnaDinding, 0, (3.0 + T) / 2, -sd - 0.2);
  K(0.4, T, sd * 2 + 0.8, warnaDinding, -sw - 0.2, T / 2, 0);
  K(0.4, T, sd * 2 + 0.8, warnaDinding, sw + 0.2, T / 2, 0);
  if (pintuSelatan) {
    const s2 = sw - 1.2;
    K(s2, T, 0.4, warnaDinding, -(1.2 + s2 / 2), T / 2, sd + 0.2); K(s2, T, 0.4, warnaDinding, 1.2 + s2 / 2, T / 2, sd + 0.2);
    K(2.4, T - 2.8, 0.4, warnaDinding, 0, (2.8 + T) / 2, sd + 0.2);
  } else K(sw * 2 + 0.8, T, 0.4, warnaDinding, 0, T / 2, sd + 0.2);
  // lis bawah
  K(sw * 2, 0.18, 0.08, 0x8a8f94, 0, 0.09, -sd + 0.04); K(0.08, 0.18, sd * 2, 0x8a8f94, -sw + 0.04, 0.09, 0); K(0.08, 0.18, sd * 2, 0x8a8f94, sw - 0.04, 0.09, 0);
  // kabin lift (di balik dinding utara): lantai, dinding, pegangan, cermin, panel tombol
  const zc = -sd - 0.4 - LIFT.dalam / 2;
  K(LIFT.lebar, 0.3, LIFT.dalam, 0x6e6a64, 0, -0.15, zc);
  K(LIFT.lebar, 0.3, LIFT.dalam, 0xd8d8d8, 0, 3.15, zc);
  K(0.2, 3.0, LIFT.dalam, 0xa7adb3, -LIFT.lebar / 2 - 0.1, 1.5, zc); K(0.2, 3.0, LIFT.dalam, 0xa7adb3, LIFT.lebar / 2 + 0.1, 1.5, zc);
  K(LIFT.lebar, 3.0, 0.2, 0xa7adb3, 0, 1.5, zc - LIFT.dalam / 2 - 0.1);
  K(LIFT.lebar - 0.6, 1.8, 0.05, 0xdfe9ee, 0, 1.7, zc - LIFT.dalam / 2 + 0.02); // cermin
  for (const s of [-1, 1]) K(0.06, 0.06, LIFT.dalam - 0.4, 0xd9a441, s * (LIFT.lebar / 2 - 0.05), 1.0, zc);
  K(0.06, 0.8, 0.4, 0x2f3b45, LIFT.lebar / 2 - 0.05, 1.3, -sd - 0.9); // panel tombol dalam kabin
  const lampu = new THREE.Mesh(new THREE.BoxGeometry(LIFT.lebar - 0.6, 0.05, LIFT.dalam - 0.6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 1 }));
  lampu.position.set(0, 3.0, zc); g.add(lampu);
  // bingkai pintu lift + 2 daun pintu geser (animasi) + layar lantai (luar & dalam)
  K(LIFT.lebar + 0.6, 0.35, 0.5, 0xb8bcc2, 0, 3.15, -sd + 0.05);
  for (const s of [-1, 1]) K(0.3, 3.0, 0.5, 0xb8bcc2, s * (LIFT.lebar / 2 + 0.15), 1.5, -sd + 0.05);
  const matPintu = new THREE.MeshStandardMaterial({ color: 0xc9ced3, roughness: 0.25, metalness: 0.6 });
  AP.pintuKiri = new THREE.Mesh(new THREE.BoxGeometry(LIFT.lebar / 2, 2.95, 0.12), matPintu);
  AP.pintuKanan = new THREE.Mesh(new THREE.BoxGeometry(LIFT.lebar / 2, 2.95, 0.12), matPintu);
  AP.pintuKiri.position.set(-LIFT.lebar / 4, 1.48, -sd - 0.05); AP.pintuKanan.position.set(LIFT.lebar / 4, 1.48, -sd - 0.05);
  g.add(AP.pintuKiri); g.add(AP.pintuKanan);
  AP.kanvasLayar = document.createElement("canvas"); AP.kanvasLayar.width = 128; AP.kanvasLayar.height = 64;
  AP.texLayar = new THREE.CanvasTexture(AP.kanvasLayar);
  const matLayar = new THREE.MeshBasicMaterial({ map: AP.texLayar });
  const layarLuar = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), matLayar); layarLuar.position.set(0, 3.6, -sd + 0.02); g.add(layarLuar);
  const layarDalam = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), matLayar); layarDalam.rotation.y = Math.PI; layarDalam.position.set(0, 2.65, -sd - 0.45); g.add(layarDalam);
  K(0.3, 0.5, 0.08, 0x2f3b45, LIFT.lebar / 2 + 0.7, 1.3, -sd + 0.04); // tombol panggil di luar
  const tombol = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffb347, emissiveIntensity: 1 }));
  tombol.position.set(LIFT.lebar / 2 + 0.7, 1.35, -sd + 0.09); g.add(tombol);
  g.add(new THREE.HemisphereLight(0xfffaf0, 0x8a8070, 0.6));
  return { g, K, halang };
}
function lampuPlafon(g, x, z, T, terang) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 1.2 }));
  p.position.set(x, T - 0.05, z); g.add(p);
  const l = new THREE.PointLight(0xffe8c4, terang || 0.6, 22, 2); l.position.set(x, T - 0.6, z); g.add(l);
}
function sofa(K, x, z, ry, warna) {
  const g = new THREE.Group(), k = (a, b, c, w, px, py, pz) => { const m = kotak(a, b, c, w, px, py, pz); m.castShadow = false; g.add(m); };
  k(2.6, 0.5, 1.0, warna, 0, 0.25, 0); k(2.6, 0.8, 0.25, warna, 0, 0.8, -0.38); k(0.25, 0.65, 1.0, warna, -1.3, 0.55, 0); k(0.25, 0.65, 1.0, warna, 1.3, 0.55, 0);
  g.position.set(x, 0, z); g.rotation.y = ry; return g;
}
function bangunLobi(data) {
  const sw = 12, sd = 9, T = 5;
  const { g, K, halang } = ruangDasar(sw, sd, T, 0xf1ece2, 0xd8d2c6, true);
  // lantai marmer pola + karpet masuk
  K(4, 0.04, 6, 0x6b3e1f, 0, 0.02, 5.5);
  // resepsionis (barat)
  K(1.2, 1.2, 5, 0x5a3a20, -8.5, 0.6, -1); K(1.4, 0.08, 5.2, 0xd9a441, -8.5, 1.24, -1); halang(-9.2, -7.8, -3.6, 1.6);
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama.toUpperCase(), "Selamat datang"), roughness: 0.8 }));
  papan.rotation.y = Math.PI / 2; papan.position.set(-sw + 0.05, 3.3, -1); g.add(papan);
  // ruang tunggu (timur): 2 sofa + meja + tanaman
  g.add(sofa(K, 8.5, -1.5, -Math.PI / 2, 0x2f6f5a)); g.add(sofa(K, 8.5, 2.5, -Math.PI / 2, 0x2f6f5a));
  K(1.2, 0.45, 2.4, 0x5a3a20, 6.6, 0.23, 0.5); halang(7.8, 10.6, -3, 4);
  for (const [x, z] of [[-10.6, -7.6], [10.6, -7.6], [10.6, 7.6], [-10.6, 7.6]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.8, 12), M(0x2f3b45)); pot.position.set(x, 0.4, z); g.add(pot);
    const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), M(0x3f8f4f)); d.position.set(x, 1.5, z); g.add(d);
    halang(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  }
  // kotak surat di dinding utara kiri lift
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) K(0.55, 0.45, 0.12, 0xb8bcc2, -8 + c * 0.6, 1.0 + r * 0.5, -sd + 0.06);
  lampuPlafon(g, -5, 0, T, 0.6); lampuPlafon(g, 5, 0, T, 0.6);
  return { g, sw, sd, T, halang, pintuSelatan: true };
}
function bangunKoridor(lantai) {
  const sw = 14, sd = 3.4, T = 3.6;
  const { g, K, halang } = ruangDasar(sw, sd, T, 0xece5d8, 0x8f7a63, false);
  K(sw * 2 - 1, 0.03, 2.2, 0x7a2f2f, 0, 0.02, 0); // karpet lorong
  const pintu = [];
  const xs = [-10, -5, 5, 10];
  xs.forEach((x, i) => { // pintu unit di dinding selatan
    K(1.6, 2.6, 0.1, 0x6b3e1f, x, 1.3, sd - 0.05); K(0.08, 0.08, 0.1, 0xd9a441, x + 0.55, 1.3, sd - 0.12);
    const no = lantai * 100 + i + 1;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: teksturNomor(no) }));
    pl.rotation.y = Math.PI; pl.position.set(x, 2.85, sd - 0.12); g.add(pl);
    pintu.push({ x, z: sd - 0.9, no });
  });
  for (const [i, x] of [[4, -10], [5, 10]]) { // 2 pintu unit di dinding utara
    K(1.6, 2.6, 0.1, 0x6b3e1f, x, 1.3, -sd + 0.05); K(0.08, 0.08, 0.1, 0xd9a441, x - 0.55, 1.3, -sd + 0.12);
    const no = lantai * 100 + i + 1;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.3), new THREE.MeshBasicMaterial({ map: teksturNomor(no) }));
    pl.position.set(x, 2.85, -sd + 0.12); g.add(pl);
    pintu.push({ x, z: -sd + 0.9, no });
  }
  const papanL = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: teksturNomor("LANTAI " + lantai) }));
  papanL.position.set(-3, 2.4, -sd + 0.03); g.add(papanL);
  for (const x of [-10, -3, 3, 10]) lampuPlafon(g, x, 0, T, 0.35);
  return { g, sw, sd, T, halang, pintu, pintuSelatan: false };
}
function teksturNomor(teks) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 112;
  const c = cv.getContext("2d"); c.fillStyle = "#2f3b45"; c.fillRect(0, 0, 256, 112);
  c.fillStyle = "#f6dd9a"; c.font = "bold 56px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(String(teks), 128, 58, 236); return new THREE.CanvasTexture(cv);
}
function teksturKota() { // pemandangan dari jendela unit: langit + siluet gedung
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, "#7db9e8"); g.addColorStop(1, "#f3e0bd"); c.fillStyle = g; c.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 26; i++) {
    const w = 18 + hashInt(i * 3) * 30, h = 40 + hashInt(i * 7) * 120, x = (i * 23) % 512;
    c.fillStyle = ["#9aa7b4", "#b5bcc4", "#8492a0", "#c9cfd6"][i % 4]; c.fillRect(x, 256 - h, w, h);
    c.fillStyle = "rgba(255,255,255,.35)"; for (let y = 256 - h + 6; y < 250; y += 10) c.fillRect(x + 3, y, w - 6, 3);
  }
  c.fillStyle = "#5fa04c"; c.fillRect(0, 236, 512, 20);
  return new THREE.CanvasTexture(cv);
}
function bangunUnit(no) {
  const sw = 9, sd = 7, T = 3.4;
  const { g, K, halang } = ruangDasar(sw, sd, T, 0xf3efe6, 0xc49a6c, true, false);
  const pemandangan = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.4), new THREE.MeshBasicMaterial({ map: teksturKota() }));
  for (const x of [-4.6, 4.6]) { // jendela kaca besar berpemandangan kota di dinding utara
    const p = pemandangan.clone(); p.position.set(x, 1.8, -sd + 0.03); g.add(p);
    K(6.2, 0.12, 0.2, 0x8a8f94, x, 3.05, -sd + 0.1); K(6.2, 0.12, 0.2, 0x8a8f94, x, 0.55, -sd + 0.1);
    for (const dx of [-3, 0, 3]) K(0.1, 2.5, 0.2, 0x8a8f94, x + dx, 1.8, -sd + 0.1);
  }
  // ruang tamu (barat): sofa, meja, TV, karpet
  K(5, 0.03, 3.6, 0xb5533c, -5, 0.02, -2); g.add(sofa(K, -5, -0.2, Math.PI, 0x4a6a8a)); halang(-6.5, -3.5, -0.8, 0.5);
  K(1.6, 0.4, 0.9, 0x5a3a20, -5, 0.2, -2.4);
  K(0.15, 1.1, 2.0, 0x1b1f22, -sw + 0.12, 1.6, -2.2); K(0.5, 0.6, 2.6, 0x5a3a20, -sw + 0.3, 0.3, -2.2); halang(-sw, -sw + 0.6, -3.5, -0.9);
  // dapur (barat daya): konter L + kulkas + kompor
  K(4, 0.95, 0.8, 0xe8e2d4, -6.5, 0.48, sd - 0.5); K(4.1, 0.06, 0.85, 0x2f3b45, -6.5, 0.98, sd - 0.5); halang(-8.6, -4.4, sd - 1, sd);
  K(0.9, 2.0, 0.8, 0xdfe3e6, -4.0, 1.0, sd - 0.5);
  K(0.6, 0.03, 0.5, 0x1b1f22, -7.5, 1.02, sd - 0.5);
  // sekat kamar tidur (timur) dengan bukaan pintu
  K(0.2, T, 5, 0xe9e2d4, 2, T / 2, -4.5); K(0.2, T, 2.6, 0xe9e2d4, 2, T / 2, 5.7);
  halang(1.9, 2.1, -7, -2); halang(1.9, 2.1, 4.4, 7);
  // kamar tidur: kasur, nakas, lemari, lampu
  K(2.6, 0.5, 3.4, 0x5a3a20, 6.5, 0.25, -4.5); K(2.4, 0.3, 3.2, 0xffffff, 6.5, 0.65, -4.5); K(2.45, 0.12, 2.0, 0x7a9cc6, 6.5, 0.85, -3.9);
  K(2.6, 1.2, 0.2, 0x5a3a20, 6.5, 0.9, -6.3); halang(5.1, 7.9, -6.6, -2.7);
  K(0.6, 0.6, 0.6, 0x8a5a30, 4.6, 0.3, -5.8);
  K(0.6, 2.4, 2.4, 0x8a5a30, sw - 0.35, 1.2, 3.5); halang(sw - 0.7, sw, 2.2, 4.8);
  // meja makan + kursi tengah
  K(1.6, 0.08, 1.0, 0x8a5a30, -1, 0.9, 3); for (const dx of [-0.6, 0.6]) K(0.08, 0.9, 0.9, 0x8a5a30, -1 + dx, 0.45, 3); halang(-1.9, -0.1, 2.4, 3.6);
  for (const dz of [-0.9, 0.9]) K(0.5, 0.5, 0.5, 0x2f6f5a, -1, 0.25, 3 + dz);
  // keset + nomor unit di dalam pintu
  K(1.6, 0.03, 0.8, 0x6b3e1f, 0, 0.02, sd - 0.6);
  lampuPlafon(g, -4.5, 0, T, 0.55); lampuPlafon(g, 6, -3, T, 0.4);
  const tumb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), M(0x3f8f4f)); tumb.position.set(-8.3, 1.2, -6.2); g.add(tumb);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.6, 12), M(0xb5533c)); pot.position.set(-8.3, 0.3, -6.2); g.add(pot);
  return { g, sw, sd, T, halang, pintuSelatan: true, tanpaLift: true };
}

/* ---- penyusun ruang aktif (dipanggil rumah.js lewat kait) ---- */
let kait = null; // { pasang(ruang), fp, INT, keluarKeJalan(), petunjuk(teks) }
export function setKaitApartemen(k) { kait = k; }
function pasangRuang(r) {
  kait.pasang(r);
  AP.ruang = r;
  const L = AP.lift; L.buka = L.sasaranBuka; perbaruiPintuLift();
  gambarLayar(labelLantai(AP.lantai), 0);
}
export function masukApartemenLobi(data) {
  AP.data = data; AP.mode = "lobi"; AP.lantai = 0;
  Object.assign(AP.lift, { buka: 0, sasaranBuka: 0, keadaan: "diam", lantaiTujuan: 0, waktu: 0 });
  pasangRuang(bangunLobi(data));
  kait.petunjuk(data.nama + " · Lobi · jalan ke LIFT di dinding utara · keluar lewat pintu selatan");
}
function pindahKe(mode, lantai, unit) {
  AP.mode = mode; AP.lantai = lantai; AP.unit = unit || 0;
  const r = mode === "lobi" ? bangunLobi(AP.data) : mode === "koridor" ? bangunKoridor(lantai) : bangunUnit(unit);
  pasangRuang(r);
}
function perbaruiPintuLift() {
  if (!AP.pintuKiri) return;
  const b = AP.ruang && AP.ruang.tanpaLift ? 0 : AP.lift.buka, w = LIFT.lebar;
  AP.pintuKiri.position.x = -w / 4 - b * (w / 2 - 0.05);
  AP.pintuKanan.position.x = w / 4 + b * (w / 2 - 0.05);
}
/* Apakah titik (lokal ruang) di dalam kabin lift. */
export function diKabin(lx, lz) { return AP.ruang && !AP.ruang.tanpaLift && lz < -AP.ruang.sd - 0.3 && Math.abs(lx - LIFT.x) < LIFT.lebar / 2; }
/* Jepit gerak pemain (koordinat lokal ruang): dinding ruang + kabin lift bila pintu terbuka. */
export function jepitRuang(lx, lz) {
  const r = AP.ruang; if (!r) return { x: lx, z: lz };
  const terbuka = AP.lift.buka > 0.85 && !r.tanpaLift;
  const belakangKabin = -r.sd - 0.4 - LIFT.dalam + 0.55;
  if (diKabin(lx, lz)) {
    lx = Math.min(LIFT.lebar / 2 - 0.5, Math.max(-LIFT.lebar / 2 + 0.5, lx));
    lz = Math.max(belakangKabin, Math.min(terbuka ? r.sd - 0.75 : -r.sd - 0.45, lz));
    return { x: lx, z: lz };
  }
  lx = Math.min(r.sw - 0.75, Math.max(-r.sw + 0.75, lx));
  const bisaMasukKabin = terbuka && Math.abs(lx) < LIFT.lebar / 2 - 0.5;
  lz = Math.min(r.sd - 0.75, Math.max(bisaMasukKabin ? belakangKabin : -r.sd + 0.75, lz));
  return { x: lx, z: lz };
}
/* Tombol aksi kontekstual di dalam apartemen. Mengembalikan {teks, tombol, aksi} atau null. */
export function aksiApartemen(lx, lz) {
  const r = AP.ruang; if (!r) return null;
  const L = AP.lift;
  if (L.keadaan !== "diam") return { teks: "Lift bergerak…", tombol: null };
  if (diKabin(lx, lz)) return { teks: "Di dalam lift · Lantai " + labelLantai(AP.lantai), tombol: "Pilih lantai", aksi: bukaPanelLantai };
  if (!r.tanpaLift && lz < -r.sd + 2.2 && Math.abs(lx) < 2.6 && L.buka < 0.5)
    return { teks: "Lift", tombol: "Panggil lift", aksi: () => { L.sasaranBuka = 1; L.keadaan = "buka"; } };
  if (AP.mode === "koridor") for (const p of r.pintu) if (Math.hypot(lx - p.x, lz - p.z) < 1.6)
    return { teks: "Unit " + p.no, tombol: "Masuk unit", aksi: () => masukUnit(p) };
  if (AP.mode === "unit" && lz > r.sd - 1.6 && Math.abs(lx) < 1.8)
    return { teks: "Pintu unit " + AP.unit, tombol: "Ke koridor", aksi: () => { const u = AP.unit; pindahKe("koridor", AP.lantai); taruh(korPintu(u)); } };
  if (AP.mode === "lobi" && lz > r.sd - 1.5 && Math.abs(lx) < 1.8) return { teks: "Pintu keluar gedung", tombol: "Keluar", aksi: () => kait.keluarKeJalan() };
  return null;
}
function korPintu(no) { const i = (no % 100) - 1; const xs = [-10, -5, 5, 10, -10, 10]; return { x: xs[i], z: i < 4 ? 3.4 - 1.3 : -3.4 + 1.3, yaw: i < 4 ? 0 : Math.PI }; }
function taruh(p) { kait.fp.x = kait.INT.x + p.x; kait.fp.z = kait.INT.z + p.z; if (p.yaw != null) kait.fp.yaw = p.yaw; }
export function masukUnit(p) {
  AP.lift.sasaranBuka = AP.lift.buka = 0;
  pindahKe("unit", AP.lantai, p.no);
  taruh({ x: 0, z: 7 - 1.6, yaw: 0 });
  kait.petunjuk("Unit " + p.no + " · " + AP.data.nama + " · keluar lewat pintu selatan ke koridor");
}
function bukaPanelLantai() {
  let html = "<h3>Lift · " + AP.data.nama + "</h3><p>Pilih lantai tujuan:</p><div class=\"panel-lift\">";
  for (let l = JUMLAH_LANTAI; l >= 0; l--) html += '<button type="button" data-lantai="' + l + '"' + (l === AP.lantai ? " disabled" : "") + ">" + labelLantai(l) + "</button>";
  $("#kartu .isi").innerHTML = html + "</div>";
  $("#kartu").hidden = false;
  $("#kartu .isi").querySelectorAll("[data-lantai]").forEach((b) => b.addEventListener("click", () => {
    $("#kartu").hidden = true; mulaiPerjalanan(+b.dataset.lantai);
  }));
}
export function mulaiPerjalanan(tujuan) {
  const L = AP.lift; if (L.keadaan !== "diam" || tujuan === AP.lantai) return;
  L.lantaiTujuan = tujuan; L.keadaan = "tutup"; L.sasaranBuka = 0; L.tampil = AP.lantai;
}
/* Animasi lift tiap frame. Mengembalikan goyang kamera (y) untuk efek kabin bergerak. */
export function perbaruiLift(dt) {
  const L = AP.lift; if (!AP.ruang) return 0;
  const lajuPintu = 1.3; // per detik
  if (L.buka !== L.sasaranBuka) {
    L.buka += Math.sign(L.sasaranBuka - L.buka) * Math.min(Math.abs(L.sasaranBuka - L.buka), lajuPintu * dt);
    perbaruiPintuLift();
  }
  if (L.keadaan === "buka" && L.buka >= 1) { L.keadaan = "diam"; }
  if (L.keadaan === "tutup" && L.buka <= 0) { L.keadaan = "jalan"; L.waktu = 0; }
  if (L.keadaan === "jalan") {
    L.waktu += dt;
    const arah = Math.sign(L.lantaiTujuan - AP.lantai);
    const per = 0.7, lantaiKini = AP.lantai + arah * Math.min(Math.abs(L.lantaiTujuan - AP.lantai), Math.floor(L.waktu / per));
    if (lantaiKini !== L.tampil) { L.tampil = lantaiKini; }
    gambarLayar(labelLantai(L.tampil), arah);
    kait.petunjuk("Lift " + (arah > 0 ? "naik ▲ " : "turun ▼ ") + "· lantai " + labelLantai(L.tampil));
    if (L.tampil === L.lantaiTujuan && L.waktu > per * Math.abs(L.lantaiTujuan - AP.lantai) + 0.4) { // tiba: bangun lantai tujuan di sekitar kabin, ding, buka
      const t = L.lantaiTujuan;
      const sdLama = AP.ruang.sd, lzLama = kait.fp.z - kait.INT.z; // posisi relatif kabin dipertahankan
      pindahKe(t === 0 ? "lobi" : "koridor", t);
      kait.fp.z = kait.INT.z + (-AP.ruang.sd + (lzLama + sdLama));
      L.buka = 0; L.sasaranBuka = 1; L.keadaan = "buka"; perbaruiPintuLift();
      gambarLayar(labelLantai(t), 0);
      kait.petunjuk(t === 0 ? AP.data.nama + " · Lobi" : AP.data.nama + " · Lantai " + t + " · pilih pintu unit");
      return 0;
    }
    AP.goyang = Math.sin(L.waktu * 26) * 0.012 + (L.waktu < 0.3 ? -0.03 * arah * (1 - L.waktu / 0.3) : 0); // getar + hentakan awal
    return AP.goyang;
  }
  AP.goyang = 0;
  return 0;
}
export function resetApartemen() { AP.ruang = null; AP.data = null; AP.pintuKiri = AP.pintuKanan = null; }
