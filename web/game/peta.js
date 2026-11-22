/* Negara Merdu — modul game "peta" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Peta: minimap dan peta besar negara. */
import { $, BLOK_BARIS, BLOK_KOLOM, FASILITAS_BLOK, JALAN, KOTA_D, KOTA_W, PITCH, PUSAT_X, PUSAT_Z, RESERVASI, TAMAN, posisiKavling } from "./inti.js";
import { daftarRumah, dataPembangunan } from "./bersama.js";
import { diInterior } from "./rumah.js";
import { dr, fp, modeKamera, tp } from "./kamera.js";
import { sesi } from "./ui.js";
import { pemainOnline, titikAcuan } from "./jaringan.js";

  /* ================= MINIMAP + PETA BESAR =================
     Lapisan statis desa digambar SEKALI dari data grid yang sama dengan
     dunia 3D (blok perumahan, jalan, plaza, lahan & fasilitas), disimpan di
     canvas offscreen; per frame minimap cukup drawImage potongan di sekitar
     pemain + beberapa penanda — tidak menggambar ulang kota per frame.
     Peta utara-tetap: utara = -z; panah pemain berputar mengikuti hadap. */
  export const PETA_SKALA = 0.125;   // px peta per satuan dunia (lapisan minimap: 840x525)
  export const PETA_RAD = 300;       // radius pandang minimap (satuan dunia)
  export const WARNA_PETA = {
    luar: "#57a047", jalan: "#b39d72",
    plaza: "#bfae87", lahan: "#cbb489", fasilitas: "#2f8f6e",
    petak: "#9db873", // blok perumahan = petak lahan kosong; rumah warga = titik warna pemilik
  };
  export const FASILITAS_DI_BLOK = {}; // "kol,bar" -> kunci fasilitas
  for (const kunci in FASILITAS_BLOK) {
    const b = FASILITAS_BLOK[kunci];
    FASILITAS_DI_BLOK[b.kol + "," + b.bar] = kunci;
  }
  export function fasilitasTerbangun(kunci) {
    return dataPembangunan.some((f) => f.kunci === kunci && f.status === "terbangun");
  }
  export function gambarBlokPeta(c, skala) { // seluruh blok kota pada konteks c dengan skala px/satuan
    c.fillStyle = WARNA_PETA.jalan; c.fillRect(0, 0, KOTA_W * skala, KOTA_D * skala);
    const dalam = (PITCH - JALAN) * skala, geser = JALAN * skala;
    for (let bar = 0; bar < BLOK_BARIS; bar++) for (let kol = 0; kol < BLOK_KOLOM; kol++) {
      const kunci = kol + "," + bar;
      let warna;
      if (RESERVASI.has(kunci)) warna = WARNA_PETA.plaza;
      else if (TAMAN.has(kunci)) {
        const fk = FASILITAS_DI_BLOK[kunci];
        warna = fk && fasilitasTerbangun(fk) ? WARNA_PETA.fasilitas : WARNA_PETA.lahan;
      } else warna = WARNA_PETA.petak; // ATURAN RUMAH: blok perumahan digambar sebagai petak lahan — yang membedakan isinya adalah titik rumah warga dari data warga (digambar dinamis di atas lapisan ini)
      c.fillStyle = warna;
      c.fillRect(kol * PITCH * skala + geser, bar * PITCH * skala + geser, dalam, dalam);
    }
  }
  /* Titik rumah warga di peta: satu titik per rumah terisi di blok
     perumahan massal, warna = warna baju pemiliknya (sama seperti atap
     rumahnya di dunia 3D). Warga yang nomornya jatuh di blok RESERVASI/
     TAMAN tidak punya rumah massal (terwakili rumah detail distrik
     pusat), jadi tidak digambar di sini. Digambar dinamis (bukan di
     lapisan statis) supaya rumah warga yang baru daftar langsung tampil
     sesudah segarkanKota tanpa menggambar ulang lapisan. */
  export function titikRumahWarga(gambar) { // gambar(x, z, warnaCss)
    for (const w of daftarRumah) {
      const bi = w.blok - 1, kol = bi % BLOK_KOLOM, bar = Math.floor(bi / BLOK_KOLOM);
      const kunci = kol + "," + bar;
      if (RESERVASI.has(kunci) || TAMAN.has(kunci)) continue;
      const p = posisiKavling(w.blok, w.kavling);
      gambar(p.x, p.z, w.warna || "#ffffff");
    }
  }
  export function buatPetaStatis(skala) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(KOTA_W * skala); cv.height = Math.round(KOTA_D * skala);
    gambarBlokPeta(cv.getContext("2d"), skala);
    return cv;
  }
  export let petaStatisKecil = null, petaStatisBesar = null; // digambar malas sekali (sesudah data pembangunan termuat)
  export function duniaKePeta(x, z, skala) { // dunia -> piksel lapisan peta (murni)
    return { x: (x + KOTA_W / 2) * skala, y: (z + KOTA_D / 2) * skala };
  }
  export function duniaKeMinimap(wx, wz, px, pz, ukuran) { // dunia -> piksel minimap, pemain di tengah (murni)
    const k = ukuran / (2 * PETA_RAD);
    return { x: ukuran / 2 + (wx - px) * k, y: ukuran / 2 + (wz - pz) * k };
  }
  export function rotasiPanah(fx, fz) { return Math.atan2(fx, -fz); } // 0 = utara (murni)
  export function arahHadap() { // vektor hadap pemain per mode (untuk panah peta)
    if (modeKamera === "ketiga") return { fx: Math.sin(tp.hadap), fz: Math.cos(tp.hadap) };
    if (modeKamera === "drone") return { fx: -Math.sin(dr.yaw), fz: -Math.cos(dr.yaw) };
    return { fx: -Math.sin(fp.yaw), fz: -Math.cos(fp.yaw) };
  }
  export function lingkaranPeta(c, x, y, r, warna) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = warna; c.fill();
    c.lineWidth = r > 5 ? 2.4 : 1.8; c.strokeStyle = "#fff"; c.stroke();
  }
  export function panahPeta(c, x, y, rot, besar) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -besar); c.lineTo(besar * 0.65, besar * 0.8);
    c.lineTo(0, besar * 0.35); c.lineTo(-besar * 0.65, besar * 0.8);
    c.closePath();
    c.fillStyle = "#fff"; c.fill();
    c.lineWidth = besar * 0.22; c.strokeStyle = "#21332a"; c.stroke();
    c.restore();
  }
  export function berlianPeta(c, x, y, s, warna) { // penanda rumah sendiri (emas)
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    c.fillStyle = warna; c.fillRect(-s / 2, -s / 2, s, s);
    c.lineWidth = 1.8; c.strokeStyle = "#fff"; c.strokeRect(-s / 2, -s / 2, s, s);
    c.restore();
  }
  export const minimapEl = $("#minimap"), mmc = minimapEl.getContext("2d");
  export const MM = 240; // sisi kanvas minimap (px perangkat; CSS 120px)
  export function gambarMinimap() {
    if (minimapEl.hidden) return;
    if (!petaStatisKecil) petaStatisKecil = buatPetaStatis(PETA_SKALA);
    const a = titikAcuan();
    const c = mmc;
    c.fillStyle = WARNA_PETA.luar; c.fillRect(0, 0, MM, MM);
    /* Potongan lapisan statis di sekitar pemain; tepi peta dijepit manual
       (daerah luar kota tetap warna hamparan dari fill di atas). */
    const tengah = duniaKePeta(a.x, a.z, PETA_SKALA);
    const setengah = PETA_RAD * PETA_SKALA, penuh = setengah * 2;
    let sx = tengah.x - setengah, sy = tengah.y - setengah, sw = penuh, sh = penuh;
    let dx = 0, dy = 0, dw = MM, dh = MM;
    if (sx < 0) { dx = -sx / penuh * MM; dw -= dx; sw += sx; sx = 0; }
    if (sy < 0) { dy = -sy / penuh * MM; dh -= dy; sh += sy; sy = 0; }
    if (sx + sw > petaStatisKecil.width) { const lebih = sx + sw - petaStatisKecil.width; dw -= lebih / penuh * MM; sw -= lebih; }
    if (sy + sh > petaStatisKecil.height) { const lebih = sy + sh - petaStatisKecil.height; dh -= lebih / penuh * MM; sh -= lebih; }
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) c.drawImage(petaStatisKecil, sx, sy, sw, sh, dx, dy, dw, dh);
    const titik = (wx, wz) => duniaKeMinimap(wx, wz, a.x, a.z, MM);
    const dalam = (p) => p.x > -10 && p.x < MM + 10 && p.y > -10 && p.y < MM + 10;
    titikRumahWarga((wx, wz, warnaCss) => { // rumah warga: petak kecil sewarna pemiliknya
      const q = titik(wx, wz);
      if (dalam(q)) { c.fillStyle = warnaCss; c.fillRect(q.x - 1.7, q.y - 1.7, 3.4, 3.4); }
    });
    let p = titik(PUSAT_X, -34 + PUSAT_Z); // penanda istana negara di plaza
    if (dalam(p)) lingkaranPeta(c, p.x, p.y, 5, "#d9462e");
    if (sesi.saya) { // rumah sendiri: berlian emas
      const rp = posisiKavling(sesi.saya.blok, sesi.saya.kavling);
      p = titik(rp.x, rp.z);
      if (dalam(p)) berlianPeta(c, p.x, p.y, 10, "#f2b13d");
    }
    for (const pl of pemainOnline.values()) { // warga online lain: titik biru
      p = titik(pl.tx, pl.tz);
      if (dalam(p)) lingkaranPeta(c, p.x, p.y, 4, "#2f9df4");
    }
    const h = arahHadap();
    panahPeta(c, MM / 2, MM / 2, rotasiPanah(h.fx, h.fz), 10);
    c.fillStyle = "rgba(33,51,42,.8)"; // penanda utara
    c.font = "bold 15px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.fillText("U", MM / 2, 17);
  }
  export function gambarPetaBesar() { // seluruh kota pada overlay, digambar saat dibuka
    if (!petaStatisBesar) petaStatisBesar = buatPetaStatis(0.2);
    const cv = $("#peta-kanvas"), c = cv.getContext("2d");
    c.fillStyle = WARNA_PETA.luar; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(petaStatisBesar, 0, 0);
    const titik = (wx, wz) => duniaKePeta(wx, wz, 0.2);
    titikRumahWarga((wx, wz, warnaCss) => { // rumah warga: petak kecil sewarna pemiliknya
      const q = titik(wx, wz);
      c.fillStyle = warnaCss; c.fillRect(q.x - 2, q.y - 2, 4, 4);
    });
    let p = titik(PUSAT_X, -34 + PUSAT_Z);
    lingkaranPeta(c, p.x, p.y, 9, "#d9462e");
    c.fillStyle = "#21332a"; c.font = "bold 21px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText("Istana Negara", p.x + 15, p.y + 7);
    if (sesi.saya) {
      const rp = posisiKavling(sesi.saya.blok, sesi.saya.kavling);
      p = titik(rp.x, rp.z);
      berlianPeta(c, p.x, p.y, 15, "#f2b13d");
      c.fillStyle = "#21332a"; c.fillText("Rumahmu", p.x + 14, p.y + 7);
    }
    for (const pl of pemainOnline.values()) {
      p = titik(pl.tx, pl.tz);
      lingkaranPeta(c, p.x, p.y, 6, "#2f9df4");
    }
    const a = titikAcuan();
    p = titik(a.x, a.z);
    const h = arahHadap();
    panahPeta(c, p.x, p.y, rotasiPanah(h.fx, h.fz), 13);
  }
  /* Minimap tampil di mode jalan (1st/3rd) & drone; sembunyi di Orbit dan
     selama di interior. Di mode drone ia bergeser ke kiri tombol naik/turun. */
  export function perbaruiMinimapTampil() {
    minimapEl.hidden = diInterior || modeKamera === "orbit";
    minimapEl.style.right = modeKamera === "drone"
      ? "calc(86px + env(safe-area-inset-right, 0px))"
      : "calc(12px + env(safe-area-inset-right, 0px))";
  }
  minimapEl.addEventListener("click", () => { gambarPetaBesar(); $("#peta-besar").hidden = false; });
  $("#tutup-peta").addEventListener("click", () => { $("#peta-besar").hidden = true; });
  $("#peta-besar").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#peta-besar").hidden = true; });

