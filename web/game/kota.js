/* Negara Merdu — modul game "kota" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Kota: pembangunan kota massal ter-instanced (bangunKotaMassal). */
import { BLOK_BARIS, BLOK_KOLOM, JALAN, KAV_PITCH, PER_BLOK, RESERVASI, SISI, TAMAN, WARNA_LAMPU_LL, elemenJalan, hashInt, markaPersimpangan, polaKavling, sudutBlok, tiangLaluLintas, warnaAtapZonaHSL, warnaDindingZonaHSL, zonaDariKolBar, KOTA_D, KOTA_W, PITCH, PLAZA_TAPAK, faseLaluLintas } from "./inti.js";
import { bangunRagamLahan, saringPersimpangan } from "./ragam.js";
import { PERSIMPANGAN_DITUTUP } from "./plazaPagar.js";
import { IM_LINGKUNGAN, LAMPU_JALAN, LL_AKTIF, PARAM, TEX_ATAP, TEX_DINDING, gabungBerwarna, gabungGeometri, geometriAtapPelana, geometriDetailMassal, plafonTerang, geometriPagar, rumahDetailSet, rumahTerisi, scene, warnaPemilik } from "./bersama.js";

  export function bangunKotaMassal() {
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
          kx: k % SISI, kz: Math.floor(k / SISI), h: hashInt(nomor), kunciBlok: kunci,
        });
      }
    }
    /* Hanya kavling terisi yang jadi rumah, dikurangi kavling detail
       (rumahnya dibangun bangunDistrik di petak yang sama); daftar penuh
       tetap dipakai untuk dekorasi lahan (pagar/semak/pohon) di semua
       petak. */
    const daftarIsi = daftar.filter((d) => rumahTerisi.has(d.kunciPos) && !rumahDetailSet.has(d.kunciPos));
    const grup = new THREE.Group();
    /* Bentang lahan pedesaan di blok kosong jauh dari garis tumbuh (ragam.js):
       blok itu tidak memakai dekorasi petak kavling & persimpangan di antara
       blok-blok desa tidak berlampu lalu lintas (kecuali jalan arteri/bus). */
    const ragam = bangunRagamLahan(grup);
    const saringRagam = saringPersimpangan(ragam);
    const persimpanganKota_ = (p) => !PERSIMPANGAN_DITUTUP.has(p.kol + "," + p.bar) && saringRagam(p); // mulut ruas plaza yang ditutup = jalan lurus
    const dummy = new THREE.Object3D(); const warna = new THREE.Color();
    const syDari = (d) => 0.9 + d.h * 0.3;
    const warnaAtap = (d) => {
      const milik = warnaPemilik.get(d.kunciPos);
      if (milik) { // identitas pemilik: atap = warna bajunya, DILEMBUTKAN (saturasi & terang dijepit) supaya tetap seperti genteng cat, bukan neon
        warna.set(milik); const hsl = { h: 0, s: 0, l: 0 }; warna.getHSL(hsl);
        return warna.setHSL(hsl.h, Math.min(hsl.s, 0.5) * 0.85, Math.min(0.56, Math.max(0.34, hsl.l)));
      }
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
    const matPelana = new THREE.MeshStandardMaterial({ map: TEX_ATAP, roughness: 0.95 }); // tanpa flatShading: plafon bawah (normal +y) tidak hitam — lihat meshPelana
    const imPelana = new THREE.InstancedMesh(geometriAtapPelana(10.4, 3.2, 9.4), matPelana, Math.max(1, daftarPelana.length));
    const geoLimas = new THREE.ConeGeometry(6.6, 3.4, 4); geoLimas.rotateY(Math.PI / 4);
    const geoLimasP = plafonTerang(geoLimas), matLimas = new THREE.MeshStandardMaterial({ map: TEX_ATAP, roughness: 0.95 });
    const imLimas = new THREE.InstancedMesh(geoLimasP, matLimas, Math.max(1, daftarLimas.length));
    const imDatar = new THREE.InstancedMesh(plafonTerang(new THREE.BoxGeometry(9.6, 0.55, 8.6)),
      new THREE.MeshStandardMaterial({ roughness: 1 }), Math.max(1, daftarDatar.length));
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
       imLimas DULU berbagi material matAtap (kini material sendiri-sendiri, penjaga ini tetap dipertahankan). Bila satu daftar kosong, setColorAt
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
      if (ragam.has(d.kunciBlok)) return; // blok bentang desa: tanpa pagar/semak petak
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
    const geoDaunJ = gabungGeometri([
  { geo: new THREE.IcosahedronGeometry(2.1, 1), x: 0, y: 3.9, z: 0 },
  { geo: new THREE.IcosahedronGeometry(1.45, 1), x: 1.0, y: 3.3, z: 0.6 },
  { geo: new THREE.IcosahedronGeometry(1.4, 1), x: -0.9, y: 3.4, z: -0.5 },
  { geo: new THREE.IcosahedronGeometry(1.3, 1), x: 0.1, y: 5.1, z: -0.1 },
]);
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
    const geoTiangL = gabungGeometri([
  { geo: new THREE.CylinderGeometry(0.24, 0.28, 0.35, 8), x: 0, y: 0.175, z: 0 }, // pondasi
  { geo: new THREE.CylinderGeometry(0.09, 0.13, 4.8, 8), x: 0, y: 2.55, z: 0 },   // tiang utama
  { geo: new THREE.BoxGeometry(1.15, 0.10, 0.10), x: 0.52, y: 4.88, z: 0 },       // lengan lampu
]);
const geoKepalaL = new THREE.BoxGeometry(0.58, 0.14, 0.32);
geoKepalaL.translate(1.02, 4.80, 0);
    const imTiangL = new THREE.InstancedMesh(geoTiangL,
      new THREE.MeshStandardMaterial({ color: 0x46524a, roughness: 0.8, flatShading: true }), Math.max(1, elJalan.lampu.length));
    const imKepalaL = new THREE.InstancedMesh(geoKepalaL,
      new THREE.MeshStandardMaterial({ color: 0xffe2ae, emissive: 0xffc37a, emissiveIntensity: 0.85, roughness: 0.6, flatShading: true }), Math.max(1, elJalan.lampu.length));
    LAMPU_JALAN.matKepala = imKepalaL.material; // fase waktu (?v=15) mengatur nyala kepala lampu dari sini
    const X_LAMPU_VERTIKAL = [0, 20, 40, 60].map(kol => sudutBlok(kol, 0).x + 15.2);
    elJalan.lampu.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z); dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, X_LAMPU_VERTIKAL.some(x => Math.abs(p.x - x) < 0.01) ? Math.PI : Math.PI / 2, 0);
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
    const tiangLL = tiangLaluLintas(persimpanganKota_);
    /* Desain lampu lalu lintas (perbaikan): dulu tiang hitam pendek dengan
       kotak lampu di pucuknya — dari kamera Orbit terbaca sebagai "tongkat".
       Kini tiang galvanis model LENGAN (mast arm) seperti persimpangan
       kota: tiang 5,8 tinggi, lengan menjulur 4,9 ke atas lajur yang
       didekati, kepala lampu 3 susun bergantung di ujung lengan lengkap
       dengan papan latar hitam berlis kuning (backplate) & topi (visor)
       per lampu. Lokal: hadap +z, lengan ke -x (lihat tiangLaluLintas:
       hadap (hx,hz) diputar ry -> -x lokal selalu mengarah ke lajur). */
    const ABU = 0x7b8086, HITAM = 0x1d2124, KUNING_LIS = 0xf2c230;
    const silinder = (r, h, seg) => new THREE.CylinderGeometry(r, r, h, seg || 8);
    // Lajur kiri: lengan menjulur ke +x LOKAL (lihat tiangLaluLintas di inti.js)
    const LENGAN = 4.9, KX = 4.35, KY = 4.62; // ujung lengan & pusat kepala lampu
    const PX = -0.2, PY = 2.75, PZ = 0.16;    // kepala lampu PENYEBERANG di tiang (sisi luar, setinggi mata)
    const bagianLL = [
      { geo: silinder(0.36, 0.3, 8), x: 0, y: 0.15, z: 0, warna: 0x5f646a },        // alas beton
      { geo: silinder(0.13, 5.6, 8), x: 0, y: 3.0, z: 0, warna: ABU },               // tiang
      { geo: silinder(0.16, 0.12, 8), x: 0, y: 5.86, z: 0, warna: ABU },             // tutup pucuk
      { geo: new THREE.BoxGeometry(LENGAN, 0.16, 0.16), x: LENGAN / 2, y: 5.62, z: 0, warna: ABU }, // lengan
      { geo: new THREE.BoxGeometry(1.9, 0.08, 0.08), x: 0.95, y: 5.05, z: 0, rz: 0.55, warna: ABU }, // penyangga miring
      { geo: new THREE.BoxGeometry(0.08, 0.45, 0.08), x: KX, y: 5.36, z: 0.05, warna: HITAM },   // penggantung
      { geo: new THREE.BoxGeometry(1.06, 2.06, 0.08), x: KX, y: KY, z: 0.0, warna: HITAM },       // backplate
      { geo: new THREE.BoxGeometry(1.02, 2.02, 0.02), x: KX, y: KY, z: 0.05, warna: KUNING_LIS }, // lis backplate (hanya terlihat dari depan)
      { geo: new THREE.BoxGeometry(0.9, 1.9, 0.02), x: KX, y: KY, z: 0.065, warna: HITAM },      // muka backplate di dalam lis
      { geo: new THREE.BoxGeometry(0.6, 1.66, 0.44), x: KX, y: KY, z: 0.26, warna: HITAM },      // rumah lampu
      { geo: new THREE.BoxGeometry(0.5, 0.9, 0.26), x: PX, y: PY, z: PZ, warna: HITAM },         // rumah lampu penyeberang
      { geo: new THREE.BoxGeometry(0.3, 0.36, 0.2), x: 0.2, y: 1.25, z: 0.12, warna: 0xf2c230 }, // tombol penyeberang
    ];
    for (const dy of [0.5, 0, -0.5]) // topi/visor tiap lampu
      bagianLL.push({ geo: new THREE.BoxGeometry(0.5, 0.05, 0.32), x: KX, y: KY + dy + 0.24, z: 0.62, rx: 0.18, warna: HITAM });
    for (const dy of [0.21, -0.21]) // visor lampu penyeberang
      bagianLL.push({ geo: new THREE.BoxGeometry(0.4, 0.04, 0.18), x: PX, y: PY + dy + 0.17, z: PZ + 0.2, warna: HITAM });
    const geoTiangLL = gabungBerwarna(bagianLL);
    const imTiangLL = new THREE.InstancedMesh(geoTiangLL,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15, flatShading: true }), Math.max(1, tiangLL.length));
    imTiangLL.castShadow = true;
    const geoCakramLL = new THREE.CylinderGeometry(0.19, 0.19, 0.08, 14);
    geoCakramLL.rotateX(Math.PI / 2); // sumbu cakram -> +z (arah hadap tiang)
    const matLLBaru = {}, imCakramPeta = {};
    for (const sumbu of ["us", "tb"]) {
      matLLBaru[sumbu] = {};
      const nSumbu = tiangLL.filter((s) => s.sumbu === sumbu).length;
      for (const w of ["merah", "kuning", "hijau"]) {
        const mat = new THREE.MeshStandardMaterial({
          color: WARNA_LAMPU_LL[w].mati, emissive: WARNA_LAMPU_LL[w].nyala, emissiveIntensity: 0, roughness: 0.3,
        });
        matLLBaru[sumbu][w] = mat;
        const im = new THREE.InstancedMesh(geoCakramLL, mat, Math.max(1, nSumbu));
        im.frustumCulled = false; im.instanceMatrix.needsUpdate = true;
        imCakramPeta[sumbu + w] = im; grup.add(im);
      }
    }
    /* Lampu penyeberang: 2 panel (orang merah di atas / orang hijau di
       bawah) per tiang, material bersama per sumbu — fasenya diatur
       perbaruiLaluLintas (hijau hanya saat arus sumbu tiang itu HIJAU:
       pejalan yang melihat tiang ini menyeberangi jalan sumbu lain). */
    const geoPanelPed = new THREE.PlaneGeometry(0.3, 0.3);
    const texOrang = (jalan) => { // piktogram orang berdiri / berjalan
      const cv = document.createElement("canvas"); cv.width = cv.height = 64;
      const c = cv.getContext("2d"); c.fillStyle = "#111"; c.fillRect(0, 0, 64, 64);
      c.fillStyle = "#fff"; c.beginPath(); c.arc(32, 12, 7, 0, 7); c.fill();
      c.lineWidth = 8; c.lineCap = "round"; c.strokeStyle = "#fff"; c.beginPath();
      if (jalan) { c.moveTo(32, 22); c.lineTo(30, 40); c.lineTo(20, 56); c.moveTo(30, 40); c.lineTo(42, 56); c.moveTo(31, 27); c.lineTo(44, 36); c.moveTo(31, 27); c.lineTo(20, 36); }
      else { c.moveTo(32, 22); c.lineTo(32, 42); c.lineTo(26, 58); c.moveTo(32, 42); c.lineTo(38, 58); c.moveTo(32, 26); c.lineTo(22, 40); c.moveTo(32, 26); c.lineTo(42, 40); }
      c.stroke(); return new THREE.CanvasTexture(cv);
    };
    const TEX_ORANG = { merah: texOrang(false), hijau: texOrang(true) };
    const matPed = {}, imPedPeta = {};
    for (const sumbu of ["us", "tb"]) {
      matPed[sumbu] = {};
      const nSumbu = tiangLL.filter((t) => t.sumbu === sumbu).length;
      for (const w of ["merah", "hijau"]) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, map: TEX_ORANG[w], emissive: WARNA_LAMPU_LL[w].nyala, emissiveMap: TEX_ORANG[w], emissiveIntensity: 0, roughness: 0.4 });
        matPed[sumbu][w] = mat;
        const im = new THREE.InstancedMesh(geoPanelPed, mat, Math.max(1, nSumbu));
        im.frustumCulled = false; imPedPeta[sumbu + w] = im; grup.add(im);
      }
    }
    const DY_PED = { merah: 0.21, hijau: -0.21 };
    const DY_CAKRAM_LL = { merah: 0.5, kuning: 0, hijau: -0.5 };
    const hitungCakram = { us: 0, tb: 0 }, _lok = new THREE.Vector3();
    tiangLL.forEach((s, i) => {
      const ry = Math.atan2(s.hx, s.hz);
      dummy.position.set(s.x, 0, s.z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix(); imTiangLL.setMatrixAt(i, dummy.matrix);
      const j = hitungCakram[s.sumbu]++;
      for (const w of ["merah", "kuning", "hijau"]) {
        _lok.set(KX, KY + DY_CAKRAM_LL[w], 0.5).applyAxisAngle(THREE.Object3D.DefaultUp, ry);
        dummy.position.set(s.x + _lok.x, _lok.y, s.z + _lok.z);
        dummy.updateMatrix(); imCakramPeta[s.sumbu + w].setMatrixAt(j, dummy.matrix);
      }
      for (const w of ["merah", "hijau"]) { // panel penyeberang menghadap arah hadap tiang
        _lok.set(PX, PY + DY_PED[w], PZ + 0.135).applyAxisAngle(THREE.Object3D.DefaultUp, ry);
        dummy.position.set(s.x + _lok.x, _lok.y, s.z + _lok.z);
        dummy.updateMatrix(); imPedPeta[s.sumbu + w].setMatrixAt(j, dummy.matrix);
        imPedPeta[s.sumbu + w].instanceMatrix.needsUpdate = true;
      }
    });
    imTiangLL.frustumCulled = false; imTiangLL.instanceMatrix.needsUpdate = true;
    grup.add(imTiangLL);
    LL_AKTIF.mat = matLLBaru; LL_AKTIF.ped = matPed; LL_AKTIF.kunci = ""; // grup baru: fase diterapkan ulang di frame berikut
    /* Marka: kotak tipis 0,06 di atas aspal (y 0,03) + polygonOffset -2 —
       mengikuti preseden anti z-fighting bidang di atas tanah. Tutup
       sewarna aspal digambar lebih dulu (urutan instans tidak menentukan
       z, tapi warna per instans yang membedakan). */
    const marka = markaPersimpangan(persimpanganKota_);
    const semuaMarka = [];
    // marka.tutup tidak dipakai lagi: tekstur aspal sudah bersih di persimpangan (lihat buatKanvasTanah)
    for (const r of marka.zebra) semuaMarka.push({ x: r.x, z: r.z, w: r.w, d: r.d, warna: 0xf4f1e6 });
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

  /* ================= LALU LINTAS MOBIL (INSTANCED, LAJUR KIRI) ================= */
  const MOBIL_AKTIF = { imBodi: null, imDetail: null, daftar: [] };
  const _dummyM = new THREE.Object3D();

  export function bangunLaluLintasMobil() {
    // 1. Geometri bodi (diwarnai per instans via instanceColor)
    const geoBodi = gabungGeometri([
      { geo: new THREE.BoxGeometry(1.92, 0.62, 4.25), x: 0, y: 0.68, z: 0 },
      { geo: new THREE.BoxGeometry(1.66, 0.60, 2.15), x: 0, y: 1.28, z: -0.2 },
    ]);

    // 2. Geometri detail statis (kaca, bumper, lampu, 4 roda + velg) via vertexColors
    const bagianDet = [
      { geo: new THREE.BoxGeometry(1.96, 0.22, 0.24), x: 0, y: 0.44, z: 2.10, warna: 0x2b2f33 },  // bumper depan
      { geo: new THREE.BoxGeometry(1.96, 0.22, 0.24), x: 0, y: 0.44, z: -2.10, warna: 0x2b2f33 }, // bumper belakang
      { geo: new THREE.BoxGeometry(1.56, 0.50, 0.08), x: 0, y: 1.26, z: 0.90, rx: -0.22, warna: 0x1e2c36 }, // kaca depan
      { geo: new THREE.BoxGeometry(1.56, 0.46, 0.08), x: 0, y: 1.26, z: -1.30, rx: 0.22, warna: 0x1e2c36 }, // kaca belakang
      { geo: new THREE.BoxGeometry(1.70, 0.42, 1.80), x: 0, y: 1.28, z: -0.20, warna: 0x1e2c36 }, // kaca samping
    ];
    for (const s of [-1, 1]) {
      bagianDet.push({ geo: new THREE.BoxGeometry(0.36, 0.16, 0.08), x: s * 0.66, y: 0.72, z: 2.13, warna: 0xfff3c4 });  // lampu depan
      bagianDet.push({ geo: new THREE.BoxGeometry(0.36, 0.15, 0.08), x: s * 0.66, y: 0.72, z: -2.13, warna: 0xd62828 }); // lampu rem
    }
    for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
      bagianDet.push({ geo: new THREE.CylinderGeometry(0.38, 0.38, 0.28, 12), x: wx, y: 0.38, z: wz, rz: Math.PI / 2, warna: 0x1e2024 });
      bagianDet.push({ geo: new THREE.CylinderGeometry(0.21, 0.21, 0.30, 10), x: wx, y: 0.38, z: wz, rz: Math.PI / 2, warna: 0xcfd4dc });
    }
    const geoDetail = gabungBerwarna(bagianDet);

    // Jalur arteri utama (di luar plaza): 4 jalur vertikal + 4 jalur horizontal (masing-masing 2 arah)
    const daftar = [];
    const PALET_MOBIL = [0xd9462e, 0x3f6fb5, 0xe8c268, 0x2e9e5b, 0xf2f0eb, 0x5c6770, 0xe07a3f, 0x4a7a8c];
    const jalurUS = [20, 36, 44, 60]; // kolom jalan vertikal (lewati area plaza 38..41)
    const jalurTB = [10, 20, 30, 40]; // baris jalan horizontal (lewati area plaza 24..25)

    // 32 mobil sumbu Utara-Selatan (lajur kiri: +z di timur x0+10.5, -z di barat x0+3.5)
    jalurUS.forEach((kol, ki) => {
      const x0 = sudutBlok(kol, 0).x;
      for (const arah of [1, -1]) {
        const laneX = arah === 1 ? x0 + JALAN * 0.75 : x0 + JALAN * 0.25;
        for (let m = 0; m < 4; m++) {
          const idx = daftar.length;
          daftar.push({
            sumbu: "us", arah, tetap: laneX,
            pos: -KOTA_D / 2 + ((m * 0.25 + hashInt(idx * 17 + 3) * 0.18) % 1) * KOTA_D,
            kec: 16 + hashInt(idx * 31 + 7) * 10,
            warna: PALET_MOBIL[idx % PALET_MOBIL.length],
          });
        }
      }
    });

    // 32 mobil sumbu Timur-Barat (lajur kiri: +x di utara z0+3.5, -x di selatan z0+10.5)
    jalurTB.forEach((bar, bi) => {
      const z0 = sudutBlok(0, bar).z;
      for (const arah of [1, -1]) {
        const laneZ = arah === 1 ? z0 + JALAN * 0.25 : z0 + JALAN * 0.75;
        for (let m = 0; m < 4; m++) {
          const idx = daftar.length;
          daftar.push({
            sumbu: "tb", arah, tetap: laneZ,
            pos: -KOTA_W / 2 + ((m * 0.25 + hashInt(idx * 23 + 5) * 0.18) % 1) * KOTA_W,
            kec: 16 + hashInt(idx * 29 + 11) * 10,
            warna: PALET_MOBIL[idx % PALET_MOBIL.length],
          });
        }
      }
    });

    const imBodi = new THREE.InstancedMesh(geoBodi,
      new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.18 }), daftar.length);
    const imDetail = new THREE.InstancedMesh(geoDetail,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 }), daftar.length);
    imBodi.castShadow = true; imBodi.receiveShadow = true;
    imBodi.frustumCulled = false; imDetail.frustumCulled = false;

    const c = new THREE.Color();
    daftar.forEach((m, i) => imBodi.setColorAt(i, c.setHex(m.warna)));
    if (imBodi.instanceColor) imBodi.instanceColor.needsUpdate = true;

    scene.add(imBodi); scene.add(imDetail);
    MOBIL_AKTIF.imBodi = imBodi; MOBIL_AKTIF.imDetail = imDetail; MOBIL_AKTIF.daftar = daftar;
    perbaruiMobil(0, 0);
  }

  export function perbaruiMobil(dt, t) {
    const { imBodi, imDetail, daftar } = MOBIL_AKTIF;
    if (!imBodi || !daftar.length) return;
    const fase = faseLaluLintas(t);
    const halfW = KOTA_W / 2, halfD = KOTA_D / 2;

    for (let i = 0; i < daftar.length; i++) {
      const m = daftar[i];
      const batas = m.sumbu === "us" ? halfD : halfW;
      // Cek apakah mendekati garis henti persimpangan saat lampu bukan hijau
      const relatif = ((m.pos + batas) % PITCH + PITCH) % PITCH;
      const mendekatiHenti = m.arah === 1
        ? (relatif > PITCH - 9 && relatif < PITCH - 4.5)
        : (relatif > JALAN + 4.5 && relatif < JALAN + 9);
      const berhenti = mendekatiHenti && fase[m.sumbu] !== "hijau";

      if (!berhenti && dt > 0) {
        m.pos += m.arah * m.kec * dt;
        if (m.pos > batas) m.pos = -batas;
        else if (m.pos < -batas) m.pos = batas;
      }

      if (m.sumbu === "us") {
        _dummyM.position.set(m.tetap, 0, m.pos);
        _dummyM.rotation.set(0, m.arah === 1 ? 0 : Math.PI, 0);
      } else {
        _dummyM.position.set(m.pos, 0, m.tetap);
        _dummyM.rotation.set(0, m.arah === 1 ? Math.PI / 2 : -Math.PI / 2, 0);
      }
      _dummyM.scale.set(1, 1, 1);
      _dummyM.updateMatrix();
      imBodi.setMatrixAt(i, _dummyM.matrix);
      imDetail.setMatrixAt(i, _dummyM.matrix);
    }
    imBodi.instanceMatrix.needsUpdate = true;
    imDetail.instanceMatrix.needsUpdate = true;
  }
