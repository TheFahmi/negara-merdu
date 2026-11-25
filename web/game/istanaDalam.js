/* Negara Merdu — modul game "istanaDalam": INTERIOR ISTANA NEGARA.
   Aula kenegaraan yang bisa dimasuki dari pintu istana (puncak tangga
   portico) — pola sama dengan interior rumah (lokasi tersembunyi INT di
   bawah peta, sistem pintu/keluar/tabrakan yang sama), ukuran lebih besar:
   - lantai marmer catur, dinding krem berpilaster emas, lis & wainscot kayu
   - karpet merah dari pintu ke panggung kepresidenan (dais berundak)
   - meja & kursi Presiden, lambang + tulisan ISTANA NEGARA MERDU, 2 bendera
   - deret pilar kiri-kanan, 2 lampu gantung kristal (PointLight)
   - papan STRUKTUR PEMERINTAHAN (Presiden, Wali Kota, Camat, Lurah, Ketua
     RW/RT) — diisi dari /api/pemilu (pejabat aktif)
   - meja rapat kabinet + kursi di sayap timur, bangku tamu di sayap barat */
import { buatJam } from "./jam.js";
import { M, kotak } from "./bersama.js";
import { teksturBenderaMerdu } from "./fasilitas.js";
import { NAMA_KECAMATAN, NAMA_KELURAHAN } from "./inti.js";

export const UKURAN_ISTANA_DALAM = { sw: 15, sd: 12, tinggi: 8.5 };

function teksturMarmer() {
  const cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const c = cv.getContext("2d");
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    c.fillStyle = (x + y) % 2 ? "#e9e2d3" : "#f8f4ea";
    c.fillRect(x * 128, y * 128, 128, 128);
  }
  c.strokeStyle = "rgba(150,130,100,0.18)"; c.lineWidth = 1.5; // urat marmer halus
  for (let i = 0; i < 14; i++) {
    c.beginPath(); let px = (i * 53) % 256, py = (i * 97) % 256; c.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += 18 + ((i * k * 13) % 20); py += ((i + k) % 2 ? 1 : -1) * 14; c.lineTo(px, py); }
    c.stroke();
  }
  c.fillStyle = "rgba(120,100,70,0.35)"; c.fillRect(0, 127, 256, 2); c.fillRect(127, 0, 2, 256);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7.5, 6); t.anisotropy = 4;
  return t;
}
function kanvasTeks(w, h, gambar) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  gambar(cv.getContext("2d"), w, h);
  return new THREE.CanvasTexture(cv);
}
function teksturLambangIstana() {
  return kanvasTeks(1024, 512, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#14402c"); g.addColorStop(1, "#0d2d1f");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = "#d9a441"; c.lineWidth = 14; c.strokeRect(18, 18, W - 36, H - 36);
    c.save(); c.translate(W / 2 - 90, 50); c.scale(180 / 64, 180 / 64); // lambang rumah emas
    c.beginPath(); c.moveTo(32, 4); c.lineTo(60, 28); c.lineTo(52, 28); c.lineTo(52, 58); c.lineTo(38, 58);
    c.lineTo(38, 42); c.lineTo(26, 42); c.lineTo(26, 58); c.lineTo(12, 58); c.lineTo(12, 28); c.lineTo(4, 28); c.closePath();
    const eg = c.createLinearGradient(0, 0, 0, 64); eg.addColorStop(0, "#f6cd6b"); eg.addColorStop(1, "#dd9a26");
    c.fillStyle = eg; c.fill(); c.restore();
    c.fillStyle = "#f6dd9a"; c.textAlign = "center";
    c.font = "800 74px system-ui, sans-serif"; c.fillText("ISTANA NEGARA", W / 2, 330);
    c.font = "700 46px system-ui, sans-serif"; c.fillStyle = "#e9c46a";
    c.fillText("NEGARA MERDU", W / 2, 400);
    c.font = "500 26px system-ui, sans-serif"; c.fillStyle = "rgba(246,221,154,.8)";
    c.fillText("Merdeka · Rukun · Merdu", W / 2, 450);
  });
}
function teksturPotretPresiden() {
  return kanvasTeks(320, 420, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#d7c6a3"); g.addColorStop(1, "#a88a5c");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = "#6e4525"; c.beginPath(); c.ellipse(W / 2, H * 0.92, 120, 110, 0, Math.PI, 0); c.fill(); // bahu jas
    c.fillStyle = "#f1c27d"; c.beginPath(); c.ellipse(W / 2, H * 0.47, 70, 84, 0, 0, Math.PI * 2); c.fill(); // wajah
    c.fillStyle = "#1f1f22"; c.fillRect(W / 2 - 72, H * 0.22, 144, 46); // peci
    c.fillStyle = "#2a2320";
    c.beginPath(); c.arc(W / 2 - 26, H * 0.45, 7, 0, 7); c.arc(W / 2 + 26, H * 0.45, 7, 0, 7); c.fill();
    c.strokeStyle = "#7c4030"; c.lineWidth = 5; c.beginPath(); c.arc(W / 2, H * 0.52, 26, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = "#fff"; c.beginPath(); c.moveTo(W / 2 - 22, H * 0.78); c.lineTo(W / 2, H * 0.9); c.lineTo(W / 2 + 22, H * 0.78); c.fill();
    c.fillStyle = "rgba(20,40,30,.85)"; c.fillRect(0, H - 54, W, 54);
    c.fillStyle = "#f6dd9a"; c.textAlign = "center"; c.font = "700 26px system-ui, sans-serif";
    c.fillText("PAK PRESIDEN", W / 2, H - 18);
  });
}
const URUT = ["kades", "walikota", "camat", "lurah", "rw", "rt"];
function gambarStruktur(cv, pejabat) {
  const c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.fillStyle = "#fbf6ea"; c.fillRect(0, 0, W, H);
  c.fillStyle = "#14402c"; c.fillRect(0, 0, W, 120);
  c.fillStyle = "#f6dd9a"; c.textAlign = "center"; c.font = "800 52px system-ui, sans-serif";
  c.fillText("STRUKTUR PEMERINTAHAN", W / 2, 78);
  const cari = (jab, wil) => (pejabat || []).find((p) => p.jabatan === jab && (wil == null || p.wilayah === wil));
  const nama = (p) => (p ? "@" + p.username : "— belum terpilih —");
  const kotakJab = (x, y, w, h, judul, isi, warna) => {
    c.fillStyle = warna; c.fillRect(x, y, w, h);
    c.strokeStyle = "rgba(0,0,0,.12)"; c.lineWidth = 3; c.strokeRect(x, y, w, h);
    c.fillStyle = "#fff"; c.textAlign = "center";
    c.font = "700 30px system-ui, sans-serif"; c.fillText(judul, x + w / 2, y + 40, w - 20);
    c.font = "600 26px system-ui, sans-serif"; c.fillStyle = "rgba(255,255,255,.92)"; c.fillText(isi, x + w / 2, y + 76, w - 20);
  };
  const garis = (x1, y1, x2, y2) => { c.strokeStyle = "#8a7550"; c.lineWidth = 4; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
  // Presiden -> Wali Kota -> 2 Camat -> 10 Lurah -> RW/RT
  kotakJab(W / 2 - 220, 150, 440, 96, "PRESIDEN", nama(cari("kades")), "#7a1f1f");
  garis(W / 2, 246, W / 2, 280);
  kotakJab(W / 2 - 220, 280, 440, 96, "WALI KOTA MERDU", nama(cari("walikota")), "#1d5a8f");
  garis(W / 2, 376, W / 2, 400); garis(W * 0.27, 400, W * 0.73, 400);
  for (let k = 0; k < 2; k++) {
    const cx = k ? W * 0.73 : W * 0.27;
    garis(cx, 400, cx, 420);
    kotakJab(cx - 230, 420, 460, 96, "CAMAT " + NAMA_KECAMATAN[k].toUpperCase(), nama(cari("camat", k + 1)), "#2e7d46");
    garis(cx, 516, cx, 540);
    for (let i = 0; i < 5; i++) { // 5 kelurahan per kecamatan (kelurahan ganjil = Barat, genap = Timur)
      const kel = i * 2 + k + 1, y = 545 + i * 92;
      c.fillStyle = "#efe4c8"; c.fillRect(cx - 230, y, 460, 80);
      c.fillStyle = "#5b4a2a"; c.textAlign = "left"; c.font = "700 26px system-ui, sans-serif";
      c.fillText("Lurah " + NAMA_KELURAHAN[kel - 1], cx - 214, y + 34, 420);
      c.font = "500 24px system-ui, sans-serif"; c.fillStyle = "#3a3222";
      c.fillText(nama(cari("lurah", kel)), cx - 214, y + 66, 420);
    }
  }
  const nRW = (pejabat || []).filter((p) => p.jabatan === "rw").length, nRT = (pejabat || []).filter((p) => p.jabatan === "rt").length;
  c.fillStyle = "#14402c"; c.fillRect(0, H - 90, W, 90);
  c.fillStyle = "#f6dd9a"; c.textAlign = "center"; c.font = "600 28px system-ui, sans-serif";
  c.fillText("20 RW · 160 RT — Ketua RW terpilih: " + nRW + " · Ketua RT terpilih: " + nRT, W / 2, H - 36);
}

/* Bangun aula. halang(minX,maxX,minZ,maxZ) = tabrakan lokal. Mengembalikan grup (posisi diatur pemanggil). */
export function bangunInteriorIstana(halang) {
  const { sw, sd, tinggi: T } = UKURAN_ISTANA_DALAM;
  const g = new THREE.Group();
  const K = (l, t, d, warna, x, y, z) => { const m = kotak(l, t, d, warna, x, y, z); m.castShadow = false; g.add(m); return m; };
  const EMAS = 0xd9a441, KREM = 0xf6ecd6, KAYU = 0x5a3418, MERAH = 0x9c1f24;
  // lantai marmer + plafon
  const lantai = new THREE.Mesh(new THREE.BoxGeometry(sw * 2 + 0.8, 0.3, sd * 2 + 0.8),
    new THREE.MeshStandardMaterial({ map: teksturMarmer(), roughness: 0.35, metalness: 0.05 }));
  lantai.position.y = -0.15; lantai.receiveShadow = true; g.add(lantai);
  K(sw * 2 + 0.8, 0.3, sd * 2 + 0.8, 0xf3ead6, 0, T + 0.15, 0);
  // dinding (selatan berlubang pintu 3,2 x 4)
  K(sw * 2 + 0.8, T, 0.4, KREM, 0, T / 2, -sd - 0.2);
  K(0.4, T, sd * 2 + 0.8, KREM, -sw - 0.2, T / 2, 0);
  K(0.4, T, sd * 2 + 0.8, KREM, sw + 0.2, T / 2, 0);
  const sisiPintu = sw - 1.6;
  K(sisiPintu, T, 0.4, KREM, -(1.6 + sisiPintu / 2), T / 2, sd + 0.2);
  K(sisiPintu, T, 0.4, KREM, 1.6 + sisiPintu / 2, T / 2, sd + 0.2);
  K(3.2, T - 4, 0.4, KREM, 0, (4 + T) / 2, sd + 0.2);
  K(3.6, 0.3, 0.5, EMAS, 0, 4.15, sd + 0.15); // ambang pintu emas
  // wainscot kayu gelap + lis emas + cornice emas di bawah plafon
  for (const [l, d, x, z] of [[sw * 2, 0.08, 0, -sd + 0.04], [0.08, sd * 2, -sw + 0.04, 0], [0.08, sd * 2, sw - 0.04, 0],
    [sisiPintu, 0.08, -(1.6 + sisiPintu / 2), sd - 0.04], [sisiPintu, 0.08, 1.6 + sisiPintu / 2, sd - 0.04]]) {
    K(l, 1.3, d, KAYU, x, 0.65, z);
    K(l === 0.08 ? 0.1 : l, 0.08, d === 0.08 ? 0.1 : d, EMAS, x, 1.32, z);
    K(l === 0.08 ? 0.16 : l, 0.3, d === 0.08 ? 0.16 : d, EMAS, x, T - 0.15, z);
  }
  // pilaster emas di dinding barat & timur
  for (const z of [-8, -2, 4, 9]) for (const s of [-1, 1]) K(0.18, T - 1.6, 0.7, 0xead7a8, s * (sw - 0.12), 1.3 + (T - 1.6) / 2, z);
  // karpet merah pintu -> panggung, lis emas
  K(3.4, 0.04, sd * 2 - 5.5, MERAH, 0, 0.02, 2.75);
  K(0.12, 0.045, sd * 2 - 5.5, EMAS, -1.7, 0.025, 2.75); K(0.12, 0.045, sd * 2 - 5.5, EMAS, 1.7, 0.025, 2.75);
  // panggung kepresidenan berundak
  K(14, 0.35, 5.2, 0xe9dcc0, 0, 0.175, -sd + 2.6);
  K(10, 0.35, 4.0, 0xe9dcc0, 0, 0.525, -sd + 2.0);
  K(14, 0.06, 0.08, EMAS, 0, 0.36, -sd + 5.2); K(10, 0.06, 0.08, EMAS, 0, 0.71, -sd + 4.0);
  K(4.2, 0.04, 4.0, MERAH, 0, 0.72, -sd + 2.0); // karpet panggung
  // meja & kursi Presiden
  K(3.4, 1.0, 1.4, KAYU, 0, 1.2, -sd + 2.6);
  K(3.5, 0.08, 1.5, EMAS, 0, 1.73, -sd + 2.6);
  K(0.9, 0.22, 0.08, 0xf6dd9a, 0, 1.88, -sd + 3.25); // plakat meja
  K(1.2, 0.18, 1.0, MERAH, 0, 1.25, -sd + 1.3);       // dudukan kursi
  K(1.2, 2.2, 0.2, MERAH, 0, 2.3, -sd + 0.85);        // sandaran tinggi
  K(1.4, 0.16, 0.26, EMAS, 0, 3.45, -sd + 0.85);      // mahkota sandaran
  for (const s of [-1, 1]) K(0.14, 0.55, 1.0, EMAS, s * 0.62, 1.45, -sd + 1.3); // lengan kursi
  halang(-7, 7, -sd, -sd + 5.2);
  // lambang besar di dinding utara + potret Presiden + bendera
  const lambang = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 3.6),
    new THREE.MeshStandardMaterial({ map: teksturLambangIstana(), roughness: 0.6 }));
  lambang.position.set(0, 5.6, -sd + 0.1); g.add(lambang); // di depan bingkai emas (anti z-fighting)
  K(7.6, 4.0, 0.08, EMAS, 0, 5.6, -sd + 0.02);
  for (const s of [-1, 1]) {
    K(2.3, 3.0, 0.1, EMAS, s * 6.4, 5.0, -sd + 0.03);
    const potret = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.65),
      new THREE.MeshStandardMaterial({ map: teksturPotretPresiden(), roughness: 0.8 }));
    potret.position.set(s * 6.4, 5.0, -sd + 0.09); g.add(potret);
    // tiang bendera di panggung
    const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.4, 10), M(EMAS, 0.4));
    tiang.position.set(s * 4.3, 3.05, -sd + 1.2); g.add(tiang);
    const pucuk = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), M(EMAS, 0.4));
    pucuk.position.set(s * 4.3, 5.8, -sd + 1.2); g.add(pucuk);
    const bendera = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2),
      new THREE.MeshStandardMaterial({ map: teksturBenderaMerdu(), roughness: 0.9, side: THREE.DoubleSide }));
    bendera.position.set(s * 4.3 - s * 0.92, 4.9, -sd + 1.2); g.add(bendera);
  }
  // deret pilar
  for (const z of [-5, 0.5, 6]) for (const s of [-1, 1]) {
    const x = s * 6.2;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, T - 0.9, 16), M(0xfbf5e8, 0.6));
    pil.position.set(x, 0.45 + (T - 0.9) / 2, z); g.add(pil);
    K(1.2, 0.45, 1.2, 0xece1c6, x, 0.225, z);
    K(1.25, 0.35, 1.25, EMAS, x, T - 0.27, z);
    halang(x - 0.6, x + 0.6, z - 0.6, z + 0.6);
  }
  // papan struktur pemerintahan (dinding barat)
  const cvStruktur = document.createElement("canvas"); cvStruktur.width = 1200; cvStruktur.height = 1100;
  gambarStruktur(cvStruktur, null);
  const texStruktur = new THREE.CanvasTexture(cvStruktur);
  K(0.12, 5.3, 5.8, EMAS, -sw + 0.08, 4.4, -2.6);
  const papan = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.0),
    new THREE.MeshStandardMaterial({ map: texStruktur, roughness: 0.8 }));
  papan.rotation.y = Math.PI / 2; papan.position.set(-sw + 0.16, 4.4, -2.6); g.add(papan);
  const jamI = buatJam(0.6, 0xd4a73a); jamI.rotation.y = Math.PI / 2; jamI.position.set(-sw + 0.16, 7.6, -2.6); g.add(jamI); // jam real time
  g.userData.isiStruktur = (pejabat) => { gambarStruktur(cvStruktur, pejabat); texStruktur.needsUpdate = true; };
  // bangku tamu (sayap barat)
  for (const z of [3, 7.5]) {
    K(0.9, 0.12, 3.2, KAYU, -10.5, 0.55, z); K(0.15, 0.9, 3.2, KAYU, -10.95, 1.0, z);
    K(0.75, 0.1, 3.0, MERAH, -10.45, 0.66, z);
    for (const dz of [-1.4, 1.4]) K(0.8, 0.5, 0.12, KAYU, -10.5, 0.25, z + dz);
    halang(-11.1, -10, z - 1.7, z + 1.7);
  }
  // meja rapat kabinet (sayap timur) + 8 kursi
  K(2.2, 0.12, 7, KAYU, 10.6, 1.0, 1.8); K(2.3, 0.04, 7.1, EMAS, 10.6, 1.08, 1.8);
  for (const dz of [-3, 3]) K(1.6, 0.95, 0.3, KAYU, 10.6, 0.48, 1.8 + dz);
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const z = -0.9 + i * 1.8, x = 10.6 + s * 1.6;
    K(0.7, 0.12, 0.7, MERAH, x, 0.6, z); K(0.12, 0.9, 0.7, KAYU, x + s * 0.32, 1.05, z);
  }
  halang(8.8, 12.4, -2, 5.6);
  // pot tanaman di sudut
  for (const [x, z] of [[-13.6, -10.6], [13.6, -10.6], [-13.6, 10.6], [13.6, 10.6]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 14), M(0xb5533c)); pot.position.set(x, 0.45, z); g.add(pot);
    const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), M(0x3f8f4f)); daun.position.set(x, 1.7, z); g.add(daun);
    halang(x - 0.7, x + 0.7, z - 0.7, z + 0.7);
  }
  // cahaya: hemisfer + 2 lampu gantung kristal
  g.add(new THREE.HemisphereLight(0xfff6e6, 0x8a7458, 0.55));
  for (const z of [-3, 5]) {
    K(0.05, 1.2, 0.05, EMAS, 0, T - 0.6, z);
    const cincin = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 8, 24), M(EMAS, 0.4));
    cincin.rotation.x = Math.PI / 2; cincin.position.set(0, T - 1.3, z); g.add(cincin);
    const kristal = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe2a6, emissiveIntensity: 1.2, roughness: 0.2 }));
    kristal.position.set(0, T - 1.55, z); g.add(kristal);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const lilin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffd889, emissiveIntensity: 1.5 }));
      lilin.position.set(Math.cos(a) * 1.0, T - 1.2, z + Math.sin(a) * 1.0); g.add(lilin);
    }
    const lampu = new THREE.PointLight(0xffe2b0, 0.9, 40, 2);
    lampu.position.set(0, T - 2, z); g.add(lampu);
  }
  return g;
}
