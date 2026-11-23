/* Negara Merdu — modul game "transportasi": STASIUN, KERETA & BUS.
   - Rel layang (elevated) membentang barat-timur hampir selebar kota di
     atas jalan utara baris blok 36 (as z 931), bertiang di tengah ruas
     jalan (tidak pernah di dalam persimpangan), dua jalur rel.
   - 4 STASIUN KRL di sepanjang rel (bar 36): Merdu Barat (kol 8),
     Merdu Tengah (kol 24), STASIUN MERDU (kol 44, timur Merdu Mall),
     Merdu Timur (kol 62): peron layang berkanopi di atas jalan +
     gedung concourse dengan tangga & eskalator, papan nama, jam.
   - TERMINAL BUS MERDU di blok Stasiun Merdu (bagian selatan):
     jalur bus berkanopi, bus parkir, ruang tunggu.
   - 2 KERETA (4 gerbong) bolak-balik di kedua jalur, melambat & berhenti
     12 detik di SETIAP stasiun, lalu berangkat lagi.
   - Bus & KRL BERONGGA ber-interior dan BISA DINAIKI pemain (lihat
     bagian NAIK BUS / KRL di bawah); bus berhenti 6 detik di halte.
   - 5 BUS "TRANS MERDU" berkeliling rute persegi jalan kota (lajur kiri)
     + detur ke pusat kota lewat jalan kol 40 & bar 25, berhenti 3 detik
     di tiap halte (8 halte, termasuk Halte Istana Negara & Halte Plaza). */
import { JALAN, PITCH, PLAZA_TAPAK, faseLaluLintas, sudutBlok } from "./inti.js";
import { M, kotak, scene } from "./bersama.js";
import { bangkuTaman, pohonKecil, teksturPapanNama } from "./fasilitas.js";

export const BLOK_STASIUN = { kol: 44, bar: 36 };
const RZ = sudutBlok(0, 36).z + JALAN / 2;        // as jalan di bawah rel (z 931)
const X0 = sudutBlok(2, 0).x, X1 = sudutBlok(78, 0).x; // ujung rel
const YD = 8.6;                                    // tinggi dek rel
const JALUR = [RZ - 2.2, RZ + 2.2];
/* Semua stasiun KRL di bar 36; x = pusat peron/concourse stasiun itu. */
const STASIUN = [
  { kol: 8, nama: "STASIUN MERDU BARAT", sub: "KRL · Barat" },
  { kol: 24, nama: "STASIUN MERDU TENGAH", sub: "KRL · Tengah" },
  { kol: 44, nama: "STASIUN MERDU", sub: "KRL · Terminal Bus", terminal: true },
  { kol: 62, nama: "STASIUN MERDU TIMUR", sub: "KRL · Timur" },
].map((s) => {
  const sBlok = sudutBlok(s.kol, 36);
  return { ...s, sBlok, x: sBlok.x + JALAN + (PITCH - JALAN) / 2 };
});
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

/* ---------- rel layang ---------- */
function bangunRel(grup) {
  const panjang = X1 - X0, cx = (X0 + X1) / 2;
  grup.add(kotak(panjang, 0.8, 9.6, 0xb8b2a6, cx, YD - 0.4, RZ));             // dek beton
  for (const s of [-1, 1]) grup.add(kotak(panjang, 1.0, 0.3, 0xd6d0c4, cx, YD + 0.5, RZ + s * 4.65)); // dinding tepi
  for (const z of JALUR) {
    grup.add(kotak(panjang, 0.12, 2.6, 0x6b5e50, cx, YD + 0.06, z));         // balas
    for (const s of [-1, 1]) grup.add(kotak(panjang, 0.18, 0.12, 0x9aa0a6, cx, YD + 0.2, z + s * 0.75)); // rel baja
  }
  // tiang di tengah ruas jalan (antar persimpangan), 2 per blok
  const geoT = new THREE.BoxGeometry(1.2, YD - 0.8, 1.2), geoK = new THREE.BoxGeometry(2.6, 0.8, 8.8);
  const xs = [];
  for (let kol = 2; kol < 78; kol++) { const x0 = sudutBlok(kol, 0).x; xs.push(x0 + JALAN + 21, x0 + JALAN + 49); }
  const imT = new THREE.InstancedMesh(geoT, M(0xcfc9bd), xs.length), imK = new THREE.InstancedMesh(geoK, M(0xcfc9bd), xs.length);
  const d = new THREE.Object3D();
  xs.forEach((x, i) => {
    d.position.set(x, (YD - 0.8) / 2, RZ); d.updateMatrix(); imT.setMatrixAt(i, d.matrix);
    d.position.set(x, YD - 1.2, RZ); d.updateMatrix(); imK.setMatrixAt(i, d.matrix);
    rintanganTransportasi.push({ minX: x - 0.7, maxX: x + 0.7, minZ: RZ - 0.7, maxZ: RZ + 0.7 });
  });
  for (const im of [imT, imK]) { im.castShadow = true; im.frustumCulled = false; grup.add(im); }
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
const KACA_KRL = new THREE.MeshStandardMaterial({ color: 0x9fc4d6, transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, depthWrite: false });
function buatKereta() {
  const g = new THREE.Group();
  const merah = M(0xc8102e, 0.4);
  const K = (l, t, d, w, x, y, z) => { const m = kotak(l, t, d, w, x, y, z); m.castShadow = false; g.add(m); return m; };
  const kaca = (l, t, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, t, d), KACA_KRL); m.position.set(x, y, z); g.add(m); };
  for (let i = 0; i < 4; i++) {
    const cx = -i * 14.2, L = 13.6;
    K(L, 0.3, 3.0, 0x6b6f74, cx, 0.35, 0);                    // lantai
    K(L, 0.25, 3.0, 0xf4f4f2, cx, 3.6, 0);                    // atap
    K(L, 0.4, 2.0, 0xd8dde2, cx, 3.95, 0);                    // kubah atap/AC
    for (const s of [-1, 1]) {
      K(L, 1.1, 0.12, 0xf4f4f2, cx, 1.05, s * 1.44);          // dinding bawah
      K(L, 0.22, 0.13, 0xc8102e, cx, 1.62, s * 1.45);         // garis merah
      kaca(L, 1.3, 0.06, cx, 2.4, s * 1.44);                  // pita jendela
      K(L, 0.4, 0.12, 0xf4f4f2, cx, 3.25, s * 1.44);          // dinding atas
      for (const dx of [-4.2, 4.2]) K(1.3, 2.6, 0.14, 0x3d5566, cx + dx, 1.9, s * 1.44); // pintu geser
      for (const dx of [-6.6, -2.0, 2.0, 6.6]) K(0.12, 1.3, 0.14, 0xf4f4f2, cx + dx, 2.4, s * 1.44); // tiang jendela
      // bangku panjang menghadap lorong
      for (const [x0, x1] of [[-6.6, -4.9], [-3.5, 3.5], [4.9, 6.6]]) {
        K(x1 - x0, 0.12, 0.55, 0x2e6fa8, cx + (x0 + x1) / 2, 0.95, s * 1.08);
        K(x1 - x0, 0.6, 0.1, 0x2e6fa8, cx + (x0 + x1) / 2, 1.3, s * 1.32);
        K(x1 - x0, 0.4, 0.45, 0x9aa0a6, cx + (x0 + x1) / 2, 0.7, s * 1.08);
      }
    }
    // tiang pegangan + rel atas + gantungan tangan
    for (const dx of [-4.2, 0, 4.2]) for (const s of [-1, 1]) K(0.05, 2.9, 0.05, 0xc0c4c8, cx + dx, 2.0, s * 0.55);
    for (const s of [-1, 1]) K(L - 0.6, 0.04, 0.04, 0xc0c4c8, cx, 3.2, s * 0.55);
    for (let h = -6; h <= 6; h += 1) for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12), M(0xf2c230)); r.position.set(cx + h, 2.85, s * 0.55); g.add(r); }
    for (const dx of [-4.5, 0, 4.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 })); l.position.set(cx + dx, 3.46, 0); g.add(l); }
    // dinding ujung dengan pintu lorong (tidak untuk ujung depan gerbong 0)
    for (const e of [-1, 1]) {
      if (i === 0 && e === 1) continue;
      for (const s of [-1, 1]) K(0.12, 3.1, 0.95, 0xe6e8ea, cx + e * 6.8, 2.0, s * 1.0);
      K(0.12, 0.8, 1.1, 0xe6e8ea, cx + e * 6.8, 3.2, 0);
    }
    if (i < 3) { K(0.9, 0.25, 1.1, 0x55595e, cx - 7.1, 0.4, 0); for (const s of [-1, 1]) K(0.9, 2.8, 0.06, 0x2b2d30, cx - 7.1, 1.9, s * 0.58); } // sambungan lorong
    K(L - 0.4, 0.35, 2.6, 0x37474f, cx, 0.05, 0);              // rangka bawah/bogie
    const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("KRL MERDU", "Gerbong " + (i + 1)) }));
    papan.rotation.y = -Math.PI / 2; papan.position.set(cx + 6.72, 3.0, 0); g.add(papan);
  }
  // kabin masinis + hidung depan (gerbong 0, ujung +x)
  K(0.12, 3.1, 2.8, 0xe6e8ea, 5.2, 2.0, 0);                    // sekat kabin (penumpang tidak masuk)
  K(1.0, 0.9, 1.2, 0x2b2d30, 6.0, 1.0, 0.4); K(0.5, 0.5, 0.5, 0x2e6fa8, 6.0, 1.2, -0.7); // konsol & kursi masinis
  const hidung = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.0, 2.96), merah); hidung.position.set(7.3, 1.85, 0); g.add(hidung);
  const kacaDepan = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 2.5), KACA_KRL); kacaDepan.position.set(8.12, 2.5, 0); g.add(kacaDepan);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 })); l.rotation.y = Math.PI / 2; l.position.set(8.13, 1.0, s * 0.9); g.add(l); }
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
    if (s > 0) { K(0.12, 1.1, 7.2, w, 1.27, 1.15, -1.4); K(0.12, 1.1, 0.9, w, 1.27, 1.15, 4.75); }
    else K(0.12, 1.1, 10.3, w, -1.27, 1.15, 0);
    const sisi = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 0.9), new THREE.MeshStandardMaterial({ map: tex, transparent: true }));
    sisi.rotation.y = s * Math.PI / 2; sisi.position.set(s * 1.34, 1.15, -1.4); g.add(sisi);
    kaca(0.05, 1.3, s > 0 ? 7.2 : 10.3, s * 1.27, 2.35, s > 0 ? -1.4 : 0);   // jendela
    K(0.12, 0.3, 10.3, w, s * 1.27, 3.15, 0);                  // pita atas
    for (let z = -4.6; z <= 3.0; z += 1.6) K(0.14, 1.3, 0.1, w, s * 1.27, 2.35, z); // tiang jendela
  }
  kaca(0.05, 0.5, 1.5, 1.27, 3.05, 3.4);                      // kaca di atas bukaan pintu
  kaca(2.4, 1.6, 0.06, 0, 2.3, 5.2); K(2.5, 1.2, 0.12, w, 0, 1.15, 5.2);   // depan: kaca depan + panel
  kaca(2.2, 0.9, 0.06, 0, 2.5, -5.2); K(2.5, 2.0, 0.12, w, 0, 1.4, -5.2);  // belakang
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 })); l.position.set(s * 0.9, 0.95, 5.27); g.add(l); }
  // kursi penumpang (2 baris kiri-kanan, menghadap depan)
  for (let r = 0; r < 6; r++) for (const s of [-1, 1]) {
    const z = -4.3 + r * 1.25; if (s > 0 && z > 2.2) continue;
    K(0.9, 0.12, 0.55, 0x2e6fa8, s * 0.72, 1.05, z); K(0.9, 0.65, 0.1, 0x2e6fa8, s * 0.72, 1.4, z - 0.27); K(0.08, 0.45, 0.08, 0x8a8f94, s * 0.72, 0.8, z);
  }
  for (const z of [-3, -0.5, 2]) for (const s of [-1, 1]) K(0.05, 2.7, 0.05, 0xf2c230, s * 0.28, 1.95, z); // tiang kuning
  for (const s of [-1, 1]) K(0.04, 0.04, 9.5, 0xc0c4c8, s * 0.3, 3.05, 0);
  // sopir
  K(0.6, 0.6, 0.6, 0x2b2d30, -0.7, 1.1, 4.3); K(1.6, 0.6, 0.4, 0x2b2d30, -0.3, 1.5, 4.95);
  const setir = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), M(0x1b1b1d)); setir.position.set(-0.7, 1.7, 4.65); setir.rotation.x = -1.0; g.add(setir);
  for (const dz of [-1.6, 1.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 })); l.position.set(0, 3.22, dz); g.add(l); }
  for (const [x, z] of [[-1.2, 3.4], [1.2, 3.4], [-1.2, -3.4], [1.2, -3.4]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(x, 0.5, z); g.add(r);
  }
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshBasicMaterial({ map: teksturPapanNama("TRANS MERDU", "Keliling Kota") }));
  papan.position.set(0, 3.0, 5.27); g.add(papan);
  return g;
}
/* rute bus: persegi jalan (kol 32/48, bar 18/36), searah jarum jam pandangan
   atas, lajur kiri + DETUR pusat kota: dari jalan utara (bar 18) turun ke
   selatan lewat jalan kol 40, ke barat lewat jalan bar 25 (depan Istana
   Negara/plaza), naik lagi lewat jalan kol 39, lalu kembali ke jalan utara. */
function ruteBus() {
  const cx = (k) => sudutBlok(k, 0).x + JALAN / 2, cz = (b) => sudutBlok(0, b).z + JALAN / 2;
  const xa = cx(32), xb = cx(48), za = cz(18), zb = cz(36);
  const L = 3.5;
  const xd = cx(40) + L, xw = cx(39) - L, zp = cz(25) + L; // lajur detur istana
  const titik = [
    [xa + L, za - L], [xd, za - L],           // ke timur di jalan utara s/d mulut detur
    [xd, zp],                                 // detur: ke selatan di jalan kol 40 (lajur timur)
    [xw, zp],                                 // detur: ke barat di jalan bar 25 (depan Istana Negara)
    [xw, za + L],                             // detur: ke utara di jalan kol 39 (lajur barat)
    [xd, za - L],                             // diagonal kembali ke lajur timur jalan utara
    [xb - L, za - L],                         // lanjut ke timur di jalan utara
    [xb + L, za + L], [xb + L, zb - L],       // ke selatan di jalan timur (lajur timur)
    [xb - L, zb + L], [xa + L, zb + L],       // ke barat di jalan selatan (lajur selatan)
    [xa - L, zb - L], [xa - L, za + L],       // ke utara di jalan barat (lajur barat)
  ];
  const seg = []; let total = 0;
  for (let i = 0; i < titik.length; i++) {
    const a = titik[i], b = titik[(i + 1) % titik.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    seg.push({ a, b, len, mulai: total }); total += len;
  }
  return { seg, total };
}
function posRute(R, s) {
  s = ((s % R.total) + R.total) % R.total;
  for (const g of R.seg) if (s <= g.mulai + g.len) {
    const f = g.len ? (s - g.mulai) / g.len : 0;
    return { x: g.a[0] + (g.b[0] - g.a[0]) * f, z: g.a[1] + (g.b[1] - g.a[1]) * f, hx: g.b[0] - g.a[0], hz: g.b[1] - g.a[1] };
  }
  return { x: 0, z: 0, hx: 1, hz: 0 };
}
let RUTE = null; const HALTE = [], HALTE_POS = [];
/* Titik henti lampu lalu lintas di sepanjang rute: satu per persimpangan
   ber-lampu (kotak jalan di luar plaza — sama seperti persimpanganKota di
   inti.js). s = posisi pusat bus berhenti (moncong di belakang garis
   henti); sumbu "tb" untuk gerak timur-barat, "us" untuk utara-selatan. */
const TITIK_HENTI = [];
function bangunTitikHenti() {
  TITIK_HENTI.length = 0;
  const HENTI = 13.5; // jarak pusat bus ke pusat persimpangan saat berhenti
  for (const g of RUTE.seg) {
    const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1];
    if (Math.abs(dx) > 0 && Math.abs(dz) > 0) continue; // segmen diagonal = sedang di dalam persimpangan
    const sumbu = dx !== 0 ? "tb" : "us";
    for (let k = 0; k < 80; k++) for (let b = 0; b < 50; b++) {
      const cx = sudutBlok(k, 0).x + JALAN / 2, cz = sudutBlok(0, b).z + JALAN / 2;
      const x0 = cx - JALAN / 2, z0 = cz - JALAN / 2;
      if (x0 >= PLAZA_TAPAK.minX && x0 + JALAN <= PLAZA_TAPAK.maxX && z0 >= PLAZA_TAPAK.minZ && z0 + JALAN <= PLAZA_TAPAK.maxZ) continue; // tertutup plaza: tanpa lampu
      const dC = sumbu === "tb" ? (cx - g.a[0]) * Math.sign(dx) : (cz - g.a[1]) * Math.sign(dz);
      if (dC < HENTI + 2 || dC > g.len + JALAN) continue; // di belakang segmen / persimpangan segmen sebelumnya
      const tegak = sumbu === "tb" ? Math.abs(cz - g.a[1]) : Math.abs(cx - g.a[0]);
      if (tegak > JALAN) continue; // bukan persimpangan yang dilalui segmen ini
      TITIK_HENTI.push({ s: g.mulai + dC - HENTI, sumbu });
    }
  }
  TITIK_HENTI.sort((a, b) => a.s - b.s);
}

function tambahHalte(grup, s) { // halte berkanopi di trotoar kiri lajur bus
  const p = posRute(RUTE, s);
  const nx = -p.hz / Math.hypot(p.hx, p.hz), nz = p.hx / Math.hypot(p.hx, p.hz); // normal kiri arah gerak
  const h = new THREE.Group();
  h.add(kotak(5, 0.2, 2, 0x1d5a8f, 0, 2.8, 0)); h.add(kotak(5, 2.4, 0.1, 0x9fc9d8, 0, 1.4, -0.9));
  for (const sx of [-2.3, 2.3]) h.add(kotak(0.12, 2.8, 0.12, 0xb8bcc2, sx, 1.4, -0.9));
  h.add(kotak(4, 0.12, 0.6, 0xa9743f, 0, 0.6, -0.5));
  h.position.set(p.x - nx * 4.6, 0, p.z - nz * 4.6);
  h.rotation.y = Math.atan2(p.hx, p.hz) - Math.PI / 2; // dinding belakang menjauhi jalan
  grup.add(h); HALTE.push(s); HALTE_POS.push({ x: p.x - nx * 3.3, z: p.z - nz * 3.3, yaw: Math.atan2(-p.hx, -p.hz) }); // titik turun: tepi trotoar depan halte
}
function cariS(R, x, z) { // posisi s di rute untuk titik (x,z) di atas segmen rute
  for (const g of R.seg) {
    const dx = g.b[0] - g.a[0], dz = g.b[1] - g.a[1], L2 = dx * dx + dz * dz;
    const f = L2 ? Math.max(0, Math.min(1, ((x - g.a[0]) * dx + (z - g.a[1]) * dz) / L2)) : 0;
    const px = g.a[0] + dx * f, pz = g.a[1] + dz * f;
    if (Math.hypot(x - px, z - pz) < 1) return g.mulai + g.len * f;
  }
  return 0;
}

export function bangunTransportasi() {
  const grup = new THREE.Group();
  bangunRel(grup);
  for (const st of STASIUN) bangunStasiun(grup, st);
  for (let j = 0; j < 2; j++) {
    const k = buatKereta(); k.position.set(j ? X1 - 400 : X0 + 400, YD + 0.2, JALUR[j]); if (j) k.rotation.y = Math.PI;
    grup.add(k);
    kereta.push({ g: k, x: k.position.x, arah: j ? -1 : 1, v: 0, berhenti: 0, sudah: new Set() });
  }
  RUTE = ruteBus();
  bangunTitikHenti();
  for (let i = 0; i < 6; i++) tambahHalte(grup, RUTE.total * (i + 0.5) / 6); // halte merata di rute
  // halte pusat kota: depan Istana Negara (jalan bar 25) + simpang plaza/warga (jalan kol 40 x bar 23)
  const cxI = sudutBlok(40, 0).x + JALAN / 2, czI = sudutBlok(0, 25).z + JALAN / 2, czW = sudutBlok(0, 23).z + JALAN / 2;
  tambahHalte(grup, cariS(RUTE, cxI - 40, czI + 3.5));   // Halte Istana Negara
  tambahHalte(grup, cariS(RUTE, cxI + 3.5, czW));       // Halte Plaza (dekat Blok 1880/1881)
  for (let i = 0; i < 5; i++) {
    const b = buatBus(["#2e9e5b", "#1d5a8f", "#e8943a", "#c8102e", "#7b2ff7"][i]); grup.add(b);
    bus.push({ g: b, s: RUTE.total * i / 5, tunggu: 0, halteTerakhir: -1, halteKini: -1 });
  }
  scene.add(grup);
  return grup;
}
export function perbaruiTransportasi(t, dt) {
  const fase = faseLaluLintas(t); // fase lampu kota yang sama dengan tiang & mobil
  for (const k of kereta) { // kereta bolak-balik, berhenti 8 dtk di setiap stasiun
    if (k.berhenti > 0) { k.berhenti -= dt; k.g.position.x = k.x; continue; }
    const kepala = k.x + k.arah * 8;
    let target = -1, dMin = Infinity;
    STASIUN.forEach((st, i) => {
      const d = (st.x - kepala) * k.arah + 26;
      if (d < -80 && k.sudah.has(i)) k.sudah.delete(i); // sudah jauh lewat: boleh berhenti lagi arah sebaliknya
      if (!k.sudah.has(i) && d > -5 && d < dMin) { dMin = d; target = i; }
    });
    let vMaks = 38;
    if (target >= 0 && dMin > 0 && dMin < 140) vMaks = Math.max(3, Math.sqrt(2 * 5 * dMin));
    k.v += Math.sign(vMaks - k.v) * Math.min(Math.abs(vMaks - k.v), 6 * dt);
    k.x += k.arah * k.v * dt;
    if (target >= 0 && dMin <= 0.5 && dMin > -5) { k.v = 0; k.berhenti = 12; k.sudah.add(target); }
    if (k.x > X1 - 60 || k.x < X0 + 60) { k.arah *= -1; k.x = Math.min(X1 - 60, Math.max(X0 + 60, k.x)); k.sudah.clear(); k.g.rotation.y = k.arah > 0 ? 0 : Math.PI; k.v = 0; }
    k.g.position.x = k.x;
  }
  if (!RUTE) return;
  /* HEADWAY: jarak target antarbus = keliling rute / jumlah bus. Kecepatan
     tiap bus diatur mengikuti jarak ke bus di depannya (kejar bila jauh,
     pelan bila dekat), dan bus ditahan di halte bila bus depan masih
     terlalu dekat — supaya bus tidak menumpuk/beriringan. */
  const TARGET = RUTE.total / bus.length;
  for (const b of bus) {
    let gap = Infinity;
    for (const o of bus) { if (o === b) continue; const d = ((o.s - b.s) % RUTE.total + RUTE.total) % RUTE.total; if (d > 0.01 && d < gap) gap = d; }
    b.gap = gap;
  }
  for (const b of bus) {
    if (b.tunggu > 0) {
      b.tunggu -= dt;
      if (b.tunggu <= 0) {
        if (b.gap < TARGET * 0.85) b.tunggu = 0.5; // tahan berangkat: jaga headway
        else b.halteKini = -1; // benar-benar berangkat: halte dilepas
      }
    } else {
      let v = b.gap < 60 ? Math.max(0, (b.gap - 14) * 0.3) : Math.max(5, Math.min(12.5, 9 * b.gap / TARGET)); // jarak dekat: ikut bus depan (antre), jangan menabrak
      /* Lampu lalu lintas: melambat ke garis henti persimpangan berikutnya
         bila fase sumbu gerak bus bukan hijau (merah/kuning = berhenti,
         sama seperti mobil kota); bus yang sudah melewati garis henti
         lanjut menyeberang. */
      let dHenti = Infinity, sumbuHenti = null;
      for (const th of TITIK_HENTI) {
        const d = ((th.s - b.s) % RUTE.total + RUTE.total) % RUTE.total;
        if (d > 0.01 && d < dHenti) { dHenti = d; sumbuHenti = th.sumbu; }
      }
      if (sumbuHenti && (sumbuHenti === "tb" ? fase.tb : fase.us) !== "hijau" && dHenti < 34) {
        v = Math.min(v, dHenti < 0.5 ? 0 : Math.max(0.9, dHenti * 0.55));
      }
      b.s = (b.s + v * dt) % RUTE.total;
      HALTE.forEach((hs, i) => { if (i !== b.halteTerakhir && Math.abs(((b.s - hs) % RUTE.total + RUTE.total) % RUTE.total) < 0.6) { b.tunggu = 6; b.halteTerakhir = i; b.halteKini = i; } });
    }
    const p = posRute(RUTE, b.s);
    b.g.position.set(p.x, 0.02, p.z); b.g.rotation.y = Math.atan2(p.hx, p.hz);
  }
}

/* ================= NAIK BUS / KRL =================
   Pemain (mode jalan) dekat pintu bus yang sedang berhenti di halte, atau
   di pintu masuk stasiun mana pun saat KRL berhenti di peronnya -> tombol
   "Naik". Selama menumpang: kamera 1st Person menempel di dalam kendaraan
   yang melaju (melihat kota lewat jendela), joystick/WASD = berjalan di
   lorong, seret = menoleh. Tombol "Turun" aktif saat kendaraan berhenti
   (halte / stasiun) -> pemain diturunkan di trotoar halte / depan stasiun
   tempat kendaraan itu berhenti. */
export const NAIK = { aktif: false, jenis: null, obj: null, lx: 0, lz: 0, lantaiY: 0 };
export function sedangNaik() { return NAIK.aktif; }
const _v = new THREE.Vector3();
const pintuStasiun = (st) => ({ x: st.x, z: st.sBlok.z + JALAN + 21 });
const stasiunDekat = (k) => STASIUN.reduce((a, st) => (Math.abs(st.x - k.x) < Math.abs(a.x - k.x) ? st : a), STASIUN[0]);
const namaStasiun = (st) => st.nama.replace("STASIUN ", "Stasiun ");
function duniaDari(o, lx, ly, lz) { o.updateMatrixWorld(); return _v.set(lx, ly, lz).applyMatrix4(o.matrixWorld); }
/* Aksi kontekstual (dipanggil rumah.js). fp = posisi pemain dunia. */
export function aksiTransportasi(fp) {
  if (NAIK.aktif) {
    const o = NAIK.obj;
    if (NAIK.jenis === "bus") {
      if (o.tunggu > 0 && o.halteKini >= 0) return { teks: "Bus berhenti di halte", tombol: "Turun", aksi: turun };
      return { teks: "Di dalam bus Trans Merdu", tombol: null };
    }
    if (o.berhenti > 0) return { teks: "KRL berhenti di " + namaStasiun(stasiunDekat(o)), tombol: "Turun", aksi: turun };
    return { teks: "Di dalam KRL Merdu", tombol: null };
  }
  for (const b of bus) {
    if (!(b.tunggu > 0)) continue;
    const d = duniaDari(b.g, 2.6, 0, 3.4);
    if (Math.hypot(fp.x - d.x, fp.z - d.z) < 5.5) return { teks: "Bus Trans Merdu di halte", tombol: "Naik Bus", aksi: () => naik("bus", b) };
  }
  for (const st of STASIUN) {
    const ps = pintuStasiun(st);
    if (Math.hypot(fp.x - ps.x, fp.z - ps.z) < 10) {
      const k = kereta.find((t) => t.berhenti > 0 && stasiunDekat(t) === st);
      if (k) return { teks: "KRL berhenti di peron", tombol: "Naik KRL", aksi: () => naik("kereta", k) };
      return { teks: namaStasiun(st) + " · menunggu KRL datang…", tombol: null };
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
  else { NAIK.lx = -4.2; NAIK.lz = 0; NAIK.lantaiY = 0.5; fp.yaw = -Math.PI / 2; }
  fp.pitch = 0;
  kaitNaik.petunjuk(jenis === "bus" ? "Menumpang bus Trans Merdu · jalan di lorong · turun saat bus berhenti di halte"
    : "Menumpang KRL Merdu · jalan antar gerbong · turun saat berhenti di stasiun");
}
function turun() {
  const fp = kaitNaik.fp, o = NAIK.obj;
  if (NAIK.jenis === "bus") { const h = HALTE_POS[o.halteKini] || duniaDari(o.g, 4, 0, 3.4); fp.x = h.x; fp.z = h.z; if (h.yaw !== undefined) fp.yaw = h.yaw; fp.pitch = 0; }
  else { const p = pintuStasiun(stasiunDekat(o)); fp.x = p.x; fp.z = p.z; fp.yaw = 0; }
  Object.assign(NAIK, { aktif: false, jenis: null, obj: null });
  kaitNaik.selesai();
}
/* Kamera & gerak di dalam kendaraan. gerak = {mx, mz} dari joystick/WASD. */
export function updateNaik(dt, camera, fp, gerak) {
  const o = NAIK.obj.g, laju = 3.2;
  const fx = -Math.sin(fp.yaw), fz = -Math.cos(fp.yaw), rx = Math.cos(fp.yaw), rz = -Math.sin(fp.yaw);
  NAIK.lx += (fx * gerak.mz + rx * gerak.mx) * laju * dt;
  NAIK.lz += (fz * gerak.mz + rz * gerak.mx) * laju * dt;
  if (NAIK.jenis === "bus") { NAIK.lx = Math.max(-0.95, Math.min(0.95, NAIK.lx)); NAIK.lz = Math.max(-4.7, Math.min(3.9, NAIK.lz)); }
  else { NAIK.lx = Math.max(-49, Math.min(4.6, NAIK.lx)); NAIK.lz = Math.max(-0.95, Math.min(0.95, NAIK.lz)); }
  const w = duniaDari(o, NAIK.lx, NAIK.lantaiY + 1.55, NAIK.lz);
  camera.position.copy(w);
  camera.rotation.set(fp.pitch, o.rotation.y + fp.yaw, 0);
  fp.x = w.x; fp.z = w.z; // untuk peta kecil & posisi yang disiarkan
}
