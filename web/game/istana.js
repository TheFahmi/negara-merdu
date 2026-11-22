/* Negara Merdu — modul game "istana" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Istana: pohon pot plaza dan kompleks Istana Negara (pusatKota) + karakter Pak Presiden. */
import { LAMPU_TAMAN, M, MAT_JENDELA, buatTeksturProsedural, kotak, scene } from "./bersama.js";
import { PUSAT_X, PUSAT_Z, hashInt } from "./inti.js";
import { bangkuTaman, teksturBenderaMerdu } from "./fasilitas.js";
import { buatKarakter, buatLabel } from "./karakter.js";
import { gambarPapanRencana, papanTex, rencanaTex, rintangan } from "./rumah.js";

  export let animasiKades = null; // diisi pusatKota(): karakter Pak Presiden (dipindah dari rumah.js — di-assign di sini)
  export function pohonPot(x, z, induk) { // pohon dalam pot terakota (palet balai 0xb5533c), basis di puncak slab plaza
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.8, 8), M(0xb5533c));
    pot.position.y = 0.4; pot.castShadow = true; g.add(pot);
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 6), M(0x8a5a30));
    batang.position.y = 1.4; g.add(batang);
    const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), M(0x4da653));
    daun.position.y = 2.9; daun.castShadow = true; g.add(daun);
    g.position.set(x, 0.3, z); (induk || scene).add(g);
    return g;
  }
  function buatKanvasPlaza(skala) { // ubin paving 8x8 unit: 4x4 batu, nat gelap tipis, variasi warna halus
    const S = Math.max(32, Math.round(128 * skala));
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const c = cv.getContext("2d"); const u = S / 128, sel = S / 4;
    c.fillStyle = "#a99a80"; c.fillRect(0, 0, S, S); // nat
    const PALET = ["#ddd0b6", "#d6c7aa", "#e3d8c1", "#cfbf9f", "#d9cbb0"];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const h = hashInt(x * 17 + y * 5 + 11);
      c.fillStyle = PALET[Math.floor(h * PALET.length)];
      c.fillRect(x * sel + 1.2 * u, y * sel + 1.2 * u, sel - 2.4 * u, sel - 2.4 * u);
      c.fillStyle = "rgba(255,255,255,0.18)"; c.fillRect(x * sel + 1.2 * u, y * sel + 1.2 * u, sel - 2.4 * u, 1.4 * u);
      c.fillStyle = "rgba(80,60,30,0.10)"; c.fillRect(x * sel + 1.2 * u, (y + 1) * sel - 2.6 * u, sel - 2.4 * u, 1.4 * u);
    }
    return cv;
  }
  (function pusatKota() {
    /* Seluruh kompleks plaza + istana dibangun di grup yang berpusat di
       (PUSAT_X, PUSAT_Z) = as persimpangan jalan tengah — istana tepat
       segaris dengan jalan utara-selatan. Koordinat di bawah tetap lokal. */
    const pusat = new THREE.Group(); pusat.position.set(PUSAT_X, 0, PUSAT_Z); scene.add(pusat);
    const rintanganPusat = (r) => rintangan.push({ minX: r.minX + PUSAT_X, maxX: r.maxX + PUSAT_X, minZ: r.minZ + PUSAT_Z, maxZ: r.maxZ + PUSAT_Z });
    // AUDIT Z-FIGHTING: pusat y 0,15 -> 0,17 supaya wajah bawah plaza (dulu persis y=0,
    // koplanar dengan plane tanah) kini menggantung 0,02 di atasnya; puncak 0,32.
    const plaza = kotak(208, 0.3, 104, 0xffffff, 0, 0.17, 0); plaza.castShadow = false; pusat.add(plaza);
    /* Perkerasan plaza (perbaikan 3D): dulu satu bidang pasir polos 208x104
       yang dari kamera Orbit terbaca sebagai "lempeng kosong". Kini paving
       batu berpola 4x4 per ubin dengan variasi warna & nat, diulang tiap
       8 unit — skala terasa, plaza tidak lagi datar. */
    const texPlaza = buatTeksturProsedural(buatKanvasPlaza);
    texPlaza.wrapS = texPlaza.wrapT = THREE.RepeatWrapping;
    texPlaza.repeat.set(208 / 8, 104 / 8); texPlaza.anisotropy = 4;
    plaza.material.map = texPlaza; plaza.material.needsUpdate = true;
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
    g.position.set(0, 0, -34); pusat.add(g);
    /* Tapak istana mewah (?v=24): podium + badan + portico + sayap menyatu
       satu kompleks tertabrak (AABB menyatu menutup seluruh tapak podium
       x[-28.2,28.2] z lokal[-8.8,11.0]); air mancur & pagar pelataran
       ditabrak terpisah, gerbang selatan (x -4.2..4.2) terbuka. Tangga
       (z lokal 10.8..17.2) & pelataran rendah (0.34) di luar AABB —
       bisa dinaiki/diinjaki seperti teras rumah. */
    rintanganPusat({ minX: -15.6, maxX: 15.6, minZ: -42.8, maxZ: -23 });    // badan utama + portico istana
    rintanganPusat({ minX: -28.2, maxX: -13.8, minZ: -42.8, maxZ: -23 });   // sayap barat + podium depannya
    rintanganPusat({ minX: 13.8, maxX: 28.2, minZ: -42.8, maxZ: -23 });     // sayap timur + podium depannya
    rintanganPusat({ minX: -4.1, maxX: 4.1, minZ: -14.2, maxZ: -5.8 });     // air mancur
    rintanganPusat({ minX: -28.2, maxX: -4.2, minZ: -3.7, maxZ: -3.1 });    // pagar selatan, barat gerbang
    rintanganPusat({ minX: 4.2, maxX: 28.2, minZ: -3.7, maxZ: -3.1 });      // pagar selatan, timur gerbang
    rintanganPusat({ minX: -28.2, maxX: -27.6, minZ: -29.4, maxZ: -3.1 });  // pagar barat
    rintanganPusat({ minX: 27.6, maxX: 28.2, minZ: -29.4, maxZ: -3.1 });    // pagar timur
    const kades = buatKarakter({ baju: "#6e4525", kulit: "#f1c27d", topi: "peci" });
    kades.scale.setScalar(1.5); kades.position.set(4.6, 0.34, -16.6); pusat.add(kades); animasiKades = kades; // berdiri di pelataran, di kaki tangga istana
    const lk = buatLabel("Pak Presiden", 4.4); lk.position.set(4.6, 3.7, -16.6); pusat.add(lk);
    // tugu — palet diseragamkan dengan balai: badan krem 0xfdf3d8 + sabuk terakota 0xb5533c
    const tugu = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 5.4, 4), M(0xfdf3d8));
    tb.position.y = 2.7; tb.castShadow = true; tugu.add(tb);
    const pita = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.5, 4), M(0xb5533c));
    pita.position.y = 1.7; pita.castShadow = true; tugu.add(pita);
    const bola = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), M(0xf2b13d, 0.5));
    bola.position.y = 6.1; tugu.add(bola); tugu.position.set(-30, 0.3, 8); pusat.add(tugu);
    rintanganPusat({ minX: -31.6, maxX: -28.4, minZ: 6.4, maxZ: 9.6 }); // tugu
    // papan raksasa
    const pg = new THREE.Group();
    pg.add(kotak(0.5, 6, 0.5, 0x7a4a21, -5.4, 3, 0));
    pg.add(kotak(0.5, 6, 0.5, 0x7a4a21, 5.4, 3, 0));
    const board = new THREE.Mesh(new THREE.BoxGeometry(13.5, 7.6, 0.3),
      [M(0x7a4a21), M(0x7a4a21), M(0x7a4a21), M(0x7a4a21),
       new THREE.MeshStandardMaterial({ map: papanTex, roughness: 0.9 }), M(0x7a4a21)]);
    board.position.y = 7.4; board.castShadow = true; pg.add(board);
    pg.position.set(34, 0, 26); pg.rotation.y = Math.PI + 0.45;
    pusat.add(pg);
    rintanganPusat({ minX: 26.5, maxX: 41.5, minZ: 18.5, maxZ: 33.5 }); // papan raksasa (perkiraan, papan miring)
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
    pusat.add(pr);
    rintanganPusat({ minX: -41.5, maxX: -26.5, minZ: 18.5, maxZ: 33.5 }); // papan rencana (perkiraan, papan miring)
    gambarPapanRencana();
    // pohon plaza
    for (const [x, z] of [[-95, -45], [95, -45], [-95, 45], [95, 45], [-60, 45], [60, 45], [-60, -45], [60, -45]]) {
      const pohon = new THREE.Group();
      const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 2.6, 6), M(0x8a5a30));
      batang.position.y = 1.3; pohon.add(batang);
      const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), M(0x4da653));
      daun.position.y = 4.4; daun.castShadow = true; pohon.add(daun);
      pohon.position.set(x, 0.3, z); pusat.add(pohon);
    }
    /* Perapian plaza: bangku & pohon pot ditaruh SIMETRIS terhadap sumbu
       plaza (berpasangan ±x), menghadap pita tengah tempat warga berjalan.
       Paletnya keluarga balai (kayu + terakota). Tanpa rintangan baru —
       perlakuan sama seperti pohon plaza: dekorasi tidak ditabrak. */
    for (const bx of [-24, 24]) {
      const b1 = bangkuTaman(bx, 28, Math.PI); b1.position.y = 0.3; pusat.add(b1); // menghadap balai (-z)
      const b2 = bangkuTaman(bx, 2, 0); b2.position.y = 0.3; pusat.add(b2);        // menghadap jalur (+z)
    }
    for (const [px, pz] of [[-52, 28], [52, 28], [-52, 2], [52, 2], [-10, -20], [10, -20]]) pohonPot(px, pz, pusat);
  })();

  /* ================= DISTRIK DETAIL (WARGA TERBARU) ================= */
