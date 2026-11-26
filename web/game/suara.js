/* Negara Merdu — modul game "suara" (26 Nov 2026).
   SEMUA suara disintesis langsung dengan Web Audio API (tanpa file audio:
   tidak menambah ukuran unduhan & bebas lisensi). Mulai setelah sentuhan /
   klik pertama (aturan autoplay browser).

   Lapisan ambien (volume diatur tiap frame dari posisi kamera & waktu):
   - angin        : derau merah-muda lowpass, makin kencang makin tinggi kamera
   - kota         : dengung lalu lintas (derau coklat lowpass) dekat tanah
   - keramaian    : gumam orang di plaza (derau bandpass bergelombang)
   - burung       : kicau acak (siang) · jangkrik: denyut 4,4 kHz (malam)
   Sumber berposisi (redaman jarak + panning kiri/kanan dari arah kamera):
   - mesin bus terdekat, gemuruh KRL terdekat
   Peristiwa: langkah kaki (1st/3rd person saat berjalan), bel pintu &
   desis rem bus di halte, bel "ting-tung" + klakson KRL di stasiun,
   klik lembut tombol UI.
   Pengaturan di menu: Suara Nyala/Mati + volume (disimpan localStorage). */
import { camera } from "./bersama.js";

const KUNCI = "pinarak_suara";
const set = (() => { try { return JSON.parse(localStorage.getItem(KUNCI)) || {}; } catch (e) { return {}; } })();
export const SUARA = { nyala: set.nyala !== false, volume: typeof set.volume === "number" ? set.volume : 0.7 };
function simpan() { try { localStorage.setItem(KUNCI, JSON.stringify(SUARA)); } catch (e) {} }

let ac = null, master = null, bufDerau = null;
const L = {}; // lapisan ambien: {gain}
let sumberBus = null, sumberKrl = null;

function buatDerau() {
  const n = ac.sampleRate * 3, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, coklat = 0;
  for (let i = 0; i < n; i++) { // derau merah muda (Paul Kellet ringkas)
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
    coklat = (coklat + 0.02 * w) / 1.02;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 + coklat * 0.6;
  }
  return b;
}
function lapisDerau(tipe, frek, q) {
  const src = ac.createBufferSource(); src.buffer = bufDerau; src.loop = true;
  src.loopStart = Math.random(); // tiap lapis mulai di titik berbeda
  const f = ac.createBiquadFilter(); f.type = tipe; f.frequency.value = frek; if (q) f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  src.connect(f); f.connect(g); g.connect(master); src.start(0, Math.random() * 2);
  return { src, f, g };
}
function sumberPosisi(buat) { // sumber berposisi: gain + panner stereo
  const g = ac.createGain(); g.gain.value = 0;
  const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
  if (pan) { g.connect(pan); pan.connect(master); } else g.connect(master);
  buat(g);
  return { g, pan };
}
function mulai() {
  if (ac) { if (ac.state === "suspended") ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = SUARA.nyala ? SUARA.volume : 0;
  const komp = ac.createDynamicsCompressor(); master.connect(komp); komp.connect(ac.destination);
  bufDerau = buatDerau();
  L.angin = lapisDerau("lowpass", 420);
  L.kota = lapisDerau("lowpass", 180);
  L.ramai = lapisDerau("bandpass", 650, 0.9);
  // mesin bus: gergaji 46 Hz + harmonik, lowpass
  sumberBus = sumberPosisi((out) => {
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 320; f.connect(out);
    for (const [fr, v] of [[46, 0.5], [92, 0.25], [139, 0.12]]) { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; const gg = ac.createGain(); gg.gain.value = v; o.connect(gg); gg.connect(f); o.start(); }
  });
  // gemuruh KRL: derau lowpass + dengung motor 120 Hz
  sumberKrl = sumberPosisi((out) => {
    const s = ac.createBufferSource(); s.buffer = bufDerau; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 260; s.connect(f); f.connect(out); s.start();
    const o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 118; const gg = ac.createGain(); gg.gain.value = 0.18; o.connect(gg); gg.connect(out); o.start();
  });
}
["pointerdown", "keydown", "touchstart"].forEach((e) => addEventListener(e, mulai, { passive: true }));

/* ---------- bunyi pendek ---------- */
function nada(frek, mulaiT, durasi, vol, tipe, tujuan, frekAkhir) {
  const o = ac.createOscillator(); o.type = tipe || "sine"; o.frequency.setValueAtTime(frek, mulaiT);
  if (frekAkhir) o.frequency.exponentialRampToValueAtTime(frekAkhir, mulaiT + durasi);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, mulaiT);
  g.gain.exponentialRampToValueAtTime(vol, mulaiT + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, mulaiT + durasi);
  o.connect(g); g.connect(tujuan || master); o.start(mulaiT); o.stop(mulaiT + durasi + 0.05);
}
function semburDerau(mulaiT, durasi, vol, tipe, frek, tujuan, q) {
  const s = ac.createBufferSource(); s.buffer = bufDerau;
  const f = ac.createBiquadFilter(); f.type = tipe; f.frequency.value = frek; if (q) f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, mulaiT); g.gain.exponentialRampToValueAtTime(0.0001, mulaiT + durasi);
  s.connect(f); f.connect(g); g.connect(tujuan || master); s.start(mulaiT, Math.random() * 2); s.stop(mulaiT + durasi + 0.05);
}
function redam(x, z) { const d = Math.hypot(x - camera.position.x, z - camera.position.z, 0); return Math.max(0, 1 - d / 140) ** 2; }
function panUntuk(x, z) {
  const kx = Math.cos(camera.rotation.y), kz = -Math.sin(camera.rotation.y); // vektor kanan kamera (kira-kira)
  const dx = x - camera.position.x, dz = z - camera.position.z, d = Math.hypot(dx, dz) || 1;
  return Math.max(-0.85, Math.min(0.85, (dx * kx + dz * kz) / d));
}
function keluaranPan(x, z, vol) {
  const g = ac.createGain(); g.gain.value = vol;
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = panUntuk(x, z); g.connect(p); p.connect(master); } else g.connect(master);
  return g;
}
export function bunyiKlik() {
  if (!ac || !SUARA.nyala) return; const t = ac.currentTime;
  nada(1400, t, 0.05, 0.05, "sine", null, 900);
}
export function bunyiPeristiwa(jenis, pos) {
  if (!ac || !SUARA.nyala || !pos) return;
  const r = redam(pos.x, pos.z); if (r < 0.01) return;
  const t = ac.currentTime, out = keluaranPan(pos.x, pos.z, r);
  if (jenis === "busBerhenti") { // desis rem angin + bel pintu dua nada
    semburDerau(t, 0.9, 0.35, "highpass", 2500, out);
    nada(880, t + 0.5, 0.35, 0.12, "sine", out); nada(660, t + 0.8, 0.5, 0.12, "sine", out);
  } else if (jenis === "busBerangkat") {
    nada(660, t, 0.3, 0.1, "sine", out); nada(880, t + 0.28, 0.4, 0.1, "sine", out);
  } else if (jenis === "krlBerhenti") { // ting-tung-ting KRL
    nada(1047, t + 0.2, 0.6, 0.12, "triangle", out); nada(784, t + 0.55, 0.6, 0.12, "triangle", out); nada(1047, t + 0.9, 0.8, 0.12, "triangle", out);
  } else if (jenis === "krlBerangkat") { // klakson KRL (dua nada)
    for (const fr of [370, 466]) nada(fr, t, 1.1, 0.12, "sawtooth", out);
  }
}

/* ---------- loop per frame ---------- */
let tKicau = 0, tJangkrik = 0, tLangkah = 0, kx = null, kz = 0;
function lerpGain(lapis, v) { lapis.g.gain.setTargetAtTime(v, ac.currentTime, 0.25); }
export function perbaruiSuara(dt, o) {
  if (!ac) return;
  master.gain.setTargetAtTime(SUARA.nyala ? SUARA.volume : 0, ac.currentTime, 0.1);
  if (!SUARA.nyala) return;
  const y = camera.position.y, malam = Math.max(0, Math.min(1, o.malam || 0)), diDalam = !!o.diDalam;
  const tanah = Math.max(0, 1 - y / 60); // 1 di tanah, 0 di atas 60 m
  lerpGain(L.angin, (diDalam ? 0.02 : 0.05 + Math.min(1, y / 200) * 0.35), dt);
  lerpGain(L.kota, diDalam ? 0.03 : 0.18 * tanah + 0.04, dt);
  const dPlaza = Math.hypot(camera.position.x - o.plaza.x, camera.position.z - o.plaza.z);
  L.ramai.f.frequency.setTargetAtTime(550 + Math.sin(performance.now() / 900) * 180, ac.currentTime, 0.3);
  lerpGain(L.ramai, diDalam ? 0 : Math.max(0, 1 - dPlaza / 160) * tanah * 0.22 * (1 - malam * 0.6), dt);
  const t = ac.currentTime;
  // burung (siang) & jangkrik (malam), hanya di luar dan dekat tanah
  if (!diDalam && tanah > 0.2) {
    tKicau -= dt; tJangkrik -= dt;
    if (tKicau <= 0 && malam < 0.5) {
      tKicau = 1.5 + Math.random() * 4;
      const out = keluaranPan(camera.position.x + (Math.random() - 0.5) * 60, camera.position.z + (Math.random() - 0.5) * 60, 0.05 * tanah);
      const f0 = 2400 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) nada(f0, t + i * 0.13, 0.1, 0.9, "sine", out, f0 * (1.25 + Math.random() * 0.3));
    }
    if (tJangkrik <= 0 && malam > 0.4) {
      tJangkrik = 0.35 + Math.random() * 0.5;
      const out = keluaranPan(camera.position.x + (Math.random() - 0.5) * 40, camera.position.z + (Math.random() - 0.5) * 40, 0.025 * malam * tanah);
      for (let i = 0; i < 3; i++) nada(4400, t + i * 0.045, 0.03, 0.9, "square", out);
    }
  }
  // langkah kaki saat jalan (1st/3rd person)
  const cx = camera.position.x, cz = camera.position.z;
  if (kx !== null && (o.mode === "orang" || o.mode === "ketiga")) {
    const v = Math.hypot(cx - kx, cz - kz) / Math.max(dt, 1e-3);
    if (v > 0.8 && v < 15) {
      tLangkah -= dt * Math.min(2.2, v / 3);
      if (tLangkah <= 0) { tLangkah = 0.5; semburDerau(t, 0.09, diDalam ? 0.32 : 0.22, "lowpass", diDalam ? 1400 : 900, null, 1.2); nada(95, t, 0.06, 0.08, "sine"); }
    }
  }
  kx = cx; kz = cz;
  // sumber berposisi: bus & KRL terdekat
  const terdekat = (daftar) => { let best = null, dm = Infinity; for (const p of daftar) { const d = Math.hypot(p.x - cx, p.z - cz); if (d < dm) { dm = d; best = p; } } return best; };
  const b = terdekat(o.bus || []), k = terdekat(o.krl || []);
  const atur = (S, p, vol) => {
    if (!S) return;
    const r = p ? redam(p.x, p.z) : 0;
    S.g.gain.setTargetAtTime(diDalam ? r * vol * 0.25 : r * vol, t, 0.2);
    if (S.pan && p) S.pan.pan.setTargetAtTime(panUntuk(p.x, p.z), t, 0.2);
  };
  atur(sumberBus, b, 0.14 * (b && b.jalan ? 1 : 0.5));
  atur(sumberKrl, k, k && k.jalan ? 0.5 : 0.06);
}

/* ---------- pengaturan menu ---------- */
export function pasangPengaturanSuara() {
  const tombol = document.querySelectorAll("#seg-suara button"), geser = document.getElementById("vol-suara");
  const segarkan = () => { tombol.forEach((b) => b.classList.toggle("on", (b.dataset.suara === "nyala") === SUARA.nyala)); if (geser) geser.value = String(Math.round(SUARA.volume * 100)); };
  tombol.forEach((b) => b.addEventListener("click", () => { SUARA.nyala = b.dataset.suara === "nyala"; simpan(); mulai(); segarkan(); }));
  if (geser) geser.addEventListener("input", () => { SUARA.volume = Number(geser.value) / 100; simpan(); });
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("button")) bunyiKlik(); }, true);
  segarkan();
}
