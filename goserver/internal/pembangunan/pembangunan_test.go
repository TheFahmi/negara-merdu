package pembangunan

import "testing"

func TestDaftarFasilitasPersis(t *testing.T) {
	if len(Fasilitas) != 8 {
		t.Fatalf("jumlah fasilitas = %d, mau 8", len(Fasilitas))
	}
	mau := map[string][2]int{
		"taman": {1879, 5_000_000}, "lapangan": {2901, 8_000_000},
		"perpustakaan": {973, 12_000_000}, "balai_warga": {1029, 15_000_000},
		"sekolah": {1653, 20_000_000}, "puskesmas": {2941, 25_000_000},
		"pasar": {2269, 30_000_000}, "masjid": {2285, 40_000_000},
	}
	for _, f := range Fasilitas {
		m, ok := mau[f.Kunci]
		if !ok {
			t.Errorf("kunci tak dikenal: %s", f.Kunci)
			continue
		}
		blok := f.Bar*80 + f.Kol + 1
		if blok != m[0] || f.Biaya != m[1] {
			t.Errorf("%s: blok %d biaya %d, mau %d/%d", f.Kunci, blok, f.Biaya, m[0], m[1])
		}
		if _, ada := perKunci[f.Kunci]; !ada {
			t.Errorf("perKunci[%s] hilang", f.Kunci)
		}
	}
	if _, ada := perKunci["ngawur"]; ada {
		t.Error("perKunci kunci salah harus tidak ada")
	}
}

func TestFasilitasVotingTokoPancing(t *testing.T) {
	if len(FasilitasVoting) != 1 {
		t.Fatalf("jumlah fasilitas voting = %d, mau 1", len(FasilitasVoting))
	}
	f := FasilitasVoting[0]
	if f.Kunci != "toko_pancing" || f.Nama != "Toko Pancing" {
		t.Fatalf("fasilitas voting = %s/%s, mau toko_pancing/Toko Pancing", f.Kunci, f.Nama)
	}
	if blok := f.Bar*80 + f.Kol + 1; blok != 1882 {
		t.Errorf("blok toko_pancing = %d, mau 1882", blok)
	}
	if f.Kol != 41 || f.Bar != 23 {
		t.Errorf("kol/bar toko_pancing = %d/%d, mau 41/23", f.Kol, f.Bar)
	}
	if !f.Voting || f.Owner != "@drennvanzz_" {
		t.Errorf("voting/owner = %v/%q, mau true/@drennvanzz_", f.Voting, f.Owner)
	}
	if f.Biaya != 0 {
		t.Errorf("biaya toko_pancing = %d, mau 0 (kas tidak dipotong)", f.Biaya)
	}
	// Tidak menimpa / tidak menggeser 8 fasilitas baku.
	if len(Fasilitas) != 8 {
		t.Errorf("fasilitas baku berubah: %d", len(Fasilitas))
	}
	semua := SemuaFasilitas()
	if len(semua) != 9 || semua[8].Kunci != "toko_pancing" {
		t.Errorf("SemuaFasilitas = %d item, item ke-9 = %v", len(semua), semua[8].Kunci)
	}
	// Bloknya tidak bertabrakan dengan blok 8 fasilitas baku.
	for _, b := range Fasilitas {
		if b.Kol == f.Kol && b.Bar == f.Bar {
			t.Errorf("blok toko_pancing menimpa fasilitas baku %s", b.Kunci)
		}
	}
	if _, ada := perKunci["toko_pancing"]; !ada {
		t.Error("perKunci[toko_pancing] hilang")
	}
}
