/* Negara Merdu — modul game "gedungKaca": GEDUNG KANTOR & SEKOLAH dengan
   INTERIOR yang terlihat dari luar lewat kaca bening (permintaan Diah
   25 Nov 2026).

   Dibangun langsung di lahan berkala (GEDUNG_KACA_BLOK di inti.js), sama
   seperti apartemen — tidak mengubah alokasi rumah warga.
   - KANTOR: menara dinding tirai kaca (curtain wall) bening; tiap lantai
     berkarpet dengan meja kerja + monitor menyala + kursi, ruang rapat
     bersekat kaca, tanaman, lampu plafon panel; inti lift/tangga di tengah;
     lobi dengan resepsionis & sofa; pegawai duduk bekerja.
   - SEKOLAH: gedung 3 lantai memanjang dengan selasar; tiap kelas berjendela
     kaca besar: meja-kursi siswa berderet, papan tulis, meja guru, guru
     berdiri & siswa duduk; halaman: tiang bendera, lapangan basket, gerbang.
   Performa: semua benda statis interior digabung per gedung (gabungBerwarna)
   -> beberapa draw call per gedung; kaca 1 mesh transparan; layar & lampu 1
   mesh Basic. Interior + orang disembunyikan bila kamera jauh (> 320 m). */
import { GEDUNG_KACA_BLOK, JALAN, PITCH, SKALA_KARAKTER, sudutBlok } from "./inti.js";
import { M, camera, gabungBerwarna, kotak, scene } from "./bersama.js";
import { buatKarakter, animasiHidup, animasiJalan } from "./karakter.js";
import { SKALA_MOBIL, hashInt } from "./inti.js";
import { pohonKecil, teksturPapanNama } from "./fasilitas.js";

export const rintanganGedung = [];
const GEDUNG = []; // {g, dalam:[obj], orang:[{kar,...}], cx, cz}
const KACA = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.25, depthWrite: false });
const BAJU = ["#1d5a8f", "#ffffff", "#c8102e", "#2e9e5b", "#4a4a4a", "#e8943a", "#7b2ff7", "#f2c230"];

/* kumpulan potongan geometri berwarna -> 1 mesh */
function Kumpul() {
  const opak = [], nyala = [], kaca = [];
  return {
    b: (w, h, d, warna, x, y, z, ry) => opak.push({ geo: new THREE.BoxGeometry(w, h, d), x, y, z, ry: ry || 0, warna }),
    c: (r, h, warna, x, y, z) => opak.push({ geo: new THREE.CylinderGeometry(r, r, h, 10), x, y, z, warna }),
    s: (r, warna, x, y, z) => opak.push({ geo: new THREE.IcosahedronGeometry(r, 0), x, y, z, warna }),
    n: (w, h, d, warna, x, y, z, ry) => nyala.push({ geo: new THREE.BoxGeometry(w, h, d), x, y, z, ry: ry || 0, warna }),
    k: (w, h, d, x, y, z) => kaca.push({ geo: new THREE.BoxGeometry(w, h, d), x, y, z, warna: 0xffffff }),
    jadi(g) {
      const o = new THREE.Mesh(gabungBerwarna(opak), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
      o.castShadow = true; o.receiveShadow = true; g.add(o);
      const nl = nyala.length ? new THREE.Mesh(gabungBerwarna(nyala), new THREE.MeshBasicMaterial({ vertexColors: true })) : null; if (nl) g.add(nl);
      const kc = kaca.length ? new THREE.Mesh(gabungBerwarna(kaca), KACA) : null; if (kc) { kc.renderOrder = 2; g.add(kc); }
      return { o, nl, kc };
    },
  };
}
function duduk(kar) { const u = kar.userData; if (u.kakiK) { u.kakiK.rotation.x = -1.4; u.kakiR.rotation.x = -1.4; } }
function orang(G, g, i, x, y, z, ry, sit) {
  const k = buatKarakter({ baju: BAJU[i % BAJU.length], kulit: ["#f1c27d", "#c68642", "#e0ac69", "#8d5524"][(i * 5) % 4], topi: i % 5 === 2 ? "hijab" : "tanpa" });
  k.scale.setScalar(SKALA_KARAKTER); k.position.set(x, y, z); k.rotation.y = ry; k.userData.geserHidup = i * 0.7;
  if (sit) duduk(k);
  g.add(k); G.orang.push({ kar: k, sit, fase: i * 0.9 });
  return k;
}

/* ---------- isi halaman (biar tidak sepi) ---------- */
function pejalan(G, g, i, a, b, y) { const k = orang(G, g, i, a.x, y === undefined ? 0.3 : y, a.z, 0, false); const p = G.orang[G.orang.length - 1]; p.jalur = { a, b }; p.s = hashInt(i * 7) * Math.hypot(b.x - a.x, b.z - a.z); p.arah = i % 2 ? 1 : -1; return k; }
function mobilParkir(g, x, z, ry, warna) {
  const m = new THREE.Group();
  m.add(kotak(1.9, 0.62, 4.2, warna, 0, 0.68, 0)); m.add(kotak(1.74, 0.62, 2.3, warna, 0, 1.3, -0.25)); m.add(kotak(1.78, 0.5, 2.0, 0x24323d, 0, 1.32, -0.25));
  for (const [wx, wz] of [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 12), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(wx, 0.37, wz); m.add(r); }
  for (const sx of [-0.62, 0.62]) { m.add(kotak(0.42, 0.16, 0.06, 0xfff3c8, sx, 0.78, 2.11)); m.add(kotak(0.42, 0.14, 0.06, 0xc0281d, sx, 0.8, -2.11)); }
  m.position.set(x, 0.3, z); m.rotation.y = ry; m.scale.setScalar(SKALA_MOBIL); g.add(m);
}
function motor(g, x, z, ry, warna) {
  const m = new THREE.Group(); m.add(kotak(0.35, 0.45, 1.5, warna, 0, 0.75, 0)); m.add(kotak(0.3, 0.15, 0.7, 0x1d1d1f, 0, 1.05, -0.2));
  for (const dz of [-0.62, 0.62]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 14), M(0x222222)); r.rotation.y = Math.PI / 2; r.position.set(0, 0.33, dz); m.add(r); }
  m.position.set(x, 0.3, z); m.rotation.y = ry; g.add(m);
}
function bangku(K, x, z, ry) { K.b(2.4, 0.12, 0.6, 0xa9743f, x, 0.75, z, ry); K.b(2.4, 0.5, 0.1, 0xa9743f, x - Math.sin(ry) * 0.28, 1.05, z - Math.cos(ry) * 0.28, ry); for (const d of [-1, 1]) K.b(0.1, 0.45, 0.5, 0x5f6b75, x + Math.cos(ry) * d, 0.52, z - Math.sin(ry) * d, ry); }
function gerobak(K, g, nama, x, z, warna) {
  K.b(2.6, 1.0, 1.2, warna, x, 1.1, z); K.b(2.7, 0.06, 1.3, 0xf4f4f2, x, 1.62, z); K.b(0.06, 2.4, 0.06, 0x8a8f94, x, 2.6, z - 0.4);
  const p = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 8), M(0xe63946)); p.position.set(x, 3.9, z - 0.4); g.add(p);
  for (const dx of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 12), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x + dx, 0.65, z + 0.65); g.add(r); }
  const pp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: teksturPapanNama(nama, "Kantin Halaman") })); pp.position.set(x, 1.1, z + 0.62); g.add(pp);
}
const WM = [0xd9462e, 0x3f6fb5, 0xf2f2ee, 0x2b2d30, 0x9aa0a6, 0xe8c268, 0x2e8b57];

/* ===================== KANTOR ===================== */
function kantor(G, g, data) {
  const L = data.lantai, H = 4.2, W = 30, D = 22, K = Kumpul();
  const dalam = Kumpul(); // interior (bisa disembunyikan jauh)
  // fondasi + atap + inti
  K.b(W + 4, 0.4, D + 4, 0x9aa0a6, 0, 0.2, 0);
  for (let f = 0; f <= L; f++) K.b(W, 0.35, D, 0xdfe3e6, 0, f * H + 0.4, 0);          // pelat lantai
  K.b(W + 0.6, 1.2, D + 0.6, 0x5f6b75, 0, L * H + 1.0, 0);                             // parapet atap
  K.b(7, 2.6, 5, 0x8a939b, 0, L * H + 1.9, 0);                                          // ruang mesin
  K.b(6, L * H, 5, 0xe9e2d3, 0, L * H / 2 + 0.4, -2);                                   // inti lift/tangga
  for (const x of [-W / 2, W / 2]) for (const z of [-D / 2, D / 2]) K.b(0.6, L * H, 0.6, 0x5f6b75, x, L * H / 2 + 0.4, z); // kolom sudut
  // mullion vertikal tiap 3 m + kaca tirai
  for (let f = 0; f < L; f++) {
    const y0 = f * H + 0.6, hh = H - 0.25;
    for (const sz of [-1, 1]) { K.k(W, hh, 0.06, 0, y0 + hh / 2, sz * D / 2); for (let x = -W / 2 + 3; x < W / 2; x += 3) K.b(0.12, hh, 0.14, 0x5f6b75, x, y0 + hh / 2, sz * D / 2); }
    for (const sx of [-1, 1]) { K.k(0.06, hh, D, sx * W / 2, y0 + hh / 2, 0); for (let z = -D / 2 + 3; z < D / 2; z += 3) K.b(0.14, hh, 0.12, 0x5f6b75, sx * W / 2, y0 + hh / 2, z); }
    K.b(W + 0.2, 0.3, 0.2, 0x5f6b75, 0, (f + 1) * H + 0.4, D / 2); K.b(W + 0.2, 0.3, 0.2, 0x5f6b75, 0, (f + 1) * H + 0.4, -D / 2);
    const lantai = f * H + 0.58;
    dalam.b(W - 0.4, 0.04, D - 0.4, f === 0 ? 0xd8cfc0 : [0x5b6b7a, 0x6b5b4b, 0x4f6b5b][f % 3], 0, lantai, 0); // karpet
    for (let x = -12; x <= 12; x += 6) for (const z of [-7, 6]) dalam.n(2.4, 0.06, 0.6, 0xfffbe8, x, (f + 1) * H + 0.18, z); // lampu panel
    if (f === 0) { // lobi
      dalam.b(6, 1.1, 1.4, 0x7a4a21, 0, lantai + 0.55, 6); dalam.b(6.2, 0.08, 1.6, 0xf4f4f2, 0, lantai + 1.14, 6);
      dalam.n(5, 1.2, 0.1, 0x1d5a8f, 0, lantai + 2.6, 0.55);                              // dinding logo menyala
      for (const x of [-9, 9]) { dalam.b(4, 0.5, 1.4, 0x2b3a4a, x, lantai + 0.25, 7); dalam.b(4, 0.8, 0.3, 0x2b3a4a, x, lantai + 0.65, 7.6); }
      for (const [x, z] of [[-13, 9], [13, 9], [-13, -9], [13, -9]]) { dalam.c(0.4, 0.6, 0xb5533c, x, lantai + 0.3, z); dalam.s(0.9, 0x3f8a3a, x, lantai + 1.2, z); }
      orang(G, g, 100 + data.kol, 0, lantai, 6.9, Math.PI, false);                         // resepsionis (berdiri di balik meja)
      continue;
    }
    // meja kerja berkelompok (2 baris x 4) di sisi depan & belakang inti
    let n = 0;
    for (const zr of [6.2, -8.2]) for (let x = -12; x <= 12; x += 3.2) {
      if (Math.abs(x) < 4 && zr < 0) continue; // jangan menembus inti
      dalam.b(2.6, 0.08, 1.3, 0xe8e2d6, x, lantai + 0.75, zr); dalam.b(0.08, 0.7, 1.2, 0x8a8f94, x - 1.2, lantai + 0.38, zr); dalam.b(0.08, 0.7, 1.2, 0x8a8f94, x + 1.2, lantai + 0.38, zr);
      dalam.n(0.7, 0.45, 0.05, (x + f) % 2 ? 0x6fc3ff : 0x9fe0b0, x, lantai + 1.05, zr - 0.45); dalam.b(0.75, 0.5, 0.04, 0x1b1d20, x, lantai + 1.05, zr - 0.48);
      dalam.b(0.6, 0.08, 0.6, 0x2b2d30, x, lantai + 0.5, zr + 0.85); dalam.b(0.6, 0.6, 0.08, 0x2b2d30, x, lantai + 0.85, zr + 1.15); dalam.c(0.04, 0.45, 0x8a8f94, x, lantai + 0.25, zr + 0.85);
      dalam.b(2.6, 0.9, 0.06, 0x8aa0b2, x, lantai + 1.0, zr - 0.7);                     // sekat meja
      if ((n++ + f) % 3 === 0) orang(G, g, f * 10 + n, x, lantai, zr + 0.85, Math.PI, true); // pegawai duduk menghadap monitor
    }
    // ruang rapat bersekat kaca (sudut timur-belakang)
    dalam.k(0.06, 2.8, 6, 9, lantai + 1.4, -3); dalam.k(6, 2.8, 0.06, 12, lantai + 1.4, 0);
    dalam.b(4, 0.08, 2, 0x7a4a21, 12, lantai + 0.75, -4); for (const dx of [-1.2, 0, 1.2]) for (const dz of [-1.4, 1.4]) dalam.b(0.5, 0.5, 0.5, 0x1d5a8f, 12 + dx, lantai + 0.3, -4 + dz);
    dalam.n(2.4, 1.3, 0.05, 0xffffff, 12, lantai + 1.8, -7.2);
    if (f % 2) { orang(G, g, f * 10 + 7, 11.2, lantai, -2.6, Math.PI, true); orang(G, g, f * 10 + 8, 12.8, lantai, -5.4, 0, true); }
    for (const [x, z] of [[-14, 10], [14, 10], [-14, -10]]) { dalam.c(0.35, 0.5, 0xb5533c, x, lantai + 0.25, z); dalam.s(0.75, 0x3f8a3a, x, lantai + 1.0, z); }
  }
  // papan nama di atap & pintu masuk
  const papan = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Gedung Perkantoran"), roughness: 0.8 }));
  papan.position.set(0, L * H + 3.2, D / 2 + 0.3); g.add(papan);
  K.b(6, 0.3, 4, 0x5f6b75, 0, 3.6, D / 2 + 2); for (const x of [-2.8, 2.8]) K.b(0.25, 3.4, 0.25, 0x5f6b75, x, 1.9, D / 2 + 3.8); // kanopi pintu
  K.b(10, 0.1, 22, 0xcfc6b0, 0, 0.06, D / 2 + 11);                                   // jalan masuk
  /* HALAMAN KANTOR: parkir mobil & motor, air mancur, taman berbangku, pos
     satpam + palang, tiang bendera, gerobak kopi, pegawai lalu-lalang. */
  K.b(16, 0.08, 24, 0x5c6066, -24, 0.3, 21); // parkir barat
  for (let i = 0; i < 6; i++) { K.b(6, 0.04, 0.15, 0xf4f1e6, -24, 0.36, 10.4 + i * 3.4); if (hashInt(data.kol * 3 + i) > 0.25) mobilParkir(g, -24, 12.1 + i * 3.4, Math.PI / 2, WM[(i + data.kol) % WM.length]); }
  for (let i = 0; i < 8; i++) motor(g, 22 + (i % 4) * 1.1, 16 + Math.floor(i / 4) * 2.4, 0, [0xc8102e, 0x1d1d1f, 0x3f6fb5][i % 3]);
  K.b(6.5, 0.15, 3, 0x8a8f94, 23.5, 0.32, 17.2); // lantai parkir motor
  K.c(3.2, 0.6, 0xd8d2c4, 12, 0.6, 22); const air = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0x3e9cc4, roughness: 0.1 })); air.position.set(12, 0.92, 22); g.add(air);
  K.c(0.35, 1.6, 0xd8d2c4, 12, 1.4, 22); const sembur = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0xdff4fa, transparent: true, opacity: 0.6 })); sembur.position.set(12, 2.6, 22); sembur.rotation.x = Math.PI; g.add(sembur);
  for (const [x, z, ry] of [[7, 27, 0], [17, 27, 0], [20, 22, -Math.PI / 2]]) bangku(K, x, z, ry);
  K.b(3, 2.6, 3, 0xf4f4f2, -8, 1.6, 31); K.b(3.6, 0.3, 3.6, 0x1d5a8f, -8, 3.05, 31); K.k(3.02, 1.0, 3.02, -8, 2.0, 31); // pos satpam
  K.b(0.2, 1.1, 0.2, 0xf2c230, -5, 0.85, 31.5); K.b(6, 0.14, 0.14, 0xc8102e, -2, 1.35, 31.5);
  for (const [x, w] of [[-3, 0xc8102e], [0, 0xffffff], [3, 0x1d5a8f]]) { K.c(0.08, 9, 0xdddddd, x - 10, 4.8, 14.5); K.b(1.6, 1, 0.05, w, x - 9.15, 8.6, 14.5); }
  gerobak(K, g, "Kopi Merdu", 24, 28, 0x6b4a2b);
  orang(G, g, 500 + data.kol, -8, 0.12, 30.3, 0, false);                                 // satpam
  orang(G, g, 510 + data.kol, 24, 0.12, 26.8, 0, false);                                 // penjual kopi
  for (let i = 0; i < 2; i++) orang(G, g, 520 + i + data.kol, 22.8 + i * 2.4, 0.12, 29.8, Math.PI, false); // pembeli kopi
  orang(G, g, 530 + data.kol, 7, 0.3, 27.25, 0, true); orang(G, g, 531 + data.kol, 17, 0.3, 27.25, 0, true); // duduk di bangku
  pejalan(G, g, 540 + data.kol, { x: -2, z: 33 }, { x: -2, z: D / 2 + 4 }, 0.12);
  pejalan(G, g, 541 + data.kol, { x: 2, z: D / 2 + 4 }, { x: 2, z: 33 }, 0.12);
  pejalan(G, g, 542 + data.kol, { x: -16, z: 14 }, { x: -6, z: 26 }, 0.12);
  pejalan(G, g, 543 + data.kol, { x: 18, z: 14 }, { x: 28, z: 32 }, 0.12);
  const statis = K.jadi(g), isi = dalam.jadi(g);
  G.dalam.push(isi.o, isi.nl, isi.kc);
  for (const [x, z] of [[-26, 26], [26, 26], [-26, -26], [26, -26], [-10, 26], [10, 26]]) g.add(pohonKecil(x, z, 1.1));
  return { W, D, statis };
}

/* ===================== SEKOLAH ===================== */
function sekolah(G, g, data) {
  const L = 3, H = 3.8, W = 52, D = 11, K = Kumpul(), dalam = Kumpul();
  const z0 = -14; // gedung di utara lahan, halaman di selatan
  K.b(W + 2, 0.4, D + 6, 0x9aa0a6, 0, 0.2, z0 + 1.5);
  for (let f = 0; f <= L; f++) { K.b(W, 0.3, D + 3, 0xe9e2d3, 0, f * H + 0.4, z0 + 1.5); if (f) K.b(W, 1.0, 0.15, 0xfdf3d8, 0, f * H + 0.95, z0 + D / 2 + 3); } // pelat + pagar selasar
  // atap pelana genteng
  const atap = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4, 1), M(0xb5533c)); atap.scale.set(W * 0.75, 3, (D + 4) * 0.75); atap.rotation.y = Math.PI / 4; atap.position.set(0, L * H + 1.9, z0 + 1.5); atap.castShadow = true; g.add(atap);
  // dinding belakang (utara) penuh, dinding ujung, sekat kelas
  K.b(W, L * H, 0.3, 0xfdf3d8, 0, L * H / 2 + 0.4, z0 - D / 2);
  for (const sx of [-1, 1]) K.b(0.3, L * H, D, 0xfdf3d8, sx * W / 2, L * H / 2 + 0.4, z0);
  const nKelas = 4, lebar = W / nKelas;
  for (let f = 0; f < L; f++) {
    const lantai = f * H + 0.57, y0 = f * H + 0.55, hh = H - 0.2;
    for (let c = 1; c < nKelas; c++) K.b(0.25, hh, D, 0xfdf3d8, -W / 2 + c * lebar, y0 + hh / 2, z0); // sekat antarkelas
    // dinding depan (ke selasar): ambang bawah bata + jendela kaca lebar + pintu
    for (let c = 0; c < nKelas; c++) {
      const cx = -W / 2 + (c + 0.5) * lebar, zD = z0 + D / 2;
      K.b(lebar, 0.9, 0.25, 0xb5533c, cx, y0 + 0.45, zD);                               // ambang bawah
      K.b(lebar, 0.5, 0.25, 0xfdf3d8, cx, y0 + hh - 0.25, zD);                          // ambang atas
      K.k(lebar - 2.6, hh - 1.4, 0.06, cx - 1.1, y0 + 0.9 + (hh - 1.4) / 2, zD);        // jendela kaca lebar (bening)
      for (let x = cx - lebar / 2 + 2.2; x < cx + lebar / 2 - 2.5; x += 2.1) K.b(0.1, hh - 1.4, 0.12, 0x7a4a21, x, y0 + 0.9 + (hh - 1.4) / 2, zD); // kusen jendela
      K.b(1.2, hh - 0.5, 0.08, 0x7a4a21, cx + lebar / 2 - 1.2, y0 + (hh - 0.5) / 2, zD + 0.05); // pintu kelas
      // isi kelas: papan tulis di dinding barat kelas, meja guru, 4x5 meja siswa menghadap barat
      const xPapan = cx - lebar / 2 + 0.3;
      dalam.b(0.08, 1.3, 4.5, 0x1f3d2b, xPapan, lantai + 1.6, z0); dalam.b(0.12, 1.45, 4.7, 0x7a4a21, xPapan - 0.03, lantai + 1.6, z0);
      dalam.b(1.4, 0.8, 0.8, 0x7a4a21, xPapan + 1.6, lantai + 0.4, z0 + 2.6);
      dalam.n(0.08, 0.06, 2.4, 0xfffbe8, cx, (f + 1) * H + 0.2, z0 - 2); dalam.n(0.08, 0.06, 2.4, 0xfffbe8, cx, (f + 1) * H + 0.2, z0 + 2);
      dalam.b(lebar - 0.5, 0.03, D - 0.6, 0xd8cfc0, cx, lantai, z0);
      let n = 0;
      for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) {
        const x = xPapan + 3.4 + col * 2.2, z = z0 - 3 + row * 2.4;
        if (x > cx + lebar / 2 - 1) continue;
        dalam.b(1.1, 0.06, 0.7, 0xc9a26a, x, lantai + 0.72, z); dalam.b(0.06, 0.7, 0.6, 0x5f6b75, x - 0.5, lantai + 0.36, z); dalam.b(0.06, 0.7, 0.6, 0x5f6b75, x + 0.5, lantai + 0.36, z);
        dalam.b(0.5, 0.06, 0.5, 0x2e6fa8, x + 0.55, lantai + 0.45, z); dalam.b(0.06, 0.5, 0.5, 0x2e6fa8, x + 0.8, lantai + 0.7, z);
        if ((n++ + c + f) % 2 === 0) orang(G, g, 200 + f * 40 + c * 10 + n, x + 0.55, lantai - 0.06, z, -Math.PI / 2, true); // siswa duduk menghadap papan
      }
      orang(G, g, 300 + f * 4 + c, xPapan + 0.9, lantai, z0 + 0.8, Math.PI / 2, false);   // guru di depan papan
    }
    // selasar: tiang
    for (let x = -W / 2; x <= W / 2; x += lebar / 2) K.b(0.35, hh, 0.35, 0xfdf3d8, x, y0 + hh / 2, z0 + D / 2 + 3);
  }
  // tangga ujung timur
  for (let t = 0; t < 12; t++) K.b(2, 0.3, 0.9, 0xd8d2c4, W / 2 + 1.5, 0.4 + t * 0.32, z0 + D / 2 + 2 - t * 0.9);
  // halaman: tiang bendera, lapangan basket, gerbang, pohon
  K.b(W, 0.06, 26, 0xcfc6b0, 0, 0.27, 16);
  K.b(28, 0.07, 15, 0x2e7d5b, -8, 0.3, 17); for (const x of [-21, 5]) { K.b(0.2, 3.2, 0.2, 0xf4f4f2, x, 1.9, 17); K.b(1.8, 1.1, 0.08, 0xffffff, x + Math.sign(-x) * 0.2, 3.4, 17); }
  K.c(0.1, 10, 0xdddddd, 16, 5.3, 12); const bdr = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshStandardMaterial({ color: 0xc8102e, side: THREE.DoubleSide })); bdr.position.set(16.9, 9.6, 12); g.add(bdr);
  const bdr2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); bdr2.position.set(16.9, 9.0, 12); g.add(bdr2);
  for (const x of [-5, 5]) K.b(1.2, 4.2, 1.2, 0xb5533c, x, 2.4, 33); K.b(11.2, 1.2, 0.8, 0xfdf3d8, 0, 4.9, 33);
  const papan = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 0.25), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Sekolah Negeri Merdu"), roughness: 0.8 }));
  papan.position.set(0, 4.9, 33.45); g.add(papan);
  /* HALAMAN SEKOLAH: kantin & gerobak jajanan, parkir motor guru & sepeda
     siswa, bangku di bawah pohon, orang tua menjemput di gerbang, siswa
     berjalan & bermain, satpam, mobil guru. */
  gerobak(K, g, "Kantin Sekolah", 22, 9, 0x2e9e5b); gerobak(K, g, "Es Teh", 27, 14, 0xe8943a);
  orang(G, g, 600 + data.kol, 22, 0.3, 7.8, 0, false); orang(G, g, 601 + data.kol, 27, 0.3, 12.8, 0, false);
  for (let i = 0; i < 3; i++) orang(G, g, 602 + i + data.kol, 20.6 + i * 1.5, 0.3, 11.2, Math.PI, false);
  for (let i = 0; i < 6; i++) motor(g, -26 + i * 1.1, 10, 0, [0xc8102e, 0x1d1d1f, 0x3f6fb5][i % 3]);
  for (let i = 0; i < 8; i++) { K.b(0.06, 0.9, 1.5, 0x2e6fa8, -26 + i * 0.7, 0.75, 24); K.b(0.05, 0.05, 1.5, 0x8a8f94, -26 + i * 0.7, 1.15, 24); }  // rak sepeda
  K.b(6, 0.1, 0.1, 0x8a8f94, -23.5, 0.6, 24);
  for (const [x, z] of [[18, 26], [-20, 18]]) { bangku(K, x, z, Math.PI); orang(G, g, 610 + x + data.kol, x, 0.3, z - 0.25, Math.PI, true); }
  for (let i = 0; i < 5; i++) orang(G, g, 620 + i + data.kol, -8 + i * 2.2, 0.3, 36.5, Math.PI, false);    // orang tua menunggu di luar gerbang
  mobilParkir(g, 26, 31, 0, 0x3f6fb5); mobilParkir(g, -27, 31, 0, 0xe8c268);
  orang(G, g, 630 + data.kol, 6.5, 0.3, 32, -Math.PI / 2, false);                      // satpam gerbang
  pejalan(G, g, 640 + data.kol, { x: -1, z: 32 }, { x: -1, z: -3 });
  pejalan(G, g, 641 + data.kol, { x: 1.5, z: -3 }, { x: 1.5, z: 30 });
  pejalan(G, g, 642 + data.kol, { x: -24, z: 2 }, { x: 24, z: 2 });
  pejalan(G, g, 643 + data.kol, { x: 24, z: 4 }, { x: -24, z: 4 });
  pejalan(G, g, 644 + data.kol, { x: 10, z: 22 }, { x: 18, z: 4 });
  const statis = K.jadi(g), isi = dalam.jadi(g);
  G.dalam.push(isi.o, isi.nl, isi.kc);
  for (const [x, z] of [[-24, 30], [24, 30], [26, 4], [-26, 4], [12, 26]]) g.add(pohonKecil(x, z, 1.1));
  // siswa bermain basket di halaman
  for (let i = 0; i < 4; i++) orang(G, g, 400 + i, -14 + i * 4, 0.3, 17 + (i % 2 ? 2 : -2), i * 1.3, false).userData.main = true;
  return { W, D: D + 6, z0: z0 + 1.5, statis };
}

export function bangunGedungKaca() {
  const grup = new THREE.Group();
  for (const data of GEDUNG_KACA_BLOK) {
    const s = sudutBlok(data.kol, data.bar), cx = s.x + JALAN + (PITCH - JALAN) / 2, cz = s.z + JALAN + (PITCH - JALAN) / 2;
    const g = new THREE.Group(); g.position.set(cx, 0.245, cz); grup.add(g);
    const G = { g, dalam: [], orang: [], cx, cz };
    const r = data.jenis === "kantor" ? kantor(G, g, data) : sekolah(G, g, data);
    const zc = r.z0 || 0;
    rintanganGedung.push({ minX: cx - r.W / 2 - 0.5, maxX: cx + r.W / 2 + 0.5, minZ: cz + zc - r.D / 2 - 0.5, maxZ: cz + zc + r.D / 2 + 0.5 });
    GEDUNG.push(G);
  }
  scene.add(grup);
  return grup;
}

/* LOD interior + animasi orang (napas, kedip, pejalan halaman, siswa main). */
let lodTerakhir = -1e9;
export function perbaruiGedungKaca(dt, t) {
  const kini = performance.now();
  if (kini - lodTerakhir > 400) { // LOD tiap 0,4 dtk waktu nyata (tak bergantung FPS)
    lodTerakhir = kini;
    for (const G of GEDUNG) {
      const dekat = Math.hypot(camera.position.x - G.cx, camera.position.z - G.cz) < 320;
      for (const o of G.dalam) if (o) o.visible = dekat;
      for (const p of G.orang) p.kar.visible = dekat;
      G.dekat = dekat;
    }
  }
  for (const G of GEDUNG) {
    if (!G.dekat) continue;
    for (const p of G.orang) {
      animasiHidup(p.kar, t, true);
      if (p.sit) { const u = p.kar.userData; if (u.lenganK) { u.lenganK.rotation.x = -1.0 + Math.sin(t * 6 + p.fase) * 0.08; u.lenganR.rotation.x = -1.0 + Math.sin(t * 6 + p.fase + 1) * 0.08; } }
      if (p.kar.userData.main) { const vx = Math.sin(t * 1.3 + p.fase) * 2.2; p.kar.position.x += vx * dt; p.kar.rotation.y = vx > 0 ? Math.PI / 2 : -Math.PI / 2; animasiJalan(p.kar, Math.abs(vx) * dt, dt); }
      if (p.jalur) { // pejalan bolak-balik di halaman
        const J = p.jalur, L = Math.hypot(J.b.x - J.a.x, J.b.z - J.a.z);
        p.s += p.arah * 1.3 * dt; if (p.s > L) { p.s = L; p.arah = -1; } else if (p.s < 0) { p.s = 0; p.arah = 1; }
        const f = p.s / L; p.kar.position.x = J.a.x + (J.b.x - J.a.x) * f; p.kar.position.z = J.a.z + (J.b.z - J.a.z) * f;
        const sas = Math.atan2((J.b.x - J.a.x) * p.arah, (J.b.z - J.a.z) * p.arah); let d = sas - p.kar.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; p.kar.rotation.y += d * Math.min(1, dt * 8);
        animasiJalan(p.kar, 1.3 * dt, dt);
      }
    }
  }
}
