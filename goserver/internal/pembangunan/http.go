package pembangunan

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
)

// Pembantu HTTP lokal paket ini (bentuk respons sama seperti server.py).

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

func strAmbil(obj map[string]any, kunci string) string {
	v, ok := obj[kunci]
	if !ok || v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
