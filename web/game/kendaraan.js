/* Negara Merdu — modul game "kendaraan": MOBIL & LALU LINTAS HIDUP.
   1) Mobil parkir: SATU mobil per rumah terisi, di carport samping rumah
      (sisi timur kavling — kavling 14 lebar, rumah 8,6: sisa 2,7 cukup
      untuk mobil 1,9). Tanpa mengurangi jumlah rumah per blok.
   2) Lalu lintas: mobil berjalan di jaringan jalan sekitar pusat kota,
      LAJUR KIRI, berhenti di garis henti saat lampu merah/kuning (fase
      dari faseLaluLintas — lampu yang sama yang tampil di tiang), menjaga
      jarak dengan mobil di depan, dan berbelok acak di persimpangan.
   Semua mobil = 2 InstancedMesh (badan berwarna per instans + detail
   kaca/lampu/roda berwarna verteks) per kelompok -> murah di HP. */
import { MAT_KACA_MOBIL, geoMobil } from "./mobilGeo.js";
import { SWAY, goyang } from "./jalur.js";
import { BLOK_BARIS, BLOK_KOLOM, JALAN, KAV_PITCH, SKALA_MOBIL, PLAZA_TAPAK, SISI, faseLaluLintas, hashInt, persimpanganKota, sudutBlok } from "./inti.js";
import { M, PARAM, gabungBerwarna, rumahDetailSet, rumahTerisi, scene } from "./bersama.js";
import { rintanganFasilitas } from "./rumah.js";

export const WARNA_MOBIL = [0xd9462e, 0x3f6fb5, 0xf2f2ee, 0x2b2d30, 0x9aa0a6, 0xe8c268, 0x2e8b57, 0x7a1f2b, 0x5b7c99, 0xe8943a];

/* Geometri mobil (hadap +z, alas y=0): badan (diwarnai instans) & detail. */
function geometriBadan() {
  return gabungBerwarna([
    { geo: new THREE.BoxGeometry(1.9, 0.62, 4.2), x: 0, y: 0.68, z: 0, warna: 0xffffff },       // badan bawah
    { geo: new THREE.BoxGeometry(1.74, 0.62, 2.3), x: 0, y: 1.3, z: -0.25, warna: 0xffffff },   // kabin
    { geo: new THREE.BoxGeometry(1.86, 0.12, 1.1), x: 0, y: 1.02, z: 1.45, warna: 0xffffff },   // kap mesin
  ]);
}
function geometriDetail() {
  const roda = [];
  for (const [x, z] of [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]]) {
    roda.push({ geo: new THREE.CylinderGeometry(0.37, 0.37, 0.3, 12), x, y: 0.37, z, rz: Math.PI / 2, warna: 0x1c1c1e });
    roda.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, 0.32, 8), x, y: 0.37, z, rz: Math.PI / 2, warna: 0xb8bcc2 });
  }
  return gabungBerwarna([
    ...roda,
    { geo: new THREE.BoxGeometry(1.78, 0.5, 2.0), x: 0, y: 1.32, z: -0.25, warna: 0x24323d },     // kaca keliling
    { geo: new THREE.BoxGeometry(1.95, 0.22, 0.14), x: 0, y: 0.5, z: 2.12, warna: 0x3a3d40 },     // bumper depan
    { geo: new THREE.BoxGeometry(1.95, 0.22, 0.14), x: 0, y: 0.5, z: -2.12, warna: 0x3a3d40 },    // bumper belakang
    { geo: new THREE.BoxGeometry(0.42, 0.16, 0.06), x: -0.62, y: 0.78, z: 2.11, warna: 0xfff3c8 }, // lampu depan
    { geo: new THREE.BoxGeometry(0.42, 0.16, 0.06), x: 0.62, y: 0.78, z: 2.11, warna: 0xfff3c8 },
    { geo: new THREE.BoxGeometry(0.42, 0.14, 0.06), x: -0.62, y: 0.8, z: -2.11, warna: 0xc0281d }, // lampu belakang
    { geo: new THREE.BoxGeometry(0.42, 0.14, 0.06), x: 0.62, y: 0.8, z: -2.11, warna: 0xc0281d },
  ]);
}
function geo() { return geoMobil(); } // model sedan realistis bersama (mobilGeo.js); geometriBadan/Detail lama tak dipakai
function buatInstans(n) {
  const g = geo();
  const badan = new THREE.InstancedMesh(g.badan, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.25 }), Math.max(1, n));
  const detail = new THREE.InstancedMesh(g.detail, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.1 }), Math.max(1, n));
  for (const m of [badan, detail]) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; }
  const kaca = new THREE.InstancedMesh(g.kaca, MAT_KACA_MOBIL, Math.max(1, n)); kaca.frustumCulled = false; kaca.renderOrder = 2;
  detail.userData.kaca = kaca; // ikut matriks detail (lihat setMatrixAt di bawah)
  return { badan, detail, kaca };
}

/* ================= 1) MOBIL PARKIR (1 per rumah terisi) ================= */
let grupParkir = null;
export function bangunMobilParkir() {
  if (grupParkir) { scene.remove(grupParkir); grupParkir = null; }
  const posisi = [];
  for (let bar = 0; bar < BLOK_BARIS; bar++) for (let kol = 0; kol < BLOK_KOLOM; kol++) {
    const blok = bar * BLOK_KOLOM + kol + 1, s = sudutBlok(kol, bar);
    for (let k = 0; k < SISI * SISI; k++) {
      const kunci = blok + "," + (k + 1);
      if (!rumahTerisi.has(kunci)) continue;
      const x = s.x + JALAN + KAV_PITCH / 2 + (k % SISI) * KAV_PITCH, z = s.z + JALAN + KAV_PITCH / 2 + Math.floor(k / SISI) * KAV_PITCH;
      const detail = rumahDetailSet.has(kunci); // rumah detail sedikit lebih besar: mobil digeser keluar
      /* carport di sisi rumah yang menjauhi trotoar: kolom kavling paling
         timur (kx 4) memarkir di sisi BARAT rumah — dulu mobilnya keluar
         kavling dan nangkring di trotoar. */
      const sisi = (k % SISI) === SISI - 1 ? -1 : 1;
      posisi.push({ x: x + sisi * (detail ? 5.75 : 5.6), z: z + 1.0, w: WARNA_MOBIL[Math.floor(hashInt(blok * 31 + k * 7) * WARNA_MOBIL.length)] });
    }
  }
  const { badan, detail, kaca } = buatInstans(posisi.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  posisi.forEach((p, i) => {
    d.position.set(p.x, 0, p.z); d.rotation.set(0, 0, 0); d.scale.setScalar(SKALA_MOBIL); d.updateMatrix();
    badan.setMatrixAt(i, d.matrix); detail.setMatrixAt(i, d.matrix); kaca.setMatrixAt(i, d.matrix); badan.setColorAt(i, c.setHex(p.w));
  });
  badan.count = detail.count = kaca.count = posisi.length;
  badan.instanceMatrix.needsUpdate = detail.instanceMatrix.needsUpdate = kaca.instanceMatrix.needsUpdate = true;
  if (badan.instanceColor) badan.instanceColor.needsUpdate = true;
  grupParkir = new THREE.Group(); grupParkir.add(badan); grupParkir.add(detail); grupParkir.add(kaca); scene.add(grupParkir);
}

/* ================= 2) LALU LINTAS BERJALAN ================= */
/* Jaringan: persimpangan (node) di kotak kolom 28..51 x baris 16..33 di
   sekitar pusat (kawasan ramai), sisi = ruas jalan antar persimpangan
   bertetangga yang tidak tertutup plaza. */
const AREA = { kol0: 28, kol1: 51, bar0: 16, bar1: 33 };
const LAJUR = 3.5;          // jarak as lajur dari as jalan
const JARAK_HENTI = 7.8;    // pusat mobil berhenti 7,8 sebelum tepi kotak persimpangan (moncong di belakang garis henti 5,25)
const JARAK_AMAN = 7.5;     // jarak minimum ke mobil di depan
const KECEPATAN = 11;       // satuan/detik
let node = null, mobilJalan = [], inst = null;

function bangunJaringan() {
  const peta = new Map();
  for (const p of persimpanganKota()) {
    if (p.kol < AREA.kol0 || p.kol > AREA.kol1 || p.bar < AREA.bar0 || p.bar > AREA.bar1) continue;
    peta.set(p.kol + "," + p.bar, { ...p, tetangga: [] });
  }
  const diPlaza = (x, z) => x > PLAZA_TAPAK.minX - 2 && x < PLAZA_TAPAK.maxX + 2 && z > PLAZA_TAPAK.minZ - 2 && z < PLAZA_TAPAK.maxZ + 2;
  for (const n of peta.values()) {
    for (const [dk, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const m = peta.get((n.kol + dk) + "," + (n.bar + db));
      if (!m) continue;
      if (diPlaza((n.cx + m.cx) / 2, (n.cz + m.cz) / 2)) continue; // ruas di bawah plaza
      n.tetangga.push(m);
    }
  }
  return [...peta.values()].filter((n) => n.tetangga.length);
}
/* Titik lajur kiri di tepi kotak persimpangan n, untuk arus berarah (dx,dz). */
function titikLajur(n, dx, dz, masuk) {
  // arah gerak +x -> lajur utara (z - LAJUR); -x -> selatan; +z -> timur (x + LAJUR); -z -> barat
  const ox = dz > 0 ? LAJUR : dz < 0 ? -LAJUR : 0, oz = dx > 0 ? -LAJUR : dx < 0 ? LAJUR : 0;
  const tepi = JALAN / 2 * (masuk ? -1 : 1);  // masuk: tepi sisi datang; keluar: tepi sisi pergi
  return { x: n.cx + ox + dx * tepi, z: n.cz + oz + dz * tepi };
}
function pilihBerikut(n, asal) {
  const pilihan = n.tetangga.filter((m) => m !== asal);
  const daftar = pilihan.length ? pilihan : n.tetangga;
  return daftar[Math.floor(Math.random() * daftar.length)];
}
function mulaiRuas(car, dari, ke) {
  const dx = Math.sign(ke.cx - dari.cx), dz = Math.sign(ke.cz - dari.cz);
  car.dari = dari; car.ke = ke; car.dx = dx; car.dz = dz;
  car.a = titikLajur(dari, dx, dz, false); // keluar dari persimpangan asal
  car.b = titikLajur(ke, dx, dz, true);    // masuk ke persimpangan tujuan
  car.panjang = Math.hypot(car.b.x - car.a.x, car.b.z - car.a.z);
  car.s = 0; car.fase = "ruas";
}
export function bangunLaluLintas() {
  node = bangunJaringan();
  if (!node.length) return;
  const N = Math.round(320 * Math.max(0.35, PARAM.kepadatan || 1)); // jalanan ramai
  mobilJalan = [];
  for (let i = 0; i < N; i++) {
    const n = node[Math.floor(hashInt(i * 17 + 3) * node.length)];
    const car = { warna: WARNA_MOBIL[i % WARNA_MOBIL.length], v: KECEPATAN * (0.85 + hashInt(i * 5) * 0.3) };
    mulaiRuas(car, n, n.tetangga[i % n.tetangga.length]);
    car.s = hashInt(i * 29 + 1) * car.panjang * 0.8;
    mobilJalan.push(car);
  }
  inst = buatInstans(N);
  const c = new THREE.Color();
  mobilJalan.forEach((m, i) => inst.badan.setColorAt(i, c.setHex(m.warna)));
  if (inst.badan.instanceColor) inst.badan.instanceColor.needsUpdate = true;
  scene.add(inst.badan); scene.add(inst.detail);
}
const _d = new THREE.Object3D();
export function perbaruiLaluLintasMobil(t, dt) {
  if (!inst || !mobilJalan.length) return;
  const fase = faseLaluLintas(t);
  // indeks mobil per ruas berarah untuk menjaga jarak
  const perRuas = new Map();
  for (const m of mobilJalan) {
    if (m.fase !== "ruas") continue;
    const k = m.dari.kol + "," + m.dari.bar + ">" + m.ke.kol + "," + m.ke.bar;
    (perRuas.get(k) || perRuas.set(k, []).get(k)).push(m);
  }
  for (const daftar of perRuas.values()) daftar.sort((p, q) => q.s - p.s); // terdepan dulu
  for (const daftar of perRuas.values()) {
    for (let i = 0; i < daftar.length; i++) {
      const m = daftar[i];
      let batas = Infinity;
      if (i > 0) batas = daftar[i - 1].s - JARAK_AMAN;                       // mobil di depan
      const titikHenti = m.panjang - JARAK_HENTI;                             // garis henti sebelum persimpangan tujuan
      const lampu = m.dx !== 0 ? fase.tb : fase.us;
      if (lampu !== "hijau" && m.s <= titikHenti + 0.3) batas = Math.min(batas, titikHenti);
      const maju = Math.max(0, Math.min(m.v * dt, batas - m.s));
      m.s += maju; m.vNyata = dt > 0 ? maju / dt : 0;
      if (m.s >= m.panjang - 0.01) { // masuk persimpangan: belok/lurus ke ruas berikut
        const berikut = pilihBerikut(m.ke, m.dari);
        const ndx = Math.sign(berikut.cx - m.ke.cx), ndz = Math.sign(berikut.cz - m.ke.cz);
        m.fase = "simpang"; m.sa = m.b; m.sb = titikLajur(m.ke, ndx, ndz, false);
        m.sPanjang = Math.max(1, Math.hypot(m.sb.x - m.sa.x, m.sb.z - m.sa.z)); m.ss = 0;
        m.berikut = berikut;
      }
    }
  }
  for (const m of mobilJalan) if (m.fase === "simpang") {
    m.ss += m.v * 0.8 * dt; m.vNyata = m.v * 0.8;
    if (m.ss >= m.sPanjang) mulaiRuas(m, m.ke, m.berikut);
  }
  mobilJalan.forEach((m, i) => {
    let x, z, hx, hz;
    if (m.fase === "ruas") {
      const f = m.panjang ? m.s / m.panjang : 0;
      x = m.a.x + (m.b.x - m.a.x) * f; z = m.a.z + (m.b.z - m.a.z) * f; hx = m.dx; hz = m.dz;
    } else {
      const f = m.ss / m.sPanjang;
      x = m.sa.x + (m.sb.x - m.sa.x) * f; z = m.sa.z + (m.sb.z - m.sa.z) * f;
      hx = m.sb.x - m.sa.x; hz = m.sb.z - m.sa.z;
    }
    const yawJ = Math.atan2(hx, hz), gJ = goyang(m.goy || (m.goy = {}), dt, yawJ, m.vNyata || 0, SWAY.mobil, t);
    _d.position.set(x, 0.02 + (gJ.naik || 0), z); _d.rotation.order = "YXZ"; _d.rotation.set(gJ.pitch, yawJ, gJ.rollTampil || 0); _d.scale.set(1, 1, 1); _d.updateMatrix(); // sway
    inst.badan.setMatrixAt(i, _d.matrix); inst.detail.setMatrixAt(i, _d.matrix);
  });
  inst.badan.instanceMatrix.needsUpdate = true; inst.detail.instanceMatrix.needsUpdate = true;
}

export function mobil(g, x, z, ry, warna) {
    const grup = new THREE.Group();
    const matBody = M(warna, 0.45);
    const matKaca = M(0x1e2c36, 0.25);
    const matBan = M(0x1e2024, 0.9);
    const matVelg = M(0xcfd4dc, 0.35);

    // 1. Bodi bawah & kap mesin
    const bodiBawah = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.62, 4.25), matBody);
    bodiBawah.position.set(0, 0.68, 0);
    bodiBawah.castShadow = true; bodiBawah.receiveShadow = true;
    grup.add(bodiBawah);

    // 2. Kabin penumpang
    const kabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.6, 2.15), matBody);
    kabin.position.set(0, 1.28, -0.2);
    kabin.castShadow = true;
    grup.add(kabin);

    // 3. Kaca depan, belakang, & samping kabin
    const kacaDepan = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 0.06), matKaca);
    kacaDepan.position.set(0, 1.26, 0.9);
    kacaDepan.rotation.x = -0.22;
    grup.add(kacaDepan);

    const kacaBelakang = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.46, 0.06), matKaca);
    kacaBelakang.position.set(0, 1.26, -1.3);
    kacaBelakang.rotation.x = 0.22;
    grup.add(kacaBelakang);

    const kacaSamping = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 1.8), matKaca);
    kacaSamping.position.set(0, 1.28, -0.2);
    grup.add(kacaSamping);

    // 4. Bumper depan & belakang
    const matBumper = M(0x2b2f33, 0.6);
    const bumperD = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.22, 0.24), matBumper);
    bumperD.position.set(0, 0.44, 2.1);
    grup.add(bumperD);
    const bumperB = bumperD.clone();
    bumperB.position.z = -2.1;
    grup.add(bumperB);

    // 5. Lampu depan & rem
    const matLampuD = M(0xfff3c4, 0.3);
    const matLampuB = M(0xd62828, 0.3);
    for (const s of [-1, 1]) {
      const ld = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), matLampuD);
      ld.position.set(s * 0.66, 0.72, 2.13);
      grup.add(ld);
      const lb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.15, 0.08), matLampuB);
      lb.position.set(s * 0.66, 0.72, -2.13);
      grup.add(lb);
    }

    // 6. Roda & Velg (silinder diputar 90 derajat)
    const geoBan = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
    const geoVelg = new THREE.CylinderGeometry(0.21, 0.21, 0.3, 12);
    for (const [wx, wz] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]]) {
      const ban = new THREE.Mesh(geoBan, matBan);
      ban.rotation.z = Math.PI / 2;
      ban.position.set(wx, 0.38, wz);
      ban.castShadow = true;
      grup.add(ban);
      const velg = new THREE.Mesh(geoVelg, matVelg);
      velg.rotation.z = Math.PI / 2;
      velg.position.set(wx, 0.38, wz);
      grup.add(velg);
    }

    grup.position.set(x, 0, z);
    grup.rotation.y = ry || 0;
    g.add(grup);
    return grup;
  }

/* ============ MOBIL PAJANGAN: mobil() detail parkir di tepi jalan ============
   8 mobil mesh penuh (bukan instanced) di tepi jalan dekat plaza &
   fasilitas terbangun, di posisi trotoar tepi (di luar lajur lalu lintas
   kendaraan.js maupun arteri kota.js). Tiap mobil didaftarkan sebagai
   AABB di rintanganFasilitas agar kamera tidak menembusnya. */
export function bangunMobilPajangan() {
  const grup = new THREE.Group();
  const tempat = [
    // jalan selatan plaza (strip z 84..98), tepi utara z 85.3, menghadap timur
    [-52, 85.3, Math.PI / 2, 0xd9462e], [-34, 85.3, Math.PI / 2, 0x3f6fb5],
    [30, 85.3, Math.PI / 2, 0xe8c268], [48, 85.3, Math.PI / 2, 0xf2f0eb],
    // jalan antara Taman (1879) & Blok 1880 (strip x -84..-70), tepi barat, menghadap utara
    [-82.7, -140, Math.PI, 0x2e9e5b], [-82.7, -108, Math.PI, 0x5c6770],
    // jalan barat Toko Pancing (1882) (strip x 84..98), tepi barat, menghadap selatan
    [85.3, -140, 0, 0xe07a3f], [85.3, -104, 0, 0x4a7a8c],
  ];
  for (const [x, z, ry, warna] of tempat) {
    mobil(grup, x, z, ry, warna);
    const memanjangX = Math.abs(Math.sin(ry)) > 0.5;
    const hx = memanjangX ? 2.15 : 0.97, hz = memanjangX ? 0.97 : 2.15;
    rintanganFasilitas.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
  }
  scene.add(grup);
  return grup;
}
