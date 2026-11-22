/* Negara Merdu — modul game "fasilitas" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Fasilitas: papan nama, bendera, model fasilitas, lahan pembangunan, dan pinggiran kota. */
import { MODEL_BARU } from "./fasilitasBaru.js";
import { FASILITAS_BLOK, JALAN, KOTA_D, KOTA_W, PITCH, TAMAN, hashInt, sudutBlok } from "./inti.js";
import { LAMPU_TAMAN, M, REG_TEX, TEX_ATAP, TEX_KILAU, buatKanvasSawah, buatTeksturProsedural, dataPembangunan, gabungGeometri, geometriAtapPelana, kotak, scene, tambahKilau } from "./bersama.js";
import { TAPAK_FASILITAS, rintanganFasilitas } from "./rumah.js";

  export const FASILITAS_NAMA = {
    taman: "Taman Desa", lapangan: "Lapangan Bola", perpustakaan: "Perpustakaan Desa",
    balai_warga: "Balai Warga", sekolah: "Sekolah Dasar", puskesmas: "Puskesmas",
    pasar: "Pasar Desa", masjid: "Masjid", toko_pancing: "Toko Pancing",
  };
  export function pusatBlok(kol, bar) { // titik tengah alas blok (sama seperti alas taman lama)
    const s = sudutBlok(kol, bar);
    return { x: s.x + PITCH / 2 + JALAN / 2, z: s.z + PITCH / 2 + JALAN / 2 };
  }
  export function geometriPagarBlok() { // pagar keliling petak 66x66: tiang + 2 rel per sisi, basis y=0
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
  export function teksturPapanNama(besar, kecil) { // papan kayu: judul krem + subjudul kuning
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
  export function teksturPapanTokoPancing() { // papan toko pancing: ikon ikan digambar sendiri di canvas (tanpa emoji) + nama toko
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
  /* Cache tekstur disimpan di properti fungsi, BUKAN `let` modul: deklarasi
     fungsi terinisialisasi sejak fase instansiasi modul, jadi slot cache ini
     tidak pernah kena TDZ walau fungsi dipanggil sebelum badan modul ini
     dievaluasi (akar insiden loading 22 Nov 15:13). */
  export function teksturBenderaMerdu() { // bendera Negara Merdu (?v=25): hijau tua + matahari emas 8 sinar + lis emas, rasio 3:2
    if (teksturBenderaMerdu._tex) return teksturBenderaMerdu._tex;
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
    teksturBenderaMerdu._tex = new THREE.CanvasTexture(cv);
    return teksturBenderaMerdu._tex;
  }
  export function buatPapanNama(besar, kecil) { // grup papan: 2 tiang + panel bertekstur, basis y=0
    const g = new THREE.Group();
    g.add(kotak(0.24, 3.0, 0.24, 0x7a4a21, -4.4, 1.5, 0));
    g.add(kotak(0.24, 3.0, 0.24, 0x7a4a21, 4.4, 1.5, 0));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(11, 3.2, 0.18),
      new THREE.MeshStandardMaterial({ map: teksturPapanNama(besar, kecil), roughness: 0.9 }));
    panel.position.set(0, 2.9, 0); panel.castShadow = true; g.add(panel);
    return g;
  }
  /* Pohon fasilitas (perbaikan 3D): dulu 1 ikosahedron hijau seragam —
     kini batang + 3 gumpal daun berlapis, warna daun bervariasi per posisi
     (deterministik), siluet lebih rimbun & alami. */
  const WARNA_DAUN = [0x4da653, 0x3f8f4f, 0x5fae4a, 0x6aa84f, 0x2f7d4a];
  export function pohonKecil(x, z, s) {
    const g = new THREE.Group();
    const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    const batang = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 2.2, 8), M(0x7a5030));
    batang.position.y = 1.1; batang.castShadow = true; g.add(batang);
    const c1 = WARNA_DAUN[Math.floor(h * WARNA_DAUN.length)], c2 = WARNA_DAUN[Math.floor(h * 7) % WARNA_DAUN.length];
    for (const [ox, oy, oz, r, c] of [[0, 3.0, 0, 1.9, c1], [0.9, 2.5, 0.5, 1.3, c2], [-0.8, 2.6, -0.4, 1.35, c2], [0.1, 4.1, -0.1, 1.25, c1]]) {
      const daun = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), M(c));
      daun.position.set(ox, oy, oz); daun.castShadow = true; daun.receiveShadow = true; g.add(daun);
    }
    g.position.set(x, 0, z); g.scale.setScalar((s || 1) * (0.9 + h * 0.25)); g.rotation.y = h * 6.28;
    return g;
  }
  /* Air alami (perbaikan taman & pemancingan): tepi dangkal terang ->
     tengah dalam, permukaan sedikit mengilap, daun teratai opsional.
     Menggantikan cakram biru polos rata. rx/rz = jari-jari elips. */
  export function airAlami(g, x, z, rx, rz, y, teratai) {
    const lapis = [[1.0, 0x8fd0df, 0.25], [0.82, 0x4fa9c9, 0.15], [0.55, 0x2f86ad, 0.08]];
    lapis.forEach(([f, warna, kasar], i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 40),
        new THREE.MeshStandardMaterial({ color: warna, roughness: kasar, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -1 - i, polygonOffsetUnits: -1 - i }));
      m.rotation.x = -Math.PI / 2; m.scale.set(rx * f, rz * f, 1); m.position.set(x, y + i * 0.006, z); m.receiveShadow = true; g.add(m);
    });
    for (let i = 0; i < (teratai || 0); i++) { // daun teratai: cakram bertakik + bunga
      const a = i * 2.39996, rr = 0.35 + (i % 3) * 0.17;
      const px = x + Math.cos(a) * rx * rr * 1.4, pz = z + Math.sin(a) * rz * rr * 1.4;
      const daun = new THREE.Mesh(new THREE.CircleGeometry(0.55 + (i % 2) * 0.2, 14, 0.4, Math.PI * 2 - 0.5), M(0x4f9a3e));
      daun.rotation.x = -Math.PI / 2; daun.rotation.z = a; daun.position.set(px, y + 0.03, pz); g.add(daun);
      if (i % 3 === 0) {
        const bunga = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 6), M(0xf2a3c0));
        bunga.position.set(px + 0.15, y + 0.15, pz); g.add(bunga);
      }
    }
  }
  /* Bebek kecil (taman): badan + kepala + paruh, mengapung. */
  export function bebek(x, z, y, ry) {
    const b = new THREE.Group();
    const badan = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), M(0xfaf6ea)); badan.scale.set(1, 0.7, 1.35); b.add(badan);
    const kepala = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), M(0xfaf6ea)); kepala.position.set(0, 0.38, 0.42); b.add(kepala);
    const paruh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), M(0xf2a33a)); paruh.rotation.x = Math.PI / 2; paruh.position.set(0, 0.36, 0.7); b.add(paruh);
    b.position.set(x, y + 0.12, z); b.rotation.y = ry || 0;
    return b;
  }
  /* Pagar semak keliling blok (±L), dengan celah di titik masuk. */
  export function pagarSemak(g, L, celah) {
    const mat = M(0x3f8a45);
    const ruas = (x1, z1, x2, z2) => {
      const pj = Math.hypot(x2 - x1, z2 - z1); if (pj < 0.5) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 === x2 ? 1.0 : pj, 1.15, x1 === x2 ? pj : 1.0), mat);
      m.position.set((x1 + x2) / 2, 0.58, (z1 + z2) / 2); m.castShadow = true; m.receiveShadow = true; g.add(m);
    };
    for (const sisi of ["n", "s", "w", "e"]) {
      const lubang = (celah[sisi] || []).slice().sort((a, b) => a[0] - b[0]);
      let mulai = -L;
      for (const [a, b] of [...lubang, [L, L]]) {
        if (sisi === "n") ruas(mulai, -L, a, -L); if (sisi === "s") ruas(mulai, L, a, L);
        if (sisi === "w") ruas(-L, mulai, -L, a); if (sisi === "e") ruas(L, mulai, L, a);
        mulai = b;
      }
    }
  }
  export function bangkuTaman(x, z, rot) {
    const g = new THREE.Group();
    g.add(kotak(2.6, 0.18, 0.7, 0xa9743f, 0, 0.5, 0));
    g.add(kotak(2.6, 0.7, 0.14, 0xa9743f, 0, 0.95, -0.3));
    g.add(kotak(0.18, 0.5, 0.6, 0x7a4a21, -1.1, 0.25, 0));
    g.add(kotak(0.18, 0.5, 0.6, 0x7a4a21, 1.1, 0.25, 0));
    g.position.set(x, 0, z); g.rotation.y = rot || 0;
    return g;
  }
  export function matAtapWarna(warna) {
    return new THREE.MeshStandardMaterial({ color: warna, map: TEX_ATAP, roughness: 0.95, flatShading: true });
  }
  /* Model prosedural tiap fasilitas — bentuk sederhana tapi bisa dibedakan
     dari jauh. Grup berisi y=0 di permukaan alas blok; posisi grup diatur
     pemanggil. Semua primitif dasar, flat shading, palet desa. */
  export const MODEL_FASILITAS = {
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
      // kolam: bibir batu + air berlapis (dangkal -> dalam) + teratai + bebek
      const bibir = new THREE.Mesh(new THREE.TorusGeometry(6.6, 0.38, 6, 28), M(0xb8a888));
      bibir.rotation.x = Math.PI / 2; bibir.position.set(-14, 0.18, -12); bibir.scale.z = 0.5; g.add(bibir);
      airAlami(g, -14, -12, 6.5, 6.5, 0.12, 7);
      g.add(bebek(-12.5, -10.5, 0.12, 0.6)); g.add(bebek(-16, -13.5, 0.12, 2.4)); g.add(bebek(-15.2, -9.8, 0.12, 4.0));
      /* air mancur tengah (pola istana diperkecil): bak bundar batu +
         air + tiang berundak + mangkuk + bola emas. Tanpa semprotan —
         pelajaran istana: kerucut semprotan terbaca murahan. */
      const batu = M(0xb8a888), batuT = M(0x9a8a70);
      const bak = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 4.15, 0.75, 16), batu);
      bak.position.y = 0.38; bak.castShadow = true; g.add(bak);
      const lisBak = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 4.1, 0.2, 16), batuT);
      lisBak.position.y = 0.82; g.add(lisBak);
      const airM = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.08, 16),
        new THREE.MeshStandardMaterial({ color: 0x3f98bf, roughness: 0.1, metalness: 0.05 }));
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
      /* Perbaikan taman: pagar semak keliling (celah di 4 ujung jalan
         setapak + gerbang timur), deret pohon rindang di tepi, & alas
         piknik — taman terasa tertutup, teduh, dan ramai. */
      pagarSemak(g, 33.6, { n: [[-3, 3]], s: [[-3, 3]], w: [[-3, 3]], e: [[-5, 5]] });
      for (const [x, z, sk] of [[-30, -30, 1.1], [-30, -18, 0.95], [-30, 17, 1.0], [-30, 30, 1.1], [-18, -30, 1.0], [-6, -30, 0.9],
        [8, -30, 0.95], [30, -30, 1.1], [30, -24, 0.9], [-18, 30, 1.05], [-9, 30, 0.9], [18, 30, 1.0], [30, 30, 1.15], [30, 20, 0.9]])
        g.add(pohonKecil(x, z, sk));
      for (const [mx, mz, mw] of [[-20, 4, 0xe86a5e], [-12, 25, 0x57b7d6]]) { // tikar piknik + keranjang
        g.add(kotak(3.0, 0.05, 2.2, mw, mx, 0.03, mz));
        g.add(kotak(0.7, 0.45, 0.5, 0xa9743f, mx + 0.8, 0.25, mz - 0.4));
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
      airAlami(g, KX, 0, 7.6, 10.6, 0.10, 5); // air berlapis dangkal->dalam + teratai (dulu cakram biru polos)
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
      /* Perbaikan pemancingan: lahan kosong luas di barat & selatan kini
         taman pinggir kolam — deret pohon peneduh, pagar semak keliling
         (celah masuk di utara depan toko), meja piknik, & ikan meloncat. */
      pagarSemak(g, 33.6, { n: [[-9, 3]], e: [[-14, 14]] }); // timur dibuka: tepi pasir kolam sampai x 33,8
      for (const [x, z, sk] of [[-30, -28, 1.1], [-30, -16, 0.95], [-30, -4, 1.05], [-30, 8, 0.95], [-30, 20, 1.1], [-30, 30, 1.0],
        [-20, 30, 1.0], [-8, 30, 0.95], [6, 30, 1.05], [18, 29, 0.9], [31, 22, 1.0], [-22, -26, 0.9], [12, -28, 1.0], [30, -28, 1.05]])
        g.add(pohonKecil(x, z, sk));
      for (const [mx, mz] of [[-20, 6], [-20, 20], [-8, 22]]) { // meja piknik kayu
        g.add(kotak(2.6, 0.12, 1.3, 0xa9743f, mx, 0.95, mz));
        for (const dz of [-1.0, 1.0]) g.add(kotak(2.6, 0.1, 0.45, 0x8a5a30, mx, 0.55, mz + dz));
        for (const dx of [-1.0, 1.0]) g.add(kotak(0.14, 0.95, 1.2, 0x7a4a21, mx + dx, 0.47, mz));
      }
      for (const [fx, fz, rot] of [[26, -4, 0.6], [22, 5, 2.2]]) { // ikan meloncat di kolam
        const ikan = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 6), M(0xf2a33a));
        ikan.scale.set(0.6, 0.6, 1.4); ikan.position.set(fx, 0.75, fz); ikan.rotation.set(-0.6, rot, 0); g.add(ikan);
        const ekor = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), M(0xe0782a));
        ekor.position.set(fx - Math.sin(rot) * 0.45, 0.6, fz - Math.cos(rot) * 0.45); ekor.rotation.set(-0.6 - Math.PI / 2, rot, 0); g.add(ekor);
        const riak = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 20), new THREE.MeshBasicMaterial({ color: 0xdff4fa, transparent: true, opacity: 0.7 }));
        riak.rotation.x = -Math.PI / 2; riak.position.set(fx, 0.14, fz); g.add(riak);
      }
    },
  };
  /* Model baru fasilitas lama (fasilitasBaru.js) menimpa model lama —
     taman & toko pancing tetap memakai model di atas. */
  Object.assign(MODEL_FASILITAS, MODEL_BARU);
  export function bangunLahanPembangunan() {
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
