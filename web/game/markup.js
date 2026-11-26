/* Markup halaman utama Negara Merdu — dipindah APA ADANYA dari body
   public/index.html lama (migrasi Next.js 22 Nov 2026). Dirender lewat
   dangerouslySetInnerHTML supaya struktur DOM identik persis; kode game
   di ../game/*.js memanipulasinya langsung seperti dulu. */
export const MARKUP = `<canvas id="kanvas"></canvas>

<div id="hud" hidden>
  <div id="zona-atas">
    <div class="bar-atas">
      <div class="merek-atas">
        <svg class="logo-atas" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#7a1f1f"/><path d="M32 11 L52 28 L46 28 L46 50 L37 50 L37 39 L27 39 L27 50 L18 50 L18 28 L12 28 Z" fill="#f2c230"/></svg>
        <div class="merek-teks">
          <b>Negara Merdu</b>
          <div class="baris-stat">
            <span class="chip-stat" title="Warga terdaftar"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><b id="stat-warga">0</b><span class="lbl-stat"> warga</span></span>
            <span class="titik-stat">·</span>
            <span class="chip-stat" title="Kavling terisi"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg><b id="stat-rumah">0 / 100.000</b></span>
          </div>
          <span id="info-sub" hidden>@negaramerdu</span>
        </div>
      </div>
      <div class="tombol-atas">
        <button id="tombol-chat" type="button" aria-label="Buka chat Istana Negara"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span id="lencana-chat" hidden>0</span></button>
        <button id="tombol-menu" type="button" aria-label="Buka menu"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg></button>
        <button id="tombol-akun" type="button" aria-haspopup="true"><span class="akun-teks">Masuk</span></button>
      </div>
    </div>
    <div id="chip-saya" hidden role="menu">
      <div class="profil-kepala">
        <span class="avatar-besar" id="avatar-besar">?</span>
        <div class="profil-teks"><b id="profil-nama">@warga</b><span id="chip-saya-teks"></span></div>
      </div>
      <button id="btn-kartu-saya" type="button" role="menuitem"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="6" y1="10" x2="12" y2="10"/><line x1="6" y1="14" x2="15" y2="14"/></svg> Kartu Saya</button>
      <button id="btn-rumah-saya" type="button" role="menuitem"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> Lihat Rumah Saya</button>
      <button id="tombol-keluar" type="button" role="menuitem" class="keluar"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Keluar Akun</button>
    </div>
    <div id="panel-chat" hidden>
      <div class="pc-judul"><b><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Istana Negara</b><button id="tombol-tutup-chat" type="button" aria-label="Tutup chat">✕</button></div>
      <div id="chat-log" aria-live="polite"></div>
      <div id="chat-catatan">Chat untuk semua warga yang sedang online.</div>
      <form id="form-chat">
        <input id="isi-chat" type="text" maxlength="200" placeholder="Tulis pesan…" autocomplete="off" autocapitalize="sentences">
        <button type="submit" id="kirim-chat">Kirim</button>
      </form>
    </div>
    <div id="panel-menu" hidden>
      <div class="pm-judul"><b>Menu Negara</b><button id="tombol-tutup-menu" type="button" aria-label="Tutup menu">✕</button></div>
      <div class="pm-stat">
        <div><span><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Warga terdaftar</span><b id="pm-warga">0</b></div>
        <div><span><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> Kavling terisi</span><b id="pm-rumah">0</b></div>
        <div><span><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> Kapasitas kota</span><b>100.000 kavling</b></div>
        <div><span><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/></svg> Ukuran kota</span><b id="pm-luas">—</b></div>
      </div>
      <button id="tombol-putar" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Putar otomatis: <span id="putar-status">Nyala</span></button>
      <div class="pm-kualitas">
        <span class="pm-kualitas-judul"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> Kualitas grafik</span>
        <div class="seg" id="seg-kualitas">
          <button type="button" data-kualitas="otomatis">Otomatis</button>
          <button type="button" data-kualitas="rendah">Rendah</button>
          <button type="button" data-kualitas="sedang">Sedang</button>
          <button type="button" data-kualitas="tinggi">Tinggi</button>
        </div>
        <p id="info-kualitas"></p>
      </div>
      <div class="pm-kualitas">
        <span class="pm-kualitas-judul"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Waktu negara</span>
        <div class="seg" id="seg-waktu">
          <button type="button" data-waktu="siang">Siang</button>
          <button type="button" data-waktu="senja">Senja</button>
          <button type="button" data-waktu="malam">Malam</button>
          <button type="button" data-waktu="siklus">Siklus</button>
        </div>
        <p id="info-waktu"></p>
      </div>
      <div class="pm-kualitas">
        <span class="pm-kualitas-judul"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg> Suara</span>
        <div class="seg" id="seg-suara">
          <button type="button" data-suara="nyala">Nyala</button>
          <button type="button" data-suara="mati">Mati</button>
        </div>
        <input id="vol-suara" type="range" min="0" max="100" step="1" aria-label="Volume suara" style="width:100%;margin-top:8px;accent-color:#2e9e5b">
        <p>Suasana kota, burung &amp; jangkrik, bus, KRL, langkah kaki.</p>
      </div>
      <button id="tombol-keluarga" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5v-2A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5v2"/><circle cx="17.5" cy="9.5" r="2.6"/><path d="M16 14.4a4.5 4.5 0 0 1 5.5 4.4v1.7"/></svg> Keluarga Saya</button>
      <button id="tombol-pemilu" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V12"/><path d="M10.3 7.6l1.2 1.2 2-2.3"/><rect x="3" y="12" width="18" height="8" rx="1.5"/><path d="M3 16h18"/></svg> Pemilu</button>
      <button id="tombol-pembangunan" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 22V4"/><path d="M7 4h13"/><path d="M7 9l6.5-5"/><path d="M17 4v5"/><rect x="15.4" y="9" width="3.2" height="3.2"/><path d="M3.5 22h10"/></svg> Pembangunan</button>
      <div class="pm-petunjuk">
        <b>Cara main</b>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> <b>Orbit</b> — seret untuk memutar, cubit/scroll untuk zoom.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> <b>1st Person</b> — joystick / WASD untuk jalan, seret untuk melihat sekeliling, Shift untuk lari.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.3" r="2.8"/><path d="M12 8.5V15"/><path d="M7.6 11.2L12 9.4l4.4 1.8"/><path d="M9.4 21L12 15l2.6 6"/></svg> <b>3rd Person</b> — karaktermu tampil dan terlihat berjalan dari belakang. Joystick / WASD untuk jalan, seret untuk memutar kamera mengelilingi karakter, scroll/cubit untuk mendekat-menjauhkan kamera.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="5" r="2.4"/><circle cx="19" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1"/><path d="M6.8 6.8l2.8 2.8M17.2 6.8l-2.8 2.8M6.8 17.2l2.8-2.8M17.2 17.2l-2.8-2.8"/></svg> <b>Drone</b> — joystick / WASD untuk terbang, R/F atau tombol naik-turun di layar untuk naik-turun.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/></svg> <b>Peta kecil</b> — tampil di kanan bawah saat mode jalan & drone: panahmu di tengah, titik biru = warga yang lagi online, penanda emas = rumahmu, titik warna-warni = rumah warga. Rumah hanya berdiri di kavling warga yang sudah daftar — sisanya masih lahan kosong. Ketuk petanya untuk membuka peta seluruh negara.</p>
        <p>Ketuk rumah di Distrik Pusat untuk melihat pemiliknya.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M2.5 22h19"/><circle cx="13.2" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg> <b>Masuk rumah</b> — dekati pintu rumah di Distrik Pusat pada mode 1st Person lalu ketuk, atau pakai tombol Masuk Rumah di kartu pemilik. Rumahmu sendiri bisa dimasuki dari Kartu Saya. Di dalam rumah kamu tetap jalan dengan kontrol 1st Person; keluar lewat pintu selatan atau tombol Keluar Rumah. Selama di dalam, warga lain melihat karaktermu menunggu di depan pintu.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> <b>Chat Istana Negara</b> — tombol chat di kanan atas. Warga lain yang sedang online tampil langsung di negara; karaktermu bergerak saat kamu jalan di mode 1st Person atau 3rd Person.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.4 17c.6-1.6 1.4-2.4 2.6-2.4s2 .8 2.6 2.4"/><path d="M14 9.5h5M14 13h5"/></svg> <b>KTP</b> — ketuk avatar profil di kanan atas → Kartu Saya, lalu ketuk Lihat KTP. Di sana KTP-mu bisa dilihat dan diunduh sebagai gambar PNG.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5v-2A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5v2"/><circle cx="17.5" cy="9.5" r="2.6"/><path d="M16 14.4a4.5 4.5 0 0 1 5.5 4.4v1.7"/></svg> <b>Kartu Keluarga</b> — tiap warga otomatis digabungkan server ke satu keluarga acak (maks 5 orang): yang mendirikan keluarga jadi Kepala Keluarga, sisanya Anggota. Lihat keluargamu dan unduh Kartu Keluarganya dari tombol Keluarga Saya di menu ini.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V12"/><path d="M10.3 7.6l1.2 1.2 2-2.3"/><rect x="3" y="12" width="18" height="8" rx="1.5"/><path d="M3 16h18"/></svg> <b>Pemilu</b> — dari tombol Pemilu di menu ini: pemilu pertama dibuka setelah <b>10.000 warga</b> terdaftar; sesudah itu, saat Pak Presiden membuka periode, warga bisa mencalonkan diri jadi Ketua RT, Ketua RW, atau Presiden (wajib isi visi & misi) dan memilih kandidat di wilayah rumahnya. Pemenangnya memegang jabatan dan jabatannya tampil di label karakter serta KTP.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 22V4"/><path d="M7 4h13"/><path d="M7 9l6.5-5"/><path d="M17 4v5"/><rect x="15.4" y="9" width="3.2" height="3.2"/><path d="M3.5 22h10"/></svg> <b>Pembangunan negara</b> — negara ini mulai hanya dari Istana Negara. Fasilitas lain (taman, pasar, masjid, sekolah, dan lainnya) berdiri satu per satu dari usulan warga di komentar Instagram @negaramerdu; yang memutuskan Pak Presiden. Daftar fasilitas, biaya kas negaranya, dan yang sudah berdiri bisa dilihat dari tombol Pembangunan di menu ini.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> <b>Kualitas grafik</b> — atur di menu ini: <b>Otomatis</b> menyesuaikan dengan kemampuan HP kamu (turun sendiri kalau berat, naik lagi kalau lancar), <b>Rendah</b> paling hemat, <b>Tinggi</b> paling bagus. Pilihanmu tersimpan di HP ini.</p>
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> <b>Waktu negara</b> — atur cahaya negara di menu ini: <b>Siang</b> terang, <b>Senja</b> golden hour (bawaan), <b>Malam</b> lampu jalan dan jendela istana menyala plus bintang, <b>Siklus</b> berganti sendiri perlahan. Warga di plaza juga beraktivitas: ada yang mengobrol, duduk di bangku, dan membawa barang — dan Pak Presiden melambai kalau kamu dekat.</p>
      </div>
      <a class="pm-ig" href="https://instagram.com/negaramerdu" target="_blank" rel="noopener"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none"/></svg> Instagram @negaramerdu</a>
    </div>
  </div>
  <div id="indikator-kualitas" hidden></div>
  <canvas id="minimap" width="240" height="240" hidden aria-label="Peta kecil negara — ketuk untuk membuka peta besar"></canvas>
  <div id="bar-bawah">
    <div id="petunjuk"><span id="petunjuk-teks">Seret untuk memutar · Cubit/scroll untuk zoom</span><button id="tutup-petunjuk" type="button" aria-label="Tutup petunjuk">✕</button></div>
    <div id="mode-bar" role="group" aria-label="Mode kamera">
      <button type="button" data-mode="orbit" class="on"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Orbit</button>
      <button type="button" data-mode="orang"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> 1st Person</button>
      <button type="button" data-mode="ketiga"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5.3" r="2.8"/><path d="M12 8.5V15"/><path d="M7.6 11.2L12 9.4l4.4 1.8"/><path d="M9.4 21L12 15l2.6 6"/></svg> 3rd Person</button>
      <button type="button" data-mode="drone"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="5" r="2.4"/><circle cx="19" cy="5" r="2.4"/><circle cx="5" cy="19" r="2.4"/><circle cx="19" cy="19" r="2.4"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1"/><path d="M6.8 6.8l2.8 2.8M17.2 6.8l-2.8 2.8M6.8 17.2l2.8-2.8M17.2 17.2l-2.8-2.8"/></svg> Drone</button>
    </div>
  </div>
  <div id="joystick" hidden><div class="knob"></div></div>
  <div id="drone-naik-turun" hidden>
    <button type="button" id="tombol-naik" aria-label="Terbang naik"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l7 11H5z"/></svg></button>
    <button type="button" id="tombol-turun" aria-label="Terbang turun"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 18L5 7h14z"/></svg></button>
  </div>
  <div id="kartu" hidden role="dialog" aria-live="polite">
    <button class="tutup" type="button" aria-label="Tutup">✕</button>
    <div class="isi"></div>
  </div>
  <div id="chip-aksi" hidden>
    <span id="chip-aksi-teks"></span>
    <button id="chip-aksi-tombol" type="button">Masuk Rumah</button>
  </div>
  <button id="tombol-keluar-rumah" type="button" hidden><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 22V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v17"/><path d="M2.5 22h19"/><circle cx="13.2" cy="12" r="0.8" fill="currentColor" stroke="none"/></svg> Keluar Rumah</button>
</div>

<div id="peta-besar" hidden>
  <div class="peta-kartu">
    <div class="peta-judul"><b><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/><path d="M8 2v16"/><path d="M16 6v16"/></svg> Peta Negara Merdu</b><button id="tutup-peta" type="button" aria-label="Tutup peta">✕</button></div>
    <canvas id="peta-kanvas" width="1344" height="840"></canvas>
    <div class="peta-legenda">
      <span><i class="lg lg-kamu"></i>Kamu</span>
      <span><i class="lg lg-rumah"></i>Rumahmu</span>
      <span><i class="lg lg-rumahwarga"></i>Rumah warga (titik warna pemilik)</span>
      <span><i class="lg lg-balai"></i>Istana Negara</span>
      <span><i class="lg lg-warga"></i>Warga online</span>
      <span><i class="lg lg-fasilitas"></i>Fasilitas terbangun</span>
      <span><i class="lg lg-lahan"></i>Lahan pembangunan</span>
    </div>
  </div>
</div>

<div id="gerbang" hidden>
  <div class="kartu-form">
    <section data-langkah="nama">
      <div class="judul">Selamat datang di<br>Negara Merdu</div>
      <p>Masuk sebagai warga negara pakai username Instagram kamu. Warga yang terdaftar dapat rumah dan karakternya jalan-jalan di negara ini.</p>
      <form id="form-nama" novalidate>
        <label for="isi-nama">Username Instagram</label>
        <div class="isian"><span>@</span><input id="isi-nama" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="31" placeholder="username"></div>
        <div class="salah" id="salah-nama" role="alert"></div>
        <button class="utama" type="submit">Lanjut</button>
      </form>
      <button class="tautan" id="ke-login" type="button">Sudah punya Kartu Warga Negara? Masuk di sini</button>
    </section>

    <section data-langkah="follow" hidden>
      <div class="judul">Satu langkah lagi</div>
      <p>Negara ini untuk warga <b>@negaramerdu</b>. Follow dulu akun negaranya, lalu kembali ke halaman ini.</p>
      <a class="utama ig" href="https://instagram.com/negaramerdu" target="_blank" rel="noopener">Follow @negaramerdu</a>
      <button id="sudah-follow" class="kedua" type="button">Sudah follow, lanjut</button>
      <button class="tautan" type="button" data-ganti>Ganti username</button>
    </section>

    <section data-langkah="kartu" hidden>
      <div class="judul">Kartu Warga Negara</div>
      <p>Buat PIN 6 angka untuk masuk lagi nanti. PIN disimpan terenkripsi (hash), tidak bisa dilihat siapa pun, termasuk Pak Presiden.</p>
      <form id="form-kartu" novalidate>
        <label for="isi-pin">PIN 6 angka</label>
        <div class="isian pin"><input id="isi-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
        <label for="isi-pin2">Ulangi PIN</label>
        <div class="isian pin"><input id="isi-pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
        <div class="salah" id="salah-kartu" role="alert"></div>
        <button class="utama" type="submit">Lanjut atur rupa</button>
      </form>
      <button class="tautan" type="button" data-ganti>Ganti username</button>
    </section>

    <section data-langkah="rupa" hidden>
      <div class="judul">Atur rupa wargamu</div>
      <div class="pratinjau-rupa"><canvas id="pratinjau-karakter" width="320" height="360" aria-label="Pratinjau karakter"></canvas><span>Seret untuk memutar</span></div>
      <div class="grup-rupa">
        <span>Jenis kelamin</span>
        <div class="seg" id="seg-gender">
          <button type="button" data-gender="L">Laki-laki</button>
          <button type="button" data-gender="P">Perempuan</button>
        </div>
      </div>
      <div class="grup-rupa">
        <span>Warna baju</span>
        <div class="swatch" id="sw-baju"></div>
      </div>
      <div class="grup-rupa">
        <span>Warna kulit</span>
        <div class="swatch" id="sw-kulit"></div>
      </div>
      <div class="grup-rupa">
        <span>Topi</span>
        <div class="seg" id="seg-topi">
          <button type="button" data-topi="peci" class="on">Peci</button>
          <button type="button" data-topi="topi">Topi</button>
          <button type="button" data-topi="hijab">Hijab</button>
          <button type="button" data-topi="tanpa">Tanpa</button>
        </div>
      </div>
      <div class="grup-rupa">
        <span>Gaya rambut</span>
        <div class="seg seg-wrap" id="seg-rambut">
          <button type="button" data-rambut="pendek" class="on">Pendek</button>
          <button type="button" data-rambut="panjang">Panjang</button>
          <button type="button" data-rambut="kuncir">Kuncir</button>
          <button type="button" data-rambut="ikal">Ikal</button>
          <button type="button" data-rambut="botak">Botak</button>
        </div>
      </div>
      <div class="grup-rupa">
        <span>Warna rambut / hijab</span>
        <div class="swatch" id="sw-rambut"></div>
      </div>
      <div class="grup-rupa">
        <span>Warna celana / rok</span>
        <div class="swatch" id="sw-celana"></div>
      </div>
      <div class="grup-rupa">
        <span>Kacamata</span>
        <div class="seg" id="seg-kacamata">
          <button type="button" data-kacamata="tidak" class="on">Tidak</button>
          <button type="button" data-kacamata="ya">Pakai</button>
        </div>
      </div>
      <div class="grup-rupa">
        <span>Alis</span>
        <div class="seg" id="seg-alis">
          <button type="button" data-alis="tipis" class="on">Tipis</button>
          <button type="button" data-alis="tebal">Tebal</button>
        </div>
      </div>
      <div class="salah" id="salah-rupa" role="alert"></div>
      <button id="daftar-kirim" class="utama" type="button">Buat Kartu Warga Negara</button>
      <button class="tautan" type="button" data-ganti>Ganti username</button>
    </section>

    <section data-langkah="jadi" hidden>
      <div class="judul">Kartu Warga Negara jadi!</div>
      <div class="kartu-warga">
        <div class="kw-head"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> NEGARA MERDU</div>
        <div class="kw-user"></div>
        <div class="kw-rumah"></div>
        <div class="kw-gender"></div>
        <div class="kw-sub">Kartu Warga Negara resmi · @negaramerdu</div>
      </div>
      <p>Rumahmu sudah dibangun di negara dan karaktermu mulai jalan-jalan. Kamu juga resmi punya KTP Negara Merdu — lihat dan unduh kalau mau menyimpannya. Sampai jumpa di dalam!</p>
      <button id="lihat-ktp-jadi" class="kedua" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.4 17c.6-1.6 1.4-2.4 2.6-2.4s2 .8 2.6 2.4"/><path d="M14 9.5h5M14 13h5"/></svg> Lihat KTP Saya</button>
      <button id="masuk-desa" class="utama" type="button">Masuk negara</button>
    </section>

    <section data-langkah="login" hidden>
      <div class="judul">Masuk lagi</div>
      <p>Pakai username dan PIN Kartu Warga Negaramu.</p>
      <form id="form-login" novalidate>
        <label for="login-nama">Username Instagram</label>
        <div class="isian"><span>@</span><input id="login-nama" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="31" placeholder="username"></div>
        <label for="login-pin">PIN 6 angka</label>
        <div class="isian pin"><input id="login-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
        <div class="salah" id="salah-login" role="alert"></div>
        <button class="utama" type="submit">Masuk negara</button>
      </form>
      <button class="tautan" type="button" data-ganti>Belum punya Kartu Warga Negara? Daftar</button>
    </section>
  </div>
</div>

<div id="sambutan-overlay" hidden>
  <div class="sambutan-kartu">
    <img class="sambutan-foto" src="ikon-180.png" alt="Pak Presiden Negara Merdu">
    <div class="sambutan-dari"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 11.5L12 3.5l9.5 8z"/><path d="M5 12v8M9.5 12v8M14.5 12v8M19 12v8"/><path d="M3 20.5h18"/></svg> Sambutan Pak Presiden</div>
    <p id="sambutan-teks"></p>
    <button id="sambutan-masuk" type="button">Masuk Negara</button>
  </div>
</div>

<div id="ktp-overlay" hidden>
  <div class="ktp-kartu"><img id="ktp-gambar" alt="KTP Negara Merdu" draggable="false"></div>
  <div class="ktp-aksi">
    <button id="unduh-ktp" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11.5"/><path d="M6.3 10.2L12 15.9l5.7-5.7"/><path d="M4 20h16"/></svg> Unduh PNG</button>
    <button id="tutup-ktp" type="button">Tutup</button>
  </div>
</div>

<div id="keluarga-overlay" hidden>
  <div class="keluarga-kartu">
    <div class="keluarga-judul"><b><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20.5v-2A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5v2"/><circle cx="17.5" cy="9.5" r="2.6"/><path d="M16 14.4a4.5 4.5 0 0 1 5.5 4.4v1.7"/></svg> Keluarga Saya</b><button id="tutup-keluarga" type="button" aria-label="Tutup">✕</button></div>
    <div id="keluarga-isi"><p class="keluarga-muat">Memuat data keluarga…</p></div>
    <button id="lihat-kk" class="utama" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg> Lihat Kartu Keluarga</button>
  </div>
</div>

<div id="kk-overlay" hidden>
  <div class="kk-dokumen">
    <div class="kk-kepala">
      <svg class="kk-lambang" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="kkEmas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cd6b"/><stop offset="1" stop-color="#dd9a26"/></linearGradient></defs><path fill="url(#kkEmas)" stroke="#b97e14" stroke-width="2" d="M32 4 L60 28 H52 V58 H38 V42 H26 V58 H12 V28 H4 Z"/></svg>
      <div class="kk-judul">
        <div class="kk-judul-besar">KARTU KELUARGA</div>
        <div class="kk-judul-kecil">NEGARA MERDU</div>
      </div>
    </div>
    <div class="kk-info">
      <div class="kk-info-baris"><span>No. KK</span><b id="kk-nokk">—</b></div>
      <div class="kk-info-baris"><span>Kepala Keluarga</span><b id="kk-kepala">—</b></div>
      <div class="kk-info-baris"><span>Alamat</span><b id="kk-alamat">—</b></div>
      <div class="kk-info-baris"><span>RT/RW</span><b id="kk-rtrw">—</b></div>
      <div class="kk-info-baris"><span>Kel/Desa</span><b id="kk-kelurahan">—</b></div>
      <div class="kk-info-baris"><span>Kecamatan</span><b id="kk-kecamatan">—</b></div>
      <div class="kk-info-baris"><span>Kota</span><b id="kk-kota">—</b></div>
    </div>
    <table class="kk-tabel">
      <thead><tr><th>No</th><th>Nama</th><th>NIK</th><th>Hubungan</th><th>Terdaftar</th></tr></thead>
      <tbody id="kk-tbody"></tbody>
    </table>
    <div class="kk-ttd">
      <div class="kk-ttd-kolom"><span>Kepala Keluarga</span><b id="kk-ttd-kepala">—</b></div>
      <div class="kk-ttd-kolom"><span>Presiden Negara Merdu</span><b>Pak Presiden</b></div>
    </div>
    <div class="kk-kaki">NEGARA MERDU · KARTU KELUARGA · @negaramerdu</div>
  </div>
  <div class="kk-aksi">
    <button id="unduh-kk" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11.5"/><path d="M6.3 10.2L12 15.9l5.7-5.7"/><path d="M4 20h16"/></svg> Unduh KK (PNG)</button>
    <button id="tutup-kk" type="button">Tutup</button>
  </div>
</div>

<div id="pemilu-overlay" hidden>
  <div class="pemilu-kartu">
    <div class="pemilu-judul"><b><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V12"/><path d="M10.3 7.6l1.2 1.2 2-2.3"/><rect x="3" y="12" width="18" height="8" rx="1.5"/><path d="M3 16h18"/></svg> Pemilu Negara Merdu</b><button id="tutup-pemilu" type="button" aria-label="Tutup">✕</button></div>
    <div id="pemilu-isi"><p class="pemilu-muat">Memuat data pemilu…</p></div>
  </div>
</div>

<div id="pembangunan-overlay" hidden>
  <div class="pembangunan-kartu">
    <div class="pembangunan-judul"><b><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 22V4"/><path d="M7 4h13"/><path d="M7 9l6.5-5"/><path d="M17 4v5"/><rect x="15.4" y="9" width="3.2" height="3.2"/><path d="M3.5 22h10"/></svg> Pembangunan Negara</b><button id="tutup-pembangunan" type="button" aria-label="Tutup">✕</button></div>
    <div id="pembangunan-isi"><p class="pembangunan-muat">Memuat data pembangunan…</p></div>
  </div>
</div>

<div id="lengkapi-overlay" hidden>
  <div class="kartu-form">
    <div class="judul">Lengkapi Profilmu</div>
    <p id="lengkapi-teks">Akunmu dibuatkan lebih dulu oleh sistem. Sebelum jalan-jalan di negara, lengkapi dulu profilmu di sini.</p>
    <div id="lengkapi-pin-grup" hidden>
      <label for="lengkapi-pin">PIN baru 6 angka</label>
      <div class="isian pin"><input id="lengkapi-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
      <label for="lengkapi-pin2">Ulangi PIN baru</label>
      <div class="isian pin"><input id="lengkapi-pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
      <p class="lengkapi-catatan">PIN bawaanmu masih PIN standar pra-daftar — ganti sekarang supaya akunmu aman. PIN lama tidak berlaku lagi sesudah disimpan.</p>
    </div>
    <div class="grup-rupa">
      <span>Jenis kelamin</span>
      <div class="seg" id="seg-gender-l">
        <button type="button" data-gender="L">Laki-laki</button>
        <button type="button" data-gender="P">Perempuan</button>
      </div>
    </div>
    <div class="grup-rupa">
      <span>Warna baju</span>
      <div class="swatch" id="sw-baju-l"></div>
    </div>
    <div class="grup-rupa">
      <span>Warna kulit</span>
      <div class="swatch" id="sw-kulit-l"></div>
    </div>
    <div class="grup-rupa">
      <span>Topi</span>
      <div class="seg" id="seg-topi-l">
        <button type="button" data-topi="peci">Peci</button>
        <button type="button" data-topi="topi">Topi</button>
        <button type="button" data-topi="tanpa">Tanpa</button>
      </div>
    </div>
    <div class="salah" id="salah-lengkapi" role="alert"></div>
    <button id="lengkapi-kirim" class="utama" type="button">Simpan & Masuk Negara</button>
  </div>
</div>

<div id="muat">
  <svg class="panorama" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="mLangit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3f7fcf"/><stop offset=".45" stop-color="#8fc0ec"/>
          <stop offset=".72" stop-color="#ffd59b"/><stop offset="1" stop-color="#ffb27a"/>
        </linearGradient>
        <radialGradient id="mSinar" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#fff3c4" stop-opacity=".95"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffb27a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="mSawah" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8cc65f"/><stop offset="1" stop-color="#4f9a3c"/></linearGradient>
        <linearGradient id="mKabut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6c2" stop-opacity="0"/><stop offset="1" stop-color="#ffe6c2" stop-opacity=".75"/></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#mLangit)"/>
      <circle class="m-sinar" cx="800" cy="470" r="260" fill="url(#mSinar)"/>
      <circle cx="800" cy="470" r="62" fill="#ffe9a8"/>
      <g class="m-awan1" fill="#fff" opacity=".9"><ellipse cx="260" cy="190" rx="90" ry="24"/><ellipse cx="320" cy="170" rx="60" ry="26"/><ellipse cx="210" cy="178" rx="44" ry="18"/></g>
      <g class="m-awan2" fill="#fff" opacity=".75"><ellipse cx="1290" cy="140" rx="80" ry="20"/><ellipse cx="1340" cy="124" rx="50" ry="22"/></g>
      <g class="m-awan3" fill="#fff" opacity=".6"><ellipse cx="980" cy="250" rx="70" ry="16"/><ellipse cx="1020" cy="238" rx="40" ry="16"/></g>
      <g class="m-burung" fill="none" stroke="#2c3e50" stroke-width="3" stroke-linecap="round">
        <path d="M600 300 q10 -10 20 0 q10 -10 20 0"/><path d="M650 270 q8 -8 16 0 q8 -8 16 0"/><path d="M700 310 q7 -7 14 0 q7 -7 14 0"/>
      </g>
      <!-- pegunungan jauh (rendah-poli, seperti di dalam game) -->
      <path d="M0 560 L120 430 L210 500 L330 360 L450 520 L560 420 L660 540 L940 540 L1040 410 L1160 520 L1270 380 L1390 500 L1500 420 L1600 520 L1600 600 L0 600 Z" fill="#7d9d8a"/>
      <path d="M330 360 L390 440 L360 470 L300 400 Z M1270 380 L1320 450 L1290 480 L1240 410 Z M1040 410 L1080 470 L1010 450 Z" fill="#9db7a6"/>
      <path d="M330 360 L352 386 L338 392 L318 380 Z M1270 380 L1290 404 L1276 410 L1258 398 Z" fill="#f4f1ea"/>
      <path d="M0 600 L180 520 L340 575 L520 505 L700 580 L900 580 L1080 500 L1260 570 L1420 515 L1600 580 L1600 640 L0 640 Z" fill="#5f9a5a"/>
      <rect y="540" width="1600" height="110" fill="url(#mKabut)"/>
      <!-- kota: rumah warga mengapit istana -->
      <g><rect x="611" y="572" width="36" height="18" fill="#f6ead2"/><path d="M607 572 L629 558 L651 572 Z" fill="#b03a2e"/><rect x="624" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="559" y="582" width="34" height="18" fill="#f6ead2"/><path d="M555 582 L576 568 L597 582 Z" fill="#e67e22"/><rect x="571" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="498" y="572" width="35" height="18" fill="#f6ead2"/><path d="M494 572 L516 558 L538 572 Z" fill="#16a085"/><rect x="511" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="442" y="582" width="34" height="18" fill="#f6ead2"/><path d="M438 582 L459 568 L480 582 Z" fill="#8e44ad"/><rect x="454" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="374" y="572" width="35" height="18" fill="#f6ead2"/><path d="M370 572 L392 558 L414 572 Z" fill="#b03a2e"/><rect x="387" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="322" y="582" width="35" height="18" fill="#f6ead2"/><path d="M318 582 L340 568 L362 582 Z" fill="#8e44ad"/><rect x="335" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="256" y="572" width="42" height="18" fill="#f6ead2"/><path d="M252 572 L277 558 L302 572 Z" fill="#b03a2e"/><rect x="272" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="200" y="582" width="35" height="18" fill="#f6ead2"/><path d="M196 582 L218 568 L240 582 Z" fill="#8e44ad"/><rect x="213" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="153" y="572" width="34" height="18" fill="#f6ead2"/><path d="M149 572 L170 558 L191 572 Z" fill="#b03a2e"/><rect x="165" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="946" y="572" width="37" height="18" fill="#f6ead2"/><path d="M942 572 L964 558 L986 572 Z" fill="#c0392b"/><rect x="959" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1012" y="582" width="36" height="18" fill="#f6ead2"/><path d="M1008 582 L1030 568 L1052 582 Z" fill="#d35400"/><rect x="1025" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1068" y="572" width="36" height="18" fill="#f6ead2"/><path d="M1064 572 L1086 558 L1108 572 Z" fill="#e67e22"/><rect x="1081" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1128" y="582" width="38" height="18" fill="#f6ead2"/><path d="M1124 582 L1147 568 L1170 582 Z" fill="#2e7d4f"/><rect x="1142" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1178" y="572" width="37" height="18" fill="#f6ead2"/><path d="M1174 572 L1197 558 L1220 572 Z" fill="#16a085"/><rect x="1192" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1234" y="582" width="42" height="18" fill="#f6ead2"/><path d="M1230 582 L1255 568 L1280 582 Z" fill="#e67e22"/><rect x="1250" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1304" y="572" width="34" height="18" fill="#f6ead2"/><path d="M1300 572 L1321 558 L1342 572 Z" fill="#8e44ad"/><rect x="1316" y="578" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1356" y="582" width="42" height="18" fill="#f6ead2"/><path d="M1352 582 L1377 568 L1402 582 Z" fill="#b03a2e"/><rect x="1372" y="588" width="7" height="7" fill="#4a6a82"/></g><g><rect x="1420" y="572" width="39" height="18" fill="#f6ead2"/><path d="M1416 572 L1440 558 L1464 572 Z" fill="#1f618d"/><rect x="1435" y="578" width="7" height="7" fill="#4a6a82"/></g>
      <rect x="1290" y="480" width="54" height="110" fill="#e9dcc4"/><rect x="1290" y="476" width="54" height="6" fill="#c9a25a"/>
      <g fill="#6e8ca3"><rect x="1298" y="492" width="8" height="9"/><rect x="1314" y="492" width="8" height="9"/><rect x="1330" y="492" width="8" height="9"/><rect x="1298" y="508" width="8" height="9"/><rect x="1314" y="508" width="8" height="9"/><rect x="1330" y="508" width="8" height="9"/><rect x="1298" y="524" width="8" height="9"/><rect x="1314" y="524" width="8" height="9"/><rect x="1330" y="524" width="8" height="9"/><rect x="1298" y="540" width="8" height="9"/><rect x="1314" y="540" width="8" height="9"/><rect x="1330" y="540" width="8" height="9"/><rect x="1298" y="556" width="8" height="9"/><rect x="1314" y="556" width="8" height="9"/><rect x="1330" y="556" width="8" height="9"/><rect x="1298" y="572" width="8" height="9"/><rect x="1314" y="572" width="8" height="9"/><rect x="1330" y="572" width="8" height="9"/></g>
      <!-- istana negara -->
      <g>
        <rect x="660" y="540" width="280" height="56" fill="#fdf3d8"/><rect x="660" y="534" width="280" height="8" fill="#d9a441"/>
        <path d="M648 540 L700 516 L900 516 L952 540 Z" fill="#2e5d43"/>
        <rect x="740" y="496" width="120" height="44" fill="#fdf3d8"/>
        <path d="M728 498 L800 466 L872 498 Z" fill="#2e5d43"/>
        <path d="M772 466 A28 28 0 0 1 828 466 Z" fill="#2e5d43"/><rect x="772" y="464" width="56" height="4" fill="#d9a441"/>
        <circle cx="800" cy="434" r="5" fill="#d9a441"/><rect x="798.5" y="408" width="3" height="26" fill="#7a6248"/>
        <path class="m-bendera" d="M801.5 408 h30 v9 h-30 Z" fill="#d62828"/><path class="m-bendera" d="M801.5 417 h30 v9 h-30 Z" fill="#ffffff"/>
        <g fill="#fdf3d8"><rect x="752" y="540" width="8" height="56"/><rect x="772" y="540" width="8" height="56"/><rect x="792" y="540" width="8" height="56"/><rect x="812" y="540" width="8" height="56"/><rect x="832" y="540" width="8" height="56"/><rect x="852" y="540" width="8" height="56"/></g>
        <g fill="#4a6a82"><rect x="680" y="556" width="12" height="16"/><rect x="714" y="556" width="12" height="16"/><rect x="872" y="556" width="12" height="16"/><rect x="906" y="556" width="12" height="16"/></g>
        <rect x="788" y="566" width="24" height="30" fill="#7a4a21"/>
        <rect x="792" y="596" width="16" height="44" fill="#c8102e"/>
      </g>
      <!-- rel layang + KRL melintas -->
      <rect x="0" y="618" width="1600" height="10" fill="#9aa0a6"/><rect x="0" y="628" width="1600" height="4" fill="#6b7076"/>
      <g fill="#8a9096"><rect x="40" y="632" width="12" height="40"/><rect x="160" y="632" width="12" height="40"/><rect x="280" y="632" width="12" height="40"/><rect x="400" y="632" width="12" height="40"/><rect x="520" y="632" width="12" height="40"/><rect x="640" y="632" width="12" height="40"/><rect x="760" y="632" width="12" height="40"/><rect x="880" y="632" width="12" height="40"/><rect x="1000" y="632" width="12" height="40"/><rect x="1120" y="632" width="12" height="40"/><rect x="1240" y="632" width="12" height="40"/><rect x="1360" y="632" width="12" height="40"/><rect x="1480" y="632" width="12" height="40"/><rect x="1600" y="632" width="12" height="40"/></g>
      <g class="m-krl">
        <g><rect x="0" y="586" width="88" height="32" rx="5" fill="#f4f4f2"/><rect x="0" y="606" width="88" height="5" fill="#c8102e"/><g fill="#5b7d95"><rect x='8' y='592' width='14' height='10' rx='2'/><rect x='28' y='592' width='14' height='10' rx='2'/><rect x='48' y='592' width='14' height='10' rx='2'/><rect x='68' y='592' width='14' height='10' rx='2'/></g><rect x="92" y="586" width="88" height="32" rx="5" fill="#f4f4f2"/><rect x="92" y="606" width="88" height="5" fill="#c8102e"/><g fill="#5b7d95"><rect x='100' y='592' width='14' height='10' rx='2'/><rect x='120' y='592' width='14' height='10' rx='2'/><rect x='140' y='592' width='14' height='10' rx='2'/><rect x='160' y='592' width='14' height='10' rx='2'/></g><rect x="184" y="586" width="88" height="32" rx="5" fill="#f4f4f2"/><rect x="184" y="606" width="88" height="5" fill="#c8102e"/><g fill="#5b7d95"><rect x='192' y='592' width='14' height='10' rx='2'/><rect x='212' y='592' width='14' height='10' rx='2'/><rect x='232' y='592' width='14' height='10' rx='2'/><rect x='252' y='592' width='14' height='10' rx='2'/></g><rect x="276" y="586" width="88" height="32" rx="5" fill="#f4f4f2"/><rect x="276" y="606" width="88" height="5" fill="#c8102e"/><g fill="#5b7d95"><rect x='284' y='592' width='14' height='10' rx='2'/><rect x='304' y='592' width='14' height='10' rx='2'/><rect x='324' y='592' width='14' height='10' rx='2'/><rect x='344' y='592' width='14' height='10' rx='2'/></g>
        <path d="M368 586 h14 q14 0 20 16 v16 h-34 Z" fill="#c8102e"/></g>
      </g>
      <!-- sawah berundak -->
      <path d="M0 672 Q400 640 800 668 T1600 660 V900 H0 Z" fill="url(#mSawah)"/>
      <path d="M0 720 Q420 690 820 716 T1600 706" fill="none" stroke="#c9b04a" stroke-width="22" opacity=".55"/>
      <path d="M0 770 Q380 742 800 768 T1600 760" fill="none" stroke="#6fb04a" stroke-width="26" opacity=".7"/>
      <path d="M0 826 Q420 798 820 824 T1600 816" fill="none" stroke="#3f8a35" stroke-width="30" opacity=".6"/>
      <!-- jalan + bus Trans Merdu -->
      <path d="M0 690 Q800 676 1600 688 L1600 712 Q800 700 0 714 Z" fill="#5c6066"/>
      <path d="M0 702 Q800 688 1600 700" fill="none" stroke="#f2c230" stroke-width="2.5" stroke-dasharray="22 18"/>
      <g class="m-bus"><rect x="0" y="664" width="96" height="30" rx="6" fill="#c8102e"/><rect x="6" y="670" width="84" height="11" rx="2" fill="#bfe0ef"/><circle cx="20" cy="696" r="7" fill="#1c1c1e"/><circle cx="76" cy="696" r="7" fill="#1c1c1e"/><rect x="0" y="684" width="96" height="3" fill="#f2c230"/></g>
      <!-- kelapa di tepi bingkai -->
      <g fill="#3d2b1f"><path d="M96 900 Q116 740 150 640 l8 3 Q130 760 112 900 Z"/><path d="M1504 900 Q1486 760 1452 650 l-8 3 Q1470 770 1488 900 Z"/></g>
      <g class="m-daun" fill="#2f6b34"><path d="M154 640 q-80 -10 -120 30 q60 -20 120 -24 Z"/><path d="M154 640 q-30 -70 -90 -80 q50 30 82 82 Z"/><path d="M154 640 q50 -60 110 -60 q-60 20 -104 64 Z"/><path d="M154 640 q80 0 110 44 q-50 -26 -108 -40 Z"/></g>
      <g class="m-daun2" fill="#2f6b34"><path d="M1448 650 q80 -10 120 30 q-60 -20 -120 -24 Z"/><path d="M1448 650 q30 -70 90 -80 q-50 30 -82 82 Z"/><path d="M1448 650 q-50 -60 -110 -60 q60 20 104 64 Z"/><path d="M1448 650 q-80 0 -110 44 q50 -26 108 -40 Z"/></g>
    </svg>
    <div class="muat-panel">
      <div class="muat-merek">
        <svg class="lambang" viewBox="0 0 64 64" aria-hidden="true">
          <defs><linearGradient id="gradEmasMuat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cd6b"/><stop offset="1" stop-color="#dd9a26"/></linearGradient></defs>
          <circle cx="32" cy="32" r="30" fill="#7a1f1f"/>
          <path d="M32 11 L52 28 L46 28 L46 50 L37 50 L37 39 L27 39 L27 50 L18 50 L18 28 L12 28 Z" fill="url(#gradEmasMuat)" stroke="#b97e14" stroke-width="1.2"/>
        </svg>
        <div>
          <div class="judul">Negara Merdu</div>
          <div class="tagline">Kota virtual milik warganya · @negaramerdu</div>
        </div>
      </div>
      <div class="sub" id="muat-status">Menghubungi Istana Negara…</div>
      <div class="bar"><i id="muat-bar"></i></div>
      <div class="langkah" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
      <div class="tips" id="muat-tips">Tips: naik bus Trans Merdu di halte, lalu turun di plaza</div>
    </div>
</div>`;
