package warga

// Uji integrasi gender + jalur pra-daftar admin + alur lengkapi profil.
// Butuh PostgreSQL uji: TEST_DATABASE_URL. Bila env tidak diset, uji
// dilewati (uji murni lain tetap jalan).

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"pinarak/internal/db"
)

const tokenAdminUji = "token-admin-uji"

func handlerUji(t *testing.T) *Handler {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL tidak diset — uji integrasi dilewati")
	}
	ctx := context.Background()
	store, err := db.BukaPool(ctx, url)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(store.Pool.Close)
	if err := db.BuatSkema(ctx, store); err != nil {
		t.Fatalf("skema: %v", err)
	}
	for _, tbl := range []string{"sesi", "chat", "suara", "kandidat", "jabatan", "warga", "keluarga"} {
		if _, err := store.Pool.Exec(ctx, "TRUNCATE TABLE "+tbl+" RESTART IDENTITY CASCADE"); err != nil {
			t.Fatalf("truncate %s: %v", tbl, err)
		}
	}
	return &Handler{DB: store, AdminToken: tokenAdminUji}
}

func panggil(h http.HandlerFunc, body string, header map[string]string) (int, map[string]any) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
		// bacaJSON menolak ContentLength <= 0; httptest dari Reader mengisinya.
	}
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h(rec, req)
	var hasil map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &hasil)
	return rec.Code, hasil
}

func daftarBody(username, pin, gender string) string {
	g := ""
	if gender != "" {
		g = `,"gender":"` + gender + `"`
	}
	return `{"username":"` + username + `","pin":"` + pin +
		`","warna_baju":"#2e9e5b","warna_kulit":"#f1c27d","topi":"peci"` + g + `}`
}

func TestDaftarGenderWajib(t *testing.T) {
	h := handlerUji(t)
	// Tanpa gender -> 400.
	if kode, _ := panggil(h.Daftar, daftarBody("uji.tanpa", "112233", ""), nil); kode != 400 {
		t.Errorf("daftar tanpa gender: kode %d, mau 400", kode)
	}
	// Gender di luar L/P -> 400.
	if kode, _ := panggil(h.Daftar, daftarBody("uji.aneh", "112233", "X"), nil); kode != 400 {
		t.Errorf("daftar gender X: kode %d, mau 400", kode)
	}
	// Dengan gender -> 201 dan tersimpan.
	kode, d := panggil(h.Daftar, daftarBody("uji.dengan", "112233", "P"), nil)
	if kode != 201 {
		t.Fatalf("daftar dengan gender: kode %d, mau 201 (%v)", kode, d)
	}
	warga, _ := d["warga"].(map[string]any)
	if warga["gender"] != "P" {
		t.Errorf("gender tersimpan: %v, mau P", warga["gender"])
	}
	// Payload publik /api/warga TIDAK memuat gender.
	req := httptest.NewRequest(http.MethodGet, "/api/warga", nil)
	rec := httptest.NewRecorder()
	h.DaftarWarga(rec, req)
	if strings.Contains(rec.Body.String(), `"gender"`) {
		t.Errorf("payload publik /api/warga memuat gender: %s", rec.Body.String())
	}
}

func TestDaftarPraDaftarAdmin(t *testing.T) {
	h := handlerUji(t)
	// Token admin sah + tanpa gender -> 201, gender NULL.
	kode, d := panggil(h.Daftar, daftarBody("uji.pra", "123456", ""),
		map[string]string{"X-Admin-Token": tokenAdminUji})
	if kode != 201 {
		t.Fatalf("pra-daftar admin: kode %d, mau 201 (%v)", kode, d)
	}
	warga, _ := d["warga"].(map[string]any)
	if g, ada := warga["gender"]; !ada || g != nil {
		t.Errorf("gender pra-daftar: %v (ada=%v), mau null", g, ada)
	}
	// Token admin SALAH + tanpa gender -> 403 (pola admin yang ada).
	if kode, _ := panggil(h.Daftar, daftarBody("uji.pra2", "123456", ""),
		map[string]string{"X-Admin-Token": "salah"}); kode != 403 {
		t.Errorf("pra-daftar token salah: kode %d, mau 403", kode)
	}
	// Token admin sah + gender terisi tetap diterima & tersimpan.
	kode, d = panggil(h.Daftar, daftarBody("uji.pra3", "123456", "L"),
		map[string]string{"X-Admin-Token": tokenAdminUji})
	if kode != 201 {
		t.Fatalf("pra-daftar admin + gender: kode %d, mau 201", kode)
	}
	if w, _ := d["warga"].(map[string]any); w["gender"] != "L" {
		t.Errorf("gender pra-daftar terisi: %v, mau L", w["gender"])
	}
}

func TestLengkapiProfil(t *testing.T) {
	h := handlerUji(t)
	// Akun PIN default (123456) dengan gender sudah terisi.
	if kode, _ := panggil(h.Daftar, daftarBody("uji.lengkap", "123456", "L"), nil); kode != 201 {
		t.Fatalf("daftar awal: kode %d", kode)
	}
	// Login -> bendera pin_default benar, gender_kosong salah.
	kode, d := panggil(h.Login, `{"username":"uji.lengkap","pin":"123456"}`, nil)
	if kode != 200 {
		t.Fatalf("login: kode %d", kode)
	}
	if d["pin_default"] != true {
		t.Errorf("pin_default: %v, mau true", d["pin_default"])
	}
	if d["gender_kosong"] != false {
		t.Errorf("gender_kosong: %v, mau false", d["gender_kosong"])
	}
	token, _ := d["token"].(string)
	auth := map[string]string{"Authorization": "Bearer " + token}
	// pin_baru bukan 6 digit -> 400.
	if kode, _ := panggil(h.Lengkapi,
		`{"pin_baru":"123","gender":"P"}`, auth); kode != 400 {
		t.Errorf("lengkapi pin_baru pendek: kode %d, mau 400", kode)
	}
	// Gender kosong -> 400.
	if kode, _ := panggil(h.Lengkapi,
		`{"pin_baru":"654321"}`, auth); kode != 400 {
		t.Errorf("lengkapi tanpa gender: kode %d, mau 400", kode)
	}
	// Lengkapi sah: ganti PIN + gender + warna baju.
	kode, d = panggil(h.Lengkapi,
		`{"pin_baru":"654321","gender":"P","warna_baju":"#e74c3c"}`, auth)
	if kode != 200 {
		t.Fatalf("lengkapi sah: kode %d (%v)", kode, d)
	}
	if w, _ := d["warga"].(map[string]any); w["gender"] != "P" || w["warna_baju"] != "#e74c3c" {
		t.Errorf("hasil lengkapi: gender=%v baju=%v", w["gender"], w["warna_baju"])
	}
	if d["pin_default"] != false {
		t.Errorf("pin_default sesudah lengkapi: %v, mau false", d["pin_default"])
	}
	// PIN lama tidak berlaku, PIN baru berlaku.
	if kode, _ := panggil(h.Login, `{"username":"uji.lengkap","pin":"123456"}`, nil); kode != 401 {
		t.Errorf("login PIN lama: kode %d, mau 401", kode)
	}
	kode, d = panggil(h.Login, `{"username":"uji.lengkap","pin":"654321"}`, nil)
	if kode != 200 {
		t.Fatalf("login PIN baru: kode %d", kode)
	}
	// Akun bukan PIN default: pin_baru ditolak.
	token2, _ := d["token"].(string)
	auth2 := map[string]string{"Authorization": "Bearer " + token2}
	if kode, _ := panggil(h.Lengkapi,
		`{"pin_baru":"999888","gender":"L"}`, auth2); kode != 400 {
		t.Errorf("lengkapi pin_baru di akun non-default: kode %d, mau 400", kode)
	}
	// Tanpa sesi -> 401.
	if kode, _ := panggil(h.Lengkapi, `{"gender":"L"}`, nil); kode != 401 {
		t.Errorf("lengkapi tanpa sesi: kode %d, mau 401", kode)
	}
}

func TestLoginGenderKosong(t *testing.T) {
	h := handlerUji(t)
	// Pra-daftar (gender NULL, PIN 123456) -> login menandai dua bendera.
	if kode, _ := panggil(h.Daftar, daftarBody("uji.kosong", "123456", ""),
		map[string]string{"X-Admin-Token": tokenAdminUji}); kode != 201 {
		t.Fatalf("pra-daftar: kode %d", kode)
	}
	kode, d := panggil(h.Login, `{"username":"uji.kosong","pin":"123456"}`, nil)
	if kode != 200 {
		t.Fatalf("login: kode %d", kode)
	}
	if d["pin_default"] != true || d["gender_kosong"] != true {
		t.Errorf("bendera: pin_default=%v gender_kosong=%v, mau true/true",
			d["pin_default"], d["gender_kosong"])
	}
}
