// Paket ws: hub WebSocket Negara Merdu — implementasi manual RFC 6455 di
// atas net/http hijack, meniru perilaku server.py persis: tamu = penonton
// (posisi/chat dibuang server), heartbeat ping 20 dtk & putus >30 dtk
// tanpa aktivitas, clamp posisi ke batas kota, siaran masuk/keluar/
// posisi/chat, pesan sistem Pak Presiden lewat Siar().
package ws

import (
	"bufio"
	"context"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"math"
	"net"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"pinarak/internal/chat"
	"pinarak/internal/db"
	"pinarak/internal/warga"
)

const (
	guid       = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11" // GUID RFC 6455 §4.1 (tetap)
	maksMuatan = 65536                                  // batas ukuran 1 frame dari klien
	timeoutDtk = 30 * time.Second                       // tanpa aktivitas apa pun -> putus
	pingTiap   = 20 * time.Second
	chatMaks   = 200 // karakter per pesan
	chatJeda   = 1500 * time.Millisecond
	batasBaca  = 2 * time.Second // jendela baca per putaran (cek detak)
)

// PemainView: bentuk data pemain sebagaimana dikirim ke klien.
type PemainView struct {
	U       string      `json:"u"`
	Baju    string      `json:"baju"`
	Kulit   string      `json:"kulit"`
	Topi    string      `json:"topi"`
	X       float64     `json:"x"`
	Z       float64     `json:"z"`
	Yaw     float64     `json:"yaw"`
	Jabatan *string     `json:"jabatan"`
	Rupa    *warga.Rupa `json:"rupa,omitempty"` // kustom karakter
}

type pemain struct {
	rupa warga.Publik
	x    float64
	z    float64
	yaw  float64
	n    int // jumlah koneksi username ini
}

func (p *pemain) publik() PemainView {
	return PemainView{
		U: p.rupa.Username, Baju: p.rupa.WarnaBaju, Kulit: p.rupa.WarnaKulit,
		Topi: p.rupa.Topi, X: p.x, Z: p.z, Yaw: p.yaw, Jabatan: p.rupa.Jabatan,
		Rupa: p.rupa.Rupa,
	}
}

// Klien: satu koneksi WebSocket.
type Klien struct {
	conn     net.Conn
	br       *bufio.Reader
	username *string
	wargaID  int64
	rupa     *warga.Publik
	terakhir time.Time
	pingLast time.Time
	kirimMu  sync.Mutex
}

func (k *Klien) kirimBingkai(op byte, muatan []byte) error {
	k.kirimMu.Lock()
	defer k.kirimMu.Unlock()
	kepala := []byte{0x80 | op}
	n := len(muatan)
	switch {
	case n < 126:
		kepala = append(kepala, byte(n))
	case n < 65536:
		kepala = append(kepala, 126, byte(n>>8), byte(n))
	default:
		kepala = append(kepala, 127)
		var b [8]byte
		binary.BigEndian.PutUint64(b[:], uint64(n))
		kepala = append(kepala, b[:]...)
	}
	_ = k.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if _, err := k.conn.Write(kepala); err != nil {
		return err
	}
	_, err := k.conn.Write(muatan)
	return err
}

func (k *Klien) kirimObj(obj any) error {
	teks, err := json.Marshal(obj)
	if err != nil {
		return err
	}
	return k.kirimBingkai(0x1, teks)
}

func (k *Klien) tutup() {
	_ = k.conn.Close()
}

// Hub: registri koneksi & pemain + rate limit chat.
type Hub struct {
	DB *db.Store

	mu       sync.Mutex
	klien    map[*Klien]struct{}
	pemain   map[string]*pemain
	chatLast map[string]time.Time
}

// Baru membuat hub kosong.
func Baru(store *db.Store) *Hub {
	return &Hub{
		DB:       store,
		klien:    make(map[*Klien]struct{}),
		pemain:   make(map[string]*pemain),
		chatLast: make(map[string]time.Time),
	}
}

// Siar menyiarkan objek ke SEMUA klien (termasuk tamu) — dipakai chat
// untuk sambutan Pak Presiden (memenuhi interface chat.Penyiar).
func (h *Hub) Siar(obj any) {
	h.siar(obj, nil)
}

func (h *Hub) siar(obj any, kecuali *Klien) {
	teks, err := json.Marshal(obj)
	if err != nil {
		return
	}
	h.mu.Lock()
	daftar := make([]*Klien, 0, len(h.klien))
	for k := range h.klien {
		if k != kecuali {
			daftar = append(daftar, k)
		}
	}
	h.mu.Unlock()
	for _, k := range daftar {
		if err := k.kirimBingkai(0x1, teks); err != nil {
			k.tutup()
		}
	}
}

// daftarKlien mendaftarkan koneksi; true bila username ini pemain BARU.
func (h *Hub) daftarKlien(k *Klien) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.klien[k] = struct{}{}
	if k.username == nil {
		return false
	}
	p, ada := h.pemain[*k.username]
	if !ada {
		h.pemain[*k.username] = &pemain{
			rupa: *k.rupa, x: 8.0, z: 22.0, yaw: 0.35, n: 1,
		}
		return true
	}
	p.n++
	return false
}

// hapusKlien mencabut koneksi; true bila itu koneksi TERAKHIR username.
func (h *Hub) hapusKlien(k *Klien) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.klien, k)
	if k.username == nil {
		return false
	}
	p, ada := h.pemain[*k.username]
	if !ada {
		return false
	}
	p.n--
	if p.n <= 0 {
		delete(h.pemain, *k.username)
		return true
	}
	return false
}

func (h *Hub) daftarPemain() []PemainView {
	h.mu.Lock()
	defer h.mu.Unlock()
	hasil := make([]PemainView, 0, len(h.pemain))
	for _, p := range h.pemain {
		hasil = append(hasil, p.publik())
	}
	return hasil
}

func (h *Hub) pemainPublik(username string) (PemainView, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	p, ada := h.pemain[username]
	if !ada {
		return PemainView{}, false
	}
	return p.publik(), true
}

// Tangani melayani GET /ws (upgrade WebSocket).
func (h *Hub) Tangani(w http.ResponseWriter, r *http.Request) {
	kunci := r.Header.Get("Sec-WebSocket-Key")
	if kunci == "" || !strings.Contains(strings.ToLower(r.Header.Get("Upgrade")), "websocket") {
		body := []byte(`{"error":"Bukan permintaan WebSocket"}`)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.WriteHeader(400)
		_, _ = w.Write(body)
		return
	}
	token := r.URL.Query().Get("token")
	var row *db.Warga
	if token != "" {
		row = warga.DariToken(r.Context(), h.DB.Pool, token)
	}
	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "hijack tidak didukung", http.StatusInternalServerError)
		return
	}
	conn, brw, err := hj.Hijack()
	if err != nil {
		return
	}
	sum := sha1.Sum([]byte(kunci + guid))
	terima := base64.StdEncoding.EncodeToString(sum[:])
	_, err = brw.WriteString("HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + terima + "\r\n\r\n")
	if err == nil {
		err = brw.Flush()
	}
	if err != nil {
		conn.Close()
		return
	}
	klien := &Klien{
		conn: conn, br: brw.Reader,
		terakhir: time.Now(), pingLast: time.Now(),
	}
	if row != nil {
		nama := row.Username
		klien.username = &nama
		klien.wargaID = row.ID
		rupa := warga.PublikSatu(r.Context(), h.DB.Pool, row)
		klien.rupa = &rupa
	}
	pemainBaru := h.daftarKlien(klien)
	defer func() {
		if h.hapusKlien(klien) {
			h.siar(map[string]any{"jenis": "keluar", "u": *klien.username}, nil)
		}
		klien.tutup()
	}()
	riwayat, _ := chat.Terakhir(r.Context(), h.DB.Pool)
	if riwayat == nil {
		riwayat = []chat.Pesan{}
	}
	_ = klien.kirimObj(map[string]any{
		"jenis": "sambutan", "kamu": klien.username,
		"pemain": h.daftarPemain(), "chat": riwayat,
	})
	if pemainBaru {
		if pv, ada := h.pemainPublik(*klien.username); ada {
			h.siar(map[string]any{"jenis": "masuk", "pemain": pv}, klien)
		}
	}
	h.putar(klien)
}

// bacaPersis membaca tepat n byte dengan jendela batasBaca per percobaan;
// pada timeout menjalankan pemeriksaan detak/ping (false = putuskan).
func (h *Hub) bacaPersis(k *Klien, n int) ([]byte, bool) {
	buf := make([]byte, 0, n)
	for len(buf) < n {
		_ = k.conn.SetReadDeadline(time.Now().Add(batasBaca))
		potong := make([]byte, n-len(buf))
		m, err := k.br.Read(potong)
		if m > 0 {
			buf = append(buf, potong[:m]...)
		}
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				kini := time.Now()
				if kini.Sub(k.terakhir) > timeoutDtk {
					return nil, false
				}
				if kini.Sub(k.pingLast) >= pingTiap {
					k.pingLast = kini
					if err := k.kirimBingkai(0x9, nil); err != nil {
						return nil, false
					}
				}
				continue
			}
			return nil, false
		}
	}
	return buf, true
}

// putar: lingkaran baca frame sampai putus (meniru tangani_ws server.py).
func (h *Hub) putar(k *Klien) {
	var frag []byte
	var fragOp byte
	for {
		kepala, ok := h.bacaPersis(k, 2)
		if !ok {
			return
		}
		b1, b2 := kepala[0], kepala[1]
		fin := b1&0x80 != 0
		op := b1 & 0x0F
		bertopeng := b2&0x80 != 0
		panjang := uint64(b2 & 0x7F)
		if panjang == 126 {
			b, ok := h.bacaPersis(k, 2)
			if !ok {
				return
			}
			panjang = uint64(binary.BigEndian.Uint16(b))
		} else if panjang == 127 {
			b, ok := h.bacaPersis(k, 8)
			if !ok {
				return
			}
			panjang = binary.BigEndian.Uint64(b)
		}
		if panjang > maksMuatan {
			return
		}
		var topeng []byte
		if bertopeng {
			topeng, ok = h.bacaPersis(k, 4)
			if !ok {
				return
			}
		}
		var muatan []byte
		if panjang > 0 {
			muatan, ok = h.bacaPersis(k, int(panjang))
			if !ok {
				return
			}
		}
		if topeng != nil {
			for i := range muatan {
				muatan[i] ^= topeng[i%4]
			}
		}
		k.terakhir = time.Now()
		switch {
		case op == 0x8: // close
			_ = k.kirimBingkai(0x8, nil)
			return
		case op == 0x9: // ping -> pong
			if err := k.kirimBingkai(0xA, muatan); err != nil {
				return
			}
			continue
		case op == 0xA: // pong
			continue
		case op == 0x0 || op == 0x1 || op == 0x2:
			if op != 0x0 {
				frag = append([]byte(nil), muatan...)
				fragOp = op
			} else {
				frag = append(frag, muatan...)
			}
			if !fin {
				continue
			}
			if fragOp == 0x1 {
				h.pesan(k, frag)
			}
			frag, fragOp = nil, 0
		}
	}
}

var kontrolRe = regexp.MustCompile(`[\x00-\x1f\x7f]`)

func keFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		if err == nil {
			return f, true
		}
	}
	return 0, false
}

// pesan menangani satu pesan JSON dari klien (jenis: detak/posisi/chat).
func (h *Hub) pesan(k *Klien, data []byte) {
	var msg map[string]any
	if err := json.Unmarshal(data, &msg); err != nil || msg == nil {
		return
	}
	jenis, _ := msg["jenis"].(string)
	switch jenis {
	case "detak":
		return
	case "posisi":
		if k.username == nil {
			return // tamu tidak tampil sebagai karakter
		}
		x, ok1 := keFloat(msg["x"])
		z, ok2 := keFloat(msg["z"])
		yaw, ok3 := keFloat(msg["yaw"])
		if !ok1 || !ok2 || !ok3 {
			return
		}
		x = math.Max(-db.BatasX, math.Min(db.BatasX, x))
		z = math.Max(-db.BatasZ, math.Min(db.BatasZ, z))
		yaw = math.Max(-1e4, math.Min(1e4, yaw))
		h.mu.Lock()
		p, ada := h.pemain[*k.username]
		if ada {
			p.x, p.z, p.yaw = x, z, yaw
		}
		h.mu.Unlock()
		if !ada {
			return
		}
		h.siar(map[string]any{
			"jenis": "posisi", "u": *k.username, "x": x, "z": z, "yaw": yaw,
		}, k)
	case "chat":
		if k.username == nil {
			_ = k.kirimObj(map[string]any{
				"jenis": "galat",
				"pesan": "Masuk dulu pakai Kartu Warga Negara untuk ikut chat Istana Negara.",
			})
			return
		}
		isi := ""
		if s, ok := msg["isi"].(string); ok {
			isi = s
		}
		isi = strings.TrimSpace(kontrolRe.ReplaceAllString(isi, " "))
		if isi == "" {
			return
		}
		if utf8.RuneCountInString(isi) > chatMaks {
			_ = k.kirimObj(map[string]any{
				"jenis": "galat",
				"pesan": "Pesan maksimal 200 karakter.",
			})
			return
		}
		kini := time.Now()
		h.mu.Lock()
		terakhir := h.chatLast[*k.username]
		if kini.Sub(terakhir) < chatJeda {
			h.mu.Unlock()
			_ = k.kirimObj(map[string]any{
				"jenis": "galat",
				"pesan": "Sabar, kirimnya pelan-pelan ya (maks 1 pesan / 1,5 detik).",
			})
			return
		}
		h.chatLast[*k.username] = kini
		h.mu.Unlock()
		jam, err := chat.Simpan(context.Background(), h.DB.Pool, k.wargaID, *k.username, isi, false)
		if err != nil {
			return
		}
		h.siar(map[string]any{
			"jenis": "chat", "u": *k.username, "isi": isi, "jam": jam,
		}, nil)
	}
}
