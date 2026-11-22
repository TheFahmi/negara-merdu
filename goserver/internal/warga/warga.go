// Paket warga: pendaftaran, login/sesi, profil publik & privat (KTP/NIK),
// daftar warga berpaginasi, dan statistik desa. Meniru jalur warga
// server.py persis (kode status & bentuk JSON sama).
package warga

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"pinarak/internal/db"
	"pinarak/internal/keluarga"
)

var (
	usernameRe = regexp.MustCompile(`^[a-z0-9._]{1,30}$`)
	pinRe      = regexp.MustCompile(`^\d{6}$`)
	warnaRe    = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

var topiSah = map[string]bool{"peci": true, "topi": true, "tanpa": true}

// Publik: bentuk data warga untuk konsumsi publik (daftar warga, kartu
// rumah, WebSocket). TANPA NIK & data keluarga.
type Publik struct {
	Username   string  `json:"username"`
	WarnaBaju  string  `json:"warna_baju"`
	WarnaKulit string  `json:"warna_kulit"`
	Topi       string  `json:"topi"`
	NomorRumah int     `json:"nomor_rumah"`
	Blok       int     `json:"blok"`
	Kavling    int     `json:"kavling"`
	Jabatan    *string `json:"jabatan"`
}

// KePublik membentuk Publik dengan label jabatan dari peta (jalur daftar).
func KePublik(w *db.Warga, peta map[int64]*string) Publik {
	return Publik{
		Username:   w.Username,
		WarnaBaju:  w.WarnaBaju,
		WarnaKulit: w.WarnaKulit,
		Topi:       w.Topi,
		NomorRumah: w.NomorRumah,
		Blok:       w.Blok,
		Kavling:    w.Kavling,
		Jabatan:    peta[w.ID],
	}
}

// PublikSatu membentuk Publik untuk satu warga (label jabatan dicari sendiri).
func PublikSatu(ctx context.Context, q db.Querier, w *db.Warga) Publik {
	jab, _ := db.LabelJabatanWarga(ctx, q, w.ID)
	p := KePublik(w, nil)
	p.Jabatan = jab
	return p
}

// Privat: Publik + NIK + gender + tanggal daftar + ringkasan keluarga —
// hanya untuk pemiliknya sendiri lewat sesi. Gender TIDAK masuk Publik
// (tidak tampil di /api/warga maupun WebSocket).
type Privat struct {
	Publik
	NIK       *string             `json:"nik"`
	Gender    *string             `json:"gender"`
	Terdaftar string              `json:"terdaftar"`
	Keluarga  *keluarga.Ringkasan `json:"keluarga"`
}

// KePrivat membentuk Privat (query keluarga sendiri, seperti warga_privat).
func KePrivat(ctx context.Context, q db.Querier, w *db.Warga) Privat {
	terdaftar := w.CreatedAt
	if len(terdaftar) > 10 {
		terdaftar = terdaftar[:10]
	}
	ring, _ := keluarga.RingkasanWarga(ctx, q, w)
	return Privat{
		Publik:    PublikSatu(ctx, q, w),
		NIK:       w.NIK,
		Gender:    w.Gender,
		Terdaftar: terdaftar,
		Keluarga:  ring,
	}
}

// DariToken: token sesi -> warga (nil bila tidak ada / token kosong).
func DariToken(ctx context.Context, q db.Querier, token string) *db.Warga {
	if token == "" {
		return nil
	}
	w, err := db.ScanWarga(q.QueryRow(ctx,
		"SELECT w.id, w.username, w.pin_hash, w.salt, w.warna_baju, w.warna_kulit, "+
			"w.topi, w.nomor_rumah, w.blok, w.kavling, w.nik, w.keluarga_id, w.peran, w.created_at, w.gender "+
			"FROM sesi s JOIN warga w ON w.id=s.warga_id WHERE s.token=$1", token))
	if err != nil {
		return nil
	}
	return w
}

// DariHeader: warga dari header Authorization Bearer permintaan.
func DariHeader(ctx context.Context, q db.Querier, r *http.Request) *db.Warga {
	return DariToken(ctx, q, bearerToken(r))
}

// BackfillNIK mengisi NIK warga lama yang belum punya (idempoten —
// deterministik dari tanggal daftar + nomor rumah). Dipanggil saat start.
func BackfillNIK(ctx context.Context, s *db.Store) error {
	rows, err := s.Pool.Query(ctx,
		"SELECT id, created_at, nomor_rumah FROM warga WHERE nik IS NULL OR nik=''")
	if err != nil {
		return err
	}
	type baris struct {
		id      int64
		created *string
		nomor   int
	}
	var daftar []baris
	for rows.Next() {
		var b baris
		if err := rows.Scan(&b.id, &b.created, &b.nomor); err != nil {
			rows.Close()
			return err
		}
		daftar = append(daftar, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, b := range daftar {
		created := ""
		if b.created != nil {
			created = *b.created
		}
		if _, err := s.Pool.Exec(ctx, "UPDATE warga SET nik=$1 WHERE id=$2",
			db.BuatNIK(created, b.nomor), b.id); err != nil {
			return err
		}
	}
	return nil
}

// PINDefault: PIN pra-daftar yang dibuatkan sistem/admin (auto-register
// follower). Warga dengan PIN ini disuruh menggantinya lewat alur
// lengkapi profil saat pertama masuk.
const PINDefault = "123456"

// genderSah: nilai gender yang diterima ('L'/'P').
func genderSah(g string) bool { return g == "L" || g == "P" }

// pinDefaultkah: apakah PIN tersimpan warga masih PIN default — dicek
// dengan memverifikasi kandidat "123456" terhadap hash (tanpa flag
// tersimpan, jadi akun pra-daftar lama pun tertangkap).
func pinDefaultkah(w *db.Warga) bool { return db.PINBenar(PINDefault, w) }

// genderKosong: gender belum diisi (NULL/kosong).
func genderKosong(w *db.Warga) bool { return w.Gender == nil || *w.Gender == "" }

// Handler: endpoint-endpoint warga.
type Handler struct {
	DB *db.Store
	// AdminToken: token admin bersama (PINARAK_ADMIN_TOKEN) — dipakai
	// jalur pra-daftar /api/daftar (gender boleh dikosongkan).
	AdminToken string
	// Sambutan dipasang main.go (chat.SambutanWargaBaru): dipanggil sekali
	// per pendaftaran berhasil, mengembalikan teks sambutan Pak Presiden.
	Sambutan func(ctx context.Context, w *db.Warga) (string, error)
}

// adminSah: pola admin yang sama seperti pemilu/pembangunan — header
// X-Admin-Token dibandingkan konstan-waktu; token ENV kosong = tak sah.
func (h *Handler) adminSah(r *http.Request) bool {
	if h.AdminToken == "" {
		return false
	}
	return subtle.ConstantTimeCompare(
		[]byte(r.Header.Get("X-Admin-Token")), []byte(h.AdminToken)) == 1
}

// Daftar menangani POST /api/daftar.
func (h *Handler) Daftar(w http.ResponseWriter, r *http.Request) {
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	username := strings.ToLower(strings.TrimLeft(strings.TrimSpace(strAmbil(data, "username")), "@"))
	pin := strAmbil(data, "pin")
	baju := strAmbil(data, "warna_baju")
	kulit := strAmbil(data, "warna_kulit")
	topi := strAmbil(data, "topi")
	gender := strings.ToUpper(strings.TrimSpace(strAmbil(data, "gender")))
	if topi == "" {
		topi = "tanpa"
	}
	if !usernameRe.MatchString(username) || strings.HasPrefix(username, ".") || strings.HasSuffix(username, ".") {
		galat(w, 400, "Username Instagram tidak valid (huruf kecil, angka, titik, garis bawah)")
		return
	}
	if !pinRe.MatchString(pin) {
		galat(w, 400, "PIN harus 6 angka")
		return
	}
	if !warnaRe.MatchString(baju) || !warnaRe.MatchString(kulit) {
		galat(w, 400, "Warna tidak valid")
		return
	}
	if !topiSah[topi] {
		galat(w, 400, "Pilihan topi tidak valid")
		return
	}
	// Gender WAJIB untuk pendaftaran biasa. Pengecualian jalur pra-daftar
	// resmi (auto-register follower): request membawa header
	// X-Admin-Token yang sah -> gender boleh kosong, warga tercipta
	// dengan gender NULL dan melengkapinya saat pertama masuk (alur
	// lengkapi profil). Header admin yang hadir tapi TIDAK sah ditolak
	// 403, mengikuti pola endpoint admin lain.
	praDaftar := false
	if r.Header.Get("X-Admin-Token") != "" {
		if !h.adminSah(r) {
			galat(w, 403, "Token admin tidak sah")
			return
		}
		praDaftar = true
	}
	if gender != "" && !genderSah(gender) {
		galat(w, 400, "Gender tidak valid (L/P)")
		return
	}
	if gender == "" && !praDaftar {
		galat(w, 400, "Gender wajib dipilih (L/P)")
		return
	}
	var genderDB *string
	if gender != "" {
		genderDB = &gender
	}
	ctx := r.Context()
	salt := db.TokenAcak(16)
	pinHash := db.HashPIN(pin, salt)

	tx, err := h.DB.Pool.Begin(ctx)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	defer tx.Rollback(ctx)
	// Titik race alokasi: advisory lock transaksi menserialkan alokasi
	// nomor rumah + penggabungan keluarga (antar-replika); UNIQUE
	// (nomor_rumah) jaring terakhir.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", db.KunciAlokasi); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	if ada, _ := db.WargaByUsername(ctx, tx, username); ada != nil {
		galat(w, 409, "Username sudah terdaftar. Silakan masuk dengan PIN kamu.")
		return
	}
	jumlah, err := db.JumlahWarga(ctx, tx)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	nomor := jumlah + 1
	if nomor > db.Kapasitas {
		galat(w, 507, "Kavling kota sudah penuh (100.000 warga)")
		return
	}
	blok, kavling := db.Alokasi(nomor)
	var wargaID int64
	err = tx.QueryRow(ctx,
		`INSERT INTO warga(username,pin_hash,salt,warna_baju,warna_kulit,topi,nomor_rumah,blok,kavling,gender)
		 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		username, pinHash, salt, baju, kulit, topi, nomor, blok, kavling, genderDB).Scan(&wargaID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			galat(w, 409, "Username sudah terdaftar. Silakan masuk dengan PIN kamu.")
			return
		}
		galat(w, 500, "Kesalahan server")
		return
	}
	token := db.TokenAcak(24)
	if _, err := tx.Exec(ctx, "INSERT INTO sesi(token,warga_id) VALUES($1,$2)", token, wargaID); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	row, err := db.WargaByID(ctx, tx, wargaID)
	if err != nil || row == nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	if row.NIK == nil || *row.NIK == "" { // NIK dibuat server sekali, saat pendaftaran
		nik := db.BuatNIK(row.CreatedAt, row.NomorRumah)
		if _, err := tx.Exec(ctx, "UPDATE warga SET nik=$1 WHERE id=$2", nik, row.ID); err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
		row, _ = db.WargaByID(ctx, tx, wargaID)
	}
	if row.KeluargaID == nil { // warga baru langsung digabungkan ke keluarga (acak)
		if err := keluarga.Gabung(ctx, tx, row.ID); err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
		row, _ = db.WargaByID(ctx, tx, wargaID)
	}
	if err := tx.Commit(ctx); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	// Sambutan Pak Presiden: HANYA di jalur pendaftaran baru ini.
	sambutan := ""
	if h.Sambutan != nil {
		if teks, err := h.Sambutan(ctx, row); err == nil {
			sambutan = teks
		}
	}
	tulisJSON(w, 201, map[string]any{
		"ok": true, "token": token,
		"warga": KePrivat(ctx, h.DB.Pool, row), "sambutan": sambutan,
	})
}

// Login menangani POST /api/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	username := strings.ToLower(strings.TrimLeft(strings.TrimSpace(strAmbil(data, "username")), "@"))
	pin := strAmbil(data, "pin")
	ctx := r.Context()
	row, _ := db.WargaByUsername(ctx, h.DB.Pool, username)
	if row == nil || !db.PINBenar(pin, row) {
		galat(w, 401, "Username atau PIN salah")
		return
	}
	token := db.TokenAcak(24)
	if _, err := h.DB.Pool.Exec(ctx, "INSERT INTO sesi(token,warga_id) VALUES($1,$2)", token, row.ID); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	// Bendera lengkapi profil: pin_default = PIN terverifikasi masih
	// "123456" (akun pra-daftar); gender_kosong = gender belum diisi.
	// Klien membuka modal Lengkapi Profil bila salah satu benar.
	tulisJSON(w, 200, map[string]any{
		"ok": true, "token": token, "warga": KePrivat(ctx, h.DB.Pool, row),
		"pin_default": pinDefaultkah(row), "gender_kosong": genderKosong(row),
	})
}

// Lengkapi menangani POST /api/lengkapi (butuh sesi): warga melengkapi
// profilnya — ganti PIN (wajib bila PIN masih default), isi gender
// (wajib), dan atur penampilan. Dipakai alur "disuruh melengkapi" untuk
// akun yang dibuatkan lebih dulu (pra-daftar) maupun warga lama yang
// gender-nya masih kosong.
func (h *Handler) Lengkapi(w http.ResponseWriter, r *http.Request) {
	row := DariHeader(r.Context(), h.DB.Pool, r)
	if row == nil {
		galat(w, 401, "Belum masuk")
		return
	}
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	ctx := r.Context()
	gender := strings.ToUpper(strings.TrimSpace(strAmbil(data, "gender")))
	if !genderSah(gender) {
		galat(w, 400, "Gender wajib dipilih (L/P)")
		return
	}
	pinBaru := strAmbil(data, "pin_baru")
	defaultPIN := pinDefaultkah(row)
	if defaultPIN {
		if !pinRe.MatchString(pinBaru) {
			galat(w, 400, "PIN baru wajib tepat 6 angka")
			return
		}
	} else if pinBaru != "" {
		galat(w, 400, "PIN baru hanya diisi bila PIN masih bawaan pra-daftar")
		return
	}
	// Penampilan: field yang dikirim divalidasi; yang tidak dikirim
	// mempertahankan nilai sekarang.
	baju, kulit, topi := row.WarnaBaju, row.WarnaKulit, row.Topi
	if v := strAmbil(data, "warna_baju"); v != "" {
		if !warnaRe.MatchString(v) {
			galat(w, 400, "Warna tidak valid")
			return
		}
		baju = v
	}
	if v := strAmbil(data, "warna_kulit"); v != "" {
		if !warnaRe.MatchString(v) {
			galat(w, 400, "Warna tidak valid")
			return
		}
		kulit = v
	}
	if v := strAmbil(data, "topi"); v != "" {
		if !topiSah[v] {
			galat(w, 400, "Pilihan topi tidak valid")
			return
		}
		topi = v
	}
	if defaultPIN {
		salt := db.TokenAcak(16)
		if _, err := h.DB.Pool.Exec(ctx,
			"UPDATE warga SET pin_hash=$1, salt=$2, gender=$3, warna_baju=$4, warna_kulit=$5, topi=$6 WHERE id=$7",
			db.HashPIN(pinBaru, salt), salt, gender, baju, kulit, topi, row.ID); err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
	} else {
		if _, err := h.DB.Pool.Exec(ctx,
			"UPDATE warga SET gender=$1, warna_baju=$2, warna_kulit=$3, topi=$4 WHERE id=$5",
			gender, baju, kulit, topi, row.ID); err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
	}
	baru, err := db.WargaByID(ctx, h.DB.Pool, row.ID)
	if err != nil || baru == nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 200, map[string]any{
		"ok": true, "warga": KePrivat(ctx, h.DB.Pool, baru),
		"pin_default": pinDefaultkah(baru), "gender_kosong": genderKosong(baru),
	})
}

// Logout menangani POST /api/logout.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if token := bearerToken(r); token != "" {
		_, _ = h.DB.Pool.Exec(r.Context(), "DELETE FROM sesi WHERE token=$1", token)
	}
	tulisJSON(w, 200, map[string]any{"ok": true})
}

// Saya menangani GET /api/saya.
func (h *Handler) Saya(w http.ResponseWriter, r *http.Request) {
	row := DariHeader(r.Context(), h.DB.Pool, r)
	if row == nil {
		galat(w, 401, "Belum masuk")
		return
	}
	// Bendera yang sama seperti login, supaya sesi yang dipulihkan dari
	// token tersimpan juga tertangkap alur lengkapi profil.
	tulisJSON(w, 200, map[string]any{
		"warga":       KePrivat(r.Context(), h.DB.Pool, row),
		"pin_default": pinDefaultkah(row), "gender_kosong": genderKosong(row),
	})
}

// KeluargaSaya menangani GET /api/keluarga-saya.
func (h *Handler) KeluargaSaya(w http.ResponseWriter, r *http.Request) {
	row := DariHeader(r.Context(), h.DB.Pool, r)
	if row == nil {
		galat(w, 401, "Belum masuk")
		return
	}
	data, err := keluarga.DataSaya(r.Context(), h.DB.Pool, row)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	if data == nil {
		galat(w, 404, "Keluarga belum terbentuk")
		return
	}
	tulisJSON(w, 200, map[string]any{"keluarga": data})
}

// DaftarWarga menangani GET /api/warga (pagination wajib).
func (h *Handler) DaftarWarga(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	parse := func(s string) (int, error) { return strconv.Atoi(strings.TrimSpace(s)) }
	limit, offset := 100, 0
	var err1, err2 error
	if q.Has("limit") {
		limit, err1 = parse(q.Get("limit"))
	}
	if q.Has("offset") {
		offset, err2 = parse(q.Get("offset"))
	}
	if err1 != nil || err2 != nil {
		galat(w, 400, "limit/offset tidak valid")
		return
	}
	if limit > 500 {
		limit = 500
	}
	if limit < 1 {
		limit = 1
	}
	if offset < 0 {
		offset = 0
	}
	arah := "ASC"
	if q.Get("urut") == "terbaru" {
		arah = "DESC"
	}
	ctx := r.Context()
	total, err := db.JumlahWarga(ctx, h.DB.Pool)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	rows, err := h.DB.Pool.Query(ctx,
		"SELECT id, username, pin_hash, salt, warna_baju, warna_kulit, topi, "+
			"nomor_rumah, blok, kavling, nik, keluarga_id, peran, created_at, gender "+
			"FROM warga ORDER BY nomor_rumah "+arah+" LIMIT $1 OFFSET $2", limit, offset)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	defer rows.Close()
	var daftar []*db.Warga
	for rows.Next() {
		rw, err := db.ScanWarga(rows)
		if err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
		daftar = append(daftar, rw)
	}
	if err := rows.Err(); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	peta, _ := db.PetaJabatan(ctx, h.DB.Pool)
	hasil := make([]Publik, 0, len(daftar))
	for _, rw := range daftar {
		hasil = append(hasil, KePublik(rw, peta))
	}
	tulisJSON(w, 200, map[string]any{
		"warga": hasil, "total": total, "limit": limit, "offset": offset,
	})
}

// Statistik menangani GET /api/statistik.
func (h *Handler) Statistik(w http.ResponseWriter, r *http.Request) {
	n, err := db.JumlahWarga(r.Context(), h.DB.Pool)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 200, map[string]any{
		"warga": n, "rumah": n, "terisi": n, "kapasitas": db.Kapasitas,
		"blok_total": db.BlokKolom * db.BlokBaris, "per_blok": db.PerBlok,
	})
}
