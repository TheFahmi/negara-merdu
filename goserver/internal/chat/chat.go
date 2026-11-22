// Paket chat: persistensi chat Istana Negara + sambutan Pak Presiden untuk
// warga baru. Siaran WebSocket dilakukan pemanggil lewat interface
// Penyiar (diimplementasikan hub ws) supaya paket ini tidak tahu protokol.
package chat

import (
	"context"
	"fmt"
	"time"

	"pinarak/internal/db"
)

// Riwayat: jumlah pesan terakhir yang dimuat ke klien baru.
const Riwayat = 50

// PengirimSistem: nama pengirim pesan sistem (sambutan Pak Presiden).
const PengirimSistem = "Pak Presiden"

// Penyiar menyiarkan satu pesan objek ke semua klien WebSocket.
type Penyiar interface {
	Siar(obj any)
}

// Pesan: satu pesan chat sebagaimana dikirim ke klien.
type Pesan struct {
	U      string `json:"u"`
	Isi    string `json:"isi"`
	Jam    string `json:"jam"`
	Sistem bool   `json:"sistem"`
}

// Simpan menyimpan pesan; mengembalikan jam lokal "HH:MM" untuk tampil.
// sistem=true menandai pesan dari desa (sambutan Pak Presiden), bukan warga.
func Simpan(ctx context.Context, q db.Querier, wargaID int64, username, isi string, sistem bool) (string, error) {
	sekarang := time.Now()
	sis := 0
	if sistem {
		sis = 1
	}
	_, err := q.Exec(ctx,
		"INSERT INTO chat(warga_id, username, isi, created_at, sistem) VALUES($1,$2,$3,$4,$5)",
		wargaID, username, isi, sekarang.Format("2006-01-02 15:04:05"), sis)
	if err != nil {
		return "", err
	}
	return sekarang.Format("15:04"), nil
}

// Terakhir: Riwayat pesan terakhir, urut lama -> baru.
func Terakhir(ctx context.Context, q db.Querier) ([]Pesan, error) {
	rows, err := q.Query(ctx,
		"SELECT username, isi, created_at, sistem FROM chat ORDER BY id DESC LIMIT $1",
		Riwayat)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var balik []Pesan
	for rows.Next() {
		var u, isi, created string
		var sis int
		if err := rows.Scan(&u, &isi, &created, &sis); err != nil {
			return nil, err
		}
		jam := ""
		if len(created) >= 16 {
			jam = created[11:16]
		}
		balik = append(balik, Pesan{U: u, Isi: isi, Jam: jam, Sistem: sis != 0})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	hasil := make([]Pesan, 0, len(balik))
	for i := len(balik) - 1; i >= 0; i-- {
		hasil = append(hasil, balik[i])
	}
	return hasil, nil
}

// TeksSambutan menyusun teks sambutan Pak Presiden dari data warga baru:
// urutan warga (= nomor rumah), alamat rumah, RT/RW, dan keluarganya.
// kepala = username kepala keluarganya ("" bila tidak diketahui).
func TeksSambutan(w *db.Warga, kepala string) string {
	rt, rw := db.WilayahDariBlok(w.Blok)
	teks := fmt.Sprintf(
		"Selamat datang @%s, warga ke-%d Negara Merdu. Rumahmu No. %d, "+
			"Blok %d Kavling %d, RT %03d/RW %02d.",
		w.Username, w.NomorRumah, w.NomorRumah, w.Blok, w.Kavling, rt, rw)
	if kepala != "" && kepala != w.Username {
		teks += fmt.Sprintf(" Keluargamu dipimpin @%s.", kepala)
	} else if kepala != "" {
		teks += " Kamu sendiri Kepala Keluarganya."
	}
	teks += " Silakan masuk, pintu desa selalu terbuka."
	return teks
}

// SambutanWargaBaru menyimpan sambutan ke chat + menyiarkannya ke warga
// online; mengembalikan teksnya. Dipanggil SEKALI per pendaftaran berhasil.
func SambutanWargaBaru(ctx context.Context, s *db.Store, penyiar Penyiar, w *db.Warga, kepala string) (string, error) {
	teks := TeksSambutan(w, kepala)
	jam, err := Simpan(ctx, s.Pool, 0, PengirimSistem, teks, true)
	if err != nil {
		return "", err
	}
	if penyiar != nil {
		penyiar.Siar(map[string]any{
			"jenis": "chat", "u": PengirimSistem, "isi": teks,
			"jam": jam, "sistem": true,
		})
	}
	return teks, nil
}
