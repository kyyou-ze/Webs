// =================== Config ===================
const API_BASE = 'https://api.limenovel.my.id/api';
const STATIC_BASE = 'https://api.limenovel.my.id'; // untuk /uploads
const RAW_DATA_URL = `${API_BASE}/novels`; // sumber data dari API

// =================== UI helpers / elements ===================
const sidebar = document.getElementById('sidebar');
const reader = document.getElementById('reader'); // opsional
const logBox = document.getElementById('logBox'); // opsional

function log(msg) {
  if (!logBox) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.prepend(line);
}

function toggleMenu() {
  if (!sidebar) return;
  sidebar.classList.toggle('show');
}

if (typeof sidebar !== 'undefined' && sidebar && typeof reader !== 'undefined' && reader) {
  sidebar.addEventListener('click', (e) => {
    if (e.target === reader) {
      reader.classList.remove('show');
      reader.classList.add('hide');
      setTimeout(() => {
        if (reader && reader.parentElement) document.body.removeChild(reader);
      }, 300);
    }
  });
}

// =================== Auth / headers ===================
function getToken() {
  return localStorage.getItem('LN_TOKEN') || null;
}
function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

// =================== Helpers ===================
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Pastikan img selalu URL penuh. Jika relatif (/uploads/...), prefix dengan STATIC_BASE.
function getImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) return `${STATIC_BASE}${url}`;
  return url;
}

// Fungsi untuk load image dengan auth header
async function loadImageWithAuth(url) {
  try {
    const response = await fetch(url, { 
      headers: { ...authHeaders() },
      mode: 'cors'
    });
    if (!response.ok) {
      console.error('Failed to fetch image:', url, response.status);
      return null;
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error loading image:', url, err);
    return null;
  }
}



// =================== Data store ===================
let novelData = [];

// =================== Carousel state ===================
let track = null;
let slides = [];
let index = 0;
let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let dragging = false;
let autoSlideInterval = null;

// =================== Fetch / Load data (dari API) ===================
async function loadNovelData() {
  try {
    const res = await fetch(RAW_DATA_URL, { headers: { ...authHeaders() } });
    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try { const j = await res.json(); if (j && j.message) errText = j.message; } catch {}
      throw new Error('Gagal ambil data: ' + errText);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.novels || []);

    // Normalisasi img ke URL penuh
    novelData = list.map(n => {
      const imgUrl = getImageUrl(n.img);
      console.log('Novel:', n.title, '| Original img:', n.img, '| Processed:', imgUrl);
      return { ...n, img: imgUrl };
    });
    log && log(`loadNovelData: ${novelData.length} items`);
    return novelData;
  } catch (err) {
    console.error('loadNovelData error:', err);
    log && log('loadNovelData error: ' + err.message);
    novelData = [];
    return novelData;
  }
}

// =================== Realtime search ===================
async function setupRealtimeSearch(searchInput, resultsContainer) {
  if (!searchInput || !resultsContainer) return;

  searchInput.addEventListener('input', async () => {
    const keyword = (searchInput.value || '').trim().toLowerCase();
    resultsContainer.innerHTML = '';

    if (keyword === '') {
      resultsContainer.textContent = "Tidak ada hasil";
      return;
    }

    const filtered = novelData.filter(novel =>
      (novel.title || '').toLowerCase().includes(keyword)
    );

    if (filtered.length === 0) {
      resultsContainer.textContent = "Tidak ada hasil";
      return;
    }

    // Load images dengan auth
    resultsContainer.innerHTML = '<p style="text-align:center;padding:20px;">Loading...</p>';
    
    const withImages = await Promise.all(
      filtered.map(async (novel) => {
        const blobUrl = await loadImageWithAuth(novel.img);
        return { ...novel, blobUrl };
      })
    );

    resultsContainer.innerHTML = '';
    withImages.forEach(novel => {
      const div = document.createElement('div');
      div.classList.add('novel-card');

      const totalViews = Array.isArray(novel.chapters)
        ? novel.chapters.reduce((sum, ch) => sum + (Number(ch.views) || 0), 0)
        : 0;

      const imgSrc = novel.blobUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23ddd%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E';

      div.innerHTML = `
      <div onclick="location.href='desk.html?id=${encodeURIComponent(novel.id || novel._id || '')}'">
        <img src="${imgSrc}" alt="${escapeHtml(novel.title || '')}" class="cover-img" />
        <h3>${escapeHtml(novel.title || '-')}</h3>
        <p><strong>Status:</strong> ${escapeHtml(novel.status || '-')}</p>
        <p><strong>Tahun:</strong> ${escapeHtml(novel.year || '-')}</p>
        <p><strong>Genre:</strong> ${escapeHtml([novel.genre1, novel.genre2, novel.genre3].filter(Boolean).join(', ') || '-')}</p>
        <p><strong>Rating:</strong> ${escapeHtml(novel.rating || '-')}</p>
        <p><strong>Total Views:</strong> ${totalViews}</p>
      </div>
      `;
      resultsContainer.appendChild(div);
    });
  });
}

// =================== Manual search (button) ===================
async function searchNovel(searchInput, resultsContainer) {
  if (!resultsContainer || !searchInput) return;
  const query = (searchInput.value || '').trim().toLowerCase();
  resultsContainer.innerHTML = '';

  if (!query) {
    resultsContainer.innerHTML = '<p>Silakan ketik judul novel untuk mencari.</p>';
    return;
  }

  try {
    if (!Array.isArray(novelData) || novelData.length === 0) {
      await loadNovelData();
    }

    const filtered = novelData.filter(novel =>
      (novel.title || '').toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<p>Tidak ditemukan.</p>';
      return;
    }

    resultsContainer.innerHTML = '<p style="text-align:center;padding:20px;">Loading images...</p>';

    // Load images dengan auth
    const withImages = await Promise.all(
      filtered.map(async (novel) => {
        const blobUrl = await loadImageWithAuth(novel.img);
        return { ...novel, blobUrl };
      })
    );

    resultsContainer.innerHTML = '';
    withImages.forEach(novel => {
      const item = document.createElement('div');
      item.className = 'novel-card';
      const totalViews = Array.isArray(novel.chapters)
        ? novel.chapters.reduce((sum, ch) => sum + (Number(ch.views) || 0), 0)
        : 0;

      const imgSrc = novel.blobUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23ddd%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E';

      item.innerHTML = `
      <div onclick="location.href='desk.html?id=${encodeURIComponent(novel.id || novel._id || '')}'">
        <img src="${imgSrc}" alt="${escapeHtml(novel.title || '')}" class="cover-img" />
        <h3>${escapeHtml(novel.title || '-')}</h3>
        <p><strong>Status:</strong> ${escapeHtml(novel.status || '-')}</p>
        <p><strong>Tahun:</strong> ${escapeHtml(novel.year || '-')}</p>
        <p><strong>Genre:</strong> ${escapeHtml([novel.genre1, novel.genre2, novel.genre3].filter(Boolean).join(', ') || '-')}</p>
        <p><strong>Rating:</strong> ${escapeHtml(novel.rating || '-')}</p>
        <p><strong>Total Views:</strong> ${totalViews}</p>
      </div>
      `;
      resultsContainer.appendChild(item);
    });

  } catch (error) {
    console.error('searchNovel error:', error);
    resultsContainer.innerHTML = '<p>Terjadi kesalahan saat mengambil data.</p>';
    log && log('searchNovel error: ' + (error.message || error));
  }
}

// =================== Load by genre ===================
async function loadGenre(genre) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;
  resultsContainer.innerHTML = `<p>Memuat novel genre "${escapeHtml(genre)}"...</p>`;

  try {
    if (!Array.isArray(novelData) || novelData.length === 0) {
      await loadNovelData();
    }

    const filtered = novelData.filter(n =>
      (n.genre1 === genre) || (n.genre2 === genre) || (n.genre3 === genre)
    );

    if (filtered.length === 0) {
      resultsContainer.innerHTML = `<p>Tidak ada novel dengan genre "${escapeHtml(genre)}".</p>`;
      return;
    }

    resultsContainer.innerHTML = '<p style="text-align:center;padding:20px;">Loading images...</p>';

    // Load images dengan auth
    const withImages = await Promise.all(
      filtered.map(async (novel) => {
        const blobUrl = await loadImageWithAuth(novel.img);
        return { ...novel, blobUrl };
      })
    );

    resultsContainer.innerHTML = '';
    withImages.forEach(novel => {
      const item = document.createElement('div');
      item.className = 'novel-card';
      const totalViews = Array.isArray(novel.chapters)
        ? novel.chapters.reduce((sum, ch) => sum + (Number(ch.views) || 0), 0)
        : 0;

      const imgSrc = novel.blobUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22280%22%3E%3Crect fill=%22%23ddd%22 width=%22200%22 height=%22280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3ENo Image%3C/text%3E%3C/svg%3E';

      item.innerHTML = `
      <div onclick="location.href='desk.html?id=${encodeURIComponent(novel.id || novel._id || '')}'">
        <img src="${imgSrc}" alt="${escapeHtml(novel.title || '')}" class="cover-img" />
        <h3>${escapeHtml(novel.title || '-')}</h3>
        <p><strong>Status:</strong> ${escapeHtml(novel.status || '-')}</p>
        <p><strong>Tahun:</strong> ${escapeHtml(novel.year || '-')}</p>
        <p><strong>Genre:</strong> ${escapeHtml([novel.genre1, novel.genre2, novel.genre3].filter(Boolean).join(', ') || '-')}</p>
        <p><strong>Rating:</strong> ${escapeHtml(novel.rating || '-')}</p>
        <p><strong>Total Views:</strong> ${totalViews}</p>
      </div>
      `;
      resultsContainer.appendChild(item);
    });

  } catch (error) {
    console.error('loadGenre error:', error);
    resultsContainer.innerHTML = '<p>Terjadi kesalahan saat mengambil data genre.</p>';
    log && log('loadGenre error: ' + (error.message || error));
  }
}

// =================== Genres ===================
async function loadGenres(dropdown) {
  if (!dropdown) return;
  dropdown.innerHTML = '<p class="genre-loading" style="padding:8px;">Memuat genre...</p>';

  try {
    if (!Array.isArray(novelData) || novelData.length === 0) {
      await loadNovelData();
    }

    if (!Array.isArray(novelData) || novelData.length === 0) {
      dropdown.innerHTML = '<p class="genre-empty" style="padding:8px;">Tidak ada genre.</p>';
      return;
    }

    const genres = new Set();
    novelData.forEach(n => {
      if (n.genre1) genres.add(n.genre1);
      if (n.genre2) genres.add(n.genre2);
      if (n.genre3) genres.add(n.genre3);
    });

    dropdown.innerHTML = '';
    Array.from(genres).sort().forEach(g => {
      const link = document.createElement('a');
      link.href = 'javascript:void(0)';
      link.className = 'genre-item';
      link.setAttribute('data-genre', g);
      link.textContent = g;
      link.addEventListener('click', () => {
        setActiveGenre(g);
        loadGenre(g);
      });
      dropdown.appendChild(link);
    });

  } catch (err) {
    console.error('loadGenres error:', err);
    dropdown.innerHTML = '<p class="genre-error" style="padding:8px;">Gagal memuat genre.</p>';
    log && log('loadGenres error: ' + err.message);
  }
}

function setActiveGenre(name) {
  document.querySelectorAll('.genre-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-genre') === name);
  });
}

// =================== Carousel ===================
async function loadCarousel() {
  track = document.getElementById('carouselTrack');
  if (!track) return;

  try {
    // Gunakan novelData yang sudah di-load, jangan fetch ulang
    if (!Array.isArray(novelData) || novelData.length === 0) {
      await loadNovelData();
    }

    track.innerHTML = '<p style="text-align:center;padding:20px;">Loading images...</p>';
    
    // Preload images dengan auth
    const slidesData = await Promise.all(
      novelData.map(async (item) => {
        const blobUrl = await loadImageWithAuth(item.img);
        return { ...item, blobUrl };
      })
    );

    track.innerHTML = '';
    slidesData.forEach(item => {
      const slide = document.createElement('div');
      slide.className = 'slide';
      
      const imgSrc = item.blobUrl || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22400%22%3E%3Crect fill=%22%23ddd%22 width=%22300%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3EImage Not Available%3C/text%3E%3C/svg%3E';
      
      slide.innerHTML = `
      <div onclick="location.href='desk.html?id=${encodeURIComponent(item.id || item._id || '')}'">
        <img src="${imgSrc}" alt="${escapeHtml(item.title || '')}">
        <div class="slide-info">
          <span class="status">${escapeHtml(item.status || '')}</span>
          <h3>${escapeHtml(item.title || '')}</h3>
          <div class="tags">
            <span class="rating">${escapeHtml(item.rating || '')}</span>
            <span class="views">${escapeHtml(item.views || '')}</span>
            ${(Array.isArray(item.genres) ? item.genres : [item.genre1, item.genre2, item.genre3].filter(Boolean)).map(g => `<span class="genre">${escapeHtml(g)}</span>`).join('')}
          </div>
        </div>
      </div>
      `;
      track.appendChild(slide);
    });

    slides = Array.from(track.querySelectorAll('.slide'));
    index = 0;
    update(false);
    attachCarouselEvents();
    startAutoSlide();
    log && log('Carousel loaded: ' + slides.length);
  } catch (err) {
    console.error('loadCarousel error:', err);
    if (track) track.innerHTML = '<p>Gagal memuat data carousel.</p>';
    log && log('loadCarousel error: ' + err.message);
  }
}

function update(smooth = true) {
  if (!track || slides.length === 0) return;
  const slideEl = slides[0];
  const w = slideEl.offsetWidth + 20;
  const parent = track.parentElement;
  const o = parent ? (parent.offsetWidth - slideEl.offsetWidth) / 2 : 0;
  currentTranslate = -(index * w) + o;
  track.style.transition = smooth ? "transform .35s ease" : "none";
  track.style.transform = `translateX(${currentTranslate}px)`;
  prevTranslate = currentTranslate;
  updateClasses();
}

function updateClasses() {
  slides.forEach((s, i) => {
    s.classList.remove('active', 'adjacent', 'far');
    if (i === index) s.classList.add('active');
    else if (Math.abs(i - index) === 1) s.classList.add('adjacent');
    else s.classList.add('far');
  });
}

function attachCarouselEvents() {
  if (!track) return;

  track.addEventListener('pointerdown', e => {
    startX = e.clientX;
    dragging = true;
    track.style.transition = "none";
    try { track.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  window.addEventListener('pointermove', e => {
    if (!dragging || !track) return;
    const d = e.clientX - startX;
    currentTranslate = prevTranslate + d;
    track.style.transform = `translateX(${currentTranslate}px)`;
  });

  window.addEventListener('pointerup', e => {
    if (!dragging || !track) return;
    dragging = false;
    const d = e.clientX - startX;
    const w = slides[0] ? slides[0].offsetWidth + 20 : 1;
    if (d < -w / 4) index = (index + 1) % slides.length;
    else if (d > w / 4) index = (index - 1 + slides.length) % slides.length;
    update(true);
    try { track.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  window.addEventListener('resize', () => update(false));
}

function startAutoSlide() {
  stopAutoSlide();
  autoSlideInterval = setInterval(() => {
    if (slides.length === 0) return;
    index = (index + 1) % slides.length;
    update(true);
  }, 3000);
}

function stopAutoSlide() {
  if (autoSlideInterval) {
    clearInterval(autoSlideInterval);
    autoSlideInterval = null;
  }
}

// =================== Init on DOM ready ===================
document.addEventListener('DOMContentLoaded', async () => {
  const resultsContainer = document.getElementById('searchResults');
  const searchInput = document.getElementById('searchInput');
  const genreDropdown = document.getElementById('genreDropdown');

  await loadNovelData();
  setupRealtimeSearch(searchInput, resultsContainer);
  await loadGenres(genreDropdown);

  const searchBtn = document.getElementById('searchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => searchNovel(searchInput, resultsContainer));
  }

  await loadCarousel();
  log && log('Init complete');
});