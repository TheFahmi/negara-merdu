/* Negara Merdu — modul game "plazaPagar": PAGAR KELILING PLAZA, JALUR BUS
   PLAZA (busway merah) & GERBANG BUS OTOMATIS (permintaan Diah 23 Nov 2026).

   Koordinat di sini LOKAL grup `pusat` (istana.js, berpusat di PUSAT_X/Z):
   plaza x ±130, z ±65. Istana di utara (z < -5), pita tengah warga di
   z -5..45, jalur bus di selatan:
     - busway as z 54, lebar 14 (z 47..61), dua lajur kiri:
       ke barat di lajur selatan (z 57,5), ke timur di lajur utara (z 50,5)
     - menembus pagar barat & timur lewat GERBANG BUS OTOMATIS (2 palang
       per gerbang, satu per lajur) yang terangkat sendiri saat bus datang
       dan turun lagi setelah bus lewat; lampu gerbang merah/hijau
     - di luar plaza busway turun lewat ramp ke jalan kol 38 (barat) & kol 42
       (timur) — lihat RUTE_PLAZA di transportasi.js
   Pagar: besi hitam berlis emas di atas pondasi bata, pilar bata berkepala
   krem; bukaan pejalan kaki di setiap as jalan yang menembus plaza
   (utara/selatan: x -84, 0, 84; barat/timur: z 0) — bukaan tengah selatan
   bergapura "PLAZA NEGARA MERDU". */
import { M, kotak } from "./bersama.js";
import { JALAN as JALAN_LEBAR, PLAZA_D, PLAZA_TAPAK, PLAZA_W, PUSAT_X, PUSAT_Z } from "./inti.js";

export const BUSWAY_Z = 54;                       // as busway (lokal plaza)
export const BUSWAY_Z_DUNIA = PUSAT_Z + BUSWAY_Z; // 61
const HW = PLAZA_W / 2, HD = PLAZA_D / 2, BW = 7; // setengah lebar busway
/* Jalan masuk plaza DIKURANGI (Diah 24 Nov): dari 8 ujung jalan tinggal 3 —
   selatan-tengah (sumbu istana), barat & timur (as z 0). 5 ruas pendek lain
   (3 dari utara, 2 dari selatan kiri-kanan) ditutup jadi taman rumput. */
const BUKA_UTARA = [], BUKA_SELATAN = [[-7, 7]];
/* ruas jalan yang ditutup: x0 dunia ruas (kol 39/40/41) + z dunia [jalan, plaza] */
const RUAS_TUTUP = [
  { x0: -84, z: [-70, -58] }, { x0: 0, z: [-70, -58] }, { x0: 84, z: [-70, -58] },  // utara (jalan bar 24 -> plaza)
  { x0: -84, z: [72, 84] }, { x0: 84, z: [72, 84] },                                // selatan kiri-kanan (plaza -> jalan bar 26)
];
/* persimpangan T di mulut ruas yang ditutup: kini jalan lurus tanpa lampu & zebra */
export const PERSIMPANGAN_DITUTUP = new Set(["39,24", "40,24", "41,24", "39,26", "41,26"]);
const BUKA_BT = [[-7, 7]];                        // bukaan pejalan pagar barat & timur (z)

/* gerbang bus: { x (lokal), palang: [{pivot, arah}], lampu, buka 0..1 } */
const GERBANG = [];
let matMerah = null, matHijau = null;

function teksturBusway() {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 128; const c = cv.getContext("2d");
  c.fillStyle = "#8a3a30"; c.fillRect(0, 0, 256, 128); // aspal merah busway
  for (let i = 0; i < 500; i++) { c.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)"; c.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); }
  c.fillStyle = "#f4f1e6"; c.fillRect(0, 3, 256, 3); c.fillRect(0, 122, 256, 3); // garis tepi
  c.fillStyle = "#f2c230"; c.fillRect(0, 62, 150, 4);                             // garis tengah putus kuning
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function teksturPapan(baris1, baris2, latar, warna) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 128; const c = cv.getContext("2d");
  c.fillStyle = latar; c.fillRect(0, 0, 512, 128);
  c.strokeStyle = "#f2c230"; c.lineWidth = 6; c.strokeRect(6, 6, 500, 116);
  c.fillStyle = warna; c.textAlign = "center"; let uk = 46; c.font = `bold ${uk}px sans-serif`;
  while (c.measureText(baris1).width > 470 && uk > 20) { uk -= 2; c.font = `bold ${uk}px sans-serif`; } // muat di papan
  c.fillText(baris1, 256, 62);
  c.font = "bold 26px sans-serif"; c.fillStyle = "#f2c230"; c.fillText(baris2, 256, 104);
  return new THREE.CanvasTexture(cv);
}
function teksturPalang() { // belang merah-putih
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 8; const c = cv.getContext("2d");
  for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#f4f4f2" : "#d62828"; c.fillRect(i * 16, 0, 16, 8); }
  return new THREE.CanvasTexture(cv);
}

/* Ruas-ruas pagar di antara bukaan, sepanjang satu sisi [a,b]. */
function ruas(a, b, bukaan) {
  const hasil = []; let mulai = a;
  for (const [p, q] of bukaan) { if (p > mulai) hasil.push([mulai, p]); mulai = q; }
  if (b > mulai) hasil.push([mulai, b]);
  return hasil;
}

export function bangunPagarPlaza(pusat, rintanganPusat) {
  const g = new THREE.Group(); pusat.add(g);
  const Y0 = 0.32; // puncak slab plaza
  /* ---------- busway di dalam plaza ---------- */
  const tex = teksturBusway(); tex.repeat.set(PLAZA_W / 24, 1);
  const jalan = new THREE.Mesh(new THREE.BoxGeometry(PLAZA_W, 0.04, BW * 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  jalan.position.set(0, Y0 + 0.02, BUSWAY_Z); jalan.receiveShadow = true; g.add(jalan);
  for (const s of [-1, 1]) for (const [x0, x1] of [[-HW, -4.5], [4.5, HW]]) { // kerb (terputus di penyeberangan tengah)
    const k = kotak(x1 - x0, 0.18, 0.35, 0xd8d2c4, (x0 + x1) / 2, Y0 + 0.09, BUSWAY_Z + s * (BW + 0.17)); k.castShadow = false; g.add(k);
  }
  for (const xc of [0]) for (let i = 0; i < 6; i++) g.add(kotak(1.2, 0.03, BW * 2 - 1, 0xf4f1e6, xc - 3.5 + i * 1.4, Y0 + 0.05, BUSWAY_Z)); // zebra cross segaris jalan masuk selatan
  /* ---------- busway di luar plaza + ramp ---------- */
  const matAspal = new THREE.MeshStandardMaterial({ map: tex.clone(), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  matAspal.map.repeat.set(1, 1); matAspal.map.needsUpdate = true;
  const xJalanB = -161 - PUSAT_X + 7, xJalanT = 175 - PUSAT_X - 7; // tepi jalan kol 38 (barat) & kol 42 (timur), lokal
  for (const [x0, x1] of [[xJalanB, -HW - 8], [HW + 8, xJalanT]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, BW * 2), matAspal); p.rotation.x = -Math.PI / 2;
    p.position.set((x0 + x1) / 2, 0.05, BUSWAY_Z); p.receiveShadow = true; g.add(p);
  }
  for (const s of [-1, 1]) { // ramp 8 m: naik 0 -> 0,34 ke slab plaza
    const r = new THREE.Mesh(new THREE.BoxGeometry(8.05, 0.06, BW * 2), new THREE.MeshStandardMaterial({ color: 0x8a3a30, roughness: 0.9 }));
    r.position.set(s * (HW + 4), Y0 / 2 + 0.02, BUSWAY_Z); r.rotation.z = -s * Math.atan2(Y0, 8); r.receiveShadow = true; g.add(r);
  }
  /* ---------- pagar keliling ---------- */
  const matBesi = M(0x23272b, 0.5), matEmas = new THREE.MeshStandardMaterial({ color: 0xd4a73a, metalness: 0.6, roughness: 0.35 });
  const matBata = M(0xa2523c, 0.9), matKrem = M(0xfdf3d8, 0.8);
  const jeruji = [], pilar = [];
  const sisi = [ // [arah, posisi tetap, bukaan]
    ["x", -HD, BUKA_UTARA], ["x", HD, BUKA_SELATAN],
    ["z", -HW, BUKA_BT.concat([[BUSWAY_Z - BW - 0.5, BUSWAY_Z + BW + 0.5]])],
    ["z", HW, BUKA_BT.concat([[BUSWAY_Z - BW - 0.5, BUSWAY_Z + BW + 0.5]])],
  ];
  for (const [arah, tetap, bukaan] of sisi) {
    const panjang = arah === "x" ? HW : HD;
    for (const [a, b] of ruas(-panjang, panjang, bukaan)) {
      const L = b - a, m = (a + b) / 2;
      const kot = (l, t, d, mat, u, y) => { const k = new THREE.Mesh(new THREE.BoxGeometry(arah === "x" ? l : d, t, arah === "x" ? d : l), mat);
        k.position.set(arah === "x" ? u : tetap, y, arah === "x" ? tetap : u); k.castShadow = true; k.receiveShadow = true; g.add(k); };
      kot(L, 0.5, 0.5, matBata, m, Y0 + 0.25);   // pondasi bata
      kot(L, 0.08, 0.1, matEmas, m, Y0 + 1.75);  // rel atas emas
      kot(L, 0.06, 0.08, matBesi, m, Y0 + 0.75); // rel bawah
      for (let u = a + 0.6; u < b - 0.3; u += 0.6) jeruji.push(arah === "x" ? [u, tetap] : [tetap, u]);
      const nPilar = Math.max(1, Math.round(L / 18));
      for (let i = 0; i <= nPilar; i++) { const u = a + (L * i) / nPilar; pilar.push(arah === "x" ? [u, tetap] : [tetap, u]); }
      rintanganPusat(arah === "x" ? { minX: a, maxX: b, minZ: tetap - 0.35, maxZ: tetap + 0.35 } : { minX: tetap - 0.35, maxX: tetap + 0.35, minZ: a, maxZ: b });
    }
  }
  const geoJeruji = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 5);
  const imJ = new THREE.InstancedMesh(geoJeruji, matBesi, jeruji.length), d = new THREE.Object3D();
  jeruji.forEach(([x, z], i) => { d.position.set(x, Y0 + 1.15, z); d.updateMatrix(); imJ.setMatrixAt(i, d.matrix); });
  imJ.castShadow = true; g.add(imJ);
  const geoUjung = new THREE.ConeGeometry(0.07, 0.22, 4);
  const imU = new THREE.InstancedMesh(geoUjung, matEmas, jeruji.length);
  jeruji.forEach(([x, z], i) => { d.position.set(x, Y0 + 1.9, z); d.updateMatrix(); imU.setMatrixAt(i, d.matrix); });
  g.add(imU);
  const imP = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 2.3, 0.9), matBata, pilar.length);
  const imK = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 0.3, 1.15), matKrem, pilar.length);
  const imB = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8), matEmas, pilar.length);
  pilar.forEach(([x, z], i) => {
    d.position.set(x, Y0 + 1.15, z); d.updateMatrix(); imP.setMatrixAt(i, d.matrix);
    d.position.y = Y0 + 2.45; d.updateMatrix(); imK.setMatrixAt(i, d.matrix);
    d.position.y = Y0 + 2.82; d.updateMatrix(); imB.setMatrixAt(i, d.matrix);
  });
  imP.castShadow = imK.castShadow = true; g.add(imP); g.add(imK); g.add(imB);
  /* ---------- gapura di SETIAP jalan kota yang masuk plaza ----------
     8 jalan berujung di tepi plaza: 3 dari utara, 3 dari selatan (as x
     -84, 0, 84) dan 1 dari barat & timur (as z 0). Tiap ujung jalan diberi
     gapura bata berpapan nama; gapura selatan-tengah (sumbu istana) paling
     besar. (Kini tinggal 3 jalan masuk — lihat BUKA_SELATAN/BUKA_BT.) */
  const papanUtama = teksturPapan("PLAZA NEGARA MERDU", "Selamat Datang", "#7a1f1f", "#fdf3d8");
  const papanKecil = teksturPapan("PLAZA NEGARA MERDU", "Kawasan Pejalan Kaki", "#7a1f1f", "#fdf3d8");
  const gapura = (cx, cz, sumbuX, utama) => { // sumbuX: bukaan membentang di sumbu x (pagar utara/selatan)
    const T = utama ? 6.5 : 5.2, gg = new THREE.Group(); gg.position.set(cx, Y0, cz); if (!sumbuX) gg.rotation.y = Math.PI / 2; g.add(gg);
    for (const s of [-1, 1]) {
      gg.add(kotak(1.6, T, 1.6, 0xa2523c, s * 7.8, T / 2, 0)); gg.add(kotak(2, 0.4, 2, 0xfdf3d8, s * 7.8, T + 0.2, 0));
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), matEmas); bl.position.set(s * 7.8, T + 0.75, 0); gg.add(bl);
      const lx = sumbuX ? cx + s * 7.8 : cx, lz = sumbuX ? cz : cz + s * 7.8;
      rintanganPusat({ minX: lx - 0.8, maxX: lx + 0.8, minZ: lz - 0.8, maxZ: lz + 0.8 });
    }
    gg.add(kotak(17.6, utama ? 1.3 : 1.0, 0.8, 0xfdf3d8, 0, T + 0.9, 0));
    for (const s of [-1, 1]) {
      const papan = new THREE.Mesh(new THREE.PlaneGeometry(utama ? 14 : 11, utama ? 1.1 : 0.85), new THREE.MeshBasicMaterial({ map: utama ? papanUtama : papanKecil }));
      papan.position.set(0, T + 0.9, s * 0.42); if (s < 0) papan.rotation.y = Math.PI; gg.add(papan);
    }
  };
  for (const [a, b] of BUKA_SELATAN) gapura((a + b) / 2, HD, true, true);
  /* ruas tertutup: trotoar menyambung di mulut ruas + rumput & pagar tanaman sampai tepi plaza */
  const matRumput = new THREE.MeshStandardMaterial({ color: 0x6aa652, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const matTrotoar = new THREE.MeshStandardMaterial({ color: 0xd9d3c4, roughness: 1, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const bidang = (mat, x0, x1, z0, z1, y) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); p.rotation.x = -Math.PI / 2;
    p.position.set((x0 + x1) / 2 - PUSAT_X, y, (z0 + z1) / 2 - PUSAT_Z); p.receiveShadow = true; g.add(p); };
  for (const r of RUAS_TUTUP) {
    const xa = r.x0 - 2.6, xb = r.x0 + JALAN_LEBAR + 2.6, utara = r.z[0] < 0;
    const zJalan = utara ? r.z[0] : r.z[1], zTro = utara ? zJalan + 2.6 : zJalan - 2.6;
    bidang(matTrotoar, xa, xb, Math.min(zJalan, zTro), Math.max(zJalan, zTro), 0.07);
    bidang(matRumput, xa, xb, utara ? zTro : r.z[0], utara ? r.z[1] : zTro, 0.06);
    const zm = (utara ? zTro + r.z[1] : r.z[0] + zTro) / 2 - PUSAT_Z;
    for (const dx of [-5, 0, 5]) { const semak = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), M(0x4f9a42)); semak.scale.y = 0.8; semak.position.set(r.x0 + 7 + dx - PUSAT_X, 0.9, zm); semak.castShadow = true; g.add(semak); }
    for (const dx of [-8, 22]) { const pk = new THREE.Group(); pk.add(kotak(0.4, 2.6, 0.4, 0x8a5a30, 0, 1.3, 0)); const dn = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), M(0x5aa64a)); dn.position.y = 3.9; dn.castShadow = true; pk.add(dn); pk.position.set(r.x0 + dx * 0.5 + 2 - PUSAT_X, 0, zm); g.add(pk); }
  }
  for (const xSisi of [-HW, HW]) for (const [a, b] of BUKA_BT) gapura(xSisi, (a + b) / 2, false, false);
  /* ---------- gerbang bus otomatis (barat & timur) ---------- */
  matMerah = new THREE.MeshStandardMaterial({ color: 0x3a0a0a, emissive: 0xff2a2a, emissiveIntensity: 1 });
  matHijau = new THREE.MeshStandardMaterial({ color: 0x0a3a14, emissive: 0x2aff5a, emissiveIntensity: 1 });
  const texPalang = teksturPalang();
  const papanGerbang = teksturPapan("GERBANG BUS OTOMATIS", "Khusus Trans Merdu", "#1d5a8f", "#ffffff");
  for (const sx of [-1, 1]) {
    const x = sx * HW, gg = new THREE.Group(); gg.position.set(x, Y0, 0); g.add(gg);
    // portal di atas busway
    for (const s of [-1, 1]) { gg.add(kotak(0.6, 6.4, 0.6, 0x7b8086, 0, 3.2, BUSWAY_Z + s * (BW + 0.9))); rintanganPusat({ minX: x - 0.5, maxX: x + 0.5, minZ: BUSWAY_Z + s * (BW + 0.9) - 0.5, maxZ: BUSWAY_Z + s * (BW + 0.9) + 0.5 }); }
    gg.add(kotak(0.7, 0.9, BW * 2 + 2.4, 0x7b8086, 0, 6.2, BUSWAY_Z));
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(BW * 2 - 1, 0.85), new THREE.MeshBasicMaterial({ map: papanGerbang }));
      p.rotation.y = s * Math.PI / 2; p.position.set(s * 0.37, 6.2, BUSWAY_Z); gg.add(p);
    }
    // pos palang di as busway (median) + 2 palang: lajur utara mengarah -z, lajur selatan +z
    gg.add(kotak(0.9, 1.3, 0.9, 0xf2c230, 0, 0.65, BUSWAY_Z));
    const palang = [];
    for (const arah of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, 1.1, BUSWAY_Z + arah * 0.45); gg.add(pivot);
      const lengan = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, BW - 0.8), new THREE.MeshStandardMaterial({ map: texPalang, roughness: 0.6 }));
      lengan.position.z = arah * (BW - 0.8) / 2; lengan.castShadow = true; pivot.add(lengan);
      const pl = { pivot, arah, buka: 0, lampu: [] }; palang.push(pl);
      for (const s of [-1, 1]) { // lampu di pos, milik palang lajur ini
        const l = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), matMerah);
        l.rotation.y = s * Math.PI / 2; l.position.set(s * 0.46, 1.05, BUSWAY_Z + arah * 0.22); gg.add(l); pl.lampu.push(l);
      }
    }
    // lampu lalu lintas mini di portal (atas, dua arah)
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.28, 14), matMerah);
      // lampu menghadap +x (s=1) dilihat bus dari timur = lajur selatan (arah +1); s=-1 -> lajur utara
      l.rotation.y = s * Math.PI / 2; l.position.set(s * 0.37, 5.45, BUSWAY_Z + s * 2.2); gg.add(l); palang.find((p) => p.arah === s).lampu.push(l);
    }
    GERBANG.push({ x: x + PUSAT_X, palang });
  }
  return g;
}

/* Tiap PALANG (satu per lajur) membuka sendiri: hanya bila ada bus di
   lajurnya (utara z<as = arah -1, selatan = +1) dalam 32 m dari portal.
   Bus masuk -> palang lajur masuk saja; bus keluar -> palang lajur keluar
   saja (dulu kedua palang terangkat bersamaan). */
export function perbaruiGerbangBus(dt, daftarBus) {
  for (const gt of GERBANG) for (const pl of gt.palang) {
    let dekat = false;
    for (const p of daftarBus) {
      const dz = p.z - BUSWAY_Z_DUNIA;
      if (Math.abs(dz) < 10 && Math.sign(dz || 1) === pl.arah && Math.abs(p.x - gt.x) < 32) { dekat = true; break; }
    }
    pl.buka = Math.max(0, Math.min(1, pl.buka + (dekat ? 1 : -1) * dt / 1.6));
    pl.pivot.rotation.x = -pl.arah * (pl.buka * pl.buka * (3 - 2 * pl.buka)) * 1.45;
    const m = pl.buka > 0.95 ? matHijau : matMerah;
    for (const l of pl.lampu) if (l.material !== m) l.material = m;
  }
}
/* Tinggi lantai bus: 0,34 di atas slab plaza, landai 8 m di luar tepi plaza. */
export function tinggiBus(x, z) {
  if (Math.abs(z - BUSWAY_Z_DUNIA) > 9) return 0.02;
  const dalam = Math.min(x - PLAZA_TAPAK.minX, PLAZA_TAPAK.maxX - x);
  return 0.02 + Math.max(0, Math.min(1, (dalam + 8) / 8)) * 0.32;
}
