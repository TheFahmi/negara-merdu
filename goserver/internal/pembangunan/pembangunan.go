// Paket pembangunan: pembangunan bertahap desa — 8 fasilitas baku yang
// mulai sebagai lahan kosong dan berdiri satu per satu lewat keputusan
// admin (token yang sama dengan pemilu), ditambah bangunan hasil voting
// warga (FasilitasVoting) yang berdiri sejak awal tanpa biaya kas.
// Meniru jalur pembangunan server.py.
package pembangunan

import (
	"context"
	"crypto/subtle"
	"net/http"

	"pinarak/internal/db"
)

// FasilitasDef: definisi tetap satu fasilitas (peta lahan + biaya kas
// virtual). Blok = bar*80 + kol + 1; peta ini WAJIB sinkron dengan
// FASILITAS_BLOK di public/app.js. Voting/Owner hanya terisi untuk
// bangunan hasil voting warga (FasilitasVoting).
type FasilitasDef struct {
	Kunci  string
	Nama   string
	Biaya  int
	Kol    int
	Bar    int
	Voting bool
	Owner  string
}

// Fasilitas: urutan tampil = biaya termurah dulu (sama seperti server.py).
var Fasilitas = []FasilitasDef{
	{Kunci: "taman", Nama: "Taman Desa", Biaya: 5_000_000, Kol: 38, Bar: 23},                     // Blok 1879 (dipindah dari 1637 ke barat Blok 1880 — perintah Fahmi 2026-11-22, blok lama dinilai terlalu jauh dari keramaian)
	{Kunci: "lapangan", Nama: "Lapangan Bola", Biaya: 8_000_000, Kol: 20, Bar: 36},               // Blok 2901
	{Kunci: "perpustakaan", Nama: "Perpustakaan Desa", Biaya: 12_000_000, Kol: 12, Bar: 12},      // Blok 973
	{Kunci: "balai_warga", Nama: "Balai Warga", Biaya: 15_000_000, Kol: 68, Bar: 12},             // Blok 1029
	{Kunci: "sekolah", Nama: "Sekolah Dasar", Biaya: 20_000_000, Kol: 52, Bar: 20},               // Blok 1653
	{Kunci: "puskesmas", Nama: "Puskesmas", Biaya: 25_000_000, Kol: 60, Bar: 36},                 // Blok 2941
	{Kunci: "pasar", Nama: "Pasar Desa", Biaya: 30_000_000, Kol: 28, Bar: 28},                    // Blok 2269
	{Kunci: "masjid", Nama: "Masjid", Biaya: 40_000_000, Kol: 44, Bar: 28},                       // Blok 2285
	{Kunci: "apartemen", Nama: "Apartemen Merdu Residence", Biaya: 50_000_000, Kol: 39, Bar: 26}, // Blok 2120 (perintah Fahmi 2026-11-22: apartemen dipasang sebagai rencana pembangunan di selatan plaza)
}

// FasilitasVoting: bangunan di luar 8 fasilitas baku, hasil voting
// usulan warga di komentar Instagram (pemenang diputuskan Fahmi).
// Berdiri sejak awal dan TANPA biaya Kas Negara (kas tidak dipotong).
// Toko Pancing: usulan @drennvanzz_ (warga #5), pemenang voting warga
// Episode 2–3, dibangun atas perintah Fahmi 2026-11-22. Awalnya di
// Blok 2917 (selatan blok danau), lalu DIPINDAH ke Blok 1882 (kol 41,
// bar 23) — tepat di timur Blok 1881 yang sedang terisi warga — atas
// laporan Fahmi 2026-11-22 bahwa blok lama terlalu jauh dari keramaian.
var FasilitasVoting = []FasilitasDef{
	{Kunci: "toko_pancing", Nama: "Toko Pancing", Biaya: 0, Kol: 41, Bar: 23, Voting: true, Owner: "@drennvanzz_"}, // Blok 1882
}

// SemuaFasilitas: 8 fasilitas baku diikuti bangunan voting.
func SemuaFasilitas() []FasilitasDef {
	semua := make([]FasilitasDef, 0, len(Fasilitas)+len(FasilitasVoting))
	semua = append(semua, Fasilitas...)
	semua = append(semua, FasilitasVoting...)
	return semua
}

var perKunci = func() map[string]FasilitasDef {
	m := make(map[string]FasilitasDef, len(Fasilitas)+len(FasilitasVoting))
	for _, f := range SemuaFasilitas() {
		m[f.Kunci] = f
	}
	return m
}()

// Item: satu fasilitas + statusnya untuk API publik.
type Item struct {
	Kunci        string  `json:"kunci"`
	Nama         string  `json:"nama"`
	Biaya        int     `json:"biaya"`
	Kol          int     `json:"kol"`
	Bar          int     `json:"bar"`
	Blok         int     `json:"blok"`
	Status       string  `json:"status"`
	DibangunPada *string `json:"dibangun_pada"`
	Voting       bool    `json:"voting,omitempty"`
	Owner        string  `json:"owner,omitempty"`
}

// Seed mengisi tabel pembangunan dari definisi (idempoten). Definisi
// adalah sumber kebenaran lokasi: pada konflik, nama/biaya/kol/bar
// diselaraskan dari definisi (memungkinkan pemindahan blok fasilitas
// lewat deploy), tetapi status & tanggal bangun yang sudah ada TIDAK
// ditimpa. Dipanggil saat start.
// Bangunan voting dimasukkan langsung berstatus terbangun bertanggal
// hari ini (berdiri sejak awal atas keputusan Fahmi).
func Seed(ctx context.Context, s *db.Store) error {
	for _, f := range SemuaFasilitas() {
		if f.Voting {
			if _, err := s.Pool.Exec(ctx,
				`INSERT INTO pembangunan(kunci, nama, biaya, kol, bar, status, dibangun_pada)
				 VALUES($1,$2,$3,$4,$5,'terbangun',$6)
				 ON CONFLICT (kunci) DO UPDATE SET nama=EXCLUDED.nama, biaya=EXCLUDED.biaya, kol=EXCLUDED.kol, bar=EXCLUDED.bar`,
				f.Kunci, f.Nama, f.Biaya, f.Kol, f.Bar, db.SekarangLokalStr()); err != nil {
				return err
			}
			continue
		}
		if _, err := s.Pool.Exec(ctx,
			`INSERT INTO pembangunan(kunci, nama, biaya, kol, bar)
			 VALUES($1,$2,$3,$4,$5)
			 ON CONFLICT (kunci) DO UPDATE SET nama=EXCLUDED.nama, biaya=EXCLUDED.biaya, kol=EXCLUDED.kol, bar=EXCLUDED.bar`,
			f.Kunci, f.Nama, f.Biaya, f.Kol, f.Bar); err != nil {
			return err
		}
	}
	return nil
}

// DaftarStatus: semua fasilitas + statusnya (urut definisi).
func DaftarStatus(ctx context.Context, q db.Querier) ([]Item, error) {
	rows, err := q.Query(ctx, "SELECT kunci, status, dibangun_pada FROM pembangunan")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type st struct {
		status string
		pada   *string
	}
	peta := make(map[string]st)
	for rows.Next() {
		var k, s string
		var p *string
		if err := rows.Scan(&k, &s, &p); err != nil {
			return nil, err
		}
		peta[k] = st{s, p}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	hasil := make([]Item, 0, len(Fasilitas)+len(FasilitasVoting))
	for _, f := range SemuaFasilitas() {
		it := Item{
			Kunci: f.Kunci, Nama: f.Nama, Biaya: f.Biaya, Kol: f.Kol, Bar: f.Bar,
			Blok:   f.Bar*db.BlokKolom + f.Kol + 1,
			Status: "belum",
			Voting: f.Voting, Owner: f.Owner,
		}
		if s, ok := peta[f.Kunci]; ok {
			if s.status == "terbangun" {
				it.Status = "terbangun"
			}
			it.DibangunPada = s.pada
		}
		hasil = append(hasil, it)
	}
	return hasil, nil
}

// Handler: endpoint pembangunan.
type Handler struct {
	DB         *db.Store
	AdminToken string
}

func (h *Handler) adminSah(r *http.Request) bool {
	if h.AdminToken == "" {
		return false
	}
	return subtle.ConstantTimeCompare(
		[]byte(r.Header.Get("X-Admin-Token")), []byte(h.AdminToken)) == 1
}

// Daftar menangani GET /api/pembangunan (publik).
func (h *Handler) Daftar(w http.ResponseWriter, r *http.Request) {
	daftar, err := DaftarStatus(r.Context(), h.DB.Pool)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	n := 0
	for _, f := range daftar {
		if f.Status == "terbangun" {
			n++
		}
	}
	tulisJSON(w, 200, map[string]any{
		"fasilitas": daftar, "terbangun": n, "total": len(daftar),
	})
}

// Bangun menangani POST /api/admin/pembangunan/bangun.
func (h *Handler) Bangun(w http.ResponseWriter, r *http.Request) {
	if !h.adminSah(r) {
		galat(w, 403, "Token admin tidak sah")
		return
	}
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	kunci := strAmbil(data, "kunci")
	f, ok := perKunci[kunci]
	if !ok {
		galat(w, 404, "Fasilitas tidak dikenal")
		return
	}
	ctx := r.Context()
	var status string
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT status FROM pembangunan WHERE kunci=$1", kunci).Scan(&status)
	if err == nil && status == "terbangun" {
		galat(w, 409, f.Nama+" sudah berdiri")
		return
	}
	sekarang := db.SekarangLokalStr()
	if _, err := h.DB.Pool.Exec(ctx,
		"UPDATE pembangunan SET status='terbangun', dibangun_pada=$1 WHERE kunci=$2",
		sekarang, kunci); err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 201, map[string]any{
		"ok": true, "kunci": kunci, "nama": f.Nama, "dibangun_pada": sekarang,
	})
}
