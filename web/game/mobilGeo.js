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
