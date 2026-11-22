/* Negara Merdu — modul game "karakter" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Karakter: label nama, pembangun karakter low-poly, dan animasi jalan/hidup. */
import { M } from "./bersama.js";

  export function buatLabel(teks, besar, jabatan) {
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
  export const SUMBER_BERSAMA = new Set();
  /* ---------- Bentuk kepala stylized (ronde skill-3d) ----------
     Pelajaran character-artist + img2threejs (head construction):
     proporsi ditetapkan SEBELUM detail, fitur wajah didudukkan pada
     permukaan dengan rumus — bukan ditebak. Kepala referensi Pak
     Kades: pipi lebar, rahang menyempit ke dagu, ubun-ubun agak rata,
     mata besar (putih ±0,20 lebar kepala), senyum lebar bergigi.
     taperKepala(t) MURNI: t = tinggi ternormalisasi (-1..1); dipakai
     bentukKepala() untuk membentuk geometri DAN mukaZ() untuk
     mendudukkan fitur — keduanya tidak pernah berpisah. */
  export function taperKepala(t) {
    if (t < 0) return 1 - 0.22 * Math.pow(-t, 1.6); // rahang -> dagu menyempit
    return 1 - 0.05 * t * t;                        // ubun-ubun sedikit rata
  }
  export function bentukKepala(geo) {
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
  export const RK = { x: 0.4576, y: 0.44, z: 0.4048 };
  export function mukaZ(x, y) { // z permukaan wajah pada (x, y) relatif pusat kepala
    const q = 1 - (x * x) / (RK.x * RK.x) - (y * y) / (RK.y * RK.y);
    return RK.z * Math.sqrt(Math.max(0.02, q)) * taperKepala(y / RK.y);
  }
  export let GEO_KARAKTER = null;
  export function geoKarakter() {
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
  export const CACHE_MAT_KARAKTER = new Map();
  export function matKarakter(warna) {
    let m = CACHE_MAT_KARAKTER.get(warna);
    if (!m) { m = M(warna); CACHE_MAT_KARAKTER.set(warna, m); SUMBER_BERSAMA.add(m); }
    return m;
  }
  // Warna celana & topi diturunkan deterministik dari warna baju (hash
  // sederhana) — tanpa mengubah skema data server, dan semua klien
  // menghitung hasil yang sama untuk warga yang sama.
  export function hashWarna(teks) {
    let h = 0;
    for (let i = 0; i < teks.length; i++) h = (h * 31 + teks.charCodeAt(i)) >>> 0;
    return h;
  }
  export const PALET_CELANA = [0x37474f, 0x2e4053, 0x4e342e, 0x556052, 0x3e3a34];
  export const PALET_TOPI = [0xd95f43, 0x3f6fb5, 0xe8c268, 0x43a06a];
  export function warnaCelana(bajuHex) { return PALET_CELANA[hashWarna(bajuHex || "") % PALET_CELANA.length]; }
  export function warnaTopi(bajuHex) { return PALET_TOPI[(hashWarna(bajuHex || "") + 2) % PALET_TOPI.length]; }
  export function warnaSkala(hex, faktor) { // terang/gelapkan warna hex (kerah lebih gelap, lipat celana lebih terang, dsb.)
    const c = new THREE.Color(hex);
    c.multiplyScalar(faktor);
    return c.getHex();
  }

  export function buatKarakter(opsi) {
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
  export const AYUN_KAKI = 0.55, AYUN_LENGAN = 0.4;
  export function animasiJalan(kar, jarak, dt) {
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
  export function skalaKedip(t, geser) {
    const SIKLUS = 3.9, LAMA = 0.17;
    let f = (t + (geser || 0)) % SIKLUS;
    if (f < 0) f += SIKLUS;
    if (f >= LAMA) return 1;
    return 1 - Math.sin((f / LAMA) * Math.PI) * 0.92;
  }
  export function animasiHidup(kar, t, diam) {
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
