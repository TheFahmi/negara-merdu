/* Negara Merdu — modul game "inti" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Inti: helper $, ikon SVG, konstanta kota, dan logika murni (perapian, lalu lintas, kualitas, waktu, aktivitas NPC). */

  export const $ = (s) => document.querySelector(s);
  /* Ikon SVG gambar sendiri (emoji dilarang di UI — keputusan Fahmi). */
  export const IK = {
    rumah: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    pintu: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M2.5 22h19"/><circle cx="13.2" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg>',
    ktp: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.4 17c.6-1.6 1.4-2.4 2.6-2.4s2 .8 2.6 2.4"/><path d="M14 9.5h5M14 13h5"/></svg>',
    keluarga: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5v-2A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5v2"/><circle cx="17.5" cy="9.5" r="2.6"/><path d="M16 14.4a4.5 4.5 0 0 1 5.5 4.4v1.7"/></svg>'
  };

  /* ================= KONSTANTA KOTA (samakan dengan server) ================= */
  export const BLOK_KOLOM = 80, BLOK_BARIS = 50, PER_BLOK = 25, SISI = 5;
  export const PITCH = 84, JALAN = 14, KAV_PITCH = 14;
  export const KAPASITAS = 100000;
  /* Skala mobil penumpang (parkir di rumah & lalu lintas arteri) relatif model
     ±4,2 m: dunia game berskala besar (lajur 7, rumah 8,6, pintu ±3), jadi
     mobil 1:1 tampak kerdil di samping rumah. Satu konstanta untuk keduanya. */
  export const SKALA_MOBIL = 1.35;
  /* Skala SEMUA karakter (pemain sendiri, pemain lain, warga di rumah, NPC
     plaza/pasar/mall/penumpang): satu angka supaya tinggi badan sama
     (±1,75 m, sebanding mata 1st Person 1,6 & interior bus/KRL/rumah). */
  export const SKALA_KARAKTER = 1.0;
  /* Warna aspal: SATU sumber untuk tekstur jalan (buatKanvasTanah) dan
     tutup marka persimpangan (kota.js) — dulu dua nilai terpisah sehingga
     persimpangan tampak sebagai tambalan berbentuk salib. */
  export const WARNA_ASPAL_HEX = 0x5c6066, WARNA_ASPAL_CSS = "#5c6066";
  /* Pusat plaza / Istana Negara diselaraskan dengan SUMBU JALAN kota
     (perbaikan posisi istana): jalan tengah utara-selatan & barat-timur
     berada di x/z 0..14 (as 7), sedangkan plaza dulu dipusatkan di (0,0)
     sehingga istana menggeser 7 unit dari as jalan dan terlihat miring
     terhadap grid. Semua koordinat plaza kini relatif ke titik ini. */
  export const PUSAT_X = JALAN / 2, PUSAT_Z = JALAN / 2;
  /* Ukuran plaza & istana (relatif pusat plaza). Istana diskalakan 1,45x
     dan pusat grupnya di z -50 (dulu skala 1 di z -34). Pak Presiden
     berdiri di pelataran, di kaki tangga istana. PINTU_ISTANA = titik
     masuk interior (di puncak tangga, depan portico). */
  export const PLAZA_W = 260, PLAZA_D = 130;
  export const SKALA_ISTANA = 1.45, Z_ISTANA = -50;
  export const POS_KADES = { x: 4.6 * SKALA_ISTANA, z: Z_ISTANA + 17.4 * SKALA_ISTANA };
  export const PINTU_ISTANA = { x: 0, z: Z_ISTANA + 12.6 * SKALA_ISTANA };
  export const KOTA_W = BLOK_KOLOM * PITCH, KOTA_D = BLOK_BARIS * PITCH;
  export const RESERVASI = new Set(); // blok pusat: plaza + balai + distrik detail
  for (let k = 38; k <= 41; k++) for (let b = 24; b <= 25; b++) RESERVASI.add(k + "," + b);
  export const TAMAN = new Set(); // blok taman berkala — kini LAHAN PEMBANGUNAN (lihat bangunLahanPembangunan)
  for (let k = 4; k < BLOK_KOLOM; k += 8) for (let b = 4; b < BLOK_BARIS; b += 8) TAMAN.add(k + "," + b);
  // 2 blok fasilitas tepi cluster warga (perintah Fahmi 2026-11-22:
  // fasilitas dipindah dekat keramaian) — di luar pola berkala, wajib
  // sama dengan pengecualian BlokTerlarang di server: (38,23) Taman di
  // barat Blok 1880 & (41,23) Toko Pancing di timur Blok 1881.
  TAMAN.add("38,23"); TAMAN.add("41,23");
  TAMAN.add("39,26"); // Blok 2120 — Apartemen Merdu Residence (selatan plaza, Fahmi 2026-11-22)
  /* Fasilitas desa (pembangunan bertahap): 8 dari 60 blok lahan dicadangkan
     untuk fasilitas bernama. Nama/biaya/status datang dari server
     (GET /api/pembangunan); peta blok ini harus sama dengan FASILITAS di
     server.py. Blok taman sisanya lahan kosong generik. */
  export const FASILITAS_BLOK = {
    taman: { kol: 38, bar: 23 }, lapangan: { kol: 20, bar: 36 },
    perpustakaan: { kol: 12, bar: 12 }, balai_warga: { kol: 68, bar: 12 },
    sekolah: { kol: 52, bar: 20 }, puskesmas: { kol: 60, bar: 36 },
    pasar: { kol: 28, bar: 28 }, masjid: { kol: 44, bar: 28 },
    // Bangunan voting warga (?v=34; dipindah ?v=35): Blok 1882 tepat di
    // timur Blok 1881 (cluster warga) — sebelumnya di selatan blok danau,
    // dinilai Fahmi terlalu jauh dari keramaian. Taman juga dipindah
    // (?v=35) ke Blok 1879 tepat di barat Blok 1880.
    toko_pancing: { kol: 41, bar: 23 },
    // Apartemen Merdu Residence (Fahmi 2026-11-22): Blok 2120 tepat di
    // selatan plaza — rencana pembangunan Rp50.000.000 (status dari server).
    apartemen: { kol: 39, bar: 26 },
    // Dapur MBG (Makan Bergizi Gratis / SPPG) — Blok 1005, lahan berkala di
    // utara pusat, searah sekolah. Merdu Mall — Blok 2917, lahan berkala di
    // selatan pusat (bekas rencana lama Toko Pancing). Keduanya rencana
    // pembangunan biasa (status dari server), tanpa mengubah alokasi rumah.
    dapur_mbg: { kol: 44, bar: 12 },
    koperasi: { kol: 36, bar: 12 }, // Koperasi Desa Merah Putih — Blok 997, di barat Dapur MBG
    mall: { kol: 36, bar: 36 },
  };

  /* ===== Hierarki wilayah (WAJIB sama dengan goserver/internal/db/db.go) =====
     RT = 5x5 blok (160 RT) · RW = 4x2 RT (20 RW) · Kelurahan = 2 RW
     barat-timur (10) · Kecamatan = kolom kelurahan (2: Barat/Timur) ·
     Kota = seluruh negara (Kota Merdu). Ketua: Ketua RT, Ketua RW, Lurah,
     Camat, Wali Kota — dipilih lewat Pemilu; Presiden di atas semuanya. */
  export const NAMA_KELURAHAN = ["Sukamerdu", "Mekarsari", "Sidomulyo", "Tanjungsari", "Harapanjaya",
    "Sukamaju", "Karangrejo", "Bumiayu", "Margasari", "Sumberjaya"];
  export const NAMA_KECAMATAN = ["Merdu Barat", "Merdu Timur"];
  export const NAMA_KOTA = "Kota Merdu";
  export function wilayahLengkap(blok) {
    const idx = blok - 1, baris = Math.floor(idx / BLOK_KOLOM), kolom = idx % BLOK_KOLOM;
    const rtKol = Math.floor(kolom / 5), rtBar = Math.floor(baris / 5);
    const rt = rtBar * 16 + rtKol + 1, rw = Math.floor(rtBar / 2) * 4 + Math.floor(rtKol / 4) + 1;
    const kelurahan = Math.floor((rw - 1) / 4) * 2 + Math.floor(((rw - 1) % 4) / 2) + 1;
    const kecamatan = (kelurahan - 1) % 2 + 1;
    return { rt, rw, kelurahan, nama_kelurahan: NAMA_KELURAHAN[kelurahan - 1], kecamatan,
      nama_kecamatan: NAMA_KECAMATAN[kecamatan - 1], kota: 1, nama_kota: NAMA_KOTA };
  }
  export function teksRTRW(wl) { return String(wl.rt).padStart(3, "0") + "/" + String(wl.rw).padStart(2, "0"); }
  /* Apartemen (lahan generik dekat pusat — bukan fasilitas server). */
  /* Gedung kantor & sekolah berkaca bening ber-interior (gedungKaca.js), di
     lahan berkala yang belum dipakai fasilitas/apartemen. */
  export const GEDUNG_KACA_BLOK = [
    { kol: 52, bar: 36, jenis: "kantor", nama: "MENARA MERDU", lantai: 9 },
    { kol: 28, bar: 36, jenis: "kantor", nama: "GRAHA NIAGA", lantai: 6 },
    { kol: 60, bar: 28, jenis: "sekolah", nama: "SMA NEGERI 1 MERDU" },
    { kol: 20, bar: 28, jenis: "sekolah", nama: "SMP NEGERI 1 MERDU" },
  ];
  export const APARTEMEN_BLOK = [
    { kol: 36, bar: 20, nama: "Merdu Residence" }, { kol: 44, bar: 20, nama: "Taman Sari Tower" },
    { kol: 28, bar: 20, nama: "Griya Kencana" }, { kol: 52, bar: 28, nama: "Puri Harmoni" },
  ];
  export function sudutBlok(kol, bar) { return { x: (kol - BLOK_KOLOM / 2) * PITCH, z: (bar - BLOK_BARIS / 2) * PITCH }; }
  export function posisiKavling(blokNomor, kavlingNomor) {
    const bi = blokNomor - 1, bar = Math.floor(bi / BLOK_KOLOM), kol = bi % BLOK_KOLOM;
    const ki = kavlingNomor - 1, kx = ki % SISI, kz = Math.floor(ki / SISI);
    const s = sudutBlok(kol, bar);
    return { x: s.x + JALAN + KAV_PITCH / 2 + kx * KAV_PITCH, z: s.z + JALAN + KAV_PITCH / 2 + kz * KAV_PITCH };
  }
  export function hashInt(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = (x * 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }

  /* === AWAL LOGIKA PERAPIAN (murni — tanpa DOM/THREE, bisa diuji Node) ===
     Perapian 3D: kota dibagi 20 zona RW (sama dengan WilayahDariBlok di
     server Go: RW = kelompok 20 kolom-blok x 10 baris-blok). Tiap zona satu
     keluarga warna; dekorasi kavling & elemen jalan berpola deterministik
     dari indeks grid — tidak ada Math.random, tampilan sama di semua klien. */
  export function zonaDariKolBar(kol, bar) { // 0..19, indeksnya = nomor RW - 1
    return Math.floor(bar / 10) * 4 + Math.floor(kol / 20);
  }
  /* Hue basis per zona: menyapu spektrum perlahan (langkah 16,2°) supaya
     zona bertetangga bergeser halus dan zona berjauhan kontras jelas. */
  export const HUE_ZONA = [];
  for (let i = 0; i < 20; i++) HUE_ZONA.push((i * 0.045) % 1);
  /* Warna atap/dinding satu rumah dalam keluarga zonanya: hue tetap,
     jitter kecil dari dua nilai hash (a, b dalam 0..1) supaya tetap hidup. */
  /* Palet atap & dinding (perbaikan 3D rumah): dulu hue menyapu seluruh
     spektrum per zona -> atap ungu/magenta/hijau neon yang norak setelah
     koreksi sRGB. Kini atap dari palet material NYATA (genteng terakota,
     bata, tanah liat, sirap cokelat, seng biru/hijau tua, arang) dan
     dinding plesteran pastel hangat. Tiap zona RW punya 3 warna atap
     dominan (keluarga warnanya tetap terbaca di peta), dijitter halus. */
  export const PALET_ATAP_HSL = [
    [0.030, 0.58, 0.46], // terakota
    [0.010, 0.52, 0.40], // genteng bata
    [0.060, 0.62, 0.50], // tanah liat oranye
    [0.075, 0.38, 0.33], // sirap cokelat
    [0.580, 0.30, 0.40], // seng biru batu
    [0.430, 0.30, 0.34], // hijau tua
    [0.110, 0.55, 0.47], // genteng mustard
    [0.610, 0.10, 0.30], // arang
  ];
  export const PALET_DINDING_HSL = [
    [0.11, 0.55, 0.90], // krem
    [0.08, 0.40, 0.92], // putih hangat
    [0.14, 0.60, 0.86], // kuning gading
    [0.05, 0.55, 0.88], // persik
    [0.30, 0.25, 0.86], // sage
    [0.56, 0.25, 0.88], // biru pucat
    [0.97, 0.35, 0.90], // merah muda pucat
  ];
  export function warnaAtapZonaHSL(zona, a, b) {
    const P = PALET_ATAP_HSL, w = P[(zona * 3 + Math.floor(a * 3)) % P.length];
    return [(w[0] + (b - 0.5) * 0.02 + 1) % 1, w[1], w[2] + (b - 0.5) * 0.06];
  }
  export function warnaDindingZonaHSL(zona, a, b) {
    const P = PALET_DINDING_HSL, w = P[(zona + Math.floor(b * 4)) % P.length];
    return [w[0], w[1], w[2] + (a - 0.5) * 0.04];
  }
  export function warnaZonaPeta(zona, terang) { // warna keluarga zona (dulu warna blok di peta; blok peta kini petak lahan — lihat WARNA_PETA.petak)
    return "hsl(" + Math.round(HUE_ZONA[zona] * 360) + ", 45%, " + (terang ? 60 : 53) + "%)";
  }
  /* Pola dekorasi per kavling: modular terhadap posisi kavling di blok +
     geser per nomor blok — dari atas terbaca sebagai pola teratur, bukan
     sebaran acak. Kepadatan meniru pola lama (pagar ±25%, semak ±33%,
     pohon ±14%). */
  export function polaKavling(kx, kz, blokNomor) {
    return {
      pagar: (kx + kz + blokNomor % 3) % 4 === 0,
      semak: (2 * kx + kz + blokNomor % 2) % 3 === 0,
      pohon: (kx + 3 * kz + blokNomor) % 7 === 0,
    };
  }
  /* Elemen jalan utama: pohon & lampu berderet pada interval tetap 42 di
     trotoar sisi kavling jalan antar-zona (jalan di tepi blok kolom
     0/20/40/60 dan baris 0/10/20/30/40 = batas-batas RW) — pohon fase +35,
     lampu fase +17, jadi selang-seling teratur. Kawasan pusat (blok
     cadangan + plaza) dikecualikan: sudah ditata sendiri di pusatKota().
     h = kunci urut hash supaya pemotongan .count oleh kepadatan kualitas
     menipiskan deretan secara merata. */
  export function elemenJalan() {
    const pohon = [], lampu = [];
    const TRO = 15.2; // strip jalan 0..14; titik tanam di trotoar, rumah mulai ±16,7
    const dalamPusat = (x, z) => Math.abs(x) < 182 && Math.abs(z) < 98;
    let idx = 0;
    for (const kol of [0, 20, 40, 60]) { // jalan vertikal antar-zona
      const x = sudutBlok(kol, 0).x + TRO;
      for (let z = -KOTA_D / 2 + 35; z < KOTA_D / 2; z += 42)
        if (!dalamPusat(x, z)) pohon.push({ x, z, h: hashInt((idx++) * 7 + 3) });
      for (let z = -KOTA_D / 2 + 17; z < KOTA_D / 2; z += 42)
        if (!dalamPusat(x, z)) lampu.push({ x, z, h: hashInt((idx++) * 11 + 5) });
    }
    for (const bar of [0, 10, 20, 30, 40]) { // jalan horizontal antar-zona
      const z = sudutBlok(0, bar).z + TRO;
      for (let x = -KOTA_W / 2 + 35; x < KOTA_W / 2; x += 42)
        if (!dalamPusat(x, z)) pohon.push({ x, z, h: hashInt((idx++) * 7 + 3) });
      for (let x = -KOTA_W / 2 + 17; x < KOTA_W / 2; x += 42)
        if (!dalamPusat(x, z)) lampu.push({ x, z, h: hashInt((idx++) * 11 + 5) });
    }
    pohon.sort((a, b) => a.h - b.h); lampu.sort((a, b) => a.h - b.h);
    return { pohon, lampu };
  }
  /* === AKHIR LOGIKA PERAPIAN === */

  /* === AWAL LOGIKA LALU LINTAS (murni — tanpa DOM/THREE, bisa diuji Node) ===
     Lampu lalu lintas + marka di SETIAP persimpangan jalan kota
     (keputusan Fahmi 21 Nov 2026: "setiap persimpangan ada zebra cross
     dan lampu merah"; sebelumnya hanya 20 persimpangan jalan antar-zona).
     Jaringan jalan adalah grid penuh: tekstur tanah menggambar strip
     jalan di tepi kiri+atas SETIAP ubin blok, jadi jalan vertikal ada di
     tepi kiri tiap kolom blok (kol 0..79) dan jalan horizontal di tepi
     atas tiap baris blok (bar 0..49) — persimpangan sah = perpotongan
     keduanya = sudut barat-laut tiap ubin: 80 x 50 = 4.000 titik. Garis
     timur (kol 80) & selatan (bar 50) BUKAN jalan — tekstur tidak
     menggambar strip di sana — jadi tidak ada persimpangan di garis itu.
     Geometri jalan per blok (dari buatKanvasTanah): strip jalan selebar
     JALAN=14 di tepi kiri+atas ubin; trotoar selebar ±2,3 menempel di kedua
     sisi strip itu (di dalam ubin ini pada 14..16,3 dan 81,7..84); rumah
     mulai di 16,7. Sudut persimpangan yang "benar-benar trotoar" karenanya:
     +15,2 dari sudut jalan (strip trotoar dalam) dan -1,15 (strip trotoar
     luar milik blok tetangga). Sudut yang jatuh di luar grid kota (kolom/
     baris 0 sisi barat/utara) tidak punya ubin trotoar -> tiang di sana
     tidak dipasang (persimpangan tepi: 2 tiang, pojok kota: 1 tiang).
     SATU PENGECUALIAN, terbukti dari konstruksi pusatKota(): slab plaza
     208x104 di (0,0) menutup rapat persegi jalan di bawahnya. Persimpangan
     yang persegi jalannya TERTUTUP PENUH oleh tapak plaza bukan lagi
     pertemuan jalan (di atasnya plaza pejalan kaki: bangku, tugu, balai)
     -> dilewati. Dari angka tapak itu, yang tertutup penuh tepat 3 titik:
     (kol 39..41, bar 25). Persimpangan di sekeliling plaza, di tepi blok
     RESERVASI & di tepi lahan pembangunan tetap dilayani — jalan di
     tepinya utuh (tekstur tanah seragam di semua blok). */
  export const PLAZA_TAPAK = { minX: PUSAT_X - PLAZA_W / 2, maxX: PUSAT_X + PLAZA_W / 2, minZ: PUSAT_Z - PLAZA_D / 2, maxZ: PUSAT_Z + PLAZA_D / 2 }; // = tapak plaza pusatKota() (dunia)
  export function persimpanganKota() { // x0,z0 = sudut barat-laut kotak jalan; cx,cz = tengahnya
    const hasil = [];
    for (let kol = 0; kol < BLOK_KOLOM; kol++) for (let bar = 0; bar < BLOK_BARIS; bar++) {
      const x0 = sudutBlok(kol, 0).x, z0 = sudutBlok(0, bar).z;
      if (x0 >= PLAZA_TAPAK.minX && x0 + JALAN <= PLAZA_TAPAK.maxX &&
          z0 >= PLAZA_TAPAK.minZ && z0 + JALAN <= PLAZA_TAPAK.maxZ) continue; // persegi jalannya tertutup plaza
      hasil.push({ kol, bar, x0, z0, cx: x0 + JALAN / 2, cz: z0 + JALAN / 2 });
    }
    return hasil;
  }
  /* LAJUR KIRI (aturan Indonesia — perbaikan 22 Nov 2026; dulu model
     lajur kanan). Arah x = timur, z = selatan; jalan utara-selatan di
     x0..x0+14, jalan barat-timur di z0..z0+14, lajur selebar 7:
       ke selatan (datang dari utara)  -> lajur TIMUR  (x0+7..14)
       ke utara   (datang dari selatan) -> lajur BARAT  (x0..7)
       ke timur   (datang dari barat)   -> lajur UTARA  (z0..7)
       ke barat   (datang dari timur)   -> lajur SELATAN (z0+7..14)
     Lampu dipasang di SISI JAUH persimpangan, di sudut yang segaris dengan
     lajur datang, menghadap pengemudi; lengan menjulur ke atas lajurnya
     (lengan = sumbu +x lokal tiang, lihat kota.js).
     sumbu "us" = utara-selatan, "tb" = timur-barat (kelompok fase). */
  export function tiangLaluLintas(saring) { // saring(p) opsional: false = persimpangan tanpa lampu (jalan desa)
    const DALAM = 15.2, LUAR = 1.15, tiang = [];
    for (const p of persimpanganKota()) {
      if (saring && !saring(p)) continue;
      // dari utara (lajur timur): tiang di sudut tenggara, hadap utara (-z)
      if (p.bar > 0) tiang.push({ x: p.x0 + DALAM, z: p.z0 + DALAM, sumbu: "us", hx: 0, hz: -1 });
      // dari selatan (lajur barat): tiang di sudut barat-laut, hadap selatan (+z)
      if (p.kol > 0 && p.bar > 0) tiang.push({ x: p.x0 - LUAR, z: p.z0 - LUAR, sumbu: "us", hx: 0, hz: 1 });
      // dari barat (lajur utara): tiang di sudut timur-laut, hadap barat (-x)
      if (p.kol > 0 && p.bar > 0) tiang.push({ x: p.x0 + DALAM, z: p.z0 - LUAR, sumbu: "tb", hx: -1, hz: 0 });
      // dari timur (lajur selatan): tiang di sudut barat-daya, hadap timur (+x)
      if (p.kol > 0) tiang.push({ x: p.x0 - LUAR, z: p.z0 + DALAM, sumbu: "tb", hx: 1, hz: 0 });
    }
    return tiang;
  }
  /* Mesin fase (22 detik), seperti lampu sungguhan:
     [0,7) us hijau · [7,10) us kuning · [10,11) SEMUA MERAH ·
     [11,18) tb hijau · [18,21) tb kuning · [21,22) SEMUA MERAH.
     Dua sumbu tidak pernah hijau/kuning bersamaan; jeda semua-merah
     memberi waktu persimpangan kosong sebelum arah lain jalan.
     Lampu penyeberang mengikuti: pejalan yang menyeberangi jalan sumbu X
     hanya "jalan" (hijau) saat arus sumbu itu merah penuh. */
  export const SIKLUS_LL = 22;
  export function faseLaluLintas(t) {
    const s = ((t % SIKLUS_LL) + SIKLUS_LL) % SIKLUS_LL;
    if (s < 7) return { us: "hijau", tb: "merah" };
    if (s < 10) return { us: "kuning", tb: "merah" };
    if (s < 11) return { us: "merah", tb: "merah" };
    if (s < 18) return { us: "merah", tb: "hijau" };
    if (s < 21) return { us: "merah", tb: "kuning" };
    return { us: "merah", tb: "merah" };
  }
  export const WARNA_LAMPU_LL = { // nyala = warna jenuh terang; mati = rona gelap warna sama
    merah: { nyala: 0xff3524, mati: 0x571a10 },
    kuning: { nyala: 0xffb020, mati: 0x57430d },
    hijau: { nyala: 0x2eff6a, mati: 0x0e4d1e },
  };
  /* Marka persimpangan: {x, z, w, d} berpusat di titik tengah persegi.
     zebra = 5 palang per sisi (palang memanjang searah arus jalan yang
     diseberangi, tala 2,75); henti = garis tipis selebar lajur arah datang
     (lalu lintas KIRI: lajur datang selalu separuh kiri dari arah
     pandang pengemudi), sebelum zebra; tutup = persegi sewarna aspal
     (#b39d72) menutup garis tengah putus-putus di kawasan persimpangan
     (garis tengah berhenti di tepi persimpangan). Sisi yang jalan
     pendekatannya di luar grid kota (barat untuk kolom 0, utara untuk
     baris 0) tidak diberi zebra/henti — jalannya memang tidak ada. */
  export function markaPersimpangan(saring) {
    const zebra = [], henti = [], tutup = [];
    for (const p of persimpanganKota()) {
      if (saring && !saring(p)) continue;
      const { x0, z0, cx, cz } = p;
      for (let i = 0; i < 5; i++) {
        const gx = x0 + 1.5 + i * 2.75, gz = z0 + 1.5 + i * 2.75;
        if (p.bar > 0) zebra.push({ x: gx, z: z0 - 2.5, w: 1.4, d: 3.6 }); // utara: menyeberangi jalan us
        zebra.push({ x: gx, z: z0 + JALAN + 2.5, w: 1.4, d: 3.6 }); // selatan
        if (p.kol > 0) zebra.push({ x: x0 - 2.5, z: gz, w: 3.6, d: 1.4 }); // barat: menyeberangi jalan tb
        zebra.push({ x: x0 + JALAN + 2.5, z: gz, w: 3.6, d: 1.4 }); // timur
      }
      // lajur kiri: garis henti di lajur DATANG (lihat tiangLaluLintas)
      if (p.bar > 0) henti.push({ x: x0 + JALAN - 3.65, z: z0 - 5.25, w: 6.1, d: 0.7 }); // datang dari utara (lajur timur)
      henti.push({ x: x0 + 3.65, z: z0 + JALAN + 5.25, w: 6.1, d: 0.7 }); // datang dari selatan (lajur barat)
      if (p.kol > 0) henti.push({ x: x0 - 5.25, z: z0 + 3.65, w: 0.7, d: 6.1 }); // datang dari barat (lajur utara)
      henti.push({ x: x0 + JALAN + 5.25, z: z0 + JALAN - 3.65, w: 0.7, d: 6.1 }); // datang dari timur (lajur selatan)
      const zA = p.bar > 0 ? z0 - 5.8 : z0, zB = z0 + JALAN + 5.8; // tutup garis tengah jalan us
      tutup.push({ x: cx, z: (zA + zB) / 2, w: 3.4, d: zB - zA });
      const xA = p.kol > 0 ? x0 - 5.8 : x0; // tutup garis tengah jalan tb (dua ruas, menghindari tumpang tindih dengan tutup us)
      tutup.push({ x: (xA + cx - 1.7) / 2, z: cz, w: (cx - 1.7) - xA, d: 3.4 });
      tutup.push({ x: (cx + 1.7 + x0 + JALAN + 5.8) / 2, z: cz, w: (x0 + JALAN + 5.8) - (cx + 1.7), d: 3.4 });
    }
    return { zebra, henti, tutup };
  }
  /* === AKHIR LOGIKA LALU LINTAS === */

  /* === AWAL LOGIKA KUALITAS (murni — tanpa DOM/THREE, bisa diuji Node) ===
     Tangga kualitas diskret. Pilihan user: "otomatis" (mulai dari langkah
     teratas, naik/turun sendiri mengikuti FPS), "rendah" (langkah 0),
     "tinggi" (langkah teratas). */
  export const LANGKAH_KUALITAS = [
    { nama: "Rendah", batasPR: 1, bayangan: false, petaBayangan: 0, kepadatan: 0.25, skalaTekstur: 0.5 },
    { nama: "Sedang", batasPR: 1.25, bayangan: false, petaBayangan: 0, kepadatan: 0.5, skalaTekstur: 0.75 },
    { nama: "Tinggi", batasPR: 1.5, bayangan: true, petaBayangan: 1024, kepadatan: 0.75, skalaTekstur: 1 },
    { nama: "Maksimal", batasPR: 2, bayangan: true, petaBayangan: 2048, kepadatan: 1, skalaTekstur: 1 },
  ];
  export function parameterKualitas(indeks, dpr) {
    const i = Math.max(0, Math.min(LANGKAH_KUALITAS.length - 1, indeks | 0));
    const L = LANGKAH_KUALITAS[i];
    return {
      indeks: i, nama: L.nama,
      pixelRatio: Math.min(Math.max(dpr || 1, 1), L.batasPR),
      bayangan: L.bayangan, petaBayangan: L.petaBayangan,
      kepadatan: L.kepadatan, skalaTekstur: L.skalaTekstur,
    };
  }
  export function indeksUntukPilihan(pilihan) { return pilihan === "rendah" ? 0 : LANGKAH_KUALITAS.length - 1; }
  /* Mesin keadaan otomatis: st = {langkah, diAtasSejak, jedaSampai} (dijutasi).
     fps < 30 -> turun 1 langkah (dijeda 8 dtk antar perubahan).
     fps > 55 berkelanjutan 30 dtk -> naik 1 langkah (maks langkah teratas).
     Mengembalikan "turun" | "naik" | null. */
  export function evaluasiOtomatis(st, fps, kini) {
    if (fps < 30) {
      st.diAtasSejak = 0;
      if (st.langkah > 0 && kini >= (st.jedaSampai || 0)) {
        st.langkah--; st.jedaSampai = kini + 8000; return "turun";
      }
      return null;
    }
    if (fps > 55) {
      if (!st.diAtasSejak) { st.diAtasSejak = kini; return null; }
      if (kini - st.diAtasSejak >= 30000 && st.langkah < LANGKAH_KUALITAS.length - 1 && kini >= (st.jedaSampai || 0)) {
        st.langkah++; st.diAtasSejak = 0; st.jedaSampai = kini + 8000; return "naik";
      }
      return null;
    }
    st.diAtasSejak = 0;
    return null;
  }
  /* === AKHIR LOGIKA KUALITAS === */

  /* === AWAL LOGIKA WAKTU (murni — tanpa DOM/THREE, bisa diuji Node) ===
     Fase cahaya desa: Siang / Senja / Malam + Siklus (berputar lambat).
     Senja = golden hour yang selama ini tampil (nilai persis ?v=14) dan
     tetap jadi bawaan. Tiap preset adalah parameter polos (hex + angka);
     pencampuran antar fase dihitung di sini, penerapan ke objek THREE
     dilakukan terapkanWaktu() — transisi halus ±2 detik, bukan potong.
     kepalaLampu = intensitas emissive kepala lampu jalan instanced;
     bintang = opasitas lapisan bintang; jendela = emissive jendela balai. */
  export const PRESET_WAKTU = {
    siang: {
      matahari: 0xfff0d6, intMatahari: 1.7, langitHemi: 0xcfe6ff, tanahHemi: 0x5f7f45, intHemi: 0.5,
      kubahAtas: 0x3f8fd2, kubahTengah: 0x9fd0f5, kubahBawah: 0xe9f4e2, kabut: 0xdcefe8, latar: 0x9fd0f5,
      paparan: 1.0, kepalaLampu: 0.05, bintang: 0, awan: 0xfff8ec, intAwan: 0.1, jendela: 0.06,
    },
    senja: {
      matahari: 0xffc890, intMatahari: 1.6, langitHemi: 0xd9e4f2, tanahHemi: 0x6a7f48, intHemi: 0.46,
      kubahAtas: 0x5fa8dd, kubahTengah: 0xaad9f2, kubahBawah: 0xffe3ae, kabut: 0xf6d9a8, latar: 0xaad9f2,
      paparan: 1.0, kepalaLampu: 0.85, bintang: 0, awan: 0xfff8ec, intAwan: 0.22, jendela: 0.25,
    },
    malam: {
      matahari: 0x8fb4e8, intMatahari: 0.38, langitHemi: 0x35497a, tanahHemi: 0x1d2a22, intHemi: 0.42,
      kubahAtas: 0x081a33, kubahTengah: 0x1d3a5f, kubahBawah: 0x33506b, kabut: 0x22364e, latar: 0x1d3a5f,
      paparan: 1.0, kepalaLampu: 2.6, bintang: 0.95, awan: 0x93a7c4, intAwan: 0.03, jendela: 2.2,
    },
  };
  export const KUNCI_HEX_WAKTU = ["matahari", "langitHemi", "tanahHemi", "kubahAtas", "kubahTengah", "kubahBawah", "kabut", "latar", "awan"];
  export const KUNCI_ANGKA_WAKTU = ["intMatahari", "intHemi", "paparan", "kepalaLampu", "bintang", "intAwan", "jendela"];
  export function campurHexWaktu(x, y, t) {
    const r = Math.round(((x >> 16) & 255) + (((y >> 16) & 255) - ((x >> 16) & 255)) * t);
    const g = Math.round(((x >> 8) & 255) + (((y >> 8) & 255) - ((x >> 8) & 255)) * t);
    const b = Math.round((x & 255) + ((y & 255) - (x & 255)) * t);
    return (r << 16) | (g << 8) | b;
  }
  export function campurPresetWaktu(a, b, t) {
    const hasil = {};
    for (const k of KUNCI_HEX_WAKTU) hasil[k] = campurHexWaktu(a[k], b[k], t);
    for (const k of KUNCI_ANGKA_WAKTU) hasil[k] = a[k] + (b[k] - a[k]) * t;
    return hasil;
  }
  /* Siklus: 240 detik per putaran — Siang -> Senja -> Malam -> Senja ->
     Siang, tiap segmen 60 detik dicampur smoothstep supaya tidak ada
     lompatan di perbatasan segmen. */
  export const URUTAN_SIKLUS = ["siang", "senja", "malam", "senja"];
  export const DURASI_SIKLUS = 240;
  export function parameterWaktu(pilihan, tSiklus) {
    if (pilihan === "siang" || pilihan === "senja" || pilihan === "malam") return PRESET_WAKTU[pilihan];
    const seg = DURASI_SIKLUS / URUTAN_SIKLUS.length;
    const pos = ((tSiklus % DURASI_SIKLUS) + DURASI_SIKLUS) % DURASI_SIKLUS;
    const i = Math.floor(pos / seg), f = (pos - i * seg) / seg;
    const s = f * f * (3 - 2 * f);
    return campurPresetWaktu(PRESET_WAKTU[URUTAN_SIKLUS[i]], PRESET_WAKTU[URUTAN_SIKLUS[(i + 1) % URUTAN_SIKLUS.length]], s);
  }
  /* === AKHIR LOGIKA WAKTU === */

  /* === AWAL LOGIKA AKTIVITAS NPC (murni — tanpa DOM/THREE, bisa diuji Node) ===
     NPC Distrik Pusat tidak lagi semuanya berjalan mengelilingi plaza:
     urutan warga terbaru diberi peran prosedural — 2 pembawa barang
     (berjalan membawa karung/kardus), 2 pasang mengobrol berhadapan,
     4 duduk di bangku plaza, sisanya pejalan seperti sebelumnya.
     Bangku plaza = posisi bangkuTaman yang dipasang pusatKota() (?v=9):
     (±24, 28) menghadap balai & (±24, 2) menghadap jalur. */
  export const BANGKU_PLAZA = [
    { x: 24, z: 28, rot: Math.PI }, { x: -24, z: 28, rot: Math.PI },
    { x: 24, z: 2, rot: 0 }, { x: -24, z: 2, rot: 0 },
  ];
  export const PASANGAN_NGOBROL = [
    [{ x: -10, z: 18 }, { x: -8.4, z: 18 }],
    [{ x: 12, z: 10 }, { x: 13.6, z: 10 }], // dulu (12,-14): kini di dalam pelataran istana
  ];
  export function aktivitasUntukNpc(i) {
    if (i < 2) return { jenis: "pembawa", alat: i === 0 ? "karung" : "kardus" };
    if (i < 6) {
      const p = PASANGAN_NGOBROL[(i - 2) >> 1], sisi = (i - 2) % 2;
      return { jenis: "ngobrol", x: p[sisi].x + PUSAT_X, z: p[sisi].z + PUSAT_Z, hadap: Math.atan2(p[1 - sisi].x - p[sisi].x, p[1 - sisi].z - p[sisi].z) };
    }
    if (i < 10) { const b = BANGKU_PLAZA[i - 6]; return { jenis: "duduk", x: b.x + PUSAT_X, z: b.z + PUSAT_Z, rot: b.rot }; }
    return { jenis: "jalan" };
  }
  /* === AKHIR LOGIKA AKTIVITAS NPC === */

