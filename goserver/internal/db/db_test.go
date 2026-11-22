package db

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"golang.org/x/crypto/pbkdf2"
)

func TestWilayahDariBlok(t *testing.T) {
	kasus := []struct {
		blok   int
		rt, rw int
	}{
		{1, 1, 1},       // baris 0 kolom 0
		{6, 2, 1},       // kolom 5 -> RT baris yang sama +1
		{81, 1, 1},      // baris blok 1 masih RT baris 0 (RT = grup 5x5 blok)
		{101, 5, 2},     // baris 1 kolom 20 -> RW 2
		{401, 17, 1},    // baris 5 kolom 0
		{4000, 160, 20}, // blok terakhir
	}
	for _, k := range kasus {
		rt, rw := WilayahDariBlok(k.blok)
		if rt != k.rt || rw != k.rw {
			t.Errorf("blok %d: dapat RT%d/RW%d, mau RT%d/RW%d", k.blok, rt, rw, k.rt, k.rw)
		}
	}
}

func TestAlokasi(t *testing.T) {
	// Aturan "1 blok beda nomor rumah" + kavling BERURUTAN (keputusan
	// Fahmi 21 Nov 2026): Blok 1880 (peringkat 1 menurut UrutanBlok)
	// diisi penuh dulu dengan kavling 1, 2, 3, … 25 tanpa lubang, baru
	// pindah ke blok peringkat 2 (1881) dari kavling 1 lagi.
	kasus := []struct {
		nomor     int
		blok, kav int
	}{
		{1, 1880, 1}, {2, 1880, 2}, {3, 1880, 3}, {14, 1880, 14},
		{18, 1880, 18},
		// Kavling terakhir Blok 1880, lalu blok peringkat 2 mulai terisi.
		{25, 1880, 25}, {26, 1881, 1}, {27, 1881, 2}, {50, 1881, 25},
		// Slot perumahan terakhir = blok perumahan terakhir (4000),
		// kavling terakhir. (Zona perumahan kini 3.930 blok = 98.250
		// slot, sesudah 2 blok tepi cluster jadi lahan fasilitas.)
		{98250, 4000, 25},
	}
	for _, k := range kasus {
		b, kv := Alokasi(k.nomor)
		if b != k.blok || kv != k.kav {
			t.Errorf("nomor %d: dapat blok %d kav %d, mau blok %d kav %d",
				k.nomor, b, kv, k.blok, k.kav)
		}
	}
	// 25 pendaftar pertama memenuhi TEPAT Blok 1880 secara berurutan:
	// warga ke-n -> Kavling n, tanpa sisa & tanpa ganda.
	u := UrutanBlok()
	kavTerisi := map[int]bool{}
	for n := 1; n <= 25; n++ {
		b, kv := Alokasi(n)
		if b != 1880 || b != u[0] {
			t.Fatalf("nomor %d: blok %d, mau 1880 (peringkat 1)", n, b)
		}
		if kv != n {
			t.Fatalf("nomor %d: kav %d, mau kavling berurutan %d", n, kv, n)
		}
		if kavTerisi[kv] {
			t.Fatalf("kavling %d Blok 1880 dipakai dua kali (nomor %d)", kv, n)
		}
		kavTerisi[kv] = true
	}
	if len(kavTerisi) != PerBlok {
		t.Fatalf("Blok 1880 terisi %d kavling, mau %d", len(kavTerisi), PerBlok)
	}
	// Blok ke-k diisi penuh sebelum blok ke-(k+1) mulai: nomor 26..50
	// semua di blok peringkat 2, 51..75 di peringkat 3, dst.
	for peringkat := 0; peringkat < 10; peringkat++ {
		for n := peringkat*PerBlok + 1; n <= (peringkat+1)*PerBlok; n++ {
			if b, _ := Alokasi(n); b != u[peringkat] {
				t.Fatalf("nomor %d: blok %d, mau blok peringkat %d (%d)",
					n, b, peringkat+1, u[peringkat])
			}
		}
	}
	// Luapan sesudah zona perumahan: blok terlarang pertama di akhir
	// UrutanBlok mulai terisi blok demi blok juga, dari kavling 1.
	if b, kv := Alokasi(98251); b != u[3930] || kv != 1 {
		t.Fatalf("nomor 98251: blok %d kav %d, mau blok luapan pertama %d kav 1",
			b, kv, u[3930])
	}
	// Tidak ada kavling ganda & tidak ada blok terlarang di seluruh zona
	// perumahan (98.250 alokasi pertama); total kapasitas tetap 100.000.
	pasangan := map[[2]int]bool{}
	for n := 1; n <= Kapasitas; n++ {
		b, kv := Alokasi(n)
		if pasangan[[2]int{b, kv}] {
			t.Fatalf("alokasi ganda di nomor %d: blok %d kav %d", n, b, kv)
		}
		pasangan[[2]int{b, kv}] = true
		if n <= 3930*PerBlok && BlokTerlarang(b) {
			t.Fatalf("nomor %d mendarat di blok terlarang %d", n, b)
		}
	}
}

func TestBlokTerlarang(t *testing.T) {
	// RESERVASI (kol 38..41, bar 24..25): blok 1959..1962 & 2039..2042.
	for _, b := range []int{1959, 1960, 1961, 1962, 2039, 2040, 2041, 2042} {
		if !BlokTerlarang(b) {
			t.Errorf("blok reservasi %d harus terlarang", b)
		}
	}
	// TAMAN/lahan pembangunan: 325 (kol 4, bar 4) + ke-8 blok fasilitas.
	for _, b := range []int{325, 1637, 2901, 973, 1029, 1653, 2941, 2269, 2285} {
		if !BlokTerlarang(b) {
			t.Errorf("blok lahan %d harus terlarang", b)
		}
	}
	// Blok fasilitas tepi cluster warga (Fahmi 2026-11-22): 1879 Taman
	// (barat Blok 1880) & 1882 Toko Pancing (timur Blok 1881).
	for _, b := range []int{1879, 1882} {
		if !BlokTerlarang(b) {
			t.Errorf("blok fasilitas tepi cluster %d harus terlarang", b)
		}
	}
	// Perumahan biasa tidak terlarang.
	for _, b := range []int{1, 1880, 1881, 2120, 4000} {
		if BlokTerlarang(b) {
			t.Errorf("blok perumahan %d tidak boleh terlarang", b)
		}
	}
	// Total terlarang tepat 70 (8 reservasi + 60 lahan + 2 blok fasilitas
	// tepi cluster) -> 3.930 blok perumahan, sama dengan hitungan klien.
	n := 0
	for b := 1; b <= BlokKolom*BlokBaris; b++ {
		if BlokTerlarang(b) {
			n++
		}
	}
	if n != 70 {
		t.Errorf("total blok terlarang %d, mau 70", n)
	}
}

func TestUrutanBlok(t *testing.T) {
	u := UrutanBlok()
	if len(u) != 4000 {
		t.Fatalf("panjang urutan %d, mau 4000", len(u))
	}
	// Kepala urutan terverifikasi tangan dari rumus jarak pusat blok.
	kepala := []int{1880, 1881, 2120, 2121, 2119, 2122, 1800, 1801, 1958, 1963}
	for i, mau := range kepala {
		if u[i] != mau {
			t.Errorf("urutan[%d] = %d, mau %d", i, u[i], mau)
		}
	}
	// Jarak pusat tidak pernah menurun di zona perumahan.
	jarak := func(blok int) int {
		idx := blok - 1
		bar, kol := idx/BlokKolom, idx%BlokKolom
		dx, dz := 2*kol-(BlokKolom-1), 2*bar-(BlokBaris-1)
		return dx*dx + dz*dz
	}
	for i := 1; i < 3930; i++ {
		if jarak(u[i]) < jarak(u[i-1]) {
			t.Fatalf("jarak menurun di urutan[%d]: blok %d sesudah %d", i, u[i], u[i-1])
		}
	}
	// Semua blok muncul tepat sekali.
	unik := map[int]bool{}
	for _, b := range u {
		if unik[b] {
			t.Fatalf("blok %d muncul dua kali", b)
		}
		unik[b] = true
	}
}

func TestLabelJabatan(t *testing.T) {
	if l := LabelJabatan("kades", 0); l == nil || *l != "Presiden" {
		t.Errorf("kades: %v", l)
	}
	if l := LabelJabatan("rt", 7); l == nil || *l != "Ketua RT 007" {
		t.Errorf("rt: %v", l)
	}
	if l := LabelJabatan("rw", 12); l == nil || *l != "Ketua RW 12" {
		t.Errorf("rw: %v", l)
	}
	if l := LabelJabatan("aneh", 1); l != nil {
		t.Errorf("jabatan tak dikenal harus nil: %v", *l)
	}
}

func TestNIKdanKK(t *testing.T) {
	nik := BuatNIK("2026-11-20 10:00:00", 1)
	if nik != "3201261120000001" {
		t.Errorf("NIK: %s", nik)
	}
	kk := BuatNoKK("2026-11-20 10:00:00", 42)
	if kk != "3201261120000042" {
		t.Errorf("No KK: %s", kk)
	}
}

func TestPersenSuara(t *testing.T) {
	kasus := []struct {
		suara, total int
		mau          float64
	}{
		{0, 0, 0.0}, {1, 2, 50.0}, {4, 6, 66.7}, {2, 6, 33.3},
		{1, 8, 12.5}, {3, 8, 37.5}, {5, 5, 100.0},
		// Python round() = half-even: 12.25 -> 12.2, 12.35 -> 12.4 (per digit)
		{49, 400, 12.2},
	}
	for _, k := range kasus {
		if got := PersenSuara(k.suara, k.total); got != k.mau {
			t.Errorf("PersenSuara(%d,%d) = %v, mau %v", k.suara, k.total, got, k.mau)
		}
	}
}

func TestPINHashKompatibel(t *testing.T) {
	salt := TokenAcak(16)
	hash := HashPIN("123456", salt)
	if len(salt) != 32 || len(hash) != 64 {
		t.Fatalf("format salt/hash: %d/%d", len(salt), len(hash))
	}
	w := &Warga{Salt: salt, PinHash: hash}
	if !PINBenar("123456", w) {
		t.Error("PIN benar ditolak")
	}
	if PINBenar("654321", w) {
		t.Error("PIN salah diterima")
	}
	// Vektor tetap PBKDF2-HMAC-SHA256 120rb iterasi (kompatibel Python
	// hashlib.pbkdf2_hmac): salt heks "00"*16, pin "123456" — hash dihitung
	// langsung dari x/crypto/pbkdf2, diverifikasi lewat PINBenar.
	salt2 := "00000000000000000000000000000000"
	saltMentah, _ := hex.DecodeString(salt2)
	hash2 := hex.EncodeToString(pbkdf2.Key([]byte("123456"), saltMentah, 120_000, 32, sha256.New))
	w2 := &Warga{Salt: salt2, PinHash: hash2}
	if !PINBenar("123456", w2) {
		t.Error("vektor tetap gagal diverifikasi")
	}
}
