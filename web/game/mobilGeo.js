/* Negara Merdu — modul game "mobilGeo": MODEL MOBIL REALISTIS bersama
   (permintaan Diah 25 Nov 2026: "semua kendaraan bikin realistic").

   Satu model sedan dipakai SEMUA mobil (lalu lintas kota, parkir rumah,
   parkir fasilitas, apartemen, kantor, patroli polisi) — panjang 4,36 m
   sebelum SKALA_MOBIL, hadap +z, alas y = 0.
   - BADAN (diwarnai per mobil): profil samping diekstrusi dengan sudut
     membulat — kap mesin melandai, bagasi, LENGKUNG RODA terpotong di bodi
     (ban terlihat utuh di ruang roda), atap & pilar A/B/C.
   - DETAIL (warna tetap): kabin kaca gelap, 4 ban + pelek palang 5 + dop,
     lampu depan & belakang, gril, bumper & rok samping gelap, spion, garis
     pintu & handel, pelat nomor depan-belakang.
   Geometri dibuat sekali & dipakai bersama (InstancedMesh atau Mesh). */
import { gabungBerwarna } from "./bersama.js";

const RODA_Z = 1.36, RODA_R = 0.36, LEBAR = 1.82;
function profilBawah() { // (u = maju/z, v = tinggi/y)
  const s = new THREE.Shape(), r = 0.45, yb = 0.3;
  s.moveTo(-2.18, yb + 0.05);
  s.lineTo(-RODA_Z - r, yb);
  s.absarc(-RODA_Z, RODA_R, r, Math.PI, 0, true);           // lengkung roda belakang
  s.lineTo(RODA_Z - r, yb);
  s.absarc(RODA_Z, RODA_R, r, Math.PI, 0, true);            // lengkung roda depan
  s.lineTo(2.12, yb + 0.02);
  s.quadraticCurveTo(2.2, 0.45, 2.18, 0.7);                 // moncong
  s.quadraticCurveTo(2.14, 0.84, 1.9, 0.88);
  s.lineTo(1.05, 0.98);                                     // kap mesin melandai ke kaca depan
  s.lineTo(-1.48, 1.0);                                     // garis pinggang
  s.quadraticCurveTo(-1.98, 1.0, -2.1, 0.92);               // bagasi
  s.quadraticCurveTo(-2.2, 0.8, -2.18, yb + 0.05);
  return s;
}
function profilKabin(inset) {
  const s = new THREE.Shape(), i = inset || 0;
  s.moveTo(1.02 - i, 0.98); s.lineTo(0.36 - i * 0.5, 1.44); s.lineTo(-0.82 + i * 0.5, 1.46); s.lineTo(-1.46 + i, 1.0); s.lineTo(1.02 - i, 0.98);
  return s;
}
function ekstrusi(shape, lebar, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: lebar - 2 * (bevel || 0), bevelEnabled: !!bevel, bevelThickness: bevel || 0, bevelSize: bevel || 0, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -(lebar - 2 * (bevel || 0)) / 2);
  g.rotateY(-Math.PI / 2); // u (maju) -> +z, ekstrusi -> lebar (x)
  return g;
}
let GEO = null;
export function geoMobil() {
  if (GEO) return GEO;
  const PUTIH = 0xffffff;
  // ---- BADAN (instance color) ----
  const badan = [
    { geo: ekstrusi(profilBawah(), LEBAR, 0.06), warna: PUTIH },
    { geo: new THREE.BoxGeometry(1.5, 0.07, 1.22), x: 0, y: 1.475, z: -0.23, warna: PUTIH },      // atap
  ];
  for (const sx of [-1, 1]) {
    badan.push({ geo: new THREE.BoxGeometry(0.07, 0.62, 0.09), x: sx * 0.77, y: 1.2, z: 0.7, rx: -0.95, warna: PUTIH });  // pilar A
    badan.push({ geo: new THREE.BoxGeometry(0.07, 0.48, 0.1), x: sx * 0.79, y: 1.22, z: -0.22, warna: PUTIH });          // pilar B
    badan.push({ geo: new THREE.BoxGeometry(0.07, 0.6, 0.12), x: sx * 0.77, y: 1.2, z: -1.15, rx: 0.68, warna: PUTIH }); // pilar C
  }
  // ---- DETAIL (warna tetap) ----
  const KACA = 0x1b2a35, KARET = 0x18191b, PELEK = 0xc9ced4, GELAP = 0x2a2c30;
  const det = [{ geo: ekstrusi(profilKabin(0), 1.6, 0), warna: KACA }];
  for (const [x, z] of [[-1, RODA_Z], [1, RODA_Z], [-1, -RODA_Z], [1, -RODA_Z]]) {
    const wx = x * 0.8;
    det.push({ geo: new THREE.CylinderGeometry(RODA_R, RODA_R, 0.26, 16), x: wx, y: RODA_R, z, rz: Math.PI / 2, warna: KARET });
    det.push({ geo: new THREE.CylinderGeometry(0.22, 0.22, 0.27, 14), x: wx + x * 0.005, y: RODA_R, z, rz: Math.PI / 2, warna: PELEK });
    for (let k = 0; k < 5; k++) det.push({ geo: new THREE.BoxGeometry(0.02, 0.36, 0.06), x: wx + x * 0.14, y: RODA_R, z, rx: k * Math.PI / 5 * 2, warna: 0x8a9097 }); // palang pelek
    det.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.29, 8), x: wx, y: RODA_R, z, rz: Math.PI / 2, warna: 0x55595e });          // dop
  }
  for (const sx of [-1, 1]) {
    det.push({ geo: new THREE.BoxGeometry(0.42, 0.13, 0.08), x: sx * 0.63, y: 0.74, z: 2.15, ry: sx * 0.12, warna: 0xf4f6f0 });         // lampu depan
    det.push({ geo: new THREE.BoxGeometry(0.44, 0.15, 0.06), x: sx * 0.62, y: 0.8, z: -2.17, warna: 0xa31717 });                        // lampu belakang
    det.push({ geo: new THREE.BoxGeometry(0.16, 0.08, 0.05), x: sx * 0.62, y: 0.68, z: -2.17, warna: 0xf2f2f2 });                       // lampu mundur
    det.push({ geo: new THREE.BoxGeometry(0.2, 0.1, 0.06), x: sx * 1.0, y: 1.02, z: 0.95, warna: GELAP });                              // spion
    det.push({ geo: new THREE.BoxGeometry(0.03, 0.1, 0.16), x: sx * 0.93, y: 1.02, z: 0.86, warna: GELAP });
    det.push({ geo: new THREE.BoxGeometry(0.03, 0.18, 2.9), x: sx * 0.92, y: 0.42, z: 0, warna: GELAP });                               // rok samping
    det.push({ geo: new THREE.BoxGeometry(0.02, 0.52, 0.02), x: sx * 0.915, y: 0.7, z: -0.22, warna: 0x3a3d40 });                     // garis pintu
    for (const dz of [0.25, -0.75]) det.push({ geo: new THREE.BoxGeometry(0.025, 0.04, 0.16), x: sx * 0.92, y: 0.86, z: dz, warna: 0x8a9097 }); // handel
  }
  det.push({ geo: new THREE.BoxGeometry(0.75, 0.16, 0.05), x: 0, y: 0.6, z: 2.17, warna: 0x1d1f22 });                                   // gril
  det.push({ geo: new THREE.BoxGeometry(1.86, 0.16, 0.12), x: 0, y: 0.38, z: 2.15, warna: GELAP });                                     // bumper depan
  det.push({ geo: new THREE.BoxGeometry(1.86, 0.16, 0.12), x: 0, y: 0.38, z: -2.16, warna: GELAP });                                    // bumper belakang
  det.push({ geo: new THREE.BoxGeometry(0.5, 0.12, 0.03), x: 0, y: 0.38, z: 2.225, warna: 0x111111 });                                  // pelat depan
  det.push({ geo: new THREE.BoxGeometry(0.5, 0.12, 0.03), x: 0, y: 0.62, z: -2.205, warna: 0x111111 });                                 // pelat belakang
  GEO = { badan: gabungBerwarna(badan), detail: gabungBerwarna(det) };
  return GEO;
}
/* Mesh mobil mandiri (bukan instanced). */
export function buatMobil(warna) {
  const G = geoMobil(), g = new THREE.Group();
  const b = new THREE.Mesh(G.badan, new THREE.MeshStandardMaterial({ color: warna, roughness: 0.32, metalness: 0.35 }));
  const d = new THREE.Mesh(G.detail, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
  for (const m of [b, d]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

/* ===================== TRUK & JIP REALISTIS =====================
   Hadap +z, alas y = 0, ukuran dunia nyata (tanpa SKALA_MOBIL; truk ±6,6 m).
   Dipakai: mobil boks MBG, truk logistik Koperasi, truk & jip tentara. */
function roda(g, x, z, r, lebar, ganda) {
  const KARET = 0x18191b;
  for (const d of ganda ? [-0.17, 0.17] : [0]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, lebar, 18), new THREE.MeshStandardMaterial({ color: KARET, roughness: 0.9 }));
    t.rotation.z = Math.PI / 2; t.position.set(x + Math.sign(x) * d, r, z); t.castShadow = true; g.add(t);
  }
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, lebar + 0.02, 14), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.6, roughness: 0.35 }));
  p.rotation.z = Math.PI / 2; p.position.set(x + Math.sign(x) * (ganda ? 0.17 : 0), r, z); g.add(p);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, lebar + 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x55595e }));
  hub.rotation.z = Math.PI / 2; hub.position.copy(p.position); g.add(hub);
}
function kotakM(g, w, h, d, warna, x, y, z, opsi) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial(Object.assign({ color: warna, roughness: 0.5, metalness: 0.2 }, opsi || {})));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
/* Kabin truk (cab-over, gaya truk ringan Indonesia): kaca depan miring,
   jendela samping, gril, lampu, bumper, spion, tangga pintu. zDepan = ujung depan. */
function kabinTruk(g, warna, zDepan, lebar) {
  const L = lebar, KACA = 0x1b2a35;
  kotakM(g, L, 1.15, 1.7, warna, 0, 1.35, zDepan - 0.85);                                   // badan bawah kabin
  kotakM(g, L - 0.06, 0.95, 1.45, warna, 0, 2.38, zDepan - 0.98);                           // atap/badan atas
  const kd = kotakM(g, L - 0.2, 0.85, 0.06, KACA, 0, 2.35, zDepan - 0.24, { roughness: 0.1, metalness: 0.5 }); kd.rotation.x = -0.18; // kaca depan
  for (const s of [-1, 1]) {
    kotakM(g, 0.05, 0.6, 0.9, KACA, s * L / 2, 2.4, zDepan - 0.85, { roughness: 0.1, metalness: 0.5 });  // jendela samping
    kotakM(g, 0.04, 1.0, 0.03, 0x2a2c30, s * (L / 2 + 0.01), 1.4, zDepan - 1.55);                       // garis pintu
    kotakM(g, 0.06, 0.4, 0.22, 0x1b1d20, s * (L / 2 + 0.25), 2.3, zDepan - 0.35);                       // spion
    kotakM(g, 0.3, 0.05, 0.05, 0x1b1d20, s * (L / 2 + 0.12), 2.5, zDepan - 0.35);
    kotakM(g, 0.4, 0.22, 0.06, 0xf4f6f0, s * (L / 2 - 0.35), 1.05, zDepan + 0.01, { emissive: 0x332a10 }); // lampu depan
    kotakM(g, 0.14, 0.12, 0.06, 0xffb020, s * (L / 2 - 0.08), 1.05, zDepan + 0.01);                     // sein
    kotakM(g, 0.35, 0.08, 0.3, 0x2a2c30, s * (L / 2 - 0.2), 0.55, zDepan - 1.4);                       // tangga pintu
  }
  kotakM(g, L * 0.55, 0.38, 0.05, 0x1d1f22, 0, 1.3, zDepan + 0.01);                         // gril
  kotakM(g, L + 0.1, 0.25, 0.2, 0x2a2c30, 0, 0.65, zDepan);                                 // bumper
  kotakM(g, 0.5, 0.13, 0.03, 0x111111, 0, 0.65, zDepan + 0.11);                             // pelat
  kotakM(g, 0.7, 0.05, 0.04, 0x111111, 0, 2.0, zDepan - 0.2).rotation.z = 0.3;             // wiper
}
/* jenis: "boks" (bak tertutup), "terpal" (militer, bak beratap terpal), "bak" (bak terbuka) */
export function buatTruk(o) {
  const g = new THREE.Group(), L = 2.2, zDepan = 3.3;
  kabinTruk(g, o.kabin, zDepan, L);
  kotakM(g, 0.9, 0.25, 6.2, 0x2a2c30, 0, 0.75, -0.2);                                       // sasis
  for (const s of [-1, 1]) kotakM(g, 0.05, 0.3, 4.4, 0x3a3d40, s * 1.05, 0.95, -1.2);       // pelindung samping
  const zb0 = zDepan - 1.85, zb1 = -3.3, pb = zb0 - zb1, zc = (zb0 + zb1) / 2;
  if (o.jenis === "boks") {
    kotakM(g, 2.35, 2.3, pb, o.boks || 0xf4f4f2, 0, 2.15, zc, { roughness: 0.6, metalness: 0.1 });
    for (let i = 0; i < 6; i++) kotakM(g, 2.37, 0.04, 0.05, 0xc9ced4, 0, 1.05 + i * 0.44, zb1 - 0.01); // pintu belakang bergaris
    kotakM(g, 0.04, 2.2, 0.04, 0x8a8f94, 0, 2.15, zb1 - 0.03);
    if (o.label) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(pb - 0.6, 1.2), new THREE.MeshBasicMaterial({ map: o.label })); p.rotation.y = s * Math.PI / 2; p.position.set(s * 1.185, 2.2, zc); g.add(p); }
  } else if (o.jenis === "terpal") {
    kotakM(g, 2.3, 0.7, pb, o.kabin, 0, 1.3, zc);                                            // dinding bak
    const geoT = new THREE.CylinderGeometry(1.15, 1.15, pb, 16, 1, false, Math.PI / 2, Math.PI); geoT.rotateX(Math.PI / 2); // setengah silinder atas memanjang
    const terpal = new THREE.Mesh(geoT, new THREE.MeshStandardMaterial({ color: o.terpal || 0x5a6640, roughness: 0.95, side: THREE.DoubleSide }));
    terpal.scale.set(1, 0.95, 1); terpal.position.set(0, 1.65, zc); terpal.castShadow = true; g.add(terpal);
    for (const s of [-1, 1]) kotakM(g, 0.04, 0.5, pb, o.terpal || 0x5a6640, s * 1.15, 1.5, zc, { roughness: 0.95 }); // sisi terpal menutup celah
    for (let i = 0; i < 4; i++) kotakM(g, 2.32, 0.05, 0.06, 0x3b4a2b, 0, 1.68, zb1 + 0.3 + i * (pb - 0.6) / 3);
  } else {
    kotakM(g, 2.3, 0.15, pb, 0x6b4a2b, 0, 1.0, zc);
    for (const s of [-1, 1]) kotakM(g, 0.08, 0.7, pb, o.kabin, s * 1.13, 1.4, zc);
    kotakM(g, 2.3, 0.7, 0.08, o.kabin, 0, 1.4, zb1);
  }
  for (const s of [-1, 1]) { kotakM(g, 0.3, 0.2, 0.06, 0xa31717, s * 0.95, 0.85, zb1 - 0.08); kotakM(g, 0.1, 0.2, 0.06, 0xffb020, s * 0.72, 0.85, zb1 - 0.08); }
  kotakM(g, 2.3, 0.2, 0.15, 0x2a2c30, 0, 0.6, zb1 - 0.05);
  roda(g, -0.95, zDepan - 0.95, 0.48, 0.3, false); roda(g, 0.95, zDepan - 0.95, 0.48, 0.3, false);
  roda(g, -0.85, -1.9, 0.48, 0.28, true); roda(g, 0.85, -1.9, 0.48, 0.28, true);
  return g;
}
/* Jip militer 4x4: kap kotak, kaca depan tegak, atap kanvas, ban kasar, ban serep. */
export function buatJip(warna) {
  const g = new THREE.Group(), W = 1.85;
  kotakM(g, W, 0.75, 4.0, warna, 0, 1.0, 0, { roughness: 0.85, metalness: 0.05 });          // badan
  kotakM(g, W - 0.1, 0.12, 1.3, warna, 0, 1.43, 1.3, { roughness: 0.85 });                   // kap
  kotakM(g, W - 0.15, 0.7, 0.06, 0x1b2a35, 0, 1.75, 0.62, { roughness: 0.1, metalness: 0.5 }); // kaca depan tegak
  kotakM(g, W - 0.05, 0.08, 0.08, warna, 0, 2.12, 0.62);
  kotakM(g, W - 0.05, 0.75, 2.3, 0x4a5236, 0, 1.78, -0.6, { roughness: 1 });                  // atap kanvas
  for (const s of [-1, 1]) {
    kotakM(g, 0.04, 0.4, 0.9, 0x1b2a35, s * (W / 2 - 0.01), 1.82, -0.1);                    // jendela kanvas
    kotakM(g, 0.3, 0.12, 1.2, 0x2a2c30, s * (W / 2 + 0.05), 1.0, 1.4);                      // spakbor depan
    kotakM(g, 0.3, 0.12, 1.2, 0x2a2c30, s * (W / 2 + 0.05), 1.0, -1.4);
    kotakM(g, 0.22, 0.2, 0.05, 0xf4f6f0, s * 0.6, 1.25, 2.01, { emissive: 0x332a10 });       // lampu bulat-kotak
  }
  for (let i = 0; i < 7; i++) kotakM(g, 0.06, 0.4, 0.04, 0x1d1f22, -0.36 + i * 0.12, 1.15, 2.01); // gril bilah
  kotakM(g, W + 0.2, 0.2, 0.25, 0x2a2c30, 0, 0.6, 2.05);                                     // bumper + derek
  const serep = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.9 }));
  serep.rotation.x = Math.PI / 2; serep.position.set(0, 1.3, -2.15); g.add(serep);
  for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) roda(g, x, z, 0.44, 0.34, false);
  const ant = kotakM(g, 0.03, 1.6, 0.03, 0x1b1d20, -0.8, 2.3, -1.8); ant.rotation.x = -0.2;   // antena radio
  return g;
}
