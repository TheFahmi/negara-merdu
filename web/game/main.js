/* Negara Merdu — modul game "main" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Main: rotator status layar muat, loop animasi, dan boot mulai(). */
import "./warna.js"; // HARUS pertama: manajemen warna sRGB (lihat warna.js)
import { $, KOTA_D, KOTA_W, POS_KADES, PUSAT_X, PUSAT_Z } from "./inti.js";
import { ambilData, awanGrup, camera, pantauFrame, perbaruiLaluLintas, renderer, scene, tambahWaktuSiklus, terapkanKualitas, terapkanWaktu } from "./bersama.js";
import { bangunKotaMassal } from "./kota.js";
import { bangunLahanPembangunan } from "./fasilitas.js";
import { animasiHidup, animasiJalan } from "./karakter.js";
import { bangunDistrik, diInterior, npcList, perbaruiAksiInterior, posisiJalur } from "./rumah.js";
import { animasiKades } from "./istana.js";
import { dr, fp, karSaya, modeKamera, putarOrbitBilaOtomatis, target, terapkanKamera, updateDrone, updateKetiga, updateOrang } from "./kamera.js";
import { bukaLengkapi, perbaruiChipSaya, sesi, tampilLangkah } from "./ui.js";
import { kirimPosisi, pemainDirender, perbaruiPemainLain, sambungWS } from "./jaringan.js";
import { gambarMinimap } from "./peta.js";
import { bangunPapanIklan, perbaruiIklan } from "./iklan.js";

  /* ================= ANIMASI ================= */
  export const jam = new THREE.Clock();
  export let waktuLalu = 0;
  export function animasi() {
    requestAnimationFrame(animasi);
    const kiniMs = performance.now();
    pantauFrame(kiniMs); // tangga kualitas otomatis (frameTerakhirMs milik bersama.js)
    const t = jam.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0, t - waktuLalu)); waktuLalu = t;
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
      const p = posisiJalur(t * 3.4 + u.fase);
      const jarakNpc = u._jx === undefined ? 0 : Math.hypot(p.x - u._jx, p.z - u._jz);
      u._jx = p.x; u._jz = p.z;
      const bobNpc = animasiJalan(kar, jarakNpc, dt);
      animasiHidup(kar, t, false);
      if (akt.jenis === "pembawa" && u.lenganK && u.lenganR) { // kedua tangan memegang barang di depan dada (menimpa ayunan jalan)
        u.lenganK.rotation.x = -0.82; u.lenganR.rotation.x = -0.82;
      }
      kar.position.set(p.x, 0.3 + bobNpc * 0.06, p.z);
      kar.rotation.y = Math.atan2(p.dx, p.dz);
    }
    kirimPosisi(false);
    perbaruiPemainLain(dt, t);
    perbaruiAksiInterior();
    gambarMinimap();
    tambahWaktuSiklus(dt); // waktuSiklus milik bersama.js
    terapkanWaktu(dt, false); // fase cahaya: lerp halus ke preset aktif (Paket 3 ?v=15)
    perbaruiLaluLintas(t);
    perbaruiIklan(t);
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
    if (!muat || !statusEl || !barEl) return;
    var langkah = ["Menghubungi Istana Negara…", "Memuat warga & rumah…", "Membangun kota…", "Menyiapkan kamera…"];
    var i = 0, t = null;
    function selesai() { return muat.style.display === "none"; }
    function tampil() {
      if (selesai()) { if (t) clearInterval(t); return; }
      statusEl.textContent = langkah[i];
    }
    t = setInterval(function () {
      if (selesai()) { clearInterval(t); return; }
      if (i < langkah.length - 1) { i++; tampil(); }
    }, 1500);
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
      window.__kotaMassal = bangunKotaMassal();
      bangunDistrik();
      bangunPapanIklan(); // papan iklan sekeliling plaza (isi dari /iklan.json)
      bangunLahanPembangunan(); // petak kosong + fasilitas terbangun (status dari ambilData)
      terapkanKualitas(); // dorong kepadatan awan & info panel sesuai pilihan tersimpan
      terapkanWaktu(0, true); // jepret fase waktu ke pilihan tersimpan (sesudah kota & lahan terbangun, sebelum frame pertama)
      terapkanKamera();
      animasi();
      sambungWS();
    } catch (e) { console.error("Gagal membangun kota:", e); }
    $("#muat").style.display = "none";
    $("#hud").hidden = false;
    if (!sesi.saya) { $("#gerbang").hidden = false; tampilLangkah("nama"); }
    else if (sesi.pinDefault || sesi.genderKosong) bukaLengkapi(); // sesi pulih pun wajib melengkapi dulu
  })();
