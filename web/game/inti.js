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
  };

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
  export function warnaAtapZonaHSL(zona, a, b) {
    return [(HUE_ZONA[zona] + (a - 0.5) * 0.03 + 1) % 1, 0.58, 0.46 + (b - 0.5) * 0.07];
  }
  export function warnaDindingZonaHSL(zona, a, b) { // pastel sekeluarga dengan atapnya
    return [(HUE_ZONA[zona] + (a - 0.5) * 0.03 + 1) % 1, 0.42, 0.80 + (b - 0.5) * 0.05];
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
  export const PLAZA_TAPAK = { minX: -104, maxX: 104, minZ: -52, maxZ: 52 }; // = kotak(208, ., 104) di (0,0) pada pusatKota()
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
  /* Satu tiang per sudut trotoar, menghadap arah datangnya kendaraan yang
     diatur (penempatan sisi jauh-kanan dari arah pandang pengemudi):
     sudut tenggara -> arus timur-barat datang dari barat (hadap -x);
     sudut barat-laut -> arus timur-barat datang dari timur (hadap +x);
     sudut timur-laut -> arus utara-selatan datang dari selatan (hadap +z);
     sudut barat-daya -> arus utara-selatan datang dari utara (hadap -z).
     sumbu "us" = utara-selatan, "tb" = timur-barat (kelompok fase). */
  export function tiangLaluLintas() {
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
  export const SIKLUS_LL = 16;
  export function faseLaluLintas(t) {
    const s = ((t % SIKLUS_LL) + SIKLUS_LL) % SIKLUS_LL;
    if (s < 7) return { us: "hijau", tb: "merah" };
    if (s < 8) return { us: "kuning", tb: "merah" };
    if (s < 15) return { us: "merah", tb: "hijau" };
    return { us: "merah", tb: "kuning" };
  }
  export const WARNA_LAMPU_LL = { // nyala = warna jenuh terang; mati = rona gelap warna sama
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
  export function markaPersimpangan() {
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
    [{ x: 12, z: -14 }, { x: 13.6, z: -14 }],
  ];
  export function aktivitasUntukNpc(i) {
    if (i < 2) return { jenis: "pembawa", alat: i === 0 ? "karung" : "kardus" };
    if (i < 6) {
      const p = PASANGAN_NGOBROL[(i - 2) >> 1], sisi = (i - 2) % 2;
      return { jenis: "ngobrol", x: p[sisi].x, z: p[sisi].z, hadap: Math.atan2(p[1 - sisi].x - p[sisi].x, p[1 - sisi].z - p[sisi].z) };
    }
    if (i < 10) { const b = BANGKU_PLAZA[i - 6]; return { jenis: "duduk", x: b.x, z: b.z, rot: b.rot }; }
    return { jenis: "jalan" };
  }
  /* === AKHIR LOGIKA AKTIVITAS NPC === */

