/* Negara Merdu — klien v2. Kota grid persegi skala 100.000 kavling.
   Rumah HANYA milik warga terdaftar (keputusan Fahmi 21 Nov 2026): kavling
   kosong = lahan kosong berpola (tanpa bangunan), rumah massal instanced
   hanya dibangun untuk kavling terisi dan muncul saat ada yang daftar.
   Rumah detail (mesh unik, bisa diklik) milik <=30 warga terbaru berdiri
   di kavling ASLI pemiliknya, menggantikan instans massalnya di petak
   yang sama (?v=18). Distrik pusat: istana negara, papan + NPC. */
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  /* Ikon SVG gambar sendiri (emoji dilarang di UI — keputusan Fahmi). */
  const IK = {
    rumah: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    pintu: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M2.5 22h19"/><circle cx="13.2" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg>',
    ktp: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.4 17c.6-1.6 1.4-2.4 2.6-2.4s2 .8 2.6 2.4"/><path d="M14 9.5h5M14 13h5"/></svg>',
    keluarga: '<svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5v-2A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5v2"/><circle cx="17.5" cy="9.5" r="2.6"/><path d="M16 14.4a4.5 4.5 0 0 1 5.5 4.4v1.7"/></svg>'
  };

  /* ================= KONSTANTA KOTA (samakan dengan server) ================= */
  const BLOK_KOLOM = 80, BLOK_BARIS = 50, PER_BLOK = 25, SISI = 5;
  const PITCH = 84, JALAN = 14, KAV_PITCH = 14;
  const KAPASITAS = 100000;
  const KOTA_W = BLOK_KOLOM * PITCH, KOTA_D = BLOK_BARIS * PITCH;
  const RESERVASI = new Set(); // blok pusat: plaza + balai + distrik detail
  for (let k = 38; k <= 41; k++) for (let b = 24; b <= 25; b++) RESERVASI.add(k + "," + b);
  const TAMAN = new Set(); // blok taman berkala — kini LAHAN PEMBANGUNAN (lihat bangunLahanPembangunan)
  for (let k = 4; k < BLOK_KOLOM; k += 8) for (let b = 4; b < BLOK_BARIS; b += 8) TAMAN.add(k + "," + b);
  // 2 blok fasilitas tepi cluster warga (perintah Fahmi 2026-11-22:
  // fasilitas dipindah dekat keramaian) — di luar pola berkala, wajib
  // sama dengan pengecualian BlokTerlarang di server: (38,23) Taman di
  // barat Blok 1880 & (41,23) Toko Pancing di timur Blok 1881.
  TAMAN.add("38,23"); TAMAN.add("41,23");
  /* Fasilitas desa (pembangunan bertahap): 8 dari 60 blok lahan dicadangkan
     untuk fasilitas bernama. Nama/biaya/status datang dari server
     (GET /api/pembangunan); peta blok ini harus sama dengan FASILITAS di
     server.py. Blok taman sisanya lahan kosong generik. */
  const FASILITAS_BLOK = {
    taman: { kol: 38, bar: 23 }, lapangan: { kol: 20, bar: 36 },
    perpustakaan: { kol: 12, bar: 12 }, balai_warga: { kol: 68, bar: 12 },
    sekolah: { kol: 52, bar: 20 }, puskesmas: { kol: 60, bar: 36 },
    pasar: { kol: 28, bar: 28 }, masjid: { kol: 44, bar: 28 },
    // Bangunan voting warga (?v=34; dipindah ?v=35): Blok 1882 tepat di
    // timur Blok 1881 (cluster warga) — sebelumnya di selatan blok danau,
    // dinilai Fahmi terlalu jauh dari keramaian. Taman juga dipindah
    // (?v=35) ke Blok 1879 tepat di barat Blok 1880.
    toko_pancing: { kol: 41, bar: 23 },
  };

  function sudutBlok(kol, bar) { return { x: (kol - BLOK_KOLOM / 2) * PITCH, z: (bar - BLOK_BARIS / 2) * PITCH }; }
  function posisiKavling(blokNomor, kavlingNomor) {
    const bi = blokNomor - 1, bar = Math.floor(bi / BLOK_KOLOM), kol = bi % BLOK_KOLOM;
    const ki = kavlingNomor - 1, kx = ki % SISI, kz = Math.floor(ki / SISI);
    const s = sudutBlok(kol, bar);
    return { x: s.x + JALAN + KAV_PITCH / 2 + kx * KAV_PITCH, z: s.z + JALAN + KAV_PITCH / 2 + kz * KAV_PITCH };
  }
  function hashInt(n) { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = (x * 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; }

  /* === AWAL LOGIKA PERAPIAN (murni — tanpa DOM/THREE, bisa diuji Node) ===
     Perapian 3D: kota dibagi 20 zona RW (sama dengan WilayahDariBlok di
     server Go: RW = kelompok 20 kolom-blok x 10 baris-blok). Tiap zona satu
     keluarga warna; dekorasi kavling & elemen jalan berpola deterministik
     dari indeks grid — tidak ada Math.random, tampilan sama di semua klien. */
  function zonaDariKolBar(kol, bar) { // 0..19, indeksnya = nomor RW - 1
    return Math.floor(bar / 10) * 4 + Math.floor(kol / 20);
  }
  /* Hue basis per zona: menyapu spektrum perlahan (langkah 16,2°) supaya
     zona bertetangga bergeser halus dan zona berjauhan kontras jelas. */
  const HUE_ZONA = [];
  for (let i = 0; i < 20; i++) HUE_ZONA.push((i * 0.045) % 1);
  /* Warna atap/dinding satu rumah dalam keluarga zonanya: hue tetap,
     jitter kecil dari dua nilai hash (a, b dalam 0..1) supaya tetap hidup. */
  function warnaAtapZonaHSL(zona, a, b) {
    return [(HUE_ZONA[zona] + (a - 0.5) * 0.03 + 1) % 1, 0.58, 0.46 + (b - 0.5) * 0.07];
  }
  function warnaDindingZonaHSL(zona, a, b) { // pastel sekeluarga dengan atapnya
    return [(HUE_ZONA[zona] + (a - 0.5) * 0.03 + 1) % 1, 0.42, 0.80 + (b - 0.5) * 0.05];
  }
  function warnaZonaPeta(zona, terang) { // warna keluarga zona (dulu warna blok di peta; blok peta kini petak lahan — lihat WARNA_PETA.petak)
    return "hsl(" + Math.round(HUE_ZONA[zona] * 360) + ", 45%, " + (terang ? 60 : 53) + "%)";
  }
  /* Pola dekorasi per kavling: modular terhadap posisi kavling di blok +
     geser per nomor blok — dari atas terbaca sebagai pola teratur, bukan
     sebaran acak. Kepadatan meniru pola lama (pagar ±25%, semak ±33%,
     pohon ±14%). */
  function polaKavling(kx, kz, blokNomor) {
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
  function elemenJalan() {
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
  const PLAZA_TAPAK = { minX: -104, maxX: 104, minZ: -52, maxZ: 52 }; // = kotak(208, ., 104) di (0,0) pada pusatKota()
  function persimpanganKota() { // x0,z0 = sudut barat-laut kotak jalan; cx,cz = tengahnya
    const hasil = [];
    for (let kol = 0; kol < BLOK_KOLOM; kol++) for (let bar = 0; bar < BLOK_BARIS; bar++) {
      const x0 = sudutBlok(kol, 0).x, z0 = sudutBlok(0, bar).z;
      if (x0 >= PLAZA_TAPAK.minX && x0 + JALAN <= PLAZA_TAPAK.maxX &&
          z0 >= PLAZA_TAPAK.minZ && z0 + JALAN <= PLAZA_TAPAK.maxZ) continue; // persegi jalannya tertutup plaza
      hasil.push({ kol, bar, x0, z0, cx: x0 + JALAN / 2, cz: z0 + JALAN / 2 });
    }
    return hasil;
  }
  /* Satu tiang per sudut trotoar, menghadap arah datangnya kendaraan yang
     diatur (penempatan sisi jauh-kanan dari arah pandang pengemudi):
     sudut tenggara -> arus timur-barat datang dari barat (hadap -x);
     sudut barat-laut -> arus timur-barat datang dari timur (hadap +x);
     sudut timur-laut -> arus utara-selatan datang dari selatan (hadap +z);
     sudut barat-daya -> arus utara-selatan datang dari utara (hadap -z).
     sumbu "us" = utara-selatan, "tb" = timur-barat (kelompok fase). */
  function tiangLaluLintas() {
    const DALAM = 15.2, LUAR = 1.15, tiang = [];
    for (const p of persimpanganKota()) {
      tiang.push({ x: p.x0 + DALAM, z: p.z0 + DALAM, sumbu: "tb", hx: -1, hz: 0 }); // tenggara: selalu di dalam grid
      if (p.bar > 0) tiang.push({ x: p.x0 + DALAM, z: p.z0 - LUAR, sumbu: "us", hx: 0, hz: 1 }); // timur-laut
      if (p.kol > 0) tiang.push({ x: p.x0 - LUAR, z: p.z0 + DALAM, sumbu: "us", hx: 0, hz: -1 }); // barat-daya
      if (p.kol > 0 && p.bar > 0) tiang.push({ x: p.x0 - LUAR, z: p.z0 - LUAR, sumbu: "tb", hx: 1, hz: 0 }); // barat-laut
    }
    return tiang;
  }
  /* Mesin fase: siklus 16 detik, dua sumbu berlawanan diselingi kuning.
     [0,7) us hijau · [7,8) us kuning · [8,15) tb hijau · [15,16) tb kuning.
     Sumbu yang tidak jalan selalu merah — dua sumbu hijau bersamaan
     tidak mungkin terjadi menurut konstruksi ini. */
  const SIKLUS_LL = 16;
  function faseLaluLintas(t) {
    const s = ((t % SIKLUS_LL) + SIKLUS_LL) % SIKLUS_LL;
    if (s < 7) return { us: "hijau", tb: "merah" };
    if (s < 8) return { us: "kuning", tb: "merah" };
    if (s < 15) return { us: "merah", tb: "hijau" };
    return { us: "merah", tb: "kuning" };
  }
  const WARNA_LAMPU_LL = { // nyala = warna jenuh terang; mati = rona gelap warna sama
    merah: { nyala: 0xff3524, mati: 0x571a10 },
    kuning: { nyala: 0xffb020, mati: 0x57430d },
    hijau: { nyala: 0x2eff6a, mati: 0x0e4d1e },
  };
  /* Marka persimpangan: {x, z, w, d} berpusat di titik tengah persegi.
     zebra = 5 palang per sisi (palang memanjang searah arus jalan yang
     diseberangi, tala 2,75); henti = garis tipis selebar lajur arah datang
     (lalu lintas kanan: lajur datang selalu separuh kanan dari arah
     pandang pengemudi), sebelum zebra; tutup = persegi sewarna aspal
     (#b39d72) menutup garis tengah putus-putus di kawasan persimpangan
     (garis tengah berhenti di tepi persimpangan). Sisi yang jalan
     pendekatannya di luar grid kota (barat untuk kolom 0, utara untuk
     baris 0) tidak diberi zebra/henti — jalannya memang tidak ada. */
  function markaPersimpangan() {
    const zebra = [], henti = [], tutup = [];
    for (const p of persimpanganKota()) {
      const { x0, z0, cx, cz } = p;
      for (let i = 0; i < 5; i++) {
        const gx = x0 + 1.5 + i * 2.75, gz = z0 + 1.5 + i * 2.75;
        if (p.bar > 0) zebra.push({ x: gx, z: z0 - 2.5, w: 1.4, d: 3.6 }); // utara: menyeberangi jalan us
        zebra.push({ x: gx, z: z0 + JALAN + 2.5, w: 1.4, d: 3.6 }); // selatan
        if (p.kol > 0) zebra.push({ x: x0 - 2.5, z: gz, w: 3.6, d: 1.4 }); // barat: menyeberangi jalan tb
        zebra.push({ x: x0 + JALAN + 2.5, z: gz, w: 3.6, d: 1.4 }); // timur
      }
      if (p.bar > 0) henti.push({ x: x0 + 3.65, z: z0 - 5.25, w: 6.1, d: 0.7 }); // datang dari utara (lajur barat)
      henti.push({ x: x0 + JALAN - 3.65, z: z0 + JALAN + 5.25, w: 6.1, d: 0.7 }); // datang dari selatan (lajur timur)
      if (p.kol > 0) henti.push({ x: x0 - 5.25, z: z0 + JALAN - 3.65, w: 0.7, d: 6.1 }); // datang dari barat (lajur selatan)
      henti.push({ x: x0 + JALAN + 5.25, z: z0 + 3.65, w: 0.7, d: 6.1 }); // datang dari timur (lajur utara)
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
  const LANGKAH_KUALITAS = [
    { nama: "Rendah", batasPR: 1, bayangan: false, petaBayangan: 0, kepadatan: 0.25, skalaTekstur: 0.5 },
    { nama: "Sedang", batasPR: 1.25, bayangan: false, petaBayangan: 0, kepadatan: 0.5, skalaTekstur: 0.75 },
    { nama: "Tinggi", batasPR: 1.5, bayangan: true, petaBayangan: 1024, kepadatan: 0.75, skalaTekstur: 1 },
    { nama: "Maksimal", batasPR: 2, bayangan: true, petaBayangan: 2048, kepadatan: 1, skalaTekstur: 1 },
  ];
  function parameterKualitas(indeks, dpr) {
    const i = Math.max(0, Math.min(LANGKAH_KUALITAS.length - 1, indeks | 0));
    const L = LANGKAH_KUALITAS[i];
    return {
      indeks: i, nama: L.nama,
      pixelRatio: Math.min(Math.max(dpr || 1, 1), L.batasPR),
      bayangan: L.bayangan, petaBayangan: L.petaBayangan,
      kepadatan: L.kepadatan, skalaTekstur: L.skalaTekstur,
    };
  }
  function indeksUntukPilihan(pilihan) { return pilihan === "rendah" ? 0 : LANGKAH_KUALITAS.length - 1; }
  /* Mesin keadaan otomatis: st = {langkah, diAtasSejak, jedaSampai} (dijutasi).
     fps < 30 -> turun 1 langkah (dijeda 8 dtk antar perubahan).
     fps > 55 berkelanjutan 30 dtk -> naik 1 langkah (maks langkah teratas).
     Mengembalikan "turun" | "naik" | null. */
  function evaluasiOtomatis(st, fps, kini) {
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
  const PRESET_WAKTU = {
    siang: {
      matahari: 0xfff2d8, intMatahari: 1.25, langitHemi: 0xd8ecff, tanahHemi: 0x8fae6a, intHemi: 0.75,
      kubahAtas: 0x3f8fd2, kubahTengah: 0x9fd0f5, kubahBawah: 0xe9f4e2, kabut: 0xdcefe8, latar: 0x9fd0f5,
      paparan: 1.0, kepalaLampu: 0.05, bintang: 0, awan: 0xfff8ec, intAwan: 0.1, jendela: 0.06,
    },
    senja: {
      matahari: 0xffc384, intMatahari: 1.15, langitHemi: 0xffe7c4, tanahHemi: 0x86a860, intHemi: 0.62,
      kubahAtas: 0x5fa8dd, kubahTengah: 0xaad9f2, kubahBawah: 0xffe3ae, kabut: 0xf6d9a8, latar: 0xaad9f2,
      paparan: 1.05, kepalaLampu: 0.85, bintang: 0, awan: 0xfff8ec, intAwan: 0.22, jendela: 0.25,
    },
    malam: {
      matahari: 0x8fb4e8, intMatahari: 0.38, langitHemi: 0x35497a, tanahHemi: 0x1d2a22, intHemi: 0.42,
      kubahAtas: 0x081a33, kubahTengah: 0x1d3a5f, kubahBawah: 0x33506b, kabut: 0x22364e, latar: 0x1d3a5f,
      paparan: 1.0, kepalaLampu: 2.6, bintang: 0.95, awan: 0x93a7c4, intAwan: 0.03, jendela: 2.2,
    },
  };
  const KUNCI_HEX_WAKTU = ["matahari", "langitHemi", "tanahHemi", "kubahAtas", "kubahTengah", "kubahBawah", "kabut", "latar", "awan"];
  const KUNCI_ANGKA_WAKTU = ["intMatahari", "intHemi", "paparan", "kepalaLampu", "bintang", "intAwan", "jendela"];
  function campurHexWaktu(x, y, t) {
    const r = Math.round(((x >> 16) & 255) + (((y >> 16) & 255) - ((x >> 16) & 255)) * t);
    const g = Math.round(((x >> 8) & 255) + (((y >> 8) & 255) - ((x >> 8) & 255)) * t);
    const b = Math.round((x & 255) + ((y & 255) - (x & 255)) * t);
    return (r << 16) | (g << 8) | b;
  }
  function campurPresetWaktu(a, b, t) {
    const hasil = {};
    for (const k of KUNCI_HEX_WAKTU) hasil[k] = campurHexWaktu(a[k], b[k], t);
    for (const k of KUNCI_ANGKA_WAKTU) hasil[k] = a[k] + (b[k] - a[k]) * t;
    return hasil;
  }
  /* Siklus: 240 detik per putaran — Siang -> Senja -> Malam -> Senja ->
     Siang, tiap segmen 60 detik dicampur smoothstep supaya tidak ada
     lompatan di perbatasan segmen. */
  const URUTAN_SIKLUS = ["siang", "senja", "malam", "senja"];
  const DURASI_SIKLUS = 240;
  function parameterWaktu(pilihan, tSiklus) {
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
  const BANGKU_PLAZA = [
    { x: 24, z: 28, rot: Math.PI }, { x: -24, z: 28, rot: Math.PI },
    { x: 24, z: 2, rot: 0 }, { x: -24, z: 2, rot: 0 },
  ];
  const PASANGAN_NGOBROL = [
    [{ x: -10, z: 18 }, { x: -8.4, z: 18 }],
    [{ x: 12, z: -14 }, { x: 13.6, z: -14 }],
  ];
  function aktivitasUntukNpc(i) {
    if (i < 2) return { jenis: "pembawa", alat: i === 0 ? "karung" : "kardus" };
    if (i < 6) {
      const p = PASANGAN_NGOBROL[(i - 2) >> 1], sisi = (i - 2) % 2;
      return { jenis: "ngobrol", x: p[sisi].x, z: p[sisi].z, hadap: Math.atan2(p[1 - sisi].x - p[sisi].x, p[1 - sisi].z - p[sisi].z) };
    }
    if (i < 10) { const b = BANGKU_PLAZA[i - 6]; return { jenis: "duduk", x: b.x, z: b.z, rot: b.rot }; }
    return { jenis: "jalan" };
  }
  /* === AKHIR LOGIKA AKTIVITAS NPC === */

  /* ================= KUALITAS GRAFIK (keadaan aktif) ================= */
  let pilihanKualitas = "otomatis";
  try {
    const s = localStorage.getItem("pinarak_kualitas");
    if (s === "rendah" || s === "tinggi" || s === "otomatis") pilihanKualitas = s;
  } catch (e) {}
  let langkahKualitas = indeksUntukPilihan(pilihanKualitas);
  let PARAM = parameterKualitas(langkahKualitas, window.devicePixelRatio || 1);
  const REG_TEX = [];       // {tex, buat} tekstur prosedural — digambar ulang saat skalaTekstur berubah
  const IM_LINGKUNGAN = []; // {mesh, penuh} InstancedMesh dekorasi kavling — count diatur kepadatan
  const LL_AKTIF = { mat: null, kunci: "" }; // material cakram lampu lalu lintas milik grup kota yang sedang tampil + fase terakhir yang diterapkan (diisi bangunKotaMassal)
  /* Waktu negara (Paket 3 ?v=15): pilihan user tersimpan seperti kualitas;
     bawaan "senja" = golden hour ?v=14 persis. */
  let pilihanWaktu = "senja";
  try {
    const s = localStorage.getItem("pinarak_waktu");
    if (s === "siang" || s === "senja" || s === "malam" || s === "siklus") pilihanWaktu = s;
  } catch (e) {}
  const LAMPU_JALAN = { matKepala: null }; // material kepala lampu jalan instanced (diisi bangunKotaMassal) — emissive-nya digerakkan fase waktu
  const MAT_JENDELA = { mat: null };       // material jendela istana negara (diisi pusatKota) — menyala hangat di malam hari
  const LAMPU_TAMAN = { mat: null };       // material kepala lampu taman istana (diisi pusatKota) — emissive-nya digerakkan fase waktu (kepalaLampu)

  /* ================= TEKSTUR PROSEDURAL (canvas, dibuat sekali) =================
     Semua tekstur dekoratif digambar dari fungsi buat(skala) supaya opsi
     kualitas bisa menggambar ulangnya di resolusi lain tanpa reload.
     Palet mengikuti poster: plesteran krem terang, genteng terang (diwarnai
     per instans lewat instanceColor), jalan pasir + trotoar, sawah berpetak. */
  function buatKanvasDinding(skala) {
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
  function buatKanvasAtap(skala) {
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
        c.strokeStyle = "rgba(96,52,26,0.40)"; c.lineWidth = 2.4 * u;
        c.beginPath(); c.arc(x + lebar / 2, y + hBaris, lebar / 2 - 1.5 * u, Math.PI, 0); c.stroke();
      }
      c.fillStyle = "rgba(70,38,18,0.20)"; c.fillRect(0, y + hBaris - 2.4 * u, S, 2.4 * u);
    }
    return cv;
  }
  function buatKanvasTanah(skala) { // ubin 1 blok: jalan di tepi kiri+atas, sisanya kavling rumput
    const S = Math.max(64, Math.round(256 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 256;
    c.fillStyle = "#63ac4e"; c.fillRect(0, 0, S, S); // rumput #7fbd68 -> #63ac4e: hijau lebih dalam (perbaikan warna)
    c.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 40; i++) c.fillRect((i * 67) % S, (i * 97) % S, 22 * u, 14 * u);
    const j = Math.round(S * JALAN / PITCH); // lebar jalan di ubin (~43px @256)
    const tro = Math.max(2, Math.round(7 * u)); // lebar trotoar
    c.fillStyle = "#d9c9a3"; // trotoar (diperdalam dari #e6dcc2): sisi kavling ubin ini + sisi kavling ubin tetangga
    c.fillRect(j, 0, tro, S); c.fillRect(0, j, S, tro);
    c.fillRect(S - tro, 0, tro, S); c.fillRect(0, S - tro, S, tro);
    c.fillStyle = "#b39d72"; c.fillRect(0, 0, j, S); c.fillRect(0, 0, S, j); // badan jalan (diperdalam dari #c8b992 supaya kontras vs rumput)
    c.fillStyle = "rgba(90,70,40,0.25)";
    c.fillRect(j - 2 * u, 0, 2 * u, S); c.fillRect(0, j - 2 * u, S, 2 * u);
    c.fillRect(0, 0, 2 * u, S); c.fillRect(0, 0, S, 2 * u);
    c.fillStyle = "#fff8dc"; // garis tengah putus-putus — kala 32u membagi habis sisi ubin
    // di semua skala (256/192/128/64), jadi pola menyambung mulus antar ubin:
    // tidak ada garis dobel/patah di sambungan blok seperti pola lama (kala 30).
    const tgh = Math.round(j / 2 - 1.5 * u);
    const kalaGaris = 32 * u, pjgGaris = Math.round(18 * u),
      awalGaris = Math.round(7 * u), lebarGaris = Math.max(2, Math.round(3 * u));
    for (let y = awalGaris; y + pjgGaris <= S; y += kalaGaris) {
      c.fillRect(tgh, y, lebarGaris, pjgGaris);
      c.fillRect(y, tgh, pjgGaris, lebarGaris);
    }
    c.strokeStyle = "rgba(60,80,50,0.20)"; c.lineWidth = Math.max(1, u);
    const langkah = (S - j - tro) / SISI, awal = j + tro;
    for (let i = 1; i < SISI; i++) {
      c.beginPath(); c.moveTo(awal + i * langkah, awal); c.lineTo(awal + i * langkah, S); c.stroke();
      c.beginPath(); c.moveTo(awal, awal + i * langkah); c.lineTo(S, awal + i * langkah); c.stroke();
    }
    return cv;
  }
  function buatKanvasSawah(skala) { // petak 8x8: variasi hijau, sebagian berair, galengan cokelat
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
  function buatTeksturProsedural(buat) {
    const tex = new THREE.CanvasTexture(buat(PARAM.skalaTekstur));
    REG_TEX.push({ tex, buat });
    return tex;
  }
  function segarkanTekstur() { // gambar ulang semua tekstur prosedural di skala aktif
    const perBuat = new Map();
    for (const r of REG_TEX) {
      if (!perBuat.has(r.buat)) perBuat.set(r.buat, r.buat(PARAM.skalaTekstur));
      r.tex.image = perBuat.get(r.buat);
      r.tex.needsUpdate = true;
    }
  }
  const TEX_DINDING = buatTeksturProsedural(buatKanvasDinding);
  const TEX_ATAP = buatTeksturProsedural(buatKanvasAtap);
  TEX_DINDING.anisotropy = 4; TEX_ATAP.anisotropy = 4;

  /* ================= DATA ================= */
  let statistik = { warga: 0, terisi: 0, kapasitas: KAPASITAS };
  let wargaTerbaru = [];           // untuk distrik detail + NPC
  const warnaPemilik = new Map();  // "blok,kavling" -> warna baju (<= 2000 warga pertama)
  const rumahTerisi = new Set();   // "blok,kavling" yang ADA warganya — satu-satunya dasar rumah massal & tabrakannya
  const rumahDetailSet = new Set(); // "blok,kavling" milik <=30 warga terbaru yang punya rumah DETAIL di kavling aslinya — instans massalnya dilewati, tabrakannya via rintanganDetail
  const daftarRumah = [];          // {nomor, blok, kavling, warna} warga termuat — untuk titik rumah di peta
  let dataPembangunan = [];        // status fasilitas dari /api/pembangunan (dibaca sekali saat muat)

  async function ambilData() {
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
      wargaTerbaru.slice(0, 30).forEach((w) => rumahDetailSet.add(w.blok + "," + w.kavling));
      warnaPemilik.clear(); rumahTerisi.clear(); daftarRumah.length = 0;
      let offset = 0, total = st.warga || 0;
      while (offset < Math.min(total, 2000)) {
        const p = await (await fetch(`/api/warga?limit=500&offset=${offset}`)).json();
        (p.warga || []).forEach((w) => {
          warnaPemilik.set(w.blok + "," + w.kavling, w.warna_baju);
          rumahTerisi.add(w.blok + "," + w.kavling);
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
  const kanvas = $("#kanvas");
  const renderer = new THREE.WebGLRenderer({ canvas: kanvas, antialias: true });
  renderer.setPixelRatio(PARAM.pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = PARAM.bayangan;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic: warna poster yang hangat & lembut
  renderer.toneMappingExposure = 1.05; // 1,2 -> 1,05 (perbaikan warna): pastel tidak lagi meledak ke putih

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaad9f2);
  scene.fog = new THREE.Fog(0xf6d9a8, 2600, 9000); // kabut hangat golden hour. PERBAIKAN WARNA: near 900 -> 2600 & far 5600 -> 9000 — dulu kabut mulai di 900 sehingga hampir seluruh kota yang terlihat (skala 6.720x4.200) terpapar kabut krem dan pucat; kini area pandang normal jernih, kabut hanya kabur di cakrawala. far 9000 = far mode 1st Person, di bawah far Orbit/Drone (13000): aman.
  /* Kubah langit gradasi: horizon krem hangat -> biru lembut di atas.
     ShaderMaterial tidak kena tone mapping/fog — warna dipilih sebagai nilai akhir.
     Radius 8200 < far mode 1st Person (9000) dan < far Orbit/Drone (13000) dari posisi ekstrem mana pun. */
  const kubahLangit = new THREE.Mesh(
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
        " gl_FragColor = vec4(c, 1.0); }",
    }));
  kubahLangit.frustumCulled = false; kubahLangit.renderOrder = -1;
  scene.add(kubahLangit);
  /* near/far diperketat per mode di aturMode() (anti z-fighting): rasio far/near
     menentukan presisi depth buffer; nilai awal ini untuk mode Orbit. */
  const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 2, 13000);
  camera.rotation.order = "YXZ"; // supaya yaw/pitch mode 1st Person & Drone berperilaku seperti FPS

  /* Golden hour: matahari miring dari barat (-x), cahaya & ambient hangat. */
  const OFSET_MATAHARI = { x: -240, y: 150, z: 90 };
  const hemi = new THREE.HemisphereLight(0xffe7c4, 0x86a860, 0.62); // ambient 0,85 -> 0,62: kurang cuci, kontras arah cahaya terasa
  scene.add(hemi);
  const matahari = new THREE.DirectionalLight(0xffc384, 1.15); // kunci cahaya 1,05 -> 1,15: sisi terang/jatuh bayangan lebih tegas
  matahari.position.set(OFSET_MATAHARI.x, OFSET_MATAHARI.y, OFSET_MATAHARI.z);
  matahari.castShadow = PARAM.bayangan;
  matahari.shadow.mapSize.set(PARAM.petaBayangan || 2048, PARAM.petaBayangan || 2048);
  matahari.shadow.camera.left = -150; matahari.shadow.camera.right = 150;
  matahari.shadow.camera.top = 150; matahari.shadow.camera.bottom = -150;
  matahari.shadow.camera.far = 600;
  scene.add(matahari); scene.add(matahari.target);

  /* ---------- Siklus cahaya (Paket 3 ?v=15) ----------
     Lapisan bintang: 700 titik deterministik di kubah langit (r 7.900,
     hanya belahan atas), 1 draw call, TANPA PointLight baru. Opasitasnya
     digerakkan fase waktu — siang/senja 0, malam menyala. */
  const matBintang = new THREE.PointsMaterial({
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
  const wkt = {};
  (function mulaiWaktu() {
    const p = parameterWaktu(pilihanWaktu, 0);
    for (const k of KUNCI_HEX_WAKTU) wkt[k] = new THREE.Color(p[k]);
    for (const k of KUNCI_ANGKA_WAKTU) wkt[k] = p[k];
  })();
  let waktuSiklus = 0; // jam berjalan untuk mode "siklus" (detik)
  const _warnaSasaran = new THREE.Color();
  function terapkanWaktu(dt, jepret) {
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

  const M = (warna, kasar) => new THREE.MeshStandardMaterial({ color: warna, roughness: kasar == null ? 0.95 : kasar, flatShading: true });
  function kotak(w, h, d, warna, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(warna));
    m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* ---------- Tanah kota: tekstur grid per blok ---------- */
  (function tanahKota() {
    const tex = buatTeksturProsedural(buatKanvasTanah);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(BLOK_KOLOM, BLOK_BARIS);
    tex.anisotropy = 4;
    const tanah = new THREE.Mesh(new THREE.PlaneGeometry(KOTA_W, KOTA_D),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    tanah.rotation.x = -Math.PI / 2; tanah.receiveShadow = true; scene.add(tanah);
    const alas = kotak(KOTA_W + 60, 6, KOTA_D + 60, 0x8a6844, 0, -3.4, 0); alas.castShadow = false; scene.add(alas);
  })();

  /* ---------- Helper geometri gabungan (untuk instancing & awan) ----------
     Menggabungkan beberapa geometri primitif (masing-masing dengan transform
     sendiri) menjadi SATU BufferGeometry non-indexed — supaya pagar & awan
     tetap 1 draw call per InstancedMesh/mesh. */
  function gabungGeometri(daftar) {
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
  function gabungBerwarna(daftar) {
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
  function geometriDetailMassal() {
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const TRIM = 0xfdf3d8, KAYU = 0x7a5230;
    const bagian = [
      { geo: B(9.3, 0.55, 8.3), x: 0, y: 0.27, z: 0, warna: 0x9a938a },        // plinth pondasi
      { geo: B(9.0, 0.4, 8.0), x: 0, y: 4.02, z: 0, warna: TRIM },             // lis di bawah atap
      { geo: B(1.6, 2.7, 0.14), x: 0, y: 1.35, z: 3.82, warna: TRIM },         // bingkai pintu
      { geo: B(1.34, 2.5, 0.16), x: 0, y: 1.25, z: 3.85, warna: 0x7a4a21 },    // daun pintu
      { geo: B(0.14, 0.14, 0.1), x: 0.45, y: 1.25, z: 3.94, warna: 0xd9a441 }, // kenop
    ];
    for (const sx of [-1, 1]) {
      bagian.push({ geo: B(2.26, 1.64, 0.12), x: sx * 1.89, y: 2.22, z: 3.81, warna: KAYU }); // bingkai jendela
      bagian.push({ geo: B(0.09, 1.46, 0.14), x: sx * 1.89, y: 2.22, z: 3.83, warna: KAYU }); // kusen vertikal
      bagian.push({ geo: B(2.08, 0.09, 0.14), x: sx * 1.89, y: 2.22, z: 3.83, warna: KAYU }); // kusen horizontal
      bagian.push({ geo: B(2.42, 0.12, 0.22), x: sx * 1.89, y: 1.36, z: 3.85, warna: TRIM }); // ambang
    }
    return gabungBerwarna(bagian);
  }
  /* Atap pelana (prisma segitiga): bubungan sejajar sumbu z, ujung segitiga
     menghadap depan/belakang rumah. Basis di y=0, tinggi h. Non-indexed ->
     normal wajah datar (flat shading) dari computeVertexNormals. */
  function geometriAtapPelana(w, h, d) {
    const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], C = [w / 2, 0, d / 2],
      D = [-w / 2, 0, d / 2], E = [0, h, -d / 2], F = [0, h, d / 2];
    const wajah = [
      [A, F, E, [0, 1], [1, 0], [0, 0]], [A, D, F, [0, 1], [1, 1], [1, 0]], // lereng kiri (v: bubungan 0 -> tepi 1)
      [B, E, F, [0, 0], [0, 1], [1, 0]], [B, F, C, [0, 0], [1, 1], [1, 1]], // lereng kanan
      [D, C, F, [0, 0], [1, 0], [0.5, 1]],                                  // ujung depan (+z)
      [B, A, E, [1, 0], [0, 0], [0.5, 1]],                                  // ujung belakang (-z)
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
    return geo;
  }
  function geometriPagar() { // pagar kayu: 4 tiang + 2 rel, panjang 12,6, basis y=0
    const bagian = [];
    for (const px of [-6, -2, 2, 6]) bagian.push({ geo: new THREE.BoxGeometry(0.22, 1.15, 0.22), x: px, y: 0.575, z: 0 });
    bagian.push({ geo: new THREE.BoxGeometry(12.6, 0.16, 0.1), x: 0, y: 0.88, z: 0 });
    bagian.push({ geo: new THREE.BoxGeometry(12.6, 0.16, 0.1), x: 0, y: 0.45, z: 0 });
    return gabungGeometri(bagian);
  }
  function geometriAwan(seed) { // 4–5 gumpalan bola pipih digabung jadi 1 geometri
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
  const TEX_KILAU = (() => {
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const grd = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,240,200,0.95)");
    grd.addColorStop(0.4, "rgba(255,220,150,0.45)");
    grd.addColorStop(1, "rgba(255,210,130,0)");
    c.fillStyle = grd; c.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  function tambahKilau(x, z, y, w, d, opasitas) {
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
  function bangunKotaMassal() {
    IM_LINGKUNGAN.length = 0; // daftar dekorasi dibangun ulang bersama grup kota
    const daftar = [];
    for (let bar = 0; bar < BLOK_BARIS; bar++) for (let kol = 0; kol < BLOK_KOLOM; kol++) {
      const kunci = kol + "," + bar;
      if (RESERVASI.has(kunci) || TAMAN.has(kunci)) continue;
      const blokNomor = bar * BLOK_KOLOM + kol + 1;
      const s = sudutBlok(kol, bar);
      for (let k = 0; k < PER_BLOK; k++) {
        const nomor = (blokNomor - 1) * PER_BLOK + k + 1;
        daftar.push({
          x: s.x + JALAN + KAV_PITCH / 2 + (k % SISI) * KAV_PITCH,
          z: s.z + JALAN + KAV_PITCH / 2 + Math.floor(k / SISI) * KAV_PITCH,
          nomor, blok: blokNomor, zona: zonaDariKolBar(kol, bar),
          kunciPos: blokNomor + "," + (k + 1), // kunci data warga (blok,kavling) — alokasi server tidak lagi urut per nomor
          kx: k % SISI, kz: Math.floor(k / SISI), h: hashInt(nomor),
        });
      }
    }
    /* Hanya kavling terisi yang jadi rumah, dikurangi kavling detail
       (rumahnya dibangun bangunDistrik di petak yang sama); daftar penuh
       tetap dipakai untuk dekorasi lahan (pagar/semak/pohon) di semua
       petak. */
    const daftarIsi = daftar.filter((d) => rumahTerisi.has(d.kunciPos) && !rumahDetailSet.has(d.kunciPos));
    const grup = new THREE.Group();
    const dummy = new THREE.Object3D(); const warna = new THREE.Color();
    const syDari = (d) => 0.9 + d.h * 0.3;
    const warnaAtap = (d) => {
      const milik = warnaPemilik.get(d.kunciPos);
      if (milik) return warna.set(milik); // identitas pemilik: atap = warna bajunya
      const hsl = warnaAtapZonaHSL(d.zona, d.h, hashInt(d.nomor * 3 + 7));
      return warna.setHSL(hsl[0], hsl[1], hsl[2]);
    };
    /* Dinding rumah terisi: 1 InstancedMesh bertekstur plesteran (tekstur
       terang dikali warna instans — pastel sekeluarga dengan atap zonanya). */
    const imDinding = new THREE.InstancedMesh(new THREE.BoxGeometry(8.6, 4.2, 7.6),
      new THREE.MeshStandardMaterial({ map: TEX_DINDING, roughness: 0.95, flatShading: true }), Math.max(1, daftarIsi.length));
    daftarIsi.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x, 2.1 * sy, d.z);
      dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imDinding.setMatrixAt(i, dummy.matrix);
      const hsl = warnaDindingZonaHSL(d.zona, hashInt(d.nomor * 11 + 3), hashInt(d.nomor * 13 + 5));
      imDinding.setColorAt(i, warna.setHSL(hsl[0], hsl[1], hsl[2]));
    });
    imDinding.count = daftarIsi.length;
    imDinding.receiveShadow = true;
    grup.add(imDinding);
    /* Detail muka (skill-3d): SATU InstancedMesh tambahan berisi plinth,
       lis, pintu & jendela berbingkai untuk semua rumah massal — total
       hanya +1 draw call untuk seluruh kota. Transform per instans sama
       dengan dinding (posisi + skala-y syDari), geometrinya ber-origo
       tanah sehingga ditaruh di y=0. */
    const imDetailMassal = new THREE.InstancedMesh(geometriDetailMassal(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), Math.max(1, daftarIsi.length));
    daftarIsi.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x, 0, d.z);
      dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imDetailMassal.setMatrixAt(i, dummy.matrix);
    });
    imDetailMassal.count = daftarIsi.length;
    imDetailMassal.receiveShadow = true;
    grup.add(imDetailMassal);
    /* Atap: 3 bentuk dibagi deterministik per nomor rumah — pelana ±55%,
       limas (kerucut-4, bentuk lama) ±30%, datar berparapet ±15%.
       Hanya untuk rumah terisi, sama seperti dinding/cerobong/teras. */
    const daftarPelana = [], daftarLimas = [], daftarDatar = [], daftarCerobong = [], daftarTeras = [];
    daftarIsi.forEach((d) => {
      const h2 = hashInt(d.nomor * 7 + 1);
      if (h2 < 0.55) daftarPelana.push(d); else if (h2 < 0.85) daftarLimas.push(d); else daftarDatar.push(d);
      if (h2 < 0.85 && hashInt(d.nomor * 13 + 5) < 0.35) daftarCerobong.push(d); // cerobong hanya di atap miring
      if (hashInt(d.nomor * 17 + 3) < 0.7) daftarTeras.push(d);
    });
    const matAtap = new THREE.MeshStandardMaterial({ map: TEX_ATAP, roughness: 0.95, flatShading: true });
    const imPelana = new THREE.InstancedMesh(geometriAtapPelana(10.4, 3.2, 9.4), matAtap, Math.max(1, daftarPelana.length));
    const geoLimas = new THREE.ConeGeometry(6.6, 3.4, 4); geoLimas.rotateY(Math.PI / 4);
    const imLimas = new THREE.InstancedMesh(geoLimas, matAtap, Math.max(1, daftarLimas.length));
    const imDatar = new THREE.InstancedMesh(new THREE.BoxGeometry(9.6, 0.55, 8.6),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, daftarDatar.length));
    daftarPelana.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x, 4.2 * sy, d.z); dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imPelana.setMatrixAt(i, dummy.matrix); imPelana.setColorAt(i, warnaAtap(d));
    });
    daftarLimas.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x, 4.2 * sy + 1.7, d.z); dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imLimas.setMatrixAt(i, dummy.matrix); imLimas.setColorAt(i, warnaAtap(d));
    });
    daftarDatar.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x, 4.2 * sy + 0.28, d.z); dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imDatar.setMatrixAt(i, dummy.matrix); imDatar.setColorAt(i, warnaAtap(d));
    });
    imPelana.count = daftarPelana.length; imLimas.count = daftarLimas.length; imDatar.count = daftarDatar.length;
    grup.add(imPelana); grup.add(imLimas); grup.add(imDatar);
    /* Mesh atap berdaftar KOSONG wajib disembunyikan (?v=33): imPelana &
       imLimas BERBAGI material matAtap. Bila satu daftar kosong, setColorAt
       tak pernah terpanggil untuknya -> instanceColor null, sementara
       saudaranya punya instanceColor -> program shader matAtap memuat
       atribut instanceColor dan three r128 melempar TypeError
       "Cannot read properties of null (reading
       'isInterleavedBufferAttribute')" di WebGLAttributes.get() setiap
       frame; render mati total dan mulai() tak pernah menyembunyikan
       #muat (insiden 22 Nov: warga ke-31 membuat daftarIsi massal tepat
       1 rumah pelana, daftarLimas kosong -> loading nyangkut di semua
       perangkat). Mesh count 0 tak menggambar apa pun, jadi menyembunyi-
       kannya tak mengubah tampilan. */
    if (!daftarPelana.length) imPelana.visible = false;
    if (!daftarLimas.length) imLimas.visible = false;
    if (!daftarDatar.length) imDatar.visible = false;
    /* Cerobong bata (sebagian rumah beratap miring) + teras kayu depan rumah. */
    const imCerobong = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 2.4, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xa2604c, roughness: 1, flatShading: true }), Math.max(1, daftarCerobong.length));
    daftarCerobong.forEach((d, i) => {
      const sy = syDari(d);
      dummy.position.set(d.x + 2.2, 6.3 * sy, d.z - 1.2); dummy.scale.set(1, sy, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imCerobong.setMatrixAt(i, dummy.matrix);
    });
    imCerobong.count = daftarCerobong.length;
    const imTeras = new THREE.InstancedMesh(new THREE.BoxGeometry(3.8, 0.3, 2.0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, daftarTeras.length));
    const WARNA_KAYU = [0xa9743f, 0x9c6a38, 0xb5854f];
    daftarTeras.forEach((d, i) => {
      dummy.position.set(d.x, 0.15, d.z + 4.75); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imTeras.setMatrixAt(i, dummy.matrix);
      imTeras.setColorAt(i, warna.setHex(WARNA_KAYU[Math.floor(hashInt(d.nomor * 37 + 2) * 3)]));
    });
    imTeras.count = daftarTeras.length;
    grup.add(imCerobong); grup.add(imTeras);
    /* Lingkungan kavling: pagar kayu + semak + pohon kecil — semua instanced.
       Berlaku di SEMUA petak (daftar penuh): di kavling terisi jadi halaman
       rumah; di kavling kosong jadi pembatas & penanda petak lahan kosong.
       Semua posisinya di luar tapak dinding (pagar di tepi depan petak,
       semak di sudut depan, pohon kecil di sudut belakang), jadi tetap
       masuk akal tanpa rumah.
       PERAPIAN: kavling yang berdekorasi dipilih polaKavling() (pola modular
       per posisi kavling, terlihat tertata dari atas), bukan sebaran hash.
       Kandidat tetap DIURUTKAN berdasarkan hash-nya, jadi memotong .count
       lewat opsi kualitas menipiskan dekorasi secara merata di seluruh
       kota, bukan menghapus satu wilayah utuh. */
    const kandPagar = [], kandSemak = [], kandPohon = [];
    daftar.forEach((d) => {
      const pola = polaKavling(d.kx, d.kz, d.blok);
      if (pola.pagar) kandPagar.push({ d, h: hashInt(d.nomor * 19 + 7) });
      if (pola.semak) kandSemak.push({ d, h: hashInt(d.nomor * 23 + 11) });
      if (pola.pohon) kandPohon.push({ d, h: hashInt(d.nomor * 29 + 13) });
    });
    kandPagar.sort((a, b) => a.h - b.h); kandSemak.sort((a, b) => a.h - b.h); kandPohon.sort((a, b) => a.h - b.h);
    const imPagar = new THREE.InstancedMesh(geometriPagar(),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, kandPagar.length));
    kandPagar.forEach((k, i) => {
      dummy.position.set(k.d.x, 0, k.d.z + 6.35); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imPagar.setMatrixAt(i, dummy.matrix);
      imPagar.setColorAt(i, warna.setHex(WARNA_KAYU[Math.floor(hashInt(k.d.nomor * 37 + 2) * 3)]));
    });
    const imSemak = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, kandSemak.length));
    const WARNA_SEMAK = [0x4da653, 0x66bb6a, 0x3f9e4d, 0x7cb84a];
    kandSemak.forEach((k, i) => {
      const sisi = k.d.kx % 2 === 0 ? 1 : -1; // sisi bergantian teratur mengikuti kolom kavling
      const sc = 0.8 + hashInt(k.d.nomor * 41 + 6) * 0.6;
      dummy.position.set(k.d.x + sisi * 4.9, 0.52 * sc, k.d.z + 5.0);
      dummy.scale.set(sc, sc * 0.72, sc); dummy.rotation.set(0, (k.d.kx * 5 + k.d.kz) * 0.63, 0);
      dummy.updateMatrix(); imSemak.setMatrixAt(i, dummy.matrix);
      imSemak.setColorAt(i, warna.setHex(WARNA_SEMAK[Math.floor(hashInt(k.d.nomor * 43 + 9) * 4) % 4]));
    });
    const imBatangK = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 1, flatShading: true }), Math.max(1, kandPohon.length));
    const imDaunK = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.7, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, kandPohon.length));
    kandPohon.forEach((k, i) => {
      const sisi = k.d.kz % 2 === 0 ? 1 : -1; // sisi bergantian teratur mengikuti baris kavling
      const sc = 0.9 + hashInt(k.d.nomor * 53 + 4) * 0.5;
      const px = k.d.x + sisi * 5.0, pz = k.d.z - 4.8;
      dummy.rotation.set(0, (k.d.kx + k.d.kz * 3) * 0.63, 0); dummy.scale.set(sc, sc, sc);
      dummy.position.set(px, 1.1 * sc, pz); dummy.updateMatrix(); imBatangK.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 3.1 * sc; dummy.updateMatrix(); imDaunK.setMatrixAt(i, dummy.matrix);
      imDaunK.setColorAt(i, warna.setHex(WARNA_SEMAK[Math.floor(hashInt(k.d.nomor * 59 + 3) * 4) % 4]));
    });
    for (const [mesh, penuh] of [[imPagar, kandPagar.length], [imSemak, kandSemak.length], [imBatangK, kandPohon.length], [imDaunK, kandPohon.length]]) {
      mesh.count = Math.floor(penuh * PARAM.kepadatan);
      IM_LINGKUNGAN.push({ mesh, penuh });
      grup.add(mesh);
    }
    /* Jalan utama ditata: pohon & lampu jalan berderet teratur di sepanjang
       jalan antar-zona — posisi dari elemenJalan() (murni, deterministik).
       Semua instanced & ikut kepadatan kualitas lewat IM_LINGKUNGAN.
       Dekorasi jalan tidak ditabrak pemain, sama seperti dekorasi kavling. */
    const elJalan = elemenJalan();
    const geoBatangJ = new THREE.CylinderGeometry(0.3, 0.45, 2.8, 6); geoBatangJ.translate(0, 1.4, 0);
    const geoDaunJ = new THREE.IcosahedronGeometry(2.35, 0); geoDaunJ.translate(0, 4.1, 0);
    const imBatangJ = new THREE.InstancedMesh(geoBatangJ,
      new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 1, flatShading: true }), Math.max(1, elJalan.pohon.length));
    const imDaunJ = new THREE.InstancedMesh(geoDaunJ,
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), Math.max(1, elJalan.pohon.length));
    elJalan.pohon.forEach((p, i) => {
      const sc = 0.92 + p.h * 0.25;
      dummy.position.set(p.x, 0, p.z); dummy.scale.set(sc, sc, sc); dummy.rotation.set(0, p.h * 6.28, 0);
      dummy.updateMatrix(); imBatangJ.setMatrixAt(i, dummy.matrix); imDaunJ.setMatrixAt(i, dummy.matrix);
      imDaunJ.setColorAt(i, warna.setHex(WARNA_SEMAK[Math.floor(p.h * 4) % 4]));
    });
    const geoTiangL = new THREE.BoxGeometry(0.2, 4.6, 0.2); geoTiangL.translate(0, 2.3, 0);
    const geoKepalaL = new THREE.BoxGeometry(0.55, 0.28, 0.55); geoKepalaL.translate(0, 4.75, 0);
    const imTiangL = new THREE.InstancedMesh(geoTiangL,
      new THREE.MeshStandardMaterial({ color: 0x46524a, roughness: 0.8, flatShading: true }), Math.max(1, elJalan.lampu.length));
    const imKepalaL = new THREE.InstancedMesh(geoKepalaL,
      new THREE.MeshStandardMaterial({ color: 0xffe2ae, emissive: 0xffc37a, emissiveIntensity: 0.85, roughness: 0.6, flatShading: true }), Math.max(1, elJalan.lampu.length));
    LAMPU_JALAN.matKepala = imKepalaL.material; // fase waktu (?v=15) mengatur nyala kepala lampu dari sini
    elJalan.lampu.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imTiangL.setMatrixAt(i, dummy.matrix); imKepalaL.setMatrixAt(i, dummy.matrix);
    });
    for (const [mesh, penuh] of [[imBatangJ, elJalan.pohon.length], [imDaunJ, elJalan.pohon.length], [imTiangL, elJalan.lampu.length], [imKepalaL, elJalan.lampu.length]]) {
      mesh.count = Math.floor(penuh * PARAM.kepadatan);
      IM_LINGKUNGAN.push({ mesh, penuh });
      grup.add(mesh);
    }
    /* Lampu lalu lintas + marka di SEMUA persimpangan kota (LOGIKA
       LALU LINTAS di atas): tiang statis 1 InstancedMesh; cakram lampu
       6 InstancedMesh (sumbu x warna) bermaterial BERSAMA per sumbu/warna
       — fasenya ditukar perbaruiLaluLintas() dari loop render, tanpa
       PointLight baru; zebra + garis henti + tutup garis tengah
       1 InstancedMesh berwarna per instans. Elemen kota inti: TIDAK ikut
       kepadatan kualitas (tidak masuk IM_LINGKUNGAN) dan tidak ditabrak
       (tiang di trotoar, sama seperti lampu jalan). */
    const tiangLL = tiangLaluLintas();
    const geoTiangLL = gabungGeometri([ // tiang menghadap +z, basis y=0
      { geo: new THREE.BoxGeometry(0.56, 0.22, 0.56), x: 0, y: 0.11, z: 0 },      // alas
      { geo: new THREE.BoxGeometry(0.16, 3.7, 0.16), x: 0, y: 2.07, z: 0 },       // tiang
      { geo: new THREE.BoxGeometry(0.62, 1.5, 0.42), x: 0, y: 4.42, z: 0.08 },     // kotak lampu
      { geo: new THREE.BoxGeometry(0.7, 0.09, 0.5), x: 0, y: 5.21, z: 0.08 },      // topi kotak
    ]);
    const imTiangLL = new THREE.InstancedMesh(geoTiangLL,
      new THREE.MeshStandardMaterial({ color: 0x2e3236, roughness: 0.85, flatShading: true }), Math.max(1, tiangLL.length));
    const geoCakramLL = new THREE.CylinderGeometry(0.155, 0.155, 0.09, 10);
    geoCakramLL.rotateX(Math.PI / 2); // sumbu cakram -> +z (arah hadap tiang)
    const matLLBaru = {}, imCakramPeta = {};
    for (const sumbu of ["us", "tb"]) {
      matLLBaru[sumbu] = {};
      const nSumbu = tiangLL.filter((s) => s.sumbu === sumbu).length;
      for (const w of ["merah", "kuning", "hijau"]) {
        const mat = new THREE.MeshStandardMaterial({
          color: WARNA_LAMPU_LL[w].mati, emissive: WARNA_LAMPU_LL[w].nyala, emissiveIntensity: 0, roughness: 0.4,
        });
        matLLBaru[sumbu][w] = mat;
        const im = new THREE.InstancedMesh(geoCakramLL, mat, Math.max(1, nSumbu));
        im.frustumCulled = false; im.instanceMatrix.needsUpdate = true;
        imCakramPeta[sumbu + w] = im; grup.add(im);
      }
    }
    const Y_CAKRAM_LL = { merah: 4.87, kuning: 4.42, hijau: 3.97 }; // di muka kotak (z lokal 0,29) -> cakram di 0,31
    const hitungCakram = { us: 0, tb: 0 };
    tiangLL.forEach((s, i) => {
      const ry = Math.atan2(s.hx, s.hz);
      dummy.position.set(s.x, 0, s.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix(); imTiangLL.setMatrixAt(i, dummy.matrix);
      const j = hitungCakram[s.sumbu]++;
      for (const w of ["merah", "kuning", "hijau"]) {
        dummy.position.set(s.x + s.hx * 0.31, Y_CAKRAM_LL[w], s.z + s.hz * 0.31);
        dummy.updateMatrix(); imCakramPeta[s.sumbu + w].setMatrixAt(j, dummy.matrix);
      }
    });
    imTiangLL.frustumCulled = false; imTiangLL.instanceMatrix.needsUpdate = true;
    grup.add(imTiangLL);
    LL_AKTIF.mat = matLLBaru; LL_AKTIF.kunci = ""; // grup baru: fase diterapkan ulang di frame berikut
    /* Marka: kotak tipis 0,06 di atas aspal (y 0,03) + polygonOffset -2 —
       mengikuti preseden anti z-fighting bidang di atas tanah. Tutup
       sewarna aspal digambar lebih dulu (urutan instans tidak menentukan
       z, tapi warna per instans yang membedakan). */
    const marka = markaPersimpangan();
    const semuaMarka = [];
    for (const r of marka.tutup) semuaMarka.push({ x: r.x, z: r.z, w: r.w, d: r.d, warna: 0xb39d72 });
    for (const r of marka.zebra) semuaMarka.push({ x: r.x, z: r.z, w: r.w, d: r.d, warna: 0xfffdf2 });
    for (const r of marka.henti) semuaMarka.push({ x: r.x, z: r.z, w: r.w, d: r.d, warna: 0xfffdf2 });
    const imMarka = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1),
      new THREE.MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      Math.max(1, semuaMarka.length));
    semuaMarka.forEach((r, i) => {
      dummy.position.set(r.x, 0.03, r.z); dummy.scale.set(r.w, 1, r.d); dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix(); imMarka.setMatrixAt(i, dummy.matrix);
      imMarka.setColorAt(i, warna.setHex(r.warna));
    });
    imMarka.frustumCulled = false; imMarka.receiveShadow = true;
    imMarka.instanceMatrix.needsUpdate = true;
    if (imMarka.instanceColor) imMarka.instanceColor.needsUpdate = true;
    grup.add(imMarka);
    for (const im of [imDinding, imPelana, imLimas, imDatar, imCerobong, imTeras, imPagar, imSemak, imBatangK, imDaunK, imBatangJ, imDaunJ, imTiangL, imKepalaL]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.frustumCulled = false; // instans membentang sekota — bounding sphere geometri tunggal tidak mewakili
    }
    scene.add(grup);
    return { grup, imDinding, imPelana, imLimas, imDatar };
  }

  /* ---------- Lahan pembangunan: 60 blok taman lama jadi petak kosong ----------
     Keputusan Fahmi (pembangunan bertahap): desa mulai HANYA dari kantor
     kades; fasilitas berdiri satu per satu dari usulan warga. Ke-60 blok
     taman lama kini petak tanah kosong berpagar; 8 di antaranya dicadangkan
     untuk fasilitas bernama (FASILITAS_BLOK) dan berpapan nama fasilitasnya,
     sisanya berpapan generik "LAHAN PEMBANGUNAN". Fasilitas yang statusnya
     "terbangun" di server (GET /api/pembangunan, dibaca sekali saat muat)
     berdiri sebagai model 3D prosedural di blok lahannya — pagar & papan
     lahannya dilipat. Danau di blok (36,28) dipertahankan apa adanya: itu
     air alam di tengah lahan kosong, bukan bangunan (blok itu bukan lahan
     fasilitas). Pohon taman instanced lama dihapus dari blok-blok ini. */
  const FASILITAS_NAMA = {
    taman: "Taman Desa", lapangan: "Lapangan Bola", perpustakaan: "Perpustakaan Desa",
    balai_warga: "Balai Warga", sekolah: "Sekolah Dasar", puskesmas: "Puskesmas",
    pasar: "Pasar Desa", masjid: "Masjid", toko_pancing: "Toko Pancing",
  };
  function pusatBlok(kol, bar) { // titik tengah alas blok (sama seperti alas taman lama)
    const s = sudutBlok(kol, bar);
    return { x: s.x + PITCH / 2 + JALAN / 2, z: s.z + PITCH / 2 + JALAN / 2 };
  }
  function geometriPagarBlok() { // pagar keliling petak 66x66: tiang + 2 rel per sisi, basis y=0
    const bagian = [];
    const tiang = () => new THREE.BoxGeometry(0.3, 1.35, 0.3);
    for (let t = -33; t <= 33; t += 6) {
      bagian.push({ geo: tiang(), x: t, y: 0.675, z: -33 });
      bagian.push({ geo: tiang(), x: t, y: 0.675, z: 33 });
      if (t > -33 && t < 33) { // sudut sudah terisi sisi x — tiang ganda koplanar dihindari
        bagian.push({ geo: tiang(), x: -33, y: 0.675, z: t });
        bagian.push({ geo: tiang(), x: 33, y: 0.675, z: t });
      }
    }
    for (const y of [0.5, 1.0]) {
      bagian.push({ geo: new THREE.BoxGeometry(66.6, 0.15, 0.1), x: 0, y, z: -33 });
      bagian.push({ geo: new THREE.BoxGeometry(66.6, 0.15, 0.1), x: 0, y, z: 33 });
      bagian.push({ geo: new THREE.BoxGeometry(0.1, 0.15, 66.6), x: -33, y, z: 0 });
      bagian.push({ geo: new THREE.BoxGeometry(0.1, 0.15, 66.6), x: 33, y, z: 0 });
    }
    return gabungGeometri(bagian);
  }
  function teksturPapanNama(besar, kecil) { // papan kayu: judul krem + subjudul kuning
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 160;
    const c = cv.getContext("2d");
    c.fillStyle = "#7a4a21"; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = "#5d3717"; c.lineWidth = 10; c.strokeRect(5, 5, 502, 150);
    c.textAlign = "center"; c.textBaseline = "middle";
    c.fillStyle = "#fff7e0"; c.font = "bold 50px system-ui, sans-serif";
    c.fillText(besar, 256, kecil ? 60 : 80, 472);
    if (kecil) {
      c.fillStyle = "#ffd98a"; c.font = "bold 29px system-ui, sans-serif";
      c.fillText(kecil, 256, 118, 472);
    }
    return new THREE.CanvasTexture(cv);
  }
  function teksturPapanTokoPancing() { // papan toko pancing: ikon ikan digambar sendiri di canvas (tanpa emoji) + nama toko
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 160;
    const c = cv.getContext("2d");
    c.fillStyle = "#7a4a21"; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = "#5d3717"; c.lineWidth = 10; c.strokeRect(5, 5, 502, 150);
    // ikan: badan elips + ekor segitiga + sirip + mata, menghadap kiri
    c.fillStyle = "#ffd98a";
    c.beginPath(); c.ellipse(82, 80, 46, 25, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(120, 80); c.lineTo(152, 56); c.lineTo(152, 104); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(70, 60); c.lineTo(92, 42); c.lineTo(98, 62); c.closePath(); c.fill(); // sirip atas
    c.fillStyle = "#7a4a21";
    c.beginPath(); c.arc(56, 74, 5, 0, Math.PI * 2); c.fill(); // mata
    c.strokeStyle = "#7a4a21"; c.lineWidth = 4;
    c.beginPath(); c.arc(76, 80, 15, -0.9, 0.9); c.stroke(); // garis insang
    c.textAlign = "left"; c.textBaseline = "middle";
    c.fillStyle = "#fff7e0"; c.font = "bold 54px system-ui, sans-serif";
    c.fillText("TOKO PANCING", 172, 84, 322);
    return new THREE.CanvasTexture(cv);
  }
  let _texBenderaMerdu = null;
  function teksturBenderaMerdu() { // bendera Negara Merdu (?v=25): hijau tua + matahari emas 8 sinar + lis emas, rasio 3:2
    if (_texBenderaMerdu) return _texBenderaMerdu;
    const cv = document.createElement("canvas"); cv.width = 192; cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "#2e5d43"; c.fillRect(0, 0, 192, 128);
    c.strokeStyle = "#d9a441"; c.lineWidth = 5; c.strokeRect(4, 4, 184, 120);
    c.fillStyle = "#d9a441";
    const cx = 96, cy = 64;
    for (let i = 0; i < 8; i++) { // 8 sinar segitiga mengelilingi cakram
      const a = i * Math.PI / 4, a1 = a - 0.16, a2 = a + 0.16;
      c.beginPath();
      c.moveTo(cx + Math.cos(a1) * 27, cy + Math.sin(a1) * 27);
      c.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
      c.lineTo(cx + Math.cos(a2) * 27, cy + Math.sin(a2) * 27);
      c.closePath(); c.fill();
    }
    c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2); c.fill();
    _texBenderaMerdu = new THREE.CanvasTexture(cv);
    return _texBenderaMerdu;
  }
  function buatPapanNama(besar, kecil) { // grup papan: 2 tiang + panel bertekstur, basis y=0
    const g = new THREE.Group();
    g.add(kotak(0.24, 3.0, 0.24, 0x7a4a21, -4.4, 1.5, 0));
    g.add(kotak(0.24, 3.0, 0.24, 0x7a4a21, 4.4, 1.5, 0));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(11, 3.2, 0.18),
      new THREE.MeshStandardMaterial({ map: teksturPapanNama(besar, kecil), roughness: 0.9 }));
    panel.position.set(0, 2.9, 0); panel.castShadow = true; g.add(panel);
    return g;
  }
  function pohonKecil(x, z, s) {
    const g = new THREE.Group();
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.9, 6), M(0x8a5a30));
    batang.position.y = 0.95; batang.castShadow = true; g.add(batang);
    const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 0), M(0x4da653));
    daun.position.y = 3.1; daun.castShadow = true; g.add(daun);
    g.position.set(x, 0, z); g.scale.setScalar(s || 1);
    return g;
  }
  function bangkuTaman(x, z, rot) {
    const g = new THREE.Group();
    g.add(kotak(2.6, 0.18, 0.7, 0xa9743f, 0, 0.5, 0));
    g.add(kotak(2.6, 0.7, 0.14, 0xa9743f, 0, 0.95, -0.3));
    g.add(kotak(0.18, 0.5, 0.6, 0x7a4a21, -1.1, 0.25, 0));
    g.add(kotak(0.18, 0.5, 0.6, 0x7a4a21, 1.1, 0.25, 0));
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    return g;
  }
  function matAtapWarna(warna) {
    return new THREE.MeshStandardMaterial({ color: warna, map: TEX_ATAP, roughness: 0.95, flatShading: true });
  }
  /* Model prosedural tiap fasilitas — bentuk sederhana tapi bisa dibedakan
     dari jauh. Grup berisi y=0 di permukaan alas blok; posisi grup diatur
     pemanggil. Semua primitif dasar, flat shading, palet desa. */
  const MODEL_FASILITAS = {
    /* Taman Wah (?v=37, perintah Fahmi "Taman kurang wah"): taman kota
       beneran di Blok 1879 — gerbang berpapan nama di sisi TIMUR
       (menghadap cluster warga Blok 1880), jalan setapak silang penuh +
       cincin paving, air mancur bertingkat bola emas di tengah (pola
       air mancur istana diperkecil), gazebo di tenggara, area bermain
       anak di timur laut (ayunan + perosotan — nyambung usul taman
       bermain @hana_kaemung), hamparan bunga berpola instanced, lampu
       taman bermaterial LAMPU_TAMAN (menyala malam, tanpa PointLight
       baru). Kolam lama di (-14,-12) PERTAHANKAN. SEMUA elemen di dalam
       blok ini saja (perintah Fahmi "1 blok aja"): koordinat lokal
       terluar ±33, interior blok ±34. */
    taman(g) {
      // jalan setapak silang penuh + cincin paving mengelilingi air mancur
      g.add(kotak(62, 0.12, 4.5, 0xd9c58f, 0, 0.06, 0));
      g.add(kotak(4.5, 0.12, 62, 0xd9c58f, 0, 0.06, 0));
      const cincin = new THREE.Mesh(new THREE.RingGeometry(4.1, 6.1, 28),
        new THREE.MeshStandardMaterial({ color: 0xd9c58f, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
      cincin.rotation.x = -Math.PI / 2; cincin.position.y = 0.13; g.add(cincin);
      // kolam lama — dipertahankan persis
      const kolam = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.5, 20),
        new THREE.MeshStandardMaterial({ color: 0x57b7d6, roughness: 0.18, flatShading: true }));
      kolam.position.set(-14, 0.25, -12); g.add(kolam);
      /* air mancur tengah (pola istana diperkecil): bak bundar batu +
         air + tiang berundak + mangkuk + bola emas. Tanpa semprotan —
         pelajaran istana: kerucut semprotan terbaca murahan. */
      const batu = M(0xb8a888), batuT = M(0x9a8a70);
      const bak = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.15, 0.75, 16), batu);
      bak.position.y = 0.38; bak.castShadow = true; g.add(bak);
      const lisBak = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.2, 16), batuT);
      lisBak.position.y = 0.82; g.add(lisBak);
      const airM = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x6fb7cf, roughness: 0.25, flatShading: true, transparent: true, opacity: 0.9 }));
      airM.position.y = 0.8; g.add(airM);
      const tiangM = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.68, 1.05, 10), batuT);
      tiangM.position.y = 1.3; tiangM.castShadow = true; g.add(tiangM);
      const mangkuk = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.85, 0.4, 12), batuT);
      mangkuk.position.y = 1.98; g.add(mangkuk);
      const tiangK = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.55, 8), batuT);
      tiangK.position.y = 2.42; g.add(tiangK);
      const bolaEmas = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M(0xd9a441, 0.45));
      bolaEmas.position.y = 2.85; bolaEmas.castShadow = true; g.add(bolaEmas);
      /* gerbang timur (x +31,5) menghadap cluster warga: 2 tiang kayu
         beratap kecil + palang + papan "TAMAN NEGARA MERDU" bertekstur
         canvas (teksturPapanNama), menghadap +x. */
      for (const gz of [-3.4, 3.4]) {
        g.add(kotak(0.42, 5.0, 0.42, 0x7a4a21, 31.5, 2.5, gz));
        const topiG = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 4), matAtapWarna(0x2e5d43));
        topiG.position.set(31.5, 5.25, gz); topiG.rotation.y = Math.PI / 4; topiG.castShadow = true; g.add(topiG);
      }
      g.add(kotak(0.34, 0.45, 8.6, 0x7a4a21, 31.5, 4.62, 0)); // palang atas
      const papanGerbang = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.1, 7.4),
        new THREE.MeshStandardMaterial({ map: teksturPapanNama("TAMAN NEGARA MERDU", null), roughness: 0.9 }));
      papanGerbang.rotation.y = -Math.PI / 2; // tekstur menghadap +x (ke jalan & rumah warga)
      papanGerbang.position.set(31.5, 3.35, 0); papanGerbang.castShadow = true; g.add(papanGerbang);
      // pot pohon terakota mengapit jalan masuk di dalam gerbang
      for (const pz of [-5.8, 5.8]) {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 8), M(0xb5533c));
        pot.position.set(29.5, 0.4, pz); pot.castShadow = true; g.add(pot);
        const semakPot = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0), M(0x4da653));
        semakPot.position.set(29.5, 1.75, pz); semakPot.castShadow = true; g.add(semakPot);
      }
      /* gazebo tenggara (18,16): lantai batu + 6 tiang + atap limas
         terakota + bola emas kecil; bangku di dalam. Tapak DITABRAK
         penuh (lihat TAPAK_FASILITAS.taman). */
      g.add(kotak(9.5, 0.3, 9.5, 0xb8a888, 18, 0.15, 16));
      for (const [px, pz] of [[14.4, 12.4], [21.6, 12.4], [14.4, 19.6], [21.6, 19.6], [18, 12.4], [18, 19.6]]) {
        const tg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.7, 7), M(0x8a5a30));
        tg.position.set(px, 1.65, pz); tg.castShadow = true; g.add(tg);
      }
      const atapG = new THREE.Mesh(new THREE.ConeGeometry(7.6, 2.4, 4), matAtapWarna(0xb5533c));
      atapG.rotation.y = Math.PI / 4; atapG.scale.set(1.15, 1, 1.15);
      atapG.position.set(18, 4.2, 16); atapG.castShadow = true; g.add(atapG);
      const bolaG = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M(0xd9a441, 0.45));
      bolaG.position.set(18, 5.55, 16); g.add(bolaG);
      g.add(bangkuTaman(18, 16, 0));
      /* area bermain anak timur laut: ayunan (rangka x 14,5..21,5 di
         z -16) + perosotan (menara di (13,5;-22,5), luncuran turun ke
         utara). Warna ceria merah/kuning/biru. */
      for (const [px, pz] of [[14.5, -17.3], [14.5, -14.7], [21.5, -17.3], [21.5, -14.7]])
        g.add(kotak(0.18, 2.6, 0.18, 0x37474f, px, 1.3, pz));
      const palangAyun = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 7.6, 7), M(0x37474f));
      palangAyun.rotation.z = Math.PI / 2; palangAyun.position.set(18, 2.6, -16); palangAyun.castShadow = true; g.add(palangAyun);
      for (const sx of [16.3, 19.7]) {
        for (const cx of [sx - 0.35, sx + 0.35]) {
          const rantai = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 5), M(0x78909c));
          rantai.position.set(cx, 1.82, -16); g.add(rantai);
        }
        g.add(kotak(0.95, 0.09, 0.5, 0xe86a5e, sx, 1.05, -16)); // dudukan ayunan
      }
      g.add(kotak(1.6, 1.5, 1.6, 0xf2b13d, 13.5, 0.75, -22.5)); // menara perosotan
      const atapS = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), matAtapWarna(0xe86a5e));
      atapS.rotation.y = Math.PI / 4; atapS.position.set(13.5, 2.4, -22.5); atapS.castShadow = true; g.add(atapS);
      const luncur = kotak(1.1, 0.12, 5.4, 0x57b7d6, 13.5, 0.82, -19.6);
      luncur.rotation.x = 0.42; g.add(luncur); // luncuran turun dari menara ke utara
      for (const rx of [12.9, 14.1]) {
        const rel = kotak(0.09, 0.3, 5.4, 0x37474f, rx, 1.0, -19.6);
        rel.rotation.x = 0.42; g.add(rel);
      }
      for (let t = 0; t < 3; t++) g.add(kotak(1.2, 0.1, 0.3, 0x7a4a21, 13.5, 0.3 + t * 0.45, -24.2 + t * 0.28)); // anak tangga selatan
      // pohon rindang — posisi lama yang bertabrakan elemen baru digeser keluar tapaknya
      for (const [x, z, s] of [[-6, -20, 0.85], [10, -26, 1.0], [-28, 8, 1.2], [6, 27, 1.0], [8, 20, 1.0], [-28, -26, 1.15], [28, 27, 1.1], [-27, 26, 0.95]]) g.add(pohonKecil(x, z, s));
      // bangku: lama dipertahankan + menghadap air mancur & kolam
      for (const [x, z, r] of [[6, 4.8, 0], [-6, -4.8, Math.PI], [4.8, -8, Math.PI / 2], [0, 7.6, 0], [0, -7.6, Math.PI], [-6.5, -12, -Math.PI / 2]]) g.add(bangkuTaman(x, z, r));
      /* lampu taman: kepala memakai LAMPU_TAMAN.mat bersama istana —
         emissive digerakkan fase waktu (menyala malam). TANPA
         PointLight baru. Fallback bila material belum terisi. */
      const matKepala = (typeof LAMPU_TAMAN !== "undefined" && LAMPU_TAMAN.mat) || M(0xffe2ae);
      function lampuTamanLokal(x, z) {
        const lg = new THREE.Group();
        const tiangL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.45, 8), M(0x455a64));
        tiangL.position.y = 1.22; lg.add(tiangL);
        const kepala = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.44), matKepala);
        kepala.position.y = 2.68; lg.add(kepala);
        const topiL = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 4), M(0x455a64));
        topiL.position.y = 3.1; topiL.rotation.y = Math.PI / 4; topiL.castShadow = true; lg.add(topiL);
        lg.position.set(x, 0, z);
        return lg;
      }
      for (const [lx, lz] of [[6.8, 6.8], [-6.8, 6.8], [6.8, -6.8], [-6.8, -6.8], [16, 3.6], [16, -3.6]]) g.add(lampuTamanLokal(lx, lz));
      /* hamparan bunga berpola: petak tanah + kepala bunga SATU
         InstancedMesh (instanceColor, material khusus milik mesh ini
         sendiri — pola aman dari jebakan ?v=33). */
      const petakBunga = [[-17, 15, 13, 6], [24, 5.9, 10, 3], [24, -5.9, 10, 3], [-5.5, 20, 3, 10], [5.5, 20, 3, 10]];
      for (const [bx, bz, bw, bd] of petakBunga) g.add(kotak(bw, 0.3, bd, 0x7a5a38, bx, 0.15, bz));
      const posisiBunga = [];
      for (const [bx, bz, bw, bd] of petakBunga) {
        const nx = Math.max(2, Math.round(bw / 2)), nz = Math.max(1, Math.round(bd / 2));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
          posisiBunga.push([bx - bw / 2 + (i + 0.5) * (bw / nx), bz - bd / 2 + (j + 0.5) * (bd / nz)]);
      }
      const imBunga = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.26, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), posisiBunga.length);
      {
        const dummyB = new THREE.Object3D();
        const paletBunga = [0xe14b5a, 0xf2d13d, 0xf6f0e6, 0xe88bb0, 0xf28bb4];
        const warnaB = new THREE.Color();
        posisiBunga.forEach(([fx, fz], i) => {
          dummyB.position.set(fx, 0.52, fz);
          dummyB.rotation.set(0, (i * 1.7) % Math.PI, 0);
          dummyB.updateMatrix();
          imBunga.setMatrixAt(i, dummyB.matrix);
          imBunga.setColorAt(i, warnaB.setHex(paletBunga[(i * 7 + Math.floor(i / 5)) % paletBunga.length]));
        });
        imBunga.instanceMatrix.needsUpdate = true;
        if (imBunga.instanceColor) imBunga.instanceColor.needsUpdate = true;
        imBunga.castShadow = true; imBunga.frustumCulled = false;
      }
      g.add(imBunga);
      // semak bola warna — 2 lama dipertahankan, 2 dipindah dari tapak elemen baru
      for (const [x, z, w] of [[-20, -4, 0xf28bb4], [-2, 16, 0xf28bb4], [26, 8, 0xe86a5e], [-24, 24, 0xf2b13d]]) {
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), M(w));
        b.position.set(x, 0.7, z); b.castShadow = true; g.add(b);
      }
    },
    lapangan(g) {
      g.add(kotak(46, 0.12, 30, 0x58b368, 0, 0.06, 0));    // bidang hijau
      const W = 0xffffff;
      g.add(kotak(44, 0.05, 0.5, W, 0, 0.145, -14));       // garis tepi
      g.add(kotak(44, 0.05, 0.5, W, 0, 0.145, 14));
      g.add(kotak(0.5, 0.05, 28, W, -22, 0.145, 0));
      g.add(kotak(0.5, 0.05, 28, W, 22, 0.145, 0));
      g.add(kotak(0.5, 0.05, 28, W, 0, 0.145, 0));         // garis tengah
      const lingkaran = new THREE.Mesh(new THREE.RingGeometry(4.6, 5.0, 24),
        new THREE.MeshBasicMaterial({ color: W, side: THREE.DoubleSide }));
      lingkaran.rotation.x = -Math.PI / 2; lingkaran.position.y = 0.15; g.add(lingkaran);
      for (const gx of [-22, 22]) {                        // 2 gawang
        g.add(kotak(0.25, 2.6, 0.25, W, gx, 1.3, -3.2));
        g.add(kotak(0.25, 2.6, 0.25, W, gx, 1.3, 3.2));
        g.add(kotak(0.25, 0.25, 6.65, W, gx, 2.6, 0));
      }
    },
    perpustakaan(g) {
      g.add(kotak(22, 0.14, 16, 0xd9c58f, 0, 0.07, 0));
      g.add(kotak(13, 5, 9, 0xfdebd0, 0, 2.64, 0));
      const atap = new THREE.Mesh(geometriAtapPelana(15, 2.4, 11), matAtapWarna(0x795548));
      atap.position.y = 5.14; atap.castShadow = true; g.add(atap);
      const papan = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.7, 0.15),
        new THREE.MeshStandardMaterial({ map: teksturPapanNama("PERPUSTAKAAN", null), roughness: 0.9 }));
      papan.position.set(0, 4.1, 4.6); g.add(papan);
      g.add(kotak(1.8, 3, 0.14, 0x7a4a21, 0, 1.64, 4.55)); // pintu
      g.add(kotak(2, 1.6, 0.14, 0xbfe8f5, -4.2, 3.2, 4.55));
      g.add(kotak(2, 1.6, 0.14, 0xbfe8f5, 4.2, 3.2, 4.55));
      // buku terbuka di atas tiang di halaman depan — penanda perpustakaan
      g.add(kotak(0.3, 1.6, 0.3, 0x7a4a21, 0, 0.8, 10));
      const b1 = kotak(2.3, 0.14, 1.7, 0xfff7e0, -1.02, 1.86, 10); b1.rotation.z = 0.38; g.add(b1);
      const b2 = kotak(2.3, 0.14, 1.7, 0xfff7e0, 1.02, 1.86, 10); b2.rotation.z = -0.38; g.add(b2);
    },
    balai_warga(g) { // pendopo terbuka: lantai + tiang + atap limas besar, tanpa dinding
      g.add(kotak(18, 0.35, 13, 0xb8a888, 0, 0.175, 0));
      for (const x of [-7.5, 0, 7.5]) for (const z of [-5, 5])
        g.add(kotak(0.45, 4.2, 0.45, 0x8a5a30, x, 2.45, z));
      const atap = new THREE.Mesh(new THREE.ConeGeometry(13.5, 4.2, 4), matAtapWarna(0xd9462e));
      atap.rotation.y = Math.PI / 4; atap.scale.set(1.25, 1, 0.95);
      atap.position.y = 6.65; atap.castShadow = true; g.add(atap);
      g.add(kotak(6, 0.5, 0.8, 0xa9743f, 0, 0.6, -2.5));
      g.add(kotak(6, 0.5, 0.8, 0xa9743f, 0, 0.6, 2.5));
    },
    sekolah(g) {
      g.add(kotak(30, 0.14, 16, 0xd9c58f, 0, 0.07, 0));
      g.add(kotak(22, 5, 9, 0xfdf3d8, 0, 2.64, -2));
      const atap = new THREE.Mesh(geometriAtapPelana(24, 2.6, 11), matAtapWarna(0xc0392b));
      atap.position.set(0, 5.14, -2); atap.castShadow = true; g.add(atap);
      g.add(kotak(2, 3.2, 0.15, 0x7a4a21, 0, 1.74, 2.55));
      for (const x of [-8.5, -4.5, 4.5, 8.5]) g.add(kotak(2.2, 1.8, 0.15, 0xbfe8f5, x, 3.2, 2.55));
      // tiang bendera + bendera Negara Merdu di halaman (?v=25, bukan merah-putih lagi)
      const tiang = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 9, 6), M(0xb0bec5));
      tiang.position.set(8, 4.64, 8); tiang.castShadow = true; g.add(tiang);
      const kainSekolah = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.73),
        new THREE.MeshStandardMaterial({ map: teksturBenderaMerdu(), roughness: 0.9, side: THREE.DoubleSide }));
      kainSekolah.position.set(9.42, 8.27, 8); kainSekolah.castShadow = true; g.add(kainSekolah);
    },
    puskesmas(g) {
      g.add(kotak(24, 0.14, 16, 0xe8e4da, 0, 0.07, 0));
      g.add(kotak(15, 5.5, 9.5, 0xffffff, 0, 2.89, 0));
      g.add(kotak(16.5, 0.4, 11, 0xb0bec5, 0, 5.84, 0));   // atap datar
      g.add(kotak(0.9, 2.8, 0.16, 0xd32f2f, 0, 3.6, 4.83)); // tanda plus merah di wajah depan
      g.add(kotak(2.8, 0.9, 0.16, 0xd32f2f, 0, 3.6, 4.83));
      g.add(kotak(2.2, 3, 0.15, 0x37474f, -3.6, 1.64, 4.8));
      g.add(kotak(2.4, 1.6, 0.15, 0xbfe8f5, 5.6, 3.4, 4.8));
      g.add(kotak(2.4, 1.6, 0.15, 0xbfe8f5, -6.2, 3.4, 4.8));
    },
    pasar(g) {
      g.add(kotak(46, 0.14, 26, 0xc9b18a, 0, 0.07, 0));
      const DINDK = [0xfdf3d8, 0xd6eaf8, 0xfadbd8, 0xd5f5e3];
      const ATAPK = [0xd9462e, 0xe67e22, 0x2f7a63, 0x795548];
      let n = 0;
      for (const z of [-7, 7]) for (const x of [-16.5, -5.5, 5.5, 16.5]) {
        g.add(kotak(8, 3, 6, DINDK[n % 4], x, 1.64, z));
        const atap = new THREE.Mesh(geometriAtapPelana(9.6, 1.8, 7.4), matAtapWarna(ATAPK[n % 4]));
        atap.position.set(x, 3.14, z); atap.castShadow = true; g.add(atap);
        n++;
      }
      const papan = buatPapanNama("PASAR DESA", null);
      papan.position.set(0, 0, 19); g.add(papan);
    },
    masjid(g) {
      g.add(kotak(26, 0.3, 22, 0xd8cfb8, 0, 0.15, 0));
      g.add(kotak(15, 6, 11, 0xf4f1e4, 0, 3.3, 0));
      g.add(kotak(16.5, 0.5, 12.5, 0x2f7a63, 0, 6.55, 0));
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.2, 14), M(0x2f7a63));
      drum.position.y = 7.4; drum.castShadow = true; g.add(drum);
      const kubah = new THREE.Mesh(new THREE.SphereGeometry(3.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xd4ac0d, 0.45));
      kubah.position.y = 8.0; kubah.castShadow = true; g.add(kubah);
      const puncak = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), M(0xd4ac0d, 0.45));
      puncak.position.y = 11.9; g.add(puncak);
      // menara di sudut depan-kanan
      const menara = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 13, 10), M(0xf4f1e4));
      menara.position.set(11.5, 6.8, -6); menara.castShadow = true; g.add(menara);
      const balkon = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.5, 10), M(0x2f7a63));
      balkon.position.set(11.5, 10.6, -6); g.add(balkon);
      const kerucut = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3, 10), M(0x2f7a63));
      kerucut.position.set(11.5, 14.8, -6); kerucut.castShadow = true; g.add(kerucut);
      g.add(kotak(2.4, 3.6, 0.15, 0x2f7a63, 0, 2.1, 5.55)); // pintu
      g.add(kotak(1.6, 2, 0.15, 0xbfe8f5, -4.5, 3.6, 5.55));
      g.add(kotak(1.6, 2, 0.15, 0xbfe8f5, 4.5, 3.6, 5.55));
    },
    /* Toko Pancing (?v=34; dipindah+diperbaiki ?v=35; + kolam ?v=36) —
       bangunan voting warga, BUKAN fasilitas baku: pemenang voting
       Episode 2–3, usulan @drennvanzz_. Blok 1882, tepat di timur Blok
       1881 (cluster warga); menghadap UTARA (-z, ke jalan): papan nama,
       etalase joran, dan kursi pancing semua di sisi utara. Kolam
       pancing (?v=36) di sisi TIMUR blok yang sama, sebelah toko. */
    toko_pancing(g) {
      g.add(kotak(34, 0.14, 26, 0xd9c58f, 0, 0.07, 2));    // alas tanah z -11..15
      g.add(kotak(14, 4.6, 8, 0xf3e9d2, 0, 2.44, 10));     // gedung z 6..14
      const atap = new THREE.Mesh(geometriAtapPelana(16, 2.2, 10), matAtapWarna(0x2f7a63));
      atap.position.set(0, 4.74, 10); atap.castShadow = true; g.add(atap);
      const papan = new THREE.Mesh(new THREE.BoxGeometry(9.5, 1.9, 0.15),
        new THREE.MeshStandardMaterial({ map: teksturPapanTokoPancing(), roughness: 0.9 }));
      papan.position.set(0, 3.55, 5.9); papan.rotation.y = Math.PI; papan.castShadow = true; g.add(papan);
      g.add(kotak(1.8, 3, 0.14, 0x7a4a21, -4.5, 1.64, 5.93)); // pintu (sisi utara)
      g.add(kotak(2, 1.6, 0.14, 0xbfe8f5, 0.8, 2.9, 5.93));   // jendela etalase
      g.add(kotak(2, 1.6, 0.14, 0xbfe8f5, 4.6, 2.9, 5.93));
      // Kanopi TINGGI (?v=35, perbaikan laporan Fahmi): kanopi lama di
      // y 3,02 memotong papan nama secara visual. Kanopi baru datar di
      // y 4,85 (sisi bawah 4,78) — jelas di atas papan nama (puncak
      // 4,50) dan ujung joran etalase (3,41), bertiang di dua sudut
      // depan, tutupan diperpanjang menaungi seluruh etalase + ember.
      g.add(kotak(0.16, 4.78, 0.16, 0x7a4a21, -6.5, 2.39, 2.15)); // tiang kanopi
      g.add(kotak(0.16, 4.78, 0.16, 0x7a4a21, 6.3, 2.39, 2.15));
      g.add(kotak(13.6, 0.14, 4.2, 0xe86a5e, -0.1, 4.85, 3.95)); // slab kanopi x -6,9..6,7 z 1,85..6,05
      g.add(kotak(13.6, 0.24, 0.1, 0xc9503f, -0.1, 4.76, 1.88)); // lis depan kanopi
      // etalase joran: rak + 6 joran berdiri berjajar + reel kecil
      g.add(kotak(0.18, 1.5, 0.18, 0x7a4a21, -1.5, 0.89, 4.3));
      g.add(kotak(0.18, 1.5, 0.18, 0x7a4a21, 5, 0.89, 4.3));
      g.add(kotak(6.8, 0.14, 0.14, 0x7a4a21, 1.75, 1.58, 4.3));
      for (let i = 0; i < 6; i++) {
        const jx = -0.9 + i * 1.15;
        const joran = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.3, 5), M(0x9c6a38));
        joran.position.set(jx, 1.78, 4.3); joran.rotation.z = 0.16; joran.castShadow = true; g.add(joran);
        g.add(kotak(0.16, 0.22, 0.1, 0x37474f, jx + 0.14, 0.95, 4.3)); // reel
      }
      // 2 joran bersandar di dinding dekat pintu
      for (const [lx, miring] of [[-6.4, -0.15], [-5.85, -0.11]]) {
        const sandar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 3.3, 5), M(0x9c6a38));
        sandar.position.set(lx, 1.6, 4.9); sandar.rotation.set(0.3, 0, miring); sandar.castShadow = true; g.add(sandar);
      }
      // ember umpan warna-warni di samping pintu
      for (const [ex, ez, ew] of [[-6.4, 3.4, 0xe86a5e], [-5.45, 4.15, 0xf2b13d], [-6.15, 2.55, 0x57b7d6]]) {
        const ember = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.33, 0.62, 10), M(ew));
        ember.position.set(ex, 0.45, ez); ember.castShadow = true; g.add(ember);
      }
      g.add(kotak(1.7, 0.8, 0.95, 0xffffff, 6.9, 0.54, 3.9));  // kotak es
      g.add(kotak(1.8, 0.16, 1.05, 0x57b7d6, 6.9, 1.02, 3.9)); // tutup kotak es
      const papanHarga = buatPapanNama("HARGA UMPAN", "Rp5.000 / cup");
      papanHarga.scale.setScalar(0.62);
      papanHarga.position.set(9.8, 0.14, 1.2); papanHarga.rotation.y = Math.PI - 0.3; g.add(papanHarga);
      // papan owner di halaman utara
      const papanOwner = new THREE.Group();
      papanOwner.add(kotak(0.2, 2.2, 0.2, 0x7a4a21, -3.2, 1.1, 0));
      papanOwner.add(kotak(0.2, 2.2, 0.2, 0x7a4a21, 3.2, 1.1, 0));
      const panelOwner = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.7, 0.16),
        new THREE.MeshStandardMaterial({ map: teksturPapanNama("Owner: @drennvanzz_", null), roughness: 0.9 }));
      panelOwner.position.set(0, 1.8, 0); panelOwner.castShadow = true; papanOwner.add(panelOwner);
      papanOwner.position.set(-11, 0, -3); papanOwner.rotation.y = Math.PI + 0.25; g.add(papanOwner);
      // payung + kursi di sisi barat
      const tiangPayung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), M(0x7a4a21));
      tiangPayung.position.set(-8.5, 1.44, -6); g.add(tiangPayung);
      const payung = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.75, 8), M(0xe86a5e));
      payung.position.set(-8.5, 2.85, -6); payung.castShadow = true; g.add(payung);
      // kursi pancing berjajar di tepi utara, menghadap jalan (-z)
      function kursiPancing(x, z) {
        const k = new THREE.Group();
        k.add(kotak(0.95, 0.1, 0.85, 0x2f7a63, 0, 0.55, 0));
        k.add(kotak(0.95, 0.95, 0.1, 0x2f7a63, 0, 1.02, 0.44));
        k.add(kotak(0.09, 0.55, 0.8, 0x7a4a21, -0.4, 0.27, 0));
        k.add(kotak(0.09, 0.55, 0.8, 0x7a4a21, 0.4, 0.27, 0));
        const j = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.0, 5), M(0x9c6a38));
        j.position.set(0.78, 1.3, -0.55); j.rotation.set(-0.5, 0, 0.1); j.castShadow = true; k.add(j);
        k.position.set(x, 0, z);
        return k;
      }
      g.add(kursiPancing(-4, -17));
      g.add(kursiPancing(0.5, -18.5));
      g.add(kursiPancing(5, -17));
      const emberKursi = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.33, 0.62, 10), M(0xf2b13d));
      emberKursi.position.set(1.9, 0.31, -18.2); emberKursi.castShadow = true; g.add(emberKursi);
      /* ===== KOLAM PANCING (?v=36) — sisi TIMUR blok yang sama (Blok
         1882), persis di sebelah toko. SEMUA di dalam blok ini saja
         (perintah Fahmi "1 blok aja"): elemen terluar = cakram pasir
         x 15,8..33,8 / z -12,9..12,9, interior blok ±35. Pola air
         mengikuti danau besar & danau taman: cakram pasir 0xd9c58f di
         bawah, air lingkaran lonjong 0x57b7d6 di atasnya, kilau
         matahari 0,35 di atas air. ===== */
      const KX = 24.8; // pusat kolam lokal (x timur, z 0)
      const pasirKolam = new THREE.Mesh(new THREE.CircleGeometry(1, 30),
        new THREE.MeshStandardMaterial({ color: 0xd9c58f, roughness: 1, flatShading: true }));
      pasirKolam.rotation.x = -Math.PI / 2; pasirKolam.scale.set(9.0, 12.9, 1);
      pasirKolam.position.set(KX, 0.04, 0); g.add(pasirKolam);
      const airKolam = new THREE.Mesh(new THREE.CircleGeometry(1, 30),
        new THREE.MeshStandardMaterial({ color: 0x57b7d6, roughness: 0.18, flatShading: true }));
      airKolam.rotation.x = -Math.PI / 2; airKolam.scale.set(7.6, 10.6, 1);
      airKolam.position.set(KX, 0.10, 0); g.add(airKolam);
      const kilauKolam = new THREE.Mesh(new THREE.PlaneGeometry(9, 6),
        new THREE.MeshBasicMaterial({ map: TEX_KILAU, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
      kilauKolam.rotation.x = -Math.PI / 2; kilauKolam.position.set(KX - 1.8, 0.45, -1.5); g.add(kilauKolam);
      // dermaga kayu dari tepi barat kolam menjorok ke air. Bisa
      // dinaiki/dilewati: puncak dek 0,34 (pola pelataran istana) dan
      // TANPA AABB — tabrakan air menyisakan koridor z -1,7..1,7 di
      // atas dermaga s/d x 23,2 (lihat TAPAK_FASILITAS.toko_pancing).
      g.add(kotak(6.8, 0.16, 2.4, 0xa9743f, 19.2, 0.26, 0));      // dek dermaga x 15,8..22,6
      g.add(kotak(6.8, 0.12, 0.18, 0x8a5a30, 19.2, 0.2, -1.16));  // balok sisi dermaga
      g.add(kotak(6.8, 0.12, 0.18, 0x8a5a30, 19.2, 0.2, 1.16));
      for (const [px, pz] of [[16.2, -1.0], [16.2, 1.0], [19.2, -1.0], [19.2, 1.0], [22.3, -1.0], [22.3, 1.0]]) {
        const tiangD = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 6), M(0x7a4a21));
        tiangD.position.set(px, 0.02, pz); tiangD.castShadow = true; g.add(tiangD);
      }
      // titik mancing di ujung dermaga: 2 joran condong ke air + ember
      const emberDermaga = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.33, 0.62, 10), M(0x57b7d6));
      emberDermaga.position.set(21.6, 0.65, 0.78); emberDermaga.castShadow = true; g.add(emberDermaga);
      for (const jz of [-0.72, 0.05]) {
        const j = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 3.1, 5), M(0x9c6a38));
        j.position.set(22.75, 1.05, jz); j.rotation.z = -0.85; j.castShadow = true; g.add(j);
      }
      // titik mancing di tepi kolam: kursi menghadap air (barat +x, selatan -z)
      const kpB1 = kursiPancing(16.2, -4.6); kpB1.rotation.y = -Math.PI / 2; g.add(kpB1);
      const kpB2 = kursiPancing(16.4, 6.2); kpB2.rotation.y = -Math.PI / 2; g.add(kpB2);
      g.add(kursiPancing(24.8, 13.9));
      // papan kecil KOLAM PANCING di tepi barat kolam, dekat dermaga
      const papanKolam = buatPapanNama("KOLAM PANCING", null);
      papanKolam.scale.setScalar(0.62);
      papanKolam.position.set(13.2, 0, -5.6); papanKolam.rotation.y = Math.PI - 0.35; g.add(papanKolam);
      // batu tepi kolam
      for (const [bx, bz, br] of [[18.3, -8.2, 0.55], [31.5, -8.8, 0.45], [33.0, 3.5, 0.6], [20.5, 11.6, 0.5], [28.5, 12.1, 0.4], [18.0, 6.8, 0.42]]) {
        const batu = new THREE.Mesh(new THREE.IcosahedronGeometry(br, 0), M(0x9e9e9e));
        batu.position.set(bx, br * 0.45, bz); batu.scale.y = 0.62; batu.castShadow = true; g.add(batu);
      }
      // ilalang di bibir kolam
      function ilalang(x, z) {
        const il = new THREE.Group();
        for (const [ox, oz, tj] of [[0, 0, 0.95], [0.28, 0.12, 0.75], [-0.24, 0.16, 0.8]]) {
          const daunIl = new THREE.Mesh(new THREE.ConeGeometry(0.13, tj, 5), M(0x5da24a));
          daunIl.position.set(ox, tj / 2, oz); daunIl.rotation.z = ox * 0.5; il.add(daunIl);
        }
        il.position.set(x, 0, z);
        return il;
      }
      g.add(ilalang(19.5, -10.2)); g.add(ilalang(30.6, -10.4)); g.add(ilalang(33.2, -2.6));
      g.add(ilalang(21.8, -12.4)); g.add(ilalang(29.8, 10.4)); g.add(ilalang(18.6, 9.8));
      g.add(pohonKecil(15, -12, 0.9));
      g.add(pohonKecil(-15.5, -13, 1.05));
    },
  };
  function bangunLahanPembangunan() {
    const grup = new THREE.Group();
    const parks = [...TAMAN].map((k) => k.split(",").map(Number));
    const dummy = new THREE.Object3D();
    // alas petak — geometri & posisi sama seperti alas taman lama
    const alas = new THREE.InstancedMesh(new THREE.BoxGeometry(68, 0.25, 68),
      new THREE.MeshStandardMaterial({ color: 0x57a047, roughness: 1, flatShading: true }), parks.length); // alas lahan 0x69b45c -> 0x57a047 (samakan pendalaman rumput)
    parks.forEach(([kol, bar], i) => {
      const c = pusatBlok(kol, bar);
      dummy.position.set(c.x, 0.12, c.z);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      alas.setMatrixAt(i, dummy.matrix);
    });
    alas.instanceMatrix.needsUpdate = true;
    grup.add(alas);
    // status fasilitas dari server (dibaca di ambilData saat muat)
    const status = {};
    for (const f of dataPembangunan) status[f.kunci] = f;
    const lahanFasilitas = {}; // "kol,bar" -> kunci fasilitas
    for (const kunci in FASILITAS_BLOK) {
      const b = FASILITAS_BLOK[kunci];
      lahanFasilitas[b.kol + "," + b.bar] = kunci;
    }
    const sudahBerdiri = (kunci) => !!(status[kunci] && status[kunci].status === "terbangun");
    // pagar keliling semua petak (1 InstancedMesh); pagar lahan fasilitas
    // yang SUDAH terbangun dilipat (skala 0) — bangunannya menggantikannya.
    const imPagar = new THREE.InstancedMesh(geometriPagarBlok(),
      new THREE.MeshStandardMaterial({ color: 0x9c6a38, roughness: 1, flatShading: true }), parks.length);
    parks.forEach(([kol, bar], i) => {
      const c = pusatBlok(kol, bar);
      const kunci = lahanFasilitas[kol + "," + bar];
      dummy.position.set(c.x, 0.245, c.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(kunci && sudahBerdiri(kunci) ? 0 : 1);
      dummy.updateMatrix(); imPagar.setMatrixAt(i, dummy.matrix);
    });
    imPagar.instanceMatrix.needsUpdate = true; imPagar.frustumCulled = false;
    grup.add(imPagar);
    // papan generik "LAHAN PEMBANGUNAN" untuk petak non-fasilitas (instanced:
    // tiang & panel masing-masing 1 InstancedMesh, panel bertekstur bersama)
    const umum = parks.filter(([kol, bar]) => !lahanFasilitas[kol + "," + bar]);
    const geoTiangPapan = gabungGeometri([
      { geo: new THREE.BoxGeometry(0.24, 3.0, 0.24), x: -4.4, y: 1.5, z: 0 },
      { geo: new THREE.BoxGeometry(0.24, 3.0, 0.24), x: 4.4, y: 1.5, z: 0 },
    ]);
    const imTiang = new THREE.InstancedMesh(geoTiangPapan,
      new THREE.MeshStandardMaterial({ color: 0x7a4a21, roughness: 1, flatShading: true }), Math.max(1, umum.length));
    const imPanel = new THREE.InstancedMesh(new THREE.BoxGeometry(11, 3.2, 0.18),
      new THREE.MeshStandardMaterial({ map: teksturPapanNama("LAHAN PEMBANGUNAN", "Menunggu usulan warga"), roughness: 0.9 }), Math.max(1, umum.length));
    umum.forEach(([kol, bar], i) => {
      const c = pusatBlok(kol, bar);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(c.x, 0.245, c.z + 27); dummy.updateMatrix(); imTiang.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 0.245 + 2.9; dummy.updateMatrix(); imPanel.setMatrixAt(i, dummy.matrix);
    });
    imTiang.count = umum.length; imPanel.count = umum.length;
    imTiang.instanceMatrix.needsUpdate = true; imPanel.instanceMatrix.needsUpdate = true;
    imTiang.frustumCulled = false; imPanel.frustumCulled = false;
    grup.add(imTiang); grup.add(imPanel);
    // 8 lahan fasilitas: yang terbangun berdiri modelnya; yang belum
    // berpapan nama fasilitasnya.
    const modelFasilitas = {}, papanFasilitas = {};
    for (const kunci in FASILITAS_BLOK) {
      const b = FASILITAS_BLOK[kunci];
      const c = pusatBlok(b.kol, b.bar);
      if (sudahBerdiri(kunci)) {
        const g = new THREE.Group();
        g.position.set(c.x, 0.245, c.z);
        g.userData.fasilitas = kunci;
        MODEL_FASILITAS[kunci](g);
        grup.add(g); modelFasilitas[kunci] = g;
        // tabrakan bangunan fasilitas: AABB dunia dari tapak relatif pusat blok
        for (const t of TAPAK_FASILITAS[kunci] || []) {
          rintanganFasilitas.push({ minX: c.x + t[0], minZ: c.z + t[1], maxX: c.x + t[2], maxZ: c.z + t[3] });
        }
      } else {
        const nama = (status[kunci] && status[kunci].nama) || FASILITAS_NAMA[kunci] || kunci;
        const papan = buatPapanNama(nama, "LAHAN PEMBANGUNAN");
        papan.position.set(c.x, 0.245, c.z + 27);
        papan.userData.papanFasilitas = kunci;
        grup.add(papan); papanFasilitas[kunci] = papan;
      }
    }
    /* Properti lokasi proyek (Paket 2 ?v=15): lahan fasilitas yang BELUM
       terbangun bukan lagi petak kosong polos — ada tumpukan bata,
       tumpukan kayu, karung material, dan pagar proyek, supaya terbaca
       sebagai lokasi yang MENUNGGU dibangun. Semua instanced (4
       InstancedMesh bersama untuk semua lahan), geometri gabungan
       primitif. Tumpukan bata & kayu DITABRAK (AABB kecil masuk
       rintanganFasilitas) supaya pemain tidak berjalan menembus
       tumpukan; karung & pagar proyek hiasan tepi tanpa tabrakan.
       Lahan yang sudah terbangun tidak diberi properti ini. */
    const belumDibangun = Object.keys(FASILITAS_BLOK).filter((kunci) => !sudahBerdiri(kunci));
    let proyek = null;
    if (belumDibangun.length) {
      const bataSatu = () => new THREE.BoxGeometry(1.3, 0.42, 0.65);
      const bagianBata = [];
      for (const [bx, bz] of [[-1.35, -0.36], [0, -0.36], [1.35, -0.36], [-1.35, 0.36], [0, 0.36], [1.35, 0.36]])
        bagianBata.push({ geo: bataSatu(), x: bx, y: 0.21, z: bz });
      for (const [bx, bz] of [[-0.68, -0.36], [0.68, -0.36], [-0.68, 0.36], [0.68, 0.36]])
        bagianBata.push({ geo: bataSatu(), x: bx, y: 0.63, z: bz });
      bagianBata.push({ geo: bataSatu(), x: 0, y: 1.05, z: 0 });
      const geoKayuSatu = () => { const g = new THREE.CylinderGeometry(0.16, 0.16, 4.6, 7); return g; };
      const bagianKayu = [];
      for (const kz of [-0.34, 0, 0.34]) bagianKayu.push({ geo: geoKayuSatu(), x: 0, y: 0.16, z: kz, rz: Math.PI / 2 });
      for (const kz of [-0.17, 0.17]) bagianKayu.push({ geo: geoKayuSatu(), x: 0, y: 0.45, z: kz, rz: Math.PI / 2 });
      const karungSatu = () => new THREE.IcosahedronGeometry(0.55, 0);
      const bagianKarung = [
        { geo: karungSatu(), x: 0, y: 0.4, z: 0, sy: 0.72 },
        { geo: karungSatu(), x: 0.85, y: 0.38, z: 0.3, sy: 0.7 },
        { geo: karungSatu(), x: 0.38, y: 0.92, z: 0.08, sy: 0.68 },
      ];
      const bagianPagarP = [];
      for (let px = -9; px <= 9; px += 3) bagianPagarP.push({ geo: new THREE.BoxGeometry(0.18, 1.5, 0.18), x: px, y: 0.75, z: 0 });
      bagianPagarP.push({ geo: new THREE.BoxGeometry(18.4, 0.34, 0.06), x: 0, y: 1.05, z: 0 });
      bagianPagarP.push({ geo: new THREE.BoxGeometry(18.4, 0.34, 0.06), x: 0, y: 0.5, z: 0 });
      const n = belumDibangun.length;
      const imBata = new THREE.InstancedMesh(gabungGeometri(bagianBata),
        new THREE.MeshStandardMaterial({ color: 0xb5533c, roughness: 1, flatShading: true }), n);
      const imKayu = new THREE.InstancedMesh(gabungGeometri(bagianKayu),
        new THREE.MeshStandardMaterial({ color: 0x9c6a38, roughness: 1, flatShading: true }), n);
      const imKarung = new THREE.InstancedMesh(gabungGeometri(bagianKarung),
        new THREE.MeshStandardMaterial({ color: 0xb59a6a, roughness: 1, flatShading: true }), n);
      const imPagarP = new THREE.InstancedMesh(gabungGeometri(bagianPagarP),
        new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1, flatShading: true }), n);
      belumDibangun.forEach((kunci, i) => {
        const b = FASILITAS_BLOK[kunci];
        const c = pusatBlok(b.kol, b.bar);
        const rot = hashInt(i * 31 + 7) * 0.6 - 0.3;
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, rot, 0); dummy.position.set(c.x + 13, 0.245, c.z + 9); dummy.updateMatrix();
        imBata.setMatrixAt(i, dummy.matrix);
        rintanganFasilitas.push({ minX: c.x + 13 - 2.1, maxX: c.x + 13 + 2.1, minZ: c.z + 9 - 1, maxZ: c.z + 9 + 1 });
        dummy.rotation.set(0, rot + 0.4, 0); dummy.position.set(c.x - 14, 0.245, c.z + 7); dummy.updateMatrix();
        imKayu.setMatrixAt(i, dummy.matrix);
        rintanganFasilitas.push({ minX: c.x - 14 - 2.5, maxX: c.x - 14 + 2.5, minZ: c.z + 7 - 0.8, maxZ: c.z + 7 + 0.8 });
        dummy.rotation.set(0, rot, 0); dummy.position.set(c.x + 9, 0.245, c.z - 13); dummy.updateMatrix();
        imKarung.setMatrixAt(i, dummy.matrix);
        dummy.rotation.set(0, 0, 0); dummy.position.set(c.x - 6, 0.245, c.z + 23); dummy.updateMatrix();
        imPagarP.setMatrixAt(i, dummy.matrix);
      });
      for (const im of [imBata, imKayu, imKarung, imPagarP]) {
        im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.castShadow = true;
        grup.add(im);
      }
      proyek = { imBata, imKayu, imKarung, imPagarP };
    }
    // danau di taman terdekat pusat (kol 36, bar 28) — dipertahankan dari
    // taman lama: air alam di tengah lahan kosong, bukan bangunan.
    const s = sudutBlok(36, 28);
    const danau = new THREE.Mesh(new THREE.CircleGeometry(24, 26),
      new THREE.MeshStandardMaterial({ color: 0x57b7d6, roughness: 0.18, flatShading: true }));
    danau.rotation.x = -Math.PI / 2;
    // AUDIT Z-FIGHTING: diangkat 0,30 -> 0,52 (selisih vs permukaan alas taman 0,245 jadi 0,275)
    danau.position.set(s.x + PITCH / 2 + JALAN / 2, 0.52, s.z + PITCH / 2 + JALAN / 2);
    grup.add(danau);
    tambahKilau(s.x + PITCH / 2 + JALAN / 2 - 6, s.z + PITCH / 2 + JALAN / 2 - 4, 0.87, 30, 15, 0.5); // kilau 0,35 di atas air
    scene.add(grup);
    window.__lahan = grup; // kait uji harness scene (pola sama seperti __kotaMassal)
    window.__proyek = proyek; // kait uji harness: InstancedMesh properti proyek (?v=15)
    return { grup, modelFasilitas, papanFasilitas, imPagarBlok: imPagar, proyek };
  }

  /* ---------- Distrik pinggiran: sawah, danau besar, hutan (penanda luas area) ----------
     Semua murah: sawah/danau = beberapa plane/circle besar, hutan = 2 InstancedMesh.
     Posisi acak semu deterministik (hashInt), tanpa Math.random. */
  (function pinggiranKota() {
    const SETENGAH_W = KOTA_W / 2, SETENGAH_D = KOTA_D / 2;
    // hamparan tanah luas di bawah segalanya supaya pinggiran tidak kosong.
    // AUDIT Z-FIGHTING: diturunkan jadi step jelas di bawah plane kota (y=0 -> -0,30)
    // + polygonOffset, karena plane ini tumpang tindih penuh dengan tanah kota & sawah.
    const hamparan = new THREE.Mesh(new THREE.PlaneGeometry(KOTA_W + 3200, KOTA_D + 3200),
      new THREE.MeshStandardMaterial({ color: 0x63ac4e, roughness: 1, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })); // hamparan 0x74b364 -> 0x63ac4e (samakan rumput kota)
    hamparan.rotation.x = -Math.PI / 2; hamparan.position.y = -0.3; hamparan.receiveShadow = true;
    scene.add(hamparan);
    // sawah: tekstur petak-petak prosedural (buatKanvasSawah), diulang di 4 sisi kota
    const texSawah = buatTeksturProsedural(buatKanvasSawah);
    texSawah.wrapS = texSawah.wrapT = THREE.RepeatWrapping;
    function petakSawah(w, d, x, z, ulangX, ulangZ) {
      const t = texSawah.clone(); t.needsUpdate = true; t.repeat.set(ulangX, ulangZ);
      REG_TEX.push({ tex: t, buat: buatKanvasSawah }); // klon ikut digambar ulang saat skala tekstur berubah
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.receiveShadow = true; scene.add(m);
    }
    const LEBAR_SAWAH = 540;
    petakSawah(KOTA_W + 2 * LEBAR_SAWAH, LEBAR_SAWAH, 0, -SETENGAH_D - LEBAR_SAWAH / 2, 26, 3); // utara
    petakSawah(KOTA_W + 2 * LEBAR_SAWAH, LEBAR_SAWAH, 0, SETENGAH_D + LEBAR_SAWAH / 2, 26, 3);  // selatan
    petakSawah(LEBAR_SAWAH, KOTA_D, -SETENGAH_W - LEBAR_SAWAH / 2, 0, 3, 20);                  // barat
    petakSawah(LEBAR_SAWAH, KOTA_D, SETENGAH_W + LEBAR_SAWAH / 2, 0, 3, 20);                   // timur
    // danau besar di luar band sawah
    const DANAU_BESAR = [
      { x: SETENGAH_W + 980, z: SETENGAH_D + 700, r: 300 },
      { x: -SETENGAH_W - 880, z: -SETENGAH_D - 620, r: 215 },
    ];
    for (const d of DANAU_BESAR) {
      const air = new THREE.Mesh(new THREE.CircleGeometry(d.r, 36),
        new THREE.MeshStandardMaterial({ color: 0x57b7d6, roughness: 0.18, flatShading: true }));
      air.rotation.x = -Math.PI / 2; air.position.set(d.x, 0.1, d.z); scene.add(air);
      const pasir = new THREE.Mesh(new THREE.RingGeometry(d.r, d.r + 26, 36),
        new THREE.MeshStandardMaterial({ color: 0xd9c58f, roughness: 1 }));
      pasir.rotation.x = -Math.PI / 2; pasir.position.set(d.x, 0.04, d.z); scene.add(pasir);
      tambahKilau(d.x - d.r * 0.25, d.z - d.r * 0.15, 0.45, d.r * 1.15, d.r * 0.55, 0.55); // kilau 0,35 di atas air (0,10)
    }
    // hutan: sabuk pohon instanced di utara & selatan, di luar sawah
    const JUMLAH_POHON = 1100;
    const imBatang = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 1, flatShading: true }), JUMLAH_POHON);
    const imDaun = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.4, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), JUMLAH_POHON);
    const dummy = new THREE.Object3D(); const warna = new THREE.Color();
    for (let i = 0; i < JUMLAH_POHON; i++) {
      const h1 = hashInt(i * 3 + 11), h2 = hashInt(i * 7 + 41), h3 = hashInt(i * 13 + 7);
      const utara = i % 2 === 0;
      let x = -SETENGAH_W - 1000 + h1 * (KOTA_W + 2000);
      let z = (utara ? -1 : 1) * (SETENGAH_D + 620 + h2 * 620);
      for (const d of DANAU_BESAR) { // jangan tanam pohon di danau
        const jauh = Math.hypot(x - d.x, z - d.z);
        if (jauh < d.r + 40) { x += (x < d.x ? -1 : 1) * (d.r + 60 - jauh); }
      }
      const sc = 1.5 + h3 * 1.5;
      dummy.rotation.set(0, h1 * Math.PI, 0); dummy.scale.set(sc, sc, sc);
      dummy.position.set(x, 1.6 * sc - 0.3, z); dummy.updateMatrix(); imBatang.setMatrixAt(i, dummy.matrix); // -0,3: kaki pohon menapak di hamparan baru (y=-0,3)
      dummy.position.y = (3.2 + 2.2) * sc - 0.3; dummy.updateMatrix(); imDaun.setMatrixAt(i, dummy.matrix);
      imDaun.setColorAt(i, warna.setHex([0x3f9e4d, 0x2e7d46, 0x4da653][Math.floor(h3 * 3)]));
    }
    imDaun.castShadow = true;
    scene.add(imBatang); scene.add(imDaun);
  })();

  /* ---------- Label & karakter (dipakai distrik detail) ---------- */
  function buatLabel(teks, besar, jabatan) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = jabatan ? 176 : 128;
    const c = cv.getContext("2d");
    c.fillStyle = "rgba(255,251,240,0.92)";
    c.beginPath();
    if (c.roundRect) c.roundRect(56, 22, 400, jabatan ? 132 : 84, 44); else c.rect(56, 22, 400, jabatan ? 132 : 84);
    c.fill();
    c.fillStyle = "#21332a"; c.font = "bold 46px system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(teks, 256, jabatan ? 60 : 66, 380);
    if (jabatan) { // baris kecil jabatan aktif hasil pemilu, mis. "Presiden"
      c.fillStyle = "#9a6b00"; c.font = "bold 36px system-ui, sans-serif";
      c.fillText(jabatan, 256, 116, 380);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(besar || 3.6, (besar || 3.6) * cv.height / 512, 1);
    return sp;
  }
  /* ---------- Karakter low-poly (dipakai warga, pemain lain, diri
     sendiri di 3rd Person, dan Pak Presiden) ----------
     Model prosedural dari geometri dasar. RONDE 2 (mengejar referensi
     Pak Presiden low-poly): kepala BERFASET nyata (ikosahedron detail 1 +
     flatShading dari M) bukan bola mulus, dan wajah lengkap — mata
     besar terbuka (putih + pupil + highlight), alis, hidung, telinga,
     senyum busur, pipi merona. Proporsi chibi ringan: kepala ±1,33x
     lebih besar, torso diperpendek; tinggi total dijaga ± sama.
     Kaki bercelana + sepatu berujung ke depan, torso meruncing ke
     pinggang, lengan bersegmen (atas berbaju + bawah berkulit)
     berpivot di bahu, rambut/peci/topi mengikuti data penampilan.
     Muka di sisi +z lokal (konvensi hadap yang sama dengan rotasi
     pemain).
     Pivot animasi TIDAK berubah kontraknya: kaki berpivot di pinggul
     dan lengan di bahu, ayunan dari animasiJalan; telapak sepatu tepat
     menyentuh y=0 saat diam sehingga karakter tidak melayang.
     Kinerja: geometri & material DIBAGI antar semua karakter lewat
     cache di bawah (penampilan warga berasal dari palet terbatas, jadi
     cache-nya efektif). Sumber bersama dicatat di SUMBER_BERSAMA agar
     buangGrup tidak membuangnya saat satu karakter dihapus. */
  const SUMBER_BERSAMA = new Set();
  /* ---------- Bentuk kepala stylized (ronde skill-3d) ----------
     Pelajaran character-artist + img2threejs (head construction):
     proporsi ditetapkan SEBELUM detail, fitur wajah didudukkan pada
     permukaan dengan rumus — bukan ditebak. Kepala referensi Pak
     Kades: pipi lebar, rahang menyempit ke dagu, ubun-ubun agak rata,
     mata besar (putih ±0,20 lebar kepala), senyum lebar bergigi.
     taperKepala(t) MURNI: t = tinggi ternormalisasi (-1..1); dipakai
     bentukKepala() untuk membentuk geometri DAN mukaZ() untuk
     mendudukkan fitur — keduanya tidak pernah berpisah. */
  function taperKepala(t) {
    if (t < 0) return 1 - 0.22 * Math.pow(-t, 1.6); // rahang -> dagu menyempit
    return 1 - 0.05 * t * t;                        // ubun-ubun sedikit rata
  }
  function bentukKepala(geo) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const t = v.y / 0.44, f = taperKepala(t);
      const rata = t > 0.55 ? 1 - 0.06 * (t - 0.55) / 0.45 : 1; // mahkota dipipihkan halus
      p.setXYZ(i, v.x * f * 1.04, v.y * rata, v.z * f);
    }
    geo.computeVertexNormals();
    return geo;
  }
  // Jari-jari efektif kepala sesudah bentuk + skala mesh (1, 1, 0,92).
  const RK = { x: 0.4576, y: 0.44, z: 0.4048 };
  function mukaZ(x, y) { // z permukaan wajah pada (x, y) relatif pusat kepala
    const q = 1 - (x * x) / (RK.x * RK.x) - (y * y) / (RK.y * RK.y);
    return RK.z * Math.sqrt(Math.max(0.02, q)) * taperKepala(y / RK.y);
  }
  let GEO_KARAKTER = null;
  function geoKarakter() {
    if (GEO_KARAKTER) return GEO_KARAKTER;
    const def = {
      celana: new THREE.CylinderGeometry(0.105, 0.088, 0.42, 6),
      lipatCelana: new THREE.CylinderGeometry(0.112, 0.118, 0.09, 6),
      sepatu: new THREE.BoxGeometry(0.2, 0.1, 0.27),
      solSepatu: new THREE.BoxGeometry(0.22, 0.04, 0.3),
      badan: new THREE.CylinderGeometry(0.35, 0.27, 0.62, 8),
      kerah: new THREE.CylinderGeometry(0.3, 0.345, 0.11, 8),
      plaket: new THREE.BoxGeometry(0.1, 0.46, 0.03),
      kancing: new THREE.SphereGeometry(0.021, 6, 5),
      lenganAtas: new THREE.CylinderGeometry(0.078, 0.066, 0.34, 6),
      lenganBawah: new THREE.CylinderGeometry(0.06, 0.052, 0.3, 6),
      tangan: new THREE.SphereGeometry(0.068, 6, 5),
      kepala: bentukKepala(new THREE.IcosahedronGeometry(0.44, 1)),
      mataPutih: new THREE.SphereGeometry(0.088, 8, 6),
      pupil: new THREE.SphereGeometry(0.052, 7, 5),
      highlight: new THREE.SphereGeometry(0.02, 6, 4),
      alis: new THREE.BoxGeometry(0.19, 0.05, 0.035),
      hidung: new THREE.ConeGeometry(0.068, 0.15, 7),
      telinga: new THREE.SphereGeometry(0.095, 6, 5),
      mulut: new THREE.TorusGeometry(0.125, 0.02, 5, 10, Math.PI),
      gigi: new THREE.TorusGeometry(0.092, 0.015, 5, 10, Math.PI),
      pipi: new THREE.CircleGeometry(0.07, 9),
      bahu: new THREE.SphereGeometry(0.115, 7, 5),
      kerahDepan: new THREE.BoxGeometry(0.1, 0.17, 0.025),
      manset: new THREE.CylinderGeometry(0.068, 0.072, 0.08, 6),
      rambut: new THREE.SphereGeometry(0.458, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.42),
      peci: new THREE.CylinderGeometry(0.345, 0.39, 0.3, 9),
      peciSabuk: new THREE.CylinderGeometry(0.398, 0.408, 0.07, 9),
      peciAtas: new THREE.SphereGeometry(0.345, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      topiAtas: new THREE.SphereGeometry(0.462, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.35),
      topiLidah: new THREE.BoxGeometry(0.38, 0.045, 0.26),
    };
    for (const k in def) SUMBER_BERSAMA.add(def[k]);
    GEO_KARAKTER = def;
    return def;
  }
  const CACHE_MAT_KARAKTER = new Map();
  function matKarakter(warna) {
    let m = CACHE_MAT_KARAKTER.get(warna);
    if (!m) { m = M(warna); CACHE_MAT_KARAKTER.set(warna, m); SUMBER_BERSAMA.add(m); }
    return m;
  }
  // Warna celana & topi diturunkan deterministik dari warna baju (hash
  // sederhana) — tanpa mengubah skema data server, dan semua klien
  // menghitung hasil yang sama untuk warga yang sama.
  function hashWarna(teks) {
    let h = 0;
    for (let i = 0; i < teks.length; i++) h = (h * 31 + teks.charCodeAt(i)) >>> 0;
    return h;
  }
  const PALET_CELANA = [0x37474f, 0x2e4053, 0x4e342e, 0x556052, 0x3e3a34];
  const PALET_TOPI = [0xd95f43, 0x3f6fb5, 0xe8c268, 0x43a06a];
  function warnaCelana(bajuHex) { return PALET_CELANA[hashWarna(bajuHex || "") % PALET_CELANA.length]; }
  function warnaTopi(bajuHex) { return PALET_TOPI[(hashWarna(bajuHex || "") + 2) % PALET_TOPI.length]; }
  function warnaSkala(hex, faktor) { // terang/gelapkan warna hex (kerah lebih gelap, lipat celana lebih terang, dsb.)
    const c = new THREE.Color(hex);
    c.multiplyScalar(faktor);
    return c.getHex();
  }

  function buatKarakter(opsi) {
    const GEO = geoKarakter();
    const g = new THREE.Group();
    const kulit = parseInt((opsi.kulit || "#f1c27d").slice(1), 16);
    const bajuHex = opsi.baju || "#2e9e5b";
    const baju = parseInt(bajuHex.slice(1), 16);
    const celana = warnaCelana(bajuHex);
    const matKulit = matKarakter(kulit), matBaju = matKarakter(baju), matCelana = matKarakter(celana);
    function bagian(geo, mat, x, y, z, bayangan) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = !!bayangan;
      return m;
    }
    // Kaki: pivot di pinggul y=0,52; celana turun 0,42 lalu sepatu
    // 0,10 dengan ujung menjorok ke +z (arah hadap). Bawah sepatu
    // tepat y=0 saat diam. Ronde 3: ujung celana berlipat (silinder
    // sedikit lebih lebar, warna celana lebih terang) dan sepatu
    // bersol terang yang menjorok sebagai bibir sol di dasar sepatu.
    const matLipat = matKarakter(warnaSkala(celana, 1.35));
    const matSol = matKarakter(0xd9d0bd);
    function buatKaki(sx) {
      const kaki = new THREE.Group(); kaki.position.set(sx, 0.52, 0);
      kaki.add(bagian(GEO.celana, matCelana, 0, -0.21, 0, true));
      kaki.add(bagian(GEO.lipatCelana, matLipat, 0, -0.375, 0, false));
      kaki.add(bagian(GEO.sepatu, matKarakter(0x33302c), 0, -0.47, 0.025, false));
      kaki.add(bagian(GEO.solSepatu, matSol, 0, -0.5, 0.03, false));
      return kaki;
    }
    const kakiK = buatKaki(-0.16), kakiR = buatKaki(0.16);
    g.add(kakiK); g.add(kakiR);
    // Torso meruncing (bahu 0,35 -> pinggang 0,27), dipipihkan di z
    // supaya tidak bulat seperti tabung. Diperpendek 0,74 -> 0,62
    // (ronde 2) supaya proporsi bergeser chibi ringan mengimbangi
    // kepala yang lebih besar. Sabuk ronde 1 dilepas: dengan torso
    // pendek + kemeja tak dimasukkan, sabuk tak terbaca lagi.
    const badan = bagian(GEO.badan, matBaju, 0, 0.85, 0, true);
    badan.scale.z = 0.8; g.add(badan);
    // Detail pakaian ronde 3: kerah cincin di leher torso (warna baju
    // lebih gelap, dipipihkan z sama seperti torso), plaket kancing di
    // dada yang menempel mengikuti kemiringan torso (rotasi x 0,10 =
    // kemiringan permukaan depan), dan 3 kancing di garis plaket —
    // posisi z kancing dihitung dari jari-jari torso pada tingginya.
    const kerah = bagian(GEO.kerah, matKarakter(warnaSkala(baju, 0.72)), 0, 1.135, 0, false);
    kerah.scale.z = 0.8; g.add(kerah);
    // Ronde skill-3d (character-artist: pakaian = bentuk terpisah):
    // bantalan bahu menutup celah torso-lengan (siluet bahu bersih)
    // dan dua lidah kerah runcing di dada meniru kerah kemeja pada
    // referensi Pak Presiden.
    const matKerahGelap = matKarakter(warnaSkala(baju, 0.72));
    for (const s of [-1, 1]) {
      const bahu = bagian(GEO.bahu, matBaju, s * 0.40, 1.13, 0, false);
      bahu.scale.set(1, 0.92, 0.8); g.add(bahu);
      const lidah = bagian(GEO.kerahDepan, matKerahGelap, s * 0.088, 1.10, 0.272, false);
      lidah.rotation.set(0.10, 0, -s * 0.45); g.add(lidah);
    }
    const plaket = bagian(GEO.plaket, matKarakter(warnaSkala(baju, 0.85)), 0, 0.88, 0.255, false);
    plaket.rotation.x = 0.10; g.add(plaket);
    const matKancing = matKarakter(0x2a2320);
    for (const ky of [1.04, 0.88, 0.72]) // z muka plaket pada tinggi ky: 0,270 di tengah + kemiringan 0,10; kancing duduk 0,008 di mukanya
      g.add(bagian(GEO.kancing, matKancing, 0, ky, 0.278 + (ky - 0.88) * 0.10, false));
    // Lengan bersegmen berpivot di bahu (y=1,14, x=±0,42), miring
    // keluar sedikit; lengan atas berbaju, lengan bawah berkulit,
    // diakhiri tangan (bola pipih berkulit) — ronde 3.
    function buatLengan(sx) {
      const lengan = new THREE.Group(); lengan.position.set(sx, 1.14, 0);
      lengan.rotation.z = sx < 0 ? -0.12 : 0.12;
      lengan.add(bagian(GEO.lenganAtas, matBaju, 0, -0.17, 0, true));
      lengan.add(bagian(GEO.lenganBawah, matKulit, 0, -0.49, 0, false));
      lengan.add(bagian(GEO.manset, matKarakter(warnaSkala(baju, 0.8)), 0, -0.37, 0, false)); // lipatan lengan tergulung (skill-3d)
      const tangan = bagian(GEO.tangan, matKulit, 0, -0.68, 0, false);
      tangan.scale.set(0.9, 1.1, 0.9);
      lengan.add(tangan);
      return lengan;
    }
    const lenganK = buatLengan(-0.42), lenganR = buatLengan(0.42);
    g.add(lenganK); g.add(lenganR);
    // Kepala berfaset + wajah lengkap. Grup kepala di y=1,30; pusat
    // kepala lokal +0,24 (abs 1,54). Ronde skill-3d: geometri kepala
    // DIBENTUK (bentukKepala: pipi lebar, rahang menyempit, ubun-ubun
    // rata) dan diskalakan (1 / 1 / 0,92) -> jari-jari efektif RK
    // (0,4576 / 0,44 / 0,4048); puncak abs ±1,96. Semua fitur wajah
    // didudukkan dengan mukaZ() pada permukaan itu — bahasa wajah
    // mengikuti referensi Pak Presiden: mata besar terbuka berjarak
    // lebar, alis tebal melengkung, senyum lebar bergigi, blush oval.
    // Leher ditiadakan: dasar kepala menembus puncak torso (1,16).
    const kepalaGrup = new THREE.Group(); kepalaGrup.position.y = 1.30; g.add(kepalaGrup);
    const kepalaMesh = bagian(GEO.kepala, matKulit, 0, 0.24, 0, true);
    kepalaMesh.scale.set(1, 1, 0.92); kepalaGrup.add(kepalaMesh);
    const matWajah = matKarakter(0x2a2320);
    const matPutih = matKarakter(0xffffff);
    // Material pipi lewat cache yang sama, ditambah polygonOffset
    // supaya lingkaran pipi tidak z-fighting dengan faset kepala.
    const matPipi = matKarakter(0xf2a097);
    if (!matPipi.polygonOffset) { matPipi.polygonOffset = true; matPipi.polygonOffsetFactor = -2; matPipi.polygonOffsetUnits = -2; }
    const mataK = [], mataR = []; // bagian mata per sisi — diskalakan animasiHidup untuk kedip
    for (const s of [-1, 1]) {
      // Mata besar terbuka: putih memipih + pupil + highlight,
      // berjarak lebar (pusat ±0,16 = 0,36 lebar kepala, pola
      // referensi). z dihitung dari mukaZ supaya duduk di permukaan.
      const putih = bagian(GEO.mataPutih, matPutih, s * 0.16, 0.29, 0.364, false);
      putih.scale.set(1.05, 1.3, 0.5); kepalaGrup.add(putih);
      const pup = bagian(GEO.pupil, matWajah, s * 0.16, 0.285, 0.400, false);
      pup.scale.set(1, 1.28, 0.55); kepalaGrup.add(pup);
      const sorot = bagian(GEO.highlight, matPutih, s * 0.16 - 0.02, 0.322, 0.428, false);
      kepalaGrup.add(sorot);
      for (const m of [putih, pup, sorot]) m.userData.sy = m.scale.y; // skala-y dasar untuk kedip
      (s < 0 ? mataK : mataR).push(putih, pup, sorot);
      // Alis: lebih tebal & panjang, melengkung mengikuti dahi.
      const alis = bagian(GEO.alis, matWajah, s * 0.16, 0.425, 0.340, false);
      alis.rotation.z = s * 0.14; alis.rotation.x = -0.12; kepalaGrup.add(alis);
      // Telinga: bola pipih di sisi kepala setinggi garis mata.
      const tel = bagian(GEO.telinga, matKulit, s * 0.435, 0.27, 0, false);
      tel.scale.set(0.45, 1.05, 0.75); kepalaGrup.add(tel);
      // Pipi merona: lingkaran lebih besar, duduk di pipi yang lebar.
      const pipi = bagian(GEO.pipi, matPipi, s * 0.25, 0.185, 0.332, false);
      pipi.rotation.y = s * 0.45; pipi.rotation.x = 0.10; kepalaGrup.add(pipi);
    }
    // Hidung: kerucut 7-sisi (faset lebih bersih), ujung menunjuk +z.
    const hidung = bagian(GEO.hidung, matKulit, 0, 0.195, 0.395, false);
    hidung.rotation.x = Math.PI / 2; kepalaGrup.add(hidung);
    // Senyum lebar terbuka ala referensi: busur bibir cokelat hangat
    // + busur gigi putih bersarang di dalamnya (dua tabung torus,
    // tanpa kartu pipih yang melayang dari permukaan melengkung).
    const mulut = bagian(GEO.mulut, matKarakter(0x7c4030), 0, 0.092, 0.372, false);
    mulut.rotation.z = Math.PI; kepalaGrup.add(mulut);
    const gigi = bagian(GEO.gigi, matPutih, 0, 0.096, 0.368, false);
    gigi.rotation.z = Math.PI; kepalaGrup.add(gigi);
    if (opsi.topi === "peci") { // songkok 3 potong: badan lebih tinggi & berfaset tegas (referensi) + sabuk + kubah
      const matPeci = matKarakter(0x1c1c1e);
      kepalaGrup.add(bagian(GEO.peci, matPeci, 0, 0.64, 0, true));
      kepalaGrup.add(bagian(GEO.peciSabuk, matKarakter(0x2b2b30), 0, 0.50, 0, false));
      const kubahPeci = bagian(GEO.peciAtas, matPeci, 0, 0.79, 0, false);
      kubahPeci.scale.set(1, 0.26, 1); kepalaGrup.add(kubahPeci);
    } else if (opsi.topi === "topi") { // topi: kubah dangkal + lidah ke depan
      const matTopi = matKarakter(warnaTopi(bajuHex));
      const kubah = bagian(GEO.topiAtas, matTopi, 0, 0.24, 0, true);
      kubah.scale.set(1.02, 1.02, 0.94); kepalaGrup.add(kubah);
      kepalaGrup.add(bagian(GEO.topiLidah, matTopi, 0, 0.43, 0.40, false));
    } else { // polos: rambut belahan bola — digeser mundur-naik (pelajaran resep Blender) supaya tidak menelan dahi/mata
      const rambut = bagian(GEO.rambut, matKarakter(0x2f2320), 0, 0.25, -0.035, false);
      rambut.scale.set(1.02, 1.02, 0.94); rambut.rotation.x = -0.32; kepalaGrup.add(rambut);
    }
    g.userData.lenganK = lenganK; g.userData.lenganR = lenganR;
    g.userData.kakiK = kakiK; g.userData.kakiR = kakiR;
    g.userData.kepala = kepalaGrup;
    g.userData.badan = badan; // untuk napas halus animasiHidup
    g.userData.mataK = mataK; g.userData.mataR = mataR; // untuk kedip animasiHidup
    g.userData.geserHidup = Math.random() * 10; // fase kedip/napas per karakter (murni visual)
    return g;
  }
  /* ---------- Animasi jalan: kaki mengayun dari pivot pinggul ----------
     Fase ayunan maju mengikuti JARAK tempuh nyata (bukan waktu saja), jadi
     kaki tidak menggelincir terhadap tanah. Panjang siklus langkah membesar
     saat lari sehingga frekuensi terbatasi ±2,2 siklus/detik. Kekuatan
     ayunan dirampa halus: naik saat mulai bergerak, mereda kembali ke
     netral saat berhenti — tidak berhenti mendadak di pose miring. Lengan
     mengayun berlawanan fase dengan kaki di sisi yang sama, gaya yang sama
     seperti ayunan lengan lama (amplitudo 0,4). Mengembalikan faktor bob
     0..1 supaya pemanggil menyelaraskan pantulan badan dengan langkah. */
  const AYUN_KAKI = 0.55, AYUN_LENGAN = 0.4;
  function animasiJalan(kar, jarak, dt) {
    const u = kar.userData;
    if (!u.kakiK || !u.kakiR) return 0;
    if (u.faseJalan === undefined) { u.faseJalan = u.fase || 0; u.ayunKuat = 0; }
    jarak = Math.min(Math.max(jarak || 0, 0), 3); // lompatan posisi (muncul ulang dsb.) tidak mengacaukan fase
    const kec = dt > 0 ? jarak / dt : 0;
    const siklus = Math.max(2.2, kec / 2.2);
    u.faseJalan += jarak / siklus * Math.PI * 2;
    const target = jarak > 0.0001 ? Math.min(1, 0.35 + kec / 6) : 0;
    u.ayunKuat += (target - u.ayunKuat) * (1 - Math.exp(-dt * 7));
    if (target === 0 && u.ayunKuat < 0.002) u.ayunKuat = 0;
    const s = Math.sin(u.faseJalan) * u.ayunKuat;
    u.kakiK.rotation.x = s * AYUN_KAKI;
    u.kakiR.rotation.x = -s * AYUN_KAKI;
    if (u.lenganK && u.lenganR) { u.lenganK.rotation.x = -s * AYUN_LENGAN; u.lenganR.rotation.x = s * AYUN_LENGAN; }
    return Math.abs(Math.sin(u.faseJalan)) * u.ayunKuat;
  }
  /* ---------- Hidup saat diam: kedip + napas (ronde 3) ----------
     skalaKedip MURNI: 1 = mata terbuka penuh; selama 0,17 detik tiap
     siklus 3,9 detik mata menutup mengikuti kurva sinus sampai ±0,08.
     animasiHidup menerapkannya ke skala-y bagian mata (dasar disimpan
     di userData.sy saat karakter dibangun) dan, khusus saat DIAM,
     memberi napas sangat halus pada torso + ayunan lengan nyaris tak
     terasa. Saat berjalan animasiJalan yang memegang lengan & torso
     dibiarkan utuh. Kaki & posisi grup tidak pernah disentuh di sini,
     jadi karakter tidak bergeser saat diam. Satu fungsi untuk semua:
     pemain sendiri, pemain lain, NPC, dan Pak Presiden. */
  function skalaKedip(t, geser) {
    const SIKLUS = 3.9, LAMA = 0.17;
    let f = (t + (geser || 0)) % SIKLUS;
    if (f < 0) f += SIKLUS;
    if (f >= LAMA) return 1;
    return 1 - Math.sin((f / LAMA) * Math.PI) * 0.92;
  }
  function animasiHidup(kar, t, diam) {
    const u = kar.userData;
    if (!u.mataK || !u.mataR) return;
    const s = skalaKedip(t, u.geserHidup);
    for (const m of u.mataK) m.scale.y = m.userData.sy * s;
    for (const m of u.mataR) m.scale.y = m.userData.sy * s;
    if (u.badan) {
      const napas = diam ? 1 + Math.sin(t * 1.7 + (u.geserHidup || 0)) * 0.018 : 1;
      u.badan.scale.x = napas;
      u.badan.scale.z = 0.8 * napas;
    }
    if (diam && u.lenganK && u.lenganR) {
      const ayun = Math.sin(t * 1.7 + (u.geserHidup || 0) + 0.7) * 0.045;
      u.lenganK.rotation.x = ayun; u.lenganR.rotation.x = ayun;
    }
  }
  function buatRumahDetail(dinding, atap, varian, cerobong) {
    // Ronde skill-3d (lowpoly-style + prop-artist): siluet besar tetap
    // sederhana, kekayaan datang dari detail arsitektur prosedural —
    // plinth pondasi (rumah terasa menapak), lis di bawah atap, papan
    // sudut, bingkai + kusen silang + ambang jendela, bingkai pintu +
    // kenop, dan hiasan halaman kecil per varian. Semua tetap di
    // dalam tapak tabrakan ±4,6 x ±4,2 (rintanganDetail).
    const g = new THREE.Group();
    const TRIM = 0xfdf3d8, KAYU = 0x7a4a21;
    g.add(kotak(5.9, 0.35, 5.3, 0x9a938a, 0, 0.17, 0)); // plinth pondasi batu
    g.add(kotak(5.4, 3, 4.8, dinding, 0, 1.68, 0));    // dinding (naik di atas plinth)
    g.add(kotak(5.6, 0.22, 5.0, TRIM, 0, 3.10, 0));    // lis keliling di bawah atap
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) // papan sudut krem
      g.add(kotak(0.18, 3.0, 0.18, TRIM, sx * 2.66, 1.83, sz * 2.36));
    const matAtap = new THREE.MeshStandardMaterial({ color: atap, map: TEX_ATAP, roughness: 0.95, flatShading: true });
    if (varian === 0) { // atap pelana
      const roof = new THREE.Mesh(geometriAtapPelana(6.8, 2.3, 6.2), matAtap);
      roof.position.y = 3.18; roof.castShadow = true; g.add(roof);
    } else if (varian === 1) { // atap limas (bentuk lama)
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.3, 4), matAtap);
      roof.position.y = 4.33; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    } else { // atap datar + parapet + kotak atap
      const slab = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 5.6), matAtap);
      slab.position.y = 3.38; slab.castShadow = true; g.add(slab);
      g.add(kotak(2.2, 0.7, 2.0, dinding, -1.2, 3.93, -0.8));
    }
    if (cerobong && varian !== 2) g.add(kotak(0.5, 1.2, 0.5, 0xa2604c, 1.35, 4.53, -0.8));
    // teras: pelat + 2 tiang + kanopi miring di atas pintu. Kanopi WAJIB
    // duduk di atas puncak bingkai pintu (y 2,41) dan jauh lebih lebar
    // dari pintu berbingkai (1,34) supaya benar-benar menaungi pintu —
    // versi ?v=19 terpasang di y 1,70 sehingga memotong daun pintu
    // (keluhan Fahmi: "kanopi lebih pendek dari pintu").
    g.add(kotak(2.9, 0.22, 1.5, 0xa9743f, 0, 0.11, 3.05));
    g.add(kotak(0.13, 2.4, 0.13, 0x8a5a30, -1.45, 1.42, 3.65));
    g.add(kotak(0.13, 2.4, 0.13, 0x8a5a30, 1.45, 1.42, 3.65));
    const atapTeras = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.13, 1.8),
      new THREE.MeshStandardMaterial({ color: atap, roughness: 0.95, flatShading: true }));
    atapTeras.position.set(0, 2.68, 3.1); atapTeras.rotation.x = -0.10; atapTeras.castShadow = true; g.add(atapTeras);
    // (Siku penopang diagonal sempat dicoba di ?v=20 — dari render
    // terbaca seperti ranting miring di depan jendela, tidak cocok
    // dengan gaya rumahnya, jadi ditiadakan.)
    g.add(kotak(1.3, 0.14, 0.5, 0x9a938a, 0, 0.28, 2.72)); // undakan batu ke pintu
    // pintu: bingkai krem + daun kayu + kenop kuningan
    g.add(kotak(1.34, 2.06, 0.10, TRIM, 0, 1.38, 2.42));
    g.add(kotak(1.1, 1.9, 0.12, KAYU, 0, 1.30, 2.44));
    const kenop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), M(0xd9a441));
    kenop.position.set(0.42, 1.30, 2.52); g.add(kenop);
    // jendela depan: bingkai kayu + kaca + kusen silang + ambang
    for (const sx of [-1, 1]) {
      g.add(kotak(1.2, 1.2, 0.09, KAYU, sx * 1.7, 1.98, 2.42));
      g.add(kotak(1, 1, 0.1, 0xbfe8f5, sx * 1.7, 1.98, 2.44));
      g.add(kotak(0.07, 1.0, 0.06, KAYU, sx * 1.7, 1.98, 2.47));
      g.add(kotak(1.0, 0.07, 0.06, KAYU, sx * 1.7, 1.98, 2.47));
      g.add(kotak(1.32, 0.09, 0.2, TRIM, sx * 1.7, 1.44, 2.46));
    }
    // jendela samping (+x): rumah terasa utuh dari jalan samping
    g.add(kotak(0.09, 1.2, 1.2, KAYU, 2.72, 1.98, -0.6));
    g.add(kotak(0.1, 1, 1, 0xbfe8f5, 2.72, 1.98, -0.6));
    // hiasan halaman mungil per varian (deterministik, di dalam tapak)
    if (varian !== 1) for (const sx of [-1, 1]) {
      const semak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), M(0x4e9a44));
      semak.position.set(sx * 2.25, 0.30, 3.3); semak.scale.y = 0.85; semak.castShadow = true; g.add(semak);
    }
    if (varian !== 0) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 7), M(0xb56545));
      pot.position.set(2.3, 0.13, 3.15); g.add(pot);
      const bunga = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), M(0xe86a92));
      bunga.position.set(2.3, 0.38, 3.15); g.add(bunga);
      const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), M(0x4e9a44));
      daun.position.set(2.18, 0.32, 3.05); g.add(daun);
    }
    return g;
  }

  /* ---------- Pusat kota: plaza, balai, papan, tugu ---------- */
  const papanCv = document.createElement("canvas"); papanCv.width = 1024; papanCv.height = 512;
  const papanTex = new THREE.CanvasTexture(papanCv);
  function gambarPapan() {
    const c = papanCv.getContext("2d");
    c.fillStyle = "#fff8ea"; c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = "#7a4a21"; c.lineWidth = 20; c.strokeRect(10, 10, 1004, 492);
    c.fillStyle = "#21332a"; c.textAlign = "center";
    c.font = "bold 92px system-ui, sans-serif"; c.fillText("NEGARA MERDU", 512, 128);
    c.font = "bold 74px system-ui, sans-serif"; c.fillStyle = "#2e7d46";
    c.fillText("WARGA: " + statistik.warga.toLocaleString("id-ID"), 512, 258);
    c.font = "bold 58px system-ui, sans-serif";
    c.fillText("KAVLING: " + statistik.terisi.toLocaleString("id-ID") + " / " + KAPASITAS.toLocaleString("id-ID"), 512, 356);
    c.font = "44px system-ui, sans-serif"; c.fillStyle = "#5b7263";
    c.fillText("@negaramerdu", 512, 448);
    papanTex.needsUpdate = true;
  }
  /* ---------- Papan Rencana Pembangunan Desa (Paket 2 ?v=15) ----------
     Papan kayu bergaya diagram di plaza: daftar fasilitas + statusnya,
     datanya dari /api/pembangunan (dataPembangunan, dibaca ambilData).
     Digambar ulang tiap bangunDistrik — pola yang sama seperti
     gambarPapan() — jadi statusnya segar sesudah data termuat.
     ?v=34: baris ke-9 = Toko Pancing (bangunan voting warga). */
  const URUTAN_PAPAN_RENCANA = ["taman", "lapangan", "perpustakaan", "balai_warga", "sekolah", "puskesmas", "pasar", "masjid", "toko_pancing"];
  const rencanaCv = document.createElement("canvas"); rencanaCv.width = 1152; rencanaCv.height = 640;
  const rencanaTex = new THREE.CanvasTexture(rencanaCv);
  function gambarPapanRencana() {
    const c = rencanaCv.getContext("2d");
    c.fillStyle = "#7a4a21"; c.fillRect(0, 0, 1152, 640);
    c.fillStyle = "#fff8ea"; c.fillRect(26, 26, 1100, 588);
    c.strokeStyle = "#7a4a21"; c.lineWidth = 8; c.strokeRect(44, 44, 1064, 552);
    c.textAlign = "center"; c.fillStyle = "#21332a";
    c.font = "bold 56px system-ui, sans-serif";
    c.fillText("RENCANA PEMBANGUNAN DESA", 576, 100);
    c.font = "32px system-ui, sans-serif"; c.fillStyle = "#5b7263";
    c.fillText("Usulan warga di komentar Instagram · Diputuskan Pak Presiden", 576, 142);
    const status = {};
    for (const f of dataPembangunan) status[f.kunci] = f;
    URUTAN_PAPAN_RENCANA.forEach((kunci, i) => {
      const y = 200 + i * 46; // 9 baris (?v=34): terakhir 200+8*46=568, di dalam bingkai (596)
      const f = status[kunci];
      const nama = (f && f.nama) || FASILITAS_NAMA[kunci] || kunci;
      const berdiri = !!(f && f.status === "terbangun");
      c.textAlign = "left"; c.fillStyle = "#21332a"; c.font = "bold 34px system-ui, sans-serif";
      c.fillText((i + 1) + ". " + nama, 84, y, 560);
      c.textAlign = "right"; c.font = "bold 31px system-ui, sans-serif";
      c.fillStyle = berdiri ? "#2e7d46" : "#a05a2c";
      c.fillText(berdiri ? "✓ SUDAH BERDIRI" : "○ LAHAN KOSONG", 1068, y);
    });
    rencanaTex.needsUpdate = true;
  }
  let animasiKades = null;
  /* Rintangan tabrakan mode 1st Person: AABB statis (pusat kota) + detail (diisi ulang tiap bangunDistrik) */
  const rintangan = [];
  const rintanganDetail = [];
  const rintanganFasilitas = []; // AABB bangunan fasilitas terbangun (diisi bangunLahanPembangunan)
  /* Tapak bangunan fasilitas relatif ke pusat bloknya (pusatBlok) — diambil
     dari ukuran kotak gedung di MODEL_FASILITAS. Hanya bangunan berdinding;
     lapangan (memang dilalui) dan balai warga (pendopo terbuka) tidak
     ditabrak; di taman (?v=37) yang ditabrak air (kolam + air mancur),
     gazebo, dan peralatan bermain — jalan setapak & area terbuka bebas. */
  const TAPAK_FASILITAS = {
    perpustakaan: [[-6.5, -4.5, 6.5, 4.5]],                 // gedung 13x9
    sekolah: [[-11, -6.5, 11, 2.5]],                        // gedung 22x9 di z=-2
    puskesmas: [[-7.5, -4.75, 7.5, 4.75]],                  // gedung 15x9,5
    pasar: [[-20.5, -10, -12.5, -4], [-9.5, -10, -1.5, -4], [1.5, -10, 9.5, -4], [12.5, -10, 20.5, -4],
            [-20.5, 4, -12.5, 10], [-9.5, 4, -1.5, 10], [1.5, 4, 9.5, 10], [12.5, 4, 20.5, 10]], // 8 kios 8x6
    masjid: [[-7.5, -5.5, 7.5, 5.5], [9.95, -7.55, 13.05, -4.45]], // gedung 15x11 + menara
    taman: [[-20.5, -18.5, -7.5, -5.5],                     // kolam r=6,5 di (-14,-12) — dipertahankan
            [-4.4, -4.4, 4.4, 4.4],                         // air mancur tengah (?v=37): bak r=4,15 di (0,0)
            [13.2, 11.2, 22.8, 20.8],                       // gazebo (?v=37): lantai 9,5x9,5 di (18,16)
            [14.2, -17.6, 21.8, -14.4],                     // ayunan (?v=37): rangka x 14,5..21,5, palang z -16
            [12.6, -23.5, 14.4, -17.4]],                    // perosotan (?v=37): menara (13,5;-22,5) + luncuran ke utara
    toko_pancing: [[-7, 6, 7, 14],                         // gedung toko 14x8 di z 6..14 (etalase & kursi hiasan, tidak ditabrak)
                   [17.2, -10.6, 32.4, -1.7],               // kolam pancing (?v=36): air di utara koridor dermaga
                   [17.2, 1.7, 32.4, 10.6],                 // kolam pancing: air di selatan koridor dermaga
                   [23.2, -1.7, 32.4, 1.7]],                // kolam pancing: air di timur ujung dermaga (koridor z -1,7..1,7 di atas dermaga bebas dilewati)
  };
  function pohonPot(x, z) { // pohon dalam pot terakota (palet balai 0xb5533c), basis di puncak slab plaza
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 8), M(0xb5533c));
    pot.position.y = 0.4; pot.castShadow = true; g.add(pot);
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6), M(0x8a5a30));
    batang.position.y = 1.4; g.add(batang);
    const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), M(0x4da653));
    daun.position.y = 2.9; daun.castShadow = true; g.add(daun);
    g.position.set(x, 0.3, z); scene.add(g);
    return g;
  }
  (function pusatKota() {
    // AUDIT Z-FIGHTING: pusat y 0,15 -> 0,17 supaya wajah bawah plaza (dulu persis y=0,
    // koplanar dengan plane tanah) kini menggantung 0,02 di atasnya; puncak 0,32.
    const plaza = kotak(208, 0.3, 104, 0xbfae87, 0, 0.17, 0); plaza.castShadow = false; scene.add(plaza); // tanah plaza 0xcfc4a5 -> 0xbfae87: pasir hangat, tidak lagi hampir putih
    /* ================= ISTANA NEGARA MEWAH (?v=24) =================
       Gedung kantor Pak Presiden dibangun ulang total: badan bertingkat
       beratap hijau tua + menara kubah berpuncak emas, portico 6 kolom
       dengan pedimen & papan nama, dua sayap bergaleri, pelataran
       berpagar dengan gerbang, air mancur, dua tiang bendera Negara
       Merdu mengapit gerbang (?v=25), karpet merah, hedge & lampu taman.
       Koordinat lokal grup (grup di (0,0,-34), depan menghadap +z).
       Palet: krem 0xfdf3d8, emas 0xd9a441, atap HIJAU TUA 0x2e5d43 —
       dipilih karena terakota sudah mendominasi atap rumah warga &
       tugu; hijau tua + krem + emas paling terbaca "istana" di cahaya
       golden hour plaza. Jendela memakai material bersama MAT_JENDELA
       (kaca gelap kebiruan 0x39566b, emissive hangat digerakkan fase
       waktu); kepala lampu taman memakai LAMPU_TAMAN (digerakkan
       kepalaLampu). Tanpa PointLight baru. */
    const g = new THREE.Group();
    const matEmas = M(0xd9a441, 0.45), matEmasT = M(0xf2b13d, 0.5);
    const matKrem = M(0xfdf3d8), matKrem2 = M(0xf3e5c3), matPutih = M(0xf8f3e4);
    const matAtapI = M(0x2e5d43, 0.9);
    const matBatu = M(0xb8a888), matBatuT = M(0xcabfa5);
    const matKayu = M(0x6b4423), matBesi = M(0x2f2a26, 0.6);
    const matHedge = M(0x3d7a44), matTanah = M(0x5d4630), matKarpet = M(0xa31f34);
    const matJendelaIstana = new THREE.MeshStandardMaterial({ color: 0x39566b, emissive: 0xffc98a, emissiveIntensity: 0.25, roughness: 0.35, flatShading: true });
    MAT_JENDELA.mat = matJendelaIstana;
    const matKepalaTaman = new THREE.MeshStandardMaterial({ color: 0xffe2ae, emissive: 0xffc37a, emissiveIntensity: 0.85, roughness: 0.6, flatShading: true });
    LAMPU_TAMAN.mat = matKepalaTaman;
    function kotakM(w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; m.receiveShadow = true; return m;
    }
    function silM(rt, rb, h, seg, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
    }
    function bolaM(r, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
      m.position.set(x, y, z); m.castShadow = true; return m;
    }
    /* Jendela berbingkai emas: bingkai emas + kaca bersama + ambang krem.
       Grup menghadap +z, titik asal di tengah jendela. */
    function jendelaEmas(x, y, z, rotY, skala) {
      const jg = new THREE.Group(); const s = skala || 1;
      jg.add(kotakM(1.6 * s, 2.2 * s, 0.14, matEmas, 0, 0, 0));
      const kaca = kotakM(1.3 * s, 1.9 * s, 0.1, matJendelaIstana, 0, 0, 0.05); kaca.castShadow = false; jg.add(kaca);
      jg.add(kotakM(1.9 * s, 0.18 * s, 0.34, matKrem2, 0, -1.18 * s, 0.06));
      jg.position.set(x, y, z); jg.rotation.y = rotY || 0; return jg;
    }
    // podium & pelataran
    g.add(kotakM(58, 1.2, 19.3, matBatu, 0, 0.6, 1.15));            // podium z[-8.5,10.8], puncak y 1.2
    g.add(kotakM(58.6, 0.18, 19.9, matEmas, 0, 1.12, 1.15));        // lis emas bibir podium
    g.add(kotakM(57, 0.34, 21, matBatuT, 0, 0.17, 20.5));           // pelataran z[10,31], puncak 0.34 (bisa diinjak)
    g.add(kotakM(57.3, 0.12, 0.45, matEmas, 0, 0.3, 30.85));        // lis emas tepi pelataran
    // tangga lebar: 4 undakan dari pelataran (0.34) ke podium (1.2), balustrade batu + bola emas
    const puncakAnak = z => z < 12.4 ? 0.99 : z < 14 ? 0.78 : z < 15.6 ? 0.57 : 0.36;
    [[0.99, 11.6], [0.78, 13.2], [0.57, 14.8], [0.36, 16.4]].forEach(([top, zc]) => {
      g.add(kotakM(13, top, 1.6, matBatuT, 0, top / 2, zc));
    });
    for (const sisi of [-1, 1]) {
      const bx = sisi * 6.95;
      const rel = kotakM(0.26, 0.16, 7.2, matBatuT, bx, 1.66, 13.95); rel.rotation.x = 0.107; g.add(rel);
      for (const bz of [11.4, 12.6, 13.8, 15.0, 16.2]) {
        const relY = 1.99 - (bz - 10.9) * 0.107, alasY = puncakAnak(bz);
        const tinggi = Math.max(0.2, relY - alasY - 0.08);
        g.add(kotakM(0.15, tinggi, 0.15, matBatuT, bx, alasY + tinggi / 2, bz));
      }
      g.add(kotakM(0.52, 1.05, 0.52, matBatu, bx, 1.72, 10.95));
      g.add(bolaM(0.3, matEmasT, bx, 2.52, 10.95));
      g.add(kotakM(0.52, 1.15, 0.52, matBatu, bx, 0.91, 17.15));
      g.add(bolaM(0.3, matEmasT, bx, 1.7, 17.15));
    }
    // badan utama dua tingkat + atap utama + menara drum berkubah
    g.add(kotakM(30, 5.4, 12, matKrem, 0, 3.9, 0));                       // tingkat bawah y[1.2,6.6], z[-6,6]
    g.add(kotakM(31.7, 0.14, 13.7, matEmas, 0, 6.62, 0));                 // pita emas
    g.add(kotakM(31.4, 0.5, 13.4, matKrem2, 0, 6.9, 0));                  // cornice bawah
    /* ATAP DIBERSIHKAN (?v=31 — keluhan Fahmi dari orbit atas: "atap
       istana kok gini"): tumpukan piramida lama (rok skirt + piramida
       utama + kotak menara menembus piramida + kubah seperti duri)
       diganti komposisi tegas yang terbaca bersih dari SEMUA sudut:
       tingkat bawah jadi teras datar (cornice + pita emas saja, TANPA
       piramida rok), SATU piramida utama bersih di atas tingkat atas,
       menara = DRUM silinder (leher) lalu kubah di atasnya. Urutan dari
       atas: atap utama -> drum -> kubah -> bola emas, semuanya sesumbu
       (0,-0.5). TIDAK ada volume atap yang saling menembus: rentang y
       sayap 6.48..9.08 < alas atap utama 11.05; drum memang menembus
       lereng atap di sumbu (menara tumbuh dari atap — disengaja). */
    g.add(kotakM(24, 3.4, 10, matKrem, 0, 8.85, -0.5));                   // tingkat atas y[7.15,10.55], z[-5.5,4.5]
    g.add(kotakM(25.7, 0.14, 11.7, matEmas, 0, 10.58, -0.5));             // pita emas atas
    g.add(kotakM(25.4, 0.45, 11.4, matKrem2, 0, 10.82, -0.5));            // cornice atas
    /* Rotasi 45° WAJIB di GEOMETRI, bukan di mesh (?v=32 — keluhan Fahmi
       "kenapa bukan kotak malah jajar genjang"): transform mesh three.js
       adalah T·R·S (skala diterapkan SEBELUM rotasi, di ruang lokal), jadi
       mesh.rotation.y=π/4 + scale z 0.4737 memutar persegi hasil skala
       menjadi BELAH KETUPAT miring terhadap dinding. Geometri yang diputar
       π/4 menaruh sudut alas di diagonal (±R/√2,±R/√2); skala mesh sesudah
       itu bekerja sejajar sumbu dunia -> alas persegi panjang sejati. */
    const geoAtapUtama = new THREE.ConeGeometry(18.81, 3.9, 4); geoAtapUtama.rotateY(Math.PI / 4);
    const atapUtama = new THREE.Mesh(geoAtapUtama, matAtapI);
    atapUtama.position.set(0, 13.0, -0.5); atapUtama.scale.set(1, 1, 0.4737);
    atapUtama.castShadow = true; g.add(atapUtama);                        // atap utama: alas 26.6x12.6 di y 11.05, puncak 14.95
    g.add(silM(2.4, 2.4, 3.4, 14, matKrem, 0, 15.6, -0.5));               // drum menara y[13.9,17.3] (dasar tertanam di atap)
    g.add(silM(2.58, 2.58, 0.32, 14, matEmas, 0, 17.3, -0.5));            // lis emas drum
    g.add(silM(3.15, 3.15, 0.25, 14, matKrem2, 0, 17.42, -0.5));          // cincin alas kubah
    const kubah = new THREE.Mesh(new THREE.SphereGeometry(3.1, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2), matAtapI);
    kubah.position.set(0, 17.55, -0.5); kubah.scale.y = 1.22; kubah.castShadow = true; g.add(kubah);
    g.add(silM(0.1, 0.14, 1.65, 6, matEmasT, 0, 21.9, -0.5));             // tiang puncak
    g.add(bolaM(0.45, matEmasT, 0, 23.03, -0.5));                         // bola emas puncak (±23.5 = titik tertinggi istana)
    // portico: 6 kolom putih berkapitel emas + entablature + pedimen
    for (const cx of [-10, -6, -2, 2, 6, 10]) {
      g.add(kotakM(1.15, 0.5, 1.15, matBatuT, cx, 1.45, 9.3));
      g.add(silM(0.44, 0.5, 5.3, 10, matPutih, cx, 4.35, 9.3));
      g.add(kotakM(1.2, 0.5, 1.2, matEmas, cx, 7.25, 9.3));
    }
    g.add(kotakM(24.7, 0.16, 3.8, matEmas, 0, 7.58, 8.7));                // pita emas entablature
    g.add(kotakM(24.5, 1.5, 3.6, matKrem, 0, 8.33, 8.7));                 // entablature y[7.58,9.08], z[6.9,10.5]
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 128;
    const c = cv.getContext("2d");
    c.fillStyle = "#7a4a21"; c.fillRect(0, 0, 1024, 128);
    c.fillStyle = "#fff7e0"; c.font = "bold 62px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("ISTANA NEGARA", 512, 66);
    const papan = new THREE.Mesh(new THREE.BoxGeometry(10, 1.3, 0.15),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), roughness: 0.9 }));
    papan.position.set(0, 8.33, 10.55); papan.castShadow = true; g.add(papan); // papan nama di wajah entablature
    const segitiga = new THREE.Shape();
    segitiga.moveTo(-12.4, 0); segitiga.lineTo(12.4, 0); segitiga.lineTo(0, 2.4); segitiga.closePath();
    const pedimen = new THREE.Mesh(new THREE.ExtrudeGeometry(segitiga, { depth: 3.2, bevelEnabled: false }), matKrem);
    pedimen.position.set(0, 9.08, 7.1); pedimen.castShadow = true; g.add(pedimen);
    const medali = silM(0.72, 0.72, 0.18, 14, matEmasT, 0, 9.85, 10.36); medali.rotation.x = Math.PI / 2; g.add(medali);
    const atapPortico = kotakM(24.5, 0.22, 5.6, matAtapI, 0, 10.15, 5.6); atapPortico.rotation.x = 0.32; g.add(atapPortico);
    // pintu utama berbingkai emas
    g.add(kotakM(3.5, 4.5, 0.3, matEmas, 0, 3.45, 6.03));
    g.add(kotakM(2.9, 4.1, 0.34, matKayu, 0, 3.25, 6.06));
    g.add(bolaM(0.11, matEmasT, -0.32, 3.1, 6.28)); g.add(bolaM(0.11, matEmasT, 0.32, 3.1, 6.28));
    // jendela badan utama (depan, samping, belakang, menara)
    for (const wx of [-7.5, 0, 7.5]) g.add(jendelaEmas(wx, 8.85, 4.56, 0));
    for (const wx of [-13.4, 13.4]) g.add(jendelaEmas(wx, 3.9, 6.06, 0));
    for (const wz of [-3.2, 1.2]) { g.add(jendelaEmas(15.06, 3.9, wz, Math.PI / 2)); g.add(jendelaEmas(-15.06, 3.9, wz, -Math.PI / 2)); }
    for (const wz of [-3.5, 0.5]) { g.add(jendelaEmas(12.06, 8.85, wz, Math.PI / 2)); g.add(jendelaEmas(-12.06, 8.85, wz, -Math.PI / 2)); }
    for (const wx of [-6, 6]) g.add(jendelaEmas(wx, 3.9, -6.06, Math.PI));
    g.add(jendelaEmas(0, 15.9, 1.92, 0, 0.72));   // jendela drum menara (?v=31: muka drum silinder z=1.9)
    // dua sayap lebih rendah + galeri penghubung beratap hijau
    for (const sisi of [-1, 1]) {
      const cx = sisi * 20.75;
      g.add(kotakM(13.5, 4.8, 9.5, matKrem, cx, 3.6, -0.25));             // dinding sayap y[1.2,6.0], z[-5,4.5]
      g.add(kotakM(14.5, 0.13, 10.5, matEmas, cx, 6.02, -0.25));
      g.add(kotakM(14.3, 0.4, 10.3, matKrem2, cx, 6.28, -0.25));
      const geoAtapSayap = new THREE.ConeGeometry(11.24, 2.6, 4); geoAtapSayap.rotateY(Math.PI / 4);
      const atapSayap = new THREE.Mesh(geoAtapSayap, matAtapI);
      atapSayap.position.set(cx, 7.78, -0.25); atapSayap.scale.set(1.0, 1, 0.7484);
      atapSayap.castShadow = true; g.add(atapSayap);
      g.add(kotakM(1.9, 3.1, 0.24, matEmas, cx, 2.75, 4.52));             // pintu sayap
      g.add(kotakM(1.5, 2.8, 0.26, matKayu, cx, 2.6, 4.55));
      g.add(kotakM(2.6, 0.18, 1.1, matBatuT, cx, 1.29, 5.15));            // undakan pintu sayap (di podium)
      g.add(jendelaEmas(cx - 3.8, 3.9, 4.56, 0)); g.add(jendelaEmas(cx + 3.8, 3.9, 4.56, 0));
      g.add(jendelaEmas(sisi * 27.56, 3.9, -0.25, sisi * Math.PI / 2));
      for (const gx of [sisi * 17.5, sisi * 24.5]) {                      // kolom galeri di depan sayap
        g.add(silM(0.16, 0.2, 4.56, 8, matPutih, gx, 3.48, 6.9));
        g.add(kotakM(0.55, 0.22, 0.55, matEmas, gx, 5.82, 6.9));
      }
    }
    g.add(kotakM(56.5, 0.28, 3.0, matAtapI, 0, 5.95, 5.9));               // atap galeri membentang selebar fasad
    // air mancur bundar di tengah pelataran (geometri statis, tanpa partikel)
    const am = new THREE.Group();
    am.add(silM(3.7, 3.95, 0.75, 16, matBatu, 0, 0.38, 0));
    am.add(silM(3.9, 3.9, 0.22, 16, matBatuT, 0, 0.82, 0));
    const air = silM(3.45, 3.45, 0.08, 16, new THREE.MeshStandardMaterial({ color: 0x6fb7cf, roughness: 0.25, flatShading: true, transparent: true, opacity: 0.9 }), 0, 0.8, 0);
    air.castShadow = false; am.add(air);
    am.add(silM(0.45, 0.68, 1.05, 10, matBatuT, 0, 1.3, 0));
    am.add(silM(1.35, 0.85, 0.4, 12, matBatuT, 0, 1.98, 0));
    am.add(silM(0.15, 0.22, 0.55, 8, matBatuT, 0, 2.42, 0));
    am.add(bolaM(0.3, matEmasT, 0, 2.85, 0));
    /* Semprotan air transparan sempat dicoba, tetapi di render malam
       terbaca sebagai kerucut padat keabuan (murahan) — ditiadakan;
       air mancur cukup kolam + tiang berundak + bola emas. */
    am.position.set(0, 0.34, 24); g.add(am);
    // dua tiang bendera Negara Merdu MENGAPIT GERBANG utama pelataran (?v=25):
    // dipindah dari tengah pelataran (±13.5, 25.5) ke sisi gerbang (±5.8, 29.2,
    // di dalam pagar, simetris thd karpet merah; jalur gerbang |x|<4.2 tetap
    // bebas — tiang tidak ditabrak, sama seperti tiang lampu). Kain 2.55x1.7
    // (rasio 3:2, sedikit lebih kecil dari kain lama 2.7x1.75), gelombang
    // dipertahankan. Posisi kain (?v=26, koreksi Fahmi): DIKEREK KE PALING
    // ATAS tiang — pusat kain y=8.88, tepi atas 9.73, tepat di bawah bola
    // emas puncak (pusat 10.05, r 0.22 -> bawah bola 9.83; celah 0.10).
    // Versi tengah tiang ?v=25 (pusat 5.09) terlihat setengah tiang — salah;
    // versi ?v=24 lama tepi kain 9.88 melewati puncak & menempel bola — juga
    // salah. Rentang tiang 0.34..9.84.
    // Pemasangan kain (?v=30, koreksi Fahmi "itu di tengah kain bendera"):
    // kain MENEMPEL DI TEPI tiang (sisi hoist), TIDAK berpusat di tiang —
    // pusat kain digeser +1.385 dari sumbu tiang (1.275 setengah lebar kain
    // + 0.11 permukaan tiang; jari-jari tiang di rentang kain maks 0.101),
    // seluruh kain berkibar ke SATU sisi: +x (timur) untuk KEDUA tiang
    // (satu arah angin, bukan cermin), tanpa rotasi cermin. Gelombang yang
    // terpanggang di geometri amplitudonya 0 di tepi hoist (bx2=0) dan
    // membesar ke ujung bebas, jadi tepi hoist tetap menempel di tiang.
    const texBendera = teksturBenderaMerdu();
    for (const sisi of [-1, 1]) {
      const fx = sisi * 5.8;
      g.add(silM(0.09, 0.15, 9.5, 8, M(0xd9d9d9, 0.5), fx, 5.09, 29.2));
      g.add(bolaM(0.22, matEmasT, fx, 10.05, 29.2));
      const geoB = new THREE.PlaneGeometry(2.55, 1.7, 6, 3);
      const posB = geoB.attributes.position;
      for (let i = 0; i < posB.count; i++) {
        const bx2 = posB.getX(i) + 1.275; // 0 di tiang -> 2.55 di ujung bebas
        posB.setZ(i, 0.22 * Math.sin(2.4 * bx2 - 0.5) * (bx2 / 2.55));
      }
      geoB.computeVertexNormals();
      const bendera = new THREE.Mesh(geoB, new THREE.MeshStandardMaterial({ map: texBendera, roughness: 0.9, side: THREE.DoubleSide }));
      bendera.position.set(fx + 1.385, 8.88, 29.2);
      bendera.castShadow = true; g.add(bendera);
    }
    // pagar pelataran: tiang besi instanced + rel emas; gerbang tengah sejajar tangga
    const posisiTiang = [];
    for (let x = -27.9; x <= -4.6; x += 2.79) posisiTiang.push([x, 30.6]);
    for (let x = 4.6; x <= 27.9; x += 2.79) posisiTiang.push([x, 30.6]);
    for (let z = 7.8; z <= 30.6; z += 2.85) { posisiTiang.push([-27.9, z]); posisiTiang.push([27.9, z]); }
    const tiangPagar = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.0, 0.2), matBesi, posisiTiang.length);
    { const mtx = new THREE.Matrix4();
      posisiTiang.forEach(([px, pz], i) => { mtx.setPosition(px, 0.84, pz); tiangPagar.setMatrixAt(i, mtx); });
      tiangPagar.castShadow = true; g.add(tiangPagar); }
    for (const ry of [1.22, 0.64]) {
      g.add(kotakM(23.3, 0.09, 0.09, matEmas, -16.25, ry, 30.6));
      g.add(kotakM(23.3, 0.09, 0.09, matEmas, 16.25, ry, 30.6));
      g.add(kotakM(0.09, 0.09, 25.6, matEmas, -27.9, ry, 17.8));
      g.add(kotakM(0.09, 0.09, 25.6, matEmas, 27.9, ry, 17.8));
    }
    for (const sisi of [-1, 1]) {
      g.add(kotakM(0.46, 1.7, 0.46, matBesi, sisi * 4.5, 1.19, 30.6));
      g.add(bolaM(0.3, matEmasT, sisi * 4.5, 2.25, 30.6));
    }
    // penataan taman: hedge rapi simetris, petak bunga, semak bola pengapit tangga
    g.add(kotakM(1.0, 0.85, 19, matHedge, -26.3, 0.77, 18.5));
    g.add(kotakM(1.0, 0.85, 19, matHedge, 26.3, 0.77, 18.5));
    g.add(kotakM(19, 0.85, 1.0, matHedge, -16, 0.77, 28.9));
    g.add(kotakM(19, 0.85, 1.0, matHedge, 16, 0.77, 28.9));
    for (const sisi of [-1, 1]) {
      const semak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), matHedge);
      semak.position.set(sisi * 8.4, 1.05, 18.6); semak.scale.y = 0.92; semak.castShadow = true; g.add(semak);
    }
    const warnaBunga = [0xe14b5a, 0xf2d13d, 0xf6f0e6, 0xe88bb0];
    for (const sisi of [-1, 1]) {
      g.add(kotakM(7.5, 0.3, 1.8, matTanah, sisi * 20.75, 0.49, 12.5));
      for (let i = 0; i < 8; i++) {
        const bunga = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 0), M(warnaBunga[(i + (sisi > 0 ? 1 : 0)) % 4], 0.8));
        bunga.position.set(sisi * 20.75 - 3.1 + i * 0.89, 0.78, 12.5 + (i % 2 ? 0.42 : -0.42));
        g.add(bunga);
      }
    }
    // 6 lampu taman klasik — kepala memakai LAMPU_TAMAN (menyala di malam hari)
    function lampuTaman(x, z) {
      const lg = new THREE.Group();
      lg.add(silM(0.07, 0.11, 2.45, 8, matBesi, 0, 1.22, 0));
      const kepala = kotakM(0.44, 0.52, 0.44, matKepalaTaman, 0, 2.68, 0); kepala.castShadow = false; lg.add(kepala);
      const topi = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.32, 4), matBesi);
      topi.position.y = 3.1; topi.rotation.y = Math.PI / 4; topi.castShadow = true; lg.add(topi);
      lg.position.set(x, 0.34, z); return lg;
    }
    for (const [lx, lz] of [[-25.2, 12.5], [25.2, 12.5], [-24.5, 21], [24.5, 21], [-6.2, 27.5], [6.2, 27.5]]) g.add(lampuTaman(lx, lz));
    // karpet merah dari gerbang ke tangga (dua segmen mengapit air mancur) + lis emas
    g.add(kotakM(5, 0.05, 3.0, matKarpet, 0, 0.37, 18.9));
    g.add(kotakM(5, 0.05, 2.6, matKarpet, 0, 0.37, 29.3));
    for (const sisi of [-1, 1]) {
      g.add(kotakM(0.16, 0.055, 3.0, matEmas, sisi * 2.55, 0.37, 18.9));
      g.add(kotakM(0.16, 0.055, 2.6, matEmas, sisi * 2.55, 0.37, 29.3));
    }
    // dua pot besar mengapit pintu utama di atas podium
    for (const sisi of [-1, 1]) {
      g.add(silM(0.78, 0.56, 0.95, 9, M(0xb5533c), sisi * 8.4, 1.68, 8.4));
      const semak2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.12, 0), M(0x4da653));
      semak2.position.set(sisi * 8.4, 3.35, 8.4); semak2.castShadow = true; g.add(semak2);
    }
    g.position.set(0, 0, -34); scene.add(g);
    /* Tapak istana mewah (?v=24): podium + badan + portico + sayap menyatu
       satu kompleks tertabrak (AABB menyatu menutup seluruh tapak podium
       x[-28.2,28.2] z lokal[-8.8,11.0]); air mancur & pagar pelataran
       ditabrak terpisah, gerbang selatan (x -4.2..4.2) terbuka. Tangga
       (z lokal 10.8..17.2) & pelataran rendah (0.34) di luar AABB —
       bisa dinaiki/diinjaki seperti teras rumah. */
    rintangan.push({ minX: -15.6, maxX: 15.6, minZ: -42.8, maxZ: -23 });    // badan utama + portico istana
    rintangan.push({ minX: -28.2, maxX: -13.8, minZ: -42.8, maxZ: -23 });   // sayap barat + podium depannya
    rintangan.push({ minX: 13.8, maxX: 28.2, minZ: -42.8, maxZ: -23 });     // sayap timur + podium depannya
    rintangan.push({ minX: -4.1, maxX: 4.1, minZ: -14.2, maxZ: -5.8 });     // air mancur
    rintangan.push({ minX: -28.2, maxX: -4.2, minZ: -3.7, maxZ: -3.1 });    // pagar selatan, barat gerbang
    rintangan.push({ minX: 4.2, maxX: 28.2, minZ: -3.7, maxZ: -3.1 });      // pagar selatan, timur gerbang
    rintangan.push({ minX: -28.2, maxX: -27.6, minZ: -29.4, maxZ: -3.1 });  // pagar barat
    rintangan.push({ minX: 27.6, maxX: 28.2, minZ: -29.4, maxZ: -3.1 });    // pagar timur
    const kades = buatKarakter({ baju: "#6e4525", kulit: "#f1c27d", topi: "peci" });
    kades.scale.setScalar(1.5); kades.position.set(4.6, 0.34, -16.6); scene.add(kades); animasiKades = kades; // berdiri di pelataran, di kaki tangga istana
    const lk = buatLabel("Pak Presiden", 4.4); lk.position.set(4.6, 3.7, -16.6); scene.add(lk);
    // tugu — palet diseragamkan dengan balai: badan krem 0xfdf3d8 + sabuk terakota 0xb5533c
    const tugu = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 5.4, 4), M(0xfdf3d8));
    tb.position.y = 2.7; tb.castShadow = true; tugu.add(tb);
    const pita = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.5, 4), M(0xb5533c));
    pita.position.y = 1.7; pita.castShadow = true; tugu.add(pita);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), M(0xf2b13d, 0.5));
    bola.position.y = 6.1; tugu.add(bola); tugu.position.set(-30, 0.3, 8); scene.add(tugu);
    rintangan.push({ minX: -31.6, maxX: -28.4, minZ: 6.4, maxZ: 9.6 }); // tugu
    // papan raksasa
    const pg = new THREE.Group();
    pg.add(kotak(0.5, 6, 0.5, 0x7a4a21, -5.4, 3, 0));
    pg.add(kotak(0.5, 6, 0.5, 0x7a4a21, 5.4, 3, 0));
    const board = new THREE.Mesh(new THREE.BoxGeometry(13.5, 7.6, 0.3),
      [M(0x7a4a21), M(0x7a4a21), M(0x7a4a21), M(0x7a4a21),
       new THREE.MeshStandardMaterial({ map: papanTex, roughness: 0.9 }), M(0x7a4a21)]);
    board.position.y = 7.4; board.castShadow = true; pg.add(board);
    pg.position.set(34, 0, 26); pg.rotation.y = Math.PI + 0.45;
    scene.add(pg);
    rintangan.push({ minX: 26.5, maxX: 41.5, minZ: 18.5, maxZ: 33.5 }); // papan raksasa (perkiraan, papan miring)
    // papan RENCANA PEMBANGUNAN — cermin papan raksasa di sisi barat plaza
    const pr = new THREE.Group();
    pr.add(kotak(0.5, 7.6, 0.5, 0x7a4a21, -6.2, 3.8, 0));
    pr.add(kotak(0.5, 7.6, 0.5, 0x7a4a21, 6.2, 3.8, 0));
    pr.add(kotak(13.4, 0.35, 0.7, 0x7a4a21, 0, 7.55, 0));
    const panelRencana = new THREE.Mesh(new THREE.BoxGeometry(12.6, 7, 0.3),
      [M(0x7a4a21), M(0x7a4a21), M(0x7a4a21), M(0x7a4a21),
       new THREE.MeshStandardMaterial({ map: rencanaTex, roughness: 0.9 }), M(0x7a4a21)]);
    panelRencana.position.y = 3.9; panelRencana.castShadow = true; pr.add(panelRencana);
    pr.position.set(-34, 0, 26); pr.rotation.y = Math.PI - 0.45;
    scene.add(pr);
    rintangan.push({ minX: -41.5, maxX: -26.5, minZ: 18.5, maxZ: 33.5 }); // papan rencana (perkiraan, papan miring)
    gambarPapanRencana();
    // pohon plaza
    for (const [x, z] of [[-95, -45], [95, -45], [-95, 45], [95, 45], [-60, 45], [60, 45], [-60, -45], [60, -45]]) {
      const pohon = new THREE.Group();
      const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.6, 6), M(0x8a5a30));
      batang.position.y = 1.3; pohon.add(batang);
      const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), M(0x4da653));
      daun.position.y = 4.4; daun.castShadow = true; pohon.add(daun);
      pohon.position.set(x, 0.3, z); scene.add(pohon);
    }
    /* Perapian plaza: bangku & pohon pot ditaruh SIMETRIS terhadap sumbu
       plaza (berpasangan ±x), menghadap pita tengah tempat warga berjalan.
       Paletnya keluarga balai (kayu + terakota). Tanpa rintangan baru —
       perlakuan sama seperti pohon plaza: dekorasi tidak ditabrak. */
    for (const bx of [-24, 24]) {
      const b1 = bangkuTaman(bx, 28, Math.PI); b1.position.y = 0.3; scene.add(b1); // menghadap balai (-z)
      const b2 = bangkuTaman(bx, 2, 0); b2.position.y = 0.3; scene.add(b2);        // menghadap jalur (+z)
    }
    for (const [px, pz] of [[-52, 28], [52, 28], [-52, 2], [52, 2], [-10, -20], [10, -20]]) pohonPot(px, pz);
  })();

  /* ================= DISTRIK DETAIL (WARGA TERBARU) ================= */
  let dinamis = null; const rumahKlik = []; const npcList = [];
  const JALUR_PLAZA = [[-88, 16], [88, 16], [88, 40], [-88, 40]];
  const SEGMEN = []; let PANJANG_JALUR = 0;
  for (let i = 0; i < JALUR_PLAZA.length; i++) {
    const a = JALUR_PLAZA[i], b = JALUR_PLAZA[(i + 1) % JALUR_PLAZA.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEGMEN.push({ a, b, len, mulai: PANJANG_JALUR }); PANJANG_JALUR += len;
  }
  function posisiJalur(s) {
    s = ((s % PANJANG_JALUR) + PANJANG_JALUR) % PANJANG_JALUR;
    for (const sg of SEGMEN) if (s <= sg.mulai + sg.len) {
      const t = sg.len ? (s - sg.mulai) / sg.len : 0;
      return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * t, z: sg.a[1] + (sg.b[1] - sg.a[1]) * t, dx: sg.b[0] - sg.a[0], dz: sg.b[1] - sg.a[1] };
    }
    return { x: 0, z: 20, dx: 1, dz: 0 };
  }
  /* Penempatan rumah detail (?v=18, keputusan Fahmi: "1 blok beda nomor
     rumah aja" — tidak ada lagi rumah pajangan di plaza, tidak berjejer
     dan tidak diacak): rumah detail berdiri di posisiKavling ASLI
     pemiliknya (lihat bangunDistrik), menggantikan instans massalnya di
     petak yang sama. */
  function bangunDistrik() {
    if (dinamis) scene.remove(dinamis);
    dinamis = new THREE.Group(); scene.add(dinamis);
    rumahKlik.length = 0; npcList.length = 0; rintanganDetail.length = 0;
    /* Penempatan ?v=18 (keputusan Fahmi: "1 blok beda nomor rumah aja"):
       rumah detail berdiri di posisiKavling ASLI pemiliknya, rotasi 0 —
       menghadap +z (selatan), teras di sisi yang sama seperti rumah
       massal — menggantikan instans massalnya di petak itu. Instans
       massal kavling detail dilewati bangunKotaMassal, dan tabrakannya
       dipegang rintanganDetail di sini (bukan tabrakanRumahMassal).
       Atap = warna baju pemilik; dinding & varian/cerobong atap memakai
       rumus hash yang sama dengan instans massal untuk nomor rumah
       global yang sama, jadi rumah detail terbaca sebagai versi rinci
       dari rumah yang sama. NPC doppelganger tetap di plaza (di bawah). */
    wargaTerbaru.slice(0, 30).forEach((w, i) => {
      const pos = posisiKavling(w.blok, w.kavling);
      const nomorGlobal = (w.blok - 1) * PER_BLOK + w.kavling; // nomor hash yang sama dengan instans massal
      const bi = w.blok - 1;
      const zonaW = zonaDariKolBar(bi % BLOK_KOLOM, Math.floor(bi / BLOK_KOLOM));
      const hslD = warnaDindingZonaHSL(zonaW, hashInt(nomorGlobal * 11 + 3), hashInt(nomorGlobal * 13 + 5));
      const warnaD = new THREE.Color(); warnaD.setHSL(hslD[0], hslD[1], hslD[2]);
      const warnaA = new THREE.Color(warnaPemilik.get(w.blok + "," + w.kavling) || w.warna_baju || "#b5533c");
      const h2 = hashInt(nomorGlobal * 7 + 1); // varian atap sama seperti instans massal
      const varian = h2 < 0.55 ? 0 : h2 < 0.85 ? 1 : 2;
      const cerobong = h2 < 0.85 && hashInt(nomorGlobal * 13 + 5) < 0.35;
      const rumah = buatRumahDetail(warnaD.getHex(), warnaA.getHex(), varian, cerobong);
      rumah.userData.pemilik = w; rumah.userData.nomor = w.nomor_rumah;
      rumah.scale.setScalar(1.55); // sebanding dengan rumah instanced skala baru
      rumah.position.set(pos.x, 0, pos.z); rumah.rotation.y = 0;
      // Titik pintu untuk fitur interior: doorstep 6,4 satuan di depan
      // wajah rumah (sisi +z, arah hadap rumah massal); di luar AABB-nya.
      rumah.userData.pintu = { x: pos.x, z: pos.z + 6.4 };
      const label = buatLabel("@" + w.username, 5, w.jabatan || null);
      label.position.set(0, 7.4, 0); rumah.add(label);
      dinamis.add(rumah); rumahKlik.push(rumah);
      rintanganDetail.push({ minX: pos.x - 4.6, maxX: pos.x + 4.6, minZ: pos.z - 4.2, maxZ: pos.z + 4.2 }); // tapak detail — cakupan tabrakan kavling ini
      const kar = buatKarakter({ baju: w.warna_baju, kulit: w.warna_kulit, topi: w.topi });
      kar.scale.setScalar(1.35);
      kar.userData.username = w.username; // dipakai multiplayer: NPC disembunyikan saat orangnya online
      const lb = buatLabel("@" + w.username, 4.2, w.jabatan || null); lb.position.y = 2.5; kar.add(lb);
      kar.userData.fase = (i / Math.max(1, Math.min(30, wargaTerbaru.length))) * PANJANG_JALUR + i * 5.3;
      /* Aktivitas prosedural (Paket 1 ?v=15): peran dari LOGIKA AKTIVITAS
         NPC — pembawa membawa properti di depan dada, pengobrol & yang
         duduk ditempatkan statis sekarang juga (pose duduk: kaki diputar
         ke depan dari pivot pinggul, badan diturunkan ke tinggi dudukan
         bangku 0,89 - pivot 0,52 = 0,37). */
      const akt = aktivitasUntukNpc(i);
      kar.userData.aktivitas = akt;
      if (akt.jenis === "pembawa") {
        let alat;
        if (akt.alat === "karung") {
          alat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 0), M(0xb59a6a));
          alat.scale.set(1, 0.88, 1); alat.castShadow = true;
        } else {
          alat = kotak(0.58, 0.58, 0.58, 0xa9743f, 0, 0, 0);
        }
        alat.position.set(0, 0.98, 0.46); kar.add(alat);
      } else if (akt.jenis === "ngobrol") {
        kar.position.set(akt.x, 0.3, akt.z); kar.rotation.y = akt.hadap;
      } else if (akt.jenis === "duduk") {
        kar.position.set(akt.x, 0.37, akt.z); kar.rotation.y = akt.rot;
        kar.userData.kakiK.rotation.x = -1.25; kar.userData.kakiR.rotation.x = -1.25;
      }
      dinamis.add(kar); npcList.push(kar);
    });
    gambarPapan();
    gambarPapanRencana(); // status fasilitas segar dari dataPembangunan yang baru dibaca
  }

  /* ---------- Awan: 18 kelompok, tiap kelompok 1 mesh gabungan (1 draw call) ---------- */
  const awanGrup = new THREE.Group(); scene.add(awanGrup);
  const matAwan = new THREE.MeshStandardMaterial({
    color: 0xfff8ec, roughness: 1, transparent: true, opacity: 0.94,
    emissive: 0xffd9a0, emissiveIntensity: 0.22, // pantulan hangat golden hour
  });
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(geometriAwan(i + 1), matAwan);
    m.position.set(-2600 + hashInt(i * 31) * 5200, 150 + hashInt(i * 17) * 110, -1800 + hashInt(i * 13) * 3600);
    m.userData.kecepatan = 0.35 + hashInt(i * 7) * 0.4;
    awanGrup.add(m);
  }

  /* ================= KAMERA ORBIT ================= */
  let theta = 0.8, phi = 1.02, radius = 300, putarOtomatis = true;
  const target = new THREE.Vector3(0, 0, 6);
  function terapkanKamera() {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    matahari.position.set(target.x + OFSET_MATAHARI.x, OFSET_MATAHARI.y, target.z + OFSET_MATAHARI.z);
    matahari.target.position.set(target.x, 0, target.z);
  }
  function fokusKe(x, z, r) {
    target.set(x, 0, z); radius = r || 60; interaksiTerakhir = 0;
  }
  const penunjuk = new Map(); let jarakCubit = 0, gerakSentuh = 0, waktuSentuh = 0, interaksiTerakhir = 0;
  kanvas.addEventListener("pointerdown", (e) => {
    penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gerakSentuh = 0; waktuSentuh = performance.now(); interaksiTerakhir = performance.now();
    if (penunjuk.size === 2) { const p = [...penunjuk.values()]; jarakCubit = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
  });
  kanvas.addEventListener("pointermove", (e) => {
    if (!penunjuk.has(e.pointerId)) return;
    const lama = penunjuk.get(e.pointerId);
    const dx = e.clientX - lama.x, dy = e.clientY - lama.y;
    penunjuk.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gerakSentuh += Math.abs(dx) + Math.abs(dy); interaksiTerakhir = performance.now();
    if (penunjuk.size === 1) {
      if (modeKamera === "orbit") {
        theta -= dx * 0.0045;
        phi = Math.min(1.42, Math.max(0.3, phi - dy * 0.0038));
      } else if (modeKamera === "orang") {
        fp.yaw -= dx * 0.0042;
        fp.pitch = Math.min(1.35, Math.max(-1.35, fp.pitch - dy * 0.0042));
      } else if (modeKamera === "ketiga") {
        tp.yaw -= dx * 0.0042; // seret = putar kamera mengelilingi karakter
        tp.pitch = Math.min(1.15, Math.max(-0.1, tp.pitch + dy * 0.0038));
      } else {
        dr.yaw -= dx * 0.0042;
        dr.pitch = Math.min(1.5, Math.max(-1.5, dr.pitch - dy * 0.0042));
      }
    } else if (penunjuk.size === 2) {
      const p = [...penunjuk.values()];
      const j = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (jarakCubit) {
        if (modeKamera === "orbit") radius = Math.min(2800, Math.max(20, radius * (jarakCubit / j)));
        else if (modeKamera === "drone") dr.y = Math.min(1000, Math.max(3, dr.y * (jarakCubit / j)));
        else if (modeKamera === "ketiga") tp.jarak = Math.min(12, Math.max(4, tp.jarak * (jarakCubit / j)));
      }
      jarakCubit = j;
    }
  });
  function akhirSentuh(e) {
    const ketuk = penunjuk.size === 1 && gerakSentuh < 7 && performance.now() - waktuSentuh < 350;
    penunjuk.delete(e.pointerId);
    if (ketuk) ketukRumah(e.clientX, e.clientY);
  }
  kanvas.addEventListener("pointerup", akhirSentuh);
  kanvas.addEventListener("pointercancel", (e) => penunjuk.delete(e.pointerId));
  kanvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    interaksiTerakhir = performance.now();
    if (modeKamera === "orbit") {
      radius = Math.min(2800, Math.max(20, radius * (e.deltaY > 0 ? 1.1 : 0.9)));
    } else if (modeKamera === "drone") {
      const s = e.deltaY > 0 ? -30 : 30; // scroll = maju/mundur mengikuti arah pandang
      dr.x += -Math.sin(dr.yaw) * Math.cos(dr.pitch) * s;
      dr.y += Math.sin(dr.pitch) * s;
      dr.z += -Math.cos(dr.yaw) * Math.cos(dr.pitch) * s;
      dr.y = Math.min(1000, Math.max(3, dr.y));
    } else if (modeKamera === "ketiga") {
      tp.jarak = Math.min(12, Math.max(4, tp.jarak * (e.deltaY > 0 ? 1.15 : 0.87))); // scroll = zoom kamera 3rd Person
    } else {
      const s = e.deltaY > 0 ? -9 : 9; // scroll = melangkah maju/mundur
      fp.x += -Math.sin(fp.yaw) * s;
      fp.z += -Math.cos(fp.yaw) * s;
      if (diInterior) {
        const pos = tabrakanInterior(fp.x, fp.z);
        fp.x = Math.min(INT.x + INT.sw - 0.75, Math.max(INT.x - INT.sw + 0.75, pos.x));
        fp.z = Math.min(INT.z + INT.sd - 0.75, Math.max(INT.z - INT.sd + 0.75, pos.z));
      } else {
        const pos = tabrakan(fp.x, fp.z);
        fp.x = Math.min(BATAS_X - 2, Math.max(-BATAS_X + 2, pos.x));
        fp.z = Math.min(BATAS_Z - 2, Math.max(-BATAS_Z + 2, pos.z));
      }
    }
  }, { passive: false });

  const ray = new THREE.Raycaster(); const v2 = new THREE.Vector2();
  function ketukRumah(cx, cy) {
    if (diInterior) { // di dalam rumah: ketuk saat berdiri di depan pintu keluar = keluar
      if (dekatPintuKeluar()) keluarInterior();
      return;
    }
    v2.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const kena = ray.intersectObjects(rumahKlik, true);
    if (!kena.length) return;
    let obj = kena[0].object;
    while (obj && !obj.userData.pemilik) obj = obj.parent;
    if (!obj) return;
    const w = obj.userData.pemilik;
    // Mode jalan (1st/3rd Person) + sudah dekat pintu (<= 14 satuan dari doorstep): ketuk rumah = masuk.
    if ((modeKamera === "orang" || modeKamera === "ketiga") && obj.userData.pintu &&
        Math.hypot(fp.x - obj.userData.pintu.x, fp.z - obj.userData.pintu.z) < 14) {
      masukInterior(w, obj);
      return;
    }
    $("#kartu .isi").innerHTML = "<h3>" + IK.rumah + " Rumah @" + w.username + "</h3><p>Rumah No. " + w.nomor_rumah +
      " · Blok " + w.blok + " Kavling " + w.kavling + "<br>" +
      (w.jabatan ? "Jabatan: <b>" + w.jabatan + "</b><br>" : "") +
      "Warga resmi Negara Merdu. Rumah detailnya dipajang di Distrik Pusat.</p>" +
      '<button class="btn-masuk" id="btn-masuk-rumah" type="button">' + IK.pintu + ' Masuk Rumah</button>';
    $("#kartu").hidden = false;
    $("#btn-masuk-rumah").addEventListener("click", () => { $("#kartu").hidden = true; masukInterior(w, obj); });
  }
  $("#kartu .tutup").addEventListener("click", () => { $("#kartu").hidden = true; });

  /* ================= MODE KAMERA: ORBIT / 1ST PERSON / DRONE ================= */
  let modeKamera = "orbit";
  const fp = { x: 8, z: 22, yaw: 0.35, pitch: 0 };          // 1st Person: posisi di tanah + arah pandang
  const dr = { x: 0, y: 140, z: 320, yaw: 0, pitch: -0.4 }; // Drone: posisi terbang bebas + arah pandang
  /* 3rd Person: posisi pemain memakai fp yang sama; tp = orbit kamera di
     sekeliling karakter. yaw/pitch mengikuti konvensi fp (arah pandang kamera
     = (-sin yaw, -cos yaw)); hadap = arah menghadap MODEL karakter (konvensi
     model: +Z lokal menunjuk (sin hadap, cos hadap)); kam* = posisi kamera
     terlicin (null = tempel ke posisi ideal pada frame berikutnya). */
  const tp = { yaw: 0.35, pitch: 0.32, jarak: 6.5, hadap: 0, kamX: null, kamY: null, kamZ: null };
  let karSaya = null, kunciRupaSaya = ""; // karakter pemain sendiri (hanya tampil di 3rd Person)
  const joy = { x: 0, y: 0 };
  let tahanNaik = false, tahanTurun = false;
  const tombolKey = new Set();
  const BATAS_X = KOTA_W / 2, BATAS_Z = KOTA_D / 2;
  const jepit = (v, a, b) => Math.min(b, Math.max(a, v));

  addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // jangan rebut ketikan di form gerbang
    tombolKey.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  addEventListener("keyup", (e) => tombolKey.delete(e.code));
  addEventListener("blur", () => tombolKey.clear());

  function ikutiMatahari(x, z) {
    matahari.position.set(x + OFSET_MATAHARI.x, OFSET_MATAHARI.y, z + OFSET_MATAHARI.z);
    matahari.target.position.set(x, 0, z);
  }
  /* Tabrakan sederhana: lingkaran pemain (r=0,55) vs AABB rintangan, didorong keluar lewat sisi terdekat.
     Rintangan AABB: objek Distrik Pusat (balai, tugu, papan, rumah detail) +
     bangunan fasilitas terbangun. Rumah massal (InstancedMesh, tanpa AABB)
     ditangani tabrakanRumahMassal di bawah dengan perhitungan grid. */
  function tabrakanDi(x, z, daftarSemua) {
    const r = 0.55;
    for (const daftar of daftarSemua) {
      for (const b of daftar) {
        if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) {
          const dl = x - (b.minX - r), dkn = (b.maxX + r) - x;
          const dn = z - (b.minZ - r), df = (b.maxZ + r) - z;
          const m = Math.min(dl, dkn, dn, df);
          if (m === dl) x = b.minX - r; else if (m === dkn) x = b.maxX + r;
          else if (m === dn) z = b.minZ - r; else z = b.maxZ + r;
        }
      }
    }
    return { x, z };
  }
  /* ---------- Tabrakan rumah massal: grid matematis O(1) ----------
     Rumah massal adalah InstancedMesh — tidak ada AABB per rumah.
     Tapaknya diturunkan dari rumus penempatan yang sama dengan
     bangunKotaMassal: dinding BoxGeometry(8,6 x 7,6) tepat di pusat kavling,
     tanpa rotasi, jadi AABB-nya = pusat kavling ± (4,3 ; 3,8). Rumah hanya
     tampil di kavling TERISI (rumahTerisi dari data warga), jadi hanya
     kavling terisi yang ditabrak — lahan kosong bisa dilalui jalan kaki,
     tabrakan mengikuti tampilan persis.
     Dari posisi pemain dihitung blok + kavlingnya, lalu hanya kavling itu
     dan tetangga 1 petak di dalam blok yang sama yang diuji (maks 9 AABB,
     tanpa alokasi objek baru — pool dipakai ulang). Itu lengkap: dinding
     kavling sebelah berjarak >= 2,7 dari tepi petaknya dan jalan selebar 14
     memisahkan antarblok, keduanya jauh melebihi jangkauan lingkaran pemain
     (r=0,55) dari petak tetangga. Yang TIDAK ditabrak: atap (mulai di
     y>=3,8 — di atas kepala), teras (lantai rendah 0,3, bisa diinjak) dan
     dekorasi kavling (pagar/semak/pohon kecil, hanya di sebagian kavling). */
  const SETENGAH_TAPAK = { x: 8.6 / 2, z: 7.6 / 2 }; // setengah lebar/dalam dinding rumah massal
  const poolKandidat = [];
  for (let i = 0; i < 9; i++) poolKandidat.push({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  const viewKandidat = []; // referensi ke poolKandidat[0..n) untuk tabrakanDi
  function tabrakanRumahMassal(x, z) {
    const kol = Math.floor((x + KOTA_W / 2) / PITCH);
    const bar = Math.floor((z + KOTA_D / 2) / PITCH);
    if (kol < 0 || kol >= BLOK_KOLOM || bar < 0 || bar >= BLOK_BARIS) return { x, z };
    const kunci = kol + "," + bar;
    if (RESERVASI.has(kunci) || TAMAN.has(kunci)) return { x, z }; // pusat: rintangan(Detail); lahan pembangunan: tanpa rumah massal
    const s = sudutBlok(kol, bar);
    const blokNomor = bar * BLOK_KOLOM + kol + 1;
    const kx = Math.floor((x - s.x - JALAN) / KAV_PITCH);
    const kz = Math.floor((z - s.z - JALAN) / KAV_PITCH);
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const ax = kx + dx, az = kz + dz;
      if (ax < 0 || ax >= SISI || az < 0 || az >= SISI) continue;
      const kavlingNomor = az * SISI + ax + 1;
      const kunciKav = blokNomor + "," + kavlingNomor;
      if (!rumahTerisi.has(kunciKav)) continue; // lahan kosong: tidak ada rumah, tidak ditabrak
      if (rumahDetailSet.has(kunciKav)) continue; // rumah detail di petak ini: tabrakannya via rintanganDetail (bangunDistrik)
      const cx = s.x + JALAN + KAV_PITCH / 2 + ax * KAV_PITCH;
      const cz = s.z + JALAN + KAV_PITCH / 2 + az * KAV_PITCH;
      const b = poolKandidat[n];
      b.minX = cx - SETENGAH_TAPAK.x; b.maxX = cx + SETENGAH_TAPAK.x;
      b.minZ = cz - SETENGAH_TAPAK.z; b.maxZ = cz + SETENGAH_TAPAK.z;
      viewKandidat[n] = b; n++;
    }
    if (!n) return { x, z };
    viewKandidat.length = n;
    return tabrakanDi(x, z, [viewKandidat]);
  }
  function tabrakan(x, z) {
    const p = tabrakanDi(x, z, [rintangan, rintanganDetail, rintanganFasilitas]);
    return tabrakanRumahMassal(p.x, p.z); // wilayahnya terpisah dari AABB di atas (blok RESERVASI/TAMAN dilewati grid)
  }
  function tabrakanInterior(x, z) { return tabrakanDi(x, z, [rintanganInterior]); }
  function posisiDepanRumah(w) { // titik di jalan tepat di depan kavling warga
    const bi = w.blok - 1, bar = Math.floor(bi / BLOK_KOLOM), kol = bi % BLOK_KOLOM;
    const s = sudutBlok(kol, bar);
    const p = posisiKavling(w.blok, w.kavling);
    return { x: s.x + JALAN / 2, z: p.z };
  }
  function vektorGerak() { // gabungan keyboard + joystick, dinormalisasi
    let mx = 0, mz = 0;
    if (tombolKey.has("KeyW") || tombolKey.has("ArrowUp")) mz += 1;
    if (tombolKey.has("KeyS") || tombolKey.has("ArrowDown")) mz -= 1;
    if (tombolKey.has("KeyD") || tombolKey.has("ArrowRight")) mx += 1;
    if (tombolKey.has("KeyA") || tombolKey.has("ArrowLeft")) mx -= 1;
    mx += joy.x; mz += -joy.y;
    const p = Math.hypot(mx, mz);
    if (p > 1) { mx /= p; mz /= p; }
    return { mx, mz };
  }
  /* Gerak pemain di tanah — dipakai bersama oleh 1st & 3rd Person: memajukan
     fp mengikuti yawBasis (fp.yaw di 1st, tp.yaw di 3rd) dengan tabrakan yang
     sama persis. Mengembalikan jarak tempuh nyata frame ini (untuk animasi). */
  function langkahPemain(dt, yawBasis) {
    const g = vektorGerak();
    const cepat = (tombolKey.has("ShiftLeft") || tombolKey.has("ShiftRight")) ? 48 : 22;
    const fx = -Math.sin(yawBasis), fz = -Math.cos(yawBasis);
    const rx = Math.cos(yawBasis), rz = -Math.sin(yawBasis);
    const ox = fp.x, oz = fp.z;
    const nx = fp.x + (fx * g.mz + rx * g.mx) * cepat * dt;
    const nz = fp.z + (fz * g.mz + rz * g.mx) * cepat * dt;
    if (diInterior) { // di dalam rumah: tabrakan perabot + jepit di dalam dinding ruangan
      const pos = tabrakanInterior(nx, nz);
      fp.x = jepit(pos.x, INT.x - INT.sw + 0.75, INT.x + INT.sw - 0.75);
      fp.z = jepit(pos.z, INT.z - INT.sd + 0.75, INT.z + INT.sd - 0.75);
    } else {
      const pos = tabrakan(nx, nz);
      fp.x = jepit(pos.x, -BATAS_X + 2, BATAS_X - 2);
      fp.z = jepit(pos.z, -BATAS_Z + 2, BATAS_Z - 2);
    }
    return Math.hypot(fp.x - ox, fp.z - oz);
  }
  function updateOrang(dt) {
    langkahPemain(dt, fp.yaw);
    if (diInterior) camera.position.set(fp.x, INT.y + 1.6, fp.z); // mata 1,6 di atas lantai interior
    else camera.position.set(fp.x, 1.6, fp.z); // setinggi mata karakter (±1,6 satuan)
    camera.rotation.set(fp.pitch, fp.yaw, 0);
    ikutiMatahari(fp.x, fp.z);
  }
  /* ---------- 3rd Person ---------- */
  function lerpSudut(a, b, t) { // interpolasi sudut sadar lilitan ±π (murni)
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  /* Posisi kamera 3rd Person (murni): menggantung `jarak` di belakang
     karakter; titik pijak = dada karakter (y 1,5); pitch > 0 menaikkan
     kamera. Arah dari karakter ke kamera = kebalikan arah pandang yaw. */
  function posisiKameraKetiga(px, pz, yaw, pitch, jarak) {
    const cp = Math.cos(pitch);
    return {
      x: px + Math.sin(yaw) * cp * jarak,
      y: 1.5 + Math.sin(pitch) * jarak,
      z: pz + Math.cos(yaw) * cp * jarak,
    };
  }
  /* Tabrakan kamera sederhana: bila titik ideal jatuh di dalam tapak rumah
     (uji tabrakan yang sama seperti pemain), tarik kamera bertingkat lebih
     dekat ke karakter sampai titiknya bebas. */
  function kameraKetigaIdeal() {
    for (const f of [1, 0.75, 0.5, 0.3, 0.15]) {
      const c = posisiKameraKetiga(fp.x, fp.z, tp.yaw, tp.pitch, tp.jarak * f);
      const uji = tabrakan(c.x, c.z);
      if (Math.abs(uji.x - c.x) < 0.01 && Math.abs(uji.z - c.z) < 0.01) return c;
    }
    return posisiKameraKetiga(fp.x, fp.z, tp.yaw, tp.pitch, tp.jarak * 0.15);
  }
  function updateKetiga(dt) {
    const ox = fp.x, oz = fp.z;
    const jarak = langkahPemain(dt, tp.yaw);
    if (karSaya) {
      if (jarak > 0.001) // hadap mengikuti perpindahan nyata (termasuk meluncur di dinding)
        tp.hadap = lerpSudut(tp.hadap, Math.atan2(fp.x - ox, fp.z - oz), 1 - Math.exp(-dt * 12));
      const bob = animasiJalan(karSaya, jarak, dt);
      animasiHidup(karSaya, waktuLalu, jarak <= 0.001);
      karSaya.position.set(fp.x, 0.32 + bob * 0.07, fp.z);
      karSaya.rotation.y = tp.hadap;
    }
    const id = kameraKetigaIdeal();
    if (tp.kamX === null) {
      tp.kamX = id.x; tp.kamY = id.y; tp.kamZ = id.z;
    } else {
      // Mendekat (dinding di belakang) harus seketika supaya kamera tidak
      // menembus rumah; menjauh boleh halus.
      const dId = Math.hypot(id.x - fp.x, id.z - fp.z), dKam = Math.hypot(tp.kamX - fp.x, tp.kamZ - fp.z);
      const k = dId < dKam - 0.05 ? 1 : 1 - Math.exp(-dt * 11);
      tp.kamX += (id.x - tp.kamX) * k; tp.kamY += (id.y - tp.kamY) * k; tp.kamZ += (id.z - tp.kamZ) * k;
    }
    camera.position.set(tp.kamX, Math.max(0.6, tp.kamY), tp.kamZ);
    camera.lookAt(fp.x, 1.5, fp.z);
    ikutiMatahari(fp.x, fp.z);
  }
  /* Karakter pemain sendiri — selama ini tidak pernah di-render (1st Person
     = kamera di mata). Untuk 3rd Person ia dibangun dari penampilan sendiri;
     tamu (belum masuk) memakai rupa bawaan dan karakternya murni visual
     lokal (tamu memang tidak disiarkan server). Tanpa label nama di atas
     kepala sendiri. */
  function rupaSaya() {
    const s = sesi.saya;
    return s ? { baju: s.warna_baju, kulit: s.warna_kulit, topi: s.topi }
             : { baju: "#2e9e5b", kulit: "#f1c27d", topi: "tanpa" };
  }
  function segarkanKarakterSaya() {
    const r = rupaSaya();
    const kunci = [r.baju, r.kulit, r.topi].join("|");
    if (karSaya && kunci === kunciRupaSaya) return;
    if (karSaya) { scene.remove(karSaya); buangGrup(karSaya); karSaya = null; }
    kunciRupaSaya = kunci;
    karSaya = buatKarakter(r);
    karSaya.scale.setScalar(1.35); // skala sama seperti pemain lain & NPC
    karSaya.visible = false; // visibilitas diatur per frame di animasi()
    scene.add(karSaya);
  }
  function updateDrone(dt) {
    const g = vektorGerak();
    const cepat = (tombolKey.has("ShiftLeft") || tombolKey.has("ShiftRight")) ? 300 : 110;
    const cp = Math.cos(dr.pitch);
    const fx = -Math.sin(dr.yaw) * cp, fy = Math.sin(dr.pitch), fz = -Math.cos(dr.yaw) * cp;
    const rx = Math.cos(dr.yaw), rz = -Math.sin(dr.yaw);
    dr.x += (fx * g.mz + rx * g.mx) * cepat * dt;
    dr.y += fy * g.mz * cepat * dt; // maju mengikuti arah pandang (termasuk naik/turun saat menunduk/mendongak)
    dr.z += (fz * g.mz + rz * g.mx) * cepat * dt;
    let naik = 0;
    if (tombolKey.has("KeyR") || tombolKey.has("KeyE") || tahanNaik) naik += 1;
    if (tombolKey.has("KeyF") || tombolKey.has("KeyQ") || tahanTurun) naik -= 1;
    dr.y += naik * cepat * 0.85 * dt;
    dr.x = jepit(dr.x, -BATAS_X - 500, BATAS_X + 500);
    dr.z = jepit(dr.z, -BATAS_Z - 500, BATAS_Z + 500);
    dr.y = jepit(dr.y, 3, 1000);
    camera.position.set(dr.x, dr.y, dr.z);
    camera.rotation.set(dr.pitch, dr.yaw, 0);
    ikutiMatahari(dr.x, dr.z);
  }
  const PETUNJUK = {
    orbit: "Seret untuk memutar · Cubit/scroll untuk zoom",
    orang: "Joystick / WASD untuk jalan · Seret untuk melihat sekeliling",
    ketiga: "Joystick / WASD untuk jalan · Seret untuk memutar kamera",
    drone: "Joystick / WASD untuk terbang · R/F atau tombol layar untuk naik-turun",
  };
  let petunjukDitutup = false;
  function aturMode(m) {
    if (m === modeKamera) return;
    if (diInterior && m !== "orang") return; // di dalam rumah mode terkunci 1st Person; keluar dulu untuk ganti mode
    const lama = modeKamera;
    modeKamera = m;
    /* near/far per mode (anti z-fighting): Orbit & Drone melihat jauh -> near besar;
       1st Person butuh near kecil untuk objek dekat, far cukup melewati ujung kabut (5.600). */
    const NF = { orbit: [2, 13000], orang: [0.3, 9000], ketiga: [0.3, 9000], drone: [1.5, 13000] }[m];
    camera.near = NF[0]; camera.far = NF[1]; camera.updateProjectionMatrix();
    document.querySelectorAll("#mode-bar button").forEach((b) => b.classList.toggle("on", b.dataset.mode === m));
    $("#joystick").hidden = m === "orbit";
    $("#drone-naik-turun").hidden = m !== "drone";
    petunjukDitutup = false; // ganti mode = petunjuk mode baru tampil lagi
    $("#petunjuk-teks").textContent = PETUNJUK[m];
    $("#petunjuk").hidden = false;
    if (m === "orang" || m === "ketiga") {
      if (pulihInterior) {
        // kembali dari interior (keluarInterior): posisi fp sudah di pintu —
        // jangan ditimpa titik mulai biasa
        pulihInterior = false;
        fp.pitch = 0;
      } else if (diInterior) {
        // masuk interior: posisi fp sudah diatur masukInterior() — jangan ditimpa titik mulai biasa
        fp.pitch = 0;
      } else if (sesi.saya) { // mulai di jalan depan rumah sendiri, menghadap rumahnya
        const depan = posisiDepanRumah(sesi.saya);
        fp.x = depan.x; fp.z = depan.z; fp.yaw = -Math.PI / 2;
        fp.pitch = 0;
        const pos = tabrakan(fp.x, fp.z); fp.x = pos.x; fp.z = pos.z;
      } else if (lama === "drone") { // turun tepat di bawah posisi drone
        fp.x = jepit(dr.x, -BATAS_X + 2, BATAS_X - 2);
        fp.z = jepit(dr.z, -BATAS_Z + 2, BATAS_Z - 2);
        fp.yaw = dr.yaw;
        fp.pitch = 0;
        const pos = tabrakan(fp.x, fp.z); fp.x = pos.x; fp.z = pos.z;
      } else { // mulai di plaza, menghadap istana negara & Pak Presiden
        fp.x = 8; fp.z = 22; fp.yaw = Math.atan2(8, 22);
        fp.pitch = 0;
        const pos = tabrakan(fp.x, fp.z); fp.x = pos.x; fp.z = pos.z;
      }
      if (m === "ketiga") { // kamera mulai tepat di belakang arah pandang awal
        tp.yaw = fp.yaw; tp.hadap = fp.yaw + Math.PI; tp.kamX = null;
        segarkanKarakterSaya();
      }
    } else if (m === "drone") { // lanjut mulus dari posisi & arah kamera saat ini
      dr.x = jepit(camera.position.x, -BATAS_X - 500, BATAS_X + 500);
      dr.z = jepit(camera.position.z, -BATAS_Z - 500, BATAS_Z + 500);
      dr.y = jepit(Math.max(camera.position.y, 26), 10, 1000);
      const d = new THREE.Vector3(); camera.getWorldDirection(d);
      dr.yaw = Math.atan2(-d.x, -d.z);
      dr.pitch = Math.asin(jepit(d.y, -1, 1));
    } else { // kembali ke orbit: putar di sekitar posisi darat terakhir
      const gx = lama === "orang" ? fp.x : dr.x, gz = lama === "orang" ? fp.z : dr.z;
      target.set(jepit(gx, -BATAS_X, BATAS_X), 0, jepit(gz, -BATAS_Z, BATAS_Z));
      radius = 170; theta = 0.8; phi = 1.02;
    }
    perbaruiMinimapTampil();
    interaksiTerakhir = performance.now();
  }
  document.querySelectorAll("#mode-bar button").forEach((b) =>
    b.addEventListener("click", () => aturMode(b.dataset.mode)));

  /* ---------- Joystick virtual (HP) ---------- */
  const joyEl = $("#joystick"), knob = joyEl.querySelector(".knob");
  let joyId = null;
  function joyGerak(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const maks = r.width / 2 - 6, p = Math.hypot(dx, dy);
    if (p > maks) { dx *= maks / p; dy *= maks / p; }
    joy.x = dx / maks; joy.y = dy / maks;
    knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
  }
  joyEl.addEventListener("pointerdown", (e) => { joyId = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (err) {} joyGerak(e); e.preventDefault(); });
  joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) joyGerak(e); });
  function joyLepas(e) {
    if (e.pointerId !== joyId) return;
    joyId = null; joy.x = 0; joy.y = 0;
    knob.style.transform = "translate(-50%,-50%)";
  }
  joyEl.addEventListener("pointerup", joyLepas);
  joyEl.addEventListener("pointercancel", joyLepas);

  /* ---------- Tombol naik/turun drone (tahan) ---------- */
  function ikatTahan(el, set) {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); set(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, () => set(false)));
  }
  ikatTahan($("#tombol-naik"), (v) => { tahanNaik = v; });
  ikatTahan($("#tombol-turun"), (v) => { tahanTurun = v; });

  /* ================= INTERIOR RUMAH =================
     Satu ruangan template low-poly dibangun jauh di bawah kota (y=-600);
     pemain di-teleport ke sana dalam mode 1st Person. Dipersonalisasi per
     rumah yang dimasuki: papan nama pemilik + bingkai Kartu Warga Negara di dinding
     utara, warna aksen (karpet, gorden, selimut) mengikuti warna baju pemilik.
     Yang bisa dimasuki di v1: rumah detail Distrik Pusat (30 warga terbaru)
     dan rumah user sendiri (lewat tombol di Kartu Warga Negara).
     Kunjungan bersifat SOLO: pemain lain tidak ikut masuk. Selama user di
     dalam, kirimPosisi() mengirim posisi PINTU rumah itu — di mata pemain
     lain karakternya tetap berdiri di depan pintu, bukan melompat ke
     koordinat interior (lihat catatan di kirimPosisi). */
  const INT = { x: 0, y: -600, z: 0, sw: 8, sd: 6.5, tinggi: 5.4 }; // sw/sd = setengah lebar/dalam ruangan
  let diInterior = false, interiorKonteks = null, grupInterior = null, rumahDekat = null;
  let pulihInterior = false; // penanda keluarInterior -> aturMode: posisi fp jangan ditimpa titik mulai
  const rintanganInterior = []; // AABB perabot, koordinat dunia (lokal + INT)

  function teksturLantaiKayu() {
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const c = cv.getContext("2d");
    const nada = ["#b0864f", "#a87c46", "#bb8f58", "#a3763f"];
    for (let r = 0; r < 4; r++) {
      c.fillStyle = nada[r]; c.fillRect(0, r * 64, 256, 64);
      c.fillStyle = "rgba(90,55,20,0.55)"; c.fillRect(0, r * 64, 256, 3);
      c.fillRect((r * 97) % 256, r * 64, 3, 64); // sambungan papan
      c.fillStyle = "rgba(255,235,200,0.07)";
      for (let i = 0; i < 6; i++) c.fillRect((i * 53 + r * 31) % 256, r * 64 + 12 + (i * 29) % 40, 34, 4);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2.5);
    return t;
  }
  function teksturPapanNamaRumah(w) { // papan alamat rumah warga — nama WAJIB beda dari teksturPapanNama fasilitas (tabrakan nama lama membuat papan fasilitas terbaca "@undefined", laporan Fahmi 2026-11-22)
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 240;
    const c = cv.getContext("2d");
    c.fillStyle = "#fff8ea"; c.fillRect(0, 0, 1024, 240);
    c.strokeStyle = "#7a4a21"; c.lineWidth = 14; c.strokeRect(8, 8, 1008, 224);
    c.fillStyle = "#21332a"; c.textAlign = "center";
    c.font = "bold 84px system-ui, sans-serif";
    c.fillText("@" + w.username, 512, 106, 940);
    c.font = "bold 56px system-ui, sans-serif"; c.fillStyle = "#2e7d46";
    c.fillText("Rumah No. " + w.nomor_rumah + " · Blok " + w.blok + " · Kavling " + w.kavling, 512, 190, 940);
    return new THREE.CanvasTexture(cv);
  }
  function teksturKartuWarga(w) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 320;
    const c = cv.getContext("2d");
    const grd = c.createLinearGradient(0, 0, 512, 320);
    grd.addColorStop(0, "#2e9e5b"); grd.addColorStop(1, "#57b96f");
    c.fillStyle = grd; c.fillRect(0, 0, 512, 320);
    c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 6; c.strokeRect(12, 12, 488, 296);
    c.fillStyle = "#ffffff"; c.textAlign = "left";
    c.font = "600 27px system-ui, sans-serif"; c.globalAlpha = 0.9;
    c.fillText("N E G A R A   M E R D U", 36, 58);
    c.globalAlpha = 1; c.font = "800 62px system-ui, sans-serif";
    c.fillText("@" + w.username, 36, 148, 440);
    c.font = "400 37px system-ui, sans-serif";
    c.fillText("Rumah No. " + w.nomor_rumah + " · Blok " + w.blok + " Kavling " + w.kavling, 36, 214, 440);
    c.font = "400 27px system-ui, sans-serif"; c.globalAlpha = 0.85;
    c.fillText("Kartu Warga Negara resmi · @negaramerdu", 36, 272);
    c.globalAlpha = 1;
    return new THREE.CanvasTexture(cv);
  }
  function teksturJendela() {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 176;
    const c = cv.getContext("2d");
    const grd = c.createLinearGradient(0, 0, 0, 176);
    grd.addColorStop(0, "#8ec9f2"); grd.addColorStop(0.75, "#dff2ff"); grd.addColorStop(0.76, "#8fce5e"); grd.addColorStop(1, "#6db84f");
    c.fillStyle = grd; c.fillRect(0, 0, 256, 176);
    c.fillStyle = "#ffd76a"; c.beginPath(); c.arc(52, 44, 20, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.92)";
    for (const [x, y, s] of [[120, 38, 1], [185, 62, 0.7], [80, 74, 0.55]]) {
      c.beginPath(); c.arc(x, y, 13 * s, 0, Math.PI * 2); c.arc(x + 14 * s, y + 3 * s, 10 * s, 0, Math.PI * 2); c.arc(x - 14 * s, y + 3 * s, 9 * s, 0, Math.PI * 2); c.fill();
    }
    return new THREE.CanvasTexture(cv);
  }
  function teksturLayarTV() {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 288;
    const c = cv.getContext("2d");
    const grd = c.createLinearGradient(0, 0, 0, 288);
    grd.addColorStop(0, "#16222e"); grd.addColorStop(1, "#2a4a63");
    c.fillStyle = grd; c.fillRect(0, 0, 512, 288);
    c.fillStyle = "#ffd76a"; c.textAlign = "center";
    c.font = "800 62px system-ui, sans-serif"; c.fillText("TV PINARAK", 256, 138);
    c.fillStyle = "#cfe8ff"; c.font = "400 30px system-ui, sans-serif";
    c.fillText("Siaran langsung dari Istana Negara", 256, 192);
    c.fillStyle = "#d63b2f"; c.beginPath(); c.arc(52, 48, 11, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffffff"; c.font = "700 25px system-ui, sans-serif"; c.textAlign = "left";
    c.fillText("LIVE", 72, 57);
    return new THREE.CanvasTexture(cv);
  }
  function teksturDindingDalam() { // krem lembut: garis vertikal sangat halus + bintik samar — dinding tidak polos
    const cv = document.createElement("canvas"); cv.width = cv.height = 256;
    const c = cv.getContext("2d");
    c.fillStyle = "#fdf3d8"; c.fillRect(0, 0, 256, 256);
    c.fillStyle = "rgba(196,164,110,0.06)";
    for (let x = 0; x < 256; x += 32) c.fillRect(x, 0, 13, 256);
    c.fillStyle = "rgba(150,120,70,0.05)";
    for (let i = 0; i < 260; i++) c.fillRect((i * 67) % 256, (i * 113) % 256, 3, 3);
    c.fillStyle = "rgba(255,255,255,0.10)";
    for (let i = 0; i < 160; i++) c.fillRect((i * 97 + 31) % 256, (i * 57 + 11) % 256, 2, 2);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1.4);
    return t;
  }
  function teksturLukisan(varian) { // lukisan low-poly sederhana: langit, matahari, gunung segitiga, tanah
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 176;
    const c = cv.getContext("2d");
    const senja = varian === 1;
    const grd = c.createLinearGradient(0, 0, 0, 176);
    if (senja) { grd.addColorStop(0, "#f7b267"); grd.addColorStop(1, "#f4845f"); }
    else { grd.addColorStop(0, "#8ec9f2"); grd.addColorStop(1, "#dff2ff"); }
    c.fillStyle = grd; c.fillRect(0, 0, 256, 176);
    c.fillStyle = senja ? "#fff3b0" : "#ffd76a";
    c.beginPath(); c.arc(senja ? 196 : 56, 44, 19, 0, Math.PI * 2); c.fill();
    c.fillStyle = senja ? "#7f5539" : "#5b8e7d";
    c.beginPath(); c.moveTo(-10, 132); c.lineTo(72, 58); c.lineTo(140, 132); c.closePath(); c.fill();
    c.fillStyle = senja ? "#9c6644" : "#74a57f";
    c.beginPath(); c.moveTo(96, 132); c.lineTo(178, 70); c.lineTo(266, 132); c.closePath(); c.fill();
    c.fillStyle = senja ? "#606c38" : "#6db84f"; c.fillRect(0, 132, 256, 44);
    c.fillStyle = "rgba(255,255,255,0.85)";
    for (const [x, y] of [[120, 34], [36, 66]]) { c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.arc(x + 11, y + 2, 7, 0, Math.PI * 2); c.fill(); }
    return new THREE.CanvasTexture(cv);
  }
  function teksturCahayaLantai() { // genangan cahaya lembut dari jendela: gradasi radial hangat -> transparan
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const grd = c.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,226,160,0.85)");
    grd.addColorStop(0.6, "rgba(255,214,140,0.35)");
    grd.addColorStop(1, "rgba(255,214,140,0)");
    c.fillStyle = grd; c.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }
  function bangunInterior(w) {
    if (grupInterior) { scene.remove(grupInterior); buangGrup(grupInterior); grupInterior = null; }
    rintanganInterior.length = 0;
    const aksen = parseInt((w.warna_baju || "#2e9e5b").slice(1), 16);
    const aksenGelap = new THREE.Color(aksen).multiplyScalar(0.68).getHex(); // turunan aksen untuk kain lempar/batas karpet (skill-3d)
    const T = INT.tinggi;
    const g = new THREE.Group();
    g.position.set(INT.x, INT.y, INT.z);
    const K = (lebar, tinggi, dalam, warna, x, y, z) => { // kotak interior: tanpa bayangan jatuh, tetap menerima
      const m = kotak(lebar, tinggi, dalam, warna, x, y, z);
      m.castShadow = false; g.add(m); return m;
    };
    const halang = (minX, maxX, minZ, maxZ) =>
      rintanganInterior.push({ minX: INT.x + minX, maxX: INT.x + maxX, minZ: INT.z + minZ, maxZ: INT.z + maxZ });
    // Dinding bertekstur lembut (satu material bersama untuk semua sisi).
    const matDinding = new THREE.MeshStandardMaterial({ map: teksturDindingDalam(), roughness: 0.96 });
    const KD = (lebar, tinggi, dalam, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(lebar, tinggi, dalam), matDinding);
      m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m;
    };

    // lantai kayu + plafon
    const lantai = new THREE.Mesh(new THREE.BoxGeometry(INT.sw * 2 + 0.8, 0.3, INT.sd * 2 + 0.8),
      new THREE.MeshStandardMaterial({ map: teksturLantaiKayu(), roughness: 0.9 }));
    lantai.position.y = -0.15; lantai.receiveShadow = true; g.add(lantai);
    K(INT.sw * 2 + 0.8, 0.3, INT.sd * 2 + 0.8, 0xf3e9d2, 0, T + 0.15, 0); // plafon
    K(INT.sw * 2, 0.26, 0.3, 0x7a4a21, 0, T - 0.13, -3.2); // balok plafon kayu (skill-3d: struktur langit-langit)
    K(INT.sw * 2, 0.26, 0.3, 0x7a4a21, 0, T - 0.13, 3.2);
    // dinding utara & barat & timur utuh; selatan berlubang pintu (lebar 2,2, tinggi 2,7)
    KD(INT.sw * 2 + 0.8, T, 0.4, 0, T / 2, -INT.sd - 0.2);
    KD(0.4, T, INT.sd * 2 + 0.8, -INT.sw - 0.2, T / 2, 0);
    KD(0.4, T, INT.sd * 2 + 0.8, INT.sw + 0.2, T / 2, 0);
    KD(7.3, T, 0.4, -4.75, T / 2, INT.sd + 0.2);
    KD(7.3, T, 0.4, 4.75, T / 2, INT.sd + 0.2);
    KD(2.2, T - 2.7, 0.4, 0, (2.7 + T) / 2, INT.sd + 0.2); // ambang atas pintu
    // Wainscot (panel bawah lebih dalam) + lis alas di semua dinding —
    // ruangan tidak lagi polos; pintu selatan dibiarkan bebas.
    const WSC = 0xf1e0bc, LIS = 0xe2cd9f;
    K(INT.sw * 2, 1.05, 0.06, WSC, 0, 0.525, -INT.sd + 0.03);
    K(0.06, 1.05, INT.sd * 2, WSC, -INT.sw + 0.03, 0.525, 0);
    K(0.06, 1.05, INT.sd * 2, WSC, INT.sw - 0.03, 0.525, 0);
    K(6.9, 1.05, 0.06, WSC, -4.55, 0.525, INT.sd - 0.03);
    K(6.9, 1.05, 0.06, WSC, 4.55, 0.525, INT.sd - 0.03);
    K(INT.sw * 2, 0.2, 0.09, LIS, 0, 0.1, -INT.sd + 0.045);
    K(0.09, 0.2, INT.sd * 2, LIS, -INT.sw + 0.045, 0.1, 0);
    K(0.09, 0.2, INT.sd * 2, LIS, INT.sw - 0.045, 0.1, 0);
    K(6.9, 0.2, 0.09, LIS, -4.55, 0.1, INT.sd - 0.045);
    K(6.9, 0.2, 0.09, LIS, 4.55, 0.1, INT.sd - 0.045);
    // Cahaya pengisi lembut ruangan + arah cahaya siang dari jendela utara.
    g.add(new THREE.HemisphereLight(0xfff3e0, 0x907050, 0.38));
    const cahayaJendela = new THREE.DirectionalLight(0xffdfae, 0.55);
    cahayaJendela.position.set(4.6, 3.6, -INT.sd + 0.3);
    cahayaJendela.target.position.set(2.2, 0.6, -1.5);
    g.add(cahayaJendela); g.add(cahayaJendela.target);
    K(2.1, 2.7, 0.14, 0x7a4a21, 0, 1.35, INT.sd + 0.12);           // daun pintu (tertutup)
    const gagang = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M(0xf2b13d, 0.4));
    gagang.position.set(0.78, 1.35, INT.sd - 0.02); g.add(gagang);
    // dinding utara: papan nama pemilik + bingkai Kartu Warga Negara + jendela bergorden aksen
    K(6.7, 1.8, 0.1, 0x7a4a21, -3.4, 3.6, -INT.sd + 0.04);
    const papanNama = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.5),
      new THREE.MeshStandardMaterial({ map: teksturPapanNamaRumah(w), roughness: 0.9 }));
    papanNama.position.set(-3.4, 3.6, -INT.sd + 0.1); g.add(papanNama);
    K(3.2, 2.1, 0.1, 0x7a4a21, -3.4, 1.5, -INT.sd + 0.04);
    const bingkai = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.8),
      new THREE.MeshStandardMaterial({ map: teksturKartuWarga(w), roughness: 0.85 }));
    bingkai.position.set(-3.4, 1.5, -INT.sd + 0.1); g.add(bingkai);
    K(2.9, 2.1, 0.12, 0x7a4a21, 4.6, 3.1, -INT.sd + 0.04); // kusen jendela
    const kaca = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.75),
      new THREE.MeshBasicMaterial({ map: teksturJendela() }));
    kaca.position.set(4.6, 3.1, -INT.sd + 0.11); g.add(kaca);
    K(0.09, 1.75, 0.05, 0x7a4a21, 4.6, 3.1, -INT.sd + 0.13);
    K(2.55, 0.09, 0.05, 0x7a4a21, 4.6, 3.1, -INT.sd + 0.13);
    K(0.55, 2.4, 0.16, aksen, 2.9, 3.0, -INT.sd + 0.16);  // gorden kiri — warna baju pemilik
    K(0.55, 2.4, 0.16, aksen, 6.3, 3.0, -INT.sd + 0.16);  // gorden kanan
    K(3.0, 0.09, 0.24, 0x7a4a21, 4.6, 2.0, -INT.sd + 0.14); // ambang jendela kayu (skill-3d)
    const potAmbang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.11, 7), M(0xb56545));
    potAmbang.position.set(3.55, 2.10, -INT.sd + 0.14); g.add(potAmbang);
    const daunAmbang = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), M(0x4da653));
    daunAmbang.position.set(3.55, 2.22, -INT.sd + 0.14); g.add(daunAmbang);
    // genangan cahaya siang di lantai bawah jendela (bidang gradasi lembut)
    const genangan = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.6),
      new THREE.MeshBasicMaterial({ map: teksturCahayaLantai(), transparent: true, opacity: 0.35, depthWrite: false }));
    genangan.rotation.x = -Math.PI / 2; genangan.rotation.z = 0.35;
    genangan.position.set(4.35, 0.03, -4.1); g.add(genangan);
    // rak buku di dinding utara (antara papan nama dan jendela): rangka +
    // 3 tingkat buku warna-warni berpola deterministik + vas kecil di atas
    const KAYU_RAK = 0x8a5a30;
    K(0.07, 2.3, 0.45, KAYU_RAK, 0.435, 1.15, -6.22);
    K(0.07, 2.3, 0.45, KAYU_RAK, 2.765, 1.15, -6.22);
    K(2.4, 0.07, 0.45, KAYU_RAK, 1.6, 2.33, -6.22);
    K(2.4, 0.12, 0.45, KAYU_RAK, 1.6, 0.06, -6.22);
    for (const sy of [0.75, 1.35]) K(2.26, 0.05, 0.4, KAYU_RAK, 1.6, sy, -6.22);
    const WARNA_BUKU = [0xd9462e, 0x3f6fb5, 0xe8c268, 0x43a06a, 0x8e5ea2, 0xe07a3f, 0x4a7a8c, 0xc2b280];
    for (let tingkat = 0; tingkat < 3; tingkat++) {
      const dasarY = [0.12, 0.775, 1.375][tingkat];
      let bx = 0.58;
      for (let i = 0; i < 14 && bx < 2.55; i++) {
        const h1 = hashInt(tingkat * 131 + i * 17 + 5), h2 = hashInt(tingkat * 57 + i * 29 + 11);
        if (h1 < 0.14) { bx += 0.16; continue; } // celah kosong sesekali
        const lebarB = 0.09 + h2 * 0.06, tinggiB = 0.3 + h1 * 0.15;
        K(lebarB, tinggiB, 0.26, WARNA_BUKU[Math.floor(h2 * WARNA_BUKU.length) % WARNA_BUKU.length],
          bx + lebarB / 2, dasarY + tinggiB / 2, -6.22);
        bx += lebarB + 0.015;
      }
    }
    const vas = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.3, 8), M(0xb5533c));
    vas.position.set(1.0, 2.52, -6.22); g.add(vas);
    const bungaVas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), M(0xe07a9f));
    bungaVas.position.set(1.0, 2.78, -6.22); g.add(bungaVas);
    halang(0.3, 2.9, -6.5, -5.9);
    // jam dinding di dinding barat di atas kasur (± pukul 10:10)
    const rimJam = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.07, 20), M(0x7a4a21));
    rimJam.rotation.z = Math.PI / 2; rimJam.position.set(-INT.sw + 0.06, 3.15, -3.2); g.add(rimJam);
    const mukaJam = new THREE.Mesh(new THREE.CircleGeometry(0.38, 20),
      new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9 }));
    mukaJam.rotation.y = Math.PI / 2; mukaJam.position.set(-INT.sw + 0.1, 3.15, -3.2); g.add(mukaJam);
    const jarumPanjang = K(0.02, 0.3, 0.045, 0x2a2320, -INT.sw + 0.11, 3.24, -3.29);
    jarumPanjang.rotation.x = -0.785;
    const jarumPendek = K(0.02, 0.2, 0.045, 0x2a2320, -INT.sw + 0.11, 3.21, -3.14);
    jarumPendek.rotation.x = 0.785;
    const titikJam = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xb5533c));
    titikJam.position.set(-INT.sw + 0.11, 3.15, -3.2); g.add(titikJam);
    // sudut tidur (barat laut): sandaran selebar rangka di ujung kepala (utara),
    // rangka -> kasur (atas y=0,74) -> selimut duduk tepat di atasnya, ujung
    // rata kaki kasur -> lipatan di atas selimut -> dua bantal berjajar di kepala
    K(2.2, 1.2, 0.18, 0x8a5a30, -6.7, 0.6, -5.19);         // sandaran kepala — menempel muka ujung utara rangka
    K(2.2, 0.45, 3.8, 0x8a5a30, -6.7, 0.23, -3.2);         // rangka kasur
    K(2.1, 0.28, 3.7, 0xfff6e8, -6.7, 0.6, -3.2);          // kasur
    K(2.14, 0.14, 2.3, aksen, -6.7, 0.81, -2.5);           // selimut — warna baju pemilik
    K(2.14, 0.1, 0.5, 0xffffff, -6.7, 0.93, -3.35);        // lipatan selimut di atas selimut, dekat kepala
    K(2.14, 0.06, 0.7, aksenGelap, -6.7, 0.90, -1.72);     // kain lempar di kaki selimut (skill-3d; duduk di atas selimut, tumpukan kasur tak berubah)
    K(1.2, 0.2, 0.7, 0xffffff, -7.05, 0.84, -4.55);        // bantal
    K(0.62, 0.16, 0.5, aksen, -6.0, 0.82, -4.55);          // bantal kecil aksen pemilik di sebelahnya (celah 0,14)
    halang(-7.95, -5.5, -5.35, -1.2);
    // nakas di SISI TIMUR kepala kasur (di samping bantal) + lampu meja + buku
    K(0.9, 0.5, 0.6, 0x9c6a38, -4.85, 0.25, -4.8);
    K(0.7, 0.05, 0.45, 0x7a4a21, -4.85, 0.52, -4.8);       // laci nakas
    const kakiLampu = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.22, 8), M(0x37474f));
    kakiLampu.position.set(-4.95, 0.655, -4.9); g.add(kakiLampu);
    const kapMeja = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.2, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe1a8, emissive: 0xffc978, emissiveIntensity: 1.1, roughness: 0.8 }));
    kapMeja.position.set(-4.95, 0.85, -4.9); g.add(kapMeja);
    const lampuMeja = new THREE.PointLight(0xffc98a, 0.55, 8, 2);
    lampuMeja.position.set(-4.95, 1.0, -4.9); g.add(lampuMeja);
    K(0.34, 0.05, 0.26, 0x3f6fb5, -4.7, 0.57, -4.72);      // buku di nakas
    halang(-5.3, -4.4, -5.1, -4.5);
    // karpet tengah berbingkai — lapisan bawah aksen gelap + karpet aksen pemilik di atasnya
    K(6.0, 0.04, 4.6, aksenGelap, 0.6, 0.02, -0.6);
    K(5.6, 0.06, 4.2, aksen, 0.6, 0.03, -0.6);
    // meja kerja di dinding selatan (timur pintu): daun + kaki + buku + lampu kecil
    K(2.4, 0.12, 1.05, 0x8a5a30, 4.6, 1.0, 5.6);
    for (const [lx, lz] of [[3.55, 5.25], [5.65, 5.25], [3.55, 5.95], [5.65, 5.95]])
      K(0.12, 0.95, 0.12, 0x7a4a21, lx, 0.48, lz);
    K(0.5, 0.06, 0.36, 0xd9462e, 3.95, 1.09, 5.55);        // buku terbaca
    K(0.42, 0.05, 0.3, 0x3f6fb5, 3.95, 1.145, 5.55);       // buku kedua menumpuk
    K(0.3, 0.34, 0.24, 0xe8c268, 5.15, 1.23, 5.5);         // buku berdiri
    const kakiLampuMeja = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.18, 8), M(0x37474f));
    kakiLampuMeja.position.set(5.5, 1.15, 5.8); g.add(kakiLampuMeja);
    const kapLampuMeja = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.13, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe1a8, emissive: 0xffc978, emissiveIntensity: 0.9, roughness: 0.8 }));
    kapLampuMeja.position.set(5.5, 1.3, 5.8); g.add(kapLampuMeja);
    // klaster meja hidup (set-dressing skill-3d): mug + tempat pensil di
    // atas meja, rak dinding berisi buku + tanaman mungil di atas meja.
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 8), M(0xffffff));
    mug.position.set(4.35, 1.105, 5.78); g.add(mug);
    const wadahPensil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.11, 7), M(0xb56545));
    wadahPensil.position.set(5.28, 1.115, 5.38); g.add(wadahPensil);
    const pensil1 = K(0.025, 0.17, 0.025, 0xe8c268, 5.26, 1.22, 5.37); pensil1.rotation.z = 0.18;
    const pensil2 = K(0.025, 0.15, 0.025, 0xd9462e, 5.31, 1.21, 5.40); pensil2.rotation.z = -0.15;
    K(2.2, 0.07, 0.3, 0x8a5a30, 4.6, 2.35, 6.12);          // rak dinding di atas meja
    K(0.16, 0.3, 0.2, 0x3f6fb5, 3.85, 2.54, 6.12);
    K(0.13, 0.26, 0.2, 0xd9462e, 4.05, 2.52, 6.12);
    K(0.15, 0.28, 0.2, 0x43a06a, 4.22, 2.53, 6.12);
    const potRak = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.1, 7), M(0xb56545));
    potRak.position.set(5.35, 2.44, 6.12); g.add(potRak);
    const daunRak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), M(0x4da653));
    daunRak.position.set(5.35, 2.55, 6.12); g.add(daunRak);
    // 2 kursi kerja menghadap meja (ke selatan)
    for (const cx of [3.9, 5.3]) {
      K(0.85, 0.1, 0.85, 0xa9743f, cx, 0.55, 4.6);
      K(0.85, 0.95, 0.1, 0xa9743f, cx, 1.0, 4.22);
    }
    halang(3.2, 6.2, 4.0, 6.2);
    // sofa menghadap TV (timur): rangka kain hangat, bantal duduk warna aksen pemilik
    const KAIN_SOFA = 0x9b8465, KAIN_TERANG = 0xb09a7a;
    K(0.95, 0.5, 2.3, KAIN_SOFA, 5.35, 0.25, 1.6);          // dudukan
    K(0.28, 0.95, 2.3, KAIN_SOFA, 5.02, 0.72, 1.6);        // sandaran punggung
    K(0.9, 0.32, 0.26, KAIN_SOFA, 5.35, 0.66, 0.58);       // sandaran lengan
    K(0.9, 0.32, 0.26, KAIN_SOFA, 5.35, 0.66, 2.62);
    K(0.72, 0.16, 1.0, aksen, 5.45, 0.58, 1.07);           // bantal duduk — warna baju pemilik
    K(0.72, 0.16, 1.0, aksen, 5.45, 0.58, 2.13);
    for (const cz of [1.07, 2.13]) {
      const bantal = K(0.14, 0.52, 1.0, KAIN_TERANG, 5.22, 0.92, cz); // bantal sandaran bersandar
      bantal.rotation.z = 0.1;
    }
    K(0.95, 0.05, 0.3, aksenGelap, 5.35, 0.845, 0.58);     // kain lempar di atas sandaran lengan sofa (skill-3d)
    K(0.05, 0.42, 0.3, aksenGelap, 5.83, 0.63, 0.58);      // ujungnya menjuntai di sisi luar lengan
    halang(4.8, 5.9, 0.4, 2.8);
    // meja kopi antara sofa dan TV: papan + 2 panel kaki + buku + cangkir
    K(0.62, 0.06, 1.5, 0x8a5a30, 6.5, 0.37, 1.6);
    K(0.05, 0.34, 1.4, 0x7a4a21, 6.24, 0.17, 1.6);
    K(0.05, 0.34, 1.4, 0x7a4a21, 6.76, 0.17, 1.6);
    K(0.3, 0.045, 0.22, 0xd9462e, 6.45, 0.42, 1.3);
    const cangkir = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    cangkir.position.set(6.6, 0.445, 1.95); g.add(cangkir);
    halang(6.15, 6.85, 0.8, 2.4);
    // TV di dinding timur: bufet berpintu + layar menyala
    K(0.7, 0.65, 2.8, 0x7a4a21, 7.55, 0.33, 1.6);
    K(0.05, 0.48, 1.26, 0x9c6a38, 7.17, 0.33, 0.94);       // pintu bufet
    K(0.05, 0.48, 1.26, 0x9c6a38, 7.17, 0.33, 2.26);
    for (const kz of [1.52, 1.68]) {
      const kenop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M(0xf2b13d, 0.4));
      kenop.position.set(7.13, 0.33, kz); g.add(kenop);
    }
    K(0.14, 1.6, 2.6, 0x1c1c1e, 7.4, 1.85, 1.6);
    const layar = new THREE.Mesh(new THREE.PlaneGeometry(2.35, 1.35),
      new THREE.MeshBasicMaterial({ map: teksturLayarTV() }));
    layar.rotation.y = -Math.PI / 2; layar.position.set(7.32, 1.85, 1.6); g.add(layar);
    halang(7.0, 8.0, 0.1, 3.1);
    // dapur mini di dinding timur (klaster set-dressing skill-3d):
    // konter berpintu + pelat atas kayu + kompor + teko + rel perkakas.
    K(0.75, 0.95, 1.9, 0xe8e0cc, 7.55, 0.475, 4.2);        // badan konter
    K(0.05, 0.7, 0.8, 0x9c6a38, 7.16, 0.45, 3.82);         // pintu lemari dapur
    K(0.05, 0.7, 0.8, 0x9c6a38, 7.16, 0.45, 4.62);
    K(0.85, 0.07, 2.0, 0x8a5a30, 7.55, 0.99, 4.2);         // pelat atas kayu
    K(0.6, 0.03, 0.7, 0x2a2320, 7.55, 1.04, 3.8);          // pelat kompor
    const tungku1 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 10), M(0x14100e));
    tungku1.position.set(7.48, 1.065, 3.62); g.add(tungku1);
    const tungku2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10), M(0x14100e));
    tungku2.position.set(7.62, 1.065, 3.98); g.add(tungku2);
    const teko = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.17, 8), M(0xb8bcc0));
    teko.position.set(7.55, 1.11, 4.6); g.add(teko);
    const kenopTeko = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), M(0x2a2320));
    kenopTeko.position.set(7.55, 1.215, 4.6); g.add(kenopTeko);
    K(0.04, 0.04, 1.2, 0x37474f, 7.9, 2.2, 4.2);           // rel gantung di dinding
    K(0.03, 0.34, 0.24, 0x37474f, 7.88, 1.95, 3.9);        // wajan gantung
    K(0.03, 0.3, 0.2, 0x8a8f94, 7.88, 1.97, 4.5);          // panci gantung
    halang(7.05, 8.0, 3.2, 5.2);
    // lemari pakaian (barat selatan): badan + 2 pintu + lis atas + kenop
    K(0.8, 3.1, 2.3, 0x8a5a30, -7.55, 1.55, 3.4);
    K(0.06, 2.7, 1.04, 0x9c6a38, -7.12, 1.5, 2.86);
    K(0.06, 2.7, 1.04, 0x9c6a38, -7.12, 1.5, 3.94);
    K(0.9, 0.12, 2.4, 0x7a4a21, -7.55, 3.16, 3.4);
    for (const kz of [3.28, 3.52]) {
      const kenopL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), M(0xf2b13d, 0.4));
      kenopL.position.set(-7.06, 1.5, kz); g.add(kenopL);
    }
    halang(-8.0, -7.05, 2.2, 4.6);
    // lukisan low-poly di dinding barat (antara kasur dan lemari)
    K(0.08, 1.5, 2.0, 0x7a4a21, -INT.sw + 0.06, 2.7, 0.3);
    const lukisan = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3),
      new THREE.MeshStandardMaterial({ map: teksturLukisan(0), roughness: 0.9 }));
    lukisan.rotation.y = Math.PI / 2; lukisan.position.set(-INT.sw + 0.11, 2.7, 0.3); g.add(lukisan);
    // tanaman sudut timur laut
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.55, 8), M(0xb5533c));
    pot.position.set(7.2, 0.28, -5.5); pot.castShadow = false; g.add(pot);
    const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 0), M(0x4da653));
    daun.position.set(7.2, 1.2, -5.5); daun.castShadow = false; g.add(daun);
    halang(6.7, 7.7, -6.0, -5.0);
    // tanaman kedua di sudut tenggara (penyeimbang diagonal)
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.37, 0.48, 8), M(0xb5533c));
    pot2.position.set(7.25, 0.24, 5.8); pot2.castShadow = false; g.add(pot2);
    const daun2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.66, 0), M(0x4da653));
    daun2.position.set(7.25, 1.05, 5.8); daun2.castShadow = false; g.add(daun2);
    halang(6.8, 7.7, 5.3, 6.3);
    // keset di dalam pintu selatan (bisa diinjak, tanpa halangan)
    K(1.9, 0.045, 0.95, 0x9c6a38, 0, 0.023, 5.8);
    K(1.55, 0.05, 0.65, aksen, 0, 0.026, 5.8);
    // rak sepatu + gantungan di sisi pintu masuk (klaster pintu skill-3d;
    // koridor pintu x ±1,1 tetap bebas — rak mulai x -1,55)
    K(1.1, 0.5, 0.35, 0x9c6a38, -2.2, 0.25, 6.12);
    K(1.16, 0.05, 0.4, 0x7a4a21, -2.2, 0.53, 6.12);
    K(0.24, 0.09, 0.3, 0x37474f, -2.42, 0.60, 6.12);       // sepasang sepatu di atas rak
    K(0.24, 0.09, 0.3, 0xb5533c, -1.98, 0.60, 6.12);
    for (const hx of [-2.5, -2.2, -1.9]) {
      const kait = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), M(0xd9a441));
      kait.position.set(hx, 1.95, 6.28); g.add(kait);
    }
    K(0.32, 0.42, 0.1, aksen, -2.2, 1.68, 6.26);           // tas gantung warna aksen pemilik
    halang(-2.85, -1.55, 5.9, 6.35);
    // 2 bingkai lukisan kecil mengapit pintu di dinding selatan
    for (const fx of [-3.4, 3.4]) {
      K(1.0, 1.25, 0.08, 0x7a4a21, fx, 2.6, INT.sd - 0.06);
      const foto = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 1.09),
        new THREE.MeshStandardMaterial({ map: teksturLukisan(1), roughness: 0.9 }));
      foto.rotation.y = Math.PI; foto.position.set(fx, 2.6, INT.sd - 0.11); g.add(foto);
    }
    // lampu gantung emissive + cahaya titik hangat
    const kabel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M(0x37474f));
    kabel.position.set(0, T - 0.25, -0.5); g.add(kabel);
    const kap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.5, 12),
      new THREE.MeshStandardMaterial({ color: 0xffe1a8, emissive: 0xffc978, emissiveIntensity: 0.9, roughness: 0.8 }));
    kap.position.set(0, T - 0.72, -0.5); g.add(kap);
    const lampu = new THREE.PointLight(0xffdca8, 0.85, 30, 2);
    lampu.position.set(0, T - 1.2, -0.5); g.add(lampu);

    grupInterior = g;
    scene.add(g);
  }
  function masukInterior(w, rumahGrup) {
    if (diInterior || !w) return;
    let pintu, hadap;
    if (rumahGrup) { // rumah detail Distrik Pusat
      pintu = rumahGrup.userData.pintu;
      hadap = { x: rumahGrup.position.x, z: rumahGrup.position.z };
    } else { // rumah sendiri: pintu = titik jalan di depan kavling, hadap = kavlingnya
      pintu = posisiDepanRumah(w);
      hadap = posisiKavling(w.blok, w.kavling);
    }
    if (!pintu) return;
    interiorKonteks = {
      pemilik: w, pintuX: pintu.x, pintuZ: pintu.z,
      yawPintu: Math.atan2(-(hadap.x - pintu.x), -(hadap.z - pintu.z)), // berdiri di pintu menghadap rumah
      modeSebelum: modeKamera, // mode asal masuk (mis. 3rd Person) — dikembalikan saat keluar
    };
    bangunInterior(w);
    diInterior = true;
    perbaruiMinimapTampil(); // minimap sembunyi selama di dalam rumah
    fp.x = INT.x; fp.z = INT.z + INT.sd - 2.1; fp.yaw = 0; fp.pitch = 0; // tepat di dalam pintu, menghadap ruangan
    if (modeKamera !== "orang") aturMode("orang"); // aturMode tidak menimpa posisi ini selama diInterior
    $("#kartu").hidden = true;
    $("#panel-menu").hidden = true;
    $("#panel-chat").hidden = true;
    $("#tombol-keluar-rumah").hidden = false;
    $("#petunjuk-teks").textContent = "Di dalam rumah @" + w.username + " · WASD/joystick untuk jalan · Keluar lewat pintu selatan";
    $("#petunjuk").hidden = false;
    kirimPosisi(true); // daftarkan posisi pintu ke server; karakter terlihat berdiri di depan pintu
  }
  function keluarInterior() {
    if (!diInterior) return;
    const k = interiorKonteks;
    diInterior = false;
    fp.x = k.pintuX; fp.z = k.pintuZ; fp.yaw = k.yawPintu; fp.pitch = 0; // kembali ke jalan tepat di depan rumah itu
    if (grupInterior) grupInterior.visible = false;
    $("#tombol-keluar-rumah").hidden = true;
    $("#chip-aksi").hidden = true;
    $("#petunjuk-teks").textContent = PETUNJUK[modeKamera];
    interiorKonteks = null;
    kirimPosisi(true);
    if (k.modeSebelum === "ketiga") { // masuk dari 3rd Person -> keluar pun kembali ke 3rd Person
      pulihInterior = true;
      aturMode("ketiga"); // aturMode menyamakan tp dari fp pintu & memanggil perbaruiMinimapTampil
    } else {
      perbaruiMinimapTampil();
    }
  }
  function dekatPintuKeluar() {
    return diInterior && fp.z > INT.z + INT.sd - 1.5 && Math.abs(fp.x - INT.x) < 1.8;
  }
  /* Chip aksi kontekstual (kecil, di atas bar bawah): "Masuk Rumah" saat berdiri
     di doorstep rumah detail (mode 1st Person), "Keluar" saat di depan pintu
     keluar interior. Tidak pernah tampil permanen. */
  function perbaruiAksiInterior() {
    const chip = $("#chip-aksi"), teks = $("#chip-aksi-teks"), tombol = $("#chip-aksi-tombol");
    if (diInterior) {
      const tampil = dekatPintuKeluar();
      chip.hidden = !tampil;
      if (tampil) { teks.textContent = "Pintu keluar"; tombol.textContent = "Keluar"; }
      return;
    }
    if (modeKamera !== "orang" && modeKamera !== "ketiga") { chip.hidden = true; rumahDekat = null; return; }
    let terbaik = null, jarakMin = 3.4;
    for (const r of rumahKlik) {
      if (!r.userData.pintu) continue;
      const j = Math.hypot(fp.x - r.userData.pintu.x, fp.z - r.userData.pintu.z);
      if (j < jarakMin) { jarakMin = j; terbaik = r; }
    }
    rumahDekat = terbaik;
    chip.hidden = !terbaik;
    if (terbaik) {
      teks.textContent = "Rumah @" + terbaik.userData.pemilik.username;
      tombol.textContent = "Masuk Rumah";
    }
  }
  $("#chip-aksi-tombol").addEventListener("click", () => {
    if (diInterior) keluarInterior();
    else if (rumahDekat) masukInterior(rumahDekat.userData.pemilik, rumahDekat);
  });
  $("#tombol-keluar-rumah").addEventListener("click", keluarInterior);

  /* ================= PENERAPAN KUALITAS GRAFIK =================
     terapkanKualitas() mendorong PARAM aktif ke renderer, matahari,
     dekorasi kavling (count), awan (visible) dan tekstur (gambar ulang).
     Dipanggil saat muat, saat user mengganti pilihan, dan saat tangga
     otomatis naik/turun. Mode kamera & interior tidak disentuh sama sekali. */
  const fpsStat = { bingkai: 0, akumulasi: 0, diAtasSejak: 0, jedaSampai: 0 };
  let frameTerakhirMs = 0, indikatorTimer = null;
  function terapkanKualitas() {
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
  function tampilIndikatorKualitas() {
    const el = $("#indikator-kualitas"); if (!el) return;
    el.textContent = "Kualitas otomatis: " + PARAM.nama;
    el.hidden = false;
    clearTimeout(indikatorTimer);
    indikatorTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function perbaruiInfoKualitas() {
    document.querySelectorAll("#seg-kualitas button").forEach((b) =>
      b.classList.toggle("on", b.dataset.kualitas === pilihanKualitas));
    const info = $("#info-kualitas");
    if (!info) return;
    info.textContent = pilihanKualitas === "otomatis"
      ? "Otomatis aktif — tingkat saat ini: " + PARAM.nama + ". Naik/turun sendiri mengikuti kelancaran HP."
      : pilihanKualitas === "rendah"
        ? "Rendah: hemat baterai & lancar di HP kentang (tanpa bayangan, detail sedikit)."
        : "Tinggi: tampilan paling bagus (bayangan lembut, detail penuh).";
  }
  function setPilihanKualitas(v) {
    pilihanKualitas = v;
    try { localStorage.setItem("pinarak_kualitas", v); } catch (e) {}
    langkahKualitas = indeksUntukPilihan(v); // otomatis & tinggi mulai dari langkah teratas, rendah dari terbawah
    fpsStat.diAtasSejak = 0; fpsStat.bingkai = 0; fpsStat.akumulasi = 0;
    terapkanKualitas();
  }
  /* Waktu negara (Paket 3 ?v=15): pilihan Siang / Senja / Malam / Siklus.
     Mengganti pilihan TIDAK memotong cahaya — terapkanWaktu() di loop
     animasi melerp keadaan aktif ke preset baru dalam ±2 detik. */
  function perbaruiInfoWaktu() {
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
  function setPilihanWaktu(v) {
    pilihanWaktu = v;
    try { localStorage.setItem("pinarak_waktu", v); } catch (e) {}
    if (v !== "siklus") waktuSiklus = 0;
    perbaruiInfoWaktu();
  }
  /* Monitor FPS bergulir ±5 detik (hanya mode otomatis): sampel dt mentah
     antar-frame; jeda >250 ms (pindah tab dsb.) diabaikan. */
  function pantauKualitas(dtMs, kini) {
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
  function perbaruiLaluLintas(t) {
    const mat = LL_AKTIF.mat; if (!mat) return;
    const f = faseLaluLintas(t), kunci = f.us + "|" + f.tb;
    if (kunci === LL_AKTIF.kunci) return;
    LL_AKTIF.kunci = kunci;
    for (const sumbu of ["us", "tb"]) for (const w of ["merah", "kuning", "hijau"]) {
      const m = mat[sumbu][w], nyala = f[sumbu] === w;
      m.emissiveIntensity = nyala ? 2.4 : 0;
      m.color.setHex(nyala ? WARNA_LAMPU_LL[w].nyala : WARNA_LAMPU_LL[w].mati);
    }
  }

  /* ================= ANIMASI ================= */
  const jam = new THREE.Clock();
  let waktuLalu = 0;
  function animasi() {
    requestAnimationFrame(animasi);
    const kiniMs = performance.now();
    if (frameTerakhirMs) pantauKualitas(kiniMs - frameTerakhirMs, kiniMs); // tangga kualitas otomatis
    frameTerakhirMs = kiniMs;
    const t = jam.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0, t - waktuLalu)); waktuLalu = t;
    if (modeKamera === "orbit") {
      if (putarOtomatis && performance.now() - interaksiTerakhir > 2500 && penunjuk.size === 0) theta += 0.00045;
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
    waktuSiklus += dt;
    terapkanWaktu(dt, false); // fase cahaya: lerp halus ke preset aktif (Paket 3 ?v=15)
    perbaruiLaluLintas(t);
    if (animasiKades) {
      animasiKades.position.y = 0.34 + Math.abs(Math.sin(t * 2)) * 0.05; // basis pelataran istana 0.34 (?v=24)
      animasiHidup(animasiKades, t, true);
      /* Pak Presiden melambai saat ada pemain dekat (Paket 1 ?v=15): acuan
         pemain = target orbit / posisi drone / posisi jalan kaki. Lengan
         kanan diangkat ke samping kepala (rotasi z ±2,55) dan digoyang;
         jendela lambai 1,8 dtk tiap 5 dtk selama pemain masih dekat. */
      const uK = animasiKades.userData;
      if (uK.lenganR) {
        const acuan = modeKamera === "orbit" ? target : modeKamera === "drone" ? dr : fp;
        const dekatKades = Math.hypot(acuan.x - 3, acuan.z + 24) < 34;
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

  /* ================= UI ================= */
  $("#tombol-putar").addEventListener("click", function () {
    putarOtomatis = !putarOtomatis; this.classList.toggle("mati", !putarOtomatis);
    $("#putar-status").textContent = putarOtomatis ? "Nyala" : "Mati";
  });
  document.querySelectorAll("#seg-kualitas button").forEach((b) =>
    b.addEventListener("click", () => setPilihanKualitas(b.dataset.kualitas)));
  document.querySelectorAll("#seg-waktu button").forEach((b) =>
    b.addEventListener("click", () => setPilihanWaktu(b.dataset.waktu)));
  perbaruiInfoWaktu();
  $("#tombol-menu").addEventListener("click", () => { $("#panel-menu").hidden = !$("#panel-menu").hidden; });
  $("#tombol-tutup-menu").addEventListener("click", () => { $("#panel-menu").hidden = true; });
  $("#tutup-petunjuk").addEventListener("click", () => { petunjukDitutup = true; $("#petunjuk").hidden = true; });
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
  function fokusRumahSaya() {
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
  function perbaruiChipSaya() {
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
  const sesi = { token: localStorage.getItem("pinarak_token") || null, saya: null, pinDefault: false, genderKosong: false };
  const form = { username: "", pin: "", gender: "", baju: "#2e9e5b", kulit: "#f1c27d", topi: "peci" };
  // Label tampil gender dari kode server ('L'/'P'); kosong -> "—".
  function labelGender(g) { return g === "L" ? "Laki-laki" : g === "P" ? "Perempuan" : "—"; }
  function tampilLangkah(nama) {
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
  const WARNA_BAJU = ["#e74c3c", "#e67e22", "#f1c40f", "#2e9e5b", "#1abc9c", "#3498db", "#9b59b6", "#e84393", "#795548", "#607d8b"];
  const WARNA_KULIT = ["#ffe0bd", "#f1c27d", "#e0ac69", "#c68642", "#8d5524"];
  function buatSwatch(el, warnaList, kunci, obj) {
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
  function segarkanSwatch(el, nilai) {
    el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.warna === nilai));
  }
  function ikatSeg(el, obj, kunci, atribut) {
    el.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      obj[kunci] = b.dataset[atribut];
      el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    }));
  }
  function segarkanSeg(el, nilai, atribut) {
    el.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset[atribut] === nilai));
  }
  buatSwatch($("#sw-baju"), WARNA_BAJU, "baju");
  buatSwatch($("#sw-kulit"), WARNA_KULIT, "kulit");
  ikatSeg($("#seg-topi"), form, "topi", "topi");
  ikatSeg($("#seg-gender"), form, "gender", "gender");
  async function segarkanKota() {
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
  const lengkap = { gender: "", baju: "#2e9e5b", kulit: "#f1c27d", topi: "peci" };
  buatSwatch($("#sw-baju-l"), WARNA_BAJU, "baju", lengkap);
  buatSwatch($("#sw-kulit-l"), WARNA_KULIT, "kulit", lengkap);
  ikatSeg($("#seg-topi-l"), lengkap, "topi", "topi");
  ikatSeg($("#seg-gender-l"), lengkap, "gender", "gender");
  function bukaLengkapi() {
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
  const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
    "Agustus", "September", "Oktober", "November", "Desember"];
  function formatTanggalID(iso) {
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
  function kelompokkanNomor(n) {
    const s = String(n == null ? "" : n).replace(/\s+/g, "");
    if (!/^\d{5,}$/.test(s)) return n == null || n === "" ? "—" : String(n);
    return s.replace(/(\d{4})(?=\d)/g, "$1 ");
  }
  function jalurBulat(c, x, y, w, h, r) {
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
  let panggungFoto = null;       // { renderer, scene, kamera } — dibuat malas, dipakai ulang
  const cacheFoto3D = new Map(); // kunci penampilan -> dataURL PNG hasil render
  function kunciRupa(rupa) {
    return [(rupa && rupa.warna_baju) || "", (rupa && rupa.warna_kulit) || "", (rupa && rupa.topi) || ""].join("|");
  }
  function siapkanPanggungFoto() {
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
  function renderFoto3D(rupa) {
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
  function lukisFotoKartu(c, x, y, w, h, rupa, selesai) {
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
  function tampilkanKTP() {
    const w = sesi.saya; if (!w) return;
    $("#ktp-nik").textContent = kelompokkanNomor(w.nik);
    $("#ktp-nama").textContent = "@" + w.username;
    $("#ktp-gender").textContent = labelGender(w.gender); // "—" bila belum dilengkapi
    $("#ktp-alamat").textContent = "Blok " + w.blok + " · Kavling " + w.kavling;
    $("#ktp-norumah").textContent = w.nomor_rumah;
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
  function teksPas(c, teks, x, y, font, lebarMaks) {
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
  function gambarKTPKeCanvas(w) {
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
    c.fillText("NEGARA MERDU", 198, 166);
    try { c.letterSpacing = "0px"; } catch (e) {}
    // panel data (kolom nilai mulai x=316, panel berakhir x=800)
    jalurBulat(c, 58, 200, 742, 404, 20); c.fillStyle = "rgba(255,255,255,0.45)"; c.fill();
    const baris = [
      ["NIK", kelompokkanNomor(w.nik), "700 39px system-ui, sans-serif"],
      ["Nama", "@" + w.username, "700 32px system-ui, sans-serif"],
      ["Jenis Kelamin", labelGender(w.gender), "700 32px system-ui, sans-serif"],
      ["Alamat", "Blok " + w.blok + " · Kavling " + w.kavling, "700 32px system-ui, sans-serif"],
      ["No. Rumah", String(w.nomor_rumah), "700 32px system-ui, sans-serif"],
      ["Terdaftar", formatTanggalID(w.terdaftar), "700 32px system-ui, sans-serif"],
      ["Berlaku", "Seumur Hidup", "700 32px system-ui, sans-serif"],
    ];
    if (w.jabatan) baris.splice(6, 0, ["Jabatan", w.jabatan, "700 32px system-ui, sans-serif"]);
    // Jarak baris bertingkat supaya semua baris tetap di dalam panel
    // (panel y 200..604): <=6 baris longgar, 7 rapat, 8+ paling rapat.
    let yAwal = 268, langkahY = 62;
    if (baris.length === 7) { yAwal = 258; langkahY = 54; }
    else if (baris.length >= 8) { yAwal = 248; langkahY = 48; }
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
  async function unduhKTP() {
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
  let dataKeluarga = null;   // cache respons /api/keluarga-saya untuk sesi ini
  const BULAN_SINGKAT_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  function formatTanggalSingkatID(iso) { // "2026-11-20" -> "20 Nov 2026" (gaya tabel KK)
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return "—";
    const bln = BULAN_SINGKAT_ID[parseInt(m[2], 10) - 1];
    if (!bln) return "—";
    return parseInt(m[3], 10) + " " + bln + " " + m[1];
  }
  async function ambilKeluarga() {
    if (!sesi.token) return null;
    try {
      const r = await fetch("/api/keluarga-saya", { headers: { Authorization: "Bearer " + sesi.token } });
      if (!r.ok) return null;
      dataKeluarga = (await r.json()).keluarga || null;
    } catch (e) { /* dataKeluarga tetap seperti sebelumnya */ }
    return dataKeluarga;
  }
  function barisInfoKeluarga(label, nilai) {
    const div = document.createElement("div");
    const s = document.createElement("span"); s.textContent = label;
    const b = document.createElement("b"); b.textContent = nilai;
    div.append(s, b);
    return div;
  }
  async function bukaKeluarga() {
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
  function tampilkanKK() {
    const d = dataKeluarga; if (!d) return;
    $("#kk-nokk").textContent = kelompokkanNomor(d.no_kk);
    $("#kk-kepala").textContent = "@" + d.kepala;
    $("#kk-alamat").textContent = "Blok " + d.alamat.blok + " · Kavling " + d.alamat.kavling + " · Negara Merdu";
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
  function gambarKKKeCanvas(d) {
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
  function unduhKK() {
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
  const TEKS_FASE_PEMILU = {
    pencalonan: "Fase pencalonan sedang dibuka — warga bisa mencalonkan diri dengan visi & misi.",
    pemungutan: "Pemungutan suara sedang berlangsung — pilih kandidat di wilayahmu.",
    selesai: "Pemilu periode ini sudah selesai. Pemenangnya sudah ditetapkan.",
  };
  function elemenPemilu(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  function formatAngkaID(n) { return Number(n || 0).toLocaleString("id-ID"); }
  async function bukaPemilu() {
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
  function gambarPanelPemilu(d) {
    const isi = $("#pemilu-isi");
    isi.textContent = "";
    const p = d.pemilu;
    // --- Pejabat aktif: Presiden + Ketua RW/RT wilayah si peminta ---
    const pejabatTampil = (d.pejabat || []).filter((j) =>
      j.jabatan === "kades" || !d.wilayah_saya ||
      (j.jabatan === "rt" && j.wilayah === d.wilayah_saya.rt) ||
      (j.jabatan === "rw" && j.wilayah === d.wilayah_saya.rw));
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
        "Wilayah rumahmu: RT " + String(d.wilayah_saya.rt).padStart(3, "0") +
        " · RW " + String(d.wilayah_saya.rw).padStart(2, "0") +
        ". Kamu memilih Ketua RT & RW di wilayahmu, dan Presiden untuk seluruh negara."));
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
  function gambarBalapanPemilu(isi, d, b) {
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
  function gambarFormCalon(isi, d) {
    isi.appendChild(elemenPemilu("h4", "pemilu-bagian", "Mencalonkan Diri"));
    const form = elemenPemilu("form", "calon-form");
    const labJ = elemenPemilu("label", null, "Jabatan yang dituju");
    const sel = document.createElement("select"); sel.id = "calon-jabatan";
    const opsi = [
      ["kades", "Presiden (seluruh negara)"],
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
  async function pilihKandidat(kandidatId, btn) {
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
  function elemenBangun(tag, kelas, teks) {
    const e = document.createElement(tag);
    if (kelas) e.className = kelas;
    if (teks !== undefined) e.textContent = teks;
    return e;
  }
  async function bukaPembangunan() {
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
  function gambarPanelPembangunan(d) {
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

  /* ================= MULTIPLAYER + CHAT BALAI DESA =================
     WebSocket ke /ws (token sesi di query). Warga login tampil sebagai
     karakter di klien lain; posisinya dikirim dari mode 1st Person
     (throttle 120 ms, hanya saat berubah) dan digerakkan dengan interpolasi.
     Maksimal 50 pemain terdekat yang di-render supaya HP tetap ringan.
     Tamu (tanpa token) hanya menonton: tidak tampil, tidak bisa chat. */
  const PEMAIN_MAKS_RENDER = 50;
  const pemainOnline = new Map();   // username -> {baju,kulit,topi, x,z,yaw, tx,tz,tyaw, grup, gelembung, gelembungSampai}
  const pemainDirender = new Set(); // username yang grup karakternya sedang tampil
  const grupPemain = new THREE.Group(); scene.add(grupPemain);
  let ws = null, wsTimer = null, detakTimer = null;
  /* Reconnect chat: backoff bertingkat 1s -> 2s -> 5s -> 10s (mentok),
     di-reset tiap berhasil tersambung. Pesan yang dikirim saat terputus
     masuk antrean (maks 5) dan dikirim otomatis sesudah tersambung —
     tidak hilang diam-diam. */
  const LANGKAH_BACKOFF = [1000, 2000, 5000, 10000];
  let langkahBackoff = 0, wsJagaTimer = null;
  const antreChat = [];
  const ANTRE_CHAT_MAKS = 5;
  let posTerakhir = { x: null, z: null, yaw: null }, posKirimTerakhir = 0;
  let renderSegarTerakhir = 0;
  let chatBelumDibaca = 0, catatanTimer = null;

  function buangGrup(grup) {
    grup.traverse((o) => {
      // Geometri/material karakter dipakai BERSAMA antar semua karakter
      // (cache di buatKarakter) — jangan dibuang saat satu karakter
      // dihapus; label & gelembung tetap milik sendiri dan dibuang.
      if (o.geometry && !SUMBER_BERSAMA.has(o.geometry)) o.geometry.dispose();
      if (o.material && !SUMBER_BERSAMA.has(o.material)) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
  function buatGelembung(teks) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 224;
    const c = cv.getContext("2d");
    const kata = String(teks).split(/\s+/); const baris = []; let b = "";
    for (const k of kata) {
      if ((b + " " + k).trim().length > 18 && b) { baris.push(b); b = k; } else b = (b + " " + k).trim();
      if (baris.length === 3) break;
    }
    if (b && baris.length < 3) baris.push(b);
    if (baris.length === 3 && kata.join(" ").length > baris.join(" ").length) baris[2] = baris[2].replace(/…?$/, "…");
    c.fillStyle = "rgba(255,251,240,0.96)";
    c.beginPath();
    if (c.roundRect) c.roundRect(36, 14, 440, 158, 34); else c.rect(36, 14, 440, 158);
    c.fill();
    c.beginPath(); c.moveTo(226, 170); c.lineTo(286, 170); c.lineTo(256, 208); c.closePath(); c.fill();
    c.fillStyle = "#21332a"; c.font = "bold 41px system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    baris.forEach((s, i) => c.fillText(s, 256, 93 + (i - (baris.length - 1) / 2) * 48, 420));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(6.4, 2.8, 1);
    return sp;
  }
  function tambahPemain(d) {
    if (!d || !d.u) return;
    if (sesi.saya && d.u === sesi.saya.username) return; // diri sendiri tidak di-render
    const lama = pemainOnline.get(d.u);
    if (lama) { lama.baju = d.baju; lama.kulit = d.kulit; lama.topi = d.topi; lama.jabatan = d.jabatan || null; return; }
    pemainOnline.set(d.u, {
      baju: d.baju, kulit: d.kulit, topi: d.topi, jabatan: d.jabatan || null,
      x: d.x || 0, z: d.z || 0, yaw: d.yaw || 0,
      tx: d.x || 0, tz: d.z || 0, tyaw: d.yaw || 0,
      grup: null, gelembung: null, gelembungSampai: 0,
    });
  }
  function hapusPemain(u) {
    const p = pemainOnline.get(u);
    if (!p) return;
    if (p.grup) { grupPemain.remove(p.grup); buangGrup(p.grup); }
    pemainOnline.delete(u); pemainDirender.delete(u);
  }
  function titikAcuan() {
    if (modeKamera === "orang" || modeKamera === "ketiga") return { x: fp.x, z: fp.z };
    if (modeKamera === "drone") return { x: dr.x, z: dr.z };
    return { x: target.x, z: target.z };
  }
  function segarkanRenderPemain() {
    const acuan = titikAcuan();
    const urut = [...pemainOnline.entries()]
      .map(([u, p]) => [u, p, Math.hypot(p.tx - acuan.x, p.tz - acuan.z)])
      .sort((a, b2) => a[2] - b2[2])
      .slice(0, PEMAIN_MAKS_RENDER);
    const harus = new Set(urut.map(([u]) => u));
    for (const u of [...pemainDirender]) {
      if (!harus.has(u)) {
        const p = pemainOnline.get(u);
        if (p && p.grup) { grupPemain.remove(p.grup); buangGrup(p.grup); p.grup = null; p.gelembung = null; }
        pemainDirender.delete(u);
      }
    }
    for (const [u, p] of urut) {
      if (!p.grup) {
        const g = buatKarakter({ baju: p.baju, kulit: p.kulit, topi: p.topi });
        g.scale.setScalar(1.35);
        const lb = buatLabel("@" + u, 4.2, p.jabatan || null); lb.position.y = 2.5; g.add(lb);
        g.position.set(p.x, 0.32, p.z);
        grupPemain.add(g); p.grup = g;
      }
      pemainDirender.add(u);
    }
  }
  function perbaruiPemainLain(dt, t) {
    if (performance.now() - renderSegarTerakhir > 4000) {
      renderSegarTerakhir = performance.now();
      segarkanRenderPemain();
    }
    const k = 1 - Math.exp(-dt * 9);
    for (const p of pemainOnline.values()) {
      if (!p.grup) continue;
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const px0 = p.x, pz0 = p.z;
      p.x += dx * k; p.z += dz * k;
      let dy = p.tyaw - p.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.yaw += dy * k;
      // Ayunan kaki+lengan mengikuti jarak perpindahan interpolasi frame ini.
      const bob = animasiJalan(p.grup, Math.hypot(p.x - px0, p.z - pz0), dt);
      animasiHidup(p.grup, t, Math.hypot(p.x - px0, p.z - pz0) < 0.0005);
      p.grup.position.set(p.x, 0.32 + bob * 0.07, p.z);
      p.grup.rotation.y = p.yaw + Math.PI; // model menghadap kebalikan yaw kamera FPS
      if (p.gelembung && performance.now() > p.gelembungSampai) {
        p.grup.remove(p.gelembung); buangGrup(p.gelembung); p.gelembung = null;
      }
    }
  }
  function tampilGelembung(u, teks) {
    const p = pemainOnline.get(u);
    if (!p || !p.grup) return;
    if (p.gelembung) { p.grup.remove(p.gelembung); buangGrup(p.gelembung); }
    const sp = buatGelembung(teks);
    sp.position.y = 4.1;
    p.grup.add(sp); p.gelembung = sp;
    p.gelembungSampai = performance.now() + 5000;
  }
  function kirimPosisi(paksa) {
    if (!ws || ws.readyState !== 1 || !sesi.saya) return;
    const kini = performance.now();
    if (!paksa && kini - posKirimTerakhir < 120) return;
    /* Di dalam interior, posisi logis yang disiarkan adalah PINTU rumah yang
       dimasuki (interiorKonteks), BUKAN koordinat interior mentah di bawah
       kota: pemain lain melihat karakter ini berdiri di depan pintu selama
       ia berkunjung, dan gelembung chat tetap muncul di sana. Karena nilainya
       konstan selama di dalam, cek epsilon di bawah otomatis menghentikan
       pengiriman berulang. */
    const sx = diInterior ? interiorKonteks.pintuX : fp.x;
    const sz = diInterior ? interiorKonteks.pintuZ : fp.z;
    /* Di 3rd Person yang disiarkan adalah arah hadap KARAKTER (bukan yaw
       kamera yang bebas berputar): klien lain merender rotation.y = yaw + π,
       jadi kirim hadap + π supaya model terlihat menghadap arah jalannya. */
    const syaw = diInterior ? interiorKonteks.yawPintu
      : (modeKamera === "ketiga" ? tp.hadap + Math.PI : fp.yaw);
    if (!paksa && posTerakhir.x !== null &&
        Math.abs(sx - posTerakhir.x) < 0.05 && Math.abs(sz - posTerakhir.z) < 0.05 &&
        Math.abs(syaw - posTerakhir.yaw) < 0.01) return;
    posTerakhir = { x: sx, z: sz, yaw: syaw }; posKirimTerakhir = kini;
    try { ws.send(JSON.stringify({ jenis: "posisi", x: sx, z: sz, yaw: syaw })); } catch (e) {}
  }
  function jadwalSambungUlang() { // backoff bertingkat, mentok 10 detik
    if (wsTimer) clearTimeout(wsTimer);
    const jeda = LANGKAH_BACKOFF[Math.min(langkahBackoff, LANGKAH_BACKOFF.length - 1)];
    langkahBackoff++;
    wsTimer = setTimeout(() => { wsTimer = null; sambungWS(); }, jeda);
  }
  function kosongkanAntreChat() { // kirim pesan tertahan, berurutan, sekali saja
    while (antreChat.length && ws && ws.readyState === 1) {
      const isi = antreChat[0];
      try { ws.send(JSON.stringify({ jenis: "chat", isi })); antreChat.shift(); }
      catch (e) { break; } // gagal di tengah: sisa antrean menunggu reconnect berikut
    }
  }
  function sambungWS() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws" +
      (sesi.token ? "?token=" + encodeURIComponent(sesi.token) : "");
    let s;
    try { s = new WebSocket(url); } catch (e) { jadwalSambungUlang(); return; }
    ws = s;
    /* Pengawas CONNECTING: jabat tangan WS bisa menggantung tanpa pernah
       open/error/close (mis. upgrade tertahan proxy saat server restart —
       persis jendela deploy). Tanpa pengawas ini klien menunggu selamanya:
       penjaga sambungWS menolak percobaan baru selama readyState===0 dan
       tidak ada kejadian lain yang datang. Sesudah 8 detik masih
       CONNECTING -> tutup paksa, onclose menjadwalkan percobaan berikut. */
    clearTimeout(wsJagaTimer);
    wsJagaTimer = setTimeout(() => {
      if (ws === s && s.readyState === 0) { try { s.close(); } catch (e) {} }
    }, 8000);
    s.onopen = () => {
      if (ws !== s) return;
      clearTimeout(wsJagaTimer);
      langkahBackoff = 0; // tersambung: backoff mulai dari awal lagi
      kirimPosisi(true); // daftarkan posisi terakhir karakter ke server
      clearInterval(detakTimer);
      detakTimer = setInterval(() => {
        if (ws === s && s.readyState === 1) { try { s.send(JSON.stringify({ jenis: "detak" })); } catch (e) {} }
      }, 10000);
      kosongkanAntreChat();
      perbaruiStatusChat();
    };
    s.onmessage = (ev) => { if (ws === s) tanganiPesanWS(ev.data); };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null; clearInterval(detakTimer); clearTimeout(wsJagaTimer);
      jadwalSambungUlang();
      perbaruiStatusChat();
    };
    s.onerror = () => { try { s.close(); } catch (e) {} };
  }
  function sambungUlangWS() { // sesudah login/logout: buang koneksi lama, sambung dengan identitas baru
    if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; }
    clearTimeout(wsJagaTimer);
    langkahBackoff = 0;
    if (ws) { const s = ws; ws = null; s.onclose = null; try { s.close(); } catch (e) {} }
    sambungWS();
  }
  /* Tab kembali terlihat / jaringan kembali: jangan menunggu sisa
     backoff — coba sambung saat itu juga (timer HP dibekukan saat tab
     tidak aktif, jadi tanpa ini reconnect bisa terasa sangat lama). */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!ws || ws.readyState >= 2) { langkahBackoff = 0; if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; } sambungWS(); }
  });
  addEventListener("online", () => {
    if (!ws || ws.readyState >= 2) { langkahBackoff = 0; if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; } sambungWS(); }
  });
  function tanganiPesanWS(data) {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (m.jenis === "sambutan") {
      for (const u of [...pemainOnline.keys()]) hapusPemain(u);
      (m.pemain || []).forEach(tambahPemain);
      segarkanRenderPemain();
      const log = $("#chat-log"); log.innerHTML = "";
      if (!(m.chat || []).length) log.innerHTML = '<div class="kosong">Belum ada obrolan. Mulai saja!</div>';
      (m.chat || []).forEach((c) => tambahBarisChat(c, false));
      perbaruiStatusChat();
    } else if (m.jenis === "masuk") {
      tambahPemain(m.pemain); segarkanRenderPemain();
    } else if (m.jenis === "keluar") {
      hapusPemain(m.u);
    } else if (m.jenis === "posisi") {
      let p = pemainOnline.get(m.u);
      if (!p) { tambahPemain({ u: m.u, baju: "#2e9e5b", kulit: "#f1c27d", topi: "tanpa", x: m.x, z: m.z, yaw: m.yaw }); p = pemainOnline.get(m.u); segarkanRenderPemain(); }
      if (p) { p.tx = m.x; p.tz = m.z; p.tyaw = m.yaw; }
    } else if (m.jenis === "chat") {
      tambahBarisChat(m, true);
      tampilGelembung(m.u, m.isi);
    } else if (m.jenis === "galat") {
      tampilCatatanChat(m.pesan || "Pesan tidak terkirim.");
    }
  }

  /* ---------- UI chat ---------- */
  function tambahBarisChat(m, hitungBadge) {
    const log = $("#chat-log");
    const kosong = log.querySelector(".kosong"); if (kosong) kosong.remove();
    const div = document.createElement("div");
    // Pesan sistem (sambutan Pak Presiden) tampil beda: tanpa awalan "@",
    // dengan gaya kartu pengumuman desa (kelas .sistem).
    div.className = "pesan" + (m.sistem ? " sistem" : "");
    const u = document.createElement("span"); u.className = "u";
    u.textContent = m.sistem ? m.u : "@" + m.u;
    const jam = document.createElement("span"); jam.className = "jam"; jam.textContent = m.jam || "";
    div.append(u, document.createTextNode(" " + m.isi), jam); // textContent: aman dari XSS
    log.appendChild(div);
    while (log.children.length > 120) log.removeChild(log.firstChild);
    if (!$("#panel-chat").hidden) log.scrollTop = log.scrollHeight;
    else if (hitungBadge) {
      chatBelumDibaca++;
      const l = $("#lencana-chat"); l.hidden = false; l.textContent = chatBelumDibaca > 99 ? "99+" : chatBelumDibaca;
    }
  }
  function tampilCatatanChat(teks) {
    const el = $("#chat-catatan");
    el.textContent = teks;
    clearTimeout(catatanTimer);
    catatanTimer = setTimeout(perbaruiStatusChat, 3500);
  }
  function perbaruiStatusChat() {
    const inp = $("#isi-chat"), btn = $("#kirim-chat"), cat = $("#chat-catatan");
    if (!inp) return;
    if (sesi.saya) {
      inp.disabled = false; btn.disabled = false;
      inp.placeholder = "Tulis pesan…";
      if (ws && ws.readyState === 1) {
        cat.textContent = "Chat sebagai @" + sesi.saya.username + " · maks 200 karakter";
      } else {
        // teks kecil di panel, menetap selama terputus — bukan banner
        cat.textContent = antreChat.length
          ? "Menyambung ulang ke negara… " + antreChat.length + " pesanmu menunggu terkirim."
          : "Menyambung ulang ke negara…";
      }
    } else {
      inp.disabled = true; btn.disabled = true;
      inp.placeholder = "Masuk dulu untuk ikut chat";
      cat.textContent = "Kamu sedang menonton sebagai tamu. Masuk pakai Kartu Warga Negara untuk tampil di negara dan ikut chat.";
    }
  }
  $("#tombol-chat").addEventListener("click", () => {
    const p = $("#panel-chat");
    p.hidden = !p.hidden;
    if (!p.hidden) {
      $("#panel-menu").hidden = true;
      chatBelumDibaca = 0; $("#lencana-chat").hidden = true;
      const log = $("#chat-log"); log.scrollTop = log.scrollHeight;
      perbaruiStatusChat();
    }
  });
  $("#tombol-tutup-chat").addEventListener("click", () => { $("#panel-chat").hidden = true; });
  $("#form-chat").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#isi-chat");
    const isi = inp.value.trim();
    if (!isi) return;
    if (!sesi.saya) { tampilCatatanChat("Masuk dulu pakai Kartu Warga Negara untuk ikut chat."); return; }
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ jenis: "chat", isi })); inp.value = ""; return; }
      catch (err) { /* send gagal di soket yang mengaku OPEN: antrekan di bawah */ }
    }
    /* Terputus: pesan TIDAK dibuang — masuk antrean dan dikirim otomatis
       sesudah reconnect (kosongkanAntreChat di onopen). Yang diantrekan
       hanya pesan yang tidak pernah sampai ke soket OPEN, jadi tidak
       ada kiriman ganda. */
    if (antreChat.length >= ANTRE_CHAT_MAKS) {
      tampilCatatanChat("Koneksi terputus dan antrean pesan penuh — tunggu tersambung dulu ya.");
      return;
    }
    antreChat.push(isi); inp.value = "";
    tampilCatatanChat("Koneksi terputus — pesanmu disimpan dan akan terkirim otomatis saat tersambung lagi.");
  });

  /* ================= MINIMAP + PETA BESAR =================
     Lapisan statis desa digambar SEKALI dari data grid yang sama dengan
     dunia 3D (blok perumahan, jalan, plaza, lahan & fasilitas), disimpan di
     canvas offscreen; per frame minimap cukup drawImage potongan di sekitar
     pemain + beberapa penanda — tidak menggambar ulang kota per frame.
     Peta utara-tetap: utara = -z; panah pemain berputar mengikuti hadap. */
  const PETA_SKALA = 0.125;   // px peta per satuan dunia (lapisan minimap: 840x525)
  const PETA_RAD = 300;       // radius pandang minimap (satuan dunia)
  const WARNA_PETA = {
    luar: "#57a047", jalan: "#b39d72",
    plaza: "#bfae87", lahan: "#cbb489", fasilitas: "#2f8f6e",
    petak: "#9db873", // blok perumahan = petak lahan kosong; rumah warga = titik warna pemilik
  };
  const FASILITAS_DI_BLOK = {}; // "kol,bar" -> kunci fasilitas
  for (const kunci in FASILITAS_BLOK) {
    const b = FASILITAS_BLOK[kunci];
    FASILITAS_DI_BLOK[b.kol + "," + b.bar] = kunci;
  }
  function fasilitasTerbangun(kunci) {
    return dataPembangunan.some((f) => f.kunci === kunci && f.status === "terbangun");
  }
  function gambarBlokPeta(c, skala) { // seluruh blok kota pada konteks c dengan skala px/satuan
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
  function titikRumahWarga(gambar) { // gambar(x, z, warnaCss)
    for (const w of daftarRumah) {
      const bi = w.blok - 1, kol = bi % BLOK_KOLOM, bar = Math.floor(bi / BLOK_KOLOM);
      const kunci = kol + "," + bar;
      if (RESERVASI.has(kunci) || TAMAN.has(kunci)) continue;
      const p = posisiKavling(w.blok, w.kavling);
      gambar(p.x, p.z, w.warna || "#ffffff");
    }
  }
  function buatPetaStatis(skala) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(KOTA_W * skala); cv.height = Math.round(KOTA_D * skala);
    gambarBlokPeta(cv.getContext("2d"), skala);
    return cv;
  }
  let petaStatisKecil = null, petaStatisBesar = null; // digambar malas sekali (sesudah data pembangunan termuat)
  function duniaKePeta(x, z, skala) { // dunia -> piksel lapisan peta (murni)
    return { x: (x + KOTA_W / 2) * skala, y: (z + KOTA_D / 2) * skala };
  }
  function duniaKeMinimap(wx, wz, px, pz, ukuran) { // dunia -> piksel minimap, pemain di tengah (murni)
    const k = ukuran / (2 * PETA_RAD);
    return { x: ukuran / 2 + (wx - px) * k, y: ukuran / 2 + (wz - pz) * k };
  }
  function rotasiPanah(fx, fz) { return Math.atan2(fx, -fz); } // 0 = utara (murni)
  function arahHadap() { // vektor hadap pemain per mode (untuk panah peta)
    if (modeKamera === "ketiga") return { fx: Math.sin(tp.hadap), fz: Math.cos(tp.hadap) };
    if (modeKamera === "drone") return { fx: -Math.sin(dr.yaw), fz: -Math.cos(dr.yaw) };
    return { fx: -Math.sin(fp.yaw), fz: -Math.cos(fp.yaw) };
  }
  function lingkaranPeta(c, x, y, r, warna) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = warna; c.fill();
    c.lineWidth = r > 5 ? 2.4 : 1.8; c.strokeStyle = "#fff"; c.stroke();
  }
  function panahPeta(c, x, y, rot, besar) {
    c.save(); c.translate(x, y); c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -besar); c.lineTo(besar * 0.65, besar * 0.8);
    c.lineTo(0, besar * 0.35); c.lineTo(-besar * 0.65, besar * 0.8);
    c.closePath();
    c.fillStyle = "#fff"; c.fill();
    c.lineWidth = besar * 0.22; c.strokeStyle = "#21332a"; c.stroke();
    c.restore();
  }
  function berlianPeta(c, x, y, s, warna) { // penanda rumah sendiri (emas)
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
    c.fillStyle = warna; c.fillRect(-s / 2, -s / 2, s, s);
    c.lineWidth = 1.8; c.strokeStyle = "#fff"; c.strokeRect(-s / 2, -s / 2, s, s);
    c.restore();
  }
  const minimapEl = $("#minimap"), mmc = minimapEl.getContext("2d");
  const MM = 240; // sisi kanvas minimap (px perangkat; CSS 120px)
  function gambarMinimap() {
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
    let p = titik(0, -34); // penanda istana negara di plaza
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
  function gambarPetaBesar() { // seluruh kota pada overlay, digambar saat dibuka
    if (!petaStatisBesar) petaStatisBesar = buatPetaStatis(0.2);
    const cv = $("#peta-kanvas"), c = cv.getContext("2d");
    c.fillStyle = WARNA_PETA.luar; c.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(petaStatisBesar, 0, 0);
    const titik = (wx, wz) => duniaKePeta(wx, wz, 0.2);
    titikRumahWarga((wx, wz, warnaCss) => { // rumah warga: petak kecil sewarna pemiliknya
      const q = titik(wx, wz);
      c.fillStyle = warnaCss; c.fillRect(q.x - 2, q.y - 2, 4, 4);
    });
    let p = titik(0, -34);
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
  function perbaruiMinimapTampil() {
    minimapEl.hidden = diInterior || modeKamera === "orbit";
    minimapEl.style.right = modeKamera === "drone"
      ? "calc(86px + env(safe-area-inset-right, 0px))"
      : "calc(12px + env(safe-area-inset-right, 0px))";
  }
  minimapEl.addEventListener("click", () => { gambarPetaBesar(); $("#peta-besar").hidden = false; });
  $("#tutup-peta").addEventListener("click", () => { $("#peta-besar").hidden = true; });
  $("#peta-besar").addEventListener("click", (e) => { if (e.target === e.currentTarget) $("#peta-besar").hidden = true; });

  /* ================= MULAI ================= */
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
})();
