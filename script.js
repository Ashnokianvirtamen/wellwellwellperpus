// Modern interactive behavior with backend API integration
document.addEventListener('DOMContentLoaded', function(){
  const API_URL = 'http://localhost:3000/api';
  
  // Theme setup
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  if(savedTheme === 'dark' || (!savedTheme && prefersDark)){
    document.body.setAttribute('data-theme', 'dark');
    document.querySelector('#theme-toggle i').className = 'fas fa-sun';
  }

  const modalPeng = document.getElementById('modal-pengunjung');
  const modalBuku = document.getElementById('modal-buku');
  const btnPeng = document.getElementById('btn-pengunjung');
  const btnBuku = document.getElementById('btn-buku');
  const btnCari = document.getElementById('btn-cari');
  const searchSection = document.getElementById('search-section');
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const booksListEl = document.getElementById('books-list');
  const visitorsListEl = document.getElementById('visitors-list');
  const toastContainer = document.getElementById('toast-container');

  const STORAGE_BOOKS = 'perpus_books_v1';
  const STORAGE_VISITORS = 'perpus_visitors_v1';

  const defaultBooks = [
    {kode:'B001', judul:'Pemrograman Web', penerbit:'Agus Santoso', tahun:2020, masuk:'2020-03-10'},
    {kode:'B002', judul:'Algoritma dan Struktur Data', penerbit:'Budi', tahun:2019, masuk:'2019-08-21'},
    {kode:'B003', judul:'Database untuk Pemula', penerbit:'Siti', tahun:2021, masuk:'2021-01-15'}
  ];

  let books = loadBooks();
  let visitors = loadVisitors();

  // ---------- persistence ----------
  function loadBooks(){
    try{ const s = localStorage.getItem(STORAGE_BOOKS); return s ? JSON.parse(s) : defaultBooks.slice(); }
    catch(e){ return defaultBooks.slice(); }
  }
  function saveBooks(){ localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books)); }
  function loadVisitors(){ try{ const s = localStorage.getItem(STORAGE_VISITORS); return s ? JSON.parse(s) : []; }catch(e){ return []; } }
  function saveVisitors(){ localStorage.setItem(STORAGE_VISITORS, JSON.stringify(visitors)); }

  // ---------- rendering ----------
  function renderBooks(filter){
    const q = (filter||'').trim().toLowerCase();
    booksListEl.innerHTML = '';
    books.forEach(b => {
      const li = document.createElement('li');
      li.className = 'book-item';

      const left = document.createElement('div'); left.className = 'book-left';
      const title = document.createElement('div');
      title.innerHTML = highlightText(`${b.kode} — ${b.judul}`, q);
      const meta = document.createElement('div'); meta.className = 'book-meta';
      meta.textContent = `${b.penerbit || '-'} • ${b.tahun || '-'} • Masuk: ${b.masuk || '-'}`;
      left.appendChild(title); left.appendChild(meta);

      const actions = document.createElement('div'); actions.className = 'book-actions';
      const del = document.createElement('button'); del.className = 'close-btn'; del.textContent = 'Hapus'; del.title='Hapus buku';
      del.addEventListener('click', ()=>{ if(confirm('Hapus buku ini?')){ deleteBook(b.kode); }});
      actions.appendChild(del);

      li.appendChild(left); li.appendChild(actions);
      // hide if not match
      if(q){ const hay = `${b.kode} ${b.judul} ${b.penerbit} ${b.tahun}`.toLowerCase(); if(!hay.includes(q)) li.style.display='none'; }

      booksListEl.appendChild(li);
    });
  }

  function renderVisitors(){
    visitorsListEl.innerHTML = '';
    visitors.slice().reverse().slice(0,12).forEach(v => {
      const li = document.createElement('li'); li.className='book-item';
      li.textContent = `${v.nama} — ${v.kelas||'-'} — ${v.waktu || ''}`;
      visitorsListEl.appendChild(li);
    });
  }

  function highlightText(text, q){
    if(!q) return escapeHtml(text);
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return escapeHtml(text).replace(new RegExp(esc,'ig'), m => `<mark>${m}</mark>`);
  }
  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ---------- operations ----------
  function addBook(obj){
    // prevent duplicate kode
    if(books.some(b=>b.kode===obj.kode)){
      showToast('Kode buku sudah ada', 'error'); return false;
    }
    books.unshift(obj); saveBooks(); renderBooks(searchInput.value); showToast('Buku tersimpan', 'success'); return true;
  }
  function deleteBook(kode){ books = books.filter(b=>b.kode!==kode); saveBooks(); renderBooks(searchInput.value); showToast('Buku dihapus', 'success'); }

  function addVisitor(obj){ visitors.push(obj); saveVisitors(); renderVisitors(); showToast('Pengunjung dicatat', 'success'); }

  // ---------- UI utilities ----------
  function showToast(message, type=''){
    const t = document.createElement('div'); t.className='toast '+(type||''); t.textContent = message;
    toastContainer.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.addEventListener('transitionend', ()=> t.remove()); t.style.transition='opacity .25s'; }, 2500);
    setTimeout(()=>{ if(t.parentNode) t.remove(); }, 3600);
  }

  // ---------- modal helpers ----------
  function openModal(modal){ modal.classList.remove('hidden'); const first = modal.querySelector('input,select,textarea'); if(first) setTimeout(()=> first.focus(),120); }
  function closeModal(modal){ modal.classList.add('hidden'); }

  btnPeng.addEventListener('click', ()=> openModal(modalPeng));
  btnBuku.addEventListener('click', ()=> openModal(modalBuku));
  btnCari.addEventListener('click', ()=> { window.scrollTo({top: searchSection.offsetTop - 10, behavior:'smooth'}); searchInput.focus(); });

  // Close buttons inside modals (header & footer)
  document.querySelectorAll('.modal .close-btn').forEach(b => b.addEventListener('click', (e)=>{
    const modal = e.target.closest('.modal'); if(modal) closeModal(modal);
  }));

  // close on ESC
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ document.querySelectorAll('.modal').forEach(m=>closeModal(m)); }});

  // click outside to close (modal fullscreen)
  document.querySelectorAll('.modal').forEach(m=> m.addEventListener('click', e=>{ if(e.target===m) closeModal(m); }));

  // ---------- forms ----------
  document.getElementById('form-pengunjung').addEventListener('submit', function(e){
    e.preventDefault(); const data = new FormData(e.target); const nama = data.get('nama'); const kelas = data.get('kelas');
    if(!nama || !nama.trim()){ showToast('Nama wajib diisi','error'); return; }
    addVisitor({nama:nama.trim(), kelas:kelas?kelas.trim():'', waktu: new Date().toLocaleString()});
    e.target.reset(); closeModal(modalPeng);
  });

  document.getElementById('form-buku').addEventListener('submit', function(e){
    e.preventDefault(); const data = new FormData(e.target);
    const kode = (data.get('kode')||'').trim(); const judul = (data.get('judul')||'').trim();
    const penerbit = (data.get('penerbit')||'').trim(); const tahun = data.get('tahun') || '';
    const masuk = data.get('masuk') || '';
    if(!kode || !judul){ showToast('Kode dan Judul wajib diisi','error'); return; }
    const ok = addBook({kode, judul, penerbit, tahun: tahun?Number(tahun):'', masuk});
    if(ok){ e.target.reset(); closeModal(modalBuku); }
  });

  // ---------- search ----------
  function filterBooks(q){ renderBooks(q); }
  searchBtn.addEventListener('click', ()=> filterBooks(searchInput.value));
  searchInput.addEventListener('input', ()=> filterBooks(searchInput.value));

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', function() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.body.removeAttribute('data-theme');
      this.querySelector('i').className = 'fas fa-moon';
      localStorage.setItem('theme', 'light');
    } else {
      document.body.setAttribute('data-theme', 'dark');
      this.querySelector('i').className = 'fas fa-sun';
      localStorage.setItem('theme', 'dark');
    }
  });

  // initial render
  renderBooks(''); renderVisitors();
});
