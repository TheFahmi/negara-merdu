/* Negara Merdu — modul game "iklan": PAPAN IKLAN (billboard) di beberapa
   titik kota.

   - 8 papan DUA MUKA berdiri di rumput sekeliling plaza Istana Negara (titik paling
     ramai: tempat pemain mulai & kamera Orbit bawaan), menghadap ke plaza
     atau ke jalan utama. Koordinat relatif pusat plaza (PUSAT_X/Z).
   - Isi iklan dibaca dari /iklan.json (web/public/iklan.json — bisa diedit
     tanpa ubah kode). Gagal dibaca / kosong = pakai IKLAN_BAWAAN.
   - Iklan bergilir tiap ROTASI_DTK detik; tiap papan mulai dari indeks
     berbeda supaya papan bersebelahan tidak menampilkan iklan yang sama.
   - Panel menyala (emissive) dan makin terang di malam hari.
   - Ketuk papan = kartu info iklan + tombol tautan (bila ada).

   Format satu entri iklan.json:
     { "judul": "…", "sub": "…", "cta": "…", "link": "https://…",
       "latar": ["#hex1", "#hex2"], "aksen": "#hex", "gambar": "/iklan/x.png" }
   Hanya "judul" yang wajib. "gambar" (opsional) = gambar penuh 2:1
   (mis. 1024×512) yang menggantikan desain teks otomatis. */
import { $, PUSAT_X, PUSAT_Z } from "./inti.js";
import { scene, wkt } from "./bersama.js";
import { rintangan } from "./rumah.js";

export const IKLAN_BAWAAN = [
  { judul: "Jadi Warga Negara Merdu", sub: "Daftar pakai username Instagram — dapat rumah & KTP digital", cta: "Daftar gratis", latar: ["#1f7a4d", "#2fa36b"], aksen: "#ffd54a" },
  { judul: "Follow @negaramerdu", sub: "Update pembangunan, pemilu & acara warga tiap hari", cta: "Instagram", link: "https://instagram.com/negaramerdu", latar: ["#7b2ff7", "#f107a3"], aksen: "#ffffff" },
  { judul: "Pasang Iklan di Sini", sub: "Papan strategis di jantung kota — dilihat semua warga", cta: "Hubungi admin", latar: ["#ff8a00", "#e52e71"], aksen: "#fff3c4" },
  { judul: "Pemilu Negara Merdu", sub: "Suaramu menentukan Presiden berikutnya. Ayo memilih!", cta: "Buka menu Pemilu", latar: ["#0f4c81", "#1f8ad1"], aksen: "#ffd54a" },
  { judul: "Pembangunan Desa", sub: "Usulkan fasilitas baru: sekolah, pasar, puskesmas…", cta: "Lihat rencana", latar: ["#5b3a1e", "#a8672f"], aksen: "#ffe08a" },
];

const ROTASI_DTK = 8;
/* Titik papan (lokal plaza): x, z, rotasi hadap (rad, 0 = menghadap +z / selatan). */
const TITIK_PAPAN = [ // di pita rumput antara tepi plaza (260x130) dan jalan pembatas blok pusat
  { x: -100, z: -71, ry: 0 },             // utara, menghadap plaza
  { x: 100, z: -71, ry: 0 },
  { x: -100, z: 71, ry: Math.PI },        // selatan, menghadap plaza
  { x: 100, z: 71, ry: Math.PI },
  { x: -146, z: -36, ry: Math.PI / 2 },   // barat, menghadap plaza
  { x: -146, z: 36, ry: Math.PI / 2 },
  { x: 146, z: -36, ry: -Math.PI / 2 },   // timur, menghadap plaza
  { x: 146, z: 36, ry: -Math.PI / 2 },
];
const PANEL_W = 16, PANEL_H = 8, KAKI = 6.2; // panel 2:1, tepi bawah panel di y = KAKI

let daftarIklan = IKLAN_BAWAAN.slice();
export const iklanKlik = [];
const papan = []; // { tex, cv, mat, indeks, grup }
const cacheGambar = new Map();
let giliran = -1;

function amanWarna(w, cadangan) { return typeof w === "string" && /^#[0-9a-f]{3,8}$/i.test(w) ? w : cadangan; }
function bungkusTeks(c, teks, maksLebar) {
  const kata = String(teks || "").split(/\s+/), baris = [];
  let kini = "";
  for (const k of kata) {
    const coba = kini ? kini + " " + k : k;
    if (c.measureText(coba).width > maksLebar && kini) { baris.push(kini); kini = k; } else kini = coba;
  }
  if (kini) baris.push(kini);
  return baris;
}
function sudutBulat(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
/* Gambar satu iklan ke kanvas 1024×512. */
function gambarIklan(cv, ik) {
  const c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const img = ik.gambar ? cacheGambar.get(ik.gambar) : null;
  if (img && img.complete && img.naturalWidth) { c.drawImage(img, 0, 0, W, H); return; }
  const latar = Array.isArray(ik.latar) ? ik.latar : [];
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, amanWarna(latar[0], "#1f7a4d")); g.addColorStop(1, amanWarna(latar[1] || latar[0], "#2fa36b"));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // ornamen: lingkaran besar transparan + garis diagonal
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.beginPath(); c.arc(W * 0.86, H * 0.18, H * 0.55, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(W * 0.95, H * 0.95, H * 0.32, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(255,255,255,0.07)"; c.lineWidth = 18;
  for (let i = -2; i < 8; i++) { c.beginPath(); c.moveTo(i * 150, H); c.lineTo(i * 150 + H, 0); c.stroke(); }
  const aksen = amanWarna(ik.aksen, "#ffd54a");
  c.fillStyle = aksen; c.fillRect(56, 70, 90, 12); // garis aksen di atas judul
  c.fillStyle = "#ffffff"; c.textBaseline = "top";
  c.font = "800 78px Inter, 'Segoe UI', Arial, sans-serif";
  const judul = bungkusTeks(c, ik.judul, W - 130).slice(0, 2);
  let y = 100;
  c.shadowColor = "rgba(0,0,0,0.25)"; c.shadowOffsetY = 4; c.shadowBlur = 8;
  for (const b of judul) { c.fillText(b, 56, y); y += 86; }
  c.shadowColor = "transparent";
  if (ik.sub) {
    c.font = "500 36px Inter, 'Segoe UI', Arial, sans-serif"; c.fillStyle = "rgba(255,255,255,0.92)";
    for (const b of bungkusTeks(c, ik.sub, W - 130).slice(0, 2)) { c.fillText(b, 58, y + 8); y += 44; }
  }
  if (ik.cta) {
    c.font = "700 34px Inter, 'Segoe UI', Arial, sans-serif";
    const lw = c.measureText(ik.cta).width + 64;
    sudutBulat(c, 56, H - 104, lw, 64, 32); c.fillStyle = aksen; c.fill();
    c.fillStyle = "#1b1b1b"; c.fillText(ik.cta, 88, H - 90);
  }
  c.font = "600 24px Inter, 'Segoe UI', Arial, sans-serif"; c.fillStyle = "rgba(255,255,255,0.75)";
  c.textAlign = "right"; c.fillText("IKLAN · NEGARA MERDU", W - 40, H - 52); c.textAlign = "left";
}

function geometriRangka() { // kaki baja + rangka panel + catwalk + lampu sorot (lokal: panel menghadap +z)
  const grup = new THREE.Group();
  const baja = new THREE.MeshStandardMaterial({ color: 0x5b6168, roughness: 0.55, metalness: 0.4, flatShading: true });
  const gelap = new THREE.MeshStandardMaterial({ color: 0x24282c, roughness: 0.8, flatShading: true });
  const tambah = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; grup.add(m); return m; };
  for (const sx of [-PANEL_W * 0.3, PANEL_W * 0.3]) {
    tambah(new THREE.CylinderGeometry(0.32, 0.4, KAKI + 1, 10), baja, sx, (KAKI + 1) / 2, -0.4);
    tambah(new THREE.BoxGeometry(1.4, 0.4, 1.4), gelap, sx, 0.2, -0.4); // pondasi
  }
  tambah(new THREE.BoxGeometry(PANEL_W + 0.8, PANEL_H + 0.8, 0.5), gelap, 0, KAKI + PANEL_H / 2, -0.35); // rangka/belakang panel
  tambah(new THREE.BoxGeometry(PANEL_W + 1.2, 0.18, 1.6), baja, 0, KAKI - 0.55, 0.5); // catwalk
  for (let i = -4; i <= 4; i++) tambah(new THREE.BoxGeometry(0.06, 0.8, 0.06), baja, i * (PANEL_W / 8.4), KAKI - 0.1, 1.25); // pagar catwalk
  tambah(new THREE.BoxGeometry(PANEL_W + 1.2, 0.06, 0.06), baja, 0, KAKI + 0.3, 1.25);
  const matLampu = new THREE.MeshStandardMaterial({ color: 0xfff6df, emissive: 0xfff1c9, emissiveIntensity: 0.6, roughness: 0.4 });
  for (const lx of [-PANEL_W * 0.33, 0, PANEL_W * 0.33]) { // lampu sorot di atas panel
    tambah(new THREE.BoxGeometry(0.08, 0.08, 1.4), baja, lx, KAKI + PANEL_H + 0.55, 0.4);
    tambah(new THREE.BoxGeometry(0.9, 0.3, 0.45), gelap, lx, KAKI + PANEL_H + 0.5, 1.15);
    tambah(new THREE.BoxGeometry(0.8, 0.06, 0.38), matLampu, lx, KAKI + PANEL_H + 0.33, 1.15).castShadow = false;
  }
  grup.userData.matLampu = matLampu;
  return grup;
}

function terapkanGiliran(n) {
  if (!daftarIklan.length) return;
  for (let i = 0; i < papan.length; i++) {
    const p = papan[i];
    p.indeks = ((n + i * 3) % daftarIklan.length + daftarIklan.length) % daftarIklan.length;
    gambarIklan(p.cv, daftarIklan[p.indeks]);
    p.tex.needsUpdate = true;
  }
}

async function muatIklan() {
  try {
    const r = await fetch("/iklan.json", { cache: "no-cache" });
    if (!r.ok) return;
    const d = await r.json();
    const arr = (Array.isArray(d) ? d : d && d.iklan) || [];
    const bersih = arr.filter((x) => x && typeof x.judul === "string" && x.judul.trim());
    if (bersih.length) daftarIklan = bersih;
  } catch (e) { /* tetap pakai IKLAN_BAWAAN */ }
  for (const ik of daftarIklan) {
    if (!ik.gambar || cacheGambar.has(ik.gambar)) continue;
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => terapkanGiliran(Math.max(0, giliran));
    img.src = ik.gambar; cacheGambar.set(ik.gambar, img);
  }
  terapkanGiliran(Math.max(0, giliran));
}

export function bangunPapanIklan() {
  const pusat = new THREE.Group(); pusat.position.set(PUSAT_X, 0, PUSAT_Z); scene.add(pusat);
  for (const t of TITIK_PAPAN) {
    const g = geometriRangka();
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 512;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.55 });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), mat);
    panel.position.set(0, KAKI + PANEL_H / 2, -0.08); panel.receiveShadow = true;
    g.add(panel);
    const panelBelakang = new THREE.Mesh(panel.geometry, mat); // dua muka: terbaca dari plaza & dari jalan
    panelBelakang.position.set(0, KAKI + PANEL_H / 2, -0.62); panelBelakang.rotation.y = Math.PI; panelBelakang.receiveShadow = true;
    g.add(panelBelakang);
    g.position.set(t.x, 0, t.z); g.rotation.y = t.ry;
    pusat.add(g);
    const data = { tex, cv, mat, indeks: 0, grup: g };
    g.userData.iklan = data;
    papan.push(data); iklanKlik.push(g);
    // tabrakan: dua kaki (AABB kecil di sekitar tiap kaki, koordinat dunia)
    const cos = Math.cos(t.ry), sin = Math.sin(t.ry);
    for (const sx of [-PANEL_W * 0.3, PANEL_W * 0.3]) {
      const wx = PUSAT_X + t.x + sx * cos - 0.4 * sin, wz = PUSAT_Z + t.z - sx * sin - 0.4 * cos;
      rintangan.push({ minX: wx - 0.8, maxX: wx + 0.8, minZ: wz - 0.8, maxZ: wz + 0.8 });
    }
  }
  terapkanGiliran(0);
  muatIklan();
}

/* Dipanggil tiap frame dari loop animasi. */
export function perbaruiIklan(t) {
  if (!papan.length) return;
  const n = Math.floor(t / ROTASI_DTK);
  if (n !== giliran) { giliran = n; terapkanGiliran(n); }
  const malam = Math.min(1, Math.max(0, (wkt.jendela || 0) / 2.2)); // 0 siang .. 1 malam
  const nyala = 0.22 + malam * 0.75;
  for (const p of papan) {
    p.mat.emissiveIntensity = nyala;
    const ml = p.grup.userData.matLampu; if (ml) ml.emissiveIntensity = 0.4 + malam * 2.2;
  }
}

/* Ketukan pada papan: kembalikan true bila menangani (kartu info tampil). */
export function ketukIklan(ray, jarakMaks) {
  const kena = ray.intersectObjects(iklanKlik, true);
  if (!kena.length || kena[0].distance > jarakMaks) return false;
  let o = kena[0].object;
  while (o && !o.userData.iklan) o = o.parent;
  if (!o) return false;
  const ik = daftarIklan[o.userData.iklan.indeks] || {};
  const esc = (s) => String(s || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const linkAman = typeof ik.link === "string" && /^https?:\/\//i.test(ik.link) ? ik.link : "";
  $("#kartu .isi").innerHTML = "<h3>" + esc(ik.judul) + "</h3>" +
    (ik.sub ? "<p>" + esc(ik.sub) + "</p>" : "") +
    (linkAman ? '<a class="btn-masuk" href="' + esc(linkAman) + '" target="_blank" rel="noopener noreferrer">' + esc(ik.cta || "Buka") + "</a>" : "") +
    '<p class="kecil">Papan iklan · ganti tiap ' + ROTASI_DTK + " detik</p>";
  $("#kartu").hidden = false;
  return true;
}
