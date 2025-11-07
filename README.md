# Sistem Perpustakaan

Sistem manajemen perpustakaan dengan frontend modern dan backend Node.js + SQLite.

## Fitur

- Manajemen buku (tambah, cari, status)
- Pencatatan pengunjung/anggota
- Sistem peminjaman buku
- Dark mode & UI modern
- Database SQLite untuk penyimpanan data

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
- buku_id (FOREIGN KEY)
- anggota_id (FOREIGN KEY)
- tanggal_pinjam
- tanggal_kembali
- status ('dipinjam'/'kembali')

## API Endpoints

### Buku
- GET `/api/buku` - List semua buku (query: `q` untuk pencarian)
- POST `/api/buku` - Tambah buku baru

### Anggota
- GET `/api/anggota` - List semua anggota
- POST `/api/anggota` - Tambah anggota baru

### Peminjaman
- GET `/api/peminjaman` - List history peminjaman
- POST `/api/peminjaman` - Catat peminjaman baru
- POST `/api/peminjaman/:id/kembali` - Catat pengembalian buku

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: SQLite3
- UI: Custom CSS dengan dark mode support
