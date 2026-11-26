package warga

// Atur ulang PIN lewat DM Instagram (reset PIN Kartu Warga Negara).
//
// Alur (arah ditetapkan Pak Presiden, 26 Nov 2026 — JANGAN dibalik):
//  1. Warga meminta reset dari dialog masuk situs (POST /api/reset-pin):
//     server membuat sesi berisi kode sekali pakai; kode DITAMPILKAN DI
//     SITUS (yang disimpan hanya hash PBKDF2-nya, skema sama seperti PIN)
//     dan berlaku 10 menit. Satu sesi aktif per warga — permintaan baru
//     menimpa yang lama.
//  2. Warga mengirim kode itu sendiri lewat DM ke Instagram @negaramerdu
//     dari akun Instagram miliknya (bukti kepemilikan akun).
//  3. Verifier sisi Muse (cron) membaca inbox @negaramerdu, mencocokkan
//     pengirim + kode terhadap hash sesi pending (endpoint admin), lalu
//     menandai sesi terverifikasi (POST /api/admin/reset-pin/verifikasi).
//  4. Situs menanyakan status sesi (GET /api/reset-pin/status); sesudah
//     terverifikasi warga menetapkan PIN baru (POST /api/reset-pin/pin-baru)
//     dalam 10 menit berikutnya. PIN diganti -> semua sesi masuk warga
//     itu dihapus (dipaksa masuk ulang di semua perangkat).
//
// Respons POST /api/reset-pin selalu generik (ok + kode + token sesi)
// baik username terdaftar maupun tidak — untuk username tak terdaftar
// dibuat baris umpan (warga_id NULL) yang tidak akan pernah bisa
// terverifikasi, supaya alurnya tak bisa dipakai menebak warga terdaftar.

import (
	"crypto/subtle"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"pinarak/internal/db"
)

const (
	resetUmurKode  = 600 // detik: jendela menunggu DM terverifikasi
	resetUmurPIN   = 600 // detik: jendela menetapkan PIN sesudah terverifikasi
	resetMaksJamU  = 5   // permintaan per username per jam
	resetMaksJamIP = 20  // permintaan per IP per jam
	resetMaksCoba  = 5   // kegagalan tetapkan PIN sebelum sesi hangus
)

// alfabetKodeReset: huruf kapital + angka TANPA karakter ambigu
// (0/O/1/I/L dikeluarkan). Kode reset sengaja BUKAN angka semua —
// format lamanya 6 digit sama persis dengan PIN sehingga ambigu
// (perintah Pak Presiden, 26 Nov 2026).
const alfabetKodeReset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

var kodeResetRe = regexp.MustCompile(`^MRD-[` + alfabetKodeReset + `]{8}$`)

// buatKodeReset: kode sekali pakai "MRD-XXXXXXXX" — 8 karakter acak
// dari alfabetKodeReset, digambar dari crypto/rand lewat db.PilihAcak.
func buatKodeReset() string {
	var b strings.Builder
	b.Grow(12)
	b.WriteString("MRD-")
	for i := 0; i < 8; i++ {
		b.WriteByte(alfabetKodeReset[db.PilihAcak(len(alfabetKodeReset))])
	}
	return b.String()
}

// normalisasiKodeReset menyamakan kandidat kode (dari UI/verifier)
// ke bentuk kanonis: tanpa spasi tepi, huruf kapital.
func normalisasiKodeReset(k string) string {
	return strings.ToUpper(strings.TrimSpace(k))
}

// pembatasReset: pembatas laju sederhana di memori (server satu proses).
type pembatasReset struct {
	mu      sync.Mutex
	pukulan map[string][]int64
}

var batasReset = &pembatasReset{pukulan: map[string][]int64{}}

// boleh mencatat satu pukulan untuk kunci dan melaporkan apakah masih
// di bawah batas dalam jendela satu jam terakhir.
func (p *pembatasReset) boleh(kunci string, maks int, kini int64) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	batas := kini - 3600
	sisa := p.pukulan[kunci][:0]
	for _, t := range p.pukulan[kunci] {
		if t > batas {
			sisa = append(sisa, t)
		}
	}
	if len(sisa) >= maks {
		p.pukulan[kunci] = sisa
		return false
	}
	p.pukulan[kunci] = append(sisa, kini)
	return true
}

// ipKlien: IP pemanggil untuk pembatas laju (di belakang Traefik/nginx,
// ambil entri pertama X-Forwarded-For bila ada).
func ipKlien(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	return r.RemoteAddr
}

// sesiReset: satu baris tabel reset_pin.
type sesiReset struct {
	ID            int64
	WargaID       *int64
	Username      string
	Token         string
	KodeHash      string
	Salt          string
	Dibuat        int64
	Terverifikasi int64
	Status        string // aktif | selesai | gugur
	Percobaan     int
}

const kolomReset = "id, warga_id, username, token, kode_hash, salt, dibuat, terverifikasi, status, percobaan"

func scanReset(row interface{ Scan(...any) error }) (*sesiReset, error) {
	var s sesiReset
	err := row.Scan(&s.ID, &s.WargaID, &s.Username, &s.Token, &s.KodeHash,
		&s.Salt, &s.Dibuat, &s.Terverifikasi, &s.Status, &s.Percobaan)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// statusEfektif menurunkan status tampil sesi dari kolom tersimpan +
// waktu (kedaluwarsa dihitung malas, tanpa cron pembersih).
func statusEfektif(s *sesiReset, kini int64) string {
	if s.Status == "selesai" || s.Status == "gugur" {
		return s.Status
	}
	if s.Terverifikasi > 0 {
		if kini > s.Terverifikasi+resetUmurPIN {
			return "kedaluwarsa"
		}
		return "terverifikasi"
	}
	if kini > s.Dibuat+resetUmurKode {
		return "kedaluwarsa"
	}
	return "menunggu"
}

// sisaDetik: sisa waktu jendela aktif sesi (untuk hitung mundur di UI).
func sisaDetik(s *sesiReset, kini int64) int64 {
	var akhir int64
	if s.Terverifikasi > 0 {
		akhir = s.Terverifikasi + resetUmurPIN
	} else {
		akhir = s.Dibuat + resetUmurKode
	}
	if sisa := akhir - kini; sisa > 0 {
		return sisa
	}
	return 0
}

// ResetMinta menangani POST /api/reset-pin {username}.
func (h *Handler) ResetMinta(w http.ResponseWriter, r *http.Request) {
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	kini := time.Now().Unix()
	ip := ipKlien(r)
	if !batasReset.boleh("ip:"+ip, resetMaksJamIP, kini) {
		galat(w, 429, "Terlalu banyak percobaan. Coba lagi nanti.")
		return
	}
	username := strings.ToLower(strings.TrimLeft(strings.TrimSpace(strAmbil(data, "username")), "@"))
	if !usernameRe.MatchString(username) || strings.HasPrefix(username, ".") || strings.HasSuffix(username, ".") {
		// Format tak sah tidak mungkin warga terdaftar: jawab generik
		// tanpa membuat apa pun (kode acak tak tersimpan).
		tulisJSON(w, 200, map[string]any{
			"ok": true, "sesi": db.TokenAcak(16),
			"kode": buatKodeReset(), "berlaku_detik": resetUmurKode,
		})
		return
	}
	if !batasReset.boleh("u:"+username, resetMaksJamU, kini) {
		galat(w, 429, "Terlalu banyak percobaan. Coba lagi nanti.")
		return
	}
	ctx := r.Context()
	kode := buatKodeReset()
	token := db.TokenAcak(16)
	salt := db.TokenAcak(16)
	hash := db.HashPIN(kode, salt)
	// Kebersihan: buang baris berumur > 1 hari (termasuk umpan lama).
	_, _ = h.DB.Pool.Exec(ctx, "DELETE FROM reset_pin WHERE dibuat < $1", kini-86400)
	// Satu sesi aktif per username: permintaan baru menimpa yang lama.
	if _, err := h.DB.Pool.Exec(ctx, "DELETE FROM reset_pin WHERE username=$1", username); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	row, _ := db.WargaByUsername(ctx, h.DB.Pool, username)
	var wargaID any
	if row != nil {
		wargaID = row.ID
	}
	if _, err := h.DB.Pool.Exec(ctx,
		`INSERT INTO reset_pin(warga_id, username, token, kode_hash, salt, dibuat)
		 VALUES($1,$2,$3,$4,$5,$6)`,
		wargaID, username, token, hash, salt, kini); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 200, map[string]any{
		"ok": true, "sesi": token, "kode": kode, "berlaku_detik": resetUmurKode,
	})
}

// ResetStatus menangani GET /api/reset-pin/status?sesi=<token>.
func (h *Handler) ResetStatus(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("sesi"))
	if token == "" {
		galat(w, 400, "Sesi tidak dikenal")
		return
	}
	s, err := scanReset(h.DB.Pool.QueryRow(r.Context(),
		"SELECT "+kolomReset+" FROM reset_pin WHERE token=$1", token))
	if err != nil {
		galat(w, 404, "Sesi tidak ditemukan")
		return
	}
	kini := time.Now().Unix()
	tulisJSON(w, 200, map[string]any{
		"status": statusEfektif(s, kini), "sisa_detik": sisaDetik(s, kini),
	})
}

// ResetPINBaru menangani POST /api/reset-pin/pin-baru {sesi, pin_baru}:
// hanya untuk sesi terverifikasi yang belum kedaluwarsa.
func (h *Handler) ResetPINBaru(w http.ResponseWriter, r *http.Request) {
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	ctx := r.Context()
	token := strings.TrimSpace(strAmbil(data, "sesi"))
	pinBaru := strAmbil(data, "pin_baru")
	s, err := scanReset(h.DB.Pool.QueryRow(ctx,
		"SELECT "+kolomReset+" FROM reset_pin WHERE token=$1", token))
	if err != nil {
		galat(w, 404, "Sesi tidak ditemukan")
		return
	}
	kini := time.Now().Unix()
	// gagal mencatat kegagalan dan menghanguskan sesi pada batasnya.
	gagal := func(kode int, pesan string) {
		s.Percobaan++
		if s.Percobaan >= resetMaksCoba {
			_, _ = h.DB.Pool.Exec(ctx, "UPDATE reset_pin SET status='gugur', percobaan=$1 WHERE id=$2", s.Percobaan, s.ID)
		} else {
			_, _ = h.DB.Pool.Exec(ctx, "UPDATE reset_pin SET percobaan=$1 WHERE id=$2", s.Percobaan, s.ID)
		}
		galat(w, kode, pesan)
	}
	if statusEfektif(s, kini) != "terverifikasi" || s.WargaID == nil {
		gagal(403, "Sesi belum terverifikasi atau sudah kedaluwarsa")
		return
	}
	if !pinRe.MatchString(pinBaru) {
		gagal(400, "PIN baru harus tepat 6 angka")
		return
	}
	salt := db.TokenAcak(16)
	if _, err := h.DB.Pool.Exec(ctx, "UPDATE warga SET pin_hash=$1, salt=$2 WHERE id=$3",
		db.HashPIN(pinBaru, salt), salt, *s.WargaID); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	// PIN berganti -> paksa masuk ulang di semua perangkat.
	_, _ = h.DB.Pool.Exec(ctx, "DELETE FROM sesi WHERE warga_id=$1", *s.WargaID)
	_, _ = h.DB.Pool.Exec(ctx, "UPDATE reset_pin SET status='selesai' WHERE id=$1", s.ID)
	tulisJSON(w, 200, map[string]any{"ok": true})
}

// AdminResetPending menangani POST /api/admin/reset-pin/pending
// (X-Admin-Token): daftar sesi nyata yang masih menunggu DM, lengkap
// dengan hash + salt kode supaya verifier bisa mencocokkan isi DM tanpa
// kode teks polos pernah disimpan server.
func (h *Handler) AdminResetPending(w http.ResponseWriter, r *http.Request) {
	if !h.adminSah(r) {
		galat(w, 403, "Token admin tidak sah")
		return
	}
	kini := time.Now().Unix()
	rows, err := h.DB.Pool.Query(r.Context(),
		"SELECT "+kolomReset+` FROM reset_pin
		 WHERE warga_id IS NOT NULL AND status='aktif' AND terverifikasi=0 AND dibuat > $1
		 ORDER BY dibuat ASC`, kini-resetUmurKode)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	defer rows.Close()
	daftar := []map[string]any{}
	for rows.Next() {
		s, err := scanReset(rows)
		if err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
		daftar = append(daftar, map[string]any{
			"id": s.ID, "username": s.Username,
			"kode_hash": s.KodeHash, "salt": s.Salt, "dibuat": s.Dibuat,
		})
	}
	if err := rows.Err(); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 200, map[string]any{"sesi": daftar})
}

// AdminResetVerifikasi menangani POST /api/admin/reset-pin/verifikasi
// (X-Admin-Token) {id}: tandai sesi terverifikasi (DM cocok ditemukan
// verifier). Idempoten selama sesi masih dalam jendelanya.
func (h *Handler) AdminResetVerifikasi(w http.ResponseWriter, r *http.Request) {
	if !h.adminSah(r) {
		galat(w, 403, "Token admin tidak sah")
		return
	}
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	idF, ok := data["id"].(float64)
	if !ok || idF <= 0 {
		galat(w, 400, "ID sesi tidak valid")
		return
	}
	ctx := r.Context()
	s, err := scanReset(h.DB.Pool.QueryRow(ctx,
		"SELECT "+kolomReset+" FROM reset_pin WHERE id=$1", int64(idF)))
	if err != nil {
		galat(w, 404, "Sesi tidak ditemukan")
		return
	}
	kini := time.Now().Unix()
	switch statusEfektif(s, kini) {
	case "terverifikasi":
		tulisJSON(w, 200, map[string]any{"ok": true, "status": "terverifikasi"})
	case "menunggu":
		if _, err := h.DB.Pool.Exec(ctx,
			"UPDATE reset_pin SET terverifikasi=$1 WHERE id=$2", kini, s.ID); err != nil {
			galat(w, 500, "Kesalahan server")
			return
		}
		tulisJSON(w, 200, map[string]any{"ok": true, "status": "terverifikasi"})
	default:
		galat(w, 410, "Sesi sudah tidak aktif")
	}
}

// kodeCocok dipakai verifier lokal (dan tes): kandidat kode dari isi DM
// dinormalisasi ke bentuk kanonis, wajib lolos format MRD-XXXXXXXX
// (kandidat di luar format — termasuk angka 6 digit format lama —
// ditolak sebelum pencocokan), lalu dibandingkan konstan-waktu
// terhadap hash sesi.
func kodeCocok(kandidat, hash, salt string) bool {
	kandidat = normalisasiKodeReset(kandidat)
	if !kodeResetRe.MatchString(kandidat) {
		return false
	}
	h := db.HashPIN(kandidat, salt)
	return subtle.ConstantTimeCompare([]byte(h), []byte(hash)) == 1
}
