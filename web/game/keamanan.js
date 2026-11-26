/* Negara Merdu — modul game "keamanan": POLISI & TENTARA (permintaan Diah
   25 Nov 2026).
   - seragam(kar, jenis): pakaian & tutup kepala polisi (kemeja cokelat,
     topi pet) / tentara (loreng hijau, baret).
   - Penjaga ISTANA NEGARA: 2 tentara siaga di gerbang pelataran + pos jaga,
     2 tentara mengapit karpet merah di kaki tangga, 2 polisi di sudut pagar,
     regu patroli tentara & polisi berjalan bolak-balik di depan pagar istana.
   - MOBIL PATROLI POLISI berkeliling negara di jalan-jalan utama (rute
     bersudut bulat, lajur kiri, mematuhi lampu merah & berhenti di garis
     henti), lampu rotator merah-biru berkedip, sein saat berbelok.
   Markas polisi & tentara ada di gedungKaca.js (jenis "polisi"/"tentara"). */
import { buatMobil } from "./mobilGeo.js";
import { JALAN, PUSAT_X, PUSAT_Z, SKALA_KARAKTER, SKALA_MOBIL, Z_ISTANA, SKALA_ISTANA, sudutBlok } from "./inti.js";
import { M, kotak, scene } from "./bersama.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";
import { SWAY, arahHalus, arahSein, goyang, jalurPoligon, jarakKeBelok, kedip, posJalur, terapkanSway } from "./jalur.js";
import { PIVOT_MOBIL } from "./mobilGeo.js";
import { batasLampuMerah } from "./kota.js";

export const WARNA_POLISI = { baju: "#8b6b45", celana: "#3d2b1f" };
export const WARNA_TENTARA = { baju: "#4f5d3a", celana: "#4f5d3a" };
let TEX_LORENG = null;
function teksturLoreng() {
  if (TEX_LORENG) return TEX_LORENG;
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; const c = cv.getContext("2d");
  c.fillStyle = "#56653f"; c.fillRect(0, 0, 64, 64);
  const W = ["#3b4a2b", "#7a7048", "#2b2f22", "#64774a"];
  for (let i = 0; i < 26; i++) { c.fillStyle = W[i % 4]; c.beginPath(); c.ellipse((i * 37) % 64, (i * 23) % 64, 6 + (i % 3) * 3, 3 + (i % 2) * 3, i, 0, 7); c.fill(); }
  TEX_LORENG = new THREE.CanvasTexture(cv); TEX_LORENG.wrapS = TEX_LORENG.wrapT = THREE.RepeatWrapping;
  return TEX_LORENG;
}
/* Pakaikan seragam: tutup kepala + (tentara) motif loreng di badan. */
export function seragam(kar, jenis) {
  const kep = kar.userData.kepala;
  if (jenis === "tentara") {
    const baret = new THREE.Mesh(new THREE.SphereGeometry(0.47, 16, 10), M(0x6b1f2a));
    baret.scale.set(1.05, 0.32, 1.05); baret.position.set(0.04, 0.63, -0.02); baret.rotation.z = 0.22; kep.add(baret);
    const lencana = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), M(0xd4a73a)); lencana.position.set(-0.22, 0.62, 0.36); kep.add(lencana);
    const tex = teksturLoreng();
    kar.traverse((o) => { if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === new THREE.Color(WARNA_TENTARA.baju).getHex()) { o.material = o.material.clone(); o.material.map = tex; o.material.color.setHex(0xffffff); o.material.needsUpdate = true; } });
  } else {
    const pet = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.42, 0.2, 18), M(0x3d2b1f)); pet.position.set(0, 0.64, 0); kep.add(pet);
    const atas = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.47, 0.06, 18), M(0x3d2b1f)); atas.position.set(0, 0.75, 0.02); kep.add(atas);
    const lidah = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.24), M(0x111111)); lidah.position.set(0, 0.55, 0.42); lidah.rotation.x = 0.25; kep.add(lidah);
    const lencana = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), M(0xd4a73a)); lencana.position.set(0, 0.66, 0.48); kep.add(lencana);
  }
  return kar;
}
export function buatPetugas(jenis, i) {
  const w = jenis === "tentara" ? WARNA_TENTARA : WARNA_POLISI;
  const k = buatKarakter({ baju: w.baju, kulit: ["#c68642", "#e0ac69", "#8d5524", "#f1c27d"][i % 4], topi: "tanpa", rupa: { warna_celana: w.celana, rambut: "botak" } });
  k.scale.setScalar(SKALA_KARAKTER); k.userData.geserHidup = i * 0.7;
  return seragam(k, jenis);
}

/* ---------- penjaga istana ---------- */
const PETUGAS = []; // {kar, jenis:"siaga"|"patroli", a, b, s, arah, v}
function siaga(jenis, i, x, z, ry, grup) {
  const k = buatPetugas(jenis, i); k.position.set(x, 0.32, z); k.rotation.y = ry; grup.add(k);
  PETUGAS.push({ kar: k, mode: "siaga", fase: i * 1.7 }); return k;
}
function patroli(jenis, i, a, b, grup, dx) {
  const k = buatPetugas(jenis, i); grup.add(k);
  PETUGAS.push({ kar: k, mode: "patroli", a, b, s: (i * 7) % Math.hypot(b.x - a.x, b.z - a.z), arah: 1, v: 1.25, dx: dx || 0 });
}
function posJaga(grup, x, z) {
  grup.add(kotak(2.2, 2.6, 2.2, 0x4f5d3a, x, 1.6, z));
  grup.add(kotak(2.6, 0.25, 2.6, 0xc8102e, x, 3.0, z));
  const kc = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.9, 2.24), new THREE.MeshStandardMaterial({ color: 0xbfe3f2, transparent: true, opacity: 0.35 })); kc.position.set(x, 2.1, z); grup.add(kc);
  for (let i = 0; i < 4; i++) grup.add(kotak(0.44, 0.2, 0.3, i % 2 ? 0xffffff : 0xc8102e, x - 0.66 + i * 0.44, 0.45, z + 1.25)); // palang merah-putih bawah
}
export function bangunKeamananIstana() {
  const grup = new THREE.Group(); scene.add(grup);
  const S = SKALA_ISTANA, X = PUSAT_X, zGerbang = PUSAT_Z + Z_ISTANA + (-3.4 + 34) * S; // ±1,4 (tepi selatan pagar pelataran)
  // gerbang: pos jaga + 2 tentara siaga menghadap selatan
  posJaga(grup, X - 13, zGerbang + 5.5); posJaga(grup, X + 13, zGerbang + 5.5);
  siaga("tentara", 1, X - 7.4, zGerbang + 1.6, 0, grup); siaga("tentara", 2, X + 7.4, zGerbang + 1.6, 0, grup);
  // kaki tangga istana: mengapit karpet merah
  // berdiri di lantai pelataran (y 0,34·S) DI DEPAN anak tangga, bukan di atas tangga (dulu terbenam di undakan)
  const zDepanTangga = PUSAT_Z + Z_ISTANA + 19.2 * S, yPel = 0.34 * S + 0.02;
  siaga("tentara", 3, X - 4.6, zDepanTangga, 0, grup).position.y = yPel; siaga("tentara", 4, X + 4.6, zDepanTangga, 0, grup).position.y = yPel;
  // polisi di sudut pagar pelataran
  siaga("polisi", 5, X - 42.5, zGerbang + 1.8, 0.4, grup); siaga("polisi", 6, X + 42.5, zGerbang + 1.8, -0.4, grup);
  // regu patroli di depan pagar istana (bolak-balik), berpasangan
  patroli("tentara", 7, { x: X - 40, z: zGerbang + 6 }, { x: X + 40, z: zGerbang + 6 }, grup, 0);
  patroli("tentara", 8, { x: X - 40, z: zGerbang + 6 }, { x: X + 40, z: zGerbang + 6 }, grup, 1.2);
  patroli("polisi", 9, { x: X + 40, z: zGerbang + 9 }, { x: X - 40, z: zGerbang + 9 }, grup, 0);
  patroli("polisi", 10, { x: X + 40, z: zGerbang + 9 }, { x: X - 40, z: zGerbang + 9 }, grup, 1.2);
  // patroli keliling sisi barat & timur istana (di dalam plaza)
  patroli("tentara", 11, { x: X - 46, z: zGerbang - 2 }, { x: X - 46, z: PUSAT_Z + Z_ISTANA - 4 }, grup, 0);
  patroli("tentara", 12, { x: X + 46, z: PUSAT_Z + Z_ISTANA - 4 }, { x: X + 46, z: zGerbang - 2 }, grup, 0);
  return grup;
}

/* ---------- mobil patroli polisi ---------- */
const PATROLI = [];
function buatMobilPolisi() {
  const g = buatMobil(0xf4f4f2); // sedan realistis bersama + livery polisi
  const K = (w, h, d, c, x, y, z) => { const m = kotak(w, h, d, c, x, y, z); m.castShadow = false; g.add(m); return m; };
  for (const sx of [-1, 1]) { K(0.02, 0.16, 3.6, 0x1d3a8f, sx * 0.935, 0.66, 0.05); K(0.02, 0.06, 3.6, 0xf28c28, sx * 0.94, 0.55, 0.05); } // strip biru-oranye
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64; const c = cv.getContext("2d");
  c.fillStyle = "#f4f4f2"; c.fillRect(0, 0, 256, 64); c.fillStyle = "#1d3a8f"; c.font = "bold 44px system-ui"; c.textAlign = "center"; c.fillText("POLISI", 128, 48);
  const tex = new THREE.CanvasTexture(cv);
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.3), new THREE.MeshBasicMaterial({ map: tex })); p.rotation.y = sx * Math.PI / 2; p.position.set(sx * 0.945, 0.84, 0.35); g.add(p); }
  const pk = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.26), new THREE.MeshBasicMaterial({ map: tex })); pk.rotation.x = -Math.PI / 2 + 0.11; pk.position.set(0, 0.96, 1.5); g.add(pk);
  K(1.2, 0.1, 0.36, 0x222222, 0, 1.55, -0.2);                                                   // dudukan rotator di atap
  const merah = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x550000 })); merah.position.set(-0.3, 1.68, -0.2); g.add(merah);
  const biru = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.32), new THREE.MeshBasicMaterial({ color: 0x000055 })); biru.position.set(0.3, 1.68, -0.2); g.add(biru);
  const lampuDepan = new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), rem = new THREE.MeshBasicMaterial({ color: 0x8a1212 }), sein = new THREE.MeshBasicMaterial({ color: 0xffb020 });
  const seinM = { 1: [], "-1": [] };
  for (const sx of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.05), lampuDepan); d.position.set(sx * 0.63, 0.74, 2.19); g.add(d);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.05), rem); r.position.set(sx * 0.62, 0.8, -2.2); g.add(r);
    for (const z of [2.15, -2.15]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.05), sein); s.position.set(sx * 0.86, 0.72, z * 1.012); s.visible = false; g.add(s); seinM[sx].push(s); }
  }
  g.scale.setScalar(SKALA_MOBIL);
  g.userData = { merah, biru, rem, seinM };
  return g;
}
export function bangunPatroliPolisi(parkir) {
  const grup = new THREE.Group(); scene.add(grup);
  const cx = (k) => sudutBlok(k, 0).x + JALAN / 2, cz = (b) => sudutBlok(0, b).z + JALAN / 2;
  const kotakR = (k0, k1, b0, b1, cw) => { const p = [[cx(k0), cz(b0)], [cx(k1), cz(b0)], [cx(k1), cz(b1)], [cx(k0), cz(b1)]]; return jalurPoligon(cw ? p : p.reverse(), { r: 9, L: 3.5 }); };
  const RUTE = [
    [kotakR(4, 76, 4, 46, true), 2], [kotakR(4, 76, 4, 46, false), 1],  // keliling negara
    [kotakR(12, 68, 12, 36, true), 1], [kotakR(12, 68, 12, 36, false), 1],
    [kotakR(20, 44, 16, 32, true), 1], [kotakR(36, 60, 18, 40, false), 1],
  ];
  let n = 0;
  for (const [J, jml] of RUTE) for (let i = 0; i < jml; i++) {
    const g = buatMobilPolisi(); grup.add(g);
    PATROLI.push({ g, J, s: J.total * (i / jml + n * 0.13) % J.total, v: 0, kec: 13 + (n % 3) * 2, fase: n * 0.37 }); n++;
  }
  for (const p of parkir || []) { const g = buatMobilPolisi(); g.position.set(p.x, 0.3, p.z); g.rotation.y = p.ry || 0; grup.add(g); PATROLI.push({ g, diam: true, fase: p.x * 0.01 }); }
  return grup;
}

export function perbaruiKeamanan(dt, t) {
  for (const p of PETUGAS) {
    const k = p.kar;
    if (p.mode === "siaga") { animasiHidup(k, t, true); const u = k.userData; if (u.lenganK) { u.lenganK.rotation.x = 0; u.lenganR.rotation.x = 0; } continue; }
    const L = Math.hypot(p.b.x - p.a.x, p.b.z - p.a.z);
    p.s += p.arah * p.v * dt; if (p.s > L) { p.s = L; p.arah = -1; } else if (p.s < 0) { p.s = 0; p.arah = 1; }
    const f = p.s / L, ux = (p.b.x - p.a.x) / L, uz = (p.b.z - p.a.z) / L;
    const x = p.a.x + ux * p.s - uz * p.dx, z = p.a.z + uz * p.s + ux * p.dx;
    const bob = animasiJalan(k, p.v * dt, dt); animasiHidup(k, t, false);
    k.position.set(x, 0.32 + bob * 0.06, z);
    const sas = Math.atan2(ux * p.arah, uz * p.arah); let d = sas - k.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; k.rotation.y += d * Math.min(1, dt * 6);
    void f;
  }
  for (const m of PATROLI) {
    const u = m.g.userData, blink = Math.floor((t + m.fase) * 6) % 2 === 0;
    u.merah.material.color.setHex(blink ? 0xff2020 : 0x400000); u.biru.material.color.setHex(blink ? 0x000040 : 0x2050ff);
    if (m.diam) continue;
    let vMaks = m.kec;
    const dB = jarakKeBelok(m.J, m.s + 3, 30); if (dB < 30) vMaks = Math.min(vMaks, 7 + dB * 0.4);
    const p = posJalur(m.J, m.s);
    vMaks = Math.min(vMaks, batasLampuMerah(p.x, p.z, p.hx, p.hz, 2.15 * SKALA_MOBIL, m.v));
    m.v += Math.sign(vMaks - m.v) * Math.min(Math.abs(vMaks - m.v), (vMaks < m.v ? 12 : 4) * dt);
    m.s = (m.s + m.v * dt) % m.J.total;
    const q = posJalur(m.J, m.s);
    const yawP = arahHalus(m.J, m.s, 2), gP = goyang(m.goy || (m.goy = {}), dt, yawP, m.v, SWAY.mobil, t);
    terapkanSway(m.g, q.x, 0.02 + (gP.naik || 0), q.z, yawP, gP.pitch, gP.rollTampil || 0, PIVOT_MOBIL, m.g.userData.sasis); // sway: bodi berayun, roda tegak
    u.rem.color.setHex(m.v < 0.5 || vMaks < m.v - 0.3 ? 0xff2a2a : 0x8a1212);
    const arah = arahSein(m.J, m.s, 24), nyala = arah !== 0 && kedip(t, m.fase);
    for (const s of u.seinM[1]) s.visible = nyala && arah > 0; for (const s of u.seinM[-1]) s.visible = nyala && arah < 0;
  }
}
