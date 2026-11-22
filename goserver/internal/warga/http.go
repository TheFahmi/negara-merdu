package warga

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// Pembantu HTTP lokal paket ini (bentuk respons sama seperti kirim_json /
// baca_json server.py).

func tulisJSON(w http.ResponseWriter, kode int, obj any) {
	body, err := json.Marshal(obj)
	if err != nil {
		kode = 500
		body = []byte(`{"error":"Kesalahan server"}`)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(kode)
	_, _ = w.Write(body)
}

func galat(w http.ResponseWriter, kode int, pesan string) {
	tulisJSON(w, kode, map[string]any{"error": pesan})
}

// bacaJSON: body JSON objek; nil bila kosong/>64KB/bukan objek.
func bacaJSON(r *http.Request) map[string]any {
	if r.ContentLength <= 0 || r.ContentLength > 65536 {
		return nil
	}
	mentah, err := io.ReadAll(io.LimitReader(r.Body, 65536))
	if err != nil {
		return nil
	}
	var v any
	if err := json.Unmarshal(mentah, &v); err != nil {
		return nil
	}
	obj, ok := v.(map[string]any)
	if !ok {
		return nil
	}
	return obj
}

// strAmbil: field string dari objek JSON (skalar non-string diformat
// seperti str() Python sebisa mungkin).
func strAmbil(obj map[string]any, kunci string) string {
	v, ok := obj[kunci]
	if !ok || v == nil {
		return ""
	}
	switch t := v.(type) {
	case string:
		return t
	case bool:
		if t {
			return "True"
		}
		return "False"
	case float64:
		if t == float64(int64(t)) && t < 1e15 && t > -1e15 {
			return strconv.FormatInt(int64(t), 10)
		}
		return strconv.FormatFloat(t, 'g', -1, 64)
	default:
		return ""
	}
}

func bearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(auth[len("Bearer "):])
}
