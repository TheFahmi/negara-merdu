/* Markup halaman utama Negara Merdu — dipindah APA ADANYA dari body
   public/index.html lama (migrasi Next.js 22 Nov 2026). Dirender lewat
   dangerouslySetInnerHTML supaya struktur DOM identik persis; kode game
   di ../game/*.js memanipulasinya langsung seperti dulu. */
export const MARKUP = `<canvas id="kanvas"></canvas>

<div id="hud" hidden>
  <div id="zona-atas">
    <div class="baris-kepala">
      <div class="info">
        <b>Negara Merdu</b>
        <span id="info-sub">@negaramerdu</span>
      </div>
      <div class="tombol-atas">
        <button id="tombol-chat" type="button" aria-label="Buka chat Istana Negara"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span id="lencana-chat" hidden>0</span></button>
        <button id="tombol-menu" type="button" aria-label="Buka menu">☰</button>
        <button id="tombol-akun" type="button">Masuk / Daftar</button>
      </div>
    </div>
    <div class="baris-stat">
      <span class="chip-stat"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> <b id="stat-warga">0</b> warga</span>
      <span class="chip-stat"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg> <b id="stat-rumah">0 / 100.000</b></span>
    </div>
    <div id="chip-saya" hidden>
      <span id="chip-saya-teks"></span>
      <button id="tombol-keluar" type="button">Keluar</button>
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
        <p><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5.4 17c.6-1.6 1.4-2.4 2.6-2.4s2 .8 2.6 2.4"/><path d="M14 9.5h5M14 13h5"/></svg> <b>KTP</b> — buka Kartu Saya (tombol kanan atas) lalu ketuk Lihat KTP. Di sana KTP-mu bisa dilihat dan diunduh sebagai gambar PNG.</p>
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
          <button type="button" data-topi="tanpa">Tanpa</button>
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
  <div class="ktp-kartu">
    <div class="ktp-kepala">
      <svg class="ktp-lambang" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="ktpEmas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6cd6b"/><stop offset="1" stop-color="#dd9a26"/></linearGradient></defs><path fill="url(#ktpEmas)" stroke="#b97e14" stroke-width="2" d="M32 4 L60 28 H52 V58 H38 V42 H26 V58 H12 V28 H4 Z"/></svg>
      <div class="ktp-judul">
        <div class="ktp-judul-besar">KARTU TANDA PENDUDUK</div>
        <div class="ktp-judul-kecil">NEGARA MERDU · KOTA MERDU</div>
      </div>
      <div class="ktp-foto-label">FOTO</div>
    </div>
    <div class="ktp-badan">
      <div class="ktp-data">
        <div class="ktp-baris"><span>NIK</span><b id="ktp-nik">—</b></div>
        <div class="ktp-baris"><span>Nama</span><b id="ktp-nama">—</b></div>
        <div class="ktp-baris"><span>Jenis Kelamin</span><b id="ktp-gender">—</b></div>
        <div class="ktp-baris"><span>Alamat</span><b id="ktp-alamat">—</b></div>
        <div class="ktp-baris"><span>RT/RW</span><b id="ktp-rtrw">—</b></div>
        <div class="ktp-baris"><span>Kel/Desa</span><b id="ktp-kelurahan">—</b></div>
        <div class="ktp-baris"><span>Kecamatan</span><b id="ktp-kecamatan">—</b></div>
        <div class="ktp-baris"><span>Terdaftar</span><b id="ktp-terdaftar">—</b></div>
        <div class="ktp-baris" id="ktp-baris-jabatan" hidden><span>Jabatan</span><b id="ktp-jabatan">—</b></div>
        <div class="ktp-baris"><span>Berlaku</span><b>Seumur Hidup</b></div>
      </div>
      <div class="ktp-foto"><canvas id="ktp-foto-kanvas" width="320" height="440"></canvas></div>
    </div>
    <div class="ktp-kaki">NEGARA MERDU · KARTU TANDA PENDUDUK · @negaramerdu</div>
  </div>
  <div class="ktp-aksi">
    <button id="unduh-ktp" type="button"><svg class="ik" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11.5"/><path d="M6.3 10.2L12 15.9l5.7-5.7"/><path d="M4 20h16"/></svg> Unduh KTP (PNG)</button>
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
  <div class="kotak">
    <svg class="adegan" viewBox="0 0 320 190" aria-hidden="true">
      <circle class="halo" cx="160" cy="44" r="29" fill="#f6cd6b" opacity="0.25"/>
      <circle cx="160" cy="44" r="19" fill="#f6cd6b"/>
      <circle cx="160" cy="44" r="13" fill="#ffe1a0"/>
      <g class="awan1" fill="#ffffff" opacity="0.85">
        <ellipse cx="54" cy="32" rx="20" ry="7"/>
        <ellipse cx="68" cy="26" rx="12" ry="6"/>
      </g>
      <g class="awan2" fill="#ffffff" opacity="0.7">
        <ellipse cx="262" cy="22" rx="16" ry="6"/>
        <ellipse cx="273" cy="17" rx="10" ry="5"/>
      </g>
      <path d="M0 150 Q90 133 175 143 T320 141 V190 H0 Z" fill="#a5c98c"/>
      <g>
        <rect x="88.8" y="138" width="2.4" height="9" fill="#8a5a30"/>
        <circle cx="90" cy="131" r="7.5" fill="#4da653"/>
        <circle cx="83.5" cy="135" r="5" fill="#4da653"/>
        <circle cx="96.5" cy="135" r="5" fill="#4da653"/>
      </g>
      <g>
        <rect x="228.8" y="138" width="2.4" height="9" fill="#8a5a30"/>
        <circle cx="230" cy="131" r="7.5" fill="#4da653"/>
        <circle cx="223.5" cy="135" r="5" fill="#4da653"/>
        <circle cx="236.5" cy="135" r="5" fill="#4da653"/>
      </g>
      <g>
        <rect x="61" y="117" width="4.5" height="8" fill="#a9743f"/>
        <path d="M33 129 L53 114 L73 129 Z" fill="#c05a34"/>
        <rect x="38" y="129" width="30" height="20" fill="#f6e3c5"/>
        <rect x="41.5" y="134" width="6" height="6" fill="#39566b"/>
        <rect x="49.5" y="139" width="7" height="10" fill="#7a4a21"/>
      </g>
      <g>
        <path d="M247 129 L267 114 L287 129 Z" fill="#2e5d43"/>
        <rect x="252" y="129" width="30" height="20" fill="#f3e9cf"/>
        <rect x="272.5" y="134" width="6" height="6" fill="#39566b"/>
        <rect x="263.5" y="139" width="7" height="10" fill="#7a4a21"/>
      </g>
      <g>
        <rect x="100" y="131" width="36" height="19" fill="#fdf3d8"/>
        <rect x="184" y="131" width="36" height="19" fill="#fdf3d8"/>
        <rect x="100" y="129.4" width="36" height="1.8" fill="#d9a441"/>
        <rect x="184" y="129.4" width="36" height="1.8" fill="#d9a441"/>
        <path d="M97 131 L118 119 L139 131 Z" fill="#2e5d43"/>
        <path d="M181 131 L202 119 L223 131 Z" fill="#2e5d43"/>
        <rect x="114" y="137" width="7" height="7" fill="#39566b"/>
        <rect x="199" y="137" width="7" height="7" fill="#39566b"/>
        <rect x="136" y="117" width="48" height="33" fill="#fdf3d8"/>
        <rect x="136" y="115.2" width="48" height="2" fill="#d9a441"/>
        <path d="M131 117 L160 100 L189 117 Z" fill="#2e5d43"/>
        <rect x="142" y="125" width="5.5" height="7.5" fill="#39566b"/>
        <rect x="172.5" y="125" width="5.5" height="7.5" fill="#39566b"/>
        <rect x="155.8" y="136" width="8.4" height="14" fill="#7a4a21"/>
        <rect x="146.5" y="91" width="27" height="13" fill="#fdf3d8"/>
        <rect x="146.5" y="89.4" width="27" height="1.8" fill="#d9a441"/>
        <path d="M143 91 L160 80 L177 91 Z" fill="#2e5d43"/>
        <path d="M151.5 80 A8.5 8.5 0 0 1 168.5 80 Z" fill="#2e5d43"/>
        <rect x="159.3" y="68.5" width="1.4" height="3.5" fill="#d9a441"/>
        <circle cx="160" cy="66.8" r="2.1" fill="#d9a441"/>
        <rect x="159.45" y="54" width="1.1" height="12.5" fill="#7a6248"/>
        <rect x="160.6" y="54" width="11.5" height="7" fill="#2e5d43" stroke="#d9a441" stroke-width="0.5"/>
        <circle cx="166.3" cy="57.5" r="1.9" fill="#d9a441"/>
        <circle cx="129" cy="146" r="4.5" fill="#5da85f"/>
        <circle cx="191" cy="146" r="4.5" fill="#5da85f"/>
        <path d="M149 150 L171 150 L175 154.5 L145 154.5 Z" fill="#d9c58f"/>
      </g>
      <path d="M0 159 Q160 151 320 159 V190 H0 Z" fill="#7fae5f"/>
      <path d="M147 152.5 L173 152.5 L196 190 L124 190 Z" fill="#66766a"/>
      <clipPath id="klipJalan"><path d="M147 152.5 L173 152.5 L196 190 L124 190 Z"/></clipPath>
      <g clip-path="url(#klipJalan)">
        <g class="garis-jalan" fill="#fff8dc">
          <rect x="157.9" y="146" width="2.6" height="7"/>
          <rect x="157.5" y="160" width="3.4" height="8.5"/>
          <rect x="157" y="176" width="4.6" height="10.5"/>
        </g>
      </g>
    </svg>
    <svg class="lambang" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="gradEmasMuat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6cd6b"/>
          <stop offset="1" stop-color="#dd9a26"/>
        </linearGradient>
      </defs>
      <path d="M32 4 L60 28 L52 28 L52 58 L38 58 L38 42 L26 42 L26 58 L12 58 L12 28 L4 28 Z" fill="url(#gradEmasMuat)" stroke="#b97e14" stroke-width="1.4"/>
    </svg>
    <div class="judul">Negara Merdu</div>
    <div class="sub" id="muat-status">Menghubungi Istana Negara…</div>
    <div class="bar"><i id="muat-bar"></i></div>
  </div>
</div>`;
