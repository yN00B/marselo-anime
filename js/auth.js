// =============================================
// MARSELO ANIME — AUTH SYSTEM
// Communicates with Node.js backend
// =============================================

const Auth = (() => {
  // Backend URL — change this to your deployed Cloudflare Worker or Express URL
  const BACKEND = window.MARSELO_API || 'http://localhost:3001';

  let currentUser = null;
  let token = null;

  function init() {
    token = localStorage.getItem('marselo_token');
    const stored = localStorage.getItem('marselo_user');
    if (token && stored) {
      try {
        currentUser = JSON.parse(stored);
        onLogin(currentUser);
      } catch { logout(); }
    }
  }

  async function register(username, email, password) {
    const res = await fetch(`${BACKEND}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('marselo_token', token);
    localStorage.setItem('marselo_user', JSON.stringify(currentUser));
    onLogin(currentUser);
    return currentUser;
  }

  async function login(email, password) {
    const res = await fetch(`${BACKEND}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('marselo_token', token);
    localStorage.setItem('marselo_user', JSON.stringify(currentUser));
    onLogin(currentUser);
    return currentUser;
  }

  function logout() {
    currentUser = null; token = null;
    localStorage.removeItem('marselo_token');
    localStorage.removeItem('marselo_user');
    onLogout();
  }

  function onLogin(user) {
    document.getElementById('user-nav-area').style.display  = 'none';
    document.getElementById('user-logged-area').style.display = '';
    const av = document.getElementById('nav-avatar');
    const nm = document.getElementById('user-menu-name');
    if (av) av.textContent = (user.username || user.email || 'U')[0].toUpperCase();
    if (nm) nm.textContent = user.username || user.email;
  }

  function onLogout() {
    document.getElementById('user-nav-area').style.display  = '';
    document.getElementById('user-logged-area').style.display = 'none';
  }

  function authHeader() {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  function isLoggedIn() { return !!currentUser; }
  function getUser()    { return currentUser; }
  function getToken()   { return token; }

  // My List (stored locally + synced to backend when logged in)
  function getList() {
    return JSON.parse(localStorage.getItem('marselo_list') || '[]');
  }

  function addToList(anime) {
    const list = getList();
    if (list.find(a => a.mal_id === anime.mal_id)) return false;
    list.push({ mal_id: anime.mal_id, title: anime.title, image: anime.images?.jpg?.image_url, score: anime.score });
    localStorage.setItem('marselo_list', JSON.stringify(list));
    return true;
  }

  function removeFromList(malId) {
    const list = getList().filter(a => a.mal_id !== malId);
    localStorage.setItem('marselo_list', JSON.stringify(list));
  }

  function isInList(malId) {
    return getList().some(a => a.mal_id === malId);
  }

  return { init, register, login, logout, isLoggedIn, getUser, getToken, authHeader, getList, addToList, removeFromList, isInList };
})();

// ── UI HANDLERS ──

async function loginUser() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err      = document.getElementById('login-error');
  err.textContent = '';
  if (!email || !password) { err.textContent = 'Please fill in all fields.'; return; }
  try {
    await Auth.login(email, password);
    closeModal();
    SoundEngine.success();
    showToast('Welcome back! ✦', 'gold');
  } catch (e) {
    SoundEngine.error();
    err.textContent = e.message;
  }
}

async function registerUser() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const err      = document.getElementById('reg-error');
  err.textContent = '';
  if (!username || !email || !password) { err.textContent = 'Please fill in all fields.'; return; }
  if (password.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return; }
  try {
    await Auth.register(username, email, password);
    closeModal();
    SoundEngine.success();
    showToast(`Welcome to Marselo Anime, ${username}! ✦`, 'gold');
  } catch (e) {
    SoundEngine.error();
    err.textContent = e.message;
  }
}

function logoutUser() {
  Auth.logout();
  showToast('Signed out. See you soon!');
  navigateTo('home');
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-menu');
  const wrap = document.querySelector('.user-avatar-wrap');
  if (menu && wrap && !wrap.contains(e.target)) {
    menu.classList.remove('open');
  }
});

Auth.init();
