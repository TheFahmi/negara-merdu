// Server Negara Merdu (Go) — entrypoint tunggal: hanya perakitan.
// Baca ENV, buka pool PostgreSQL (internal/db), jalankan inisialisasi
// skema + backfill + seed, daftarkan rute semua folder fitur, sajikan
// klien statis dari folder public/ proyek, lalu jalankan HTTP server.
//
// Struktur folder per fitur ada di internal/ (db, warga, keluarga, chat,
// ws, pemilu, pembangunan) — lihat DEPLOY_REPORT.md.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"pinarak/internal/chat"
	"pinarak/internal/db"
	"pinarak/internal/keluarga"
	"pinarak/internal/pembangunan"
	"pinarak/internal/pemilu"
	"pinarak/internal/warga"
	"pinarak/internal/ws"
)

type konfigurasi struct {
	DatabaseURL string
	Host        string
	Port        int
	AdminToken  string
	MinWarga    int
	DirPublik   string
}

func bacaKonfigurasi() konfigurasi {
	k := konfigurasi{
		DatabaseURL: os.Getenv("DATABASE_URL"),
		Host:        os.Getenv("HOST"),
		AdminToken:  os.Getenv("PINARAK_ADMIN_TOKEN"),
		MinWarga:    10_000,
	}
	if k.DatabaseURL == "" {
		k.DatabaseURL = "postgresql://pinarak:pinarak@localhost:5432/pinarak"
	}
	if k.Host == "" {
		k.Host = "0.0.0.0"
	}
	k.Port = 8026
	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			k.Port = v
		}
	}
	// PINARAK_MIN_WARGA: override UJI saja (produksi bawaan 10.000) —
	// kosong/tidak valid -> 10.000, sama seperti server.py.
	if mv := strings.TrimSpace(os.Getenv("PINARAK_MIN_WARGA")); mv != "" {
		if v, err := strconv.Atoi(mv); err == nil {
			k.MinWarga = v
		}
	}
	k.DirPublik = cariDirPublik()
	return k
}

// cariDirPublik mencari folder public/ klien: ENV PUBLIC_DIR, lalu ./public
// (di dalam image Docker), ../public (menjalankan dari goserver/), dan
// relatif terhadap lokasi binary.
func cariDirPublik() string {
	kandidat := []string{}
	if d := os.Getenv("PUBLIC_DIR"); d != "" {
		kandidat = append(kandidat, d)
	}
	kandidat = append(kandidat, "public", filepath.Join("..", "public"))
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		kandidat = append(kandidat,
			filepath.Join(dir, "public"),
			filepath.Join(dir, "..", "public"),
			filepath.Join(dir, "..", "..", "public"))
	}
	for _, c := range kandidat {
		if info, err := os.Stat(filepath.Join(c, "index.html")); err == nil && !info.IsDir() {
			abs, _ := filepath.Abs(c)
			return abs
		}
	}
	abs, _ := filepath.Abs("public")
	return abs
}

// inisialisasi: skema -> backfill NIK -> indeks unik NIK -> backfill
// keluarga -> seed pembangunan (urutan sama seperti init_db server.py;
// semua langkah idempoten).
func inisialisasi(ctx context.Context, store *db.Store) error {
	if err := db.BuatSkema(ctx, store); err != nil {
		return err
	}
	if err := warga.BackfillNIK(ctx, store); err != nil {
		return err
	}
	db.IndeksUnikNIK(ctx, store)
	if err := keluarga.Backfill(ctx, store); err != nil {
		return err
	}
	if err := pembangunan.Seed(ctx, store); err != nil {
		return err
	}
	return nil
}

// tungguDB menjalankan inisialisasi dengan pengulangan untuk kesalahan
// koneksi (maks 15 percobaan, jeda 2 detik) — meniru __main__ server.py.
func tungguDB(ctx context.Context, store *db.Store) error {
	var err error
	for i := 0; i < 15; i++ {
		err = inisialisasi(ctx, store)
		if err == nil {
			return nil
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) {
			return err // kesalahan SQL/skema: gagal cepat, jangan diulang
		}
		if i < 14 {
			time.Sleep(2 * time.Second)
		}
	}
	return err
}

func tulisJSONMentah(w http.ResponseWriter, kode int, body []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(kode)
	_, _ = w.Write(body)
}

func galat404(w http.ResponseWriter) {
	body, _ := json.Marshal(map[string]any{"error": "Tidak ditemukan"})
	tulisJSONMentah(w, 404, body)
}

// sajiStatis menyajikan klien dari folder public/ (setara
// SimpleHTTPRequestHandler server.py): "/" -> index.html, direktori ->
// index.html di dalamnya, MIME dari ekstensi, jalur keluar ditolak.
func sajiStatis(dirPublik string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		bersih := path.Clean("/" + r.URL.Path)
		full := filepath.Join(dirPublik, filepath.FromSlash(bersih))
		if full != dirPublik && !strings.HasPrefix(full, dirPublik+string(os.PathSeparator)) {
			http.NotFound(w, r)
			return
		}
		info, err := os.Stat(full)
		if err == nil && info.IsDir() {
			full = filepath.Join(full, "index.html")
			info, err = os.Stat(full)
		}
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		f, err := os.Open(full)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()
		if ct := mime.TypeByExtension(filepath.Ext(full)); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		http.ServeContent(w, r, info.Name(), info.ModTime(), f)
	}
}

func main() {
	konf := bacaKonfigurasi()
	ctx := context.Background()
	store, err := db.BukaPool(ctx, konf.DatabaseURL)
	if err != nil {
		log.Fatalf("DATABASE_URL tidak valid: %v", err)
	}
	defer store.Pool.Close()
	if err := tungguDB(ctx, store); err != nil {
		log.Fatalf("Inisialisasi database gagal: %v", err)
	}

	hub := ws.Baru(store)
	wargaH := &warga.Handler{DB: store, AdminToken: konf.AdminToken}
	// Sambutan Pak Presiden: keluarga dicari kepalanya, lalu chat menyimpan +
	// menyiarkan lewat hub (chat tidak tahu protokol ws).
	wargaH.Sambutan = func(ctx context.Context, w *db.Warga) (string, error) {
		kepala, _ := keluarga.KepalaUsername(ctx, store.Pool, w)
		return chat.SambutanWargaBaru(ctx, store, hub, w, kepala)
	}
	pemiluH := &pemilu.Handler{DB: store, AdminToken: konf.AdminToken, MinWarga: konf.MinWarga}
	pembH := &pembangunan.Handler{DB: store, AdminToken: konf.AdminToken}
	statis := sajiStatis(konf.DirPublik)

	akar := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch r.Method {
		case http.MethodGet, http.MethodHead:
			switch p {
			case "/ws":
				if r.Method == http.MethodGet {
					hub.Tangani(w, r)
				} else {
					statis(w, r)
				}
				return
			case "/api/warga":
				wargaH.DaftarWarga(w, r)
				return
			case "/api/statistik":
				wargaH.Statistik(w, r)
				return
			case "/api/saya":
				wargaH.Saya(w, r)
				return
			case "/api/keluarga-saya":
				wargaH.KeluargaSaya(w, r)
				return
			case "/api/pemilu":
				pemiluH.Ambil(w, r)
				return
			case "/api/pembangunan":
				pembH.Daftar(w, r)
				return
			}
			if strings.HasPrefix(p, "/api/") {
				galat404(w)
				return
			}
			statis(w, r)
		case http.MethodPost:
			switch p {
			case "/api/daftar":
				wargaH.Daftar(w, r)
			case "/api/login":
				wargaH.Login(w, r)
			case "/api/lengkapi":
				wargaH.Lengkapi(w, r)
			case "/api/logout":
				wargaH.Logout(w, r)
			case "/api/pemilu/calon":
				pemiluH.Calon(w, r)
			case "/api/pemilu/pilih":
				pemiluH.Pilih(w, r)
			case "/api/admin/pemilu/buka":
				pemiluH.Admin("buka")(w, r)
			case "/api/admin/pemilu/fase":
				pemiluH.Admin("fase")(w, r)
			case "/api/admin/pemilu/tutup":
				pemiluH.Admin("tutup")(w, r)
			case "/api/admin/pembangunan/bangun":
				pembH.Bangun(w, r)
			default:
				galat404(w)
			}
		default:
			// BaseHTTPRequestHandler Python menjawab 501 untuk method lain.
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusNotImplemented)
			_, _ = w.Write([]byte("<html><body><h1>501 Unsupported method</h1></body></html>"))
		}
	})

	alamat := net.JoinHostPort(konf.Host, strconv.Itoa(konf.Port))
	srv := &http.Server{Addr: alamat, Handler: akar}
	fmt.Printf("Negara Merdu (Go) jalan di %s (DB: PostgreSQL, kapasitas %d)\n", alamat, db.Kapasitas)
	log.Fatal(srv.ListenAndServe())
}
