// =============================================
// MARSELO ANIME — SOUND ENGINE
// Web Audio API — no external files needed
// =============================================

const SoundEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let ambientOsc = null;
  let ambientGain = null;
  let ambientRunning = false;
  let muted = false;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
    } catch (e) { console.warn('Web Audio not available'); }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, type, duration, startVol, endVol, delay = 0) {
    if (!ctx || muted) return;
    resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    gain.gain.setValueAtTime(startVol, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(Math.max(endVol, 0.001), ctx.currentTime + delay + duration);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.05);
  }

  function hover() {
    init();
    playTone(880, 'sine', 0.1, 0.05, 0.001);
  }

  function click() {
    init();
    playTone(660, 'sine', 0.08, 0.12, 0.001);
    playTone(990, 'sine', 0.12, 0.08, 0.001, 0.04);
  }

  function success() {
    init();
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      playTone(f, 'sine', 0.25, 0.12, 0.001, i * 0.08);
    });
  }

  function error() {
    init();
    playTone(220, 'sawtooth', 0.2, 0.1, 0.001);
    playTone(180, 'sawtooth', 0.2, 0.08, 0.001, 0.1);
  }

  function transition() {
    init();
    playTone(440, 'sine', 0.3, 0.08, 0.001);
    playTone(550, 'sine', 0.3, 0.06, 0.001, 0.1);
  }

  function notification() {
    init();
    playTone(800, 'sine', 0.15, 0.1, 0.001);
    playTone(1000, 'sine', 0.15, 0.08, 0.001, 0.08);
  }

  function startAmbient() {
    if (!ctx || ambientRunning || muted) return;
    resume();
    ambientRunning = true;

    // Low drone
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 300;
    drone.type = 'sine';
    drone.frequency.value = 55;
    droneGain.gain.value = 0.04;
    drone.connect(droneFilter);
    droneFilter.connect(masterGain);
    drone.start();

    // Shimmer
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.value = 880;
    shimmerGain.gain.value = 0;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(masterGain);
    shimmer.start();

    // Pulse shimmer gain
    let t = 0;
    const pulse = setInterval(() => {
      if (!ambientRunning) { clearInterval(pulse); return; }
      t += 0.05;
      shimmerGain.gain.value = 0.008 * (0.5 + 0.5 * Math.sin(t));
      drone.frequency.value = 55 + 2 * Math.sin(t * 0.3);
    }, 50);

    ambientOsc = { drone, shimmer, pulse };
  }

  function stopAmbient() {
    if (!ambientRunning || !ambientOsc) return;
    ambientRunning = false;
    clearInterval(ambientOsc.pulse);
    try {
      ambientOsc.drone.stop();
      ambientOsc.shimmer.stop();
    } catch (e) {}
    ambientOsc = null;
  }

  function toggleMute() {
    muted = !muted;
    if (muted) stopAmbient();
    else startAmbient();
    return muted;
  }

  return { init, hover, click, success, error, transition, notification, startAmbient, stopAmbient, toggleMute, get muted() { return muted; } };
})();

// Attach hover/click sounds globally
document.addEventListener('mouseover', (e) => {
  if (e.target.matches('button, a, .anime-card, .filter-btn, .nav-link')) {
    SoundEngine.hover();
  }
});
document.addEventListener('click', (e) => {
  if (e.target.matches('button, a')) {
    SoundEngine.click();
  }
});

// Update cursor
document.addEventListener('mousemove', (e) => {
  const cursor = document.getElementById('cursor');
  const trail = document.getElementById('cursor-trail');
  if (cursor) { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; }
  setTimeout(() => {
    if (trail) { trail.style.left = e.clientX + 'px'; trail.style.top = e.clientY + 'px'; }
  }, 60);
});

function toggleAmbient() {
  SoundEngine.init();
  const muted = SoundEngine.toggleMute();
  const btn = document.getElementById('sound-toggle');
  if (btn) btn.classList.toggle('muted', muted);
  showToast(muted ? '♪ Music off' : '♪ Music on');
}
