/* Negara Merdu — modul game "rumah" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Rumah: rumah detail di kavling asli, papan distrik, rintangan & tapak fasilitas, dan interior rumah. */
import { $, BLOK_KOLOM, KAPASITAS, PER_BLOK, PINTU_ISTANA, PUSAT_X, PUSAT_Z, Z_ISTANA, aktivitasUntukNpc, hashInt, posisiKavling, warnaDindingZonaHSL, zonaDariKolBar } from "./inti.js";
import { M, TEX_ATAP, daftarRumah, dataPembangunan, geometriAtapPelana, meshPelana, plafonTerang, kotak, scene, statistik, wargaTerbaru, warnaPemilik } from "./bersama.js";
import { FASILITAS_NAMA } from "./fasilitas.js";
import { buatKarakter, buatLabel } from "./karakter.js";
import { PETUNJUK, aturMode, fp, modeKamera, posisiDepanRumah } from "./kamera.js";
import { buangGrup, kirimPosisi } from "./jaringan.js";
import { perbaruiMinimapTampil } from "./peta.js";
import { UKURAN_ISTANA_DALAM, bangunInteriorIstana } from "./istanaDalam.js";
import { PINTU_MALL, TAPAK_BARU } from "./fasilitasBaru.js";
import { UKURAN_MALL_DALAM, bangunInteriorMall } from "./mallDalam.js";
import { aksiTransportasi, setKaitNaik } from "./transportasi.js";
import { AP, aksiApartemen, pintuApartemen, jepitRuang, masukApartemenLobi, resetApartemen, setKaitApartemen } from "./apartemen.js";

  export function buatRumahDetail(dinding, atap, varian, cerobong) {
    const g = new THREE.Group();
    const TRIM = 0xfdf3d8, KAYU = 0x7a4a21, KAYU_T = 0x5c3618;

    const matDind = new THREE.MeshStandardMaterial({ color: dinding, roughness: 0.88, flatShading: true });
    const matKaca = new THREE.MeshStandardMaterial({
      color: 0xbfe6f8, roughness: 0.08, metalness: 0.25,
      transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide,
    });
    const matTirai = new THREE.MeshStandardMaterial({
      color: 0xfaf5eb, roughness: 0.9, transparent: true, opacity: 0.72,
    });
    const matLampu = new THREE.MeshStandardMaterial({
      color: 0xfff4d4, emissive: 0xffcf82, emissiveIntensity: 1.35, roughness: 0.35,
    });

    const boxD = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matDind);
      m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };

    // Helper kaca transparan + kusen + tirai dalam
    function pasangJendela(w, h, x, y, z, rotY, pakaiBunga) {
      const jg = new THREE.Group();
      // Bingkai 4 sisi (bukan kotak padat, jadi benar-benar berlubang)
      jg.add(kotak(w + 0.14, 0.09, 0.18, KAYU, 0, h / 2 + 0.03, 0));
      jg.add(kotak(w + 0.14, 0.09, 0.18, KAYU, 0, -h / 2 - 0.03, 0));
      jg.add(kotak(0.09, h, 0.18, KAYU, -w / 2 - 0.03, 0, 0));
      jg.add(kotak(0.09, h, 0.18, KAYU, w / 2 + 0.03, 0, 0));
      // Kusen silang tipis
      jg.add(kotak(0.05, h, 0.06, KAYU, 0, 0, 0));
      jg.add(kotak(w, 0.05, 0.06, KAYU, 0, 0, 0));
      // Panel kaca transparan nyata
      const kaca = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matKaca);
      jg.add(kaca);
      // Tirai tipis di sisi dalam
      for (const sx of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h - 0.04, 0.03), matTirai);
        t.position.set(sx * (w * 0.37), 0, -0.08); jg.add(t);
      }
      // Ambang luar + kotak bunga opsional
      jg.add(kotak(w + 0.24, 0.09, 0.26, TRIM, 0, -h / 2 - 0.07, 0.06));
      if (pakaiBunga) {
        jg.add(kotak(w * 0.85, 0.20, 0.22, 0x9c5a3c, 0, -h / 2 - 0.20, 0.14));
        for (let i = -1; i <= 1; i++) {
          const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), M(i === 0 ? 0xf2b13d : 0xe86a92));
          b.position.set(i * (w * 0.26), -h / 2 - 0.05, 0.15); jg.add(b);
        }
      }
      jg.position.set(x, y, z); jg.rotation.y = rotY || 0;
      g.add(jg);
    }

    // 1. Pondasi & Lantai Interior Parket + Plafon
    g.add(kotak(5.9, 0.35, 5.3, 0x8f887f, 0, 0.175, 0));
    g.add(kotak(5.1, 0.06, 4.5, 0xb88b58, 0, 0.38, 0));   // lantai kayu dalam
    g.add(kotak(5.2, 0.10, 4.6, 0xf6efe0, 0, 3.28, 0));   // plafon dalam

    // 2. Dinding Berbukaan Nyata (tebal 0.22; luar x:±2.7, z:±2.4, y:0.35..3.35)
    // Dinding Depan (z = +2.29) — lubang pintu & 2 jendela
    boxD(0.45, 3.0, 0.22, -2.475, 1.85, 2.29);
    boxD(0.45, 3.0, 0.22,  2.475, 1.85, 2.29);
    boxD(0.47, 3.0, 0.22, -0.815, 1.85, 2.29);
    boxD(0.47, 3.0, 0.22,  0.815, 1.85, 2.29);
    boxD(1.20, 1.0, 0.22, -1.65,  0.85, 2.29); // spandrel bawah jendela kiri
    boxD(1.20, 1.0, 0.22,  1.65,  0.85, 2.29); // spandrel bawah jendela kanan
    boxD(1.20, 0.8, 0.22, -1.65,  2.95, 2.29); // header atas jendela kiri
    boxD(1.20, 0.8, 0.22,  1.65,  2.95, 2.29); // header atas jendela kanan
    boxD(1.16, 1.05, 0.22, 0,     2.825, 2.29); // header atas pintu

    // Dinding Kiri & Kanan (x = ±2.59) — lubang jendela lebar 1.4
    for (const sx of [-1, 1]) {
      const wx = sx * 2.59;
      boxD(0.22, 3.0, 1.08, wx, 1.85, -1.64);
      boxD(0.22, 3.0, 1.88, wx, 1.85,  1.24);
      boxD(0.22, 1.0, 1.40, wx, 0.85, -0.40);
      boxD(0.22, 0.8, 1.40, wx, 2.95, -0.40);
    }

    // Dinding Belakang (z = -2.29) — lubang jendela panoramik lebar 2.4
    boxD(1.50, 3.0, 0.22, -1.95, 1.85, -2.29);
    boxD(1.50, 3.0, 0.22,  1.95, 1.85, -2.29);
    boxD(2.40, 1.0, 0.22,  0,    0.85, -2.29);
    boxD(2.40, 0.8, 0.22,  0,    2.95, -2.29);

    // Pasang jendela transparan pada ke-5 bukaan dinding
    pasangJendela(1.20, 1.20, -1.65, 1.95,  2.29, 0, varian === 0);
    pasangJendela(1.20, 1.20,  1.65, 1.95,  2.29, 0, varian === 0);
    pasangJendela(1.40, 1.20,  2.59, 1.95, -0.40, Math.PI / 2, false);
    pasangJendela(1.40, 1.20, -2.59, 1.95, -0.40, -Math.PI / 2, false);
    pasangJendela(2.40, 1.20,  0,    1.95, -2.29, Math.PI, false);

    // 3. Interior 3D Nyata di Dalam Rumah (terlihat menembus jendela)
    const aksenRuang = new THREE.Color(atap).lerp(new THREE.Color(0xf4ead8), 0.35).getHex();
    // Karpet + Ruang Tamu (kiri)
    g.add(kotak(2.1, 0.03, 1.8, aksenRuang, -1.15, 0.425, 0.35));
    g.add(kotak(1.6, 0.36, 0.65, 0x8b7e74, -1.35, 0.59, -0.35));   // sofa utama
    g.add(kotak(1.6, 0.42, 0.16, 0x776b62, -1.35, 0.88, -0.60));   // sandaran sofa
    g.add(kotak(0.85, 0.24, 0.48, 0x8a5a30, -1.25, 0.53, 0.45));   // meja kopi
    g.add(kotak(0.28, 0.42, 1.15, 0x6b4423, -2.30, 0.62, 0.55));   // kabinet TV
    g.add(kotak(0.06, 0.58, 0.95, 0x1b2228, -2.32, 1.15, 0.55));   // TV layar datar
    // Area Tidur & Lemari (kanan)
    g.add(kotak(1.55, 0.30, 1.95, 0x8a5a30, 1.45, 0.56, -0.85));   // rangka kasur
    g.add(kotak(1.45, 0.20, 1.85, 0xfaf6ee, 1.45, 0.78, -0.85));   // matras
    g.add(kotak(1.48, 0.10, 1.15, aksenRuang, 1.45, 0.90, -0.50)); // selimut
    g.add(kotak(0.55, 0.14, 0.35, 0xffffff, 1.15, 0.92, -1.52));   // bantal 1
    g.add(kotak(0.55, 0.14, 0.35, 0xffffff, 1.75, 0.92, -1.52));   // bantal 2
    g.add(kotak(0.55, 1.85, 1.15, 0x7a4a21, 2.15, 1.33, 1.25));    // lemari kayu
    // Lampu plafon menyala hangat (membuat interior hidup dilihat dari luar)
    const lampuDalam = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 12), matLampu);
    lampuDalam.position.set(0, 3.16, 0); g.add(lampuDalam);

    // 4. Lis Atap, Papan Sudut & Variasi Atap
    g.add(kotak(5.65, 0.22, 5.05, TRIM, 0, 3.35, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      g.add(kotak(0.20, 3.0, 0.20, TRIM, sx * 2.66, 1.85, sz * 2.36));
    }
    const matAtap = new THREE.MeshStandardMaterial({ color: atap, map: TEX_ATAP, roughness: 0.9, flatShading: true });
    if (varian === 0) {
      const roof = meshPelana(geometriAtapPelana(6.8, 2.3, 6.2), matAtap);
      roof.position.y = 3.42; roof.castShadow = true; g.add(roof);
    } else if (varian === 1) {
      matAtap.flatShading = false; const geoL = new THREE.ConeGeometry(4.15, 2.35, 4); geoL.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(plafonTerang(geoL), matAtap);
      roof.position.y = 4.58; roof.castShadow = true; g.add(roof);
    } else {
      matAtap.flatShading = false; const slab = new THREE.Mesh(plafonTerang(new THREE.BoxGeometry(6.2, 0.36, 5.6)), matAtap);
      slab.position.y = 3.58; slab.castShadow = true; g.add(slab);
      g.add(kotak(5.8, 0.28, 0.14, TRIM, 0, 3.88, 2.55));
      g.add(kotak(2.2, 0.72, 2.0, dinding, -1.2, 4.10, -0.8));
      g.add(kotak(2.35, 0.12, 2.15, TRIM, -1.2, 4.50, -0.8));
    }
    if (cerobong && varian !== 2) {
      g.add(kotak(0.52, 1.25, 0.52, 0xa2604c, 1.35, 4.75, -0.8));
      g.add(kotak(0.66, 0.12, 0.66, 0x7a4a3a, 1.35, 5.40, -0.8));
    }

    // 5. Teras, Pintu Kaca, Railing & Lampu Teras
    g.add(kotak(3.1, 0.24, 1.55, 0xa9743f, 0, 0.12, 3.08));
    g.add(kotak(1.4, 0.14, 0.55, 0x8f887f, 0, 0.26, 2.72));
    for (const sx of [-1, 1]) {
      g.add(kotak(0.15, 2.45, 0.15, 0x8a5a30, sx * 1.45, 1.45, 3.72));
      g.add(kotak(0.08, 0.08, 1.3, 0x8a5a30, sx * 1.45, 0.85, 3.05));
      g.add(kotak(0.06, 0.62, 0.06, 0x8a5a30, sx * 1.45, 0.55, 3.05));
    }
    const atapTeras = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.88),
      new THREE.MeshStandardMaterial({ color: atap, roughness: 0.9, flatShading: true }));
    atapTeras.position.set(0, 2.74, 3.12); atapTeras.rotation.x = -0.10; atapTeras.castShadow = true; g.add(atapTeras);
    const lampuT = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), matLampu);
    lampuT.position.set(0.84, 2.15, 2.46); g.add(lampuT);

    // Pintu berbingkai + kaca intip transparan + kenop kuningan
    g.add(kotak(1.26, 2.02, 0.16, TRIM, 0, 1.36, 2.30));
    g.add(kotak(1.06, 1.90, 0.12, KAYU, 0, 1.30, 2.31));
    g.add(kotak(0.70, 0.56, 0.05, KAYU_T, 0, 0.82, 2.37));
    const kacaPintu = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.54), matKaca);
    kacaPintu.position.set(0, 1.72, 2.38); g.add(kacaPintu);
    const kenop = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M(0xd9a441, 0.35));
    kenop.position.set(0.40, 1.28, 2.40); g.add(kenop);

    // Hiasan halaman
    if (varian !== 1) for (const sx of [-1, 1]) {
      const semak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), M(0x4e9a44));
      semak.position.set(sx * 2.25, 0.30, 3.3); semak.scale.y = 0.82; semak.castShadow = true; g.add(semak);
    }
    if (varian !== 0) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.26, 8), M(0xb56545));
      pot.position.set(2.3, 0.13, 3.15); g.add(pot);
      const bunga = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), M(0xe86a92));
      bunga.position.set(2.3, 0.38, 3.15); g.add(bunga);
    }
    return g;
  }

  /* ---------- Pusat kota: plaza, balai, papan, tugu ---------- */
  export const papanCv = document.createElement("canvas"); papanCv.width = 1024; papanCv.height = 512;
  export const papanTex = new THREE.CanvasTexture(papanCv);
  export function gambarPapan() {
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
  export const URUTAN_PAPAN_RENCANA = ["taman", "lapangan", "perpustakaan", "balai_warga", "sekolah", "puskesmas", "pasar", "koperasi", "dapur_mbg", "masjid", "apartemen", "mall", "toko_pancing"];
  export const rencanaCv = document.createElement("canvas"); rencanaCv.width = 1152; rencanaCv.height = 640;
  export const rencanaTex = new THREE.CanvasTexture(rencanaCv);
  export function gambarPapanRencana() {
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
  /* Rintangan tabrakan mode 1st Person: AABB statis (pusat kota) + detail (diisi ulang tiap bangunDistrik) */
  export const rintangan = [];
  export const rintanganDetail = [];
  export const rintanganFasilitas = []; // AABB bangunan fasilitas terbangun (diisi bangunLahanPembangunan)
  /* Tapak bangunan fasilitas relatif ke pusat bloknya (pusatBlok) — diambil
     dari ukuran kotak gedung di MODEL_FASILITAS. Hanya bangunan berdinding;
     lapangan (memang dilalui) dan balai warga (pendopo terbuka) tidak
     ditabrak; di taman (?v=37) yang ditabrak air (kolam + air mancur),
     gazebo, dan peralatan bermain — jalan setapak & area terbuka bebas. */
  export const TAPAK_FASILITAS = {
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
  Object.assign(TAPAK_FASILITAS, TAPAK_BARU); // tapak model baru fasilitas lama (fasilitasBaru.js)
  export let dinamis = null;
  export const rumahKlik = [];
  export const npcList = [];
  export const JALUR_PLAZA = [[-88, 16], [88, 16], [88, 40], [-88, 40]].map(([x, z]) => [x + PUSAT_X, z + PUSAT_Z]); // relatif pusat plaza
  export const SEGMEN = [];
  export let PANJANG_JALUR = 0;
  for (let i = 0; i < JALUR_PLAZA.length; i++) {
    const a = JALUR_PLAZA[i], b = JALUR_PLAZA[(i + 1) % JALUR_PLAZA.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    SEGMEN.push({ a, b, len, mulai: PANJANG_JALUR }); PANJANG_JALUR += len;
  }
  /* Jalur keliling blok (perbaikan "kota hidup"): NPC pejalan kini tidak
     semua berputar di plaza — sebagian besar berjalan di TROTOAR keliling
     blok perumahan yang berpenghuni di seluruh kota (arah bergantian),
     sisanya tetap meramaikan plaza. */
  export function buatJalurBlok(blok, balik) {
    const bi = blok - 1, kol = bi % BLOK_KOLOM, bar = Math.floor(bi / BLOK_KOLOM);
    const x0 = (kol - BLOK_KOLOM / 2) * 84, z0 = (bar - 50 / 2) * 84; // = sudutBlok (PITCH 84, BLOK_BARIS 50)
    const n = 15.3, f = 82.7; // as trotoar sisi dalam (dekat jalan) tiap tepi blok
    let titik = [[x0 + n, z0 + n], [x0 + f, z0 + n], [x0 + f, z0 + f], [x0 + n, z0 + f]];
    if (balik) titik = titik.reverse();
    const segmen = []; let panjang = 0;
    for (let i = 0; i < titik.length; i++) {
      const a = titik[i], b = titik[(i + 1) % titik.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      segmen.push({ a, b, len, mulai: panjang }); panjang += len;
    }
    return { segmen, panjang };
  }
  export function posisiJalurNpc(u, s) {
    const J = u.jalur; if (!J) return posisiJalur(s);
    s = ((s % J.panjang) + J.panjang) % J.panjang;
    for (const sg of J.segmen) if (s <= sg.mulai + sg.len) {
      const t = sg.len ? (s - sg.mulai) / sg.len : 0;
      return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * t, z: sg.a[1] + (sg.b[1] - sg.a[1]) * t, dx: sg.b[0] - sg.a[0], dz: sg.b[1] - sg.a[1] };
    }
    return posisiJalur(s);
  }
  export function posisiJalur(s) {
    s = ((s % PANJANG_JALUR) + PANJANG_JALUR) % PANJANG_JALUR;
    for (const sg of SEGMEN) if (s <= sg.mulai + sg.len) {
      const t = sg.len ? (s - sg.mulai) / sg.len : 0;
      return { x: sg.a[0] + (sg.b[0] - sg.a[0]) * t, z: sg.a[1] + (sg.b[1] - sg.a[1]) * t, dx: sg.b[0] - sg.a[0], dz: sg.b[1] - sg.a[1] };
    }
    return { x: PUSAT_X, z: 20 + PUSAT_Z, dx: 1, dz: 0 };
  }
  /* Penempatan rumah detail (?v=18, keputusan Fahmi: "1 blok beda nomor
     rumah aja" — tidak ada lagi rumah pajangan di plaza, tidak berjejer
     dan tidak diacak): rumah detail berdiri di posisiKavling ASLI
     pemiliknya (lihat bangunDistrik), menggantikan instans massalnya di
     petak yang sama. */
  export function bangunDistrik() {
    if (dinamis) scene.remove(dinamis);
    dinamis = new THREE.Group(); scene.add(dinamis);
    rumahKlik.length = 0; npcList.length = 0; rintanganDetail.length = 0;
    const blokBerpenghuni = [...new Set(daftarRumah.map((r) => r.blok))]; // blok yang ada rumah warganya
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
      const kar = buatKarakter({ baju: w.warna_baju, kulit: w.warna_kulit, topi: w.topi, rupa: w.rupa });
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
      if (akt.jenis !== "ngobrol" && akt.jenis !== "duduk" && i % 4 !== 0 && blokBerpenghuni.length) { // 3/4 pejalan keliling kota
        const blokJalan = blokBerpenghuni[Math.floor(hashInt(i * 53 + 7) * blokBerpenghuni.length)];
        kar.userData.jalur = buatJalurBlok(blokJalan, i % 2 === 1);
        kar.userData.fase = hashInt(i * 19 + 2) * kar.userData.jalur.panjang;
      }
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
  export const INT = { x: 0, y: -600, z: 0, sw: 8, sd: 6.5, tinggi: 5.4 }; // sw/sd = setengah lebar/dalam ruangan
  export let diInterior = false, interiorKonteks = null, grupInterior = null, rumahDekat = null;
  export let pulihInterior = false; // penanda keluarInterior -> aturMode: posisi fp jangan ditimpa titik mulai
  export const rintanganInterior = []; // AABB perabot, koordinat dunia (lokal + INT)

  export function teksturLantaiKayu() {
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
  export function teksturPapanNamaRumah(w) { // papan alamat rumah warga — nama WAJIB beda dari teksturPapanNama fasilitas (tabrakan nama lama membuat papan fasilitas terbaca "@undefined", laporan Fahmi 2026-11-22)
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
  export function teksturKartuWarga(w) {
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
  export function teksturJendela() {
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
  export function teksturLayarTV() {
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
  export function teksturDindingDalam() { // krem lembut: garis vertikal sangat halus + bintik samar — dinding tidak polos
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
  export function teksturLukisan(varian) { // lukisan low-poly sederhana: langit, matahari, gunung segitiga, tanah
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
  export function teksturCahayaLantai() { // genangan cahaya lembut dari jendela: gradasi radial hangat -> transparan
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    const grd = c.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,226,160,0.85)");
    grd.addColorStop(0.6, "rgba(255,214,140,0.35)");
    grd.addColorStop(1, "rgba(255,214,140,0)");
    c.fillStyle = grd; c.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }
  export function bangunInterior(w) {
    if (grupInterior) { scene.remove(grupInterior); buangGrup(grupInterior); grupInterior = null; }
    rintanganInterior.length = 0;
    INT.sw = 8; INT.sd = 6.5; INT.tinggi = 5.4; // ukuran rumah (interior istana memakai ukuran lain)
    /* Aksen pemilik dilembutkan (campur 40% krem): dulu warna baju jenuh
       (oranye/magenta) dipakai mentah di karpet, gorden & selimut sehingga
       ruangan terasa norak setelah koreksi warna sRGB. */
    const aksen = new THREE.Color(w.warna_baju || "#2e9e5b").lerp(new THREE.Color(0xf3e8d4), 0.4).getHex();
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
    // papan nama dikecilkan jadi plakat kayu di atas dinding (dulu 6,4 m —
    // mendominasi ruangan), bingkai Kartu Warga jadi pigura ukuran wajar
    K(4.0, 1.0, 0.08, 0x7a4a21, -3.4, 4.35, -INT.sd + 0.04);
    const papanNama = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.89),
      new THREE.MeshStandardMaterial({ map: teksturPapanNamaRumah(w), roughness: 0.9 }));
    papanNama.position.set(-3.4, 4.35, -INT.sd + 0.09); g.add(papanNama);
    K(2.1, 1.42, 0.08, 0x5a3418, -3.4, 2.55, -INT.sd + 0.04);
    K(1.96, 1.28, 0.02, 0xf6efe0, -3.4, 2.55, -INT.sd + 0.085); // passe-partout
    const bingkai = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06),
      new THREE.MeshStandardMaterial({ map: teksturKartuWarga(w), roughness: 0.85 }));
    bingkai.position.set(-3.4, 2.55, -INT.sd + 0.1); g.add(bingkai);
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
    const lampu = new THREE.PointLight(0xffdca8, 1.1, 30, 2);
    lampu.position.set(0, T - 1.2, -0.5); g.add(lampu);

    grupInterior = g;
    scene.add(g);
  }
  export function masukInterior(w, rumahGrup) {
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
    $("#tombol-keluar-rumah").lastChild.textContent = " Keluar Rumah";
    $("#petunjuk-teks").textContent = "Di dalam rumah @" + w.username + " · WASD/joystick untuk jalan · Keluar lewat pintu selatan";
    $("#petunjuk").hidden = false;
    kirimPosisi(true); // daftarkan posisi pintu ke server; karakter terlihat berdiri di depan pintu
  }
  /* Titik pintu istana di dunia (puncak tangga portico). */
  export function pintuIstanaDunia() { return { x: PINTU_ISTANA.x + PUSAT_X, z: PINTU_ISTANA.z + PUSAT_Z }; }
  /* Merdu Mall: pola sama dengan istana — aula interior di lokasi INT. */
  export function masukMall() {
    if (diInterior || !PINTU_MALL.length) return;
    const p = PINTU_MALL[0];
    interiorKonteks = { pemilik: { username: "mall" }, jenis: "mall", pintuX: p.x, pintuZ: p.z + 1.5, yawPintu: 0, modeSebelum: modeKamera };
    if (grupInterior) { scene.remove(grupInterior); buangGrup(grupInterior); grupInterior = null; }
    rintanganInterior.length = 0;
    INT.sw = UKURAN_MALL_DALAM.sw; INT.sd = UKURAN_MALL_DALAM.sd; INT.tinggi = UKURAN_MALL_DALAM.tinggi;
    const g = bangunInteriorMall((minX, maxX, minZ, maxZ) =>
      rintanganInterior.push({ minX: INT.x + minX, maxX: INT.x + maxX, minZ: INT.z + minZ, maxZ: INT.z + maxZ }));
    g.position.set(INT.x, INT.y, INT.z);
    grupInterior = g; scene.add(g);
    diInterior = true;
    perbaruiMinimapTampil();
    fp.x = INT.x; fp.z = INT.z + INT.sd - 2.1; fp.yaw = 0; fp.pitch = 0;
    if (modeKamera !== "orang") aturMode("orang");
    $("#kartu").hidden = true; $("#panel-menu").hidden = true; $("#panel-chat").hidden = true;
    $("#tombol-keluar-rumah").hidden = false;
    $("#petunjuk-teks").textContent = "Di dalam Merdu Mall · WASD/joystick untuk jalan · Keluar lewat pintu kaca selatan";
    $("#tombol-keluar-rumah").lastChild.textContent = " Keluar Mall";
    $("#petunjuk").hidden = false;
    kirimPosisi(true);
  }
  export function masukIstana() {
    if (diInterior) return;
    const p = pintuIstanaDunia();
    const pintu = { x: p.x, z: p.z + 3.5 }; // keluar: berdiri di tangga, menghadap istana
    interiorKonteks = {
      pemilik: { username: "istana" }, jenis: "istana", pintuX: pintu.x, pintuZ: pintu.z,
      yawPintu: Math.atan2(-(PUSAT_X - pintu.x), -(Z_ISTANA + PUSAT_Z - pintu.z)),
      modeSebelum: modeKamera,
    };
    if (grupInterior) { scene.remove(grupInterior); buangGrup(grupInterior); grupInterior = null; }
    rintanganInterior.length = 0;
    INT.sw = UKURAN_ISTANA_DALAM.sw; INT.sd = UKURAN_ISTANA_DALAM.sd; INT.tinggi = UKURAN_ISTANA_DALAM.tinggi;
    const g = bangunInteriorIstana((minX, maxX, minZ, maxZ) =>
      rintanganInterior.push({ minX: INT.x + minX, maxX: INT.x + maxX, minZ: INT.z + minZ, maxZ: INT.z + maxZ }));
    g.position.set(INT.x, INT.y, INT.z);
    grupInterior = g; scene.add(g);
    fetch("/api/pemilu").then((r) => r.json()).then((d) => { if (grupInterior === g) g.userData.isiStruktur(d.pejabat || []); }).catch(() => {});
    diInterior = true;
    perbaruiMinimapTampil();
    fp.x = INT.x; fp.z = INT.z + INT.sd - 2.1; fp.yaw = 0; fp.pitch = 0;
    if (modeKamera !== "orang") aturMode("orang");
    $("#kartu").hidden = true; $("#panel-menu").hidden = true; $("#panel-chat").hidden = true;
    $("#tombol-keluar-rumah").hidden = false;
    $("#petunjuk-teks").textContent = "Di dalam Istana Negara · WASD/joystick untuk jalan · Keluar lewat pintu selatan";
    $("#tombol-keluar-rumah").lastChild.textContent = " Keluar Istana";
    $("#petunjuk").hidden = false;
    kirimPosisi(true);
  }
  /* ===== APARTEMEN (lihat apartemen.js): kait penyusun ruang ===== */
  setKaitApartemen({
    pasang(r) {
      if (grupInterior) { scene.remove(grupInterior); buangGrup(grupInterior); grupInterior = null; }
      rintanganInterior.length = 0;
      INT.sw = r.sw; INT.sd = r.sd; INT.tinggi = r.T;
      for (const [a, b, c, d] of r.halang.daftar) rintanganInterior.push({ minX: INT.x + a, maxX: INT.x + b, minZ: INT.z + c, maxZ: INT.z + d });
      r.g.position.set(INT.x, INT.y, INT.z); grupInterior = r.g; scene.add(r.g);
    },
    get fp() { return fp; }, INT, // getter: fp milik kamera.js bisa belum terinisialisasi saat modul ini dievaluasi
    keluarKeJalan() { keluarInterior(); },
    petunjuk(t) { $("#petunjuk-teks").textContent = t; $("#petunjuk").hidden = false; },
  });
  export function masukApartemen(p) { // p = {x, z, data} titik pintu lobi di dunia
    if (diInterior) return;
    interiorKonteks = { pemilik: { username: p.data.nama }, jenis: "apartemen", pintuX: p.x, pintuZ: p.z + 2,
      yawPintu: 0, modeSebelum: modeKamera };
    masukApartemenLobi(p.data);
    diInterior = true;
    perbaruiMinimapTampil();
    fp.x = INT.x; fp.z = INT.z + INT.sd - 2.1; fp.yaw = 0; fp.pitch = 0;
    if (modeKamera !== "orang") aturMode("orang");
    $("#kartu").hidden = true; $("#panel-menu").hidden = true; $("#panel-chat").hidden = true;
    $("#tombol-keluar-rumah").hidden = false;
    $("#tombol-keluar-rumah").lastChild.textContent = " Keluar Gedung";
    kirimPosisi(true);
  }
  /* Jepit gerak di interior: apartemen punya kabin lift di balik dinding utara. */
  export function jepitInteriorUmum(x, z) {
    if (interiorKonteks && interiorKonteks.jenis === "apartemen") {
      const p = jepitRuang(x - INT.x, z - INT.z); return { x: INT.x + p.x, z: INT.z + p.z };
    }
    return { x: Math.min(INT.x + INT.sw - 0.75, Math.max(INT.x - INT.sw + 0.75, x)), z: Math.min(INT.z + INT.sd - 0.75, Math.max(INT.z - INT.sd + 0.75, z)) };
  }
  let aksiAptAktif = null, aksiTransAktif = null;
  setKaitNaik({ get fp() { return fp; }, petunjuk(t) { $("#petunjuk-teks").textContent = t; $("#petunjuk").hidden = false; }, selesai() { $("#petunjuk-teks").textContent = PETUNJUK[modeKamera]; kirimPosisi(true); } });
  export function keluarInterior() {
    if (!diInterior) return;
    const k = interiorKonteks;
    diInterior = false;
    if (k.jenis === "apartemen") resetApartemen();
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
  export function dekatPintuKeluar() {
    if (interiorKonteks && interiorKonteks.jenis === "apartemen") return false; // apartemen: keluar lewat chip lobi
    return diInterior && fp.z > INT.z + INT.sd - 1.5 && Math.abs(fp.x - INT.x) < 1.8;
  }
  /* Chip aksi kontekstual (kecil, di atas bar bawah): "Masuk Rumah" saat berdiri
     di doorstep rumah detail (mode 1st Person), "Keluar" saat di depan pintu
     keluar interior. Tidak pernah tampil permanen. */
  export function perbaruiAksiInterior() {
    const chip = $("#chip-aksi"), teks = $("#chip-aksi-teks"), tombol = $("#chip-aksi-tombol");
    if (diInterior && interiorKonteks && interiorKonteks.jenis === "apartemen") {
      const a = aksiApartemen(fp.x - INT.x, fp.z - INT.z);
      aksiAptAktif = a && a.aksi ? a.aksi : null;
      chip.hidden = !a;
      if (a) { teks.textContent = a.teks; tombol.textContent = a.tombol || "…"; tombol.hidden = !a.tombol; }
      return;
    }
    tombol.hidden = false;
    if (diInterior) {
      const tampil = dekatPintuKeluar();
      chip.hidden = !tampil;
      if (tampil) { teks.textContent = "Pintu keluar"; tombol.textContent = "Keluar"; }
      return;
    }
    if (!diInterior && (modeKamera === "orang" || modeKamera === "ketiga")) { // naik/turun bus & KRL
      const at = aksiTransportasi(fp);
      aksiTransAktif = at && at.aksi ? at.aksi : null;
      if (at) { chip.hidden = false; teks.textContent = at.teks; tombol.textContent = at.tombol || "…"; tombol.hidden = !at.tombol; rumahDekat = null; return; }
    } else aksiTransAktif = null;
    tombol.hidden = false;
    if (modeKamera !== "orang" && modeKamera !== "ketiga") { chip.hidden = true; rumahDekat = null; return; }
    let terbaik = null, jarakMin = 3.4;
    for (const r of rumahKlik) {
      if (!r.userData.pintu) continue;
      const j = Math.hypot(fp.x - r.userData.pintu.x, fp.z - r.userData.pintu.z);
      if (j < jarakMin) { jarakMin = j; terbaik = r; }
    }
    rumahDekat = terbaik;
    for (const pa of pintuApartemen) if (!terbaik && Math.hypot(fp.x - pa.x, fp.z - pa.z) < 5) {
      rumahDekat = { apartemen: true, ...pa }; chip.hidden = false;
      teks.textContent = pa.data.nama; tombol.textContent = "Masuk Apartemen";
      return;
    }
    if (!terbaik && PINTU_MALL.length && Math.hypot(fp.x - PINTU_MALL[0].x, fp.z - PINTU_MALL[0].z) < 6) { // depan pintu Merdu Mall
      rumahDekat = "mall"; chip.hidden = false; teks.textContent = "Merdu Mall"; tombol.textContent = "Masuk Mall";
      return;
    }
    const pi = pintuIstanaDunia();
    if (!terbaik && Math.hypot(fp.x - pi.x, fp.z - pi.z) < 5) { // di depan pintu istana
      rumahDekat = "istana"; chip.hidden = false;
      teks.textContent = "Istana Negara"; tombol.textContent = "Masuk Istana";
      return;
    }
    chip.hidden = !terbaik;
    if (terbaik) {
      teks.textContent = "Rumah @" + terbaik.userData.pemilik.username;
      tombol.textContent = "Masuk Rumah";
    }
  }
  $("#chip-aksi-tombol").addEventListener("click", () => {
    if (!diInterior && aksiTransAktif) { if (modeKamera !== "orang") aturMode("orang"); aksiTransAktif(); }
    else if (diInterior && aksiAptAktif) aksiAptAktif();
    else if (diInterior) keluarInterior();
    else if (rumahDekat === "istana") masukIstana();
    else if (rumahDekat === "mall") masukMall();
    else if (rumahDekat && rumahDekat.apartemen) masukApartemen(rumahDekat);
    else if (rumahDekat) masukInterior(rumahDekat.userData.pemilik, rumahDekat);
  });
  $("#tombol-keluar-rumah").addEventListener("click", keluarInterior);


  /* Setter lintas-modul (migrasi Next.js): pulihInterior dinyatakan di
     modul ini; kamera.js meresetnya lewat fungsi ini. */
  export function setPulihInterior(v) { pulihInterior = v; }
