/* Negara Merdu — modul game "jalur": lintasan halus untuk kendaraan
   (bus, KRL, mobil arteri). Murni matematika (tanpa THREE/DOM).

   jalurPoligon(pusat, opsi) membangun lintasan TERTUTUP dari titik-titik
   as jalan (poligon, berurutan arah gerak):
     - tiap sudut dibulatkan (kurva Bezier kuadrat, jari-jari r di as),
     - lalu seluruh lintasan digeser L ke KIRI arah gerak (lajur kiri).
   Geseran sejajar membuat jari-jari belok lajur menyesuaikan sendiri:
   belok kiri lebih sempit (r - L), belok kanan lebih lebar (r + L),
   seperti kendaraan sungguhan. Lintasan disampel rapat (≤ langkah m)
   sehingga posisi & arah hadap berubah mulus — tidak ada lagi sudut patah
   yang membuat kendaraan "memutar di tempat".
   Tiap sampel menyimpan `belok` (0 lurus .. 1 tikungan) untuk pengereman. */

export function jalurPoligon(pusat, opsi) {
  const r = opsi.r, L = opsi.L || 0, langkah = opsi.langkah || 2;
  const n = pusat.length, as = [];
  const arah = (p, q) => { const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; };
  for (let i = 0; i < n; i++) {
    const a = pusat[(i - 1 + n) % n], c = pusat[i], b = pusat[(i + 1) % n], nx = pusat[(i + 2) % n];
    const d1 = arah(a, c), d2 = arah(c, b);
    // busur sudut c: t1 -> (c) -> t2
    const t1 = [c[0] - d1[0] * r, c[1] - d1[1] * r], t2 = [c[0] + d2[0] * r, c[1] + d2[1] * r];
    const NB = Math.max(6, Math.ceil((Math.PI * r / 2) / langkah));
    for (let k = 0; k < NB; k++) {
      const t = k / NB, u = 1 - t;
      as.push({ x: u * u * t1[0] + 2 * u * t * c[0] + t * t * t2[0], z: u * u * t1[1] + 2 * u * t * c[1] + t * t * t2[1], belok: 1 });
    }
    // ruas lurus t2 -> t1 sudut berikutnya
    const d3 = arah(b, nx), t1b = [b[0] - d2[0] * r, b[1] - d2[1] * r];
    void d3;
    const len = Math.hypot(t1b[0] - t2[0], t1b[1] - t2[1]), NS = Math.max(1, Math.ceil(len / langkah));
    for (let k = 0; k < NS; k++) { const t = k / NS; as.push({ x: t2[0] + (t1b[0] - t2[0]) * t, z: t2[1] + (t1b[1] - t2[1]) * t, belok: 0 }); }
  }
  // geser ke kiri arah gerak sejauh L (normal dari tetangga)
  const m = as.length, xs = new Float64Array(m), zs = new Float64Array(m), bel = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const p = as[(i - 1 + m) % m], q = as[(i + 1) % m];
    const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
    xs[i] = as[i].x + (dz / l) * L; zs[i] = as[i].z + (-dx / l) * L; // kiri(d) = (dz, -dx)
    bel[i] = as[i].belok;
  }
  const kum = new Float64Array(m + 1);
  for (let i = 0; i < m; i++) { const j = (i + 1) % m; kum[i + 1] = kum[i] + Math.hypot(xs[j] - xs[i], zs[j] - zs[i]); }
  return { xs, zs, bel, kum, n: m, total: kum[m] };
}

/* Posisi & arah pada jarak s (dibungkus modulo panjang lintasan). */
export function posJalur(J, s) {
  s = ((s % J.total) + J.total) % J.total;
  let lo = 0, hi = J.n - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (J.kum[mid] <= s) lo = mid; else hi = mid - 1; }
  const i = lo, j = (i + 1) % J.n, seg = J.kum[i + 1] - J.kum[i] || 1, f = (s - J.kum[i]) / seg;
  const hx = J.xs[j] - J.xs[i], hz = J.zs[j] - J.zs[i];
  return { x: J.xs[i] + hx * f, z: J.zs[i] + hz * f, hx, hz, belok: J.bel[i], i };
}

/* Arah hadap halus: dari titik s-a ke s+a (menghaluskan peralihan antarsampel). */
export function arahHalus(J, s, a) {
  const p = posJalur(J, s - (a || 2)), q = posJalur(J, s + (a || 2));
  return Math.atan2(q.x - p.x, q.z - p.z); // rotation.y untuk objek yang menghadap +z
}

/* Tikungan terdekat di depan (0 bila tidak ada dalam `jangkau` meter). */
export function jarakKeBelok(J, s, jangkau) {
  for (let d = 0; d <= jangkau; d += 2) if (posJalur(J, s + d).belok) return d;
  return Infinity;
}

export function sTerdekatJalur(J, x, z) {
  let terbaik = 0, dMin = Infinity;
  for (let i = 0; i < J.n; i++) { const d = (J.xs[i] - x) ** 2 + (J.zs[i] - z) ** 2; if (d < dMin) { dMin = d; terbaik = i; } }
  return J.kum[terbaik];
}

/* Arah sein: +1 belok KIRI, -1 belok KANAN, 0 lurus — dilihat dari arah
   hadap di s ke arah hadap `depan` meter di depan (menyalakan sein sebelum
   & selama tikungan). Kiri kendaraan yang menghadap (hx,hz) = (hz,-hx). */
export function arahSein(J, s, depan) {
  const a = posJalur(J, s), b = posJalur(J, s + (depan || 22));
  if (!a.belok && !b.belok) return 0;
  const la = Math.hypot(a.hx, a.hz) || 1, lb = Math.hypot(b.hx, b.hz) || 1;
  const silang = (a.hx / la) * (b.hz / lb) - (a.hz / la) * (b.hx / lb); // >0: belok ke kanan pada sistem x timur/z selatan
  if (Math.abs(silang) < 0.15) return 0;
  return silang > 0 ? -1 : 1;
}
/* Kedip sein ±1,5 Hz (nyala 55%). */
export function kedip(t, geser) { return ((t + (geser || 0)) * 1.5) % 1 < 0.55; }

/* ---------- GOYANGAN KENDARAAN (sway) — 26 Nov 2026 ----------
   Bodi kendaraan miring keluar saat menikung (gaya sentrifugal ~ v x laju
   belok), mengangguk saat mengerem / menyentak saat menggas, plus getar
   halus jalan. Pegas-redam membuatnya berayun lembut lalu tenang (bukan
   langsung patah). Dipakai bus, KRL, mobil lalu lintas & patroli.
   st: objek keadaan per kendaraan (disimpan pemanggil). Mengembalikan st
   dengan st.roll (rotasi z, + = sisi kiri/+x naik), st.pitch (rotasi x,
   + = moncong turun) dan st.naik (getar vertikal, meter). Pakai dengan
   rotation.order = "YXZ" supaya miring di sumbu lokal kendaraan. */
export const SWAY = {
  bus: { roll: 0.012, pitch: 0.006, maks: 0.075, k: 26, c: 5.5, getar: 0.016 },
  krl: { roll: 0.006, pitch: 0.0025, maks: 0.035, k: 18, c: 4.5, getar: 0.022 }, // getar besar = goyang rel
  mobil: { roll: 0.005, pitch: 0.0045, maks: 0.055, k: 38, c: 8, getar: 0.006 },
};
export function goyang(st, dt, yaw, v, p, t) {
  if (st.yaw === undefined) { st.yaw = yaw; st.v = v; st.roll = 0; st.pitch = 0; st.vr = 0; st.vp = 0; st.naik = 0; st.f = Math.random() * 10; return st; }
  if (!(dt > 0)) return st;
  let dy = yaw - st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  const lajuBelok = dy / dt, aLat = v * lajuBelok, aLong = (v - st.v) / dt;
  st.yaw = yaw; st.v = v;
  const mR = Math.max(-p.maks, Math.min(p.maks, aLat * p.roll));
  const mP = Math.max(-p.maks * 0.8, Math.min(p.maks * 0.8, -aLong * p.pitch));
  const h = Math.min(dt, 1 / 30); // langkah stabil
  st.vr += (p.k * (mR - st.roll) - p.c * st.vr) * h; st.roll += st.vr * h;
  st.vp += (p.k * (mP - st.pitch) - p.c * st.vp) * h; st.pitch += st.vp * h;
  const g = Math.min(1, Math.abs(v) / 10) * p.getar, tt = (t || 0) + st.f;
  st.naik = g * (Math.sin(tt * 13.1) * 0.6 + Math.sin(tt * 7.7) * 0.4);
  st.rollTampil = st.roll + g * 0.25 * Math.sin(tt * 9.3);
  return st;
}
