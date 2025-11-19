const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// setup database
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
      status TEXT DEFAULT 'tersedia' CHECK(status IN ('tersedia', 'dipinjam')),
      approved INTEGER DEFAULT 1
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
      durasi_pinjam INTEGER DEFAULT 7,
      tanggal_kembali_direncanakan DATE,
      tanggal_kembali DATE,
      status TEXT DEFAULT 'dipinjam' CHECK(status IN ('dipinjam', 'kembali')),
      denda INTEGER DEFAULT 0,
      FOREIGN KEY (buku_id) REFERENCES buku (id),
      FOREIGN KEY (anggota_id) REFERENCES anggota (id)
    );`);

    db.all("PRAGMA table_info(buku)", (err, cols) => {
      if (err) {
        console.error('Failed to check buku columns for migration:', err);
        return;
      }
      const hasApproved = Array.isArray(cols) && cols.some(c => c && c.name === 'approved');
      if (!hasApproved) {
        console.log('Migrating DB: adding `approved` column to buku');
        db.run("ALTER TABLE buku ADD COLUMN approved INTEGER DEFAULT 1", (alterErr) => {
          if (alterErr) console.error('Failed to add approved column:', alterErr);
          else console.log('Migration complete: added `approved` column to buku');
        });
      }
    });
  });
}

// API
// Get buku tersedia
app.get('/api/buku-tersedia', (req, res) => {
  db.all(
    "SELECT * FROM buku WHERE status = 'tersedia' AND approved = 1 ORDER BY kode",
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Get peminjaman aktif
app.get('/api/peminjaman-aktif', (req, res) => {
  db.all(
    `SELECT p.*, b.kode, b.judul, b.penerbit, b.tahun, a.nama as peminjam
     FROM peminjaman p
     JOIN buku b ON p.buku_id = b.id
     JOIN anggota a ON p.anggota_id = a.id
     WHERE p.status = 'dipinjam'
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

app.get('/api/buku', (req, res) => {
  const query = req.query.q || '';
  // hanya tampilkan semua buku jika admin=1
  const adminView = req.query.admin === '1';
  const baseSql = `SELECT * FROM buku WHERE (kode LIKE ? OR judul LIKE ? OR penerbit LIKE ?) ${adminView ? '' : 'AND approved = 1'} ORDER BY tanggal_masuk DESC`;
  db.all(
    baseSql,
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
  const approved = req.query.admin === '1' ? 1 : 0;
  db.run(
    `INSERT INTO buku (kode, judul, penerbit, tahun, tanggal_masuk, approved) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [kode, judul, penerbit, tahun, tanggal_masuk, approved],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(400).json({ error: 'Kode buku sudah ada' });
        } else {
          res.status(500).json({ error: err.message });
        }
        return;
      }
      const msg = approved ? 'Buku berhasil ditambahkan' : 'Buku dikirim untuk persetujuan admin';
      res.json({ id: this.lastID, message: msg });
    }
  );
});

// list buku pending approval
app.get('/api/buku-pending', (req, res) => {
  db.all(
    "SELECT * FROM buku WHERE approved = 0 ORDER BY tanggal_masuk DESC",
    (err, rows) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      res.json(rows);
    }
  );
});

// setujui buku
app.post('/api/buku/:id/approve', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE buku SET approved = 1 WHERE id = ?', [id], function(err){
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Buku disetujui', id });
  });
});

// Update buku
app.put('/api/buku/:id', (req, res) => {
  const id = req.params.id;
  const { kode, judul, penerbit, tahun, tanggal_masuk, approved } = req.body;
  const fields = [];
  const values = [];
  if (kode !== undefined) { fields.push('kode = ?'); values.push(kode); }
  if (judul !== undefined) { fields.push('judul = ?'); values.push(judul); }
  if (penerbit !== undefined) { fields.push('penerbit = ?'); values.push(penerbit); }
  if (tahun !== undefined) { fields.push('tahun = ?'); values.push(tahun); }
  if (tanggal_masuk !== undefined) { fields.push('tanggal_masuk = ?'); values.push(tanggal_masuk); }
  if (approved !== undefined) { fields.push('approved = ?'); values.push(approved ? 1 : 0); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);
  const sql = `UPDATE buku SET ${fields.join(', ')} WHERE id = ?`;
  db.run(sql, values, function(err){
    if (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Kode buku sudah ada' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Buku diperbarui', id });
  });
});

// Reject buku (hapus)
app.post('/api/buku/:id/reject', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM buku WHERE id = ? AND approved = 0', [id], function(err){
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Buku ditolak dan dihapus jika pending', id });
  });
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
  const { buku_id, anggota_id, durasi_pinjam } = req.body;
  console.log('POST /api/peminjaman body:', req.body);
  const durasi = durasi_pinjam || 7; // default 7 hari
  
  if (!buku_id || !anggota_id) {
    res.status(400).json({ error: 'ID buku dan anggota wajib diisi' });
    return;
  }

  db.serialize(() => {
    // Cek anggota tersedia
    db.get('SELECT id FROM anggota WHERE id = ?', [anggota_id], (err, anggota) => {
      if (err || !anggota) {
        res.status(404).json({ error: 'Anggota tidak ditemukan' });
        return;
      }

      // cek buku tersedia
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

        const today = new Date();
        const plannedReturn = new Date(today.getTime() + durasi * 24 * 60 * 60 * 1000);
        const plannedReturnStr = plannedReturn.toISOString().split('T')[0];

        db.run('BEGIN TRANSACTION');
        db.run(
          'INSERT INTO peminjaman (buku_id, anggota_id, durasi_pinjam, tanggal_kembali_direncanakan) VALUES (?, ?, ?, ?)',
          [buku_id, anggota_id, durasi, plannedReturnStr],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }
            const peminjamanId = this.lastID;

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
                    console.log('Peminjaman inserted id:', peminjamanId, 'buku_id:', buku_id, 'anggota_id:', anggota_id);
                    res.json({ 
                      id: peminjamanId, 
                      message: 'Peminjaman berhasil dicatat',
                      tanggal_kembali_direncanakan: plannedReturnStr
                    });
              }
            );
          }
        );
      });
    });
  });
});

    app.get('/api/anggota/:id/peminjaman-aktif', (req, res) => {
      const anggotaId = req.params.id;
      db.all(
        `SELECT p.*, b.kode, b.judul, b.penerbit, b.tahun
         FROM peminjaman p
         JOIN buku b ON p.buku_id = b.id
         WHERE p.status = 'dipinjam' AND p.anggota_id = ?
         ORDER BY p.tanggal_pinjam DESC`,
        [anggotaId],
        (err, rows) => {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json(rows);
        }
      );
    });

app.post('/api/peminjaman/:id/kembali', (req, res) => {
  const id = req.params.id;
  const { tanggal_kembali } = req.body;
  
  if (!tanggal_kembali) {
    res.status(400).json({ error: 'Tanggal kembali wajib diisi' });
    return;
  }

  db.serialize(() => {
    db.get(
      'SELECT buku_id, tanggal_pinjam, durasi_pinjam, tanggal_kembali_direncanakan FROM peminjaman WHERE id = ? AND status = ?',
      [id, 'dipinjam'],
      (err, pinjam) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        if (!pinjam) {
          res.status(404).json({ error: 'Peminjaman tidak ditemukan atau sudah dikembalikan' });
          return;
        }

        const returnDate = new Date(tanggal_kembali);
        const plannedDate = new Date(pinjam.tanggal_kembali_direncanakan);
        const daysLate = Math.max(0, Math.floor((returnDate - plannedDate) / (1000 * 60 * 60 * 24)));
        const denda = daysLate > 0 ? daysLate * 5000 : 0;

        db.run('BEGIN TRANSACTION');
        
        db.run(
          'UPDATE peminjaman SET status = ?, tanggal_kembali = ?, denda = ? WHERE id = ?',
          ['kembali', tanggal_kembali, denda, id],
          (err) => {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ error: err.message });
              return;
            }

            db.run(
              'UPDATE buku SET status = ? WHERE id = ?',
              ['tersedia', pinjam.buku_id],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  res.status(500).json({ error: err.message });
                  return;
                }

                db.run('COMMIT');
                res.json({ 
                  message: 'Buku berhasil dikembalikan',
                  daysLate,
                  denda,
                  dendaRp: `Rp ${denda.toLocaleString('id-ID')}`
                });
              }
            );
          }
        );
      }
    );
  });
});

app.get('/api/peminjaman', (req, res) => {
  db.all(
    `SELECT p.*, b.kode, b.judul, b.penerbit, b.tahun, a.nama as peminjam
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

// hapus buku (hanya jika status tersedia)
app.delete('/api/buku/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT status FROM buku WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Buku tidak ditemukan' });
    if (row.status === 'dipinjam') return res.status(400).json({ error: 'Buku sedang dipinjam, tidak bisa dihapus' });
    db.run('DELETE FROM buku WHERE id = ?', [id], function(err2){
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Buku dihapus', id });
    });
  });
});

// hapus anggota (hanya jika tidak ada peminjaman aktif)
app.delete('/api/anggota/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT COUNT(*) as cnt FROM peminjaman WHERE anggota_id = ? AND status = ?', [id, 'dipinjam'], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row && row.cnt > 0) return res.status(400).json({ error: 'Anggota memiliki peminjaman aktif, tidak bisa dihapus' });
    db.run('DELETE FROM anggota WHERE id = ?', [id], function(err2){
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Anggota dihapus', id });
    });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});