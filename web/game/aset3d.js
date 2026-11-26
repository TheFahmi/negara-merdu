/* Negara Merdu — modul "aset3d": ASET 3D GLB (pengganti model prosedural).
   Dimuat via GLTFLoader three r128 (global THREE, /GLTFLoader.js +
   /BufferGeometryUtils.js di layout). muatAset3D() dipanggil main.js
   SEBELUM kota dibangun; tiap builder di sini mengembalikan null bila
   asetnya gagal dimuat -> pemanggil jatuh ke model prosedural lama.

   Kalibrasi (satuan file -> satuan dunia game):
   - Rumah: tapak file 0,694 x 1,002; skala diserahkan ke rumah.js.
   - Bus: panjang file 4,47 -> 10,5 (sama dengan bus prosedural lama).
   - KRL: pitch gerbong file 4,42 -> 14,2 (sama dengan rangkaian lama);
     lantai diselaraskan ke 0,5 lokal (sejajar peron), pintu file di
     z ±1,3/0 -> lx ∓4,18/0 (pintu game lama di ±4,2). Konsist dibalik
     (Tail-Mid-Mid-Head, rotasi -90°) supaya pintu geser asli (sisi +x
     file) menghadap sisi peron lokal +z seperti logika game.
   - Kendaraan kecil: 0,40 satuan file = 1 m game (skala 2,5), kecuali
     truk (6,6 m), jip (4,3 m), becak & motor (samakan model lama).
   - next37 (audit skala terukur vs model prosedural): becak 2,0->2,5
     dan motor 1,94->2,17 di pemanggil (panjang kembali = prosedural);
     jip 2,37->2,55 di mobilGeo. Sedan/truk/ambulans/polisi terukur
     sudah <=4% dari prosedural — tidak diubah. */

const DASAR = "/aset3d/";
let TPL = null;

function muatSatu(loader, url) {
  return new Promise((res) => {
    try { loader.load(url, (g) => res(g.scene), undefined, () => res(null)); }
    catch (e) { res(null); }
  });
}

/* Pindah induk yang aman untuk three r128 (removeFromParent baru r132+). */
function lepas(o) { if (o.parent) o.parent.remove(o); }
function rapikanMaterial(sc) {
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    if (m && m.name === "FlatGlass") { m.transparent = true; m.depthWrite = false; }
  });
}

/* Gabung daftar geometri (dijadikan non-indexed, atribut diseragamkan).
   Mengembalikan null bila gagal / BufferGeometryUtils tak ada. */
function gabungGeo(list) {
  if (!list.length || !THREE.BufferGeometryUtils) return null;
  const norm = list.map((g) => {
    let gg = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(gg.attributes)) if (["position", "normal", "uv", "color"].indexOf(k) < 0) gg.deleteAttribute(k);
    if (!gg.attributes.uv) { const n = gg.attributes.position.count; gg.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2)); }
    return gg;
  });
  try { return THREE.BufferGeometryUtils.mergeBufferGeometries(norm, false); } catch (e) { return null; }
}

function bakarWarna(g, c) {
  const n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

/* ---------- RUMAH: gabung per material, tanah digeser ke y=0 ---------- */
function templateRumah(sc) {
  if (!sc) return null;
  rapikanMaterial(sc);
  sc.updateMatrixWorld(true);
  const perMat = new Map();
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const nama = o.material.name || "?";
    if (!perMat.has(nama)) perMat.set(nama, { mat: o.material, geos: [] });
    perMat.get(nama).geos.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
  });
  const grup = new THREE.Group();
  for (const ent of perMat.values()) {
    const g = gabungGeo(ent.geos);
    if (!g) return null;
    const m = new THREE.Mesh(g, ent.mat);
    m.castShadow = true; m.receiveShadow = true;
    grup.add(m);
  }
  const bb = new THREE.Box3().setFromObject(grup);
  const dalam = new THREE.Group(); dalam.position.y = -bb.min.y; dalam.add(grup);
  const luar = new THREE.Group(); luar.add(dalam);
  return { grup: luar, tinggi: bb.max.y - bb.min.y, lebar: bb.max.x - bb.min.x, dalam: bb.max.z - bb.min.z };
}

export function asetRumah(tipe) { return (TPL && TPL.rumah[tipe]) || null; }
export function buatRumahGLB(tipe) {
  const t = asetRumah(tipe); if (!t) return null;
  return t.grup.clone();
}

/* ---------- BUS ---------- */
function templateBus(sc) {
  if (!sc) return null;
  rapikanMaterial(sc);
  const bb = new THREE.Box3().setFromObject(sc);
  const kursi = []; let lantaiAtas = -Infinity, plafonBawah = null;
  const sasisNama = [];
  sc.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name === "Chassis" || o.name.startsWith("Wheel")) sasisNama.push(o.name);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    if (/^Seat_.*_Cushion$/.test(o.name)) kursi.push({ x: c.x, z: c.z, atas: b.max.y });
    if (o.name === "Cabin_Floor" || o.name === "FloorSlab") lantaiAtas = Math.max(lantaiAtas, b.max.y);
    if (o.name === "Cabin_Ceiling") plafonBawah = b.min.y; // sisi bawah plafon kabin (koordinat file)
  });
  if (!kursi.length || lantaiAtas === -Infinity) return null;
  return { scene: sc, skala: 10.5 / (bb.max.z - bb.min.z), kursi, lantaiAtas, plafonBawah, sasisNama, tanah: bb.min.y };
}

export function buatBusGLB() {
  const t = TPL && TPL.bus; if (!t) return null;
  const SB = t.skala, oy = -t.tanah * SB;
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.scale.setScalar(SB); inner.position.y = oy; g.add(inner);
  const sc = t.scene.clone(); inner.add(sc);
  /* sasis (roda + casis): tetap tegak saat bodi sway — sama seperti bus lama */
  const sasis = new THREE.Group(); g.add(sasis); g.userData.sasis = sasis;
  const roda = [];
  for (const nama of t.sasisNama) {
    const m = sc.getObjectByName(nama); if (!m) continue;
    lepas(m);
    m.position.set(m.position.x * SB, m.position.y * SB + oy, m.position.z * SB);
    m.scale.setScalar(SB); sasis.add(m);
    if (nama.startsWith("Wheel")) roda.push(m);
  }
  g.userData.roda = roda; g.userData.rRoda = 0.17 * SB;
  /* pintu tengah (Door_Mid) disatukan jadi satu daun geser */
  const pm = sc.getObjectByName("Door_Mid");
  if (pm) {
    const daun = new THREE.Group(); daun.position.copy(pm.position);
    for (const nama of ["Door_Mid", "Door_Mid_Livery", "Door_Mid_Glass", "Door_Mid_Frame"]) {
      const m = sc.getObjectByName(nama); if (!m) continue;
      lepas(m); m.position.set(0, 0, 0); daun.add(m);
    }
    sc.add(daun);
    g.userData.pintu = [{ daun, z0: daun.position.z, arah: -1, geser: 0.55 }];
  } else g.userData.pintu = [];
  const lantai = (t.lantaiAtas - t.tanah) * SB;
  g.userData.kursi = t.kursi.map((a) => ({ lx: a.x * SB, ly: (a.atas - t.tanah) * SB - 0.54, lz: a.z * SB, rot: 0, isi: null, lorongX: 0, lantai }));
  g.userData.lantaiY = lantai;
  /* Tinggi mata penumpang (next36): kabin GLB jauh lebih rendah dari bus
     prosedural (lantai 0,85, plafon 2,34) — offset mata lama lantai+2,05
     menembus atap (mata 2,90 > atap 2,70) sehingga interior tak pernah
     terlihat. Mata diturunkan 0,42 di bawah plafon kabin terukur. */
  if (t.plafonBawah !== null && t.plafonBawah !== undefined) {
    const plafon = (t.plafonBawah - t.tanah) * SB;
    g.userData.mataY = Math.max(lantai + 0.9, Math.min(lantai + 2.05, plafon - 0.42));
  }
  let matRem = new THREE.MeshBasicMaterial({ color: 0x8a1212 });
  const rl = sc.getObjectByName("Rear_Lamp_L"), rr = sc.getObjectByName("Rear_Lamp_R");
  if (rl) { matRem = rl.material.clone(); rl.material = matRem; if (rr) rr.material = matRem; }
  g.userData.lampu = { matRem, sein: { 1: [], "-1": [] } };
  return g;
}

/* ---------- KRL ---------- */
function templateKRL(sc) {
  if (!sc) return null;
  rapikanMaterial(sc);
  sc.updateMatrixWorld(true);
  const cars = {};
  let lantaiAtas = null, pitch = 4.42;
  const posCar = {};
  for (const nama of ["Head", "Mid", "Tail"]) {
    const gc = sc.getObjectByName("Car_" + nama); if (!gc) return null;
    posCar[nama] = gc.position.z;
    const inv = new THREE.Matrix4().copy(gc.matrixWorld).invert();
    const perMat = new Map(), pintuMap = new Map(), bogieMap = new Map(), kursi = [];
    gc.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      const nm = o.name; let m;
      if ((m = nm.match(/^Door_.*_(R\d)/))) {
        if (!pintuMap.has(m[1])) pintuMap.set(m[1], []);
        pintuMap.get(m[1]).push({ geo: g, mat: o.material });
      } else if ((m = nm.match(/^Bogie_.*_(\d+)_/)) || (m = nm.match(/^Bogie_.*_(\d+)$/))) {
        if (!bogieMap.has(m[1])) bogieMap.set(m[1], []);
        bogieMap.get(m[1]).push({ geo: g, mat: o.material });
      } else {
        if (/Bench.*_Cushion$/.test(nm)) { g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()); kursi.push({ x: c.x, z: c.z, atas: b.max.y, panjang: s.z }); }
        if (nm.endsWith("_Int_Floor")) lantaiAtas = Math.max(lantaiAtas || -Infinity, (g.computeBoundingBox(), g.boundingBox.max.y));
        if (!perMat.has(o.material.name || "?")) perMat.set(o.material.name || "?", { mat: o.material, geos: [] });
        perMat.get(o.material.name || "?").geos.push(g);
      }
    });
    const grup = new THREE.Group();
    for (const ent of perMat.values()) {
      const gg = gabungGeo(ent.geos); if (!gg) return null;
      const mesh = new THREE.Mesh(gg, ent.mat); mesh.castShadow = true; grup.add(mesh);
    }
    const pintu = [];
    for (const meshes of pintuMap.values()) {
      const b = new THREE.Box3(); for (const pm of meshes) { pm.geo.computeBoundingBox(); b.union(pm.geo.boundingBox); }
      const cz = b.getCenter(new THREE.Vector3()).z;
      pintu.push({ meshes, arah: cz < -0.1 ? -1 : 1, geser: Math.abs(cz) > 0.1 ? 0.46 : 0.48 });
    }
    const bogie = [];
    for (const meshes of bogieMap.values()) {
      const b = new THREE.Box3(); for (const pm of meshes) { pm.geo.computeBoundingBox(); b.union(pm.geo.boundingBox); }
      const asal = new THREE.Vector3(0, b.min.y + 0.17, b.getCenter(new THREE.Vector3()).z);
      for (const pm of meshes) pm.geo.translate(-asal.x, -asal.y, -asal.z);
      bogie.push({ meshes, asal });
    }
    cars[nama] = { grup, pintu, bogie, kursi };
  }
  pitch = Math.abs(posCar.Head - posCar.Mid) || 4.42;
  /* gangway: geometri dinormalkan ke pusatnya sendiri */
  const gang = sc.getObjectByName("Gangway_1"); let gangway = null, gangwayY = 0.51;
  if (gang) {
    const daftar = [];
    sc.traverse((o) => { if (o.isMesh && o.name.startsWith("Gangway_1")) daftar.push(o); });
    const bb = new THREE.Box3(); for (const o of daftar) { const t = new THREE.Box3().setFromObject(o); bb.union(t); }
    const c = bb.getCenter(new THREE.Vector3()); gangwayY = c.y;
    gangway = daftar.map((o) => { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); g.translate(-c.x, -c.y, -c.z); return { geo: g, mat: o.material }; });
  }
  if (lantaiAtas === null) return null;
  return { cars, gangway, gangwayY, lantaiAtas, skala: 14.2 / pitch };
}

export function buatKeretaGLB() {
  const t = TPL && TPL.krl; if (!t) return null;
  const SK = t.skala, oy = 0.5 - SK * t.lantaiAtas;
  const k = new THREE.Group(), gerbong = [];
  for (let i = 0; i < 4; i++) {
    const ct = t.cars[["Tail", "Mid", "Mid", "Head"][i]];
    const c = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = -Math.PI / 2; inner.scale.setScalar(SK); inner.position.y = oy;
    c.add(inner);
    inner.add(ct.grup.clone());
    if (i < 3 && t.gangway) for (const gm of t.gangway) {
      const m = new THREE.Mesh(gm.geo, gm.mat); m.position.set(0, t.gangwayY, 2.21); inner.add(m);
    }
    c.userData.pintu = ct.pintu.map((p) => {
      const daun = new THREE.Group();
      for (const pm of p.meshes) daun.add(new THREE.Mesh(pm.geo, pm.mat));
      inner.add(daun);
      return { daun, sumbu: "z", pos0: 0, arah: p.arah, geser: p.geser, sisi: 1 };
    });
    const sasis = new THREE.Group(); c.add(sasis); c.userData.sasis = sasis;
    for (const b of ct.bogie) {
      const pivot = new THREE.Group();
      pivot.position.set(-b.asal.z * SK, oy + b.asal.y * SK, b.asal.x * SK);
      pivot.rotation.y = -Math.PI / 2; pivot.scale.setScalar(SK);
      for (const pm of b.meshes) pivot.add(new THREE.Mesh(pm.geo, pm.mat));
      sasis.add(pivot);
    }
    c.userData.kursi = [];
    for (const a of ct.kursi) {
      const spots = a.panjang > 0.4 ? [-a.panjang / 4, a.panjang / 4] : [0];
      for (const dz of spots) c.userData.kursi.push({ lx: -(a.z + dz) * SK, ly: a.atas * SK + oy - 0.61, lz: a.x * SK, rot: a.x > 0 ? Math.PI : 0, isi: null, lantai: 0.5 });
    }
    gerbong.push(c); k.add(c);
  }
  k.userData.gerbong = gerbong;
  return k;
}

/* ---------- KENDARAAN KECIL ---------- */
function bagianMobil(sc) {
  if (!sc) return null;
  rapikanMaterial(sc);
  sc.updateMatrixWorld(true);
  const S = 2.5, m4 = new THREE.Matrix4().makeScale(S, S, S); m4.setPosition(0, 0.368 * S, 0);
  const kelas = { badan: [], detail: [], kaca: [], roda: [] };
  sc.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(m4);
    if (o.name.startsWith("Wheel")) kelas.roda.push({ g, warna: o.material.color });
    else if (o.material.name === "FlatGlass") { g.deleteAttribute("color"); kelas.kaca.push({ g }); }
    else if (o.material.name === "BodyPaint") kelas.badan.push({ g });
    else kelas.detail.push({ g, warna: o.material.color || new THREE.Color(0xffffff) });
  });
  const PUTIH = { r: 1, g: 1, b: 1 };
  return {
    badan: gabungGeo(kelas.badan.map((e) => bakarWarna(e.g, PUTIH))),
    detail: gabungGeo(kelas.detail.map((e) => bakarWarna(e.g, e.warna))),
    kaca: gabungGeo(kelas.kaca.map((e) => e.g)),
    roda: gabungGeo(kelas.roda.map((e) => bakarWarna(e.g, e.warna))),
  };
}

export function geoMobilGLB() {
  const t = TPL && TPL.mobilGeo;
  if (!t || !t.badan || !t.detail || !t.kaca || !t.roda) return null;
  return t;
}

/* Klon kendaraan utuh (grup): inner berskala, tanah di y=0, hadap +z. */
export function klonKendaraanGLB(nama, skala, warna) {
  const t = TPL && TPL.kendaraan[nama]; if (!t) return null;
  const g = new THREE.Group();
  const inner = new THREE.Group(); inner.scale.setScalar(skala); inner.position.y = 0.368 * skala; g.add(inner);
  const sc = t.scene.clone(); inner.add(sc);
  sc.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  if (warna !== undefined && warna !== null) {
    let cat = null;
    sc.traverse((o) => {
      if (o.isMesh && o.material.name === "BodyPaint") {
        if (!cat) { cat = o.material.clone(); cat.color.setHex(warna); }
        o.material = cat;
      }
    });
  }
  return { g, scene: sc };
}

/* Pindahkan roda dari scene klon ke grup sasis (tetap tegak saat sway). */
export function pindahRodaKeSasis(scene, sasis, skala) {
  const daftar = [];
  scene.traverse((o) => { if (o.isMesh && o.name.startsWith("Wheel")) daftar.push(o); });
  for (const m of daftar) {
    lepas(m);
    m.position.set(m.position.x * skala, m.position.y * skala + 0.368 * skala, m.position.z * skala);
    m.scale.setScalar(skala); sasis.add(m);
  }
}

export function buatPolisiGLB() {
  const b = klonKendaraanGLB("mobil_polisi", 2.5, null); if (!b) return null;
  const sasis = new THREE.Group(); b.g.add(sasis); b.g.userData.sasis = sasis;
  pindahRodaKeSasis(b.scene, sasis, 2.5);
  const mr = b.scene.getObjectByName("LightBar_Red"), mb = b.scene.getObjectByName("LightBar_Blue");
  if (!mr || !mb) return null;
  mr.material = mr.material.clone(); mb.material = mb.material.clone();
  let rem = null;
  const tl = b.scene.getObjectByName("Taillamp_L");
  if (tl) { rem = tl.material.clone(); b.scene.traverse((o) => { if (o.isMesh && o.material.name === "FlatLampRear") o.material = rem; }); }
  if (!rem) return null;
  return { g: b.g, merah: mr, biru: mb, rem };
}

/* ---------- MUAT SEMUA ---------- */
export async function muatAset3D() {
  if (TPL) return TPL;
  TPL = { rumah: {}, bus: null, krl: null, mobilGeo: null, kendaraan: {} };
  if (!THREE.GLTFLoader) return TPL;
  const loader = new THREE.GLTFLoader();
  const berkas = ["rumah-tipe1", "rumah-tipe2", "rumah-tipe3", "rumah-tipe4", "rumah-tipe5", "rumah-tipe6",
    "bus", "krl", "mobil", "mobil_polisi", "ambulans", "becak", "jip", "motor", "truk_bak", "truk_boks", "truk_terpal"];
  const hasil = await Promise.all(berkas.map((n) => muatSatu(loader, DASAR + n + ".glb")));
  const ambil = (n) => hasil[berkas.indexOf(n)];
  for (let i = 1; i <= 6; i++) { try { TPL.rumah[i] = templateRumah(ambil("rumah-tipe" + i)); } catch (e) { TPL.rumah[i] = null; } }
  try { TPL.bus = templateBus(ambil("bus")); } catch (e) { TPL.bus = null; }
  try { TPL.krl = templateKRL(ambil("krl")); } catch (e) { TPL.krl = null; }
  try { TPL.mobilGeo = bagianMobil(ambil("mobil")); } catch (e) { TPL.mobilGeo = null; }
  for (const n of ["mobil", "mobil_polisi", "ambulans", "becak", "jip", "motor", "truk_bak", "truk_boks", "truk_terpal"]) {
    const sc = ambil(n); if (sc) { rapikanMaterial(sc); TPL.kendaraan[n] = { scene: sc }; }
  }
  return TPL;
}
