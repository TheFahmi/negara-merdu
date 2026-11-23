/* Negara Merdu — modul game "jaringan" (pecahan app.js monolit, migrasi Next.js 22 Nov 2026).
   Jaringan: multiplayer WebSocket dan chat Istana Negara. */
import { $ } from "./inti.js";
import { scene } from "./bersama.js";
import { SUMBER_BERSAMA, animasiHidup, animasiJalan, buatKarakter, buatLabel } from "./karakter.js";
import { diInterior, interiorKonteks } from "./rumah.js";
import { dr, fp, modeKamera, target, tp } from "./kamera.js";
import { sesi } from "./ui.js";

  /* ================= MULTIPLAYER + CHAT BALAI DESA =================
     WebSocket ke /ws (token sesi di query). Warga login tampil sebagai
     karakter di klien lain; posisinya dikirim dari mode 1st Person
     (throttle 120 ms, hanya saat berubah) dan digerakkan dengan interpolasi.
     Maksimal 50 pemain terdekat yang di-render supaya HP tetap ringan.
     Tamu (tanpa token) hanya menonton: tidak tampil, tidak bisa chat. */
  export const PEMAIN_MAKS_RENDER = 50;
  export const pemainOnline = new Map();   // username -> {baju,kulit,topi, x,z,yaw, tx,tz,tyaw, grup, gelembung, gelembungSampai}
  export const pemainDirender = new Set(); // username yang grup karakternya sedang tampil
  export const grupPemain = new THREE.Group(); scene.add(grupPemain);
  export let ws = null, wsTimer = null, detakTimer = null;
  /* Reconnect chat: backoff bertingkat 1s -> 2s -> 5s -> 10s (mentok),
     di-reset tiap berhasil tersambung. Pesan yang dikirim saat terputus
     masuk antrean (maks 5) dan dikirim otomatis sesudah tersambung —
     tidak hilang diam-diam. */
  export const LANGKAH_BACKOFF = [1000, 2000, 5000, 10000];
  export let langkahBackoff = 0, wsJagaTimer = null;
  export const antreChat = [];
  export const ANTRE_CHAT_MAKS = 5;
  export let posTerakhir = { x: null, z: null, yaw: null }, posKirimTerakhir = 0;
  export let renderSegarTerakhir = 0;
  export let chatBelumDibaca = 0, catatanTimer = null;

  export function buangGrup(grup) {
    grup.traverse((o) => {
      // Geometri/material karakter dipakai BERSAMA antar semua karakter
      // (cache di buatKarakter) — jangan dibuang saat satu karakter
      // dihapus; label & gelembung tetap milik sendiri dan dibuang.
      if (o.geometry && !SUMBER_BERSAMA.has(o.geometry)) o.geometry.dispose();
      if (o.material && !SUMBER_BERSAMA.has(o.material)) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
  }
  export function buatGelembung(teks) {
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 224;
    const c = cv.getContext("2d");
    const kata = String(teks).split(/\s+/); const baris = []; let b = "";
    for (const k of kata) {
      if ((b + " " + k).trim().length > 18 && b) { baris.push(b); b = k; } else b = (b + " " + k).trim();
      if (baris.length === 3) break;
    }
    if (b && baris.length < 3) baris.push(b);
    if (baris.length === 3 && kata.join(" ").length > baris.join(" ").length) baris[2] = baris[2].replace(/…?$/, "…");
    c.fillStyle = "rgba(255,251,240,0.96)";
    c.beginPath();
    if (c.roundRect) c.roundRect(36, 14, 440, 158, 34); else c.rect(36, 14, 440, 158);
    c.fill();
    c.beginPath(); c.moveTo(226, 170); c.lineTo(286, 170); c.lineTo(256, 208); c.closePath(); c.fill();
    c.fillStyle = "#21332a"; c.font = "bold 41px system-ui, sans-serif";
    c.textAlign = "center"; c.textBaseline = "middle";
    baris.forEach((s, i) => c.fillText(s, 256, 93 + (i - (baris.length - 1) / 2) * 48, 420));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    sp.scale.set(6.4, 2.8, 1);
    return sp;
  }
  export function tambahPemain(d) {
    if (!d || !d.u) return;
    if (sesi.saya && d.u === sesi.saya.username) return; // diri sendiri tidak di-render
    const lama = pemainOnline.get(d.u);
    if (lama) { lama.baju = d.baju; lama.kulit = d.kulit; lama.topi = d.topi; lama.rupa = d.rupa || null; lama.jabatan = d.jabatan || null; return; }
    pemainOnline.set(d.u, {
      baju: d.baju, kulit: d.kulit, topi: d.topi, rupa: d.rupa || null, jabatan: d.jabatan || null,
      x: d.x || 0, z: d.z || 0, yaw: d.yaw || 0,
      tx: d.x || 0, tz: d.z || 0, tyaw: d.yaw || 0,
      grup: null, gelembung: null, gelembungSampai: 0,
    });
  }
  export function hapusPemain(u) {
    const p = pemainOnline.get(u);
    if (!p) return;
    if (p.grup) { grupPemain.remove(p.grup); buangGrup(p.grup); }
    pemainOnline.delete(u); pemainDirender.delete(u);
  }
  export function titikAcuan() {
    if (modeKamera === "orang" || modeKamera === "ketiga") return { x: fp.x, z: fp.z };
    if (modeKamera === "drone") return { x: dr.x, z: dr.z };
    return { x: target.x, z: target.z };
  }
  export function segarkanRenderPemain() {
    const acuan = titikAcuan();
    const urut = [...pemainOnline.entries()]
      .map(([u, p]) => [u, p, Math.hypot(p.tx - acuan.x, p.tz - acuan.z)])
      .sort((a, b2) => a[2] - b2[2])
      .slice(0, PEMAIN_MAKS_RENDER);
    const harus = new Set(urut.map(([u]) => u));
    for (const u of [...pemainDirender]) {
      if (!harus.has(u)) {
        const p = pemainOnline.get(u);
        if (p && p.grup) { grupPemain.remove(p.grup); buangGrup(p.grup); p.grup = null; p.gelembung = null; }
        pemainDirender.delete(u);
      }
    }
    for (const [u, p] of urut) {
      if (!p.grup) {
        const g = buatKarakter({ baju: p.baju, kulit: p.kulit, topi: p.topi, rupa: p.rupa });
        g.scale.setScalar(1.35);
        const lb = buatLabel("@" + u, 4.2, p.jabatan || null); lb.position.y = 2.5; g.add(lb);
        g.position.set(p.x, 0.32, p.z);
        grupPemain.add(g); p.grup = g;
      }
      pemainDirender.add(u);
    }
  }
  export function perbaruiPemainLain(dt, t) {
    if (performance.now() - renderSegarTerakhir > 4000) {
      renderSegarTerakhir = performance.now();
      segarkanRenderPemain();
    }
    const k = 1 - Math.exp(-dt * 9);
    for (const p of pemainOnline.values()) {
      if (!p.grup) continue;
      /* Gerak pemain lain HALUS: dulu dikejar eksponensial ke posisi paket
         terakhir (cepat-lambat-cepat tiap 120 ms = tersendat). Kini sasaran
         diprediksi maju dengan kecepatan paket terakhir (maks 0,3 dtk) lalu
         dikejar lembut -> laju konstan. */
      const umur = p.tTerima ? Math.min(0.3, (performance.now() - p.tTerima) / 1000) : 0;
      const sx = p.tx + (p.vx || 0) * umur, sz = p.tz + (p.vz || 0) * umur;
      const dx = sx - p.x, dz = sz - p.z;
      const px0 = p.x, pz0 = p.z;
      p.x += dx * k; p.z += dz * k;
      let dy = p.tyaw - p.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      p.yaw += dy * k;
      // Ayunan kaki+lengan mengikuti jarak perpindahan interpolasi frame ini.
      const bob = animasiJalan(p.grup, Math.hypot(p.x - px0, p.z - pz0), dt);
      animasiHidup(p.grup, t, Math.hypot(p.x - px0, p.z - pz0) < 0.0005);
      p.grup.position.set(p.x, 0.32 + bob * 0.07, p.z);
      p.grup.rotation.y = p.yaw + Math.PI; // model menghadap kebalikan yaw kamera FPS
      if (p.gelembung && performance.now() > p.gelembungSampai) {
        p.grup.remove(p.gelembung); buangGrup(p.gelembung); p.gelembung = null;
      }
    }
  }
  export function tampilGelembung(u, teks) {
    const p = pemainOnline.get(u);
    if (!p || !p.grup) return;
    if (p.gelembung) { p.grup.remove(p.gelembung); buangGrup(p.gelembung); }
    const sp = buatGelembung(teks);
    sp.position.y = 4.1;
    p.grup.add(sp); p.gelembung = sp;
    p.gelembungSampai = performance.now() + 5000;
  }
  export function kirimPosisi(paksa) {
    if (!ws || ws.readyState !== 1 || !sesi.saya) return;
    const kini = performance.now();
    if (!paksa && kini - posKirimTerakhir < 120) return;
    /* Di dalam interior, posisi logis yang disiarkan adalah PINTU rumah yang
       dimasuki (interiorKonteks), BUKAN koordinat interior mentah di bawah
       kota: pemain lain melihat karakter ini berdiri di depan pintu selama
       ia berkunjung, dan gelembung chat tetap muncul di sana. Karena nilainya
       konstan selama di dalam, cek epsilon di bawah otomatis menghentikan
       pengiriman berulang. */
    const sx = diInterior ? interiorKonteks.pintuX : fp.x;
    const sz = diInterior ? interiorKonteks.pintuZ : fp.z;
    /* Di 3rd Person yang disiarkan adalah arah hadap KARAKTER (bukan yaw
       kamera yang bebas berputar): klien lain merender rotation.y = yaw + π,
       jadi kirim hadap + π supaya model terlihat menghadap arah jalannya. */
    const syaw = diInterior ? interiorKonteks.yawPintu
      : (modeKamera === "ketiga" ? tp.hadap + Math.PI : fp.yaw);
    if (!paksa && posTerakhir.x !== null &&
        Math.abs(sx - posTerakhir.x) < 0.05 && Math.abs(sz - posTerakhir.z) < 0.05 &&
        Math.abs(syaw - posTerakhir.yaw) < 0.01) return;
    posTerakhir = { x: sx, z: sz, yaw: syaw }; posKirimTerakhir = kini;
    try { ws.send(JSON.stringify({ jenis: "posisi", x: sx, z: sz, yaw: syaw })); } catch (e) {}
  }
  export function jadwalSambungUlang() { // backoff bertingkat, mentok 10 detik
    if (wsTimer) clearTimeout(wsTimer);
    const jeda = LANGKAH_BACKOFF[Math.min(langkahBackoff, LANGKAH_BACKOFF.length - 1)];
    langkahBackoff++;
    wsTimer = setTimeout(() => { wsTimer = null; sambungWS(); }, jeda);
  }
  export function kosongkanAntreChat() { // kirim pesan tertahan, berurutan, sekali saja
    while (antreChat.length && ws && ws.readyState === 1) {
      const isi = antreChat[0];
      try { ws.send(JSON.stringify({ jenis: "chat", isi })); antreChat.shift(); }
      catch (e) { break; } // gagal di tengah: sisa antrean menunggu reconnect berikut
    }
  }
  export function sambungWS() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    const url = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws" +
      (sesi.token ? "?token=" + encodeURIComponent(sesi.token) : "");
    let s;
    try { s = new WebSocket(url); } catch (e) { jadwalSambungUlang(); return; }
    ws = s;
    /* Pengawas CONNECTING: jabat tangan WS bisa menggantung tanpa pernah
       open/error/close (mis. upgrade tertahan proxy saat server restart —
       persis jendela deploy). Tanpa pengawas ini klien menunggu selamanya:
       penjaga sambungWS menolak percobaan baru selama readyState===0 dan
       tidak ada kejadian lain yang datang. Sesudah 8 detik masih
       CONNECTING -> tutup paksa, onclose menjadwalkan percobaan berikut. */
    clearTimeout(wsJagaTimer);
    wsJagaTimer = setTimeout(() => {
      if (ws === s && s.readyState === 0) { try { s.close(); } catch (e) {} }
    }, 8000);
    s.onopen = () => {
      if (ws !== s) return;
      clearTimeout(wsJagaTimer);
      langkahBackoff = 0; // tersambung: backoff mulai dari awal lagi
      kirimPosisi(true); // daftarkan posisi terakhir karakter ke server
      clearInterval(detakTimer);
      detakTimer = setInterval(() => {
        if (ws === s && s.readyState === 1) { try { s.send(JSON.stringify({ jenis: "detak" })); } catch (e) {} }
      }, 10000);
      kosongkanAntreChat();
      perbaruiStatusChat();
    };
    s.onmessage = (ev) => { if (ws === s) tanganiPesanWS(ev.data); };
    s.onclose = () => {
      if (ws !== s) return;
      ws = null; clearInterval(detakTimer); clearTimeout(wsJagaTimer);
      jadwalSambungUlang();
      perbaruiStatusChat();
    };
    s.onerror = () => { try { s.close(); } catch (e) {} };
  }
  export function sambungUlangWS() { // sesudah login/logout: buang koneksi lama, sambung dengan identitas baru
    if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; }
    clearTimeout(wsJagaTimer);
    langkahBackoff = 0;
    if (ws) { const s = ws; ws = null; s.onclose = null; try { s.close(); } catch (e) {} }
    sambungWS();
  }
  /* Tab kembali terlihat / jaringan kembali: jangan menunggu sisa
     backoff — coba sambung saat itu juga (timer HP dibekukan saat tab
     tidak aktif, jadi tanpa ini reconnect bisa terasa sangat lama). */
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!ws || ws.readyState >= 2) { langkahBackoff = 0; if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; } sambungWS(); }
  });
  addEventListener("online", () => {
    if (!ws || ws.readyState >= 2) { langkahBackoff = 0; if (wsTimer) { clearTimeout(wsTimer); wsTimer = null; } sambungWS(); }
  });
  export function tanganiPesanWS(data) {
    let m;
    try { m = JSON.parse(data); } catch (e) { return; }
    if (m.jenis === "sambutan") {
      for (const u of [...pemainOnline.keys()]) hapusPemain(u);
      (m.pemain || []).forEach(tambahPemain);
      segarkanRenderPemain();
      const log = $("#chat-log"); log.innerHTML = "";
      if (!(m.chat || []).length) log.innerHTML = '<div class="kosong">Belum ada obrolan. Mulai saja!</div>';
      (m.chat || []).forEach((c) => tambahBarisChat(c, false));
      perbaruiStatusChat();
    } else if (m.jenis === "masuk") {
      tambahPemain(m.pemain); segarkanRenderPemain();
    } else if (m.jenis === "keluar") {
      hapusPemain(m.u);
    } else if (m.jenis === "posisi") {
      let p = pemainOnline.get(m.u);
      if (!p) { tambahPemain({ u: m.u, baju: "#2e9e5b", kulit: "#f1c27d", topi: "tanpa", x: m.x, z: m.z, yaw: m.yaw }); p = pemainOnline.get(m.u); segarkanRenderPemain(); }
      if (p) { // simpan kecepatan antar paket untuk prediksi gerak (dead reckoning)
        const kini = performance.now(), dtp = p.tTerima ? Math.max(0.05, (kini - p.tTerima) / 1000) : 0;
        p.vx = dtp ? (m.x - p.tx) / dtp : 0; p.vz = dtp ? (m.z - p.tz) / dtp : 0;
        if (Math.hypot(p.vx, p.vz) > 80) { p.vx = 0; p.vz = 0; } // teleport (masuk rumah dll.) — jangan diprediksi
        p.tx = m.x; p.tz = m.z; p.tyaw = m.yaw; p.tTerima = kini;
      }
    } else if (m.jenis === "chat") {
      tambahBarisChat(m, true);
      tampilGelembung(m.u, m.isi);
    } else if (m.jenis === "galat") {
      tampilCatatanChat(m.pesan || "Pesan tidak terkirim.");
    }
  }

  /* ---------- UI chat ---------- */
  export function tambahBarisChat(m, hitungBadge) {
    const log = $("#chat-log");
    const kosong = log.querySelector(".kosong"); if (kosong) kosong.remove();
    const div = document.createElement("div");
    // Pesan sistem (sambutan Pak Presiden) tampil beda: tanpa awalan "@",
    // dengan gaya kartu pengumuman desa (kelas .sistem).
    div.className = "pesan" + (m.sistem ? " sistem" : "");
    const u = document.createElement("span"); u.className = "u";
    u.textContent = m.sistem ? m.u : "@" + m.u;
    const jam = document.createElement("span"); jam.className = "jam"; jam.textContent = m.jam || "";
    div.append(u, document.createTextNode(" " + m.isi), jam); // textContent: aman dari XSS
    log.appendChild(div);
    while (log.children.length > 120) log.removeChild(log.firstChild);
    if (!$("#panel-chat").hidden) log.scrollTop = log.scrollHeight;
    else if (hitungBadge) {
      chatBelumDibaca++;
      const l = $("#lencana-chat"); l.hidden = false; l.textContent = chatBelumDibaca > 99 ? "99+" : chatBelumDibaca;
    }
  }
  export function tampilCatatanChat(teks) {
    const el = $("#chat-catatan");
    el.textContent = teks;
    clearTimeout(catatanTimer);
    catatanTimer = setTimeout(perbaruiStatusChat, 3500);
  }
  export function perbaruiStatusChat() {
    const inp = $("#isi-chat"), btn = $("#kirim-chat"), cat = $("#chat-catatan");
    if (!inp) return;
    if (sesi.saya) {
      inp.disabled = false; btn.disabled = false;
      inp.placeholder = "Tulis pesan…";
      if (ws && ws.readyState === 1) {
        cat.textContent = "Chat sebagai @" + sesi.saya.username + " · maks 200 karakter";
      } else {
        // teks kecil di panel, menetap selama terputus — bukan banner
        cat.textContent = antreChat.length
          ? "Menyambung ulang ke negara… " + antreChat.length + " pesanmu menunggu terkirim."
          : "Menyambung ulang ke negara…";
      }
    } else {
      inp.disabled = true; btn.disabled = true;
      inp.placeholder = "Masuk dulu untuk ikut chat";
      cat.textContent = "Kamu sedang menonton sebagai tamu. Masuk pakai Kartu Warga Negara untuk tampil di negara dan ikut chat.";
    }
  }
  $("#tombol-chat").addEventListener("click", () => {
    const p = $("#panel-chat");
    p.hidden = !p.hidden;
    if (!p.hidden) {
      $("#panel-menu").hidden = true;
      chatBelumDibaca = 0; $("#lencana-chat").hidden = true;
      const log = $("#chat-log"); log.scrollTop = log.scrollHeight;
      perbaruiStatusChat();
    }
  });
  $("#tombol-tutup-chat").addEventListener("click", () => { $("#panel-chat").hidden = true; });
  $("#form-chat").addEventListener("submit", (e) => {
    e.preventDefault();
    const inp = $("#isi-chat");
    const isi = inp.value.trim();
    if (!isi) return;
    if (!sesi.saya) { tampilCatatanChat("Masuk dulu pakai Kartu Warga Negara untuk ikut chat."); return; }
    if (ws && ws.readyState === 1) {
      try { ws.send(JSON.stringify({ jenis: "chat", isi })); inp.value = ""; return; }
      catch (err) { /* send gagal di soket yang mengaku OPEN: antrekan di bawah */ }
    }
    /* Terputus: pesan TIDAK dibuang — masuk antrean dan dikirim otomatis
       sesudah reconnect (kosongkanAntreChat di onopen). Yang diantrekan
       hanya pesan yang tidak pernah sampai ke soket OPEN, jadi tidak
       ada kiriman ganda. */
    if (antreChat.length >= ANTRE_CHAT_MAKS) {
      tampilCatatanChat("Koneksi terputus dan antrean pesan penuh — tunggu tersambung dulu ya.");
      return;
    }
    antreChat.push(isi); inp.value = "";
    tampilCatatanChat("Koneksi terputus — pesanmu disimpan dan akan terkirim otomatis saat tersambung lagi.");
  });

