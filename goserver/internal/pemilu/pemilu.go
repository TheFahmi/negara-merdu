// Paket pemilu: pemilihan Ketua RT / Ketua RW / Presiden — kandidat
// berwajib visi-misi, hak pilih per wilayah rumah, gerbang jumlah warga,
// fase pencalonan -> pemungutan -> selesai, penetapan pemenang & jabatan
// aktif. Meniru jalur pemilu server.py persis.
package pemilu

import (
	"context"
	"crypto/subtle"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"pinarak/internal/db"
	"pinarak/internal/warga"
)

// Batas panjang teks kandidat (karakter).
const (
	VisiMaks = 200
	MisiMaks = 1000
)

// LabelJabatanSah: jabatan yang dikenal.
var LabelJabatanSah = map[string]bool{"kades": true, "walikota": true, "camat": true, "lurah": true, "rw": true, "rt": true}

// Periode: satu baris tabel pemilu.
type Periode struct {
	ID          int64
	Status      string
	DibukaPada  *string
	DitutupPada *string
	// PemungutanPada: saat fase pemungutan dibuka — hanya warga terdaftar
	// SEBELUM saat ini yang punya hak pilih.
	PemungutanPada *string
}

// KandidatView: satu kandidat + suara berjalan untuk respons API.
type KandidatView struct {
	ID       int64   `json:"id"`
	Username string  `json:"username"`
	Jabatan  string  `json:"jabatan"`
	Wilayah  int     `json:"wilayah"`
	Visi     string  `json:"visi"`
	Misi     string  `json:"misi"`
	Suara    int     `json:"suara"`
	Persen   float64 `json:"persen"`
}

// Balapan: satu balapan (jabatan+wilayah).
type Balapan struct {
	Jabatan    string         `json:"jabatan"`
	Wilayah    int            `json:"wilayah"`
	Label      *string        `json:"label"`
	TotalSuara int            `json:"total_suara"`
	Kandidat   []KandidatView `json:"kandidat"`
	PemenangID *int64         `json:"pemenang_id"`
	// TanpaPemenang: periode selesai tetapi tidak ada pemenang sah
	// ("seri" = suara teratas sama; "nol" = tidak ada suara masuk) ->
	// jabatan tetap dipegang pejabat lama.
	TanpaPemenang string `json:"tanpa_pemenang,omitempty"`
}

// Pejabat: satu pejabat aktif untuk panel publik.
type Pejabat struct {
	Username string  `json:"username"`
	Jabatan  string  `json:"jabatan"`
	Wilayah  int     `json:"wilayah"`
	Label    *string `json:"label"`
}

// Gerbang: status gerbang jumlah warga.
type Gerbang struct {
	MinWarga    int
	JumlahWarga int
	Terkunci    bool
}

// StatusGerbang menghitung gerbang dari DB saat ini juga.
func StatusGerbang(ctx context.Context, q db.Querier, minWarga int) (Gerbang, error) {
	n, err := db.JumlahWarga(ctx, q)
	if err != nil {
		return Gerbang{}, err
	}
	return Gerbang{MinWarga: minWarga, JumlahWarga: n, Terkunci: n < minWarga}, nil
}

// Terbaru: periode pemilu terakhir (apa pun statusnya), atau nil.
func Terbaru(ctx context.Context, q db.Querier) (*Periode, error) {
	p := &Periode{}
	err := q.QueryRow(ctx,
		"SELECT id, status, dibuka_pada, ditutup_pada, pemungutan_pada FROM pemilu ORDER BY id DESC LIMIT 1").
		Scan(&p.ID, &p.Status, &p.DibukaPada, &p.DitutupPada, &p.PemungutanPada)
	if err != nil {
		return nil, nil
	}
	return p, nil
}

// BalapanData menyusun satu balapan: kandidat urut waktu daftar + suara +
// persen berjalan + pemenang bila periode selesai. Aturan seri: suara
// terbanyak; seri -> pendaftar lebih dulu (urutan daftar dipertahankan).
func BalapanData(ctx context.Context, q db.Querier, p *Periode, jabatan string, wilayah int) (Balapan, error) {
	b := Balapan{Jabatan: jabatan, Wilayah: wilayah, Label: db.LabelJabatan(jabatan, wilayah),
		Kandidat: []KandidatView{}}
	rows, err := q.Query(ctx,
		`SELECT k.id, w.username, k.visi, k.misi FROM kandidat k
		 JOIN warga w ON w.id=k.warga_id
		 WHERE k.pemilu_id=$1 AND k.jabatan=$2 AND k.wilayah=$3
		 ORDER BY k.dibuat_pada ASC, k.id ASC`, p.ID, jabatan, wilayah)
	if err != nil {
		return b, err
	}
	type mentah struct {
		id       int64
		username string
		visi     string
		misi     string
	}
	var daftar []mentah
	for rows.Next() {
		var m mentah
		if err := rows.Scan(&m.id, &m.username, &m.visi, &m.misi); err != nil {
			rows.Close()
			return b, err
		}
		daftar = append(daftar, m)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return b, err
	}
	srows, err := q.Query(ctx,
		`SELECT kandidat_id, COUNT(*) FROM suara
		 WHERE pemilu_id=$1 AND jabatan=$2 AND wilayah=$3 GROUP BY kandidat_id`,
		p.ID, jabatan, wilayah)
	if err != nil {
		return b, err
	}
	hitung := make(map[int64]int)
	for srows.Next() {
		var kid int64
		var c int
		if err := srows.Scan(&kid, &c); err != nil {
			srows.Close()
			return b, err
		}
		hitung[kid] = c
	}
	srows.Close()
	if err := srows.Err(); err != nil {
		return b, err
	}
	total := 0
	for _, c := range hitung {
		total += c
	}
	b.TotalSuara = total
	for _, m := range daftar {
		s := hitung[m.id]
		b.Kandidat = append(b.Kandidat, KandidatView{
			ID: m.id, Username: m.username, Jabatan: jabatan, Wilayah: wilayah,
			Visi: m.visi, Misi: m.misi, Suara: s, Persen: db.PersenSuara(s, total),
		})
	}
	if p.Status == "selesai" && len(b.Kandidat) > 0 {
		id, alasan := pemenangSah(b.Kandidat)
		if alasan == "" {
			b.PemenangID = &id
		} else {
			b.TanpaPemenang = alasan
		}
	}
	return b, nil
}

// pemenangSah: kandidat bersuara terbanyak, dengan syarat (26 Nov 2026):
// minimal 1 suara (kalau tidak -> "nol") dan tidak seri di posisi teratas
// (kalau seri -> "seri"). Tanpa pemenang sah, jabatan tetap dipegang
// pejabat lama sampai pemilu berikutnya.
func pemenangSah(daftar []KandidatView) (int64, string) {
	terbaik, seri := daftar[0], false
	for _, k := range daftar[1:] {
		if k.Suara > terbaik.Suara {
			terbaik, seri = k, false
		} else if k.Suara == terbaik.Suara {
			seri = true
		}
	}
	if terbaik.Suara < 1 {
		return 0, "nol"
	}
	if seri {
		return 0, "seri"
	}
	return terbaik.ID, ""
}

// pemenangBalapan: (warga_id pemenang) satu balapan pada penutupan.
func pemenangBalapan(ctx context.Context, q db.Querier, p *Periode, jabatan string, wilayah int) (int64, bool, error) {
	data, err := BalapanData(ctx, q, p, jabatan, wilayah)
	if err != nil || len(data.Kandidat) == 0 {
		return 0, false, err
	}
	kid := data.PemenangID
	if kid == nil { // seri atau tanpa suara: tidak ada pemenang, pejabat lama tetap
		return 0, false, nil
	}
	var wargaID int64
	err = q.QueryRow(ctx, "SELECT warga_id FROM kandidat WHERE id=$1", *kid).Scan(&wargaID)
	if err != nil {
		return 0, false, nil
	}
	return wargaID, true, nil
}

// TetapkanPemenang menetapkan pemenang tiap balapan berkandidat ke tabel
// jabatan (pemegang lama balapan sama digantikan; pemenang melepas
// jabatan lamanya lewat upsert per warga). Mengembalikan daftar
// (warga_id, jabatan, wilayah) pemenang.
func TetapkanPemenang(ctx context.Context, q db.Querier, p *Periode) ([][3]any, error) {
	sekarang := db.SekarangLokalStr()
	rows, err := q.Query(ctx,
		"SELECT DISTINCT jabatan, wilayah FROM kandidat WHERE pemilu_id=$1", p.ID)
	if err != nil {
		return nil, err
	}
	type balapanKey struct {
		jabatan string
		wilayah int
	}
	var kunci []balapanKey
	for rows.Next() {
		var k balapanKey
		if err := rows.Scan(&k.jabatan, &k.wilayah); err != nil {
			rows.Close()
			return nil, err
		}
		kunci = append(kunci, k)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	selesai := *p
	selesai.Status = "selesai"
	var pemenang [][3]any
	for _, k := range kunci {
		wid, ok, err := pemenangBalapan(ctx, q, &selesai, k.jabatan, k.wilayah)
		if err != nil {
			return nil, err
		}
		if ok {
			pemenang = append(pemenang, [3]any{wid, k.jabatan, k.wilayah})
		}
	}
	for _, pm := range pemenang {
		if _, err := q.Exec(ctx, "DELETE FROM jabatan WHERE jabatan=$1 AND wilayah=$2",
			pm[1], pm[2]); err != nil {
			return nil, err
		}
	}
	for _, pm := range pemenang {
		if _, err := q.Exec(ctx,
			`INSERT INTO jabatan(warga_id, jabatan, wilayah, sejak, pemilu_id)
			 VALUES($1,$2,$3,$4,$5)
			 ON CONFLICT (warga_id) DO UPDATE SET
			   jabatan=EXCLUDED.jabatan, wilayah=EXCLUDED.wilayah,
			   sejak=EXCLUDED.sejak, pemilu_id=EXCLUDED.pemilu_id`,
			pm[0], pm[1], pm[2], sekarang, p.ID); err != nil {
			return nil, err
		}
	}
	return pemenang, nil
}

// DaftarPejabat: semua pejabat aktif (urut kades, rw, rt; lalu wilayah).
func DaftarPejabat(ctx context.Context, q db.Querier) ([]Pejabat, error) {
	rows, err := q.Query(ctx,
		`SELECT w.username, j.jabatan, j.wilayah FROM jabatan j
		 JOIN warga w ON w.id=j.warga_id
		 ORDER BY CASE j.jabatan WHEN 'kades' THEN 0 WHEN 'walikota' THEN 1 WHEN 'camat' THEN 2
		          WHEN 'lurah' THEN 3 WHEN 'rw' THEN 4 ELSE 5 END,
		          j.wilayah ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	hasil := []Pejabat{}
	for rows.Next() {
		var p Pejabat
		if err := rows.Scan(&p.Username, &p.Jabatan, &p.Wilayah); err != nil {
			return nil, err
		}
		p.Label = db.LabelJabatan(p.Jabatan, p.Wilayah)
		hasil = append(hasil, p)
	}
	return hasil, rows.Err()
}

// statusHak: (terverifikasi, terdaftar_pada) warga — dibaca terpisah
// supaya struktur Warga bersama tidak berubah.
func statusHak(ctx context.Context, q db.Querier, wargaID int64) (bool, string) {
	var v bool
	var dibuat *string
	if err := q.QueryRow(ctx, "SELECT terverifikasi, created_at FROM warga WHERE id=$1", wargaID).Scan(&v, &dibuat); err != nil {
		return false, ""
	}
	if dibuat == nil {
		return v, ""
	}
	return v, *dibuat
}

// PesanBelumVerifikasi: alasan ditolak bila akun belum terverifikasi.
const PesanBelumVerifikasi = "Akunmu belum terverifikasi. Hak pilih & mencalonkan khusus warga yang mem-follow @negaramerdu di Instagram dengan username yang sama — follow dulu, verifikasi berjalan otomatis berkala."

// Handler: endpoint pemilu.
type Handler struct {
	DB         *db.Store
	AdminToken string
	MinWarga   int
}

func (h *Handler) adminSah(r *http.Request) bool {
	if h.AdminToken == "" {
		return false
	}
	return subtle.ConstantTimeCompare(
		[]byte(r.Header.Get("X-Admin-Token")), []byte(h.AdminToken)) == 1
}

// Ambil menangani GET /api/pemilu.
func (h *Handler) Ambil(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()
	row := warga.DariHeader(ctx, h.DB.Pool, r)
	p, _ := Terbaru(ctx, h.DB.Pool)
	gerbang, err := StatusGerbang(ctx, h.DB.Pool, h.MinWarga)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	pejabat, err := DaftarPejabat(ctx, h.DB.Pool)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	var wilayahSaya *db.Wilayah
	if row != nil {
		wl := db.WilayahLengkap(row.Blok)
		wilayahSaya = &wl
	}
	balapan := []Balapan{}
	suaraSaya := map[string]int64{}
	var kandidatSaya map[string]any
	var hakSaya map[string]any
	if row != nil {
		v, dibuat := statusHak(ctx, h.DB.Pool, row.ID)
		bolehPilih := v && !warga.PINMasihDefault(row)
		alasan := ""
		if warga.PINMasihDefault(row) {
			alasan = "pin_default"
		} else if !v {
			alasan = "belum_verifikasi"
		} else if p != nil && p.PemungutanPada != nil && dibuat != "" && dibuat >= *p.PemungutanPada {
			bolehPilih, alasan = false, "terdaftar_terlambat"
		}
		hakSaya = map[string]any{"terverifikasi": v, "boleh_ikut": bolehPilih, "alasan": alasan}
	}
	if p != nil {
		daftar := [][2]any{{"kades", 0}}
		j := q.Get("jabatan")
		if LabelJabatanSah[j] {
			wil := 0
			if j != "kades" {
				if v, err := strconv.Atoi(strings.TrimSpace(q.Get("wilayah"))); err == nil {
					wil = v
				}
			}
			daftar = [][2]any{{j, wil}}
		} else if row != nil {
			for _, jb := range db.UrutanJabatan[1:] { // walikota .. rt di wilayah rumah sendiri
				daftar = append(daftar, [2]any{jb, db.WilayahJabatan(jb, row.Blok)})
			}
		}
		for _, d := range daftar {
			b, err := BalapanData(ctx, h.DB.Pool, p, d[0].(string), d[1].(int))
			if err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			balapan = append(balapan, b)
		}
		if row != nil {
			rows, err := h.DB.Pool.Query(ctx,
				"SELECT jabatan, kandidat_id FROM suara WHERE pemilu_id=$1 AND pemilih_id=$2",
				p.ID, row.ID)
			if err == nil {
				for rows.Next() {
					var jab string
					var kid int64
					if err := rows.Scan(&jab, &kid); err == nil {
						suaraSaya[jab] = kid
					}
				}
				rows.Close()
			}
			var kj string
			var kw int
			err = h.DB.Pool.QueryRow(ctx,
				"SELECT jabatan, wilayah FROM kandidat WHERE pemilu_id=$1 AND warga_id=$2",
				p.ID, row.ID).Scan(&kj, &kw)
			if err == nil {
				kandidatSaya = map[string]any{"jabatan": kj, "wilayah": kw}
			}
		}
	}
	var pemiluView any
	if p != nil {
		pemiluView = map[string]any{
			"id": p.ID, "status": p.Status,
			"dibuka_pada": p.DibukaPada, "ditutup_pada": p.DitutupPada,
			"pemungutan_pada": p.PemungutanPada,
		}
	}
	tulisJSON(w, 200, map[string]any{
		"pemilu":        pemiluView,
		"min_warga":     gerbang.MinWarga,
		"jumlah_warga":  gerbang.JumlahWarga,
		"terkunci":      gerbang.Terkunci,
		"pejabat":       pejabat,
		"wilayah_saya":  wilayahSaya,
		"balapan":       balapan,
		"suara_saya":    suaraSaya,
		"kandidat_saya": kandidatSaya,
		"hak_saya":      hakSaya,
	})
}

// Calon menangani POST /api/pemilu/calon.
func (h *Handler) Calon(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	row := warga.DariHeader(ctx, h.DB.Pool, r)
	if row == nil {
		galat(w, 401, "Masuk dulu untuk mencalonkan diri")
		return
	}
	if warga.PINMasihDefault(row) {
		galat(w, 403, "Ganti dulu PIN default 123456 lewat Lengkapi Profil sebelum ikut pemilu — supaya akunmu tidak bisa dipakai orang lain")
		return
	}
	if v, _ := statusHak(ctx, h.DB.Pool, row.ID); !v {
		galat(w, 403, PesanBelumVerifikasi)
		return
	}
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	jabatan := strAmbil(data, "jabatan")
	visi := strings.TrimSpace(strAmbil(data, "visi"))
	misi := strings.TrimSpace(strAmbil(data, "misi"))
	if !LabelJabatanSah[jabatan] {
		galat(w, 400, "Jabatan tidak dikenal (rt/rw/lurah/camat/walikota/kades)")
		return
	}
	if visi == "" || utf8.RuneCountInString(visi) > VisiMaks {
		galat(w, 400, fmt.Sprintf("Visi wajib diisi, maksimal %d karakter", VisiMaks))
		return
	}
	if misi == "" || utf8.RuneCountInString(misi) > MisiMaks {
		galat(w, 400, fmt.Sprintf("Misi wajib diisi, maksimal %d karakter", MisiMaks))
		return
	}
	// Wilayah SELALU dihitung server dari blok rumah kandidat sendiri.
	wilayah := db.WilayahJabatan(jabatan, row.Blok)
	p, _ := Terbaru(ctx, h.DB.Pool)
	if p == nil || p.Status != "pencalonan" {
		galat(w, 409, "Pencalonan sedang tidak dibuka")
		return
	}
	var ada int64
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT id FROM kandidat WHERE pemilu_id=$1 AND warga_id=$2",
		p.ID, row.ID).Scan(&ada)
	if err == nil {
		galat(w, 409, "Kamu sudah mencalonkan diri di periode ini (1 warga hanya boleh 1 jabatan)")
		return
	}
	var kandidatID int64
	err = h.DB.Pool.QueryRow(ctx,
		`INSERT INTO kandidat(pemilu_id, warga_id, jabatan, wilayah, visi, misi)
		 VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
		p.ID, row.ID, jabatan, wilayah, visi, misi).Scan(&kandidatID)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	tulisJSON(w, 201, map[string]any{
		"ok": true, "kandidat_id": kandidatID,
		"jabatan": jabatan, "wilayah": wilayah,
		"label": db.LabelJabatan(jabatan, wilayah),
	})
}

// Pilih menangani POST /api/pemilu/pilih.
func (h *Handler) Pilih(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	row := warga.DariHeader(ctx, h.DB.Pool, r)
	if row == nil {
		galat(w, 401, "Masuk dulu untuk memilih")
		return
	}
	if warga.PINMasihDefault(row) {
		galat(w, 403, "Ganti dulu PIN default 123456 lewat Lengkapi Profil sebelum ikut pemilu — supaya akunmu tidak bisa dipakai orang lain")
		return
	}
	data := bacaJSON(r)
	if data == nil {
		galat(w, 400, "Data tidak valid")
		return
	}
	mentah, ok := data["kandidat_id"].(float64)
	if !ok || mentah != float64(int64(mentah)) {
		// Python: int(data.get("kandidat_id")) menerima int & string angka.
		s := strAmbil(data, "kandidat_id")
		v, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
		if s == "" || err != nil {
			galat(w, 400, "kandidat_id tidak valid")
			return
		}
		mentah = float64(v)
	}
	kandidatID := int64(mentah)
	hak := map[string]int{}
	for _, jb := range db.UrutanJabatan {
		hak[jb] = db.WilayahJabatan(jb, row.Blok)
	}
	p, _ := Terbaru(ctx, h.DB.Pool)
	if p == nil || p.Status != "pemungutan" {
		galat(w, 409, "Pemungutan suara sedang tidak berlangsung")
		return
	}
	if v, dibuat := statusHak(ctx, h.DB.Pool, row.ID); !v {
		galat(w, 403, PesanBelumVerifikasi)
		return
	} else if p.PemungutanPada != nil && dibuat != "" && dibuat >= *p.PemungutanPada {
		// format kedua waktu sama ('YYYY-MM-DD HH24:MI:SS' UTC) -> bisa dibandingkan sebagai teks
		galat(w, 403, "Hak pilih periode ini hanya untuk warga yang terdaftar sebelum pemungutan suara dibuka")
		return
	}
	var kJabatan string
	var kWilayah int
	err := h.DB.Pool.QueryRow(ctx,
		"SELECT jabatan, wilayah FROM kandidat WHERE id=$1 AND pemilu_id=$2",
		kandidatID, p.ID).Scan(&kJabatan, &kWilayah)
	if err != nil {
		galat(w, 404, "Kandidat tidak ditemukan di periode ini")
		return
	}
	// Hak pilih divalidasi dari alamat rumah PEMILIH (bukan klaim klien).
	if kWilayah != hak[kJabatan] {
		galat(w, 403, "Kandidat itu bukan untuk wilayahmu — kamu hanya bisa memilih di wilayah rumahmu sendiri")
		return
	}
	var sudah int64
	err = h.DB.Pool.QueryRow(ctx,
		`SELECT id FROM suara WHERE pemilu_id=$1 AND pemilih_id=$2
		 AND jabatan=$3 AND wilayah=$4`,
		p.ID, row.ID, kJabatan, kWilayah).Scan(&sudah)
	if err == nil {
		galat(w, 409, "Kamu sudah memilih untuk jabatan ini")
		return
	}
	tag, err := h.DB.Pool.Exec(ctx,
		`INSERT INTO suara(pemilu_id, pemilih_id, jabatan, wilayah, kandidat_id)
		 VALUES($1,$2,$3,$4,$5)
		 ON CONFLICT (pemilu_id, pemilih_id, jabatan, wilayah) DO NOTHING`,
		p.ID, row.ID, kJabatan, kWilayah, kandidatID)
	if err != nil {
		galat(w, 500, "Kesalahan server")
		return
	}
	if tag.RowsAffected() == 0 {
		galat(w, 409, "Kamu sudah memilih untuk jabatan ini")
		return
	}
	tulisJSON(w, 200, map[string]any{"ok": true, "kandidat_id": kandidatID})
}

// Admin menangani POST /api/admin/pemilu/{buka,fase,tutup}.
func (h *Handler) Admin(aksi string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !h.adminSah(r) {
			galat(w, 403, "Token admin tidak sah")
			return
		}
		ctx := r.Context()
		p, _ := Terbaru(ctx, h.DB.Pool)
		switch aksi {
		case "buka":
			g, err := StatusGerbang(ctx, h.DB.Pool, h.MinWarga)
			if err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			if g.Terkunci {
				galat(w, 403, fmt.Sprintf(
					"Pemilu masih terkunci: baru %d dari %d warga terdaftar. "+
						"Pemilu pertama dibuka setelah %d warga.",
					g.JumlahWarga, g.MinWarga, g.MinWarga))
				return
			}
			if p != nil && p.Status != "selesai" {
				galat(w, 409, "Masih ada periode pemilu yang belum selesai")
				return
			}
			var id int64
			err = h.DB.Pool.QueryRow(ctx,
				"INSERT INTO pemilu(status) VALUES('pencalonan') RETURNING id").Scan(&id)
			if err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			tulisJSON(w, 201, map[string]any{"ok": true, "pemilu_id": id, "status": "pencalonan"})
			return
		}
		if p == nil {
			galat(w, 404, "Belum ada periode pemilu")
			return
		}
		switch aksi {
		case "fase":
			data := bacaJSON(r)
			fase := ""
			if data != nil {
				fase = strAmbil(data, "fase")
			}
			if fase != "pemungutan" || p.Status != "pencalonan" {
				galat(w, 400, "Perpindahan fase tidak sah (hanya pencalonan -> pemungutan; tutup lewat /tutup)")
				return
			}
			if _, err := h.DB.Pool.Exec(ctx,
				"UPDATE pemilu SET status='pemungutan', pemungutan_pada=to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') WHERE id=$1", p.ID); err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			tulisJSON(w, 200, map[string]any{"ok": true, "pemilu_id": p.ID, "status": "pemungutan"})
		case "tutup":
			if p.Status != "pemungutan" {
				galat(w, 400, "Pemilu hanya bisa ditutup dari fase pemungutan")
				return
			}
			tx, err := h.DB.Pool.Begin(ctx)
			if err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			defer tx.Rollback(ctx)
			pemenang, err := TetapkanPemenang(ctx, tx, p)
			if err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			sekarang := db.SekarangLokalStr()
			if _, err := tx.Exec(ctx,
				"UPDATE pemilu SET status='selesai', ditutup_pada=$1 WHERE id=$2",
				sekarang, p.ID); err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			if err := tx.Commit(ctx); err != nil {
				galat(w, 500, "Kesalahan server")
				return
			}
			daftar := []map[string]any{}
			for _, pm := range pemenang {
				daftar = append(daftar, map[string]any{
					"jabatan": pm[1], "wilayah": pm[2],
					"label": db.LabelJabatan(pm[1].(string), pm[2].(int)),
				})
			}
			tulisJSON(w, 200, map[string]any{
				"ok": true, "pemilu_id": p.ID, "status": "selesai",
				"pemenang": daftar,
			})
		default:
			galat(w, 404, "Aksi admin tidak dikenal")
		}
	}
}
