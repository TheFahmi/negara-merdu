# DEPLOY REPORT — Desa Pinarak → https://pinarak.mfah.me

Tanggal: 20 Nov 2026 (WIB) · Status: **KODE SELESAI & TERVERIFIKASI LOKAL — DEPLOY KE X99 TERHALANG X99 DOWN**

## Blocker (bukti, bukan klaim)

X99 localserver (100.75.143.43) mati total selama sesi ini:
- SSH via jalur resmi `x99.py` (sandbox → Oracle → X99) timeout berulang: ±16:00, 16:05, 16:09, 16:11, 16:13 WIB — semua `Connection timed out`.
- Dari Oracle langsung: ping 100.75.143.43 = 100% packet loss, port 22 tidak terjangkau.
- Seluruh layanan X99 ikut mati: `fibo.mfah.me` = 530, `gap.mfah.me` = 530 (Cloudflare Tunnel merdu-lb tidak punya origin hidup). Gangguan sudah berjalan sejak ±15:02 WIB (konteks sesi induk: timeout SSH X99 menghentikan CCTV/trader).
- `pinarak.mfah.me` juga 530 saat ini — murni karena origin X99 mati, bukan karena DNS/app.

**Langkah resume begitu X99 hidup (1 perintah, ±2–3 menit):**
```
python3 ~/workspace/pinarak/deploy/sync_and_deploy.py
```
Skrip itu: cek X99 → kirim source (tar.gz base64, md5 dicocokkan) → unduh three.min.js r128 dari cdnjs di X99 (md5 `eb8549863a97355411c3259a3f93b8e1` dicocokkan) → jalankan `deploy/deploy_x99.sh` (systemd `pinarak` port 8026 enable+restart, Traefik dynamic `pinarak-desk.yaml`, vhost nginx, aturan firewall 8026 dari 172.19.0.0/16 + netfilter-persistent).
Sesudah itu verifikasi wajib (belum bisa dijalankan): curl https://pinarak.mfah.me/ = 200 judul Desa Pinarak; daftar @warga.test1 via API → statistik 1 → login PIN benar/salah → HAPUS warga test dari DB X99 → statistik kembali 0; `systemctl is-active/is-enabled pinarak`.

## Yang SUDAH selesai

- **DNS**: CNAME `pinarak.mfah.me` → `19eedf11-5822-45cd-8b78-6c5f51ff4f18.cfargotunnel.com`, proxied=true — TERBUAT dari Oracle (sudo, kredensial /etc/letsencrypt/cloudflare.ini, nilai tidak dicatat), record id `c3f62bb49743afa819948f525cbb9735`. Target sama persis dengan fibo/gap/kantor.
- **Seluruh kode** di `~/workspace/pinarak/` (server.py, public/, deploy/) — selesai, syntax-checked, teruji lokal penuh (di bawah).
- **DB produksi**: belum ada & tidak disentuh — tidak ada seed palsu; load test memakai DB sementara yang sudah dibersihkan.

## Arsitektur v2 (spek revisi: kota persegi grid, target 100.000 warga)

- **Backend**: Python 3 stdlib (`http.server` ThreadingHTTPServer) + SQLite (WAL). Tanpa dependensi. PIN = PBKDF2-HMAC-SHA256 120rb iterasi + salt per warga (terbukti di DB lokal: hash, bukan plaintext). Service systemd `pinarak`, port **8026**, `DATA_DIR=/root/builds/pinarak/data`, Restart=always (file unit siap di `deploy/pinarak.service`).
- **Grid kota**: 80 kolom × 50 baris blok = 4.000 blok × 25 kavling (5×5) = **100.000 kavling**. Alokasi berurutan dari nomor urut warga → (blok, kavling) disimpan di DB (`alokasi()` di server.py; terverifikasi: warga #19901 → Blok 797 Kavling 1).
- **Indeks & pagination**: `username` UNIQUE, `nomor_rumah` UNIQUE + indeks eksplisit. `GET /api/warga?limit=&offset=&urut=terlama|terbaru` (limit maks 500) + `total`. Statistik dari `COUNT(*)`.
- **Rendering skala**: tanah = 1 plane bertekstur canvas grid (ubin 1 blok di-repeat 80×50). Rumah massal = **InstancedMesh**: 98.300 kavling (di luar 8 blok pusat + 60 blok taman) digambar dengan 2 draw call (dinding + atap kerucut-4), warna per-instance; kavling terisi memakai warna baju pemilik (peta warna dimuat paginasi, maks 2.000 pertama) atau paleta cerah, kavling kosong paleta pudar. Pohon taman juga instanced (1.500). Detail penuh hanya di **Distrik Pusat**: balai desa + Pak Kades (peci hitam, batik coklat), papan raksasa (WARGA nyata + KAVLING n/100.000, CanvasTexture), tugu, dan maks 30 rumah warga **terbaru** sebagai mesh unik yang bisa diklik (info pemilik + Blok/Kavling) + maks 30 NPC berjalan berlabel @username. Kamera orbit custom (seret/cubit/scroll, auto-putar), radius s/d 1.600 unit, bayangan directional mengikuti target kamera.
- **Alur warga** (meniru konsep referensi, kode sendiri): username IG → follow @desapinarak (link instagram.com/desapinarak) → PIN 6 angka (2×) → atur rupa (warna baju/kulit, peci/topi/tanpa) → Kartu Warga (No. rumah + Blok/Kavling) → sesi token di localStorage; login kembali username+PIN; tombol Kartu Saya mengarahkan kamera ke kavling pemilik.
- **PWA**: manifest + ikon 192/512/180 dari foto profil Pak Kades yang sudah dibuat sesi induk.
- **Routing (mengikuti pola fibo yang terbukti)**: Cloudflare CNAME → Tunnel merdu-lb (wildcard *.mfah.me) → Traefik Coolify → `pinarak-desk.yaml` → `http://172.17.0.1:8026` → service. Host nginx X99 mati sejak 30 Okt (di luar cakupan); vhost nginx tetap disiapkan seperti fibo.

## Mode kamera (ditambahkan 20 Nov 2026, permintaan Fahmi: "mode 1st person dan drone")

Tiga mode, dipilih lewat tombol segmented di HUD bawah: **🔄 Orbit** (default, perilaku lama tidak berubah) · **🚶 1st Person** · **🚁 Drone**. Implementasi murni di `public/app.js` + elemen HUD di `public/index.html`/`style.css`; backend tidak berubah. Kamera memakai rotasi Euler `YXZ` (yaw/pitch ala FPS), pergerakan dihitung per-frame dengan delta-time.

- **1st Person**: kamera setinggi mata **1,6 satuan**, posisi di tanah. Titik mulai: kalau user login → di jalan tepat di depan kavling rumahnya sendiri, menghadap rumahnya; kalau belum login → di plaza menghadap balai desa & Pak Kades; kalau pindah dari mode Drone → turun tepat di bawah posisi drone. Tombol "Kartu Saya" saat mode ini aktif memindahkan pemain langsung ke depan rumahnya. Kontrol desktop: **WASD / panah** jalan, **seret mouse** melihat sekeliling, **Shift** lari (30 vs 14 satuan/dtk), scroll = melangkah maju/mundur. HP: **joystick virtual** kiri-bawah + seret layar untuk melihat sekeliling. **Tabrakan sederhana (pilihan v1)**: lingkaran pemain r=0,55 vs AABB objek Distrik Pusat saja — balai desa, tugu, papan raksasa, dan 30 rumah detail (didorong keluar lewat sisi terdekat). Rumah instanced massal (98.300 kavling) sengaja TIDAK bertabrakan supaya warga bebas berdiri/jalan di kavlingnya sendiri; posisi selalu di-clamp di dalam batas kota.
- **Drone**: kamera terbang bebas, transisi mulus dari posisi & arah pandang kamera sebelumnya. Maju mengikuti arah pandang penuh (termasuk menunduk/mendongak). Kontrol desktop: **WASD / panah** terbang (60 satuan/dtk, **Shift** 170), **R/F atau Q/E** naik/turun, **seret mouse** arah pandang, scroll = maju/mundur mengikuti arah pandang. HP: joystick untuk terbang datar, tombol tahan **⬆/⬇** kanan-bawah untuk naik/turun, **cubit** mengubah ketinggian. Batas: ketinggian 3–600 satuan, area kota + margin 250 satuan.
- **Kembali ke Orbit**: target orbit dipindah ke posisi darat terakhir (posisi jalan kaki / titik di bawah drone), radius 170 — jadi eksplorasi tidak "hilang" saat ganti mode.
- Bayangan matahari mengikuti posisi kamera di kedua mode baru supaya area sekitar pemain tetap berbayang. Teks `#petunjuk` berganti sesuai mode. Ketuk rumah detail untuk info pemilik tetap berfungsi di semua mode.
- **Keterbatasan v1**: tidak ada gravitasi/lompat; tabrakan hanya Distrik Pusat (lihat di atas); NPC & Pak Kades tidak bertabrakan (bisa dilewati); belum ada mode foto/screenshot bawaan.

Verifikasi mode (lokal, DB sementara di /tmp, sudah dihapus): server uji port 18026 → `GET /` **200** judul "Desa Pinarak" dan HTML memuat `#mode-bar` + joystick + tombol drone; `GET /app.js` 200 dan memuat kode mode baru; `node --check app.js` OK; regresi API: daftar `warga.test1` → **201** Rumah No. 1 Blok 1 Kavling 1, login PIN salah → **401**, login PIN benar → **200**, statistik 0 → 1. Render 3D tetap tidak bisa di-screenshot dari sandbox (tidak ada headless browser) — verifikasi visual mode baru menunggu deploy + sesi browser induk, sama seperti catatan sebelumnya.

## UI Mobile dirapikan (20 Nov 2026, keluhan Fahmi: "UI di mobile penuh")

Mobile-first: saat halaman dibuka di HP, yang dominan adalah desa 3D-nya. Perubahan di `public/index.html`, `public/style.css`, `public/app.js` (backend tidak berubah):

- **HUD atas dirampingkan**: kartu info kini hanya judul kecil + 2 chip ringkas ("👥 n warga", "🏠 n / 100.000"); di layar ≤560px handle @desapinarak disembunyikan dan kartu dibatasi 56vw. Di kanan atas hanya tersisa tombol **☰ (44×44px)** dan 1 tombol utama **"Masuk / Daftar"** (saat login berubah jadi "Kartu Saya").
- **Yang tadinya permanen kini di balik panel menu (tombol ☰, panel geser dari kanan atas)**: tombol **Putar otomatis** (dulu tombol "🔄 Putar" permanen di kanan atas; sekarang di dalam panel dengan label Nyala/Mati), **statistik detail** (warga terdaftar, kavling terisi, kapasitas 100.000, ukuran kota — dulu sebagian tampil sebagai chip permanen), **petunjuk lengkap cara main semua mode** (dulu 1 baris panjang permanen di bawah), dan tautan Instagram @desapinarak.
- **Bar bawah ramping** (`#bar-bawah`, 1 kolom lengket): petunjuk per mode dipersingkat jadi **1 baris pendek** per mode (mis. Orbit: "Seret untuk memutar · Cubit/scroll untuk zoom") dengan tombol **✕** untuk menutupnya (muncul lagi otomatis saat ganti mode), di bawahnya pemilih mode Orbit/1st Person/Drone (tombol min. 44px tinggi).
- **Joystick & tombol naik/turun drone** tetap hanya muncul di mode yang membutuhkan (1st Person / Drone) dan dinaikkan ke `bottom: 122px + safe-area-inset` supaya tidak menutupi bar bawah; semua elemen HUD memakai `env(safe-area-inset-*)`. Kartu info rumah juga digeser ke atas bar bawah.
- Desktop (layar lebar) tidak berubah perilaku: info lebih lapang, panel menu tetap opsional lewat tombol ☰.

Verifikasi UI (lokal, server uji port 18027, DB sementara /tmp, sudah dihapus): `GET /` 200 judul "Desa Pinarak" dan HTML memuat `#panel-menu`, `#bar-bawah`, `#tombol-menu`, `#tutup-petunjuk` (masing-masing tepat 1×); `GET /app.js` & `/style.css` 200; `node --check app.js` OK; CSS memuat media query `max-width: 560px` + 10 pemakaian safe-area-inset + `min-height: 44px` pada tombol. Regresi API: daftar `warga.test1` → 201 (Rumah No. 1 Blok 1 Kavling 1), login PIN salah → 401, PIN benar → 200, statistik 0 → 1, pagination OK. Verifikasi visual pixel tetap menunggu deploy + browser induk (sandbox tanpa headless browser).

## Skala dunia diperbesar (20 Nov 2026, permintaan Fahmi: "Desa belum luas")

Keluhan: kota terasa kecil walau kapasitasnya 100.000 kavling. Satuan grid diperbesar (jumlah blok/kavling TIDAK berubah, kapasitas logis tetap 100.000):

| Ukuran | Sebelum | Sesudah |
|---|---|---|
| Pitch blok (PITCH) | 52 | **84** |
| Lebar jalan (JALAN) | 7 | **14** |
| Pitch kavling (KAV_PITCH) | 9 | **14** |
| Dimensi kota | 4.160 × 2.600 satuan | **6.720 × 4.200 satuan** |
| Luas kota | ±10,8 juta satuan² | **±28,2 juta satuan² (2,6× lipat)** |
| Rumah instanced | dinding 5,4×3×4,8, atap r=4,1 | dinding **8,6×4,2×7,6**, atap r=**6,6** |
| Rumah detail Distrik Pusat | skala 1 | skala **1,55** |

- **Cara luasnya dibuat terasa**: (1) blok, jalan, dan kavling semuanya membesar proporsional, jadi perjalanan 1st Person/Drone antarblok benar-benar jauh — kecepatan ikut disesuaikan (jalan kaki 14→22, lari 30→48, drone 60→110 / Shift 170→300 satuan/dtk; scroll step diperbesar; zoom orbit maks 1.600→2.800; ketinggian drone maks 600→1.000; kabut 700–2.600 → 900–5.600, kamera far 7.000→14.000). (2) **Distrik pinggiran** baru di tepi grid persegi sebagai penanda luas: **sawah** petak-petak (tekstur kanvas 1 gambar, diulang di 4 sisi kota, band 540 satuan), **2 danau besar** (r=300 & r=215, di luar band sawah, lengkap dengan cincin pasir), **hutan** sabuk utara & selatan (1.100 pohon, pohonnya lebih besar dari pohon taman), dan hamparan tanah luas di bawah semuanya.
- **Performa dijaga**: pinggiran hanya menambah ±8 mesh plane/circle + 2 InstancedMesh hutan (batang+daun, 1.100 instance) — tidak ada mesh unik massal baru; rumah massal tetap 2 draw call InstancedMesh seperti sebelumnya.

Verifikasi skala (lokal, bareng uji UI di atas): `node --check app.js` OK, server uji 200, regresi API lolos; konstanta baru terkonfirmasi di source (`PITCH = 84, JALAN = 14, KAV_PITCH = 14`, fungsi `pinggiranKota()` ada). Posisi kavling warga dihitung dari konstanta yang sama di klien, dan alokasi (blok/kavling) di server tidak terpengaruh (murni urutan logis).

## Audit z-fighting tanah (20 Nov 2026, preventif — meniru temuan di contoh diorama)

Di contoh diorama, glitch belang hijau di tanah terbukti **z-fighting**: dua lapisan tanah permukaan atasnya sama tinggi dan tumpang tindih penuh. Source Pinarak diaudit dengan pola yang sama — **ditemukan** beberapa pasangan rawan dan sudah diperbaiki di `public/app.js` (backend tidak berubah). Ambang yang dipakai: pada skala dunia Pinarak (satuan besar, rumah selebar 8,6), selisih tinggi < ±0,3 antarpermukaan yang tumpang tindih dianggap rawan — bukan 0,05 mentah — karena presisi depth buffer memburuk kuadratik terhadap jarak pandang (kamera bisa melihat dari ribuan satuan), jadi selisih yang aman di jarak dekat belum tentu aman dari Drone/Orbit jauh.

**Inventaris lapisan datar (semua permukaan horizontal di app.js):**

| Lapisan | Geometri | y sebelum | y sesudah | Tumpang tindih dengan |
|---|---|---|---|---|
| Plane tanah kota (tekstur grid; jalan/kavling digambar di tekstur, BUKAN geometri terpisah) | Plane 6.720×4.200 | 0 | 0 (tetap, lapisan acuan) | Hamparan (penuh), plaza (di bawahnya) |
| Hamparan tanah pinggiran | Plane 9.920×7.400 | **−0,12** | **−0,30** + `polygonOffset` factor/units 2 | Tanah kota (penuh), sawah, danau besar |
| Sawah 4 sisi (band 540) | 4 Plane | 0,03 | 0,03 (selisih vs hamparan kini 0,33) | Hamparan (penuh di area band) |
| Danau besar — air | Circle r=300 & r=215 | 0,06 | **0,10** | Hamparan; berbatasan tepi dengan cincin pasir |
| Danau besar — cincin pasir | Ring r..r+26 | 0,05 | **0,04** | Hamparan; berbatasan tepi dengan air (tidak tumpang tindih area) |
| Alas blok taman | Box instanced 68×0,25×68, pusat y=0,12 → permukaan 0,245 | 0,245 | 0,245 (tetap) | Plane tanah (kotak menembus plane, bukan koplanar) |
| Danau taman (di atas alas taman) | Circle r=24 | **0,30** (selisih cuma 0,055) | **0,52** (selisih 0,275) | Alas taman (penuh di area danau) |
| Plaza pusat | Box 208×0,3×104, pusat y=0,15 → wajah bawah **persis 0 (koplanar!)**, puncak 0,30 | 0,15 | **0,17** (bawah 0,02, puncak 0,32) | Plane tanah (wajah bawah) |
| Alas/dinding kotak lain (alas kota, dinding rumah instanced & detail, dasar balai) | Box, wajah bawah di 0 / −0,4 | — | tidak diubah | Hanya *kontak* wajah bawah yang tersembunyi di atas plane — bukan dua permukaan atas yang bersaing, kategori aman |

**Perbaikan yang diterapkan:**
1. **Hamparan diturunkan jadi step** −0,12 → **−0,30** di bawah plane kota + `polygonOffset` (factor 2, units 2) pada materialnya. Konsekuensi ikut disesuaikan: pohon hutan pinggiran diturunkan 0,3 supaya kakinya tetap menapak di hamparan (dulu menapak di 0 sambil hamparan di −0,12).
2. **Danau taman diangkat** 0,30 → **0,52** (selisih terhadap alas taman 0,055 → 0,275).
3. **Danau besar dipisah**: air 0,06 → **0,10**, cincin pasir 0,05 → **0,04** (keduanya kini ≥0,34 di atas hamparan baru).
4. **Plaza digeser** pusat 0,15 → **0,17**: wajah bawahnya tidak lagi koplanar dengan plane tanah. Objek di atas plaza (Pak Kades, NPC, rumah detail, tugu, pohon plaza) kini menapak 0,02 di dalam puncak plaza baru (0,32) — tidak terlihat secara visual.
5. **near/far kamera diperketat per mode** (di `aturMode()`, kamera dibuat dengan nilai Orbit): sebelumnya tetap **0,5 / 14.000** (rasio 28.000) untuk semua mode → kini **Orbit 2 / 13.000** (rasio 6.500), **Drone 1,5 / 13.000** (8.667), **1st Person 0,3 / 9.000** (near kecil memang dibutuhkan untuk objek dekat; far 9.000 tetap melewati ujung kabut 5.600 dan sudut terjauh kota ±7.900 dari posisi pemain di dalam kota). Far 13.000 dihitung dari posisi ekstrem Drone (sudut kota + margin, tinggi 1.000) ke sudut hamparan terjauh (±10.850) — tidak ada geometri terpotong.

Verifikasi audit (lokal, server uji port 18028, DB sementara /tmp — sudah dimatikan & dihapus, `data/` produksi terkonfirmasi tetap kosong): `node --check app.js` OK; `py_compile server.py` OK; `GET /` 200 judul "Desa Pinarak"; `GET /app.js` 200; regresi API: statistik 0 → daftar `warga.test1` **201** (Rumah No. 1 Blok 1 Kavling 1 + token) → login PIN salah **401** → login PIN benar **200** → statistik 1 → pagination OK. Verifikasi visual pixel (apakah flicker benar-benar hilang di HP) tetap menunggu deploy + browser induk, sama seperti catatan sebelumnya — yang terverifikasi di sini adalah geometri sumbernya: tidak ada lagi pasangan permukaan atas koplanar / berselisih < 0,27 yang tumpang tindih.

## Multiplayer + Chat Balai Desa (20 Nov 2026, permintaan Fahmi: "bisa multiplayer dan bisa chat")

**Arsitektur real-time** — WebSocket **RFC 6455 diimplementasikan dengan stdlib murni** di `server.py` (handshake SHA-1+base64, frame masking/parsing manual, ping/pong, fragmentasi), TANPA dependensi baru. `ThreadingHTTPServer` memberi 1 thread per koneksi; koneksi `GET /ws` mengambil alih soketnya di thread handler itu. Token sesi dikirim sebagai query `?token=` (WebSocket browser tidak bisa memasang header); tanpa token valid = **tamu penonton**. Pelajaran penting yang terbukti saat pengujian: frame dibaca dengan `recv()` langsung, BUKAN `makefile()` — file object soket CPython rusak permanen sesudah sekali timeout (`OSError: cannot read from timed out object`) dan itu sempat memutuskan koneksi diam-diam setiap ±2 detik.

**Presence & gerak:**
- Warga login yang membuka desa tampil sebagai karakter (rupa dari datanya: warna baju/kulit/topi + label sprite `@username`) di klien lain. Spawn awal di plaza (8, 22); klien mengirim posisi terkininya sekali saat tersambung.
- Di mode **1st Person** posisi + yaw dikirim tiap berubah (throttle 120 ms, epsilon gerak 0,05/yaw 0,01); di Orbit/Drone karakter diam di posisi terakhirnya (penonton tidak menggerakkan karakter). Klien lain menggerakkan karakter itu dengan **interpolasi eksponensial + ayunan lengan/bob** ala NPC.
- **Render dibatasi 50 pemain terdekat** dari titik acuan kamera (posisi FP / drone / target orbit), dievaluasi ulang tiap 4 detik; sisanya tetap terlacak datanya tapi tidak di-render.
- Disconnect → server menyiarkan `keluar`; koneksi tanpa aktivitas/detak >30 detik diputus server (klien mengirim `detak` tiap 10 detik, server juga ping WS tiap 20 detik) → karakter hilang dari klien lain dalam hitungan detik.
- NPC plaza yang username-nya sedang online disembunyikan (orangnya tampil sebagai pemain, bukan dobel).
- Posisi divalidasi server: harus numerik, di-clamp ke batas kota + margin drone (|x| ≤ 3.860, |z| ≤ 2.600).

**Chat "Balai Desa":**
- Tabel baru `chat(id, warga_id, username, isi, created_at)` — migrasi aman `CREATE TABLE IF NOT EXISTS` di `init_db`, DB lama tidak berubah. created_at ditulis waktu lokal server supaya jam tampil (`HH:MM`) konsisten antara pesan live dan riwayat.
- UI: tombol **💬** (44px, ada lencana jumlah belum dibaca) di kanan atas membuka **panel geser** — tidak permanen memenuhi layar (pola sama seperti panel menu). Isi panel: log chat, catatan status, form kirim. Tamu: input nonaktif + penjelasan harus masuk dulu.
- Server mengambil username dari sesi (tidak percaya klaim klien); pesan disiarkan ke semua termasuk pengirim (echo untuk panel + gelembung). Pesan juga tampil sebagai **gelembung chat sprite ±5 detik di atas kepala karakter pengirim** di desa.
- Riwayat **50 pesan terakhir** dikirim dalam pesan `sambutan` saat klien tersambung.
- Pengaman: isi dibersihkan dari karakter kontrol, **maks 200 karakter** (lebih → ditolak dengan pesan galat), **rate limit 1 pesan / 1,5 detik per warga**, klien merender semua teks chat dengan `textContent` (anti-XSS).

**Protokol WS (JSON, field `jenis`):**
- Server → klien: `sambutan` {kamu, pemain[], chat[]} · `masuk` {pemain} · `keluar` {u} · `posisi` {u, x, z, yaw} · `chat` {u, isi, jam} · `galat` {pesan}
- Klien → server: `posisi` {x, z, yaw} · `chat` {isi} · `detak` {}

**Batas v1:** tidak ada chat privat/kanal per distrik; tidak ada moderasi kata; riwayat hanya 50 terakhir (belum ada pagination riwayat); satu username bisa online dari beberapa tab (dihitung 1 pemain, posisi dari tab terakhir yang bergerak); gelembung chat hanya tampil bila karakter pengirim sedang ter-render (≤50 terdekat); proxy publik (Traefik/Cloudflare) meneruskan upgrade WebSocket secara bawaan, tapi verifikasi WS lewat jalur publik tetap menunggu deploy.

**Verifikasi dua klien** (server uji port 18029, DATA_DIR sementara /tmp — sudah dimatikan & dihapus; klien uji WS stdlib murni di `/tmp/pinarak_ws_test/ws_test.py`, DB produksi `data/` terkonfirmasi tetap kosong). SEMUA LOLOS:
1. Regresi HTTP: daftar 2 warga → 201 (test1 Rumah No. 1 Blok 1 Kavling 1), duplikat → 409, login PIN salah → 401, statistik warga=2, pagination total=2.
2. Tamu tersambung: `sambutan` kamu=None, pemain & chat kosong. B (token) masuk → sambutan berisi dirinya; tamu menerima broadcast `masuk`. A masuk → sambutan A berisi 2 pemain; B & tamu menerima `masuk` A.
3. A kirim posisi (100, 50, yaw 1.2) → B menerima persis. A kirim (999999, −999999) → B menerima hasil clamp (3860, −2600). Posisi dari tamu → diabaikan server (B tidak menerima apa pun).
4. Chat tamu → ditolak (`galat` ke tamu, tidak disiarkan). Chat A "Halo dari A" → diterima B (username dari sesi + jam), A (echo), dan tamu. Chat 250 karakter → ditolak "Pesan maksimal 200 karakter", tidak disiarkan. Chat B kedua <1,5 detik → ditolak rate limit, tidak disiarkan.
5. Tamu baru tersambung → `sambutan.chat` berisi riwayat 2 pesan yang sah. B disconnect → A menerima `keluar` warga.test2.
6. `node --check app.js` OK; `py_compile server.py` OK.

## Interior rumah (20 Nov 2026, permintaan Fahmi: "rumah ada interior")

Fitur murni di klien (`public/app.js`, `index.html`, `style.css`) — **server.py tidak diubah sama sekali**; tidak ada endpoint/protokol baru.

**Cara masuk/keluar:**
- **Rumah detail Distrik Pusat** (30 warga terbaru): tiap rumah kini punya titik *doorstep* (6,4 satuan di depan wajah rumah, di jalan, di luar AABB tabrakannya). Di mode **1st Person**, berdiri ≤3,4 satuan dari doorstep → muncul **chip aksi kecil** di atas bar bawah ("🚪 Rumah @user" + tombol **Masuk Rumah**); ketuk rumah dari jarak ≤14 satuan dari doorstep juga langsung masuk. Dari mode lain, klik rumah → kartu pemilik seperti sebelumnya + tombol **🚪 Masuk Rumah**.
- **Rumah sendiri**: tombol **🚪 Masuk Rumah Saya** di Kartu Warga (berlaku walau kavlingnya di luar Distrik Pusat; titik pintunya = jalan di depan kavling sendiri).
- **Keluar**: tombol **🚪 Keluar Rumah** (kanan bawah, hanya tampil selama di dalam), tombol **Keluar** pada chip aksi saat berdiri di depan pintu keluar, atau ketuk layar saat di depan pintu keluar. Pemain kembali **persis ke doorstep rumah itu** menghadap rumahnya. Keluar akun (logout) dan membuka Kartu Saya juga otomatis mengeluarkan pemain dari interior dulu.

**Interiornya:** satu ruangan template low-poly (16 × 13 satuan, tinggi 5,4) dibangun sebagai grup Three.js di **(0, −600, 0)** — jauh di bawah kota, koordinat tetap — dan pemain di-teleport ke sana; ruangan dibangun ulang tiap kunjungan. Isi: lantai kayu (tekstur kanvas papan), dinding krem + plafon, jendela bergambar pemandangan dengan **gorden warna aksen**, kasur + bantal + **selimut aksen**, **karpet aksen**, meja + 2 kursi + buku, TV menyala ("TV PINARAK — LIVE") di meja TV dinding timur, lemari pakaian 2 pintu, tanaman sudut, lampu gantung emissive + `PointLight` hangat, daun pintu kayu selatan dengan gagang. Semua bentuk dasar Three.js, flat shading, palet pastel desa. **Personalisasi per rumah**: papan nama di dinding utara ("@username — Rumah No. X · Blok Y · Kavling Z", tekstur kanvas) + bingkai **Kartu Warga** pemilik (replika kartu hijau) di bawahnya; warna aksen karpet/gorden/selimut = **warna baju pemilik**.

**Di dalam:** tetap mode 1st Person (WASD/joystick/scroll sama); mode kamera **terkunci** — tombol Orbit/Drone tidak berfungsi sampai keluar. Tabrakan memakai generalisasi pola AABB yang sudah ada (`tabrakanDi(x, z, daftar)`; `tabrakan` kota dan `tabrakanInterior` sama-sama memanggilnya): 5 AABB perabot (kasur, set meja-kursi, meja TV, lemari, tanaman) + posisi di-jepit di dalam dinding ruangan (0,75 dari dinding) — kamera tidak tembus dinding/perabot.

**Perilaku multiplayer saat di interior (keputusan v1):** posisi yang dikirim ke server adalah **posisi pintu rumah yang dimasuki** (`interiorKonteks.pintuX/pintuZ/yawPintu` di `kirimPosisi`), BUKAN koordinat interior mentah — jadi tidak ada karakter melompat ke (0, −600) di klien lain, tidak kena clamp server, dan karena nilainya konstan selama di dalam, cek epsilon menghentikan pengiriman berulang dengan sendirinya. Di mata pemain lain, karakter pengunjung **berdiri di depan pintu rumah itu** selama ia di dalam; gelembung chat-nya tetap muncul di sana. **Interior bersifat kunjungan SOLO**: pemain lain tidak bisa ikut masuk ke ruangan yang sama di v1 (tidak ada interior bersama per rumah).

**Batas v1:** hanya rumah detail Distrik Pusat + rumah sendiri yang bisa dimasuki (98.300 rumah instanced tetap cangkang dari luar); satu template ruangan untuk semua rumah (yang beda hanya personalisasi di atas); pintu tidak beranimasi buka/tutup (daun pintu tertutup, keluar-masuk via teleport); perabot tidak interaktif (TV/lampu statis); tidak ada lantai dua.

**Verifikasi interior** (server uji port 18029 + harness Node, semua data uji di /tmp — sudah dimatikan & dihapus; `data/` produksi terkonfirmasi tetap kosong):
1. `node --check app.js` OK; `py_compile server.py` OK. Konsistensi DOM: semua `$("#id")` yang dirujuk app.js ada tepat 1× di index.html yang disajikan server (termasuk 4 id baru: `chip-aksi`, `chip-aksi-teks`, `chip-aksi-tombol`, `tombol-keluar-rumah`); satu-satunya pengecualian `btn-masuk-rumah` memang dibuat dinamis via innerHTML oleh app.js sendiri sebelum dirujuk.
2. Regresi HTTP di server uji: `GET /` 200 judul "Desa Pinarak", `GET /app.js` 200 memuat semua fungsi interior; daftar → **201** (Rumah No. 1 Blok 1 Kavling 1), login PIN salah → **401**, PIN benar → **200**, statistik 0 → 1, pagination OK.
3. Regresi WebSocket dua klien (skrip uji sesi sebelumnya, DB bersih): **SEMUA LOLOS** — presence/masuk/keluar, posisi persis + clamp (3860, −2600), posisi tamu diabaikan, chat + echo + riwayat 50, tolak >200 karakter, rate limit 1,5 detik. Interior tidak menyentuh jalur server ini.
4. **Uji logika interior tanpa browser** (harness Node: stub DOM/THREE minimal; driver disisipkan ke dalam scope IIFE app.js dan memanggil fungsi aslinya — berkas uji `/tmp/pinarak-int-test/uji_interior.js`, sudah dihapus): **21/21 LOLOS** — distrik terbangun dengan titik pintu tepat 6,4 satuan; 3 frame animasi (termasuk `perbaruiAksiInterior`) tanpa error; `masukInterior` → diInterior=true, mode terkunci "orang" (percobaan `aturMode("drone")` ditolak), grup interior 47 anak mesh, tepat 5 AABB perabot, spawn (0, 4,4) tepat di dalam pintu; **posisi terkirim saat masuk & selama bergerak di dalam = koordinat pintu persis, bukan koordinat interior**; `tabrakanInterior` mendorong titik di tengah kasur keluar ke tepi (−4,95) dan idempoten; `keluarInterior` → fp kembali persis ke doorstep + grup disembunyikan; alur rumah sendiri (`masukInterior(w, null)`) mengirim & kembali ke jalan depan kavling sendiri. Harness kedua menjalankan **frame animasi asli saat `diInterior=true`** (8/8 LOLOS): cabang interior `updateOrang` jalan tanpa error, fp yang dipaksa keluar dinding dijepit frame ke batas ruangan (x = 7,25), chip aksi tersembunyi saat jauh dari pintu keluar dan tampil dengan teks "🚪 Pintu keluar / Keluar" saat berdiri di depannya.
5. Yang TIDAK terverifikasi di sandbox (jujur): render visual interiornya (tidak ada headless browser) — menunggu deploy + sesi browser induk, sama seperti fitur 3D sebelumnya.

## KTP Desa Pinarak (20 Nov 2026, permintaan Fahmi: "setiap warga ada KTP")

Setiap warga kini punya **KTP Desa Pinarak** bergaya KTP Indonesia (desain mengikuti contoh yang disetujui Fahmi: kartu landscape biru muda, header "KARTU TANDA PENDUDUK / DESA PINARAK" + lambang rumah emas, foto karakter di kanan, pita kaki penanda desa). Identitas tetap **username IG saja** — usulan field "Nama" tambahan sudah dibatalkan Fahmi, tidak ditambahkan.

**Server (`server.py` + SQLite):**
- Kolom baru `nik TEXT` di tabel warga. Migrasi aman di `init_db`: DB baru langsung punya kolomnya; DB lama di-`ALTER TABLE ADD COLUMN` bila kolom belum ada (data lama utuh); indeks unik `idx_warga_nik` dibuat sesudah backfill.
- **Skema NIK (16 digit)**: `3201` (kode desa tetap, 4 digit) + `YYMMDD` tanggal daftar (6 digit, dari `created_at`) + **nomor rumah zero-padded 6 digit** (000001–100000). Karena `nomor_rumah` UNIQUE, NIK dijamin unik walau tanggal daftar sama; karena deterministik dari data baris, backfill idempoten secara konstruksi. Contoh nyata hasil uji: warga daftar 20 Nov 2026 rumah No. 1 → `3201261120000001`.
- NIK dibuat server **sekali saat pendaftaran** (`daftar()` mengisi + membaca ulang baris). **Backfill** warga lama berjalan di `init_db` setiap startup: hanya baris dengan `nik IS NULL/''` yang diisi — menjalankan berulang kali tidak pernah mengubah NIK yang sudah ada (terbukti di uji restart).
- **Keputusan privasi NIK**: NIK lengkap hanya dikirim ke **pemiliknya sendiri** lewat sesi — fungsi baru `warga_privat()` (warga_publik + `nik` + `terdaftar` YYYY-MM-DD) dipakai di respons `/api/daftar`, `/api/login`, `/api/saya`. `warga_publik()` TIDAK diubah: `/api/warga` (daftar publik) dan data rupa WebSocket tidak memuat NIK, jadi kartu rumah warga lain tetap hanya berisi data yang memang sudah publik.

**Klien (`public/app.js`, `index.html`, `style.css`):**
- **Tombol "🪪 Lihat KTP"** di Kartu Warga (dari tombol "Kartu Saya" → `fokusRumahSaya`, dibuat dinamis seperti tombol Masuk Rumah) dan tombol **"🪪 Lihat KTP Saya"** di layar "jadi" sesudah pendaftaran — pilihan yang tidak mengganggu alur: KTP tidak dipaksa tampil, tapi tombolnya jelas di layar keberhasilan (dokumentasi pilihan sesuai tugas).
- Tampilan KTP = **DOM/CSS** (`#ktp-overlay`, z-index 15 di atas gerbang supaya bisa dibuka dari layar "jadi"): kartu rasio 1,586, gradasi biru muda + pola kontur halus, lambang rumah emas (SVG inline), panel data semi-transparan (NIK, Nama `@username`, Alamat `Blok X · Kavling Y`, No. Rumah, Terdaftar dalam format tanggal Indonesia, Berlaku "Seumur Hidup"), kotak foto berbingkai navy + label FOTO, pita kaki "DESA PINARAK · KARTU TANDA PENDUDUK · @desapinarak".
- **Foto KTP** digambar di canvas 2D (`gambarPotretKTP`) dari data rupa pemiliknya — warna kulit, warna baju, peci/topi/tanpa — gaya flat dengan faset ala low-poly yang konsisten dengan karakter 3D-nya (kepala + bahu, wajah sederhana, penutup kepala sesuai pilihan).
- **Tombol "⬇️ Unduh KTP (PNG)"**: kartu yang sama digambar ulang ke canvas 1200×756 (`gambarKTPKeCanvas`, memakai fungsi potret yang sama) lalu diunduh sebagai `ktp-pinarak-<username>.png`. Semua teks persis dari data server sesi pemilik (bukan gambar AI).

**Verifikasi KTP** (semua server uji + DB di /tmp, sudah dimatikan & dihapus; `data/` produksi terkonfirmasi tetap kosong):
1. **API + NIK (DB segar, port 18030) — 12/12 LOLOS**: daftar warga 1 → 201 + NIK `3201261120000001` (16 digit, pola `3201`+YYMMDD+`000001`) + `terdaftar` terisi; warga 2 → NIK beda berakhiran `000002`; duplikat → 409; PIN salah → 401; login → NIK sama persis (tidak berubah); `/api/saya` → NIK sama; `/api/warga` publik terbukti TANPA field `nik`/`terdaftar`; statistik 2; pagination OK.
2. **Backfill (port 18031) — 5/5 LOLOS**: DB skema lama persis pra-KTP (tanpa kolom `nik`) berisi 2 warga bertanggal daftar 2026-09-05 & 2026-11-20 → server baru menambahkan kolom + mengisi NIK `3201260905000001` & `3201261120000002` (unik, sesuai tanggal masing-masing); **restart kedua: kedua NIK tidak berubah** (idempoten).
3. **Regresi WebSocket dua klien (port 18032) — 14/14 LOLOS**: sambutan tamu/pemain, broadcast masuk, posisi persis + clamp (3860, −2600), posisi tamu diabaikan, chat + echo + sampai ke tamu, tolak >200 karakter, rate limit 1,5 detik, riwayat 2 pesan untuk klien baru, broadcast keluar saat disconnect. Jalur WS tidak disentuh fitur KTP.
4. **Harness Node fungsi KTP — 25/25 LOLOS**: seksi KTP diekstrak dari app.js dan dijalankan dengan stub DOM/canvas perekam — `formatTanggalID` benar ("2026-11-20" → "20 November 2026"); `gambarPotretKTP` tanpa error untuk peci/topi/tanpa; `gambarKTPKeCanvas` menghasilkan canvas 1200×756 dan **semua teks yang digambar persis** dari data uji (NIK, @username, "Blok 1 · Kavling 1", tanggal terformat, "Seumur Hidup", pita kaki); `tampilkanKTP` mengisi DOM dari data sesi + membuka overlay; `unduhKTP` jalan (toBlob stub).
5. `node --check app.js` OK; `py_compile server.py` OK; konsistensi DOM: 69 id yang dirujuk app.js semuanya ada di index.html (10 id KTP baru termasuk), kecuali `btn-masuk-rumah` & `btn-ktp-saya` yang memang dibuat dinamis via innerHTML.
6. **Catatan jujur**: render visual kartu (DOM/CSS + potret canvas) BELUM terverifikasi di browser — sandbox tidak punya headless browser, sama seperti fitur 3D sebelumnya. Yang terverifikasi: data, logika gambar (teks & tanpa error), dan konsistensi DOM/CSS. Verifikasi pixel menunggu deploy + sesi browser induk.

## Keluarga + Kartu Keluarga (20 Nov 2026, permintaan Fahmi: "masukin random orang ke 1 keluarga, dan ada kartu keluarga")

Tiap warga otomatis tergabung dalam **satu keluarga** yang dipilih server secara **acak**, dan tiap keluarga punya **Kartu Keluarga (KK)** bergaya dokumen resmi (desain mengikuti contoh yang disetujui Fahmi: dokumen portrait, pita kepala biru muda "KARTU KELUARGA / DESA PINARAK" + lambang rumah emas, No. KK, Kepala Keluarga, Alamat, tabel anggota, ruang tanda tangan Kepala Keluarga & Kepala Desa, footer penanda). Peran di keluarga **hanya dua** (keputusan Fahmi): **Kepala Keluarga** (pendiri keluarga) dan **Anggota** (semua sisanya) — tidak ada peran Pasangan/Anak/dll.

**Server (`server.py` + SQLite):**
- Tabel baru `keluarga(id, no_kk UNIQUE, created_at)` + kolom `keluarga_id` & `peran` ('kepala'/'anggota') di tabel warga. Migrasi aman di `init_db` (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE` bila kolom belum ada; data lama utuh).
- **Skema No. KK (16 digit)** — sama seperti NIK: `3201` (kode desa) + `YYMMDD` tanggal keluarga dibuat + **nomor urut keluarga (id, zero-padded 6)**. id unik → No. KK unik; deterministik dari (created_at, id). Contoh hasil uji nyata: keluarga pertama yang dibuat 20 Nov 2026 → `3201261120000001`.
- **Pengelompokan acak** (`gabung_keluarga`, dipanggil saat pendaftaran): `pilih_keluarga_acak` mengumpulkan semua keluarga yang belum penuh (**maks 5 orang**) lalu memilih satu dengan `random.SystemRandom().choice` — randomness server yang benar, bukan deterministik dari nomor rumah. Bila tidak ada keluarga yang muat → buat keluarga baru, warga itu jadi **Kepala Keluarga**-nya; bila masuk keluarga yang sudah ada → **Anggota**.
- **Backfill idempoten** di `init_db` setiap startup: semua warga lama yang `keluarga_id`-nya kosong digabungkan dengan aturan yang sama (urutan proses = nomor rumah; pilihan keluarganya tetap acak). Sesudah semua punya keluarga, menjalankan lagi tidak mengubah apa pun (terbukti di uji restart). Ada juga perbaikan peran parsial: keluarga tanpa kepala → anggota bernomor rumah terkecil dipromosikan.
- **Alamat keluarga** = alamat rumah Kepala Keluarga (Blok/Kavling/No. Rumah kepala).
- **API**: `GET /api/keluarga-saya` (wajib sesi) → `{no_kk, kepala, alamat, kamu{username, peran}, anggota[{username, nik, peran, terdaftar, nomor_rumah, blok, kavling}]}` (anggota terurut nomor rumah, kepala selalu baris pertama). Respons `/api/daftar`, `/api/login`, `/api/saya` kini juga memuat ringkasan `warga.keluarga = {no_kk, peran}` lewat `warga_privat()`.
- **Keputusan privasi**: NIK semua anggota hanya dikirim ke **sesama anggota keluarga itu yang login** (KK memang memuat NIK anggotanya — sama seperti KK asli). `warga_publik()` tidak diubah: `/api/warga` publik dan WebSocket terbukti **tanpa NIK dan tanpa data keluarga sama sekali**.

**Klien (`public/app.js`, `index.html`, `style.css`):**
- **Panel "👨‍👩‍👧 Keluarga Saya"**: tombol di panel menu (☰) + tombol di Kartu Warga. Menampilkan No. KK, Kepala Keluarga, alamat keluarga, kalimat peran user ("Kamu adalah Kepala Keluarga…" / "Kamu adalah Anggota — kepala keluargamu @…"), dan daftar anggota dengan chip peran (emas untuk Kepala Keluarga) + penanda "(Kamu)". HUD tetap ramping — panel ini overlay yang dibuka dari tombol, bukan elemen permanen.
- **Kartu Keluarga**: tombol "📄 Lihat Kartu Keluarga" membuka dokumen DOM/CSS (`#kk-overlay`) mengikuti desain contoh; **"⬇️ Unduh KK (PNG)"** menggambar ulang dokumen yang sama ke canvas portrait 1100×1460 (`gambarKKKeCanvas`) dan mengunduh `kk-pinarak-<no_kk>.png` — semua teks persis dari data server. Tanggal di tabel memakai format singkat Indonesia ("20 Nov 2026").

**Verifikasi keluarga/KK** (semua server uji + DB di /tmp, sudah dimatikan & dibersihkan; `data/` produksi terkonfirmasi tetap kosong; skrip uji di `/tmp/pinarak-kk-test/`):
1. **HTTP utama (port 18033) — 80/80 LOLOS**: daftar 12 warga → terbentuk **tepat 3 keluarga berukuran 5+5+2**, tiap keluarga tepat 1 Kepala Keluarga & sisanya Anggota, semua warga punya keluarga, No. KK unik 16 digit, KK konsisten antar anggota (selain field `kamu`), alamat KK = alamat kepala, **NIK tiap anggota di KK cocok persis dengan NIK yang ia terima saat pendaftaran**, `kamu.peran` cocok per peminta; tanpa token → **401**; `/api/warga` publik tanpa `nik`/`keluarga`; regresi: duplikat **409**, PIN salah **401**, NIK stabil sesudah login (KTP), statistik 0→12, pagination OK.
2. **Keacakan (unit, fungsi server langsung) — 8/8 LOLOS**: 300 panggilan `pilih_keluarga_acak` atas 3 keluarga @4 anggota → distribusi **103/98/99** (merata, bukan selalu keluarga pertama); 10 keluarga @4 anggota + 10 warga baru lewat `gabung_keluarga` → tersebar ke **10 keluarga berbeda**, semua jadi Anggota; semua penuh → pemilih `None` dan `gabung_keluarga` membuat keluarga baru dengan warga itu sebagai Kepala Keluarga + No. KK 16 digit.
3. **Backfill (DB skema pra-KK persis: warga + NIK, tanpa kolom/tabel keluarga) — 7/7 LOLOS**: 7 warga lama → tergabung jadi 2 keluarga (5+2), tepat 1 kepala per keluarga, No. KK unik 16 digit, NIK lama tidak berubah; **restart kedua: pengelompokan identik** (idempoten).
4. **Regresi WebSocket dua klien (port 18034, klien WS stdlib) — 13/13 LOLOS**: sambutan tamu/pemain, broadcast masuk/keluar, posisi persis + clamp (3860, −2600), chat sampai ke B & tamu, chat tamu ditolak & tidak disiarkan. Jalur WS tidak disentuh fitur ini.
5. **Harness Node fungsi KK klien — 24/24 LOLOS**: `formatTanggalSingkatID` benar; `gambarKKKeCanvas` menghasilkan canvas 1100×1460 dan **semua teks yang digambar persis** dari data uji (No. KK, kepala, alamat, kelima kolom tabel, kedua label tanda tangan, footer); tidak ada peran selain Kepala Keluarga/Anggota.
6. `node --check app.js` OK; `py_compile server.py` OK; konsistensi DOM: 83 id yang dirujuk app.js semuanya ada di index.html (13 id KK/keluarga baru termasuk), kecuali 3 tombol dinamis (`btn-masuk-rumah`, `btn-ktp-saya`, `btn-keluarga-saya`) yang memang dibuat via innerHTML.
7. **Catatan jujur**: render visual panel keluarga & dokumen KK (DOM/CSS + canvas unduhan) BELUM terverifikasi di browser — sandbox tidak punya headless browser, sama seperti fitur sebelumnya. Yang terverifikasi: data & aturan pengelompokan, keacakan, privasi, logika gambar (teks & tanpa error), dan konsistensi DOM/CSS. Verifikasi pixel menunggu deploy + sesi browser induk.

**Batas v1 keluarga**: keanggotaan bersifat permanen (tidak ada pindah keluarga/keluar/pecah KK); keluarga tidak memengaruhi posisi rumah (tiap warga tetap di kavling urutannya sendiri — alamat KK hanya administratif mengikuti kepala); bila Kepala Keluarga adalah satu-satunya anggota, KK-nya tetap sah berisi 1 orang; tidak ada batas jumlah keluarga (tumbuh mengikuti jumlah warga ÷ 5).

## Verifikasi lokal (sandbox, server + DB sementara)

1. Daftar `warga.test1` → 201, `nomor_rumah 1, blok 1, kavling 1`, token sesi diterbitkan.
2. Login PIN salah → **401**; daftar username sama → **409**; PIN di DB = hash PBKDF2 + salt.
3. `/api/statistik` → `{warga:1, rumah:1, terisi:1, kapasitas:100000, blok_total:4000, per_blok:25}`.
4. **Uji beban 20.000 baris sintetis (DB SEMENTARA, sudah dihapus)**: seed 0,44 dtk; statistik **2,6 ms**; pagination limit=100 offset=0 **4,1 ms**; offset=19900 **5,8 ms**; limit=500 urut=terbaru **10,1 ms**.
5. `node --check app.js` OK; `py_compile server.py` OK. Render 3D tidak bisa di-screenshot dari sandbox (tidak ada headless browser) — verifikasi visual final menunggu deploy + sesi browser induk.

## Kekurangan v1 yang disengaja

- Warna atap pemilik hanya untuk 2.000 warga pertama (paginasi warna); selebihnya agregat paleta per kavling terisi.
- Rumah detail + NPC hanya 30 warga terbaru di Distrik Pusat; kavling warga lain tampil sebagai rumah instanced (bisa ditunjuk via Kartu Saya).
- Verifikasi follow Instagram bersifat kepercayaan (tombol "Sudah follow") — sama seperti situs referensi; API IG tidak menyediakan cek follower.
- Blok taman memakan 1.500 kavling dari grid render (kapasitas logis DB tetap 100.000; 60 blok taman + 8 blok pusat tidak di-render sebagai rumah).
- Belum ada rate-limit API & moderasi username; SQLite cukup untuk v1, jalur migrasi Postgres terbuka bila warga meledak.


---

## Coming Soon Sementara di Oracle (20 Nov 2026, ±20:02 WIB)

Perintah Fahmi: selama X99 mati, pinarak.mfah.me ditampung SEMENTARA di Oracle dengan halaman coming soon.

- **Halaman**: statis di Oracle `/var/www/pinarak-comingsoon/` (`index.html` + `poster.webp` 530.864 B). Sumber lokal: `~/workspace/pinarak/coming-soon/`. Isi: poster teaser, judul Desa Pinarak, teks "SEGERA HADIR — Desa 3D tempat follower jadi warga. Daftar dapat rumah, KTP & Kartu Keluarga. Kavling 100.000.", tombol ke instagram.com/desapinarak.
- **Vhost Oracle**: `/etc/nginx/sites-available/pinarak.mfah.me` (symlink sites-enabled), pola sama seperti vhost statis lain di Oracle: 80 → redirect 301 ke 443; 443 root `/var/www/pinarak-comingsoon`. `nginx -t` sukses + reload OK.
- **Sertifikat origin**: Let's Encrypt khusus `pinarak.mfah.me` diterbitkan via certbot DNS-01 (plugin dns-cloudflare, kredensial /etc/letsencrypt/cloudflare.ini), live di `/etc/letsencrypt/live/pinarak.mfah.me/`, berlaku s/d 18 Feb 2027. (Sertifikat `mfah.me` yang ada hanya mencakup mfah.me + www, jadi tidak bisa dipakai.) Cloudflare tetap terminate TLS di edge seperti biasa; origin kini punya sertifikat valid untuk hostname ini.
- **DNS — SEBELUM**: CNAME `pinarak.mfah.me` → `19eedf11-5822-45cd-8b78-6c5f51ff4f18.cfargotunnel.com`, proxied=true, record id `c3f62bb49743afa819948f525cbb9735`.
- **DNS — SESUDAH**: A `pinarak.mfah.me` → `140.245.124.194`, proxied=true, record id TETAP `c3f62bb49743afa819948f525cbb9735` (PUT update pada record yang sama). Skrip: `~/workspace/pinarak/deploy/dns_pinarak_oracle.py` (dijalankan di Oracle).
- **Verifikasi publik (dari sandbox, 3×)**: `https://pinarak.mfah.me/` = 200, body memuat "SEGERA HADIR" + "Desa Pinarak", `poster.webp` = 200 (530.864 B). Origin juga diuji langsung di Oracle via `--resolve` 127.0.0.1: 200.
- **Catatan akses**: SSH baru ke Oracle sempat kena "Connection reset by peer" dari proxy egress berulang kali; tembus dengan pola python subprocess list-args (ProxyCommand proxy_cmd.py %h %p) — sesuai catatan AGENTS.md.
- **Desain diganti (20 Nov 2026, 20:08 WIB)**: versi pertama ditolak Fahmi sebagai "AI slop" (gradasi hijau, tombol pil kuning, bayangan). Diganti versi sederhana atas perintahnya: latar krem datar #f5efe2, tipografi slab serif (Zilla Slab) jadi pemeran utama, poster tampil polos tanpa bingkai/efek, teks gaya pengumuman singkat ("Segera hadir." + satu paragraf + tautan IG), tanpa JavaScript/animasi. File lama di Oracle disimpan sebagai `index.html.bak-slop`. Verifikasi sesudah ganti: halaman 200, teks baru termuat, poster.webp tetap 200.

### RESTORE (WAJIB saat X99 hidup, SEBELUM verifikasi deploy asli)

1. Deploy app ke X99: `python3 ~/workspace/pinarak/deploy/sync_and_deploy.py`.
2. Kembalikan DNS record id `c3f62bb49743afa819948f525cbb9735` menjadi **CNAME → `19eedf11-5822-45cd-8b78-6c5f51ff4f18.cfargotunnel.com`, proxied=true** (PUT update dari Oracle, kredensial sama; pola `dns_pinarak.py`). Tanpa langkah ini, pinarak.mfah.me tetap menunjuk halaman coming soon di Oracle dan verifikasi deploy akan membaca halaman yang salah.
3. Verifikasi konten app asli (penanda kanvas/gerbang/app.js, BUKAN poster/teks coming soon) + uji API seperti langkah verifikasi deploy semula.
4. Cron `pinarak-deploy-retry` SUDAH diperbarui 20 Nov 2026 ±20:06 WIB: instruksinya kini memuat langkah restore DNS ini (langkah 3) sebelum verifikasi, dan syarat verifikasi konten app asli.
5. Sesudah app live dari X99, vhost + file coming soon di Oracle boleh dibiarkan (tidak terpakai selama DNS berupa CNAME) atau dibersihkan; sertifikat pinarak.mfah.me di Oracle tidak mengganggu apa pun.

---

## Pemilu: Ketua RT / Ketua RW / Kepala Desa (20 Nov 2026)

Fitur pemilihan pejabat desa: warga mencalonkan diri (wajib visi & misi), warga lain memilih sesuai hak pilih wilayah rumahnya, pemenang memegang jabatan yang tampil di label karakter, kartu rumah, Kartu Warga, dan KTP. Dibangun & diverifikasi LOKAL di source ini; deploy ikut rilis berikutnya dari source yang sama (cron `pinarak-deploy-retry` / `sync_and_deploy.py`).

### Pemetaan wilayah RT/RW (deterministik, dihitung dari blok — TANPA kolom baru)

Grid kota: 80 kolom × 50 baris blok (blok 1..4000, tiap blok 25 kavling). Dari nomor blok: `baris, kolom = divmod(blok-1, 80)`.

- **RT = kelompok 5 kolom × 5 baris blok** → kisi RT 16 × 10 = **160 RT** (masing-masing 25 blok = 625 kavling). `rt_kol = kolom // 5`, `rt_bar = baris // 5`, nomor RT = `rt_bar*16 + rt_kol + 1` (1..160), label "Ketua RT 042" (3 digit).
- **RW = kelompok 4 RT-kolom × 2 RT-baris** (= 20 × 10 blok) → kisi RW 4 × 5 = **20 RW** (masing-masing 8 RT = 200 blok = 5.000 kavling). Nomor RW = `(rt_bar//2)*4 + (rt_kol//4) + 1` (1..20), label "Ketua RW 07" (2 digit).
- **Kepala Desa** = seluruh desa (wilayah disimpan 0).
- Rumus yang sama hidup di server (`wilayah_dari_blok`) — klien tidak menghitung sendiri; server menghitung wilayah kandidat & pemilih dari blok rumah masing-masing dan tidak pernah memercayai wilayah dari klien.

### Model status & kendali admin

- Satu periode `pemilu` berjalan satu per satu. Status: **pencalonan → pemungutan → selesai** (kolom `pemilu.status`; dibuka_pada/ditutup_pada dicatat).
- Admin (Pak Kades) lewat endpoint ber-token: header `X-Admin-Token` dicocokkan `hmac.compare_digest` dengan ENV **`PINARAK_ADMIN_TOKEN`** di service. Env kosong/tidak cocok → selalu 403.
  - `POST /api/admin/pemilu/buka` — buka periode baru (fase pencalonan); 409 bila masih ada periode belum selesai.
  - `POST /api/admin/pemilu/fase` `{"fase":"pemungutan"}` — pencalonan → pemungutan.
  - `POST /api/admin/pemilu/tutup` — hanya dari pemungutan: tetapkan pemenang + status selesai.
  - CLI siap pakai: `deploy/pemilu_admin.sh buka|pemungutan|tutup [base_url]` (token dari env pemanggil, tidak disimpan di berkas).
- CATATAN DEPLOY: set `PINARAK_ADMIN_TOKEN` di environment service `pinarak` di X99 saat rilis fitur ini; tanpa itu endpoint admin selalu 403 (panel warga tetap jalan, tapi periode tidak bisa dibuka).

### Aturan main

- Kandidat: 1 warga hanya boleh jadi kandidat untuk **1 jabatan per periode** (UNIQUE pemilu+warga). Visi wajib 1–200 karakter, misi wajib 1–1000 karakter (dipotong spasi pinggir; disimpan apa adanya; klien menampilkannya via textContent — anti-XSS).
- Hak pilih (divalidasi server dari alamat rumah pemilih): RT hanya se-RT, RW hanya se-RW, Kepala Desa semua warga. 1 suara per warga per jabatan+wilayah (UNIQUE suara). Memilih di luar wilayah → 403; memilih 2× → 409.
- Hasil berjalan (suara + persen per kandidat) tampil real-time selama pemungutan lewat `GET /api/pemilu` (publik; balapan default = Kepala Desa + RT/RW si peminta bila login; balapan lain via `?jabatan=&wilayah=`).
- **Aturan seri**: suara terbanyak menang; seri → kandidat yang **mendaftar lebih dulu** menang (urut dibuat_pada, lalu id). Berlaku juga bila semua kandidat 0 suara selama ada kandidat.
- Jabatan aktif disimpan di tabel `jabatan` (1 baris per warga: jabatan, wilayah, sejak, pemilu_id). Saat periode ditutup: pemegang lama balapan yang sama digantikan; pemenang yang sebelumnya memegang jabatan lain melepas jabatan lamanya; balapan tanpa kandidat tidak mengubah pejabat lamanya. Jabatan tampil di: label karakter 3D (baris kecil emas di bawah nama — NPC, pemain online via WebSocket, dan label rumah), kartu profil rumah, Kartu Warga, dan KTP (baris "Jabatan" di kartu DOM + PNG unduhan, hanya untuk pejabat aktif). `GET /api/warga` & payload WebSocket kini memuat field `jabatan` (label atau null); NIK & data keluarga TIDAK ikut tersebar (privasi tidak berubah).

### Verifikasi lokal (20 Nov 2026, server uji + DB /tmp, token admin hanya di env proses uji)

- Seed 8 warga meniru persis alur `daftar()` (hash PBKDF2, NIK `buat_nik`, gabung keluarga, token sesi) dengan nomor rumah sparse untuk sebaran wilayah: RT 1/RW 1 (rumah 1–3), RT 2/RW 1 (rumah 126–127), RT 5/RW 2 (rumah 2501–2502), RT 17/RW 1 (rumah 10001, kandidat RW 1).
- **HTTP 59/59 lulus**: buka tanpa/salah token 403, dengan token 201; buka ganda 409; 7 kandidat terdaftar dengan wilayah server yang benar; visi kosong/>200 char 400; daftar 2 jabatan 409; calon tanpa sesi 401; memilih saat pencalonan 409; tutup dari pencalonan 400; pilih RT/RW beda wilayah 403; pilih 2× 409; hasil berjalan kades 3 suara 60% vs 2 suara 40%; **seri RT 2 (1–1) dimenangkan pendaftar pertama**; sesudah tutup pejabat = Kepala Desa (kades.a), Ketua RT 001, Ketua RT 002, Ketua RW 01, Ketua RW 02; jabatan terbaca di `/api/saya` dan `/api/warga`.
- **Regresi HTTP lulus**: daftar 201/409, PIN salah 401, login 200, keluarga-saya 200, statistik benar, NIK KTP utuh.
- **WebSocket 7/7 lulus**: sambutan & pesan masuk memuat jabatan ("Kepala Desa", "Ketua RT 001"), posisi & chat tersiar antar dua klien login, chat/posisi tamu tidak tersiar.
- `node --check` app.js OK; `py_compile` server.py OK; konsistensi id DOM: 89 id dirujuk JS, 0 hilang (id form calon dibuat dinamis via DOM).
- Insiden kecil selama uji: seed pertama sempat masuk DB `data/` karena env yang benar adalah `DATA_DIR` (bukan `PINARAK_DB`) — DB produksi saat itu memang kosong & belum pernah deploy; file DB tercemar dihapus dan skema dibuat ulang kosong. Status akhir terverifikasi: **DB produksi `data/` = 0 warga**, skema memuat 4 tabel pemilu baru. Semua data uji /tmp sudah dibersihkan.

### Batas v1

- Keanggotaan jabatan tidak bisa dicabut manual; jabatan berakhir hanya lewat pemilu berikutnya untuk balapan itu.
- Panel pemilu menampilkan balapan Kepala Desa + RT/RW si peminta; balapan wilayah lain bisa dilihat lewat parameter URL API, belum ada penjelajah semua RT/RW di UI.
- Interior tetap solo; pejabat tidak punya ruang khusus di balai desa.
- Render visual panel & label jabatan belum diverifikasi piksel di browser (tidak ada browser headless di sandbox) — pola DOM/CSS mengikuti panel Keluarga/KTP yang sudah live-terverifikasi.

---

## Upgrade Visual + Opsi Kualitas Grafik (20 Nov 2026)

Target: mendekati poster teaser (desa low-poly golden hour) + opsi kualitas **Otomatis / Rendah / Tinggi** atas permintaan Fahmi. Murni sisi klien (`public/app.js`, `index.html`, `style.css`) — **`server.py` tidak diubah sama sekali**. Semua jarak permukaan dari audit z-fighting dipertahankan; satu-satunya permukaan datar baru adalah bidang kilau danau yang diletakkan **0,35 di atas air** (danau besar 0,10 → kilau 0,45; danau taman 0,52 → kilau 0,87) dan pelat teras (kotak 0,3 tebal, kategori kontak yang sama dengan alas taman 0,245).

### Perubahan visual

- **Pencahayaan & langit**: tone mapping **ACES Filmic** (exposure 1,2) + output sRGB; matahari golden hour miring dari **barat** (offset −240, 150, 90 mengikuti target kamera seperti sebelumnya), warna 0xffc384 intensitas 1,05; hemisphere hangat (langit 0xffe7c4, tanah 0x86a860). **Kubah langit gradasi** (sphere r=8200, ShaderMaterial: horizon krem 0xffe3ae → biru lembut 0xaad9f2 → 0x5fa8dd; radius aman di bawah far semua mode: FP 9000, Orbit/Drone 13000). Kabut diganti warna hangat 0xf6d9a8, **jarak kabut tidak berubah** (900–5600, audit far-plane tetap berlaku).
- **Variasi rumah massal** (tetap InstancedMesh): dinding 1 IM bertekstur; atap dibagi deterministik per nomor rumah — **pelana ±55%** (geometri prisma segitiga baru `geometriAtapPelana`), **limas ±30%** (kerucut-4 lama), **datar ±15%** (pelat parapet); **cerobong bata** di ±35% rumah beratap miring; **teras kayu** di ±70% rumah. Warna atap/dinding tetap per instans (palet lama; kavling terisi tetap warna baju pemilik).
- **Tekstur prosedural canvas** (dibuat sekali saat muat, digambar ulang saat skala kualitas berubah): dinding **plesteran + 2 jendela berbingkai + pita bawah**; atap **genteng berbaris** (tekstur terang dikali `instanceColor`, jadi semua warna atap tetap jalan); keduanya juga dipakai rumah detail Distrik Pusat & atap balai desa. Rumah detail kini bervariasi juga: atap pelana/limas/datar bergiliran per rumah + cerobong + teras ber-atap mini.
- **Lingkungan kavling** (instanced, hash deterministik): **pagar kayu** (geometri gabungan 4 tiang + 2 rel) di ±28% kavling, **semak** ±32%, **pohon kecil** ±14%. Kandidat **diurutkan berdasarkan hash** supaya pemotongan kepadatan menipiskan secara merata sekota.
- **Jalan**: tekstur ubin tanah digambar ulang — badan jalan pasir + **trotoar terang di kedua sisi** + **garis tengah putus-putus** (masih 1 plane bertekstur, tanpa geometri baru).
- **Sawah**: tekstur digambar ulang — petak 8×8 (dulu 4×4), variasi hijau per petak, barisan padi halus, ±16% petak berair, galengan cokelat.
- **Danau**: material lebih mengkilap (roughness 0,3 → 0,18) + **bidang kilau matahari aditif** (gradasi radial canvas, bukan refleksi real-time) di 2 danau besar & danau taman.
- **Awan**: 10 kelompok × 3 bola (30 mesh) → **18 kelompok, tiap kelompok 1 mesh gabungan** berisi 4–5 gumpalan pipih, material lembut kehangatan (emissive krem), sebaran lebih luas.

### Opsi kualitas (panel menu ☰ → "🎨 Kualitas grafik")

Pilihan **Otomatis / Rendah / Tinggi**, tersimpan di `localStorage` (`pinarak_kualitas`), diterapkan langsung tanpa reload. Di dalamnya ada tangga 4 langkah diskret (`LANGKAH_KUALITAS`, logika murni terpisah & teruji):

| Langkah | Pixel ratio | Bayangan | Kepadatan dekorasi | Skala tekstur |
|---|---|---|---|---|
| Rendah | maks 1 | mati | 0,25 | 0,5 |
| Sedang | maks 1,25 | mati | 0,5 | 0,75 |
| Tinggi | maks 1,5 | aktif, peta 1024 | 0,75 | 1 |
| Maksimal | maks min(DPR, 2) | aktif, peta 2048 | 1 | 1 |

- **Rendah** = langkah 0; **Tinggi** = langkah 3 (Maksimal). **Otomatis** mulai dari langkah 3; monitor FPS bergulir 5 detik di loop animasi: rata-rata **< 30 FPS → turun 1 langkah** (jeda 8 detik antar perubahan); **> 55 FPS berkelanjutan 30 detik → naik 1 langkah** (maks langkah 3). Setiap perubahan langkah di mode Otomatis memunculkan indikator kecil sesaat ("🎨 Kualitas otomatis: …") di atas layar; panel menu juga menampilkan tingkat aktif. Sampel dt > 250 ms (pindah tab) diabaikan.
- Penerapan tanpa reload: pixel ratio via `setPixelRatio`; bayangan via `shadowMap.enabled` + `castShadow` + `needsUpdate` material sekali per pergantian; kepadatan via `.count` InstancedMesh dekorasi & jumlah awan tampil; tekstur via gambar ulang 8 tekstur prosedural terdaftar (`REG_TEX`: dinding, atap, tanah, sawah + 4 klon sawah) — ukuran: dinding/atap/tanah 256² (128² di Rendah), sawah 512² (256² di Rendah), kilau tetap 128².
- Mode kamera (Orbit/1st Person/Drone) dan interior **tidak berubah perilaku** di semua kualitas.

### Anggaran (draw call & segitiga, scene statis 0 warga)

| | Sebelum (dari struktur kode lama) | Sesudah (terukur harness, kualitas Maksimal) |
|---|---|---|
| Draw call scene statis | ±90 | **88** (awan digabung 30 → 18 mengimbangi tambahan baru) |
| Draw call rumah massal + dekorasi | 2 | **10** (dinding, 3 atap, cerobong, teras, pagar, semak, batang, daun) |
| Segitiga | ±2,5 juta | **±6,54 juta** (di Rendah: ±4,1 juta — dekorasi dipotong 75%) |
| Rumah detail Distrik Pusat | 6 mesh/rumah | ±11 mesh/rumah (variasi atap + teras + cerobong; maks 30 rumah) |

Kenaikan segitiga terutama dari pagar (72 segitiga × ±27,5 ribu instans) — dimitigasi tangga otomatis & kepadatan; draw call praktis tidak naik.

### Verifikasi lokal (20 Nov 2026)

1. `node --check app.js` OK; `py_compile server.py` OK. Konsistensi DOM: **93 id** dirujuk app.js, 0 hilang (3 id baru: `seg-kualitas`, `info-kualitas`, `indikator-kualitas`).
2. **Harness logika kualitas 31/31 LOLOS** (`/tmp/pinarak-visual-test/uji_kualitas.js`, blok murni diekstrak dari app.js): pemetaan langkah → parameter (PR/bayangan/kepadatan/tekstur, clamp DPR & indeks), tangga otomatis (turun per langkah + jeda 8 dtk, lantai 0, naik hanya sesudah >55 FPS berkelanjutan 30 dtk, reset di FPS menengah, batas persis 30/55).
3. **Harness scene 31/31 LOLOS** (`uji_scene.js`: app.js dijalankan utuh dengan THREE r128 asli + stub DOM/renderer): kota terbangun (dinding 98.300 instans; pelana+limas+datar = 98.300; rasio pelana 0,55); geometri pelana 6 segitiga, normal satuan, tanpa NaN, basis y=0 & puncak y=h; pagar gabungan 216 titik; kubah langit + 3 bidang kilau ada; awan 18 mesh; penerapan kualitas terbukti dua arah (Rendah: PR 1, bayangan mati, dekorasi 25%, awan 5, tekstur 128px — Maksimal: PR 2, peta bayangan 2048, dekorasi penuh, awan 18, tekstur 256px; Tinggi: peta 1024); `setPilihanKualitas` menyimpan ke localStorage & otomatis mulai dari langkah teratas; loop animasi asli memanggil render.
4. **Regresi HTTP + WebSocket 26/26 LOLOS** (server uji port 18036, DATA_DIR /tmp — sudah dimatikan & dihapus): `/` 200 memuat kontrol kualitas, daftar 201/409, PIN salah 401, login 200 + NIK, statistik, pagination, keluarga-saya; WS dua klien + tamu: sambutan, broadcast masuk/keluar, posisi persis + clamp (3860, −2600), posisi tamu diabaikan, chat + riwayat, tolak >200 karakter, rate limit 1,5 detik.
5. **DB produksi `data/` tidak disentuh** (terbaca 0 warga sesudah semua uji; seluruh server uji memakai DATA_DIR /tmp).

### Batas jujur

- **Render visual TIDAK terverifikasi piksel** — sandbox tanpa headless browser, sama seperti fitur 3D sebelumnya. Yang terverifikasi: struktur scene, geometri, logika kualitas, dan penerapan parameter dua arah lewat harness THREE asli. Nilai exposure/warna golden hour dipilih konservatif mendekati kecerahan lama; penilaian akhir menunggu deploy + HP Fahmi.
- Segitiga naik ±2,6× di kualitas Maksimal; HP lemah mengandalkan tangga Otomatis (default) untuk turun sendiri — belum ada bukti FPS perangkat nyata sampai deploy.
- Tekstur interior rumah tidak ikut diskala kualitas (ruangan kecil, tekstur 256² tetap).

---

## Sambutan Pak Kades + Gerbang Pemilu 10.000 Warga (20 Nov 2026)

Dua keputusan Fahmi: (A) "Kades akan menyambut warga baru" (20:17 WIB) dan (B) "Pemilu harus ketika user udah 10rb" (20:20 WIB). Dibangun & diverifikasi LOKAL; deploy ikut rilis berikutnya dari source yang sama.

### (A) Sambutan Pak Kades

- **Pemicu**: hanya pendaftaran yang BERHASIL (`Handler.daftar`, sesudah warga + NIK + keluarga selesai dibuat). Login ulang tidak melewati jalur ini, jadi **satu warga = tepat satu pesan sambutan**, secara konstruksi.
- **Penyimpanan**: pesan chat Balai Desa biasa dengan penanda sistem — kolom baru **`sistem INTEGER NOT NULL DEFAULT 0`** di tabel `chat` (CREATE untuk DB baru + migrasi `ALTER TABLE` aman untuk DB lama; pesan lama otomatis `sistem=0`). Sambutan disimpan dengan `warga_id=0`, username **`Pak Kades`**, `sistem=1` (fungsi `sambutan_warga_baru` / `teks_sambutan_warga_baru` di server.py).
- **Isi** (disusun server dari data warga itu sendiri): sapaan + @username, urutan warga (= nomor rumah), alamat rumah (No./Blok/Kavling), RT/RW dari `wilayah_dari_blok`, dan keluarganya — anggota: "Keluargamu dipimpin @kepala."; pendiri keluarga: "Kamu sendiri Kepala Keluarganya." Ditutup "Silakan masuk, pintu desa selalu terbuka." Contoh nyata hasil uji: *"Selamat datang @warga.baru, warga ke-2 Desa Pinarak. Rumahmu No. 2, Blok 1 Kavling 2, RT 001/RW 01. Keluargamu dipimpin @penonton.dulu. Silakan masuk, pintu desa selalu terbuka."*
- **Tiga jalur tampil**: (a) masuk **riwayat chat** (`chat_terakhir` kini memuat flag `sistem`; klien merender pesan sistem sebagai kartu pengumuman hijau dengan nama "Pak Kades" tanpa "@"); (b) **disiarkan langsung** via `ws_broadcast` (`{jenis:"chat", u:"Pak Kades", sistem:true}`) ke semua yang online saat pendaftaran terjadi; (c) respons `POST /api/daftar` memuat field **`sambutan`** — klien menampilkannya sebagai **dialog sambutan** (`#sambutan-overlay`, foto Pak Kades `ikon-180.png` + teks + tombol **Masuk Desa** yang menutup gerbang & memfokuskan rumah warga baru) tepat sesudah layar "jadi". Respons login TIDAK memuat field itu.

### (B) Gerbang pemilu 10.000 warga

- Konstanta server **`PEMILU_MIN_WARGA = 10_000`** (bawaan di kode). ENV **`PINARAK_MIN_WARGA`** hanya override untuk UJI lokal; produksi tidak menyetelnya.
- `POST /api/admin/pemilu/buka`: sesudah cek token admin, server menghitung warga saat itu juga (`status_gerbang_pemilu`); bila `< PEMILU_MIN_WARGA` → **403** dengan pesan menyebut angka ("Pemilu masih terkunci: baru N dari 10000 warga terdaftar…") dan periode TIDAK dibuat. Fase/tutup periode yang sudah berjalan tidak terpengaruh.
- `GET /api/pemilu` kini selalu memuat **`min_warga`, `jumlah_warga`, `terkunci`** di level atas respons.
- **Panel klien**: bila `terkunci`, panel menampilkan blok `.pemilu-terkunci` — teks persis "🔒 Pemilu pertama dibuka setelah 10.000 warga terdaftar — sekarang N dari 10.000." (format angka id-ID) + bar progres (pola `.suara-bar`) + catatan; form pencalonan dan tombol Pilih **tidak dirender** (dijaga di `gambarPanelPemilu` & `gambarBalapanPemilu`, termasuk kasus tepi periode berjalan). Pejabat aktif tetap tampil di atasnya seperti sebelumnya. Aturan pemilu lain (wilayah, visi-misi, 1 suara, seri, token admin) tidak berubah.

### Verifikasi lokal (20 Nov 2026; DB uji di folder scratch workspace — /tmp sandbox ter-wipe di tengah sesi, jadi seluruh suite dibuat ulang & dijalankan bersih di sana, lalu folder scratch dihapus)

1. **Server A (ambang bawaan, port 18037) — 36/36 LOLOS**: daftar warga ke-1 & ke-2 → respons memuat sambutan dengan data persis (urutan, alamat, RT 001/RW 01, kepala keluarga cocok dengan `/api/keluarga-saya`); klien WS yang online menerima siaran sambutan langsung (`sistem:true`, isi identik dengan respons daftar); tamu baru membuka chat → riwayat berisi **tepat 2** pesan sistem berurutan; **login ulang → tidak ada sambutan baru** (respons login tanpa field `sambutan`, jumlah pesan sistem tetap 2). Gerbang: `GET /api/pemilu` → `min_warga 10000, jumlah_warga 2, terkunci true`; buka dengan token admin sah → **403 terkunci** + periode tetap tidak ada. Regresi: duplikat 409, PIN salah 401, statistik, pagination, publik tanpa NIK, `/api/saya` ber-NIK; WS dua klien: masuk/keluar, posisi persis + clamp (3860, −2600), chat warga tersiar (bukan sistem), rate limit 1,5 dtk, tolak >200 karakter.
2. **Server B (override uji `PINARAK_MIN_WARGA=3`, port 18038) — 17/17 LOLOS**: pada 2 warga `terkunci=true` & buka → 403; warga ke-3 mendaftar → `terkunci=false`; buka → **201 pencalonan**; buka ganda 409; token salah 403. Regresi pemilu penuh di DB yang sama: calon kades/RT (wilayah server benar), visi kosong 400, pilih saat pencalonan 409, fase pemungutan, pilih 200, pilih 2× 409, hasil berjalan 1 suara 100%, tutup → pemenang memegang jabatan "Kepala Desa" di `/api/saya`. **Cara gerbang "membuka" dibuktikan persis seperti ini** — ambang diturunkan lewat env di DB uji; nilai produksi tetap 10.000 di kode (terbukti oleh Server A tanpa env override).
3. **Migrasi DB lama**: DB berskema chat pra-sambutan (tanpa kolom `sistem`) + 1 pesan lama → server baru menambah kolom, pesan lama terbaca dengan `sistem:false`, server jalan normal.
4. **Harness klien (Node, seksi asli app.js + stub DOM) — 19/19 LOLOS**: format angka id-ID; payload terkunci → teks status persis, bar progres 1,28% pada 128/10.000, tanpa form calon, catatan lama tidak tampil; terkunci + pejabat → pejabat tetap tampil; tidak terkunci → form calon (pencalonan) & tombol Pilih (pemungutan) tampil; terkunci + pemungutan (kasus tepi) → tombol Pilih disembunyikan; render chat: pesan sistem berkelas `.sistem` dengan nama tanpa "@", pesan warga seperti biasa.
5. `node --check app.js` OK; `py_compile server.py` OK; konsistensi DOM: **94 id** dirujuk app.js, 0 hilang (3 id baru sambutan termasuk). **DB produksi `data/` tidak disentuh**: terverifikasi 0 warga, 0 chat, dan skema chat-nya masih versi lama (migrasi `sistem` akan berjalan otomatis saat service produksi pertama kali start dengan kode baru).

### Batas jujur

- **Render visual dialog sambutan & panel terkunci BELUM terverifikasi piksel** — tidak ada headless browser di sandbox, sama seperti fitur sebelumnya. Yang terverifikasi: data & teks sambutan persis dari server, siaran WS langsung, logika panel (harness DOM atas fungsi asli), dan konsistensi id/CSS. Penilaian visual menunggu deploy + HP Fahmi.
- Sambutan terkirim juga ke lencana chat belum-dibaca warga yang sedang online (dianggap pengumuman desa — disengaja).
- Bila pendaftaran terjadi saat tidak ada warga online, sambutan tetap tersimpan dan terbaca dari riwayat chat oleh siapa pun yang membuka desa sesudahnya (50 pesan terakhir).


---

## Pembangunan Bertahap — desa mulai dari kantor kades saja (20 Nov 2026)

Keputusan Fahmi 20:16 WIB: "Desa awalnya cuma kantor kades. Nanti followers minta bangun ini itu." Diterapkan penuh di source lokal; BELUM deploy (X99 masih mati).

### Keadaan awal baru

- **Distrik Pusat tidak berubah**: balai desa (kantor kades) + plaza + papan desa. Rumah warga tetap muncul seiring pendaftaran — saat rilis warga = 0, jadi desa memang mulai dari kantor kades saja.
- **60 blok taman lama (kol 4+8a, bar 4+8b) kini LAHAN PEMBANGUNAN**: petak tanah berpagar kayu sederhana + papan nama. Pohon taman instanced (1.500 pohon) yang memenuhi blok-blok itu DIHAPUS. Lanskap alam TETAP: sawah, 2 danau besar, hutan pinggir kota, danau taman di blok (36,28) dipertahankan sebagai air alami di lahan kosong (blok itu bukan lahan fasilitas).
- 52 lahan tanpa fasilitas cadangan: papan generik "LAHAN PEMBANGUNAN / Menunggu usulan warga" (tiang + panel sebagai 2 InstancedMesh @52). 8 lahan fasilitas: papan individual bernama fasilitasnya (mis. "MASJID / LAHAN PEMBANGUNAN"). Pagar semua lahan = 1 InstancedMesh (60 instans, geometri gabungan tiang+2 palang per sisi); pagar lahan yang fasilitasnya sudah berdiri dilipat ke skala 0.
- Status dibaca klien saat muat halaman lewat `GET /api/pembangunan` (dipanggil `ambilData()` bersama statistik & daftar warga; bila gagal, semua dianggap belum berdiri). **Tidak ada siaran real-time di v1** — bangunan baru terlihat sesudah muat ulang halaman.

### Peta lahan fasilitas + biaya Kas Desa (virtual)

| Kunci | Nama | Kol/Bar | Blok | Biaya kas |
|---|---|---|---|---|
| taman | Taman Desa | 36/20 | 1637 | Rp5.000.000 |
| lapangan | Lapangan Bola | 20/36 | 2901 | Rp8.000.000 |
| perpustakaan | Perpustakaan Desa | 12/12 | 973 | Rp12.000.000 |
| balai_warga | Balai Warga | 68/12 | 1029 | Rp15.000.000 |
| sekolah | Sekolah Dasar | 52/20 | 1653 | Rp20.000.000 |
| puskesmas | Puskesmas | 60/36 | 2941 | Rp25.000.000 |
| pasar | Pasar Desa | 28/28 | 2269 | Rp30.000.000 |
| masjid | Masjid | 44/28 | 2285 | Rp40.000.000 |

Peta yang sama persis ada di dua tempat dan WAJIB tetap sinkron: konstanta `FASILITAS` di `server.py` dan `FASILITAS_BLOK` di `public/app.js`. Blok dihitung `bar*80 + kol + 1` (konsisten dengan penomoran kavling yang ada).

### Server

- Tabel **`pembangunan`** (`kunci` PRIMARY KEY, nama, biaya, kol, bar, status `belum`/`terbangun`, dibangun_pada) dibuat di `init_db` dan di-seed idempoten (`INSERT OR IGNORE` — restart tidak menimpa status/tanggal yang sudah ada; terbukti di uji restart).
- **`GET /api/pembangunan`** (publik): `{fasilitas: [...{kunci, nama, biaya, kol, bar, blok, status, dibangun_pada}], terbangun, total}`.
- **Admin** (pola token pemilu: header `X-Admin-Token` vs ENV `PINARAK_ADMIN_TOKEN`): `POST /api/admin/pembangunan/bangun` `{kunci}` → 201 + tanggal berdiri; tanpa/salah token 403; body tidak sah 400; kunci tak dikenal 404; sudah berdiri 409.
- **CLI `deploy/pembangunan_admin.sh`**: `PINARAK_ADMIN_TOKEN=... ./pembangunan_admin.sh bangun <kunci> [base_url]` dan `... daftar [base_url]` (bawaan `http://127.0.0.1:8026`). Token hanya dari ENV, tidak pernah disimpan/dicetak. Teruji langsung: daftar 8 fasilitas benar, bangun sekolah 201, bangun ulang 409, tanpa token ditolak.

### Klien — model fasilitas & panel

- Fasilitas terbangun dirender sebagai **model 3D prosedural low-poly khas** di tengah blok lahannya (`MODEL_FASILITAS` di app.js, dibangun dari helper yang ada): **masjid** = aula + kubah emas + menara; **sekolah** = gedung atap merah + tiang bendera merah-putih; **pasar** = 8 kios beratap warna-warni + papan "PASAR DESA"; **lapangan** = bidang hijau + garis putih + lingkaran tengah + 2 gawang; **taman** = jalan setapak menyilang + kolam + 5 pohon + 3 bangku + semak bunga; **puskesmas** = gedung putih + tanda plus merah di muka; **perpustakaan** = gedung + papan "PERPUSTAKAAN" + buku terbuka di tiang; **balai_warga** = pendopo terbuka (lantai + 6 tiang + atap kerucut besar, tanpa dinding). Total draw call tambahan hanya ±8 grup kecil (satu per fasilitas terbangun).
- **Panel "🏗️ Pembangunan"** (tombol di panel menu ☰, overlay `#pembangunan-overlay`): pengantar singkat — desa mulai dari kantor kades, fasilitas dibangun satu per satu dari usulan warga di komentar Instagram @desapinarak, diputuskan Pak Kades — lalu ringkasan "Sudah berdiri X dari 8 fasilitas" dan satu baris per fasilitas: nama, "Blok N · Biaya kas RpX"; yang berdiri ditandai **✓ Sudah berdiri** + tanggal (format id-ID), yang belum "Belum dibangun". **Saldo kas IG TIDAK ditampilkan di app** (kas hidup di ledger IG terpisah; app tidak mengarang angka kas).

### Verifikasi lokal (20 Nov 2026; DB uji di `scratch-bangun/` via DATA_DIR, dihapus sesudahnya; DB produksi TIDAK disentuh)

1. **Suite server (port 18041) — 48/48 LOLOS**: `/api/pembangunan` awal: 8 fasilitas semua `belum`, terbangun=0, nomor blok & biaya kedelapan fasilitas persis tabel di atas, `dibangun_pada` kosong; bangun tanpa token 403, token salah 403, kunci tak dikenal 404, bangun `taman` 201 + tanggal terisi, GET sesudahnya terbangun=1 (7 lain tetap `belum`), bangun lagi 409. **Restart server pada DATA_DIR yang sama**: taman tetap `terbangun` dengan tanggal yang sama (seed idempoten). Regresi: daftar 2 warga (sambutan ada, NIK 16 digit pola `3201…`), duplikat 409, PIN salah 401, login 200 tanpa field sambutan + NIK stabil, `/api/saya` ber-NIK, `/api/warga` publik tanpa NIK, `/api/keluarga-saya` 200, statistik warga=2; gerbang pemilu ambang bawaan: `min_warga 10000, jumlah 2, terkunci true`, buka → 403; WS: tamu menerima 2 sambutan Pak Kades persis di riwayat, dua klien login saling melihat masuk, posisi tersiar persis + posisi liar di-clamp (3860, −2600), chat tersiar, chat >200 char ditolak tanpa siaran.
2. **Suite pemilu penuh (port 18042, override uji `PINARAK_MIN_WARGA=2`) — 13/13 LOLOS**: gerbang membuka pada 2 warga; buka 201 pencalonan; visi kosong 400; calon 201; pilih saat pencalonan 409; fase pemungutan; pilih 200; pilih 2× 409; hasil berjalan 1 suara 100%; tutup → pemenang memegang jabatan "Kepala Desa". (Nilai produksi tetap 10.000 di kode — terbukti oleh suite pertama tanpa override.)
3. **Harness scene klien (Node, app.js + THREE asli, stub DOM/renderer/fetch) — 26/26 LOLOS**: skenario tanpa fasilitas terbangun → 0 model fasilitas, 8 papan nama fasilitas, pagar 60 instans semua skala 1, alas 60 petak, papan generik tiang+panel @52, pohon taman lama hilang, danau (36,28) tetap ada, rumah massal tetap 98.300 instans. Skenario taman+masjid terbangun → tepat 2 grup model di pusat blok yang benar (taman −287,−371; masjid 385,301; y=0,245), model masjid berkubah (SphereGeometry), 6 papan tersisa, pagar 2 lahan itu skala 0 dan 58 lain skala 1. Panel Pembangunan pada skenario itu: ringkasan "2 dari 8", menyebut usulan komentar Instagram, biaya Taman Desa Rp5.000.000 & Masjid Rp40.000.000 tampil, status ✓ + tanggal "20 November 2026" terformat, status "Belum dibangun" ada, dan TIDAK ada teks saldo kas.
4. `node --check app.js` OK; `py_compile server.py` OK; konsistensi DOM: **98 id** dirujuk app.js, yang tidak ada di index.html hanya 3 pengecualian lama yang dibuat lewat innerHTML (`btn-keluarga-saya`, `btn-ktp-saya`, `btn-masuk-rumah`); 4 id pembangunan baru semua ada. **DB produksi `data/` tidak disentuh**: terverifikasi tetap 0 warga dan tabel `pembangunan` belum ada di sana (akan dibuat otomatis saat service produksi pertama kali start dengan kode baru).

### Batas v1 (jujur)

- **Usulan pembangunan tetap dari komentar Instagram** dan **keputusan membangun tetap di tangan Fahmi di luar app** — tidak ada fitur usulan/voting pembangunan di dalam app.
- **Kas Desa IG dipotong manual di ledger kas-desa** (`~/workspace/pinarak/kas-desa/kas.json`) saat sebuah bangunan diumumkan — app TIDAK memotong kas otomatis dan tidak tahu saldo kas.
- Status pembangunan terbaca saat muat halaman saja; warga yang sedang online tidak melihat bangunan muncul langsung (muat ulang untuk melihat).
- **Render visual model fasilitas, lahan berpagar, dan panel BELUM terverifikasi piksel** — tidak ada headless browser di sandbox. Yang terverifikasi: data server persis, struktur scene (harness atas kode asli), posisi blok, dan logika panel. Penilaian visual menunggu deploy + HP Fahmi.

## Implementasi Go + PostgreSQL + Docker (20 Nov 2026)

Keputusan Fahmi 20 Nov 2026 ±20:51: server resmi Pinarak sekarang **Go + PostgreSQL**, deploy nanti via **Docker ke Hostinger**. Implementasi Python tidak lagi dipakai menjalankan desa (lihat "Warisan Python" di bawah). Klien `public/` tidak diubah satu byte pun — kontrak API (path, field JSON, kode status, teks pesan) identik dengan perilaku yang didokumentasikan gelombang-gelombang di atas.

### Struktur folder final (per fitur, BUKAN MVC)

Koreksi Fahmi dua kali di hari yang sama: instruksi MVC (internal/model, internal/view, internal/controller) diterbitkan lalu **diganti** struktur folder per fitur di bawah `internal/`. Tidak ada folder `pkg/`, `api/`, `configs/`, `vendor/`, `scripts/`, `web/`.

```
~/workspace/pinarak/
├── docker-compose.yml      (root proyek: app Go + db postgres:16-alpine)
├── .env.example            (root proyek, placeholder saja)
├── Dockerfile.python-legacy (Dockerfile Python lama, diganti nama; bukan jalur deploy)
├── public/                 (klien, tidak diubah)
├── server.py               (referensi warisan, lihat bawah)
└── goserver/
    ├── go.mod, go.sum      (module pinarak, go 1.23; pgx/v5 v5.7.2, x/crypto v0.31.0)
    ├── Dockerfile          (konteks build = root proyek agar bisa COPY public/)
    └── cmd/server/main.go  (entrypoint tunggal: hanya perakitan)
    └── internal/
        ├── db/             (pool pgx + skema/migrasi — satu-satunya yang menyentuh driver)
        ├── warga/          (daftar, login, logout, sesi, profil, NIK/KTP, daftar warga, statistik)
        ├── keluarga/       (pengelompokan acak maks 5 + data Kartu Keluarga)
        ├── chat/           (persistensi chat Balai Desa + sambutan Pak Kades)
        ├── ws/             (hub WebSocket RFC 6455 manual di atas net/http hijack)
        ├── pemilu/         (kandidat, suara, fase, gerbang 10.000, admin)
        └── pembangunan/    (8 fasilitas + admin bangun)
```

Test unit Go = file `_test.go` menempel di folder fiturnya (db, chat, pembangunan). Suite regresi HTTP/WS penuh dijalankan sebagai skrip Python stdlib terhadap server Go yang hidup (lihat hasil di bawah).

Penyajian statis: binary menyajikan folder `public/` dari disk (bukan embed) — di image Docker disalin ke `/app/public/`, saat dev dicari di `./public`, `../public`, atau ENV `PUBLIC_DIR`. Satu perbedaan kecil dari Python yang diterima: direktori tanpa `index.html` menjawab 404 (Python menampilkan daftar isi direktori); klien tidak memakai perilaku itu.

### Peta endpoint (identik kontraknya)

- `GET /` + file statis dari `public/`; `GET /ws?token=` WebSocket (tamu tanpa token = penonton).
- `POST /api/daftar` 201 (+sambutan) / 400 / 409 / 507 · `POST /api/login` 200/401 · `POST /api/logout` 200 · `GET /api/saya` 200/401 · `GET /api/keluarga-saya` 200/401/404 · `GET /api/warga` (limit 1..500 bawaan 100, offset, `urut=terbaru`) · `GET /api/statistik`.
- `GET /api/pemilu` (panel: periode, gerbang `min_warga/jumlah_warga/terkunci`, pejabat, balapan, suara_saya, kandidat_saya) · `POST /api/pemilu/calon` 201/400/401/409 · `POST /api/pemilu/pilih` 200/400/401/403/404/409 · admin `POST /api/admin/pemilu/buka|fase|tutup`.
- `GET /api/pembangunan` · admin `POST /api/admin/pembangunan/bangun` 201/400/403/404/409.
- `/api/*` tak dikenal → 404 `{"error":"Tidak ditemukan"}`; method selain GET/HEAD/POST → 501 (sama seperti BaseHTTPRequestHandler).

Aturan bisnis disalin persis: grid 80×50×25 = 100.000 (tolak 507 saat penuh), username regex + PIN 6 digit, **PBKDF2-HMAC-SHA256 120.000 iterasi, salt 16 byte hex** (format penyimpanan kompatibel Python — terbukti silang: hash yang dibuat Python hashlib di-seed ke DB, login lewat server Go berhasil), NIK `3201`+YYMMDD+nomor rumah 6 digit, keluarga acak crypto/rand maks 5 dengan peran hanya Kepala Keluarga/Anggota, sambutan Pak Kades tepat 1× saat daftar, wilayah RT/RW dari blok (160 RT, 20 RW), gerbang pemilu `PEMILU_MIN_WARGA` bawaan 10.000, token admin dibandingkan konstan-waktu (`subtle.ConstantTimeCompare`; ENV kosong = admin selalu 403), visi ≤200 / misi ≤1000 karakter (dihitung per rune), seri pemilu → pendaftar lebih dulu, persen suara dibulatkan half-even seperti `round()` Python, rate limit chat 1 pesan/1,5 detik + maks 200 karakter (rune), riwayat chat 50, clamp posisi x ±3860 / z ±2600, ping server 20 detik & putus >30 detik tanpa aktivitas.

### Titik konkurensi (pengganti lock global Python)

- **Pendaftaran**: satu transaksi + `pg_advisory_xact_lock(20261120)` — nomor rumah = COUNT(*)+1 tidak bisa ganda; constraint unik username & nomor_rumah jadi lapis kedua (23505 → 409).
- **Keluarga**: pilihan keluarga kandidat <5 anggota dan penyisipan anggota terjadi di dalam transaksi pendaftaran yang sama (di bawah advisory lock yang sama), jadi tidak ada keluarga >5 walau daftar paralel.
- **Suara ganda**: cek awal + `INSERT ... ON CONFLICT (pemilu_id, pemilih_id, jabatan, wilayah) DO NOTHING` — baris 0 terpengaruh → 409.
- **Penutupan pemilu**: penetapan pemenang + perubahan status dalam satu transaksi.
- **Pembangunan**: UPDATE bersyarat status di transaksi handler; bangun ganda → 409.
- **Hub WebSocket**: satu mutex registri klien/pemain; pengiriman per koneksi dikunci per klien; rate limit chat per username di dalam mutex hub.

### ENV wajib saat deploy

`DATABASE_URL` (di compose disusun dari `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` di `.env`), `PINARAK_ADMIN_TOKEN` (dari env host; kosong = admin terkunci), `PORT` (bawaan 8026), `HOST` (bawaan 0.0.0.0). `PINARAK_MIN_WARGA` hanya override uji — produksi jangan diisi (bawaan 10.000). Nilai asli tidak dicatat di repo; `.env.example` hanya placeholder.

### Docker

`goserver/Dockerfile`: multi-stage — `golang:1.23-alpine` build `CGO_ENABLED=0` binary statis → `alpine:3.20` berisi binary + `public/`, user non-root `pinarak`, `EXPOSE 8026`. `docker-compose.yml`: app build dari `goserver/Dockerfile` (konteks root proyek), port `127.0.0.1:8026:8026`, `depends_on` db sehat; db `postgres:16-alpine`, volume `pinarak-db`, healthcheck `pg_isready`. **Docker tidak tersedia di sandbox ini** — `docker compose up` belum dijalankan; smoke test container adalah langkah pertama saat deploy ke Hostinger nanti.

### Verifikasi lokal (20 Nov 2026; PostgreSQL 16.2 lokal port 54329, tiga DB segar terpisah)

- `go build ./...` lulus, `go vet ./...` lulus, `gofmt` bersih, `go test ./...` lulus (db: wilayah/alokasi/label/NIK/persen half-even/PIN; chat: teks sambutan 3 klausa; pembangunan: 8 fasilitas blok+biaya persis).
- **Suite A (port 18026, ambang bawaan) — 62/62 LOLOS**: statis (/ , app.js, style.css, ikon PNG, 404), statistik 0→12, daftar + teks sambutan persis + NIK pola, duplikat 409, username/PIN tidak valid 400, PIN salah 401, login tanpa sambutan baru, 12 warga → tepat 3 keluarga (5+5+2) masing-masing 1 kepala, endpoint KK + NIK hanya untuk sesama keluarga (daftar publik tanpa NIK), pagination + clamp limit 500, gerbang pemilu terkunci di 10.000 (buka → 403 walau token benar), pembangunan 403/404/201/409 + tanggal, WebSocket dua klien + tamu: sambutan berisi 12 pesan sistem Pak Kades, masuk/keluar, posisi persis + clamp (3860, −2600), posisi tamu dibuang, chat tamu ditolak, chat tersiar ke semua dengan username sesi, rate limit, >200 char ditolak, riwayat klien baru benar.
- **Suite B (port 18027, `PINARAK_MIN_WARGA=2`, 7 warga tersebar 5 RT/2 RW di-seed dengan hash Python) — 44/44 LOLOS**: gerbang membuka, wilayah_saya benar per warga, buka 201, visi kosong/201 char 400, calon kedua 409, wilayah kandidat dihitung server, pilih saat pencalonan 409, fase/tutup tidak sah 400, pilih wilayah lain 403, suara ganda 409, kandidat tak ada 404, hasil berjalan kades 4–2 (66.7/33.3), RW1 seri 2–2 → pemenang pendaftar lebih dulu, tutup → jabatan tampil di profil + daftar publik.
- **Suite C (port 18028) — 5/5 LOLOS**: 20 pendaftaran paralel → semua 201, nomor rumah 1..20 unik lengkap, tepat 4 keluarga × 5 anggota; 10 pendaftaran paralel username sama → tepat satu 201, sembilan 409.
- **Restart idempoten**: server A di-restart atas DB yang sama → 12 warga utuh, login warga lama 200, seed pembangunan tidak menimpa status.
- Jalur kapasitas penuh (507 pada warga ke-100.001) tidak diuji end-to-end — sama seperti pengujian Python sebelumnya; logikanya perbandingan COUNT di dalam transaksi pendaftaran.

Catatan proses: dua cek suite sempat gagal karena ekspektasi skrip uji yang salah hitung (urutan DESC pagination; jumlah suara kades 4–2 bukan 3–2) — sesudah ekspektasi dikoreksi sesuai aritmetika yang benar, server lolos tanpa perubahan kode.

### Warisan Python

`server.py` di root repo adalah versi Python yang **sudah dimigrasikan agen sebelumnya ke PostgreSQL** (impor psycopg, DDL PG inline, advisory lock) — bukan lagi versi SQLite/systemd lama. File itu dipertahankan apa adanya sebagai referensi perilaku dan **tidak diperbaiki/dipakai lagi**; `requirements.txt` dan `Dockerfile.python-legacy` milik jalur yang sama. Jalur deploy resmi sekarang: build image Go (di X99 sesuai aturan build Fahmi) → Hostinger `docker compose pull/up` — menggantikan rencana lama systemd di X99 + restore CNAME dari halaman coming soon Oracle; instruksi cron `pinarak-deploy-retry` lama sudah tidak sesuai jalur ini dan perlu disesuaikan/dihapus saat deploy Go dikerjakan.

---

## Deploy Hostinger (Docker) — LIVE (20 Nov 2026, ±21:31–21:47 WIB)

Desa Pinarak **LIVE dari Hostinger**: https://pinarak.mfah.me/ — menggantikan halaman coming soon di Oracle. Rencana lama (systemd di X99 + restore CNAME tunnel) resmi ditinggalkan; cron `pinarak-deploy-retry` tidak lagi sesuai jalur ini (pengelolaannya di tangan parent).

### Hasil survei Hostinger (root@76.13.197.226, mail.merdu.id, Ubuntu 24.04.4, x86_64, 4 core, RAM 16 GB, disk 35 GB bebas)

- **Docker SUDAH terpasang** (Engine 29.2.1 + Compose v5.0.2) — tidak ada pemasangan baru. Di box yang sama berjalan Coolify + Merdu + mailcow; tidak satu pun diubah/direstart dalam deploy ini.
- **Host nginx (systemd) TIDAK aktif** — port 80/443 host dipegang **coolify-proxy (Traefik v3.6)**. Jadi "vhost" di server ini berbentuk **label Traefik di container** (persis pola `merdu-frontend`) atau file dynamic di `/data/coolify/proxy/dynamic/`. Deploy ini memakai jalur label.
- certbot ada (snap 5.10.0) tapi tidak dipakai: sertifikat diterbitkan Traefik sendiri (lihat HTTPS di bawah). Port 8026 bebas sebelum deploy.
- **Akses SSH**: jalur langsung sandbox→Hostinger:22 tidak menjawab banner (terverifikasi berulang; dari Oracle banner normal). Jalur yang dipakai: double-hop sandbox → (proxy CONNECT) → Oracle → Hostinger, host key Hostinger diverifikasi terhadap `~/workspace/cloudflared/known_hosts_hostinger` (tanpa bypass).

### Cara build image (tanpa kompilasi di Hostinger)

- Binary Go dikompilasi **di sandbox** (toolchain `~/workspace/tools/go`, Go 1.23.4): `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w"` → binary statis 9.818.264 B.
- Docker tidak tersedia di sandbox, jadi image disusun dari **Dockerfile runtime-saja** (`FROM alpine:3.20` + COPY binary & `public/`, tanpa langkah kompilasi) dan `docker build` di Hostinger hanya melakukan pelapisan COPY itu (±40 detik termasuk pull `postgres:16-alpine` & `alpine:3.20`).
- **Bug yang ditemukan & diperbaiki saat deploy**: file `public/` dari konteks berizin `660 root` → user non-root `pinarak` di container tidak bisa membaca aset → semua statis 404 (API tetap jalan). Perbaikan: `RUN chmod 755 /app/pinarak && chmod -R a+rX /app/public` di Dockerfile.runtime, build ulang → statis 200 semua.

### Lokasi & konfigurasi di Hostinger

- Direktori **`/opt/pinarak/`**: `docker-compose.yml` (varian Hostinger dari compose repo: app build dari Dockerfile.runtime, app bergabung ke network eksternal `coolify`, label Traefik di bawah), `Dockerfile.runtime`, `pinarak` (binary), `public/`, `.env` (chmod 600 — berisi kredensial PostgreSQL + `PINARAK_ADMIN_TOKEN`, keduanya dibuat kuat di server saat deploy; **nilai tidak dicatat di mana pun di repo/laporan ini**).
- Container: `pinarak-app-1` (127.0.0.1:8026 di host, restart unless-stopped) + `pinarak-db-1` (postgres:16-alpine, volume `pinarak_pinarak-db`, healthy).
- **Routing/HTTPS (Traefik)**: label `traefik.enable=true`, `traefik.docker.network=coolify`, router http → middleware redirect https, router https `tls.certresolver=cfdns` (DNS challenge Cloudflare — sertifikat terbit tanpa menunggu propagasi DNS), service port 8026. WebSocket `/ws` diteruskan Traefik secara bawaan (Upgrade header) — terbukti di verifikasi live. Tidak ada file/vhost layanan lain yang disentuh; host nginx tetap inactive seperti sebelumnya.

### DNS

- Record id `c3f62bb49743afa819948f525cbb9735` diubah (PUT dari Oracle, kredensial `/etc/letsencrypt/cloudflare.ini`, skrip baru `deploy/dns_pinarak_hostinger.py`): **A `pinarak.mfah.me` → 140.245.124.194 (Oracle) menjadi A → 76.13.197.226 (Hostinger), proxied=true**. Terverifikasi GET sesudahnya lewat keluaran skrip (SEBELUM/SESUDAH tercetak di log deploy).

### Verifikasi live (dari sandbox, jalur publik)

- `https://pinarak.mfah.me/` = **200**, `<title>Desa Pinarak</title>`, penanda app asli ada, **0 penanda coming soon** (tanpa poster.webp / "Segera hadir"); `/app.js` 200 (159.418 B), `/style.css` 200.
- Lokal di Hostinger: `curl 127.0.0.1:8026/` 200; log app bersih (satu baris start); `/api/statistik` jalan.
- **API end-to-end**: daftar `@warga.test1` → **201**, rumah 1 · Blok 1 · Kavling 1, respons memuat **sambutan Pak Kades** ("Selamat datang @warga.test1, warga ke-1 Desa Pinarak…"); login PIN benar **200**; PIN salah **401**; statistik warga=1. Warga uji kedua `@warga.test2` (rumah 2) dibuat untuk uji WS.
- **WebSocket**: `wss://pinarak.mfah.me/ws?token=…` → CONNECT via proxy → TLS 1.3 → handshake **101 Switching Protocols**, pesan pertama `{"jenis":"sambutan"}` diterima.
- **Pembersihan**: kedua warga uji + turunannya dihapus dari PostgreSQL produksi dalam satu transaksi (3 sesi, 2 chat sambutan, 2 warga, 1 keluarga kosong terhapus). Sesudahnya `/api/statistik` = **warga 0, rumah 0, terisi 0**; tabel sesi/keluarga/chat kembali 0 baris terkait uji.

### Rollback

1. DNS: jalankan ulang `deploy/dns_pinarak_oracle.py` di Oracle → record kembali A → 140.245.124.194 (halaman coming soon Oracle masih utuh di sana, sengaja TIDAK dimatikan/dihapus).
2. App: `cd /opt/pinarak && docker compose down` mematikan app+db Pinarak saja (volume `pinarak_pinarak-db` tetap; layanan lain tidak terpengaruh).

### Batas yang belum terverifikasi

- Tampilan visual desa di HP user (render 3D, panel, sambutan) — tidak ada headless browser; yang terverifikasi adalah HTTP/WS/API + kontrak data, sama seperti gelombang-gelombang sebelumnya.
- Sertifikat saat ini diterbitkan resolver `cfdns`; pembaruan otomatisnya mengikuti mekanisme Traefik/Coolify yang sudah berjalan untuk domain lain di box ini.

## Perbaikan UI Zona Atas — "Saling Numpuk" (20 Nov 2026, ±21:55 WIB)

Laporan user dari tangkapan layar HP (±400px, sudah login): tombol chat menutupi chip jumlah warga (teks terpotong "1 wa"), dan bar gelap info user menimpa tepi bawah kartu header.

### Penyebab

Zona atas dulu terdiri dari empat elemen `position:absolute` yang berbagi titik yang sama: `.info` (kiri, `max-width:56vw` di layar kecil), `.tombol-atas` (kanan, lebar alami ±195–215px), `#chip-saya` (`top:56–62px`), dan `#panel-chat`/`#panel-menu` (`top:62px; right:10px`). Di lebar 400px rentang horizontal `.info` dan `.tombol-atas` tumpang tindih ±30px (tombol chat menimpa chip warga), dan tinggi kartu info (±63px) melebihi `top` bar user (56–62px) sehingga bar user menempel/menimpa kartu.

### Perbaikan (hanya `public/index.html` + `public/style.css`; app.js & server Go tidak berubah)

- Struktur baru: satu kontainer `#zona-atas` (absolute sekali di pojok atas, `display:flex; flex-wrap:wrap; gap:8px`) yang memuat, berurutan dalam flow: `.info` (judul saja), `.tombol-atas` (rata kanan via `margin-left:auto`), `.baris-stat` (kedua chip statistik dipindah keluar dari `.info`, baris penuh sendiri), `#chip-saya` (bar user, rata kanan, teks elipsis pengaman), lalu `#panel-chat` & `#panel-menu`.
- Panel tidak lagi di titik lama: keduanya `position:absolute; top:calc(100% + 6px); right:0` relatif ke `#zona-atas` — selalu menggantung di bawah seluruh zona atas, berapa pun tingginya.
- `#indikator-kualitas` (toast sesaat) dipindah ke `top:150px` agar tidak jatuh di atas baris chip.
- Media query ≤560px dibersihkan dari sisa posisi lama (`max-width:56vw`, `top:56px`). Semua tombol tetap ≥44px; tidak ada id DOM yang berubah (app.js murni mencari by-id).

### Verifikasi lokal

- Harness struktur/CSS/anggaran lebar: **27/27 lulus** — urutan flow benar, tag div seimbang 112/112, 98 id yang dirujuk app.js semua ada (3 di antaranya dibuat dinamis via innerHTML, perilaku lama), tidak ada sisa aturan `top:62px/56px`, anggaran lebar baris 1 muat di 360/400/430px dan di 320px grup tombol wrap ke barisnya sendiri (tetap tanpa tumpang tindih karena flex-wrap).
- `node --check app.js` lulus (app.js tidak diubah).

### Deploy & verifikasi live

- Backup file lama di Hostinger: `/opt/pinarak/bak-atas/` (index.html + style.css pra-perbaikan). File baru dikirim ke `/opt/pinarak/public/`, `docker compose build app` + `up -d app` (image runtime-saja, hanya COPY); `pinarak-app-1` jalan, log start bersih, `pinarak-db-1` tetap healthy; layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** dan memuat `id="zona-atas"` + `baris-stat`; `/style.css` **200**, memuat `#zona-atas` dan `top: calc(100% + 6px)` ×2, dan **byte-identik** dengan file lokal baru; `/app.js` 200; `/api/statistik` normal (warga 1, rumah 1 — warga asli @thefahmihassan). HTML live berbeda byte dari lokal hanya karena penulisan-ulang Cloudflare di proxy (minify + skrip sisipan), penanda strukturnya utuh.

### Batas verifikasi

- Tidak ada headless browser di sandbox, jadi perbaikan ini terverifikasi secara struktur CSS/DOM + anggaran lebar + file yang tersaji live — BUKAN pixel-perfect visual. Bukti visual final = tangkapan layar HP user berikutnya.

### Ronde 2 — "Masih Timpaan" (20 Nov 2026, ±22:25 WIB)

User mengirim tangkapan layar baru sesudah ronde 1 terdeploy: baris chip statistik sudah jadi baris sendiri di paling atas, tetapi pill judul "Desa Pinarak" menutupi separuh bawah baris chip itu; bar user kali ini bersih.

#### Penyebab pasti (dua lapis, keduanya terbukti dari file)

1. **HP user menyajikan CAMPURAN versi: HTML ronde 1 + CSS pra-ronde 1 dari cache browser.** Bukti:
   - CSS pra-ronde 1 (tersimpan di `/opt/pinarak/bak-atas/style.css`) memuat `#hud .info { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 10px; }`, `.tombol-atas { position: absolute; top: …; right: 10px; }`, `#chip-saya { position: absolute; top: calc(62px + env(safe-area-inset-top)); right: 10px; }`, dan gaya `.chip-stat` — tetapi **tidak memuat satu pun aturan `#zona-atas` / `.baris-stat`**.
   - Dengan CSS lama itu, HTML baru ter-render persis seperti tangkapan layar: `#zona-atas` div statis tanpa aturan → `.baris-stat` (satu-satunya anak yang in-flow, karena `.info`/`.tombol-atas`/`#chip-saya` absolut) jatuh di paling atas zona; `.info` absolut di `top:10px` menimpa separuh bawahnya; `#chip-saya` di `top:62px` tampil bersih di bawah tombol.
   - Kenapa CSS lama bertahan di HP: `style.css` dirujuk **tanpa parameter versi** dan tersaji dengan `Cache-Control: max-age=14400` (4 jam, terukur dari header live) — kunjungan user 21:50 (pra-deploy ronde 1) meng-cache CSS lama, dan pada 22:12 browser boleh menyajikannya tanpa revalidasi, sementara HTML kebetulan termuat segar.
2. **Struktur ronde 1 sendiri masih menyisakan kerapuhan**: `#zona-atas` adalah `flex-wrap: wrap` (baris terbentuk dari lipatan + `.baris-stat { flex-basis: 100% }`), bukan kolom eksplisit — urutan baris bergantung pada muat/tidaknya item dalam satu garis.

#### Perbaikan (hanya `public/index.html` + `public/style.css`; app.js & server Go tidak berubah, tidak ada id yang berubah)

- `#zona-atas` menjadi **kolom flex eksplisit** (`flex-direction: column; gap: 8px`). Isinya berurutan dalam flow murni: `.baris-kepala` (baris flex berisi `.info` + `.tombol-atas`) → `.baris-stat` → `#chip-saya` → `#panel-chat` → `#panel-menu`.
- **Tidak ada lagi anak zona atas yang `position: absolute/fixed`, bermargin negatif, atau bertransform.** Panel chat/menu tidak lagi `top: calc(100% + 6px)`; keduanya kini item flow terakhir dengan `align-self: flex-end` — saat dibuka mereka memperpanjang kolom ke bawah, tidak menimpa baris mana pun. `#chip-saya` rata kanan via `align-self: flex-end` (bukan `margin-left: auto`). Satu-satunya absolut yang tersisa di zona ini adalah lencana angka di dalam tombol chat (cucu, penanda di atas tombolnya sendiri).
- `.baris-kepala` dan `.baris-stat` sama-sama `flex-wrap: wrap` dan `.chip-stat` `nowrap`: angka panjang (mis. "1.234 warga" / "99.999 / 100.000") menambah baris ke bawah, tidak pernah menimpa. Anggaran: baris kepala ±321px (muat 360–430px; di 320px tombol melipat ke baris berikut dalam flow), baris stat angka panjang ±247px; tinggi zona atas ±135px saat login, ±85px saat tamu (360 & 430 sama).
- **Cache-busting**: `index.html` kini merujuk `style.css?v=2` dan `app.js?v=2` — URL baru, tidak bisa dicampur dengan cache lama. **Tidak ada service worker** di app ini (terverifikasi: tidak ada `sw.js` dan tidak ada pendaftaran SW di app.js/index.html), jadi tidak ada nama cache SW yang perlu dinaikkan; satu-satunya cache yang berperan adalah cache HTTP browser/Cloudflare, dan itu yang diputus oleh parameter versi ini. Naikkan angka `v=` setiap perubahan aset berikutnya.

#### Verifikasi lokal

- Harness struktur/CSS ronde 2 (`/tmp/uji_zona2.js`): **68/68 lulus** — kolom eksplisit + gap, nol absolut/fixed/margin-negatif/transform pada semua aturan anak zona atas (termasuk di dalam media query), urutan DOM benar, div seimbang 113/113, 98 id yang dirujuk app.js semua ada, referensi aset berversi terpasang, anggaran lebar/tinggi seperti di atas. `node --check app.js` lulus.

#### Deploy & verifikasi live

- Backup file ronde 1 di Hostinger: `/opt/pinarak/bak-atas2/` (backup ronde 1 di `bak-atas/` tidak ditimpa). File baru terkirim ke `/opt/pinarak/public/` (md5 di server = md5 lokal), `docker compose build app` + `up -d app`; `pinarak-app-1` jalan dengan log start bersih, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** dan memuat `class="baris-kepala"` + `href="style.css?v=2"` + `src="app.js?v=2"`; `GET /style.css?v=2` **200 byte-identik** dengan CSS lokal baru (memuat aturan kolom); `/app.js?v=2` 200; `/api/statistik` normal (warga 1, rumah 1). Satu pengambilan awal `style.css?v=2` sempat menerima halaman error Cloudflare 525 (gangguan SSL edge↔origin sesaat tepat sesudah container restart); pengambilan ulang langsung 200 byte-identik dan sesudah itu stabil.

#### Batas verifikasi

- Yang terbukti dari file tersaji: HTML live sudah berversi `?v=2` dan CSS yang terunduh dari URL berversi itu adalah CSS kolom baru — jadi HP user, begitu memuat HTML ini, **tidak bisa lagi** mencampur CSS lama (URL-nya berbeda).
- Yang tetap hanya bisa dibuktikan di HP user: tampilan pikselnya. Bila HP masih menampilkan versi lama sekali lagi, itu berarti HTML-nya sendiri yang masih dari cache — tutup tab / muat ulang penuh sekali; sesudah itu pasangan HTML+CSS terkunci di versi yang sama.

## Perbaikan Animasi Kaki — "Kaki Ga Kayak Jalan" (20 Nov 2026, ±22:50 WIB)

Laporan user: karakter yang bergerak kakinya kaku — meluncur di atas tanah, tidak mengayun seperti orang jalan.

### Penyebab

Di `buatKarakter` (`public/app.js`), kaki hanya dua kotak statis yang ditempel langsung ke grup karakter — tidak pernah dirotasi. Yang dianimasikan selama ini hanya **lengan** (NPC warga di plaza + pemain lain via WebSocket) plus bob badan, jadi badan bergerak maju sementara kaki diam: kesan meluncur.

### Perbaikan (hanya `public/app.js` + versi aset di `public/index.html`; server tidak berubah)

- **Pivot pinggul**: tiap kaki kini grup `THREE.Group` di (±0,16, y=0,5) berisi kotak kaki yang sama digeser −0,25 ke dalam grup — tampilan diam identik (kotak tetap membentang y 0..0,5), tapi kaki bisa berotasi dari pinggul. Referensi disimpan di `userData.kakiK/kakiR` (pola sama seperti `lenganK/lenganR`).
- **Fungsi baru `animasiJalan(kar, jarak, dt)`** dipakai NPC plaza dan pemain lain:
  - Fase ayunan maju mengikuti **jarak tempuh nyata** frame itu (perpindahan posisi NPC di jalur / perpindahan interpolasi pemain lain), bukan waktu — kaki selaras dengan tanah, tidak menggelincir. Panjang siklus langkah membesar saat lari (siklus = maks(2,2; kecepatan/2,2)) sehingga frekuensi terbatasi ±2,2 siklus/detik.
  - Kedua kaki berotasi berlawanan fase dari pivot (amplitudo maks 0,55 rad); lengan mengayun berlawanan fase dengan kaki sesisi (amplitudo 0,4, sama seperti gaya lama) dari fase yang sama.
  - Kekuatan ayunan dirampa eksponensial: naik saat mulai bergerak (target membesar dengan kecepatan), mereda halus ke netral saat berhenti — tidak berhenti mendadak di pose miring. Bob badan kini diturunkan dari fase langkah yang sama (amplitudo sama seperti sebelumnya: 0,06 NPC, 0,07 pemain lain).
  - Lompatan posisi (karakter muncul ulang/teleport) di-clamp 3 satuan/frame agar fase tidak meledak. Pak Kades tidak diubah (diam di tempat, hanya bob seperti sebelumnya); karakter sendiri memang tidak di-render.
- Cache-busting: `app.js?v=3` dan `style.css?v=3` di `index.html` (isi style.css tidak berubah, versi dinaikkan agar konsisten).

### Verifikasi lokal

- `node --check app.js` lulus.
- Harness logika (`/tmp/uji_kaki.js`, mengekstrak fungsi asli dari app.js + stub THREE): **18/18 lulus** — pivot di pinggul & rentang diam kaki tetap y 0..0,5; saat jalan kedua kaki selalu berlawanan tanda; fase maju sebanding jarak (kecepatan 2× → fase 2×; 30fps vs 60fps untuk jarak sama → fase sama); lengan berlawanan fase dengan kaki sesisi; sesudah berhenti ayunan mereda ke ~0 dalam 3 detik secara bertahap; lari 22 satuan/dtk → frekuensi 2,2 siklus/dtk & amplitudo penuh; karakter tanpa kaki dan 200 karakter muncul/hilang tanpa error; teleport ter-clamp.

### Deploy & verifikasi live

- Backup file lama di Hostinger: `/opt/pinarak/bak-kaki/` (app.js + index.html versi `?v=2`). File baru ke `/opt/pinarak/public/` (md5 server = md5 lokal: app.js `60dbbaf8…`, index.html `4337b035…`), `docker compose build app` + `up -d app`; `pinarak-app-1` jalan dengan log start bersih, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** memuat `style.css?v=3` + `app.js?v=3`; `GET /app.js?v=3` **200 byte-identik** dengan file lokal baru dan memuat `function animasiJalan(kar, jarak, dt)`; `/api/statistik` normal (warga 1, rumah 1).

### Batas verifikasi

- Terbukti: logika ayunan dari kode yang sama persis dengan yang tersaji live (byte-identik) + harness jarak/fase di atas. Bukti visual final (kaki benar-benar terlihat mengayun enak dipandang) tetap di HP user — tidak ada headless browser di sandbox.

## Perbaikan Tabrakan Rumah — "Kenapa Bisa Tembus Rumah" (20 Nov 2026, ±23:20 WIB)

Laporan user: di mode 1st Person pemain bisa berjalan menembus rumah.

### Penyebab

Tabrakan pemain (`tabrakanDi`, lingkaran r=0,55 vs AABB) hanya mencakup objek Distrik Pusat (balai, tugu, papan raksasa, ±30 rumah detail) + perabot interior. 98.300 rumah massal adalah InstancedMesh visual murni — di v1 memang sengaja tidak diberi tabrakan. Akibatnya di luar Distrik Pusat semua rumah bisa ditembus.

### Perbaikan (hanya `public/app.js` + versi aset di `index.html`; server tidak berubah)

- **Tabrakan grid matematis `tabrakanRumahMassal(x, z)`** — tanpa membuat 98rb AABB. Tapak diturunkan dari rumus penempatan yang sama dengan `bangunKotaMassal`: dinding `BoxGeometry(8,6 × 7,6)` tepat di pusat kavling tanpa rotasi, jadi AABB = pusat kavling ± (4,3 ; 3,8). Rumah tampil di SEMUA kavling blok perumahan (terisi/belum), jadi tabrakan mengikuti tampilan persis: 3.932 blok × 25 = **98.300 rumah tertabrak**.
- Cara kerja O(1): dari posisi pemain dihitung blok (`floor((x + KOTA_W/2)/PITCH)`) dan kavlingnya; blok RESERVASI (pusat — ditangani AABB lama) dan TAMAN (lahan pembangunan, tanpa rumah massal) dilewati. Hanya kavling pemain + tetangga 1 petak di dalam blok yang sama yang diuji (maks 9 AABB dari pool objek yang dipakai ulang, tanpa alokasi per frame). Itu lengkap secara matematis: dinding kavling sebelah berjarak ≥2,7 dari tepi petaknya dan jalan selebar 14 memisahkan antarblok — jauh melebihi jangkauan lingkaran pemain (r=0,55). Resolusi memakai `tabrakanDi` yang sama (dorong keluar sisi terdekat), jadi perilaku meluncur di dinding sama dengan rumah detail.
- `tabrakan(x, z)` kini = AABB lama + `rintanganFasilitas` lalu grid massal. Interior tetap `tabrakanInterior` sendiri, tidak disentuh.
- **Fasilitas sekalian ditabrak** (tapak mudah dari `MODEL_FASILITAS`): tabel `TAPAK_FASILITAS` relatif ke pusat blok, diisi ke `rintanganFasilitas` oleh `bangunLahanPembangunan` hanya untuk fasilitas berstatus terbangun — perpustakaan (gedung 13×9), sekolah (22×9), puskesmas (15×9,5), pasar (8 kios 8×6), masjid (gedung 15×11 + menara), taman (hanya kolam r=6,5). Lapangan (bidang terbuka, memang dilalui) dan balai warga (pendopo terbuka) sengaja tidak ditabrak.
- **Yang tidak ditabrak (sisa batas)**: atap rumah massal (overhang mulai y≥3,8 — di atas kepala pemain), teras (lantai kayu rendah 0,3 di depan rumah, bisa diinjak), dekorasi kavling (pagar/semak/pohon kecil — hanya di sebagian kavling, berbasis hash).

### Verifikasi lokal

- `node --check app.js` lulus.
- Harness (`/tmp/uji_tabrakan.js`, mengekstrak konstanta + fungsi asli dari app.js): **37/37 lulus**. Bukti sebelum/sesudah dengan koordinat:
  - Tengah rumah dulu tembus (tabrakan lama mengembalikan titik yang sama), kini didorong keluar tapak: blok 1 kav 13 (−3311,−2051) → (−3311,−2046,65); blok 4000 (pojok peta) kav 13 (3325,2065) → (3325,2060,65); blok 2500 kav 13 (−1715,553) → (−1715,548,65); kav 1 & 25 blok yang sama juga tertahan. Dorongan dari pusat persis ke tepi dinding z (dz=4,350 = 3,8+0,55).
  - Mendekat dari barat berhenti persis di wajah dinding (x akhir = minX − r = −1719,850).
  - Meluncur: 12 langkah diagonal di wajah barat → z maju penuh 3,6, x tidak pernah menembus; pendekatan dari sudut → meluncur di wajah selatan, tidak lengket, tidak pernah berakhir di dalam tapak sesudah resolusi.
  - Area bebas tetap bebas persis: jalan tepi blok, persimpangan, koridor antar rumah (jalan lurus lokal z 10→90 tanpa hambatan), plaza (0,20), lahan pembangunan kosong (4,4), lahan fasilitas taman (36,20), lapangan (20,36).
  - Fasilitas: tengah gedung masjid (385,301) → (385,294,95); menara → tertahan; halaman masjid bebas.
  - Interior: `tabrakanInterior` identitas tanpa perabot, tetap menolak perabot, dan mengabaikan rumah massal.
  - Kinerja: 100rb panggilan `tabrakan()` ≈ 484 ms di Node (±4,8 µs/panggilan) — 1 panggilan per frame, aman.

### Urutan deploy (apa adanya — digabung dengan perbaikan warna)

File tabrakan versi `?v=4` sempat terkirim ke `/opt/pinarak/public/` di server (backup versi live `?v=3` di `/opt/pinarak/bak-tabrakan/`, md5 cocok), TETAPI sebelum image dibangun ulang, laporan warna pucat masuk dan user meminta keduanya dikerjakan dalam satu rangkaian. Jadi `?v=4` **tidak pernah dibangun/disajikan**; file final gabungan (tabrakan + warna) dinaikkan versinya ke `?v=5`, dibackup tahapannya di `/opt/pinarak/bak-warna/` (isi: file `?v=4` yang ter-stage), lalu satu kali `docker compose build app` + `up -d app`. Verifikasi live gabungan ada di sub-bagian warna di bawah.

## Perbaikan Warna — "Warna Kotanya Kenapa Kayak Pucat" (20 Nov 2026, ±23:20 WIB)

Laporan user: warna kota terlihat pucat/tercuci di HP — rumah, tanah, dan plaza pastel pudar, plaza hampir putih krem (juga terlihat di tangkapan layar sebelumnya).

### Penyebab (dari kode, berurutan dampak)

1. **Kabut mulai terlalu dekat**: `Fog(0xf6d9a8, 900, 5600)` — kota berskala 6.720×4.200; dari orbit maupun 1st Person hampir semua yang terlihat berjarak >900 sehingga tertutup kabut krem hangat (di jarak 3.000 sudah 45% tertutup, di 4.500 sudah 77%, di 6.100 sudah 100%).
2. **Exposure ACES 1,2** mengangkat semua pastel ke arah putih (plaza 0xcfc4a5 tampak nyaris putih).
3. **Atap rumah belum terisi di-lerp 0,45** ke abu-hijau 0x9db3a4 — saat ini 98.299 dari 98.300 rumah belum terisi, jadi praktis seluruh atap kota pudar. Saturasi contoh atap oranye hanya 0,53.
4. **Ambient hemisphere 0,85** kuat meratakan kontras; palet dinding sendiri pastel nyaris putih (tekstur dinding adalah pengali terang, jadi nilai palet ≈ warna akhir); rumput #7fbd68, jalan #c8b992, dan tanah plaza 0xcfc4a5 semuanya terang.

### Perbaikan (hanya nilai parameter di `public/app.js`; geometri, jumlah instans & opsi kualitas tidak berubah)

| Parameter | Sebelum | Sesudah |
|---|---|---|
| Kabut near / far | 900 / 5.600 | **2.600 / 9.000** (far = far 1st Person; di bawah far Orbit/Drone 13.000) |
| Exposure ACES | 1,2 | **1,05** |
| Hemisphere intensity | 0,85 | **0,62** |
| Matahari (directional) | 1,05 | **1,15** |
| Lerp atap belum terisi | 0,45 | **0,22** |
| Palet dinding (massal + detail) | fdf3d8 d6eaf8 fadbd8 d5f5e3 fdebd0 eaeded | **f9e7bc aed3f2 f5b7b1 a9dfbf f8cf9e d5dbdb** |
| Rumput (tekstur tanah) | #7fbd68 | **#63ac4e** |
| Badan jalan / trotoar | #c8b992 / #e6dcc2 | **#b39d72 / #d9c9a3** |
| Tanah plaza | 0xcfc4a5 | **0xbfae87** |
| Alas lahan pembangunan / hamparan | 0x69b45c / 0x74b364 | **0x57a047 / 0x63ac4e** |

Nuansa golden hour dipertahankan: warna kabut & cahaya tetap hangat, kubah langit tidak diubah; yang dibuang hanya cuciannya.

### Verifikasi lokal

- Harness (`/tmp/uji_warna.js`): **19/19 lulus** — semua nilai baru terbaca dari source, nilai lama hilang, ACES + tangga kualitas utuh, rumah massal tetap 98.300 instans.
- Bukti kuantitatif kabut: jarak 1.200 dulu 6% tertutup → kini 0%; 2.000: 23% → 0%; 3.000: 45% → 6%; 4.500: 77% → 30%; 6.100 (tepi terjauh dari orbit): 100% → 55% (kabur cakrawala tetap ada, kota terbaca).
- Saturasi atap contoh (oranye 0xe67e22 belum terisi): 0,53 → **0,71**.

### Deploy & verifikasi live (gabungan tabrakan + warna, `?v=5`)

- File final ke `/opt/pinarak/public/` (md5 server = lokal: app.js `4b9ebee3…`, index.html `76c729d4…`), `docker compose build app` + `up -d app`; `pinarak-app-1` jalan (log start Go bersih), `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** memuat `style.css?v=5` + `app.js?v=5`; `GET /app.js?v=5` **200 byte-identik** dengan file lokal final dan memuat penanda kedua perbaikan (`function tabrakanRumahMassal`, `Fog(0xf6d9a8, 2600, 9000)`, `toneMappingExposure = 1.05`); `/api/statistik` normal (warga 1, rumah 1).

### Batas verifikasi

- Terbukti: parameter & logika dari file byte-identik yang tersaji live + perhitungan kabut/saturasi di atas. Bukti visual final (warna benar-benar terasa hidup di layar HP, kaki/animasi tidak terpengaruh) tetap di HP user — tidak ada headless browser di sandbox.

## Gameplay: 3rd Person + Minimap (2026-11-20 ±23:50 WIB, `?v=6`)

Meniru rasa gameplay game open-world mobile yang dikagumi user di Threads: karakter terlihat berlari dari belakang + minimap di pojok. Deploy gabungan dengan model karakter low-poly baru (permintaan user "Karakter kenapa bukan low poly 3d") dalam satu kenaikan versi `?v=6`.

### Fitur 1 — Mode 3rd Person

- Tombol baru `🧍 3rd Person` di bar mode: urutan Orbit, 1st Person, **3rd Person**, Drone (`data-mode="ketiga"`).
- Gerak memakai ulang jalur 1st Person persis: langkah diekstrak menjadi `langkahPemain(dt, yawBasis)` (dipakai `updateOrang` dengan fp.yaw dan `updateKetiga` dengan tp.yaw) — tabrakan interior/grid/pusat, jepit batas kota, dan pengiriman posisi WebSocket (120 ms, payload sama) tidak berubah. Yang dikirim sebagai arah hadap di 3rd Person adalah arah BADAN (`tp.hadap + π`), bukan arah orbit kamera, jadi pemain lain melihat karakter menghadap arah jalannya.
- Karakter sendiri dibangun `buatKarakter` dari penampilan sesi (tamu: bawaan hijau/kulit terang/tanpa topi), TANPA label nama di atas kepala sendiri; dibangun ulang hanya bila kunci penampilan berubah. Menghadap arah gerak nyata (lerp sudut sadar lilitan), beranimasi dengan `animasiJalan` yang sama (fase dari jarak tempuh lokal), bob sama seperti pemain lain (0,07), skala 1,35 sama.
- Kamera: di belakang + atas karakter (jarak bawaan 6,5 bisa pinch/wheel 4–12, tinggi dari pitch bawaan 0,32 → ±3,5). Drag memutar yaw/pitch mengelilingi karakter (pitch dibatasi −0,1..1,15, tidak menembus tanah). Pelicinan eksponensial (k = 1−e^(−dt·11)); bila titik ideal menyusut karena tabrakan, kamera menempel seketika (tidak menembus dinding lalu memantul).
- Tabrakan kamera: titik ideal diuji bertahap (jarak penuh, 75%, 50%, 30%, 15%) memakai uji `tabrakan()` yang ada (tapak rumah massal + pusat + fasilitas); titik bebas pertama dipakai. Kamera tidak lagi masuk ke dalam rumah saat membelakangi dinding.
- Interior: masuk dari 3rd Person tetap bisa (ketuk rumah sendiri & chip 📍 sama seperti mode lain); di dalam tetap terkunci 1st Person; `interiorKonteks.modeSebelum` mencatat mode asal dan keluar mengembalikan ke 3rd Person tepat di pintu (posisi mulai TIDAK di-reset ulang — ditangani flag `pulihInterior` di `aturMode`).
- Titik mulai sama seperti 1st Person (depan rumah sendiri menghadap rumah / plaza menghadap balai). Near/far kamera mode ini 0,3/9.000.

### Fitur 2 — Minimap + Peta Besar

- Canvas 2D 120×120 (di layar pendek ≤480px: 88×88) di kanan bawah, sudut membulat, latar agak transparan, penanda "U" (utara). Menampilkan radius ±300 satuan di sekitar pemain dari data grid yang sama dengan dunia 3D (perumahan, jalan antar-blok, plaza, lahan & fasilitas pembangunan) — bukan gambar tempelan.
- Lapisan statis kota di-render SEKALI ke canvas offscreen (dua skala: 0,125 untuk minimap → 840×525, 0,2 untuk peta besar → 1.344×840); per frame hanya `drawImage` viewport yang mengikuti pemain (di-clipping manual supaya tetap tajam) + penanda dinamis: panah pemain berputar sesuai arah hadap per mode, titik emas rumah sendiri (bila dalam radius), titik merah Balai Desa, titik biru pemain online lain (dari data WebSocket yang sudah ada), fasilitas terbangun berwarna teal vs lahan cokelat muda.
- Ketuk minimap → overlay peta besar seluruh kota dengan penanda yang sama + legenda; tutup via ✕ atau ketuk latar. Di landscape pendek lebar kartu dibatasi 460px supaya tidak scroll panjang.
- Penempatan: tampil di 1st Person, 3rd Person, Drone; sembunyi di Orbit dan selama di interior. Di mode Drone bergeser ke `right: 86px` agar tidak menimpa tombol naik/turun; offset kanan menghormati `safe-area-inset-right` (notch samping landscape).

### Sub-bagian: Model Karakter Low-Poly

- **Sebelum:** tumpukan primitif polos — kaki kotak abu lurus, badan silinder satu warna, lengan kotak miring statis (berputar dari tengah lengan), kepala bola polos tanpa wajah, peci silinder, topi kerucut.
- **Sesudah (`buatKarakter` ditulis ulang, prosedural, tanpa file model eksternal):** proporsi manusia — kaki bercelana (silinder 6-sisi meruncing) + SEPATU kotak berujung ke depan (+z, arah hadap); torso meruncing bahu 0,34 → pinggang 0,26, dipipihkan z 0,8, + sabuk; lengan BERSEGMENT berpivot di BAHU (atas berbaju + bawah berkulit, miring keluar 0,12); leher; kepala berwajah (2 mata + senyum tipis di sisi +z); varian: peci silinder meruncing hitam, topi kubah + lidah, polos = rambut belahan bola. Total 16 mesh/karakter. Pak Kades & NPC memakai pembangun yang sama (Kades tetap peci + baju cokelat batik `#6e4525`).
- **Keputusan warna celana:** skema data server TIDAK diubah. Warna celana & topi diturunkan deterministik di klien dari hash warna baju warga (palet celana 5 warna netral: slate/navy/cokelat/olive/arang; palet topi 4 warna) — semua klien menghitung hasil yang sama untuk warga yang sama.
- **Pivot & tanah:** kontrak `animasiJalan` dipertahankan — kaki pivot pinggul (sekarang y=0,52), lengan pivot bahu; telapak sepatu tepat y=0 saat diam (karakter tidak melayang/tenggelam); celupan ujung sepatu pada ayunan puncak ≤ 0,7 cm sesaat.
- **Dampak kinerja:** geometri (14 jenis) & material dibagi lewat cache (`geoKarakter()` + `matKarakter()`, dicatat di `SUMBER_BERSAMA`); `buangGrup` diubah melewati sumber bersama agar menghapus satu karakter tidak membuang geometri/material yang masih dipakai karakter lain (label & gelembung tetap dibuang seperti biasa). Batas render 50 pemain terdekat tidak berubah; tidak ada tekstur baru per karakter dari model ini.

### Verifikasi lokal

- `node --check app.js` lulus.
- Harness baru `/tmp/uji_3rdminimap.js`: **95/95** — matematika kamera belakang (6 yaw: selalu di belakang, jarak 3D tepat), langkah relatif yaw kamera + tertahan dinding, transisi mode termasuk pulang-pergi interior dari 3rd Person (mode terkunci di dalam, kembali ke ketiga di pintu, posisi tidak ter-reset), minimap tampil/sembunyi per mode + offset drone, animasiJalan pada karakter sendiri (mengayun saat jalan, mereda saat diam), koordinat dunia→minimap/peta (tengah, 4 arah mata angin, pojok kota, titik jauh tersaring), rotasi panah 4 arah, konsistensi semua id DOM, dan **anggaran dimensi landscape 800×360 dari nilai CSS nyata** (minimap 88px tidak menimpa bar mode/joystick/tombol drone/zona atas; zona atas kolom kiri 86px vs joystick mulai y=122).
- Harness baru `/tmp/uji_karakter.js`: **52/52** — struktur model (kepala+wajah, leher, torso meruncing, sabuk, lengan bersegmen, kaki+sepatu, varian peci/topi/rambut, Pak Kades), telapak tepat y=0, pivot animasi benar (kaki berlawanan fase, lengan berlawanan kaki sesisi, mereda ke 0), warna turunan deterministik dari palet, geometri/material benar-benar dibagi (objek identik antar karakter), `buangGrup` aman.
- Regresi: `uji_kaki` **19/19** (cek struktur disesuaikan ke model baru, cek animasi tetap), `uji_tabrakan` **37/37**, `uji_warna` **19/19**. Total 222 cek lulus.

### Deploy & verifikasi live

- Backup file live lama → `/opt/pinarak/bak-3rdminimap/` di Hostinger. File baru disalin (md5 server = lokal: index.html `cc574e1a…`, style.css `8c40e586…`, app.js `0ce115d3…`), `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain (Coolify, Merdu, dll.) tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** memuat `style.css?v=6` + `app.js?v=6`; `GET /app.js?v=6` **byte-identik** dengan lokal dan memuat penanda `updateKetiga`, `gambarMinimap`, `geoKarakter`, `buatKarakter`; `style.css?v=6` byte-identik; index tersaji utuh (selisih satu-satunya = script challenge yang disisipkan proxy Cloudflare); `/api/statistik` normal (warga 1, rumah 1).

### Sisa batas

- Bukti visual final tetap di HP user (tidak ada headless browser di sandbox): rasa pelicinan kamera 3rd Person, keterbacaan minimap, dan wajah/proorsi model baru hanya bisa dinilai di layar nyata. Yang terbukti dari sini: logika, matematika, struktur model, dan file byte-identik yang tersaji live.
- Di 3rd Person pemain tidak bisa melihat wajah karakternya sendiri kecuali memutar kamera ke depan (drag) — sesuai konvensi genre.
- Minimap tidak berputar mengikuti kamera (utara selalu di atas); yang berputar hanya panah pemain — disengaja supaya peta mudah dibaca.

## Model Karakter Ronde 2: Faset + Wajah (2026-11-21 ±00:05 WIB, `?v=7`)

User membandingkan screenshot game dengan gambar referensi Pak Kades low-poly dan berkomentar "Beda banget" — benar: dua celah ditutup di `buatKarakter` (`public/app.js`), tanpa menyentuh server, mode kamera, atau fitur lain.

### Celah 1 — Bahasa bentuk: kepala bola mulus → berfaset nyata

- **Sebelum:** kepala `SphereGeometry(0.33, 10, 8)` — terbaca seperti boneka tanah liat/balon, bukan low-poly.
- **Sesudah:** kepala `IcosahedronGeometry(0.44, 1)` (80 faset segitiga struktural) diskalakan elipsoid (0,92 / 1,02 / 0,88) menyerupai kepala. Faset kini dari geometrinya sendiri, bukan sekadar flag.
- Material karakter memang sudah `flatShading: true` lewat pabrik `M()` (dipakai `matKarakter`) — ronde ini membuktikannya dari sumber di harness (M diekstrak asli dari app.js, bukan stub) dan menegaskan tidak ada material karakter yang lolos tanpa flatShading.
- Geometri pendukung wajah juga segmen rendah (bola 8×6 / 7×5 / 6×5, kerucut 4-sisi, torus 5×9, lingkaran 9) supaya satu bahasa bentuk.

### Celah 2 — Wajah: garis tertutup → wajah referensi

Semua bagian menempel di permukaan elipsoid kepala (Rx 0,405 / Ry 0,449 / Rz 0,387), di sisi +z (arah hadap):

- **Mata besar terbuka:** putih mata (bola pipih, skala 1 / 1,28 / 0,5) + pupil gelap + highlight putih kecil, urutan z tegas (putih 0,345 < pupil 0,372 < highlight 0,390).
- **Alis:** kotak tipis miring (ujung dalam lebih rendah), di atas mata.
- **Hidung:** kerucut 4-sisi menunjuk +z di antara mata dan mulut.
- **Telinga:** bola pipih di kedua sisi kepala (|x| 0,40, z≈0).
- **Mulut:** busur torus setengah diputar menjadi senyum U (menggantikan kotak "senyum tipis" lama).
- **Pipi merona:** dua lingkaran pipih merah muda `0xf2a097`, material lewat cache `matKarakter` yang sama + `polygonOffset` (−2/−2) anti z-fighting, dimiringkan mengikuti permukaan.

### Proporsi chibi ringan + yang dipertahankan

- Kepala ±1,33× lebih besar (r efektif 0,33 → 0,44); torso diperpendek 0,74 → 0,62 dan sedikit dilebarkan (bahu 0,35 / pinggang 0,27); pivot bahu turun 1,26 → 1,14; grup kepala di y=1,30, pusat kepala abs 1,54.
- **Tinggi total praktis sama:** puncak kepala 1,99 vs 1,97 model lama (+1%, dalam ±5%) — framing kamera 3rd Person & titik mata tidak berubah. Dengan peci: 2,02.
- Leher dilepas (dasar kepala yang besar menembus puncak torso 1,16 — leher tidak akan terlihat) dan sabuk dilepas (tak terbaca pada torso pendek bergaya kemeja referensi). Mesh per karakter 16 → **25** (tambahan murni bagian wajah + telinga; semua varian tetap 25).
- Peci digedein mengikuti kepala (silinder 0,335/0,378 × 0,28, abs y 1,88, menutup puncak kepala, tepi bawah di atas alis); topi menjadi kubah dangkal (thetaLength 0,35π, tepi di atas alis) + lidah lebih lebar; rambut belahan bola diperbesar (r 0,458, thetaLength 0,42π) dan dimiringkan ke belakang (−0,3 rad) supaya tidak menutupi wajah.
- Dipertahankan persis: kaki + sepatu (telapak tetap tepat y=0), pivot pinggul/bahu & kontrak `animasiJalan`, warna celana/topi turunan deterministik, cache geometri/material bersama + keamanan `buangGrup` (`SUMBER_BERSAMA`), batas render pemain, data penampilan server.

### Verifikasi lokal

- `node --check app.js` lulus.
- `/tmp/uji_karakter.js` ditulis ulang untuk ronde 2: **71/71** — struktur wajah lengkap (15 cek posisi wajah: semua bagian wajah terbukti di sisi +z dari tanda koordinat terhadap arah hadap, telinga terbukti di sisi), kepala ikosahedron detail ≤1, flatShading pada SEMUA material karakter dari M asli, puncak kepala 1,99 dalam ±5%, peci menutup puncak & di atas alis, tepi kubah topi di atas alis, telapak y=0, pivot animasi berlawanan fase, cache bersama & `buangGrup` aman.
- Regresi: `uji_kaki` **19/19** (stub THREE ditambah kelas geometri baru), `uji_3rdminimap` **95/95** (cek versi aset diperbarui ke v=7), `uji_tabrakan` **37/37**, `uji_warna` **19/19**. Total **241 cek lulus**.

### Deploy & verifikasi live

- Backup file live lama → `/opt/pinarak/bak-wajah/` di Hostinger. File baru disalin (md5 server = lokal: app.js `ab8d8572…`, index.html `d968a06c…`; style.css tidak berubah, md5 identik `8c40e586…`), `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `https://pinarak.mfah.me/` **200** memuat `style.css?v=7` + `app.js?v=7`; `GET /app.js?v=7` **200 byte-identik** dengan lokal dan memuat penanda `IcosahedronGeometry(0.44, 1)`; `/api/statistik` normal (warga 1, rumah 1).

### Sisa batas

- Bukti visual final tetap di HP user (tidak ada headless browser di sandbox): ketajaman faset kepala, keterbacaan wajah dari jarak main, dan duduknya peci/topi/rambut pada geometri ikosahedron (penempatan dihitung dari pendekatan elipsoid) hanya bisa dinilai di layar nyata. Yang terbukti dari sini: struktur model, posisi relatif wajah terhadap arah hadap, matematika proporsi, dan file byte-identik yang tersaji live.

## KTP Rapi + Foto 3D (2026-11-21 ±00:35 WIB, `?v=8`)

User mengirim screenshot KTP-nya: "Ga rapih dan belum low poly 3d". Dua masalah ditutup di `?v=8` (gabung dengan Perbaikan Chat di bawah — satu kenaikan versi, satu backup `/opt/pinarak/bak-ktp/`).

### Masalah 1 — Layout KTP tidak rapi

- **NIK pecah baris** ("…000000" / "1"): sekarang ditampilkan berkelompok 4-4-4-4 lewat `kelompokkanNomor()` ("3201 2611 2000 0001") — nilai mentah server tidak berubah, hanya tampilan — plus `#ktp-nik { white-space: nowrap }` dan ukuran huruf dihitung muat (clamp 11px/3,2vw/20px, letter-spacing 0).
- **Label pecah** ("No." / "Rumah") & kolom tidak sejajar: kolom label kini lebar tetap `clamp(58px, 24%, 100px)` + `nowrap`; kotak foto disempitkan 27% → 24% dan padding panel data 4,2% → 3% supaya kolom nilai lega di lebar HP 320–430px. Anggaran lebar dihitung dari nilai CSS nyata di harness (faktor glyph konservatif 0,60em): NIK muat 1 baris di 320/360/430px, label terpanjang ("Terdaftar") muat di kolomnya di semua lebar itu juga (lantai label 58px + font baris dibatasi 2,8vw/16px sesudah uji pertama menemukan label kalah lebar di 430px).
- **Strip bawah terpotong elipsis** ("@desa…"): elipsis dibuang; teks sama ditampilkan utuh dengan font `clamp(7,5px, 2vw, 12px)` + letter-spacing 0,3px, strip direntangkan selebar kartu & teks di tengah — lebar teks terhitung ≤ ruang tersedia di 320–430px.
- **PNG unduhan** mengikuti layout yang sama: NIK berkelompok; semua nilai ditulis via `teksPas()` (huruf menyusut otomatis sampai muat kolom nilai 462px — terbukti: NIK tetap 39px/445px, username 28 karakter menyusut 32→26px).
- **KK sekalian diperiksa:** tidak ada potret di KK. No. KK & NIK anggota kini berkelompok 4 digit di panel keluarga, dokumen KK (DOM, `#kk-nokk` nowrap), dan PNG KK — tidak ada lagi angka 16 digit yang pecah di tengah.

### Masalah 2 — Foto 2D datar → render 3D asli

- `gambarPotretKTP()` (canvas 2D, topi jadi segitiga kerucut) DIHAPUS total beserta pembantunya `terangGelap()` — tidak ada lagi rujukan ke gambar 2D lama.
- Pengganti: `renderFoto3D(rupa)` — renderer Three.js kecil TERPISAH dibuat sekali (konteks WebGL tambahan hanya satu, 320×440, `preserveDrawingBuffer`), dipakai ulang; scene berisi SATU karakter dari `buatKarakter()` dengan data penampilan warga itu (baju/kulit/topi), cahaya meniru desa (hemisphere 0xffe7c4/0x86a860 0,62 + directional 0xffc384 1,15 dari kiri-atas-depan), ACES + sRGB sama seperti renderer utama, latar krem polos 0xf5ecd7. Kamera (0, 1,54, 1,9) menatap (0, 1,44, 0): potret dada-ke-atas, wajah di sisi +z, karakter diam. Karakter dibersihkan via `buangGrup` sesudah render (sumber bersama aman).
- Hasil render → dataURL → dilukis ke kanvas foto DOM (`lukisFotoKartu`) dan ke canvas PNG unduhan (kotak foto yang sama 306×404; `gambarKTPKeCanvas` kini Promise, `unduhKTP` menunggu foto selesai). Cache `cacheFoto3D` per kunci penampilan (baju|kulit|topi): penampilan sama tidak dirender ulang; berubah → render baru.
- Fallback: WebGL/render gagal → `renderFoto3D` mengembalikan null → placeholder krem polos tergambar, kartu tetap terbuka (bukan gambar 2D lama).

### Verifikasi lokal

- `node --check app.js` lulus.
- Harness baru `/tmp/uji_ktp.js`: **42/42** — perilaku `kelompokkanNomor` (16 digit, sisa kelompok, "—", null), perilaku foto 3D dengan stub (render 1x, cache bekerja, `buatKarakter` menerima data penampilan yang benar, karakter dibuang rapi, instans baru dengan WebGL rusak → null + placeholder + selesai tepat 1x), integrasi sumber (potret 2D hilang, tepat 2 WebGLRenderer, semua titik pakai), dan anggaran lebar CSS nyata (NIK/label/strip di 320/360/430px).
- Regresi: `uji_karakter` 71/71, `uji_3rdminimap` 95/95 (ekspektasi versi diperbarui ke v=8), `uji_tabrakan` 37/37, `uji_kaki` 19/19, `uji_warna` 19/19. Total dengan harness chat di bawah: **304 cek lulus**.

### Sub-bagian: Perbaikan Chat — Reconnect (laporan user "Ga bisa kirim chat")

**Diagnosa (dibuktikan, bukan ditebak):**
- *Server sehat.* Uji live dengan warga uji sekali-pakai di produksi (daftar → WS → kirim → klien kedua → sambung ulang): sambutan Pak Kades untuk warga itu ADA di riwayat, pesan terpantul ke pengirim, diterima klien tamu kedua, dan tersimpan di riwayat sesudah reconnect — 7/7 sebelum deploy, 8/8 sesudah deploy `?v=8`. Warga uji + sesi + chat + sambutannya dihapus sesudah tiap uji; statistik kembali warga 1.
- *Klien punya reconnect, tapi punya lubang fatal.* `sambungWS()` lama menjadwalkan retry tetap 3 detik dari `onclose` — TETAPI tidak ada pengawas untuk soket yang menggantung di CONNECTING: penjaga `sambungWS` menolak percobaan baru selama `readyState === 0`, dan jabat tangan WS yang tertahan proxy saat container app di-restart (jendela deploy `?v=7` ±00:01; jalur Cloudflare↔origin memang glitch di jendela itu — selama diagnosa ini pun terlihat satu 525 sesaat sementara origin dari dalam sehat) tidak pernah memicu open/error/close. Akibatnya: tidak ada `sambutan` yang pernah diproses → riwayat KOSONG total (persis screenshot user), dan tiap kirim berhenti di `readyState !== 1`. Halaman user sudah terbuka dari sebelum restart — cocok penuh.
- *Kirim saat putus nyaris tanpa jejak:* pesan ditolak dengan catatan kecil yang hilang sendiri dalam 3,5 detik; tidak ada antrean, tidak ada status menetap.

**Perbaikan (klien saja, server Go tidak berubah):**
- Backoff bertingkat **1s → 2s → 5s → 10s** (mentok, reset tiap berhasil tersambung) menggantikan retry tetap 3 detik.
- **Pengawas CONNECTING 8 detik:** soket yang masih CONNECTING sesudah 8 detik ditutup paksa → `onclose` menjadwalkan percobaan berikut. Ini penutup lubang di atas.
- **Antrean pesan (keputusan: tahan & kirim otomatis, maks 5):** kirim saat terputus tidak dibuang — pesan masuk `antreChat`, input dibersihkan, catatan menjelaskan pesan disimpan; saat `onopen`, `kosongkanAntreChat()` mengirimnya berurutan. Hanya pesan yang tidak pernah mencapai soket OPEN yang diantrekan (send yang melempar di soket OPEN pun diantrekan) → tidak ada kiriman ganda. Antrean penuh → pesan ditahan di input dengan penjelasan.
- **Status koneksi menetap, kecil:** `#chat-catatan` kini sadar koneksi — terputus: "Menyambung ulang ke desa…" (+ jumlah pesan menunggu bila ada); tersambung: teks biasa. Bukan banner.
- **Sambung segera saat tab terlihat lagi / jaringan kembali** (`visibilitychange` + `online`): reset backoff & coba saat itu juga — timer HP dibekukan saat tab tidak aktif, tanpa ini reconnect terasa lama.
- Anti dobel: listener form tetap terdaftar sekali (bukan per koneksi); riwayat dibangun ulang dari `sambutan` tiap tersambung; flush antrean hanya di `onopen` soket berjalan dan tiap pesan digeser keluar antrean tepat sekali — diuji reconnect 2x: total pesan terkirim tetap sama.
- Harness baru `/tmp/uji_chat.js`: **21/21** — mesin keadaan reconnect dengan WebSocket & timer palsu: pengawas 8s menutup CONNECTING menggantung, urutan backoff persis [1000, 2000, 5000, 10000, 10000], flush antrean berurutan sekali, backoff reset, `sambungUlangWS` seketika.

**Soal latar hitam di screenshot yang sama:** BUKAN bug panel/kode — panel chat hanya kartu kecil krem (84vw × 58vh) tanpa lapisan penggelap; loop render tidak pernah dijeda oleh panel/kartu; adegan tidak punya keadaan malam (langit & kabut golden-hour tetap, tidak pernah hitam). Kanvas yang hitam pekat di Chrome Android adalah tanda konteks WebGL hilang (GPU direset di bawah tekanan memori) — Three r128 meminta restore otomatis, tapi proses GPU yang mati untuk tab itu hanya pulih dengan muat ulang halaman. Tidak ada perbaikan kode yang dikarang untuk ini; muat ulang halaman memulihkannya.

### Deploy & verifikasi live

- Backup file live lama → `/opt/pinarak/bak-ktp/`. File baru md5 server = lokal: index.html `39d03a36…`, style.css `24d7009c…`, app.js `3df68285…`; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=8` + `app.js?v=8`; `app.js?v=8` & `style.css?v=8` **byte-identik** dengan lokal dan memuat penanda `renderFoto3D`, `LANGKAH_BACKOFF`, `antreChat`; `/api/statistik` normal (warga 1, rumah 1) sesudah pembersihan warga uji terakhir.

### Sisa batas

- Bukti visual final tetap di HP user (tidak ada headless browser di sandbox): kerapian KTP pada lebar layarnya, keterbacaan NIK berkelompok, dan hasil render foto 3D (framing dada-ke-atas dihitung dari proporsi model; distorsi regang kecil mungkin ada karena aspek kotak foto DOM ~0,67–0,70 vs render 0,727) hanya bisa dinilai di layar nyata.
- Renderer foto adalah konteks WebGL kedua yang hidup selama halaman terbuka (kecil, 320×440) — di HP sangat lemah ini menambah sedikit memori GPU; fallback placeholder menutup kegagalannya.
- Reconnect membuktikan diri terhadap server yang sehat; skenario jabat tangan menggantung dibuktikan di harness (timer/soket palsu), bukan dengan mematikan produksi.

---

## Perbaikan Chat Ronde 2 — akar masalah: GUID WebSocket salah di server (21 Nov 2026, ±09:07–10:15 WIB)

### Gejala
Chat tidak pernah tersambung dari browser user (HP): panel menampilkan "Menyambung ulang ke desa…", riwayat kosong, pesan mengantre selamanya. HTTPS, login, statistik, dan dunia 3D normal. Semua uji non-browser (klien Python mentah dari sandbox & X99, lewat Cloudflare maupun langsung ke origin) selalu lulus — kegagalan hanya terjadi dari browser sungguhan.

### Akar masalah (terbukti)
Konstanta GUID WebSocket di server salah tulis sejak versi Python dan terbawa ke port Go: `internal/ws/ws.go` memakai `258EAFA5-E914-47DA-95C5-C59AB0D41F2D`, sedangkan GUID RFC 6455 §4.1 yang benar adalah `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`. Akibatnya `Sec-WebSocket-Accept` yang dihitung server tidak pernah cocok dengan yang diharapkan browser, dan browser membatalkan jabat tangan sebelum satu frame pun dipertukarkan. Seluruh perangkat uji buatan sendiri memakai GUID yang sama-sama salah, jadi uji-uji itu "lulus" secara konsisten semu — pelajaran: uji jabat tangan WS wajib memakai browser sungguhan atau pustaka standar, bukan klien tulisan tangan.

### Bukti rantai diagnosa
- Netlog Chrome 149 headless di X99 (mode IncludeSocketBytes) saat membuka `wss://pinarak.mfah.me/ws`: server menjawab 101, tetapi Chrome menutup dengan pesan verbatim `Error during WebSocket handshake: Incorrect 'Sec-WebSocket-Accept' header value` (`WEBSOCKET_UPGRADE_FAILURE`, `ERR_INVALID_RESPONSE`).
- Uji A/B lokal di X99: server mentah Python yang menjawab accept persis rumus RFC versi lama tetap ditolak Chrome dengan pesan yang sama; server Node memakai paket standar `ws` DITERIMA Chrome (`open` + frame mengalir). Dump proxy TCP menunjukkan respons 101 paket `ws` memakai GUID `…95CA-C5AB0DC85B11`.
- Verifikasi silang tiga sumber resmi yang diambil langsung: teks RFC 6455 dari rfc-editor.org, sumber Chromium tag 149.0.7827.114 (`kWebSocketGuid`), dan paket `ws` dari registry.npmjs.org — ketiganya `258EAFA5-E914-47DA-95CA-C5AB0DC85B11`.
- Lapis lain dibebaskan dengan bukti: respons 101 dari app langsung (127.0.0.1:8026) dan lewat Traefik bersih; Cloudflare meneruskan jabat tangan (header tambahan `Connection: upgrade, close` tidak melanggar validasi Chrome — terkonfirmasi dari sumber Chromium `ValidateConnection`); kode klien `sambungWS` (?v=8) membangun URL/token dengan benar.

### Perbaikan
- `goserver/internal/ws/ws.go`: GUID diganti ke nilai RFC yang benar. `server.py` lawas diperbaiki sama (konsistensi, tidak terdeploy).
- Klien tidak berubah → versi aset tetap `?v=8`, tidak ada kenaikan versi.
- Build di sandbox (Go 1.23.4, `CGO_ENABLED=0 GOOS=linux GOARCH=amd64`, statis; gofmt + `go vet` bersih), binary md5 `1c3ebc9cd3c144c69df820365e2d0c8c`. Deploy runtime COPY-saja ke Hostinger: backup binary lama di `/opt/pinarak/bak-chat2/pinarak`, `docker compose build app` + `up -d app`; `pinarak-db-1` tidak disentuh, layanan lain tidak terpengaruh. Log start bersih: "Desa Pinarak (Go) jalan di 0.0.0.0:8026".

### Bukti keberhasilan (browser sungguhan, jalur publik)
- Uji tetap fixed-key dari sandbox: server kini menjawab accept yang COCOK dihitung dengan GUID yang benar.
- Chrome headless sungguhan di X99 via CDP membuka `https://pinarak.mfah.me`, login token warga uji: event `Network.webSocketHandshakeResponseReceived` status **101** untuk `wss://pinarak.mfah.me/ws?token=…`; riwayat chat termuat di `#chat-log` (8 pesan, termasuk sambutan Pak Kades); garis status "Chat sebagai @uji.chat.fix · maks 200 karakter"; pesan "halo desa, uji chat sesudah perbaikan" dikirim lewat form asli → frame terkirim tercatat di CDP → siaran balik server diterima → pesan tampil di `#chat-log`. Frame posisi dan detak jantung ikut mengalir dua arah.

### Pembersihan
- Warga uji `@uji.ws.pub2` (yatim dari diagnosa ronde sebelumnya) dan `@uji.chat.fix` (warga uji ronde ini) dihapus beserta sesi, pesan chat, dan sambutannya (transaksi SQL: sesi 2, chat 7, warga 2 terhapus). Keluarga @thefahmihassan tidak disentuh.
- Statistik akhir terverifikasi: `{"warga":1,"rumah":1,"terisi":1}` — hanya @thefahmihassan, Rumah No. 1.
- Server uji lokal di X99 (port 8901/8931/8932) dimatikan; perangkat diagnosa tersimpan di `~/workspace/wsdiag/` (termasuk `cdp_final.py`, `logproxy.py`, `ab_server.py`, `ws_server.js`, `hst_put.py`).

## Perapian 3D: Zonasi + Jalan + Plaza (2026-11-21 ±09:25 WIB, `?v=9`)

User memilih "Rapikan total: palet zonasi + jalan & plaza" (meniru kerapian 3D Jetschool: satu gaya konsisten, semua tertata). Hanya klien yang berubah (`public/app.js` + `index.html`); server Go tidak disentuh. Semua pola & palet deterministik dari indeks grid (tanpa Math.random) — tampilan sama di semua klien & kunjungan.

### 1. Palet per zona (dampak terbesar)

- Warna rumah massal tidak lagi acak per rumah dari `PALETA_ATAP`/`PALETA_DINDING` (kedua konstanta itu dihapus; dulu 8 atap + 6 dinding dipilih hash per rumah → karpet tabrakan warna). Sekarang diturunkan dari **zona RW bloknya** — pembagian RW yang sama persis dengan server (`WilayahDariBlok` di Go: RW = kelompok 20 kolom-blok × 10 baris-blok → 20 zona). Fungsi klien baru `zonaDariKolBar(kol, bar)` (0-based = RW − 1) diverifikasi setara formula Go pada sampel blok + kasus `db_test.go` (blok 101 → RW 2).
- Tiap zona satu keluarga warna: hue basis menyapu spektrum perlahan (langkah 0,045 ≈ 16,2° per zona — tetangga bergeser halus, zona jauh kontras). Atap: `warnaAtapZonaHSL` = hue zona ±0,015, saturasi 0,58, lightness 0,46 ±0,035. Dinding: `warnaDindingZonaHSL` = pastel sekeluarga (hue sama, saturasi 0,42, lightness 0,80 ±0,025). Jitter per rumah dari hash nomor rumah — tetap hidup, tidak keluar keluarga.
- Rumah terisi: identitas pemilik dipertahankan persis seperti sebelumnya — atap = warna baju pemilik bila tercatat (`warnaPemilik`, ≤2.000 warga pertama, dicek sebelum jalur zona); terisi tanpa catatan warna memakai warna zona penuh; belum terisi memakai warna zona + lerp 0,22 ke `0x9db3a4` (pembeda terisi/kosong dari perbaikan warna dipertahankan).
- Rumah detail Distrik Pusat: tidak lagi siklus 5 warna acak (`ATAPD`/`DIND` dihapus) — memakai keluarga zona pusat (`zonaDariKolBar(39,24)` = zona 9) dengan jitter per indeks rumah.

### 2. Jalan ditata

- Pohon & lampu berderet pada **interval tetap 42** di trotoar sisi kavling (titik tanam 15,2 dari awal strip jalan; strip jalan 0..14, tepi rumah mulai ±16,7) sepanjang jalan antar-zona: vertikal di tepi blok kolom 0/20/40/60, horizontal di tepi blok baris 0/10/20/30/40 (batas-batas RW). Pohon fase +35, lampu fase +17 → selang-seling teratur. Posisi dari fungsi murni `elemenJalan()`; kawasan pusat (|x|<182, |z|<98 — blok cadangan + plaza) dikecualikan karena sudah ditata sendiri.
- Hasil: **1.195 pohon jalan + 1.196 lampu jalan**, masing-masing 2 InstancedMesh (batang+daun; tiang+kepala lampu beremisi hangat). Terdaftar di `IM_LINGKUNGAN` → ikut kepadatan kualitas; kandidat terurut hash supaya penipisan merata. Diverifikasi: tidak satu pun di dalam tapak rumah (AABB 8,6×7,6 + tepi; jarak terdekat ke pusat kavling 5,80 persis geometri trotoar) dan interval di tiap jalan konstan kelipatan 42.
- Tabrakan tidak berubah sama sekali: `tabrakanRumahMassal` & `TAPAK_FASILITAS` utuh; dekorasi jalan tidak ditabrak, sama seperti dekorasi kavling.

### 3. Plaza & pusat rapi

- Tugu diseragamkan ke palet balai: badan krem balai `0xfdf3d8` (dari `0xe8e0cc`) + sabuk terakota `0xb5533c` (warna balok balai).
- Dekorasi baru simetris terhadap sumbu plaza: 4 bangku `bangkuTaman` berpasangan di (±24, 28) menghadap balai & (±24, 2) menghadap jalur; 6 pohon pot terakota `0xb5533c` di (±52, 28), (±52, 2), (±10, −20). Tanpa rintangan baru (perlakuan sama seperti pohon plaza lama). Fasilitas Pembangunan Bertahap tidak disentuh.

### 4. Dekorasi kavling berpola

- Pemilihan kavling berdekorasi diganti dari ambang hash (terbaca acak) ke `polaKavling(kx, kz, blokNomor)` — pola modular per posisi kavling + geser per nomor blok: pagar `(kx+kz+blok%3)%4==0`, semak `(2kx+kz+blok%2)%3==0`, pohon `(kx+3kz+blok)%7==0`. Sisi semak/pohon & rotasi kini mengikuti posisi kavling (bergantian teratur), bukan hash. Kepadatan dipertahankan: pagar 25,3% (lama 28%), semak 34,0% (lama 32%), pohon 14,3% (lama 14%). Mekanisme penipisan kualitas tidak berubah (kandidat tetap diurutkan hash, `.count` dipotong `PARAM.kepadatan`).

### 5. Minimap

- `gambarBlokPeta`: blok perumahan tidak lagi dua hijau acak — diwarnai `warnaZonaPeta(zona, terang)`: hue zona yang sama dengan kota 3D (saturasi 45%, lightness 53%/60% bergantian papan-catur halus per (kol+bar)). Peta kini jujur: 20 kawasan warna kota terbaca juga di minimap & peta besar. Kunci `WARNA_PETA.rumah/rumah2` dibuang.

### Perubahan jumlah instans (kepadatan penuh)

| Mesh | Sebelum | Sesudah |
|---|---|---|
| Pagar kavling | 27.450 | 24.902 |
| Semak kavling | 31.506 | 33.452 |
| Pohon kavling (×2 mesh) | 13.739 | 14.043 |
| Pohon jalan (×2 mesh) | — | 1.195 |
| Lampu jalan (×2 mesh) | — | 1.196 |
| **Total instans dekorasi** | **86.434** | **93.622 (+8,3%)** |

Draw call dekorasi bertambah 4 (mesh jalan). Tangga kualitas & kepadatannya tidak berubah (0,25/0,5/0,75/1) — semua mesh baru ikut diskalakan.

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_rapi.js`: **42/42** — ekuivalensi zona↔RW Go; keluarga hue per zona (20 zona × 40 sampel, atap & dinding); determinisme & kepadatan pola; elemen jalan deterministik, interval konstan, nol di kawasan pusat, nol menabrak tapak rumah; minimap memakai palet zona; regresi fungsi murni lama (`posisiKavling(1,13) = (−3311,−2051)`, `posisiKavling(4000,25) = (3353,2093)`, `duniaKeMinimap`, `rotasiPanah`, tangga kualitas).
- Harness integrasi `/tmp/uji_rapi3d.js`: **9/9** — `bangunKotaMassal()` asli dijalankan dengan three.min.js asli: grup kota 14 InstancedMesh; **seluruh 98.300 warna dinding di buffer instans terbukti masuk keluarga hue zonanya**; atap rumah No. 1 = warna pemilik uji `#123456`; atap rumah kosong No. 50.000 dekat hue zonanya sesudah lerp pudar; 4 mesh jalan terdaftar di `IM_LINGKUNGAN`.
- Catatan soal harness lama (karakter 71, 3rdminimap 95, tabrakan 37, kaki 19, warna 19, ktp 42, chat 21): file-file `/tmp/uji_*.js` lama sudah terhapus oleh pembersihan /tmp sehingga tidak bisa dijalankan ulang apa adanya; cakupan regresinya yang menyentuh pekerjaan ini (fungsi grid/tabrakan murni, matematika minimap, tangga kualitas, ekspektasi warna) dibangun ulang di dua harness di atas. **Perubahan ekspektasi warna yang disengaja**: uji warna lama mengharapkan atap dari palet 8 warna acak & dinding dari palet 6 pastel — ekspektasi itu kini digantikan keluarga HSL per zona (hue dalam ±0,015 dari hue zona; atap s 0,58/l 0,46±0,035; dinding s 0,42/l 0,80±0,025). Parameter perbaikan warna sebelumnya (kabut 2600/9000, eksposur 1,05, hemisphere 0,62, matahari 1,15, lerp atap kosong 0,22) tidak diubah.
- Deploy: backup file live lama → `/opt/pinarak/bak-rapi/` (app.js `?v=8` 192.067 byte + index.html). File baru md5 server = lokal: app.js `9d84cd54…` (200.711 byte), index.html `67c64a5b…`; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=9` + `app.js?v=9`; `app.js?v=9` **200 byte-identik** dengan lokal dan memuat penanda `elemenJalan`/`warnaAtapZonaHSL`/`warnaZonaPeta`; `style.css?v=9` 200; `/api/statistik` normal (warga 1, rumah 1).

### Sisa batas

- Bukti visual final tetap di HP user (tidak ada headless browser di sandbox): keharmonisan 20 keluarga warna dari orbit, keterbacaan deretan pohon/lampu, dan komposisi plaza hanya bisa dinilai di layar nyata. Yang terbukti dari sini: matematika zonasi & pola, seluruh buffer warna instans, posisi elemen jalan, dan file byte-identik yang tersaji live.

## Interior Bagus + Karakter Ronde 3 (2026-11-21 ±09:55 WIB, `?v=10`)

User: "Interior harus bagus, karakter juga." Acuan rasa: gambar referensi Pak Kades low-poly + kerapian Jetschool. Hanya klien (`public/app.js` + `index.html`); server Go tidak disentuh. Ukuran ruang interior, titik masuk/keluar, personalisasi, mode solo & posisi pintu yang disiarkan — semua tidak berubah.

### Bagian 1 — Interior jadi ruang tinggal tertata (147 mesh + 4 lampu, 10 AABB)

Tata letak ulang mengikuti dinding, simetris/berpola (koordinat lokal ruangan 16×13):

- **Cangkang**: dinding memakai tekstur prosedural baru `teksturDindingDalam()` (krem lembut, garis vertikal sangat halus + bintik samar) lewat satu material bersama; **wainscot** (panel bawah `0xf1e0bc`, tinggi 1,05) + **lis alas** (`0xe2cd9f`, 0,2) di semua dinding, pintu selatan bebas. Lantai kayu & plafon tetap.
- **Pencahayaan**: HemisphereLight pengisi (0,38) + DirectionalLight siang dari arah jendela utara (0,55, tanpa bayangan) + genangan cahaya lantai `teksturCahayaLantai()` (gradasi radial transparan di bawah jendela) + lampu meja ber-PointLight sendiri. Total lampu interior: 4 (hemi, arah, titik gantung lama, titik meja).
- **Zona tidur (barat laut)**: kasur lama + lipatan ujung selimut + bantal kecil; **nakas** berlaci dengan **lampu meja menyala** (kap emissive + PointLight `0xffc98a` 0,55/8) + buku.
- **Dinding utara**: papan nama & bingkai Kartu Warga tetap; **rak buku** baru (rangka + 3 tingkat, ±30 buku warna-warni berpola deterministik `hashInt` + vas bunga di atas) di antara papan nama dan jendela.
- **Jam dinding** di dinding barat di atas kasur (rim kayu, muka krem, 2 jarum ±10:10, titik tengah terakota).
- **Zona nonton (timur)**: **sofa** kain hangat `0x9b8465` menghadap TV — dudukan, sandaran, 2 lengan, 2 bantal duduk **warna aksen pemilik**, 2 bantal sandaran bersandar; **meja kopi** (papan + panel kaki + buku + cangkir); bufet TV kini **berpintu 2 + kenop kuningan**.
- **Meja kerja (selatan, timur pintu)**: meja makan lama dipindah & dibentuk ulang ke dinding selatan — daun + 4 kaki + 3 buku + lampu meja kecil emissive + 2 kursi menghadap meja.
- **Detail lain**: lemari + lis atas & kenop pintu; **lukisan low-poly** `teksturLukisan()` di dinding barat + 2 bingkai lukisan senja mengapit pintu selatan; **keset** berlapis aksen di dalam pintu; tanaman kedua di sudut tenggara (penyeimbang diagonal tanaman lama).
- **Personalisasi tetap**: warna aksen dari baju pemilik kini tampil di ≥7 tempat (selimut, karpet, gorden ×2, bantal sofa ×2, lapisan keset); papan nama & bingkai kartu dari data pemilik utuh.
- **Tabrakan**: AABB diperbarui mengikuti perabot baru — **10 AABB**: kasur, nakas, rak buku, sofa, meja kopi, bufet TV, lemari, meja kerja+kursi, tanaman ×2. Lorong jalan & titik masuk terverifikasi bebas.

### Bagian 2 — Karakter ronde 3 (mesh/karakter 25 → 38 peci / 37 topi / 36 tanpa)

- **Pakaian**: kerah cincin (baju ×0,72, dipipihkan z seperti torso); plaket dada mengikuti kemiringan permukaan torso (rotasi x 0,10) + **3 kancing** yang z-nya dihitung dari jari-jari torso per tinggi (menonjol ±0,017, tertanam wajar — terbukti di harness); lengan dua warna dipertahankan (atas baju, bawah kulit) + **tangan** bola pipih berkulit; celana berujung **lipat** (silinder lebih lebar, warna celana ×1,35); sepatu ber**sol** terang `0xd9d0bd` yang menjorok sebagai bibir sol. Helper warna baru `warnaSkala()`.
- **Wajah**: bola mata 0,078→0,088 & pupil 0,044→0,05 (z disesuaikan: putih 0,345 / pupil 0,378 / highlight 0,398 — urutan tonjolan tetap sah); alis lebih panjang & tegas (0,17×0,04, miring 0,16); senyum diperlebar (torus r 0,088→0,105).
- **Kedip**: `skalaKedip(t, geser)` murni — siklus 3,9 detik, jendela tutup 0,17 detik mengikuti sinus ke 0,08. `animasiHidup()` menerapkannya ke skala-y 3 bagian mata per sisi (dasar disimpan di `userData.sy` saat bangun). Fase per karakter acak visual (`geserHidup`).
- **Idle**: saat diam, napas halus pada torso (skala x/z ±1,8%, 1,7 rad/dtk) + ayunan lengan ±0,045; saat berjalan `animasiJalan` tetap memegang penuh (napas dipaksa skala 1). Kaki & posisi grup tidak pernah disentuh `animasiHidup` — karakter tidak bergeser saat diam.
- **Peci 3 potong**: badan meruncing (tinggi 0,28→0,26) + sabuk bawah `0x2b2b30` + kubah atas pipih (skala-y 0,22). Puncak peci 2,074 (lama 2,02; +2,7%).
- **Titik panggil** `animasiHidup`: karakter sendiri (updateKetiga, diam = jarak ≤0,001), pemain lain (perbaruiPemainLain, diam = perpindahan frame <0,0005), NPC (selalu bergerak), Pak Kades (diam). `renderFoto3D` otomatis ikut naik (memakai `buatKarakter` yang sama — terverifikasi dari sumber).
- **Dipertahankan**: cache geometri/material bersama + `buangGrup` aman (terbukti: dispose sumber bersama = 0 sesudah buangGrup), batas render 50 pemain, telapak tepat y=0 (diukur dari verteks nyata), tinggi tanpa topi 1,986 (lama 1,99), pivot animasi utuh.

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_interior.js`: **55/55** — karakter: keberadaan kerah/plaket/3 kancing/lipat ×2/sol ×2/tangan ×2/peci 3 potong/mata besar; kancing menonjol dari permukaan torso; telapak y=0 & tinggi total dari verteks (peci 2,074, polos 1,986); wajah di +z; `skalaKedip` (terbuka di luar jendela, <0,2 di tengah, periodik, geser fase); `animasiHidup` menutup & membuka mata ke skala dasar persis; napas hanya saat diam (rentang terukur 0,982–1,018) & kaki/posisi tak bergeser; regresi `animasiJalan` berlawanan fase; cache bersama aman. Interior: grup terbentuk & masuk scene; **147 mesh**; lampu 2 PointLight + 1 Hemisphere + 1 Directional; **10 AABB**; aksen pemilik di ≥5 perabot (terukur 7); 9 titik perabot tertahan tabrakan & 6 titik jalan bebas; bangun ulang untuk pemilik kedua mengganti personalisasi & mempertahankan 10 AABB; papan nama/kartu tetap dirujuk.
- Regresi lama: `/tmp/uji_rapi3d.js` **9/9**; `/tmp/uji_rapi.js` **41/42** — satu-satunya gagal adalah cek penanda versi `?v=9` di harness itu, yang memang digantikan deploy ini (`?v=10`); bukan regresi fungsi.
- Catatan pengukuran: Box3 r128 memakai AABB lokal sehingga menggelembungkan geometri miring (rambut terbaca 2,099); harness mengukur dari verteks nyata (1,986) — perilaku Box3 ini sudah ada sejak ronde 2, bukan perubahan ronde 3.

### Deploy & verifikasi live

- Backup file live lama → `/opt/pinarak/bak-interior/` (app.js `?v=9` md5 `9d84cd54…` + index.html `67c64a5b…`, terverifikasi sesudah salin).
- File baru md5 server = lokal: app.js `d1661d59…` (217.558 byte), index.html `5a94a978…`; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=10` + `app.js?v=10`; `app.js?v=10` **200 byte-identik** dengan lokal dan memuat penanda `animasiHidup`/`skalaKedip`/`teksturDindingDalam`/`renderFoto3D`; `/api/statistik` normal (warga 1, rumah 1).
- **Pelajaran jalur SSH (penting untuk deploy berikutnya)**: perintah majemuk dengan `;`/`&&` yang dikirim lewat `hst.py` TERPECAH di shell fish hop Oracle — hanya segmen pertama yang sampai ke Hostinger, segmen berikutnya berjalan di Oracle (gejala awalnya membingungkan: file "hilang timbul", `docker ps` menampilkan container Oracle seperti sen-web). Semua langkah deploy ini akhirnya dijalankan satu perintah per panggilan dan diverifikasi per langkah; pola itu yang terbukti aman.

### Sisa batas

- Bukti visual final tetap di HP user (tidak ada headless browser di sandbox): keterbacaan kedip & napas dari jarak main, kehangatan cahaya interior, dan kerapian susunan perabot hanya bisa dinilai di layar nyata. Yang terbukti dari sini: struktur & posisi semua perabot/AABB, matematika kedip/napas/tinggi, warna aksen, dan file byte-identik yang tersaji live.
- Interior kini 147 mesh + 4 lampu dibangun per kunjungan (sebelumnya ±55 mesh + 1 lampu) — di HP sangat lemah kunjungan pertama bisa terasa sedikit lebih berat; grup dibuang utuh saat keluar seperti sebelumnya.

## Jalan: Traffic Light + Marka (2026-11-21 ±10:2x WIB, `?v=11`)

User menunjuk acuan Jetschool: "jalanan bagus ada traffic light dan garis putus2 bagus". Klien saja; server Go tidak berubah.

### Lampu lalu lintas (baru — sebelumnya tidak ada)

- **Penempatan (murni, deterministik)** di seksi baru `LOGIKA LALU LINTAS` di app.js: 20 persimpangan jalan utama = perpotongan jalan antar-zona (tepi blok kolom 0/20/40/60 × baris 0/10/20/30/40, grid yang sama dengan `elemenJalan`). Satu tiang per sudut yang benar-benar trotoar: offset +15,2 (strip trotoar dalam ubin, 14..16,3) dan −1,15 (strip trotoar luar milik blok tetangga, 81,7..84) dari sudut kotak jalan — dibuktikan dari rumus tekstur `buatKanvasTanah`; tidak ada tiang di badan jalan/tapak rumah. Sudut yang jatuh di luar grid kota (barat untuk kolom 0, utara untuk baris 0) tidak dipasangi tiang: persimpangan interior 4 tiang, tepi 2, pojok kota 1 → **total 63 tiang** (sumbu utara–selatan 31, timur–barat 32). Tiap tiang menghadap arah datang arus yang diatur (penempatan sisi jauh-kanan): tenggara→−x, barat-laut→+x (sumbu tb); timur-laut→+z, barat-daya→−z (sumbu us).
- **Model**: tiang low-poly 1 InstancedMesh (geometri gabungan alas+tiang+kota lampu+topi, tinggi total 5,26, warna gelap `0x2e3236`); cakram lampu 6 InstancedMesh (sumbu × warna) berbentuk silinder r 0,155 di muka kotak (merah 4,87 / kuning 4,42 / hijau 3,97).
- **Nyala bergantian sungguhan**: mesin fase murni `faseLaluLintas(t)` — siklus 16 detik: [0,7) us hijau, [7,8) us kuning, [8,15) tb hijau, [15,16) tb kuning; sumbu yang tidak jalan selalu merah (dua sumbu hijau bersamaan mustahil menurut konstruksi, terbukti dari sapuan t di harness). Material **bersama** per sumbu/warna (6 material) disimpan di `LL_AKTIF` oleh `bangunKotaMassal`; `perbaruiLaluLintas(t)` di loop render menukar emissive (2,4 saat nyala, warna jenuh `WARNA_LAMPU_LL`) **hanya saat fase berubah** — tanpa PointLight baru, biaya per frame di luar pergantian fase nol. Lampu lalu lintas + marka adalah elemen kota inti: **tidak** masuk `IM_LINGKUNGAN`, jadi tingkat kualitas tidak menghilangkannya; tiang di trotoar = dekorasi tidak bertabrakan (fungsi tabrakan tidak diubah).

### Marka jalan ditingkatkan

- **Garis putus-putus kontinu**: pola lama di `buatKanvasTanah` memakai kala 30px yang tidak membagi sisi ubin (256) → satu garis dobel-panjang di tiap sambungan blok. Pola baru: kala 32u, panjang 18u, awal 7u, warna `#fff8dc` — membagi habis semua ukuran ubin (256/192/128/64), terbukti seragam termasuk celah bungkus di sambungan (harness menggambar tekstur asli dengan stub canvas di 3 skala).
- **Zebra cross + garis henti (baru)**: geometri tipis instanced (kotak 0,06 di y 0,03 + polygonOffset −2, preseden anti z-fighting bidang di atas tanah), satu InstancedMesh berwarna per instans bersama tutup garis tengah: **355 palang zebra** (5 per sisi; sisi barat/utara hilang di persimpangan tepi yang jalan pendekatannya memang tidak ada di luar grid), **71 garis henti** (selebar lajur arah datang menurut lalu lintas kanan, sebelum zebra), **60 persegi tutup** sewarna aspal `#b39d72` yang menutup garis tengah di kawasan persimpangan (garis tengah berhenti di tepi persimpangan; ruas tb dibagi dua supaya tidak tumpang tindih ruas us). Total 486 instans marka.
- Minimap tidak diubah (marka/lampu terlalu kecil untuk skala peta; tidak ada yang jadi salah).

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_jalan.js`: **120/120** — 20 persimpangan; tiang 63 (us 31/tb 32) & hitungan per persimpangan (4/2/1); semua tiang terbukti di strip trotoar lokal & di luar kawasan kavling; tiang tidak menempel pohon/lampu jalan (≥1,2); fase: titik-titik batas 0/7/8/15/16 + t negatif + sapuan 64 detik (tidak pernah dua hijau, sumbu lawan selalu merah, periodik); marka: jumlah 355/71/60, semua di dalam batas kota, pusat zebra & henti di atas aspal, zebra per persimpangan 20/15/10, tutup us menutup kotak persimpangan, tutup tidak saling tumpang tindih, tidak ada pohon/lampu jalan di atas zebra; garis putus-putus kontinu di skala 1/0,75/0,5.
- Regresi: `/tmp/uji_rapi.js` **42/42** (ekspektasi penanda versi di harness diperbarui ke `?v=11`), `/tmp/uji_rapi3d.js` **15/15** (cakupan diperluas: grup kota kini 22 InstancedMesh; mesh tiang 63, cakram 3×31+3×32, marka 486 terdeteksi; `LL_AKTIF.mat` terdaftar dan `perbaruiLaluLintas(0)`/`(10)` menerapkan fase yang benar ke material asli; zonasi 98.300 rumah tetap lulus), `/tmp/uji_interior.js` **55/55**.

### Deploy & verifikasi live

- Backup file live lama → `/opt/pinarak/bak-jalan/` (app.js `?v=10` md5 `d1661d59…` + index.html `5a94a978…`, terverifikasi sesudah salin).
- File baru md5 server = lokal: **app.js `27913d8d19236bacb71b68088ce948c9`** (228.772 byte), index.html `2b76eea3…`; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh. Jalur deploy satu perintah per panggilan hst.py (pelajaran fish ronde lalu dipatuhi).
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=11` + `app.js?v=11`; `app.js?v=11` **byte-identik** (md5 sama dengan lokal); `/api/statistik` normal (warga 1, rumah 1, terisi 1).

### Sisa batas

- Bukti visual final tetap di HP user: keterbacaan lampu yang menyala dari jarak main, ketegasan zebra, dan mulusnya garis putus-putus hanya bisa dinilai di layar nyata. Yang terbukti dari sini: posisi & hitungan semua elemen dari rumus grid, mesin fase, kontinuitas pola tekstur, dan file byte-identik yang tersaji live.

## Verifikasi Render Kota Massal (2026-11-21 ±10:25–10:50 WIB, live `?v=11`)

Pemicu: pemeriksaan visual lewat Chrome di komputer user melaporkan hanya ±300 rumah dalam satu gugusan di tengah dan sisanya grid kavling kosong — bertentangan dengan harness `uji_rapi3d` (98.300 warna dinding masuk buffer instans) dan screenshot HP user 08:26 (`?v=8`, karpet kota padat). Verifikasi ini membuktikan keadaan render live di browser sungguhan. **Hasil: RENDER SEHAT — tidak ada regresi; tidak ada perubahan kode/deploy dari verifikasi ini.**

### Cara

Chrome headless 149 di X99 digerakkan via CDP (perangkat di `~/workspace/wsdiag/`: `cek_kota.py`, `cek_kota2.py`, `cek_kota3.py`, `cek_kota4.py`, `cek_kota5.py`), membuka `https://pinarak.mfah.me/` jalur publik sebagai TAMU (tanpa akun uji; statistik tidak berubah: warga 1). Tiga muatan penuh independen dievaluasi di dalam halaman (`window.__kotaMassal`), ditambah satu muatan dengan intersepsi Fetch pada `three.min.js` untuk menangkap renderer asli aplikasi (kanvas `#kanvas`) dan membaca `renderer.info` — kait jebakan `window.THREE`/poller namespace terbukti tidak menjangkau renderer aplikasi, intersepsi jaringan yang menjangkau.

### Angka scene (konsisten di semua muatan)

- `imDinding.count` = **98.300** (kapasitas buffer 98.300) — persis 3.932 blok perumahan × 25 kavling.
- Atap: pelana **54.225** + limas **29.353** + datar **14.722** = **98.300** (satu atap per rumah).
- Grup kota: **22 InstancedMesh, 386.603 instans total** (termasuk cerobong 29.130, teras 68.913, pagar 24.902, semak 33.452, pohon kavling 14.043×2, pohon jalan 1.195×2, lampu jalan 1.196×2, cakram lampu lalu lintas 31/32, marka 486). Semua `visible=true`, semua `frustumCulled=false`, `instanceColor` terisi (sampel RGB dinding: (0,877; 0,699; 0,706), (0,741; 0,894; 0,755), (0,883; 0,713; 0,853) — warna zona pastel bervariasi, bukan buffer kosong).
- Matriks instans dinding menyebar sepenuh kota: instans 0 di (−3339, −2079), tengah (indeks 49.150) di (−3339, 21), terakhir (98.299) di (3353, 2093) — rentang penuh 6.720×4.200, bukan gugusan tengah.
- Segitiga grup kota dihitung dari buffer geometri asli: **6.387.942 segitiga**.

### renderer.info (renderer asli aplikasi, dari intersepsi)

- `info.render`: **calls 197, triangles 6.481.044** per frame (selisih ±93 ribu dari grup kota = sisa adegan: tanah, langit, distrik pusat detail, lahan, sawah, karakter) — cocok dengan hitungan buffer.
- `info.memory`: geometries 135, textures 14; programs 14. `pixelRatio` 1, buffer kanvas 1600×900.
- Kualitas aktif saat uji: **Otomatis → tingkat "Maksimal"**, kepadatan dekorasi penuh (angka pagar/semak/pohon/lampu di atas = nilai kepadatan 1).
- FPS di X99 headless = **1** — SwiftShader (render perangkat lunak tanpa GPU, ada warning fallback software WebGL di konsol); sifat mesin uji, bukan situs.

### Konsol selama muat

**0 error, 0 exception.** 7 warning: 1× deprecation fallback software WebGL (lingkungan X99) + 6× WebSocket chat "closed before the connection is established" — pengawas CONNECTING 8 detik milik klien (`?v=8`) menutup jabat tangan yang lambat di halaman uji yang sangat terbebani (1 FPS); soket chat, tidak berkaitan dengan render, dan di perangkat normal jabat tangan selesai jauh di bawah ambang itu (terbukti di sesi perbaikan chat).

### Bukti visual (CDP Page.captureScreenshot, disimpan di `~/workspace/wsdiag/bukti-kota/`)

- `a_orbit_awal.jpg` — orbit bawaan: karpet rumah rapat ke segala arah di belakang dialog tamu.
- `b_orbit_jauh.jpg` — zoom orbit maksimal: SELURUH kota persegi terlihat utuh dengan pita-pita warna zona RW (ungu, biru, teal, hijau-kuning, oranye), plaza kecil di tengah, sabuk hutan + danau di tepi.
- `c_lingkungan.jpg` — orbit dekat di atas plaza: lingkungan massal rapat di semua sisi plaza, zona tetangga berbeda warna terlihat di atas bingkai, jalan bermarka putus-putus + elemen lalu lintas tampak.

### Kenapa pemeriksaan sebelumnya bisa melihat "±300 rumah di tengah"

Fakta skala: kota 6.720×4.200 satuan berisi 98.300 rumah kecil; dari ketinggian orbit sedang, rumah di luar pusat berukuran beberapa piksel dan tekstur grid kavling di tanah mendominasi kesan — kota penuh memang tampak seperti "grid" bila rumahnya sub-piksel, apalagi di jarak berkabut (kabut mulai 2.600). Satu-satunya struktur BESAR yang terbaca individual ada di Distrik Pusat (±30 rumah detail + balai/plaza), sehingga hitungan mata dari satu bingkai mudah berhenti di angka ratusan di tengah. Sebagai catatan faktual tambahan: artefak contoh `diorama-low-poly` memang hanya memiliki 284 rumah instans dalam satu diorama tengah — bila tab yang terperiksa adalah artefak itu, angka ±300 cocok persis dengannya. Di situs live, angka scene + segitiga ter-render + tiga tangkapan layar di atas membuktikan kota penuh tampil.

### Koordinasi

Tidak ada deploy dari verifikasi ini (tidak ada md5 baru). Pekerjaan jalan `?v=11` (app.js live md5 `27913d8d19236bacb71b68088ce948c9`) tidak disentuh; agen kasur interior dipersilakan berpijak pada `?v=11` seperti rencana.

## Perbaikan Kasur Interior (2026-11-21 ±10:5x WIB, `?v=12`)

User masuk rumahnya (live `?v=11`) dan melaporkan singkat: "Kasur di rumah ngaco". Tanpa screenshot — diagnosa direkonstruksi murni dari angka di `bangunInterior()` (semua koordinat lokal ruangan; y = PUSAT kotak; permukaan kasur y=0,74; rangka x[−7,8,−5,6], z[−5,1,−1,3]) dan dibuktikan dengan harness yang menjalankan pembangun asli: **sebelum perbaikan 51 lulus / 22 gagal**.

### Apa yang salah (dari angka)

1. **Sandaran kepala salah orientasi & salah tempat.** Kotak `0,18(x) × 1,2 × 2,2(z)` di (−7,75, 0,6, −3,2) = panel berdiri di sepanjang SISI BARAT kasur, di tengah panjang kasur — bukan di ujung kepala selebar kasur. Ia memotong rangka (irisan vol 0,1386), kasur (0,0554), dan selimut (0,0208), menjulang 0,46 di samping badan orang tidur.
2. **Selimut tenggelam & menggantung di udara.** Bawah selimut y=0,69 vs permukaan kasur 0,74 → tenggelam 0,05 di seluruh tapaknya (irisan dengan kasur vol 0,2205); ujung kakinya z=−1,15 melewati ujung kasur (−1,35) dan rangka (−1,3) sebesar 0,20 → 20 cm selimut melayang tanpa apa pun di bawahnya.
3. **Lipatan selimut terkubur di dalam selimut.** Rentang y lipatan [0,67, 0,77] hampir seluruhnya di dalam selimut [0,69, 0,83] (irisan 0,0770) + memotong kasur (0,0368) → lipatan putih praktis tidak terlihat.
4. **Dua bantal bertabrakan.** Bantal besar x[−7,5,−6,3] dan bantal kecil x[−6,66,−6,04] tumpang tindih 0,36 di x dengan rentang y/z yang sama (irisan 0,0288) — bantal kecil tertanam di sisi bantal besar, bukan "di depannya"/di sebelahnya; keduanya juga tenggelam 0,02 ke kasur.
5. **Nakas di belakang kepala, bukan di samping.** Nakas di (−6,7, ·, −6,05), z[−6,35,−5,75] — segaris sumbu kasur di celah antara ujung kepala dan dinding utara; rentang z-nya bahkan tidak bersinggungan dengan bantal, dan lampunya menyala tepat di belakang kepala. Buku di atasnya tenggelam 0,01 ke atap laci.

### Yang diubah (hanya zona tidur di `bangunInterior`)

- **Sandaran**: `K(2,2, 1,2, 0,18)` di (−6,7, 0,6, −5,19) — selebar rangka persis (x[−7,8,−5,6]), muka belakang rata menempel muka ujung utara rangka (z −5,28..−5,10), berdiri dari lantai, puncak 1,2.
- **Selimut**: pusat y 0,76→0,81 (bawah tepat 0,74 = permukaan kasur), pusat z −2,3→−2,5 → z[−3,65,−1,35], ujung rata kaki kasur, tidak lagi menggantung.
- **Lipatan**: ke ATAS selimut dekat kepala: (−6,7, 0,93, −3,35) — bawah tepat 0,88 = permukaan selimut, tapak di dalam tapak selimut.
- **Bantal**: berjajar melintang tanpa sentuhan — besar (−7,05, 0,84, −4,55), kecil (−6,0, 0,82, −4,55), celah 0,14; keduanya duduk tepat di permukaan kasur (bawah 0,74) di dalam bidang kasur.
- **Nakas pindah ke sisi timur kepala kasur**: badan (−4,85, 0,25, −4,8) — celah 0,3 dari rangka, rentang z sejajar bantal; laci, kaki lampu (−4,95, 0,655, −4,9), kap, PointLight, dan buku (−4,7, 0,57, −4,72; bawah buku tepat di atap laci 0,545, tapak di dalam laci) ikut pindah.
- **Halang**: kasur diperluas menutupi sandaran baru `(-7.95, -5.5, -5.35, -1.2)`; nakas diganti `(-5.3, -4.4, -5.1, -4.5)`; jumlah halang tetap 10 dan keduanya tidak tumpang tindih.

### Verifikasi

- `node --check app.js` bersih. Harness baru `/tmp/uji_kasur.js` (menjalankan `bangunInterior()` asli yang diekstrak dari sumber dengan THREE asli `three.min.js`; tekstur di-stub karena tidak memengaruhi geometri): **73/73 lulus** — orientasi & tempel sandaran, tumpukan rangka→kasur→selimut→lipatan dengan selisih permukaan 0, kedua bantal di bidang kasur tanpa irisan, nakas di samping kepala, **nol irisan volume antar semua bagian kasur** (sentuhan muka = 0), semua bagian di dalam dinding, halang menutupi tapak visual persis, titik masuk pemain bebas, regresi kasar interior (mesh ≥140 terhitung 147+, PointLight tetap 2).
- File `/tmp/uji_interior.js` lama sudah terhapus oleh pembersihan /tmp (kejadian berulang yang tercatat), jadi cakupan regresinya dibangun ulang di harness ini (jumlah mesh, jumlah halang, titik masuk, lampu) dan lulus semua.

### Deploy & verifikasi live

- Koordinasi versi: sebelum deploy, live masih `?v=11` dan app.js live md5 `27913d8d…` = persis basis edit ini (agen verifikasi render selesai tanpa deploy, lihat bagian sebelumnya) → naik ke **`?v=12`**.
- Backup file live lama → `/opt/pinarak/bak-kasur/` (app.js `27913d8d…` + index.html `2b76eea3…`, terverifikasi sesudah salin). File baru ditransfer per file via base64/stdin double-hop, md5 di server sebelum pindah tempat: app.js `18d7987e94b9d569786f95efae553727` (229.033 byte), index.html `6d6486c260ef8adc01a7e82d51c5d7e8` — keduanya sama dengan lokal.
- `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` jalan, `pinarak-db-1` healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=12` + `app.js?v=12` (selisih satu-satunya dari file lokal = skrip challenge Cloudflare yang disuntikkan di depan `</body>`); `app.js?v=12` **byte-identik** dengan lokal (md5 sama) dan memuat penanda sandaran baru; `/api/statistik` normal (warga 1, rumah 1, terisi 1).

### Sisa batas

- Bukti visual final tetap di HP user: yang terbukti dari sini adalah geometri tumpukan dari koordinat (nol irisan, semua permukaan bersentuhan tepat), bukan kesan mata di layar. Bila user masih melihat yang aneh, tersangka berikutnya adalah tekstur/render, bukan posisi — minta screenshot titik pandangnya.

## Rumah Hanya Warga Terdaftar (2026-11-21 ±11:2x WIB, `?v=13`)

Keputusan Fahmi (verbatim pilihannya dari kartu opsi): "Rumah hanya milik warga terdaftar — kavling kosong jadi lahan kosong, rumah muncul saat ada yang daftar". Menggantikan tampilan lama: 98.300 kavling perumahan semuanya berumah instans, yang kosong memudar (lerp abu 0,22). Klien saja — server Go tidak disentuh (terbukti tidak perlu: `/api/warga` sudah memberi nomor_rumah/blok/kavling/warna_baju per warga).

### Yang berubah (public/app.js, index.html, style.css)

- **Himpunan terisi dari data warga.** `ambilData()` kini juga mengisi `rumahTerisi` (Set nomor_rumah) + `daftarRumah` ({nomor, blok, kavling, warna}) dari loop paging `/api/warga` yang sama yang mengisi `warnaPemilik` — batas muat yang sama seperti sebelumnya (maks 2.000 warga pertama; di luar itu warna pemilik pun memang tidak dimuat klien).
- **Rumah massal hanya kavling terisi.** `bangunKotaMassal()` memisahkan `daftarIsi = daftar.filter(nomor ∈ rumahTerisi)`; dinding/atap pelana-limas-datar/cerobong/teras instanced hanya dibuat dari `daftarIsi` (kapasitas InstancedMesh pas sejumlah terisi, count ditegaskan). Invariant baru: jumlah instans rumah == jumlah warga terdaftar di blok perumahan massal. Cabang warna "belum terisi + lerp pudar" dihapus; pewarnaan rumah terisi tidak berubah (dinding keluarga zona RW, atap = warna baju pemilik bila tercatat, else keluarga zona).
- **Kavling kosong = lahan kosong.** Tanpa dinding/atap/cerobong/teras. Petak tetap terbaca dari tekstur tanah; dekorasi berpola `polaKavling` (pagar/semak/pohon kecil) dipertahankan di SEMUA petak dari daftar penuh — posisinya memang di luar tapak dinding (pagar di tepi depan petak z+6,35; semak sudut depan ±4,9/+5,0; pohon kecil sudut belakang ±5,0/−4,8), jadi di lahan kosong terbaca sebagai pembatas & penanda petak siap bangun, bukan sisa rumah.
- **Tabrakan hanya rumah terisi.** `tabrakanRumahMassal()` menghitung nomor kavling tiap kandidat dari rumus grid yang sama dan melewati yang tidak ada di `rumahTerisi` — lahan kosong bisa dilalui jalan kaki. Tapak fasilitas & pusat tidak berubah.
- **Distrik pusat** sudah sesuai aturan (rumah detail hanya dari `wargaTerbaru`); ditegaskan harness: 0 warga → 0 rumah detail/NPC, 1 warga → tepat 1.
- **Minimap & peta besar.** Lapisan statis: blok perumahan kini warna petak lahan baru `WARNA_PETA.petak` (#9db873), bukan keluarga zona. Rumah terisi digambar DINAMIS sebagai titik sewarna baju pemilik dari `daftarRumah` (`titikRumahWarga`) di minimap (petak 3,4px) & peta besar (4px), di bawah penanda balai/rumah sendiri/pemain. Warga yang nomornya jatuh di blok RESERVASI/TAMAN dilewati (tidak punya rumah massal; terwakili rumah detail pusat). Legenda peta besar ditambah "Rumah warga (titik warna pemilik)" + kelas CSS `lg-rumahwarga`; teks bantuan peta kecil diperbarui.
- **Rumah muncul saat mendaftar.** Alur lama sudah cukup: sesudah daftar berhasil, `segarkanKota()` memanggil `ambilData()` (himpunan terisi segar) lalu membangun ulang grup kota — rumah warga baru tampil di sesi yang sama. BATAS v1: pengunjung lain melihat rumah baru saat memuat ulang halaman; tidak ada sinkronisasi live via WebSocket untuk rumah baru.
- **Teks statistik tidak berubah** karena sudah jujur: chip "🏠 terisi / 100.000", panel "Kavling terisi", papan "KAVLING: terisi / 100.000" — semuanya hitungan terisi terhadap kapasitas, tidak ada yang mengklaim 98.300 rumah berdiri.

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_rumah.js` (menjalankan `bangunKotaMassal`/`tabrakanRumahMassal`/`gambarBlokPeta`/`titikRumahWarga`/`bangunDistrik` ASLI yang diekstrak dari sumber dengan THREE asli; data warga suntikan meniru `ambilData`): **36/36 lulus** — 0 warga → 0 instans rumah (dinding/atap/cerobong/teras) tapi grup tetap 22 InstancedMesh & dekorasi penuh persis hitungan ulang `polaKavling` atas 98.300 kavling, tabrakan kavling kosong lolos; 1 warga (Blok 1 Kav 1) → tepat 1 rumah di pusat kavlingnya, atap == warna baju pemilik, tabrakan menahan di kavlingnya & lolos di tetangga kosong; 3 warga tersebar (nomor 1/100/5000) → 3 rumah, posisi & warna masing-masing benar, titik peta 3 (warga blok lahan dilewati); lapisan peta: blok perumahan == warna petak, pusat tetap plaza, lahan tetap lahan; PENUH (100.000 nomor terisi) → dinding 98.300 & atap 98.300 (kapasitas utuh); regresi jalan: pohon 1.195, lampu 1.196, tiang LL 63, marka 355/71/60.
- Regresi interior: `/tmp/uji_kasur.js` **73/73 lulus** (tidak ada kode interior yang disentuh).
- Catatan jujur harness lama: file `/tmp/uji_rapi.js`, `uji_rapi3d.js`, `uji_jalan.js`, `uji_interior.js` sudah terhapus oleh pembersihan /tmp (kejadian berulang yang tercatat di bagian-bagian sebelumnya). Ekspektasi relevannya dibangun ulang di `uji_rumah.js` dengan invariant baru (komposisi 22 InstancedMesh, hitungan penuh 98.300, hitungan jalan/lalu lintas persis) dan lulus; ekspektasi lama "instans == 98.300 selalu" memang SENGAJA digantikan invariant "instans == warga terdaftar" oleh keputusan ini.

### Deploy & verifikasi live

- Basis edit = live `?v=12` persis (app.js server `18d7987e…` sebelum deploy). Backup file `?v=12` → `/opt/pinarak/bak-rumahterisi/` (app.js `18d7987e94b9d569786f95efae553727`, index.html `6d6486c260ef8adc01a7e82d51c5d7e8`, style.css `24d7009c718c75a65d42d3d53ad5f75e`, terverifikasi sesudah salin).
- File baru ditransfer per file via stdin double-hop ke path `.baru`, md5 di server diverifikasi sama dengan lokal SEBELUM pindah tempat: app.js `fc09df1055c41c1eeab5d7ee3ff04aff` (232.177 byte), index.html `a982f4489acf5cbde6e82600d8825845`, style.css `301b7987844f3e033be074553819957a`. Versi naik `?v=12` → **`?v=13`** (style.css ikut berubah: kelas legenda baru).
- `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` Up, `pinarak-db-1` Up (healthy), layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=13` + `app.js?v=13`; `app.js?v=13` & `style.css?v=13` **byte-identik** dengan lokal (md5 sama); index.html live identik dengan lokal kecuali skrip challenge Cloudflare 1 baris di akhir (suntikan yang sama seperti deploy sebelumnya); `/api/statistik` normal (warga 1, rumah 1, terisi 1, kapasitas 100.000); `/api/warga` mengembalikan tepat 1 warga: @thefahmihassan, nomor 1, Blok 1, Kavling 1, warna baju #1abc9c.

### Keadaan live sesudah deploy (yang diharapkan terlihat)

Tepat **1 rumah berdiri** di seluruh kota massal — Blok 1 Kavling 1 milik @thefahmihassan (warga #1, atap teal warna bajunya) — plus kantor kades/balai desa & rumah detailnya di Distrik Pusat. Seluruh 98.299 kavling lain kini lahan kosong berpetak dengan dekorasi polanya. Desa tumbuh satu rumah per pendaftaran berikutnya.

### Sisa batas

- Bukti visual final tetap di HP user: yang terbukti dari sini adalah invariant jumlah/posisi/warna instans dari pembangun asli + file live byte-identik + data API live. Kesan "lahan kosong terbaca sebagai petak siap bangun" adalah penilaian mata di layar.
- Batas muat data per-warga klien (2.000 warga pertama, warisan desain `warnaPemilik`) kini juga membatasi himpunan rumah yang ter-render; di atas itu perlu endpoint daftar nomor ringkas dari server — belum dikerjakan, tidak dibutuhkan pada skala sekarang (1 warga).

## Zebra + Lampu Merah Semua Persimpangan (2026-11-21, `?v=14`)

Keputusan Fahmi (21 Nov 2026): "Harusnya setiap persimpangan ada zebra cross dan lampu merah". Menggantikan cakupan ?v=11 yang hanya melayani 20 persimpangan jalan antar-zona. Klien saja — server Go tidak disentuh.

### Turunan himpunan persimpangan (dari rumus grid, bukan daftar tangan)

- Jaringan jalan = grid penuh tekstur tanah: strip jalan di tepi kiri+atas SETIAP ubin blok → jalan vertikal di tepi kiri tiap kolom (kol 0..79), jalan horizontal di tepi atas tiap baris (bar 0..49). Persimpangan sah = sudut barat-laut tiap ubin = **80 × 50 = 4.000 titik**. Garis timur (kol 80) & selatan (bar 50) bukan jalan (tekstur tidak menggambar strip di sana) → tidak ada persimpangan di garis itu.
- **Satu-satunya pengecualian (3 titik)**: slab plaza `pusatKota()` — `kotak(208, 0.3, 104)` di (0,0), tapak x −104..104, z −52..52 — menutup rapat persegi jalan di bawahnya. Persimpangan yang persegi jalannya tertutup PENUH tapak itu bukan lagi pertemuan jalan (di atasnya plaza pejalan kaki): tepat **(39,25), (40,25), (41,25)**. Di app.js ini dirumuskan sebagai konstanta `PLAZA_TAPAK` + uji tutup-penuh di `persimpanganKota()` — bukan daftar titik yang diketik tangan. Tidak ada tumpang-tindih sebagian (persegi tetangga terdekat berjarak ≥ 11 satuan dari tepi plaza; dibuktikan harness: nol marka/tiang menembus tapak plaza). Persimpangan di sekeliling RESERVASI & tepi lahan pembangunan tetap dilayani penuh — tekstur jalan seragam di semua blok; danau blok (36,28) berada di dalam petak (pusat lokal (49,49), r 24), ≥ 11 satuan dari strip jalan mana pun, jadi tidak mengecualikan sudut bloknya.
- **Persimpangan terlayani: 3.997.**

### Yang berubah (public/app.js + index.html)

- `persimpanganUtama()` (daftar kolom/baris utama) → **`persimpanganKota()`** (semua sudut ubin minus pengecualian plaza). `tiangLaluLintas()` & `markaPersimpangan()` mengiterasi fungsi baru itu; rumus sudut trotoar (+15,2 strip dalam / −1,15 strip luar), aturan sisi (utara hanya bila bar>0, barat hanya bila kol>0), mesin fase 2 sumbu siklus 16 dtk, dan material bersama `LL_AKTIF` TIDAK berubah sama sekali.
- Angka akhir: **tiang 15.729** (interior 4 / tepi 2 / pojok kota 1 per persimpangan; sumbu us 7.864, tb 7.865) + **cakram 47.187** (3 per tiang, 6 InstancedMesh sumbu×warna); **zebra 79.290 palang** (tetap 5 per sisi — tidak perlu diturunkan ke 4, lihat kinerja), **garis henti 15.858**, **tutup aspal 11.991** → **marka total 107.139 instans** dalam 1 InstancedMesh seperti sebelumnya. Tiang tetap 1 InstancedMesh geometri gabungan. Semua tetap elemen inti kota (tidak ikut kepadatan kualitas), tidak bertabrakan, minimap tidak diubah.
- Kinerja (grup kota, 0 warga, kepadatan 1, diukur harness dari pembangun asli): sebelum **91.960 instans / ±3.177.576 segitiga** → sesudah **261.277 instans / ±7.089.300 segitiga**. Sebagai pembanding, kota lama berumah-penuh yang pernah terverifikasi render di browser sungguhan adalah 6,48 jt segitiga/frame — angka baru seorde itu, dan rumah kini hampir nol (1 warga); tangga kualitas otomatis tetap mengatur pixel ratio/bayangan/kepadatan dekorasi di HP lemah. Jumlah InstancedMesh tetap 22 (tidak ada draw call baru).

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_jalan.js` (fungsi asli diekstrak dari sumber, THREE asli): **36/36 lulus** — himpunan aktual == turunan rumus independen (4.000 − 3, pengecualian tepat 3 titik itu); aturan sudut tiap persimpangan cocok per posisi eksak (peta posisi, bukan hanya hitungan); semua tiang terbukti di strip trotoar sudut (lokal ubin 15,2/82,85 di kedua sumbu), nol di tapak plaza, nol di rintangan pusat (balai/tugu/papan), nol di 14 AABB tapak fasilitas; zebra/henti/tutup dicocokkan sebagai HIMPUAN persegi eksak per persimpangan (semua sisi yang wajib, tanpa ganda/ekstra); semua marka terbukti di atas aspal (strip L per ubin, uji titik sudut+pusat), nol menembus plaza; sapuan fase 64 dtk tanpa dua sumbu tidak-merah bersamaan; integrasi grup: tiang count 15.729, cakram us 3×7.864 & tb 3×7.865, marka 107.139 (warna instans: tutup aspal 11.991, putih 95.148), posisi cakram sampel menempel di muka tiangnya, `perbaruiLaluLintas(0)` & `(10)` menerapkan fase benar ke material yang sama dengan yang dipakai mesh cakram.
- Regresi: `/tmp/uji_rumah.js` **36/36 lulus** (dua ekspektasi regresi LL di dalamnya diperbarui dari angka ?v=11 — tiang 63, marka 355/71/60 — ke angka semua-persimpangan; invariant rumah == warga tidak berubah), `/tmp/uji_kasur.js` **73/73 lulus**.

### Deploy & verifikasi live

- Basis edit = live `?v=13` persis (app.js server `fc09df1055c41c1eeab5d7ee3ff04aff` sebelum deploy). Backup `?v=13` → `/opt/pinarak/bak-persimpangan/` (app.js `fc09df10…`, index.html `a982f448…`, style.css `301b7987…`, terverifikasi sama sesudah salin).
- File baru ditransfer per file via stdin double-hop ke `.baru`, md5 di server diverifikasi SEBELUM pindah tempat: app.js `bcb1169c1c2814ffad75573621d39ca4` (233.408 byte), index.html `e8cff2872cfc3871f90a6d9951d6ad2f`. style.css tidak berubah (md5 sama dengan live) — hanya parameter versinya naik. Versi `?v=13` → **`?v=14`**.
- `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` Up, `pinarak-db-1` Up (healthy), layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=14` + `app.js?v=14`; `app.js?v=14` **byte-identik** dengan lokal (md5 sama); `/api/statistik` normal (warga 1, rumah 1, terisi 1, kapasitas 100.000).

### Batas jujur

- Yang terbukti: himpunan/posisi/jumlah dari pembangun asli + mesin fase + file live byte-identik. Keterbacaan zebra & nyala lampu dari jarak main, dan kelancaran frame di HP user dengan marka kota-penuh, adalah penilaian di layar user — tangga kualitas otomatis adalah katup pengamannya bila FPS turun.

## Upgrade Visual ke Arah Ase Jaya (2026-11-21, `?v=15`)

Perintah Fahmi (21 Nov 2026): "Upgrade visual Pinarak ke arah Ase Jaya" — mengejar rasa "3D bagus" episode Day 20 @aselemenein (adegan bercerita, karakter berakting, properti bercerita, drama cahaya malam) dalam batas WebGL real-time. Klien saja — server Go tidak disentuh.

### Paket 1 — Karakter beraktivitas (NPC Distrik Pusat + Pak Kades)

- Peran prosedural murni `aktivitasUntukNpc(i)` (bagian LOGIKA AKTIVITAS NPC): warga terbaru ke-1..2 = **pembawa** (berjalan di jalur plaza membawa karung/kardus di depan dada, kedua lengan ditahan rotation.x −0,82 menimpa ayunan jalan), ke-3..6 = **mengobrol** (2 pasang berdiri berhadapan di (−10,18)/(−8,4,18) & (12,−14)/(13,6,−14); napas/kedip + gestur satu tangan ±1,3 dtk tiap ±7 dtk), ke-7..10 = **duduk** di 4 bangku plaza ?v=9 persis (kaki diputar −1,25 dari pivot pinggul, badan di y 0,37 = dudukan 0,89 − pivot 0,52), sisanya pejalan seperti sebelumnya. Pemain online & karakter pemain tidak diubah; NPC yang orangnya online tetap disembunyikan seperti sebelumnya.
- **Pak Kades melambai** saat acuan pemain (target orbit / posisi drone / posisi jalan) berjarak < 34 dari (3,−24): lengan kanan rotation.z 2,55 + goyangan sin, jendela 1,8 dtk tiap 5 dtk; di luar itu kembali 0,12.
- Keadaan live sekarang (1 warga): NPC tunggal = pembawa karung — peran lain terisi otomatis saat warga bertambah.

### Paket 2 — Properti bercerita

- **Papan "RENCANA PEMBANGUNAN DESA"** di plaza (−34, 26, rotY π−0,45, cermin papan raksasa): kanvas 1152×640 berisi 8 fasilitas + status (✓ SUDAH BERDIRI / ○ LAHAN KOSONG) dari `dataPembangunan` (/api/pembangunan), digambar ulang tiap `bangunDistrik()` seperti `gambarPapan()`. AABB tabrakan ditambahkan simetris dengan papan raksasa.
- **Properti lokasi proyek** di 8 lahan fasilitas yang BELUM terbangun (instanced, 4 InstancedMesh bersama): tumpukan bata (geometri gabungan 11 bata) di (+13,+9), tumpukan kayu (5 batang) di (−14,+7), karung material (3 karung) di (+9,−13), pagar proyek (18,4 m) di (−6,+23) — semua relatif pusat blok. **Keputusan tabrakan (konsisten): tumpukan bata & kayu DITABRAK** (AABB kecil masuk `rintanganFasilitas`, 2 per lahan); karung & pagar proyek tanpa tabrakan. Lahan terbangun tidak diberi properti (harness: taman terbangun → proyek 7, model berdiri, AABB 15 = 14 tumpukan + 1 kolam).

### Paket 3 — Siklus cahaya (Siang / Senja / Malam / Siklus)

- Pengaturan **"🕐 Waktu desa"** di panel ☰ (segmen Siang · Senja · Malam · Siklus + teks info), tersimpan di `localStorage pinarak_waktu`, bawaan **Senja = golden hour ?v=14 persis** (preset diverifikasi harness: matahari 0xffc384/1,15, kabut 0xf6d9a8, paparan 1,05, kepala lampu 0,85).
- LOGIKA WAKTU murni: `PRESET_WAKTU` (matahari, hemisphere, gradien kubah, kabut, latar, paparan, kepala lampu, bintang, awan, jendela) + `campurPresetWaktu` + `parameterWaktu` (Siklus = 240 dtk/putaran Siang→Senja→Malam→Senja, smoothstep antar segmen). `terapkanWaktu(dt)` di loop animasi melerp keadaan aktif (konstanta ±0,7 dtk → mantap ±2 dtk), TANPA PointLight baru: yang digerakkan hanya warna/intensitas matahari & hemisphere, uniform kubah, warna fog/latar, exposure, **emissive kepala lampu jalan instanced** (registry `LAMPU_JALAN.matKepala` diisi `bangunKotaMassal`), **opasitas 700 titik bintang** baru (1 draw call), warna/emissive awan, dan **emissive jendela balai** (2 jendela + kusen baru bermaterial bersama `MAT_JENDELA`). Cakram lampu lalu lintas tidak disentuh (tetap menyala dari mesin fasenya).

### Kinerja

- Grup lahan terukur dari pembangun asli: instans 224 → **256 (+32** = 4 IM × 8 lahan), InstancedMesh 4 → **8**; mesh biasa tetap 25. Di luar itu: papan rencana +4 mesh, jendela balai +4 mesh, bintang +1 Points, properti NPC ≤ +2 mesh → **total ±13 draw call baru**, nol pekerjaan berat per frame baru (lerp ±20 nilai/frame). Invariant ?v=13 & ?v=14 utuh (harness di bawah).

### Verifikasi

- `node --check app.js` bersih.
- Harness baru `/tmp/uji_visual.js` (fungsi asli diekstrak, THREE asli, stub canvas perekam): **55/55 lulus** — preset waktu lengkap & senja == ?v=14; campur t=0/1 == ujung; siklus t=0 siang, t=120 malam, kontinu di perbatasan segmen & putaran; peran NPC 0..29 (pembawa/ngobrol berhadapan terverifikasi vektor hadapnya/duduk di bangku persis/dst.); teks papan rencana: 8 nama + 8× LAHAN KOSONG, lalu 1× SUDAH BERDIRI saat taman terbangun; proyek: 8 lahan → 8/8/8/8 & AABB 16, bata taman tepat di (+13,+9) dalam petak; kota massal: 0 warga → dinding 0, 1 warga → dinding 1 & atap 1, material kepala lampu terdaftar (emissive awal 0,85); regresi lalu lintas murni: persimpangan 3.997, tiang 15.729, marka 107.139, sapuan fase 64 dtk aman.
- Regresi interior/kasur: `/tmp/uji_diff_interior.js` — `bangunInterior`, `tabrakanInterior`, `masukInterior`, `keluarInterior`, `perbaruiAksiInterior`, `dekatPintuKeluar`, konstanta `INT` & `rintanganInterior` **byte-identik** antara app.js ?v=14 live (terunduh sebelum deploy) dan ?v=15 → kode kasur ?v=12 yang lulus 73/73 tidak berubah sama sekali. (File harness uji_rumah/uji_kasur/uji_jalan lama kembali hilang dari /tmp oleh pembersihan berkala; invariant relevannya dibangun ulang di uji_visual.js dan lulus.)
- **Browser asli (Chrome headless di X99 via CDP, jalur publik):** halaman live memuat kode baru; di scene: dinding 1 & atap 1 (invariant rumah), proyek bata/kayu/karung/pagar = 8/8/8/8, total 32 InstancedMesh / 263.735 instans, kepala lampu emissive 0,85 (senja), papan rencana ketemu di (−34, 26) dengan tekstur terpasang, NPC warga #1 = pembawa karung (13 anak grup = 12 karakter+label + 1 karung) dengan **kedua lengan tertahan −0,82** (pose memegang barang aktif), **Pak Kades: rotasi z lengan kanan terpantau 0,12 → 2,24** (istirahat → melambai), **NPC bergerak di jalur**: x −42,19 → **−26,96** (z 16, segmen jalur plaza) antar sampling; **0 exception runtime** dalam 35 dtk sesudah reload (hanya peringatan SwiftShader bawaan). Fase malam (localStorage + reload): **kepala lampu emissive 2,6 · bintang opasitas 0,95 · jendela balai emissive 2,2** — persis preset. Screenshot senja & malam tersimpan di `~/workspace/wsdiag/bukti-visual15/` — malam terbaca jelas lebih gelap/biru dari titik pandang yang sama. Catatan laju frame rig uji: SwiftShader X99 merender scene kota penuh ±5 dtk/frame (sama seperti verifikasi render ?v=11), jadi gerak teramati berloncat antar frame selesai — bukan halaman macet; di HP/GPU asli tangga kualitas yang mengatur.

### Deploy & verifikasi live

- Basis edit = live `?v=14` persis (app.js server `bcb1169c…` sebelum deploy). Backup `?v=14` → `/opt/pinarak/bak-visual/` (app.js `bcb1169c1c2814ffad75573621d39ca4`, index.html `e8cff2872cfc3871f90a6d9951d6ad2f`, style.css `301b7987844f3e033be074553819957a`, terverifikasi sesudah salin).
- File baru ditransfer per file via stdin double-hop ke `.baru`, md5 di server diverifikasi SEBELUM pindah tempat: app.js `956c20b4b2f37d95a6ab17d719fa9641` (253.582 byte), index.html `7460656275ea64fcbae6a6eaa4edf167`. style.css isinya tidak berubah (kelas panel waktu memakai ulang `.pm-kualitas`/`.seg`) — hanya parameter versinya naik. Versi `?v=14` → **`?v=15`**.
- `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` Started, `pinarak-db-1` Healthy, layanan lain tidak disentuh.
- Dari sandbox (jalur publik): `/` **200** memuat `style.css?v=15` + `app.js?v=15`; `app.js?v=15` & `style.css?v=15` **byte-identik** dengan lokal (md5 sama); `/api/statistik` normal (warga 1, rumah 1, terisi 1, kapasitas 100.000).

### Batas jujur

- Yang terbukti dari sini: logika murni + pembangun asli (harness), keadaan scene & nilai emissive & gerak NPC di browser asli, screenshot dua fase, file live byte-identik. Kesan sinematik final (seberapa dekat rasanya ke Ase Jaya) tetap penilaian mata di HP user — terutama gestur ngobrol & pose duduk yang baru terisi penuh saat warga ke-3..10 terdaftar (sekarang baru 1 warga, jadi yang tampil baru pembawa karung + lambaian Pak Kades).
- Mode Malam menggelapkan seluruh kota termasuk area jauh; keterbacaan minimap tidak terpengaruh (kanvas 2D warnanya sendiri). Siklus penuh 4 menit membuat fase malam hanya mampir ±1 menit per putaran — disengaja supaya desa tidak lama gelap.

## Alokasi Rumah: Tumbuh dari Tengah + Kavling Acak (2026-11-21 ±15:5x WIB, `?v=16`)

Keputusan Fahmi (21 Nov 2026, reaksi ❤️ pada proposal): rumah tidak lagi menumpuk sebaris di Blok 1 (pojok barat laut). Aturan alokasi diganti: desa tumbuh dari tengah, kavling di dalam blok diisi acak. Server Go + klien berubah.

### Aturan final (server, `internal/db/db.go`)

- **Blok terlarang (bukan perumahan)** — himpunan yang sama persis dengan yang dilewati render klien: RESERVASI (kolom 38..41 × baris 24..25, plaza + balai + distrik detail) + TAMAN/lahan pembangunan (kolom ≡ 4 mod 8, baris ≡ 4 mod 8 — termasuk ke-8 blok FASILITAS_BLOK: 1637, 2901, 973, 1029, 1653, 2941, 2269, 2285). Total **68 blok terlarang → 3.932 blok perumahan**.
- **Urutan blok**: jarak kuadrat pusat blok ke plaza (0,0) menaik, tie-break nomor blok. Kepala urutan: **1880, 1881, 2120, 2121, 1879, 1882, 2119, 2122, 1800, 1801, …** — Blok 1880 = kolom 39, baris 23 (persis di utara plaza; empat blok terpusat memang RESERVASI). 68 blok terlarang ditaruh di AKHIR urutan (nomor menaik) sebagai cadangan luapan, jadi kapasitas total tetap tepat 100.000 kavling dan `Alokasi` tidak pernah keluar rentang.
- **Kavling dalam blok**: permutasi acak deterministik 1..25 (Fisher-Yates digerakkan splitmix64 di-seed nomor blok); pendaftar ke-k di blok itu menerima elemen ke-k. Permutasi Blok 1880: **[22 8 14 21 13 23 4 7 10 9 5 25 18 3 24 16 6 11 12 1 20 19 15 2 17]**.
- `nomor_rumah` tidak berubah makna (nomor urut pendaftaran global) → NIK semua warga tetap. RT/RW diturunkan dari blok seperti sebelumnya; Blok 1880 = **RT 072 / RW 10**.

### Perubahan klien (`?v=16`) — asumsi urutan lama yang ditemukan & diperbaiki

- Klien lama mengunci `rumahTerisi`/`warnaPemilik` dengan **nomor_rumah** dan menurunkan nomor tiap petak dari rumus lama `(blok-1)*25 + kavling` — dengan alokasi baru, rumah akan tetap tergambar di Blok 1 walau data server pindah. Diperbaiki minimal di 4 titik: `ambilData()` kini mengunci `"blok,kavling"`, `bangunKotaMassal()` menyaring & mewarnai atap pemilik via kunci posisi baru (`kunciPos`), `tabrakanRumahMassal()` memeriksa kunci posisi. Semua pemakaian lain (fokusRumahSaya, titik peta, interior, KTP/KK) memang sudah data-driven dari kolom blok/kavling API — tidak diubah.
- Harness baru `/tmp/uji_alokasi.js` (pembangun asli + THREE asli): **9/9 lulus** — 11 warga suntikan di Blok 1880 → tepat 11 dinding/atap di posisi kavling data (bukan Blok 1), atap kavling 1880/22 == warna pemilik #1abc9c, tabrakan menahan di kavling terisi & lolos di kavling kosong serta di Blok 1 Kav 1, 0 warga → 0 rumah.

### Verifikasi server (lokal)

- `go test ./...` semua paket lulus, `go vet` & `gofmt` bersih. Test baru: `TestAlokasi` (25 pertama memenuhi tepat Blok 1880 dengan kavling permutasi lengkap; seluruh 100.000 alokasi unik; nol blok terlarang di 98.300 pertama), `TestBlokTerlarang` (68 blok persis), `TestUrutanBlok` (kepala urutan + jarak tak pernah menurun + semua blok unik), `TestPermutasiKavling` (sah + deterministik).

### Migrasi warga produksi — 13 warga (bukan 11)

- Saat migrasi dijalankan, produksi sudah **13 warga**: 11 dari daftar tugas + 2 pendaftaran organik baru sesudahnya (@kinannm_ #12, @azza.tyr #13, masih di Blok 1). Demi konsistensi aturan, **ke-13-nya dimigrasikan** dengan aturan yang sama persis (warga #k → slot ke-k). Satu `UPDATE` dalam transaksi; hanya kolom blok/kavling yang berubah — nomor rumah, NIK, keluarga, peran, PIN utuh.
- Posisi baru (semua **Blok 1880**, RT 072/RW 10): #1 @thefahmihassan Kav 22 · #2 @taa_lge12 Kav 8 · #3 @zamourraa Kav 14 · #4 @hana_kaemung Kav 21 · #5 @drennvanzz_ Kav 13 · #6 @4caa_caaaee Kav 23 · #7 @dwiaprianti30_ Kav 4 · #8 @ulandesheeran_ Kav 7 · #9 @4yumbukanayam Kav 10 · #10 @muhamad_aria_12 Kav 9 · #11 @cil_aaaa38 Kav 5 · #12 @kinannm_ Kav 25 · #13 @azza.tyr Kav 18.
- Catatan: teks sambutan Pak Kades historis di riwayat chat Balai Desa untuk ke-13 warga masih menyebut Blok 1 Kavling lama (teks sejarah saat mereka mendaftar; tidak ditulis ulang).

### Deploy

- Backup sebelum deploy: `/opt/pinarak/bak-alokasi/` (binary lama 9.818.264 byte + salinan `public/` + `warga.sql` hasil pg_dump) **dan** tabel `warga_bak_alokasi` di DB produksi (13 baris, `CREATE TABLE AS SELECT`).
- Binary dibangun di sandbox (Go 1.23.4, statis): md5 **`30640613c908086c15ca67625ce7f975`**. app.js `dedbaa04df1a811212b892a98bfcb01f`, index.html `9af5c0f5550926e5a7aee77fd6a39e6c`; style.css tidak berubah isinya (hanya parameter versi). Transfer per file ke `.baru`, md5 diverifikasi di server sebelum pindah tempat; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` Recreated/Started, `pinarak-db-1` Healthy, layanan lain tidak disentuh.
- Jalur publik: `/` memuat `?v=16`, `app.js?v=16` byte-identik dengan lokal.

### Verifikasi produksi

- `GET /api/warga`: ke-13 warga di Blok 1880 dengan kavling sesuai tabel migrasi; `/api/statistik` normal (warga 13, rumah 13, terisi 13).
- **Warga uji**: `POST /api/daftar` @uji.alokasi → **No. 14, Blok 1880 Kavling 3, RT 072/RW 10** (persis slot ke-14 permutasi), sambutan menyebut Blok 1880. Sesudahnya dihapus tuntas (warga + sesi + pesan sambutan chat; kandidat/suara memang 0): statistik kembali 13, keluarga kosong 0.
- **Login warga lama**: @zamourraa dengan PIN lamanya (123456) berhasil; data sesi menunjukkan Blok 1880 Kav 14; login tidak memicu sambutan (sesuai perilaku lama).
- `/api/pembangunan` tidak berubah (8 fasilitas, semua "belum"); pemilu tidak disentuh.
- **Render** (Chrome headless X99, tab baru memuat `?v=16`, scene dipinjam dari aplikasi live, pola `lihat_blok1c.py`): screenshot tersimpan di `~/workspace/wsdiag/bukti-blok1/` — `bloktengah_dekat.jpg` (13 rumah menyebar acak di seluruh petak Blok 1880, tidak sebaris), `bloktengah_konteks.jpg` (gugusan rumah berwarna persis di utara slab plaza + balai — desa kini tumbuh menempel pusat), `bloktengah_jalan.jpg` (level jalan: rumah di kedalaman bervariasi menghadap jalan selatan blok).

### Batas jujur

- Bukti visual render berasal dari renderer pinjaman di Chrome headless X99 (SwiftShader) dengan preset senja yang sama seperti verifikasi sebelumnya; kesan final di HP user tetap penilaian user.
- Batas muat data per-warga klien (2.000 pertama) tidak berubah — rumah warga ke-2.001+ belum ter-render sampai batas itu diangkat (catatan lama, di luar cakupan tugas ini).

## Alokasi Sebar: 1 Blok 1 Kavling Dulu (2026-11-21 ±16:0x WIB, koreksi Fahmi)

Koreksi Fahmi atas putaran ?v=16 ("Harusnya 1 blok dan 1 kavling dulu beda nomor rumah"): pola isi-satu-blok-penuh ditolak. Yang berubah HANYA urutan pengisian slot di server; UrutanBlok, himpunan 68 blok terlarang, dan PermutasiKavling tidak berubah. Klien tidak berubah sama sekali (tetap `?v=16` — sejak ?v=16 klien sudah data-driven kunci `"blok,kavling"`, terverifikasi dari `app.js?v=16` yang tersaji).

### Aturan final (server, `internal/db/db.go` fungsi `Alokasi`)

- Slot global diurutkan **(ronde, peringkat blok)**: ronde 1 = kavling permutasi posisi ke-1 dari SETIAP blok perumahan (blok menurut UrutanBlok dari plaza), ronde 2 = posisi ke-2 dari setiap blok, dst. Pendaftar ke-n → blok peringkat ((n−1) mod 3.932), ronde ⌊(n−1)/3.932⌋. `jumlahBlokPerumahan` (3.932) kini dihitung dari `BlokTerlarang`, tidak di-hardcode.
- Sesudah slot perumahan habis (98.300), 68 blok terlarang di akhir UrutanBlok tetap diisi blok demi blok sebagai cadangan luapan, persis seperti putaran lalu → kapasitas tetap tepat 100.000.
- Nilai kunci terverifikasi dari kode: peringkat 11 = Blok **1958** (permutasi-1: Kav 13), peringkat 12 = Blok **1963** (Kav 6), peringkat 13 = Blok **2038** (Kav 23), peringkat 14 = Blok **2043** (Kav 13). `Alokasi(3933)` = Blok 1880 Kav 8 (ronde 2 blok peringkat 1); `Alokasi(98300)` = Blok 4000 Kav 23 (slot perumahan terakhir).

### Test

- `TestAlokasi` ditulis ulang: kasus eksak nomor 1–14 + batas 3932/3933/98300; 13 pendaftar pertama terbukti di 13 blok berbeda masing-masing di kavling permutasi posisi 1; seluruh ronde 1 = 3.932 blok berbeda; loop lama dipertahankan (100.000 alokasi unik, nol blok terlarang di 98.300 pertama). `go test ./...` semua paket lulus, `go vet` & `gofmt` bersih.

### Deploy

- Backup: `/opt/pinarak/bak-sebar/` (binary lama 9.834.648 byte + `public/` 8 file + `warga.sql` 5.433 byte) **dan** tabel `warga_bak_sebar` di DB produksi (13 baris).
- Binary dibangun di sandbox (Go 1.23.4, statis): md5 **`49662e3c647d19bbac535b78488ba6c2`**, 9.838.744 byte; md5 diverifikasi di server sebelum tukar; `docker compose build app` (runtime COPY saja) + `up -d app`; `pinarak-app-1` Up, `pinarak-db-1` Healthy.

### Migrasi warga produksi — tetap 13 warga

- Tidak ada pendaftar organik baru sejak putaran lalu; ke-13 warga dimigrasikan dalam satu transaksi, hanya kolom blok/kavling (nomor rumah, NIK, keluarga, peran, PIN utuh). RT/RW kini mengikuti blok masing-masing (tidak lagi seragam).
- Posisi baru: #1 @thefahmihassan Blok **1880** Kav 22 · #2 @taa_lge12 Blok **1881** Kav 10 · #3 @zamourraa Blok **2120** Kav 15 · #4 @hana_kaemung Blok **2121** Kav 4 · #5 @drennvanzz_ Blok **1879** Kav 4 · #6 @4caa_caaaee Blok **1882** Kav 15 · #7 @dwiaprianti30_ Blok **2119** Kav 22 · #8 @ulandesheeran_ Blok **2122** Kav 16 · #9 @4yumbukanayam Blok **1800** Kav 12 · #10 @muhamad_aria_12 Blok **1801** Kav 14 · #11 @cil_aaaa38 Blok **1958** Kav 13 · #12 @kinannm_ Blok **1963** Kav 6 · #13 @azza.tyr Blok **2038** Kav 23. (#1 kebetulan tetap di 1880 Kav 22 — itu memang slot peringkat 1 aturan baru.)
- Catatan sama seperti putaran lalu: teks sambutan historis di riwayat chat untuk ke-13 warga masih menyebut posisi saat mereka mendaftar (teks sejarah, tidak ditulis ulang).

### Verifikasi produksi

- `GET /api/warga` jalur publik: ke-13 warga persis di posisi tabel migrasi; `/api/statistik` normal (warga 13, rumah 13, terisi 13); `/api/pembangunan` tidak berubah.
- **Warga uji**: `POST /api/daftar` @uji.sebar → **No. 14, Blok 2043 Kavling 13, RT 089/RW 11** (persis blok peringkat 14, kavling permutasi posisi 1; teks sambutan menyebut Blok 2043). Sesudahnya dihapus tuntas (warga + sesi + pesan sambutan chat + suara/kandidat): statistik kembali 13, keluarga kosong 0, sisa jejak uji 0.
- **Login warga lama**: @zamourraa dengan PIN lamanya (123456) berhasil; data sesi menunjukkan Blok 2120 Kav 15; login tidak memicu sambutan.
- **Render** (Chrome headless X99, scene dipinjam dari tab aplikasi live, renderer sendiri): `imDinding.count` = 13 di scene. Screenshot di `~/workspace/wsdiag/bukti-blok1/` — `sebar_konteks.jpg` (dari ketinggian: atap-atap berwarna tersebar di blok-blok berbeda mengelilingi slab plaza, tiap blok maksimal satu rumah) dan `sebar_dekat.jpg` (Blok 2120: satu rumah beratap merah sendirian di bloknya, kavling lain kosong berpagar; blok tetangga pun masing-masing satu rumah; distrik pusat terlihat di latar). Upaya pertama screenshot gagal (jebakan konstruktor THREE error di tab baru) dan diulang dengan pola pinjam tab yang sudah terbangun — hasil akhirnya yang dipakai.

## Rumah Detail Distrik: Sebar Organik + Warna Pemilik (2026-11-21 ±16:3x WIB, ?v=17)

Koreksi Fahmi atas masalah aslinya sejak awal ("Rumah berjejer hijau masih ada", screenshot HP 16:20): yang berjejer hijau ternyata BUKAN rumah massal alokasi server, melainkan **rumah pajangan Distrik Pusat** di `bangunDistrik()` — 30 rumah detail warga terbaru ditata 2 baris lurus (z=47 & z=−47, x −98..+98 stp 14) mengapit plaza, dengan dinding+atap dari satu palet zona plaza (ZONA_PUSAT) berjitter kecil → terbaca hijau seragam; warna baju pemilik tidak dipakai. Perbaikan client-only di `public/app.js` + bump `?v=17` di `index.html`; server Go tidak berubah.

### Pola penempatan final (blok murni baru "LOGIKA DISTRIK")

- Blok murni `slotDistrik(i, terpakai)` (bertanda AWAL/AKHIR LOGIKA DISTRIK, bisa diuji Node): kandidat dari cincin elips mengelilingi plaza (rx 122±15, rz 67±11) ber-jitter `hashInt` per indeks & percobaan; rotasi menghadap titik plaza (0, 8) + jitter ±0,13 rad. Cadangan terakhir: pindai grid deterministik kawasan reservasi.
- Kelayakan (`layakDistrik`): AABB tapak lama (±4,6 × ±4,2) diputar rotasi rumah harus bersih dari slab plaza `PLAZA_TAPAK` (longgar 0,6), 8 rect strip jalan tekstur tanah di blok reservasi `JALAN_PUSAT` (0,6), 29 rect rintangan statis + dekor + titik NPC plaza `RINTANGAN_PUSAT` (0,5; cermin rintangan pusatKota: balai, tugu, 2 papan, pohon/bangku/pot plaza, titik ngobrol, Pak Kades), dan rumah detail sebelumnya (celah halaman 1,6). **Aturan anti-berbaris**: kandidat ditolak bila ≥3 rumah terdahulu sudah segaris-x atau segaris-z dengannya (toleransi 1,6). Doorstep (6,4 di depan wajah rumah) tidak boleh masuk AABB rumah/rintangan lain.
- Rumah kini berdiri di rumput blok reservasi sekeliling slab (y=0; sebelumnya y=0,3 di atas slab). `rintanganDetail` kini memakai AABB hasil `slotDistrik` persis. Doorstep, `userData.pemilik/nomor/pintu`, label @username+jabatan, klik (`rumahKlik`), interior, dan NPC doppelganger (jalur plaza) tidak berubah perilakunya.
- Posisi 13 warga live (indeks warga terbaru 0–12): (−111,5; 30,0), (−52,5; 62,4), (−31,7; 61,4), (114,3; −6,6), (112,0; 32,8), (−13,4; 62,3), (−119,8; −32,3), (133,3; −9,8), (−115,9; −6,1), (−32,4; −61,2), (59,8; 60,0), (112,4; −33,8), (−8,7; −61,0) — tersebar di sabuk barat/selatan/timur/utara plaza, tidak segaris.

### Warna

- Atap rumah detail = **warna baju pemilik**: `warnaPemilik.get(w.blok + "," + w.kavling) || w.warna_baju` — perlakuan sama seperti rumah massal (`warna.set(milik)`). Dinding tetap pastel keluarga zona pusat dengan jitter saturasi/lightness per rumah yang lebih terasa (di `bangunDistrik`, tanpa mengubah fungsi zona bersama). `warnaAtapZonaHSL` tidak lagi dipanggil di `bangunDistrik`.

### Harness

- Baru: `~/workspace/wsdiag/uji_distrik.js` — mengekstrak blok LOGIKA DISTRIK + `hashInt` + `PLAZA_TAPAK` + `FASILITAS_BLOK`/`TAPAK_FASILITAS` persis dari source: **2.936 cek lulus, 0 gagal**. Cakupannya: 30/30 rumah terpasang & deterministik; tidak ada ≥4 rumah segaris-x/z (tol 0,75); jarak antar pusat min ≥10 dan tidak konstan (std >2); nol tumpang tindih AABB antar rumah (celah ≥1,5), vs slab plaza, vs strip jalan, vs rintangan/dekor plaza, vs AABB fasilitas dunia; doorstep tidak masuk rumah lain dan selalu terjangkau chip interior (jarak ke tepi AABB sendiri ≤3,4); rotasi menghadap plaza (dot >0,95); atap == warna baju pemilik untuk 30 warga contoh (termasuk 1 yang absen dari `warnaPemilik` → fallback `warna_baju`); asersi statis isi `bangunDistrik` (slot lama hilang, `warnaAtapZonaHSL` tak dipakai, `slotDistrik`/`p.bb` terpakai).
- Harness lama `uji_rumah`/`uji_jalan`/`uji_visual` sudah tidak ada di disk (dulu hidup di /tmp yang ter-wipe berkala; salinan di wsdiag hanya menyisakan seri ep1) — tidak bisa dijalankan ulang. Jalur kode rumah massal, lalu lintas, dan visual tidak disentuh putaran ini (perubahan hanya blok LOGIKA DISTRIK baru + isi `bangunDistrik` + versi aset), dan invariant yang relevan (jalan & tapak) dicakup ulang oleh harness baru.

### Deploy

- Backup: `/opt/pinarak/bak-distrik/public/` (8 file keadaan ?v=16). Upload hanya `app.js` + `index.html` via hst_put; md5 di server == lokal: app.js `5a0b33242fdcfd98f529edfd75e8dbb2` (259.658 byte), index.html `36cb51ab30825c0440136546eef44a3c`. `docker compose build app` (COPY public/ saja yang berubah) + `up -d app`; db Healthy.
- Verifikasi jalur publik: `app.js?v=17` tersaji byte-identik (md5 sama), index memuat `?v=17`, `/api/statistik` normal (warga 13, rumah 13, terisi 13).

### Render (Chrome headless X99, tab baru ?v=17, scene dipinjam, renderer sendiri)

- Tab live melaporkan 13 objek `userData.pemilik` (rumah detail) terbangun. Screenshot di `~/workspace/wsdiag/bukti-blok1/`: `distrik_atas.jpg` (dari atas plaza: rumah detail beratap warna-warni tersebar di empat sisi slab pada blok rumput reservasi; barisan hijau ganda di tepi plaza hilang total) dan `distrik_miring.jpg` (sudut miring tenggara: tiap rumah detail berdiri sendiri pada jarak & sudut bervariasi mengelilingi plaza, atap mengikuti warna baju pemilik — pink, kuning, ungu, merah, biru, teal; balai, papan, dan label warga tetap pada tempatnya). Keduanya sudah dilihat sendiri dan sesuai pola yang diminta.

### Batas jujur

- Bukti visual berasal dari renderer pinjaman di Chrome headless X99 (SwiftShader, preset senja) seperti verifikasi sebelumnya; kesan final di HP user tetap penilaian user.
- Empat rumah detail di sabuk selatan berdiri relatif berdekatan (x −52..+60 pada z ±60–62) — lolos semua invariant (tidak segaris, celah AABB ≥1,6, warna & rotasi beda) dan terbaca sebagai gugusan organik, bukan barisan; bila user menilai masih terlalu rapat, parameter cincin bisa dilonggarkan.

## Kembali ke 1 Blok + Rumah Detail di Kavling Asli (2026-11-21 ±16:4x WIB, ?v=18)

Keputusan eksplisit Fahmi (21 Nov 2026, 16:32): "bagus yang awal — 1 blok beda nomor rumah aja". Dua putaran koreksi sebelumnya DIBATALKAN: pola sebar ronde server ("Kenapa menyebar") dan scatter elips rumah detail ?v=17 ("Kenapa jadi ngacak"). Model final: warga terkumpul di SATU blok terdekat plaza, tiap rumah di kavlingnya sendiri; rumah detail bukan pajangan plaza — ia berdiri di kavling ASLI pemiliknya menggantikan instans massalnya.

### (A) Server — Alokasi kembali ke (peringkat blok, ronde)

- `internal/db/db.go`: `Alokasi` kembali persis ke rumus ?v=16a — `blok = urutanBlok[idx/PerBlok]`, `kavling = PermutasiKavling(blok)[idx%PerBlok]`; var `jumlahBlokPerumahan` yang tak lagi dipakai dihapus. Blok 1880 diisi 25 kavling permutasinya ([22 8 14 21 13 23 4 7 10 9 5 25 18 3 24 16 6 11 12 1 20 19 15 2 17]) dulu, lalu peringkat 2, dst; zona luapan blok terlarang tetap di akhir UrutanBlok → kapasitas tetap 100.000.
- `TestAlokasi` ditulis kembali ke ekspektasi itu: kasus eksak 1–14 (semua Blok 1880), 25 (Kav 17, blok penuh), 26 (Blok 1881 Kav 10), 98300 (Blok 4000 Kav 23); 25 pertama memenuhi tepat Blok 1880; blok ke-k penuh sebelum ke-(k+1); luapan dari u[3932]; 100.000 alokasi unik & nol blok terlarang di 98.300 pertama. `go test ./...` semua paket lulus, `go vet` & `gofmt` bersih (build & test di X99, Go 1.26.1 — sandbox tidak punya toolchain Go; X99 memang server build tetap).
- Deploy: backup `/opt/pinarak/bak-satu-blok/` (binary sebar 9.838.744 byte + `public/` ?v=17 + `warga.sql`) dan tabel `warga_bak_satu_blok` di DB. Binary baru md5 **`ef0f359ff9620913329bc3c9c4be914b`** (10.526.882 byte, statis, dibangun di X99), md5 diverifikasi di server sebelum tukar; `docker compose build app` (COPY-only) + `up -d app`; db Healthy.

### (B) Migrasi warga produksi — 14 warga (bukan 13)

- Saat migrasi dijalankan, produksi sudah **14 warga**: ada pendaftaran organik baru sesudah putaran sebar — **@zamouraa #14** (di Blok 2043 Kav 13, slot sebar-nya). Ia dimigrasikan sekalian ke slot aturan pulih yang memang miliknya: `Alokasi(14)` = **Blok 1880 Kav 3**. Satu `UPDATE ... CASE nomor_rumah` dalam transaksi, hanya blok/kavling berubah (nomor rumah/NIK/PIN/keluarga utuh).
- Posisi final (semua **Blok 1880**, RT 072/RW 10): #1 @thefahmihassan Kav 22 · #2 @taa_lge12 Kav 8 · #3 @zamourraa Kav 14 · #4 @hana_kaemung Kav 21 · #5 @drennvanzz_ Kav 13 · #6 @4caa_caaaee Kav 23 · #7 @dwiaprianti30_ Kav 4 · #8 @ulandesheeran_ Kav 7 · #9 @4yumbukanayam Kav 10 · #10 @muhamad_aria_12 Kav 9 · #11 @cil_aaaa38 Kav 5 · #12 @kinannm_ Kav 25 · #13 @azza.tyr Kav 18 · #14 @zamouraa Kav 3.
- **Warga uji**: `POST /api/daftar` @uji.satublok → **No. 15, Blok 1880 Kavling 24, RT 072/RW 10** (slot permutasi ke-15 aturan pulih — bergeser satu dari rencana awal karena warga riil kini 14), sambutan menyebut Blok 1880. Dihapus tuntas (warga + sesi + pesan sambutan chat id 33; ia bergabung sebagai Anggota ke KK lama @cil_aaaa38, tidak membuat keluarga baru): statistik kembali **14**, keluarga kosong 0. Login @zamourraa PIN lama berhasil → Blok 1880 Kav 14.

### (C) Klien ?v=18 — rumah detail di kavling asli

- `bangunDistrik()`: blok LOGIKA DISTRIK ?v=17 (slotDistrik elips + layakDistrik + JALAN_PUSAT/RINTANGAN_PUSAT, 83 baris) DIHAPUS seluruhnya; baris plaza lama juga tidak dikembalikan. Tiap warga di `wargaTerbaru` (maks 30) kini: posisi = `posisiKavling(w.blok, w.kavling)` persis, `rotation.y = 0` (menghadap +z/selatan — konvensi rumah massal: dinding tanpa rotasi, teras di sisi +z), doorstep `(x, z+6,4)`, `rintanganDetail` = AABB tapak detail (pusat ±4,6 × ±4,2) di posisi itu. Dinding & varian/cerobong atap memakai rumus hash instans massal untuk nomor rumah global yang sama (zona bloknya sendiri + `hashInt(nomorGlobal*…)`) → rumah detail terbaca sebagai versi rinci rumah yang sama; atap tetap warna baju pemilik (?v=17 dipertahankan). Label, `rumahKlik`, interior, dan NPC doppelganger di plaza tidak berubah perilaku.
- **Anti-duplikasi**: `rumahDetailSet` ("blok,kavling" irisan 30 terbaru) dibangun di `ambilData()` dari irisan yang sama persis dengan yang dibangun `bangunDistrik`. `bangunKotaMassal` menyaring `daftarIsi` dengan `!rumahDetailSet.has(kunciPos)`; `tabrakanRumahMassal` melewati kavling detail (cakupannya `rintanganDetail`). Invariant: tiap warga terlihat tepat 1 rumah; tiap kavling terisi tercakup tepat 1 sistem tabrakan.
- Harness baru `~/workspace/wsdiag/uji_satublok.js` (fungsi murni diekstrak persis dari source): **3.371 cek lulus, 0 gagal** — asersi statis (slotDistrik hilang, posisiKavling/rotasi 0/doorstep/filter/tabrak terpasang, index ?v=18); skenario A 13 warga Blok 1880 (detail 13, massal 0), B 40 warga (detail 30, massal 10, irisan kosong, total 40), C 25 warga 1 blok; posisi detail == posisiKavling data; nol tumpang tindih AABB detail↔detail, detail↔massal, detail↔PLAZA_TAPAK; doorstep selalu 2,2 di luar AABB sendiri (≤3,4 jangkauan chip) dan tidak masuk AABB rumah lain.
- Deploy: app.js md5 **`61753c4043ee7e961f4021d54a6b18dd`** (255.722 byte), index.html `fe63667c83bebb03f5c7aee3875a8788`; md5 lokal == server == tersaji publik (`app.js?v=18` byte-identik), `/api/statistik` normal (warga 14, rumah 14, terisi 14).

### Render (Chrome headless X99, tab baru ?v=18, scene dipinjam, renderer sendiri)

- Data scene live: **14 rumah detail** (`userData.pemilik`) terbangun, SEMUA pada koordinat `posisiKavling` Blok 1880 yang persis (mis. @thefahmihassan (−49,−91) Kav 22, @zamouraa (−35,−147) Kav 3) dengan rotasi 0 — tidak ada satu pun di kawasan plaza.
- Screenshot di `~/workspace/wsdiag/bukti-blok1/`: `satublok_1880.jpg` (Blok 1880 dari tenggara: 14 rumah detail berdiri menyebar di petak-petak permutasi dalam satu blok — atap warna pemilik pink/ungu/teal/kuning/oranye/merah/biru, label @username di tiap rumah, teras menghadap selatan, kavling kosong tetap lahan berpagar; tidak ada rumah ganda/z-fighting) dan `satublok_plaza.jpg` (plaza BERSIH: hanya balai, papan raksasa, papan rencana, NPC berlabel, bangku & pohon pot — gugusan warna Blok 1880 terlihat di utara plaza). Keduanya sudah dilihat sendiri dan sesuai model yang diminta.

### Batas jujur

- Bukti visual berasal dari renderer pinjaman di Chrome headless X99 (SwiftShader, preset senja) seperti verifikasi sebelumnya; kesan final di HP user tetap penilaian user.
- Warga ke-31+ (di luar 30 terbaru) tampil sebagai rumah massal biasa di kavlingnya — perilaku lama yang sama seperti sebelum ?v=17; batas muat data per-warga klien (2.000 pertama) juga tidak berubah.

## Upgrade Skill 3D: Rumah, Interior, Karakter — ?v=19 (21 Nov 2026)

Perintah Fahmi: "Pake skill 3d untuk rumah, interior, karakter". Klien saja; server Go & perilaku ?v=18 (alokasi 1 blok, rumah detail di kavling asli + anti-duplikasi) tidak berubah. Teknik diambil dari skill yang baru terpasang di `~/workspace/custom-skills/`: **img2threejs** (konstruksi prosedural per-bagian + dudukan fitur berbasis rumus + loop koreksi-diri), **character-artist** (proporsi sebelum detail, pakaian sebagai bentuk terpisah), **lowpoly-style** (siluet besar terbaca, anggaran segitiga karakter 500–3.000), **prop-artist/set-dressing** (klaster properti 3–7 per zona cerita, jalur lalu-lalang bebas), **lowpoly-3d-render** (bahasa visual referensi Pak Kades + pelajaran rambut digeser mundur-naik).

### (A) Karakter — `bentukKepala` + `mukaZ` (img2threejs head construction)

- Geometri kepala tidak lagi ellipsoid polos: `bentukKepala()` membentuk ikosahedron dengan fungsi murni `taperKepala(t)` — pipi melebar (×1,04), rahang menyempit ke dagu (−22%), ubun-ubun diratakan halus. Skala mesh menjadi (1 / 1 / 0,92), jari-jari efektif RK (0,4576 / 0,44 / 0,4048), puncak abs ±1,96.
- Semua fitur wajah didudukkan dengan `mukaZ(x, y)` (rumus permukaan + taper yang sama) — bukan ditebak: mata berjarak lebar ala referensi (pusat ±0,16 = 0,36 lebar kepala), putih diperbesar (skala 1,05×1,3), pupil 0,052, highlight 0,02 di kiri-atas; alis lebih tebal/panjang (0,19×0,05) melengkung mengikuti dahi; telinga setinggi garis mata; blush lebih besar (r 0,07).
- Senyum lebar terbuka ala referensi: busur bibir (torus r 0,125, cokelat hangat) + busur **gigi** putih (r 0,092) bersarang di dalamnya — dua tabung 3D, tanpa kartu pipih. Hidung kerucut 7-sisi (faset bersih).
- Peci lebih tinggi & berfaset tegas (badan h 0,30, r 0,345/0,39 + sabuk + kubah); rambut varian polos digeser mundur-naik (0, +0,01, −0,035, rot.x −0,32) mengikuti pelajaran resep Blender supaya tidak menelan dahi; kubah topi menyesuaikan skala kepala baru.
- Pakaian sebagai bentuk terpisah (character-artist): bantalan **bahu** menutup celah torso–lengan, dua **lidah kerah runcing** di dada (kerah kemeja referensi), **manset** lipatan lengan tergulung di tiap lengan.
- Kontrak lama utuh (dijaga harness): pivot pinggul 0,52 / bahu (±0,42, 1,14), bawah sepatu tepat y=0, `userData.sy` mata untuk kedip, ayunan jalan berlawanan fase ≤ AYUN_KAKI. Hasil: **45 mesh / 1.658 segitiga per karakter** (di dalam anggaran lowpoly-style; +7 mesh dari ronde 3). `renderFoto3D` memakai builder yang sama → foto KTP ikut membaik.
- **Iterasi koreksi-diri 1×** sesudah render pertama: hidung diperbesar (r 0,068, h 0,15, z 0,395) dan busur gigi diperkecil/diturunkan (r 0,092, tabung 0,015) + bibir dipergelap (0x7c4030) — render ulang menunjukkan senyum bergigi terbaca sebagai gigi di dalam bibir; hidung tetap fitur paling halus di renderer pinjaman (fasetnya menangkap cahaya, tonjolannya kecil).

### (B) Rumah

- **Detail** (`buatRumahDetail`, 11 → 27–31 mesh): plinth pondasi batu (seluruh rumah naik 0,18 di atasnya secara konsisten — dinding/atap/cerobong/pintu/jendela), lis keliling di bawah atap, papan sudut krem ×4, pintu berbingkai + kenop kuningan + undakan batu, jendela depan berbingkai kayu + kusen silang + ambang, **jendela samping** (+x), atap teras dimiringkan, hiasan halaman deterministik per varian (semak ikosahedron / pot bunga). Semua di dalam tapak tabrakan ±4,6 × ±4,2 (overhang atap limas lama ±5,80 tidak berubah).
- **Massal** (`bangunKotaMassal`): tepat **+1 InstancedMesh** untuk seluruh kota — `geometriDetailMassal()` menggabungkan plinth + lis + pintu berbingkai + jendela berbingkai berkusen menjadi satu geometri berwarna-vertex (`gabungBerwarna`, 13 kotak = 156 segitiga/instans, material `vertexColors`, tanpa `instanceColor`). Bingkai jendela **dialignkan persis** ke jendela lukisan `TEX_DINDING` (pusat x ±1,89, y 1,51–2,94 pada dinding 8,6×4,2) sehingga bingkai 3D duduk di atas kaca lukisan; transform instans sama dengan dinding (skala-y `syDari`) → alignmen bertahan di semua variasi tinggi. Total draw call kota hanya +1.

### (C) Interior — set-dressing per klaster (147 → 186 mesh, cahaya tetap 4)

- Zona tidur: kain lempar aksen-gelap di kaki selimut + bantal kecil menjadi warna aksen pemilik. **Tumpukan kasur ?v=12 tidak berubah satu nilai pun** (dijaga asersi persis di harness) dan nakas tetap di timur kepala kasur.
- Zona hidup: karpet kini berbingkai (lapisan bawah aksen-gelap 6,0×4,6 di bawah karpet aksen), kain lempar di sandaran lengan sofa, ambang jendela kayu + pot mungil di ambang.
- Zona kerja: mug + tempat pensil berisi 2 pensil di meja, rak dinding di atas meja (3 buku + tanaman mungil).
- **Dapur mini** (klaster baru, dinding timur z 3,25–5,15): konter berpintu ×2 + pelat atas kayu + pelat kompor + 2 tungku + teko baja + rel gantung dengan wajan & panci.
- **Klaster pintu masuk**: rak sepatu (2 pasang sepatu) + 3 kait kuningan + tas gantung aksen di sisi pintu selatan; koridor pintu (x ±1,1) bebas.
- Struktur: 2 balok plafon kayu. Turunan warna `aksenGelap` (aksen ×0,68) dipakai konsisten untuk kain/batas.
- Halang 10 → **12** (dapur 7,05–8,0 × 3,2–5,2; rak sepatu −2,85…−1,55 × 5,9–6,35); harness membuktikan nol tumpang tindih antar ke-12 halang dan titik spawn/koridor pintu bebas halangan.

### Harness & deploy

- Harness baru `~/workspace/wsdiag/uji_skill3d.js` (blok diekstrak persis dari source, three.min.js r128 asli di Node): **168 cek lulus, 0 gagal** — struktur/pivot/dudukan wajah/kedip/jalan/anggaran segitiga karakter, tapak & jumlah bagian rumah detail, atribut warna + alignmen geometri massal, tumpukan kasur persis + 12 halang interior. Regresi `uji_satublok.js`: **3.371 lulus, 0 gagal** (pin versi harness disesuaikan ke ?v=19).
- Deploy: backup `/opt/pinarak/bak-skill3d/` (public/ ?v=18); hanya `app.js` + `index.html` diupload; `docker compose build app` (COPY-only) + `up -d app`; db Healthy. app.js final md5 **`03c31fd4133a03d0986ac481bf73f638`** (270.245 byte, sesudah iterasi karakter), index.html `4aeb31a6cebe2871ca8a2da2c1d17a61`; md5 lokal == server == tersaji publik; `/api/statistik` normal (warga 14, rumah 14, terisi 14).

### Render (Chrome headless X99, tab baru ?v=19, scene dipinjam, renderer sendiri)

Screenshot di `~/workspace/wsdiag/bukti-blok1/` — semua sudah dilihat sendiri:
- `karakter_dekat.jpg` — Pak Kades dari depan ¾: peci tinggi berfaset, mata besar + highlight, alis tebal, senyum bergigi, blush, lidah kerah + kancing terbaca; pose melambai (animasi Kades) utuh.
- `rumah_detail.jpg` — rumah detail Blok 1880 dari jalan: bingkai + kusen silang + ambang jendela, jendela samping, plinth, lis atap, papan sudut, pot bunga — siluet & detail terbaca dari jalan; rumah tetangga konsisten.
- `interior_skill.jpg` — interior @zamourraa sudut lebar: zona tertata (papan nama, KK berbingkai, rak buku, karpet berbingkai, balok plafon). Pendukung: `interior_kasur.jpg` (tumpukan kasur benar + nakas timur + kain lempar), `interior_dapur.jpg` (TV, sofa berkain lempar, meja + rak dinding, dapur mini di belakang sofa), `rumah_atas.jpg`, `karakter_samping.jpg`.

### Batas jujur

- Render interior dari renderer pinjaman tampak pucat (palet krem ruangan + cahaya SwiftShader) — bukan regresi; kesan final di HP user tetap penilaian user, sama seperti putaran sebelumnya.
- Delta performa: karakter +7 mesh / ±1.658 segitiga (×maks 50 pemain terdekat), rumah detail +±18 mesh (maks 30 rumah), interior +39 mesh (1 ruangan), kota +1 draw call (detail massal, 156 segitiga × rumah massal terisi — saat ini 0 karena 14 warga semuanya rumah detail).

## Perbaikan Kanopi Rumah (?v=20 → koreksi ?v=21)

Keluhan Fahmi sesudah melihat render ?v=19: "Kenapa kanopi Lebih pendek dari pintu".

### Diagnosis (dari angka di buatRumahDetail)
- Pintu berbingkai: lebar 1,34 (x −0,67..0,67), puncak bingkai y = 1,38 + 2,06/2 = **2,41**; daun pintu 1,10, puncaknya 2,25.
- Kanopi ?v=19 (`atapTeras`): lebar 3,1 × tebal 0,13 × dalam 1,7, terpasang di **y 1,70** (rentang ±1,61–1,79) — jadi lebarnya sebenarnya SUDAH melebihi pintu, tetapi posisi pasangnya **0,71 di bawah puncak bingkai pintu**: bidang kanopi memotong daun pintu di ketinggian ±70%-nya. Itulah yang terbaca "lebih pendek dari pintu" di render. Tiang penyangga ikut pendek (tinggi 1,55, puncak 1,63).

### Perubahan (hanya buatRumahDetail; rumah massal tidak punya kanopi — geometriDetailMassal hanya plinth/lis/pintu/jendela, tidak diubah)
- Kanopi: lebar 3,1 → **3,5**, dalam 1,7 → **1,8**, posisi y 1,70 → **2,68** (kemiringan −0,10 tetap). Sisi bawah kanopi kini 2,53–2,70 — selalu di atas puncak bingkai pintu 2,41 (jarak bebas ±0,27 di bidang pintu) dan di bawah lis atap (bawah lis 2,99; puncak belakang kanopi 2,83). Ujung depan z = 4,0, tetap di dalam tapak tabrakan ±4,6×±4,2.
- Tiang: x ±1,3 → **±1,45**, tinggi 1,55 → **2,4** (berdiri di pelat teras y 0,22, puncak 2,62 menyentuh sisi bawah kanopi 2,56 — menyatu, tanpa celah).
- Siku penopang diagonal sempat ditambahkan di build ?v=20 pertama, tetapi dari render terbaca seperti ranting miring di depan jendela — tidak cocok dengan gaya rumahnya, jadi **ditiadakan** dan build koreksinya dirilis sebagai ?v=21 (bump versi agar tidak tercampur cache ?v=20). Mesh rumah detail kembali 31 (varian 0 + cerobong).

### Verifikasi
- Harness: `uji_skill3d.js` **192 lulus, 0 gagal** (termasuk asersi baru: kanopi ditemukan, bbox min.y > 2,41, lebar ≥ 3,4, z maks ≤ 4,2 untuk semua varian) + regresi `uji_satublok.js` **3.371 lulus, 0 gagal**. Penanda versi basi di kedua harness diperbarui ke ?v=21.
- Visual: render pinjam-scene Chrome X99 dari situs live — `~/workspace/wsdiag/bukti-blok1/rumah_kanopi.jpg` (depan lurus, rumah warga #1 Blok 1880 Kav 22): kanopi terbaca jelas di atas pintu, jauh lebih lebar dari pintu, menaungi pintu + undakan + teras, ditopang 2 tiang lurus. Sudah dilihat sendiri.
- Deploy: backup `/opt/pinarak/bak-kanopi/` (app.js + index.html ?v=19); hanya `app.js` + `index.html` diupload; `docker compose build app` (COPY-only) + `up -d app`. app.js final md5 **`9ed54b43a8535836cc575de07c146861`**, index.html `4b944355d63f9d792b3d56d98c2346c6`; md5 lokal == server == tersaji publik; `/api/statistik` normal (warga 14, rumah 14, terisi 14). Server Go tidak disentuh.

---

## Rebrand Negara Merdu — 21 Nov 2026 (perintah Fahmi 18:13–18:15 WIB)

Desa Pinarak → **Negara Merdu**; game menggantikan website Merdu di root **merdu.id**; Kades → Presiden. Client **?v=22**.

### Tahap A — Istilah + ikon SVG
- Pemetaan diterapkan di client (public/) + server Go: "Desa Pinarak"→"Negara Merdu", "Pak Kades"→"Pak Presiden" (34×), "Kepala Desa"→"Presiden", "Balai Desa"→"Istana Negara" (termasuk nama ruang chat), "Kas Desa"→"Kas Negara", "Kartu Warga"→"Kartu Warga Negara", "@desapinarak"→"@negaramerdu", "Waktu desa"→"Waktu negara", kop KTP/KK, papan canvas plaza "N E G A R A M E R D U", sambutan server, `PengirimSistem = "Pak Presiden"`, label pemilu tertinggi "Presiden". Manifest PWA: "Negara Merdu"/"Merdu". Key internal level `"kades"` dan path modul Go `pinarak/...` sengaja tidak diubah (tidak terlihat pengguna). Pesan chat historis di DB tidak diubah. Nol sisa string lama di public/ + goserver.
- **Ikon emoji → SVG buatan sendiri** (instruksi Fahmi "Jangan pake emoji icon, lu generate sendiri"): semua ikon UI diganti path SVG inline 24×24 stroke currentColor (kelas `.ik`): chat, warga, rumah, grid, peta, putar, kualitas (sliders), jam, keluarga, pemilu (kotak suara), pembangunan (crane), mode mata/orang/drone, segitiga naik/turun, pintu, KTP, glyph IG, istana, dokumen, unduh; di app.js lewat objek `IK`. Konteks textContent/canvas: emoji dicabut (teks polos). Sisa glyph tipografis saja: ☰ ✕ ✓ (bukan emoji). Pengecualian Fahmi: bio IG boleh emoji.
- Go: `go vet` + `go test ./...` LULUS di X99 (Go 1.26.1, GOTOOLCHAIN=local); binary baru md5 `55745360c58a169ee75a74fedbaa0879`. Harness: uji_skill3d **192/0**, uji_satublok **3.371/0** (pin versi ?v=22).

### Tahap B — Domain merdu.id
- Keadaan awal: root merdu.id A → Oracle 140.245.124.194 (proxied) → nginx "Gateway Fallback LB" → upstream Hostinger merdu-lb-proxy → merdu-frontend (Traefik). Backup: **`/opt/backup-merdu-web-20261121/`** di Hostinger (compose Merdu + snapshot HTML root lama + inspect container) dan **`/opt/pinarak/bak-negara/`** (public/ + binary lama).
- Alih routing: label `traefik.enable=false` pada merdu-frontend (data/volume tidak dihapus; merdu-redis ikut recreate sebagai dependensi, sehat). pinarak-app dapat router: `negara` (merdu.id https, certresolver cfdns), www → redirect permanen ke root, pinarak.mfah.me → redirect permanen ke merdu.id (Traefik redirectregex permanent = **308**, padanan permanen dari 301). DNS: merdu.id A → **76.13.197.226 (Hostinger) proxied**; www CNAME diubah **proxied=true** (sertifikat origin LE untuk merdu.id kedaluwarsa sejak 20 Mei 2026 — jalur publik aman lewat terminasi TLS Cloudflare, sama seperti situs lama berjalan).
- Insiden DB: recreate pertama crash-loop (DATABASE_URL tidak ada di .env; compose jalan dari cwd salah → password default). Terbukti DB live = **pinarak-db-1** (isi cocok persis: warga #12–#14 di kavling ?v=18); DATABASE_URL ditambahkan ke /opt/pinarak/.env dari nilai POSTGRES_* yang sudah ada. App sehat: log "Negara Merdu (Go) jalan di 0.0.0.0:8026".
- Efek samping diperbaiki: middleware `redirect-to-https@docker` (dipakai router http webmail) tadinya didefinisikan label merdu-frontend; definisinya dipindah ke label pinarak-app — error Traefik berhenti (0 sejak perbaikan), mail tidak berubah fungsi.
- Verifikasi publik dari sandbox: https://merdu.id **200** judul "Negara Merdu"; /api/statistik normal; https://www.merdu.id **308 → https://merdu.id/**; https://pinarak.mfah.me **308 → https://merdu.id/**; https://mail.merdu.id **200**; md5 app.js/index.html/style.css/manifest tersaji == lokal. Warga saat verifikasi: **15** (pendaftar baru #15 @drrennvanzz, Blok 1880 Kav 24 — bukan 14 lagi).

### Tahap C — Instagram
- Username **@negaramerdu** dan nama tampilan **"Negara Merdu"** ternyata sudah diganti Fahmi sendiri sebelum tahap ini jalan (terverifikasi via instagram-cli profile).
- Bio diganti (147/150 karakter, emoji diizinkan khusus bio): "🏛️ Negara 3D: follower jadi warga negara / Daftar → rumah, KTP & Kartu Keluarga / Dipimpin Pak Presiden · 100.000 kavling / 👇 Follow & daftar di merdu.id".
- Link bio: judul **"Masuk Negara Merdu"** → **https://merdu.id** (link_id baru 4045624779065795); field website ikut https://merdu.id. Terverifikasi baca-ulang profil.

### Tahap D — Cron kas
- Job `kas-desa-ig-harian`: judul → "Kas Negara Merdu — hitung interaksi IG harian"; body: "Kas Desa @desapinarak" → "Kas Negara @negaramerdu", rujukan akun IG → negaramerdu, laporan → "saldo Kas Negara". Aturan hitung TIDAK berubah (like 10.000, share 1.000.000 bila data ada, komentar 0; lapor hanya bila saldo berubah). Diverifikasi baca-ulang; run pertama dengan wording baru: Sabtu 21 Nov 2026 20:07:41 WIB.
- Rollback bila perlu: DNS merdu.id A kembali ke 140.245.124.194 + `traefik.enable=true` lagi di compose Merdu + pulihkan /opt/pinarak dari bak-negara.

## Pembersihan Sambutan Chat Historis (21 Nov 2026, sesudah rebrand)
- Keluhan Fahmi: sambutan chat masih berbunyi "Pak Kades". Penyebab: 15 pesan sambutan sistem lama (sistem=1, warga_id=0) tersimpan di DB sejak sebelum rebrand — kolom username masih "Pak Kades" dan isi masih "Desa Pinarak". Template baru memang sudah benar, pesan historis waktu rebrand sengaja tidak diubah; sekarang diubah atas perintah Fahmi.
- Backup sebelum UPDATE: `/opt/pinarak/bak-sambutan/chat-sistem-sebelum.json` (15 baris sistem) + `chat-semua-sebelum.json` (seluruh tabel chat, 16 baris) di Hostinger.
- UPDATE (satu transaksi, hanya baris sistem): username "Pak Kades"→"Pak Presiden" 15 baris; isi "Desa Pinarak"→"Negara Merdu" 15 baris; "Balai Desa"/"Kepala Desa"/"Pak Kades"/"Kades"/"kas desa" di isi: 0 baris (memang tidak ada). Fakta historis blok/kavling/RT di teks dibiarkan. Pesan warga asli (1 baris) tidak disentuh.
- Verifikasi: query baca ulang — sisa istilah lama di pesan sistem = 0 semua; total chat tetap 16. Jalur publik WS (token warga tes): riwayat 17 pesan, nol "Kades"/"Desa Pinarak", pengirim sistem "Pak Presiden".
- Bukti jalur baru: daftar @uji.sambutan22 → sambutan respons + baris chat tersimpan: "Selamat datang @uji.sambutan22, warga ke-16 Negara Merdu..." dari "Pak Presiden". Warga tes + sesi + pesan sambutannya + keluarga barunya (id 5, anggota tunggal) dihapus bersih; /api/statistik kembali warga 15.
- Catatan: frasa "pintu desa selalu terbuka" tetap — template sambutan BARU di server Go (chat.go TeksSambutan) juga masih memakai frasa itu, jadi historis dan baru konsisten.

## Auto-Register Follower Baru (21 Nov 2026 ~19:15 WIB)
- Mekanisme: cron `negaramerdu-autoreg-follower` tiap 30 mnt menjalankan `~/workspace/pinarak/autoreg/autoreg.py`. Sumber follower: `instagram-cli followers` akun @negaramerdu (17841467282682017); pembanding: `/api/warga` live + `~/workspace/pinarak/autoreg/state.json` (ditulis atomik, ada lockfile anti-tumpang-tindih). Kandidat: follower belum jadi warga + lolos regex username + belum gagal permanen; maks 20/run.
- Pembuatan dieksekusi di sisi Hostinger (`autoreg/host_exec.py` meneruskan skrip Python via SSH double-hop stdin, fish-safe): token admin dibaca lokal dari .env di sana, POST ke 127.0.0.1:8026/api/daftar dengan header admin, PIN default 123456, TANPA gender (NULL — warga melengkapi sendiri saat pertama masuk), penampilan deterministik dari SHA-256 username (palet sama seperti pra-daftar manual).
- Verifikasi server live sebelum run pertama: binary live saat itu BELUM memuat kolom gender (DB belum punya kolom gender; source Go sudah punya logika gender + jalur admin, belum ter-deploy) — pendaftaran tanpa gender aman di kedua keadaan.
- Dry-run: 3 kandidat. Run pertama (backlog): @tati19384 → Rumah 16 (Blok 1880 Kav 16), @yiinu___ → Rumah 17 (Blok 1880 Kav 6), @yogiibandheloo → Rumah 18 (Blok 1880 Kav 11). Statistik 15 → 18 warga. Run kedua langsung sesudahnya: 0 kandidat (idempoten terverifikasi).
- Insiden probe: satu akun sampah @zzprobe98765 sempat terbuat saat probing validasi gender (jadi warga #16) — sudah dihapus bersih dari DB (warga+sesi+chat+keluarga barunya), statistik kembali 15 sebelum run pertama.
- Batas jujur: daftar `followers` IG bisa tertinggal dari penghitung profil (saat run pertama: profil 14 follower vs daftar 12 nama, dan 3 kandidat justru follower yang tidak muncul di penghitung lama) — diff run berikutnya menangkap yang belum terdaftar begitu IG mengeksposnya. Cron lapor ke chat hanya bila ada CREATED atau FAIL.

## Gender Pendaftaran + Lengkapi Profil (21 Nov 2026 malam, ?v=23)
- Perintah Fahmi: "Bikin gender pas daftar. Misal user belum bikin tanpa pin, dan pas user mau bikin user tinggal dikasih suruh bikin pin dan gender dll" + syarat tambahan: jalur pra-daftar resmi untuk auto-register follower (akun dibuatkan sistem: PIN default 123456, gender KOSONG, dilengkapi orangnya saat login).
- Skema: migrasi aman `ALTER TABLE warga ADD COLUMN IF NOT EXISTS gender TEXT` (nullable; nilai "L"/"P"). Terverifikasi live: kolom ada, 18 warga lama gender NULL.
- API:
  - POST /api/daftar: field `gender` WAJIB (400 "Gender wajib dipilih (L/P)" bila kosong/di luar L/P). Pengecualian resmi: header `X-Admin-Token` yang valid (token admin yang sama dengan pemilu/pembangunan) → gender BOLEH kosong, warga tercipta gender NULL (jalur pra-daftar auto-register); header ada tapi salah → 403. Respons daftar & GET /api/saya memuat `gender` (hanya di payload privat pemilik).
  - Login & /api/saya memuat dua bendera: `pin_default` (PIN terverifikasi == "123456", dideteksi saat itu juga dari hash tersimpan — TANPA flag retroaktif, jadi akun pra-daftar lama ikut tertangkap) dan `gender_kosong`.
  - POST /api/lengkapi (butuh sesi): body {pin_baru, gender, warna_baju, warna_kulit, topi}. pin_baru WAJIB tepat 6 digit bila akun pin_default (dan DITOLAK 400 bila dikirim untuk akun non-default); gender wajib L/P; penampilan divalidasi bila diisi, kosong = pertahankan. Sesudah ganti, PIN lama tidak berlaku. Mengembalikan data saya terbaru + bendera yang dihitung ulang.
  - Gender TIDAK masuk payload publik /api/warga maupun WebSocket (diuji: body /api/warga tidak memuat "gender").
- Klien (?v=23): form daftar — pemilih "Jenis kelamin" (tombol Laki-laki/Perempuan, teks saja tanpa emoji, tanpa pilihan bawaan) di langkah rupa; daftar ditolak di klien bila belum dipilih. Modal "Lengkapi Profil" muncul sesudah login ATAU sesi pulih bila `pin_default || gender_kosong`, TIDAK bisa ditutup sebelum tersimpan: field PIN baru + konfirmasi (hanya bila pin_default), pemilih gender (wajib), penampilan terisi awal dari data sekarang. Simpan → POST /api/lengkapi → muat ulang data saya & kota + sambung ulang WS. KTP (DOM + unduhan PNG) dan Kartu Warga Negara menampilkan baris "Jenis Kelamin: Laki-laki/Perempuan"; gender kosong tampil "—" konsisten di DOM & PNG (logika jarak baris PNG bertingkat: ≤6 baris longgar, 7 rapat, 8+ paling rapat — panel tidak meluber). Catatan jujur: model karakter 3D BELUM dibedakan berdasarkan gender (pekerjaan terpisah bila Fahmi mau).
- Uji Go (X99, pohon lengkap, PostgreSQL 16 buangan): gofmt bersih, vet lulus, `go test ./...` SEMUA paket lulus — termasuk uji integrasi baru `warga_gender_test.go`: daftar tanpa gender 400; gender "X" 400; gender sah tersimpan; pra-daftar admin 201 + gender NULL; token admin salah 403; lengkapi menolak pin_baru bukan 6 digit & tanpa gender; lengkapi mengganti PIN (lama 401, baru 200) + mengisi gender; login akun pra-daftar memuat dua bendera. (Satu kegagalan awal TestLabelJabatan terbukti artefak pohon build X99 yang basi — pra-rebrand; pohon kanonis sandbox lulus penuh.)
- E2E produksi (localhost Hostinger, token admin dibaca lokal dari .env, tidak pernah ditampilkan): A1 tanpa gender 400; A2 daftar gender L → /api/saya gender L, bendera mati; B1 pra-daftar admin → 201 gender NULL; B2 token salah → 403; B3 login → pin_default+gender_kosong menyala; B4 lengkapi (PIN baru + gender P + ganti warna baju) → 200; B5 PIN lama 401, PIN baru 200 dengan gender & warna baru. Warga tes (uji.gender1/uji.gender2) + sesi + sambutan chat dihapus bersih (keluarga 7 yang mereka tumpangi tidak dihapus — masih berisi warga asli).
- Harness klien: uji_skill3d 192 lulus 0 gagal; uji_satublok 3.371 lulus 0 gagal (pin versi diperbarui ke ?v=23).
- Deploy: backup `/opt/pinarak/bak-gender/` (binary ?v=22 + public lama). Binary dibangun di X99 (Go 1.25, md5 tahap ini 16c7435a…), public di-COPY, image runtime di-rebuild COPY-only; md5 tersaji == lokal; /api/statistik normal. Warga saat deploy 18 (15 + 3 hasil auto-register follower: @tati19384, @yiinu___, @yogiibandheloo — semuanya PIN default + gender NULL, tertangkap alur lengkapi saat pertama masuk).
- Batas verifikasi: modal lengkapi terverifikasi di level API + bendera + wiring klien (node --check lulus); penampakan visual modal di browser HP belum dicek langsung putaran ini.

## Alokasi Kavling Berurutan (21 Nov 2026 malam, tahap 2)
- Perintah Fahmi: isi kavling di dalam blok diganti dari permutasi acak deterministik menjadi BERURUTAN TANPA LUBANG.
- Server: `Alokasi` — urutan blok tetap (terdekat plaza dulu, Blok 1880 pertama, 68 blok terlarang dilewati), kavling sekarang `idx%25 + 1` (1, 2, 3, … 25). Fungsi `PermutasiKavling` (Fisher-Yates) DIHAPUS beserta ujinya; TestAlokasi ditulis ulang mengikuti aturan baru (kasus tangan + blok penuh berurutan + luapan kav 1 + tanpa ganda di 100.000 slot). gofmt bersih, vet + `go test ./...` lulus semua. Klien TIDAK berubah (posisi rumah murni dari data server) — versi tetap ?v=23.
- Migrasi: backup `/opt/pinarak/bak-urut/` (dump `warga-sebelum.sql` 8.436 byte + binary build gender) dan tabel `warga_bak_urut` (19 baris). UPDATE satu transaksi: `kavling = nomor_rumah` untuk Blok 1880 — 19 warga terpetakan #1→Kav 1 … #19→Kav 19 (saat migrasi jalan warga sudah 19: #19 @0x646a6_00 mendaftar organik selama deploy tahap 1, sempat Kav 12 pola lama). Nomor rumah, NIK, PIN, keluarga TIDAK berubah.
- Verifikasi: warga tes @uji.urut mendaftar → Blok 1880 Kavling 20 persis. Render bukti Blok 1880 (pinjam-scene Chrome X99, scene live 20 rumah detail): foto tegak menunjukkan 20 rumah rapat 4 baris × 5 tanpa lubang, baris ke-5 kosong — `~/workspace/wsdiag/bukti-urut/blok1880_{tegak,atas,miring}.jpg`. Warga tes + sesi + sambutan dihapus; statistik akhir 19 warga.
- Deploy: binary tahap 2 dibangun di X99 (md5 4d4e9a3b…), menggantikan build gender di image yang sama (COPY-only); md5 /opt/pinarak/pinarak == build X99; public tidak berubah.

## Istana Negara Mewah (21 Nov 2026 malam, ?v=24)
- Perintah Fahmi: "Istana negara bikin mewah". Gedung kantor Pak Presiden di Distrik Pusat dibangun ulang TOTAL (klien saja, server Go tidak disentuh). Papan raksasa "NEGARA MERDU", papan rencana, dan tugu TIDAK diubah.
- Rancangan akhir (grup di (0,0,-34), depan +z, semua simetris):
  - Badan utama dua tingkat (30×12 bawah, 24×10 atas) di podium batu 58×19,3 setinggi 1,2 berlis emas; cornice krem + pita emas di tiap tingkat; atap bertingkat (skirt + atap utama piramida) dan kubah menara tengah — semua **hijau tua 0x2e5d43** (pilihan palet: terakota sudah mendominasi atap rumah warga & tugu; hijau tua + krem 0xfdf3d8 + emas 0xd9a441 paling terbaca "istana" di golden hour); menara berlis emas, kubah setengah bola, puncak tiang + bola emas (titik tertinggi ±23,5).
  - Portico: tangga lebar 13 (4 undakan) dengan balustrade batu (rel miring + 5 baluster/sisi + tiang ujung berbola emas), 6 kolom putih beralas batu & berkapitel emas, entablature berpita emas dengan papan nama canvas "ISTANA NEGARA" di wajahnya, pedimen segitiga (ExtrudeGeometry) + medali emas, atap portico miring hijau.
  - Dua sayap (13,5×9,5) lebih rendah, beratap piramida hijau + cornice emas, masing-masing berpintu berbingkai emas + undakan; galeri penghubung: atap hijau membentang 56,5 di depan sayap & badan, ditopang 4 kolom ramping berkapitel emas.
  - Pelataran (57×21, puncak 0,34 — bisa diinjak seperti teras): karpet merah 2 segmen berlis emas dari gerbang ke tangga mengapit air mancur; air mancur bundar (kolam batu + alas berundak + bola emas); 2 tiang bendera 9,5 dengan bendera Merah Putih bergelombang dari geometri (canvas merah-putih); pagar besi (tiang InstancedMesh 34 instans + rel emas ganda) mengelilingi pelataran dengan gerbang tengah 8,4 sejajar tangga + tiang gerbang berbola emas.
  - Taman: hedge kotak rapi simetris (2 sisi + 2 depan), 2 semak bola pengapit tangga, 2 petak bunga (16 bunga warna-warni), 2 pot besar terakota mengapit pintu utama di podium, 6 lampu taman klasik.
  - Jendela: 22 jendela berbingkai emas (badan depan/samping/belakang, sayap, menara) — kaca memakai material bersama baru (warna gelap kebiruan 0x39566b, emissive hangat) yang didaftarkan ke MAT_JENDELA, jadi menyala malam mengikuti mekanisme fase waktu yang ada; kepala lampu taman memakai holder baru LAMPU_TAMAN yang digerakkan `kepalaLampu` di terapkanWaktu. Tanpa PointLight baru.
  - Semprotan air mancur (kerucut transparan) sempat dipasang, tetapi di render malam terbaca sebagai kerucut padat keabuan — **ditiadakan** sebelum rilis final; air mancur = kolam + tiang berundak saja.
- NPC Pak Presiden dipindah dari (3, 0.3, -24) ke **(4.6, 0.34, -16.6)** — berdiri di pelataran di kaki tangga, tidak tertanam bangunan; basis bob animasinya ikut 0,34.
- Jumlah mesh grup istana terukur dari scene live: **236 mesh** (238 sebelum 2 mesh semprotan dihapus) + 34 instans tiang pagar.
- Footprint & AABB (menggantikan 1 AABB lama {-6.6..6.6, -39.2..-29.2} menjadi 8): badan+portico {-15.6..15.6, -42.8..-23}; sayap barat {-28.2..-13.8, -42.8..-23}; sayap timur {13.8..28.2, -42.8..-23} (gabungan ketiganya menutup seluruh tapak podium x[-28.2,28.2] × z lokal[-8.8,11.0], tumpang-tindih di sambungan sayap-badan); air mancur {-4.1..4.1, -14.2..-5.8}; pagar selatan 2 segmen {-28.2..-4.2} & {4.2..28.2} di z{-3.7..-3.1} (gerbang terbuka); pagar barat {-28.2..-27.6, -29.4..-3.1}; pagar timur {27.6..28.2, -29.4..-3.1}. Tangga (z lokal 10.8..17.2) & pelataran di luar AABB — bisa dinaiki/diinjaki.
- Harness: baru `uji_istana.js` **383 lulus 0 gagal** (asers statis + AABB diekstrak dari source + tabrakanDi asli: tak tembus dari 4 sisi, pagar menahan kecuali gerbang, tangga/pelataran bebas, air mancur tertabrak, NPC presiden bebas, tapak podium tertutup penuh); regresi `uji_satublok.js` **3.371/0** dan `uji_skill3d.js` **192/0** (pin versi kedua harness diperbarui ke ?v=24).
- Deploy: backup `/opt/pinarak/bak-istana/` (app.js + index.html ?v=23); upload app.js + index.html, rebuild COPY-only + up -d. app.js final md5 **`542eb0c3a7e935ae327099e59ff84e7b`**, index.html `7e12fe36778c4ddf719435f0f8ff2410`; md5 tersaji == lokal; /api/statistik normal. Warga saat deploy **20** (bertambah 1 dari auto-register selama pengerjaan — bukan 19 lagi).
- Bukti render pinjam-scene Chrome X99 dari situs live (sudah dilihat sendiri): `~/workspace/wsdiag/bukti-istana/istana_depan_final.jpg` (depan rendah dari plaza: fasad simetris penuh, kubah emas, bendera, air mancur bersih), `istana_udara.jpg` (udara miring: tata pelataran berpagar + karpet + Blok 1880), `istana_malam.jpg` (mode malam: jendela istana menyala hangat — terukur emissiveIntensity kaca 2,20 sesuai preset malam — dan kepala lampu taman menyala). Foto `istana_depan.jpg` adalah versi sebelum semprotan dihapus; versi finalnya `istana_depan_final.jpg`.

## Bendera Negara Merdu (21 Nov 2026 malam, ?v=25)
- Perintah Fahmi: (1) "Bendera kenapa di tengah gitu" — tiang bendera jangan di tengah pelataran; (2) "Bikin bendera negara sendiri jangan merah putih"; (3) penegasan: cek/diagnosis dulu dari dekat, dan kain bendera baru harus di TENGAH tiang, bukan menggantung di puncak.
- DIAGNOSIS (diukur dari scene live ?v=24 + render dekat pinjam-scene `~/workspace/wsdiag/lihat_bendera_diag.py`, foto /root/bukti-bendera/diag_dekat.jpg di X99): tiang silinder h=9,5 di lokal (±13,5; 5,09; 25,5), rentang y 0,34..9,84, bola emas puncak y=10,05. Kain lama 2,7×1,75 berpusat di y=9,0 → rentang 8,13..9,88: tepi atas kain MELEWATI puncak tiang dan menempel ke bola puncak; pusat kain di ±91% tinggi tiang (menggantung di puncak). Kenapa terbaca "balok merah besar" di screenshot HP: (a) separuh atas kain merah pekat datar #e70011 dengan gelombang halus (amplitudo 0,22 di lebar 2,7) → terbaca lempeng padat; (b) kain berpusat tepat di tiang sehingga tiang membelah kain seperti spanduk di puncak; (c) tiang berdiri di tengah pelataran (±13,5; 25,5), persis di jalur dekat kamera drone/1st-person, sehingga kain memenuhi bingkai; (d) setinggi pedimen, menyatu visual dengan fasad.
- BENDERA BARU (desain tetap): bidang hijau tua 0x2e5d43 penuh, matahari emas 0xd9a441 di tengah (cakram r=24 + 8 sinar segitiga, canvas 192×128), lis emas tipis di tepi, rasio 3:2. Digambar sebagai tekstur canvas oleh fungsi bersama baru `teksturBenderaMerdu()` (di-cache), menggantikan total tekstur merah-putih.
- PENEMPATAN BARU: kedua tiang dipindah ke lokal (±5,8; 29,2) — MENGAPIT GERBANG UTAMA pelataran (lubang gerbang |x|<4,2, tiang gerbang di ±4,5), di dalam pagar (garis pagar z=30,6), simetris terhadap karpet merah. Kain 2,55×1,7 (sedikit lebih kecil dari 2,7×1,75 lama, rasio pas 3:2), gelombang dipertahankan, dan pusat kain di y=5,09 = PERSIS TENGAH tiang (tengah rentang 0,34..9,84) sesuai penegasan Fahmi. Tiang tetap tidak ditabrak (seperti tiang lampu); posisi baru tidak menghalangi jalur gerbang (tiang di |x|=5,8, di luar lubang 4,2), tidak menimpa karpet (lebar 5, tepi ±2,5), hedge depan (mulai |x|=6,5), maupun lampu taman (±6,2; 27,5). NPC presiden, air mancur, karpet, pagar tidak diubah. Terukur dari scene live ?v=25: TIANG (±5,80; 5,09; 29,20) rentang 0,34..9,84; KAIN 2,55×1,7 berpusat y=5,09.
- Bendera lain di dunia ikut diganti: model fasilitas SEKOLAH punya bendera merah-putih dari 2 kotak (0xd9462e + 0xffffff) → diganti kain plane 2,6×1,73 bertekstur `teksturBenderaMerdu()` yang sama. Grep akhir: tidak ada sisa "#e70011" maupun kotak merah-putih di app.js.
- Harness: `uji_istana.js` 394 lulus 0 gagal (383 lama + 11 cek baru: fungsi tekstur Merdu, bidang hijau, tidak ada #e70011/kotak sekolah lama, tiang di ±5,8 z=29,2, posisi lama hilang, pusat kain 5,09, kain 2,55×1,7; pin versi → ?v=25); regresi `uji_satublok.js` 3.371/0 dan `uji_skill3d.js` 192/0 (pin versi diperbarui ke ?v=25).
- Deploy: backup `/opt/pinarak/bak-bendera/` (app.js + index.html ?v=24); upload app.js + index.html, rebuild COPY-only + up -d. app.js md5 `233b4b9f0aa0947aa5518820efc69d82`, index.html `1dbe0fda396c9097e35dee820b422d50`; md5 tersaji == lokal; /api/statistik normal, warga 20.
- Bukti render pinjam-scene Chrome X99 dari situs live (sudah dilihat sendiri): `~/workspace/wsdiag/bukti-istana/bendera_depan.jpg` (depan istana dari luar gerbang: dua bendera hijau matahari emas simetris mengapit gerbang, jalur karpet bebas), `bendera_dekat.jpg` (tiang timur utuh alas→bola puncak, kain di tengah tiang, emblem matahari emas terbaca jelas).

## Bendera Dikerek ke Puncak Tiang (21 Nov 2026 malam, ?v=26)
- Perintah Fahmi (koreksi atas ?v=25): "Harusnya di paling atas tiang, dan paling ujung bendera" — kain di tengah tiang terlihat seperti bendera setengah tiang, SALAH. Yang tidak berubah: desain bendera Merdu, tiang mengapit gerbang (±5,8; 29,2), kain 2,55x1,7, gelombang.
- Perubahan SATU angka di app.js: pusat kain y 5,09 -> 8,88 (komentar blok diperbarui). Hitungan puncak: rentang tiang 0,34..9,84; bola emas pusat 10,05 r 0,22 -> bawah bola 9,83. Tepi atas kain sekarang 9,73: celah 0,10 di bawah bola dan 0,11 di bawah ujung tiang — dikerek penuh tanpa mengulangi kesalahan ?v=24 (tepi 9,88 melewati puncak dan menempel bola).
- Bendera sekolah dicek: tiang rentang 0,14..9,14, kain pusat 8,27 -> tepi atas 9,135, sudah di ujung atas tiang — tidak diubah.
- Harness: uji_istana 397 lulus 0 gagal (394 lama + 3 cek baru: string posisi 8,88 ada, posisi tengah 5,09 hilang, geometri tepi atas di bawah bola & celah 0,05..0,15 ke puncak); regresi uji_satublok 3.371/0 dan uji_skill3d 192/0 (pin versi -> ?v=26).
- Deploy: backup /opt/pinarak/bak-bendera2/ (app.js + index.html keadaan ?v=25: 233b4b9f... / 1dbe0fda...); upload app.js + index.html, rebuild COPY-only + up -d. app.js md5 87b638ff81de511ad3fccc2cfd7af13c, index.html 5c3d83fb211e03442af98eab6d638986; md5 tersaji == lokal; /api/statistik normal (warga 20 saat deploy, 21 tak lama sesudahnya dari auto-register).
- Verifikasi scene live (rig pinjam-scene Chrome X99, lihat_bendera2.py): terukur KEDUA tiang (±5,80; 29,20) rentang 0,34..9,84, bola bawah 9,83, kain 2,55x1,7 pusat y=8,88 tepi atas 9,73 — persis target. Bukti render sudah dilihat sendiri: ~/workspace/wsdiag/bukti-istana/bendera_atas.jpg (tiang timur utuh alas->bola puncak, kain hijau matahari emas berkibar di ujung atas tiang tepat di bawah bola; tiang barat sama).

## Redesign Layar Loading (21 Nov 2026 malam, ?v=27; koreksi status ?v=28-?v=29)
- Titipan Fahmi lewat chat Hallmark: redesign layar loading #muat, dikerjakan SESUDAH deploy bendera ?v=26 selesai (satu-satunya editor file saat itu). Kontrak TIDAK diubah: app.js tetap menyembunyikan #muat via style.display="none" lalu hud.hidden=false; app.js tidak disentuh di tahap ini (md5 tetap 87b638ff... sejak ?v=26).
- Basis sinkronisasi (dicek ulang di awal run): live == lokal == Hostinger — index.html 1dbe0fda396c9097e35dee820b422d50, style.css 5c407356f9f6501160ee18c900bca752, app.js 233b4b9f0aa0947aa5518820efc69d82 (keadaan ?v=25). Perbedaan md5 app.js live yang teramati 20:17 adalah keadaan sesaat di tengah deploy bendera; saat tahap ini mulai ketiganya sudah identik.
- Yang dibangun (index.html + style.css saja):
  - Adegan SVG gambar sendiri (tanpa emoji, tanpa gambar eksternal, tanpa font baru): matahari golden hour berhalo, 2 awan melayang, siluet Istana Negara di tengah (badan + sayap + atap bertingkat hijau tua + kubah + bendera Merdu mini di puncak, sejalan gedung ?v=24), rumah warga low-poly kiri (atap terakota) & kanan (atap hijau), 2 pohon, bukit dua lapis, jalan beraspal dengan garis tengah bergerak (grup dash ter-clip ke trapesium jalan, animasi transform translateY).
  - Lambang rumah emas di atas judul: path SVG PERSIS lambang KTP/KK dari app.js (viewBox 64: M32 4 L60 28 ... Z) dengan gradasi #f6cd6b -> #dd9a26 + garis #b97e14.
  - Teks status berganti bertahap tiap 1,5 dtk: "Menghubungi Istana Negara..." -> "Memuat warga & rumah..." -> "Membangun kota..." -> "Menyiapkan kamera..."; bar progres sekarang BERTAHAP via transform scaleX 0,18 -> 0,45 -> 0,72 -> 0,90 (berhenti di 90% sampai #muat hilang). Mekanisme: skrip inline kecil di index.html tepat sesudah #muat (bukan mengait internal app.js); interval memeriksa style.display tiap tick dan berhenti sendiri begitu app.js menyembunyikan #muat.
  - Animasi HANYA transform/opacity (awan translateX, garis jalan translateY, halo opacity, bar scaleX + transisi transform). Fallback prefers-reduced-motion: semua animasi mati + transisi bar mati. Palet tetap project: gradasi langit #6fb1e6 -> #ffe3ae, teks #21332a, hijau #2e9e5b, emas #f6cd6b/#dd9a26.
- Koreksi sesudah render pertama (?v=28 lalu ?v=29): screenshot verifikasi awal menunjukkan teks status kosong/pucat. Sebab: pergantian status memakai fade opacity (opacity 0 selama 170 md) — thread utama sedang sibuk membangun kota sehingga timer pemulih fade tertahan dan status tertangkap kamera dalam keadaan tak terlihat. Fade DIBUANG TOTAL di ?v=29: teks diganti seketika, bar tetap bertransisi transform. (Di ?v=28 sempat dicoba "langkah pertama tanpa fade" — tidak cukup, makanya fade dihapus seluruhnya.)
- Deploy & backup: /opt/pinarak/bak-loading/ berisi index.html + style.css keadaan ?v=26 (5c3d83fb... / 5c407356...) plus index-v27.html, index-v28.html, style-v28.css untuk tiap koreksi. Final LIVE ?v=29: index.html md5 3779da50a7bcc5c56e8122bab4cfae7e, style.css 64135bb020353aad553dde77c83ba97f; md5 tersaji == lokal; /api/statistik normal, warga 21.
- Harness: uji_istana 397/0, uji_satublok 3.371/0, uji_skill3d 192/0 (pin versi -> ?v=29); skrip inline lolos cek sintaks (new Function) dan tidak lagi memakai style.opacity sama sekali.
- Verifikasi jalur publik, browser asli (Chrome headless X99 via CDP, tab baru ke https://merdu.id/, viewport HP 420x860 @2x, rig lihat_loading.py): rotasi status TERAMATI hidup lintas run — langkah 1 "Menghubungi Istana Negara...", langkah 2 "Memuat warga & rumah..." dengan bar scaleX(0.45), langkah 3 "Membangun kota..." dengan bar scaleX(0.72); keadaan akhir #muat display none, HUD tampil (chip 21 warga, 21/100.000), gerbang tamu "Selamat datang di Negara Merdu" tampil normal; error konsol 0. Screenshot sudah dilihat sendiri: ~/workspace/wsdiag/bukti-loading/loading_awal.jpg (adegan + lambang + judul + status "Memuat warga & rumah..." terbaca jelas + bar +-45%, tidak ada elemen bertabrakan) dan sesudah_muat.jpg (HUD + gerbang + kota 3D normal).
- Catatan jujur: di rig headless X99 muat selesai dalam 23-49 dtk (bangun kota di SwiftShader memang lambat) sehingga tidak semua 4 status tertangkap dalam satu run; di HP asli urutan berjalan 1,5 dtk/langkah dan bar berhenti di 90% sampai kota siap.

## Bendera Menempel di Tepi Tiang (21 Nov 2026 malam, ?v=30)

- Keluhan Fahmi (dengan foto live): "Sekarang masih salah, coba cek posisi bendera yang benar gimana — itu di tengah kain bendera". Diagnosis terkonfirmasi di kode & scene: kain 2,55x1,7 dipasang BERPUSAT pada tiang (`position.set(fx + sisi * 0.05, ...)` + rotasi cermin untuk tiang barat) — tiang membelah kain tepat di tengahnya, kain menjulur ke kedua sisi seperti spanduk. Itu maksud asli koreksi "bendera di tengah tiang" sejak awal.
- Perbaikan (app.js saja untuk bagian ini; desain tekstur, posisi tiang mengapit gerbang, ukuran kain, posisi vertikal ?v=26 TIDAK berubah):
  - Pusat kain digeser ke `fx + 1.385` untuk KEDUA tiang, tanpa rotasi cermin: 1,385 = 1,275 (setengah lebar kain) + 0,11 (permukaan tiang; jari-jari tiang menyempit 0,15->0,09 sepanjang rentang 0,34..9,84, pada rentang kain y 8,03..9,73 maks 0,101) — tepi hoist menempel 0,009..0,019 dari permukaan tiang: tidak menembus, tidak bercelah terlihat.
  - Seluruh kain berkibar ke SATU sisi yang sama untuk kedua tiang: +x (timur), satu arah angin, bukan cermin berlawanan. Dari kamera depan (selatan) kain menjulur ke samping, tidak menutupi fasad/papan nama, dan tekstur terbaca benar (tidak mirror) dari depan untuk kedua bendera.
  - Gelombang terpanggang di geometri dipertahankan: amplitudo 0 di tepi hoist (faktor bx2/2,55, bx2=0 di hoist) membesar ke ujung bebas — tepi hoist tetap menempel di tiang.
  - Bendera SEKOLAH dicek: kain 2,6 berpusat x=9,42 -> rentang [8,12, 10,72]; tiang x=8 r=0,09 -> permukaan 8,09. Sudah SATU sisi di tepi tiang sejak ?v=25 — TIDAK diubah, cukup dijaga cek harness baru.
- Harness: uji_istana **407 lulus 0 gagal** (397 lama + 10 cek baru: string posisi tepi ada, posisi berpusat + rotasi cermin hilang, rentang kain kedua tiang tidak mencakup tiang kecuali sisi hoist, faktor gelombang hoist utuh, kain sekolah tetap tepi); regresi uji_satublok 3.371/0, uji_skill3d 192/0 (pin versi -> ?v=30).
- Deploy: backup `/opt/pinarak/bak-bendera3/` (app.js + index.html + style.css keadaan ?v=29: 87b638ff... / 3779da50... / 64135bb0...); upload ketiga file (bagian loading di bawah ikut berubah), rebuild COPY-only + up -d app. md5 final: app.js `88a1cf604451095c263841b65be42fc0`, index.html `961cf2e4d1e9a81bc80b6281682eabf3`, style.css `966ae9349afdc96463af8bf028d9646c`; md5 tersaji == lokal; /api/statistik normal (21 warga).
- Verifikasi scene live (rig pinjam-scene `lihat_bendera3.py`, bounding box geometri x matrixWorld): tiang barat x=-5,80 -> kain dunia x **-5,69..-3,14**; tiang timur x=5,80 -> kain **5,91..8,46**; keduanya tepi hoist tepat +0,11 dari sumbu tiang dan berkibar searah +x; vertikal tetap y 8,03..9,73. Bukti render sudah dilihat sendiri: `~/workspace/wsdiag/bukti-istana/bendera_tepi.jpg` (dekat tiang timur utuh alas->bola: kain menempel di tepi tiang, berkibar ke satu sisi, matahari emas terbaca tidak mirror) dan `bendera_tepi_depan.jpg` (depan istana: kedua bendera searah, papan nama bebas).

### Sub-bagian: Bar Progres Loading Murni CSS (?v=30, deploy yang sama)

- Laporan Fahmi: "Progress ga jalan" — bar layar loading TIDAK bergerak di HP-nya. Sebab (terkonfirmasi dari kode live ?v=29): bar digerakkan `setInterval` 1500ms di skrip inline index.html (scaleX 0,18->0,45->0,72->0,90), dan thread utama tersumbat lama saat parse three.min.js + app.js + bangunKotaMassal() sinkron, jadi callback interval tertahan — di HP bar diam di 18% lalu #muat keburu hilang. Verifikasi ?v=29 lolos hanya karena Chrome X99 cepat.
- Fix (style.css + skrip inline index.html; kontrak sembunyi #muat oleh app.js TIDAK berubah):
  - Bar digerakkan MURNI animasi CSS (compositor, kebal sumbatan thread utama): `@keyframes muatBar` scaleX(0,03) -> scaleX(0,90), durasi 11 dtk ease-out, forwards, di `#muat .bar i`; properti transition lama dibuang.
  - Skrip inline TIDAK lagi menyetel transform bar (`barEl.style.transform` + array persen dihapus dari `tampil()`); rotasi TEKS status tetap JS seperti ?v=29.
  - `prefers-reduced-motion`: animasi mati, bar tampil statis scaleX(0,90).
- Verifikasi (Chrome asli lewat jalur publik https://merdu.id; instance khusus port 9224 di X99 karena instance bersama 9223 penuh kontenasi 8 tab):
  - CPU throttling 5x + perekam in-page (addScriptToEvaluateOnNewDocument): muat tuntas (#muat none, HUD + gerbang normal), error konsol 0; perekam menangkap sx naik 0,03 -> 0,237 di jeda-jeda awal sebelum thread tersumbat padat (interval memang kelaparan selama bangun kota — itu justru kondisi yang diperbaiki).
  - Bukti penentu (rig `lihat_loading_throttle7.py`): request app.js DITAHAN via Fetch (aplikasi tidak jalan sama sekali, skrip inline tidak menyetel bar) + throttle 5x, screenshot beruntun mengukur isian dari piksel: t=8,3s **0,221** -> 9,7s **0,383** -> 11,1s **0,526** -> 12,6s **0,652** -> 14,0s **0,762** -> 15,5s **0,843** -> 16,9s **0,890** — bar bergerak monoton murni oleh CSS selagi "muat" belum selesai. Frame isian 0,526 disimpan & sudah dilihat sendiri: `~/workspace/wsdiag/bukti-loading/bar_throttle.jpg` (layar muat utuh, status "Menyiapkan kamera...", bar terisi ±53%).
  - Tanpa throttle (rig lihat_loading.py): rotasi status teramati, #muat hilang, HUD + gerbang tamu normal, error konsol 0; screenshot `loading_awal.jpg` + `sesudah_muat.jpg` di folder yang sama.
  - Catatan jujur: di headless, frame compositor digerakkan oleh permintaan screenshot (di HP nyata oleh vsync) — mekanisme yang dibuktikan adalah bar maju tanpa JS apa pun selama thread utama tersumbat; angka seri di atas diukur dari piksel frame live, bukan dari klaim kode.

## Perbaikan Atap Istana (21 Nov 2026 malam, ?v=31)
- Perintah Fahmi (dengan screenshot HP mode Orbit dari atas): "Atap istana negara kok gini" — atap ?v=24 dari atas terbaca gumulan piramida bertumpuk tak rapi: piramida rok tingkat tengah + piramida utama + piramida kedua sayap saling tumpang tindih visual, kotak menara menembus piramida utama, dan kubah duduk seperti bola/duri kecil di ujungnya. Dikerjakan SESUDAH ?v=30 live (basis disinkronkan dulu: live == lokal, app.js 88a1cf60…).
- Komposisi baru (klien saja, app.js; dinding/portico/tangga/sayap/pelataran/pagar/air mancur/bendera ?v=30/NPC/tabrakkan TIDAK berubah):
  - Piramida rok (Cone 19.5×2.4, alas y 6.4–8.8) DIHAPUS total — tingkat bawah jadi teras datar bersih: cornice krem + pita emas yang sudah ada menjadi garis atapnya.
  - SATU atap utama bersih: piramida Cone(18.81, 3.9, 4) rotY π/4 skala (1, 1, 0.4737) — alas 26,6×12,6 tepat di atas cornice atas (y 11.05, overhang 0,6 merata dari cornice 25,4×11,4), puncak 14.95 di sumbu (0, −0,5).
  - Menara diganti DRUM silinder: silinder krem r 2,4 tinggi 3,4 (y 13,9–17,3, dasar tertanam di lereng atap pada sumbu — menara tumbuh dari atap), lis emas r 2,58, cincin alas kubah krem r 3,15; kubah setengah bola r 3,1 skalaY 1,22 (puncak 21,33) di atas drum; tiang puncak + bola emas r 0,45 di y 23,03 → titik tertinggi 23,48 (praktis sama dengan 23,5 lama). Urutan dari atas kini terbaca: atap utama → drum → kubah → bola emas, semuanya sesumbu.
  - Atap sayap: keluarga piramida yang sama dengan utama (Cone 4 sisi rotY π/4), diganti Cone(11.24, 2.6, 4) skala (1, 1, 0.7484) — alas 15,9×11,9 (overhang 1,2 merata dari badan sayap 13,5×9,5), alas y 6,48, puncak 9,08 (sama seperti lama), sejajar sumbu bangunan.
  - Jaminan tak tumpang tindih: rentang y sayap 6,48–9,08 < alas atap utama 11,05; kedua sayap terpisah sumbu x; tidak ada sisa piramida lama (grep bersih: rokAtap/Cone lama/kotak menara lama hilang). Jendela menara dipindah ke muka drum (0, 15.9, 1.92).
- Harness: `uji_istana.js` **422 lulus 0 gagal** (397 lama + 25 cek baru ?v=31: piramida lama hilang, tepat 1 atap utama + 1 definisi atap sayap + tepat 1 kubah, drum ada, skala alas benar, rentang y atap tak tumpang tindih, tinggi total 23,48); regresi `uji_satublok.js` **3.371/0** dan `uji_skill3d.js` **192/0** (pin versi ketiga harness → ?v=31).
- Deploy: backup `/opt/pinarak/bak-atap/` (app.js + index.html ?v=30); upload app.js + index.html, rebuild COPY-only + up -d app. app.js md5 `3cab17038c8a002d7740dbd5a91f41c7`, index.html `ec6d8f4ef24d81950366078d40dbd886`; md5 tersaji == lokal; /api/statistik normal (21 warga).
- Verifikasi scene live (rig pinjam-scene Chrome X99 `lihat_atap.py`, terukur dari scene): tepat 1 KERUCUT utama (r 18,81 h 3,9 di y 13,0 skala z 0,474), 2 KERUCUT sayap (r 11,24 h 2,6 di (±20,8; 7,78) skala 0,748), drum silinder r 2,4 h 3,4 di y 15,6 + lis 2,58 + cincin 3,15, kubah r 3,1 skalaY 1,22 di y 17,55, bola emas di 23,03 — tidak ada kerucut rok.
- Bukti render pinjam-scene dari situs live (sudah dilihat sendiri): `~/workspace/wsdiag/bukti-istana/atap_atas.jpg` (orbit curam dari atas, sudut yang sama dengan screenshot Fahmi: komposisi terbaca bersih & simetris — 1 piramida utama, drum+kubah konsentris di puncak, 2 piramida sayap sejajar, teras datar rapi), `atap_miring.jpg` (udara miring: drum terbaca jelas sebagai leher kubah), `atap_depan.jpg` (depan dari plaza: fasad gagah utuh, kubah di atas drum, bendera Merdu di puncak tiang mengapit gerbang).

## Atap Istana Persegi Sejajar (21 Nov 2026 malam, ?v=32)
- Keluhan Fahmi atas render atap_atas ?v=31: "Kenapa bukan kotak malah jajar genjang" — dari atas, atap utama & sayap terbaca BELAH KETUPAT miring, bukan persegi panjang sejajar dinding.
- Sebab (terverifikasi numerik dengan three.min.js project sendiri): piramida ?v=31 dibangun ConeGeometry(R, h, 4) dengan rotasi π/4 di MESH + skala tak seragam. Transform mesh three.js adalah T·R·S — skala diterapkan di ruang lokal SEBELUM rotasi — jadi persegi hasil skala ikut berputar 45° dan sudut alas dunia jatuh di (6.30,6.30), (13.30,−13.30), (−6.30,−6.30), (−13.30,13.30): belah ketupat murni. Sudut alas kerucut-4 mentah memang menunjuk sepanjang sumbu (0,±R),(±R,0).
- Fix (klien saja, app.js; pola yang sama seperti geoLimas rumah massal yang sudah benar sejak lama): rotasi π/4 dipindah ke GEOMETRI — `geoAtapUtama.rotateY(Math.PI / 4)` dan `geoAtapSayap.rotateY(Math.PI / 4)`; mesh TANPA rotasi, skala tidak berubah (utama (1,1,0.4737), sayap (1.0,1,0.7484)). Sudut alas kini di diagonal (±R/√2, ±R/√2) lalu diskala sejajar sumbu dunia → persegi panjang sejati: utama sudut (±13.30, ±6.30) = 26,6×12,6 (overhang 0,6 merata dari cornice 25,4×11,4); sayap (±7.95, ±5.95) = 15,9×11,9. Tinggi/puncak, warna hijau 0x2e5d43, drum & kubah (bulat) tidak disentuh. Atap galeri (kotak datar) & atap portico (kotak miring) memang sudah sejajar — tidak berubah. Catatan di luar ruang lingkup: pola mesh-rotasi yang sama ada di atap pendopo balai_warga (fasilitas terpisah, bukan kompleks istana) — tidak diubah karena bukan keluhan Fahmi.
- Harness: `uji_istana.js` **432 lulus 0 gagal** (422 lama + 10 cek baru ?v=32: rotasi ada di geometri, rotasi mesh hilang, sudut alas hasil konstruksi menunjuk diagonal, sisi alas sejajar sumbu, footprint persis 26,6×12,6 & 15,9×11,9); regresi `uji_satublok.js` **3.371/0**, `uji_skill3d.js` **192/0** (pin versi ketiga harness → ?v=32).
- Deploy: backup `/opt/pinarak/bak-atap2/` (app.js + index.html keadaan ?v=31, md5 app.js 3cab1703…); upload app.js + index.html, rebuild COPY-only (Dockerfile.runtime) + up -d app. app.js md5 `b5034693ec2e4fc42466cd5e06f6239d`; md5 tersaji == lokal; /api/statistik normal (21 warga).
- Bukti render pinjam-scene dari situs live (rig `lihat_atap2.py`, sudah dilihat sendiri): `~/workspace/wsdiag/bukti-istana/atap2_atas.jpg` (TEPAT dari atas, kamera tegak lurus: outline atap utama & kedua sayap persegi panjang sejajar bangunan dan pelataran, kubah lingkaran konsentris di tengah atap utama — tidak ada berlian), `atap2_miring.jpg` (orbit curam sudut screenshot Fahmi: piramida utama & sayap terbaca limas persegi sejajar sumbu, drum+kubah sesumbu), `atap2_depan.jpg` (depan dari plaza: fasad utuh, kubah di atas drum, bendera Merdu di puncak tiang mengapit gerbang).

## Perbaikan Nyangkut Loading (22 Nov 2026 pagi, ?v=33)
- Laporan Fahmi 08:13: merdu.id NYANGKUT di layar loading di HP-nya. Server sehat (200, /api/statistik normal) — masalahnya di klien: #muat tidak pernah disembunyikan.
- Reproduksi (Chrome asli X99 via CDP, jalur publik, tab baru, viewport HP): #muat TIDAK hilang >200 dtk; `Runtime.exceptionThrown` membanjir (369 dalam 15 dtk) dengan error yang sama persis:
  `TypeError: Cannot read properties of null (reading 'isInterleavedBufferAttribute')` — stack: `WebGLAttributes.get` (three.min.js:6:121808) <- `WebGLBindingStates.setup` <- `renderBufferDirect` <- `render` <- `animasi` (app.js). Sampling Debugger.pause menangkap loop rAF `animasi` tetap jalan tetapi render melempar SETIAP frame; panggilan `animasi()` pertama di dalam `mulai()` melempar -> promise `mulai()` gugur sebelum baris `$("#muat").style.display = "none"` -> loading terkunci selamanya, sementara rAF terus menjadwal ulang dirinya dan terus melempar.
- Isolasi objek (renderer baru di halaman yang sama, biseksi visibilitas 52 anak scene): hanya anak scene [48] (grup kota massal) yang melempar; di dalamnya tepat satu objek: **imLimas** — InstancedMesh ConeGeometry, **count 0, instanceColor null**.
- Akar masalah (rantai lengkap, semua terverifikasi dari data live + kode):
  1. `imPelana` & `imLimas` BERBAGI satu material `matAtap` (app.js baris ±902–904). Program shader material bersama memuat atribut `instanceColor` begitu salah satu mesh memilikinya.
  2. `instanceColor` sebuah InstancedMesh hanya tercipta bila `setColorAt` pernah dipanggil — yaitu bila daftar rumahnya TIDAK kosong. Daftar kosong -> `instanceColor` tetap null -> di `WebGLBindingStates.setup` three r128, cabang `"instanceColor" === name` memanggil `attributes.get(object.instanceColor)` TANPA penjaga null -> `get(null)` membaca `.isInterleavedBufferAttribute` dari null -> TypeError. (Mesh berdaftar kosong bermaterial eksklusif — imDatar, imCerobong — terbukti TIDAK melempar: program mereka tak memuat instanceColor.)
  3. Pemicu waktunya: rumah massal = kavling terisi DI LUAR 30 warga terbaru (rumah detail). Selama warga <= 30, daftar massal kosong total — ketiga daftar atap kosong, tak ada instanceColor di matAtap, aman. Warga ke-31 (@ratudhfta, Blok 1881) membuat daftar massal tepat 1 rumah (milik warga #1) dan hash atapnya jatuh ke PELANA: imPelana berisi + punya instanceColor, imLimas kosong + null -> campuran maut itu muncul pertama kali. Warga ke-32 terdaftar saat perbaikan berjalan — tanpa fix, situs akan tetap mati untuk semua pengunjung.
- Fix (klien saja, app.js; kontrak lama utuh — `mulai()` tetap yang menyembunyikan #muat, bar CSS murni ?v=30 tidak disentuh):
  1. Di `bangunKotaMassal()`: sesudah `grup.add(imPelana/imLimas/imDatar)`, mesh atap berdaftar kosong disembunyikan — `if (!daftarPelana.length) imPelana.visible = false;` dan sama untuk imLimas/imDatar. Mesh count 0 memang tak menggambar apa pun; tampilan tak berubah.
  2. Jaring pengaman di `mulai()`: langkah bangun kota (bangunKotaMassal -> sambungWS) dibungkus try/catch (`console.error("Gagal membangun kota:", e)`) — pengecualian bangun APA PUN kini tak bisa lagi mengunci layar loading; #muat tetap disembunyikan dan HUD/gerbang tetap tampil.
- Harness: uji_istana 432/0, uji_satublok **3.375/0** (3.371 lama + 4 cek baru ?v=33: ketiga penjaga visible + jaring pengaman mulai), uji_skill3d 192/0; pin versi ketiga harness -> ?v=33; `node --check` app.js lolos.
- Deploy: backup `/opt/pinarak/bak-loading2/` (app.js + index.html keadaan ?v=32); upload app.js + index.html, rebuild COPY-only (Dockerfile.runtime) + up -d app. app.js md5 `338cba7aa9f6d96992823deb3b086319`, index.html `722c3dd690cbd3984ca9da65cf1a51ac`; md5 tersaji == lokal; /api/statistik normal (32 warga saat verifikasi).
- Verifikasi sesudah deploy (Chrome X99 jalur publik, tab BARU, cache browser dibersihkan dulu via CDP, viewport HP 420x860 @2x, **CPU throttle 6x**): **#muat hilang pada 22,5 dtk**, HUD tampil, gerbang tamu tampil, **exception JS 0** (banjir TypeError hilang total). Dua log tersisa bukan error aplikasi: notis deprecation SwiftShader (artefak headless) + satu "WebSocket closed before established" saat tab verifikasi ditutup. Kontras: basis ?v=32 pada rig yang sama tak pernah selesai >200 dtk. Screenshot sesudah muat sudah dilihat sendiri: `~/workspace/wsdiag/bukti-loading/muat_fix.jpg` (HUD + chip 32 warga + gerbang "Selamat datang di Negara Merdu" + kota ter-render di belakangnya).
- Catatan jebakan verifikasi: instance Chrome 9223 menyimpan index.html lama di cache HTTP-nya — dua tab pertama sesudah deploy memuat app.js?v=32 dari cache dan tetap melempar; itu sebabnya rig verifikasi sekarang membersihkan cache dulu (diag_muat.py + Network.clearBrowserCache). Di HP Fahmi berlaku hal yang sama: bila masih nyangkut sekali lagi, muat ulang penuh (tutup tab / refresh paksa) mengambil index ?v=33; sesudah itu pin versi menjaga seterusnya.
- Skrip diagnosa baru di ~/workspace/wsdiag/: diag_muat.py (polling #muat + tangkap exception, kini dengan clearBrowserCache), diag_exc.py, diag_sample.py, diag_pause2.py, diag_isolasi.py, diag_im.py, diag_tabs.py, hst_kirim.py (kirim file ke Hostinger via stdin dd — menghindari redirect fish).

## Toko Pancing — Pemenang Voting (22 Nov 2026, ?v=34) + Taman Terbangun & Potongan Kas
- Perintah Fahmi 10:39 "Buatkan toko pancingan" (pemenang voting usulan warga Episode 2–3; usul @drennvanzz_, warga #5, yang jadi owner) + tahap tambahan di rangkaian yang sama: bangun Taman + potong Kas Negara.
- Server (Go, `internal/pembangunan`): `FasilitasDef` bertambah `Voting bool` + `Owner string`; 8 literal baku diubah ke bentuk keyed (nilai tak berubah); `FasilitasVoting` baru = toko_pancing (awalnya Blok 2917 (36,36), Biaya 0, Voting, Owner "@drennvanzz_"); `SemuaFasilitas()` = baku + voting; `Item` API bertambah `voting`/`owner`; `Seed` memasukkan bangunan voting langsung berstatus 'terbangun' bertanggal hari berjalan (ON CONFLICT DO NOTHING saat itu). Test baru `TestFasilitasVotingTokoPancing`; gofmt/vet/test lulus di X99; binary dibangun di X99 (md5 `5a2fbb47fd3f330b6fc1dc324d545a58`), Hostinger hanya COPY.
- Klien (?v=34): `FASILITAS_BLOK`/`FASILITAS_NAMA` + toko_pancing; `teksturPapanTokoPancing()` (ikon ikan digambar tangan di canvas + teks); `MODEL_FASILITAS.toko_pancing` menghadap utara: alas pasir, gedung krem atap pelana teal, papan nama berikon ikan, pintu + 2 jendela etalase, rak 6 joran + reel, 2 joran sandar, 3 ember umpan warna, kotak es, papan "HARGA UMPAN / Rp5.000 / cup", papan "Owner: @drennvanzz_", payung + 3 kursi pancing berjoran; `TAPAK_FASILITAS.toko_pancing` AABB gedung; papan RENCANA 9 baris (tata letak dikompres agar muat); panel Pembangunan menampilkan baris voting sebagai "Bangunan dari voting warga · Pemenang voting warga Episode 2–3 · Owner @drennvanzz_". Harness: uji_satublok 3.393/0, uji_istana 432/0, uji_skill3d 192/0.
- Deploy: backup `/opt/pinarak/bak-pancing/` (binary + public ?v=33); md5 tersaji == lokal; /api/pembangunan: total 9, terbangun 1 (toko_pancing "terbangun", voting:true, owner "@drennvanzz_", dibangun_pada 2026-11-22); 8 baku tetap "belum"; /api/statistik normal (33 warga).
- Taman dibangun lewat jalur admin resmi dari sisi Hostinger (POST /api/admin/pembangunan/bangun {"kunci":"taman"}, token dibaca di server, tidak pernah keluar): HTTP 201, dibangun_pada 2026-11-22 03:54:28 UTC. API: terbangun 2/9. (Jebakan terverifikasi: perintah majemuk ber-pipe lewat hst.py terbelah di hop fish Oracle — segmen sesudah pipa pertama jalan di Oracle, bukan Hostinger; skrip multi-langkah wajib dikirim sebagai FILE lalu dijalankan sebagai satu perintah sederhana.)
- Kas Negara (`kas-desa/kas.json`, dibaca ulang persis sebelum eksekusi): saldo berjalan Rp5.670.000 (Rp620.000 hasil rekap Episode 3 + kredit share/repost Rp5.000.000 dari tangkapan layar IG Fahmi 10:42 + rekap like manual Rp50.000 10:43) dipotong Rp5.000.000 → **saldo Rp670.000**; entri riwayat {kas_masuk: -5000000, keterangan: "Pembangunan Taman (Blok 1637) — keputusan Fahmi 2026-11-22", like_baru: 0, share_baru: 0, saldo_sesudah: 670000, waktu: 2026-11-22T10:55:21+07:00}. Counter like/share per postingan TIDAK disentuh. Toko pancing TIDAK memotong kas (bangunan voting).
- Bukti render ?v=34 (rig `lihat_pancing.py`): `~/workspace/wsdiag/bukti-pancing/toko_depan.jpg`, `toko_konteks.jpg`, `taman_konteks.jpg` — dari foto depan inilah 3 cacat ?v=35 terlihat (lihat bagian berikut).

## Perbaikan Laporan Fahmi: Papan "undefined", Pindah Dekat Keramaian, Kanopi (22 Nov 2026, ?v=35)
- Tiga laporan Fahmi dari screenshot HP (toko sudah live): (1) papan di depan toko terbaca "@undefined / Rumah No. undefined · Blok undefined · Kavling undefined"; (2) toko terlalu jauh dari keramaian; (3) kanopi terlalu pendek memotong papan. Ditambah perintah lanjutan: Taman juga dipindah dekat keramaian (blok berbeda dari toko).
- Akar masalah papan: DUA deklarasi fungsi bernama sama `teksturPapanNama` di scope yang sama — painter fasilitas `(besar, kecil)` dan painter papan alamat rumah `(w)`; deklarasi terakhir (rumah) menimpa yang pertama untuk SEMUA panggilan, jadi setiap papan fasilitas (papan harga toko, papan owner, papan "LAHAN PEMBANGUNAN" umum & fasilitas) digambar painter rumah dengan argumen string → semua field warga undefined. Fix: painter rumah diganti nama `teksturPapanNamaRumah` (+ situs panggilnya); painter fasilitas kembali satu-satunya. Papan nama utama toko tidak kena (painter sendiri `teksturPapanTokoPancing`).
- Pemindahan blok: blok lahan pola berkala terdekat ke cluster pun berjarak ±4 blok, jadi dipilih dua blok perumahan kosong yang MENEMPEL langsung ke blok terisi: **Toko Pancing → Blok 1882 (kol 41, bar 23), tepat di timur Blok 1881**; **Taman → Blok 1879 (kol 38, bar 23), tepat di barat Blok 1880**. Keduanya belum teralokasi warga (urutan isi lama menempatkannya sesudah 2120/2121; warga baru 34) dan kini dikecualikan permanen: server `BlokTerlarang` + 1879/1882 (total terlarang 68→70, blok perumahan 3.932→3.930, kapasitas tetap 100.000 — blok terlarang jadi cadangan luapan di akhir urutan) dan klien menambahkannya ke set `TAMAN` (alas/pagar lahan + warna peta fasilitas ikut benar). Server: def `taman` (38,23) & `toko_pancing` (41,23) diubah; `Seed` kini ON CONFLICT DO UPDATE menyelaraskan nama/biaya/kol/bar dari definisi (status & dibangun_pada TIDAK ditimpa — tanggal bangun taman & toko tetap 2026-11-22 03:54:28 / 03:48:36 UTC). Test disesuaikan: pembangunan (blok taman 1879, toko 1882), db (total terlarang 70, kepala urutan baru {1880, 1881, 2120, 2121, 2119, 2122, 1800, 1801, 1958, 1963}, batas zona perumahan 98.250). gofmt/vet/test SEMUA lulus di X99; binary X99 md5 `db08aa87a6c33d6da17a61cbff0b4ef7`.
- Kanopi toko: slab lama (y 3,02 miring) diganti kanopi datar bertiang dua di y 4,85 (sisi bawah 4,78 — di atas puncak papan nama 4,50 dan ujung joran etalase 3,41), lebar 13,6 × dalam 4,2 menaungi seluruh etalase + lis depan. Mengikuti patokan kanopi rumah ?v=21: tepi bawah kanopi di atas elemen tertinggi yang dinaunginya.
- Klien: `FASILITAS_BLOK` taman (38,23) & toko_pancing (41,23); model/panel/papan RENCANA/peta mengikuti dari peta blok + API (blok lama 1637 & 2917 kembali lahan kosong berpagar berpapan generik). Biaya Taman & potongan kas TIDAK berubah (tetap Rp5.000.000 satu kali di ?v=34; kas.json tidak disentuh di ?v=35 — saldo tetap Rp670.000).
- Harness: uji_satublok **3.399/0** (+6 cek ?v=35: blok baru, set TAMAN, painter tepat satu + nama baru terpakai, kanopi 4,85 ada & kanopi lama hilang), uji_istana 432/0, uji_skill3d 192/0; pin versi → ?v=35.
- Deploy: backup `/opt/pinarak/bak-pindah/` (binary + public ?v=34); upload binary + app.js + index.html; rebuild COPY-only + up -d app. app.js md5 `c17d17a25e46b4448926b28b4be6ad85`, index.html `30ac0575dc3d7cd68c8639ab00eb5ca2`; md5 tersaji (?v=35) == lokal. Verifikasi API: taman Blok 1879 terbangun & toko_pancing Blok 1882 terbangun (tanggal asli dipertahankan), 7 baku lain "belum", terbangun 2/9; baris DB pembangunan terselaraskan (taman 38/23, toko_pancing 41/23); /api/statistik normal (34 warga — 1 warga baru dari auto-register).
- Bukti render pinjam-scene situs live (rig `lihat_pancing2.py`, scene terukur: taman @ (-119,-119) 29 mesh, toko_pancing @ (133,-119) 61 mesh; grup fasilitas di blok lama sudah tidak ada): `~/workspace/wsdiag/bukti-pancing2/papan_harga.jpg` ("HARGA UMPAN / Rp5.000 / cup" terbaca bersih), `papan_owner.jpg` ("Owner: @drennvanzz_" terbaca, tanpa undefined), `kanopi_depan.jpg` (papan nama TOKO PANCING utuh tak terpotong, kanopi jadi garis lis merah di atas papan, etalase berjoran di bawahnya), `toko_konteks.jpg` (toko di depan, deretan rumah warga Blok 1880/1881 + Istana Negara satu frame), `taman_konteks.jpg` (taman — jalur silang, kolam, bangku — di depan, deretan rumah Blok 1880/1881 tepat di seberang jalan).

## Kolam Pancing (22 Nov 2026, ?v=36)

- Pemicu: Fahmi bertanya "Kolam pancing mana" — toko pancing di Blok 1882 sudah berdiri tapi kolamnya belum ada; penegasan Fahmi: "1 blok aja" (kolam + toko HARUS muat di Blok 1882 saja, tidak melebar ke blok tetangga/jalan). Klien saja yang berubah; server Go/binary TIDAK disentuh (fasilitas tetap toko_pancing Blok 1882 terbangun).
- Model (di dalam `MODEL_FASILITAS.toko_pancing`, sisi TIMUR blok yang sama, pusat lokal (24,8; 0) → dunia (157,8; -119)): pola air mengikuti danau besar & danau taman — cakram pasir `0xd9c58f` (skala elips 9,0×12,9, y 0,04) di bawah air lingkaran lonjong `0x57b7d6` (7,6×10,6, y 0,10) + kilau matahari (TEX_KILAU, y 0,45). Elemen terluar = cakram pasir x lokal 15,8..33,8 / z -12,9..12,9 — di dalam interior blok (±35) dan di dalam alas lahan blok (±34). Dermaga kayu dari tepi barat menjorok ke air (dek 6,8×2,4 puncak 0,34 pola pelataran istana + 2 balok sisi + 6 tiang), 2 joran condong + ember di ujung dermaga, 3 kursi pancing menghadap air (2 tepi barat menghadap +x, 1 tepi selatan menghadap -z), papan "KOLAM PANCING" (buatPapanNama skala 0,62) di tepi barat dekat dermaga, 6 batu tepi + 6 rumpun ilalang di bibir kolam. Papan nama/owner/harga & kanopi ?v=35 tidak berubah; tidak ada elemen toko yang digeser.
- Tabrakan: `TAPAK_FASILITAS.toko_pancing` ditambah 3 AABB air — utara koridor [17,2; -10,6; 32,4; -1,7], selatan [17,2; 1,7; 32,4; 10,6], timur ujung dermaga [23,2; -1,7; 32,4; 1,7] — air tidak bisa diinjak, koridor dermaga z -1,7..1,7 bebas dilewati s/d x 23,2 (dermaga bisa dinaiki/dilewati, tanpa AABB). Minimap/peta besar: mengikuti pola yang ada (blok fasilitas terbangun tampil warna fasilitas; air per-fitur memang tidak digambar di peta — sama seperti kolam taman), tidak ada sistem baru.
- Harness: uji_satublok **3.407/0** (+8 cek ?v=36: papan kolam, ukuran air & pasir, dek dermaga, 3 AABB air, invariant cakram pasir di dalam blok; cek tapak ?v=34 disesuaikan ke format multi-AABB), uji_istana 432/0, uji_skill3d 192/0; pin versi → ?v=36 di ketiga harness.
- Deploy: backup `/opt/pinarak/bak-kolam/` (app.js + index.html ?v=35); upload app.js + index.html; rebuild COPY-only + up -d app. app.js md5 `51fe0dd6f04211250b78a9f41a89304e`, index.html `4da552d0c8487ac9e0abd2e89b125321`; md5 tersaji (?v=36) == lokal. Verifikasi API: /api/pembangunan tetap terbangun 2/9 (taman & toko_pancing Blok 1882), /api/statistik normal (34 warga).
- Bukti render pinjam-scene situs live (rig `lihat_kolam.py` + ambil ulang depan `lihat_kolam2.py`; scene terukur: toko_pancing @ (133,-119) mesh 61 → **118**, 57 mesh baru persis di area kolam lokal x>14): `~/workspace/wsdiag/bukti-pancing2/kolam_depan.jpg` (air lonjong + tepi pasir, dermaga berjoran + ember, papan "KOLAM PANCING" terbaca penuh, kursi & ilalang tepi), `kolam_konteks.jpg` (kolam + toko + deretan rumah Blok 1881 + Istana Negara satu frame; seluruh fasilitas terlihat di dalam satu blok berpagar jalan).

## Taman Wah (22 Nov 2026, ?v=37)
- Perintah Fahmi: "Taman kurang wah" + penegasan "1 blok aja" — upgrade total model `MODEL_FASILITAS.taman` di Blok 1879 (kol 38, bar 23, barat Blok 1880). SEMUA elemen di dalam blok yang sama: terukur dari scene live batas lokal maks |x| 31,5 / |z| 27,0 (interior blok ±34). Status/blok di panel & papan RENCANA tidak berubah (taman tetap terbangun 2026-11-22); server Go tidak disentuh.
- Elemen baru: (1) gerbang timur (x lokal +31,5, menghadap cluster warga Blok 1880): 2 tiang kayu beratap kecil hijau + palang + papan canvas "TAMAN NEGARA MERDU" (teksturPapanNama, menghadap +x), 2 pot pohon terakota mengapit jalan masuk; (2) jalan setapak silang diperpanjang penuh (62×4,5) + cincin paving RingGeometry(4,1; 6,1) mengelilingi air mancur; (3) air mancur tengah pola istana diperkecil: bak batu r 4,15 + lis + air 0x6fb7cf + tiang berundak + mangkuk + bola emas r 0,3 (tanpa semprotan — pelajaran istana); (4) gazebo tenggara (18,16): lantai batu 9,5×9,5 + 6 tiang + atap limas terakota + bola emas + bangku di dalam; (5) area bermain anak timur laut (nyambung usul taman bermain @hana_kaemung): ayunan rangka baja (palang x 14,5..21,5 di z -16, 2 dudukan berantai) + perosotan (menara kuning beratap di (13,5;-22,5), luncuran biru ke utara, anak tangga selatan); (6) 6 lampu taman — kepala memakai material bersama `LAMPU_TAMAN.mat` (emissive digerakkan fase waktu, menyala malam; TANPA PointLight baru; fallback M(0xffe2ae) bila material belum terisi); (7) hamparan bunga berpola: 5 petak tanah + SATU InstancedMesh kepala bunga (54 instans, setColorAt palet 5 warna, material khusus milik mesh itu sendiri — pola aman jebakan ?v=33); (8) pohon rindang 5 → 8 (posisi lama yang bertabrakan elemen baru digeser keluar tapaknya), bangku 3 → 6 (menghadap air mancur & kolam), semak bola warna 2 dipertahankan + 2 dipindah dari tapak gazebo/bermain. Kolam lama di (-14,-12) dipertahankan persis.
- Tabrakan `TAPAK_FASILITAS.taman` kini 5 AABB: kolam lama [-20,5;-18,5;-7,5;-5,5] (tetap), air mancur [-4,4;-4,4;4,4;4,4], gazebo [13,2;11,2;22,8;20,8], ayunan [14,2;-17,6;21,8;-14,4], perosotan [12,6;-23,5;14,4;-17,4]. Jalan setapak, cincin, dan area terbuka bebas dilewati.
- Harness: uji_satublok **3.423/0** (+16 cek ?v=37: papan gerbang, cincin, bak air mancur, atap gazebo, ayunan, lampu LAMPU_TAMAN, bunga setColorAt, 4 AABB baru + kolam lama utuh, jalan lama hilang, invariant batas blok), uji_istana 432/0, uji_skill3d 192/0; pin versi → ?v=37 di ketiga harness.
- Deploy: backup `/opt/pinarak/bak-tamanwah/` (app.js + index.html ?v=36); upload app.js + index.html (lewat `dd of=` via hst — redirect `>` ditelan fish hop Oracle); rebuild COPY-only + up -d app. app.js md5 `2b6097b378ac6c38180d9443d8320092`, index.html `3d0386bfb617f35d2de16da5a98a46ee`; md5 tersaji (?v=37) == lokal. Verifikasi API: /api/pembangunan tetap terbangun 2/9 (taman Blok 1879 tanggal asli + toko_pancing), /api/statistik normal (34 warga).
- Bukti render pinjam-scene situs live (rig `lihat_tamanwah.py` + foto malam ulang `lihat_tamanwah2.py`; scene terukur: taman @ (-119,-119) mesh 29 → **121** — air mancur 17, gerbang 12, gazebo 13, area main 19): `~/workspace/wsdiag/bukti-pancing2/taman_wah_depan.jpg` (dari gerbang timur: papan TAMAN NEGARA MERDU terbaca, petak bunga mengapit jalan masuk, gazebo di kiri, air mancur di kejauhan), `taman_wah_atas.jpg` (miring dari atas: seluruh komposisi satu blok — kolam, air mancur + cincin, petak bunga, gazebo, ayunan + perosotan, gerbang), `taman_wah_malam.jpg` (mode malam via pinarak_waktu=malam di rig: kepala lampu taman menyala terang mengelilingi air mancur; pengaturan rig dikembalikan ke senja sesudahnya).

## Frontend Next.js (migrasi) — 22 Nov 2026

Perintah Fahmi: "Frontend pake nextjs". Frontend vanilla (public/index.html + style.css + app.js monolit 5.502 baris) dimigrasikan ke Next.js; backend Go (API + WebSocket + PostgreSQL) TIDAK berubah sama sekali. `public/` lama TIDAK dihapus dari server maupun repo pada tahap ini.

### Arsitektur
- Proyek baru `web/` (Next.js 15.5, App Router, React 19). `web/app/page.js` (client component) me-render markup body index.html lama APA ADANYA dari `web/game/markup.js` (34,4 KB, lewat dangerouslySetInnerHTML — struktur DOM identik), lalu memuat kode game lewat dynamic `import("../game/main.js")` di useEffect. `web/app/layout.js` memuat `three.min.js` vendored (Script beforeInteractive, global THREE seperti dulu) + metadata/PWA yang sama; `web/app/globals.css` = style.css lama utuh. Aset PWA (three.min.js, manifest.webmanifest, ikon 180/192/512) di `web/public/` — path publik sama persis.
- Routing produksi (Traefik di Hostinger, semua label di container web; container Go TIDAK di-recreate): router `negara-api` (Host merdu.id && PathPrefix /api|/ws, prioritas 100) → service Go `pinarak`; router `negara-web` (Host merdu.id, prioritas 50) → service Next `negaraweb` (port 3000). Router lama di container Go tetap ada (kalah prioritas) — ROLLBACK = hapus label merdu.id dari service web lalu `docker compose up -d web`, Go kembali melayani semuanya dari public/ statisnya.
- Build WAJIB di X99 (aturan Fahmi): `docker build` di X99 → push registry `100.120.212.116:5000/negara-merdu-web` (tag `next3`, digest sha256:1f89583d71b6512909b000cba21d688a1b4a123c18926a5392df7cb045e50f70) → Hostinger `docker pull` (digest cocok). Runner memakai `next start` (output standalone Next tidak ter-emit di build X99 — dicatat apa adanya; pola next start terverifikasi jalan).
- Host uji: `uji.merdu.id` (record A Cloudflare dibuat dari Oracle via kredensial certbot, proxied, id fcfa638628014ccd0f94b02cbbb7998b) dengan router uji di container yang sama (web-uji + uji-api) — tetap aktif sesudah cutover untuk pengujian berikutnya.

### Peta modul (app.js dipecah menjadi ES modules di web/game/)
Pemecahan otomatis (skrip splitter satu-kali; 359 nama top-level terdaftar, 0 assignment lintas-modul, impor dihasilkan dari analisis pemakaian):
- `inti.js` — konstanta kota, ikon SVG, logika murni (posisi kavling, jalur NPC, kualitas, waktu).
- `bersama.js` — state bersama, tekstur prosedural, ambilData + cache, scene/renderer/kamera/lampu/langit, siklus waktu.
- `kota.js` — bangunKotaMassal (kota instanced 100.000 kavling).
- `fasilitas.js` — MODEL_FASILITAS + bangunLahanPembangunan (taman, toko pancing, dst.), papan, bendera, pinggiran kota.
- `karakter.js` — buatKarakter + animasi jalan/hidup warga & NPC.
- `rumah.js` — rumah detail, interior, distrik (bangunDistrik), rintangan, TAPAK_FASILITAS.
- `istana.js` — pusat kota / Istana Negara.
- `kamera.js` — orbit, mode kamera (orbit/orang pertama/orang ketiga/drone), pergerakan, tabrakan, joystick.
- `ui.js` — seluruh wiring UI: gerbang masuk/daftar, lengkapi profil, KTP/KK, keluarga, pemilu, pembangunan, chip, menu.
- `jaringan.js` — WebSocket multiplayer + chat.
- `peta.js` — minimap + peta besar.
- `main.js` — rotator status layar muat, loop animasi, boot `mulai()`.
- `markup.js` — markup halaman (bukan kode).
Penyesuaian lintas-modul yang terpaksa (perilaku identik): assignment langsung ke binding modul lain diganti setter/fungsi pemilik state — `setPutarOtomatis`/`setPetunjukDitutup`/`putarOrbitBilaOtomatis` (kamera), `setPulihInterior` (rumah), `resetWaktuSiklus`/`tambahWaktuSiklus`/`pantauFrame` (bersama), deklarasi `animasiKades` pindah ke istana (pemilik satu-satunya yang meng-assign).
Dua bug splitter yang ketahuan oleh verifikasi host uji dan diperbaiki sebelum cutover: (1) pemakaian spread `[...TAMAN]` terbaca sebagai akses properti → impor TAMAN hilang → ReferenceError saat bangun lahan; lexer diperbaiki (spread + interpolasi template kini terbaca sebagai pemakaian). (2) Baris multi-deklarasi (`let dinamis…; const rumahKlik…; const npcList…;`) hanya mengekspor nama pertama → npcList/rumahKlik hilang → ReferenceError di loop animasi; splitter kini memecah baris multi-deklarasi.

### Verifikasi host uji (uji.merdu.id, rig Chrome X99 jalur publik, tab baru, cache bersih)
Baseline pembanding = merdu.id ?v=37 di rig yang sama: #muat hilang, HUD tampil, taman 121 mesh, toko_pancing 118 mesh, grup lahan 18, kota massal 24 anak / 261.252 instance, scene 2.963 mesh, 0 exception.
Hasil uji (build next3): SEMUA angka identik (kotaInstance 261.256 hanya selama warga uji ke-35 ada; kembali 261.252 sesudah dibersihkan). 0 exception JS di semua run. Login warga uji: gerbang tertutup, chip saya tampil. Chat WebSocket: status "Chat sebagai @uji_next_migrasi" (soket OPEN lewat routing uji), pesan terkirim dan tersimpan di DB (id 61/62), riwayat 39 baris ter-render penuh di klien Next. Panel keluarga/pemilu/pembangunan/peta besar buka-tutup normal; mode kamera Orbit/1st Person/3rd Person/Drone + toggle putar otomatis jalan; semua tanpa exception. /api/statistik lewat domain uji normal (membuktikan split routing). Warga uji `uji_next_migrasi` + sesi + 2 chat + keluarga-nya DIHAPUS bersih sesudah tes (warga kembali 34, terverifikasi via /api/statistik).

### Cutover (22 Nov 2026)
Backup compose: `/opt/pinarak/bak-nextmigrasi/docker-compose.yml.pre` (pra-web) dan `.pre-cutover`. Sesudah verifikasi uji lulus penuh, label router merdu.id ditambahkan ke service web + `docker compose up -d web` (app & db tidak disentuh). Verifikasi ulang jalur publik merdu.id: /api/statistik dari Go (34 warga), halaman dari Next (title + chunk _next), www → 301 ke root, http → 302 ke https, rig browser: #muat hilang, HUD tampil, UKUR identik baseline (121/118/2.963/261.252), 0 exception. Screenshot bukti: X99 `/root/bukti-next/merdu.id.jpg` (baseline) & `uji.merdu.id.jpg`.

### Harness
Diperbarui ke susunan modul baru (SRC = gabungan web/game/*.js urutan muat; cek ?v=37 diganti cek kabel Next.js di page.js): uji_satublok **3.423/0**, uji_istana **432/0**, uji_skill3d **192/0**. uji_distrik resmi PENSIUN: target ekstraknya (blok LOGIKA DISTRIK) sudah dihapus sejak ?v=18 sehingga harness itu memang tidak bisa jalan jauh sebelum migrasi ini; file-nya kini menegaskan invarian pensiun pada modul baru (5/0) dan menunjuk uji_satublok sebagai pengganti.

## Kambuh Nyangkut Loading — TDZ Antar-Modul (22 Nov 2026, web next6)

Laporan Fahmi 15:13 WIB: "Stuck di loading lagi" di HP. Server sehat (merdu.id 200, /api/statistik 36 warga) — bug sisi klien, BUKAN kambuhnya bug ?v=33 (mesh atap instanced kosong); jaring pengaman ?v=33 di main.js terbukti masih utuh.

### Reproduksi & akar masalah
Rig Chrome asli di X99 via CDP (tab baru, cache dibersihkan, viewport HP, throttle CPU 4x, jalur publik): #muat TIDAK PERNAH hilang dalam 200 detik. Exception tertangkap persis:

```
ReferenceError: Cannot access 'nC' before initialization
    at nz (https://merdu.id/_next/static/chunks/351.94020357707b0994.js:1:140475)
    at https://merdu.id/_next/static/chunks/351.94020357707b0994.js:1:90760
    at 3351 (https://merdu.id/_next/static/chunks/351.94020357707b0994.js:1:96035)
    at r (webpack-...)
```

`nz` = `teksturBenderaMerdu()` dan `nC` = cache-nya `_texBenderaMerdu` di web/game/fasilitas.js. Mekanisme: (1) web/game/istana.js membangun seluruh plaza+istana lewat IIFE `(function pusatKota(){...})()` yang berjalan SAAT EVALUASI MODUL, dan di dalamnya memanggil teksturBenderaMerdu(); (2) cache itu `export let` — berada di TDZ sampai badan fasilitas.js dievaluasi; (3) urutan badan modul dalam chunk hasil concatenation webpack mengikuti graf impor, dan graf itu berubah oleh patch-patch WhatsApp (9530f25 menambah modul iklan.js; 35ac0c1 menambah istanaDalam.js + tepi impor rumah->istanaDalam->fasilitas). Di build next5 urutan berbalik: badan istana.js jalan sebelum inisialisasi `let _texBenderaMerdu` -> ReferenceError saat chunk dimuat -> main.js tidak pernah tereksekusi -> mulai() (dan try/catch ?v=33 di dalamnya) tidak pernah tercapai -> #muat terkunci di semua perangkat.

### Perbaikan (di sumber web/game/, perilaku & visual tidak berubah)
1. istana.js: IIFE evaluasi-modul diubah menjadi `export function bangunPusatKota()` (isi identik) — tidak ada lagi pembangunan saat evaluasi modul.
2. main.js: `bangunPusatKota()` dipanggil sebagai langkah PERTAMA di dalam try/catch boot mulai() (jaring pengaman ?v=33) — exception bangun kota jenis apa pun kini tidak bisa lagi mengunci loading.
3. fasilitas.js: cache tekstur bendera dipindah dari `let` modul ke properti fungsi (`teksturBenderaMerdu._tex`) — deklarasi fungsi terinisialisasi sejak fase instansiasi modul, jadi slot ini kebal TDZ untuk pemanggil kapan pun.

### Lintasan deploy (bertabrakan dengan Patch 4 — selesai tanpa kehilangan)
Perbaikan ini ter-commit MENJADI SATU dengan Patch 4 di commit eb0c1c5 (15:24 WIB; sesi Patch 4 meng-commit pohon kerja bersama yang sudah memuat perbaikan ini — terverifikasi dari diff commit-nya). Image gabungan dibangun di X99 sebagai negara-merdu-web:next6 digest sha256:86fbe40808f5bf241501dbcd8ce8c74b353ca9e4f46d4d0802797e5f09a5aca2 (Patch 4 + perbaikan TDZ), ter-push ke registry (tag next6 ditegaskan ulang ke digest ini) dan LIVE di Hostinger (container pinarak-web-1 menjalankan digest itu; backend Go tidak disentuh). Image next6 digest da6cb2fb yang sempat dibangun sesi ini dari pohon pra-Patch-4 tergantikan di semua tempat (registry, X99, Hostinger) oleh image gabungan. Backup compose pra-swap: /opt/pinarak/docker-compose.yml.bak-next6.

### Verifikasi jalur publik sesudah deploy (rig yang sama persis)
Tab baru + cache bersih + viewport HP + throttle 4x: **#muat hilang pada 34,0 detik** (sebelum fix: tidak pernah hilang/200 dtk), HUD tampil, gerbang tamu tampil, kotaMassal terbangun, **0 exception JS** (satu-satunya event = LOG peringatan SwiftShader bawaan Chrome headless). Bukti screenshot: ~/workspace/wsdiag/bukti-loading/muat_fix_next6.jpg (gerbang "Selamat datang di Negara Merdu" di atas kota 3D yang ter-render). Rig: /root/diag_muat2.py di X99, log /root/diag_run3.log.

### Harness (catatan jujur)
uji_satublok 3.421 lulus/2 gagal, uji_skill3d 189/3, uji_istana 358 gagal — dan angka-angka itu IDENTIK pada pohon TANPA perbaikan ini (dibuktikan via git stash dua arah): seluruh kegagalan adalah drift harness terhadap Patch 1–4 (ekstraksi AABB istana pra-skala, geometri kolam ?v=36/37, anggaran segitiga karakter Patch 3), BUKAN regresi perbaikan ini (0 kegagalan baru). Harness perlu diperbarui menyusul patch-patch tersebut di sesi terpisah.

## Tempelan Fahmi 22 Nov Malam: Karakter Stylized, Rumah Detail v2, Mobil, Daun & Lampu Baru, Istana PBR, Apartemen Residensia 10 (web next8 + next9, app Go baru)

Delapan potongan kode yang ditempel Fahmi di chat (17:21–17:50 WIB) diterapkan BYTE-PER-BYTE dalam dua fase web + satu fase server. Catatan tag: image **next7 sudah terlanjur dibangun & live oleh sesi WhatsApp** (commit 8d0dfd6 "Kota hidup", 16:44 WIB) sebelum siklus ini mulai, jadi tempelan masuk sebagai **next8**, dan pengganti spesifikasi terakhir (rumah detail v2 + Residensia 10) sebagai **next9**.

### Fase 1 — web next8 (digest sha256:96c8a055ea81…, live 17:39 WIB)
- **karakter.js diganti utuh** dengan modul stylized halus (sphere segmen tinggi, flatShading:false, rambut berponi, sepatu & tangan detail). Audit kontrak SEBELUM menimpa: ekspor modul baru identik 1:1 dengan yang lama (21 nama); `renderFoto3D` ternyata tinggal di ui.js, bukan karakter.js — tidak ada ekspor yang hilang. Pemanggil cocok: rumah.js menyetel `userData.fase` (dipakai modul baru sebagai benih `faseJalan`), kamera/rumah menyetel `kakiK/kakiR.rotation` langsung (kedua field ada). Ukuran terukur (metode sama, three.min.js vendor): lama 43–45 mesh / 8.139–8.251 tris per karakter → baru 55–58 mesh / 8.690–9.832 tris.
- **mobil(g, x, z, ry, warna)** (pembuat mobil detail 19 mesh) ditambahkan ke kendaraan.js sebagai ekspor, plus `bangunMobilPajangan()`: 8 mobil parkir tepi jalan — 4 di jalan selatan plaza (z 85,3, menghadap timur), 2 di jalan Taman–Blok 1880 (x −82,7, menghadap utara), 2 di jalan barat Toko Pancing (x 85,3, menghadap selatan) — semua di tepi luar lajur (tidak menghalangi lalu lintas), tiap mobil didaftarkan sebagai AABB di `rintanganFasilitas`. Tabrakan nama diselesaikan: array lalu lintas internal kendaraan.js bernama `mobil` diganti nama jadi `mobilJalan` (8 titik pakai) supaya fungsi tempel tetap byte-per-byte; impor `M` ditambahkan ke kendaraan.js.
- **buatRumahDetail v1** (kaca transparan + latar interior + jendela 4 sisi): 31–34 mesh → 72–80 mesh per rumah. (Versi ini kemudian DIGANTI v2 di fase 2 — lihat bawah.)
- **geoDaunJ** pohon jalan diganti tajuk gabungan 4 icosahedron (gabungGeometri): 20 → 320 tris per instans (1.195 pohon jalan). Pohon kavling & pohon taman tidak disentuh (definisi terpisah).
- **Lampu jalan massal**: tiang silinder berpondasi + lengan 1,15 + kepala 0,58×0,14×0,32 di-translate(1.02, 4.80, 0). Instancing lama TIDAK punya rotasi (semua ry=0 — lengan akan menghadap acak), jadi rotasi instance diselaraskan: lampu di jalan vertikal (x = sudutBlok(kol,0).x + 15,2 untuk kol 0/20/40/60) → ry=π (lengan ke −x, ke jalan di baratnya); lampu jalan horizontal → ry=π/2 (lengan ke −z, ke jalan di utaranya). Mekanisme malam tidak berubah (material kepala yang sama ditukar emissive-nya lewat LAMPU_JALAN.matKepala).
- **Istana PBR**: blok material diganti set MeshStandardMaterial metalik (matEmas metalness 0,72, matEmasT 0,78, matKubah baru, kaca jendela 0x2b475c roughness 0,12 metalness 0,45), jendelaEmas berkusen silang, kubah utama SphereGeometry 28×16 dengan matKubah, air mancur material licin (roughness 0,08). Penugasan holder malam dipertahankan persis: `MAT_JENDELA.mat = matJendelaIstana`, `LAMPU_TAMAN.mat = matKepalaTaman` — fase malam tetap menaikkan emissive lewat holder yang sama. Pola anti-TDZ tidak disentuh (bangunPusatKota tetap dipanggil dari mulai()).
- **Mobil bergerak arteri (kota.js)**: bangunLaluLintasMobil() + perbaruiMobil(dt, t) ditempel persis; impor inti.js ditambah KOTA_D, KOTA_W, PITCH, PLAZA_TAPAK, faseLaluLintas (semua memang diekspor inti.js; faseLaluLintas tinggal di inti.js). main.js: dipanggil sesudah bangunKotaMassal(), perbaruiMobil(dt, t) di loop RAF. CATATAN: sistem ini BERDAMPINGAN dengan lalu lintas kendaraan.js dari commit 8d0dfd6 (±320 mobil area pusat) — keduanya instanced, lajur kiri, patuh lampu; total mobil berjalan 384. Belum ada keputusan Fahmi untuk melebur keduanya.
- **Apartemen template 8 lantai** ditambahkan ke fasilitasBaru.js (MODEL_BARU + TAPAK_BARU) — kemudian DIGANTI Residensia 10 di fase 2.

Verifikasi fase 1 (rig CDP X99, jalur publik, viewport HP): #muat hilang 33,1 dtk, **0 exception**, karakter baru terukur langsung di scene (58 mesh/9.832 tris varian rambut — sama dengan ukur Node), 8/8 mobil pajangan ditemukan (19 mesh each), kepala lampu baru 0,58×0,14×0,32 terkonfirmasi (1.196 instans), lintas arteri: 64/64 mobil bergerak, 10 mobil tercatat berhenti-berkala di lampu, 0 diam permanen.

### Fase 2 — web next9 (digest sha256:47cea000a606…) + app Go baru (live 17:51 WIB)
Pengganti spesifikasi terakhir Fahmi (17:50 WIB) — menimpa, bukan menambah:
- **buatRumahDetail v2** (versi latar-palsu DIBATALKAN): dinding berbukaan FISIK dari pilar/spandrel/header di 4 sisi, kaca opacity 0,28 DoubleSide, interior 3D mini nyata (lantai parket, karpet, sofa, meja kopi, kabinet + TV, kasur + bantal + selimut, lemari, lampu plafon menyala). Terukur: **112–120 mesh / 1.476–2.028 tris per rumah** (v1: 72–80; asli: 31–34). Dengan ±30 rumah detail: ±3.500 mesh / ±55 ribu tris total di scene — dilaporkan apa adanya sesuai perintah, isi kode tidak dikurangi.
- **Apartemen RESIDENSIA 10** menggantikan template 8 lantai di fasilitasBaru.js: lobi transparan + 9 lantai hunian (36 unit, interior ter-instanced 8 InstancedMesh), lift kaca panoramik + pintu geser kabin/lantai sinkron, rooftop infinity pool. State `LIFT_APT` di atas file, `perbaruiApartemen(dt, t)` diekspor di bawah file dan dipanggil main.js di loop RAF sesudah perbaruiMobil — guard `if (!LIFT_APT.kabin) return` membuatnya aman selama apartemen belum terbangun. TAPAK apartemen diganti [[-13.5, -14.5, 16.0, 4.5]]. Helper pohonKecil(px, pz, skala) ternyata SUDAH diekspor fasilitas.js dan sudah diimpor fasilitasBaru.js — tidak perlu penyelesaian tambahan.
- **Server Go**: Fasilitas baru `{apartemen, "Apartemen Merdu Residence", Rp50.000.000, Kol 39, Bar 26}` (Blok 2120, selatan plaza) — seed idempoten saat start (INSERT … ON CONFLICT DO UPDATE), status awal "belum". BlokTerlarang + 2120 (total terlarang 70 → 71; perumahan 3.930 → 3.929 blok; kapasitas tetap 100.000). Urutan isi blok baru: 1880, 1881, 2121, 2119, 2122, 1800, … (2120 keluar dari zona perumahan; di dalam kelompok jarak-sama, urutan nomor menaik menempatkan 2119 sebelum 2122). Tes yang mengunci semua ini diperbarui (db_test, pembangunan_test). gofmt bersih, go vet lulus, `go test ./...` SEMUA LULUS (db, pembangunan, warga, chat) — dijalankan di container golang:1.23-alpine di X99. Binary dibangun di X99 (CGO_ENABLED=0, -trimpath, md5 ae0043fb94e080850c2d91d5b20988bf), ditransfer ke Hostinger, binary lama dibackup ke /opt/pinarak/bak-apartemen/pinarak.lama, app di-build ulang dari Dockerfile.runtime (tanpa kompilasi di server produksi) dan di-recreate; web tidak disentuh oleh langkah app.
- **Klien**: FASILITAS_BLOK apartemen {kol 39, bar 26} + TAMAN.add("39,26") di inti.js — petak 2120 tampil sebagai lahan pembangunan + papan nama mengikuti pola fasilitas belum terbangun lain; model Residensia 10 tampil penuh hanya bila status terbangun (MODEL_FASILITAS/TAPAK_FASILITAS sudah menggabungkan MODEL_BARU/TAPAK_BARU secara generik).

Verifikasi fase 2 (publik): GET /api/pembangunan = **10 fasilitas**, apartemen {blok 2120, biaya 50000000, status belum} ✓; /api/statistik tetap 36 warga ✓. Rig final (tab bersih, satu tab sekali jalan): #muat hilang 28,8–37,1 dtk (siang paksa 30,2 dtk), **0 exception di semua tab (senja, malam paksa, siang paksa)**. Arah lengan lampu dibaca langsung dari matriks instans tiang: lampu di jalan vertikal lengannya ke (-1, 0, 0), lampu di jalan horizontal ke (0, 0, -1) — semua sampel konsisten menghadap jalan. Sensus material fase malam: kaca jendela istana PBR (emissive 0xffc98a, metalness 0,45, roughness 0,12) aktif di 22 mesh dengan emissiveIntensity 2,2 (menyala hangat) dan kepala lampu taman 0xffc37a ei 2,6 di 13 mesh — mekanisme malam lewat holder MAT_JENDELA/LAMPU_TAMAN bekerja dengan material baru. Rumah detail v2 terukur 110–120 mesh per grup di scene live; 32 grup karakter (55–58 mesh) tampil; petak Blok 2120 tampil sebagai lahan pembangunan berpagar dengan papan di tepi selatannya. Bukti foto: ~/workspace/wsdiag/bukti-next9/ (karakter_siang.jpg, jalan_lampu_mobil.jpg, rumah_detail_v2.jpg, rumah_siang.jpg, petak_apartemen_2120.jpg, istana_kubah.jpg, istana_siang.jpg). Catatan jujur: satu run rig awal terbaca #muat 91,2 dtk karena tab zombie dari run yang terputus ikut merender di Chrome yang sama; sesudah tab dibersihkan, pengukuran berulang konsisten 28,8–37,1 dtk.

### Harness (catatan jujur, sama seperti bab sebelumnya)
Baseline SEBELUM tempelan (pohon 8d0dfd6): uji_satublok crash di ekstraksi (PUSAT_X — drift lama), uji_istana 358 gagal, uji_skill3d 189/3. SESUDAH tempelan: uji_istana 360 gagal, uji_skill3d 157/17. Seluruh kegagalan BARU tertelusur ke angka yang memang diubah kode tempel Fahmi, BUKAN kerusakan: (1) kubah Sphere(3.1) kini bermaterial matKubah & kaca istana 0x2b475c (cek harness mengunci warna lama 0x39566b); (2) pivot kaki/lengan karakter bergeser sesuai modul baru (kaki x ±0,16→±0,155, lengan (±0,42, 1,14)→(±0,40, 1,12)); (3) kanopi teras & overhang atap varian 1 (kerucut 4,1→4,15) mengikuti angka tempel; (4) cek "anggaran segitiga karakter 3000" SUDAH gagal sebelum tempelan (8.139) dan kini terbaca 8.690–9.832. Regresi kerusakan: 0. Penyegaran harness tetap pekerjaan terpisah.
