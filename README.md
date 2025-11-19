# Sistem Perpustakaan

Sistem manajemen perpustakaan dengan frontend modern dan backend Node.js + SQLite.

## Fitur

- **Manajemen Buku**: Tambah, cari, dan lihat status buku (tersedia/dipinjam)
- **Sistem Login Pengunjung**: Login/daftar anggota dengan status persistent (tidak perlu login ulang)
- **Peminjaman Buku**: Cari dan pilih buku tersedia, tentukan durasi peminjaman, auto-calculate jatuh tempo
- **Pengembalian Buku**: Cari buku yang sedang dipinjam, input tanggal kembali, auto-calculate denda (Rp 5.000/hari keterlambatan)
- **Pencarian Interaktif**: Input ketik dengan suggestions list untuk pemilihan buku
- **Dark Mode**: Toggle tema gelap/terang dengan sinkronisasi ke browser preferences
- **UI Modern**: Glassmorphism effects, smooth animations, responsive design
- **Database SQLite**: Penyimpanan data persistent dengan transaction support
- **Login Persistent**: Login tersimpan di localStorage, tetap aktif meski halaman di-reload

## Setup & Menjalankan

1. Install dependencies:
```bash
npm install
```

2. Jalankan server:
```bash
# Development mode dengan auto-reload
npm run dev

# Production mode
npm start
```

3. Buka aplikasi:
- Buka browser dan akses `http://localhost:3000`
- Database SQLite (`library.db`) akan dibuat otomatis

## Struktur Database

### Tabel `buku`
- id (PRIMARY KEY)
- kode (UNIQUE)
- judul
- penerbit
- tahun
- tanggal_masuk
- status ('tersedia'/'dipinjam')

### Tabel `anggota`
- id (PRIMARY KEY)
- nama
- kelas
- tanggal_daftar

### Tabel `peminjaman`
- id (PRIMARY KEY)
- buku_id (FOREIGN KEY → buku)
- anggota_id (FOREIGN KEY → anggota)
- tanggal_pinjam (default: CURRENT_DATE)
- durasi_pinjam (durasi peminjaman dalam hari, default: 7)
- tanggal_kembali_direncanakan (otomatis dihitung dari tanggal_pinjam + durasi_pinjam)
- tanggal_kembali (tanggal kembali aktual, null sampai dikembalikan)
- status ('dipinjam'/'kembali')
- denda (total denda jika terlambat, Rp 5.000 per hari)

## API Endpoints

### Buku
- `GET /api/buku` - List semua buku (query: `q` untuk pencarian berdasarkan kode/judul/penerbit)
- `GET /api/buku-tersedia` - List buku yang tersedia (status='tersedia')
- `POST /api/buku` - Tambah buku baru (kode, judul, penerbit, tahun, tanggal_masuk)

### Anggota
- `GET /api/anggota` - List semua anggota
- `POST /api/anggota` - Tambah anggota baru (nama, kelas)

### Peminjaman
- `GET /api/peminjaman` - List semua history peminjaman (dengan detail buku & anggota)
- `GET /api/peminjaman-aktif` - List peminjaman aktif (status='dipinjam') dengan detail buku & anggota
- `GET /api/anggota/:id/peminjaman-aktif` - List peminjaman aktif untuk anggota tertentu
- `POST /api/peminjaman` - Catat peminjaman baru (buku_id, anggota_id, durasi_pinjam)
  - Response: `{ id, message, tanggal_kembali_direncanakan }`
- `POST /api/peminjaman/:id/kembali` - Catat pengembalian buku (tanggal_kembali)
  - Response: `{ message, daysLate, denda, dendaRp }`

## Tech Stack

- **Frontend**: HTML5, CSS3 (Glassmorphism, Dark Mode), JavaScript (ES6+, Fetch API)
- **Backend**: Node.js, Express.js
- **Database**: SQLite3 (dengan transaction support)
- **Icons**: Font Awesome 6.4.2
- **Storage**: localStorage untuk persistent login
- **UI**: Custom CSS dengan CSS variables untuk theming, responsive design

## Cara Menggunakan

### Login & Navigasi
1. Klik tombol "Login Pengunjung" di navbar
2. Masukkan nama Anda (wajib) dan kelas (opsional)
3. Klik "Login / Daftar" untuk login atau mendaftar sebagai anggota baru
4. Setelah login, modal akan menampilkan menu dengan opsi:
   - **Pinjam Buku**: Cari buku tersedia dengan auto-suggest, tentukan durasi, lihat jatuh tempo
   - **Kembalikan Buku**: Cari buku yang sedang dipinjam, tentukan tanggal kembali, lihat perhitungan denda otomatis
   - **Logout**: Keluar dari akun dan kembali ke form login

### Menu Tambahan di Navbar
- **Input Buku**: Tambah buku baru ke sistem (kode, judul, penerbit, tahun)
- **Sistem Pencarian**: Cari buku berdasarkan kode/judul/penerbit dengan highlight hasil
- **Theme Toggle**: Ubah antara dark mode dan light mode (tersimpan di browser)

### Fitur Pencarian & Suggestions
- Pencarian buku untuk peminjaman: ketik kode atau judul → daftar saran muncul otomatis
- Pencarian buku untuk pengembalian: ketik kode atau judul → daftar buku yang sedang dipinjam muncul
- Klik salah satu saran untuk memilih

### Kalkulasi Denda
- Denda otomatis dihitung: Rp 5.000 × jumlah hari keterlambatan
- Contoh: jatuh tempo 18 Nov, kembali 21 Nov → 3 hari terlambat → denda Rp 15.000
- Jika tepat waktu → "Tidak ada denda"

### Login Persistent
- Login tersimpan dalam localStorage browser
- Reload halaman → tetap login tanpa perlu masuk ulang
- Logout → hapus login dari localStorage dan kembali ke form login
