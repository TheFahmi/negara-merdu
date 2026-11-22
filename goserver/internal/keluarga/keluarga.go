// Paket keluarga: pengelompokan warga ke keluarga secara ACAK (maks 5,
// peran hanya Kepala Keluarga / Anggota) + data Kartu Keluarga.
// Meniru gabung_keluarga & data_keluarga_saya server.py.
package keluarga

import (
	"context"

	"pinarak/internal/db"
)

// Maks: warga per keluarga (Kartu Keluarga).
const Maks = 5

// Label peran tampil.
func Label(peran *string) string {
	if peran != nil && *peran == "kepala" {
		return "Kepala Keluarga"
	}
	return "Anggota"
}

func belumPenuh(ctx context.Context, q db.Querier) ([]int64, error) {
	rows, err := q.Query(ctx,
		`SELECT k.id AS id FROM keluarga k
		 LEFT JOIN warga w ON w.keluarga_id = k.id
		 GROUP BY k.id HAVING COUNT(w.id) < $1 ORDER BY k.id`, Maks)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// PilihAcak: satu keluarga yang belum penuh dipilih secara acak
// (crypto/rand, setara SystemRandom); ok=false bila tidak ada yang muat.
func PilihAcak(ctx context.Context, q db.Querier) (int64, bool, error) {
	calon, err := belumPenuh(ctx, q)
	if err != nil || len(calon) == 0 {
		return 0, false, err
	}
	return calon[db.PilihAcak(len(calon))], true, nil
}

func buatBaru(ctx context.Context, q db.Querier) (int64, error) {
	sekarang := db.SekarangLokalStr()
	var id int64
	err := q.QueryRow(ctx,
		"INSERT INTO keluarga(no_kk, created_at) VALUES('', $1) RETURNING id",
		sekarang).Scan(&id)
	if err != nil {
		return 0, err
	}
	_, err = q.Exec(ctx, "UPDATE keluarga SET no_kk=$1 WHERE id=$2",
		db.BuatNoKK(sekarang, id), id)
	return id, err
}

// Gabung memasukkan warga ke keluarga: dipilih ACAK ke satu keluarga yang
// belum penuh sebagai Anggota; bila tidak ada yang muat, buat keluarga
// baru dan jadikan warga ini Kepala Keluarga-nya. Harus dipanggil dalam
// transaksi yang sama dengan pendaftaran warga.
func Gabung(ctx context.Context, q db.Querier, wargaID int64) error {
	kid, ok, err := PilihAcak(ctx, q)
	if err != nil {
		return err
	}
	peran := "anggota"
	if !ok {
		kid, err = buatBaru(ctx, q)
		if err != nil {
			return err
		}
		peran = "kepala"
	}
	_, err = q.Exec(ctx, "UPDATE warga SET keluarga_id=$1, peran=$2 WHERE id=$3",
		kid, peran, wargaID)
	return err
}

// Anggota: satu baris tabel KK.
type Anggota struct {
	Username   string  `json:"username"`
	NIK        *string `json:"nik"`
	Peran      string  `json:"peran"`
	Terdaftar  string  `json:"terdaftar"`
	NomorRumah int     `json:"nomor_rumah"`
	Blok       int     `json:"blok"`
	Kavling    int     `json:"kavling"`
}

// Data: isi lengkap Kartu Keluarga untuk endpoint /api/keluarga-saya.
type Data struct {
	NoKK   string `json:"no_kk"`
	Kepala string `json:"kepala"`
	Alamat struct {
		Blok       int `json:"blok"`
		Kavling    int `json:"kavling"`
		NomorRumah int `json:"nomor_rumah"`
	} `json:"alamat"`
	Kamu struct {
		Username string `json:"username"`
		Peran    string `json:"peran"`
	} `json:"kamu"`
	Anggota []Anggota `json:"anggota"`
}

func anggotaKeluarga(ctx context.Context, q db.Querier, kid int64) ([]*db.Warga, error) {
	rows, err := q.Query(ctx,
		"SELECT id, username, pin_hash, salt, warna_baju, warna_kulit, topi, "+
			"nomor_rumah, blok, kavling, nik, keluarga_id, peran, created_at, gender "+
			"FROM warga WHERE keluarga_id=$1 ORDER BY nomor_rumah ASC", kid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var hasil []*db.Warga
	for rows.Next() {
		w, err := db.ScanWarga(rows)
		if err != nil {
			return nil, err
		}
		hasil = append(hasil, w)
	}
	return hasil, rows.Err()
}

// kepalaDari: baris kepala keluarga (peran 'kepala'; fallback anggota
// bernomor rumah terkecil) — sama seperti data_keluarga_saya server.py.
func kepalaDari(rows []*db.Warga) *db.Warga {
	for _, r := range rows {
		if r.Peran != nil && *r.Peran == "kepala" {
			return r
		}
	}
	if len(rows) > 0 {
		return rows[0]
	}
	return nil
}

// KepalaUsername: username kepala keluarga si warga ("" bila tak berkeluarga).
func KepalaUsername(ctx context.Context, q db.Querier, w *db.Warga) (string, error) {
	if w.KeluargaID == nil {
		return "", nil
	}
	rows, err := anggotaKeluarga(ctx, q, *w.KeluargaID)
	if err != nil {
		return "", err
	}
	k := kepalaDari(rows)
	if k == nil {
		return "", nil
	}
	return k.Username, nil
}

// DataSaya menyusun data KK untuk keluarga si peminta (nil bila belum
// berkeluarga). NIK anggota hanya dikirim lewat jalur sesi ini.
func DataSaya(ctx context.Context, q db.Querier, w *db.Warga) (*Data, error) {
	if w.KeluargaID == nil {
		return nil, nil
	}
	var noKK string
	err := q.QueryRow(ctx, "SELECT no_kk FROM keluarga WHERE id=$1", *w.KeluargaID).Scan(&noKK)
	if err != nil {
		return nil, nil // keluarga tak ditemukan -> seperti server.py (None)
	}
	rows, err := anggotaKeluarga(ctx, q, *w.KeluargaID)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	kepala := kepalaDari(rows)
	d := &Data{NoKK: noKK, Kepala: kepala.Username}
	d.Alamat.Blok = kepala.Blok
	d.Alamat.Kavling = kepala.Kavling
	d.Alamat.NomorRumah = kepala.NomorRumah
	d.Kamu.Username = w.Username
	d.Kamu.Peran = Label(w.Peran)
	for _, r := range rows {
		terdaftar := r.CreatedAt
		if len(terdaftar) > 10 {
			terdaftar = terdaftar[:10]
		}
		d.Anggota = append(d.Anggota, Anggota{
			Username:   r.Username,
			NIK:        r.NIK,
			Peran:      Label(r.Peran),
			Terdaftar:  terdaftar,
			NomorRumah: r.NomorRumah,
			Blok:       r.Blok,
			Kavling:    r.Kavling,
		})
	}
	// Kepala Keluarga selalu baris pertama (sort stabil; sisanya tetap
	// urut nomor rumah) — sama seperti server.py.
	for i := 1; i < len(d.Anggota); i++ {
		for j := i; j > 0 && d.Anggota[j].Peran == "Kepala Keluarga" &&
			d.Anggota[j-1].Peran != "Kepala Keluarga"; j-- {
			d.Anggota[j], d.Anggota[j-1] = d.Anggota[j-1], d.Anggota[j]
		}
	}
	return d, nil
}

// Ringkasan untuk warga_privat: {no_kk, peran} milik warga itu sendiri.
type Ringkasan struct {
	NoKK  string `json:"no_kk"`
	Peran string `json:"peran"`
}

// RingkasanWarga mengambil ringkasan keluarga satu warga (nil bila tidak ada).
func RingkasanWarga(ctx context.Context, q db.Querier, w *db.Warga) (*Ringkasan, error) {
	if w.KeluargaID == nil {
		return nil, nil
	}
	var noKK string
	err := q.QueryRow(ctx, "SELECT no_kk FROM keluarga WHERE id=$1", *w.KeluargaID).Scan(&noKK)
	if err != nil {
		return nil, nil
	}
	return &Ringkasan{NoKK: noKK, Peran: Label(w.Peran)}, nil
}

// Backfill menggabungkan semua warga lama yang belum berkeluarga (urutan
// nomor rumah; pilihan keluarga tetap acak) lalu memperbaiki peran parsial
// — idempoten, meniru init_db server.py. Dipanggil sekali saat start.
func Backfill(ctx context.Context, s *db.Store) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx,
		"SELECT id FROM warga WHERE keluarga_id IS NULL ORDER BY nomor_rumah ASC")
	if err != nil {
		return err
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, id := range ids {
		if err := Gabung(ctx, tx, id); err != nil {
			return err
		}
	}
	// Perbaikan peran parsial: keluarga tanpa kepala -> anggota bernomor
	// rumah terkecil dipromosikan.
	krows, err := tx.Query(ctx, "SELECT id FROM keluarga")
	if err != nil {
		return err
	}
	var kids []int64
	for krows.Next() {
		var id int64
		if err := krows.Scan(&id); err != nil {
			krows.Close()
			return err
		}
		kids = append(kids, id)
	}
	krows.Close()
	if err := krows.Err(); err != nil {
		return err
	}
	for _, kid := range kids {
		var c int
		if err := tx.QueryRow(ctx,
			"SELECT COUNT(*) FROM warga WHERE keluarga_id=$1 AND peran='kepala'",
			kid).Scan(&c); err != nil {
			return err
		}
		if c == 0 {
			var pertama int64
			err := tx.QueryRow(ctx,
				"SELECT id FROM warga WHERE keluarga_id=$1 ORDER BY nomor_rumah ASC LIMIT 1",
				kid).Scan(&pertama)
			if err == nil {
				if _, err := tx.Exec(ctx, "UPDATE warga SET peran='kepala' WHERE id=$1", pertama); err != nil {
					return err
				}
			}
		}
	}
	if _, err := tx.Exec(ctx,
		"UPDATE warga SET peran='anggota' WHERE keluarga_id IS NOT NULL "+
			"AND (peran IS NULL OR peran NOT IN ('kepala','anggota'))"); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
