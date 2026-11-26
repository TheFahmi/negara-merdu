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
import { geoMobilGLB, klonKendaraanGLB } from "./aset3d.js";

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
/* kaca mobil: gelap tembus pandang (interior terlihat) — dipakai bersama semua mobil */
export const MAT_KACA_MOBIL = new THREE.MeshStandardMaterial({ color: 0x2a4050, transparent: true, opacity: 0.5, roughness: 0.05, metalness: 0.6, depthWrite: false });
export function geoMobil() {
  if (GEO) return GEO;
  /* Sedan GLB (next35): geometri dari aset3d — skala meter game yang
     sama dengan model prosedural (0,40 file = 1 m), alas y = 0, hadap
     +z; SKALA_MOBIL di pemanggil berlaku seperti sebelumnya. */
  const glb = geoMobilGLB();
  if (glb) { GEO = glb; return GEO; }
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
  const KARET = 0x18191b, PELEK = 0xc9ced4, GELAP = 0x2a2c30;
  /* INTERIOR (terlihat lewat kaca bening): 4 jok bersandaran & sandaran
     kepala, dasbor + panel instrumen, setir, konsol tengah & tuas, plafon,
     lantai karpet, panel pintu, kaca spion dalam. */
  const JOK = 0x3a332e, JOK2 = 0x2a2420, DASH = 0x232528;
  const det = [];
  for (const [jz, depan] of [[0.15, true], [-0.95, false]]) {
    for (const sx of depan ? [-1, 1] : [0]) {
      const lw = depan ? 0.55 : 1.45, x = depan ? sx * 0.38 : 0;
      det.push({ geo: new THREE.BoxGeometry(lw, 0.14, 0.5), x, y: 0.62, z: jz, warna: JOK });
      det.push({ geo: new THREE.BoxGeometry(lw, 0.62, 0.12), x, y: 0.98, z: jz - 0.3, rx: -0.12, warna: JOK });
      if (depan) det.push({ geo: new THREE.BoxGeometry(0.28, 0.18, 0.1), x, y: 1.36, z: jz - 0.36, warna: JOK2 });
      else for (const hx of [-0.45, 0.45]) det.push({ geo: new THREE.BoxGeometry(0.26, 0.15, 0.1), x: hx, y: 1.33, z: jz - 0.35, warna: JOK2 });
    }
  }
  det.push({ geo: new THREE.BoxGeometry(1.6, 0.3, 0.5), x: 0, y: 0.88, z: 0.85, warna: DASH });                         // dasbor
  det.push({ geo: new THREE.BoxGeometry(0.42, 0.13, 0.03), x: -0.38, y: 1.0, z: 0.6, rx: -0.4, warna: 0x0f2a3a });         // panel instrumen
  det.push({ geo: new THREE.TorusGeometry(0.17, 0.025, 6, 16), x: -0.38, y: 0.92, z: 0.55, rx: -0.45, warna: 0x111111 }); // setir
  det.push({ geo: new THREE.BoxGeometry(0.22, 0.3, 0.7), x: 0, y: 0.6, z: 0.4, warna: DASH });                            // konsol tengah
  det.push({ geo: new THREE.BoxGeometry(0.05, 0.14, 0.05), x: 0, y: 0.8, z: 0.3, warna: 0x111111 });                       // tuas transmisi
  det.push({ geo: new THREE.BoxGeometry(1.5, 0.03, 1.4), x: 0, y: 1.43, z: -0.25, warna: 0xc9c2b4 });                      // plafon
  det.push({ geo: new THREE.BoxGeometry(1.5, 0.02, 2.6), x: 0, y: 0.5, z: -0.2, warna: 0x1f2124 });                        // karpet
  for (const sx of [-1, 1]) det.push({ geo: new THREE.BoxGeometry(0.04, 0.35, 2.2), x: sx * 0.84, y: 0.8, z: -0.25, warna: 0x2a2c30 }); // panel pintu
  det.push({ geo: new THREE.BoxGeometry(0.22, 0.07, 0.02), x: 0, y: 1.35, z: 0.55, warna: 0x111111 });                     // spion dalam
  const kaca = [{ geo: ekstrusi(profilKabin(0), 1.6, 0), warna: 0xffffff }];
  const roda = []; // ban+pelek+dop: geometri TERPISAH -> tetap tegak saat bodi sway
  for (const [x, z] of [[-1, RODA_Z], [1, RODA_Z], [-1, -RODA_Z], [1, -RODA_Z]]) {
    const wx = x * 0.8;
    roda.push({ geo: new THREE.CylinderGeometry(RODA_R, RODA_R, 0.26, 16), x: wx, y: RODA_R, z, rz: Math.PI / 2, warna: KARET });
    roda.push({ geo: new THREE.CylinderGeometry(0.22, 0.22, 0.27, 14), x: wx + x * 0.005, y: RODA_R, z, rz: Math.PI / 2, warna: PELEK });
    for (let k = 0; k < 5; k++) roda.push({ geo: new THREE.BoxGeometry(0.02, 0.36, 0.06), x: wx + x * 0.14, y: RODA_R, z, rx: k * Math.PI / 5 * 2, warna: 0x8a9097 }); // palang pelek
    roda.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.29, 8), x: wx, y: RODA_R, z, rz: Math.PI / 2, warna: 0x55595e });          // dop
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
  GEO = { badan: gabungBerwarna(badan), detail: gabungBerwarna(det), kaca: gabungBerwarna(kaca), roda: gabungBerwarna(roda) };
  return GEO;
}
let _matRoda = null;
export function MAT_RODA() { return _matRoda || (_matRoda = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.2 })); }
export const PIVOT_MOBIL = 0.36; // titik putar sway mobil (setinggi as roda, satuan lokal)
/* Mesh mobil mandiri (bukan instanced). */
export function buatMobil(warna) {
  const G = geoMobil(), g = new THREE.Group();
  const b = new THREE.Mesh(G.badan, new THREE.MeshStandardMaterial({ color: warna, roughness: 0.32, metalness: 0.35 }));
  const d = new THREE.Mesh(G.detail, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
  for (const m of [b, d]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  const k = new THREE.Mesh(G.kaca, MAT_KACA_MOBIL); k.renderOrder = 2; g.add(k);
  const sasis = new THREE.Group(); g.add(sasis); g.userData.sasis = sasis; // roda: tetap tegak saat bodi sway
  const r = new THREE.Mesh(G.roda, MAT_RODA()); r.castShadow = true; sasis.add(r);
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
  /* kabin atas BERONGGA: atap, pilar, dinding belakang, kaca bening + interior
     (jok sopir & penumpang, dasbor, setir, tuas, panel instrumen) */
  kotakM(g, L - 0.06, 0.12, 1.45, warna, 0, 2.83, zDepan - 0.98);                           // atap
  kotakM(g, L - 0.06, 0.95, 0.08, warna, 0, 2.38, zDepan - 1.67);                           // dinding belakang kabin
  for (const s of [-1, 1]) { kotakM(g, 0.1, 0.95, 0.1, warna, s * (L / 2 - 0.05), 2.38, zDepan - 0.3); kotakM(g, 0.1, 0.95, 0.1, warna, s * (L / 2 - 0.05), 2.38, zDepan - 1.6); kotakM(g, 0.08, 0.95, 0.1, warna, s * (L / 2 - 0.04), 2.38, zDepan - 1.05); }
  const kd = new THREE.Mesh(new THREE.BoxGeometry(L - 0.2, 0.85, 0.04), MAT_KACA_MOBIL); kd.position.set(0, 2.35, zDepan - 0.24); kd.rotation.x = -0.18; kd.renderOrder = 2; g.add(kd); // kaca depan
  for (const s of [-1, 1]) { const ks = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 1.25), MAT_KACA_MOBIL); ks.position.set(s * (L / 2 - 0.03), 2.38, zDepan - 0.95); ks.renderOrder = 2; g.add(ks); }
  for (const s of [-1, 1]) { kotakM(g, 0.6, 0.15, 0.55, 0x3a332e, s * 0.5, 1.98, zDepan - 1.25); kotakM(g, 0.6, 0.7, 0.12, 0x3a332e, s * 0.5, 2.38, zDepan - 1.52); } // jok
  kotakM(g, L - 0.2, 0.35, 0.4, 0x232528, 0, 2.05, zDepan - 0.45);                             // dasbor
  kotakM(g, 0.4, 0.12, 0.03, 0x0f2a3a, -0.5, 2.18, zDepan - 0.66);                              // panel instrumen
  { const st = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: 0x111111 })); st.position.set(-0.5, 2.2, zDepan - 0.72); st.rotation.x = -1.0; g.add(st); }
  kotakM(g, 0.05, 0.35, 0.05, 0x111111, 0, 1.95, zDepan - 0.95);                               // tuas persneling
  for (const s of [-1, 1]) {
    kotakM(g, 0.04, 1.0, 0.03, 0x2a2c30, s * (L / 2 + 0.01), 1.4, zDepan - 1.55);                       // garis pintu
    void KACA;
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
  /* Truk GLB (next35): varian jenis -> truk_boks/truk_bak/truk_terpal,
     skala samakan panjang prosedural 6,6 m. Parameter warna/label lama
     tidak dipakai — livery GLB tetap. */
  const glb = klonKendaraanGLB(o.jenis === "terpal" ? "truk_terpal" : o.jenis === "bak" ? "truk_bak" : "truk_boks", 2.405, null);
  if (glb) return glb.g;
  return buatTrukProsedural(o);
}
function buatTrukProsedural(o) {
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
  /* Jip GLB (next35): skala samakan panjang prosedural ±4,3 m.
     next37: 2,37->2,55 — kompromi panjang/lebar vs prosedural terukur
     (4,465 x 2,250): panjang 4,31->4,63 (+3,7%), lebar 1,97->2,12 (-5,9%). */
  const glb = klonKendaraanGLB("jip", 2.55, null);
  if (glb) return glb.g;
  return buatJipProsedural(warna);
}
function buatJipProsedural(warna) {
  const g = new THREE.Group(), W = 1.85;
  kotakM(g, W, 0.75, 4.0, warna, 0, 1.0, 0, { roughness: 0.85, metalness: 0.05 });          // badan
  kotakM(g, W - 0.1, 0.12, 1.3, warna, 0, 1.43, 1.3, { roughness: 0.85 });                   // kap
  { const kd = new THREE.Mesh(new THREE.BoxGeometry(W - 0.15, 0.7, 0.04), MAT_KACA_MOBIL); kd.position.set(0, 1.75, 0.62); kd.renderOrder = 2; g.add(kd); } // kaca depan tegak (bening)
  for (const [jz, sx] of [[0.0, -1], [0.0, 1], [-1.1, 0]]) { const lw = sx ? 0.6 : 1.5; kotakM(g, lw, 0.14, 0.5, 0x3b3a2e, sx * 0.45, 1.45, jz); kotakM(g, lw, 0.6, 0.1, 0x3b3a2e, sx * 0.45, 1.8, jz - 0.28); } // jok
  kotakM(g, W - 0.2, 0.25, 0.35, 0x2b2d22, 0, 1.55, 0.42);                                     // dasbor
  { const st = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), new THREE.MeshStandardMaterial({ color: 0x111111 })); st.position.set(-0.45, 1.75, 0.25); st.rotation.x = -1.1; g.add(st); }
  kotakM(g, 0.25, 0.25, 0.15, 0x3b4a2b, 0.35, 1.78, 0.38);                                      // radio militer
  kotakM(g, W - 0.05, 0.08, 0.08, warna, 0, 2.12, 0.62);
  kotakM(g, W - 0.05, 0.06, 2.3, 0x4a5236, 0, 2.15, -0.6, { roughness: 1 });                  // atap kanvas
  kotakM(g, W - 0.05, 0.75, 0.05, 0x4a5236, 0, 1.78, -1.75, { roughness: 1 });                 // kanvas belakang
  for (const s of [-1, 1]) for (const z of [0.55, -1.75]) kotakM(g, 0.05, 0.75, 0.05, 0x2b2d22, s * (W / 2 - 0.03), 1.78, z); // rangka kanvas
  for (const s of [-1, 1]) {
    kotakM(g, 0.04, 0.3, 2.3, 0x4a5236, s * (W / 2 - 0.01), 2.0, -0.6, { roughness: 1 });       // tepi kanvas samping (sisi terbuka: interior terlihat)
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
