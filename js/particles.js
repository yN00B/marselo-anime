// =============================================
// MARSELO ANIME — PARTICLE ENGINE
// =============================================

(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, particles = [], animFrame;
  const PARTICLE_COUNT = 60;
  const GOLD = [201, 168, 76];
  const PURPLE = [109, 40, 217];

  class Particle {
    constructor() { this.reset(true); }
    reset(init = false) {
      this.x = Math.random() * W;
      this.y = init ? Math.random() * H : H + 10;
      this.size = Math.random() * 2 + 0.5;
      this.speedY = -(Math.random() * 0.4 + 0.1);
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.5 + 0.1;
      this.life = 1;
      this.maxLife = Math.random() * 200 + 100;
      this.age = 0;
      this.color = Math.random() > 0.6 ? PURPLE : GOLD;
      this.twinkle = Math.random() * Math.PI * 2;
      this.twinkleSpeed = (Math.random() * 0.02 + 0.005);
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      this.age++;
      this.twinkle += this.twinkleSpeed;
      const fadeIn  = Math.min(1, this.age / 30);
      const fadeOut = Math.min(1, (this.maxLife - this.age) / 50);
      this.life = Math.min(fadeIn, fadeOut);
      if (this.age >= this.maxLife) this.reset();
    }
    draw() {
      const twinkleMod = 0.6 + 0.4 * Math.sin(this.twinkle);
      const alpha = this.opacity * this.life * twinkleMod;
      const [r, g, b] = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
      // Glow
      const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    particles = Array.from({ length: PARTICLE_COUNT }, () => new Particle());
    animate();
  }

  function animate() {
    animFrame = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
  }

  window.addEventListener('resize', resize);
  window.addEventListener('load', init);
  init();
})();
