/* Negara Merdu — modul game "fasilitasBaru": MODEL BARU fasilitas lama
   (perbaikan 22 Nov 2026, perintah "bangunan lama diperbaiki semua").
   Dulu tiap fasilitas = 1 kotak kecil di tengah lahan hijau kosong 68x68.
   Kini tiap blok ditata utuh: bangunan utama berdetail (alas, dinding,
   jendela berbingkai, atap bertekstur, teras/kanopi, papan nama), jalan
   masuk dari gerbang selatan, halaman/parkir, pagar semak keliling, deret
   pohon peneduh, lampu taman. Semua elemen di dalam blok (±34 lokal).
   Depan bangunan menghadap +z (selatan). Grup: y=0 = muka alas blok.
   TAPAK_BARU = AABB tabrakan [minX, minZ, maxX, maxZ] relatif pusat blok. */
import { SKALA_MOBIL } from "./inti.js";
import { LAMPU_TAMAN, M, geometriAtapPelana, meshPelana, kotak } from "./bersama.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";
import { bangkuTaman, matAtapWarna, pagarSemak, pohonKecil, teksturBenderaMerdu, teksturPapanNama } from "./fasilitas.js";

const KREM = 0xf6efdf, PUTIH = 0xfbfaf5, KAYU = 0x7a4a21, KAYU_M = 0xa9743f, BATU = 0xcfc6b0, ASPAL = 0x5c6066;
/* Titik pintu & grup Merdu Mall (diisi saat modelnya dibangun) — dipakai rumah.js/kamera.js. */
export const PINTU_MALL = [], MALL_KLIK = [];
export const PASAR_ORANG = []; // pedagang (diam) & pembeli (berjalan) Pasar Desa — dianimasikan perbaruiPasar()
const KACA = 0x9fd3e6, KUSEN = 0x5a3a20, EMAS = 0xd9a441, HIJAU_T = 0x2f7a63;

/* ---------- helper umum ---------- */
function jendela(g, x, y, z, w, h, arah, warnaKusen) { // arah: "z" (muka ±z) | "x" (muka ±x)
  const k = warnaKusen || KUSEN;
  if (arah === "x") {
    g.add(kotak(0.16, h + 0.3, w + 0.3, k, x, y, z));
    g.add(kotak(0.2, h, w, KACA, x, y, z));
    g.add(kotak(0.24, 0.08, w, k, x, y, z)); g.add(kotak(0.24, h, 0.08, k, x, y, z));
  } else {
    g.add(kotak(w + 0.3, h + 0.3, 0.16, k, x, y, z));
    g.add(kotak(w, h, 0.2, KACA, x, y, z));
    g.add(kotak(w, 0.08, 0.24, k, x, y, z)); g.add(kotak(0.08, h, 0.24, k, x, y, z));
  }
}
/* gedung: alas batu + badan + lis atas + jendela berderet di 4 sisi + pintu depan + atap pelana bertekstur. */
function gedung(g, o) {
  const { x = 0, z = 0, w, d, h, dinding = KREM, atap = 0xb5533c, lantai = 1, pintu = true, ridgeX = false, jarakJendela = 3.2 } = o;
  g.add(kotak(w + 1.2, 0.5, d + 1.2, BATU, x, 0.25, z));                 // alas
  g.add(kotak(w, h, d, dinding, x, 0.5 + h / 2, z));                     // badan
  g.add(kotak(w + 0.3, 0.45, d + 0.3, 0xe6dcc6, x, 0.5 + h - 0.2, z));   // lis atas
  for (let l = 0; l < lantai; l++) {
    const tl = h / lantai, y = 0.5 + tl * l + tl * 0.55;
    if (l > 0) g.add(kotak(w + 0.2, 0.22, d + 0.2, 0xe6dcc6, x, 0.5 + tl * l, z)); // lis antar lantai
    const nW = Math.max(1, Math.floor((w - 2) / jarakJendela)), nD = Math.max(1, Math.floor((d - 2) / jarakJendela));
    for (let i = 0; i < nW; i++) {
      const jx = x - w / 2 + (i + 0.5) * (w / nW);
      if (pintu && l === 0 && Math.abs(jx - x) < 1.8) continue; // ruang pintu
      jendela(g, jx, y, z + d / 2 + 0.02, 1.3, tl * 0.42, "z");
      jendela(g, jx, y, z - d / 2 - 0.02, 1.3, tl * 0.42, "z");
    }
    for (let i = 0; i < nD; i++) {
      const jz = z - d / 2 + (i + 0.5) * (d / nD);
      jendela(g, x + w / 2 + 0.02, y, jz, 1.3, tl * 0.42, "x");
      jendela(g, x - w / 2 - 0.02, y, jz, 1.3, tl * 0.42, "x");
    }
  }
  if (pintu) { // pintu ganda + kanopi kecil
    g.add(kotak(2.6, 3.0, 0.2, KUSEN, x, 2.0, z + d / 2 + 0.05));
    g.add(kotak(2.2, 2.7, 0.24, 0x8a5a30, x, 1.85, z + d / 2 + 0.06));
    g.add(kotak(0.06, 2.7, 0.28, KUSEN, x, 1.85, z + d / 2 + 0.07));
    g.add(kotak(4, 0.18, 2.2, 0xe6dcc6, x, 3.7, z + d / 2 + 1.1));
    g.add(kotak(4.4, 0.3, 2.6, BATU, x, 0.15, z + d / 2 + 1.3)); // anak tangga
  }
  if (atap) {
    const ap = meshPelana(geometriAtapPelana(ridgeX ? d + 1.6 : w + 1.6, Math.min(w, d) * 0.32, ridgeX ? w + 1.6 : d + 1.6), matAtapWarna(atap));
    if (ridgeX) ap.rotation.y = Math.PI / 2;
    ap.position.set(x, 0.5 + h, z); ap.castShadow = true; ap.receiveShadow = true; g.add(ap);
  }
}
function lampuTaman(g, x, z) {
  const mat = (LAMPU_TAMAN && LAMPU_TAMAN.mat) || M(0xffe2ae);
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.6, 8), M(0x455a64)); t.position.set(x, 1.3, z); g.add(t);
  const k = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), mat); k.position.set(x, 2.85, z); g.add(k);
  const tp = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 4), M(0x455a64)); tp.position.set(x, 3.25, z); tp.rotation.y = Math.PI / 4; g.add(tp);
}
/* lingkungan blok: pagar semak (gerbang selatan selebar 2*lebarGerbang), jalan masuk, pohon keliling. */
function lingkungan(g, o) {
  const { lebarGerbang = 4, jalanSampai = 10, pohon = true, lampu = true, lebarJalan = 5 } = o || {};
  pagarSemak(g, 33.6, { s: [[-lebarGerbang, lebarGerbang]] });
  g.add(kotak(lebarJalan, 0.1, 34 - jalanSampai, BATU, 0, 0.05, (34 + jalanSampai) / 2));
  for (const s of [-1, 1]) { // tiang gerbang + bola
    g.add(kotak(0.8, 1.8, 0.8, 0xe6dcc6, s * (lebarGerbang + 0.4), 0.9, 33.6));
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), M(EMAS, 0.4)); bola.position.set(s * (lebarGerbang + 0.4), 2.05, 33.6); g.add(bola);
    if (lampu) for (const lz of [30, 22]) if (lz > jalanSampai + 2) lampuTaman(g, s * (lebarJalan / 2 + 1), lz);
  }
  if (pohon) {
    for (let i = -3; i <= 3; i++) {
      g.add(pohonKecil(-30.5, i * 9.2, 0.95)); g.add(pohonKecil(30.5, i * 9.2, 0.95));
      if (i !== 0) g.add(pohonKecil(i * 9.2, -30.5, 0.95));
    }
  }
}
function papanDepan(g, judul, sub, x, z, skala) {
  const p = new THREE.Group();
  p.add(kotak(12, 0.6, 1.2, BATU, 0, 0.3, 0));
  const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(judul, sub), roughness: 0.85 }));
  panel.position.y = 1.85; panel.castShadow = true; p.add(panel);
  p.position.set(x, 0, z); p.scale.setScalar(skala || 0.8); g.add(p);
}
function parkir(g, x, z, n, arahX) { // deret garis parkir di atas aspal
  const L = n * 3.2;
  g.add(kotak(arahX ? 7 : L + 1, 0.08, arahX ? L + 1 : 7, ASPAL, x, 0.06, z)); // petak 3,2 x 6: muat mobil SKALA_MOBIL (2,6 x 5,7)
  for (let i = 0; i <= n; i++) {
    const o = -L / 2 + i * 3.2;
    g.add(kotak(arahX ? 6 : 0.15, 0.1, arahX ? 0.15 : 6, 0xf4f1e6, x + (arahX ? 0 : o), 0.07, z + (arahX ? o : 0)));
  }
}
function mobil(g, x, z, ry, warna) {
  const m = new THREE.Group();
  m.add(kotak(1.9, 0.8, 4.2, warna, 0, 0.75, 0));
  m.add(kotak(1.7, 0.7, 2.3, warna, 0, 1.5, -0.2));
  m.add(kotak(1.75, 0.55, 2.0, 0x2a3a46, 0, 1.52, -0.2));
  for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), M(0x222222)); r.rotation.z = Math.PI / 2; r.position.set(wx, 0.38, wz); m.add(r);
  }
  m.position.set(x, 0, z); m.rotation.y = ry || 0; m.scale.setScalar(SKALA_MOBIL); g.add(m); // skala sama dengan mobil kota
  return m;
}
function tiangBendera(g, x, z) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 10), M(0xdddddd, 0.4)); t.position.set(x, 4.5, z); g.add(t);
  g.add(kotak(2.2, 0.4, 2.2, BATU, x, 0.2, z));
  const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: teksturBenderaMerdu(), side: THREE.DoubleSide, roughness: 0.9 }));
  b.position.set(x + 1.25, 7.9, z); g.add(b);
}

/* State animasi Apartemen Residensia 10 (lift kaca + pintu geser +
   air kolam rooftop) — diisi apartemen() saat gedungnya dibangun;
   selama belum terbangun kabin null dan perbaruiApartemen() kembali. */
const LIFT_APT = { kabin: null, pintuKabinKiri: null, pintuKabinKanan: null, pintuLantai: [], airKolam: null, lantai: 0, tujuan: 4, fase: "diam", timer: 1.5, bukaan: 0, ySaatIni: 0.5 };

export const MODEL_BARU = {
  /* ===== LAPANGAN BOLA: stadion mini ===== */
  lapangan(g) {
    g.add(kotak(60, 0.08, 46, 0xa8553a, 0, 0.04, 0));       // lintasan lari merah bata
    for (let i = 1; i < 4; i++) { // garis lintasan
      g.add(kotak(60 - i * 1.6, 0.1, 0.12, 0xf4f1e6, 0, 0.05, -23 + i * 0.8)); g.add(kotak(60 - i * 1.6, 0.1, 0.12, 0xf4f1e6, 0, 0.05, 23 - i * 0.8));
    }
    // rumput bergaris (pola potong) + garis lapangan
    for (let i = 0; i < 10; i++) g.add(kotak(4.6, 0.12, 30, i % 2 ? 0x5fae52 : 0x529c48, -20.7 + i * 4.6, 0.06, 0));
    const W = 0xffffff;
    g.add(kotak(44, 0.05, 0.4, W, 0, 0.145, -14)); g.add(kotak(44, 0.05, 0.4, W, 0, 0.145, 14));
    g.add(kotak(0.4, 0.05, 28, W, -22, 0.145, 0)); g.add(kotak(0.4, 0.05, 28, W, 22, 0.145, 0));
    g.add(kotak(0.4, 0.05, 28, W, 0, 0.145, 0));
    const lingkar = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 32), new THREE.MeshBasicMaterial({ color: W, side: THREE.DoubleSide }));
    lingkar.rotation.x = -Math.PI / 2; lingkar.position.y = 0.15; g.add(lingkar);
    for (const s of [-1, 1]) {
      g.add(kotak(0.4, 0.05, 14, W, s * 16, 0.145, 0)); g.add(kotak(6, 0.05, 0.4, W, s * 19, 0.145, -7)); g.add(kotak(6, 0.05, 0.4, W, s * 19, 0.145, 7)); // kotak penalti
      // gawang + jaring
      g.add(kotak(0.22, 2.6, 0.22, W, s * 22, 1.3, -3.4)); g.add(kotak(0.22, 2.6, 0.22, W, s * 22, 1.3, 3.4)); g.add(kotak(0.22, 0.22, 7, W, s * 22, 2.6, 0));
      const jaring = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 6.8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, wireframe: true }));
      jaring.position.set(s * 22.9, 1.3, 0); g.add(jaring);
      // tribun berundak (utara & selatan) dengan kursi berwarna
      const zt = s * 27.5;
      for (let r = 0; r < 4; r++) {
        g.add(kotak(40, 0.6, 1.4, 0xb9b2a2, 0, 0.3 + r * 0.6, zt + s * r * 1.3));
        for (let k = -18; k <= 18; k += 1.5) g.add(kotak(1.0, 0.35, 0.6, [0x2e7d46, 0xf2c230, 0x2e7d46, 0xffffff][r], k, 0.75 + r * 0.6, zt + s * r * 1.3));
      }
      // atap tribun
      for (const kx of [-19, -6.5, 6.5, 19]) g.add(kotak(0.3, 6.5, 0.3, 0x7b8086, kx, 3.25, zt + s * 5));
      const atapT = kotak(41, 0.25, 6.4, HIJAU_T, 0, 6.6, zt + s * 2.3); atapT.rotation.x = s * 0.12; g.add(atapT);
    }
    // menara lampu sorot di 4 sudut
    for (const [lx, lz] of [[-31, -21], [31, -21], [-31, 21], [31, 21]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 14, 8), M(0x7b8086)); t.position.set(lx, 7, lz); g.add(t);
      const kp = kotak(2.4, 1.4, 0.4, 0x37474f, lx, 14.2, lz); kp.lookAt(0, 0, 0); g.add(kp);
      const lam = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.1), new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff1c9, emissiveIntensity: 0.6 }));
      lam.position.set(lx * 0.985, 14.2, lz * 0.985); lam.lookAt(0, 0, 0); g.add(lam);
    }
    // papan skor + bangku pemain
    // papan skor di ujung barat (menghadap lapangan, +x)
    g.add(kotak(0.4, 5, 0.4, 0x37474f, -32.5, 2.5, -2.5)); g.add(kotak(0.4, 5, 0.4, 0x37474f, -32.5, 2.5, 2.5));
    g.add(kotak(0.5, 2.6, 7, 0x1b1f22, -32.5, 5.6, 0));
    g.add(kotak(0.1, 1, 2, 0xf2c230, -32.2, 5.6, -1.6)); g.add(kotak(0.1, 1, 2, 0xf2c230, -32.2, 5.6, 1.6));
    for (const s of [-1, 1]) {
      g.add(kotak(6, 2.2, 0.15, 0x9fd3e6, s * 8, 1.1, -16.6)); g.add(kotak(6, 0.5, 1.2, 0x2e7d46, s * 8, 0.25, -16));
    }
    for (const [x, z] of [[-31, -31], [31, -31], [-31, 31], [31, 31]]) g.add(pohonKecil(x, z, 1.05));
  },

  /* ===== PERPUSTAKAAN: 2 lantai berportiko + taman baca ===== */
  perpustakaan(g) {
    lingkungan(g, { jalanSampai: 2 });
    g.add(kotak(36, 0.12, 12, BATU, 0, 0.06, 6)); // pelataran
    gedung(g, { z: -9, w: 24, d: 14, h: 9, lantai: 2, dinding: 0xf3e3c4, atap: 0x8a4b2f, ridgeX: false });
    // portiko kolom
    g.add(kotak(12, 0.6, 4.4, BATU, 0, 0.3, 0.4));
    for (let i = 0; i < 5; i++) {
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 6.4, 14), M(PUTIH)); k.position.set(-4.8 + i * 2.4, 3.8, 1.8); k.castShadow = true; g.add(k);
    }
    g.add(kotak(12.6, 0.6, 4.6, 0xe6dcc6, 0, 7.2, 0.4));
    const ped = meshPelana(geometriAtapPelana(4.6, 1.6, 12.6), M(0xe6dcc6)); ped.rotation.y = Math.PI / 2; ped.position.set(0, 7.5, 0.4); ped.castShadow = true; g.add(ped);
    const papan = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanNama("PERPUSTAKAAN", "NEGARA MERDU"), roughness: 0.9 }));
    papan.position.set(0, 6.4, 2.75); g.add(papan);
    // taman baca: bangku melingkar + rak buku luar + payung
    for (const s of [-1, 1]) {
      g.add(bangkuTaman(s * 11, 9, 0)); g.add(bangkuTaman(s * 11, 14, Math.PI));
      g.add(kotak(2.4, 1.8, 0.6, KAYU_M, s * 16, 0.9, 11.5));
      for (let b = 0; b < 6; b++) g.add(kotak(0.25, 0.5, 0.4, [0xd9462e, 0x3f6fb5, 0xe8c268, 0x43a06a][b % 4], s * 16 - 0.9 + b * 0.35, 1.45, 11.6));
      const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 6), M(KAYU)); tp.position.set(s * 11, 1.4, 11.5); g.add(tp);
      const py = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.8, 8), M(s < 0 ? 0xe86a5e : 0x57b7d6)); py.position.set(s * 11, 3, 11.5); g.add(py);
    }
    papanDepan(g, "PERPUSTAKAAN DESA", "Buka setiap hari", 12, 28, 0.6);
  },

  /* ===== BALAI WARGA: pendopo joglo + kantor kecil + parkir ===== */
  balai_warga(g) {
    lingkungan(g, { jalanSampai: 6 });
    g.add(kotak(24, 1.0, 20, BATU, 0, 0.5, -4)); // lantai pendopo tinggi
    g.add(kotak(24.6, 0.12, 20.6, 0xa9743f, 0, 1.06, -4));
    for (let t = 0; t < 3; t++) g.add(kotak(6, 0.35, 1, BATU, 0, 0.17 + t * 0.33, 6.6 + (2 - t) * 0.9)); // undakan depan
    for (const x of [-10, -5, 0, 5, 10]) for (const z of [-12.5, -4, 4.5]) {
      if (z === -4 && Math.abs(x) < 6) continue;
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 5.6, 12), M(KAYU)); k.position.set(x, 3.9, z); k.castShadow = true; g.add(k);
      g.add(kotak(0.9, 0.3, 0.9, BATU, x, 1.25, z));
    }
    for (const x of [-2.5, 2.5]) for (const z of [-7, -1]) { // soko guru
      const k = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 7.6, 12), M(0x6b3e1f)); k.position.set(x, 4.9, z); g.add(k);
    }
    // atap joglo bertingkat (3 limas bertumpuk)
    for (const [w, d, y, tg] of [[28, 24, 6.7, 2.2], [16, 13, 8.7, 2.4], [8, 6.5, 10.9, 3.4]]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2, tg, 4), matAtapWarna(0x6e3b26));
      a.rotation.y = Math.PI / 4; a.scale.set(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
      a.position.set(0, y + tg / 2, -4); a.castShadow = true; g.add(a);
    }
    // isi pendopo: tikar + kursi baris + meja depan
    g.add(kotak(10, 0.05, 6, 0xc94f3d, 0, 1.14, -1));
    for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) {
      g.add(kotak(0.8, 0.1, 0.8, 0xe8c268, c * 1.4, 1.6, -8 + r * 1.6)); g.add(kotak(0.8, 0.8, 0.1, KAYU, c * 1.4, 2.0, -7.6 + r * 1.6));
    }
    g.add(kotak(4, 1, 1.2, KAYU, 0, 1.6, -11.5));
    // kantor kecil + bendera + parkir
    gedung(g, { x: -22, z: 14, w: 10, d: 8, h: 4.2, dinding: 0xf1e8d2, atap: 0xb5533c, pintu: true });
    tiangBendera(g, 9, 14);
    parkir(g, 20, 16, 4, true);
    mobil(g, 20, 14.4, Math.PI / 2, 0xd9462e); mobil(g, 20, 20.8, Math.PI / 2, 0x3f6fb5); // tepat di tengah petak
    papanDepan(g, "BALAI WARGA", "Pendopo Negara Merdu", -12, 28, 0.6);
  },

  /* ===== SEKOLAH DASAR: gedung U 2 lantai + lapangan upacara ===== */
  sekolah(g) {
    g.add(kotak(6, 0.1, 18, BATU, 0, 0.05, 25)); // jalan masuk dari gerbang ke lapangan upacara
    gedung(g, { z: -22, w: 40, d: 9, h: 8, lantai: 2, dinding: 0xf7f1e1, atap: 0xc0392b });
    for (const s of [-1, 1]) gedung(g, { x: s * 22, z: -5, w: 9, d: 24, h: 8, lantai: 2, dinding: 0xf7f1e1, atap: 0xc0392b, pintu: false });
    // koridor beratap di sisi dalam
    for (let i = 0; i < 7; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.6, 8), M(PUTIH)); k.position.set(-15 + i * 5, 2.3, -16.2); g.add(k); }
    g.add(kotak(36, 0.2, 3, 0xc0392b, 0, 4.2, -16.8));
    // lapangan upacara + tiang bendera + ring basket
    g.add(kotak(28, 0.1, 18, 0xbdb6a6, 0, 0.05, 2));
    for (let i = 0; i < 6; i++) g.add(kotak(0.2, 0.11, 18, 0xf4f1e6, -12.5 + i * 5, 0.06, 2));
    tiangBendera(g, 0, -10);
    for (const s of [-1, 1]) {
      g.add(kotak(0.25, 4, 0.25, 0x37474f, s * 13, 2, 2)); g.add(kotak(0.12, 1.2, 1.8, 0xffffff, s * 12.7, 4.2, 2));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 16), M(0xe86a3e)); ring.rotation.x = Math.PI / 2; ring.position.set(s * 12.2, 3.8, 2); g.add(ring);
    }
    // pagar besi depan + gerbang berpapan
    pagarSemak(g, 33.6, { s: [[-34, 34]] });
    for (let x = -33; x <= 33; x += 1.5) if (Math.abs(x) > 4.5) g.add(kotak(0.12, 1.8, 0.12, 0x2e7d46, x, 0.9, 33.4));
    g.add(kotak(66, 0.15, 0.15, 0x2e7d46, 0, 1.7, 33.4));
    for (const s of [-1, 1]) g.add(kotak(0.8, 4.2, 0.8, 0xe6dcc6, s * 4.8, 2.1, 33.4));
    const pg = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.6, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama("SD NEGERI MERDU", "Tut Wuri Handayani"), roughness: 0.9 }));
    pg.position.set(0, 4.6, 33.4); g.add(pg);
    for (const [x, z] of [[-30, 14], [30, 14], [-30, 24], [30, 24], [-14, 24], [14, 24]]) g.add(pohonKecil(x, z, 1.0));
    for (const s of [-1, 1]) g.add(bangkuTaman(s * 9, 14, 0));
  },

  /* ===== PUSKESMAS: klinik berkanopi + ambulans + taman ===== */
  puskesmas(g) {
    lingkungan(g, { jalanSampai: 6, lebarJalan: 7 });
    gedung(g, { z: -10, w: 30, d: 14, h: 5, dinding: PUTIH, atap: 0x2f7a63, pintu: true });
    gedung(g, { x: -12, z: -10, w: 8, d: 15, h: 7.5, dinding: 0xf2f7f5, atap: null, pintu: false }); // menara 2 lantai (ruang rawat)
    g.add(kotak(9, 0.5, 16, 0xe6dcc6, -12, 8.2, -10));
    // tanda palang merah di atap & dinding
    for (const [x, y, z, s] of [[-12, 9.2, -10, 1.6], [6, 4.2, -2.85, 1]]) {
      g.add(kotak(3 * s, 0.9 * s, 0.25, 0xd63b2f, x, y, z)); g.add(kotak(0.9 * s, 3 * s, 0.25, 0xd63b2f, x, y, z));
    }
    g.add(kotak(9, 1.2, 0.3, PUTIH, -12, 9.2, -10.1));
    g.add(kotak(3, 0.9, 0.3, 0xd63b2f, -12, 9.2, -9.9)); g.add(kotak(0.9, 3, 0.3, 0xd63b2f, -12, 9.2, -9.9));
    // kanopi drop-off ambulans
    g.add(kotak(12, 0.35, 8, 0xe6dcc6, 4, 4.3, 0.5));
    for (const x of [-1.6, 9.6]) g.add(kotak(0.4, 4.1, 0.4, PUTIH, x, 2.05, 4.2));
    const pn = new THREE.Mesh(new THREE.BoxGeometry(10, 1.1, 0.25), new THREE.MeshStandardMaterial({ map: teksturPapanNama("PUSKESMAS", "Negara Merdu Sehat"), roughness: 0.9 }));
    pn.position.set(4, 5.1, 4.55); g.add(pn);
    const amb = mobil(g, 4, 2, 0, 0xffffff);
    amb.add(kotak(2.0, 1.6, 2.4, 0xffffff, 0, 1.6, 1.1)); amb.add(kotak(2.02, 0.3, 4.22, 0xd63b2f, 0, 1.0, 0));
    amb.add(kotak(0.6, 0.2, 0.4, 0x3f6fb5, 0, 2.5, -0.6));
    parkir(g, -18, 14, 5, false); mobil(g, -24.4, 14, 0, 0x8a8f94); mobil(g, -14.8, 14, 0, 0xe8c268);
    // taman obat + bangku tunggu
    for (const [x, z] of [[16, 14], [22, 14], [16, 20], [22, 20]]) {
      g.add(kotak(4.5, 0.4, 4.5, 0x7a5a38, x, 0.2, z));
      for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), M([0x4da653, 0x6aa84f, 0x8bc34a][i % 3])); t.position.set(x - 1.1 + (i % 2) * 2.2, 0.8, z - 1.1 + Math.floor(i / 2) * 2.2); g.add(t); }
    }
    for (const s of [-1, 1]) g.add(bangkuTaman(s * 8 + 4, 7.5, Math.PI));
  },

  /* ===== PASAR DESA: los beratap panjang + lapak tenda + parkir ===== */
  /* ===== PASAR DESA MERDU (dibangun ulang, perintah "buatkan pasar"):
     pasar tradisional hidup — gapura bernama, LOS UTAMA beratap susun
     (ventilasi) dengan 4 lorong lapak: sayur, buah, ikan (di atas es),
     daging, bumbu, beras, telur, kelontong; tiap lapak berpapan nama &
     berpedagang; PEMBELI berjalan menyusuri lorong; lampu gantung; lapak
     tenda jajanan di halaman, gerobak bakso, becak, parkir motor & mobil.
     Pasar terbuka — pemain bisa langsung berjalan masuk. ===== */
  pasar(g) {
    lingkungan(g, { jalanSampai: 18, lebarJalan: 8, pohon: false });
    g.add(kotak(60, 0.12, 50, 0xbdb6a6, 0, 0.06, -6)); // pelataran pasar
    // gapura depan
    for (const s of [-1, 1]) { g.add(kotak(1.2, 6, 1.2, 0xc8102e, s * 5.5, 3, 31)); g.add(kotak(1.6, 0.5, 1.6, 0xd9a441, s * 5.5, 6.2, 31)); }
    const gp = new THREE.Mesh(new THREE.BoxGeometry(12.6, 1.8, 0.4), new THREE.MeshStandardMaterial({ map: teksturPapanNama("PASAR DESA MERDU", "Segar · Murah · Merdu"), roughness: 0.8 }));
    gp.position.set(0, 6.6, 31); g.add(gp);
    // LOS UTAMA: 48 x 26, kolom baja, atap susun (bawah + ventilasi atas)
    const LZ = -12, LW = 48, LD = 26;
    for (let x = -LW / 2; x <= LW / 2; x += 6) for (const z of [LZ - LD / 2, LZ, LZ + LD / 2]) g.add(kotak(0.45, 6, 0.45, 0x6e7378, x, 3, z));
    const atap1 = meshPelana(geometriAtapPelana(LD + 3, 3.2, LW + 3), matAtapWarna(0x2f6f8f)); atap1.rotation.y = Math.PI / 2; atap1.position.set(0, 6, LZ); atap1.castShadow = true; g.add(atap1);
    const atap2 = meshPelana(geometriAtapPelana(8, 1.6, LW + 1), matAtapWarna(0x245a75)); atap2.rotation.y = Math.PI / 2; atap2.position.set(0, 9.6, LZ); g.add(atap2);
    for (const x of [-LW / 2, LW / 2]) g.add(kotak(0.3, 1.4, 8, 0x6e7378, x, 9.0, LZ)); // dinding ventilasi
    g.add(kotak(LW + 1, 0.15, LD + 1, 0xd8d2c6, 0, 0.14, LZ)); // lantai los
    const papanLos = new THREE.Mesh(new THREE.BoxGeometry(14, 1.4, 0.25), new THREE.MeshStandardMaterial({ map: teksturPapanNama("LOS UTAMA", "Sayur · Buah · Ikan · Daging · Sembako"), roughness: 0.8 }));
    papanLos.position.set(0, 6.6, LZ + LD / 2 + 0.3); g.add(papanLos);
    // komoditas
    const bola = (w, r, x, y, z, sy) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(w)); m.position.set(x, y, z); if (sy) m.scale.y = sy; g.add(m); };
    const KOMODITAS = {
      sayur(x, z) { for (let i = 0; i < 4; i++) bola(0x6aa84f, 0.32, x - 1.5 + i, 1.2, z, 0.85); for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 6), M(0xe8742a)); c.rotation.z = Math.PI / 2; c.position.set(x - 1.4 + i * 0.5, 1.05, z + 0.5); g.add(c); } for (let i = 0; i < 8; i++) bola(0xd9201a, 0.07, x - 1 + i * 0.28, 1.05, z - 0.5); },
      buah(x, z) { for (let i = 0; i < 5; i++) bola(0xf2a33a, 0.22, x - 1.6 + i * 0.4, 1.1, z - 0.3); bola(0x2e7d32, 0.45, x + 1.3, 1.3, z + 0.2); for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), M(0xf2d13d)); p.rotation.z = 1.2; p.position.set(x - 1 + i * 0.25, 1.15, z + 0.45); g.add(p); } },
      ikan(x, z) { g.add(kotak(3.6, 0.12, 1.4, 0xeaf6fb, x, 0.98, z)); for (let i = 0; i < 6; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), M([0x9aa7b4, 0xc0c8d0][i % 2])); f.scale.set(0.5, 0.45, 1.6); f.position.set(x - 1.4 + i * 0.55, 1.12, z); f.rotation.y = 0.3; g.add(f); } },
      daging(x, z) { for (let i = 0; i < 4; i++) g.add(kotak(0.6, 0.25, 0.45, 0xb0302c, x - 1.2 + i * 0.8, 1.05, z)); g.add(kotak(3.8, 0.08, 0.08, 0x8a8f94, x, 2.6, z - 0.4)); for (let i = 0; i < 3; i++) g.add(kotak(0.35, 0.8, 0.25, 0xc04a3c, x - 1 + i, 2.1, z - 0.4)); },
      bumbu(x, z) { const W = [0xd9201a, 0xf2c230, 0x8a4b2f, 0xe8742a, 0x6aa84f, 0xf6f0e0]; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 10), M(W[i])); m.position.set(x - 1.5 + i * 0.6, 1.08, z); g.add(m); } },
      beras(x, z) { for (let i = 0; i < 6; i++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.7, 10), M(0xf4efe2)); k.position.set(x - 1.5 + (i % 3) * 1.2, 1.25 + Math.floor(i / 3) * 0.6, z - 0.2 + Math.floor(i / 3) * 0.3); g.add(k); } },
      telur(x, z) { for (let t = 0; t < 3; t++) { g.add(kotak(1.0, 0.08, 1.0, 0xc9a26b, x - 1.2 + t * 1.2, 0.98, z)); for (let i = 0; i < 9; i++) bola(0xf3e3c4, 0.08, x - 1.5 + t * 1.2 + (i % 3) * 0.3, 1.08, z - 0.3 + Math.floor(i / 3) * 0.3, 1.25); } },
      kelontong(x, z) { const W = [0xe14b2f, 0x3f6fb5, 0xf2c230, 0x2e9e5b]; for (let i = 0; i < 8; i++) g.add(kotak(0.4, 0.5, 0.35, W[i % 4], x - 1.5 + (i % 4) * 1.0, 1.15 + Math.floor(i / 4) * 0.5, z)); },
    };
    const JENIS = ["sayur", "buah", "ikan", "daging", "bumbu", "beras", "telur", "kelontong"];
    const PEDAGANG = ["Bu Siti", "Pak Darto", "Bu Ani", "Mas Joko", "Bu Tini", "Pak Udin", "Mbak Rini", "Pak Slamet"];
    const BAJU = ["#e74c3c", "#3498db", "#f1c40f", "#2e9e5b", "#9b59b6", "#e67e22", "#1abc9c", "#795548"];
    let n = 0;
    for (const z of [LZ - 8.5, LZ - 2.5, LZ + 3.5, LZ + 9]) { // 4 deret lapak (lorong di antaranya)
      const hadap = z < LZ ? 1 : -1; // pedagang di belakang meja, menghadap lorong
      for (let x = -18; x <= 18; x += 7.2) {
        const jenis = JENIS[n % JENIS.length];
        g.add(kotak(4.4, 0.9, 1.8, 0xa9743f, x, 0.45, z));
        KOMODITAS[jenis](x, z);
        const papan = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.6, 0.08), new THREE.MeshStandardMaterial({ map: teksturPapanNama(jenis.toUpperCase(), PEDAGANG[n % PEDAGANG.length]), roughness: 0.85 }));
        papan.position.set(x, 3.0, z); papan.rotation.y = hadap > 0 ? 0 : Math.PI; g.add(papan);
        g.add(kotak(0.05, 1.0, 0.05, 0x333333, x, 4.0, z));
        const lampu = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd889, emissiveIntensity: 0.8 })); lampu.position.set(x, 3.45, z + hadap * 0.4); g.add(lampu);
        if (n % 3 !== 2) { // pedagang
          const p = buatKarakter({ baju: BAJU[n % BAJU.length], kulit: ["#c68642", "#e0ac69", "#8d5524"][n % 3], topi: n % 4 === 0 ? "hijab" : n % 4 === 1 ? "peci" : "tanpa" });
          p.scale.setScalar(1.3); p.position.set(x + 1.4, 0.15, z - hadap * 1.6); p.rotation.y = hadap > 0 ? 0 : Math.PI; g.add(p);
          PASAR_ORANG.push({ kar: p, diam: true });
        }
        n++;
      }
    }
    // pembeli menyusuri lorong (jalur keliling antar deret)
    const lorong = [[LZ - 5.5, -22, 22], [LZ + 0.5, 22, -22], [LZ + 6.3, -22, 22]];
    for (let i = 0; i < 9; i++) {
      const [lz, x0, x1] = lorong[i % 3];
      const k = buatKarakter({ baju: BAJU[(i + 3) % BAJU.length], kulit: ["#f1c27d", "#c68642", "#e0ac69"][i % 3], topi: i % 3 === 0 ? "hijab" : "tanpa" });
      k.scale.setScalar(1.3); g.add(k);
      if (i % 2 === 0) { const kantong = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.25), M(0xe14b2f)); kantong.position.set(0.5, 0.75, 0.1); k.add(kantong); }
      PASAR_ORANG.push({ kar: k, lz, x0, x1, s: (i * 7.3) % Math.abs(x1 - x0), v: 1.8 + (i % 3) * 0.35, arah: 1 });
    }
    // halaman: lapak tenda jajanan
    const WARNA_TENDA = [0xe14b2f, 0xf2c230, 0x2e9e5b, 0x3f6fb5, 0xe86a9e, 0xe8943a];
    for (let i = 0; i < 6; i++) {
      const x = -24 + i * 9.6, z = 8 + (i % 2) * 0.5;
      for (const [px, pz] of [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]]) g.add(kotak(0.15, 2.6, 0.15, 0x6e7378, x + px, 1.3, z + pz));
      const atap = meshPelana(geometriAtapPelana(4.2, 0.9, 3.8), M(WARNA_TENDA[i])); atap.position.set(x, 2.6, z); atap.castShadow = true; g.add(atap);
      g.add(kotak(3.4, 0.8, 1.4, KAYU_M, x, 0.4, z + 0.6));
      for (let k = 0; k < 3; k++) g.add(kotak(0.8, 0.5, 0.6, 0xc9a26b, x - 1 + k, 1.05, z + 0.6));
    }
    // gerobak bakso + becak
    const gerobak = new THREE.Group(); gerobak.add(kotak(2.2, 1.2, 1.1, 0xf2f2ee, 0, 1.2, 0)); gerobak.add(kotak(2.4, 0.12, 1.3, 0xc8102e, 0, 2.5, 0));
    for (const s of [-1, 1]) { gerobak.add(kotak(0.08, 1.3, 0.08, 0x8a8f94, s * 1.1, 1.85, 0.5)); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.15, 12), M(0x333333)); r.rotation.x = Math.PI / 2; r.position.set(s * 0.8, 0.45, 0.6); gerobak.add(r); }
    const pg = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.6), new THREE.MeshStandardMaterial({ map: teksturPapanNama("BAKSO", "Pak Kumis") })); pg.position.set(0, 1.3, 0.56); gerobak.add(pg);
    gerobak.position.set(14, 0, 16); g.add(gerobak);
    const becak = new THREE.Group();
    becak.add(kotak(1.4, 0.9, 1.0, 0x2e7d46, 0, 1.0, 0.8)); becak.add(kotak(1.4, 1.0, 0.15, 0x2e7d46, 0, 1.6, 1.3));
    const kap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc8102e)); kap.scale.set(0.9, 0.9, 0.7); kap.position.set(0, 1.9, 0.9); becak.add(kap);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16), M(0x222222)); r.rotation.y = Math.PI / 2; r.position.set(s * 0.75, 0.4, 0.8); becak.add(r); }
    const rb = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 16), M(0x222222)); rb.rotation.y = Math.PI / 2; rb.position.set(0, 0.4, -0.9); becak.add(rb);
    becak.add(kotak(0.1, 0.1, 1.8, 0x333333, 0, 0.7, -0.1)); becak.add(kotak(0.5, 0.1, 0.4, 0x333333, 0, 1.3, -0.8));
    becak.position.set(-12, 0, 18); becak.rotation.y = 0.6; g.add(becak);
    // parkir motor (deret) + mobil
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Group(), w = [0xc8102e, 0x1d1d1f, 0x3f6fb5, 0xf2f2ee][i % 4];
      m.add(kotak(0.35, 0.5, 1.5, w, 0, 0.75, 0)); m.add(kotak(0.3, 0.15, 0.7, 0x1d1d1f, 0, 1.05, -0.2));
      for (const z of [-0.65, 0.65]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 14), M(0x222222)); r.rotation.y = Math.PI / 2; r.position.set(0, 0.33, z); m.add(r); }
      m.add(kotak(0.7, 0.06, 0.06, 0x8a8f94, 0, 1.2, 0.6));
      m.position.set(20 + (i % 5) * 1.2, 0.1, 20 + Math.floor(i / 5) * 2.6); g.add(m);
    }
    parkir(g, -20, 24, 4, false); mobil(g, -24.8, 24, 0, 0x3f6fb5); mobil(g, -15.2, 24, 0, 0xe8c268);
    for (const [x, z] of [[-31, -30], [31, -30], [-31, 30], [31, 30]]) g.add(pohonKecil(x, z, 1.0));
  },


  /* ===== MASJID: kubah besar, 4 kubah kecil, 2 menara, serambi, tempat wudhu, kolam ===== */
  masjid(g) {
    lingkungan(g, { jalanSampai: 10, lebarJalan: 6 });
    g.add(kotak(50, 0.14, 44, 0xece6d6, 0, 0.07, -3)); // halaman marmer
    // aula utama
    g.add(kotak(24, 0.7, 18, BATU, 0, 0.35, -10));
    g.add(kotak(22, 8, 16, PUTIH, 0, 4.7, -10));
    g.add(kotak(22.6, 0.6, 16.6, 0x2f7a63, 0, 8.9, -10)); // lis hijau
    for (let x = -9; x <= 9; x += 3) for (const s of [-1, 1]) { // jendela lengkung samping depan/belakang
      g.add(kotak(1.4, 3.2, 0.2, 0x2f6f5a, x, 4.4, -10 + s * 8.05));
      const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 16, 1, false, 0, Math.PI), M(0x2f6f5a));
      lk.rotation.z = Math.PI / 2; lk.rotation.y = Math.PI / 2; lk.position.set(x, 6.0, -10 + s * 8.05); g.add(lk);
    }
    for (let z = -16; z <= -4; z += 3) for (const s of [-1, 1]) g.add(kotak(0.2, 3.2, 1.4, 0x2f6f5a, s * 11.05, 4.4, z));
    // kubah utama (drum + kubah bawang + puncak bulan sabit)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 2.6, 24), M(PUTIH)); drum.position.set(0, 10.5, -10); drum.castShadow = true; g.add(drum);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const jw = kotak(0.8, 1.4, 0.2, 0x2f6f5a, Math.sin(a) * 5.3, 10.5, -10 + Math.cos(a) * 5.3); jw.rotation.y = a; g.add(jw); }
    const kubah = new THREE.Mesh(new THREE.SphereGeometry(5.4, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), M(0x2e8b57, 0.45));
    kubah.scale.y = 1.25; kubah.position.set(0, 11.6, -10); kubah.castShadow = true; g.add(kubah);
    const tg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 8), M(EMAS, 0.35)); tg.position.set(0, 19.4, -10); g.add(tg);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), M(EMAS, 0.35)); bola.position.set(0, 19.0, -10); g.add(bola);
    const sabit = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 20, Math.PI * 1.4), M(EMAS, 0.35)); sabit.position.set(0, 21.0, -10); sabit.rotation.z = -0.5; g.add(sabit);
    // 4 kubah kecil di sudut atap
    for (const [x, z] of [[-9, -16], [9, -16], [-9, -4], [9, -4]]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.2, 16), M(PUTIH)); d.position.set(x, 9.8, z); g.add(d);
      const k = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2e8b57, 0.45)); k.position.set(x, 10.4, z); g.add(k);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M(EMAS, 0.35)); p.position.set(x, 11.95, z); g.add(p);
    }
    // serambi berlengkung di depan
    g.add(kotak(22, 0.6, 6, BATU, 0, 0.3, 1));
    for (let i = 0; i < 6; i++) { const x = -10 + i * 4; const k = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 5.2, 14), M(PUTIH)); k.position.set(x, 3.2, 3.6); k.castShadow = true; g.add(k); }
    for (let i = 0; i < 5; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.28, 8, 20, Math.PI), M(PUTIH)); a.position.set(-8 + i * 4, 5.4, 3.6); g.add(a); }
    g.add(kotak(22.4, 1.4, 6.4, PUTIH, 0, 7.4, 1)); g.add(kotak(22.8, 0.4, 6.8, 0x2f7a63, 0, 8.25, 1));
    const papan = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanNama("MASJID AL-MERDU", "Negara Merdu"), roughness: 0.9 }));
    papan.position.set(0, 7.4, 4.25); g.add(papan);
    g.add(kotak(3.2, 4.2, 0.2, 0x6b3e1f, 0, 2.7, -1.95)); // pintu utama
    // bedug di serambi
    const bedug = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 18), M(0x8a5a30)); bedug.rotation.z = Math.PI / 2; bedug.position.set(8.5, 1.9, 1); g.add(bedug);
    g.add(kotak(0.15, 1.4, 1.6, KAYU, 7.5, 1.3, 1)); g.add(kotak(0.15, 1.4, 1.6, KAYU, 9.5, 1.3, 1));
    // 2 menara
    for (const s of [-1, 1]) {
      const x = s * 15.5, z = 4;
      g.add(kotak(3.6, 1, 3.6, BATU, x, 0.5, z));
      const bd = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 20, 8), M(PUTIH)); bd.position.set(x, 11, z); bd.castShadow = true; g.add(bd);
      for (const y of [8, 15]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.6, 0.6, 8), M(0x2f7a63)); b.position.set(x, y, z); g.add(b); }
      const atas = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 8), M(PUTIH)); atas.position.set(x, 22.1, z); g.add(atas);
      const kk = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), M(0x2e8b57, 0.45)); kk.scale.y = 1.4; kk.position.set(x, 23.2, z); g.add(kk);
      const pc = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 8), M(EMAS, 0.35)); pc.position.set(x, 25.3, z); g.add(pc);
    }
    // tempat wudhu (barat) + kolam air mancur depan
    g.add(kotak(4, 0.4, 12, BATU, -21, 0.2, -8)); g.add(kotak(4.4, 0.3, 12.4, 0x2f7a63, -21, 3.4, -8));
    for (const z of [-13, -3]) g.add(kotak(0.3, 3.2, 0.3, PUTIH, -19.2, 1.8, z));
    g.add(kotak(0.6, 1, 11, 0xd8d3c4, -22.2, 0.9, -8));
    for (let i = 0; i < 8; i++) g.add(kotak(0.12, 0.35, 0.12, 0xc0c4c8, -21.8, 1.5, -12.5 + i * 1.3)); // keran
    for (const kx of [-11, 11]) { // 2 kolam air mancur segi delapan mengapit jalan masuk
      const kolam = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.6, 8), M(BATU)); kolam.position.set(kx, 0.3, 13); g.add(kolam);
      const air = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.08, 8), new THREE.MeshStandardMaterial({ color: 0x3f98bf, roughness: 0.1 })); air.position.set(kx, 0.62, 13); g.add(air);
      const am = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.4, 10), M(BATU)); am.position.set(kx, 1.2, 13); g.add(am);
    }
    for (const s of [-1, 1]) lampuTaman(g, s * 5, 8);
    // taman kurma/pohon di halaman
    for (const [x, z] of [[-21, 10], [21, 10], [-21, 20], [21, 20], [-12, 22], [12, 22]]) g.add(pohonKecil(x, z, 0.9));
    parkir(g, 22, -12, 4, true);
  },
  /* ===== APARTEMEN RESIDENSIA 10: 10 lantai, kaca transparan, 36 unit interior 3D instanced, lift kaca & rooftop pool ===== */
  apartemen(g) {
    lingkungan(g, { jalanSampai: 12, lebarJalan: 8, lebarGerbang: 5, pohon: false });
    const BZ = -5; // pusat Z gedung (meninggalkan halaman depan luas)
    const W = 24, D = 16, T_LOBI = 4.4, T_LT = 3.2, N_HUNIAN = 9;
    const Y_MULAI = 0.5 + T_LOBI; // 4.9

    const matKaca = new THREE.MeshStandardMaterial({
      color: 0xb5e2f5, roughness: 0.08, metalness: 0.25,
      transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide,
    });
    const matTirai = new THREE.MeshStandardMaterial({
      color: 0xfbf7f0, roughness: 0.9, transparent: true, opacity: 0.65,
    });
    const matLampu = new THREE.MeshStandardMaterial({
      color: 0xfff3d4, emissive: 0xffd088, emissiveIntensity: 1.15, roughness: 0.4,
    });
    const matBaja = new THREE.MeshStandardMaterial({ color: 0x323b42, roughness: 0.4, metalness: 0.55 });
    const matPintuLift = new THREE.MeshStandardMaterial({ color: 0x8f9aa3, roughness: 0.28, metalness: 0.65 });

    // --- 1. LANTAI 1: LOBI KOMERSIAL TRANSPARAN ---
    g.add(kotak(W + 3, 0.5, D + 3, BATU, 0, 0.25, BZ));
    g.add(kotak(W, 0.12, D, 0xe8e2d5, 0, 0.56, BZ)); // lantai marmer lobi
    // 6 pilar struktural lobi
    for (const px of [-W / 2 + 0.5, 0, W / 2 - 0.5]) for (const pz of [BZ - D / 2 + 0.5, BZ + D / 2 - 0.5]) {
      g.add(kotak(0.9, T_LOBI, 0.9, 0xded8cc, px, 0.5 + T_LOBI / 2, pz));
    }
    // Dinding belakang & samping lobi + kaca transparan depan
    g.add(kotak(W, T_LOBI, 0.35, 0xeae4d7, 0, 0.5 + T_LOBI / 2, BZ - D / 2 + 0.2));
    g.add(kotak(0.35, T_LOBI, D, 0xeae4d7, -W / 2 + 0.2, 0.5 + T_LOBI / 2, BZ));
    const kacaLobiD = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.2, T_LOBI - 0.4), matKaca);
    kacaLobiD.position.set(0, 0.5 + T_LOBI / 2, BZ + D / 2 - 0.1); g.add(kacaLobiD);
    // Kanopi drop-off lobi
    g.add(kotak(10, 0.32, 4.8, 0x2f3840, 0, 4.5, BZ + D / 2 + 2.4));
    for (const sx of [-4.5, 4.5]) g.add(kotak(0.32, 4.3, 0.32, 0x2f3840, sx, 2.35, BZ + D / 2 + 4.4));
    // Interior lobi: meja resepsionis, sofa tunggu, lampu plafon
    g.add(kotak(5.2, 1.15, 1.1, 0x6b4423, 0, 1.15, BZ - 3.5));
    g.add(kotak(5.4, 0.12, 1.25, 0xf6efe0, 0, 1.75, BZ - 3.5));
    for (const sx of [-6.5, 6.5]) {
      g.add(kotak(3.2, 0.55, 1.1, 0x8b7e74, sx, 0.85, BZ + 1.8));
      g.add(kotak(1.6, 0.35, 0.9, 0x7a4a21, sx, 0.72, BZ + 3.6));
    }
    const lampuLobi = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 1.2), matLampu);
    lampuLobi.position.set(0, Y_MULAI - 0.22, BZ); g.add(lampuLobi);

    // --- 2. LANTAI 2–10: STRUKTUR BERBUKAAN NYATA + 36 UNIT INTERIOR INSTANCED ---
    const unitList = []; // 36 unit: 9 lantai x 4 unit (2 depan, 2 belakang)
    for (let lt = 0; lt < N_HUNIAN; lt++) {
      const y = Y_MULAI + lt * T_LT;
      // Pelat lantai + koridor tengah + partisi antar unit
      g.add(kotak(W + 0.8, 0.26, D + 0.8, 0xd9d3c6, 0, y, BZ));
      g.add(kotak(W - 0.6, T_LT - 0.26, 0.22, 0xf2ece0, 0, y + T_LT / 2, BZ - 1.1)); // dinding koridor utara
      g.add(kotak(W - 0.6, T_LT - 0.26, 0.22, 0xf2ece0, 0, y + T_LT / 2, BZ + 1.1)); // dinding koridor selatan
      g.add(kotak(0.24, T_LT - 0.26, D - 0.6, 0xf2ece0, 0, y + T_LT / 2, BZ));       // partisi tengah (kiri/kanan)

      // Fasad depan (+z) & belakang (-z) dengan BUKAAN FISIK NYATA
      for (const s of [-1, 1]) {
        const zMuka = BZ + s * (D / 2 - 0.15);
        // 3 Pilar vertikal (kiri, tengah, kanan) + spandrel bawah + header atas
        for (const px of [-W / 2 + 0.45, 0, W / 2 - 0.45]) {
          g.add(kotak(0.9, T_LT, 0.42, PUTIH, px, y + T_LT / 2, zMuka));
        }
        g.add(kotak(W, 0.48, 0.34, 0xe8e2d5, 0, y + 0.36, zMuka));          // spandrel bawah
        g.add(kotak(W, 0.42, 0.34, 0xe8e2d5, 0, y + T_LT - 0.21, zMuka));   // header atas

        // Kaca transparan, tirai & balkon untuk 2 unit di sisi ini
        for (const ux of [-6, 6]) {
          const kacaU = new THREE.Mesh(new THREE.PlaneGeometry(10.8, T_LT - 0.9), matKaca);
          kacaU.position.set(ux, y + T_LT / 2, zMuka); g.add(kacaU);
          // Tirai tipis di sisi dalam
          for (const ts of [-4.6, 4.6]) {
            const tr = new THREE.Mesh(new THREE.BoxGeometry(1.3, T_LT - 0.95, 0.06), matTirai);
            tr.position.set(ux + ts, y + T_LT / 2, zMuka - s * 0.22); g.add(tr);
          }
          // Balkon + railing kaca transparan
          g.add(kotak(6.2, 0.18, 1.5, 0xd9d3c6, ux, y + 0.08, zMuka + s * 0.85));
          const railK = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.88, 0.07), matKaca);
          railK.position.set(ux, y + 0.56, zMuka + s * 1.55); g.add(railK);
          g.add(kotak(6.2, 0.07, 0.10, 0x323b42, ux, y + 1.02, zMuka + s * 1.55));

          unitList.push({ x: ux, y: y + 0.14, z: BZ + s * 4.4, s, idx: unitList.length });
        }
      }
      // Dinding samping barat (-x) berjendela transparan
      g.add(kotak(0.32, T_LT, 3.6, PUTIH, -W / 2 + 0.16, y + T_LT / 2, BZ));
      g.add(kotak(0.32, 0.7, D, PUTIH, -W / 2 + 0.16, y + 0.48, BZ));
      g.add(kotak(0.32, 0.5, D, PUTIH, -W / 2 + 0.16, y + T_LT - 0.25, BZ));
      const kacaBarat = new THREE.Mesh(new THREE.PlaneGeometry(D - 1.2, T_LT - 1.1), matKaca);
      kacaBarat.rotation.y = Math.PI / 2;
      kacaBarat.position.set(-W / 2 + 0.16, y + T_LT / 2, BZ); g.add(kacaBarat);
    }

    // Instanced Interior untuk ke-36 Unit (100% 3D nyata, super hemat draw call)
    const N = unitList.length;
    const dummy = new THREE.Object3D(), col = new THREE.Color();
    const PALET_SOFA = [0xd4c3a3, 0x7a9685, 0x627385, 0xb86d52];
    const buatIM = (geo, mat, pakaiWarna) => {
      const im = new THREE.InstancedMesh(geo, mat, N);
      im.frustumCulled = false;
      g.add(im);
      return { im, pakaiWarna };
    };
    const imLantai = buatIM(new THREE.BoxGeometry(10.8, 0.05, 6.2), M(0xb88b58, 0.85));
    const imSofa   = buatIM(new THREE.BoxGeometry(2.8, 0.58, 1.05), new THREE.MeshStandardMaterial({ roughness: 0.85 }), true);
    const imMeja   = buatIM(new THREE.BoxGeometry(1.4, 0.36, 0.72), M(0x6b4423, 0.75));
    const imTV     = buatIM(new THREE.BoxGeometry(1.9, 1.05, 0.10), M(0x1b2228, 0.35));
    const imKasur  = buatIM(new THREE.BoxGeometry(2.4, 0.45, 2.2), M(0xf8f4ec, 0.9));
    const imSelim  = buatIM(new THREE.BoxGeometry(2.44, 0.12, 1.35), new THREE.MeshStandardMaterial({ roughness: 0.88 }), true);
    const imKisi   = buatIM(new THREE.BoxGeometry(3.2, 2.4, 0.10), M(0x8c5e35, 0.8)); // dinding aksen kayu
    const imLampuU = buatIM(new THREE.BoxGeometry(2.6, 0.08, 0.7), matLampu);

    unitList.forEach((u, i) => {
      const rot = u.s > 0 ? 0 : Math.PI;
      const set = (item, dx, dy, dz, warnaHex) => {
        const px = u.x + dx * (u.s > 0 ? 1 : -1), pz = u.z + dz * u.s;
        dummy.position.set(px, u.y + dy, pz);
        dummy.rotation.set(0, rot, 0);
        dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        item.im.setMatrixAt(i, dummy.matrix);
        if (item.pakaiWarna && warnaHex != null) item.im.setColorAt(i, col.setHex(warnaHex));
      };
      const wAksen = PALET_SOFA[i % PALET_SOFA.length];
      set(imLantai, 0, 0.03, 0);
      set(imSofa,  -2.6, 0.32, -0.6, wAksen);
      set(imMeja,  -2.6, 0.21,  0.9);
      set(imTV,    -2.6, 1.25,  2.2);
      set(imKasur,  2.6, 0.26, -0.5);
      set(imSelim,  2.6, 0.54,  0.0, wAksen);
      set(imKisi,   2.6, 1.30, -2.5);
      set(imLampuU, 0,   2.85,  0);
    });
    for (const it of [imLantai, imSofa, imMeja, imTV, imKasur, imSelim, imKisi, imLampuU]) {
      it.im.instanceMatrix.needsUpdate = true;
      if (it.im.instanceColor) it.im.instanceColor.needsUpdate = true;
    }

    // --- 3. ROOFTOP: INFINITY POOL, PERGOLA & TAMAN ATAP ---
    const Y_ATAP = Y_MULAI + N_HUNIAN * T_LT; // 33.7
    g.add(kotak(W + 1.0, 0.4, D + 1.0, 0xd8d2c5, 0, Y_ATAP + 0.2, BZ));
    // Parapet kaca keliling rooftop
    for (const s of [-1, 1]) {
      const pk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 1.1, 0.1), matKaca);
      pk.position.set(0, Y_ATAP + 0.95, BZ + s * (D / 2 + 0.35)); g.add(pk);
      g.add(kotak(W + 0.8, 0.08, 0.14, 0x323b42, 0, Y_ATAP + 1.52, BZ + s * (D / 2 + 0.35)));
    }
    // Infinity Pool (sisi timur-depan rooftop)
    g.add(kotak(11.6, 0.55, 6.6, 0xc9c2b2, 4.8, Y_ATAP + 0.65, BZ + 2.2));
    const airPool = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.18, 5.6),
      new THREE.MeshStandardMaterial({ color: 0x2ea8cc, emissive: 0x0c4a60, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.2 }));
    airPool.position.set(4.8, Y_ATAP + 0.92, BZ + 2.2); g.add(airPool);
    LIFT_APT.airKolam = airPool;
    // Dek kayu + 3 kursi jemur + pergola kayu
    g.add(kotak(10, 0.14, 6.6, 0x9c6b3f, -6.2, Y_ATAP + 0.47, BZ + 2.2));
    for (let i = 0; i < 3; i++) {
      g.add(kotak(1.2, 0.26, 2.6, 0xf6efe0, -9.0 + i * 2.6, Y_ATAP + 0.68, BZ + 2.2));
    }
    for (const [px, pz] of [[-10.5, BZ - 6], [-2.5, BZ - 6], [-10.5, BZ - 2], [-2.5, BZ - 2]]) {
      g.add(kotak(0.24, 3.0, 0.24, 0x6b4423, px, Y_ATAP + 1.9, pz));
    }
    for (let i = 0; i < 6; i++) g.add(kotak(8.6, 0.14, 0.22, 0x7a4a21, -6.5, Y_ATAP + 3.4, BZ - 6 + i * 0.8));
    // Ruang mesin lift di atap
    g.add(kotak(5.2, 3.2, 5.2, 0xeae4d7, 8.6, Y_ATAP + 2.0, BZ - 4.8));

    // --- 4. LIFT KACA PANORAMIK & PINTU GESER SINKRON (SISI TIMUR) ---
    const LX = W / 2 + 2.1; // x = 14.1
    const tinggiShaft = Y_ATAP + 0.4;
    // Rangka baja vertikal shaft + dinding kaca panoramik
    for (const dx of [-1.4, 1.4]) for (const dz of [-1.4, 1.4]) {
      const tiang = new THREE.Mesh(new THREE.BoxGeometry(0.18, tinggiShaft, 0.18), matBaja);
      tiang.position.set(LX + dx, tinggiShaft / 2, BZ + dz); g.add(tiang);
    }
    const kacaShaftD = new THREE.Mesh(new THREE.BoxGeometry(2.7, tinggiShaft, 2.7), matKaca);
    kacaShaftD.position.set(LX, tinggiShaft / 2, BZ); g.add(kacaShaftD);

    // Vestibul & Pintu Geser Gedung di ke-10 Lantai (Lantai 1–10)
    LIFT_APT.pintuLantai = [];
    for (let lt = 0; lt < 10; lt++) {
      const yLt = lt === 0 ? 0.5 : Y_MULAI + (lt - 1) * T_LT;
      // Jembatan vestibul dari gedung ke shaft lift
      g.add(kotak(1.6, 0.22, 2.8, 0xd9d3c6, W / 2 + 0.5, yLt, BZ));
      // Kusen pintu lift gedung
      g.add(kotak(0.16, 2.45, 2.2, 0x323b42, W / 2 + 0.72, yLt + 1.25, BZ));
      const pKiri  = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.25, 0.92), matPintuLift);
      const pKanan = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.25, 0.92), matPintuLift);
      pKiri.position.set(W / 2 + 0.76, yLt + 1.18, BZ - 0.47);
      pKanan.position.set(W / 2 + 0.76, yLt + 1.18, BZ + 0.47);
      g.add(pKiri); g.add(pKanan);
      LIFT_APT.pintuLantai.push({ kiri: pKiri, kanan: pKanan, y: yLt, bz: BZ });
    }

    // Kabin Lift Kaca + Pintu Geser Kabin
    const kabin = new THREE.Group();
    kabin.add(kotak(2.4, 0.18, 2.4, 0x323b42, 0, 0.09, 0));
    kabin.add(kotak(2.4, 0.18, 2.4, 0x323b42, 0, 2.45, 0));
    const lampuKabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.6), matLampu);
    lampuKabin.position.set(0, 2.34, 0); kabin.add(lampuKabin);
    const kacaKabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 2.2), matKaca);
    kacaKabin.position.set(0, 1.25, 0); kabin.add(kacaKabin);
    const pkKiri  = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.9), matPintuLift);
    const pkKanan = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.9), matPintuLift);
    pkKiri.position.set(-1.12, 1.22, -0.46);
    pkKanan.position.set(-1.12, 1.22, 0.46);
    kabin.add(pkKiri); kabin.add(pkKanan);
    kabin.position.set(LX, 0.5, BZ);
    g.add(kabin);
    LIFT_APT.kabin = kabin;
    LIFT_APT.pintuKabinKiri = pkKiri;
    LIFT_APT.pintuKabinKanan = pkKanan;

    // --- 5. PARKIR, MOBIL & POHON ---
    parkir(g, -18, 18, 4, false);
    mobil(g, -22.8, 18, 0, 0x3f6fb5);
    mobil(g, -13.2, 18, 0, 0xd9462e);
    mobil(g, 0, 12.5, Math.PI / 2, 0xf2f0eb); // mobil drop-off di depan lobi
    for (const [px, pz] of [[-29, -28], [29, -28], [-29, 28], [29, 28], [-29, 0], [29, 8]]) {
      g.add(pohonKecil(px, pz, 1.05));
    }
    papanDepan(g, "RESIDENSIA 10", "Apartemen Modern 10 Lantai", 13, 28, 0.65);
  },

  /* ===== KOPERASI DESA MERAH PUTIH (Kopdes): kantor koperasi + gerai
     sembako berkanopi, unit simpan pinjam, apotek desa, gudang & cold
     storage, mobil logistik, papan merah-putih, bendera. ===== */
  koperasi(g) {
    lingkungan(g, { jalanSampai: 10, lebarJalan: 7 });
    g.add(kotak(50, 0.12, 30, 0xd8d2c6, 0, 0.06, -4)); // halaman
    const MERAH = 0xc8102e;
    // kantor utama 2 lantai
    gedung(g, { z: -16, w: 26, d: 12, h: 8, lantai: 2, dinding: 0xfbfaf5, atap: MERAH });
    g.add(kotak(26.4, 1.0, 0.3, MERAH, 0, 4.2, -9.85)); g.add(kotak(26.4, 0.5, 0.3, 0xffffff, 0, 3.5, -9.85)); // pita merah-putih
    const papan = new THREE.Mesh(new THREE.BoxGeometry(18, 1.8, 0.25),
      new THREE.MeshStandardMaterial({ map: teksturPapanNama("KOPERASI DESA MERAH PUTIH", "Kopdes Negara Merdu"), roughness: 0.85 }));
    papan.position.set(0, 10.4, -9.8); g.add(papan);
    // deret unit layanan berkanopi merah (sembako · simpan pinjam · apotek)
    const UNIT = [["GERAI SEMBAKO", -14], ["SIMPAN PINJAM", 0], ["APOTEK DESA", 14]];
    for (const [nama, x] of UNIT) {
      gedung(g, { x, z: 2, w: 12, d: 7, h: 4, dinding: 0xf6efdf, atap: null, pintu: true });
      g.add(kotak(12.6, 0.3, 3.2, MERAH, x, 4.4, 6.9));
      for (const s of [-1, 1]) g.add(kotak(0.2, 4.0, 0.2, 0xb8bcc2, x + s * 6, 2.3, 8.3));
      const pn = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanNama(nama, "Kopdes"), roughness: 0.85 }));
      pn.position.set(x, 5.1, 8.5); g.add(pn);
      g.add(kotak(12.4, 0.5, 7.4, 0xe6dcc6, x, 4.75, 2));
    }
    // karung beras & peti sembako di depan gerai, timbangan
    for (let i = 0; i < 6; i++) g.add(kotak(0.9, 0.6, 0.6, 0xe9e0c8, -18 + (i % 3) * 1.0, 0.3 + Math.floor(i / 3) * 0.6, 8.8));
    for (let i = 0; i < 4; i++) g.add(kotak(0.9, 0.5, 0.7, 0xc9a26b, -12 + i * 1.0, 0.25, 9.2));
    // gudang + cold storage (barat) & mobil logistik
    gedung(g, { x: -24, z: -16, w: 9, d: 12, h: 5, dinding: 0xd8dde2, atap: 0x8a8f94, pintu: false });
    g.add(kotak(6, 4.2, 0.2, 0x9aa0a6, -24, 2.6, -9.95));
    g.add(kotak(6, 4, 6, 0xeef3f6, 24, 2.2, -16)); g.add(kotak(6.2, 0.4, 6.2, 0x3f6fb5, 24, 4.3, -16)); // cold storage
    const pnC = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.9), new THREE.MeshStandardMaterial({ map: teksturPapanNama("COLD STORAGE", "Hasil tani warga") }));
    pnC.position.set(24, 3.4, -12.95); g.add(pnC);
    const truk = new THREE.Group();
    truk.add(kotak(2.2, 1.3, 2.0, MERAH, 0, 1.2, 2.4)); truk.add(kotak(2.0, 0.6, 1.4, 0x24323d, 0, 1.9, 2.6));
    truk.add(kotak(2.4, 2.2, 4.2, 0xffffff, 0, 1.9, -0.8)); truk.add(kotak(2.42, 0.4, 4.22, MERAH, 0, 1.4, -0.8));
    for (const [wx, wz] of [[-1.1, 2.2], [1.1, 2.2], [-1.1, -1.8], [1.1, -1.8]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(wx, 0.45, wz); truk.add(r); }
    truk.position.set(-24, 0, -4); truk.scale.setScalar(SKALA_MOBIL); g.add(truk); // sebanding mobil kota
    tiangBendera(g, 18, 14); tiangBendera(g, 22, 14);
    parkir(g, 20, 22, 4, false);
    for (const s of [-1, 1]) g.add(bangkuTaman(s * 7, 14, 0));
    papanDepan(g, "KOPDES MERAH PUTIH", "Sembako · Simpan Pinjam · Apotek", -14, 28, 0.6);
  },

  /* ===== DAPUR MBG (Satuan Pelayanan Pemenuhan Gizi) — dapur Makan
     Bergizi Gratis: gedung dapur higienis, cerobong/tudung exhaust,
     dok muat berkanopi + 3 mobil boks MBG pengantar ke sekolah, troli
     tumpukan ompreng, tandon air, gudang bahan, kebun gizi. ===== */
  dapur_mbg(g) {
    lingkungan(g, { jalanSampai: 14, lebarJalan: 8 });
    gedung(g, { z: -14, w: 34, d: 16, h: 6, dinding: 0xfbfaf5, atap: 0x2f6f9f, jarakJendela: 4 });
    g.add(kotak(34.4, 1.0, 0.3, 0x2f6f9f, 0, 6.0, -5.85)); // pita biru fasad
    const papan = new THREE.Mesh(new THREE.BoxGeometry(20, 1.6, 0.25),
      new THREE.MeshStandardMaterial({ map: teksturPapanNama("DAPUR MBG", "Satuan Pelayanan Pemenuhan Gizi"), roughness: 0.85 }));
    papan.position.set(0, 7.5, -5.7); g.add(papan);
    for (const x of [-12, -4, 4, 12]) { // tudung exhaust + cerobong dapur di atap
      g.add(kotak(2.2, 1.0, 2.2, 0xb8bcc2, x, 9.6, -16));
      const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 12), M(0x9aa0a6)); cb.position.set(x, 11.4, -16); g.add(cb);
      const tp = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 12), M(0x8a8f94)); tp.position.set(x, 13.1, -16); g.add(tp);
    }
    // dok muat berkanopi di sisi timur depan
    g.add(kotak(16, 1.1, 6, BATU, 8, 0.55, -3));
    g.add(kotak(17, 0.3, 8, 0x2f6f9f, 8, 5.2, -2));
    for (const x of [0.5, 8, 15.5]) g.add(kotak(0.3, 4.1, 0.3, 0xb8bcc2, x, 3.1, 1.8));
    for (const x of [3, 8, 13]) g.add(kotak(3.2, 3.6, 0.2, 0x9aa0a6, x, 2.9, -5.95)); // pintu rolling dok
    // mobil boks pengantar MBG
    const texMBG = teksturPapanNama("MBG", "Makan Bergizi Gratis");
    for (const [x, w] of [[3, 0xffffff], [8, 0xffffff], [13, 0xffffff]]) {
      const v = new THREE.Group();
      v.add(kotak(2.1, 1.0, 2.0, 0x2f6f9f, 0, 1.0, 2.2)); v.add(kotak(2.0, 0.6, 1.4, 0x24323d, 0, 1.75, 2.4)); // kabin
      v.add(kotak(2.3, 2.4, 3.6, w, 0, 1.75, -0.8));                                                       // boks
      const sisi = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), new THREE.MeshStandardMaterial({ map: texMBG }));
      sisi.rotation.y = Math.PI / 2; sisi.position.set(1.16, 2.0, -0.8); v.add(sisi);
      const sisi2 = sisi.clone(); sisi2.rotation.y = -Math.PI / 2; sisi2.position.x = -1.16; v.add(sisi2);
      for (const [wx, wz] of [[-1.05, 2.0], [1.05, 2.0], [-1.05, -1.6], [1.05, -1.6]]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(wx, 0.42, wz); v.add(r);
      }
      v.position.set(x, 0, 5.2); v.rotation.y = Math.PI; v.scale.setScalar(SKALA_MOBIL); g.add(v); // sebanding mobil kota
    }
    // troli ompreng (tumpukan wadah makan stainless) di dok
    for (const x of [-4, -1.5]) {
      g.add(kotak(1.6, 0.1, 1.0, 0x9aa0a6, x, 0.6, 2)); for (let i = 0; i < 8; i++) g.add(kotak(1.3, 0.12, 0.8, 0xd8dde2, x, 0.75 + i * 0.16, 2));
      for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) g.add(kotak(0.06, 0.6, 0.06, 0x8a8f94, x + dx, 0.3, 2 + dz));
    }
    // tandon air + gudang bahan + kebun gizi + area cuci
    for (const x of [-26, -22]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3.4, 16), M(0x2f6f9f)); t.position.set(x, 5.7, -26); g.add(t); g.add(kotak(4, 4, 4, 0x8a8f94, x, 2, -26)); }
    gedung(g, { x: -24, z: 4, w: 10, d: 8, h: 4, dinding: 0xf1ede4, atap: 0x8a8f94 });
    for (let i = 0; i < 4; i++) {
      g.add(kotak(5, 0.35, 2.2, 0x7a5a38, -26 + (i % 2) * 7, 0.18, 16 + Math.floor(i / 2) * 4));
      for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), M([0x4da653, 0xe14b2f, 0xf2a33a][k % 3])); t.position.set(-28 + (i % 2) * 7 + k * 0.8, 0.6, 16 + Math.floor(i / 2) * 4); g.add(t); }
    }
    for (let i = 0; i < 5; i++) g.add(kotak(1.0, 0.7, 0.7, 0xc9a26b, 18 + i * 1.2, 0.35, 14)); // peti sayur
    const spanduk = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.4), new THREE.MeshStandardMaterial({ map: teksturPapanNama("MAKAN BERGIZI GRATIS", "Untuk anak sekolah Negara Merdu"), side: THREE.DoubleSide }));
    spanduk.position.set(-12, 3.2, 10); g.add(spanduk);
    for (const x of [-17, -7]) g.add(kotak(0.15, 3.9, 0.15, 0x7a4a21, x, 1.95, 10));
    parkir(g, 22, 22, 4, false);
  },

  /* ===== MERDU MALL: mall megah 2 lantai — fasad kaca, portal atrium
     tinggi, papan nama besar, atap kubah kaca, layar LED, plaza depan
     berair mancur + tiang bendera, parkir luas. Interior: mallDalam.js. ===== */
  mall(g) {
    pagarSemak(g, 33.6, { s: [[-10, 10]] });
    g.add(kotak(66, 0.12, 26, 0xd8d2c6, 0, 0.06, 20)); // plaza depan
    const W = 56, D = 34, H = 14, zc = -10;
    g.add(kotak(W + 1, 0.6, D + 1, BATU, 0, 0.3, zc));
    g.add(kotak(W, H, D, 0xe9e3d6, 0, H / 2 + 0.6, zc)); // badan batu
    // fasad kaca depan berderet + sirip vertikal
    for (let i = 0; i < 14; i++) {
      const x = -W / 2 + 2 + i * ((W - 4) / 13);
      g.add(kotak(3.4, H - 2, 0.2, 0x2e5a73, x, H / 2 + 0.6, zc + D / 2 + 0.05));
      g.add(kotak(0.3, H, 0.8, 0xcfc6b0, x + 1.9, H / 2 + 0.6, zc + D / 2 + 0.3));
    }
    g.add(kotak(W, 0.5, 0.5, 0xcfc6b0, 0, 7.4, zc + D / 2 + 0.3)); // lis antar lantai
    // spanduk brand warna-warni di fasad samping
    for (const [x, w] of [[-22, 0xe14b2f], [-14, 0xf2c230], [14, 0x2e9e5b], [22, 0x7b2ff7]]) g.add(kotak(5, 3, 0.2, w, x, 10.5, zc + D / 2 + 0.25));
    // portal atrium kaca tinggi + kanopi lengkung
    g.add(kotak(16, 18, 4, 0x9fc9d8, 0, 9.6, zc + D / 2 + 2)); g.add(kotak(16.6, 0.6, 4.6, 0xcfc6b0, 0, 18.8, zc + D / 2 + 2));
    for (const x of [-8, -4, 0, 4, 8]) g.add(kotak(0.35, 18, 0.35, 0xe9e3d6, x, 9.6, zc + D / 2 + 4.05));
    const kanopi = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 12, 24, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0xd9dde2, side: THREE.DoubleSide, metalness: 0.3, roughness: 0.4 }));
    kanopi.rotation.z = Math.PI / 2; kanopi.scale.set(0.35, 1, 1); kanopi.position.set(0, 4.6, zc + D / 2 + 5.6); g.add(kanopi);
    g.add(kotak(4, 3.4, 0.3, 0x24323d, 0, 2.3, zc + D / 2 + 4.1)); // pintu putar/kaca
    const nama = new THREE.Mesh(new THREE.BoxGeometry(24, 3.2, 0.4), new THREE.MeshStandardMaterial({ map: teksturPapanNama("MERDU MALL", "Belanja · Kuliner · Bioskop"), emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.5 }));
    nama.scale.set(0.62, 1, 1); nama.position.set(0, 15.6, zc + D / 2 + 4.3); g.add(nama); // di muka portal atrium
    // atap: kubah kaca atrium + unit AC
    const kubah = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 22, 24, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9fd3e6, transparent: true, opacity: 0.75, metalness: 0.2, roughness: 0.1, side: THREE.DoubleSide }));
    kubah.rotation.x = Math.PI / 2; kubah.rotation.z = Math.PI / 2; kubah.position.set(0, H + 0.6, zc); g.add(kubah);
    for (let i = 0; i < 6; i++) g.add(kotak(2, 1.2, 2, 0xb8bcc2, -22 + (i % 3) * 4, H + 1.2, zc - 10 + Math.floor(i / 3) * 4));
    // layar LED di sudut
    g.add(kotak(0.5, 8, 10, 0x1b1f22, W / 2 + 0.3, 9, zc + 6));
    const led = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 7.4), new THREE.MeshStandardMaterial({ map: teksturPapanNama("DISKON 50%", "Akhir pekan di Merdu Mall"), emissive: 0xffffff, emissiveIntensity: 0.6 }));
    led.rotation.y = Math.PI / 2; led.position.set(W / 2 + 0.56, 9, zc + 6); g.add(led);
    // plaza: air mancur + tiang bendera + pohon + bangku
    const bak = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.7, 24), M(BATU)); bak.position.set(0, 0.35, 21); g.add(bak);
    const air = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.1, 24), new THREE.MeshStandardMaterial({ color: 0x3f98bf, roughness: 0.08 })); air.position.set(0, 0.7, 21); g.add(air);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const j = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0xdff4fa, transparent: true, opacity: 0.6 })); j.position.set(Math.cos(a) * 2.6, 1.8, 21 + Math.sin(a) * 2.6); g.add(j); }
    for (const x of [-6, 0, 6]) tiangBendera(g, x, 30);
    for (const x of [-30, -20, 20, 30]) g.add(pohonKecil(x, 30, 1.0));
    for (const s of [-1, 1]) { g.add(bangkuTaman(s * 9, 20, s * Math.PI / 2)); lampuTaman(g, s * 12, 14); lampuTaman(g, s * 12, 26); }
    // parkir kiri & kanan
    parkir(g, -26, 16, 4, true); parkir(g, 26, 16, 4, true);
    for (const [x, z, w] of [[-26, 11.2, 0xd9462e], [-26, 17.6, 0x3f6fb5], [26, 11.2, 0x2b2d30], [26, 20.8, 0xe8c268]]) mobil(g, x, z, Math.PI / 2, w);
    PINTU_MALL.length = 0; PINTU_MALL.push({ x: g.position.x, z: g.position.z + zc + D / 2 + 6.5 });
    MALL_KLIK.length = 0; MALL_KLIK.push(g);
  },

};

/* Tabrakan [minX, minZ, maxX, maxZ] relatif pusat blok — bangunan berdinding saja. */
export const TAPAK_BARU = {
  koperasi: [[-13.6, -22.6, 13.6, -9.4], [-20.6, -1.9, 20.6, 5.9], [-29, -22.6, -19, -9.4], [21, -19.5, 27, -12.5]],
  dapur_mbg: [[-17.6, -22.6, 17.6, -5.4], [0, -6, 16, 0], [-29.6, 0, -18.4, 8.6], [-28.5, -28.5, -19.5, -23.5]],
  mall: [[-28.5, -27.5, 28.5, 7.5], [-8, 7, 8, 11.2], [-5.6, 15.7, 5.6, 26.3]],
  apartemen: [[-13.5, -14.5, 16.0, 4.5]],
  lapangan: [[-21, -31.5, 21, -24.5], [-21, 24.5, 21, 31.5], [-33, -3, -32, 3]],       // tribun + papan skor
  perpustakaan: [[-12.6, -16.6, 12.6, -1.4], [-6, -0.2, 6, 2.6]],
  balai_warga: [[-27.6, 9.4, -16.4, 18.6]],                                            // kantor (pendopo terbuka bisa dimasuki)
  sekolah: [[-20.6, -27.1, 20.6, -16.9], [-27.1, -17.6, -16.9, 7.6], [16.9, -17.6, 27.1, 7.6]],
  puskesmas: [[-15.6, -17.6, 15.6, -2.4]],
  pasar: [[-20.2, -21.4, 20.2, -19.6], [-20.2, -15.4, 20.2, -13.6], [-20.2, -9.4, 20.2, -7.6], [-20.2, -3.9, 20.2, -2.1]], // deret meja lapak (lorong & ujung terbuka)
  masjid: [[-12, -19, 12, -1.5], [-17.4, 2.2, -13.6, 5.8], [13.6, 2.2, 17.4, 5.8], [-14.8, 9.2, -7.2, 16.8], [7.2, 9.2, 14.8, 16.8], [-23, -14, -19, -2]],
};

export function perbaruiApartemen(dt, t) {
  if (!LIFT_APT.kabin) return;
  const st = LIFT_APT;
  const targetY = st.pintuLantai[st.tujuan] ? st.pintuLantai[st.tujuan].y : 0.5;

  if (st.fase === "diam") {
    st.timer -= dt;
    if (st.timer <= 0) {
      st.tujuan = (st.lantai + 1 + Math.floor((t * 1.7) % 8)) % 10;
      if (st.tujuan === st.lantai) st.tujuan = (st.lantai + 3) % 10;
      st.fase = "gerak";
    }
  } else if (st.fase === "gerak") {
    const dy = targetY - st.ySaatIni;
    const langkah = Math.sign(dy) * Math.min(Math.abs(dy), 5.5 * dt);
    st.ySaatIni += langkah;
    st.kabin.position.y = st.ySaatIni;
    if (Math.abs(targetY - st.ySaatIni) < 0.02) {
      st.ySaatIni = targetY; st.kabin.position.y = targetY;
      st.lantai = st.tujuan; st.fase = "buka";
    }
  } else if (st.fase === "buka") {
    st.bukaan = Math.min(1, st.bukaan + dt * 1.8);
    if (st.bukaan >= 1) { st.fase = "tunggu"; st.timer = 2.0; }
  } else if (st.fase === "tunggu") {
    st.timer -= dt;
    if (st.timer <= 0) st.fase = "tutup";
  } else if (st.fase === "tutup") {
    st.bukaan = Math.max(0, st.bukaan - dt * 1.8);
    if (st.bukaan <= 0) { st.fase = "diam"; st.timer = 1.0; }
  }

  // Sinkronkan pintu geser kabin & pintu lantai aktif
  const geser = st.bukaan * 0.78;
  st.pintuKabinKiri.position.z = -0.46 - geser;
  st.pintuKabinKanan.position.z = 0.46 + geser;
  const pl = st.pintuLantai[st.lantai];
  if (pl) {
    pl.kiri.position.z = pl.bz - 0.47 - geser;
    pl.kanan.position.z = pl.bz + 0.47 + geser;
  }

  // Animasi halus riak air infinity pool rooftop
  if (st.airKolam) {
    st.airKolam.position.y = 33.7 + 0.92 + Math.sin(t * 2.2) * 0.025;
  }
}

/* Animasi orang di Pasar Desa: pedagang bernapas/berkedip, pembeli
   berjalan bolak-balik menyusuri lorong los dengan langkah halus. */
export function perbaruiPasar(dt, t) {
  for (const o of PASAR_ORANG) {
    if (o.diam) { animasiHidup(o.kar, t, true); continue; }
    const pj = Math.abs(o.x1 - o.x0);
    o.s += o.v * dt * o.arah;
    if (o.s > pj) { o.s = pj; o.arah = -1; } else if (o.s < 0) { o.s = 0; o.arah = 1; }
    const dir = Math.sign(o.x1 - o.x0) * o.arah, x = o.x0 + Math.sign(o.x1 - o.x0) * o.s;
    const bob = animasiJalan(o.kar, o.v * dt, dt);
    animasiHidup(o.kar, t, false);
    o.kar.position.set(x, 0.15 + bob * 0.06, o.lz);
    const sasaran = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    let d = sasaran - o.kar.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    o.kar.rotation.y += d * (1 - Math.exp(-dt * 8));
  }
}
