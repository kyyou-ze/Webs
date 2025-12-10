function getIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

const chapterList = document.getElementById("chapterList");
const btnNewest = document.getElementById("btnNewest");
const btnOldest = document.getElementById("btnOldest");

let chapters = [];

function renderChapters(data) {
  chapterList.innerHTML = "";
  data.forEach((chapter) => {
    const div = document.createElement("div");
    div.className = "chapter-item";
    div.innerHTML = `
      <div>
        <div onclick="location.href='ch.html?id=${getIdFromUrl()}&ch=${chapter._id}'>
          <i class="fas fa-book-open"></i>${chapter.title}
        </div>
        <div class="views"><i class="fas fa-eye"></i>${chapter.views || 0}</div>
      </div>
    `;
    chapterList.appendChild(div);
  });
}

async function loadNovel() {
  try {
    const id = getIdFromUrl();
    // 🔗 panggil API backend
    const res = await fetch(`https://api.limenovel.my.id/api/novels/${id}`);
    if (!res.ok) throw new Error('Network response not OK');
    const { novel } = await res.json();

    if (!novel) {
      document.getElementById('novel-slider').innerHTML = '<p>Novel tidak ditemukan.</p>';
      return;
    }

    // Detail novel
    const detailHTML = `
      <div class="card">
        <img src="${novel.img}" alt="${novel.title}" />
        <h2>${novel.title}</h2>
        <div class="meta">
          <i class="fas fa-star"></i>${novel.rating}
          <i class="fas fa-calendar-alt"></i> ${novel.year}
          <i class="fas fa-check-circle"></i>${novel.status}
        </div>
        <div class="genre">
          <i class="fas fa-tags"></i> ${novel.genre1}${novel.genre2 ? ', ' + novel.genre2 : ''}
        </div>
        <button class="btn-back" onclick="location.href='index.html'">
          <i class="fas fa-arrow-left"></i> Kembali
        </button>
      </div>
      <div class="section">
        <h3>Sinopsis</h3>
        <p>${novel.summary}</p>
      </div>
    `;
    document.getElementById('novel-slider').innerHTML = detailHTML;

    // Daftar chapter
    chapters = novel.chapters || [];
    renderChapters(chapters);

  } catch (err) {
    console.error('Error fetching API:', err);
    document.getElementById('novel-slider').innerHTML = '<p>Gagal memuat data.</p>';
  }
}

// Tombol urutan chapter
btnNewest.addEventListener("click", () => {
  btnNewest.classList.add("active");
  btnOldest.classList.remove("active");
  renderChapters(chapters);
});

btnOldest.addEventListener("click", () => {
  btnOldest.classList.add("active");
  btnNewest.classList.remove("active");
  renderChapters([...chapters].slice().reverse());
});

// Jalankan load
loadNovel();
