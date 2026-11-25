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
import { buatJam } from "./jam.js";
import { buatPetugas } from "./keamanan.js";
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
function orang(G, g, i, x, y, z, ry, sit, opsi) {
  const o = opsi || {};
  const k = o.petugas ? buatPetugas(o.petugas, i) : buatKarakter({ baju: o.baju || BAJU[i % BAJU.length], kulit: ["#f1c27d", "#c68642", "#e0ac69", "#8d5524"][(i * 5) % 4], topi: i % 5 === 2 ? "hijab" : "tanpa", rupa: o.celana ? { warna_celana: o.celana } : undefined });
  k.scale.setScalar(SKALA_KARAKTER * (o.skala || 1)); k.position.set(x, y, z); k.rotation.y = ry; k.userData.geserHidup = i * 0.7;
  if (sit) duduk(k);
  g.add(k); G.orang.push({ kar: k, sit, fase: i * 0.9, aksi: o.aksi, x0: x, z0: z, rentang: o.rentang || 0 });
  return k;
}

/* limas 4 sisi beralas persegi (sudut di ±1) — diskalakan per sumbu tanpa miring */
function atapLimas() { const c = new THREE.ConeGeometry(Math.SQRT2, 1, 4, 1); c.rotateY(Math.PI / 4); return c; }
/* ---------- isi halaman (biar tidak sepi) ---------- */
function pejalan(G, g, i, a, b, y, opsi) { const k = orang(G, g, i, a.x, y === undefined ? 0.3 : y, a.z, 0, false, opsi); const p = G.orang[G.orang.length - 1]; p.jalur = { a, b }; p.s = hashInt(i * 7) * Math.hypot(b.x - a.x, b.z - a.z); p.arah = i % 2 ? 1 : -1; return k; }
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
    if (f % 2) { // rapat: peserta duduk + presenter di depan layar
      orang(G, g, f * 10 + 7, 11.2, lantai, -2.6, Math.PI, true); orang(G, g, f * 10 + 8, 12.8, lantai, -5.4, 0, true);
      const pr = orang(G, g, f * 10 + 9, 13.6, lantai, -6.5, 0, false, { aksi: "presentasi" }); G.orang[G.orang.length - 1].ry0 = -0.6; void pr;
    }
    // aktivitas: pegawai berjalan di lorong dekat jendela depan & belakang, ngobrol di dispenser
    pejalan(G, g, 800 + f * 3 + data.kol, { x: -12.5, z: 9.4 }, { x: 12.5, z: 9.4 }, lantai);
    if (f % 2 === 0) pejalan(G, g, 801 + f * 3 + data.kol, { x: 13, z: -9.8 }, { x: -13, z: -9.8 }, lantai);
    dalam.b(0.4, 1.2, 0.4, 0xdfe3e6, -14, lantai + 0.6, 1.5); dalam.b(0.35, 0.4, 0.35, 0x6fc3ff, -14, lantai + 1.4, 1.5); // dispenser air
    orang(G, g, 802 + f * 3 + data.kol, -13.1, lantai, 1.5, -Math.PI / 2, false, { aksi: "presentasi" }); G.orang[G.orang.length - 1].ry0 = -Math.PI / 2;
    for (const [x, z] of [[-14, 10], [14, 10], [-14, -10]]) { dalam.c(0.35, 0.5, 0xb5533c, x, lantai + 0.25, z); dalam.s(0.75, 0x3f8a3a, x, lantai + 1.0, z); }
  }
  // papan nama di atap & pintu masuk
  const papan = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Gedung Perkantoran"), roughness: 0.8 }));
  papan.position.set(0, L * H + 3.2, D / 2 + 0.3); g.add(papan);
  const jk = buatJam(1.0); jk.position.set(9, L * H + 3.2, D / 2 + 0.35); g.add(jk);
  const jl = buatJam(0.5); jl.position.set(0, 3.7, 0.6); g.add(jl); // jam lobi di atas logo
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
/* Seragam per jenjang (baju putih, celana/rok sesuai jenjang). */
const JENJANG = [
  { nama: "SD", celana: "#c8102e", skala: 0.78 },
  { nama: "SMP", celana: "#1d3a8f", skala: 0.9 },
  { nama: "SMA", celana: "#7a7f86", skala: 0.98 },
];
function sekolah(G, g, data) {
  const L = 3, H = 3.8, W = 52, D = 11, K = Kumpul(), dalam = Kumpul();
  const z0 = -14; // gedung di utara lahan, halaman di selatan
  K.b(W + 2, 0.4, D + 6, 0x9aa0a6, 0, 0.2, z0 + 1.5);
  for (let f = 0; f <= L; f++) { K.b(W, 0.3, D + 3, 0xe9e2d3, 0, f * H + 0.4, z0 + 1.5); if (f) K.b(W, 1.0, 0.15, 0xfdf3d8, 0, f * H + 0.95, z0 + D / 2 + 3); } // pelat + pagar selasar
  // atap pelana genteng
  const atap = new THREE.Mesh(atapLimas(), M(0xb5533c)); atap.scale.set(W * 0.53, 3, (D + 4) * 0.53); atap.position.set(0, L * H + 1.9, z0 + 1.5); atap.castShadow = true; g.add(atap);
  // dinding belakang (utara) penuh, dinding ujung, sekat kelas
  K.b(W, L * H, 0.3, 0xfdf3d8, 0, L * H / 2 + 0.4, z0 - D / 2);
  for (const sx of [-1, 1]) K.b(0.3, L * H, D, 0xfdf3d8, sx * W / 2, L * H / 2 + 0.4, z0);
  const nKelas = 4, lebar = W / nKelas;
  for (let f = 0; f < L; f++) {
    const J = JENJANG[f]; // lantai 1 SD, 2 SMP, 3 SMA
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
      if (f === 0) { const jc = buatJam(0.28); jc.rotation.y = Math.PI / 2; jc.position.set(xPapan + 0.08, lantai + 2.75, z0); g.add(jc); } // jam kelas (lantai dasar)
      dalam.b(1.4, 0.8, 0.8, 0x7a4a21, xPapan + 1.6, lantai + 0.4, z0 + 2.6);
      dalam.n(0.08, 0.06, 2.4, 0xfffbe8, cx, (f + 1) * H + 0.2, z0 - 2); dalam.n(0.08, 0.06, 2.4, 0xfffbe8, cx, (f + 1) * H + 0.2, z0 + 2);
      dalam.b(lebar - 0.5, 0.03, D - 0.6, 0xd8cfc0, cx, lantai, z0);
      let n = 0;
      for (let col = 0; col < 4; col++) for (let row = 0; row < 3; row++) {
        const x = xPapan + 3.4 + col * 2.2, z = z0 - 3 + row * 2.4;
        if (x > cx + lebar / 2 - 1) continue;
        dalam.b(1.1, 0.06, 0.7, 0xc9a26a, x, lantai + 0.72, z); dalam.b(0.06, 0.7, 0.6, 0x5f6b75, x - 0.5, lantai + 0.36, z); dalam.b(0.06, 0.7, 0.6, 0x5f6b75, x + 0.5, lantai + 0.36, z);
        dalam.b(0.5, 0.06, 0.5, 0x2e6fa8, x + 0.55, lantai + 0.45, z); dalam.b(0.06, 0.5, 0.5, 0x2e6fa8, x + 0.8, lantai + 0.7, z);
        if ((n++ + c + f) % 2 === 0) orang(G, g, 200 + f * 40 + c * 10 + n, x + 0.55, lantai - 0.06 + (1 - J.skala) * 0.45, z, -Math.PI / 2, true, { baju: "#ffffff", celana: J.celana, skala: J.skala, aksi: n % 3 === 0 ? "angkat" : "tulis" }); // siswa (seragam jenjang) duduk menghadap papan
      }
      orang(G, g, 300 + f * 4 + c, xPapan + 0.9, lantai, z0 + 0.8, Math.PI / 2, false, { aksi: "guru", rentang: 2.0 });   // guru mondar-mandir di depan papan sambil menerangkan
    }
    // selasar: tiang + papan jenjang di pagar selasar
    for (let x = -W / 2; x <= W / 2; x += lebar / 2) K.b(0.35, hh, 0.35, 0xfdf3d8, x, y0 + hh / 2, z0 + D / 2 + 3);
    const pj = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.8), new THREE.MeshBasicMaterial({ map: teksturPapanNama(J.nama, ["Kelas 1-6", "Kelas 7-9", "Kelas 10-12"][f]) }));
    pj.position.set(-W / 2 + 3, (f + 1) * H + 0.95, z0 + D / 2 + 3.1); g.add(pj);
  }
  // tangga ujung timur
  for (let t = 0; t < 12; t++) K.b(2, 0.3, 0.9, 0xd8d2c4, W / 2 + 1.5, 0.4 + t * 0.32, z0 + D / 2 + 2 - t * 0.9);
  // halaman: tiang bendera, lapangan basket, gerbang, pohon
  K.b(W, 0.06, 26, 0xcfc6b0, 0, 0.27, 16);
  K.b(28, 0.07, 15, 0x2e7d5b, -8, 0.3, 17); for (const x of [-21, 5]) { K.b(0.2, 3.2, 0.2, 0xf4f4f2, x, 1.9, 17); K.b(1.8, 1.1, 0.08, 0xffffff, x + Math.sign(-x) * 0.2, 3.4, 17); }
  K.c(0.1, 10, 0xdddddd, 16, 5.3, 12); const bdr = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), new THREE.MeshStandardMaterial({ color: 0xc8102e, side: THREE.DoubleSide })); bdr.position.set(16.9, 9.6, 12); g.add(bdr);
  const bdr2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })); bdr2.position.set(16.9, 9.0, 12); g.add(bdr2);
  for (const x of [-5, 5]) K.b(1.2, 4.2, 1.2, 0xb5533c, x, 2.4, 33); K.b(11.2, 1.2, 0.8, 0xfdf3d8, 0, 4.9, 33);
  const papan = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 0.25), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "TK · SD · SMP · SMA"), roughness: 0.8 }));
  papan.position.set(0, 4.9, 33.45); g.add(papan);
  const js = buatJam(1.0, 0xb5533c); js.position.set(0, L * H + 1.2, z0 + D / 2 + 3.3); g.add(js); // jam sekolah di selasar atas
  /* HALAMAN SEKOLAH: kantin & gerobak jajanan, parkir motor guru & sepeda
     siswa, bangku di bawah pohon, orang tua menjemput di gerbang, siswa
     berjalan & bermain, satpam, mobil guru. */
  /* GEDUNG TK (barat daya): 1 lantai warna-warni berkaca, kelas TK dengan
     meja bundar & anak kecil, taman bermain (perosotan, ayunan, jungkat-jungkit). */
  const tx = -21, tz = 14;
  K.b(14, 0.3, 9, 0xe9e2d3, tx, 0.45, tz);
  for (const [w, x] of [[0xf2c230, -7], [0x3aa6b9, 7]]) K.b(0.3, 3.2, 9, w, tx + x, 2.2, tz);
  K.b(14, 3.2, 0.3, 0xe85d75, tx, 2.2, tz - 4.5);
  K.b(14, 0.9, 0.25, 0x2e9e5b, tx, 1.05, tz + 4.5); K.k(13.5, 2.0, 0.06, tx, 2.5, tz + 4.5);
  const atapTK = new THREE.Mesh(atapLimas(), M(0xc8102e)); atapTK.scale.set(7.8, 2.4, 5.3); atapTK.position.set(tx, 5.0, tz); g.add(atapTK);
  const pTK = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({ map: teksturPapanNama("TK MERDU CERIA", "Taman Kanak-kanak") })); pTK.position.set(tx, 3.4, tz + 4.65); g.add(pTK);
  for (const dx of [-4, 0, 4]) {
    dalam.c(0.9, 0.06, [0xf2c230, 0x3aa6b9, 0xe85d75][(dx + 4) / 4], tx + dx, 1.05, tz);
    dalam.c(0.07, 0.45, 0x8a8f94, tx + dx, 0.8, tz);
    for (let a = 0; a < 4; a++) { const ax = Math.cos(a * Math.PI / 2) * 1.2, az = Math.sin(a * Math.PI / 2) * 1.2; dalam.b(0.35, 0.06, 0.35, 0x2e9e5b, tx + dx + ax, 0.85, tz + az); if ((a + dx) % 2 === 0) orang(G, g, 700 + dx * 4 + a, tx + dx + ax, 0.6, tz + az, Math.atan2(-ax, -az), true, { skala: 0.62, aksi: "angkat" }); }
  }
  orang(G, g, 720, tx - 5.5, 0.6, tz - 2, 0, false, { aksi: "guru", rentang: 3 });
  dalam.n(0.06, 1.2, 3, 0xffffff, tx - 6.8, 2.2, tz - 1);                                 // papan gambar
  // taman bermain
  const ox = -22, oz = 27;
  K.b(12, 0.08, 7, 0xd8c690, ox, 0.3, oz);
  K.b(0.15, 2.4, 0.15, 0xc8102e, ox - 4, 1.5, oz - 1); K.b(0.15, 2.4, 0.15, 0xc8102e, ox - 4, 1.5, oz + 1); K.b(1.2, 0.12, 1.2, 0xf2c230, ox - 4, 2.6, oz);
  const peros = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 3.6), M(0x3aa6b9)); peros.position.set(ox - 4, 1.4, oz + 2.3); peros.rotation.x = 0.65; g.add(peros);
  for (const x of [ox + 1, ox + 3.4]) K.b(0.15, 2.6, 0.15, 0x7b8086, x, 1.6, oz - 1.2); for (const x of [ox + 1, ox + 3.4]) K.b(0.15, 2.6, 0.15, 0x7b8086, x, 1.6, oz + 1.2);
  K.b(0.12, 0.12, 2.6, 0x7b8086, ox + 1, 2.9, oz); K.b(0.12, 0.12, 2.6, 0x7b8086, ox + 3.4, 2.9, oz);
  K.b(4, 0.1, 0.5, 0xe85d75, ox + 3.5, 0.7, oz + 3); K.b(0.3, 0.4, 0.3, 0x5f6b75, ox + 3.5, 0.5, oz + 3);
  for (let i = 0; i < 4; i++) orang(G, g, 730 + i, ox - 2 + i * 1.8, 0.35, oz + (i % 2 ? 1 : -1.5), i, false, { skala: 0.62, aksi: "lompat" });
  gerobak(K, g, "Kantin Sekolah", 22, 9, 0x2e9e5b); gerobak(K, g, "Es Teh", 27, 14, 0xe8943a);
  orang(G, g, 600 + data.kol, 22, 0.3, 7.8, 0, false); orang(G, g, 601 + data.kol, 27, 0.3, 12.8, 0, false);
  for (let i = 0; i < 3; i++) orang(G, g, 602 + i + data.kol, 20.6 + i * 1.5, 0.3, 11.2, Math.PI, false);
  for (let i = 0; i < 6; i++) motor(g, 24 + (i % 3) * 1.1, 20 + Math.floor(i / 3) * 2.3, 0, [0xc8102e, 0x1d1d1f, 0x3f6fb5][i % 3]);
  for (let i = 0; i < 8; i++) { K.b(0.06, 0.9, 1.5, 0x2e6fa8, 8 + i * 0.7, 0.75, 31); K.b(0.05, 0.05, 1.5, 0x8a8f94, 8 + i * 0.7, 1.15, 31); }  // rak sepeda
  K.b(6, 0.1, 0.1, 0x8a8f94, 10.5, 0.6, 31);
  for (const [x, z] of [[18, 26], [10, 22]]) { bangku(K, x, z, Math.PI); orang(G, g, 610 + x + data.kol, x, 0.3, z - 0.25, Math.PI, true); }
  for (let i = 0; i < 5; i++) orang(G, g, 620 + i + data.kol, -8 + i * 2.2, 0.3, 36.5, Math.PI, false);    // orang tua menunggu di luar gerbang
  mobilParkir(g, 26, 31, 0, 0x3f6fb5); mobilParkir(g, -27, 31, 0, 0xe8c268);
  orang(G, g, 630 + data.kol, 6.5, 0.3, 32, -Math.PI / 2, false);                      // satpam gerbang
  pejalan(G, g, 640 + data.kol, { x: -1, z: 32 }, { x: -1, z: -3 });
  pejalan(G, g, 641 + data.kol, { x: 1.5, z: -3 }, { x: 1.5, z: 30 });
  pejalan(G, g, 642 + data.kol, { x: -10, z: 2 }, { x: 24, z: 2 });
  pejalan(G, g, 643 + data.kol, { x: 24, z: 4 }, { x: -10, z: 4 });
  pejalan(G, g, 644 + data.kol, { x: 10, z: 22 }, { x: 18, z: 4 });
  const statis = K.jadi(g), isi = dalam.jadi(g);
  G.dalam.push(isi.o, isi.nl, isi.kc);
  for (const [x, z] of [[-24, 30], [24, 30], [26, 4], [-26, 4], [12, 26]]) g.add(pohonKecil(x, z, 1.1));
  // siswa bermain basket di halaman
  for (let i = 0; i < 4; i++) orang(G, g, 400 + i, -14 + i * 4, 0.3, 17 + (i % 2 ? 2 : -2), i * 1.3, false).userData.main = true;
  return { W, D: D + 6, z0: z0 + 1.5, statis };
}

/* ===================== UNIVERSITAS ===================== */
function kampus(G, g, data) {
  const L = 3, H = 4.4, W = 44, D = 16, z0 = -15, K = Kumpul(), dalam = Kumpul();
  K.b(W + 4, 0.4, D + 4, 0x9aa0a6, 0, 0.2, z0);
  for (let f = 0; f <= L; f++) K.b(W, 0.35, D, 0xe9e2d3, 0, f * H + 0.4, z0);
  K.b(W + 0.6, 1.0, D + 0.6, 0x7a1f1f, 0, L * H + 0.9, z0);                                   // lis atap marun
  const kubah = new THREE.Mesh(new THREE.SphereGeometry(4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2e5d43)); kubah.position.set(0, L * H + 1.4, z0); kubah.castShadow = true; g.add(kubah);
  K.b(9, 1.6, 9, 0xfdf3d8, 0, L * H + 1.2, z0);
  for (const x of [-W / 2, W / 2]) for (const z of [z0 - D / 2, z0 + D / 2]) K.b(0.7, L * H, 0.7, 0xfdf3d8, x, L * H / 2 + 0.4, z);
  K.b(W, L * H, 0.3, 0xfdf3d8, 0, L * H / 2 + 0.4, z0 - D / 2);                              // dinding belakang
  for (const sx of [-1, 1]) K.b(0.3, L * H, D, 0xfdf3d8, sx * W / 2, L * H / 2 + 0.4, z0);
  // portico depan: 6 kolom + pedimen
  for (let i = 0; i < 6; i++) K.c(0.55, L * H, 0xfdf3d8, -10 + i * 4, L * H / 2 + 0.4, z0 + D / 2 + 2.6);
  K.b(24, 0.8, 4, 0xfdf3d8, 0, L * H + 0.6, z0 + D / 2 + 2.4);
  const shp = new THREE.Shape(); shp.moveTo(-13, 0); shp.lineTo(13, 0); shp.lineTo(0, 3.4); shp.lineTo(-13, 0); // pedimen segitiga
  const geoPed = new THREE.ExtrudeGeometry(shp, { depth: 3.6, bevelEnabled: false }); geoPed.translate(0, 0, -1.8);
  const ped = new THREE.Mesh(geoPed, M(0xfdf3d8)); ped.position.set(0, L * H + 1.0, z0 + D / 2 + 2.4); ped.castShadow = true; g.add(ped);
  const papan = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Kampus Negara Merdu"), roughness: 0.8 }));
  papan.position.set(0, L * H + 0.6, z0 + D / 2 + 4.45); g.add(papan);
  const jk = buatJam(0.9, 0xd4a73a); jk.position.set(0, L * H + 2.3, z0 + D / 2 + 4.25); g.add(jk);
  for (let f = 0; f < L; f++) {
    const lantai = f * H + 0.58, y0 = f * H + 0.6, hh = H - 0.25, zD = z0 + D / 2;
    K.k(W, hh, 0.06, 0, y0 + hh / 2, zD);                                                     // fasad depan kaca bening
    for (let x = -W / 2 + 2.75; x < W / 2; x += 2.75) K.b(0.12, hh, 0.14, 0x7a1f1f, x, y0 + hh / 2, zD);
    K.b(W, 0.3, 0.2, 0x7a1f1f, 0, (f + 1) * H + 0.4, zD);
    dalam.b(W - 0.6, 0.04, D - 0.6, [0xc9b896, 0x5b4b6b, 0x4b5b6b][f], 0, lantai, z0);
    for (let x = -18; x <= 18; x += 6) dalam.n(2.4, 0.06, 0.6, 0xfffbe8, x, (f + 1) * H + 0.18, z0);
    if (f === 0) { // PERPUSTAKAAN: rak buku + meja baca + mahasiswa membaca
      for (let r = 0; r < 4; r++) {
        const x = -18 + r * 4.5;
        dalam.b(0.6, 2.4, 9, 0x7a4a21, x, lantai + 1.2, z0 - 1.5);
        for (let k = 0; k < 4; k++) for (let b = 0; b < 8; b++) dalam.b(0.62, 0.42, 0.9, [0xc8102e, 0x1d5a8f, 0x2e9e5b, 0xf2c230, 0x7b2ff7][(b + k + r) % 5], x, lantai + 0.4 + k * 0.58, z0 - 5.4 + b * 1.1);
      }
      for (const x of [4, 10, 16]) {
        dalam.b(3, 0.08, 1.4, 0xc9a26a, x, lantai + 0.78, z0 + 3); dalam.b(0.1, 0.75, 1.2, 0x5f6b75, x - 1.3, lantai + 0.38, z0 + 3); dalam.b(0.1, 0.75, 1.2, 0x5f6b75, x + 1.3, lantai + 0.38, z0 + 3);
        for (const dz of [-1.1, 1.1]) { dalam.b(0.5, 0.08, 0.5, 0x2e6fa8, x, lantai + 0.48, z0 + 3 + dz); orang(G, g, 900 + x + (dz > 0 ? 1 : 0), x, lantai, z0 + 3 + dz, dz > 0 ? Math.PI : 0, true, { aksi: "tulis" }); }
      }
      const pPerpus = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({ map: teksturPapanNama("PERPUSTAKAAN", "Lantai 1") })); pPerpus.position.set(-14, H - 0.2, zD + 0.1); g.add(pPerpus);
      orang(G, g, 950, -6, lantai, z0 + 5, Math.PI / 2, false); G.orang[G.orang.length - 1].jalur = { a: { x: -20, z: z0 + 5 }, b: { x: 0, z: z0 + 5 } }; Object.assign(G.orang[G.orang.length - 1], { s: 4, arah: 1 });
    } else if (f === 1) { // RUANG KULIAH: kursi bertingkat menghadap papan/layar di barat, dosen menerangkan
      for (const [x0, x1] of [[-W / 2 + 0.5, -0.5], [0.5, W / 2 - 0.5]]) {
        dalam.b(0.25, hh, D - 0.6, 0xfdf3d8, x1 + 0.4, y0 + hh / 2, z0);
        dalam.n(0.08, 2.0, 5, 0xf4f8ff, x0 + 0.2, lantai + 2.2, z0);                                  // layar proyektor
        dalam.b(1.6, 0.9, 0.8, 0x7a4a21, x0 + 2, lantai + 0.45, z0 + 4);                              // meja dosen
        orang(G, g, 960 + x0, x0 + 1.4, lantai, z0, Math.PI / 2, false, { aksi: "guru", rentang: 2.4 });
        for (let col = 0; col < 6; col++) {
          const x = x0 + 5 + col * 2.6, naik = col * 0.22;
          dalam.b(1.8, naik + 0.05, D - 2, 0x6b5b4b, x, lantai + naik / 2, z0);                        // undakan
          for (let row = 0; row < 4; row++) {
            const z = z0 - 5 + row * 3.1; dalam.b(0.6, 0.08, 2.4, 0xc9a26a, x - 0.4, lantai + naik + 0.75, z); dalam.b(0.5, 0.06, 0.5, 0x2e6fa8, x + 0.2, lantai + naik + 0.45, z);
            if ((row + col + x0) % 2 === 0) orang(G, g, 970 + col * 7 + row + (x0 > 0 ? 50 : 0), x + 0.2, lantai + naik - 0.05, z, -Math.PI / 2, true, { aksi: (row + col) % 4 === 0 ? "angkat" : "tulis" });
          }
        }
      }
    } else { // LAB KOMPUTER
      for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
        const x = -18 + i * 4.4, z = z0 - 4.5 + row * 4;
        dalam.b(1.6, 0.08, 0.9, 0xe8e2d6, x, lantai + 0.75, z); dalam.b(0.08, 0.7, 0.8, 0x8a8f94, x - 0.7, lantai + 0.38, z); dalam.b(0.08, 0.7, 0.8, 0x8a8f94, x + 0.7, lantai + 0.38, z);
        dalam.n(0.8, 0.5, 0.05, (i + row) % 3 ? 0x6fc3ff : 0x9fe0b0, x, lantai + 1.1, z - 0.3); dalam.b(0.85, 0.55, 0.04, 0x1b1d20, x, lantai + 1.1, z - 0.33);
        dalam.b(0.55, 0.08, 0.55, 0x2b2d30, x, lantai + 0.5, z + 0.7);
        if ((i + row) % 2 === 0) orang(G, g, 1100 + row * 10 + i, x, lantai, z + 0.7, Math.PI, true, { aksi: "tulis" });
      }
      const pLab = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({ map: teksturPapanNama("LAB KOMPUTER", "Lantai 3") })); pLab.position.set(-14, 3 * H - 0.2 - H + H, zD + 0.1); g.add(pLab);
      pejalan(G, g, 1190, { x: -20, z: z0 + 6 }, { x: 20, z: z0 + 6 }, lantai);
    }
  }
  // HALAMAN KAMPUS: taman luas, jalan setapak, tugu, mahasiswa bergerombol di rumput, kantin, parkir motor, gerbang
  K.b(10, 0.08, 34, 0xcfc6b0, 0, 0.3, 17); K.b(60, 0.08, 6, 0xcfc6b0, 0, 0.3, 12);
  K.c(1.6, 0.8, 0xd8d2c4, 0, 0.7, 12); K.b(1, 6, 1, 0xfdf3d8, 0, 4, 12); K.s(0.9, 0xd4a73a, 0, 7.5, 12);               // tugu kampus
  for (const [cx, cz] of [[-16, 22], [16, 22], [-22, 4], [20, 4]]) {                                                     // mahasiswa duduk melingkar di rumput
    for (let a = 0; a < 4; a++) { const ang = a / 4 * Math.PI * 2; orang(G, g, 1200 + cx + cz + a, cx + Math.cos(ang) * 1.4, 0.0, cz + Math.sin(ang) * 1.4, Math.atan2(-Math.cos(ang), -Math.sin(ang)), true, { aksi: a % 2 ? "presentasi" : "tulis" }); G.orang[G.orang.length - 1].ry0 = Math.atan2(-Math.cos(ang), -Math.sin(ang)); }
  }
  gerobak(K, g, "Kantin Kampus", 26, 26, 0x7a1f1f); orang(G, g, 1290, 26, 0.12, 24.8, 0, false);
  for (let i = 0; i < 3; i++) orang(G, g, 1291 + i, 24.6 + i * 1.4, 0.12, 27.8, Math.PI, false);
  for (let i = 0; i < 10; i++) motor(g, -28 + (i % 5) * 1.1, 26 + Math.floor(i / 5) * 2.4, 0, [0xc8102e, 0x1d1d1f, 0x3f6fb5, 0xf2f2ee][i % 4]);
  for (const [x, z] of [[-10, 28], [10, 28], [-12, 16], [12, 16]]) bangku(K, x, z, 0);
  for (const x of [-6, 6]) K.b(1.4, 5, 1.4, 0x7a1f1f, x, 2.5, 33); K.b(13.4, 1.3, 1, 0xfdf3d8, 0, 5.6, 33);
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(11, 1), new THREE.MeshBasicMaterial({ map: teksturPapanNama(data.nama, "Selamat Datang") })); pg.position.set(0, 5.6, 33.55); g.add(pg);
  for (let i = 0; i < 6; i++) pejalan(G, g, 1300 + i, { x: -2 + (i % 2) * 4, z: 32 - (i % 3) }, { x: -2 + (i % 2) * 4, z: z0 + D / 2 + 5 }, 0.36);
  pejalan(G, g, 1310, { x: -28, z: 12 }, { x: 28, z: 12 }, 0.36); pejalan(G, g, 1311, { x: 28, z: 11 }, { x: -28, z: 11 }, 0.36);
  const statis = K.jadi(g), isi = dalam.jadi(g);
  G.dalam.push(isi.o, isi.nl, isi.kc);
  for (const [x, z] of [[-28, 32], [28, 32], [-28, 16], [28, 16], [-6, 22], [6, 22]]) g.add(pohonKecil(x, z, 1.2));
  return { W: W + 2, D: D + 6, z0: z0 + 2, statis };
}

/* ===================== MARKAS POLISI & TENTARA ===================== */
export const PARKIR_POLISI = []; // posisi dunia mobil polisi yang parkir (diisi saat bangun)
function markasPolisi(G, g, data) {
  const L = 3, H = 4.0, W = 30, D = 14, z0 = -16, K = Kumpul(), dalam = Kumpul(), BIRU = 0x1d3a5f;
  K.b(W + 4, 0.4, D + 4, 0x9aa0a6, 0, 0.2, z0);
  for (let f = 0; f <= L; f++) K.b(W, 0.35, D, 0xe9e2d3, 0, f * H + 0.4, z0);
  K.b(W + 0.6, 1.0, D + 0.6, BIRU, 0, L * H + 0.9, z0);
  K.b(W, L * H, 0.3, 0xf4f4f2, 0, L * H / 2 + 0.4, z0 - D / 2);
  for (const sx of [-1, 1]) K.b(0.3, L * H, D, 0xf4f4f2, sx * W / 2, L * H / 2 + 0.4, z0);
  for (let f = 0; f < L; f++) {
    const lantai = f * H + 0.58, y0 = f * H + 0.6, hh = H - 0.25, zD = z0 + D / 2;
    K.k(W, hh, 0.06, 0, y0 + hh / 2, zD); for (let x = -W / 2 + 3; x < W / 2; x += 3) K.b(0.14, hh, 0.14, BIRU, x, y0 + hh / 2, zD);
    K.b(W, 0.4, 0.25, BIRU, 0, (f + 1) * H + 0.3, zD);
    dalam.b(W - 0.6, 0.04, D - 0.6, [0x8a8f94, 0x5b6b7a, 0x5b6b7a][f], 0, lantai, z0);
    for (let x = -12; x <= 12; x += 6) dalam.n(2.4, 0.06, 0.6, 0xfffbe8, x, (f + 1) * H + 0.18, z0);
    if (f === 0) { // SPKT: loket pelayanan + warga melapor + ruang tunggu
      dalam.b(16, 1.1, 1.2, 0x7a4a21, 0, lantai + 0.55, z0 + 1); dalam.b(16.2, 0.08, 1.4, 0xf4f4f2, 0, lantai + 1.14, z0 + 1);
      dalam.n(6, 0.9, 0.08, 0x1d3a8f, 0, lantai + 2.8, z0 - 6.5);
      for (const x of [-6, 0, 6]) { orang(G, g, 1400 + x, x, lantai, z0 - 0.2, 0, false, { petugas: "polisi" }); orang(G, g, 1410 + x, x + 0.6, lantai, z0 + 2.4, Math.PI, false); }
      for (const x of [-12, -10, 10, 12]) { dalam.b(1.4, 0.45, 0.6, 0x2e6fa8, x, lantai + 0.25, z0 + 5); orang(G, g, 1420 + x, x, lantai, z0 + 5, Math.PI, true); }
    } else { // ruang kerja reserse/lalu lintas: meja + monitor + petugas
      for (const x of [-11, -6, -1, 4, 9]) for (const z of [z0 - 3, z0 + 2]) {
        dalam.b(2.2, 0.08, 1.1, 0xe8e2d6, x, lantai + 0.75, z); dalam.n(0.7, 0.45, 0.05, 0x6fc3ff, x, lantai + 1.05, z - 0.4); dalam.b(0.75, 0.5, 0.04, 0x1b1d20, x, lantai + 1.05, z - 0.43);
        dalam.b(0.55, 0.08, 0.55, 0x2b2d30, x, lantai + 0.5, z + 0.8);
        if ((x + z + f) % 2 === 0) orang(G, g, 1430 + f * 20 + x + z, x, lantai, z + 0.8, Math.PI, true, { petugas: "polisi", aksi: "tulis" });
      }
      pejalan(G, g, 1480 + f, { x: -13, z: z0 + 5.6 }, { x: 13, z: z0 + 5.6 }, lantai, { petugas: "polisi" });
    }
  }
  const papan = new THREE.Mesh(new THREE.BoxGeometry(18, 1.8, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Melindungi & Mengayomi"), roughness: 0.8 }));
  papan.position.set(0, L * H + 0.9, z0 + D / 2 + 0.35); g.add(papan);
  const jk = buatJam(0.7); jk.position.set(12, L * H + 0.9, z0 + D / 2 + 0.45); g.add(jk);
  // halaman: parkir mobil patroli (diisi keamanan.js), tiang bendera, pos jaga, petugas apel
  K.b(W, 0.08, 18, 0x5c6066, 0, 0.3, 12);
  for (let i = 0; i < 5; i++) { K.b(0.15, 0.04, 6, 0xf4f1e6, -12 + i * 6, 0.36, 10); if (i < 4) PARKIR_POLISI.push({ x: G.cx - 9 + i * 6, z: G.cz + 10, ry: Math.PI }); }
  K.c(0.1, 10, 0xdddddd, 18, 5.3, 24); const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xc8102e, side: THREE.DoubleSide })); bd.position.set(18.9, 9.9, 24); g.add(bd);
  const bd2 = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })); bd2.position.set(18.9, 9.3, 24); g.add(bd2);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) orang(G, g, 1500 + r * 6 + c, -10 + c * 1.6, 0.36, 24 + r * 1.6, Math.PI, false, { petugas: "polisi" }); // apel
  orang(G, g, 1520, -5.8, 0.36, 21, 0, false, { petugas: "polisi", aksi: "presentasi" }); G.orang[G.orang.length - 1].ry0 = 0;
  K.b(3, 2.6, 3, BIRU, -12, 1.6, 31); K.b(3.6, 0.3, 3.6, 0xf4f4f2, -12, 3.05, 31); orang(G, g, 1521, -9.6, 0.36, 31.5, 0, false, { petugas: "polisi" });
  for (const x of [-6, 6]) K.b(1.2, 4.2, 1.2, BIRU, x, 2.4, 33); K.b(13.2, 1.1, 0.8, 0xf4f4f2, 0, 4.9, 33);
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.9), new THREE.MeshBasicMaterial({ map: teksturPapanNama(data.nama, "Pelayanan 24 Jam") })); pg.position.set(0, 4.9, 33.45); g.add(pg);
  const statis = K.jadi(g), isi = dalam.jadi(g); G.dalam.push(isi.o, isi.nl, isi.kc);
  for (const [x, z] of [[-26, 30], [26, 30], [-26, 6], [26, 6]]) g.add(pohonKecil(x, z, 1.1));
  return { W: W + 2, D: D + 2, z0, statis };
}
function markasTentara(G, g, data) {
  const K = Kumpul(), dalam = Kumpul(), HIJAU = 0x4f5d3a, KREM = 0xd8cfb0;
  // 2 barak panjang berkaca (barat & timur) + gedung komando di utara
  const barak = (bx, nama) => {
    const W = 12, D = 26, H = 4.2, z0 = 2;
    K.b(W + 1, 0.4, D + 1, 0x9aa0a6, bx, 0.2, z0); K.b(W, 0.3, D, KREM, bx, 0.45, z0);
    const at = new THREE.Mesh(atapLimas(), M(HIJAU)); at.scale.set(W * 0.56, 2.4, D * 0.53); at.position.set(bx, H + 1.7, z0); at.castShadow = true; g.add(at);
    K.b(W, H, 0.3, KREM, bx, H / 2 + 0.4, z0 - D / 2); K.b(W, H, 0.3, KREM, bx, H / 2 + 0.4, z0 + D / 2);
    for (const sx of [-1, 1]) { K.b(0.3, 1.0, D, KREM, bx + sx * W / 2, 0.9, z0); K.k(0.06, 2.4, D, bx + sx * W / 2, 2.6, z0); K.b(0.3, 0.8, D, KREM, bx + sx * W / 2, H, z0); for (let z = z0 - D / 2 + 3; z < z0 + D / 2; z += 3) K.b(0.15, 2.4, 0.15, HIJAU, bx + sx * W / 2, 2.6, z); }
    for (let i = 0; i < 8; i++) for (const sx of [-1, 1]) { // ranjang susun + loker
      const z = z0 - D / 2 + 2.2 + i * 3, x = bx + sx * 3.6;
      dalam.b(1.0, 0.15, 2.0, 0x556b2f, x, 0.95, z); dalam.b(1.0, 0.15, 2.0, 0x556b2f, x, 2.15, z);
      for (const dz of [-0.95, 0.95]) dalam.b(0.08, 2.0, 0.08, 0x5f6b75, x - 0.45, 1.4, z + dz);
      dalam.b(0.6, 1.8, 0.6, 0x7b8086, bx + sx * 5.4, 1.35, z);
      if ((i + sx) % 3 === 0) orang(G, g, 1600 + bx + i * 2 + sx, x, 1.0, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, true, { petugas: "tentara" });
    }
    const pp = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.8), new THREE.MeshBasicMaterial({ map: teksturPapanNama(nama, "Asrama Prajurit") })); pp.position.set(bx, H - 0.3, z0 + D / 2 + 0.2); g.add(pp);
  };
  barak(-22, "BARAK A"); barak(22, "BARAK B");
  // gedung komando (utara), fasad kaca
  const W = 26, D = 10, z0 = -23, H = 4.2;
  K.b(W + 2, 0.4, D + 2, 0x9aa0a6, 0, 0.2, z0);
  for (let f = 0; f <= 2; f++) K.b(W, 0.35, D, KREM, 0, f * H + 0.4, z0);
  K.b(W, 2 * H, 0.3, KREM, 0, H + 0.4, z0 - D / 2); for (const sx of [-1, 1]) K.b(0.3, 2 * H, D, KREM, sx * W / 2, H + 0.4, z0);
  K.b(W + 0.6, 0.9, D + 0.6, HIJAU, 0, 2 * H + 0.85, z0);
  for (let f = 0; f < 2; f++) {
    const lantai = f * H + 0.58, y0 = f * H + 0.6, hh = H - 0.25;
    K.k(W, hh, 0.06, 0, y0 + hh / 2, z0 + D / 2); for (let x = -W / 2 + 2.6; x < W / 2; x += 2.6) K.b(0.14, hh, 0.14, HIJAU, x, y0 + hh / 2, z0 + D / 2);
    dalam.b(W - 0.6, 0.04, D - 0.6, 0x6b6450, 0, lantai, z0);
    if (f === 0) { dalam.b(8, 0.1, 3, 0x7a4a21, 0, lantai + 0.78, z0); dalam.n(5, 2.4, 0.06, 0x2e7d5b, 0, lantai + 2, z0 - 4.6); // meja peta + layar taktis
      for (const [x, z, ry] of [[-3, z0 - 2, 0], [3, z0 - 2, 0], [-3, z0 + 2, Math.PI], [3, z0 + 2, Math.PI], [-4.8, z0, Math.PI / 2]]) orang(G, g, 1700 + x * 3 + z, x, lantai, z, ry, false, { petugas: "tentara", aksi: "presentasi" }), (G.orang[G.orang.length - 1].ry0 = ry); }
    else for (const x of [-9, -4, 1, 6]) { dalam.b(2.2, 0.08, 1.1, 0xe8e2d6, x, lantai + 0.75, z0); dalam.n(0.7, 0.45, 0.05, 0x9fe0b0, x, lantai + 1.05, z0 - 0.4); dalam.b(0.55, 0.08, 0.55, 0x2b2d30, x, lantai + 0.5, z0 + 0.8); orang(G, g, 1720 + x, x, lantai, z0 + 0.8, Math.PI, true, { petugas: "tentara", aksi: "tulis" }); }
  }
  const papan = new THREE.Mesh(new THREE.BoxGeometry(16, 1.6, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(data.nama, "Pertahanan Negara Merdu"), roughness: 0.8 }));
  papan.position.set(0, 2 * H + 0.85, z0 + D / 2 + 0.35); g.add(papan);
  const jk = buatJam(0.6); jk.position.set(10, 2 * H + 0.85, z0 + D / 2 + 0.45); g.add(jk);
  // lapangan apel: barisan prajurit + komandan, prajurit lari keliling, kendaraan militer, menara jaga
  K.b(24, 0.06, 18, 0x8a8f6a, 0, 0.3, 4);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) orang(G, g, 1800 + r * 7 + c, -6 + c * 2, 0.33, 2 + r * 2, Math.PI, false, { petugas: "tentara" });
  orang(G, g, 1830, 0, 0.33, -2.5, 0, false, { petugas: "tentara", aksi: "presentasi" }); G.orang[G.orang.length - 1].ry0 = 0;
  for (let i = 0; i < 6; i++) pejalan(G, g, 1840 + i, { x: -11 + (i % 2) * 0.9, z: 12.5 + Math.floor(i / 2) * 0.9 }, { x: 11 + (i % 2) * 0.9, z: 12.5 + Math.floor(i / 2) * 0.9 }, 0.33, { petugas: "tentara" }); // prajurit lari pagi
  const truk = (x, z) => { K.b(2.4, 1.5, 2.2, HIJAU, x, 1.35, z + 2.6); K.b(2.0, 0.6, 1.4, 0x24323d, x, 2.0, z + 2.7); K.b(2.6, 0.5, 5, HIJAU, x, 1.0, z - 1); K.b(2.6, 2.2, 5, 0x5a6640, x, 2.4, z - 1);
    for (const [wx, wz] of [[-1.2, 2.6], [1.2, 2.6], [-1.2, -0.6], [1.2, -0.6], [-1.2, -2.4], [1.2, -2.4]]) K.c(0.5, 0.3, 0x1c1c1e, x + wx, 0.6, z + wz); };
  truk(-24, 26); truk(-18, 26);
  K.b(2.0, 0.8, 4, HIJAU, 22, 1.0, 26); K.b(1.8, 0.6, 1.6, HIJAU, 22, 1.65, 25.4); for (const [wx, wz] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) K.c(0.45, 0.3, 0x1c1c1e, 22 + wx, 0.6, 26 + wz); // jip
  for (const x of [-28, 28]) { for (const dx of [-1, 1]) for (const dz of [-1, 1]) K.b(0.2, 7, 0.2, 0x6b4a2b, x + dx, 3.8, -30 + dz); K.b(3, 0.2, 3, 0x6b4a2b, x, 7.3, -30); K.b(3.2, 0.25, 3.2, HIJAU, x, 9.4, -30); orang(G, g, 1860 + x, x, 7.4, -30, 0, false, { petugas: "tentara" }); }
  for (const x of [-6, 6]) K.b(1.4, 4.6, 1.4, HIJAU, x, 2.6, 33); K.b(13.4, 1.2, 0.9, KREM, 0, 5.3, 33);
  const pg = new THREE.Mesh(new THREE.PlaneGeometry(11, 0.95), new THREE.MeshBasicMaterial({ map: teksturPapanNama(data.nama, "Kawasan Militer") })); pg.position.set(0, 5.3, 33.5); g.add(pg);
  for (const x of [-9, 9]) { K.b(2.2, 2.6, 2.2, HIJAU, x, 1.6, 33); orang(G, g, 1870 + x, x + Math.sign(x) * -1.8, 0.33, 34.2, 0, false, { petugas: "tentara" }); }
  K.c(0.1, 11, 0xdddddd, 0, 5.8, 14.5); const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.62), new THREE.MeshBasicMaterial({ color: 0xc8102e, side: THREE.DoubleSide })); bd.position.set(0.95, 10.9, 14.5); g.add(bd);
  const bd2 = bd.clone(); bd2.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }); bd2.position.y = 10.28; g.add(bd2);
  const statis = K.jadi(g), isi = dalam.jadi(g); G.dalam.push(isi.o, isi.nl, isi.kc);
  return { W: 58, D: 36, z0: -4, statis, rintangan: [[-22, 2, 13, 27], [22, 2, 13, 27], [0, -23, 28, 12]] };
}

export function bangunGedungKaca() {
  const grup = new THREE.Group();
  for (const data of GEDUNG_KACA_BLOK) {
    const s = sudutBlok(data.kol, data.bar), cx = s.x + JALAN + (PITCH - JALAN) / 2, cz = s.z + JALAN + (PITCH - JALAN) / 2;
    const g = new THREE.Group(); g.position.set(cx, 0.245, cz); grup.add(g);
    const G = { g, dalam: [], orang: [], cx, cz };
    const r = data.jenis === "kantor" ? kantor(G, g, data) : data.jenis === "kampus" ? kampus(G, g, data) : data.jenis === "polisi" ? markasPolisi(G, g, data) : data.jenis === "tentara" ? markasTentara(G, g, data) : sekolah(G, g, data);
    const zc = r.z0 || 0;
    if (r.rintangan) for (const [x, z, w, d] of r.rintangan) rintanganGedung.push({ minX: cx + x - w / 2, maxX: cx + x + w / 2, minZ: cz + z - d / 2, maxZ: cz + z + d / 2 });
    else rintanganGedung.push({ minX: cx - r.W / 2 - 0.5, maxX: cx + r.W / 2 + 0.5, minZ: cz + zc - r.D / 2 - 0.5, maxZ: cz + zc + r.D / 2 + 0.5 });
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
      const u = p.kar.userData;
      if (p.sit && u.lenganK) { u.lenganK.rotation.x = -1.0 + Math.sin(t * 6 + p.fase) * 0.08; u.lenganR.rotation.x = -1.0 + Math.sin(t * 6 + p.fase + 1) * 0.08; } // mengetik/menulis
      if (p.aksi === "angkat" && u.lenganR) { const c = (t * 0.25 + p.fase * 0.37) % 1; if (c < 0.18) u.lenganR.rotation.x = -2.9 + Math.sin(t * 9) * 0.15; } // mengacungkan tangan bertanya
      if (p.aksi === "guru") { // mondar-mandir di depan papan sambil menerangkan / menunjuk papan
        const ph = Math.sin(t * 0.45 + p.fase), dz = ph * p.rentang;
        const zLama = p.kar.position.z; p.kar.position.z = p.z0 + dz;
        const gerak = Math.abs(p.kar.position.z - zLama);
        animasiJalan(p.kar, gerak, dt);
        if (gerak > 0.002) p.kar.rotation.y = p.kar.position.z > zLama ? 0 : Math.PI; else p.kar.rotation.y = Math.PI / 2;
        if (u.lenganR) u.lenganR.rotation.x = -1.6 + Math.sin(t * 2.3 + p.fase) * 0.5;
      }
      if (p.aksi === "presentasi" && u.lenganR) { u.lenganR.rotation.x = -1.4 + Math.sin(t * 1.7 + p.fase) * 0.6; p.kar.rotation.y = p.ry0 + Math.sin(t * 0.6) * 0.5; }
      if (p.aksi === "lompat") { p.kar.position.y = 0.35 + Math.abs(Math.sin(t * 3.2 + p.fase)) * 0.5; if (u.lenganK) { u.lenganK.rotation.x = -2.6; u.lenganR.rotation.x = -2.6; } }
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
