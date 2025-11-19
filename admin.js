document.addEventListener('DOMContentLoaded', function(){
  const API_URL = 'http://localhost:3000/api';
  const booksList = document.getElementById('admin-books-list');
  const anggotaList = document.getElementById('admin-anggota-list');
  const formBuku = document.getElementById('form-admin-buku');
  const formAnggota = document.getElementById('form-admin-anggota');
  const refreshBtn = document.getElementById('refresh-btn');

  async function fetchBooks(){
    const res = await fetch(`${API_URL}/buku?admin=1`);
    return res.ok ? await res.json() : [];
  }
  async function fetchPending(){
    const res = await fetch(`${API_URL}/buku-pending`);
    return res.ok ? await res.json() : [];
  }
  async function fetchAnggota(){
    const res = await fetch(`${API_URL}/anggota`);
    return res.ok ? await res.json() : [];
  }
  async function fetchActiveLoans(){
    const res = await fetch(`${API_URL}/peminjaman-aktif`);
    return res.ok ? await res.json() : [];
  }

  function fmtDate(d){ try{ return new Date(d).toLocaleDateString(); }catch(e){return '-';} }
  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function renderBooks(){
    const [books, loans] = await Promise.all([fetchBooks(), fetchActiveLoans()]);
    const loanByBook = {};
    loans.forEach(l => { if(l && l.buku_id) loanByBook[String(l.buku_id)] = l; });

    booksList.innerHTML = '';
    if(books.length===0){ booksList.innerHTML = '<li>Belum ada buku</li>'; return; }

    books.forEach(b => {
      const li = document.createElement('li');
      li.className = 'book-item';
      li.style.display = 'flex';
      li.style.justifyContent = 'space-between';
      li.style.alignItems = 'center';
      li.style.padding = '10px';

      const metaHtml = `${escapeHtml(b.penerbit||'-')} • ${b.tahun||'-'} • Masuk: ${b.tanggal_masuk||'-'}`;
      const leftHtml = `<div><strong>${escapeHtml(b.kode)}</strong> — ${escapeHtml(b.judul)}<div class="book-meta">${metaHtml}</div></div>`;

      const statusDiv = document.createElement('div');
      statusDiv.style.textAlign = 'right';

      if(String(b.status) === 'dipinjam' || loanByBook[String(b.id)]){
        const loan = loanByBook[String(b.id)];
        const borrower = loan ? escapeHtml(loan.peminjam || loan.nama || '-') : '-';
        const due = loan && loan.tanggal_kembali_direncanakan ? fmtDate(loan.tanggal_kembali_direncanakan) : '-';
        statusDiv.innerHTML = `<div style="font-weight:600;color:#b91c1c">Dipinjam</div><div style="font-size:0.85rem;color:var(--muted)">oleh ${borrower}<br/>jatuh tempo: ${due}</div>`;
      } else {
        statusDiv.innerHTML = `<div style="font-weight:600;color:#059669">Tersedia</div>`;
      }

      const actions = document.createElement('div');
      actions.style.marginLeft = '12px';
      const del = document.createElement('button'); del.className='btn-modern small'; del.textContent='Hapus'; del.addEventListener('click', ()=> deleteBook(b.id));
      const edit = document.createElement('button'); edit.className='btn-modern small'; edit.style.marginLeft='8px'; edit.textContent='Edit'; edit.addEventListener('click', ()=> editBook(b));
      actions.appendChild(edit);
      actions.appendChild(del);

      li.innerHTML = leftHtml;
      li.appendChild(statusDiv);
      li.appendChild(actions);
      booksList.appendChild(li);
    });
  }

  async function renderPending(){
    const pend = await fetchPending();
    const pendingList = document.getElementById('admin-pending-list');
    pendingList.innerHTML = '';
    if(pend.length===0){ pendingList.innerHTML = '<li>Tidak ada buku pending</li>'; return; }
    pend.forEach(b=>{
      const li = document.createElement('li');
      li.className = 'book-item';
      li.style.display = 'flex'; li.style.justifyContent='space-between'; li.style.alignItems='center'; li.style.padding='10px';
      li.innerHTML = `<div><strong>${escapeHtml(b.kode)}</strong> — ${escapeHtml(b.judul)}<div class="book-meta">${escapeHtml(b.penerbit||'-')} • ${b.tahun||'-'} • Masuk: ${b.tanggal_masuk||'-'}</div></div>`;
      const actions = document.createElement('div');
      const approve = document.createElement('button'); approve.className='btn-modern small'; approve.textContent='Setujui'; approve.addEventListener('click', ()=> approveBook(b.id));
      const edit = document.createElement('button'); edit.className='btn-modern small'; edit.style.marginLeft='8px'; edit.textContent='Edit'; edit.addEventListener('click', ()=> editBook(b));
      const reject = document.createElement('button'); reject.className='btn-modern small'; reject.style.marginLeft='8px'; reject.textContent='Tolak'; reject.addEventListener('click', ()=> rejectBook(b.id));
      actions.appendChild(approve); actions.appendChild(edit); actions.appendChild(reject);
      li.appendChild(actions);
      pendingList.appendChild(li);
    });
  }

  async function renderAnggota(){
    const [ag, loans] = await Promise.all([fetchAnggota(), fetchActiveLoans()]);
    const loansByAng = {};
    loans.forEach(l => {
      const aId = String(l.anggota_id);
      loansByAng[aId] = loansByAng[aId] || [];
      loansByAng[aId].push(l);
    });

    anggotaList.innerHTML = '';
    if(ag.length===0){ anggotaList.innerHTML = '<li>Belum ada anggota</li>'; return; }
    ag.forEach(a=>{
      const li = document.createElement('li');
      li.className = 'book-item';
      li.style.display = 'flex'; li.style.justifyContent='space-between'; li.style.alignItems='center'; li.style.padding = '10px';

      const left = document.createElement('div');
      left.innerHTML = `<strong>${escapeHtml(a.nama)}</strong><div class="book-meta">${escapeHtml(a.kelas||'-')} • ${fmtDate(a.tanggal_daftar)}</div>`;

      const right = document.createElement('div');
      right.style.textAlign = 'right';
      const theirLoans = loansByAng[String(a.id)] || [];
      if(theirLoans.length > 0){
        const items = theirLoans.map(l => `${escapeHtml(l.kode)} — ${escapeHtml(l.judul)} (jatuh tempo: ${fmtDate(l.tanggal_kembali_direncanakan)})`).join('<br/>');
        right.innerHTML = `<div style="font-weight:600;color:#b91c1c">Sedang meminjam</div><div style="font-size:0.85rem;color:var(--muted)">${items}</div>`;
      } else {
        right.innerHTML = `<div style="font-weight:600;color:#059669">Tidak meminjam</div>`;
      }

      const actions = document.createElement('div');
      const del = document.createElement('button'); del.className='btn-modern small'; del.textContent='Hapus'; del.addEventListener('click', ()=> deleteAnggota(a.id));
      actions.appendChild(del);

      li.appendChild(left);
      li.appendChild(right);
      li.appendChild(actions);
      anggotaList.appendChild(li);
    });
  }

  async function deleteBook(id){
    if(!confirm('Hapus buku ini?')) return;
    const res = await fetch(`${API_URL}/buku/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if(!res.ok){ alert(data.error||data.message||'Gagal hapus'); return; }
    alert('Buku dihapus'); renderBooks();
  }

  async function editBook(book){
    // book can be an object with current values
    const kode = prompt('Kode buku:', book.kode);
    if (kode === null) return; // cancelled
    const judul = prompt('Judul:', book.judul);
    if (judul === null) return;
    const penerbit = prompt('Penerbit:', book.penerbit||'') ;
    if (penerbit === null) return;
    const tahunStr = prompt('Tahun (kosongkan jika tidak ada):', book.tahun||'');
    if (tahunStr === null) return;
    const tanggal_masuk = prompt('Tanggal masuk (YYYY-MM-DD):', book.tanggal_masuk||'');
    if (tanggal_masuk === null) return;

    const tahun = tahunStr === '' ? null : (isNaN(Number(tahunStr)) ? null : Number(tahunStr));

    const payload = { kode, judul, penerbit, tahun, tanggal_masuk };
    const res = await fetch(`${API_URL}/buku/${book.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) { alert(data.error||'Gagal mengedit buku'); return; }
    alert('Buku diperbarui');
    renderBooks(); renderPending();
  }

  async function approveBook(id){
    if(!confirm('Setujui buku ini?')) return;
    const res = await fetch(`${API_URL}/buku/${id}/approve`, { method: 'POST' });
    const data = await res.json(); if(!res.ok){ alert(data.error||'Gagal approve'); return; }
    alert('Buku disetujui'); renderPending(); renderBooks();
  }

  async function rejectBook(id){
    if(!confirm('Tolak dan hapus buku ini?')) return;
    const res = await fetch(`${API_URL}/buku/${id}/reject`, { method: 'POST' });
    const data = await res.json(); if(!res.ok){ alert(data.error||'Gagal reject'); return; }
    alert('Buku ditolak dan dihapus'); renderPending();
  }

  async function deleteAnggota(id){
    if(!confirm('Hapus anggota ini?')) return;
    const res = await fetch(`${API_URL}/anggota/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if(!res.ok){ alert(data.error||data.message||'Gagal hapus'); return; }
    alert('Anggota dihapus'); renderAnggota();
  }

  formBuku.addEventListener('submit', async function(e){
    e.preventDefault();
    const kode = document.getElementById('admin-kode').value.trim();
    const judul = document.getElementById('admin-judul').value.trim();
    const penerbit = document.getElementById('admin-penerbit').value.trim();
    const tahun = document.getElementById('admin-tahun').value || null;
    if(!kode || !judul){ alert('Kode dan judul wajib diisi'); return; }
    const res = await fetch(`${API_URL}/buku`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({kode, judul, penerbit, tahun, tanggal_masuk: new Date().toISOString().split('T')[0]}) });
    const data = await res.json(); if(!res.ok){ alert(data.error||'Gagal tambah buku'); return; }
    alert('Buku ditambahkan'); e.target.reset(); renderBooks();
  });

  formAnggota.addEventListener('submit', async function(e){
    e.preventDefault();
    const nama = document.getElementById('admin-nama').value.trim();
    const kelas = document.getElementById('admin-kelas').value.trim();
    if(!nama){ alert('Nama wajib diisi'); return; }
    const res = await fetch(`${API_URL}/anggota`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nama, kelas}) });
    const data = await res.json(); if(!res.ok){ alert(data.error||'Gagal tambah anggota'); return; }
    alert('Anggota ditambahkan'); e.target.reset(); renderAnggota();
  });

  refreshBtn.addEventListener('click', ()=>{ renderBooks(); renderAnggota(); renderPending(); });

  // initial
  renderBooks(); renderAnggota(); renderPending();
});