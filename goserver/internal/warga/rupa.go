package warga

import (
	"encoding/json"
	"regexp"
)

// Rupa: kustom karakter tambahan saat daftar / lengkapi profil, di luar
// warna baju, warna kulit, dan topi (kolom lama). Disimpan sebagai JSON di
// kolom warga.rupa; string kosong = semua bawaan.
type Rupa struct {
	Rambut      string `json:"rambut,omitempty"`       // pendek | panjang | kuncir | ikal | botak
	WarnaRambut string `json:"warna_rambut,omitempty"` // #rrggbb
	WarnaCelana string `json:"warna_celana,omitempty"` // #rrggbb
	Kacamata    string `json:"kacamata,omitempty"`     // ya | tidak
	Alis        string `json:"alis,omitempty"`         // tipis | tebal
}

var (
	rambutSah   = map[string]bool{"pendek": true, "panjang": true, "kuncir": true, "ikal": true, "botak": true}
	kacamataSah = map[string]bool{"ya": true, "tidak": true}
	alisSah     = map[string]bool{"tipis": true, "tebal": true}
	hexRe       = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

// RupaDari mengurai kolom JSON; nil bila kosong/rusak.
func RupaDari(s string) *Rupa {
	if s == "" {
		return nil
	}
	var r Rupa
	if json.Unmarshal([]byte(s), &r) != nil {
		return nil
	}
	return &r
}

// rupaDariPermintaan memvalidasi objek "rupa" di body JSON. ok=false bila
// ada nilai tidak sah. Mengembalikan JSON tersimpan ("" bila tidak dikirim).
func rupaDariPermintaan(data map[string]any) (simpan string, ada bool, ok bool) {
	mentah, hadir := data["rupa"].(map[string]any)
	if !hadir {
		return "", false, true
	}
	ambil := func(k string) string { v, _ := mentah[k].(string); return v }
	r := Rupa{Rambut: ambil("rambut"), WarnaRambut: ambil("warna_rambut"), WarnaCelana: ambil("warna_celana"),
		Kacamata: ambil("kacamata"), Alis: ambil("alis")}
	if (r.Rambut != "" && !rambutSah[r.Rambut]) ||
		(r.WarnaRambut != "" && !hexRe.MatchString(r.WarnaRambut)) ||
		(r.WarnaCelana != "" && !hexRe.MatchString(r.WarnaCelana)) ||
		(r.Kacamata != "" && !kacamataSah[r.Kacamata]) ||
		(r.Alis != "" && !alisSah[r.Alis]) {
		return "", true, false
	}
	b, _ := json.Marshal(r)
	if string(b) == "{}" {
		return "", true, true
	}
	return string(b), true, true
}
