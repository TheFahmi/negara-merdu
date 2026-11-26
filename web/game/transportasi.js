/* Negara Merdu — modul game "transportasi": STASIUN, KERETA & BUS.
   - Rel layang KELILING KOTA (poligon kol 4/76, bar 4/36, tikungan
     r 150 m) dua jalur berlawanan arah, 4 rangkaian KRL; tiap gerbong
     mengikuti lengkung rel (bogie depan/belakang), melambat di tikungan.
   - 2 STASIUN: Stasiun Merdu (selatan, bar 36) & Stasiun Merdu Utara
     (bar 4); KRL berhenti 14 detik, pintu geser membuka di sisi peron.
   - LAA: tiang portal + kawat kontak di atas tiap jalur, pantograf
     di gerbong 2 & 3; kabin masinis transparan di kedua ujung.
   - Warga menunggu di peron & halte: saat kendaraan berhenti ada yang
     turun berjalan pergi dan yang menunggu naik lewat pintu.
   - Bus & KRL BERONGGA ber-interior dan BISA DINAIKI pemain (lihat
     bagian NAIK BUS / KRL di bawah); pintu bus geser membuka di halte.
   - Bus tetap menjaga HEADWAY per koridor dan PATUH LAMPU LALU LINTAS
     (titik henti per persimpangan, fase sama dengan tiang kota).
   - 5 BUS "TRANS MERDU" berkeliling rute persegi jalan kota (lajur kiri),
     berhenti 3 detik di tiap halte (halte berkanopi di trotoar). */
import { JALAN, PITCH, PUSAT_X, faseLaluLintas, persimpanganKota, sudutBlok } from "./inti.js";
import { M, camera, gabungBerwarna, jarakDetail, kotak, scene } from "./bersama.js";
import { bangkuTaman, pohonKecil, teksturPapanNama } from "./fasilitas.js";
import { BUSWAY_Z_DUNIA, perbaruiGerbangBus, tinggiBus } from "./plazaPagar.js";
import { arahHalus, arahSein, jalurPoligon, jarakKeBelok, kedip, posJalur, sTerdekatJalur } from "./jalur.js";
import { bunyiPeristiwa } from "./suara.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";
import { batasLampuMerah } from "./kota.js";
import { buatJam } from "./jam.js";

export const BLOK_STASIUN = { kol: 44, bar: 36 };
const RZ = sudutBlok(0, 36).z + JALAN / 2;        // as jalan di bawah rel (z 931)
/* Rel KELILING KOTA (24 Nov 2026, dulu lurus bolak-balik): poligon as jalan
   kol 4 / kol 76 / bar 4 / bar 36 (selatan = rel lama, tetap lewat Stasiun
   Merdu), sudut dibulatkan jari-jari 150 m. Dua jalur searah lajur kiri:
   jalur A searah jarum jam pandangan atas... (lihat ARAH_A), jalur B kebalikannya. */
const XW = sudutBlok(4, 0).x + JALAN / 2, XE = sudutBlok(76, 0).x + JALAN / 2;
const ZN = sudutBlok(0, 4).z + JALAN / 2;
const R_REL = 150;
const POLI_REL = [[XW, 0], [XE, 0], [XE, 0], [XW, 0]]; // diisi RZ/ZN di bawah (RZ didefinisikan dulu)
const YD = 8.6;                                    // tinggi dek rel
POLI_REL[0][1] = RZ; POLI_REL[1][1] = RZ; POLI_REL[2][1] = ZN; POLI_REL[3][1] = ZN;
const JALUR_A = jalurPoligon(POLI_REL, { r: R_REL, L: 2.2, langkah: 3 });
const JALUR_B = jalurPoligon(POLI_REL.slice().reverse(), { r: R_REL, L: 2.2, langkah: 3 });
const AS_REL = jalurPoligon(POLI_REL, { r: R_REL, L: 0, langkah: 8 });
const X_UTARA = 7; // Stasiun Merdu Utara (sumbu istana)
const sSt = sudutBlok(BLOK_STASIUN.kol, BLOK_STASIUN.bar);
const XST = sSt.x + JALAN + (PITCH - JALAN) / 2;   // pusat stasiun (x)
const kereta = [], bus = [];
/* Armada & headway (26 Nov): 4 KRL per arah, bus 7 (K1) + 4 + 4 (K2A/K2B).
   Pengaturan headway: (1) jaga jarak aman ke kendaraan di depan (rem
   bertahap), (2) di stasiun/halte, kendaraan yang terlalu dekat dengan yang
   di depannya ditahan lebih lama sampai jaraknya kembali ~ideal, sehingga
   armada tidak menggerombol (bunching) dan tidak berjarak terlalu jauh. */
const N_KRL = 4, N_BUS = [7, 4, 4];
function jarakKeDepan(daftar, o, total, sama) { // jarak lintasan ke kendaraan terdekat di depan pada lintasan yang sama
  let min = Infinity;
  for (const x of daftar) { if (x === o || !sama(x)) continue; const d = ((x.s - o.s) % total + total) % total; if (d > 0.01 && d < min) min = d; }
  return min;
}
export const rintanganTransportasi = [];

function teksturBus(warna) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const c = cv.getContext("2d");
  /* tulisan saja di atas warna bodi (dulu ada pita hitam bekas "jendela"
     di atas tulisan yang terlihat seperti blok hitam menutupi) */
  c.fillStyle = warna; c.fillRect(0, 0, 512, 128);
  c.fillStyle = "#ffffff"; c.textAlign = "center"; c.textBaseline = "middle"; c.font = "bold 78px system-ui";
  c.fillText("TRANS MERDU", 256, 66);
  c.fillStyle = "#f2c230"; c.fillRect(20, 112, 472, 8);
  return new THREE.CanvasTexture(cv);
}

/* ---------- rel layang keliling (instanced per potongan 8 m mengikuti lengkung) ---------- */
function bangunRel(grup) {
  const potong = [];
  for (let s0 = 0; s0 < AS_REL.total; s0 += 8) potong.push(posJalur(AS_REL, s0 + 4));
  const bag = [
    { geo: new THREE.BoxGeometry(8.6, 0.8, 9.6), y: -0.4, warna: 0xb8b2a6 },                       // dek beton
    { geo: new THREE.BoxGeometry(8.6, 1.0, 0.3), y: 0.5, z: -4.65, warna: 0xd6d0c4 },               // dinding tepi
    { geo: new THREE.BoxGeometry(8.6, 1.0, 0.3), y: 0.5, z: 4.65, warna: 0xd6d0c4 },
  ];
  for (const zj of [-2.2, 2.2]) {
    bag.push({ geo: new THREE.BoxGeometry(8.6, 0.12, 2.6), y: 0.06, z: zj, warna: 0x6b5e50 });     // balas
    for (const sr of [-1, 1]) bag.push({ geo: new THREE.BoxGeometry(8.6, 0.18, 0.12), y: 0.2, z: zj + sr * 0.75, warna: 0x9aa0a6 }); // rel baja
    for (const bx of [-3, 0, 3]) bag.push({ geo: new THREE.BoxGeometry(0.3, 0.1, 2.2), x: bx, y: 0.13, z: zj, warna: 0x8b7a66 }); // bantalan
  }
  /* LAA (Listrik Aliran Atas): kawat kontak & kawat pemikul di atas tiap
     jalur, menerus mengikuti potongan dek. */
  for (const zj of [-2.2, 2.2]) {
    bag.push({ geo: new THREE.BoxGeometry(8.6, 0.04, 0.04), y: 6.27, z: zj, warna: 0x3a3226 });    // kawat kontak (disentuh pantograf)
    bag.push({ geo: new THREE.BoxGeometry(8.6, 0.04, 0.04), y: 6.85, z: zj, warna: 0x3a3226 });    // kawat pemikul
    bag.push({ geo: new THREE.BoxGeometry(0.03, 0.58, 0.03), x: 0, y: 6.56, z: zj, warna: 0x3a3226 }); // penggantung
  }
  const geoDek = gabungBerwarna(bag);
  const imDek = new THREE.InstancedMesh(geoDek, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), potong.length);
  const geoT = new THREE.BoxGeometry(1.2, YD - 0.8, 1.2), geoK = new THREE.BoxGeometry(2.6, 0.8, 8.8);
  const tiang = potong.filter((_, i) => i % 5 === 2);
  const imT = new THREE.InstancedMesh(geoT, M(0xcfc9bd), tiang.length), imK = new THREE.InstancedMesh(geoK, M(0xcfc9bd), tiang.length);
  const d = new THREE.Object3D();
  potong.forEach((p, i) => { d.position.set(p.x, YD, p.z); d.rotation.set(0, Math.atan2(-p.hz, p.hx), 0); d.updateMatrix(); imDek.setMatrixAt(i, d.matrix); });
  tiang.forEach((p, i) => {
    const ry = Math.atan2(-p.hz, p.hx);
    d.rotation.set(0, ry, 0); d.position.set(p.x, (YD - 0.8) / 2, p.z); d.updateMatrix(); imT.setMatrixAt(i, d.matrix);
    d.position.set(p.x, YD - 1.2, p.z); d.updateMatrix(); imK.setMatrixAt(i, d.matrix);
    rintanganTransportasi.push({ minX: p.x - 0.8, maxX: p.x + 0.8, minZ: p.z - 0.8, maxZ: p.z + 0.8 });
  });
  // tiang portal LAA tiap 48 m (6 potongan): 2 tiang di tepi dek + palang + lengan
  const portal = potong.filter((_, i) => i % 6 === 0);
  const bagP = [];
  for (const sz of [-1, 1]) {
    bagP.push({ geo: new THREE.BoxGeometry(0.3, 7.2, 0.3), y: 3.6, z: sz * 4.4, warna: 0x7b8086 });
    bagP.push({ geo: new THREE.BoxGeometry(0.1, 0.5, 0.1), y: 6.75, z: sz * 2.2, warna: 0xd8d2c4 }); // isolator gantung
  }
  bagP.push({ geo: new THREE.BoxGeometry(0.3, 0.35, 9.4), y: 7.1, warna: 0x7b8086 });
  const imP = new THREE.InstancedMesh(gabungBerwarna(bagP), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), portal.length);
  portal.forEach((p, i) => { d.position.set(p.x, YD, p.z); d.rotation.set(0, Math.atan2(-p.hz, p.hx), 0); d.updateMatrix(); imP.setMatrixAt(i, d.matrix); });
  for (const im of [imDek, imT, imK, imP]) { im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; grup.add(im); }
}

/* ---------- AKSES PERON BISA DIJALANI (25 Nov 2026) ----------
   Dulu peron layang tidak terhubung ke tanah untuk pejalan. Kini tiap
   stasiun punya: TANGGA dari tanah (sisi selatan, masuk blok) ke ujung timur
   peron selatan, dan JEMBATAN PENYEBERANGAN di atas rel & kawat LAA (y 17,8)
   dengan tangga di ujung barat kedua peron -> peron utara. Zona dipakai
   tinggiPijak() untuk mengangkat pemain (kamera & karakter) mengikuti
   tangga/peron; di atas peron pemain tidak bisa jatuh ke rel. */
/* Tangga lurus rapi (26 Nov): anak tangga beraturan (tinggi ±0,19 m) di atas
   pelat miring beton, balok tepi (stringer) di kedua sisi, pagar kaca +
   pegangan tangan, dan kanopi miring bertiang. a = tepi bawah (tengah),
   b = tepi atas (tengah). Bagian opak digabung jadi 1 mesh. */
const MAT_KACA_TANGGA = new THREE.MeshStandardMaterial({ color: 0xa8d4e8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
function tanggaRapi(grup, a, b, lebar, atap) {
  const dx = b.x - a.x, dz = b.z - a.z, run = Math.hypot(dx, dz), dh = b.y - a.y;
  const ux = dx / run, uz = dz / run, px = -uz, pz = ux; // u = arah naik (horizontal), p = arah melintang
  const pitch = Math.atan2(dh, run), yaw = Math.atan2(ux, uz), miring = Math.hypot(run, dh);
  const bag = [];
  const miringBox = (w, h, len, cx, cy, cz, warna) => { const g = new THREE.BoxGeometry(w, h, len); g.rotateX(-pitch); g.rotateY(yaw); bag.push({ geo: g, x: cx, y: cy, z: cz, warna }); };
  const datar = (w, h, d, cx, cy, cz, warna) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(yaw); bag.push({ geo: g, x: cx, y: cy, z: cz, warna }); };
  const n = Math.max(3, Math.round(dh / 0.19)), tr = dh / n, td = run / n;
  for (let i = 0; i < n; i++) { // anak tangga: injakan + tegak
    const f = (i + 0.5) / n, cx = a.x + ux * run * f, cz = a.z + uz * run * f, yt = a.y + tr * (i + 1);
    datar(lebar, tr + 0.04, td + 0.03, cx, yt - (tr + 0.04) / 2, cz, i % 2 ? 0xd6d0c4 : 0xdcd6ca);
    datar(lebar, 0.03, 0.06, cx + ux * (td / 2 - 0.03), yt + 0.012, cz + uz * (td / 2 - 0.03), 0xf2c230); // strip anti-selip kuning
  }
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, my = (a.y + b.y) / 2;
  miringBox(lebar, 0.35, miring, mx, my - 0.32, mz, 0xa9a49b);             // pelat beton miring
  for (const s of [-1, 1]) {
    const sx = mx + px * s * (lebar / 2 + 0.1), sz = mz + pz * s * (lebar / 2 + 0.1);
    miringBox(0.2, 0.75, miring + 0.2, sx, my - 0.05, sz, 0xbdb7ac);       // balok tepi
    miringBox(0.07, 0.07, miring, sx, my + 1.15, sz, 0x8a8f94);            // pegangan tangan
    const kaca = new THREE.Mesh((() => { const g = new THREE.BoxGeometry(0.03, 0.85, miring); g.rotateX(-pitch); g.rotateY(yaw); return g; })(), MAT_KACA_TANGGA);
    kaca.position.set(sx, my + 0.7, sz); grup.add(kaca);
    if (atap) for (let t = 0; t <= Math.ceil(run / 5); t++) { // tiang kanopi
      const f = Math.min(1, t / Math.ceil(run / 5)), cx = a.x + ux * run * f + px * s * (lebar / 2 + 0.35), cz = a.z + uz * run * f + pz * s * (lebar / 2 + 0.35);
      const yb = a.y + dh * f; datar(0.14, 2.9, 0.14, cx, yb + 1.45 - 0.2, cz, 0x7b8086);
    }
  }
  if (atap) { miringBox(lebar + 1.2, 0.14, miring + 0.6, mx, my + 2.75, mz, 0x14467a); miringBox(lebar + 1.3, 0.06, miring + 0.7, mx, my + 2.66, mz, 0xe9edf0); }
  const m = new THREE.Mesh(gabungBerwarna(bag), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }));
  m.castShadow = true; m.receiveShadow = true; grup.add(m);
}
export const ZONA_PIJAK = []; // {x0,x1,z0,z1, y} datar | {.., sumbu:"x"|"z", ya, yb} tangga (ya di sisi koordinat kecil)
const Y_PERON = YD + 1.2, Y_JEMBATAN = YD + 9.2;
function bangunAksesPeron(grup, xc, zc) {
  const K = (w, h, d, c, x, y, z) => grup.add(kotak(w, h, d, c, x, y, z));
  // peron (datar)
  ZONA_PIJAK.push({ x0: xc - 33, x1: xc + 33, z0: zc + 4.75, z1: zc + 7.85, y: Y_PERON });
  ZONA_PIJAK.push({ x0: xc - 33, x1: xc + 33, z0: zc - 7.85, z1: zc - 4.75, y: Y_PERON });
  // 1) tangga tanah -> ujung timur peron selatan (turun ke selatan, masuk blok)
  const tx0 = xc + 30.4, tx1 = xc + 33, panjang = 15;
  const za = zc + 7.85, zb = za + panjang;
  ZONA_PIJAK.push({ x0: tx0, x1: tx1, z0: za, z1: zb, sumbu: "z", ya: Y_PERON, yb: 0.05 });
  tanggaRapi(grup, { x: (tx0 + tx1) / 2, y: 0.05, z: zb }, { x: (tx0 + tx1) / 2, y: Y_PERON, z: za }, tx1 - tx0, true);
  const pp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), new THREE.MeshBasicMaterial({ map: teksturPapanNama("KE PERON", "KRL Merdu") })); pp.position.set((tx0 + tx1) / 2, 2.6, zb + 0.3); grup.add(pp);
  K(0.15, 2.4, 0.15, 0x7b8086, tx0 - 0.3, 1.2, zb + 0.2); K(0.15, 2.4, 0.15, 0x7b8086, tx1 + 0.3, 1.2, zb + 0.2);
  // 2) tangga naik di ujung barat kedua peron (naik ke barat) + jembatan melintang rel
  const bx0 = xc - 33, bx1 = xc - 30.5, sx0 = xc - 30.5, sx1 = xc - 18;
  for (const sz of [-1, 1]) {
    const z0 = sz > 0 ? zc + 4.75 : zc - 7.85, z1 = z0 + 3.1;
    ZONA_PIJAK.push({ x0: sx0, x1: sx1, z0, z1, sumbu: "x", ya: Y_JEMBATAN, yb: Y_PERON });
    // digeser ke sisi rel (z ±5,95) supaya tidak menabrak tiang kanopi peron di z ±7,6
    tanggaRapi(grup, { x: sx1, y: Y_PERON, z: zc + sz * 5.95 }, { x: sx0, y: Y_JEMBATAN, z: zc + sz * 5.95 }, 2.2, false);
  }
  ZONA_PIJAK.push({ x0: bx0, x1: bx1, z0: zc - 7.85, z1: zc + 7.85, y: Y_JEMBATAN });
  K(bx1 - bx0, 0.35, 15.7, 0xcfc9bd, (bx0 + bx1) / 2, Y_JEMBATAN - 0.18, zc);                       // lantai jembatan
  for (const x of [bx0 - 0.05, bx1 + 0.05]) { K(0.1, 1.2, 15.7, 0x8a8f94, x, Y_JEMBATAN + 0.6, zc); K(0.06, 2.6, 15.7, 0x9fc4d6, x, Y_JEMBATAN + 1.6, zc); }
  K(bx1 - bx0 + 0.8, 0.25, 16, 0x1d5a8f, (bx0 + bx1) / 2, Y_JEMBATAN + 3.1, zc);                   // atap jembatan
  for (const zz of [zc - 7.6, zc + 7.6]) for (const x of [bx0, bx1]) K(0.25, Y_JEMBATAN, 0.25, 0x7b8086, x, Y_JEMBATAN / 2, zz);
}
/* Tinggi pijak di (x,z) bagi pemain yang sekarang di ketinggian yNow:
   kandidat = tanah (0) + zona datar/tangga di titik itu; dipilih yang paling
   dekat dengan yNow dalam batas langkah 1,4 m. null = tidak bisa ke sana
   (mis. melangkah dari peron ke udara di atas rel). */
export function tinggiPijak(x, z, yNow) {
  const kand = [0];
  for (const Z of ZONA_PIJAK) {
    if (x < Z.x0 || x > Z.x1 || z < Z.z0 || z > Z.z1) continue;
    if (Z.sumbu === "z") kand.push(Z.ya + (Z.yb - Z.ya) * (z - Z.z0) / (Z.z1 - Z.z0));
    else if (Z.sumbu === "x") kand.push(Z.ya + (Z.yb - Z.ya) * (x - Z.x0) / (Z.x1 - Z.x0));
    else kand.push(Z.y);
  }
  // zona (tangga/peron) yang terjangkau didahulukan dari tanah, supaya
  // menaiki tangga dari bawah benar-benar naik; tanah hanya bila tak ada zona terjangkau
  let best = null, d = 1.4;
  for (let i = 1; i < kand.length; i++) { const e = Math.abs(kand[i] - yNow); if (e <= d) { d = e; best = kand[i]; } }
  if (best === null && yNow < 1.4) best = 0;
  return best;
}

/* ---------- Stasiun Merdu Utara (rel utara, sumbu istana) ---------- */
function bangunStasiunUtara(grup) {
  const x = X_UTARA, z = ZN;
  for (const s of [-1, 1]) {
    grup.add(kotak(66, 0.5, 3.2, 0xe6dcc6, x, YD + 0.95, z + s * 6.3));
    grup.add(kotak(66, 0.1, 0.3, 0xf2c230, x, YD + 1.22, z + s * 4.85));
    for (let i = 0; i < 6; i++) grup.add(kotak(0.35, 5.2, 0.35, 0x7b8086, x - 30 + i * 12, YD + 3.6, z + s * 7.6));
    for (const t of [-6, 20]) { const bk = bangkuTaman(x + t, z + s * 7.0, s > 0 ? Math.PI : 0); bk.position.y = YD + 1.2; grup.add(bk); }
  }
  const atap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 58, 24, 1, true, -Math.PI / 2 + 0.6, Math.PI - 1.2),
    new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
  atap.rotation.z = Math.PI / 2; atap.position.set(x, YD + 2.5, z); atap.castShadow = true; grup.add(atap);
  // tangga turun ke selatan (arah kota) dari ujung peron selatan + kios pintu
  grup.add(kotak(6, 3.4, 3.4, 0x1d5a8f, x, 1.7, z + 24.5));
  const papan = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama("STASIUN MERDU UTARA", "KRL Keliling Kota"), roughness: 0.8 }));
  papan.position.set(x, YD + 3.2, z + 8.2); grup.add(papan);
  const jamU = buatJam(0.9); jamU.position.set(x + 12, YD + 3.2, z + 8.2); grup.add(jamU);
}

/* ---------- Gedung Stasiun Merdu (realistis) ---------- */
function teksturNamaStasiun(judul, sub) {
  const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 192; const c = cv.getContext("2d");
  c.fillStyle = "#14467a"; c.fillRect(0, 0, 1024, 192);
  c.fillStyle = "#e3262d"; c.fillRect(0, 160, 1024, 32);           // strip merah bawah
  c.fillStyle = "#ffffff"; c.beginPath(); c.arc(96, 82, 56, 0, Math.PI * 2); c.fill(); // logo bulat
  c.fillStyle = "#14467a"; c.font = "900 62px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("M", 96, 86);
  c.fillStyle = "#ffffff"; c.textAlign = "left"; c.font = "800 86px system-ui, sans-serif"; c.fillText(judul, 176, 74, 820);
  c.font = "600 34px system-ui, sans-serif"; c.fillStyle = "#cfe2f5"; c.fillText(sub, 180, 134, 820);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t;
}
function teksturLayarJadwal() {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256; const c = cv.getContext("2d");
  c.fillStyle = "#0b0f14"; c.fillRect(0, 0, 512, 256);
  c.fillStyle = "#ffb020"; c.font = "bold 30px monospace"; c.fillText("JADWAL KRL MERDU", 18, 40);
  c.font = "24px monospace"; c.fillStyle = "#f2f2f2";
  [["K1", "Keliling Kota", "5 mnt"], ["K1", "Keliling Kota", "12 mnt"], ["UTR", "Merdu Utara", "8 mnt"], ["HUB", "Trans Merdu", "3 mnt"]].forEach(([a, b, d], i) => {
    const y = 86 + i * 42; c.fillStyle = "#ffb020"; c.fillText(a, 18, y); c.fillStyle = "#f2f2f2"; c.fillText(b, 100, y); c.fillStyle = "#5fd46a"; c.fillText(d, 400, y);
  });
  return new THREE.CanvasTexture(cv);
}
function bangunGedungStasiun(grup, zb) {
  const W = 57, x0 = XST - W / 2, x1 = XST + W / 2, z0 = zb + 1, z1 = zb + 17, zc = (z0 + z1) / 2, H = YD + 1.2, LT = 4.6;
  const bag = []; // bagian opak digabung jadi 1 mesh (hemat draw call)
  const P = (w, h, d, x, y, z, warna) => bag.push({ geo: new THREE.BoxGeometry(w, h, d), x, y, z, warna });
  const PUTIH = 0xf1eee8, ABU = 0x5f6b75, ALU = 0xd5dade, BATU = 0xb9b2a6, BIRU = 0x14467a;
  // lantai, dinding belakang & samping, plafon lantai dasar (= lantai atas)
  P(W, 0.3, 16, XST, 0.15, zc, 0xd9d4cc);
  P(W, H, 0.4, XST, H / 2, z0 + 0.2, 0xe7e3da);
  for (const sx of [-1, 1]) { P(0.5, H, 16, XST + sx * (W / 2 - 0.25), H / 2, zc, 0xe7e3da); for (let i = 0; i < 6; i++) P(0.25, H - 1, 0.6, XST + sx * (W / 2 + 0.1), H / 2, z0 + 2 + i * 2.6, ALU); }
  P(W - 1, 0.45, 16, XST, LT, zc, 0xf3f0ea);                               // pelat lantai atas
  P(W + 0.8, 0.9, 1.4, XST, LT + 0.2, z1 - 0.3, PUTIH);                    // lis tebal depan lantai atas
  P(W + 0.8, 0.18, 1.42, XST, LT - 0.12, z1 - 0.3, BIRU);                  // strip biru
  P(W + 1.2, 0.7, 17.2, XST, H + 0.25, zc, PUTIH); P(W + 1.4, 0.25, 17.4, XST, H + 0.7, zc, BIRU); // atap datar + lisplang
  // kolom bulat fasad
  const geoKolom = new THREE.CylinderGeometry(0.38, 0.38, H, 16);
  for (let i = 0; i <= 8; i++) bag.push({ geo: geoKolom, x: x0 + 1 + i * (W - 2) / 8, y: H / 2, z: z1 - 0.3, warna: PUTIH });
  // lantai dasar: kusen kaca (kaca mundur 1,6 m di bawah overhang)
  const zg = z1 - 1.6;
  for (let x = x0 + 1; x <= x1 - 1 + 0.01; x += 2.9) P(0.12, 4.2, 0.16, x, 2.4, zg, ABU);
  P(W - 2, 0.14, 0.18, XST, 0.38, zg, ABU); P(W - 2, 0.14, 0.18, XST, 4.35, zg, ABU); P(W - 2, 0.08, 0.14, XST, 3.3, zg, ABU);
  // lantai atas: kaca pita + sirip aluminium vertikal
  for (let x = x0 + 0.8; x <= x1 - 0.8; x += 1.25) P(0.14, H - LT - 1.2, 0.8, x, (LT + 0.7 + H - 0.4) / 2, z1 - 0.2, ALU);
  P(W - 1.5, 0.12, 0.2, XST, LT + 0.75, z1 - 0.95, ABU);
  // kanopi pintu masuk + 2 tiang + papan "PINTU MASUK"
  P(12, 0.35, 4.6, XST, 4.05, z1 + 1.6, PUTIH); P(12.1, 0.12, 4.7, XST, 3.86, z1 + 1.6, BIRU);
  for (const sx of [-1, 1]) P(0.22, 3.8, 0.22, XST + sx * 5.6, 1.9, z1 + 3.6, ALU);
  P(W + 4, 0.08, 9, XST, 0.04, z1 + 4.5, 0xc9c2b6);                       // pelataran paving depan stasiun
  P(6, 0.06, 3.2, XST, 0.33, z1 + 1.3, 0x3d3a36);                       // keset
  // tiang pembatas (bollard) & pot tanaman di pelataran
  for (let i = -6; i <= 6; i++) if (Math.abs(i) > 2) P(0.25, 0.8, 0.25, XST + i * 4.2, 0.4, z1 + 4.8, 0x8a8f94);
  for (const sx of [-1, 1]) for (const dx of [10, 20]) P(2.4, 0.7, 1.2, XST + sx * dx, 0.35, z1 + 2.2, BATU);
  // INTERIOR lantai dasar: loket, gerbang tap, mesin tiket, bangku, layar jadwal
  for (const sx of [-1, 1]) {
    P(12, 1.1, 1.1, XST + sx * 16, 0.85, z0 + 2.2, 0x8a5a30);             // meja loket
    P(12.2, 0.12, 1.3, XST + sx * 16, 1.46, z0 + 2.2, 0xe9e2d4);
    for (let k = 0; k < 4; k++) P(0.08, 1.3, 1.1, XST + sx * 16 - 4.5 + k * 3, 2.15, z0 + 2.2, ABU); // sekat jendela loket
    P(12, 0.9, 0.12, XST + sx * 16, 3.6, z0 + 0.5, BIRU);                 // papan LOKET
    for (let k = 0; k < 3; k++) P(0.9, 1.8, 0.6, XST + sx * 25.5, 1.2, z0 + 3 + k * 1.4, k === 1 ? 0xe3262d : 0x2a6db0); // mesin tiket/top-up
  }
  for (let k = 0; k < 9; k++) { // deret gerbang tap (tiang + sayap kaca kecil)
    const gx = XST - 8 + k * 2;
    P(0.32, 1.05, 1.4, gx, 0.85, zc + 0.5, 0xc4c8cc); P(0.34, 0.06, 0.3, gx, 1.41, zc + 0.05, k % 3 === 1 ? 0xe3262d : 0x3fbf5a);
  }
  for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { // bangku tunggu
    const bx = XST + sx * (6 + k * 4), bz = zc + 4.2;
    P(3, 0.12, 0.6, bx, 0.75, bz, 0x2a6db0); P(3, 0.6, 0.1, bx, 1.05, bz - 0.3, 0x2a6db0); P(0.1, 0.45, 0.4, bx - 1.3, 0.52, bz, ALU); P(0.1, 0.45, 0.4, bx + 1.3, 0.52, bz, ALU);
  }
  P(0.6, 2.2, 0.6, XST + 12, 1.4, zc, 0xe3262d); // tiang info merah
  const mesh = new THREE.Mesh(gabungBerwarna(bag), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }));
  mesh.castShadow = true; mesh.receiveShadow = true; grup.add(mesh);
  // kaca transparan (lantai dasar & atas) + pintu geser
  const matKaca = new THREE.MeshStandardMaterial({ color: 0xa8d4e8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
  const kacaBawah = new THREE.Mesh(new THREE.PlaneGeometry(W - 2, 3.9), matKaca); kacaBawah.position.set(XST, 2.4, zg + 0.02); grup.add(kacaBawah);
  const kacaAtas = new THREE.Mesh(new THREE.PlaneGeometry(W - 1.5, H - LT - 1.2), matKaca); kacaAtas.position.set(XST, (LT + 0.7 + H - 0.4) / 2, z1 - 0.95); grup.add(kacaAtas);
  // lampu plafon (panel menyala) lantai dasar & atas
  const matPanel = new THREE.MeshBasicMaterial({ color: 0xfff7e6 });
  const bagLampu = [];
  for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) {
    bagLampu.push({ geo: new THREE.BoxGeometry(2.2, 0.05, 0.6), x: x0 + 4 + i * (W - 8) / 8, y: LT - 0.25, z: z0 + 3.5 + j * 4.5, warna: 0xfff7e6 });
    bagLampu.push({ geo: new THREE.BoxGeometry(2.2, 0.05, 0.6), x: x0 + 4 + i * (W - 8) / 8, y: H - 0.12, z: z0 + 3.5 + j * 4.5, warna: 0xfff7e6 });
  }
  grup.add(new THREE.Mesh(gabungBerwarna(bagLampu), matPanel));
  // papan nama modern di lis depan + di atas atap, papan LOKET, layar jadwal
  const texNama = teksturNamaStasiun("STASIUN MERDU", "KRL Merdu · Terminal Bus · MRD");
  const papan1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: texNama }));
  papan1.position.set(XST, H - 1.1, z1 + 0.25); grup.add(papan1);
  const papan2 = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.7), new THREE.MeshBasicMaterial({ map: texNama }));
  papan2.position.set(XST, 4.05, z1 + 3.92); grup.add(papan2);
  const texLoket = teksturPapanNama("LOKET", "Tiket & Kartu Merdu");
  for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.85), new THREE.MeshBasicMaterial({ map: texLoket })); l.position.set(XST + sx * 16, 3.6, z0 + 0.57); grup.add(l); }
  const layar = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: teksturLayarJadwal() }));
  layar.position.set(XST, 3.4, z0 + 0.45); grup.add(layar);
  const layar2 = layar.clone(); layar2.position.set(XST, 3.6, zc + 0.5); layar2.rotation.y = 0; grup.add(layar2);
  // pohon di pelataran
  for (const sx of [-1, 1]) for (const dx of [10, 20]) { const ph = pohonKecil(XST + sx * dx, z1 + 2.2); ph.position.y = 0.7; grup.add(ph); }
}

/* ---------- stasiun + terminal ---------- */
function bangunStasiun(grup, st) {
  const XST = st.x, zb = st.sBlok.z + JALAN; // tepi utara kavling blok stasiun
  // peron layang di kedua sisi jalur + kanopi atap lengkung
  for (const s of [-1, 1]) {
    grup.add(kotak(66, 0.5, 3.2, 0xe6dcc6, XST, YD + 0.95, RZ + s * 6.3));
    grup.add(kotak(66, 0.1, 0.3, 0xf2c230, XST, YD + 1.22, RZ + s * 4.85)); // garis kuning peron
    for (let i = 0; i < 6; i++) grup.add(kotak(0.35, 5.2, 0.35, 0x7b8086, XST - 30 + i * 12, YD + 3.6, RZ + s * 7.6));
  }
  const atap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 58, 24, 1, true, -Math.PI / 2 + 0.6, Math.PI - 1.2),
    new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
  atap.rotation.z = Math.PI / 2; atap.position.set(XST, YD + 2.5, RZ); atap.castShadow = true; grup.add(atap);
  // GEDUNG STASIUN (rombak 26 Nov): 2 lantai, fasad kaca + kolom + sirip
  // aluminium, kanopi pintu masuk, interior hall (loket, gerbang tap, mesin
  // tiket, layar jadwal, bangku) terlihat menembus kaca.
  bangunGedungStasiun(grup, zb);
  const jam = buatJam(1.1); jam.position.set(XST + 12, YD - 1.1, zb + 17.3); grup.add(jam); // jam stasiun real time di fasad
  rintanganTransportasi.push({ minX: XST - 28.5, maxX: XST + 28.5, minZ: zb + 1, maxZ: zb + 17 });
  if (!st.terminal) return;
  // terminal bus (selatan blok, hanya Stasiun Merdu)
  const zt = zb + 48;
  grup.add(kotak(66, 0.12, 30, 0x5c6066, XST, 0.31, zt));
  for (let i = 0; i < 4; i++) {
    const x = XST - 24 + i * 16;
    grup.add(kotak(14, 0.35, 4, 0xd8d2c6, x, 0.45, zt - 6)); // peron bus
    grup.add(kotak(14, 0.3, 5, 0x1d5a8f, x, 4.4, zt - 6));
    for (const s of [-1, 1]) grup.add(kotak(0.25, 4, 0.25, 0xb8bcc2, x + s * 6.6, 2.3, zt - 6));
    grup.add(bangkuTaman(x - 3, zt - 7, 0)); grup.add(bangkuTaman(x + 3, zt - 7, 0));
  }
  const pT = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama("TERMINAL BUS MERDU", "Trans Merdu · Antar Kota"), roughness: 0.8 }));
  pT.position.set(XST, 5.6, zt - 8.6); grup.add(pT);
  for (let i = 0; i < 3; i++) { const b = buatBus(["#2e9e5b", "#1d5a8f", "#e8943a"][i]); b.position.set(XST - 24 + i * 16, 0.3, zt + 2); grup.add(b); }
  for (const [x, z] of [[XST - 31, zt + 12], [XST + 31, zt + 12], [XST - 31, zb + 26], [XST + 31, zb + 26]]) grup.add(pohonKecil(x, z, 1.0));
}

/* ---------- kereta (gerbong BERONGGA ber-interior, bisa dinaiki) ----------
   Grup kereta menghadap +x. Tiap gerbong 13,6 x 3,0, lantai y 0,5, atap 3,6:
   dinding bawah + pita jendela kaca + atap, bangku panjang di kedua sisi
   (gaya KRL), tiang & gantungan tangan, lampu plafon, pintu, lorong antar
   gerbong terbuka; kabin masinis + hidung merah di gerbong depan. */
const TEX_PETA_KRL = (() => { const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96; const c = cv.getContext("2d"); c.fillStyle = "#0b1622"; c.fillRect(0, 0, 512, 96);
  c.strokeStyle = "#c8102e"; c.lineWidth = 8; c.beginPath(); c.moveTo(30, 52); c.lineTo(482, 52); c.stroke();
  const st = ["MERDU", "TIMUR", "MERDU UTARA", "BARAT"]; st.forEach((n, i) => { const x = 40 + i * 140; c.fillStyle = i === 0 ? "#2aff6a" : "#ffffff"; c.beginPath(); c.arc(x, 52, 10, 0, 7); c.fill(); c.font = "bold 18px system-ui"; c.textAlign = "center"; c.fillText(n, x, 86); });
  c.fillStyle = "#ffb020"; c.font = "bold 18px system-ui"; c.textAlign = "left"; c.fillText("KRL MERDU · Keliling Kota", 30, 24); return new THREE.CanvasTexture(cv); })();
const KACA_KRL = new THREE.MeshStandardMaterial({ color: 0x9fc4d6, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.1, depthWrite: false });
function buatKereta() {
  const g = new THREE.Group(), gerbong = [];
  let tgt = g; // grup gerbong yang sedang diisi
  const merah = M(0xc8102e, 0.4);
  const K = (l, t, d, w, x, y, z) => { const m = kotak(l, t, d, w, x, y, z); m.castShadow = false; tgt.add(m); return m; };
  const kaca = (l, t, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, d), KACA_KRL); m.position.set(x, y, z); tgt.add(m); };
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Group(); c.userData.no = i; g.add(c); gerbong.push(c); tgt = c;
    const cx = 0, L = 13.6; // geometri lokal gerbong; posisi/arah tiap gerbong diatur perbaruiTransportasi (mengikuti lengkung rel)
    K(L, 0.3, 3.0, 0x6b6f74, cx, 0.35, 0);                    // lantai
    K(L, 0.25, 3.0, 0xf4f4f2, cx, 3.6, 0);                    // atap
    K(L, 0.4, 2.0, 0xd8dde2, cx, 3.95, 0);                    // kubah atap/AC
    for (const s of [-1, 1]) {
      // dinding bawah, garis merah & pita jendela DIPOTONG di 2 bukaan pintu (x ±4,2, lebar 1,3)
      for (const [x0, x1] of [[-6.8, -4.85], [-3.55, 3.55], [4.85, 6.8]]) {
        const w = x1 - x0, xm = cx + (x0 + x1) / 2;
        K(w, 1.1, 0.12, 0xf4f4f2, xm, 1.05, s * 1.44);          // dinding bawah
        K(w, 0.22, 0.13, 0xc8102e, xm, 1.62, s * 1.45);         // garis merah
        kaca(w, 1.3, 0.06, xm, 2.4, s * 1.44);                  // pita jendela
      }
      K(L, 0.4, 0.12, 0xf4f4f2, cx, 3.25, s * 1.44);          // dinding atas (di atas pintu, utuh)
      /* pintu geser 2 daun per bukaan: daun = panel abu + jendela gelap; digeser
         keluar ±0,66 saat buka (perbaruiPintuKrl) */
      for (const dx of [-4.2, 4.2]) for (const arah of [-1, 1]) {
        const daun = new THREE.Group();
        daun.add(kotak(0.64, 1.05, 0.06, 0xdfe3e6, 0, -0.72, 0));   // panel bawah
        daun.add(kotak(0.64, 0.25, 0.06, 0xdfe3e6, 0, 1.12, 0));    // panel atas
        for (const dx of [-0.28, 0.28]) daun.add(kotak(0.08, 1.2, 0.06, 0xdfe3e6, dx, 0.4, 0)); // bingkai samping
        const jd = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.2, 0.03), KACA_KRL); jd.position.y = 0.4; daun.add(jd); // kaca bening
        daun.add(kotak(0.64, 0.18, 0.07, 0xc8102e, 0, -0.33, 0));
        daun.position.set(cx + dx + arah * 0.32, 1.77, s * 1.52); tgt.add(daun);
        (c.userData.pintu || (c.userData.pintu = [])).push({ daun, x0: cx + dx + arah * 0.32, arah, sisi: s });
      }
      for (const dx of [-6.6, -2.0, 2.0, 6.6]) K(0.12, 1.3, 0.14, 0xf4f4f2, cx + dx, 2.4, s * 1.44); // tiang jendela
      // bangku panjang menghadap lorong
      for (const [x0, x1] of [[-6.6, -4.9], [-3.5, 3.5], [4.9, 6.6]]) {
        for (let xs = x0 + 0.4; xs <= x1 - 0.35; xs += 0.75) (c.userData.kursi || (c.userData.kursi = [])).push({ lx: xs, ly: 0.49, lz: s * 1.0, rot: s > 0 ? Math.PI : 0, isi: null, lantai: 0.5 });
        // bangku longitudinal KRL: jok beludru per penumpang (pembatas tipis), kursi prioritas merah di ujung, alas stainless
        const prio = x0 < -6 || x1 > 6, jok = prio ? 0xb0283a : 0x2e6fa8, jok2 = prio ? 0x8a1f2e : 0x234f84, xm = cx + (x0 + x1) / 2;
        K(x1 - x0, 0.14, 0.52, jok, xm, 0.96, s * 1.08); K(x1 - x0, 0.62, 0.1, jok, xm, 1.32, s * 1.33);
        for (let xs = x0 + 0.75; xs < x1 - 0.1; xs += 0.75) { K(0.03, 0.15, 0.5, jok2, cx + xs, 1.04, s * 1.08); K(0.03, 0.6, 0.06, jok2, cx + xs, 1.32, s * 1.3); }
        K(x1 - x0, 0.4, 0.45, 0xc9ced4, xm, 0.7, s * 1.08);                  // alas stainless
        K(0.06, 0.45, 0.5, 0xc9ced4, cx + x0, 1.15, s * 1.08); K(0.06, 0.45, 0.5, 0xc9ced4, cx + x1, 1.15, s * 1.08); // sandaran tangan ujung
        K(x1 - x0, 0.04, 0.32, 0xc9ced4, xm, 2.95, s * 1.22);                // rak bagasi
        for (let xs = x0; xs <= x1; xs += 0.5) K(0.02, 0.02, 0.3, 0x8a8f94, cx + xs, 2.97, s * 1.22);
        if (!prio) { const ik = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2, x1 - x0 - 0.4), 0.4), M([0xf2c230, 0x2e9e5b, 0xe85d75][(i + (s > 0 ? 1 : 0)) % 3])); ik.position.set(xm, 3.25, s * 1.37); ik.rotation.y = s > 0 ? Math.PI : 0; tgt.add(ik); } // panel iklan atas jendela
      }
    }
    // tiang pegangan + rel atas + gantungan tangan
    for (const dx of [-4.2, 0, 4.2]) for (const s of [-1, 1]) K(0.05, 2.9, 0.05, 0xc0c4c8, cx + dx, 2.0, s * 0.55);
    for (const s of [-1, 1]) K(L - 0.6, 0.04, 0.04, 0xc0c4c8, cx, 3.2, s * 0.55);
    for (let h = -6; h <= 6; h += 1) for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), M(0xf2c230)); r.position.set(cx + h, 2.85, s * 0.55); tgt.add(r); }
    for (const dx of [-4.5, 0, 4.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })); l.position.set(cx + dx, 3.46, 0); tgt.add(l); }
    /* lantai bermotif + garis kuning di depan pintu, peta jalur LED di atas
       pintu, lampu indikator pintu, CCTV, saluran AC & plafon melengkung */
    K(L - 0.3, 0.02, 2.7, 0x8a8478, cx, 0.51, 0);
    for (const dx of [-4.2, 4.2]) for (const sz of [-1, 1]) {
      K(1.3, 0.006, 0.12, 0xf2c230, cx + dx, 0.522, sz * 1.25);
      const pt = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshBasicMaterial({ map: TEX_PETA_KRL })); pt.position.set(cx + dx, 3.18, sz * 1.36); pt.rotation.y = sz > 0 ? Math.PI : 0; tgt.add(pt);
      const ind = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 })); ind.position.set(cx + dx + 0.75, 3.05, sz * 1.34); tgt.add(ind);
    }
    for (const sz of [-1, 1]) K(L - 0.6, 0.18, 0.5, 0xe9ecef, cx, 3.42, sz * 0.95);    // plafon samping melengkung
    K(L - 0.6, 0.06, 0.4, 0xc9ced4, cx, 3.5, 0); for (let dx = -5.5; dx <= 5.5; dx += 1.1) K(0.5, 0.02, 0.3, 0x6b6f74, cx + dx, 3.47, 0.5); // saluran AC + kisi
    K(0.12, 0.12, 0.12, 0x1b1d20, cx + 6.3, 3.35, 0); K(0.12, 0.12, 0.12, 0x1b1d20, cx - 6.3, 3.35, 0);           // CCTV
    // dinding ujung dengan pintu lorong (tidak untuk ujung depan gerbong 0)
    for (const e of [-1, 1]) {
      if ((i === 0 && e === 1) || (i === 3 && e === -1)) continue; // ujung rangkaian = kabin masinis
      for (const s of [-1, 1]) K(0.12, 3.1, 0.95, 0xe6e8ea, cx + e * 6.8, 2.0, s * 1.0);
      K(0.12, 0.8, 1.1, 0xe6e8ea, cx + e * 6.8, 3.2, 0);
    }
    if (i < 3) { K(0.9, 0.25, 1.1, 0x55595e, cx - 7.1, 0.4, 0); for (const s of [-1, 1]) K(0.9, 2.8, 0.06, 0x2b2d30, cx - 7.1, 1.9, s * 0.58); } // sambungan lorong
    K(L - 0.4, 0.3, 2.6, 0x37474f, cx, 0.1, 0);               // rangka bawah
    /* 2 bogie per gerbong: rangka + 4 roda baja + pegas; peralatan bawah lantai; 2 unit AC atap */
    for (const bz of [-4.6, 4.6]) {
      K(2.6, 0.35, 2.2, 0x2b2d30, cx + bz, -0.2, 0);
      for (const dx of [-0.8, 0.8]) for (const sz of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 14), M(0x55595e)); r.rotation.x = Math.PI / 2; r.position.set(cx + bz + dx, -0.08, sz * 0.75); tgt.add(r); }
      for (const sz of [-1, 1]) { const pg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.32, 8), M(0x8a3a30)); pg.position.set(cx + bz, 0.0, sz * 1.0); tgt.add(pg); }
    }
    K(4.5, 0.5, 1.8, 0x3a3d40, cx, -0.2, 0);                   // kotak peralatan bawah lantai
    for (const ax of [-3.3, 3.3]) { K(2.6, 0.4, 1.8, 0xc9ced4, cx + ax, 4.3, 0); K(1.6, 0.05, 1.2, 0x5f6b75, cx + ax, 4.53, 0); }
    const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("KRL MERDU", "Gerbong " + (i + 1)) }));
    papan.rotation.y = -Math.PI / 2; papan.position.set(cx + 6.72, 3.0, 0); tgt.add(papan);
  }
  /* Kabin masinis DI KEDUA UJUNG (KRL berjalan dua arah) & TRANSPARAN:
     badan hidung merah hanya sampai sabuk jendela; di atasnya kaca depan
     besar & kaca samping bening sehingga masinis, konsol & kursinya
     terlihat dari luar. Lampu depan putih + lampu belakang merah.
     a = +1 ujung depan (gerbong 1), -1 ujung belakang (gerbong 4). */
  const matLampu = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 });
  const matLampuR = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 0.8 });
  for (const [c, a] of [[gerbong[0], 1], [gerbong[3], -1]]) {
    tgt = c;
    K(0.12, 3.1, 2.8, 0xe6e8ea, a * 5.2, 2.0, 0);                                    // sekat kabin (penumpang tidak masuk)
    K(0.12, 2.9, 0.12, 0x2b2d30, a * 5.2, 2.0, 0);                                    // pintu sekat
    // badan bawah kabin + hidung (merah) sampai sabuk jendela y 1,9
    K(1.5, 1.55, 2.96, 0xc8102e, a * 6.05, 1.12, 0);
    const hidung = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.55, 2.96), merah); hidung.position.set(a * 7.45, 1.12, 0); tgt.add(hidung);
    K(2.8, 0.12, 2.96, 0xf4f4f2, a * 6.7, 1.95, 0);                                   // lis putih sabuk
    // kaca depan besar (miring sedikit) & kaca samping kabin — bening
    const kd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.45, 2.8), KACA_KRL); kd.position.set(a * 8.0, 2.65, 0); kd.rotation.z = a * 0.12; tgt.add(kd);
    for (const sz of [-1, 1]) { const ks = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.3, 0.05), KACA_KRL); ks.position.set(a * 6.7, 2.6, sz * 1.46); tgt.add(ks); }
    for (const sz of [-1, 1]) K(0.12, 1.45, 0.14, 0xc8102e, a * 8.0, 2.65, sz * 1.42);  // pilar kaca depan
    K(3.0, 0.35, 2.96, 0xf4f4f2, a * 6.65, 3.42, 0);                                   // atap kabin
    // konsol, tuas & kursi masinis + masinis
    K(0.5, 0.5, 2.2, 0x2b2d30, a * 7.45, 1.75, 0); // konsol rendah: masinis terlihat dari depan
    const layar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x0a2a3a, emissive: 0x2a9fd6, emissiveIntensity: 0.8 })); layar.position.set(a * 7.2, 2.1, -0.4); layar.rotation.z = a * 0.4; tgt.add(layar);
    K(0.5, 0.12, 0.5, 0x2e6fa8, a * 6.55, 1.45, -0.45); K(0.1, 0.7, 0.5, 0x2e6fa8, a * 6.3, 1.85, -0.45);
    const masinis = buatKarakter({ baju: "#1d3a5f", kulit: "#c68642", topi: "tanpa" });
    masinis.position.set(a * 6.75, 0.95, -0.45); masinis.rotation.y = a * Math.PI / 2; tgt.add(masinis);
    const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), M(0x1d3a5f)); topi.position.set(0, 1.62, 0); masinis.add(topi);
    for (const sz of [-1, 1]) {
      // ujung depan (a=+1, rangkaian selalu melaju ke +x lokal): lampu utama putih; ujung belakang: lampu merah
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), a > 0 ? matLampu : M(0x5a5a5a)); l.rotation.y = a * Math.PI / 2; l.position.set(a * 8.11, 0.95, sz * 0.95); tgt.add(l);
      const lr = new THREE.Mesh(new THREE.CircleGeometry(a > 0 ? 0.1 : 0.15, 12), a > 0 ? M(0x4a1010) : matLampuR); lr.rotation.y = a * Math.PI / 2; lr.position.set(a * 8.11, 0.95, sz * 1.25); tgt.add(lr);
      if (a > 0 && sz > 0) { const lu = new THREE.Mesh(new THREE.CircleGeometry(0.13, 12), matLampu); lu.rotation.y = Math.PI / 2; lu.position.set(8.12, 3.15, 0); tgt.add(lu); } // lampu sorot atas
    }
    const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("KRL MERDU", "Keliling Kota") }));
    papan.rotation.y = a * Math.PI / 2; papan.position.set(a * 8.16, 3.42, 0); tgt.add(papan);
    K(0.5, 0.6, 2.7, 0x2b2d30, a * 8.1, 0.05, 0);                                     // rok depan / pembersih rel
    K(0.6, 0.25, 0.35, 0x55595e, a * 8.5, 0.45, 0);                                    // kopler
    for (const sz of [-1, 1]) { const wp = K(0.03, 0.8, 0.03, 0x111111, a * 8.06, 2.3, sz * 0.6); wp.rotation.x = sz * 0.6; } // wiper
  }
  /* Pantograf (LAA) di atap gerbong 2 & 3 — menyentuh kawat kontak di atas rel. */
  for (const c of [gerbong[1], gerbong[2]]) {
    tgt = c;
    const pg = new THREE.Group(); pg.position.set(0, 4.15, 0); c.add(pg);
    pg.add(kotak(1.4, 0.12, 1.4, 0x55595e, 0, 0.06, 0));
    for (const z of [-0.5, 0.5]) pg.add(kotak(0.14, 0.3, 0.14, 0xd8d2c4, 0.5, 0.25, z)); // isolator
    const lengan = (x0, y0, x1, y1) => { const l = Math.hypot(x1 - x0, y1 - y0), m = kotak(l, 0.06, 0.06, 0x2b2d30, (x0 + x1) / 2, (y0 + y1) / 2, 0); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); return m; };
    for (const z of [-0.35, 0.35]) { const a1 = lengan(0.5, 0.35, -0.3, 0.85), a2 = lengan(-0.3, 0.85, 0.15, 1.38); a1.position.z = a2.position.z = z; pg.add(a1); pg.add(a2); }
    pg.add(kotak(0.25, 0.06, 1.7, 0x2b2d30, 0.15, 1.42, 0));                          // kepala pantograf
  }
  g.userData.gerbong = gerbong;
  return g;
}
/* ---------- bus (BERONGGA ber-interior, bisa dinaiki) — hadap +z ----------
   Lantai y 0,55, atap 3,3; pintu di sisi KIRI (+x, ke trotoar, lajur kiri). */
const PINTU_BUS_Z = 0; // pintu bus di TENGAH bodi (z lokal)
function buatBus(warna) {
  const g = new THREE.Group(), w = parseInt(warna.slice(1), 16), tex = teksturBus(warna);
  const K = (l, t, d, c, x, y, z) => { const m = kotak(l, t, d, c, x, y, z); m.castShadow = false; g.add(m); return m; };
  const kaca = (l, t, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, d), KACA_KRL); m.position.set(x, y, z); g.add(m); };
  K(2.5, 0.3, 10.3, 0x55595e, 0, 0.5, 0);                     // lantai
  K(2.6, 0.2, 10.5, 0xf4f4f2, 0, 3.35, 0);                    // atap
  for (const s of [-1, 1]) {
    /* PINTU DI TENGAH (sisi kiri +x, bukaan z -0,8..0,8) & roda simetris
       z ±3,4 -> overhang depan = belakang. Dinding bawah penuh y 0,6..1,7
       kecuali lengkung roda & bukaan pintu; di atas lengkung roda tetap ada. */
    const potong = [[-4.05, -2.75]].concat(s > 0 ? [[-0.8, 0.8]] : [], [[2.75, 4.05]]);
    let z0 = -5.15;
    for (const [a, b] of potong.concat([[5.15, 5.15]])) { if (a > z0) K(0.12, 1.1, a - z0, w, s * 1.27, 1.15, (a + z0) / 2); z0 = b; }
    for (const [a, b] of [[-4.05, -2.75], [2.75, 4.05]]) K(0.12, 0.62, b - a, w, s * 1.27, 1.39, (a + b) / 2);
    for (const lz of s > 0 ? [-1.75] : [-1.4]) { // tulisan TRANS MERDU di antara lengkung roda (tidak tertutup spakbor / pintu)
      const sisi = new THREE.Mesh(new THREE.PlaneGeometry(s > 0 ? 1.9 : 2.6, s > 0 ? 0.47 : 0.65), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
      sisi.rotation.y = s * Math.PI / 2; sisi.position.set(s * 1.34, 1.3, lz); g.add(sisi);
    }
    if (s > 0) { kaca(0.05, 1.3, 4.35, 1.27, 2.35, -2.975); kaca(0.05, 1.3, 4.35, 1.27, 2.35, 2.975); } // jendela kiri: belakang & depan pintu
    else kaca(0.05, 1.3, 10.3, -1.27, 2.35, 0);                 // jendela kanan utuh
    K(0.12, 0.3, 10.3, w, s * 1.27, 3.15, 0);                  // pita atas
    for (const z of [-4.4, -2.6, 2.6, 4.4].concat(s > 0 ? [] : [-0.9, 0.9])) K(0.14, 1.3, 0.1, w, s * 1.27, 2.35, z); // tiang jendela
    if (s > 0) for (const z of [-0.8, 0.8]) K(0.14, 2.75, 0.12, w, 1.27, 1.95, z); // kusen pintu
  }
  kaca(0.05, 0.5, 1.5, 1.27, 3.05, PINTU_BUS_Z);              // kaca di atas bukaan pintu
  /* pintu bus 2 daun geser (kaca berbingkai) di bukaan z 2,6..4,2 — digeser
     keluar ke depan/belakang di luar dinding saat bus berhenti di halte */
  g.userData.pintu = [];
  for (const arah of [-1, 1]) {
    /* daun pintu = bingkai (atas, bawah, kiri, kanan) + kaca bening; dulu
       panel opaque utuh dengan kaca tertanam sehingga tidak tembus pandang */
    const daun = new THREE.Group();
    daun.add(kotak(0.06, 0.55, 0.78, w, 0, -0.925, 0));         // panel bawah
    daun.add(kotak(0.06, 0.12, 0.78, w, 0, 1.14, 0));           // bingkai atas
    for (const dz of [-0.35, 0.35]) daun.add(kotak(0.06, 1.73, 0.08, w, 0, 0.215, dz)); // bingkai samping
    const kc = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.73, 0.62), KACA_KRL); kc.position.y = 0.215; daun.add(kc);
    const z0 = PINTU_BUS_Z + arah * 0.4;
    daun.position.set(1.36, 1.85, z0); g.add(daun);
    g.userData.pintu.push({ daun, z0, arah });
  }
  kaca(2.6, 1.5, 0.06, 0, 2.5, 5.2); K(2.6, 1.2, 0.12, w, 0, 1.15, 5.2);   // depan: kaca depan (rapat ke atap & pilar) + panel
  kaca(2.6, 0.85, 0.06, 0, 2.825, -5.2); K(2.6, 2.0, 0.12, w, 0, 1.4, -5.2);  // belakang: kaca rapat ke panel & atap
  for (const [x, z] of [[-1.27, 5.2], [1.27, 5.2], [-1.27, -5.2], [1.27, -5.2]]) K(0.18, 2.8, 0.18, w, x, 1.95, z); // pilar sudut
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 })); l.position.set(s * 0.9, 0.95, 5.27); g.add(l); }
  // kursi penumpang (2 baris kiri-kanan, menghadap depan)
  for (let r = 0; r < 6; r++) for (const s of [-1, 1]) {
    const z = -4.3 + r * 1.25; if (s > 0 && Math.abs(z - PINTU_BUS_Z) < 1.3) continue; // ruang depan pintu tengah
    /* kursi bus realistis: rangka baja, dudukan & sandaran empuk berlapis kain motif,
       sandaran kepala, pegangan atas sandaran, kaki di dinding & lantai; baris
       depan = kursi prioritas (merah) */
    const prio = r >= 4, kain = prio ? 0xb0283a : 0x2a4f86, kain2 = prio ? 0x8a1f2e : 0x1f3c68;
    K(0.92, 0.14, 0.52, kain, s * 0.72, 1.06, z + 0.02);                         // dudukan empuk
    K(0.92, 0.04, 0.5, kain2, s * 0.72, 1.14, z + 0.02);                         // jahitan/lapisan atas
    K(0.92, 0.7, 0.12, kain, s * 0.72, 1.48, z - 0.25);                          // sandaran
    K(0.4, 0.2, 0.1, kain2, s * 0.72 - 0.22, 1.92, z - 0.26); K(0.4, 0.2, 0.1, kain2, s * 0.72 + 0.22, 1.92, z - 0.26); // sandaran kepala
    K(0.92, 0.05, 0.05, 0xc9ced4, s * 0.72, 1.86, z - 0.33);                     // pegangan belakang sandaran
    K(0.94, 0.1, 0.56, 0x3a3d40, s * 0.72, 0.97, z + 0.02);                      // rangka dudukan
    K(0.06, 0.32, 0.06, 0x8a8f94, s * 0.4, 0.8, z + 0.15);                       // kaki lorong
    K(0.3, 0.06, 0.06, 0x8a8f94, s * 1.12, 1.0, z);                              // dudukan dinding
    (g.userData.kursi || (g.userData.kursi = [])).push({ lx: s * 0.72, ly: 0.59, lz: z + 0.02, rot: 0, isi: null, lorongX: 0.15, lantai: 0.65 }); // titik duduk penumpang
  }
  for (const z of [-3, 1.6, 3.4]) for (const s of [-1, 1]) { K(0.05, 2.7, 0.05, 0xf2c230, s * 0.28, 1.95, z); K(0.09, 0.06, 0.05, 0xd62828, s * 0.28, 1.6, z); } // tiang kuning + tombol STOP merah
  /* lantai anti-selip + lis kuning, panel plafon, ventilasi AC, gantungan tangan,
     validator kartu di pintu, monitor info, CCTV, speaker, area kursi roda */
  K(2.3, 0.02, 10.0, 0x3d4046, 0, 0.66, 0);
  for (let z = -4.8; z <= 4.8; z += 0.4) K(2.3, 0.005, 0.03, 0x4a4e55, 0, 0.672, z);
  K(1.4, 0.006, 1.6, 0xf2c230, 0.55, 0.673, PINTU_BUS_Z);
  K(2.3, 0.04, 10.0, 0xe9ecef, 0, 3.22, 0);                                    // plafon
  for (const sx of [-1, 1]) { K(0.35, 0.08, 9.5, 0xd8dde2, sx * 0.85, 3.16, 0); for (let z = -4; z <= 4; z += 2) K(0.2, 0.02, 0.6, 0x6b6f74, sx * 0.85, 3.11, z); } // saluran AC + kisi
  for (let z = -4.2; z <= 4.2; z += 0.6) for (const sx of [-1, 1]) { K(0.02, 0.28, 0.02, 0x8a8f94, sx * 0.3, 2.92, z); const gt = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 6, 12), M(0xf2c230)); gt.position.set(sx * 0.3, 2.74, z); g.add(gt); } // gantungan tangan
  K(0.22, 0.32, 0.12, 0x1b1d20, 0.75, 1.55, PINTU_BUS_Z + 1.0); { const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0x2aff6a })); sc.position.set(0.75, 1.62, PINTU_BUS_Z + 0.935); sc.rotation.y = Math.PI; g.add(sc); } // validator kartu
  { const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64; const c = cv.getContext("2d"); c.fillStyle = "#06121f"; c.fillRect(0, 0, 256, 64); c.fillStyle = "#ffb020"; c.font = "bold 22px monospace"; c.fillText("Halte berikut:", 10, 26); c.fillStyle = "#ffffff"; c.fillText("HUB TRANS MERDU", 10, 54);
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) })); mon.position.set(0, 2.95, 4.9); mon.rotation.y = Math.PI; g.add(mon); K(1.05, 0.3, 0.06, 0x1b1d20, 0, 2.95, 4.94); }
  K(0.12, 0.12, 0.12, 0x1b1d20, 0, 3.12, -4.9); K(0.12, 0.12, 0.12, 0x1b1d20, 0, 3.12, 4.7);   // CCTV
  K(1.0, 0.006, 1.2, 0x2e6fa8, 0.6, 0.674, 2.4); K(0.04, 0.6, 1.0, 0xc9ced4, 1.1, 1.2, 2.4);   // area kursi roda + sandaran
  for (const z of [-1.0, 1.0]) K(0.05, 1.0, 0.05, 0xf2c230, 0.95, 1.6, z); // pegangan pintu
  for (const s of [-1, 1]) K(0.04, 0.04, 9.5, 0xc0c4c8, s * 0.3, 3.05, 0);
  // sopir
  K(0.55, 0.12, 0.55, 0x1b1d20, -0.7, 1.15, 4.25); K(0.55, 0.7, 0.12, 0x1b1d20, -0.7, 1.55, 3.98); K(0.1, 0.45, 0.1, 0x55595e, -0.7, 0.87, 4.25); // kursi sopir bersandaran
  K(2.4, 0.55, 0.5, 0x2b2d30, 0, 1.5, 4.95);                                    // dasbor
  { const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshBasicMaterial({ color: 0x0a2a3a })); panel.position.set(-0.7, 1.78, 4.69); panel.rotation.x = -0.5; panel.rotation.y = Math.PI; g.add(panel);
    for (const dx of [-0.12, 0.12]) { const jm = new THREE.Mesh(new THREE.CircleGeometry(0.07, 14), new THREE.MeshBasicMaterial({ color: 0xffffff })); jm.position.set(-0.7 + dx, 1.79, 4.685); jm.rotation.x = -0.5; jm.rotation.y = Math.PI; g.add(jm); } } // speedometer
  K(0.06, 0.5, 0.06, 0x2b2d30, -0.25, 1.0, 4.45); K(0.1, 0.1, 0.1, 0x111111, -0.25, 1.28, 4.45);  // tuas persneling
  K(0.4, 0.3, 0.3, 0x55595e, 0.3, 1.45, 4.55);                                  // kotak tiket/EDC
  K(0.2, 0.06, 0.35, 0x1b1d20, -0.85, 0.75, 4.6); K(0.2, 0.06, 0.3, 0x1b1d20, -0.55, 0.75, 4.6); // pedal
  K(0.05, 0.9, 1.2, 0xc9ced4, -0.2, 1.15, 3.8);                                 // sekat pengaman sopir
  K(0.6, 0.18, 0.03, 0x1b1d20, -0.7, 2.95, 5.15); K(0.55, 0.13, 0.01, 0x9fc4d6, -0.7, 2.95, 5.13); // kaca spion dalam
  const setir = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), M(0x1b1b1d)); setir.position.set(-0.7, 1.7, 4.62); setir.rotation.x = -1.0; g.add(setir); { const kol = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 8), M(0x1b1b1d)); kol.position.set(-0.7, 1.55, 4.8); kol.rotation.x = 0.55; g.add(kol); }
  for (const dz of [-1.6, 1.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 })); l.position.set(0, 3.22, dz); g.add(l); }
  /* Roda simetris z ±3,4 (overhang depan = belakang), pintu di tengah di
     antara kedua as. Tiap ban berpelek & bernaung spakbor gelap. */
  for (const [x, z] of [[-1.2, 3.4], [1.2, 3.4], [-1.2, -3.4], [1.2, -3.4]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(x, 0.5, z); g.add(r);
    const pelek = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.37, 12), M(0xb8bcc2)); pelek.rotation.z = Math.PI / 2; pelek.position.set(x, 0.5, z); g.add(pelek);
    const sx = Math.sign(x);
    K(0.06, 0.16, 1.3, 0x1b1d20, sx * 1.36, 1.08, z);                           // spakbor atas
    for (const dz of [-0.62, 0.62]) K(0.06, 0.5, 0.1, 0x1b1d20, sx * 1.36, 0.82, z + dz);
  }
  /* KOLONG BUS (dulu satu kotak hitam): rok samping sewarna bodi dengan
     lengkung roda, pelat dasar tipis, 2 rel sasis, as roda + gardan,
     tangki solar, tabung udara rem, knalpot, blok mesin di belakang, pegas
     daun, aki — dengan celah tanah 0,3 m yang benar-benar kosong. */
  for (const s of [-1, 1]) {
    const potongR = [[-4.05, -2.75], [2.75, 4.05]].concat(s > 0 ? [[-0.8, 0.8]] : []).sort((a, b) => a[0] - b[0]);
    let za = -5.15;
    for (const [a, b] of potongR.concat([[5.15, 5.15]])) { if (a > za) { K(0.1, 0.28, a - za, w, s * 1.26, 0.48, (a + za) / 2); K(0.11, 0.05, a - za, 0x1b1d20, s * 1.265, 0.35, (a + za) / 2); } za = b; }
  }
  K(2.3, 0.04, 10.1, 0x3a3d40, 0, 0.34, 0);                                       // pelat dasar
  for (const sx of [-0.45, 0.45]) K(0.14, 0.18, 9.8, 0x1b1d20, sx, 0.26, 0);      // rel sasis
  for (const z of [-3.4, 3.4]) { const as = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), M(0x2a2c30)); as.rotation.z = Math.PI / 2; as.position.set(0, 0.5, z); g.add(as); // as roda
    for (const sx of [-0.45, 0.45]) { K(0.1, 0.06, 1.2, 0x3a3d40, sx, 0.62, z); K(0.1, 0.05, 1.0, 0x3a3d40, sx, 0.56, z); } } // pegas daun
  { const gd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M(0x2a2c30)); gd.position.set(0, 0.5, -3.4); g.add(gd); }  // gardan belakang
  K(0.08, 0.08, 6.5, 0x55595e, 0, 0.3, 0);                                         // poros propeler
  K(0.5, 0.42, 1.4, 0x5f6b75, -0.85, 0.28, 0.6);                                   // tangki solar
  for (const z of [-1.2, -1.8]) { const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 10), M(0x8a8f94)); tb.rotation.z = Math.PI / 2; tb.position.set(0.6, 0.24, z); g.add(tb); } // tabung udara rem
  K(0.4, 0.3, 0.5, 0x1b1d20, 0.8, 0.27, 1.8);                                      // kotak aki
  K(1.4, 0.45, 1.5, 0x3a3d40, 0, 0.36, -4.4);                                      // blok mesin belakang
  { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), M(0x6b6f74)); kn.rotation.x = Math.PI / 2; kn.position.set(-0.7, 0.2, -3.9); g.add(kn); } // knalpot
  // tangga & ambang pintu tengah: lantai menyambung ke tepi, satu anak tangga, karet ambang
  K(0.35, 0.18, 1.5, 0x55595e, 1.15, 0.6, PINTU_BUS_Z);
  K(0.3, 0.12, 1.5, 0x8a8f94, 1.3, 0.3, PINTU_BUS_Z);
  K(0.04, 0.04, 1.55, 0xf2c230, 1.32, 0.69, PINTU_BUS_Z);
  /* detail realistis: papan tujuan LED, bumper, gril, spion bertangkai,
     wiper, AC atap, pelat nomor, lis atap membulat, kaca belakang mesin */
  const cvLed = document.createElement("canvas"); cvLed.width = 256; cvLed.height = 48; const cl = cvLed.getContext("2d");
  cl.fillStyle = "#111"; cl.fillRect(0, 0, 256, 48); cl.fillStyle = "#ffb020"; cl.font = "bold 30px monospace"; cl.textAlign = "center"; cl.fillText("TRANS MERDU", 128, 35);
  const led = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.34), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cvLed) })); led.position.set(0, 3.12, 5.28); g.add(led);
  K(2.62, 0.3, 0.2, 0x2b2d30, 0, 0.55, 5.32); K(2.62, 0.3, 0.2, 0x2b2d30, 0, 0.55, -5.32);   // bumper
  K(1.3, 0.4, 0.05, 0x1d1f22, 0, 0.95, 5.27);                                                  // gril
  K(0.6, 0.14, 0.03, 0x111111, 0, 0.55, 5.43); K(0.6, 0.14, 0.03, 0x111111, 0, 0.75, -5.4);  // pelat nomor
  for (const sx of [-1, 1]) {
    K(0.05, 0.05, 0.5, 0x1b1d20, sx * 1.42, 2.75, 5.35); K(0.07, 0.5, 0.2, 0x1b1d20, sx * 1.62, 2.4, 5.55); // spion bertangkai
    const wp = K(0.03, 0.9, 0.03, 0x111111, sx * 0.55, 1.95, 5.24); wp.rotation.z = sx * 0.9;  // wiper
  }
  K(1.6, 0.35, 2.4, 0xdfe3e6, 0, 3.6, -1.5); K(1.4, 0.06, 2.2, 0x8a8f94, 0, 3.8, -1.5);        // AC atap
  for (const sx of [-1, 1]) K(0.16, 0.16, 10.5, w, sx * 1.22, 3.42, 0);                        // lis atap membulat
  for (let i = 0; i < 5; i++) K(1.5, 0.05, 0.08, 0x1b1d20, 0, 0.95 + i * 0.12, -5.27);         // kisi mesin belakang (dipersempit: sudut untuk lampu)
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("TRANS MERDU", "Keliling Kota") }));
  papan.position.set(0, 3.0, -5.28); papan.rotation.y = Math.PI; g.add(papan);
  /* lampu: rem merah (terang saat berhenti/melambat), sein kuning kiri (+x)
     & kanan (-x) di 4 sudut + samping, lampu mundur/kabut tidak perlu */
  const matRem = new THREE.MeshBasicMaterial({ color: 0x8a1212 });
  for (const sx of [-1, 1]) {
    // lampu belakang vertikal di sudut, MENONJOL dari panel (z -5.26) supaya tidak tertutup bodi/kisi
    K(0.32, 1.05, 0.06, 0x16181b, sx * 1.1, 1.42, -5.285);                                      // rumah lampu gelap
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.05), matRem); r.position.set(sx * 1.1, 1.22, -5.325); g.add(r);
    const mundur = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 })); mundur.position.set(sx * 1.1, 1.84, -5.325); g.add(mundur);
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); d.position.set(sx * 0.9, 0.95, 5.24); g.add(d);
  }
  const lampuRem3 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.06), matRem); lampuRem3.position.set(0, 3.25, -5.3); g.add(lampuRem3);
  const sein = { 1: [], "-1": [] }, matSein = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  for (const sx of [-1, 1]) for (const [x, y, z, w, h, d] of [[sx * 1.15, 0.95, 5.24, 0.2, 0.18, 0.06], [sx * 1.1, 1.66, -5.325, 0.24, 0.22, 0.05], [sx * 1.36, 1.0, 4.6, 0.04, 0.14, 0.35]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matSein); m.position.set(x, y, z); m.visible = false; g.add(m); sein[sx].push(m);
  }
  g.userData.lampu = { matRem, sein };
  return g;
}
/* ================= RUTE BUS (jalur halus) =================
   Koridor 1 keliling kota (kol 32/48, bar 18/36) + Koridor 2 Plaza (2A ke
   barat lewat busway plaza, 2B ke timur). Lintasan dari jalurPoligon():
   sudut dibulatkan (r 10 di as jalan) & lajur kiri 3,5 -> bus berbelok
   melengkung, melambat di tikungan, arah hadap dihaluskan. */
const cxK = (k) => sudutBlok(k, 0).x + JALAN / 2, czB = (b) => sudutBlok(0, b).z + JALAN / 2;
const RUTE = []; // [{R, halte:[{s, pos, entri}]}]
const HUB = []; // entri halte di Hub Trans Merdu (transit antar koridor)
const XHUB = XST + 78; // pusat hub: di timur Stasiun Merdu, jalan bar 36
const HALTE_SEMUA = []; // entri halte (untuk penumpang menunggu)
const STASIUN = []; // {nama, x, z (as rel), pintu:{x,z}}

/* Gedung Hub Trans Merdu: kanopi panjang di kedua sisi jalan bar 36 (di
   bawah rel layang), papan rute, papan info transit & jalur pejalan ke
   Stasiun Merdu. Halte koridor berada di bawah kanopi ini. */
function bangunGedungHub(grup, z) {
  for (const sisi of [-1, 1]) {
    const zk = z + sisi * 10.4, x0 = XHUB - 30, x1 = XHUB + 32;
    grup.add(kotak(x1 - x0, 0.3, 5.2, 0x1d5a8f, (x0 + x1) / 2, 4.4, zk));             // atap kanopi
    grup.add(kotak(x1 - x0, 0.5, 0.25, 0xf2c230, (x0 + x1) / 2, 4.1, zk - sisi * 2.5)); // lis kuning
    for (let x = x0 + 2; x <= x1 - 2; x += 10) { grup.add(kotak(0.3, 4.3, 0.3, 0xb8bcc2, x, 2.15, zk + sisi * 2.2)); rintanganTransportasi.push({ minX: x - 0.3, maxX: x + 0.3, minZ: zk + sisi * 2.2 - 0.3, maxZ: zk + sisi * 2.2 + 0.3 }); }
    grup.add(kotak(x1 - x0, 0.15, 5.2, 0xd8d2c4, (x0 + x1) / 2, 0.08, zk));            // lantai peron
    const papan = new THREE.Mesh(new THREE.BoxGeometry(16, 2, 0.25), new THREE.MeshStandardMaterial({ map: teksturPapanNama("HUB TRANS MERDU", sisi > 0 ? "Koridor 1 · 2B · KRL" : "Koridor 2A · KRL"), roughness: 0.8 }));
    papan.position.set(XHUB, 5.7, zk); if (sisi < 0) papan.rotation.y = Math.PI; grup.add(papan);
    const jh = buatJam(0.8); jh.position.set(XHUB + 10, 5.7, zk + sisi * 0.2); if (sisi < 0) jh.rotation.y = Math.PI; grup.add(jh);
    // papan info transit (peta koridor)
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 256; const c = cv.getContext("2d");
    c.fillStyle = "#0f2f4f"; c.fillRect(0, 0, 512, 256); c.fillStyle = "#f2c230"; c.font = "bold 34px system-ui"; c.fillText("INFO TRANSIT", 20, 46);
    const baris = [["#2e9e5b", "K1  Keliling Kota"], ["#c8102e", "K2A Plaza → Pasar → Hub"], ["#e8943a", "K2B Hub → Pasar → Plaza"], ["#ffffff", "KRL Keliling Kota · Stasiun Merdu"]];
    baris.forEach(([w, t], i) => { c.fillStyle = w; c.fillRect(20, 70 + i * 44, 26, 26); c.fillStyle = "#ffffff"; c.font = "bold 24px system-ui"; c.fillText(t, 60, 92 + i * 44); });
    const info = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
    info.position.set(XHUB - 22, 2.0, zk + sisi * 2.35); info.rotation.y = sisi > 0 ? Math.PI : 0; grup.add(info);
    grup.add(kotak(3.4, 2.3, 0.15, 0x2b2d30, XHUB - 22, 1.85, zk + sisi * 2.45));
  }
}

/* ---------- KRL keliling ---------- */
function stopUntuk(J) { // s kepala kereta saat berhenti di tiap stasiun (pusat rangkaian di pusat peron)
  return STASIUN.map((st, idx) => ({ idx, s: (sTerdekatJalur(J, st.x, st.z + (J === JALUR_A ? -2.2 : 2.2) * (st.z === RZ ? 1 : -1)) + 21.3) % J.total }));
}

/* Titik henti lampu lalu lintas untuk bus di satu rute jalur: satu per
   persimpangan ber-lampu yang dilalui rute (persimpanganKota di inti.js
  bangunAksesPeron(grup, XST, RZ); bangunAksesPeron(grup, X_UTARA, ZN);
   sudah mengecualikan kotak jalan tertutup plaza). s = posisi pusat bus
   saat berhenti (moncong di belakang garis henti); sumbu dari arah rute
   di titik itu: "tb" gerak timur-barat, "us" utara-selatan. */
function bangunTitikHentiJalur(R) {
  const TITIK = [], HENTI = 13.5;
  for (const p of persimpanganKota()) {
    const s = sTerdekatJalur(R, p.cx, p.cz), pos = posJalur(R, s);
    if (Math.hypot(pos.x - p.cx, pos.z - p.cz) > JALAN) continue; // persimpangan tidak dilalui rute ini
    const sumbu = Math.abs(pos.hx) >= Math.abs(pos.hz) ? "tb" : "us";
    TITIK.push({ s: ((s - HENTI) % R.total + R.total) % R.total, sumbu });
  }
  TITIK.sort((a, b) => a.s - b.s);
  return TITIK;
}

export function bangunTransportasi() {
  const grup = new THREE.Group(); grupPenumpang = grup;
  bangunRel(grup); bangunStasiun(grup, { x: XST, sBlok: sSt }); bangunStasiunUtara(grup);
  STASIUN.push({ nama: "Stasiun Merdu", x: XST, z: RZ, pintu: { x: XST, z: sSt.z + JALAN + 21 } });
  STASIUN.push({ nama: "Stasiun Merdu Utara", x: X_UTARA, z: ZN, pintu: { x: X_UTARA, z: ZN + 27.5 } });
  for (const [J, nama] of [[JALUR_A, "A"], [JALUR_B, "B"]]) {
    const stop = stopUntuk(J);
    for (let j = 0; j < N_KRL; j++) { // armada per arah, tersebar rata (headway = keliling / N_KRL)
      const k = buatKereta(); grup.add(k);
      kereta.push({ g: k, mobil: k.userData.gerbong, J, jalur: nama, s: (stop[0].s + J.total * (0.12 + j / N_KRL)) % J.total, v: 20, berhenti: 0, stop, sudahIdx: -1, stasiunKini: -1 });
    }
  }
  for (const k of kereta) aturGerbong(k);
  for (const st of STASIUN) for (const sisi of [-1, 1]) for (let i = 0; i < 3; i++) // penumpang menunggu di peron
    tambahTunggu(st.entri || (st.entri = { peron: true, tunggu: { "-1": [], "1": [] } }), { x: st.x - 18 + i * 18 + (sisi > 0 ? 6 : 0), z: st.z + sisi * 6.6, y: YD + 1.2, yaw: sisi > 0 ? Math.PI : 0 }, String(sisi));

  const R1 = jalurPoligon([[cxK(32), czB(18)], [cxK(48), czB(18)], [cxK(48), czB(36)], [cxK(32), czB(36)]], { r: 10, L: 3.5 });
  /* ===== HUB TRANS MERDU (24 Nov 2026) =====
     Semua koridor bus melewati SATU hub di jalan bar 36 tepat di timur
     Stasiun Merdu (x 445..480): penumpang turun di hub lalu pindah ke halte
     koridor lain (transit) atau ke KRL. Koridor:
       K1  : keliling kol 32-48 / bar 18-36 (lewat hub arah barat)
       K2A : Plaza (busway, ke barat) -> kol 38 ke selatan -> hub (ke timur)
             -> kol 46 ke utara -> bar 26 -> kol 42 -> busway
       K2B : kebalikan K2A (lewat hub ke barat)  */
  const POLI2 = [[cxK(42), BUSWAY_Z_DUNIA], [cxK(38), BUSWAY_Z_DUNIA], [cxK(38), czB(36)], [cxK(46), czB(36)], [cxK(46), czB(26)], [cxK(42), czB(26)]];
  const R2A = jalurPoligon(POLI2, { r: 10, L: 3.5 });
  const R2B = jalurPoligon(POLI2.slice().reverse(), { r: 10, L: 3.5 });
  RUTE.push({ R: R1, halte: [], nama: "Koridor 1", henti: bangunTitikHentiJalur(R1) }, { R: R2A, halte: [], nama: "Koridor 2A", henti: bangunTitikHentiJalur(R2A) }, { R: R2B, halte: [], nama: "Koridor 2B", henti: bangunTitikHentiJalur(R2B) });
  const pasangHalte = (r, sh, nama, sub) => {
    const p = posJalur(r.R, sh), l = Math.hypot(p.hx, p.hz);
    const nx = -p.hz / l, nz = p.hx / l; // -n = sisi kiri arah gerak
    const h = new THREE.Group();
    h.add(kotak(5, 0.2, 2, 0x1d5a8f, 0, 2.8, 0)); h.add(kotak(5, 2.4, 0.1, 0x9fc9d8, 0, 1.4, -0.9));
    for (const sx of [-2.3, 2.3]) h.add(kotak(0.12, 2.8, 0.12, 0xb8bcc2, sx, 1.4, -0.9));
    h.add(kotak(4, 0.12, 0.6, 0xa9743f, 0, 0.6, -0.5));
    if (nama) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({ map: teksturPapanNama(nama, sub || "Trans Merdu") })); pp.position.set(0, 3.15, 0.95); h.add(pp); }
    const hx = p.x - nx * 4.6, hz = p.z - nz * 4.6, hy = tinggiBus(hx, hz) - 0.02;
    h.position.set(hx, hy, hz);
    h.rotation.y = Math.atan2(p.hx, p.hz) - Math.PI / 2; // dinding belakang menjauhi jalan
    grup.add(h);
    const tx = p.hx / l, tz = p.hz / l; // arah sepanjang trotoar
    const entri = { halte: true, tunggu: { h: [] }, normal: { x: -nx, z: -nz }, y: hy, pusat: { x: hx + nx * 0.6, z: hz + nz * 0.6, yaw: Math.atan2(nx, nz) }, tangen: { x: tx, z: tz }, rute: r };
    HALTE_SEMUA.push(entri);
    for (let i = 0; i < 2; i++) tambahTunggu(entri, { x: hx + nx * 0.6 + (i - 0.5) * 1.4 * nz, z: hz + nz * 0.6 - (i - 0.5) * 1.4 * nx, y: hy + 0.02, yaw: Math.atan2(nx, nz) }, "h");
    r.halte.push({ s: sh, pos: { x: p.x - nx * 3.3, z: p.z - nz * 3.3, yaw: Math.atan2(-p.hx, -p.hz) }, entri });
    return entri;
  };
  const zHub = czB(36);
  // halte hub (dipasang dulu); halte biasa K1 yang terlalu dekat hub dilewati
  const hubK1 = pasangHalte(RUTE[0], sTerdekatJalur(R1, XHUB + 18, zHub + 3.5), "HUB TRANS MERDU", "Koridor 1");
  const hubK2B = pasangHalte(RUTE[2], sTerdekatJalur(R2B, XHUB - 4, zHub + 3.5), "HUB TRANS MERDU", "Koridor 2B");
  const hubK2A = pasangHalte(RUTE[1], sTerdekatJalur(R2A, XHUB + 6, zHub - 3.5), "HUB TRANS MERDU", "Koridor 2A");
  for (const e of [hubK1, hubK2B, hubK2A]) { e.hub = true; HUB.push(e); }
  for (let i = 0; i < 6; i++) {
    const sh = R1.total * (i + 0.5) / 6, q = posJalur(R1, sh);
    if (Math.hypot(q.x - XHUB, q.z - zHub) > 80) pasangHalte(RUTE[0], sh, null);
  }
  pasangHalte(RUTE[1], sTerdekatJalur(R2A, PUSAT_X - 30, BUSWAY_Z_DUNIA + 3.5), "Halte Plaza");
  pasangHalte(RUTE[2], sTerdekatJalur(R2B, PUSAT_X + 30, BUSWAY_Z_DUNIA - 3.5), "Halte Plaza");
  pasangHalte(RUTE[1], sTerdekatJalur(R2A, cxK(38) - 3.5, czB(30)), "Halte Pasar");
  pasangHalte(RUTE[2], sTerdekatJalur(R2B, cxK(38) + 3.5, czB(30)), "Halte Pasar");
  pasangHalte(RUTE[1], sTerdekatJalur(R2A, cxK(46) + 3.5, czB(31)), "Halte Masjid");
  pasangHalte(RUTE[2], sTerdekatJalur(R2B, cxK(46) - 3.5, czB(31)), "Halte Masjid");
  for (const r of RUTE) r.halte.sort((a, b) => a.s - b.s);
  bangunGedungHub(grup, zHub);
  const WARNA = ["#2e9e5b", "#1d5a8f", "#e8943a", "#c8102e", "#7b2ff7"];
  for (let i = 0; i < N_BUS[0]; i++) { const b = buatBus(WARNA[i % WARNA.length]); grup.add(b); bus.push({ g: b, r: 0, s: R1.total * i / N_BUS[0], v: 0, tunggu: 0, halteTerakhir: -1, halteKini: null }); }
  for (const r of [1, 2]) for (let i = 0; i < N_BUS[r]; i++) {
    const b = buatBus(r === 1 ? "#c8102e" : "#e8943a"); grup.add(b);
    bus.push({ g: b, r, s: RUTE[r].R.total * (i / N_BUS[r] + 0.05), v: 0, tunggu: 0, halteTerakhir: -1, halteKini: null });
  }
  for (const b of bus) isiAwal(b.g, 2 + Math.floor(Math.random() * 3));      // penumpang awal
  for (const k of kereta) for (const c of k.mobil) isiAwal(c, 2 + Math.floor(Math.random() * 2));
  scene.add(grup);
  return grup;
}

/* posisi kendaraan untuk suara berposisi (suara.js) */
export function posisiSuaraKendaraan() {
  return {
    bus: bus.map((b) => ({ x: b.g.position.x, z: b.g.position.z, jalan: b.v > 0.5 })),
    krl: kereta.map((k) => { const p = k.mobil[1].position; return { x: p.x, z: p.z, jalan: k.v > 1 }; }),
  };
}
/* Posisi & arah tiap gerbong mengikuti lengkung rel: titik bogie depan &
   belakang (±5 m dari pusat gerbong) di lintasan -> gerbong berbelok mulus
   dan rangkaian "melipat" di tikungan seperti kereta sungguhan. */
/* Masih ada warga yang naik/turun kendaraan ini? (menunggu giliran,
   berjalan ke pintu, atau di ambang pintu) -> pintu tetap terbuka. */
function sibuk(v) { for (const o of AKTIF) if (o.veh === v) return true; return false; }
function perbaruiPintuKrl(k) {
  const e = k.buka * k.buka * (3 - 2 * k.buka);
  for (const c of k.mobil) for (const pt of c.userData.pintu) {
    const aktif = pt.sisi === (k.sisiPintu || 0) ? e : 0; // hanya sisi yang menghadap peron
    pt.daun.position.x = pt.x0 + pt.arah * aktif * 0.66;
  }
}
function aturGerbong(k) {
  k.mobil.forEach((c, i) => {
    const sc = k.s - i * 14.2, a = posJalur(k.J, sc + 5), b = posJalur(k.J, sc - 5);
    c.position.set((a.x + b.x) / 2, YD + 0.7, (a.z + b.z) / 2); // roda bogie di atas rel, lantai sejajar peron
    c.rotation.y = Math.atan2(-(a.z - b.z), a.x - b.x);
  });
}

export function perbaruiTransportasi(t, dt) {
  const fase = faseLaluLintas(t); // fase lampu kota yang sama dengan tiang & mobil
  for (const k of kereta) {
    // pintu KRL: buka di sisi peron selama berhenti, menutup 2,5 dtk sebelum berangkat
    const sasaranK = k.berhenti > 2.5 ? 1 : 0;
    if (k.buka === undefined) k.buka = 0;
    if (k.buka !== sasaranK) { k.buka += Math.sign(sasaranK - k.buka) * Math.min(Math.abs(sasaranK - k.buka), dt / 0.9); perbaruiPintuKrl(k); }
    if (k.berhenti > 0) {
      k.tahan = (k.tahan || 0) + dt;
      if (k.berhenti - dt <= 2.6 && sibuk(k) && k.tahan < 40) { k.berhenti = 2.6; continue; } // tunggu penumpang selesai
      if (k.berhenti - dt <= 2.6 && k.tahan < 45) { // atur headway: tahan bila terlalu rapat dengan KRL di depan
        const ideal = k.J.total / N_KRL, depan = jarakKeDepan(kereta, k, k.J.total, (x) => x.J === k.J);
        if (depan < ideal * 0.8) { k.berhenti = 2.6; continue; }
      }
      k.berhenti -= dt; if (k.berhenti <= 0) k.tahan = 0;
      if (k.berhenti <= 0) { k.sudahIdx = k.stasiunKini; k.stasiunKini = -1; bunyiPeristiwa("krlBerangkat", k.mobil[1].position); }
      continue;
    }
    let vMaks = 34;
    { // jarak aman ke KRL di depan (panjang rangkaian ±86 m + jarak aman 60 m)
      const depan = jarakKeDepan(kereta, k, k.J.total, (x) => x.J === k.J);
      vMaks = Math.min(vMaks, Math.sqrt(2 * 2.6 * Math.max(0, depan - 120)));
    }
    const dB = jarakKeBelok(k.J, k.s + 6, 160); // melambat sebelum & selama tikungan
    if (dB < 160) vMaks = Math.min(vMaks, 15 + dB * 0.12);
    for (const st of k.stop) {
      if (st.idx === k.sudahIdx) continue;
      const jarak = ((st.s - k.s) % k.J.total + k.J.total) % k.J.total;
      if (jarak < 170) vMaks = Math.min(vMaks, Math.max(2.5, Math.sqrt(2 * 3.2 * jarak)));
      if (jarak < 0.6) { k.v = 0; k.berhenti = 14; k.stasiunKini = st.idx; peristiwaKeretaBerhenti(k, st.idx); break; }
    }
    k.v += Math.sign(vMaks - k.v) * Math.min(Math.abs(vMaks - k.v), 5 * dt);
    k.s = (k.s + k.v * dt) % k.J.total;
    if (k.sudahIdx >= 0) { const st = k.stop.find((x) => x.idx === k.sudahIdx); const lewat = ((k.s - st.s) % k.J.total + k.J.total) % k.J.total; if (lewat > 300 && lewat < k.J.total - 300) k.sudahIdx = -1; }
    aturGerbong(k);
  }
  if (!RUTE.length) return;
  /* HEADWAY per koridor: jarak target antarbus = keliling rute koridor /
     jumlah busnya; dipakai untuk menahan berangkat dari halte dan
     membatasi kecepatan kejar — supaya bus tidak menumpuk/beriringan. */
  const perKoridor = RUTE.map((kor, ri) => ({ kor, daftar: bus.filter((x) => x.r === ri) }));
  for (const { kor, daftar } of perKoridor) {
    const TARGET = kor.R.total / Math.max(1, daftar.length);
    for (const b of daftar) {
      let gap = Infinity;
      for (const o of daftar) { if (o === b) continue; const d = ((o.s - b.s) % kor.R.total + kor.R.total) % kor.R.total; if (d > 0.01 && d < gap) gap = d; }
      b.gap = daftar.length > 1 ? gap : TARGET;
    }
  }
  for (const b of bus) {
    const r = RUTE[b.r];
    if (b.tunggu > 0 && b.tunggu - dt <= 1.3 && sibuk(b) && (b.tahan = (b.tahan || 0) + dt) < 30) { b.tunggu = 1.3; b.v = 0; } // pintu terbuka sampai penumpang selesai
    else if (b.tunggu > 0) { b.tunggu -= dt; b.v = 0; if (b.tunggu <= 0) { b.tahan = 0; const db = perKoridor[b.r].daftar; if (db.length > 1 && b.gap < (r.R.total / db.length) * 0.85) b.tunggu = 0.5; else { bunyiPeristiwa("busBerangkat", b.g.position); if (b.halteKini && b.halteKini.entri) b.halteKini.entri.isiUlang = 9 + Math.random() * 8; b.halteKini = null; } } }
    else {
      const dB = jarakKeBelok(r.R, b.s + 3, 16), vMaks = dB < 16 ? 4.5 + dB * 0.3 : 9; // pelan di tikungan
      let vM = vMaks;
      r.halte.forEach((h, i) => { if (i === b.halteTerakhir) return; const j = ((h.s - b.s) % r.R.total + r.R.total) % r.R.total; if (j < 20) vM = Math.min(vM, Math.max(1.5, Math.sqrt(2 * 2.5 * j))); });
      const db2 = perKoridor[b.r].daftar; // headway: jangan menabrak/menumpuk di belakang bus depan
      if (db2.length > 1) { const TARGET2 = r.R.total / db2.length; vM = Math.min(vM, b.gap < 60 ? Math.max(0, (b.gap - 14) * 0.3) : Math.min(9, Math.max(4, 9 * b.gap / TARGET2))); }
      /* Lampu lalu lintas: melambat ke garis henti persimpangan berikutnya
         bila fase sumbu gerak bus bukan hijau (merah/kuning = berhenti,
         sama seperti mobil kota); bus yang sudah melewati garis henti
         lanjut menyeberang. */
      let dHenti = Infinity, sumbuHenti = null;
      for (const th of r.henti) { const d = ((th.s - b.s) % r.R.total + r.R.total) % r.R.total; if (d > 0.01 && d < dHenti) { dHenti = d; sumbuHenti = th.sumbu; } }
      if (sumbuHenti && (sumbuHenti === "tb" ? fase.tb : fase.us) !== "hijau" && dHenti < 34) vM = Math.min(vM, dHenti < 0.5 ? 0 : Math.max(0.9, dHenti * 0.55));
      { const q = posJalur(r.R, b.s); vM = Math.min(vM, batasLampuMerah(q.x, q.z, q.hx, q.hz, 5.3, b.v)); } // lampu merah: berhenti di belakang garis henti
      b.v += Math.sign(vM - b.v) * Math.min(Math.abs(vM - b.v), (vM < b.v ? 8 : 4) * dt);
      b.s = (b.s + b.v * dt) % r.R.total;
      r.halte.forEach((h, i) => { if (i !== b.halteTerakhir && Math.abs(((b.s - h.s) % r.R.total + r.R.total) % r.R.total) < 0.6) { b.tunggu = 7; b.halteTerakhir = i; b.halteKini = h; peristiwaBusBerhenti(b, h.entri); } });
    }
    const sasaranB = b.tunggu > 1.2 ? 1 : 0; // pintu bus: buka di halte, tutup sebelum jalan
    if (b.buka === undefined) b.buka = 0;
    if (b.buka !== sasaranB) {
      b.buka += Math.sign(sasaranB - b.buka) * Math.min(Math.abs(sasaranB - b.buka), dt / 0.7);
      const e = b.buka * b.buka * (3 - 2 * b.buka);
      for (const pt of b.g.userData.pintu) pt.daun.position.z = pt.z0 + pt.arah * e * 0.8;
    }
    { // lampu rem & sein bus (sein juga menyala saat keluar dari halte = menepi/ masuk lajur)
      const L = b.g.userData.lampu, tNow = performance.now() / 1000;
      const rem = b.tunggu > 0 || b.v < 0.5 || (b.vLalu !== undefined && b.v < b.vLalu - 0.01);
      b.vLalu = b.v;
      L.matRem.color.setHex(rem ? 0xff2a2a : 0x8a1212);
      let arah = arahSein(r.R, b.s, 20);
      if (!arah && b.tunggu > 0 && b.tunggu < 2.5) arah = -1; // mau berangkat dari halte: sein kanan
      const nyala = arah !== 0 && kedip(tNow, b.s * 0.01);
      for (const m of L.sein[1]) m.visible = nyala && arah > 0;
      for (const m of L.sein[-1]) m.visible = nyala && arah < 0;
    }
    const p = posJalur(r.R, b.s);
    b.g.position.set(p.x, tinggiBus(p.x, p.z), p.z); b.g.rotation.y = arahHalus(r.R, b.s, 2.5);
  }
  perbaruiGerbangBus(dt, bus.map((b) => b.g.position));
  perbaruiPenumpang(dt);
}

/* ================= PENUMPANG (warga naik-turun) =================
   Setiap halte & peron punya warga MENUNGGU. Saat bus berhenti: 1-2 warga
   TURUN dari pintu bus berjalan ke halte lalu pergi menjauhi jalan, warga
   yang menunggu NAIK berjalan ke pintu & masuk. Saat KRL berhenti: tiap
   gerbong menurunkan 1 warga ke peron (berjalan ke tangga lalu hilang),
   warga di peron naik lewat pintu terdekat. Sesudah kendaraan pergi,
   warga baru berdatangan menunggu lagi. Karakter dipakai ulang dari kolam
   (tidak dibuat ulang tiap kali). */
const KOLAM = [], AKTIF = [];
let grupPenumpang = null, nomorWarga = 0;
const BAJU = ["#c8102e", "#1d5a8f", "#2e9e5b", "#e8943a", "#7b2ff7", "#f2c230", "#e85d75", "#3aa6b9", "#ffffff", "#4a4a4a"];
function ambilKarakter() {
  let k = KOLAM.pop();
  if (!k) { const i = nomorWarga++; k = buatKarakter({ baju: BAJU[i % BAJU.length], kulit: ["#f1c27d", "#c68642", "#e0ac69", "#8d5524"][(i * 7) % 4], topi: i % 4 === 1 ? "hijab" : "tanpa" }); k.userData.geserHidup = i * 0.6; grupPenumpang.add(k); }
  k.visible = true; return k;
}
function lepasKarakter(o) { o.kar.visible = false; KOLAM.push(o.kar); const i = AKTIF.indexOf(o); if (i >= 0) AKTIF.splice(i, 1); }
/* o.rute = [{x,y,z}, ...] dilalui berurutan; selesai -> o.akhir(o) */
function jalankan(kar, rute, akhir, tunda, posisiAwal) {
  const o = { kar, rute, akhir, tunda: tunda || 0, v: 1.5 + Math.random() * 0.4 };
  if (posisiAwal) kar.position.set(posisiAwal.x, posisiAwal.y, posisiAwal.z);
  AKTIF.push(o); return o;
}
function tambahTunggu(entri, pos, kunci) {
  const kar = ambilKarakter(); kar.position.set(pos.x, pos.y, pos.z); kar.rotation.y = pos.yaw;
  const o = { kar, rute: [], diam: true, pos, kunci, v: 1.5 };
  AKTIF.push(o); entri.tunggu[kunci].push(o); return o;
}
let jedaLod = 0;
function perbaruiPenumpang(dt) {
  const t = performance.now() / 1000;
  if ((jedaLod -= dt) <= 0) { // penumpang duduk hanya digambar bila kamera cukup dekat (hemat draw call)
    jedaLod = 0.4;
    for (const o of AKTIF) if (o.duduk && o.induk) { o.induk.getWorldPosition(_wp); o.kar.visible = _wp.distanceTo(camera.position) < jarakDetail() * 0.56; } // ikut kualitas grafik
  }
  for (let n = AKTIF.length - 1; n >= 0; n--) {
    const o = AKTIF[n], k = o.kar;
    if (o.tunda > 0) { o.tunda -= dt; animasiHidup(k, t, true); continue; }
    if (!o.rute.length) { animasiHidup(k, t, true); if (!o.duduk) animasiJalan(k, 0, dt); continue; }
    const tj = o.rute[0], dx = tj.x - k.position.x, dz = tj.z - k.position.z, d = Math.hypot(dx, dz);
    const langkah = Math.min(d, o.v * dt);
    if (d > 0.05) {
      k.position.x += dx / d * langkah; k.position.z += dz / d * langkah;
      let sas = Math.atan2(dx, dz), sel = sas - k.rotation.y; while (sel > Math.PI) sel -= Math.PI * 2; while (sel < -Math.PI) sel += Math.PI * 2;
      k.rotation.y += sel * (1 - Math.exp(-dt * 10));
    }
    k.position.y += (tj.y - k.position.y) * (1 - Math.exp(-dt * 8));
    animasiJalan(k, langkah, dt); animasiHidup(k, t, false);
    if (d < 0.08) { o.rute.shift(); if (!o.rute.length && o.akhir) o.akhir(o); }
  }
  for (const e of HALTE_SEMUA.concat(STASIUN.map((s) => s.entri))) { // warga baru berdatangan ke halte/peron yang kosong
    if (!e || !(e.isiUlang > 0)) continue;
    e.isiUlang -= dt; if (e.isiUlang > 0) continue;
    for (const kunci of Object.keys(e.tunggu)) e.tunggu[kunci] = e.tunggu[kunci].filter((o) => !(o.transit && (o.pergi || !o.kar.visible))); // penumpang transit tidak diganti
    for (const kunci of Object.keys(e.tunggu)) for (const o of e.tunggu[kunci]) if (!o.kar.visible || o.pergi) {
      const kar = ambilKarakter(), pos = o.pos, asal = e.halte ? { x: pos.x + e.normal.x * 9, y: pos.y, z: pos.z + e.normal.z * 9 } : { x: e.tangga.x, y: pos.y, z: pos.z };
      const baru = { kar, rute: [{ x: pos.x, y: pos.y, z: pos.z }], v: 1.4, pos, kunci, akhir: (b) => { b.kar.rotation.y = pos.yaw; } };
      kar.position.set(asal.x, asal.y, asal.z); AKTIF.push(baru);
      e.tunggu[kunci][e.tunggu[kunci].indexOf(o)] = baru;
    }
  }
}
/* ---------- penumpang DI DALAM kendaraan: berjalan ke kursi & duduk ----------
   Warga yang naik tidak lagi menghilang: setelah melewati pintu ia
   menjadi anak grup kendaraan (ikut terbawa), berjalan di lorong ke kursi
   kosong lalu duduk. Di pemberhentian berikutnya sebagian penumpang yang
   duduk berdiri, berjalan ke pintu & turun. */
const _wp = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function yawDunia(o) { o.getWorldQuaternion(_q); return _e.setFromQuaternion(_q, "YXZ").y; }
function pindahInduk(kar, induk) {
  kar.getWorldPosition(_wp); const yaw = yawDunia(kar);
  induk.updateMatrixWorld(); induk.add(kar);
  kar.position.copy(induk.worldToLocal(_wp.clone())); kar.rotation.y = yaw - yawDunia(induk);
}
function pose(kar, duduk) { const u = kar.userData; if (u.kakiK) { u.kakiK.rotation.x = duduk ? -1.35 : 0; u.kakiR.rotation.x = duduk ? -1.35 : 0; } }
function kursiKosong(induk, dekatX) {
  const bebas = (induk.userData.kursi || []).filter((k) => !k.isi);
  if (!bebas.length) return null;
  bebas.sort((a, b) => Math.abs(a.lx - dekatX) - Math.abs(b.lx - dekatX) + (Math.random() - 0.5) * 3);
  return bebas[0];
}
function dudukkan(o, kursi, induk) {
  const k = o.kar; if (k.parent !== induk) induk.add(k);
  k.position.set(kursi.lx, kursi.ly, kursi.lz); k.rotation.y = kursi.rot; pose(k, true);
  o.duduk = true; o.kursi = kursi; o.induk = induk; o.rute = []; o.akhir = null; kursi.isi = o;
}
function isiAwal(induk, n) { // penumpang yang sudah duduk sejak awal
  for (let i = 0; i < n; i++) {
    const kursi = kursiKosong(induk, (Math.random() - 0.5) * 10); if (!kursi) return;
    const o = { kar: ambilKarakter(), rute: [], v: 1.4 }; AKTIF.push(o); dudukkan(o, kursi, induk);
  }
}
/* rute lokal dari kursi ke titik pintu-dalam (koordinat kendaraan) */
function ruteKePintu(kursi, pintuLx, pintuLz, bus) {
  const y = kursi.lantai;
  if (bus) return [{ x: kursi.lorongX, y, z: kursi.lz + 0.5 }, { x: kursi.lorongX, y, z: pintuLz }, { x: pintuLx, y, z: pintuLz }];
  return [{ x: kursi.lx, y, z: kursi.lz * 0.45 }, { x: pintuLx, y, z: 0 }, { x: pintuLx, y, z: pintuLz }];
}
function ruteKeKursi(kursi, pintuLx, pintuLz, bus) {
  const y = kursi.lantai;
  if (bus) return [{ x: kursi.lorongX, y, z: pintuLz }, { x: kursi.lorongX, y, z: kursi.lz + 0.5 }, { x: kursi.lx, y, z: kursi.lz + 0.45 }];
  return [{ x: pintuLx, y, z: 0 }, { x: kursi.lx, y, z: 0 }, { x: kursi.lx, y, z: kursi.lz * 0.6 }];
}
/* seorang penumpang yang duduk berdiri & turun; ruteLuar = rute dunia setelah keluar pintu */
const zJalanHub = () => sudutBlok(0, 36).z + JALAN / 2;
const X_ZEBRA_HUB = sudutBlok(45, 0).x + JALAN + 2.5;
function turunkan(o, pintuLx, pintuLz, bus, ruteLuar, tunda, veh, akhirLuar) {
  const kursi = o.kursi; kursi.isi = null; o.kursi = null; o.duduk = false; o.veh = veh; // kendaraan menunggu sampai ia keluar pintu
  o.kar.visible = true; pose(o.kar, false);
  o.tunda = tunda; o.rute = ruteKePintu(kursi, pintuLx, pintuLz, bus);
  o.akhir = (x) => { x.veh = null; pindahInduk(x.kar, grupPenumpang); x.rute = ruteLuar; x.akhir = akhirLuar || lepasKarakter; };
}
/* warga yang menunggu naik: rute dunia ke pintu, lalu masuk & duduk */
function naikkan(w, pintuLuar, pintuDalam, induk, pintuLx, pintuLz, bus, tunda, veh) {
  w.pergi = true; w.diam = false; w.tunda = tunda; w.veh = veh; w.v = 1.5 + Math.random() * 0.3; // kendaraan menunggu sampai ia masuk
  w.rute = [{ x: pintuLuar.x, y: pintuLuar.y, z: pintuLuar.z }, { x: pintuDalam.x, y: pintuDalam.y, z: pintuDalam.z }];
  w.akhir = (o) => {
    const kursi = kursiKosong(induk, pintuLx);
    o.veh = null; // sudah di dalam: pintu boleh menutup
    if (!kursi) { lepasKarakter(o); return; } // penuh: berdiri di dalam (tak terlihat)
    kursi.isi = o; pindahInduk(o.kar, induk);
    o.rute = ruteKeKursi(kursi, pintuLx, pintuLz, bus);
    o.akhir = (x) => dudukkan(x, kursi, induk);
  };
}
function peristiwaBusBerhenti(b, entri) {
  bunyiPeristiwa("busBerhenti", b.g.position);
  const pintuLuar = duniaDari(b.g, 2.2, 0, PINTU_BUS_Z).clone(), pintuDalam = duniaDari(b.g, 0.9, 0.65, PINTU_BUS_Z).clone();
  const y0 = entri.y + 0.02; pintuLuar.y = y0;
  const duduk = (b.g.userData.kursi || []).filter((k) => k.isi).map((k) => k.isi);
  const nTurun = Math.min(duduk.length, Math.floor(Math.random() * 3));
  duduk.sort(() => Math.random() - 0.5);
  const nT = entri.hub ? Math.min(duduk.length, 2 + Math.floor(Math.random() * 2)) : nTurun; // di hub lebih banyak yang turun
  for (let i = 0; i < nT; i++) {
    const tujuan = { x: pintuLuar.x + entri.normal.x * 2 + (i - 0.5) * 1.2 * entri.normal.z, y: y0, z: pintuLuar.z + entri.normal.z * 2 - (i - 0.5) * 1.2 * entri.normal.x };
    const awal = [{ x: pintuLuar.x, y: y0, z: pintuLuar.z }, tujuan];
    const lain = entri.hub ? HUB.filter((e) => e !== entri && e.tunggu.h.length < 7) : [];
    if (lain.length && Math.random() < 0.75) { // TRANSIT: jalan ke halte koridor lain di hub & menunggu di sana
      const e2 = lain[Math.floor(Math.random() * lain.length)];
      const slot = { x: e2.pusat.x + e2.tangen.x * (Math.random() * 4 - 2), y: e2.y + 0.02, z: e2.pusat.z + e2.tangen.z * (Math.random() * 4 - 2), yaw: e2.pusat.yaw };
      const rute = awal.slice();
      if (Math.sign(e2.pusat.z - zJalanHub()) !== Math.sign(tujuan.z - zJalanHub())) { // seberang jalan: lewat zebra cross timur persimpangan kol 45
        rute.push({ x: X_ZEBRA_HUB, y: y0, z: tujuan.z }, { x: X_ZEBRA_HUB, y: y0, z: slot.z });
      }
      rute.push(slot);
      turunkan(duduk[i], 0.9, PINTU_BUS_Z, true, rute, 0.3 + i * 1.2, b, (o) => {
        o.kar.rotation.y = slot.yaw; Object.assign(o, { diam: true, pos: slot, kunci: "h", transit: true, pergi: false, rute: [], akhir: null });
        e2.tunggu.h.push(o);
      });
    } else turunkan(duduk[i], 0.9, PINTU_BUS_Z, true, awal.concat([{ x: tujuan.x + entri.normal.x * 9, y: y0, z: tujuan.z + entri.normal.z * 9 }]), 0.3 + i * 1.2, b);
  }
  entri.tunggu.h.forEach((w, i) => {
    if (!w.kar.visible || w.pergi) return;
    naikkan(w, pintuLuar, pintuDalam, b.g, 0.9, PINTU_BUS_Z, true, 1.0 + nT * 1.6 + i * 0.9, b);
  });
}
function peristiwaKeretaBerhenti(k, idx) {
  bunyiPeristiwa("krlBerhenti", k.mobil[1].position);
  const st = STASIUN[idx], e = st.entri;
  const tengah = k.mobil[1].position;
  const sisiDunia = Math.sign(tengah.z - st.z) || 1; // -1 peron utara as, +1 selatan
  const yPeron = YD + 1.2;
  e.tangga = { x: st.x, z: st.z + sisiDunia * 6.6 };
  const pintu = [];
  k.mobil.forEach((c) => {
    const a = duniaDari(c, 0, 0.5, 1.0).clone(), b2 = duniaDari(c, 0, 0.5, -1.0).clone();
    const lz = Math.abs(a.z - st.z) > Math.abs(b2.z - st.z) ? 1 : -1; // sisi lokal yang menghadap peron
    k.sisiPintu = lz;
    for (const lx of [-4.2, 4.2]) pintu.push({ c, lx, lz, dalam: duniaDari(c, lx, 0.5, lz * 0.9).clone(), luar: duniaDari(c, lx, 0.5, lz * 2.6).clone() });
  });
  // turun: 1-2 penumpang duduk per gerbong berjalan ke pintu terdekat lalu ke tangga peron
  k.mobil.forEach((c, ci) => {
    const duduk = (c.userData.kursi || []).filter((x) => x.isi).map((x) => x.isi).sort(() => Math.random() - 0.5);
    const n = Math.min(duduk.length, Math.floor(Math.random() * 3));
    for (let i = 0; i < n; i++) {
      const o = duduk[i], lx = o.kursi.lx < 0 ? -4.2 : 4.2, p = pintu.find((q) => q.c === c && q.lx === lx);
      turunkan(o, lx, p.lz * 0.9, false, [{ x: p.luar.x, y: yPeron, z: p.luar.z }, { x: p.luar.x, y: yPeron, z: st.z + sisiDunia * 6.8 }, { x: st.x, y: yPeron, z: st.z + sisiDunia * 6.8 }], 1.0 + i * 1.3 + ci * 0.2, k);
    }
  });
  const kunci = String(sisiDunia);
  (e.tunggu[kunci] || []).forEach((w, i) => {
    if (!w.kar.visible || w.pergi) return;
    let p = pintu[0], dMin = Infinity;
    for (const q of pintu) { const d = Math.hypot(q.luar.x - w.kar.position.x, q.luar.z - w.kar.position.z); if (d < dMin) { dMin = d; p = q; } }
    naikkan(w, { x: p.luar.x, y: yPeron, z: p.luar.z }, { x: p.dalam.x, y: p.dalam.y, z: p.dalam.z }, p.c, p.lx, p.lz * 0.9, false, 3.5 + i * 0.7, k);
  });
  e.isiUlang = 22 + Math.random() * 10;
}

/* ================= NAIK BUS / KRL (pemain) =================
   Pemain (mode jalan) dekat pintu bus yang sedang berhenti di halte, atau
   di pintu masuk stasiun saat KRL berhenti di peron -> tombol "Naik".
   Selama menumpang: kamera 1st Person menempel di dalam kendaraan yang
   melaju (melihat kota lewat jendela), joystick/WASD = berjalan di lorong
   (KRL: antar gerbong), seret = menoleh. "Turun" aktif saat berhenti. */
export const NAIK = { aktif: false, jenis: null, obj: null, lx: 0, lz: 0, lantaiY: 0 };
export function sedangNaik() { return NAIK.aktif; }
const _v = new THREE.Vector3();
function duniaDari(o, lx, ly, lz) { o.updateMatrixWorld(); return _v.set(lx, ly, lz).applyMatrix4(o.matrixWorld); }
/* Aksi kontekstual (dipanggil rumah.js). fp = posisi pemain dunia. */
export function aksiTransportasi(fp) {
  if (NAIK.aktif) {
    const o = NAIK.obj;
    if (NAIK.jenis === "bus") {
      if (o.tunggu > 0 && o.halteKini) return { teks: "Bus berhenti di halte", tombol: "Turun", aksi: turun };
      return { teks: "Di dalam bus Trans Merdu", tombol: null };
    }
    if (o.berhenti > 0 && o.stasiunKini >= 0) return { teks: "KRL berhenti di " + STASIUN[o.stasiunKini].nama, tombol: "Turun", aksi: turun };
    return { teks: "Di dalam KRL Merdu · keliling kota", tombol: null };
  }
  for (const b of bus) {
    if (!(b.tunggu > 0)) continue;
    const d = duniaDari(b.g, 2.6, 0, PINTU_BUS_Z);
    if (Math.hypot(fp.x - d.x, fp.z - d.z) < 5.5) return { teks: "Bus Trans Merdu di halte", tombol: "Naik Bus", aksi: () => naik("bus", b) };
  }
  if ((fp.y || 0) > Y_PERON - 1) { // di peron: naik lewat pintu KRL terdekat yang terbuka
    for (const k of kereta) {
      if (!(k.berhenti > 2.5) || k.stasiunKini < 0) continue;
      for (let ci = 0; ci < k.mobil.length; ci++) for (const lx of [-4.2, 4.2]) {
        const d = duniaDari(k.mobil[ci], lx, 0, (k.sisiPintu || 1) * 2.0);
        if (Math.hypot(fp.x - d.x, fp.z - d.z) < 3.2) return { teks: "Pintu KRL terbuka", tombol: "Naik KRL", aksi: () => { naik("kereta", k); NAIK.lx = lx - ci * 14.2; } };
      }
    }
    return { teks: "Peron stasiun · tunggu KRL berhenti", tombol: null };
  }
  for (let i = 0; i < STASIUN.length; i++) {
    const ps = STASIUN[i].pintu;
    if (Math.hypot(fp.x - ps.x, fp.z - ps.z) < 10) {
      const k = kereta.find((t) => t.berhenti > 0 && t.stasiunKini === i);
      if (k) return { teks: "KRL berhenti di peron " + STASIUN[i].nama, tombol: "Naik KRL", aksi: () => naik("kereta", k) };
      return { teks: STASIUN[i].nama + " · menunggu KRL datang…", tombol: null };
    }
  }
  return null;
}
var kaitNaik; // { fp, petunjuk(teks), selesai() } — var tanpa inisialisasi: setKaitNaik dipanggil rumah.js saat modul ini masih dievaluasi (impor melingkar)
export function setKaitNaik(k) { kaitNaik = k; }
function naik(jenis, obj) {
  Object.assign(NAIK, { aktif: true, jenis, obj });
  const fp = kaitNaik.fp;
  if (jenis === "bus") { NAIK.lx = 0.2; NAIK.lz = PINTU_BUS_Z; NAIK.lantaiY = 0.65; fp.yaw = Math.PI; }
  else { NAIK.lx = -18.4; NAIK.lz = 0; NAIK.lantaiY = 0.5; fp.yaw = -Math.PI / 2; }
  fp.pitch = 0;
  kaitNaik.petunjuk(jenis === "bus" ? "Menumpang bus Trans Merdu · jalan di lorong · turun saat bus berhenti di halte"
    : "Menumpang KRL Merdu keliling kota · jalan antar gerbong · turun saat berhenti di stasiun");
}
function turun() {
  const fp = kaitNaik.fp, o = NAIK.obj;
  if (NAIK.jenis === "bus") { const h = (o.halteKini && o.halteKini.pos) || duniaDari(o.g, 4, 0, PINTU_BUS_Z); fp.x = h.x; fp.z = h.z; if (h.yaw !== undefined) fp.yaw = h.yaw; fp.pitch = 0; }
  else { const p = STASIUN[Math.max(0, o.stasiunKini)].pintu; fp.x = p.x; fp.z = p.z; fp.yaw = 0; }
  fp.y = 0;
  Object.assign(NAIK, { aktif: false, jenis: null, obj: null });
  kaitNaik.selesai();
}
/* Kamera & gerak di dalam kendaraan. gerak = {mx, mz} dari joystick/WASD.
   KRL: lx menerus sepanjang rangkaian (gerbong i berpusat di -14,2·i);
   kamera menempel ke GERBONG tempat pemain berdiri (ikut miring di tikungan). */
export function updateNaik(dt, camera, fp, gerak) {
  const laju = 3.2;
  const fx = -Math.sin(fp.yaw), fz = -Math.cos(fp.yaw), rx = Math.cos(fp.yaw), rz = -Math.sin(fp.yaw);
  NAIK.lx += (fx * gerak.mz + rx * gerak.mx) * laju * dt;
  NAIK.lz += (fz * gerak.mz + rz * gerak.mx) * laju * dt;
  let o, lx = NAIK.lx;
  if (NAIK.jenis === "bus") { NAIK.lx = Math.max(-0.95, Math.min(0.95, NAIK.lx)); NAIK.lz = Math.max(-4.7, Math.min(3.9, NAIK.lz)); o = NAIK.obj.g; lx = NAIK.lx; }
  else {
    NAIK.lx = Math.max(-42.6 - 4.6, Math.min(4.6, NAIK.lx)); // di antara sekat kabin depan & belakang NAIK.lz = Math.max(-0.95, Math.min(0.95, NAIK.lz));
    const i = Math.max(0, Math.min(3, Math.round(-NAIK.lx / 14.2)));
    o = NAIK.obj.mobil[i]; lx = NAIK.lx + i * 14.2;
  }
  const w = duniaDari(o, lx, NAIK.lantaiY + 2.05, NAIK.lz); // mata penumpang (karakter ±2,3 m)
  camera.position.copy(w);
  camera.rotation.set(fp.pitch, o.rotation.y + fp.yaw, 0);
  fp.x = w.x; fp.z = w.z; // untuk peta kecil & posisi yang disiarkan
}
