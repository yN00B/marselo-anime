// =============================================
// MARSELO ANIME — WATCH PARTY ENGINE
// WebSocket-based sync for up to 30 people
// =============================================

const Party = (() => {
  const WS_URL = window.MARSELO_WS || 'ws://localhost:3001';
  const MAX_MEMBERS = 30;

  let ws = null;
  let roomCode = null;
  let members  = [];
  let isHost   = false;
  let myName   = '';
  let currentAnime = null;
  let currentEp    = 1;
  let chatMessages = [];
  let reconnectTimer = null;

  function genCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  function connect(code, name, host) {
    roomCode = code;
    myName   = name;
    isHost   = host;
    const url = `${WS_URL}?room=${code}&name=${encodeURIComponent(name)}&host=${host ? '1' : '0'}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[Party] Connected to room', code);
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      send({ type: 'join', name, host });
    };

    ws.onmessage = (e) => {
      try { handle(JSON.parse(e.data)); } catch {}
    };

    ws.onclose = () => {
      console.log('[Party] Connection closed');
      // Auto-reconnect after 3s
      reconnectTimer = setTimeout(() => {
        if (roomCode) connect(roomCode, myName, isHost);
      }, 3000);
    };

    ws.onerror = () => ws.close();
  }

  function handle(msg) {
    switch (msg.type) {
      case 'members':
        members = msg.members;
        renderMembers();
        updateCount();
        break;
      case 'chat':
        addChatMsg(msg.name, msg.text, msg.time);
        break;
      case 'sync':
        if (!isHost) applySyncState(msg.state);
        break;
      case 'pick_anime':
        currentAnime = msg.anime;
        currentEp    = msg.episode || 1;
        if (!isHost) updateWatchFromParty(msg.anime, msg.episode);
        break;
      case 'joined':
        addSystemMsg(`${msg.name} joined the party ✦`);
        SoundEngine.notification();
        break;
      case 'left':
        addSystemMsg(`${msg.name} left the party`);
        break;
      case 'kick':
        if (msg.target === myName) { leavePartyRoom(); showToast('You were removed from the party.', 'error'); }
        break;
    }
  }

  function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  function sendChat(text) {
    send({ type: 'chat', name: myName, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }

  function syncState(state) {
    if (!isHost) return;
    send({ type: 'sync', state });
  }

  function pickAnime(anime, episode = 1) {
    currentAnime = anime; currentEp = episode;
    send({ type: 'pick_anime', anime, episode });
    if (!isHost) return;
    updateWatchFromParty(anime, episode);
  }

  function kick(name) {
    if (!isHost) return;
    send({ type: 'kick', target: name });
  }

  function leave() {
    send({ type: 'leave', name: myName });
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    roomCode = null; members = []; chatMessages = [];
  }

  function addChatMsg(name, text, time) {
    chatMessages.push({ name, text, time });
    renderChatMsg(name, text, time, false);
    if (currentPage === 'watch') renderSidebarChatMsg(name, text);
  }

  function addSystemMsg(text) {
    chatMessages.push({ system: true, text });
    appendSystemMsg('pra-chat-log', text);
    if (currentPage === 'watch') appendSystemMsg('ps-chat-log', text);
  }

  function renderChatMsg(name, text, time, own) {
    appendChatEl('pra-chat-log', name, text, time, own);
    if (currentPage === 'watch') appendChatEl('ps-chat-log', name, text, time, own);
  }

  function appendChatEl(containerId, name, text, time, own) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'chat-msg' + (own ? ' own' : '');
    div.innerHTML = `<span class="chat-user">${escapeHtml(name)}${time ? ' · ' + time : ''}</span><span class="chat-text">${escapeHtml(text)}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function appendSystemMsg(containerId, text) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'chat-msg system';
    div.innerHTML = `<span class="chat-text" style="color:var(--text-dimmer);font-style:italic">${escapeHtml(text)}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }

  function renderSidebarChatMsg(name, text) {
    appendChatEl('ps-chat-log', name, text, '', false);
  }

  function renderMembers() {
    // Party page list
    const list = document.getElementById('pra-members-list');
    if (list) {
      list.innerHTML = members.map(m => `
        <div class="pra-member ${m.host ? 'host' : ''}">
          <div class="av">${m.name[0].toUpperCase()}</div>
          <span>${escapeHtml(m.name)}</span>
          ${m.host ? '<span class="host-badge">Host</span>' : ''}
          ${isHost && !m.host ? `<button onclick="Party.kick('${m.name}')" style="margin-left:auto;background:none;border:none;color:var(--text-dimmer);cursor:pointer;font-size:11px">✕</button>` : ''}
        </div>
      `).join('');
    }
    // Watch sidebar
    const sidebarMembers = document.getElementById('ps-members');
    if (sidebarMembers) {
      sidebarMembers.innerHTML = members.map(m => `
        <div class="ps-member" title="${escapeHtml(m.name)}">${m.name[0].toUpperCase()}</div>
      `).join('');
    }
  }

  function updateCount() {
    const mc  = document.getElementById('party-member-count');
    const psc = document.getElementById('ps-count');
    if (mc)  mc.textContent  = members.length;
    if (psc) psc.textContent = `${members.length}/30`;
  }

  function isInRoom()    { return !!roomCode; }
  function getCode()     { return roomCode; }
  function getMembers()  { return members; }
  function getIsHost()   { return isHost; }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Called when a non-host receives a pick_anime event
  function updateWatchFromParty(anime, episode) {
    // If on watch page, reload the iframe
    if (currentPage === 'watch') {
      loadEpisode(anime.mal_id, episode);
    }
    showToast(`Now watching: ${anime.title} — Ep ${episode}`);
  }

  return {
    connect, leave, send, sendChat, syncState, pickAnime, kick,
    isInRoom, getCode, getMembers, getIsHost, genCode,
    MAX_MEMBERS
  };
})();

// ── PARTY PAGE UI ──

function createPartyRoom() {
  if (!Auth.isLoggedIn()) {
    showToast('Please sign in to create a party!');
    openModal('login'); return;
  }
  if (Party.isInRoom()) { showToast('You are already in a room!'); return; }

  const code = Party.genCode();
  const user = Auth.getUser();
  Party.connect(code, user.username || user.email, true);

  document.getElementById('party-actions').style.display  = 'none';
  document.getElementById('party-room-active').style.display = '';
  document.getElementById('pra-code-display').textContent = code;

  SoundEngine.success();
  showToast('Room created! Share the code ✦', 'gold');
}

function joinPartyRoom() {
  if (!Auth.isLoggedIn()) {
    showToast('Please sign in to join a party!');
    openModal('login'); return;
  }
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (code.length < 4) { showToast('Please enter a valid room code.', 'error'); return; }

  const user = Auth.getUser();
  Party.connect(code, user.username || user.email, false);

  document.getElementById('party-actions').style.display  = 'none';
  document.getElementById('party-room-active').style.display = '';
  document.getElementById('pra-code-display').textContent = code;

  SoundEngine.success();
  showToast(`Joined room ${code} ✦`, 'gold');
}

function leavePartyRoom() {
  Party.leave();
  document.getElementById('party-actions').style.display  = '';
  document.getElementById('party-room-active').style.display = 'none';
  document.getElementById('pra-chat-log').innerHTML = '';
  document.getElementById('pra-members-list').innerHTML = '';
  showToast('Left the party room.');
}

function copyRoomCode() {
  const code = Party.getCode();
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    SoundEngine.success();
    showToast('Room code copied! ◆', 'gold');
  });
}

function sendRoomChat() {
  const input = document.getElementById('pra-chat-input');
  const text  = input.value.trim();
  if (!text) return;
  Party.sendChat(text);
  // Show own message immediately
  const el = document.getElementById('pra-chat-log');
  if (el) {
    const div = document.createElement('div');
    div.className = 'chat-msg own';
    div.innerHTML = `<span class="chat-user" style="color:var(--gold-light)">You</span><span class="chat-text">${text}</span>`;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  }
  input.value = '';
}

function roomChatKey(e) {
  if (e.key === 'Enter') sendRoomChat();
}

function sendPartyChat() {
  const input = document.getElementById('ps-chat-input');
  const text  = input.value.trim();
  if (!text) return;
  Party.sendChat(text);
  input.value = '';
}

function partyChatKey(e) {
  if (e.key === 'Enter') sendPartyChat();
}

let partySearchTimer = null;
function searchPartyAnime() {
  clearTimeout(partySearchTimer);
  partySearchTimer = setTimeout(async () => {
    const q = document.getElementById('party-anime-search').value.trim();
    if (!q) return;
    const { results } = await API.search(q);
    const container = document.getElementById('party-anime-results');
    if (!container) return;
    container.innerHTML = '';
    results.slice(0, 8).forEach(anime => {
      const card = buildAnimeCard(anime, () => {
        Party.pickAnime(anime, 1);
        showToast(`Party: Now watching ${anime.title} ✦`, 'gold');
      });
      container.appendChild(card);
    });
  }, 400);
}
