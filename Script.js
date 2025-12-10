function toggleMenu() {
  document.getElementById("sidebar").classList.toggle("show");
}
function searchNovel() {
  const query = document.getElementById('searchInput').value.toLowerCase();
  const resultsContainer = document.getElementById('searchResults');
  resultsContainer.innerHTML = ''; // Kosongkan hasil sebelumnya

  fetch('data/novel.json') // Ganti dengan API jika sudah tersedia
.then(res => res.json())
.then(data => {
      const filtered = data.filter(novel =>
        novel.title.toLowerCase().includes(query)
);

      if (filtered.length === 0) {
        resultsContainer.innerHTML = '<p>Tidak ditemukan.</p>';
        return;
}
filtered.forEach(novel => {
  const item = document.createElement('div');
  item.className = 'novel-card';

  // hitung total views dari semua chapter
  const totalViews = novel.chapters
    ? novel.chapters.reduce((sum, ch) => sum + (ch.views || 0), 0)
    : 0;

  item.innerHTML = `
    <img src="${novel.img}" alt="${novel.title}" class="cover-img" />
    <h3>${novel.title}</h3>
    <p><strong>Status:</strong> ${novel.status}</p>
    <p><strong>Tahun:</strong> ${novel.year}</p>
    <p><strong>Genre:</strong> ${novel.genre1}, ${novel.genre2}</p>
    <p><strong>Rating:</strong> ${novel.rating}</p>
    <p><strong>Total Views:</strong> ${totalViews}</p>
  `;
  resultsContainer.appendChild(item);
});


});
}