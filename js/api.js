// =============================================
// MARSELO ANIME — API LAYER
// MAL via Jikan v4 + AniKoto/MegaPlay video
// =============================================

const API = (() => {
  const JIKAN = 'https://api.jikan.moe/v4';
  const VIDEO = 'https://megaplay.buzz/api';
  const CACHE = new Map();

  // Rate-limit safe fetch with cache
  async function jikan(path, params = {}) {
    const query = new URLSearchParams(params).toString();
    const key   = `${path}?${query}`;
    if (CACHE.has(key)) return CACHE.get(key);

    // Retry with backoff for 429
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${JIKAN}${path}?${query}`);
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        if (!res.ok) throw new Error(`Jikan ${res.status}`);
        const data = await res.json();
        CACHE.set(key, data);
        return data;
      } catch (e) {
        if (attempt === 2) throw e;
        await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }

  // ── PUBLIC API ──

  async function getTrending() {
    const data = await jikan('/top/anime', { filter: 'airing', limit: 12 });
    return data?.data || [];
  }

  async function getTopRated() {
    const data = await jikan('/top/anime', { filter: 'bypopularity', limit: 12 });
    return data?.data || [];
  }

  async function getSeasonal() {
    const now  = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const seasons = ['winter','spring','summer','fall'];
    const season  = seasons[Math.floor(month / 3)];
    try {
      const data = await jikan(`/seasons/${year}/${season}`, { limit: 12 });
      return data?.data || [];
    } catch {
      return (await jikan('/seasons/now', { limit: 12 }))?.data || [];
    }
  }

  async function search(query, genre = '', page = 1) {
    const params = { q: query, page, limit: 20, order_by: 'score', sort: 'desc' };
    if (genre && genre !== 'all') params.genres = genreToId(genre);
    const data = await jikan('/anime', params);
    return { results: data?.data || [], pagination: data?.pagination || {} };
  }

  async function getAnime(id) {
    const data = await jikan(`/anime/${id}/full`);
    return data?.data || null;
  }

  async function getCharacters(id) {
    const data = await jikan(`/anime/${id}/characters`);
    return data?.data?.slice(0, 8) || [];
  }

  async function getRelated(id) {
    const data = await jikan(`/anime/${id}/recommendations`);
    return data?.data?.slice(0, 6).map(r => r.entry) || [];
  }

  // Build video embed URL using AniKoto/MegaPlay API
  function getVideoEmbed(malId, episode = 1) {
    // MegaPlay/AniKoto embed format
    return `${VIDEO}/embed/${malId}/${episode}`;
  }

  // Alternative embed formats to try
  function getVideoEmbedAlts(malId, episode = 1) {
    return [
      `${VIDEO}/embed/${malId}/${episode}`,
      `${VIDEO}/player?id=${malId}&ep=${episode}`,
      `${VIDEO}/watch/${malId}?episode=${episode}`,
    ];
  }

  // Genre name → Jikan genre ID mapping
  function genreToId(genre) {
    const map = {
      action: 1, adventure: 2, comedy: 4, drama: 8, fantasy: 10,
      horror: 14, mystery: 7, romance: 22, 'sci-fi': 24, 'slice_of_life': 36,
      supernatural: 37, thriller: 41, sports: 30, 'school': 23,
    };
    return map[genre.toLowerCase()] || '';
  }

  return {
    getTrending, getTopRated, getSeasonal,
    search, getAnime, getCharacters, getRelated,
    getVideoEmbed, getVideoEmbedAlts
  };
})();
