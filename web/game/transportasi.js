/* Negara Merdu — modul game "transportasi": STASIUN, KERETA & BUS.
   - Rel layang (elevated) membentang barat-timur hampir selebar kota di
     atas jalan utara baris blok 36 (as z 931), bertiang di tengah ruas
     jalan (tidak pernah di dalam persimpangan), dua jalur rel.
   - STASIUN MERDU di Blok 2925 (kol 44, bar 36, tepat di timur Merdu
     Mall): peron layang berkanopi di atas jalan + gedung concourse
     dengan tangga & eskalator, papan nama, jam.
   - TERMINAL BUS MERDU di blok yang sama (bagian selatan): jalur bus
     berkanopi, bus parkir, ruang tunggu.
   - 2 KERETA (4 gerbong) bolak-balik di kedua jalur, melambat & berhenti
     di stasiun 8 detik, lalu berangkat lagi.
   - 5 BUS "TRANS MERDU" berkeliling rute persegi jalan kota (lajur kiri),
     berhenti 3 detik di tiap halte (halte berkanopi di trotoar). */
import { JALAN, PITCH, sudutBlok } from "./inti.js";
import { M, kotak, scene } from "./bersama.js";
import { bangkuTaman, pohonKecil, teksturPapanNama } from "./fasilitas.js";

export const BLOK_STASIUN = { kol: 44, bar: 36 };
const RZ = sudutBlok(0, 36).z + JALAN / 2;        // as jalan di bawah rel (z 931)
const X0 = sudutBlok(2, 0).x, X1 = sudutBlok(78, 0).x; // ujung rel
const YD = 8.6;                                    // tinggi dek rel
const JALUR = [RZ - 2.2, RZ + 2.2];
const sSt = sudutBlok(BLOK_STASIUN.kol, BLOK_STASIUN.bar);
const XST = sSt.x + JALAN + (PITCH - JALAN) / 2;   // pusat stasiun (x)
const kereta = [], bus = [];
export const rintanganTransportasi = [];

function teksturKereta() {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128;
  const c = cv.getContext("2d");
  c.fillStyle = "#f4f4f2"; c.fillRect(0, 0, 512, 128);
  c.fillStyle = "#c8102e"; c.fillRect(0, 92, 512, 14);        // garis merah
  c.fillStyle = "#1f2a33"; for (let i = 0; i < 6; i++) c.fillRect(20 + i * 82, 28, 62, 46); // jendela
  c.fillStyle = "#3d5566"; c.fillRect(250, 22, 34, 84);       // pintu
  c.fillStyle = "#1d5a8f"; c.font = "bold 18px system-ui"; c.fillText("KRL MERDU", 400, 120);
  const t = new THREE.CanvasTexture(cv); return t;
}
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
function bangunStasiun(grup) {
  const zb = sSt.z + JALAN; // tepi utara kavling blok stasiun (938)
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
  const papan = new THREE.Mesh(new THREE.BoxGeometry(24, 2.4, 0.3), new THREE.MeshStandardMaterial({ map: teksturPapanNama("STASIUN MERDU", "KRL · Terminal Bus"), roughness: 0.8 }));
  papan.position.set(XST, YD + 3.0, zb + 17.2); grup.add(papan);
  const jam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 24), M(0xffffff)); jam.rotation.x = Math.PI / 2; jam.position.set(XST + 16, YD + 3, zb + 17.3); grup.add(jam);
  for (let t = 0; t < 14; t++) grup.add(kotak(4, 0.4, 0.9, 0xd8d2c6, XST - 6, 0.2 + t * 0.6, zb + 30 - t * 0.85)); // tangga
  const esk = kotak(1.6, 0.3, 14, 0x8a8f94, XST + 6, YD / 2, zb + 24); esk.rotation.x = -Math.atan2(YD, 12); grup.add(esk); // eskalator
  grup.add(kotak(4.4, 3.6, 3.2, 0x2e5a73, XST, 1.8, zb + 18.6)); // pintu masuk bawah
  rintanganTransportasi.push({ minX: XST - 30, maxX: XST + 30, minZ: zb + 1, maxZ: zb + 17 });
  // terminal bus (selatan blok)
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

/* ---------- kereta ---------- */
function buatKereta() {
  const g = new THREE.Group(), tex = teksturKereta();
  const matSisi = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, metalness: 0.2 }), putih = M(0xf4f4f2, 0.4);
  for (let i = 0; i < 4; i++) {
    const gb = new THREE.Mesh(new THREE.BoxGeometry(13.6, 3.4, 3.0), [putih, putih, putih, M(0x9aa0a6), matSisi, matSisi]);
    // BoxGeometry muka urutan: +x,-x,+y,-y,+z,-z — sisi panjang (+z/-z) bertekstur
    gb.position.set(-i * 14.2, 1.9, 0); gb.castShadow = true; g.add(gb);
    g.add(kotak(13, 0.4, 2.6, 0x37474f, -i * 14.2, 0.25, 0));
  }
  const hidung = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.9), M(0xc8102e, 0.4)); hidung.position.set(7.6, 1.6, 0); hidung.rotation.z = -0.35; g.add(hidung);
  const kaca = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 2.4), M(0x1f2a33)); kaca.position.set(8.0, 2.7, 0); kaca.rotation.z = -0.35; g.add(kaca);
  return g;
}
/* ---------- bus ---------- */
function buatBus(warna) {
  const g = new THREE.Group(), tex = teksturBus(warna), w = parseInt(warna.slice(1), 16);
  const sisi = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), p = M(w, 0.5);
  const badan = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.0, 10.5), [sisi, sisi, p, M(0x333333), M(0x1f2a33), p]);
  badan.position.y = 1.9; badan.castShadow = true; g.add(badan);
  for (const [x, z] of [[-1.2, 3.4], [1.2, 3.4], [-1.2, -3.4], [1.2, -3.4]]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), M(0x1c1c1e)); r.rotation.z = Math.PI / 2; r.position.set(x, 0.5, z); g.add(r);
  }
  return g; // hadap +z
}
/* rute bus: persegi jalan (kol 32/48, bar 18/36), searah jarum jam pandangan atas, lajur kiri */
function ruteBus() {
  const cx = (k) => sudutBlok(k, 0).x + JALAN / 2, cz = (b) => sudutBlok(0, b).z + JALAN / 2;
  const xa = cx(32), xb = cx(48), za = cz(18), zb = cz(36);
  const L = 3.5;
  // urutan: utara (ke timur, -x? ) — gerak ke timur di jalan za -> lajur utara (z - L)
  const titik = [
    [xa + L, za - L], [xb - L, za - L],       // ke timur di jalan utara
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
let RUTE = null; const HALTE = [];

export function bangunTransportasi() {
  const grup = new THREE.Group();
  bangunRel(grup); bangunStasiun(grup);
  for (let j = 0; j < 2; j++) {
    const k = buatKereta(); k.position.set(j ? X1 - 400 : X0 + 400, YD + 0.2, JALUR[j]); if (j) k.rotation.y = Math.PI;
    grup.add(k);
    kereta.push({ g: k, x: k.position.x, arah: j ? -1 : 1, v: 0, berhenti: 0, sudahBerhenti: false });
  }
  RUTE = ruteBus();
  for (let i = 0; i < 6; i++) { // halte di sisi kiri jalan
    const s = RUTE.total * (i + 0.5) / 6, p = posRute(RUTE, s);
    const nx = -p.hz / Math.hypot(p.hx, p.hz), nz = p.hx / Math.hypot(p.hx, p.hz); // normal kiri arah gerak
    const h = new THREE.Group();
    h.add(kotak(5, 0.2, 2, 0x1d5a8f, 0, 2.8, 0)); h.add(kotak(5, 2.4, 0.1, 0x9fc9d8, 0, 1.4, -0.9));
    for (const sx of [-2.3, 2.3]) h.add(kotak(0.12, 2.8, 0.12, 0xb8bcc2, sx, 1.4, -0.9));
    h.add(kotak(4, 0.12, 0.6, 0xa9743f, 0, 0.6, -0.5));
    h.position.set(p.x - nx * 4.6, 0, p.z - nz * 4.6); // di trotoar kiri lajur bus h.rotation.y = Math.atan2(p.hx, p.hz) + Math.PI / 2;
    grup.add(h); HALTE.push(s);
  }
  for (let i = 0; i < 5; i++) {
    const b = buatBus(["#2e9e5b", "#1d5a8f", "#e8943a", "#c8102e", "#7b2ff7"][i]); grup.add(b);
    bus.push({ g: b, s: RUTE.total * i / 5, tunggu: 0, halteTerakhir: -1 });
  }
  scene.add(grup);
  return grup;
}
export function perbaruiTransportasi(dt) {
  for (const k of kereta) { // kereta bolak-balik, berhenti di stasiun
    if (k.berhenti > 0) { k.berhenti -= dt; if (k.berhenti <= 0) k.sudahBerhenti = true; continue; }
    const kepala = k.x + k.arah * 8, keStasiun = (XST - kepala) * k.arah + 26;
    let vMaks = 38;
    if (!k.sudahBerhenti && keStasiun > 0 && keStasiun < 140) vMaks = Math.max(3, Math.sqrt(2 * 5 * keStasiun));
    k.v += Math.sign(vMaks - k.v) * Math.min(Math.abs(vMaks - k.v), 6 * dt);
    k.x += k.arah * k.v * dt;
    if (!k.sudahBerhenti && keStasiun <= 0.5 && keStasiun > -5) { k.v = 0; k.berhenti = 8; }
    if (k.x > X1 - 60 || k.x < X0 + 60) { k.arah *= -1; k.x = Math.min(X1 - 60, Math.max(X0 + 60, k.x)); k.sudahBerhenti = false; k.g.rotation.y = k.arah > 0 ? 0 : Math.PI; k.v = 0; }
    if (keStasiun < -80) k.sudahBerhenti = false;
    k.g.position.x = k.x;
  }
  if (!RUTE) return;
  for (const b of bus) {
    if (b.tunggu > 0) { b.tunggu -= dt; } else {
      b.s = (b.s + 9 * dt) % RUTE.total;
      HALTE.forEach((hs, i) => { if (i !== b.halteTerakhir && Math.abs(((b.s - hs) % RUTE.total + RUTE.total) % RUTE.total) < 0.6) { b.tunggu = 3; b.halteTerakhir = i; } });
    }
    const p = posRute(RUTE, b.s);
    b.g.position.set(p.x, 0.02, p.z); b.g.rotation.y = Math.atan2(p.hx, p.hz);
  }
}
