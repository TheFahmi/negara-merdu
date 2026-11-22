// Paket db: pool PostgreSQL bersama + konstanta dunia + tipe baris warga +
// fungsi murni (alokasi kavling, wilayah RT/RW, NIK/KK, hash PIN) yang
// dipakai lintas folder fitur. Tidak ada HTTP di sini.
package db

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/pbkdf2"
)

// Konstanta dunia — sama persis dengan server.py referensi.
const (
	Kapasitas = 100_000
	PerBlok   = 25
	BlokKolom = 80
	BlokBaris = 50

	PitchSatuan = 84
	KotaW       = BlokKolom * PitchSatuan // 6.720
	KotaD       = BlokBaris * PitchSatuan // 4.200
	BatasX      = KotaW/2 + 500           // 3.860
	BatasZ      = KotaD/2 + 500           // 2.600

	KodeDesaNIK = "3201"

	// Kunci advisory transaksi PostgreSQL untuk titik race alokasi nomor
	// rumah (sama dengan KUNCI_ALOKASI di server.py).
	KunciAlokasi = 20261120
)

// Querier: permukaan query yang dipenuhi *pgxpool.Pool maupun pgx.Tx,
// supaya fungsi fitur bisa jalan di dalam / di luar transaksi.
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Store membungkus pool koneksi.
type Store struct {
	Pool *pgxpool.Pool
}

// BukaPool membuat pool dari DATABASE_URL.
func BukaPool(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &Store{Pool: pool}, nil
}

// Warga: satu baris tabel warga (kolom sesuai skema server.py).
type Warga struct {
	ID         int64
	Username   string
	PinHash    string
	Salt       string
	WarnaBaju  string
	WarnaKulit string
	Topi       string
	NomorRumah int
	Blok       int
	Kavling    int
	NIK        *string
	KeluargaID *int64
	Peran      *string
	Gender     *string // 'L'/'P'; nil = belum diisi
	CreatedAt  string
}

const kolomWarga = "id, username, pin_hash, salt, warna_baju, warna_kulit, " +
	"topi, nomor_rumah, blok, kavling, nik, keluarga_id, peran, created_at, gender"

// ScanWarga membaca satu baris dengan urutan kolomWarga.
func ScanWarga(row pgx.Row) (*Warga, error) {
	w := &Warga{}
	var created *string
	err := row.Scan(&w.ID, &w.Username, &w.PinHash, &w.Salt, &w.WarnaBaju,
		&w.WarnaKulit, &w.Topi, &w.NomorRumah, &w.Blok, &w.Kavling,
		&w.NIK, &w.KeluargaID, &w.Peran, &created, &w.Gender)
	if err != nil {
		return nil, err
	}
	if created != nil {
		w.CreatedAt = *created
	}
	return w, nil
}

// WargaByID mengambil warga berdasarkan id (nil, nil bila tidak ada).
func WargaByID(ctx context.Context, q Querier, id int64) (*Warga, error) {
	w, err := ScanWarga(q.QueryRow(ctx, "SELECT "+kolomWarga+" FROM warga WHERE id=$1", id))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return w, err
}

// WargaByUsername mengambil warga berdasarkan username (nil, nil bila tidak ada).
func WargaByUsername(ctx context.Context, q Querier, username string) (*Warga, error) {
	w, err := ScanWarga(q.QueryRow(ctx, "SELECT "+kolomWarga+" FROM warga WHERE username=$1", username))
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return w, err
}

// JumlahWarga: total warga terdaftar.
func JumlahWarga(ctx context.Context, q Querier) (int, error) {
	var n int
	err := q.QueryRow(ctx, "SELECT COUNT(*) FROM warga").Scan(&n)
	return n, err
}

// BlokTerlarang: blok yang BUKAN perumahan — himpunan yang sama dengan
// RESERVASI + TAMAN di public/app.js (klien tidak membangun rumah massal
// di blok ini). RESERVASI = plaza + balai + distrik detail di pusat:
// kolom 38..41, baris 24..25 (0-based). TAMAN = lahan pembangunan berkala
// (termasuk 8 blok FASILITAS_BLOK): kolom ≡ 4 (mod 8), baris ≡ 4 (mod 8).
// DITAMBAH 2 blok fasilitas tepi cluster warga (perintah Fahmi
// 2026-11-22, fasilitas dipindah dekat keramaian): Blok 1879 (kol 38,
// bar 23 — Taman, di barat Blok 1880) dan Blok 1882 (kol 41, bar 23 —
// Toko Pancing, di timur Blok 1881); keduanya juga masuk set TAMAN klien.
func BlokTerlarang(blok int) bool {
	if blok == 1879 || blok == 1882 {
		return true
	}
	idx := blok - 1
	bar, kol := idx/BlokKolom, idx%BlokKolom
	if kol >= 38 && kol <= 41 && bar >= 24 && bar <= 25 {
		return true
	}
	return kol%8 == 4 && bar%8 == 4
}

// urutanBlok: urutan pengisian blok untuk warga baru — desa tumbuh dari
// tengah. Blok perumahan diurutkan menurut jarak kuadrat pusat blok ke
// plaza (0,0), tie-break nomor blok menaik. Blok terlarang (70 blok)
// ditambahkan di akhir menurut nomor menaik sebagai cadangan luapan,
// supaya kapasitas total tetap tepat 100.000 kavling.
var urutanBlok = bangunUrutanBlok()

func bangunUrutanBlok() []int {
	type entri struct{ blok, d2 int }
	perumahan := make([]entri, 0, 3930)
	cadangan := make([]int, 0, 70)
	for blok := 1; blok <= BlokKolom*BlokBaris; blok++ {
		idx := blok - 1
		bar, kol := idx/BlokKolom, idx%BlokKolom
		// Pusat blok relatif ke plaza, diskalakan 2x supaya bilangan bulat:
		// pusat = ((kol - 39,5) * Pitch, (bar - 24,5) * Pitch).
		dx := 2*kol - (BlokKolom - 1)
		dz := 2*bar - (BlokBaris - 1)
		if BlokTerlarang(blok) {
			cadangan = append(cadangan, blok)
		} else {
			perumahan = append(perumahan, entri{blok, dx*dx + dz*dz})
		}
	}
	sort.Slice(perumahan, func(i, j int) bool {
		if perumahan[i].d2 != perumahan[j].d2 {
			return perumahan[i].d2 < perumahan[j].d2
		}
		return perumahan[i].blok < perumahan[j].blok
	})
	urutan := make([]int, 0, BlokKolom*BlokBaris)
	for _, e := range perumahan {
		urutan = append(urutan, e.blok)
	}
	return append(urutan, cadangan...)
}

// UrutanBlok: salinan urutan pengisian blok (indeks 0 = blok pertama yang
// diisi). Diekspor untuk pengujian & peralatan migrasi.
func UrutanBlok() []int {
	hasil := make([]int, len(urutanBlok))
	copy(hasil, urutanBlok)
	return hasil
}

// Alokasi: nomor urut warga (1-based) -> (blok 1-based, kavling 1-based).
// Aturan "1 blok beda nomor rumah" (keputusan Fahmi 21 Nov 2026): blok
// peringkat 1 menurut UrutanBlok (Blok 1880, terdekat plaza) diisi penuh
// dulu, lalu blok peringkat 2, dst — warga terkumpul di satu blok yang
// tumbuh dari tengah. Di dalam blok, kavling diisi BERURUTAN TANPA
// LUBANG 1, 2, 3, … 25 (keputusan Fahmi 21 Nov 2026 malam, menggantikan
// permutasi acak deterministik Fisher-Yates yang dipakai sebelumnya).
// Sesudah seluruh blok perumahan habis (3.932 x 25 = 98.300), blok
// terlarang di akhir UrutanBlok diisi blok demi blok sebagai cadangan
// luapan — rumus yang sama berlaku seragam untuk semua nomor, jadi
// kapasitas total tetap tepat 100.000. Nomor rumah sendiri tidak
// berubah makna — tetap nomor urut pendaftaran global (NIK
// menyandinya, jadi NIK warga lama tidak berubah).
func Alokasi(nomor int) (blok, kavling int) {
	idx := nomor - 1
	blok = urutanBlok[idx/PerBlok]
	kavling = idx%PerBlok + 1
	return blok, kavling
}

// WilayahDariBlok: nomor blok (1-based) -> (nomor RT, nomor RW).
// RT = kelompok blok 5 kolom x 5 baris -> 160 RT; RW = kelompok 4 kolom-RT
// x 2 baris-RT -> 20 RW. Sama persis dengan wilayah_dari_blok di server.py.
func WilayahDariBlok(blok int) (rt, rw int) {
	idx := blok - 1
	baris, kolom := idx/BlokKolom, idx%BlokKolom
	rtKol, rtBar := kolom/5, baris/5
	rt = rtBar*16 + rtKol + 1
	rw = (rtBar/2)*4 + (rtKol / 4) + 1
	return rt, rw
}

// LabelJabatan: label tampil jabatan aktif ("Presiden", "Ketua RW 07",
// "Ketua RT 042"); nil untuk jabatan tak dikenal.
func LabelJabatan(jabatan string, wilayah int) *string {
	var s string
	switch jabatan {
	case "kades":
		s = "Presiden"
	case "rw":
		s = fmt.Sprintf("Ketua RW %02d", wilayah)
	case "rt":
		s = fmt.Sprintf("Ketua RT %03d", wilayah)
	default:
		return nil
	}
	return &s
}

// LabelJabatanWarga: label jabatan aktif satu warga (nil bila tidak menjabat).
func LabelJabatanWarga(ctx context.Context, q Querier, wargaID int64) (*string, error) {
	var jabatan string
	var wilayah int
	err := q.QueryRow(ctx, "SELECT jabatan, wilayah FROM jabatan WHERE warga_id=$1", wargaID).Scan(&jabatan, &wilayah)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return LabelJabatan(jabatan, wilayah), nil
}

// PetaJabatan: {warga_id: label jabatan aktif} untuk semua pejabat —
// dipakai jalur daftar (pagination) supaya tidak query per baris.
func PetaJabatan(ctx context.Context, q Querier) (map[int64]*string, error) {
	rows, err := q.Query(ctx, "SELECT warga_id, jabatan, wilayah FROM jabatan")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	peta := make(map[int64]*string)
	for rows.Next() {
		var id int64
		var jabatan string
		var wilayah int
		if err := rows.Scan(&id, &jabatan, &wilayah); err != nil {
			return nil, err
		}
		peta[id] = LabelJabatan(jabatan, wilayah)
	}
	return peta, rows.Err()
}

// HashPIN: PBKDF2-HMAC-SHA256, 120.000 iterasi, salt hex — skema
// penyimpanan identik dengan server.py (hash & salt keduanya hex).
func HashPIN(pin, saltHex string) string {
	salt, err := hex.DecodeString(saltHex)
	if err != nil {
		return ""
	}
	dk := pbkdf2.Key([]byte(pin), salt, 120_000, 32, sha256.New)
	return hex.EncodeToString(dk)
}

// PINBenar membandingkan PIN terhadap hash tersimpan (konstan-waktu).
func PINBenar(pin string, w *Warga) bool {
	h := HashPIN(pin, w.Salt)
	return subtle.ConstantTimeCompare([]byte(h), []byte(w.PinHash)) == 1
}

// TokenAcak: n byte acak kriptografis dalam hex (setara secrets.token_hex).
func TokenAcak(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// PilihAcak: indeks acak seragam [0, n) dari crypto/rand — setara
// random.SystemRandom().choice di server.py.
func PilihAcak(n int) int {
	if n <= 0 {
		return 0
	}
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	v := uint64(b[0]) | uint64(b[1])<<8 | uint64(b[2])<<16 | uint64(b[3])<<24 |
		uint64(b[4])<<32 | uint64(b[5])<<40 | uint64(b[6])<<48 | uint64(b[7])<<56
	return int(v % uint64(n))
}

// tanggalDari: parse 10 karakter pertama "YYYY-MM-DD"; gagal -> waktu UTC kini
// (meniru fallback datetime.utcnow() di buat_nik/buat_no_kk server.py).
func tanggalDari(createdAt string) time.Time {
	if len(createdAt) >= 10 {
		if t, err := time.Parse("2006-01-02", createdAt[:10]); err == nil {
			return t
		}
	}
	return time.Now().UTC()
}

// BuatNIK: 16 digit = 3201 + YYMMDD tanggal daftar + nomor rumah 6 digit.
func BuatNIK(createdAt string, nomorRumah int) string {
	t := tanggalDari(createdAt)
	return KodeDesaNIK + t.Format("060102") + fmt.Sprintf("%06d", nomorRumah)
}

// BuatNoKK: skema sama seperti NIK, komponen terakhir = id keluarga.
func BuatNoKK(createdAt string, keluargaID int64) string {
	t := tanggalDari(createdAt)
	return KodeDesaNIK + t.Format("060102") + fmt.Sprintf("%06d", keluargaID)
}

// SekarangLokalStr: waktu lokal server format "YYYY-MM-DD HH:MM:SS"
// (meniru datetime.now().strftime di server.py untuk chat/tutup pemilu/dll).
func SekarangLokalStr() string {
	return time.Now().Format("2006-01-02 15:04:05")
}

// PersenSuara: persen dengan pembulatan setengah-ke-genap (round() Python)
// ke 1 desimal.
func PersenSuara(suara, total int) float64 {
	if total == 0 {
		return 0
	}
	v := 100.0 * float64(suara) / float64(total)
	return math.RoundToEven(v*10) / 10
}
