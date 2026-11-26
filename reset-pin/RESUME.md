# Reset PIN via DM — status & langkah lanjutan (26 Nov 2026, 23:47 WIB)

## Status
Semua kode SELESAI & terverifikasi lokal. Deploy TERBLOKIR: X99 offline
(Tailscale node `m-fahmi-hassan-x99` last seen ±23:15 WIB; ping 100% loss).
Aturan proyek: semua build di X99 — binary Go & image web TIDAK dibangun
di sandbox/produksi.

## Format kode reset (PENTING — diubah 26 Nov 2026 23:27 WIB)
Perintah Fahmi: kode reset TIDAK BOLEH 6 digit angka (sama persis dengan
format PIN -> ambigu). Format final: `MRD-` + 8 karakter acak dari
alfabet tak-ambigu `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (huruf kapital +
angka, TANPA 0/O/1/I/L), digambar dari crypto/rand. Bentuk contoh:
`MRD-K7PX3Q9A`. Teks DM tetap `Reset PIN Negara Merdu: MRD-XXXXXXXX`.
Backend (`buatKodeReset`/`kodeCocok` di resetpin.go) menolak kandidat di
luar format ini — termasuk angka 6 digit format lama. Verifier
mengekstrak kandidat dengan pola `MRD-[alfabet]{8}` (case-insensitive,
di-upper sebelum pencocokan hash). E2E di bawah WAJIB memakai kode
persis dari respons POST /api/reset-pin (format baru ini).

## Yang sudah jadi
- Backend: `goserver/internal/warga/resetpin.go` (+ tes lulus),
  tabel `reset_pin` di `goserver/internal/db/skema.go`,
  5 rute di `goserver/cmd/server/main.go`. gofmt/vet/`go test ./...` lulus
  (toolchain lokal, hanya verifikasi — bukan artefak deploy).
- Frontend: tombol "Lupa PIN?" + section reset/reset-kode/reset-pin/
  reset-selesai di `web/game/markup.js`, handler + polling + tombol Salin
  di `web/game/ui.js`, gaya `.blok-salin` di `web/app/globals.css`.
  Parse ES-module OK.
- Verifier: `reset-pin/verifier.py` (pola autoreg; PBKDF2 cocokkan DM;
  struktur thread CLI terpetakan dari DM uji nyata @mfahmihassan ->
  @negaramerdu: users[].username + messages[].sender_fbid/timestamp/
  content.text_body; DM warga mendarat di folder pending maupun inbox).
- Cron `negaramerdu-reset-pin-verifier` (interval 60s) TERDAFTAR tapi
  DISABLED — aktifkan sesudah backend live & E2E lulus.
- Skrip deploy: `deploy/deploy_app_resetpin.py`,
  `deploy/deploy_web_next38.py` (nomor mengikuti live: saat tulisan ini
  live=next36, agen skala menyiapkan next37; cek ulang tag live sebelum
  build web — nomor rilis web = live terakhir + 1).

## Langkah lanjutan (saat X99 kembali)
1. Backend: sinkron `goserver/` ke X99 `/root/builds/negara-merdu/`,
   build di container golang:1.23-alpine (CGO_ENABLED=0, -trimpath,
   pola deploy apartemen), `go test ./...` di sana juga.
2. Transfer binary -> Hostinger `/opt/pinarak/pinarak.new`
   (uji dulu `ssh root@76.13.197.226` dari X99; bila tak bisa: pull ke
   sandbox via deploy/pull_from_x99.py lalu kirim ber-chunk via
   autoreg/host_exec.py, atau bungkus image ke registry + docker cp).
3. `python3 deploy/deploy_app_resetpin.py | python3 autoreg/host_exec.py`
   (backup otomatis ke bak-resetpin/). Verifikasi output curl di skrip.
4. E2E (tanpa menyentuh PIN @thefahmihassan):
   a. Buat warga uji `mfahmihassan` via POST /api/daftar + X-Admin-Token
      (runner host_exec, pola autoreg; PIN awal acak tercatat di state uji).
   b. POST https://merdu.id/api/reset-pin {username: mfahmihassan}
      -> dapat kode + token sesi.
   c. Kirim DM dari @mfahmihassan (fbid 17841400148924820) ke
      @negaramerdu: `instagram-messages-cli send --account-id
      17841400148924820 --recipient-user-fbids 17841467282682017
      --text "Reset PIN Negara Merdu: <KODE>"`.
   d. `python3 reset-pin/verifier.py` -> harus TERVERIFIKASI.
   e. GET status sesi -> "terverifikasi"; POST /api/reset-pin/pin-baru
      dengan PIN uji baru; POST /api/login PIN baru harus 200.
   f. Negatif: pin-baru sebelum verifikasi (sesi kedua) -> 403;
      DM kode salah (format MRD- yang keliru) -> tidak terverifikasi;
      DM berisi angka 6 digit (format lama) -> juga tidak terverifikasi.
   g. BERSIHKAN warga uji dari DB (host_exec + psql di pinarak-db-1):
      hapus baris warga mfahmihassan + sesi + reset_pin-nya; cek
      /api/statistik kembali 48 warga.
5. Aktifkan cron: cron.update id=negaramerdu-reset-pin-verifier
   enabled=true; tunggu 1 siklus; cek reset-pin/verifier.log bersih.
6. Web: sinkron `web/` ke X99 `/root/builds/negara-merdu-web/`, build
   image tag = live+1, push registry, deploy via skrip deploy_web
   (sesuaikan nomor), verifikasi https://merdu.id memuat string
   "Atur Ulang PIN" / "Reset PIN Negara Merdu:" di bundle.
