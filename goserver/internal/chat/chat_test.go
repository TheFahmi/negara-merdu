package chat

import (
	"strings"
	"testing"

	"pinarak/internal/db"
)

func wargaUji() *db.Warga {
	return &db.Warga{Username: "budi", NomorRumah: 126, Blok: 6, Kavling: 1}
}

func TestSambutanKepalaSendiri(t *testing.T) {
	teks := TeksSambutan(wargaUji(), "budi")
	if !strings.Contains(teks, "Selamat datang @budi, warga ke-126 Negara Merdu.") {
		t.Errorf("pembuka salah: %s", teks)
	}
	if !strings.Contains(teks, "Rumahmu No. 126, Blok 6 Kavling 1, RT 002/RW 01.") {
		t.Errorf("alamat salah: %s", teks)
	}
	if !strings.Contains(teks, "Kamu sendiri Kepala Keluarganya.") {
		t.Errorf("klausa kepala salah: %s", teks)
	}
	if !strings.HasSuffix(teks, "Silakan masuk, pintu desa selalu terbuka.") {
		t.Errorf("penutup salah: %s", teks)
	}
}

func TestSambutanDipimpin(t *testing.T) {
	teks := TeksSambutan(wargaUji(), "siti")
	if !strings.Contains(teks, "Keluargamu dipimpin @siti.") {
		t.Errorf("klausa dipimpin salah: %s", teks)
	}
}

func TestSambutanTanpaKeluarga(t *testing.T) {
	// Kepala "" (keluarga tak ditemukan) -> tanpa klausa keluarga sama
	// sekali, langsung penutup.
	teks := TeksSambutan(wargaUji(), "")
	if strings.Contains(teks, "Keluarga") {
		t.Errorf("kepala kosong tidak boleh memuat klausa keluarga: %s", teks)
	}
	if !strings.Contains(teks, "RT 002/RW 01. Silakan masuk, pintu desa selalu terbuka.") {
		t.Errorf("penutup langsung sesudah alamat: %s", teks)
	}
}
