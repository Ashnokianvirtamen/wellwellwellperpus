const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

// Database setup
const db = new sqlite3.Database('library.db', (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to SQLite database');
    initDatabase();
  }
});

//database 
function initDatabase() {
  db.serialize(() => {
    // Buku table
    db.run(`CREATE TABLE IF NOT EXISTS buku (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      judul TEXT NOT NULL,
      penerbit TEXT,
      tahun INTEGER,
      tanggal_masuk DATE,
      status TEXT DEFAULT 'tersedia' CHECK(status IN ('tersedia', 'dipinjam'))
    )`);

    // Pengunjung
    db.run(`CREATE TABLE IF NOT EXISTS anggota (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT NOT NULL,
      kelas TEXT,
      tanggal_daftar DATE DEFAULT CURRENT_DATE
    )`);

    // Peminjaman
    db.run(`CREATE TABLE IF NOT EXISTS peminjaman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buku_id INTEGER,
      anggota_id INTEGER,
      tanggal_pinjam DATE DEFAULT CURRENT_DATE,
      tanggal_kembali DATE,
      status TEXT DEFAULT 'dipinjam' CHECK(status IN ('dipinjam', 'kembali')),
      FOREIGN KEY (buku_id) REFERENCES buku (id),
      FOREIGN KEY (anggota_id) REFERENCES anggota (id)
    )`);
  });
}

// API
app.get('/api/buku', (req, res) => {
  const query = req.query.q || '';
  db.all(
    `SELECT * FROM buku WHERE 
     kode LIKE ? OR 
     judul LIKE ? OR 
     penerbit LIKE ? 
     ORDER BY tanggal_masuk DESC`,
    [`%${query}%`, `%${query}%`, `%${query}%`],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.post('/api/buku', (req, res) => {
  const { kode, judul, penerbit, tahun, tanggal_masuk } = req.body;
  if (!kode || !judul) {
    res.status(400).json({ error: 'Kode dan judul wajib diisi' });
    return;
  }

  db.run(
    `INSERT INTO buku (kode, judul, penerbit, tahun, tanggal_masuk) 
     VALUES (?, ?, ?, ?, ?)`,
    [kode, judul, penerbit, tahun, tanggal_masuk],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Kode buku sudah ada' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      res.json({ id: this.lastID, message: 'Buku berhasil ditambahkan' });
    }
  );
});

// API Pengunjung
app.get('/api/anggota', (req, res) => {
  db.all('SELECT * FROM anggota ORDER BY tanggal_daftar DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/anggota', (req, res) => {
  const { nama, kelas } = req.body;
  if (!nama) {
    res.status(400).json({ error: 'Nama wajib diisi' });
    return;
  }

  db.run(
    'INSERT INTO anggota (nama, kelas) VALUES (?, ?)',
    [nama, kelas],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Anggota berhasil ditambahkan' });
    }
  );
});

// API Peminjaman
app.post('/api/peminjaman', (req, res) => {
  const { buku_id, anggota_id } = req.body;
  if (!buku_id || !anggota_id) {
    res.status(400).json({ error: 'ID buku dan anggota wajib diisi' });
    return;
  }

  db.serialize(() => {
    db.get('SELECT status FROM buku WHERE id = ?', [buku_id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Buku tidak ditemukan' });
        return;
      }
      if (row.status === 'dipinjam') {
        res.status(400).json({ error: 'Buku sedang dipinjam' });
        return;
      }

      db.run('BEGIN TRANSACTION');
      db.run(
        'INSERT INTO peminjaman (buku_id, anggota_id) VALUES (?, ?)',
        [buku_id, anggota_id],
        function(err) {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }

          db.run(
            'UPDATE buku SET status = ? WHERE id = ?',
            ['dipinjam', buku_id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }

              db.run('COMMIT');
              res.json({ 
                id: this.lastID, 
                message: 'Peminjaman berhasil dicatat' 
              });
            }
          );
        }
      );
    });
  });
});

app.post('/api/peminjaman/:id/kembali', (req, res) => {
  const id = req.params.id;
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    db.run(
      `UPDATE peminjaman 
       SET status = 'kembali', tanggal_kembali = CURRENT_DATE 
       WHERE id = ? AND status = 'dipinjam'`,
      [id],
      function(err) {
        if (err) {
          db.run('ROLLBACK');
          res.status(500).json({ error: err.message });
          return;
        }
        if (this.changes === 0) {
          db.run('ROLLBACK');
          res.status(404).json({ error: 'Peminjaman tidak ditemukan atau sudah dikembalikan' });
          return;
        }

        db.get('SELECT buku_id FROM peminjaman WHERE id = ?', [id], (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: err.message });
            return;
          }

          db.run(
            "UPDATE buku SET status = 'tersedia' WHERE id = ?",
            [row.buku_id],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
              }

              db.run('COMMIT');
              res.json({ message: 'Buku berhasil dikembalikan' });
            }
          );
        });
      }
    );
  });
});

app.get('/api/peminjaman', (req, res) => {
  db.all(
    `SELECT p.*, b.kode, b.judul, a.nama as peminjam
     FROM peminjaman p
     JOIN buku b ON p.buku_id = b.id
     JOIN anggota a ON p.anggota_id = a.id
     ORDER BY p.tanggal_pinjam DESC`,
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});