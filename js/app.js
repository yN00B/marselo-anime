// =============================================
// MARSELO ANIME — MAIN APP
// Routing, rendering, UI orchestration
// =============================================

let currentPage = 'home';
let browseCurrentPage = 1;
let browseCurrentFilter = 'all';
let browseSearchQuery = '';
let searchTimer = null;
let currentDetailAnime = null;
let currentWatchId = null;
let currentWatchEp = 1;

// ── NAVIGATION ──

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${page}`);
  if (!el) return;
  el.classList.add('active');
  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  SoundEngine.transition();

  if (page === 'browse')  initBrowse();
  if (page === 'mylist')  renderMyList();
}

// ── MODAL ──

function openModal(type) {
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById(`modal-${type}`).classList.add('open');
  SoundEngine.click();
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── TOAST ──

let toastTimer = null;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3000);
}

// ── CARD BUILDER ──

function buildAnimeCard(anime, onClick) {
  const card   = document.createElement('div');
  card.className = 'anime-card';
  const img    = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const title  = anime.title_english || anime.title || 'Unknown';
  const score  = anime.score ? `⭐ ${anime.score}` : '';
  const ep     = anime.episodes ? `${anime.episodes} eps` : anime.type || '';
  const inList = Auth.isInList(anime.mal_id);

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${img}" alt="${escHtml(title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300/0d0d1a/c9a84c?text=No+Image'"/>
      <div class="card-overlay"></div>
      <div class="card-play">▶</div>
      ${anime.airing ? '<div class="card-badge">Airing</div>' : ''}
      <button class="card-wishlist ${inList ? 'active' : ''}" onclick="toggleList(event, this)" data-id="${anime.mal_id}" data-title="${escHtml(title)}" data-img="${img}" data-score="${anime.score || ''}">
        ${inList ? '♥' : '♡'}
      </button>
    </div>
    <div class="card-info">
      <div class="card-title">${escHtml(title)}</div>
      <div class="card-meta">
        ${score ? `<span class="card-score">${score}</span>` : ''}
        ${ep ? `<span>${ep}</span>` : ''}
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('card-wishlist') || e.target.closest('.card-wishlist')) return;
    if (onClick) { onClick(anime); return; }
    openDetailPage(anime);
  });

  return card;
}

function toggleList(e, btn) {
  e.stopPropagation();
  const id    = parseInt(btn.dataset.id);
  const inList = Auth.isInList(id);
  if (inList) {
    Auth.removeFromList(id);
    btn.textContent = '♡';
    btn.classList.remove('active');
    showToast('Removed from My List');
  } else {
    Auth.addToList({
      mal_id: id,
      title: btn.dataset.title,
      images: { jpg: { image_url: btn.dataset.img } },
      score: btn.dataset.score
    });
    btn.textContent = '♥';
    btn.classList.add('active');
    SoundEngine.success();
    showToast('Added to My List ✦', 'gold');
  }
}

// ── HOME ──

async function initHome() {
  // Load sections in parallel
  Promise.all([
    loadRow('trending-row', () => API.getTrending()),
    loadRow('toprated-row', () => API.getTopRated()),
    loadRow('seasonal-row', () => API.getSeasonal()),
  ]);
}

async function loadRow(containerId, fetcher) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const items = await fetcher();
    container.innerHTML = '';
    items.slice(0, 12).forEach(anime => {
      container.appendChild(buildAnimeCard(anime));
    });
  } catch (e) {
    container.innerHTML = `<div style="color:var(--text-dimmer);padding:20px">Failed to load. Check your connection.</div>`;
  }
}

// ── BROWSE ──

async function initBrowse() {
  browseCurrentPage = 1;
  await loadBrowse();
}

async function loadBrowse() {
  const grid = document.getElementById('browse-grid');
  if (!grid) return;
  grid.innerHTML = Array(8).fill('<div class="card-skeleton" style="height:290px"></div>').join('');

  try {
    const q = browseSearchQuery.trim();
    const { results, pagination } = await API.search(q || 'a', browseCurrentFilter, browseCurrentPage);
    grid.innerHTML = '';
    if (results.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-dimmer);padding:60px">No results found.</div>';
      return;
    }
    results.forEach((anime, i) => {
      const card = buildAnimeCard(anime);
      card.style.setProperty('--i', i);
      grid.appendChild(card);
    });
    document.getElementById('page-indicator').textContent = `Page ${browseCurrentPage}`;
    document.getElementById('prev-btn').disabled = browseCurrentPage <= 1;
    document.getElementById('next-btn').disabled = !pagination.has_next_page;
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-dimmer);padding:60px">Failed to load results.</div>';
  }
}

function debounceSearch() {
  browseSearchQuery = document.getElementById('search-input')?.value || '';
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { browseCurrentPage = 1; loadBrowse(); }, 500);
}

function setFilter(filter, btn) {
  browseCurrentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  browseCurrentPage = 1;
  loadBrowse();
}

function changePage(dir) {
  browseCurrentPage = Math.max(1, browseCurrentPage + dir);
  loadBrowse();
  document.querySelector('.browse-grid-wrap')?.scrollIntoView({ behavior: 'smooth' });
}

// ── DETAIL PAGE ──

async function openDetailPage(anime) {
  navigateTo('detail');
  currentDetailAnime = anime;
  const container = document.getElementById('detail-content');
  container.innerHTML = '<div style="text-align:center;padding:100px 40px;color:var(--text-dim)"><div style="font-size:32px;color:var(--gold);animation:spin 1s linear infinite;display:inline-block">◆</div></div>';

  try {
    const full = await API.getAnime(anime.mal_id);
    if (!full) throw new Error('Not found');
    currentDetailAnime = full;
    renderDetailPage(full);
  } catch {
    renderDetailPage(anime);
  }
}

function renderDetailPage(anime) {
  const container = document.getElementById('detail-content');
  const img     = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const title   = anime.title_english || anime.title || 'Unknown';
  const genres  = (anime.genres || []).map(g => `<span class="genre-tag">${g.name}</span>`).join('');
  const score   = anime.score || 'N/A';
  const year    = anime.year || (anime.aired?.prop?.from?.year) || '';
  const eps     = anime.episodes || '?';
  const status  = anime.status || '';
  const synopsis = anime.synopsis?.replace(/\[Written by.*?\]/g,'').trim() || 'No synopsis available.';
  const rating  = anime.rating || '';

  container.innerHTML = `
    <div class="detail-hero">
      <div class="detail-backdrop" style="background-image:url('${img}')"></div>
      <div class="detail-backdrop-overlay"></div>
      <div class="detail-content">
        <div class="detail-poster">
          <img src="${img}" alt="${escHtml(title)}" onerror="this.src='https://via.placeholder.com/220x320/0d0d1a/c9a84c?text=No+Image'"/>
        </div>
        <div class="detail-info">
          <div class="detail-genres">${genres || '<span class="genre-tag">Anime</span>'}</div>
          <h1 class="detail-title">${escHtml(title)}</h1>
          <div class="detail-meta-row">
            <div class="detail-score-badge">⭐ ${score}</div>
            ${year ? `<span class="detail-meta-item">📅 ${year}</span>` : ''}
            <span class="detail-meta-item">🎬 ${eps} eps</span>
            ${status ? `<span class="detail-meta-item">• ${status}</span>` : ''}
            ${rating ? `<span class="detail-meta-item">• ${rating}</span>` : ''}
          </div>
          <p class="detail-synopsis">${escHtml(synopsis)}</p>
          <div class="detail-actions">
            <button class="btn-primary" onclick="openWatchPage(${anime.mal_id}, 1)">
              <span>▶ Watch Now</span><span class="btn-arrow">→</span>
            </button>
            <button class="btn-ghost" onclick="addToListFromDetail(${anime.mal_id})" id="detail-list-btn">
              <span>${Auth.isInList(anime.mal_id) ? '♥ In My List' : '♡ Add to List'}</span>
            </button>
            ${Party.isInRoom() ? `<button class="btn-ghost" onclick="Party.pickAnime(currentDetailAnime, 1);showToast('Party watching ${escHtml(title)} ✦','gold')">◆ Watch in Party</button>` : ''}
          </div>
        </div>
      </div>
    </div>
    <div class="detail-lower">
      <div id="detail-related"></div>
    </div>
  `;

  loadRelated(anime.mal_id);
}

function addToListFromDetail(malId) {
  const btn = document.getElementById('detail-list-btn');
  if (Auth.isInList(malId)) {
    Auth.removeFromList(malId);
    if (btn) btn.innerHTML = '<span>♡ Add to List</span>';
    showToast('Removed from My List');
  } else {
    Auth.addToList(currentDetailAnime);
    if (btn) btn.innerHTML = '<span>♥ In My List</span>';
    SoundEngine.success();
    showToast('Added to My List ✦', 'gold');
  }
}

async function loadRelated(malId) {
  const container = document.getElementById('detail-related');
  if (!container) return;
  try {
    const related = await API.getRelated(malId);
    if (!related.length) return;
    container.innerHTML = `
      <div class="section-header" style="margin-bottom:28px">
        <div class="section-eyebrow">◆ YOU MAY ALSO LIKE</div>
        <h2 class="section-title">Recommended</h2>
      </div>
      <div class="cards-row" id="related-row"></div>
    `;
    const row = document.getElementById('related-row');
    related.forEach(a => row.appendChild(buildAnimeCard(a)));
  } catch {}
}

// ── WATCH PAGE ──

function openWatchPage(malId, episode = 1) {
  navigateTo('watch');
  currentWatchId = malId;
  currentWatchEp = episode;
  loadEpisode(malId, episode);

  // Show sidebar if in party
  const sidebar = document.getElementById('watch-sidebar');
  if (sidebar) sidebar.style.display = Party.isInRoom() ? '' : 'none';
}

function loadEpisode(malId, episode) {
  currentWatchEp = episode;
  const iframe = document.getElementById('watch-iframe');
  if (!iframe) return;

  const url = API.getVideoEmbed(malId, episode);
  iframe.src = url;

  // Update info bar
  const bar = document.getElementById('watch-info-bar');
  if (bar && currentDetailAnime) {
    const title = currentDetailAnime.title_english || currentDetailAnime.title || '';
    bar.innerHTML = `
      <strong style="color:var(--text)">${escHtml(title)}</strong>
      <span style="color:var(--gold);margin-left:16px">Episode ${episode}</span>
      ${Party.isInRoom() ? `<span style="margin-left:16px;color:var(--purple-light)">◆ Watch Party Active</span>` : ''}
    `;
  }

  // Update episode buttons
  updateEpisodeButtons(episode);

  // Sync party if host
  if (Party.isInRoom() && Party.getIsHost()) {
    Party.syncState({ malId, episode });
  }
}

function updateEpisodeButtons(activeEp) {
  const container = document.getElementById('episode-list');
  if (!container || !currentDetailAnime) return;
  const total = currentDetailAnime.episodes || 1;
  // Cap at 100 buttons for performance
  const show = Math.min(total, 100);
  container.innerHTML = '';
  for (let i = 1; i <= show; i++) {
    const btn = document.createElement('button');
    btn.className = 'ep-btn' + (i === activeEp ? ' active' : '');
    btn.textContent = i;
    btn.onclick = () => loadEpisode(currentWatchId, i);
    container.appendChild(btn);
  }
  if (total > 100) {
    const more = document.createElement('div');
    more.style.cssText = 'color:var(--text-dimmer);font-size:12px;padding:8px;align-self:center';
    more.textContent = `+${total - 100} more episodes`;
    container.appendChild(more);
  }
}

// ── MY LIST ──

function renderMyList() {
  const grid  = document.getElementById('mylist-grid');
  const empty = document.getElementById('mylist-empty');
  if (!grid) return;
  const list = Auth.getList();
  grid.innerHTML = '';
  if (list.length === 0) {
    empty && grid.appendChild(empty);
    empty && (empty.style.display = '');
    return;
  }
  list.forEach(item => {
    const card = buildAnimeCard(item);
    grid.appendChild(card);
  });
}

// ── UTILS ──

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── LOADING SCREEN ──

window.addEventListener('load', () => {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.classList.add('hidden');
    initHome();
    SoundEngine.init();
    // Start ambient after first user interaction
    document.addEventListener('click', () => SoundEngine.startAmbient(), { once: true });
  }, 2400);
});

// ── NAVBAR SCROLL ──
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── SCROLL REVEAL ──
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
