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
import { M, camera, gabungBerwarna, kotak, scene } from "./bersama.js";
import { bangkuTaman, pohonKecil, teksturPapanNama } from "./fasilitas.js";
import { BUSWAY_Z_DUNIA, perbaruiGerbangBus, tinggiBus } from "./plazaPagar.js";
import { arahHalus, jalurPoligon, jarakKeBelok, posJalur, sTerdekatJalur } from "./jalur.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";

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
export const rintanganTransportasi = [];

function teksturBus(warna) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const c = cv.getContext("2d");
  c.fillStyle = warna; c.fillRect(0, 0, 512, 128);
  c.fillStyle = "#1f2a33"; c.fillRect(10, 18, 492, 46);
  c.fillStyle = "#ffffff"; c.font = "bold 30px system-ui"; c.fillText("TRANS MERDU", 150, 104);
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
    bag.push({ geo: new THREE.BoxGeometry(8.6, 0.04, 0.04), y: 5.78, z: zj, warna: 0x3a3226 });    // kawat kontak
    bag.push({ geo: new THREE.BoxGeometry(8.6, 0.04, 0.04), y: 6.45, z: zj, warna: 0x3a3226 });    // kawat pemikul
    bag.push({ geo: new THREE.BoxGeometry(0.03, 0.67, 0.03), x: 0, y: 6.12, z: zj, warna: 0x3a3226 }); // penggantung
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

/* ---------- Stasiun Merdu Utara (rel utara, sumbu istana) ---------- */
function bangunStasiunUtara(grup) {
  const x = X_UTARA, z = ZN;
  for (const s of [-1, 1]) {
    grup.add(kotak(66, 0.5, 3.2, 0xe6dcc6, x, YD + 0.95, z + s * 6.3));
    grup.add(kotak(66, 0.1, 0.3, 0xf2c230, x, YD + 1.22, z + s * 4.85));
    for (let i = 0; i < 6; i++) grup.add(kotak(0.35, 5.2, 0.35, 0x7b8086, x - 30 + i * 12, YD + 3.6, z + s * 7.6));
    for (const t of [-20, 20]) { const bk = bangkuTaman(x + t, z + s * 7.0, s > 0 ? Math.PI : 0); bk.position.y = YD + 1.2; grup.add(bk); }
  }
  const atap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 68, 24, 1, true, -Math.PI / 2 + 0.6, Math.PI - 1.2),
    new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
  atap.rotation.z = Math.PI / 2; atap.position.set(x, YD + 2.5, z); atap.castShadow = true; grup.add(atap);
  // tangga turun ke selatan (arah kota) dari ujung peron selatan + kios pintu
  for (let t = 0; t < 14; t++) grup.add(kotak(4, 0.4, 0.9, 0xd8d2c6, x, 0.2 + t * 0.6, z + 21 - t * 0.85));
  grup.add(kotak(5, YD + 1.2, 3, 0xf3efe6, x, (YD + 1.2) / 2, z + 9.4));
  grup.add(kotak(6, 3.4, 3.4, 0x1d5a8f, x, 1.7, z + 24.5));
  const papan = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama("STASIUN MERDU UTARA", "KRL Keliling Kota"), roughness: 0.8 }));
  papan.position.set(x, YD + 3.2, z + 8.2); grup.add(papan);
  rintanganTransportasi.push({ minX: x - 2.6, maxX: x + 2.6, minZ: z + 7.8, maxZ: z + 22 });
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
  const atap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 68, 24, 1, true, -Math.PI / 2 + 0.6, Math.PI - 1.2),
    new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
  atap.rotation.z = Math.PI / 2; atap.position.set(XST, YD + 2.5, RZ); atap.castShadow = true; grup.add(atap);
  // concourse di blok (utara) + tangga/eskalator turun ke halaman
  grup.add(kotak(60, YD + 1.2, 16, 0xf3efe6, XST, (YD + 1.2) / 2, zb + 9));
  for (let i = 0; i < 9; i++) grup.add(kotak(4.2, 3.2, 0.2, 0x2e5a73, XST - 26 + i * 6.5, YD - 1.8, zb + 17.05));
  grup.add(kotak(60.6, 0.6, 16.6, 0x1d5a8f, XST, YD + 1.4, zb + 9));
  const papan = new THREE.Mesh(new THREE.BoxGeometry(24, 2.4, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama(st.nama, st.sub), roughness: 0.8 }));
  papan.position.set(XST, YD + 3.0, zb + 17.2); grup.add(papan);
  const jam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 24), M(0xffffff)); jam.rotation.x = Math.PI / 2; jam.position.set(XST + 16, YD + 3, zb + 17.3); grup.add(jam);
  for (let t = 0; t < 14; t++) grup.add(kotak(4, 0.4, 0.9, 0xd8d2c6, XST - 6, 0.2 + t * 0.6, zb + 30 - t * 0.85)); // tangga
  const esk = kotak(1.6, 0.3, 14, 0x8a8f94, XST + 6, YD / 2, zb + 24); esk.rotation.x = -Math.atan2(YD, 12); grup.add(esk); // eskalator
  grup.add(kotak(4.4, 3.6, 3.2, 0x2e5a73, XST, 1.8, zb + 18.6)); // pintu masuk bawah
  rintanganTransportasi.push({ minX: XST - 30, maxX: XST + 30, minZ: zb + 1, maxZ: zb + 17 });
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
        K(x1 - x0, 0.12, 0.55, 0x2e6fa8, cx + (x0 + x1) / 2, 0.95, s * 1.08);
        K(x1 - x0, 0.6, 0.1, 0x2e6fa8, cx + (x0 + x1) / 2, 1.3, s * 1.32);
        K(x1 - x0, 0.4, 0.45, 0x9aa0a6, cx + (x0 + x1) / 2, 0.7, s * 1.08);
      }
    }
    // tiang pegangan + rel atas + gantungan tangan
    for (const dx of [-4.2, 0, 4.2]) for (const s of [-1, 1]) K(0.05, 2.9, 0.05, 0xc0c4c8, cx + dx, 2.0, s * 0.55);
    for (const s of [-1, 1]) K(L - 0.6, 0.04, 0.04, 0xc0c4c8, cx, 3.2, s * 0.55);
    for (let h = -6; h <= 6; h += 1) for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), M(0xf2c230)); r.position.set(cx + h, 2.85, s * 0.55); tgt.add(r); }
    for (const dx of [-4.5, 0, 4.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })); l.position.set(cx + dx, 3.46, 0); tgt.add(l); }
    // dinding ujung dengan pintu lorong (tidak untuk ujung depan gerbong 0)
    for (const e of [-1, 1]) {
      if ((i === 0 && e === 1) || (i === 3 && e === -1)) continue; // ujung rangkaian = kabin masinis
      for (const s of [-1, 1]) K(0.12, 3.1, 0.95, 0xe6e8ea, cx + e * 6.8, 2.0, s * 1.0);
      K(0.12, 0.8, 1.1, 0xe6e8ea, cx + e * 6.8, 3.2, 0);
    }
    if (i < 3) { K(0.9, 0.25, 1.1, 0x55595e, cx - 7.1, 0.4, 0); for (const s of [-1, 1]) K(0.9, 2.8, 0.06, 0x2b2d30, cx - 7.1, 1.9, s * 0.58); } // sambungan lorong
    K(L - 0.4, 0.35, 2.6, 0x37474f, cx, 0.05, 0);              // rangka bawah/bogie
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
    masinis.position.set(a * 6.75, 0.95, -0.45); masinis.rotation.y = a * Math.PI / 2; masinis.scale.setScalar(0.95); tgt.add(masinis);
    const topi = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 12), M(0x1d3a5f)); topi.position.set(0, 1.62, 0); masinis.add(topi);
    for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.17, 14), matLampu); l.rotation.y = a * Math.PI / 2; l.position.set(a * 8.11, 0.95, sz * 0.95); tgt.add(l);
      const lr = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), matLampuR); lr.rotation.y = a * Math.PI / 2; lr.position.set(a * 8.11, 0.95, sz * 1.25); tgt.add(lr);
    }
    const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("KRL MERDU", "Keliling Kota") }));
    papan.rotation.y = a * Math.PI / 2; papan.position.set(a * 8.16, 3.42, 0); tgt.add(papan);
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
function buatBus(warna) {
  const g = new THREE.Group(), w = parseInt(warna.slice(1), 16), tex = teksturBus(warna);
  const K = (l, t, d, c, x, y, z) => { const m = kotak(l, t, d, c, x, y, z); m.castShadow = false; g.add(m); return m; };
  const kaca = (l, t, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, d), KACA_KRL); m.position.set(x, y, z); g.add(m); };
  K(2.5, 0.3, 10.3, 0x55595e, 0, 0.5, 0);                     // lantai
  K(2.6, 0.2, 10.5, 0xf4f4f2, 0, 3.35, 0);                    // atap
  for (const s of [-1, 1]) {
    // dinding bawah berwarna (sisi +x punya bukaan pintu z 2,6..4,2)
    /* dinding bawah: penuh y 0,6..1,7 kecuali lengkung roda (z ±0,65 di as)
       & bukaan pintu (sisi +x, z 2,6..4,2); di atas lengkung roda tetap ada. */
    const potong = [[-4.05, -2.75], [0.85, 2.15]].concat(s > 0 ? [[2.6, 4.2]] : []);
    let z0 = -5.15;
    for (const [a, b] of potong.concat([[5.15, 5.15]])) { if (a > z0) K(0.12, 1.1, a - z0, w, s * 1.27, 1.15, (a + z0) / 2); z0 = b; }
    for (const [a, b] of potong.slice(0, 2)) K(0.12, 0.62, b - a, w, s * 1.27, 1.39, (a + b) / 2);
    const sisi = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.9), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
    sisi.rotation.y = s * Math.PI / 2; sisi.position.set(s * 1.34, 1.15, -1.4); g.add(sisi);
    if (s > 0) { kaca(0.05, 1.3, 7.75, 1.27, 2.35, -1.275); kaca(0.05, 1.3, 0.95, 1.27, 2.35, 4.675); } // jendela kiri: belakang & depan pintu
    else kaca(0.05, 1.3, 10.3, -1.27, 2.35, 0);                 // jendela kanan utuh
    K(0.12, 0.3, 10.3, w, s * 1.27, 3.15, 0);                  // pita atas
    for (let z = -4.6; z <= 3.0; z += 1.6) if (!(s > 0 && z > 2.5)) K(0.14, 1.3, 0.1, w, s * 1.27, 2.35, z); // tiang jendela
    if (s > 0) for (const z of [2.6, 4.2]) K(0.14, 2.75, 0.12, w, 1.27, 1.95, z); // kusen pintu
  }
  kaca(0.05, 0.5, 1.5, 1.27, 3.05, 3.4);                      // kaca di atas bukaan pintu
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
    const z0 = 3.4 + arah * 0.4;
    daun.position.set(1.36, 1.85, z0); g.add(daun);
    g.userData.pintu.push({ daun, z0, arah });
  }
  kaca(2.6, 1.5, 0.06, 0, 2.5, 5.2); K(2.6, 1.2, 0.12, w, 0, 1.15, 5.2);   // depan: kaca depan (rapat ke atap & pilar) + panel
  kaca(2.6, 0.85, 0.06, 0, 2.825, -5.2); K(2.6, 2.0, 0.12, w, 0, 1.4, -5.2);  // belakang: kaca rapat ke panel & atap
  for (const [x, z] of [[-1.27, 5.2], [1.27, 5.2], [-1.27, -5.2], [1.27, -5.2]]) K(0.18, 2.8, 0.18, w, x, 1.95, z); // pilar sudut
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 })); l.position.set(s * 0.9, 0.95, 5.27); g.add(l); }
  // kursi penumpang (2 baris kiri-kanan, menghadap depan)
  for (let r = 0; r < 6; r++) for (const s of [-1, 1]) {
    const z = -4.3 + r * 1.25; if (s > 0 && z > 2.2) continue;
    K(0.9, 0.12, 0.55, 0x2e6fa8, s * 0.72, 1.05, z); K(0.9, 0.65, 0.1, 0x2e6fa8, s * 0.72, 1.4, z - 0.27); K(0.08, 0.45, 0.08, 0x8a8f94, s * 0.72, 0.8, z);
    (g.userData.kursi || (g.userData.kursi = [])).push({ lx: s * 0.72, ly: 0.59, lz: z + 0.02, rot: 0, isi: null, lorongX: 0.15, lantai: 0.65 }); // titik duduk penumpang
  }
  for (const z of [-3, -0.5, 2]) for (const s of [-1, 1]) K(0.05, 2.7, 0.05, 0xf2c230, s * 0.28, 1.95, z); // tiang kuning
  for (const s of [-1, 1]) K(0.04, 0.04, 9.5, 0xc0c4c8, s * 0.3, 3.05, 0);
  // sopir
  K(0.6, 0.6, 0.6, 0x2b2d30, -0.7, 1.1, 4.3); K(1.6, 0.6, 0.4, 0x2b2d30, -0.3, 1.5, 4.95);
  const setir = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), M(0x1b1b1d)); setir.position.set(-0.7, 1.7, 4.65); setir.rotation.x = -1.0; g.add(setir);
  for (const dz of [-1.6, 1.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 })); l.position.set(0, 3.22, dz); g.add(l); }
  /* Roda: as depan DI BELAKANG pintu (z 1,5; dulu z 3,4 tepat di bawah
     bukaan pintu sehingga ban kelihatan di ambang pintu) & as belakang z -3,4.
     Tiap ban berpelek dan bernaung spakbor (lengkung roda gelap) di bodi. */
  for (const [x, z] of [[-1.2, 1.5], [1.2, 1.5], [-1.2, -3.4], [1.2, -3.4]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 16), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(x, 0.5, z); g.add(r);
    const pelek = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.37, 12), M(0xb8bcc2)); pelek.rotation.z = Math.PI / 2; pelek.position.set(x, 0.5, z); g.add(pelek);
    const sx = Math.sign(x);
    K(0.06, 0.16, 1.3, 0x1b1d20, sx * 1.36, 1.08, z);                           // spakbor atas
    for (const dz of [-0.62, 0.62]) K(0.06, 0.5, 0.1, 0x1b1d20, sx * 1.36, 0.82, z + dz);
  }
  K(2.5, 0.5, 10.3, 0x2b2d30, 0, 0.3, 0);                                         // rok bawah bodi (rangka tertutup)
  // tangga & ambang pintu (bukaan z 2,6..4,2): lantai menyambung ke tepi, satu anak tangga, karet ambang
  K(0.35, 0.18, 1.5, 0x55595e, 1.15, 0.6, 3.4);
  K(0.3, 0.12, 1.5, 0x8a8f94, 1.3, 0.3, 3.4);
  K(0.04, 0.04, 1.55, 0xf2c230, 1.32, 0.69, 3.4);
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("TRANS MERDU", "Keliling Kota") }));
  papan.position.set(0, 3.0, 5.27); g.add(papan);
  return g;
}
/* ================= RUTE BUS (jalur halus) =================
   Koridor 1 keliling kota (kol 32/48, bar 18/36) + Koridor 2 Plaza (2A ke
   barat lewat busway plaza, 2B ke timur). Lintasan dari jalurPoligon():
   sudut dibulatkan (r 10 di as jalan) & lajur kiri 3,5 -> bus berbelok
   melengkung, melambat di tikungan, arah hadap dihaluskan. */
const cxK = (k) => sudutBlok(k, 0).x + JALAN / 2, czB = (b) => sudutBlok(0, b).z + JALAN / 2;
const RUTE = []; // [{R, halte:[{s, pos, entri}]}]
const HALTE_SEMUA = []; // entri halte (untuk penumpang menunggu)
const STASIUN = []; // {nama, x, z (as rel), pintu:{x,z}}

/* ---------- KRL keliling ---------- */
function stopUntuk(J) { // s kepala kereta saat berhenti di tiap stasiun (pusat rangkaian di pusat peron)
  return STASIUN.map((st, idx) => ({ idx, s: (sTerdekatJalur(J, st.x, st.z + (J === JALUR_A ? -2.2 : 2.2) * (st.z === RZ ? 1 : -1)) + 21.3) % J.total }));
}

/* Titik henti lampu lalu lintas untuk bus di satu rute jalur: satu per
   persimpangan ber-lampu yang dilalui rute (persimpanganKota di inti.js
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
    for (let j = 0; j < 2; j++) {
      const k = buatKereta(); grup.add(k);
      kereta.push({ g: k, mobil: k.userData.gerbong, J, jalur: nama, s: (stop[0].s + J.total * (0.25 + j * 0.5)) % J.total, v: 20, berhenti: 0, stop, sudahIdx: -1, stasiunKini: -1 });
    }
  }
  for (const k of kereta) aturGerbong(k);
  for (const st of STASIUN) for (const sisi of [-1, 1]) for (let i = 0; i < 3; i++) // penumpang menunggu di peron
    tambahTunggu(st.entri || (st.entri = { peron: true, tunggu: { "-1": [], "1": [] } }), { x: st.x - 18 + i * 18 + (sisi > 0 ? 6 : 0), z: st.z + sisi * 6.6, y: YD + 1.2, yaw: sisi > 0 ? Math.PI : 0 }, String(sisi));

  const R1 = jalurPoligon([[cxK(32), czB(18)], [cxK(48), czB(18)], [cxK(48), czB(36)], [cxK(32), czB(36)]], { r: 10, L: 3.5 });
  const zB24 = czB(24);
  const R2A = jalurPoligon([[cxK(42), BUSWAY_Z_DUNIA], [cxK(38), BUSWAY_Z_DUNIA], [cxK(38), zB24], [cxK(42), zB24]], { r: 10, L: 3.5 });
  const R2B = jalurPoligon([[cxK(38), BUSWAY_Z_DUNIA], [cxK(42), BUSWAY_Z_DUNIA], [cxK(42), zB24], [cxK(38), zB24]], { r: 10, L: 3.5 });
  RUTE.push({ R: R1, halte: [], henti: bangunTitikHentiJalur(R1) }, { R: R2A, halte: [], henti: bangunTitikHentiJalur(R2A) }, { R: R2B, halte: [], henti: bangunTitikHentiJalur(R2B) });
  const pasangHalte = (r, sh, nama) => {
    const p = posJalur(r.R, sh), l = Math.hypot(p.hx, p.hz);
    const nx = -p.hz / l, nz = p.hx / l; // -n = sisi kiri arah gerak
    const h = new THREE.Group();
    h.add(kotak(5, 0.2, 2, 0x1d5a8f, 0, 2.8, 0)); h.add(kotak(5, 2.4, 0.1, 0x9fc9d8, 0, 1.4, -0.9));
    for (const sx of [-2.3, 2.3]) h.add(kotak(0.12, 2.8, 0.12, 0xb8bcc2, sx, 1.4, -0.9));
    h.add(kotak(4, 0.12, 0.6, 0xa9743f, 0, 0.6, -0.5));
    if (nama) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.5), new THREE.MeshBasicMaterial({ map: teksturPapanNama(nama, "Trans Merdu") })); pp.position.set(0, 3.15, 0.95); h.add(pp); }
    const hx = p.x - nx * 4.6, hz = p.z - nz * 4.6, hy = tinggiBus(hx, hz) - 0.02;
    h.position.set(hx, hy, hz);
    h.rotation.y = Math.atan2(p.hx, p.hz) - Math.PI / 2; // dinding belakang menjauhi jalan
    grup.add(h);
    const entri = { halte: true, tunggu: { h: [] }, normal: { x: -nx, z: -nz }, y: hy };
    HALTE_SEMUA.push(entri);
    for (let i = 0; i < 2; i++) tambahTunggu(entri, { x: hx + nx * 0.6 + (i - 0.5) * 1.4 * nz, z: hz + nz * 0.6 - (i - 0.5) * 1.4 * nx, y: hy + 0.02, yaw: Math.atan2(nx, nz) }, "h");
    r.halte.push({ s: sh, pos: { x: p.x - nx * 3.3, z: p.z - nz * 3.3, yaw: Math.atan2(-p.hx, -p.hz) }, entri });
  };
  for (let i = 0; i < 6; i++) pasangHalte(RUTE[0], R1.total * (i + 0.5) / 6, null);
  pasangHalte(RUTE[1], sTerdekatJalur(R2A, PUSAT_X - 30, BUSWAY_Z_DUNIA + 3.5), "Halte Plaza");
  pasangHalte(RUTE[2], sTerdekatJalur(R2B, PUSAT_X + 30, BUSWAY_Z_DUNIA - 3.5), "Halte Plaza");
  pasangHalte(RUTE[2], sTerdekatJalur(R2B, PUSAT_X + 42, zB24 + 3.5), "Halte Istana");
  const WARNA = ["#2e9e5b", "#1d5a8f", "#e8943a", "#c8102e", "#7b2ff7"];
  for (let i = 0; i < 5; i++) { const b = buatBus(WARNA[i]); grup.add(b); bus.push({ g: b, r: 0, s: R1.total * i / 5, v: 0, tunggu: 0, halteTerakhir: -1, halteKini: null }); }
  for (const r of [1, 2]) for (let i = 0; i < 2; i++) {
    const b = buatBus(r === 1 ? "#c8102e" : "#e8943a"); grup.add(b);
    bus.push({ g: b, r, s: RUTE[r].R.total * (i / 2 + 0.1), v: 0, tunggu: 0, halteTerakhir: -1, halteKini: null });
  }
  for (const b of bus) isiAwal(b.g, 2 + Math.floor(Math.random() * 3));      // penumpang awal
  for (const k of kereta) for (const c of k.mobil) isiAwal(c, 2 + Math.floor(Math.random() * 2));
  scene.add(grup);
  return grup;
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
    c.position.set((a.x + b.x) / 2, YD + 0.2, (a.z + b.z) / 2);
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
      k.berhenti -= dt; if (k.berhenti <= 0) k.tahan = 0;
      if (k.berhenti <= 0) { k.sudahIdx = k.stasiunKini; k.stasiunKini = -1; }
      continue;
    }
    let vMaks = 34;
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
    else if (b.tunggu > 0) { b.tunggu -= dt; b.v = 0; if (b.tunggu <= 0) { b.tahan = 0; const db = perKoridor[b.r].daftar; if (db.length > 1 && b.gap < (r.R.total / db.length) * 0.85) b.tunggu = 0.5; else { if (b.halteKini && b.halteKini.entri) b.halteKini.entri.isiUlang = 9 + Math.random() * 8; b.halteKini = null; } } }
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
      b.v += Math.sign(vM - b.v) * Math.min(Math.abs(vM - b.v), 4 * dt);
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
    for (const o of AKTIF) if (o.duduk && o.induk) { o.induk.getWorldPosition(_wp); o.kar.visible = _wp.distanceTo(camera.position) < 180; }
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
function turunkan(o, pintuLx, pintuLz, bus, ruteLuar, tunda, veh) {
  const kursi = o.kursi; kursi.isi = null; o.kursi = null; o.duduk = false; o.veh = veh; // kendaraan menunggu sampai ia keluar pintu
  o.kar.visible = true; pose(o.kar, false);
  o.tunda = tunda; o.rute = ruteKePintu(kursi, pintuLx, pintuLz, bus);
  o.akhir = (x) => { x.veh = null; pindahInduk(x.kar, grupPenumpang); x.rute = ruteLuar; x.akhir = lepasKarakter; };
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
  const pintuLuar = duniaDari(b.g, 2.2, 0, 3.4).clone(), pintuDalam = duniaDari(b.g, 0.9, 0.65, 3.4).clone();
  const y0 = entri.y + 0.02; pintuLuar.y = y0;
  const duduk = (b.g.userData.kursi || []).filter((k) => k.isi).map((k) => k.isi);
  const nTurun = Math.min(duduk.length, Math.floor(Math.random() * 3));
  duduk.sort(() => Math.random() - 0.5);
  for (let i = 0; i < nTurun; i++) {
    const tujuan = { x: pintuLuar.x + entri.normal.x * 2 + (i - 0.5) * 1.2 * entri.normal.z, y: y0, z: pintuLuar.z + entri.normal.z * 2 - (i - 0.5) * 1.2 * entri.normal.x };
    turunkan(duduk[i], 0.9, 3.4, true, [{ x: pintuLuar.x, y: y0, z: pintuLuar.z }, tujuan, { x: tujuan.x + entri.normal.x * 9, y: y0, z: tujuan.z + entri.normal.z * 9 }], 0.3 + i * 1.2, b);
  }
  entri.tunggu.h.forEach((w, i) => {
    if (!w.kar.visible || w.pergi) return;
    naikkan(w, pintuLuar, pintuDalam, b.g, 0.9, 3.4, true, 1.0 + nTurun * 1.6 + i * 0.9, b);
  });
}
function peristiwaKeretaBerhenti(k, idx) {
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
    const d = duniaDari(b.g, 2.6, 0, 3.4);
    if (Math.hypot(fp.x - d.x, fp.z - d.z) < 5.5) return { teks: "Bus Trans Merdu di halte", tombol: "Naik Bus", aksi: () => naik("bus", b) };
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
  if (jenis === "bus") { NAIK.lx = 0.2; NAIK.lz = 3.0; NAIK.lantaiY = 0.65; fp.yaw = Math.PI; }
  else { NAIK.lx = -18.4; NAIK.lz = 0; NAIK.lantaiY = 0.5; fp.yaw = -Math.PI / 2; }
  fp.pitch = 0;
  kaitNaik.petunjuk(jenis === "bus" ? "Menumpang bus Trans Merdu · jalan di lorong · turun saat bus berhenti di halte"
    : "Menumpang KRL Merdu keliling kota · jalan antar gerbong · turun saat berhenti di stasiun");
}
function turun() {
  const fp = kaitNaik.fp, o = NAIK.obj;
  if (NAIK.jenis === "bus") { const h = (o.halteKini && o.halteKini.pos) || duniaDari(o.g, 4, 0, 3.4); fp.x = h.x; fp.z = h.z; if (h.yaw !== undefined) fp.yaw = h.yaw; fp.pitch = 0; }
  else { const p = STASIUN[Math.max(0, o.stasiunKini)].pintu; fp.x = p.x; fp.z = p.z; fp.yaw = 0; }
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
  const w = duniaDari(o, lx, NAIK.lantaiY + 1.55, NAIK.lz);
  camera.position.copy(w);
  camera.rotation.set(fp.pitch, o.rotation.y + fp.yaw, 0);
  fp.x = w.x; fp.z = w.z; // untuk peta kecil & posisi yang disiarkan
}
