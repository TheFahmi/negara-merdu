/* Negara Merdu — modul game "mallDalam": INTERIOR MERDU MALL.
   Atrium megah 2 lantai (pola interior INT seperti istana): lantai marmer
   mengilap, deret toko berkaca di 3 sisi lengkap dengan papan nama &
   etalase menyala, lantai 2 berupa galeri keliling berpagar kaca dengan
   toko atas, sepasang ESKALATOR yang anak tangganya benar-benar bergerak,
   air mancur & pohon di tengah atrium, langit-langit kaca bercahaya,
   layar LED gantung, food court, pintu bioskop, kios, bangku, pengunjung.
   Nama toko fiktif (bukan merek nyata). */
import { M, kotak } from "./bersama.js";
import { buatKarakter } from "./karakter.js";

export const UKURAN_MALL_DALAM = { sw: 24, sd: 16, tinggi: 14 };
const ESKALATOR = []; // {mesh: InstancedMesh, n, panjang, naik, x0, z0, dz, h}

function kanvas(w, h, f) { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; f(cv.getContext("2d"), w, h); return new THREE.CanvasTexture(cv); }
function teksturMarmer() {
  const t = kanvas(256, 256, (c) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { c.fillStyle = (x + y) % 2 ? "#ece6da" : "#f9f6ef"; c.fillRect(x * 128, y * 128, 128, 128); }
    c.strokeStyle = "rgba(140,120,90,.16)"; c.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) { c.beginPath(); let px = (i * 61) % 256, py = (i * 37) % 256; c.moveTo(px, py); for (let k = 0; k < 4; k++) { px += 22; py += (k % 2 ? 12 : -10); c.lineTo(px, py); } c.stroke(); }
    c.fillStyle = "rgba(160,140,110,.3)"; c.fillRect(0, 127, 256, 2); c.fillRect(127, 0, 2, 256);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 8); t.anisotropy = 4; return t;
}
function teksturPapanToko(nama, warna) {
  return kanvas(512, 128, (c, W, H) => {
    c.fillStyle = warna; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(255,255,255,.12)"; c.fillRect(0, 0, W, 10);
    c.fillStyle = "#fff"; c.font = "800 56px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(nama, W / 2, H / 2 + 4, W - 30);
  });
}
const TOKO = [
  ["MERDU MART", "#2e9e5b"], ["BATIK SEKAR", "#8a4b2f"], ["KOPI SENJA", "#5a3a20"], ["ELEKTRONIK JAYA", "#1d5a8f"],
  ["SEPATU LANGKAH", "#d9462e"], ["MAINAN CERIA", "#e8943a"], ["OPTIK TERANG", "#2f3b45"], ["APOTEK SEHAT", "#2e8b57"],
  ["ROTI HANGAT", "#b5533c"], ["ARUNIKA FASHION", "#7b2ff7"], ["TOKO BUKU PENA", "#3f6fb5"], ["GAWAI KITA", "#e14b6f"],
];

export function bangunInteriorMall(halang) {
  const { sw, sd, tinggi: T } = UKURAN_MALL_DALAM;
  const g = new THREE.Group(); ESKALATOR.length = 0;
  const K = (l, t, d, w, x, y, z) => { const m = kotak(l, t, d, w, x, y, z); m.castShadow = false; g.add(m); return m; };
  const KREM = 0xf1ece2, EMAS = 0xd9a441, KACA = 0xbfe2ee;
  // lantai marmer + plafon + dinding (selatan berpintu kaca 3,2)
  const lantai = new THREE.Mesh(new THREE.BoxGeometry(sw * 2 + 0.8, 0.3, sd * 2 + 0.8), new THREE.MeshStandardMaterial({ map: teksturMarmer(), roughness: 0.18, metalness: 0.05 }));
  lantai.position.y = -0.15; g.add(lantai);
  K(sw * 2 + 0.8, 0.3, sd * 2 + 0.8, 0xf6f2ea, 0, T + 0.15, 0);
  K(sw * 2 + 0.8, T, 0.4, KREM, 0, T / 2, -sd - 0.2);
  K(0.4, T, sd * 2 + 0.8, KREM, -sw - 0.2, T / 2, 0); K(0.4, T, sd * 2 + 0.8, KREM, sw + 0.2, T / 2, 0);
  const s2 = sw - 1.6;
  K(s2, T, 0.4, KREM, -(1.6 + s2 / 2), T / 2, sd + 0.2); K(s2, T, 0.4, KREM, 1.6 + s2 / 2, T / 2, sd + 0.2); K(3.2, T - 4, 0.4, KREM, 0, (4 + T) / 2, sd + 0.2);
  K(6, 4, 0.1, KACA, -4.6, 2, sd - 0.05); K(6, 4, 0.1, KACA, 4.6, 2, sd - 0.05); // dinding kaca pintu masuk
  // langit-langit kaca (skylight) bercahaya di tengah
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(22, 14), new THREE.MeshStandardMaterial({ color: 0xdff1fa, emissive: 0xeaf6ff, emissiveIntensity: 0.9 }));
  sky.rotation.x = Math.PI / 2; sky.position.set(0, T - 0.02, 0); g.add(sky);
  for (let i = -5; i <= 5; i++) K(0.15, 0.3, 14, 0xb8bcc2, i * 2, T - 0.2, 0);
  // ---- deret toko lantai dasar (utara: bioskop di tengah; barat & timur) ----
  let iToko = 0;
  const toko = (x, z, ry, lebar, y0) => {
    const t = new THREE.Group(); const [nama, warna] = TOKO[iToko++ % TOKO.length];
    const k = (l, tt, d, w, px, py, pz) => { const m = kotak(l, tt, d, w, px, py, pz); m.castShadow = false; t.add(m); };
    k(lebar, 4.2, 3.4, 0xfbfaf5, 0, 2.1, -1.7);             // ruang toko (dinding belakang terang)
    k(lebar - 0.2, 0.06, 3.2, 0xe8e2d4, 0, 0.03, -1.6);
    const kaca = new THREE.Mesh(new THREE.BoxGeometry(lebar - 0.6, 3.2, 0.08), new THREE.MeshStandardMaterial({ color: KACA, transparent: true, opacity: 0.35, roughness: 0.05 }));
    kaca.position.set(0, 1.6, 0.02); t.add(kaca);
    const papan = new THREE.Mesh(new THREE.BoxGeometry(lebar, 0.9, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanToko(nama, warna), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0.05 }));
    papan.position.set(0, 3.75, 0.1); t.add(papan);
    for (let i = 0; i < 3; i++) { // etalase: rak + barang warna-warni + manekin
      k(1.2, 0.9, 0.6, 0xd8d2c6, -lebar / 2 + 1.2 + i * (lebar - 2.4) / 2, 0.45, -2.6);
      for (let b = 0; b < 3; b++) k(0.3, 0.35, 0.3, [0xe14b2f, 0xf2c230, 0x3f6fb5, 0x2e9e5b][(i + b + iToko) % 4], -lebar / 2 + 0.9 + i * (lebar - 2.4) / 2 + b * 0.32, 1.08, -2.6);
    }
    const lampu = new THREE.Mesh(new THREE.PlaneGeometry(lebar - 1, 2.4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e4, emissiveIntensity: 0.8 }));
    lampu.rotation.x = Math.PI / 2; lampu.position.set(0, 4.15, -1.7); t.add(lampu);
    t.position.set(x, y0 || 0, z); t.rotation.y = ry; g.add(t);
  };
  for (const x of [-18, -11, 11, 18]) toko(x, -sd + 3.4, 0, 6.4);                        // utara
  for (const z of [-8, -1, 6]) { toko(-sw + 3.4, z, Math.PI / 2, 6.4); toko(sw - 3.4, z, -Math.PI / 2, 6.4); } // barat & timur
  halang(-21.4, -7.6, -sd, -sd + 3.6); halang(7.6, 21.4, -sd, -sd + 3.6);
  halang(-sw, -sw + 3.6, -11.4, 9.4); halang(sw - 3.6, sw, -11.4, 9.4);
  // bioskop di tengah utara
  K(14, 7, 3.4, 0x1b1f22, 0, 3.5, -sd + 1.7);
  const bio = new THREE.Mesh(new THREE.BoxGeometry(12, 1.4, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanToko("BIOSKOP MERDU", "#7a1f1f"), emissive: 0xffffff, emissiveIntensity: 0.25 }));
  bio.position.set(0, 6.2, -sd + 3.5); g.add(bio);
  for (const x of [-4.5, 4.5]) { // poster film
    const pst = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), new THREE.MeshStandardMaterial({ map: teksturPapanToko(x < 0 ? "SEGERA" : "TAYANG", x < 0 ? "#2f3b45" : "#8a4b2f"), emissive: 0xffffff, emissiveIntensity: 0.2 }));
    pst.position.set(x, 2.6, -sd + 3.45); g.add(pst);
  }
  K(4, 3.2, 0.1, 0x3a0d0d, 0, 1.6, -sd + 3.45);
  halang(-7, 7, -sd, -sd + 3.6);
  // ---- lantai 2: galeri keliling (pelat + pagar kaca + toko atas) ----
  const Y2 = 6.8;
  K(sw * 2, 0.4, 5, 0xe9e3d6, 0, Y2, -sd + 2.5);               // galeri utara
  K(5, 0.4, sd * 2 - 5, 0xe9e3d6, -sw + 2.5, Y2, 2.5); K(5, 0.4, sd * 2 - 5, 0xe9e3d6, sw - 2.5, Y2, 2.5);
  const matKacaPagar = new THREE.MeshStandardMaterial({ color: 0xdff1fa, transparent: true, opacity: 0.35, roughness: 0.05 });
  for (const [l, d, x, z] of [[sw * 2 - 10, 0.08, 0, -sd + 5], [0.08, sd * 2 - 5, -sw + 5, 2.5], [0.08, sd * 2 - 5, sw - 5, 2.5]]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(l, 1.1, d), matKacaPagar); p.position.set(x, Y2 + 0.75, z); g.add(p);
    K(l === 0.08 ? 0.12 : l, 0.08, d === 0.08 ? 0.12 : d, EMAS, x, Y2 + 1.32, z);
  }
  for (const x of [-18, -11, 11, 18]) toko(x, -sd + 3.4, 0, 6.4, Y2 + 0.2);
  for (const z of [-4, 4]) { toko(-sw + 3.4, z, Math.PI / 2, 6.4, Y2 + 0.2); toko(sw - 3.4, z, -Math.PI / 2, 6.4, Y2 + 0.2); }
  for (const [x, z] of [[-sw + 5, -sd + 5], [sw - 5, -sd + 5], [-sw + 5, 9], [sw - 5, 9]]) { // pilar
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, T, 18), M(0xfbfaf5, 0.4)); p.position.set(x, T / 2, z); g.add(p);
    halang(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  }
  // ---- eskalator (sepasang, anak tangga bergerak) ----
  const eskalator = (x, naik) => {
    const panjang = 12, h = Y2 + 0.2, z0 = 8, z1 = z0 - panjang; // naik ke utara
    const kemiringan = Math.atan2(h, panjang);
    const badan = K(1.6, 0.3, Math.hypot(panjang, h), 0x8a8f94, x, h / 2 - 0.25, (z0 + z1) / 2); badan.rotation.x = kemiringan;
    for (const s of [-1, 1]) {
      const sisi = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, Math.hypot(panjang, h)), matKacaPagar); sisi.position.set(x + s * 0.8, h / 2 + 0.55, (z0 + z1) / 2); sisi.rotation.x = kemiringan; g.add(sisi);
      const pg = K(0.14, 0.1, Math.hypot(panjang, h), 0x1b1f22, x + s * 0.8, h / 2 + 1.1, (z0 + z1) / 2); pg.rotation.x = kemiringan; // pegangan karet
    }
    const n = 28, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.12, 0.42), new THREE.MeshStandardMaterial({ color: 0x5c6066, metalness: 0.5, roughness: 0.4 }), n);
    im.frustumCulled = false; g.add(im);
    ESKALATOR.push({ im, n, panjang, h, x, z0, naik, fase: 0 });
    halang(x - 1, x + 1, z1 - 0.5, z0 + 0.5);
    const tanda = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.4), new THREE.MeshBasicMaterial({ map: teksturPapanToko(naik ? "▲ NAIK" : "▼ TURUN", naik ? "#2e9e5b" : "#d9462e") }));
    tanda.position.set(x, 2.4, z0 + 0.6); g.add(tanda);
  };
  eskalator(-9, true); eskalator(-6.6, false);
  // ---- tengah atrium: air mancur, pohon, layar LED gantung, kios, bangku ----
  const bak = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.7, 32), M(0xe9e3d6)); bak.position.set(6, 0.35, 0); g.add(bak);
  const air = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x3fa8cf, roughness: 0.05 })); air.position.set(6, 0.68, 0); g.add(air);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const j = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xe6f7fc, transparent: true, opacity: 0.55 })); j.position.set(6 + Math.cos(a) * 1.6, 1.6, Math.sin(a) * 1.6); g.add(j); }
  const tiangAir = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.6, 12), M(0xd9a441, 0.3)); tiangAir.position.set(6, 1.6, 0); g.add(tiangAir);
  halang(2.4, 9.6, -3.6, 3.6);
  for (const [x, z] of [[0, -5], [12, -5], [0, 5], [12, 5]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1, 16), M(0x2f3b45)); pot.position.set(x, 0.5, z); g.add(pot);
    const btg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.4, 8), M(0x7a5030)); btg.position.set(x, 2.6, z); g.add(btg);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const d = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 6), M(0x3f8f4f)); d.position.set(x + Math.cos(a) * 0.9, 4.2, z + Math.sin(a) * 0.9); d.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); g.add(d); } // daun palem
    halang(x - 0.9, x + 0.9, z - 0.9, z + 0.9);
  }
  K(0.2, 3.2, 5.6, 0x1b1f22, 6, 10.5, 0); // layar LED gantung (2 muka)
  for (const s of [-1, 1]) {
    const led = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.8), new THREE.MeshStandardMaterial({ map: teksturPapanToko("PROMO AKHIR PEKAN", "#d9462e"), emissive: 0xffffff, emissiveIntensity: 0.55 }));
    led.rotation.y = s * Math.PI / 2; led.position.set(6 + s * 0.12, 10.5, 0); g.add(led);
  }
  for (const s of [-1, 1]) K(0.04, 3.5, 0.04, 0x8a8f94, 6, 12.6, s * 2.4);
  for (const [x, z, w] of [[-14, 0, 0xe86a5e], [17, -12, 0xf2c230]]) { // kios gerobak
    K(2.4, 1.0, 1.4, w, x, 0.5, z); K(2.8, 0.1, 1.8, 0xfbfaf5, x, 2.4, z);
    for (const s of [-1, 1]) K(0.08, 1.4, 0.08, 0x8a8f94, x + s * 1.2, 1.7, z);
    halang(x - 1.3, x + 1.3, z - 0.8, z + 0.8);
  }
  // food court (barat daya): meja bundar + kursi + payung
  for (let i = 0; i < 6; i++) {
    const x = -18 + (i % 3) * 4.2, z = 10 + Math.floor(i / 3) * 3.6;
    const meja = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 18), M(0xfbfaf5)); meja.position.set(x, 1.0, z); g.add(meja);
    const kaki = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), M(0x8a8f94)); kaki.position.set(x, 0.5, z); g.add(kaki);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) K(0.5, 0.5, 0.5, [0xe86a5e, 0x57b7d6][i % 2], x + Math.cos(a) * 1.15, 0.25, z + Math.sin(a) * 1.15);
    halang(x - 1, x + 1, z - 1, z + 1);
  }
  const fc = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 0.2), new THREE.MeshStandardMaterial({ map: teksturPapanToko("FOOD COURT", "#e8943a"), emissive: 0xffffff, emissiveIntensity: 0.2 }));
  fc.position.set(-14, 4.2, 8.2); g.add(fc);
  for (const z of [-3, 3]) { K(2.6, 0.12, 0.7, 0xa9743f, 18, 0.5, z); K(2.6, 0.6, 0.12, 0xa9743f, 18, 0.85, z - 0.32); halang(16.6, 19.4, z - 0.5, z + 0.5); } // bangku
  K(3, 1.1, 1.2, 0x2f3b45, 14, 0.55, 11); K(3.2, 0.08, 1.4, EMAS, 14, 1.14, 11); halang(12.4, 15.6, 10.3, 11.7); // meja informasi (di samping, jalur masuk lega)
  // pengunjung (diam, bergaya)
  const PENGUNJUNG = [["#e14b6f", -2, 6, 2.6], ["#3f6fb5", 14, 2, -1.2], ["#f2c230", -16, 12.2, 0.3], ["#2e9e5b", 9, 8, 3.4], ["#7b2ff7", -12, -6, 1.6]];
  for (const [baju, x, z, ry] of PENGUNJUNG) { const k = buatKarakter({ baju, kulit: "#c68642", topi: "tanpa" }); k.position.set(x, 0, z); k.rotation.y = ry; k.scale.setScalar(1.35); g.add(k); }
  // cahaya
  g.add(new THREE.HemisphereLight(0xffffff, 0xb8a888, 0.75));
  for (const [x, z] of [[-12, 0], [12, 0], [0, -8]]) { const l = new THREE.PointLight(0xfff1dc, 0.7, 50, 2); l.position.set(x, T - 2, z); g.add(l); }
  return g;
}
/* Gerakkan anak tangga eskalator. */
export function perbaruiMall(dt) {
  for (const e of ESKALATOR) {
    e.fase = (e.fase + dt * 0.45 * (e.naik ? 1 : -1) + 1) % 1;
    const d = new THREE.Object3D(), L = Math.hypot(e.panjang, e.h);
    for (let i = 0; i < e.n; i++) {
      const f = ((i / e.n) + e.fase) % 1;
      d.position.set(e.x, f * e.h + 0.05, e.z0 - f * e.panjang);
      d.rotation.set(0, 0, 0); d.updateMatrix(); e.im.setMatrixAt(i, d.matrix);
    }
    e.im.instanceMatrix.needsUpdate = true;
    void L;
  }
}
