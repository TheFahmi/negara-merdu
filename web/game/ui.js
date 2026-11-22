/* Negara Merdu — modul game "ui" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   UI: wiring panel/menu, sesi + gerbang daftar/masuk, lengkapi profil, KTP, keluarga/KK, pemilu, dan panel pembangunan. */
import { $, IK, posisiKavling, teksRTRW, wilayahLengkap } from "./inti.js";
import { ambilData, perbaruiInfoWaktu, renderer, scene, setPilihanKualitas, setPilihanWaktu } from "./bersama.js";
import { bangunKotaMassal } from "./kota.js";
import { buatKarakter } from "./karakter.js";
import { bangunDistrik, diInterior, keluarInterior, masukInterior } from "./rumah.js";
import { fokusKe, fp, modeKamera, posisiDepanRumah, putarOtomatis, segarkanKarakterSaya, setPetunjukDitutup, setPutarOtomatis, target, tp } from "./kamera.js";
import { buangGrup, perbaruiStatusChat, sambungUlangWS } from "./jaringan.js";

  /* ================= UI ================= */
  $("#tombol-putar").addEventListener("click", function () {
    setPutarOtomatis(!putarOtomatis); this.classList.toggle("mati", !putarOtomatis);
    $("#putar-status").textContent = putarOtomatis ? "Nyala" : "Mati";
  });
  document.querySelectorAll("#seg-kualitas button").forEach((b) =>
    b.addEventListener("click", () => setPilihanKualitas(b.dataset.kualitas)));
  document.querySelectorAll("#seg-waktu button").forEach((b) =>
    b.addEventListener("click", () => setPilihanWaktu(b.dataset.waktu)));
  perbaruiInfoWaktu();
  $("#tombol-menu").addEventListener("click", () => { $("#panel-menu").hidden = !$("#panel-menu").hidden; });
  $("#tombol-tutup-menu").addEventListener("click", () => { $("#panel-menu").hidden = true; });
  $("#tutup-petunjuk").addEventListener("click", () => { setPetunjukDitutup(true); $("#petunjuk").hidden = true; });
  $("#tombol-akun").addEventListener("click", () => {
    if (sesi.saya) { fokusRumahSaya(); return; }
    $("#gerbang").hidden = false; tampilLangkah("nama");
  });
  $("#tombol-keluar").addEventListener("click", async () => {
    if (diInterior) keluarInterior(); // keluar rumah dulu sebelum sesi ditutup
    try { await fetch("/api/logout", { method: "POST", headers: { Authorization: "Bearer " + sesi.token } }); } catch (e) {}
    sesi.token = null; sesi.saya = null; dataKeluarga = null;
    localStorage.removeItem("pinarak_token");
    perbaruiChipSaya();
    sambungUlangWS(); // turun jadi tamu penonton
  });
  export function fokusRumahSaya() {
    if (!sesi.saya) return;
    if (diInterior) keluarInterior(); // jangan teleport keluar-masuk interior secara diam-diam
    const w = sesi.saya;
    const pos = posisiKavling(w.blok, w.kavling);
    fokusKe(pos.x, pos.z, 55);
    if (modeKamera === "orang" || modeKamera === "ketiga") { // kalau sedang jalan kaki, pindah langsung ke depan rumah sendiri
      const depan = posisiDepanRumah(w);
      fp.x = depan.x; fp.z = depan.z; fp.yaw = -Math.PI / 2; fp.pitch = 0;
      if (modeKamera === "ketiga") { tp.yaw = fp.yaw; tp.hadap = fp.yaw + Math.PI; tp.kamX = null; }
    }
    $("#kartu .isi").innerHTML = "<h3>" + IK.ktp + " Kartu Warga Negara</h3><p><b>@" + w.username + "</b><br>Rumah No. " + w.nomor_rumah +
      " · Blok " + w.blok + " Kavling " + w.kavling + "<br>" +
      teksWilayahPendek(w.wilayah || wilayahLengkap(w.blok)) + "<br>" +
      "Jenis Kelamin: " + labelGender(w.gender) + "<br>" +
      (w.jabatan ? "Jabatan: <b>" + w.jabatan + "</b><br>" : "") +
      "Kamera sedang menunjuk kavlingmu di kota.</p>" +
      '<button class="btn-masuk" id="btn-masuk-rumah" type="button">' + IK.pintu + ' Masuk Rumah Saya</button>' +
      '<button class="btn-masuk" id="btn-ktp-saya" type="button">' + IK.ktp + ' Lihat KTP</button>' +
      '<button class="btn-masuk" id="btn-keluarga-saya" type="button">' + IK.keluarga + ' Keluarga Saya</button>';
    $("#kartu").hidden = false;
    $("#btn-masuk-rumah").addEventListener("click", () => { $("#kartu").hidden = true; masukInterior(w, null); });
    $("#btn-ktp-saya").addEventListener("click", () => { $("#kartu").hidden = true; tampilkanKTP(); });
    $("#btn-keluarga-saya").addEventListener("click", () => { $("#kartu").hidden = true; bukaKeluarga(); });
  }
  export function teksWilayahPendek(wl) { // "RT 072/RW 10 · Kel. Harapanjaya · Kec. Merdu Barat · Kota Merdu"
    if (!wl) return "";
    return "RT " + String(wl.rt).padStart(3, "0") + "/RW " + String(wl.rw).padStart(2, "0") +
      " · Kel. " + wl.nama_kelurahan + " · Kec. " + wl.nama_kecamatan + " · " + (wl.nama_kota || "Kota Merdu");
  }
  export function perbaruiChipSaya() {
    const chip = $("#chip-saya");
    if (sesi.saya) {
      chip.hidden = false;
      $("#chip-saya-teks").textContent = "@" + sesi.saya.username + " · Blok " + sesi.saya.blok + " Kav. " + sesi.saya.kavling;
      $("#tombol-akun").textContent = "Kartu Saya";
    } else {
      chip.hidden = true;
      $("#tombol-akun").textContent = "Masuk / Daftar";
    }
    segarkanKarakterSaya(); // penampilan berubah (masuk/keluar) -> karakter 3rd Person mengikuti
    perbaruiStatusChat();
  }

  /* ================= SESI + GERBANG ================= */
  export const sesi = { token: localStorage.getItem("pinarak_token") || null, saya: null, pinDefault: false, genderKosong: false };
  export const form = { username: "", pin: "", gender: "", baju: "#2e9e5b", kulit: "#f1c27d", topi: "peci" };
  // Label tampil gender dari kode server ('L'/'P'); kosong -> "—".
  export function labelGender(g) { return g === "L" ? "Laki-laki" : g === "P" ? "Perempuan" : "—"; }
  export function tampilLangkah(nama) {
    document.querySelectorAll("#gerbang section").forEach((s) => { s.hidden = s.dataset.langkah !== nama; });
  }
  document.querySelectorAll("[data-ganti]").forEach((b) => b.addEventListener("click", () => tampilLangkah("nama")));
  $("#ke-login").addEventListener("click", () => tampilLangkah("login"));
  $("#form-nama").addEventListener("submit", (e) => {
    e.preventDefault();
    const u = $("#isi-nama").value.trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(u) || u.startsWith(".") || u.endsWith(".")) {
      $("#salah-nama").textContent = "Username tidak valid. Pakai huruf kecil, angka, titik, atau garis bawah.";
      return;
    }
    $("#salah-nama").textContent = ""; form.username = u; tampilLangkah("follow");
  });
  $("#sudah-follow").addEventListener("click", () => tampilLangkah("kartu"));
  $("#form-kartu").addEventListener("submit", (e) => {
    e.preventDefault();
    const p1 = $("#isi-pin").value, p2 = $("#isi-pin2").value;
    if (!/^\d{6}$/.test(p1)) { $("#salah-kartu").textContent = "PIN harus tepat 6 angka."; return; }
    if (p1 !== p2) { $("#salah-kartu").textContent = "PIN kedua tidak sama."; return; }
    $("#salah-kartu").textContent = ""; form.pin = p1; tampilLangkah("rupa");
  });
  export const WARNA_BAJU = ["#e74c3c", "#e67e22", "#f1c40f", "#2e9e5b", "#1abc9c", "#3498db", "#9b59b6", "#e84393", "#795548", "#607d8b"];
  export const WARNA_KULIT = ["#ffe0bd", "#f1c27d", "#e0ac69", "#c68642", "#8d5524"];
  export function buatSwatch(el, warnaList, kunci, obj) {
    const target = obj || form;
    warnaList.forEach((w) => {
      const b = document.createElement("button");
      b.type = "button"; b.style.background = w; b.dataset.warna = w;
      if (target[kunci] === w) b.classList.add("on");
      b.addEventListener("click", () => {
        target[kunci] = w;
        el.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on");
      });
      el.appendChild(b);
    });
  }
  // segarkanSwatch: sesuaikan tanda "on" swatch dengan nilai state saat ini
  // (dipakai modal lengkapi yang state-nya terisi dari data warga).
  export function segarkanSwatch(el, nilai) {
    el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.warna === nilai));
  }
  export function ikatSeg(el, obj, kunci, atribut) {
    el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      obj[kunci] = b.dataset[atribut];
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    }));
  }
  export function segarkanSeg(el, nilai, atribut) {
    el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset[atribut] === nilai));
  }
  buatSwatch($("#sw-baju"), WARNA_BAJU, "baju");
  buatSwatch($("#sw-kulit"), WARNA_KULIT, "kulit");
  ikatSeg($("#seg-topi"), form, "topi", "topi");
  ikatSeg($("#seg-gender"), form, "gender", "gender");
  export async function segarkanKota() {
    await ambilData();
    if (window.__kotaMassal) scene.remove(window.__kotaMassal.grup);
    window.__kotaMassal = bangunKotaMassal();
    bangunDistrik();
  }
  $("#daftar-kirim").addEventListener("click", async () => {
    if (form.gender !== "L" && form.gender !== "P") { $("#salah-rupa").textContent = "Pilih jenis kelamin dulu."; return; }
    $("#salah-rupa").textContent = "";
    const btn = $("#daftar-kirim"); btn.disabled = true; btn.textContent = "Membuat kartu…";
    try {
      const r = await fetch("/api/daftar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, pin: form.pin, gender: form.gender, warna_baju: form.baju, warna_kulit: form.kulit, topi: form.topi }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mendaftar");
      sesi.token = d.token; sesi.saya = d.warga; dataKeluarga = null;
      sesi.pinDefault = false; sesi.genderKosong = false;
      localStorage.setItem("pinarak_token", d.token);
      document.querySelector(".kw-user").textContent = "@" + d.warga.username;
      document.querySelector(".kw-rumah").textContent = "Rumah No. " + d.warga.nomor_rumah + " · Blok " + d.warga.blok + " Kavling " + d.warga.kavling;
      document.querySelector(".kw-gender").textContent = "Jenis Kelamin: " + labelGender(d.warga.gender);
      await segarkanKota(); perbaruiChipSaya();
      sambungUlangWS(); // tampil sebagai karakter + bisa chat
      tampilLangkah("jadi");
      // Sambutan Pak Presiden: hanya pendaftaran BARU yang menerima field
      // `sambutan` dari server (login tidak pernah memunculkan dialog ini).
      if (d.sambutan) {
        $("#sambutan-teks").textContent = d.sambutan;
        $("#sambutan-overlay").hidden = false;
      }
    } catch (err) { $("#salah-rupa").textContent = err.message; }
    btn.disabled = false; btn.textContent = "Buat Kartu Warga Negara";
  });
  $("#masuk-desa").addEventListener("click", () => { $("#gerbang").hidden = true; if (sesi.saya) fokusRumahSaya(); });
  $("#sambutan-masuk").addEventListener("click", () => {
    $("#sambutan-overlay").hidden = true;
    $("#gerbang").hidden = true;
    if (sesi.saya) fokusRumahSaya();
  });
  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = $("#login-nama").value.trim().replace(/^@/, "").toLowerCase();
    const p = $("#login-pin").value;
    try {
      const r = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, pin: p }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal masuk");
      sesi.token = d.token; sesi.saya = d.warga; dataKeluarga = null;
      sesi.pinDefault = !!d.pin_default; sesi.genderKosong = !!d.gender_kosong;
      localStorage.setItem("pinarak_token", d.token);
      await segarkanKota(); perbaruiChipSaya();
      sambungUlangWS(); // tampil sebagai karakter + bisa chat
      $("#gerbang").hidden = true;
      if (sesi.pinDefault || sesi.genderKosong) bukaLengkapi();
    } catch (err) { $("#salah-login").textContent = err.message; }
  });

  /* ================= LENGKAPI PROFIL =================
     Akun pra-daftar (dibuatkan sistem: PIN standar 123456, gender kosong)
     dan warga lama yang gender-nya belum terisi DISURUH melengkapi saat
     masuk: modal ini tidak bisa ditutup sebelum tersimpan — isinya PIN
     baru (hanya bila PIN masih bawaan), gender (wajib), dan penampilan
     (terisi awal dari data sekarang). Simpan -> POST /api/lengkapi. */
  export const lengkap = { gender: "", baju: "#2e9e5b", kulit: "#f1c27d", topi: "peci" };
  buatSwatch($("#sw-baju-l"), WARNA_BAJU, "baju", lengkap);
  buatSwatch($("#sw-kulit-l"), WARNA_KULIT, "kulit", lengkap);
  ikatSeg($("#seg-topi-l"), lengkap, "topi", "topi");
  ikatSeg($("#seg-gender-l"), lengkap, "gender", "gender");
  export function bukaLengkapi() {
    const w = sesi.saya; if (!w) return;
    lengkap.gender = w.gender || "";
    lengkap.baju = w.warna_baju; lengkap.kulit = w.warna_kulit; lengkap.topi = w.topi;
    segarkanSeg($("#seg-gender-l"), lengkap.gender, "gender");
    segarkanSeg($("#seg-topi-l"), lengkap.topi, "topi");
    segarkanSwatch($("#sw-baju-l"), lengkap.baju);
    segarkanSwatch($("#sw-kulit-l"), lengkap.kulit);
    $("#lengkapi-pin-grup").hidden = !sesi.pinDefault;
    $("#lengkapi-pin").value = ""; $("#lengkapi-pin2").value = "";
    $("#salah-lengkapi").textContent = "";
    $("#lengkapi-teks").textContent = sesi.pinDefault
      ? "Akunmu dibuatkan lebih dulu oleh sistem dengan PIN standar. Ganti PIN-mu dan lengkapi profil di bawah ini sebelum jalan-jalan di negara."
      : "Satu langkah lagi: lengkapi profilmu di bawah ini sebelum jalan-jalan di negara.";
    $("#lengkapi-overlay").hidden = false;
  }
  $("#lengkapi-kirim").addEventListener("click", async () => {
    if (lengkap.gender !== "L" && lengkap.gender !== "P") { $("#salah-lengkapi").textContent = "Pilih jenis kelamin dulu."; return; }
    const body = { gender: lengkap.gender, warna_baju: lengkap.baju, warna_kulit: lengkap.kulit, topi: lengkap.topi };
    if (sesi.pinDefault) {
      const p1 = $("#lengkapi-pin").value, p2 = $("#lengkapi-pin2").value;
      if (!/^\d{6}$/.test(p1)) { $("#salah-lengkapi").textContent = "PIN baru harus tepat 6 angka."; return; }
      if (p1 !== p2) { $("#salah-lengkapi").textContent = "PIN kedua tidak sama."; return; }
      body.pin_baru = p1;
    }
    const btn = $("#lengkapi-kirim"); btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      const r = await fetch("/api/lengkapi", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + sesi.token },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan");
      sesi.saya = d.warga; dataKeluarga = null;
      sesi.pinDefault = !!d.pin_default; sesi.genderKosong = !!d.gender_kosong;
      $("#lengkapi-overlay").hidden = true;
      await segarkanKota(); perbaruiChipSaya();
      sambungUlangWS(); // penampilan baru tampil ke warga lain
      if (sesi.saya) fokusRumahSaya();
    } catch (err) { $("#salah-lengkapi").textContent = err.message; }
    btn.disabled = false; btn.textContent = "Simpan & Masuk Negara";
  });

  /* ================= KTP NEGARA MERDU =================
     Kartu landscape biru muda gaya KTP: NIK + @username + alamat Blok/Kavling
     + No. Rumah + tanggal terdaftar + "Berlaku: Seumur Hidup", foto karakter
     di kanan. Semua data dari sesi pemiliknya sendiri (server hanya memberi
     NIK lengkap ke pemiliknya). Tampilan = DOM/CSS (#ktp-overlay); unduhan
     PNG digambar ulang ke canvas 2D. Foto di kedua tempat adalah RENDER 3D
     ASLI model karakter warga itu (lihat renderFoto3D di bawah), dan NIK
     ditampilkan berkelompok 4 digit supaya tidak pecah baris. */
  export const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"];
  export function formatTanggalID(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "—";
    const bln = BULAN_ID[parseInt(m[2], 10) - 1];
    if (!bln) return "—";
    return parseInt(m[3], 10) + " " + bln + " " + m[1];
  }
  /* Nomor kartu (NIK / No. KK) ditampilkan berkelompok 4 digit supaya
     terbaca sekilas dan tidak pecah di tengah angka: "3201261120000001"
     -> "3201 2611 2000 0001". Nilai mentah dari server tidak diubah,
     hanya tampilan. Masukan bukan deretan angka panjang dikembalikan
     apa adanya (mis. "—"). */
  export function kelompokkanNomor(n) {
    const s = String(n == null ? "" : n).replace(/\s+/g, "");
    if (!/^\d{5,}$/.test(s)) return n == null || n === "" ? "—" : String(n);
    return s.replace(/(\d{4})(?=\d)/g, "$1 ");
  }
  export function jalurBulat(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
  /* ================= FOTO KARAKTER 3D UNTUK KARTU =================
     Foto di KTP (tampilan maupun unduhan PNG) adalah RENDER 3D ASLI dari
     model karakter low-poly warga itu sendiri — buatKarakter() dibangun
     dari data penampilannya — bukan lagi gambar 2D datar. Renderer kecil
     terpisah dibuat SEKALI (konteks WebGL tambahan hanya satu) lalu
     dipakai ulang untuk semua render; hasilnya di-cache per penampilan
     sehingga penampilan yang sama tidak dirender berulang. Bingkai =
     potret dada-ke-atas: kamera di depan wajah (sisi +z arah hadap),
     karakter diam, latar krem polos warna kartu, cahaya meniru desa
     (hemisphere hangat + directional). Bila WebGL/render gagal, kartu
     memakai placeholder krem polos (BUKAN gambar 2D lama) dan kartu
     tetap bisa dibuka. */
  export let panggungFoto = null;       // { renderer, scene, kamera } — dibuat malas, dipakai ulang
  export const cacheFoto3D = new Map(); // kunci penampilan -> dataURL PNG hasil render
  export function kunciRupa(rupa) {
    return [(rupa && rupa.warna_baju) || "", (rupa && rupa.warna_kulit) || "", (rupa && rupa.topi) || ""].join("|");
  }
  export function siapkanPanggungFoto() {
    if (panggungFoto) return panggungFoto;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(320, 440);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5ecd7); // krem polos warna bingkai foto kartu
    scene.add(new THREE.HemisphereLight(0xffe7c4, 0x86a860, 0.62)); // cahaya yang sama seperti di desa
    const mentari = new THREE.DirectionalLight(0xffc384, 1.15);
    mentari.position.set(-2.4, 3.2, 2.6); // hangat dari kiri-atas-depan wajah
    scene.add(mentari);
    const kamera = new THREE.PerspectiveCamera(38, 320 / 440, 0.1, 20);
    kamera.position.set(0, 1.54, 1.9);
    kamera.lookAt(0, 1.44, 0); // bingkai kepala + bahu (karakter diam, tanpa animasi)
    panggungFoto = { renderer, scene, kamera };
    return panggungFoto;
  }
  /* Render satu karakter menjadi dataURL potret. Mengembalikan null
     bila gagal — pemanggil memakai placeholder polos. */
  export function renderFoto3D(rupa) {
    const kunci = kunciRupa(rupa);
    if (cacheFoto3D.has(kunci)) return cacheFoto3D.get(kunci);
    let kar = null;
    try {
      const p = siapkanPanggungFoto();
      kar = buatKarakter({
        baju: (rupa && rupa.warna_baju) || "#2e9e5b",
        kulit: (rupa && rupa.warna_kulit) || "#f1c27d",
        topi: (rupa && rupa.topi) || "tanpa",
      });
      p.scene.add(kar);
      p.renderer.render(p.scene, p.kamera);
      const url = p.renderer.domElement.toDataURL("image/png");
      cacheFoto3D.set(kunci, url);
      return url;
    } catch (e) {
      return null; // fallback: placeholder polos, kartu tetap tampil
    } finally {
      if (kar && panggungFoto) { panggungFoto.scene.remove(kar); buangGrup(kar); }
    }
  }
  /* Lukis foto kartu ke konteks 2D pada kotak (x, y, w, h): selalu mulai
     dari placeholder krem polos, lalu foto 3D ditimpa begitu gambarnya
     siap dimuat. selesai() dipanggil tepat sekali di semua jalur
     (dipakai unduhan PNG yang harus menunggu foto selesai digambar). */
  export function lukisFotoKartu(c, x, y, w, h, rupa, selesai) {
    const grad = c.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, "#f9f1de"); grad.addColorStop(1, "#eddfba");
    c.fillStyle = grad; c.fillRect(x, y, w, h);
    let sudah = false;
    const beres = () => { if (!sudah) { sudah = true; if (selesai) selesai(); } };
    const url = renderFoto3D(rupa);
    if (!url) { beres(); return; }
    const img = new Image();
    img.onload = () => { try { c.drawImage(img, x, y, w, h); } catch (e) {} beres(); };
    img.onerror = beres;
    img.src = url;
  }
  export function tampilkanKTP() {
    const w = sesi.saya; if (!w) return;
    $("#ktp-nik").textContent = kelompokkanNomor(w.nik);
    $("#ktp-nama").textContent = "@" + w.username;
    $("#ktp-gender").textContent = labelGender(w.gender); // "—" bila belum dilengkapi
    const wl = w.wilayah || wilayahLengkap(w.blok); // server mengirim wilayah; cadangan dihitung klien
    $("#ktp-alamat").textContent = "No. " + w.nomor_rumah + ", Blok " + w.blok + " Kav. " + w.kavling;
    $("#ktp-rtrw").textContent = teksRTRW(wl);
    $("#ktp-kelurahan").textContent = wl.nama_kelurahan;
    $("#ktp-kecamatan").textContent = wl.nama_kecamatan;
    $("#ktp-terdaftar").textContent = formatTanggalID(w.terdaftar);
    $("#ktp-baris-jabatan").hidden = !w.jabatan; // baris Jabatan hanya untuk pejabat aktif
    $("#ktp-jabatan").textContent = w.jabatan || "—";
    const cv = $("#ktp-foto-kanvas");
    const c = cv.getContext("2d");
    c.clearRect(0, 0, cv.width, cv.height);
    lukisFotoKartu(c, 0, 0, cv.width, cv.height, w); // placeholder dulu, render 3D menimpa begitu siap
    $("#ktp-overlay").hidden = false;
  }
  /* Tulis teks nilai kartu di PNG dengan huruf yang menyusut otomatis
     sampai muat di lebar kolomnya — nilai panjang (NIK berkelompok,
     username panjang) tidak pernah meluber keluar panel. */
  export function teksPas(c, teks, x, y, font, lebarMaks) {
    c.font = font;
    const m = /([\d.]+)px/.exec(font);
    let ukuran = m ? parseFloat(m[1]) : 32;
    while (ukuran > 18 && c.measureText(teks).width > lebarMaks) {
      ukuran -= 2;
      c.font = font.replace(/[\d.]+px/, ukuran + "px");
    }
    c.fillText(teks, x, y);
  }
  /* Gambar ulang KTP yang sama ke kanvas besar untuk diunduh (PNG).
     Semua teks persis dari data server milik sesi ini. Mengembalikan
     Promise<canvas> karena foto 3D harus selesai digambar dulu. */
  export function gambarKTPKeCanvas(w) {
    return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.width = 1200; cv.height = 756;
    const c = cv.getContext("2d");
    const grad = c.createLinearGradient(0, 0, 1200, 756);
    grad.addColorStop(0, "#c4e5f8"); grad.addColorStop(1, "#93c9ef");
    jalurBulat(c, 0, 0, 1200, 756, 36); c.fillStyle = grad; c.fill();
    c.save(); jalurBulat(c, 0, 0, 1200, 756, 36); c.clip();
    c.strokeStyle = "rgba(29,78,121,0.07)"; c.lineWidth = 2; // pola kontur halus
    for (const [ex, ey, er] of [[1120, 720, 130], [1120, 720, 190], [1120, 720, 250], [40, 30, 120], [40, 30, 185]]) {
      c.beginPath(); c.ellipse(ex, ey, er, er * 0.62, 0, 0, Math.PI * 2); c.stroke();
    }
    // lambang rumah emas
    const eg = c.createLinearGradient(0, 48, 0, 158);
    eg.addColorStop(0, "#f6cd6b"); eg.addColorStop(1, "#dd9a26");
    c.save(); c.translate(58, 48); c.scale(110 / 64, 110 / 64);
    c.beginPath();
    c.moveTo(32, 4); c.lineTo(60, 28); c.lineTo(52, 28); c.lineTo(52, 58); c.lineTo(38, 58);
    c.lineTo(38, 42); c.lineTo(26, 42); c.lineTo(26, 58); c.lineTo(12, 58); c.lineTo(12, 28);
    c.lineTo(4, 28); c.closePath();
    c.fillStyle = eg; c.fill(); c.strokeStyle = "#b97e14"; c.lineWidth = 1.4; c.stroke();
    c.restore();
    c.fillStyle = "#123058"; c.textBaseline = "alphabetic";
    c.font = "800 55px system-ui, sans-serif";
    c.fillText("KARTU TANDA PENDUDUK", 196, 118);
    c.font = "700 36px system-ui, sans-serif"; c.fillStyle = "#1d5a8f";
    try { c.letterSpacing = "8px"; } catch (e) {}
    c.fillText("NEGARA MERDU · KOTA MERDU", 198, 166);
    try { c.letterSpacing = "0px"; } catch (e) {}
    // panel data (kolom nilai mulai x=316, panel berakhir x=800)
    jalurBulat(c, 58, 200, 742, 404, 20); c.fillStyle = "rgba(255,255,255,0.45)"; c.fill();
    const wlK = w.wilayah || wilayahLengkap(w.blok);
    const baris = [
      ["NIK", kelompokkanNomor(w.nik), "700 39px system-ui, sans-serif"],
      ["Nama", "@" + w.username, "700 32px system-ui, sans-serif"],
      ["Jenis Kelamin", labelGender(w.gender), "700 32px system-ui, sans-serif"],
      ["Alamat", "No. " + w.nomor_rumah + ", Blok " + w.blok + " Kav. " + w.kavling, "700 32px system-ui, sans-serif"],
      ["RT/RW", teksRTRW(wlK), "700 32px system-ui, sans-serif"],
      ["Kel/Desa", wlK.nama_kelurahan, "700 32px system-ui, sans-serif"],
      ["Kecamatan", wlK.nama_kecamatan, "700 32px system-ui, sans-serif"],
      ["Terdaftar", formatTanggalID(w.terdaftar), "700 32px system-ui, sans-serif"],
      ["Berlaku", "Seumur Hidup", "700 32px system-ui, sans-serif"],
    ];
    if (w.jabatan) baris.splice(8, 0, ["Jabatan", w.jabatan, "700 32px system-ui, sans-serif"]);
    // Jarak baris bertingkat supaya semua baris tetap di dalam panel
    // (panel y 200..604): <=6 baris longgar, 7 rapat, 8+ paling rapat.
    let yAwal = 268, langkahY = 62;
    if (baris.length === 7) { yAwal = 258; langkahY = 54; }
    else if (baris.length === 8) { yAwal = 248; langkahY = 48; }
    else if (baris.length >= 9) { yAwal = 240; langkahY = Math.floor(370 / (baris.length - 1)); } // 9-10 baris (RT/RW, Kel, Kec)
    baris.forEach(([label, nilai, font], i) => {
      const yy = yAwal + i * langkahY;
      c.font = "600 30px system-ui, sans-serif"; c.fillStyle = "#1d4e79";
      c.fillText(label, 92, yy);
      c.fillStyle = "#102c4c";
      teksPas(c, nilai, 316, yy, font, 800 - 316 - 22);
    });
    // pita kaki (digambar sebelum foto; tidak tumpang tindih dengan kotak foto)
    const kaki = "NEGARA MERDU · KARTU TANDA PENDUDUK · @negaramerdu";
    c.font = "700 21px system-ui, sans-serif";
    const lebarKaki = c.measureText(kaki).width + 52;
    jalurBulat(c, 58, 644, lebarKaki, 48, 24); c.fillStyle = "rgba(29,78,121,0.88)"; c.fill();
    c.fillStyle = "#eaf4fc"; c.fillText(kaki, 84, 676);
    // kotak foto + render 3D karakter (placeholder krem bila render gagal)
    c.font = "700 24px system-ui, sans-serif"; c.fillStyle = "#123058";
    c.textAlign = "right"; c.fillText("FOTO", 1142, 182); c.textAlign = "left";
    c.save(); jalurBulat(c, 836, 200, 306, 404, 18); c.clip();
    lukisFotoKartu(c, 836, 200, 306, 404, w, () => {
      c.restore();
      jalurBulat(c, 836, 200, 306, 404, 18); c.strokeStyle = "#1d4e79"; c.lineWidth = 5; c.stroke();
      c.restore();
      resolve(cv);
    });
    });
  }
  export async function unduhKTP() {
    if (!sesi.saya) return;
    const cv = await gambarKTPKeCanvas(sesi.saya);
    cv.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ktp-pinarak-" + sesi.saya.username + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  }
  $("#tutup-ktp").addEventListener("click", () => { $("#ktp-overlay").hidden = true; });
  $("#unduh-ktp").addEventListener("click", unduhKTP);
  $("#lihat-ktp-jadi").addEventListener("click", tampilkanKTP);
  $("#ktp-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#ktp-overlay").hidden = true; });

  /* ================= KELUARGA + KARTU KELUARGA =================
     Tiap warga digabungkan server secara ACAK ke satu keluarga (maks 5):
     pendiri = Kepala Keluarga, sisanya Anggota — hanya dua peran itu.
     Data keluarga (termasuk NIK semua anggota, seperti KK asli) hanya
     dikirim server ke anggota keluarga itu sendiri lewat sesi
     (/api/keluarga-saya). Panel "Keluarga Saya" menampilkan No. KK +
     daftar anggota; Kartu Keluarga digambar DOM/CSS (#kk-overlay) dan
     bisa diunduh sebagai PNG (digambar ulang ke canvas, pola KTP). */
  export let dataKeluarga = null;   // cache respons /api/keluarga-saya untuk sesi ini
  export const BULAN_SINGKAT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  export function formatTanggalSingkatID(iso) { // "2026-11-20" -> "20 Nov 2026" (gaya tabel KK)
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "—";
    const bln = BULAN_SINGKAT_ID[parseInt(m[2], 10) - 1];
    if (!bln) return "—";
    return parseInt(m[3], 10) + " " + bln + " " + m[1];
  }
  export async function ambilKeluarga() {
    if (!sesi.token) return null;
    try {
      const r = await fetch("/api/keluarga-saya", { headers: { Authorization: "Bearer " + sesi.token } });
      if (!r.ok) return null;
      dataKeluarga = (await r.json()).keluarga || null;
    } catch (e) { /* dataKeluarga tetap seperti sebelumnya */ }
    return dataKeluarga;
  }
  export function barisInfoKeluarga(label, nilai) {
    const div = document.createElement("div");
    const s = document.createElement("span"); s.textContent = label;
    const b = document.createElement("b"); b.textContent = nilai;
    div.append(s, b);
    return div;
  }
  export async function bukaKeluarga() {
    if (!sesi.saya) return;
    $("#panel-menu").hidden = true;
    const isi = $("#keluarga-isi");
    isi.innerHTML = '<p class="keluarga-muat">Memuat data keluarga…</p>';
    $("#keluarga-overlay").hidden = false;
    const d = await ambilKeluarga();
    isi.innerHTML = "";
    if (!d) {
      isi.innerHTML = '<p class="keluarga-muat">Data keluarga belum tersedia. Coba lagi sebentar lagi ya.</p>';
      return;
    }
    const info = document.createElement("div"); info.className = "keluarga-info";
    info.append(
      barisInfoKeluarga("No. KK", kelompokkanNomor(d.no_kk)),
      barisInfoKeluarga("Kepala Keluarga", "@" + d.kepala),
      barisInfoKeluarga("Alamat", "Blok " + d.alamat.blok + " · Kavling " + d.alamat.kavling)
    );
    isi.appendChild(info);
    const peran = document.createElement("p"); peran.className = "keluarga-peran";
    peran.textContent = d.kamu.peran === "Kepala Keluarga"
      ? "Kamu adalah Kepala Keluarga di keluarga ini."
      : "Kamu adalah Anggota — kepala keluargamu @" + d.kepala + ".";
    isi.appendChild(peran);
    const daftarEl = document.createElement("div"); daftarEl.className = "keluarga-anggota";
    d.anggota.forEach((a) => {
      const baris = document.createElement("div"); baris.className = "anggota-baris";
      const siapa = document.createElement("div"); siapa.className = "siapa";
      const nama = document.createElement("b");
      nama.textContent = "@" + a.username + (sesi.saya && a.username === sesi.saya.username ? " (Kamu)" : "");
      const sub = document.createElement("div");
      sub.textContent = "Rumah No. " + a.nomor_rumah + " · Blok " + a.blok + " Kavling " + a.kavling;
      siapa.append(nama, sub);
      const chip = document.createElement("span");
      chip.className = "peran-chip" + (a.peran === "Kepala Keluarga" ? " kepala" : "");
      chip.textContent = a.peran;
      baris.append(siapa, chip);
      daftarEl.appendChild(baris);
    });
    isi.appendChild(daftarEl);
  }
  export function tampilkanKK() {
    const d = dataKeluarga; if (!d) return;
    $("#kk-nokk").textContent = kelompokkanNomor(d.no_kk);
    $("#kk-kepala").textContent = "@" + d.kepala;
    $("#kk-alamat").textContent = "Blok " + d.alamat.blok + " · Kavling " + d.alamat.kavling;
    const wlKK = wilayahLengkap(d.alamat.blok);
    $("#kk-rtrw").textContent = teksRTRW(wlKK);
    $("#kk-kelurahan").textContent = wlKK.nama_kelurahan;
    $("#kk-kecamatan").textContent = wlKK.nama_kecamatan;
    $("#kk-kota").textContent = wlKK.nama_kota + " · Negara Merdu";
    const tb = $("#kk-tbody"); tb.innerHTML = "";
    d.anggota.forEach((a, i) => {
      const tr = document.createElement("tr");
      [String(i + 1), "@" + a.username, kelompokkanNomor(a.nik), a.peran, formatTanggalSingkatID(a.terdaftar)]
        .forEach((teks) => {
          const td = document.createElement("td"); td.textContent = teks; tr.appendChild(td);
        });
      tb.appendChild(tr);
    });
    $("#kk-ttd-kepala").textContent = "@" + d.kepala;
    $("#kk-overlay").hidden = false;
  }
  /* Gambar ulang Kartu Keluarga ke kanvas portrait untuk diunduh (PNG).
     Semua teks persis dari data server keluarga sesi ini. */
  export function gambarKKKeCanvas(d) {
    const cv = document.createElement("canvas"); cv.width = 1100; cv.height = 1460;
    const c = cv.getContext("2d");
    c.fillStyle = "#ffffff"; c.fillRect(0, 0, 1100, 1460);
    c.strokeStyle = "#1d5a8f"; c.lineWidth = 5; c.strokeRect(26, 26, 1048, 1408);
    // pita kepala biru muda + lambang rumah emas
    const grad = c.createLinearGradient(0, 26, 0, 200);
    grad.addColorStop(0, "#bcdcf5"); grad.addColorStop(1, "#93c9ef");
    c.fillStyle = grad; c.fillRect(29, 29, 1042, 168);
    c.strokeStyle = "#1d5a8f"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(29, 197); c.lineTo(1071, 197); c.stroke();
    const eg = c.createLinearGradient(0, 56, 0, 172);
    eg.addColorStop(0, "#f6cd6b"); eg.addColorStop(1, "#dd9a26");
    c.save(); c.translate(66, 56); c.scale(116 / 64, 116 / 64);
    c.beginPath();
    c.moveTo(32, 4); c.lineTo(60, 28); c.lineTo(52, 28); c.lineTo(52, 58); c.lineTo(38, 58);
    c.lineTo(38, 42); c.lineTo(26, 42); c.lineTo(26, 58); c.lineTo(12, 58); c.lineTo(12, 28);
    c.lineTo(4, 28); c.closePath();
    c.fillStyle = eg; c.fill(); c.strokeStyle = "#b97e14"; c.lineWidth = 1.4; c.stroke();
    c.restore();
    c.textAlign = "center"; c.fillStyle = "#123058";
    c.font = "800 56px system-ui, sans-serif";
    c.fillText("KARTU KELUARGA", 580, 108);
    c.font = "700 33px system-ui, sans-serif"; c.fillStyle = "#1d5a8f";
    try { c.letterSpacing = "7px"; } catch (e) {}
    c.fillText("NEGARA MERDU", 580, 160);
    try { c.letterSpacing = "0px"; } catch (e) {}
    c.textAlign = "left";
    // info kepala dokumen
    const infoKK = [
      ["No. KK", kelompokkanNomor(d.no_kk)],
      ["Kepala Keluarga", "@" + d.kepala],
      ["Alamat", "Blok " + d.alamat.blok + " · Kavling " + d.alamat.kavling + " · Negara Merdu"],
    ];
    infoKK.forEach(([label, nilai], i) => {
      const yy = 268 + i * 54;
      c.font = "600 29px system-ui, sans-serif"; c.fillStyle = "#1d4e79";
      c.fillText(label, 74, yy);
      c.font = "700 30px system-ui, sans-serif"; c.fillStyle = "#102c4c";
      c.fillText(nilai, 400, yy);
    });
    // tabel anggota
    const tx = 74, tw = 952, kolom = [64, 246, 292, 186, 164]; // No, Nama, NIK, Hubungan, Terdaftar
    let ty = 452;
    c.fillStyle = "#4a86c5"; c.fillRect(tx, ty, tw, 58);
    c.fillStyle = "#ffffff"; c.font = "700 24px system-ui, sans-serif";
    let kx = tx;
    ["No", "Nama", "NIK", "Hubungan", "Terdaftar"].forEach((h, i) => {
      c.fillText(h, kx + 14, ty + 38); kx += kolom[i];
    });
    ty += 58;
    d.anggota.forEach((a, i) => {
      if (i % 2 === 1) { c.fillStyle = "#eef4fa"; c.fillRect(tx, ty, tw, 56); }
      c.fillStyle = "#102c4c"; c.font = "600 24px system-ui, sans-serif";
      const sel = [String(i + 1), "@" + a.username, kelompokkanNomor(a.nik), a.peran, formatTanggalSingkatID(a.terdaftar)];
      let cx2 = tx;
      sel.forEach((teks, j) => { c.fillText(teks, cx2 + 14, ty + 37); cx2 += kolom[j]; });
      ty += 56;
    });
    c.strokeStyle = "rgba(29,78,121,.45)"; c.lineWidth = 1.5;
    c.strokeRect(tx, 452, tw, ty - 452);
    let gx = tx;
    kolom.slice(0, -1).forEach((w) => {
      gx += w; c.beginPath(); c.moveTo(gx, 452); c.lineTo(gx, ty); c.stroke();
    });
    for (let yy = 452 + 58; yy < ty; yy += 56) {
      c.beginPath(); c.moveTo(tx, yy); c.lineTo(tx + tw, yy); c.stroke();
    }
    c.beginPath(); c.moveTo(tx, 510); c.lineTo(tx + tw, 510); c.stroke();
    // tanda tangan
    const ttdY = ty + 120;
    c.textAlign = "center";
    [[300, "Kepala Keluarga", "@" + d.kepala], [800, "Presiden Negara Merdu", "Pak Presiden"]].forEach(([cx3, label, nama]) => {
      c.font = "600 24px system-ui, sans-serif"; c.fillStyle = "#44584c";
      c.fillText(label, cx3, ttdY);
      c.strokeStyle = "#44584c"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx3 - 130, ttdY + 96); c.lineTo(cx3 + 130, ttdY + 96); c.stroke();
      c.font = "700 26px system-ui, sans-serif"; c.fillStyle = "#102c4c";
      c.fillText(nama, cx3, ttdY + 132);
    });
    c.font = "700 20px system-ui, sans-serif"; c.fillStyle = "#1d5a8f";
    try { c.letterSpacing = "3px"; } catch (e) {}
    c.fillText("NEGARA MERDU · KARTU KELUARGA · @negaramerdu", 550, 1388);
    try { c.letterSpacing = "0px"; } catch (e) {}
    c.textAlign = "left";
    return cv;
  }
  export function unduhKK() {
    if (!dataKeluarga) return;
    const d = dataKeluarga;
    gambarKKKeCanvas(d).toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "kk-pinarak-" + d.no_kk + ".png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  }
  $("#tombol-keluarga").addEventListener("click", bukaKeluarga);
  $("#tutup-keluarga").addEventListener("click", () => { $("#keluarga-overlay").hidden = true; });
  $("#keluarga-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#keluarga-overlay").hidden = true; });
  $("#lihat-kk").addEventListener("click", async () => { if (!dataKeluarga) await ambilKeluarga(); if (dataKeluarga) tampilkanKK(); });
  $("#tutup-kk").addEventListener("click", () => { $("#kk-overlay").hidden = true; });
  $("#unduh-kk").addEventListener("click", unduhKK);
  $("#kk-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#kk-overlay").hidden = true; });

  /* ================= PEMILU: KETUA RT / RW / KEPALA DESA =================
     Panel "Pemilu" (tombol di panel menu). Semua data dari GET
     /api/pemilu: pejabat aktif, balapan Presiden + RT/RW wilayah si
     peminta (bila login), hitungan suara berjalan + persen. Wilayah RT/RW
     SELALU dihitung server dari blok rumah warga — klien hanya menampilkan.
     Mencalonkan (POST /api/pemilu/calon, wajib visi & misi) dan memilih
     (POST /api/pemilu/pilih) wajib sesi; tamu hanya melihat. Semua teks
     dari warga (username, visi, misi) ditulis via textContent — anti-XSS. */
  export const TEKS_FASE_PEMILU = {
    pencalonan: "Fase pencalonan sedang dibuka — warga bisa mencalonkan diri dengan visi & misi.",
    pemungutan: "Pemungutan suara sedang berlangsung — pilih kandidat di wilayahmu.",
    selesai: "Pemilu periode ini sudah selesai. Pemenangnya sudah ditetapkan.",
  };
  export function elemenPemilu(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  export function formatAngkaID(n) { return Number(n || 0).toLocaleString("id-ID"); }
  export async function bukaPemilu() {
    $("#panel-menu").hidden = true;
    const isi = $("#pemilu-isi");
    isi.textContent = "";
    isi.appendChild(elemenPemilu("p", "pemilu-muat", "Memuat data pemilu…"));
    $("#pemilu-overlay").hidden = false;
    let d = null;
    try {
      const r = await fetch("/api/pemilu", sesi.token ? { headers: { Authorization: "Bearer " + sesi.token } } : {});
      if (r.ok) d = await r.json();
    } catch (e) {}
    if (!d) { isi.textContent = ""; isi.appendChild(elemenPemilu("p", "pemilu-muat", "Data pemilu belum bisa dimuat. Coba lagi sebentar.")); return; }
    gambarPanelPemilu(d);
  }
  export function gambarPanelPemilu(d) {
    const isi = $("#pemilu-isi");
    isi.textContent = "";
    const p = d.pemilu;
    // --- Pejabat aktif: Presiden + Ketua RW/RT wilayah si peminta ---
    // Pejabat yang relevan: Presiden + Wali Kota + Camat/Lurah/Ketua RW/RT wilayah si peminta
    const ws = d.wilayah_saya;
    const kunciWilayah = { kades: 0, walikota: 1, camat: ws && ws.kecamatan, lurah: ws && ws.kelurahan, rw: ws && ws.rw, rt: ws && ws.rt };
    const pejabatTampil = (d.pejabat || []).filter((j) =>
      j.jabatan === "kades" || j.jabatan === "walikota" || !ws || j.wilayah === kunciWilayah[j.jabatan]);
    if (pejabatTampil.length) {
      isi.appendChild(elemenPemilu("h4", "pemilu-bagian", "Pejabat Negara Saat Ini"));
      for (const j of pejabatTampil) {
        const baris = elemenPemilu("div", "pejabat-baris");
        baris.appendChild(elemenPemilu("span", null, j.label));
        baris.appendChild(elemenPemilu("b", null, "@" + j.username));
        isi.appendChild(baris);
      }
    }
    // --- Gerbang 10.000 warga (keputusan Fahmi): selama jumlah warga
    // belum mencapai ambang, panel terkunci — tampil progresnya saja;
    // pejabat aktif di atas tetap tampil seperti biasa. ---
    if (d.terkunci) {
      const kunci = elemenPemilu("div", "pemilu-terkunci");
      kunci.appendChild(elemenPemilu("p", "pemilu-status",
        "Pemilu pertama dibuka setelah " + formatAngkaID(d.min_warga) +
        " warga terdaftar — sekarang " + formatAngkaID(d.jumlah_warga) +
        " dari " + formatAngkaID(d.min_warga) + "."));
      const bar = elemenPemilu("div", "suara-bar");
      const isiBar = elemenPemilu("i");
      isiBar.style.width = Math.min(100, d.min_warga ? (d.jumlah_warga / d.min_warga) * 100 : 0) + "%";
      bar.appendChild(isiBar); kunci.appendChild(bar);
      kunci.appendChild(elemenPemilu("p", "pemilu-catatan",
        "Sambil menunggu, negara terus menerima warga baru. Begitu jumlahnya cukup, Pak Presiden bisa membuka pemilu pertama."));
      isi.appendChild(kunci);
    }
    if (!p) {
      if (!d.terkunci) {
        isi.appendChild(elemenPemilu("p", "pemilu-catatan",
          "Belum ada pemilu yang dibuka. Tunggu Pak Presiden membuka periode pemilihan berikutnya."));
      }
      return;
    }
    const status = elemenPemilu("div", "pemilu-status", TEKS_FASE_PEMILU[p.status] || "");
    isi.appendChild(status);
    if (d.wilayah_saya) {
      isi.appendChild(elemenPemilu("p", "pemilu-catatan",
        "Wilayah rumahmu: " + teksWilayahPendek(d.wilayah_saya) +
        ". Kamu memilih Ketua RT, Ketua RW, Lurah, Camat & Wali Kota di wilayahmu, dan Presiden untuk seluruh negara."));
    }
    for (const b of d.balapan || []) gambarBalapanPemilu(isi, d, b);
    if (p.status === "pencalonan" && !d.terkunci) {
      if (!sesi.saya) {
        isi.appendChild(elemenPemilu("p", "pemilu-catatan", "Masuk pakai Kartu Warga Negara untuk mencalonkan diri."));
      } else if (!d.kandidat_saya) {
        gambarFormCalon(isi, d);
      }
    }
    if (p.status === "selesai") {
      isi.appendChild(elemenPemilu("p", "pemilu-catatan",
        "Jabatan di atas berlaku sampai pemilu berikutnya untuk jabatan itu selesai."));
    }
  }
  export function gambarBalapanPemilu(isi, d, b) {
    isi.appendChild(elemenPemilu("h4", "pemilu-bagian", b.label));
    if (!b.kandidat.length) {
      isi.appendChild(elemenPemilu("p", "pemilu-catatan", "Belum ada kandidat untuk jabatan ini."));
      return;
    }
    const sudahPilih = d.suara_saya ? d.suara_saya[b.jabatan] : undefined;
    for (const k of b.kandidat) {
      const kartu = elemenPemilu("div", "kandidat-kartu" + (b.pemenang_id === k.id ? " menang" : ""));
      const nama = elemenPemilu("div", "kandidat-nama");
      nama.appendChild(document.createTextNode("@" + k.username));
      if (sesi.saya && k.username === sesi.saya.username)
        nama.appendChild(elemenPemilu("span", "kamu", " (kamu)"));
      if (b.pemenang_id === k.id)
        nama.appendChild(elemenPemilu("span", "lencana-menang", " — Pemenang"));
      kartu.appendChild(nama);
      const vm = elemenPemilu("div", "kandidat-visimisi");
      const bv = elemenPemilu("b", null, "Visi: "); vm.appendChild(bv);
      vm.appendChild(document.createTextNode(k.visi));
      vm.appendChild(document.createElement("br"));
      const bm = elemenPemilu("b", null, "Misi: "); vm.appendChild(bm);
      vm.appendChild(document.createTextNode(k.misi));
      kartu.appendChild(vm);
      if (d.pemilu.status !== "pencalonan") {
        const sb = elemenPemilu("div", "suara-baris");
        const bar = elemenPemilu("div", "suara-bar");
        const isiBar = elemenPemilu("i"); isiBar.style.width = (k.persen || 0) + "%";
        bar.appendChild(isiBar); sb.appendChild(bar);
        sb.appendChild(elemenPemilu("span", "suara-teks", k.suara + " suara · " + k.persen + "%"));
        kartu.appendChild(sb);
      }
      if (d.pemilu.status === "pemungutan" && !d.terkunci) {
        if (!sesi.saya) {
          kartu.appendChild(elemenPemilu("p", "pemilu-catatan", "Masuk untuk memilih."));
        } else if (sudahPilih === k.id) {
          kartu.appendChild(elemenPemilu("p", "sudah-pilih", "✓ Kamu memilih kandidat ini"));
        } else if (sudahPilih !== undefined) {
          kartu.appendChild(elemenPemilu("p", "pemilu-catatan", "Kamu sudah memilih untuk jabatan ini."));
        } else {
          const btn = elemenPemilu("button", "tombol-pilih", "Pilih @" + k.username);
          btn.type = "button";
          btn.addEventListener("click", () => pilihKandidat(k.id, btn));
          kartu.appendChild(btn);
        }
      }
      isi.appendChild(kartu);
    }
  }
  export function gambarFormCalon(isi, d) {
    isi.appendChild(elemenPemilu("h4", "pemilu-bagian", "Mencalonkan Diri"));
    const form = elemenPemilu("form", "calon-form");
    const labJ = elemenPemilu("label", null, "Jabatan yang dituju");
    const sel = document.createElement("select"); sel.id = "calon-jabatan";
    const opsi = [
      ["kades", "Presiden (seluruh negara)"],
      ["walikota", "Wali Kota Merdu (seluruh kota)"],
      ["camat", "Camat " + (d.wilayah_saya.nama_kecamatan || "") + " (kecamatanmu)"],
      ["lurah", "Lurah " + (d.wilayah_saya.nama_kelurahan || "") + " (kelurahanmu)"],
      ["rw", "Ketua RW " + String(d.wilayah_saya.rw).padStart(2, "0") + " (wilayah rumahmu)"],
      ["rt", "Ketua RT " + String(d.wilayah_saya.rt).padStart(3, "0") + " (wilayah rumahmu)"],
    ];
    for (const [v, t] of opsi) { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }
    labJ.appendChild(sel); form.appendChild(labJ);
    const labV = elemenPemilu("label", null, "Visi (maks 200 karakter)");
    const inV = document.createElement("input");
    inV.id = "calon-visi"; inV.maxLength = 200; inV.placeholder = "Visi kamu untuk negara…";
    labV.appendChild(inV); form.appendChild(labV);
    const labM = elemenPemilu("label", null, "Misi (maks 1000 karakter)");
    const inM = document.createElement("textarea");
    inM.id = "calon-misi"; inM.maxLength = 1000; inM.placeholder = "Langkah nyata yang akan kamu kerjakan…";
    labM.appendChild(inM); form.appendChild(labM);
    const salah = elemenPemilu("p", "calon-salah", "");
    form.appendChild(salah);
    const kirim = elemenPemilu("button", "calon-kirim", "Daftar Jadi Kandidat");
    kirim.type = "submit"; form.appendChild(kirim);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      salah.textContent = "";
      kirim.disabled = true;
      try {
        const r = await fetch("/api/pemilu/calon", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + sesi.token },
          body: JSON.stringify({ jabatan: sel.value, visi: inV.value, misi: inM.value }),
        });
        const dj = await r.json().catch(() => ({}));
        if (!r.ok) { salah.textContent = dj.error || "Pencalonan gagal."; kirim.disabled = false; return; }
        bukaPemilu(); // muat ulang panel: status kandidat + daftar terbaru
      } catch (err) { salah.textContent = "Jaringan bermasalah, coba lagi."; kirim.disabled = false; }
    });
    isi.appendChild(form);
    isi.appendChild(elemenPemilu("p", "pemilu-catatan",
      "Satu warga hanya boleh mencalonkan diri untuk 1 jabatan per periode."));
  }
  export async function pilihKandidat(kandidatId, btn) {
    if (btn) btn.disabled = true;
    try {
      const r = await fetch("/api/pemilu/pilih", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + sesi.token },
        body: JSON.stringify({ kandidat_id: kandidatId }),
      });
      const dj = await r.json().catch(() => ({}));
      if (!r.ok) { alert(dj.error || "Memilih gagal."); if (btn) btn.disabled = false; return; }
      bukaPemilu(); // muat ulang: tanda sudah memilih + hasil berjalan terbaru
    } catch (e) { alert("Jaringan bermasalah, coba lagi."); if (btn) btn.disabled = false; }
  }
  $("#tombol-pemilu").addEventListener("click", bukaPemilu);
  $("#tutup-pemilu").addEventListener("click", () => { $("#pemilu-overlay").hidden = true; });
  $("#pemilu-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#pemilu-overlay").hidden = true; });

  /* ================= PEMBANGUNAN BERTAHAP: PANEL FASILITAS =================
     Panel "Pembangunan" (tombol di panel menu). Data dari GET
     /api/pembangunan (publik): daftar 8 fasilitas + biaya Kas Negara virtual
     + status terbangun/belum + tanggal berdiri. Desa mulai hanya dari
     istana negara; fasilitas dibangun satu per satu dari usulan warga di
     komentar Instagram, diputuskan Pak Presiden (admin). Saldo kas IG TIDAK
     ditampilkan di sini — kas dicatat terpisah di ledger IG, panel ini
     hanya menunjukkan biaya & status. Semua teks via textContent. */
  export function elemenBangun(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  export async function bukaPembangunan() {
    $("#panel-menu").hidden = true;
    const isi = $("#pembangunan-isi");
    isi.textContent = "";
    isi.appendChild(elemenBangun("p", "pembangunan-muat", "Memuat data pembangunan…"));
    $("#pembangunan-overlay").hidden = false;
    let d = null;
    try {
      const r = await fetch("/api/pembangunan");
      if (r.ok) d = await r.json();
    } catch (e) {}
    if (!d) {
      isi.textContent = "";
      isi.appendChild(elemenBangun("p", "pembangunan-muat", "Data pembangunan belum bisa dimuat. Coba lagi sebentar."));
      return;
    }
    gambarPanelPembangunan(d);
  }
  export function gambarPanelPembangunan(d) {
    const isi = $("#pembangunan-isi");
    isi.textContent = "";
    isi.appendChild(elemenBangun("p", "pembangunan-catatan",
      "Negara Merdu mulai hanya dari istana negara. Fasilitas di bawah ini dibangun satu per satu dari usulan warga di komentar Instagram @negaramerdu — yang memutuskan dan membangunnya Pak Presiden."));
    const ringkas = elemenBangun("div", "pembangunan-ringkasan",
      "Sudah berdiri " + (d.terbangun || 0) + " dari " + (d.total || 0) + " fasilitas.");
    isi.appendChild(ringkas);
    for (const f of d.fasilitas || []) {
      const baris = elemenBangun("div", "fasilitas-baris" + (f.status === "terbangun" ? " berdiri" : ""));
      const kiri = elemenBangun("div", "fasilitas-kiri");
      kiri.appendChild(elemenBangun("b", "fasilitas-nama", f.nama));
      kiri.appendChild(elemenBangun("span", "fasilitas-sub",
        f.voting
          ? "Blok " + formatAngkaID(f.blok) + " · Bangunan dari voting warga · Pemenang voting warga Episode 2–3 · Owner " + (f.owner || "")
          : "Blok " + formatAngkaID(f.blok) + " · Biaya kas Rp" + formatAngkaID(f.biaya)));
      baris.appendChild(kiri);
      const kanan = elemenBangun("div", "fasilitas-kanan");
      if (f.status === "terbangun") {
        kanan.appendChild(elemenBangun("span", "fasilitas-status berdiri", "✓ Sudah berdiri"));
        if (f.dibangun_pada) {
          kanan.appendChild(elemenBangun("span", "fasilitas-tanggal",
            formatTanggalID(String(f.dibangun_pada).slice(0, 10))));
        }
      } else {
        kanan.appendChild(elemenBangun("span", "fasilitas-status", "Belum dibangun"));
      }
      baris.appendChild(kanan);
      isi.appendChild(baris);
    }
    isi.appendChild(elemenBangun("p", "pembangunan-catatan",
      "Mau mengusulkan fasilitas berikutnya? Tulis usulmu di komentar postingan Instagram @negaramerdu."));
  }
  $("#tombol-pembangunan").addEventListener("click", bukaPembangunan);
  $("#tutup-pembangunan").addEventListener("click", () => { $("#pembangunan-overlay").hidden = true; });
  $("#pembangunan-overlay").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#pembangunan-overlay").hidden = true; });

