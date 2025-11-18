// Frontend that reads/writes the Node.js/SQLite backend API
document.addEventListener('DOMContentLoaded', function(){
  const API_URL = 'http://localhost:3000/api';

  // Theme setup
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  if(savedTheme === 'dark' || (!savedTheme && prefersDark)){
    document.body.setAttribute('data-theme', 'dark');
    const t = document.querySelector('#theme-toggle i'); if(t) t.className = 'fas fa-sun';
  }

  const modalPeng = document.getElementById('modal-pengunjung');
  const modalBuku = document.getElementById('modal-buku');
  const modalPinjam = document.getElementById('modal-pinjam');
  const modalKembali = document.getElementById('modal-kembali');
  const btnPeng = document.getElementById('btn-pengunjung');
  const btnBuku = document.getElementById('btn-buku');
  const btnCari = document.getElementById('btn-cari');
  
  let currentUser = null; // Track user yang sedang login
  // restore login from previous session if present
  try {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      currentUser = JSON.parse(saved);
    }
  } catch (e) {
    currentUser = null;
  }

  const searchSection = document.getElementById('search-section');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const booksListEl = document.getElementById('books-list');
  const visitorsListEl = document.getElementById('visitors-list');
  const toastContainer = document.getElementById('toast-container');

  // ---------- API calls ----------
  async function fetchBooks(query = ''){
    try{
      const res = await fetch(`${API_URL}/buku${query ? '?q=' + encodeURIComponent(query) : ''}`);
      if(!res.ok) throw await res.json();
      return await res.json();
    }catch(err){ showToast(err.error || err.message || 'Gagal mengambil buku','error'); return []; }
  }

  async function addBookAPI(book){
    try{
      const res = await fetch(`${API_URL}/buku`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(book)});
      const data = await res.json(); if(!res.ok) throw data;
      showToast('Buku tersimpan','success'); return true;
    }catch(err){ showToast(err.error || err.message || 'Gagal menyimpan buku','error'); return false; }
  }

  async function fetchVisitors(){
    try{ const res = await fetch(`${API_URL}/anggota`); if(!res.ok) throw await res.json(); return await res.json(); }
    catch(err){ showToast(err.error||err.message||'Gagal ambil pengunjung','error'); return []; }
  }

  async function fetchAvailableBooks(){
    try{ const res = await fetch(`${API_URL}/buku-tersedia`); if(!res.ok) throw await res.json(); return await res.json(); }
    catch(err){ showToast(err.error||err.message||'Gagal ambil buku','error'); return []; }
  }

  async function fetchActiveLoans(){
    try{ const res = await fetch(`${API_URL}/peminjaman-aktif`); if(!res.ok) throw await res.json(); return await res.json(); }
    catch(err){ showToast(err.error||err.message||'Gagal ambil peminjaman','error'); return []; }
  }

  async function addVisitorAPI(v){
    try{ const res = await fetch(`${API_URL}/anggota`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}); const data = await res.json(); if(!res.ok) throw data; showToast('Pengunjung tersimpan','success'); return data.id; }
    catch(err){ showToast(err.error||err.message||'Gagal tambah pengunjung','error'); return null; }
  }

  async function borrowBookAPI(buku_id, anggota_id){
    try{ const res = await fetch(`${API_URL}/peminjaman`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buku_id, anggota_id, durasi_pinjam: 7})}); const data = await res.json(); if(!res.ok) throw data; showToast('Peminjaman tercatat','success'); return true; }
    catch(err){ showToast(err.error||err.message||'Gagal pinjam buku','error'); return false; }
  }

  async function fetchLoans(){
    try{ const res = await fetch(`${API_URL}/peminjaman`); if(!res.ok) throw await res.json(); return await res.json(); }catch(err){ showToast(err.error||err.message||'Gagal ambil riwayat','error'); return []; }
  }

  // ---------- rendering ----------
  async function renderBooks(filter){
    const books = await fetchBooks(filter);
    booksListEl.innerHTML = '';
    books.forEach(b => {
      const li = document.createElement('li'); li.className='book-item';
      const left = document.createElement('div'); left.className='book-left';
      const title = document.createElement('div'); title.innerHTML = highlightText(`${b.kode} — ${b.judul}`, filter);
      const meta = document.createElement('div'); meta.className='book-meta'; meta.innerHTML = `${escapeHtml(b.penerbit||'-')} • ${b.tahun||'-'} • Masuk: ${b.tanggal_masuk||'-'}`;
      left.appendChild(title); left.appendChild(meta);

      const actions = document.createElement('div'); actions.className='book-actions';
      if(b.status === 'tersedia'){
        const btn = document.createElement('button'); btn.className='btn-modern small'; btn.textContent='Pinjam';
        btn.addEventListener('click', ()=> onBorrowClick(b)); actions.appendChild(btn);
      } else {
        const s = document.createElement('span'); s.textContent = 'Sedang dipinjam'; actions.appendChild(s);
      }

      li.appendChild(left); li.appendChild(actions); booksListEl.appendChild(li);
    });
    if(books.length===0){ const empty = document.createElement('li'); empty.className='book-item'; empty.textContent = filter? 'Tidak ada buku yang cocok' : 'Belum ada buku'; booksListEl.appendChild(empty); }
  }

  async function renderVisitors(){
    const visitors = await fetchVisitors(); visitorsListEl.innerHTML = '';
    visitors.slice(0,12).forEach(v=>{ const li = document.createElement('li'); li.className='book-item'; li.innerHTML = `<div><strong>${escapeHtml(v.nama)}</strong><div class="book-meta">${escapeHtml(v.kelas||'-')} • ${new Date(v.tanggal_daftar).toLocaleDateString()}</div></div>`; visitorsListEl.appendChild(li); });
    if(visitors.length===0){ const empty = document.createElement('li'); empty.className='book-item'; empty.textContent='Belum ada pengunjung'; visitorsListEl.appendChild(empty); }
  }

  function highlightText(text, q){ if(!q) return escapeHtml(text); const esc = q.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&'); return escapeHtml(text).replace(new RegExp(esc,'ig'), m=>`<mark>${m}</mark>`); }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ---------- borrow flow ----------
  async function onBorrowClick(book){
    // ask for anggota id or nama
    const input = prompt('Masukkan ID anggota (angka) atau nama anggota baru:');
    if(!input) return;
    let anggotaId = null;
    if(/^[0-9]+$/.test(input.trim())){
      anggotaId = Number(input.trim());
    } else {
      // create new anggota
      const id = await addVisitorAPI({nama: input.trim(), kelas: ''});
      if(!id) return; anggotaId = id;
    }

    const ok = await borrowBookAPI(book.id, anggotaId);
    if(ok){ renderBooks(searchInput.value); renderVisitors(); }
  }

  // ---------- UI utilities ----------
  function showToast(message, type=''){
    const t = document.createElement('div'); t.className='toast '+(type||''); t.textContent = message; toastContainer.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.addEventListener('transitionend', ()=> t.remove()); t.style.transition='opacity .25s'; }, 2500);
    setTimeout(()=>{ if(t.parentNode) t.remove(); }, 3600);
  }

  // ---------- modal helpers & events ----------
  function openModal(modal){ modal.classList.remove('hidden'); const first = modal.querySelector('input,select,textarea'); if(first) setTimeout(()=> first.focus(),120); }
  function closeModal(modal){ modal.classList.add('hidden'); }
  // Menu buttons for after login
  const btnMenuPinjam = document.getElementById('btn-menu-pinjam');
  const btnMenuKembali = document.getElementById('btn-menu-kembali');
  const btnLogout = document.getElementById('btn-logout');

  function showLoginSection(){
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('menu-section').classList.add('hidden');
  }

  function showMenuSection(anggota){
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('menu-section').classList.remove('hidden');
    document.getElementById('user-nama').textContent = anggota.nama;
    document.getElementById('pinjam-user-nama').textContent = anggota.nama;
    document.getElementById('kembali-user-nama').textContent = anggota.nama;
  }

  btnPeng.addEventListener('click', ()=> {
    // Open pengunjung modal: if already logged in show menu, otherwise show login form
    openModal(modalPeng);
    if (currentUser) { showMenuSection(currentUser); }
    else { showLoginSection(); }
  });
  btnBuku.addEventListener('click', ()=> openModal(modalBuku));
  btnCari.addEventListener('click', ()=> { window.scrollTo({top: searchSection.offsetTop - 10, behavior:'smooth'}); searchInput.focus(); });
  
  btnMenuPinjam.addEventListener('click', ()=> { closeModal(modalPeng); setTimeout(()=> { openModal(modalPinjam); setupPinjamForm(); }, 300); });
  btnMenuKembali.addEventListener('click', ()=> { closeModal(modalPeng); setTimeout(()=> { openModal(modalKembali); setupKembaliForm(); }, 300); });
  btnLogout.addEventListener('click', ()=> {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showLoginSection();
  });
  
  // Initialize modal state based on login restore
  if (currentUser) {
    showMenuSection(currentUser);
  } else {
    showLoginSection();
  }
  
  document.querySelectorAll('.modal .close-btn').forEach(b => b.addEventListener('click', (e)=>{ const modal = e.target.closest('.modal'); if(modal) closeModal(modal); }));
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') document.querySelectorAll('.modal').forEach(m=>closeModal(m)); });
  document.querySelectorAll('.modal').forEach(m=> m.addEventListener('click', e=>{ if(e.target===m) closeModal(m); }));

  // ---------- forms ----------
  async function setupPinjamForm(){
    const cariInput = document.getElementById('pinjam-cari');
    const bukuList = document.getElementById('pinjam-buku-list');
    const bukuIdHidden = document.getElementById('pinjam-buku');
    const bukuSelected = document.getElementById('pinjam-buku-selected');
    let allBooks = [];

    // Load books on form open
    allBooks = await fetchAvailableBooks();

    cariInput.addEventListener('input', ()=>{
      const query = cariInput.value.toLowerCase();
      bukuList.innerHTML = '';
      
      if(query.length === 0){
        bukuList.style.display = 'none';
        return;
      }

      const filtered = allBooks.filter(b => 
        b.kode.toLowerCase().includes(query) || 
        b.judul.toLowerCase().includes(query)
      ).slice(0, 8);

      if(filtered.length === 0){
        bukuList.style.display = 'none';
        return;
      }

      bukuList.style.display = 'block';
      filtered.forEach(b => {
        const li = document.createElement('li');
        li.style.cssText = 'padding:10px;cursor:pointer;border-bottom:1px solid var(--border);hover:background-color:var(--glass)';
        li.innerHTML = `<div style="font-weight:500">${b.kode} - ${b.judul}</div><div style="font-size:0.85rem;color:var(--muted)">${b.penerbit} • ${b.tahun}</div>`;
        li.addEventListener('click', ()=>{
          bukuIdHidden.value = b.id;
          cariInput.value = '';
          bukuList.innerHTML = '';
          bukuList.style.display = 'none';
          bukuSelected.innerHTML = `<strong>${b.kode}</strong> - ${b.judul} (${b.tahun}) <span style="color:var(--muted)">✓</span>`;
          bukuSelected.style.display = 'block';
          document.getElementById('buku-detail').textContent = `${b.kode} - ${b.judul}\n${b.penerbit} (${b.tahun})`;
          document.getElementById('buku-info').style.display = 'block';
        });
        bukuList.appendChild(li);
      });
    });

    // Clear selection when clicking input again
    cariInput.addEventListener('focus', ()=>{
      if(bukuIdHidden.value){
        bukuIdHidden.value = '';
        bukuSelected.style.display = 'none';
        document.getElementById('buku-info').style.display = 'none';
      }
    });
  }

  async function setupKembaliForm(){
    const cariInput = document.getElementById('kembali-cari');
    const pinjamList = document.getElementById('kembali-pinjam-list');
    const pinjamIdHidden = document.getElementById('kembali-pinjam');
    const pinjamSelected = document.getElementById('kembali-pinjam-selected');
    let userLoans = [];

    // Ensure user is logged in
    if(!currentUser){
      showToast('Silakan login terlebih dahulu','error');
      return;
    }

    // Load loans on form open
    const loans = await fetchActiveLoans();
    // normalize id types and filter for current user
    userLoans = loans.filter(l => String(l.anggota_id) === String(currentUser.id));

    function renderPinjamItems(list){
      pinjamList.innerHTML = '';
      if(list.length === 0){ pinjamList.style.display = 'none'; return; }
      pinjamList.style.display = 'block';
      list.forEach(l => {
        const durasi = l.durasi_pinjam || 7;
        const li = document.createElement('li');
        li.style.cssText = 'padding:10px;cursor:pointer;border-bottom:1px solid var(--border)';
        li.innerHTML = `<div style="font-weight:500">${l.kode} - ${l.judul}</div><div style="font-size:0.85rem;color:var(--muted)">Pinjam: ${new Date(l.tanggal_pinjam).toLocaleDateString()} • Jatuh Tempo: ${new Date(l.tanggal_kembali_direncanakan).toLocaleDateString()}</div>`;
        li.addEventListener('click', ()=>{
          pinjamIdHidden.value = l.id;
          cariInput.value = '';
          pinjamList.innerHTML = '';
          pinjamList.style.display = 'none';
          pinjamSelected.innerHTML = `<strong>${l.kode}</strong> - ${l.judul} <span style="color:var(--muted)">✓</span>`;
          pinjamSelected.style.display = 'block';

          const text = `Buku: ${l.judul}\nTanggal Pinjam: ${new Date(l.tanggal_pinjam).toLocaleDateString()}\nDurasi: ${durasi} hari\nJatuh Tempo: ${new Date(l.tanggal_kembali_direncanakan).toLocaleDateString()}`;
          document.getElementById('pinjam-detail-text').textContent = text;
          document.getElementById('pinjam-detail-info').style.display = 'block';

          // Store data for denda calculation
          document.querySelector('#kembali-tanggal').dataset.kembaliDirencanakan = l.tanggal_kembali_direncanakan;
        });
        pinjamList.appendChild(li);
      });
    }

    // Show all user loans immediately (so user can pick without typing)
    renderPinjamItems(userLoans.slice(0, 12));

    cariInput.addEventListener('input', ()=>{
      const query = (cariInput.value||'').toLowerCase();
      const filtered = query ? userLoans.filter(l => (l.kode||'').toLowerCase().includes(query) || (l.judul||'').toLowerCase().includes(query)) : userLoans;
      renderPinjamItems(filtered.slice(0, 8));
    });

    // Clear selection when clicking input again
    cariInput.addEventListener('focus', ()=>{
      if(pinjamIdHidden.value){
        pinjamIdHidden.value = '';
        pinjamSelected.style.display = 'none';
        document.getElementById('pinjam-detail-info').style.display = 'none';
      } else {
        // if no selection, show list
        renderPinjamItems(userLoans.slice(0,12));
      }
    });

    document.getElementById('kembali-tanggal').addEventListener('change', calculateDenda);
  }

  function calculateDenda(){
    const pinjamIdHidden = document.getElementById('kembali-pinjam');
    const tanggalKembali = document.getElementById('kembali-tanggal').value;
    if(!pinjamIdHidden.value || !tanggalKembali) return;
    
    // Get stored tanggal_kembali_direncanakan
    const kembaliDirencanakan = new Date(document.querySelector('#kembali-tanggal').dataset.kembaliDirencanakan);
    const tanggalKembaliDate = new Date(tanggalKembali);
    const daysLate = Math.max(0, Math.floor((tanggalKembaliDate - kembaliDirencanakan) / (1000*60*60*24)));
    const denda = daysLate * 5000;
    const text = daysLate > 0 ? `Keterlambatan: ${daysLate} hari\nDenda: Rp ${denda.toLocaleString('id-ID')}` : 'Tidak ada denda (tepat waktu)';
    document.getElementById('denda-text').textContent = text;
    document.getElementById('denda-info').style.display = 'block';
  }

  document.getElementById('form-pinjam').addEventListener('submit', async function(e){
    e.preventDefault();
    if(!currentUser){ showToast('Silakan login terlebih dahulu','error'); return; }
    const bukuSelect = document.getElementById('pinjam-buku');
    const durasi = document.getElementById('pinjam-durasi').value;
    if(!bukuSelect.value){ showToast('Pilih buku','error'); return; }
    const res = await fetch(`${API_URL}/peminjaman`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({buku_id:bukuSelect.value,anggota_id:currentUser.id,durasi_pinjam:parseInt(durasi)})});
    const data = await res.json(); if(!res.ok){ showToast(data.error,'error'); return; }
    showToast('Peminjaman berhasil dicatat','success'); e.target.reset(); closeModal(modalPinjam); renderBooks('');
  });

  document.getElementById('form-kembali').addEventListener('submit', async function(e){
    e.preventDefault();
    const pinjamSelect = document.getElementById('kembali-pinjam');
    const tanggalKembali = document.getElementById('kembali-tanggal').value;
    if(!pinjamSelect.value){ showToast('Pilih peminjaman','error'); return; }
    const res = await fetch(`${API_URL}/peminjaman/${pinjamSelect.value}/kembali`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tanggal_kembali:tanggalKembali})});
    const data = await res.json(); if(!res.ok){ showToast(data.error,'error'); return; }
    showToast(`Buku dikembalikan${data.denda>0?` | Denda: Rp ${data.denda.toLocaleString('id-ID')}`:''}`, data.denda>0?'':'success'); e.target.reset(); closeModal(modalKembali); renderBooks('');
  });

  // ---------- login flow ----------
  document.getElementById('form-pengunjung').addEventListener('submit', async function(e){
    e.preventDefault();
    const nama = (document.getElementById('pengunjung-nama').value||'').trim();
    const kelas = (document.getElementById('pengunjung-kelas').value||'').trim();
    if(!nama){ showToast('Nama wajib diisi','error'); return; }
    
    // Check if anggota already exists
    const visitors = await fetchVisitors();
    let user = visitors.find(v => v.nama.toLowerCase() === nama.toLowerCase());
    
    if(!user){
      // Create new anggota
      const id = await addVisitorAPI({nama, kelas});
      if(!id) return;
      user = {id, nama, kelas};
    }
    
    // Set currentUser and persist to localStorage
    currentUser = user;
    try { localStorage.setItem('currentUser', JSON.stringify(user)); } catch(e) { /* ignore */ }
    showMenuSection(user);
    e.target.reset();
  });

  document.getElementById('form-buku').addEventListener('submit', async function(e){
    e.preventDefault(); const data = new FormData(e.target);
    const book = { kode:(data.get('kode')||'').trim(), judul:(data.get('judul')||'').trim(), penerbit:(data.get('penerbit')||'').trim(), tahun: data.get('tahun')||null, tanggal_masuk: data.get('masuk') || new Date().toISOString().split('T')[0] };
    if(!book.kode || !book.judul){ showToast('Kode dan Judul wajib diisi','error'); return; }
    const ok = await addBookAPI(book); if(ok){ e.target.reset(); closeModal(modalBuku); renderBooks(searchInput.value); }
  });

  // ---------- search ----------
  let searchTimeout;
  searchInput.addEventListener('input', ()=>{ clearTimeout(searchTimeout); searchTimeout = setTimeout(()=> renderBooks(searchInput.value), 300); });
  searchBtn.addEventListener('click', ()=> renderBooks(searchInput.value));

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', function(){ const isDark = document.body.getAttribute('data-theme') === 'dark'; if(isDark){ document.body.removeAttribute('data-theme'); this.querySelector('i').className='fas fa-moon'; localStorage.setItem('theme','light'); } else { document.body.setAttribute('data-theme','dark'); this.querySelector('i').className='fas fa-sun'; localStorage.setItem('theme','dark'); } });

  // initial render
  renderBooks(''); renderVisitors();
});
