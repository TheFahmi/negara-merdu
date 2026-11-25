/* Negara Merdu — modul game "main" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Main: rotator status layar muat, loop animasi, dan boot mulai(). */
import "./warna.js"; // HARUS pertama: manajemen warna sRGB (lihat warna.js)
import { $, KOTA_D, KOTA_W, POS_KADES, PUSAT_X, PUSAT_Z } from "./inti.js";
import { ambilData, awanGrup, camera, pantauFrame, perbaruiLaluLintas, renderer, scene, tambahWaktuSiklus, terapkanKualitas, terapkanWaktu } from "./bersama.js";
import { bangunKotaMassal, bangunLaluLintasMobil, perbaruiMobil } from "./kota.js";
import { bangunLahanPembangunan } from "./fasilitas.js";
import { perbaruiApartemen } from "./fasilitasBaru.js";
import { animasiHidup, animasiJalan } from "./karakter.js";
import { bangunDistrik, diInterior, npcList, perbaruiAksiInterior, posisiJalurNpc, rintanganFasilitas } from "./rumah.js";
import { animasiKades, bangunPusatKota } from "./istana.js";
import { dr, fp, karSaya, modeKamera, putarOrbitBilaOtomatis, target, terapkanKamera, updateDrone, updateKetiga, updateOrang } from "./kamera.js";
import { bukaLengkapi, perbaruiChipSaya, sesi, tampilLangkah } from "./ui.js";
import { kirimPosisi, pemainDirender, perbaruiPemainLain, sambungWS } from "./jaringan.js";
import { gambarMinimap } from "./peta.js";
import { bangunPapanIklan, perbaruiIklan } from "./iklan.js";
import { bangunLaluLintas, bangunMobilPajangan, bangunMobilParkir, perbaruiLaluLintasMobil } from "./kendaraan.js";
import { bangunApartemen, perbaruiApartemenLuar, perbaruiLift, tapakApartemen } from "./apartemen.js";
import { perbaruiMall } from "./mallDalam.js";
import { perbaruiPasar } from "./fasilitasBaru.js";
import { bangunPegunungan } from "./ragam.js";
import { perbaruiPlazaRamai } from "./plazaRamai.js";
import { perbaruiJam } from "./jam.js";
import { bangunGedungKaca, perbaruiGedungKaca, rintanganGedung } from "./gedungKaca.js";
import { bangunTransportasi, perbaruiTransportasi, rintanganTransportasi } from "./transportasi.js";

  /* ================= ANIMASI ================= */
  export const jam = new THREE.Clock();
  export let waktuLalu = 0;
  export function animasi() {
    requestAnimationFrame(animasi);
    const kiniMs = performance.now();
    pantauFrame(kiniMs); // tangga kualitas otomatis (frameTerakhirMs milik bersama.js)
    const t = jam.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0, t - waktuLalu)); waktuLalu = t;
    perbaruiTransportasi(t, dt); // kereta & bus — SEBELUM kamera: penumpang menempel tanpa tertinggal 1 frame (t untuk fase lampu)
    if (modeKamera === "orbit") {
      putarOrbitBilaOtomatis(); // theta & keadaan interaksi milik kamera.js
      terapkanKamera();
    } else if (modeKamera === "orang") {
      updateOrang(dt);
    } else if (modeKamera === "ketiga") {
      updateKetiga(dt);
    } else {
      updateDrone(dt);
    }
    if (karSaya) karSaya.visible = modeKamera === "ketiga" && !diInterior;
    for (const kar of npcList) {
      kar.visible = !pemainDirender.has(kar.userData.username); // orangnya lagi online? tampil sebagai pemain, bukan NPC
      if (!kar.visible) continue;
      const u = kar.userData;
      const akt = u.aktivitas || { jenis: "jalan" };
      if (akt.jenis === "ngobrol") { // berdiri berhadapan: napas/kedip + gestur satu tangan sesekali (±1,3 dtk tiap ±7 dtk, fase per orang)
        animasiHidup(kar, t, true);
        const sik = (t + (u.geserHidup || 0) * 3.7) % 7;
        if (u.lenganR && sik < 1.3) u.lenganR.rotation.x = -0.55 - Math.sin(sik / 1.3 * Math.PI) * 0.55;
        continue;
      }
      if (akt.jenis === "duduk") { animasiHidup(kar, t, true); continue; } // pose duduk statis dari bangunDistrik; kaki tidak disentuh di sini
      const p = posisiJalurNpc(u, t * 3.4 + u.fase); // jalur sendiri (keliling blok) atau jalur plaza
      const jarakNpc = u._jx === undefined ? 0 : Math.hypot(p.x - u._jx, p.z - u._jz);
      u._jx = p.x; u._jz = p.z;
      const bobNpc = animasiJalan(kar, jarakNpc, dt);
      animasiHidup(kar, t, false);
      if (akt.jenis === "pembawa" && u.lenganK && u.lenganR) { // kedua tangan memegang barang di depan dada (menimpa ayunan jalan)
        u.lenganK.rotation.x = -0.82; u.lenganR.rotation.x = -0.82;
      }
      kar.position.set(p.x, 0.3 + bobNpc * 0.06, p.z);
      { // hadap berputar HALUS di tikungan (dulu langsung patah 90°)
        const sasaran = Math.atan2(p.dx, p.dz);
        if (u.yawHalus === undefined) u.yawHalus = sasaran;
        let d = sasaran - u.yawHalus; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        u.yawHalus += d * (1 - Math.exp(-dt * 6));
        kar.rotation.y = u.yawHalus;
      }
    }
    kirimPosisi(false);
    perbaruiPemainLain(dt, t);
    perbaruiAksiInterior();
    gambarMinimap();
    tambahWaktuSiklus(dt); // waktuSiklus milik bersama.js
    terapkanWaktu(dt, false); // fase cahaya: lerp halus ke preset aktif (Paket 3 ?v=15)
    perbaruiLaluLintas(t);
    perbaruiIklan(t);
    perbaruiMobil(dt, t);
    perbaruiApartemen(dt, t); // lift Residensia 10 (kembali diam-diam bila belum terbangun)
    // DIMATIKAN 22 Nov (keputusan Fahmi): sistem mobil berjalan kendaraan.js
    // (±320) dimatikan, yang hidup hanya arteri kota.js (64 mobil).
    // Kode sistemnya tetap utuh di kendaraan.js; hidupkan lagi cukup dengan
    // mengembalikan baris ini + pemanggilan bangunLaluLintas() di mulai().
    // perbaruiLaluLintasMobil(t, dt); // mobil berjalan kendaraan.js
    perbaruiLift(dt); perbaruiApartemenLuar();
    if (diInterior) perbaruiMall(dt); // anak tangga eskalator mall
    perbaruiPasar(dt, t); // pedagang & pembeli Pasar Desa
    perbaruiPlazaRamai(dt, t);
    perbaruiGedungKaca(dt, t);
    perbaruiJam(); // semua jam analog real time // band, penonton, air mancur menari, umbul-umbul, merpati
    if (animasiKades) {
      animasiKades.position.y = 0.49 + Math.abs(Math.sin(t * 2)) * 0.05; // basis pelataran istana 0.34 (?v=24)
      animasiHidup(animasiKades, t, true);
      /* Pak Presiden melambai saat ada pemain dekat (Paket 1 ?v=15): acuan
         pemain = target orbit / posisi drone / posisi jalan kaki. Lengan
         kanan diangkat ke samping kepala (rotasi z ±2,55) dan digoyang;
         jendela lambai 1,8 dtk tiap 5 dtk selama pemain masih dekat. */
      const uK = animasiKades.userData;
      if (uK.lenganR) {
        const acuan = modeKamera === "orbit" ? target : modeKamera === "drone" ? dr : fp;
        const dekatKades = Math.hypot(acuan.x - POS_KADES.x - PUSAT_X, acuan.z - POS_KADES.z - PUSAT_Z) < 40; // relatif pusat plaza
        uK.lenganR.rotation.z = dekatKades && (t % 5) < 1.8 ? 2.55 + Math.sin(t * 9) * 0.32 : 0.12;
      }
    }
    awanGrup.children.forEach((g) => { if (g.visible) { g.position.x += g.userData.kecepatan * 0.16; if (g.position.x > 2900) g.position.x = -2900; } });
    renderer.render(scene, camera);
  }
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* Rotator status layar muat (dulu script inline di index.html lama):
     teks berganti bertahap; bar progres murni animasi CSS (?v=30). */
  (function rotatorMuat() {
    var muat = document.getElementById("muat");
    var statusEl = document.getElementById("muat-status");
    var barEl = document.getElementById("muat-bar");
    var tipsEl = document.getElementById("muat-tips");
    if (!muat || !statusEl || !barEl) return;
    var langkah = ["Menghubungi Istana Negara…", "Memuat warga & rumah…", "Membangun kota…", "Menyiapkan kamera…"];
    var tips = [
      "Tips: naik bus Trans Merdu di halte, lalu turun di Halte Plaza",
      "Tips: KRL Merdu berhenti di Stasiun Merdu — tekan “Naik KRL” di pintu stasiun",
      "Tips: ketuk papan iklan atau Istana Negara untuk melihat info",
      "Tips: Panggung Rakyat di sisi timur plaza sedang ada pertunjukan",
      "Tips: ganti kamera 1st Person, 3rd Person, atau Drone di bar bawah",
      "Tips: ikut pemilu Lurah, Camat, dan Walikota dari menu",
    ];
    var i = 0, j = Math.floor(Math.random() * tips.length), t = null, tt = null;
    function selesai() { return muat.style.display === "none" || muat.classList.contains("selesai"); }
    function tampil() {
      if (selesai()) { if (t) clearInterval(t); return; }
      statusEl.textContent = langkah[i]; muat.dataset.langkah = String(i);
    }
    t = setInterval(function () {
      if (selesai()) { clearInterval(t); return; }
      if (i < langkah.length - 1) { i++; tampil(); }
    }, 1500);
    if (tipsEl) {
      tipsEl.textContent = tips[j];
      tt = setInterval(function () {
        if (selesai()) { clearInterval(tt); return; }
        tipsEl.classList.add("ganti");
        setTimeout(function () { j = (j + 1) % tips.length; tipsEl.textContent = tips[j]; tipsEl.classList.remove("ganti"); }, 350);
      }, 3400);
    }
    tampil();
  })();

  (async function mulai() {
    const pmLuas = $("#pm-luas");
    if (pmLuas) pmLuas.textContent = KOTA_W.toLocaleString("id-ID") + " × " + KOTA_D.toLocaleString("id-ID") + " satuan + sawah, hutan & danau di pinggiran";
    await ambilData();
    if (sesi.token) {
      try {
        const r = await fetch("/api/saya", { headers: { Authorization: "Bearer " + sesi.token } });
        if (r.ok) {
          const dj = await r.json();
          sesi.saya = dj.warga;
          sesi.pinDefault = !!dj.pin_default; sesi.genderKosong = !!dj.gender_kosong;
        }
        else { sesi.token = null; localStorage.removeItem("pinarak_token"); }
      } catch (e) {}
    }
    perbaruiChipSaya();
    /* Jaring pengaman ?v=33: pengecualian APA PUN saat membangun kota
       tidak boleh lagi mengunci layar loading selamanya — kesalahan
       dicatat ke konsol, lalu #muat tetap disembunyikan dan HUD/gerbang
       tetap tampil (kota mungkin tampil sebagian, halaman tetap bisa
       dipakai). Insiden pemicu: TypeError render dari mesh atap instanced
       berdaftar kosong membunuh mulai() sebelum baris sembunyi #muat. */
    try {
      bangunPegunungan(scene); // cakrawala pegunungan (ragam.js)
      bangunPusatKota(); // plaza + istana (dulu IIFE evaluasi modul di istana.js — TDZ-nya mengunci loading 22 Nov 15:13; kini di dalam jaring pengaman ini)
      window.__kotaMassal = bangunKotaMassal();
      bangunLaluLintasMobil(); // 64 mobil arteri kota (instanced, lajur kiri)
      bangunDistrik();
      bangunMobilParkir(); // 1 mobil per rumah terisi
      // bangunLaluLintas(); // DIMATIKAN 22 Nov (keputusan Fahmi): mobil berjalan kendaraan.js ±320 mati; arteri kota.js 64 yang dipakai. Lihat catatan di loop animasi.
      bangunMobilPajangan(); // 8 mobil detail parkir tepi jalan (plaza & fasilitas)
      bangunApartemen(); rintanganFasilitas.push(...tapakApartemen());
      bangunTransportasi(); rintanganFasilitas.push(...rintanganTransportasi);
      bangunGedungKaca(); rintanganFasilitas.push(...rintanganGedung); // kantor & sekolah berkaca ber-interior // stasiun, kereta, bus
      bangunPapanIklan(); // papan iklan sekeliling plaza (isi dari /iklan.json)
      bangunLahanPembangunan(); // petak kosong + fasilitas terbangun (status dari ambilData)
      terapkanKualitas(); // dorong kepadatan awan & info panel sesuai pilihan tersimpan
      terapkanWaktu(0, true); // jepret fase waktu ke pilihan tersimpan (sesudah kota & lahan terbangun, sebelum frame pertama)
      terapkanKamera();
      animasi();
      sambungWS();
    } catch (e) { console.error("Gagal membangun kota:", e); }
    { // layar muat memudar (panel & panorama), lalu dilepas dari tata letak
      const m = $("#muat"); m.dataset.langkah = "3"; $("#muat-bar").style.animation = "none"; $("#muat-bar").style.transform = "scaleX(1)";
      m.classList.add("selesai"); setTimeout(() => { m.style.display = "none"; }, 650);
    }
    $("#hud").hidden = false;
    if (!sesi.saya) { $("#gerbang").hidden = false; tampilLangkah("nama"); }
    else if (sesi.pinDefault || sesi.genderKosong) bukaLengkapi(); // sesi pulih pun wajib melengkapi dulu
  })();
