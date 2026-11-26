/* Negara Merdu — modul game "bersama" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Bersama: state kualitas/waktu, tekstur prosedural, data dari API, dan scene Three.js (renderer, kamera, cahaya, langit, tanah, geometri bantu) + penerapan kualitas/waktu. */
import { $, BLOK_BARIS, BLOK_KOLOM, JALAN, KAPASITAS, KOTA_D, KOTA_W, KUNCI_ANGKA_WAKTU, KUNCI_HEX_WAKTU, PITCH, SISI, WARNA_ASPAL_CSS, WARNA_LAMPU_LL, evaluasiOtomatis, faseLaluLintas, hashInt, indeksUntukPilihan, parameterKualitas, parameterWaktu } from "./inti.js";

  /* ================= KUALITAS GRAFIK (keadaan aktif) ================= */
  export let pilihanKualitas = "otomatis";
  try {
    const s = localStorage.getItem("pinarak_kualitas");
    if (s === "rendah" || s === "sedang" || s === "tinggi" || s === "otomatis") pilihanKualitas = s;
  } catch (e) {}
  export let langkahKualitas = indeksUntukPilihan(pilihanKualitas);
  export let PARAM = parameterKualitas(langkahKualitas, window.devicePixelRatio || 1);
  export const REG_TEX = [];       // {tex, buat} tekstur prosedural — digambar ulang saat skalaTekstur berubah
  export const IM_LINGKUNGAN = []; // {mesh, penuh} InstancedMesh dekorasi kavling — count diatur kepadatan
  export const LL_AKTIF = { mat: null, kunci: "" }; // material cakram lampu lalu lintas milik grup kota yang sedang tampil + fase terakhir yang diterapkan (diisi bangunKotaMassal)
  /* Waktu negara (Paket 3 ?v=15): pilihan user tersimpan seperti kualitas;
     bawaan "senja" = golden hour ?v=14 persis. */
  export let pilihanWaktu = "senja";
  try {
    const s = localStorage.getItem("pinarak_waktu");
    if (s === "siang" || s === "senja" || s === "malam" || s === "siklus") pilihanWaktu = s;
  } catch (e) {}
  export const LAMPU_JALAN = { matKepala: null }; // material kepala lampu jalan instanced (diisi bangunKotaMassal) — emissive-nya digerakkan fase waktu
  export const MAT_JENDELA = { mat: null };       // material jendela istana negara (diisi pusatKota) — menyala hangat di malam hari
  export const LAMPU_TAMAN = { mat: null };       // material kepala lampu taman istana (diisi pusatKota) — emissive-nya digerakkan fase waktu (kepalaLampu)

  /* ================= TEKSTUR PROSEDURAL (canvas, dibuat sekali) =================
     Semua tekstur dekoratif digambar dari fungsi buat(skala) supaya opsi
     kualitas bisa menggambar ulangnya di resolusi lain tanpa reload.
     Palet mengikuti poster: plesteran krem terang, genteng terang (diwarnai
     per instans lewat instanceColor), jalan pasir + trotoar, sawah berpetak. */
  export function buatKanvasDinding(skala) {
    const S = Math.max(32, Math.round(256 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 256;
    c.fillStyle = "#f8f3e6"; c.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) { // bintik plesteran halus
      c.fillStyle = i % 2 ? "rgba(120,90,50,0.05)" : "rgba(255,255,255,0.07)";
      c.fillRect(hashInt(i * 3 + 1) * S, hashInt(i * 7 + 2) * S, 2.4 * u, 2.4 * u);
    }
    c.fillStyle = "rgba(110,85,55,0.045)"; // coretan vertikal sangat halus
    for (let i = 0; i < 12; i++) c.fillRect(hashInt(i * 13 + 5) * S, 0, 3 * u, S);
    for (const wx of [0.16, 0.60]) { // dua jendela bingkai kayu + kaca
      const x = wx * S, y = 0.30 * S, w = 0.24 * S, h = 0.34 * S;
      c.fillStyle = "#7a5230"; c.fillRect(x - 4 * u, y - 4 * u, w + 8 * u, h + 8 * u);
      c.fillStyle = "#bfe0ee"; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(255,255,255,0.5)";
      c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + w * 0.55, y); c.lineTo(x + w, y); c.lineTo(x + w * 0.45, y + h); c.closePath(); c.fill();
      c.fillStyle = "#7a5230";
      c.fillRect(x + w / 2 - 2 * u, y, 4 * u, h); c.fillRect(x, y + h / 2 - 2 * u, w, 4 * u);
      c.fillStyle = "#8a5f36"; c.fillRect(x - 6 * u, y + h + 4 * u, w + 12 * u, 5 * u);
    }
    const grd = c.createLinearGradient(0, S * 0.86, 0, S); // pita bawah: rumah terasa menapak
    grd.addColorStop(0, "rgba(110,80,45,0)"); grd.addColorStop(1, "rgba(110,80,45,0.20)");
    c.fillStyle = grd; c.fillRect(0, S * 0.86, S, S * 0.14);
    return cv;
  }
  export function buatKanvasAtap(skala) {
    const S = Math.max(32, Math.round(256 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 256;
    c.fillStyle = "#f4ede1"; c.fillRect(0, 0, S, S);
    const baris = 8, hBaris = S / baris, lebar = S / 8;
    for (let r = 0; r < baris; r++) {
      const y = r * hBaris, geser = (r % 2) * lebar / 2;
      for (let k = -1; k < 9; k++) {
        const x = k * lebar + geser, v = hashInt(r * 31 + k * 7 + 3);
        c.fillStyle = v > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(90,50,25,0.07)";
        c.fillRect(x + 1.5 * u, y + 1.5 * u, lebar - 3 * u, hBaris - 3 * u);
        c.strokeStyle = "rgba(96,52,26,0.26)"; c.lineWidth = 2 * u; // 0,40 -> 0,26: setelah koreksi sRGB garis genteng terlalu kasar
        c.beginPath(); c.arc(x + lebar / 2, y + hBaris, lebar / 2 - 1.5 * u, Math.PI, 0); c.stroke();
      }
      c.fillStyle = "rgba(70,38,18,0.20)"; c.fillRect(0, y + hBaris - 2.4 * u, S, 2.4 * u);
    }
    return cv;
  }
  export function buatKanvasTanah(skala) { // ubin 1 blok: jalan di tepi kiri+atas, sisanya kavling rumput
    /* Desain jalan (perbaikan): jalan pasir rata diganti ASPAL abu dengan
       butiran halus, garis tepi putih, garis tengah putus-putus, kerb
       beton di antara aspal & trotoar, trotoar paving bernat. Resolusi
       dasar 256 -> 512 px per blok supaya marka tetap tajam dari dekat. */
    const S = Math.max(64, Math.round(512 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 256;
    c.fillStyle = "#6aa652"; c.fillRect(0, 0, S, S); // rumput
    for (let i = 0; i < 70; i++) { // bercak rumput halus terang/gelap
      c.fillStyle = i % 2 ? "rgba(255,255,220,0.05)" : "rgba(30,70,20,0.06)";
      c.fillRect(hashInt(i * 11 + 3) * S, hashInt(i * 17 + 5) * S, (10 + hashInt(i) * 18) * u, (8 + hashInt(i + 9) * 12) * u);
    }
    const j = Math.round(S * JALAN / PITCH); // lebar jalan di ubin (~43u)
    const tro = Math.max(3, Math.round(8 * u)); // lebar trotoar
    const kerb = Math.max(1, Math.round(1.6 * u));
    // trotoar: sisi kavling ubin ini + sisi kavling ubin tetangga
    c.fillStyle = "#d9d3c4";
    // hanya di sisi kavling (j..S) — trotoar tidak lagi melintang di atas persimpangan
    c.fillRect(j, j, tro, S - j); c.fillRect(j, j, S - j, tro);
    c.fillRect(S - tro, j, tro, S - j); c.fillRect(j, S - tro, S - j, tro);
    c.fillStyle = "rgba(110,100,85,0.35)"; // nat paving trotoar
    const ubinT = 8 * u;
    for (let y = j; y < S; y += ubinT) { c.fillRect(j, y, tro, Math.max(1, 0.6 * u)); c.fillRect(S - tro, y, tro, Math.max(1, 0.6 * u)); }
    for (let x = j; x < S; x += ubinT) { c.fillRect(x, j, Math.max(1, 0.6 * u), tro); c.fillRect(x, S - tro, Math.max(1, 0.6 * u), tro); }
    // aspal
    c.fillStyle = WARNA_ASPAL_CSS; c.fillRect(0, 0, j, S); c.fillRect(0, 0, S, j);
    for (let i = 0; i < 900; i++) { // butiran aspal (seimbang terang/gelap -> rata-rata tetap WARNA_ASPAL)
      const x = hashInt(i * 7 + 1) * S, y = hashInt(i * 13 + 2) * S;
      if (x > j && y > j) continue;
      c.fillStyle = i % 2 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)";
      c.fillRect(x, y, 1.4 * u, 1.4 * u);
    }
    // kerb beton (tepi aspal ke trotoar, kedua sisi jalan)
    c.fillStyle = "#b9b4a8";
    c.fillRect(j, j, kerb, S - j); c.fillRect(j, j, S - j, kerb);
    c.fillRect(S - kerb, j, kerb, S - j); c.fillRect(j, S - kerb, S - j, kerb);
    // garis tepi putih menerus, 3u dari kerb — berhenti di bibir persimpangan (petak 0..j bersih)
    c.fillStyle = "rgba(244,241,230,0.85)";
    const tepi = Math.max(1, Math.round(1.2 * u));
    c.fillRect(j - 3 * u - tepi, j, tepi, S - j); c.fillRect(j, j - 3 * u - tepi, S - j, tepi);
    c.fillRect(3 * u, j, tepi, S - j); c.fillRect(j, 3 * u, S - j, tepi);
    // garis tengah putus-putus — kala 32u membagi habis sisi ubin di semua skala: menyambung mulus antar blok
    c.fillStyle = "#f4f1e6";
    const lebarGaris = Math.max(2, Math.round(1.6 * u));
    const tgh = Math.round(j / 2 - lebarGaris / 2);
    const kalaGaris = 32 * u, pjgGaris = Math.round(16 * u), awalGaris = Math.round(8 * u);
    // tidak digambar di petak persimpangan & zona zebra (5,8 unit di tiap sisi) — dulu ditutup instans "tutup"
    const bebas = Math.round(S * (JALAN + 5.8) / PITCH), bebasAkhir = S - Math.round(S * 5.8 / PITCH);
    for (let y = awalGaris; y + pjgGaris <= S; y += kalaGaris) {
      if (y < bebas || y + pjgGaris > bebasAkhir) continue;
      c.fillRect(tgh, y, lebarGaris, pjgGaris);
      c.fillRect(y, tgh, pjgGaris, lebarGaris);
    }
    // petak kavling: garis batas halus
    c.strokeStyle = "rgba(40,70,30,0.18)"; c.lineWidth = Math.max(1, u);
    const langkah = (S - j - tro) / SISI, awal = j + tro;
    for (let i = 1; i < SISI; i++) {
      c.beginPath(); c.moveTo(awal + i * langkah, awal); c.lineTo(awal + i * langkah, S - tro); c.stroke();
      c.beginPath(); c.moveTo(awal, awal + i * langkah); c.lineTo(S - tro, awal + i * langkah); c.stroke();
    }
    return cv;
  }
  export function buatKanvasSawah(skala) { // petak 8x8: variasi hijau, sebagian berair, galengan cokelat
    const S = Math.max(64, Math.round(512 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 512;
    const WARNA_SAWAH = ["#8fce5e", "#a9d95f", "#7cb84a", "#c9d95f", "#95c94f", "#b5cf57"];
    const sel = S / 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const h1 = hashInt(x * 7 + y * 31 + 3), h2 = hashInt(x * 13 + y * 17 + 9);
      const px = x * sel, py = y * sel;
      if (h2 < 0.16) { // petak berair: memantulkan langit
        c.fillStyle = "#a9cfae"; c.fillRect(px, py, sel, sel);
        c.fillStyle = "rgba(255,255,255,0.28)";
        for (let i = 0; i < 3; i++) c.fillRect(px + 6 * u, py + (10 + i * 18) * u, sel - 12 * u, 3 * u);
      } else {
        c.fillStyle = WARNA_SAWAH[Math.floor(h1 * WARNA_SAWAH.length)];
        c.fillRect(px, py, sel, sel);
        c.strokeStyle = h1 > 0.5 ? "rgba(46,90,30,0.20)" : "rgba(240,255,210,0.20)";
        c.lineWidth = Math.max(1, 1.6 * u);
        for (let i = 0; i < 12; i++) { // barisan padi halus
          const lx = px + 4 * u + hashInt(x * 101 + y * 57 + i * 7) * (sel - 8 * u);
          c.beginPath(); c.moveTo(lx, py + sel * 0.24); c.lineTo(lx, py + sel * 0.82); c.stroke();
        }
      }
      c.strokeStyle = "rgba(122,100,58,0.55)"; c.lineWidth = Math.max(1.5, 5 * u); // galengan/pematang
      c.strokeRect(px + 1, py + 1, sel - 2, sel - 2);
      c.strokeStyle = "rgba(255,255,240,0.20)"; c.lineWidth = Math.max(1, 2 * u);
      c.beginPath(); c.moveTo(px + 3, py + 3); c.lineTo(px + sel - 3, py + 3); c.stroke();
    }
    return cv;
  }
  export function buatTeksturProsedural(buat) {
    const tex = new THREE.CanvasTexture(buat(PARAM.skalaTekstur));
    REG_TEX.push({ tex, buat });
    return tex;
  }
  export function segarkanTekstur() { // gambar ulang semua tekstur prosedural di skala aktif
    const perBuat = new Map();
    for (const r of REG_TEX) {
      if (!perBuat.has(r.buat)) perBuat.set(r.buat, r.buat(PARAM.skalaTekstur));
      r.tex.image = perBuat.get(r.buat);
      r.tex.needsUpdate = true;
    }
  }
  export const TEX_DINDING = buatTeksturProsedural(buatKanvasDinding);
  export const TEX_ATAP = buatTeksturProsedural(buatKanvasAtap);
  TEX_DINDING.anisotropy = 4; TEX_ATAP.anisotropy = 4;

  /* ================= DATA ================= */
  export let statistik = { warga: 0, terisi: 0, kapasitas: KAPASITAS };
  export let wargaTerbaru = [];           // untuk distrik detail + NPC
  export const warnaPemilik = new Map();  // "blok,kavling" -> warna baju (<= 2000 warga pertama)
  export const rumahTerisi = new Set();   // "blok,kavling" yang ADA warganya — satu-satunya dasar rumah massal & tabrakannya
  export const rumahDetailSet = new Set(); // "blok,kavling" milik <=30 warga terbaru yang punya rumah DETAIL di kavling aslinya — instans massalnya dilewati, tabrakannya via rintanganDetail
  export const daftarRumah = [];          // {nomor, blok, kavling, warna} warga termuat — untuk titik rumah di peta
  export const semuaWarga = [];           // SEMUA warga dari paginasi (objek lengkap) — dasar rumah GLB tiap warga di bangunDistrik
  export let dataPembangunan = [];        // status fasilitas dari /api/pembangunan (dibaca sekali saat muat)

  export async function ambilData() {
    try {
      const st = await (await fetch("/api/statistik")).json();
      statistik = st;
      try { // status pembangunan: gagal memuat = semua dianggap belum terbangun
        const pb = await (await fetch("/api/pembangunan")).json();
        dataPembangunan = pb.fasilitas || [];
      } catch (e) { dataPembangunan = []; }
      const hal = await (await fetch("/api/warga?limit=60&urut=terbaru")).json();
      wargaTerbaru = hal.warga || [];
      rumahDetailSet.clear(); // himpunan detail harus sama persis dengan irisan yang dibangun bangunDistrik
      warnaPemilik.clear(); rumahTerisi.clear(); daftarRumah.length = 0; semuaWarga.length = 0;
      let offset = 0, total = st.warga || 0;
      while (offset < Math.min(total, 2000)) {
        const p = await (await fetch(`/api/warga?limit=500&offset=${offset}`)).json();
        (p.warga || []).forEach((w) => {
          warnaPemilik.set(w.blok + "," + w.kavling, w.warna_baju);
          rumahTerisi.add(w.blok + "," + w.kavling);
          rumahDetailSet.add(w.blok + "," + w.kavling); // SEMUA warga kini rumah detail (GLB) — instans massalnya dilewati
          semuaWarga.push(w);
          daftarRumah.push({ nomor: w.nomor_rumah, blok: w.blok, kavling: w.kavling, warna: w.warna_baju });
        });
        offset += 500;
      }
    } catch (e) { /* kota tetap tampil */ }
    $("#stat-warga").textContent = statistik.warga;
    $("#stat-rumah").textContent = statistik.terisi + " / " + (statistik.kapasitas || KAPASITAS).toLocaleString("id-ID");
    const pmW = $("#pm-warga"), pmR = $("#pm-rumah");
    if (pmW) pmW.textContent = (statistik.warga || 0).toLocaleString("id-ID");
    if (pmR) pmR.textContent = (statistik.terisi || 0).toLocaleString("id-ID") + " kavling";
  }

  /* ================= SCENE ================= */
  export const kanvas = $("#kanvas");
  export const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
  renderer.setPixelRatio(PARAM.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = PARAM.bayangan;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic: warna poster yang hangat & lembut
  renderer.toneMappingExposure = 1.05; // 1,2 -> 1,05 (perbaikan warna): pastel tidak lagi meledak ke putih

  export const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaad9f2);
  scene.fog = new THREE.Fog(0xf6d9a8, 2600, 9000); // kabut hangat golden hour. PERBAIKAN WARNA: near 900 -> 2600 & far 5600 -> 9000 — dulu kabut mulai di 900 sehingga hampir seluruh kota yang terlihat (skala 6.720x4.200) terpapar kabut krem dan pucat; kini area pandang normal jernih, kabut hanya kabur di cakrawala. far 9000 = far mode 1st Person, di bawah far Orbit/Drone (13000): aman.
  /* Kubah langit gradasi: horizon krem hangat -> biru lembut di atas.
     ShaderMaterial tidak kena tone mapping/fog — warna dipilih sebagai nilai akhir.
     Radius 8200 < far mode 1st Person (9000) dan < far Orbit/Drone (13000) dari posisi ekstrem mana pun. */
  export const kubahLangit = new THREE.Mesh(
    new THREE.SphereGeometry(8200, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        atas: { value: new THREE.Color(0x5fa8dd) },
        tengah: { value: new THREE.Color(0xaad9f2) },
        bawah: { value: new THREE.Color(0xffe3ae) },
      },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "varying vec3 vP; uniform vec3 atas; uniform vec3 tengah; uniform vec3 bawah;" +
        "void main(){ float h = normalize(vP).y;" +
        " vec3 c = h > 0.12 ? mix(tengah, atas, smoothstep(0.12, 0.65, h)) : mix(bawah, tengah, smoothstep(-0.08, 0.12, h));" +
        " gl_FragColor = linearToOutputTexel(vec4(c, 1.0)); }", // uniform linear (warna.js) -> encode sRGB
    }));
  kubahLangit.frustumCulled = false; kubahLangit.renderOrder = -1;
  scene.add(kubahLangit);
  /* near/far diperketat per mode di aturMode() (anti z-fighting): rasio far/near
     menentukan presisi depth buffer; nilai awal ini untuk mode Orbit. */
  export const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 2, 13000);
  camera.rotation.order = "YXZ"; // supaya yaw/pitch mode 1st Person & Drone berperilaku seperti FPS

  /* Golden hour: matahari miring dari barat (-x), cahaya & ambient hangat. */
  export const OFSET_MATAHARI = { x: -480, y: 300, z: 180 };
  export const hemi = new THREE.HemisphereLight(0xffe7c4, 0x86a860, 0.62); // ambient 0,85 -> 0,62: kurang cuci, kontras arah cahaya terasa
  scene.add(hemi);
  export const matahari = new THREE.DirectionalLight(0xffc384, 1.15); // kunci cahaya 1,05 -> 1,15: sisi terang/jatuh bayangan lebih tegas
  matahari.position.set(OFSET_MATAHARI.x, OFSET_MATAHARI.y, OFSET_MATAHARI.z);
  matahari.castShadow = PARAM.bayangan;
  matahari.shadow.mapSize.set(PARAM.petaBayangan || 2048, PARAM.petaBayangan || 2048);
  matahari.shadow.camera.left = -150; matahari.shadow.camera.right = 150;
  matahari.shadow.camera.top = 150; matahari.shadow.camera.bottom = -150;
  matahari.shadow.camera.far = 1500;
  matahari.shadow.bias = -0.0004; matahari.shadow.normalBias = 0.6; // anti shadow acne di atap/dinding flat-shaded
  matahari.shadow.radius = 3;
  scene.add(matahari); scene.add(matahari.target);
  /* Jangkauan bayangan mengikuti jarak kamera: dulu kotak tetap ±150 sehingga
     di mode Orbit (radius 300) hanya tengah layar yang berbayang dan sisanya
     terlihat datar. Dibulatkan per 20 unit supaya proyeksi tidak dihitung
     ulang tiap frame saat zoom halus. */
  let _jangkauBayangan = 150;
  export function aturJangkauBayangan(j) {
    j = Math.max(90, Math.min(460, Math.round(j / 20) * 20));
    if (j === _jangkauBayangan) return;
    _jangkauBayangan = j;
    const c = matahari.shadow.camera;
    c.left = -j; c.right = j; c.top = j; c.bottom = -j;
    c.updateProjectionMatrix();
  }

  /* ---------- Siklus cahaya (Paket 3 ?v=15) ----------
     Lapisan bintang: 700 titik deterministik di kubah langit (r 7.900,
     hanya belahan atas), 1 draw call, TANPA PointLight baru. Opasitasnya
     digerakkan fase waktu — siang/senja 0, malam menyala. */
  export const matBintang = new THREE.PointsMaterial({
    color: 0xffffff, size: 2.4, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  (function buatBintang() {
    const pos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const az = hashInt(i * 7 + 1) * Math.PI * 2;
      const el = Math.asin(0.06 + hashInt(i * 13 + 5) * 0.92);
      pos[i * 3] = Math.cos(el) * Math.cos(az) * 7900;
      pos[i * 3 + 1] = Math.sin(el) * 7900;
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * 7900;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const bintang = new THREE.Points(geo, matBintang);
    bintang.frustumCulled = false; bintang.renderOrder = -1;
    scene.add(bintang);
  })();
  /* Keadaan cahaya AKTIF: warna THREE.Color + angka yang dilerp halus ke
     sasaran preset tiap frame (konstanta waktu ±0,7 dtk -> mantap dalam
     ±2 detik). Dimulai persis dari preset pilihan tersimpan, jadi tidak
     ada loncatan saat halaman dimuat. */
  export const wkt = {};
  (function mulaiWaktu() {
    const p = parameterWaktu(pilihanWaktu, 0);
    for (const k of KUNCI_HEX_WAKTU) wkt[k] = new THREE.Color(p[k]);
    for (const k of KUNCI_ANGKA_WAKTU) wkt[k] = p[k];
  })();
  export let waktuSiklus = 0; // jam berjalan untuk mode "siklus" (detik)
  export const _warnaSasaran = new THREE.Color();
  export function terapkanWaktu(dt, jepret) {
    const target = parameterWaktu(pilihanWaktu, waktuSiklus);
    const k = jepret ? 1 : 1 - Math.exp(-(dt || 0) / 0.7);
    for (const key of KUNCI_HEX_WAKTU) wkt[key].lerp(_warnaSasaran.setHex(target[key]), k);
    for (const key of KUNCI_ANGKA_WAKTU) wkt[key] += (target[key] - wkt[key]) * k;
    matahari.color.copy(wkt.matahari); matahari.intensity = wkt.intMatahari;
    hemi.color.copy(wkt.langitHemi); hemi.groundColor.copy(wkt.tanahHemi); hemi.intensity = wkt.intHemi;
    kubahLangit.material.uniforms.atas.value.copy(wkt.kubahAtas);
    kubahLangit.material.uniforms.tengah.value.copy(wkt.kubahTengah);
    kubahLangit.material.uniforms.bawah.value.copy(wkt.kubahBawah);
    scene.fog.color.copy(wkt.kabut);
    if (scene.background && scene.background.isColor) scene.background.copy(wkt.latar);
    renderer.toneMappingExposure = wkt.paparan;
    if (LAMPU_JALAN.matKepala) LAMPU_JALAN.matKepala.emissiveIntensity = wkt.kepalaLampu;
    if (LAMPU_TAMAN.mat) LAMPU_TAMAN.mat.emissiveIntensity = wkt.kepalaLampu;
    matBintang.opacity = wkt.bintang;
    matAwan.color.copy(wkt.awan); matAwan.emissiveIntensity = wkt.intAwan;
    if (MAT_JENDELA.mat) MAT_JENDELA.mat.emissiveIntensity = wkt.jendela;
  }

  export const M = (warna, kasar) => new THREE.MeshStandardMaterial({ color: warna, roughness: kasar == null ? 0.95 : kasar, flatShading: true });
  export function kotak(w, h, d, warna, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(warna));
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* ---------- Tanah kota: tekstur grid per blok ---------- */
  (function tanahKota() {
    const tex = buatTeksturProsedural(buatKanvasTanah);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(BLOK_KOLOM, BLOK_BARIS);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); // jalan tetap tajam di sudut pandang landai
    const tanah = new THREE.Mesh(new THREE.PlaneGeometry(KOTA_W, KOTA_D),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    tanah.rotation.x = -Math.PI / 2; tanah.receiveShadow = true; scene.add(tanah);
    const alas = kotak(KOTA_W + 60, 6, KOTA_D + 60, 0x8a6844, 0, -3.4, 0); alas.castShadow = false; scene.add(alas);
  })();

  /* ---------- Helper geometri gabungan (untuk instancing & awan) ----------
     Menggabungkan beberapa geometri primitif (masing-masing dengan transform
     sendiri) menjadi SATU BufferGeometry non-indexed — supaya pagar & awan
     tetap 1 draw call per InstancedMesh/mesh. */
  export function gabungGeometri(daftar) {
    const pos = [], nor = [], uv = [];
    const m4 = new THREE.Matrix4(), eu = new THREE.Euler(), qt = new THREE.Quaternion(),
      vv = new THREE.Vector3(), sv = new THREE.Vector3();
    for (const d of daftar) {
      const g = d.geo.index ? d.geo.toNonIndexed() : d.geo.clone();
      eu.set(d.rx || 0, d.ry || 0, d.rz || 0); qt.setFromEuler(eu);
      vv.set(d.x || 0, d.y || 0, d.z || 0);
      sv.set(d.sx == null ? 1 : d.sx, d.sy == null ? 1 : d.sy, d.sz == null ? 1 : d.sz);
      m4.compose(vv, qt, sv); g.applyMatrix4(m4);
      const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
        if (t) uv.push(t.getX(i), t.getY(i));
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (nor.length === pos.length) geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    if (uv.length === pos.length / 3 * 2) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    return geo;
  }
  /* Varian berwarna dari gabungGeometri: tiap bagian membawa warna
     sendiri yang ditulis sebagai atribut color (material vertexColors).
     Dipakai geometriDetailMassal supaya detail muka rumah massal tetap
     SATU InstancedMesh / satu draw call (ronde skill-3d). */
  export function gabungBerwarna(daftar) {
    const pos = [], nor = [], uv = [], col = [];
    const m4 = new THREE.Matrix4(), eu = new THREE.Euler(), qt = new THREE.Quaternion(),
      vv = new THREE.Vector3(), sv = new THREE.Vector3(), cc = new THREE.Color();
    for (const d of daftar) {
      const g = d.geo.index ? d.geo.toNonIndexed() : d.geo.clone();
      eu.set(d.rx || 0, d.ry || 0, d.rz || 0); qt.setFromEuler(eu);
      vv.set(d.x || 0, d.y || 0, d.z || 0);
      sv.set(d.sx == null ? 1 : d.sx, d.sy == null ? 1 : d.sy, d.sz == null ? 1 : d.sz);
      m4.compose(vv, qt, sv); g.applyMatrix4(m4);
      cc.setHex(d.warna == null ? 0xffffff : d.warna);
      const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
        if (t) uv.push(t.getX(i), t.getY(i));
        col.push(cc.r, cc.g, cc.b);
      }
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    if (nor.length === pos.length) geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    if (uv.length === pos.length / 3 * 2) geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }
  /* Detail muka rumah massal (ronde skill-3d, img2threejs part-based):
     plinth + lis atap + pintu berbingkai + jendela berbingkai dengan
     kusen silang, digabung jadi satu geometri berwarna. Bingkai jendela
     DIALIGNKAN PERSIS ke jendela lukisan TEX_DINDING (pusat u 0,28/0,72
     -> x ±1,89; v 0,36..0,70 -> y 1,51..2,94 pada dinding 8,6 x 4,2),
     jadi bingkai 3D duduk di atas kaca lukisan, bukan di sebelahnya.
     Origo di tanah (y=0) — instans memakai skala-y yang sama dengan
     dinding, jadi alignmen bertahan di semua variasi tinggi rumah. */
  /* Detail muka rumah massal REALISTIS (26 Nov 2026): satu geometri
     berwarna verteks untuk semua rumah (1 draw call). Dinding 8,6 x 4,2 x 7,6
     berpusat di (0, 2,1, 0); muka depan z +3,8.
     - pondasi + anak tangga teras, lantai teras keramik
     - kanopi teras beratap genteng di atas 2 tiang + lampu teras
     - pintu panel kayu berbingkai + kaca di atas pintu, kenop, nomor rumah
     - jendela berkaca (biru-langit memantul) + tirai + teralis + ambang +
       lis atas, juga di sisi kiri, kanan & belakang
     - roster ventilasi di atas jendela, lis plafon & talang air + pipa turun
     - unit AC luar di sisi, meteran listrik, kotak surat */
  export function geometriDetailMassal() {
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const TRIM = 0xfdf3d8, KAYU = 0x7a5230, KACA = 0x5f8aa3, TIRAI = 0xe9dcc2, BESI = 0x2a2c30, KERAMIK = 0xc9b9a0;
    const bagian = [];
    const P = (w, h, d, x, y, z, warna, rx, ry) => bagian.push({ geo: B(w, h, d), x, y, z, rx: rx || 0, ry: ry || 0, warna });
    P(9.3, 0.55, 8.3, 0, 0.27, 0, 0x9a938a);                                   // pondasi
    P(9.0, 0.4, 8.0, 0, 4.02, 0, TRIM);                                        // lis plafon
    // teras depan: lantai keramik + 2 anak tangga
    P(5.6, 0.3, 2.2, 0, 0.42, 4.9, KERAMIK);
    P(2.0, 0.15, 0.4, 0, 0.13, 6.15, 0x9a938a); P(2.0, 0.3, 0.35, 0, 0.2, 5.85, 0x9a938a);
    // kanopi teras: 2 tiang + atap miring + lisplang
    for (const sx of [-1, 1]) { P(0.22, 3.2, 0.22, sx * 2.6, 2.15, 5.85, TRIM); P(0.34, 0.2, 0.34, sx * 2.6, 0.62, 5.85, 0x9a938a); }
    P(6.2, 0.14, 2.6, 0, 3.86, 5.0, 0xa04a32, -0.2); P(6.3, 0.22, 0.08, 0, 3.66, 6.28, TRIM);
    P(0.22, 0.22, 0.22, 1.2, 3.45, 4.2, 0xfff1c4);                              // lampu teras
    // pintu: bingkai, daun panel, kaca atas, kenop, nomor
    // pintu menutup PENUH bukaan kusen (dulu ada celah kaca pucat di atas daun pintu)
    P(1.7, 3.0, 0.14, 0, 1.5, 3.82, TRIM);                                     // kusen
    P(1.36, 2.82, 0.18, 0, 1.43, 3.86, 0x7a4a21);                              // daun pintu setinggi kusen
    for (const [py, ph] of [[0.7, 0.9], [1.9, 0.9]]) for (const px of [-0.3, 0.3]) P(0.45, ph, 0.04, px, py, 3.96, 0x6a3f1c); // panel
    P(1.2, 0.22, 0.04, 0, 2.6, 3.96, 0x6a3f1c);                                // panel atas
    P(1.8, 0.16, 0.22, 0, 3.05, 3.86, TRIM);                                   // lis atas pintu
    P(0.12, 0.12, 0.08, 0.5, 1.3, 3.97, 0xd9a441);                             // kenop
    P(0.45, 0.25, 0.04, 1.3, 2.4, 3.82, 0x1d3a5f);                              // pelat nomor rumah
    // jendela: fungsi umum di bidang (normal arah n: 'z' / 'x')
    const jendela = (x, z, sisi, lebar) => {
      const dz = sisi === "z" ? Math.sign(z) : 0, dx = sisi === "x" ? Math.sign(x) : 0;
      const W = (w, d) => (sisi === "z" ? [w, d] : [d, w]);
      const put = (w, h, d, ox, y, off, warna) => { const [a, c] = W(w, d); P(a, h, c, x + (sisi === "z" ? ox : dx * off), y, z + (sisi === "z" ? dz * off : ox), warna); };
      /* kusen = 4 batang (BUKAN balok padat): dulu balok kusen menutupi panel kaca
         (muka depannya sebidang -> kaca tertutup/berkedip). Kaca kini di depan
         dinding, di dalam bingkai; tirai tipis di sisi kiri kaca. */
      put(lebar + 0.2, 0.1, 0.12, 0, 2.2 + 0.8, 0.05, KAYU); put(lebar + 0.2, 0.1, 0.12, 0, 2.2 - 0.8, 0.05, KAYU);
      put(0.1, 1.5, 0.12, -lebar / 2 - 0.05, 2.2, 0.05, KAYU); put(0.1, 1.5, 0.12, lebar / 2 + 0.05, 2.2, 0.05, KAYU);
      put(lebar, 1.5, 0.012, 0, 2.2, 0.016, KACA);                  // kaca (di depan muka dinding)
      put(lebar * 0.3, 1.42, 0.006, -lebar * 0.33, 2.22, 0.026, TIRAI); // tirai terlihat di balik kaca
      put(0.08, 1.5, 0.1, 0, 2.2, 0.06, KAYU);                      // kusen tengah
      for (let i = 1; i < 6; i++) put(0.03, 1.5, 0.04, -lebar / 2 + i * lebar / 6, 2.2, 0.12, BESI); // teralis
      put(lebar + 0.4, 0.12, 0.24, 0, 1.38, 0.08, TRIM);            // ambang bawah
      put(lebar + 0.3, 0.12, 0.16, 0, 3.08, 0.06, TRIM);            // lis atas
      put(lebar, 0.3, 0.05, 0, 3.5, 0.0, 0xd8cfbf);                 // roster ventilasi
      for (let i = 0; i < 5; i++) put(0.16, 0.16, 0.06, -lebar / 2 + 0.2 + i * (lebar - 0.4) / 4, 3.5, 0.02, 0x8a8478);
    };
    for (const sx of [-1, 1]) jendela(sx * 2.25, 3.8, "z", 1.9);
    jendela(-4.3, -1.6, "x", 1.4); jendela(4.3, -1.6, "x", 1.4); jendela(4.3, 1.6, "x", 1.0);
    jendela(-1.8, -3.8, "z", 1.4); jendela(1.9, -3.8, "z", 1.0);
    // talang air & pipa turun
    P(9.4, 0.14, 0.16, 0, 4.25, 4.12, 0x6b6f74); P(9.4, 0.14, 0.16, 0, 4.25, -4.12, 0x6b6f74);
    for (const [x, z] of [[4.45, 4.1], [-4.45, -4.1]]) P(0.12, 4.0, 0.12, x, 2.2, z, 0x6b6f74);
    // unit AC luar, meteran listrik, kotak surat
    P(0.85, 0.6, 0.35, -2.4, 1.2, -4.0, 0xe9ecef); P(0.5, 0.5, 0.02, -2.4, 1.2, -4.19, 0x8a8f94);   // AC luar (belakang, tak tertabrak mobil carport)
    P(0.35, 0.45, 0.16, 3.55, 1.6, 3.88, 0x8a8f94);                                                   // meteran listrik
    P(0.4, 0.3, 0.25, 2.6, 1.35, 6.0, 0xc8102e);
    return gabungBerwarna(bagian);
  }
  /* Atap pelana (prisma segitiga): bubungan sejajar sumbu z, ujung segitiga
     menghadap depan/belakang rumah. Basis di y=0, tinggi h. Non-indexed ->
     normal wajah datar (flat shading) dari computeVertexNormals. */
  export function geometriAtapPelana(w, h, d) {
    const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2],
      D = [-w / 2, 0, d / 2], E = [0, h, -d / 2], F = [0, h, d / 2];
    const wajah = [
      [A, F, E, [0, 1], [1, 0], [0, 0]], [A, D, F, [0, 1], [1, 1], [1, 0]], // lereng kiri (v: bubungan 0 -> tepi 1)
      [B, E, F, [0, 0], [0, 1], [1, 0]], [B, F, C, [0, 0], [1, 1], [1, 1]], // lereng kanan
      [D, C, F, [0, 0], [1, 0], [0.5, 1]],                                  // ujung depan (+z)
      [B, A, E, [1, 0], [0, 0], [0.5, 1]],                                  // ujung belakang (-z)
      /* plafon/lisplang bawah (menghadap -y): dulu tidak ada, jadi dari bawah
         (1st/3rd Person di dekat rumah) bagian atap yang menjorok melewati
         dinding terlihat bolong ke langit karena sisi belakang lereng di-cull. */
      [A, B, C, [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], [A, C, D, [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]],
    ];
    const pos = [], uv = [];
    for (const [p1, p2, p3, t1, t2, t3] of wajah) {
      pos.push(...p1, ...p2, ...p3);
      uv.push(t1[0] * 2, t1[1], t2[0] * 2, t2[1], t3[0] * 2, t3[1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    /* normal plafon dibalik ke atas: menghadap -y ia hanya menerima cahaya
       pantul tanah (nyaris hitam). Dengan normal +y ia diterangi langit
       (hemisphere) & tetap berbayang atap -> rona genteng teduh, wajar. */
    const nor = geo.attributes.normal;
    for (let i = nor.count - 6; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    return geo;
  }
  /* Mesh atap pelana: materialnya WAJIB tanpa flatShading — flatShading
     menghitung normal dari turunan layar & mengabaikan normal plafon (+y),
     sehingga plafon kembali hitam. Lereng tetap tampak rata karena
     geometrinya tak berindeks (normal per wajah). Material harus milik mesh
     ini sendiri (tidak dipakai bersama bentuk lain). */
  /* Untuk atap limas (kerucut-4) & atap datar (kotak): jadikan tak berindeks
     (normal per wajah = tetap tampak rata tanpa flatShading) lalu balik
     normal wajah alas (seluruh titiknya di y terendah) ke +y, sama seperti
     plafon pelana. Material pemakainya juga tanpa flatShading. */
  export function plafonTerang(geo) {
    const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal; let yMin = Infinity;
    for (let i = 0; i < p.count; i++) yMin = Math.min(yMin, p.getY(i));
    for (let i = 0; i < p.count; i += 3) if ([0, 1, 2].every((k) => Math.abs(p.getY(i + k) - yMin) < 1e-4)) for (let k = 0; k < 3; k++) n.setXYZ(i + k, 0, 1, 0);
    return g;
  }
  export function meshPelana(geo, mat) { mat.flatShading = false; mat.needsUpdate = true; return new THREE.Mesh(geo, mat); }
  export function geometriPagar() { // pagar kayu: 4 tiang + 2 rel, panjang 12,6, basis y=0
    const bagian = [];
    for (const px of [-6, -2, 2, 6]) bagian.push({ geo: new THREE.BoxGeometry(0.22, 1.15, 0.22), x: px, y: 0.575, z: 0 });
    bagian.push({ geo: new THREE.BoxGeometry(12.6, 0.16, 0.1), x: 0, y: 0.88, z: 0 });
    bagian.push({ geo: new THREE.BoxGeometry(12.6, 0.16, 0.1), x: 0, y: 0.45, z: 0 });
    return gabungGeometri(bagian);
  }
  export function geometriAwan(seed) { // 4–5 gumpalan bola pipih digabung jadi 1 geometri
    const bagian = [];
    const n = 4 + Math.floor(hashInt(seed * 3 + 1) * 2);
    for (let j = 0; j < n; j++) {
      bagian.push({
        geo: new THREE.SphereGeometry(5 + hashInt(seed * 7 + j * 13) * 7, 7, 5),
        x: (j - (n - 1) / 2) * 8.5 + hashInt(seed + j) * 3,
        y: hashInt(seed * 5 + j) * 2.4, z: hashInt(seed * 11 + j) * 5, sy: 0.5,
      });
    }
    return gabungGeometri(bagian);
  }
  /* Kilau matahari di permukaan danau: bidang aditif bergradasi radial —
     BUKAN refleksi real-time. Bidang diletakkan >= 0,35 di atas air (audit
     z-fighting: air danau besar y=0,10 -> kilau 0,45; danau taman 0,52 -> 0,87). */
  export const TEX_KILAU = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const grd = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,240,200,0.95)");
    grd.addColorStop(0.4, "rgba(255,220,150,0.45)");
    grd.addColorStop(1, "rgba(255,210,130,0)");
    c.fillStyle = grd; c.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  export function tambahKilau(x, z, y, w, d, opasitas) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: TEX_KILAU, transparent: true, opacity: opasitas, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
    scene.add(m);
    return m;
  }

  /* ---------- Rumah massal: InstancedMesh ----------
     ATURAN RUMAH (Fahmi 21 Nov 2026): rumah hanya milik warga terdaftar.
     Dinding/atap/cerobong/teras instanced HANYA dibuat untuk kavling yang
     posisinya (blok,kavling) ada di rumahTerisi (data /api/warga di ambilData) — jumlah
     instans rumah == jumlah warga terdaftar di blok perumahan massal,
     DIKURANGI kavling detail ?v=18 (rumahDetailSet): rumah detail milik
     <=30 warga terbaru berdiri di petak yang sama menggantikan instans
     ini, jadi tiap warga tetap terlihat tepat 1 rumah.
     Kavling kosong tetap lahan kosong: petaknya dari tekstur tanah +
     dekorasi berpola (pagar/semak/pohon kecil, di bawah) yang memang
     berada di luar tapak rumah, jadi terbaca sebagai petak siap bangun,
     bukan rumah yang hilang.
     PERAPIAN 3D: warna rumah tidak lagi acak per rumah (karpet tabrakan
     warna) — atap & dinding diturunkan dari zona RW bloknya (lihat LOGIKA
     PERAPIAN di atas): satu zona satu keluarga warna, jitter kecil per
     rumah. Rumah terisi yang warna pemiliknya tercatat tetap memakai warna
     baju pemilik sebagai warna atap (identitas pemilik dipertahankan). */
  export const awanGrup = new THREE.Group(); scene.add(awanGrup);
  export const matAwan = new THREE.MeshStandardMaterial({
    color: 0xfff8ec, roughness: 1, transparent: true, opacity: 0.94,
    emissive: 0xffd9a0, emissiveIntensity: 0.22, // pantulan hangat golden hour
  });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(geometriAwan(i + 1), matAwan);
    m.position.set(-2600 + hashInt(i * 31) * 5200, 150 + hashInt(i * 17) * 110, -1800 + hashInt(i * 13) * 3600);
    m.userData.kecepatan = 0.35 + hashInt(i * 7) * 0.4;
    awanGrup.add(m);
  }

  /* ================= PENERAPAN KUALITAS GRAFIK =================
     terapkanKualitas() mendorong PARAM aktif ke renderer, matahari,
     dekorasi kavling (count), awan (visible) dan tekstur (gambar ulang).
     Dipanggil saat muat, saat user mengganti pilihan, dan saat tangga
     otomatis naik/turun. Mode kamera & interior tidak disentuh sama sekali. */
  export const fpsStat = { bingkai: 0, akumulasi: 0, diAtasSejak: 0, jedaSampai: 0 };
  export let frameTerakhirMs = 0, indikatorTimer = null;
  /* Jarak tampil detail (interior gedung, penumpang, NPC gedung) mengikuti
     langkah kualitas: Rendah 120 m · Sedang 200 m · Tinggi 320 m. */
  export function jarakDetail() { return [120, 200, 280, 320][langkahKualitas] || 320; }
  export function terapkanKualitas() {
    const pBaru = parameterKualitas(langkahKualitas, window.devicePixelRatio || 1);
    const bayanganBerubah = pBaru.bayangan !== PARAM.bayangan;
    const texBerubah = pBaru.skalaTekstur !== PARAM.skalaTekstur;
    PARAM = pBaru;
    renderer.setPixelRatio(PARAM.pixelRatio);
    if (bayanganBerubah) {
      renderer.shadowMap.enabled = PARAM.bayangan;
      matahari.castShadow = PARAM.bayangan;
      scene.traverse((o) => { // program shader harus dibangun ulang tanpa/dengan bayangan
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; });
      });
    }
    if (PARAM.bayangan && PARAM.petaBayangan && matahari.shadow.mapSize.x !== PARAM.petaBayangan) {
      matahari.shadow.mapSize.set(PARAM.petaBayangan, PARAM.petaBayangan);
      if (matahari.shadow.map) { matahari.shadow.map.dispose(); matahari.shadow.map = null; }
    }
    for (const d of IM_LINGKUNGAN) d.mesh.count = Math.floor(d.penuh * PARAM.kepadatan);
    const awanTampil = Math.max(4, Math.round(awanGrup.children.length * PARAM.kepadatan));
    awanGrup.children.forEach((g, i) => { g.visible = i < awanTampil; });
    if (texBerubah) segarkanTekstur();
    perbaruiInfoKualitas();
  }
  export function tampilIndikatorKualitas() {
    const el = $("#indikator-kualitas"); if (!el) return;
    el.textContent = "Kualitas otomatis: " + PARAM.nama;
    el.hidden = false;
    clearTimeout(indikatorTimer);
    indikatorTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  export function perbaruiInfoKualitas() {
    document.querySelectorAll("#seg-kualitas button").forEach((b) =>
      b.classList.toggle("on", b.dataset.kualitas === pilihanKualitas));
    const info = $("#info-kualitas");
    if (!info) return;
    info.textContent = pilihanKualitas === "otomatis"
      ? "Otomatis aktif — tingkat saat ini: " + PARAM.nama + ". Naik/turun sendiri mengikuti kelancaran HP."
      : pilihanKualitas === "rendah"
        ? "Rendah: hemat baterai & lancar di HP kentang (tanpa bayangan, resolusi rendah, isi gedung & penumpang hanya dari dekat)."
        : pilihanKualitas === "sedang"
          ? "Sedang: seimbang — tanpa bayangan, detail lingkungan setengah, isi gedung terlihat dari jarak menengah."
          : "Tinggi: tampilan paling bagus (bayangan lembut, resolusi penuh, detail penuh, isi gedung terlihat dari jauh).";
  }
  export function setPilihanKualitas(v) {
    pilihanKualitas = v;
    try { localStorage.setItem("pinarak_kualitas", v); } catch (e) {}
    langkahKualitas = indeksUntukPilihan(v); // otomatis & tinggi mulai dari langkah teratas, rendah dari terbawah
    fpsStat.diAtasSejak = 0; fpsStat.bingkai = 0; fpsStat.akumulasi = 0;
    terapkanKualitas();
  }
  /* Waktu negara (Paket 3 ?v=15): pilihan Siang / Senja / Malam / Siklus.
     Mengganti pilihan TIDAK memotong cahaya — terapkanWaktu() di loop
     animasi melerp keadaan aktif ke preset baru dalam ±2 detik. */
  export function perbaruiInfoWaktu() {
    document.querySelectorAll("#seg-waktu button").forEach((b) =>
      b.classList.toggle("on", b.dataset.waktu === pilihanWaktu));
    const info = $("#info-waktu");
    if (!info) return;
    info.textContent = pilihanWaktu === "siang"
      ? "Siang: cahaya terang, lampu jalan padam."
      : pilihanWaktu === "malam"
        ? "Malam: lampu jalan & jendela balai menyala, bintang tampil."
        : pilihanWaktu === "siklus"
          ? "Siklus: siang → senja → malam berputar sendiri perlahan (4 menit per putaran)."
          : "Senja: golden hour khas Negara Merdu (tampilan bawaan).";
  }
  export function setPilihanWaktu(v) {
    pilihanWaktu = v;
    try { localStorage.setItem("pinarak_waktu", v); } catch (e) {}
    if (v !== "siklus") waktuSiklus = 0;
    perbaruiInfoWaktu();
  }
  /* Monitor FPS bergulir ±5 detik (hanya mode otomatis): sampel dt mentah
     antar-frame; jeda >250 ms (pindah tab dsb.) diabaikan. */
  export function pantauKualitas(dtMs, kini) {
    if (pilihanKualitas !== "otomatis") return;
    if (dtMs <= 0 || dtMs > 250) return;
    fpsStat.bingkai++; fpsStat.akumulasi += dtMs;
    if (fpsStat.akumulasi < 5000) return;
    const fps = fpsStat.bingkai / (fpsStat.akumulasi / 1000);
    fpsStat.bingkai = 0; fpsStat.akumulasi = 0;
    const st = { langkah: langkahKualitas, diAtasSejak: fpsStat.diAtasSejak, jedaSampai: fpsStat.jedaSampai };
    const hasil = evaluasiOtomatis(st, fps, kini);
    fpsStat.diAtasSejak = st.diAtasSejak; fpsStat.jedaSampai = st.jedaSampai;
    if (hasil) {
      langkahKualitas = st.langkah;
      terapkanKualitas();
      tampilIndikatorKualitas();
    }
  }

  /* Fase lampu lalu lintas: material bersama per sumbu/warna ditukar HANYA
     saat fase berubah (paling sering 1x/detik di perbatasan kuning) —
     biaya per frame di luar itu nol, tanpa PointLight baru. */
  export function perbaruiLaluLintas(t) {
    const mat = LL_AKTIF.mat; if (!mat) return;
    const f = faseLaluLintas(t), kunci = f.us + "|" + f.tb;
    if (kunci === LL_AKTIF.kunci) return;
    LL_AKTIF.kunci = kunci;
    for (const sumbu of ["us", "tb"]) for (const w of ["merah", "kuning", "hijau"]) {
      const m = mat[sumbu][w], nyala = f[sumbu] === w;
      m.emissiveIntensity = nyala ? 2.4 : 0;
      m.color.setHex(nyala ? WARNA_LAMPU_LL[w].nyala : WARNA_LAMPU_LL[w].mati);
    }
    if (LL_AKTIF.ped) for (const sumbu of ["us", "tb"]) { // penyeberang: hijau hanya saat arus sumbu tiang HIJAU
      const jalan = f[sumbu] === "hijau";
      LL_AKTIF.ped[sumbu].hijau.emissiveIntensity = jalan ? 2.2 : 0;
      LL_AKTIF.ped[sumbu].merah.emissiveIntensity = jalan ? 0 : 2.2;
    }
  }


  /* Helper lintas-modul (migrasi Next.js): waktuSiklus & frameTerakhirMs
     hanya boleh diubah dari modul ini (pemilik deklarasinya). */
  export function resetWaktuSiklus() { waktuSiklus = 0; }
  export function tambahWaktuSiklus(dt) { waktuSiklus += dt; }
  export function pantauFrame(kiniMs) {
    if (frameTerakhirMs) pantauKualitas(kiniMs - frameTerakhirMs, kiniMs); // tangga kualitas otomatis
    frameTerakhirMs = kiniMs;
  }
