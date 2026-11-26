package warga

import (
	"strings"
	"testing"

	"pinarak/internal/db"
)

// Mesin status sesi reset: menunggu -> terverifikasi -> selesai, dengan
// kedaluwarsa malas di kedua jendela (kode 10 menit, PIN 10 menit).
func TestStatusEfektifReset(t *testing.T) {
	dasar := &sesiReset{Dibuat: 1000, Status: "aktif"}
	if got := statusEfektif(dasar, 1000); got != "menunggu" {
		t.Fatalf("awal: %q, mau menunggu", got)
	}
	if got := statusEfektif(dasar, 1000+resetUmurKode); got != "menunggu" {
		t.Fatalf("tepat batas kode: %q, mau menunggu", got)
	}
	if got := statusEfektif(dasar, 1000+resetUmurKode+1); got != "kedaluwarsa" {
		t.Fatalf("lewat batas kode: %q, mau kedaluwarsa", got)
	}
	terv := &sesiReset{Dibuat: 1000, Terverifikasi: 1500, Status: "aktif"}
	if got := statusEfektif(terv, 1500+resetUmurPIN); got != "terverifikasi" {
		t.Fatalf("tepat batas PIN: %q, mau terverifikasi", got)
	}
	if got := statusEfektif(terv, 1500+resetUmurPIN+1); got != "kedaluwarsa" {
		t.Fatalf("lewat batas PIN: %q, mau kedaluwarsa", got)
	}
	selesai := &sesiReset{Dibuat: 1000, Terverifikasi: 1500, Status: "selesai"}
	if got := statusEfektif(selesai, 999999); got != "selesai" {
		t.Fatalf("selesai tetap: %q", got)
	}
	gugur := &sesiReset{Dibuat: 1000, Status: "gugur"}
	if got := statusEfektif(gugur, 1001); got != "gugur" {
		t.Fatalf("gugur tetap: %q", got)
	}
	if sisa := sisaDetik(dasar, 1300); sisa != 300 {
		t.Fatalf("sisaDetik menunggu: %d, mau 300", sisa)
	}
	if sisa := sisaDetik(terv, 1500); sisa != resetUmurPIN {
		t.Fatalf("sisaDetik terverifikasi: %d, mau %d", sisa, resetUmurPIN)
	}
}

// Generator kode reset: format "MRD-" + 8 karakter dari alfabet
// tak-ambigu (tanpa 0/O/1/I/L), dan kode-kode yang dihasilkan berbeda.
func TestBuatKodeReset(t *testing.T) {
	unik := map[string]bool{}
	for i := 0; i < 200; i++ {
		k := buatKodeReset()
		if !kodeResetRe.MatchString(k) {
			t.Fatalf("format salah: %q", k)
		}
		for _, c := range k[len("MRD-"):] {
			if !strings.ContainsRune(alfabetKodeReset, c) {
				t.Fatalf("karakter di luar alfabet: %q", k)
			}
		}
		unik[k] = true
	}
	if len(unik) < 199 {
		t.Fatalf("kode terlalu sering berulang: %d unik dari 200", len(unik))
	}
	if a, b := buatKodeReset(), buatKodeReset(); a == b {
		t.Fatalf("dua kode berurutan sama: %q", a)
	}
}

// Kode DM dicocokkan terhadap hash PBKDF2 sesi (skema HashPIN yang sama
// dengan PIN warga): kode format baru cocok (termasuk sesudah
// normalisasi huruf kecil), kode lain tidak, dan angka 6 digit format
// lama DITOLAK — kode reset tak boleh tertukar dengan PIN.
func TestKodeCocokReset(t *testing.T) {
	salt := db.TokenAcak(16)
	kode := buatKodeReset()
	hash := db.HashPIN(kode, salt)
	if !kodeCocok(kode, hash, salt) {
		t.Fatal("kode benar harus cocok")
	}
	if !kodeCocok(strings.ToLower(kode), hash, salt) {
		t.Fatal("kode huruf kecil harus cocok sesudah normalisasi kapital")
	}
	salah := "MRD-AAAAAAAA"
	if kode == salah {
		salah = "MRD-BBBBBBBB"
	}
	if kodeCocok(salah, hash, salt) {
		t.Fatal("kode salah tidak boleh cocok")
	}
	if kodeCocok("483920", hash, salt) {
		t.Fatal("kode 6 angka format lama harus ditolak")
	}
	if kodeCocok("", hash, salt) {
		t.Fatal("kode kosong tidak boleh cocok")
	}
}
