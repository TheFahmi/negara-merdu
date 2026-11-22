/* Negara Merdu — modul game "kota" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Kota: pembangunan kota massal ter-instanced (bangunKotaMassal). */
import { BLOK_BARIS, BLOK_KOLOM, JALAN, KAV_PITCH, PER_BLOK, RESERVASI, SISI, TAMAN, WARNA_LAMPU_LL, elemenJalan, hashInt, markaPersimpangan, polaKavling, sudutBlok, tiangLaluLintas, warnaAtapZonaHSL, warnaDindingZonaHSL, zonaDariKolBar } from "./inti.js";
import { IM_LINGKUNGAN, LAMPU_JALAN, LL_AKTIF, PARAM, TEX_ATAP, TEX_DINDING, gabungGeometri, geometriAtapPelana, geometriDetailMassal, geometriPagar, rumahDetailSet, rumahTerisi, scene, warnaPemilik } from "./bersama.js";

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
