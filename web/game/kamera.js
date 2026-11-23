/* Negara Merdu — modul game "kamera" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Kamera: mode orbit/1st person/3rd person/drone, gerak pemain, tabrakan, joystick & sentuh. */
import { $, BLOK_BARIS, BLOK_KOLOM, IK, JALAN, KAV_PITCH, KOTA_D, KOTA_W, PITCH, PUSAT_X, PUSAT_Z, RESERVASI, wilayahLengkap, SISI, TAMAN, posisiKavling, sudutBlok } from "./inti.js";
import { OFSET_MATAHARI, aturJangkauBayangan, camera, kanvas, matahari, rumahDetailSet, rumahTerisi, scene } from "./bersama.js";
import { animasiHidup, animasiJalan, buatKarakter } from "./karakter.js";
import { INT, dekatPintuKeluar, diInterior, jepitInteriorUmum, keluarInterior, masukApartemen, masukInterior, masukIstana, masukMall, pulihInterior, rintangan, rintanganDetail, rintanganFasilitas, rintanganInterior, rumahKlik, setPulihInterior } from "./rumah.js";
import { sesi, teksWilayahPendek } from "./ui.js";
import { buangGrup } from "./jaringan.js";
import { perbaruiMinimapTampil } from "./peta.js";
import { ketukIklan } from "./iklan.js";
import { istanaKlik } from "./istana.js";
import { MALL_KLIK } from "./fasilitasBaru.js";
import { AP, apartemenKlik, pintuApartemen } from "./apartemen.js";
import { waktuLalu } from "./main.js";

  /* ================= KAMERA ORBIT ================= */
  export let theta = 0.8, phi = 1.02, radius = 300, putarOtomatis = true;
  export const target = new THREE.Vector3(PUSAT_X, 0, 6 + PUSAT_Z);
  export function terapkanKamera() {
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    matahari.position.set(target.x + OFSET_MATAHARI.x, OFSET_MATAHARI.y, target.z + OFSET_MATAHARI.z);
    matahari.target.position.set(target.x, 0, target.z);
    aturJangkauBayangan(radius * 1.15);
  }
  export function fokusKe(x, z, r) {
    target.set(x, 0, z); radius = r || 60; interaksiTerakhir = 0;
  }
  export const penunjuk = new Map();
  export let jarakCubit = 0, gerakSentuh = 0, waktuSentuh = 0, interaksiTerakhir = 0;
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
  export function akhirSentuh(e) {
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
        const pos = jepitInteriorUmum(tabrakanInterior(fp.x, fp.z).x, tabrakanInterior(fp.x, fp.z).z);
        fp.x = pos.x; fp.z = pos.z;
      } else {
        const pos = tabrakan(fp.x, fp.z);
        fp.x = Math.min(BATAS_X - 2, Math.max(-BATAS_X + 2, pos.x));
        fp.z = Math.min(BATAS_Z - 2, Math.max(-BATAS_Z + 2, pos.z));
      }
    }
  }, { passive: false });

  export const ray = new THREE.Raycaster();
  export const v2 = new THREE.Vector2();
  export function ketukRumah(cx, cy) {
    if (diInterior) { // di dalam rumah: ketuk saat berdiri di depan pintu keluar = keluar
      if (dekatPintuKeluar()) keluarInterior();
      return;
    }
    v2.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(v2, camera);
    const kena = ray.intersectObjects(rumahKlik, true);
    if (ketukIklan(ray, kena.length ? kena[0].distance : Infinity)) return; // papan iklan lebih dekat dari rumah mana pun
    const kenaApt = ray.intersectObjects(apartemenKlik, true);
    if (kenaApt.length && (!kena.length || kenaApt[0].distance < kena[0].distance)) {
      let o = kenaApt[0].object; while (o && !o.userData.apartemen) o = o.parent;
      const data = o.userData.apartemen, pintu = pintuApartemen.find((p) => p.data === data);
      $("#kartu .isi").innerHTML = "<h3>" + IK.rumah + " " + data.nama + "</h3><p>Apartemen 10 lantai: lobi, lift, dan 6 unit kamar tiap lantai. Naik lift untuk berkunjung ke unit mana pun.</p>" +
        '<button class="btn-masuk" id="btn-masuk-apt" type="button">' + IK.pintu + " Masuk Apartemen</button>";
      $("#kartu").hidden = false;
      $("#btn-masuk-apt").addEventListener("click", () => { $("#kartu").hidden = true; masukApartemen(pintu); });
      return;
    }
    const kenaMall = ray.intersectObjects(MALL_KLIK, true);
    if (kenaMall.length && (!kena.length || kenaMall[0].distance < kena[0].distance)) {
      $("#kartu .isi").innerHTML = "<h3>" + IK.rumah + " Merdu Mall</h3><p>Mall megah 2 lantai: 20+ toko, eskalator, food court, bioskop, air mancur atrium.</p>" +
        '<button class="btn-masuk" id="btn-masuk-mall" type="button">' + IK.pintu + " Masuk Mall</button>";
      $("#kartu").hidden = false;
      $("#btn-masuk-mall").addEventListener("click", () => { $("#kartu").hidden = true; masukMall(); });
      return;
    }
    const kenaIstana = ray.intersectObjects(istanaKlik, true);
    if (kenaIstana.length && (!kena.length || kenaIstana[0].distance < kena[0].distance)) {
      $("#kartu .isi").innerHTML = "<h3>" + IK.rumah + " Istana Negara</h3><p>Kantor Pak Presiden Negara Merdu. Di dalam: aula kenegaraan, ruang rapat kabinet & papan struktur pemerintahan (Presiden, Wali Kota, Camat, Lurah, Ketua RW/RT).</p>" +
        '<button class="btn-masuk" id="btn-masuk-istana" type="button">' + IK.pintu + " Masuk Istana</button>";
      $("#kartu").hidden = false;
      $("#btn-masuk-istana").addEventListener("click", () => { $("#kartu").hidden = true; masukIstana(); });
      return;
    }
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
      teksWilayahPendek(wilayahLengkap(w.blok)) + "<br>" +
      (w.jabatan ? "Jabatan: <b>" + w.jabatan + "</b><br>" : "") +
      "Warga resmi Negara Merdu. Rumah detailnya dipajang di Distrik Pusat.</p>" +
      '<button class="btn-masuk" id="btn-masuk-rumah" type="button">' + IK.pintu + ' Masuk Rumah</button>';
    $("#kartu").hidden = false;
    $("#btn-masuk-rumah").addEventListener("click", () => { $("#kartu").hidden = true; masukInterior(w, obj); });
  }
  $("#kartu .tutup").addEventListener("click", () => { $("#kartu").hidden = true; });

  /* ================= MODE KAMERA: ORBIT / 1ST PERSON / DRONE ================= */
  export let modeKamera = "orbit";
  export const fp = { x: 8, z: 22, yaw: 0.35, pitch: 0 };          // 1st Person: posisi di tanah + arah pandang
  export const dr = { x: 0, y: 140, z: 320, yaw: 0, pitch: -0.4 }; // Drone: posisi terbang bebas + arah pandang
  /* 3rd Person: posisi pemain memakai fp yang sama; tp = orbit kamera di
     sekeliling karakter. yaw/pitch mengikuti konvensi fp (arah pandang kamera
     = (-sin yaw, -cos yaw)); hadap = arah menghadap MODEL karakter (konvensi
     model: +Z lokal menunjuk (sin hadap, cos hadap)); kam* = posisi kamera
     terlicin (null = tempel ke posisi ideal pada frame berikutnya). */
  export const tp = { yaw: 0.35, pitch: 0.32, jarak: 6.5, hadap: 0, kamX: null, kamY: null, kamZ: null };
  export let karSaya = null, kunciRupaSaya = ""; // karakter pemain sendiri (hanya tampil di 3rd Person)
  export const joy = { x: 0, y: 0 };
  export let tahanNaik = false, tahanTurun = false;
  export const tombolKey = new Set();
  export const BATAS_X = KOTA_W / 2, BATAS_Z = KOTA_D / 2;
  export const jepit = (v, a, b) => Math.min(b, Math.max(a, v));

  addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; // jangan rebut ketikan di form gerbang
    tombolKey.add(e.code);
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  });
  addEventListener("keyup", (e) => tombolKey.delete(e.code));
  addEventListener("blur", () => tombolKey.clear());

  export function ikutiMatahari(x, z, jangkau) {
    matahari.position.set(x + OFSET_MATAHARI.x, OFSET_MATAHARI.y, z + OFSET_MATAHARI.z);
    matahari.target.position.set(x, 0, z);
    aturJangkauBayangan(jangkau || 110); // jalan kaki: kotak rapat = bayangan tajam
  }
  /* Tabrakan sederhana: lingkaran pemain (r=0,55) vs AABB rintangan, didorong keluar lewat sisi terdekat.
     Rintangan AABB: objek Distrik Pusat (balai, tugu, papan, rumah detail) +
     bangunan fasilitas terbangun. Rumah massal (InstancedMesh, tanpa AABB)
     ditangani tabrakanRumahMassal di bawah dengan perhitungan grid. */
  export function tabrakanDi(x, z, daftarSemua) {
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
  export const SETENGAH_TAPAK = { x: 8.6 / 2, z: 7.6 / 2 }; // setengah lebar/dalam dinding rumah massal
  export const poolKandidat = [];
  for (let i = 0; i < 9; i++) poolKandidat.push({ minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
  export const viewKandidat = []; // referensi ke poolKandidat[0..n) untuk tabrakanDi
  export function tabrakanRumahMassal(x, z) {
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
  export function tabrakan(x, z) {
    const p = tabrakanDi(x, z, [rintangan, rintanganDetail, rintanganFasilitas]);
    return tabrakanRumahMassal(p.x, p.z); // wilayahnya terpisah dari AABB di atas (blok RESERVASI/TAMAN dilewati grid)
  }
  export function tabrakanInterior(x, z) { return tabrakanDi(x, z, [rintanganInterior]); }
  export function posisiDepanRumah(w) { // titik di jalan tepat di depan kavling warga
    const bi = w.blok - 1, bar = Math.floor(bi / BLOK_KOLOM), kol = bi % BLOK_KOLOM;
    const s = sudutBlok(kol, bar);
    const p = posisiKavling(w.blok, w.kavling);
    return { x: s.x + JALAN / 2, z: p.z };
  }
  export function vektorGerak() { // gabungan keyboard + joystick, dinormalisasi
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
  export function langkahPemain(dt, yawBasis) {
    const g = vektorGerak();
    const cepat = (tombolKey.has("ShiftLeft") || tombolKey.has("ShiftRight")) ? 48 : 22;
    const fx = -Math.sin(yawBasis), fz = -Math.cos(yawBasis);
    const rx = Math.cos(yawBasis), rz = -Math.sin(yawBasis);
    const ox = fp.x, oz = fp.z;
    const nx = fp.x + (fx * g.mz + rx * g.mx) * cepat * dt;
    const nz = fp.z + (fz * g.mz + rz * g.mx) * cepat * dt;
    if (diInterior) { // di dalam rumah: tabrakan perabot + jepit di dalam dinding ruangan
      const t = tabrakanInterior(nx, nz), pos = jepitInteriorUmum(t.x, t.z); // + kabin lift apartemen
      fp.x = pos.x; fp.z = pos.z;
    } else {
      const pos = tabrakan(nx, nz);
      fp.x = jepit(pos.x, -BATAS_X + 2, BATAS_X - 2);
      fp.z = jepit(pos.z, -BATAS_Z + 2, BATAS_Z - 2);
    }
    return Math.hypot(fp.x - ox, fp.z - oz);
  }
  export function updateOrang(dt) {
    langkahPemain(dt, fp.yaw);
    if (diInterior) camera.position.set(fp.x, INT.y + 1.6 + (AP.goyang || 0), fp.z); // mata 1,6 di atas lantai interior (+ getar kabin lift)
    else camera.position.set(fp.x, 1.6, fp.z); // setinggi mata karakter (±1,6 satuan)
    camera.rotation.set(fp.pitch, fp.yaw, 0);
    ikutiMatahari(fp.x, fp.z);
  }
  /* ---------- 3rd Person ---------- */
  export function lerpSudut(a, b, t) { // interpolasi sudut sadar lilitan ±π (murni)
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  /* Posisi kamera 3rd Person (murni): menggantung `jarak` di belakang
     karakter; titik pijak = dada karakter (y 1,5); pitch > 0 menaikkan
     kamera. Arah dari karakter ke kamera = kebalikan arah pandang yaw. */
  export function posisiKameraKetiga(px, pz, yaw, pitch, jarak) {
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
  export function kameraKetigaIdeal() {
    for (const f of [1, 0.75, 0.5, 0.3, 0.15]) {
      const c = posisiKameraKetiga(fp.x, fp.z, tp.yaw, tp.pitch, tp.jarak * f);
      const uji = tabrakan(c.x, c.z);
      if (Math.abs(uji.x - c.x) < 0.01 && Math.abs(uji.z - c.z) < 0.01) return c;
    }
    return posisiKameraKetiga(fp.x, fp.z, tp.yaw, tp.pitch, tp.jarak * 0.15);
  }
  export function updateKetiga(dt) {
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
  export function rupaSaya() {
    const s = sesi.saya;
    return s ? { baju: s.warna_baju, kulit: s.warna_kulit, topi: s.topi, rupa: s.rupa || null }
             : { baju: "#2e9e5b", kulit: "#f1c27d", topi: "tanpa" };
  }
  export function segarkanKarakterSaya() {
    const r = rupaSaya();
    const kunci = [r.baju, r.kulit, r.topi, JSON.stringify(r.rupa || null)].join("|");
    if (karSaya && kunci === kunciRupaSaya) return;
    if (karSaya) { scene.remove(karSaya); buangGrup(karSaya); karSaya = null; }
    kunciRupaSaya = kunci;
    karSaya = buatKarakter(r);
    karSaya.scale.setScalar(1.35); // skala sama seperti pemain lain & NPC
    karSaya.visible = false; // visibilitas diatur per frame di animasi()
    scene.add(karSaya);
  }
  export function updateDrone(dt) {
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
    ikutiMatahari(dr.x, dr.z, 120 + dr.y * 1.2);
  }
  export const PETUNJUK = {
    orbit: "Seret untuk memutar · Cubit/scroll untuk zoom",
    orang: "Joystick / WASD untuk jalan · Seret untuk melihat sekeliling",
    ketiga: "Joystick / WASD untuk jalan · Seret untuk memutar kamera",
    drone: "Joystick / WASD untuk terbang · R/F atau tombol layar untuk naik-turun",
  };
  export let petunjukDitutup = false;
  export function aturMode(m) {
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
        setPulihInterior(false);
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
        fp.x = 8 + PUSAT_X; fp.z = 22 + PUSAT_Z; fp.yaw = Math.atan2(8, 22);
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
  export const joyEl = $("#joystick"), knob = joyEl.querySelector(".knob");
  export let joyId = null;
  export function joyGerak(e) {
    const r = joyEl.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const maks = r.width / 2 - 6, p = Math.hypot(dx, dy);
    if (p > maks) { dx *= maks / p; dy *= maks / p; }
    joy.x = dx / maks; joy.y = dy / maks;
    knob.style.transform = "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px))";
  }
  joyEl.addEventListener("pointerdown", (e) => { joyId = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch (err) {} joyGerak(e); e.preventDefault(); });
  joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joyId) joyGerak(e); });
  export function joyLepas(e) {
    if (e.pointerId !== joyId) return;
    joyId = null; joy.x = 0; joy.y = 0;
    knob.style.transform = "translate(-50%,-50%)";
  }
  joyEl.addEventListener("pointerup", joyLepas);
  joyEl.addEventListener("pointercancel", joyLepas);

  /* ---------- Tombol naik/turun drone (tahan) ---------- */
  export function ikatTahan(el, set) {
    el.addEventListener("pointerdown", (e) => { e.preventDefault(); set(true); });
    ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => el.addEventListener(ev, () => set(false)));
  }
  ikatTahan($("#tombol-naik"), (v) => { tahanNaik = v; });
  ikatTahan($("#tombol-turun"), (v) => { tahanTurun = v; });


  /* Setter lintas-modul (migrasi Next.js): putarOtomatis & petunjukDitutup
     dinyatakan di modul ini; UI mengubahnya lewat fungsi ini. */
  export function setPutarOtomatis(v) { putarOtomatis = v; }
  export function setPetunjukDitutup(v) { petunjukDitutup = v; }
  /* Putar orbit otomatis (dipanggil loop animasi di main.js; theta &
     keadaan interaksinya milik modul ini). */
  export function putarOrbitBilaOtomatis() {
    if (putarOtomatis && performance.now() - interaksiTerakhir > 2500 && penunjuk.size === 0) theta += 0.00045;
  }
