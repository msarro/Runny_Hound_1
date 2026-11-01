/*
 * Runny Hound — game loop, physics, input and HUD.
 */
(function (RH) {
  'use strict';

  const { W, H, GROUND_Y, COLORS: C, LAYER_W: LW } = RH;
  const TAU = Math.PI * 2;

  // Dev flags: ?hitboxes  ?god  ?score=800  ?autostart  ?sim=5 (fast-forward N seconds)
  const params = new URLSearchParams(location.search);
  const DEV = {
    sim: Math.max(0, +params.get('sim') || 0),
    boxes: params.has('hitboxes'),
    god: params.has('god'),
    autostart: params.has('autostart'),
    score: Math.max(0, +params.get('score') || 0),
  };

  const PHYS = { gravity: 2700, jumpV: 900, cutV: 470, fastFall: 3.2, coyote: 0.07, buffer: 0.13 };
  const SPEED = { start: 380, max: 960, accel: 0.0085 };
  const SCORE_PER_PX = 1 / 40;
  const DAY_NIGHT_CYCLE = 1200; // points per full night→day→night cycle

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 0, scenery = null;

  function setupCanvas() {
    const next = Math.min(2, Math.max(1, Math.round((window.devicePixelRatio || 1) * 2) / 2));
    if (next === dpr) return;
    dpr = next;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    scenery = RH.buildScenery(dpr);
  }

  let hi = 0;
  try { hi = +localStorage.getItem('rhHiScore') || 0; } catch (e) { /* private mode */ }

  const dog = {};
  const game = {
    state: 'title',
    distance: 0,
    speed: SPEED.start,
    score: 0,
    obstacles: [],
    particles: [],
    snow: [],
    gap: 0,
    time: 0,
    night: 1,
    shake: 0,
    overT: 0,
    flashT: 0,
    cause: null,
    newHi: false,
    nextMilestone: 100,
  };

  function resetDog() {
    Object.assign(dog, {
      x: 70, y: GROUND_Y, vy: 0, onGround: true, duck: false, crouch: 0,
      phase: 0, held: false, coyote: 0, buffer: 0, dustT: 0,
    });
  }
  resetDog();

  function startGame() {
    resetDog();
    game.state = 'playing';
    game.distance = DEV.score / SCORE_PER_PX;
    game.score = DEV.score;
    game.speed = SPEED.start;
    game.obstacles = [];
    game.particles = [];
    game.gap = 0;
    game.overT = 0;
    game.cause = null;
    game.newHi = false;
    game.nextMilestone = Math.floor(DEV.score / 100) * 100 + 100;
    RH.Audio.start();
    RH.Audio.startMusic();
  }

  function gameOver(obstacle) {
    game.state = 'over';
    game.overT = 0;
    game.shake = 10;
    game.cause = RH.Obstacles[obstacle.kind];
    if (game.score > hi) {
      hi = game.score;
      game.newHi = true;
      try { localStorage.setItem('rhHiScore', String(hi)); } catch (e) { /* ignore */ }
    }
    RH.Audio.stopMusic();
    RH.Audio.crash();
    const cx = dog.x + 60, cy = dog.y - 40;
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, v = 80 + Math.random() * 260;
      game.particles.push({
        kind: i % 3 ? 'spark' : 'star', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120,
        life: 0.9 + Math.random() * 0.5, max: 1.4, size: 2 + Math.random() * 3, rot: Math.random() * TAU,
        g: 500,
      });
    }
  }

  function togglePause() {
    if (game.state === 'playing') {
      game.state = 'paused';
      RH.Audio.stopMusic();
    } else if (game.state === 'paused') {
      game.state = 'playing';
      RH.Audio.startMusic();
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function pressJump() {
    RH.Audio.unlock();
    if (game.state === 'title') return startGame();
    if (game.state === 'over') { if (game.overT > 0.5) startGame(); return; }
    if (game.state === 'paused') return togglePause();
    dog.held = true;
    dog.buffer = PHYS.buffer;
  }
  function releaseJump() { dog.held = false; }
  function setDuck(on) {
    if (on && !dog.duck && game.state === 'playing') RH.Audio.duck();
    dog.duck = on;
  }

  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  const DUCK_KEYS = ['ArrowDown', 'KeyS'];
  window.addEventListener('keydown', (e) => {
    if (JUMP_KEYS.includes(e.code)) {
      e.preventDefault();
      if (!e.repeat) pressJump();
    } else if (DUCK_KEYS.includes(e.code)) {
      e.preventDefault();
      setDuck(true);
    } else if (e.code === 'KeyM') {
      RH.Audio.unlock();
      RH.Audio.toggleMute();
    } else if (e.code === 'KeyN') {
      RH.Audio.unlock();
      RH.Audio.toggleMusic();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (JUMP_KEYS.includes(e.code)) releaseJump();
    else if (DUCK_KEYS.includes(e.code)) setDuck(false);
  });

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    pressJump();
  });
  ['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, releaseJump));

  const duckBtn = document.getElementById('duck-btn');
  if (duckBtn) {
    duckBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); RH.Audio.unlock(); setDuck(true); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => duckBtn.addEventListener(t, () => setDuck(false)));
  }
  const jumpBtn = document.getElementById('jump-btn');
  if (jumpBtn) {
    jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pressJump(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => jumpBtn.addEventListener(t, releaseJump));
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') togglePause();
  });
  window.addEventListener('blur', () => {
    if (game.state === 'playing') togglePause();
  });

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------
  function puff(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      game.particles.push({
        kind: 'dust', x: x + (Math.random() - 0.5) * (spread || 10), y: y - Math.random() * 3,
        vx: -game.speed * 0.9 - Math.random() * 60, vy: -20 - Math.random() * 60,
        life: 0.35 + Math.random() * 0.25, max: 0.6, size: 2 + Math.random() * 3, g: 60,
      });
    }
  }

  function updateDog(dt) {
    dog.buffer -= dt;
    dog.coyote = dog.onGround ? PHYS.coyote : dog.coyote - dt;
    if (dog.buffer > 0 && dog.coyote > 0) {
      dog.vy = -PHYS.jumpV;
      dog.onGround = false;
      dog.coyote = 0;
      dog.buffer = 0;
      RH.Audio.jump();
      puff(dog.x + 20, GROUND_Y, 6, 30);
    }
    if (!dog.onGround) {
      if (!dog.held && dog.vy < -PHYS.cutV) dog.vy = -PHYS.cutV;
      dog.vy += PHYS.gravity * (dog.duck ? PHYS.fastFall : 1) * dt;
      dog.y += dog.vy * dt;
      if (dog.y >= GROUND_Y) {
        dog.y = GROUND_Y;
        dog.vy = 0;
        dog.onGround = true;
        RH.Audio.land();
        puff(dog.x + 30, GROUND_Y, 8, 50);
      }
    }
    const crouchTarget = dog.duck && dog.onGround ? 1 : 0;
    dog.crouch += (crouchTarget - dog.crouch) * Math.min(1, dt * 25);
    dog.phase += (dt * game.speed) / 24;
    dog.dustT -= dt;
    if (dog.onGround && dog.dustT <= 0) {
      dog.dustT = 0.09;
      puff(dog.x + 14, GROUND_Y, 1, 8);
    }
  }

  function pickObstacle() {
    const s = game.score;
    const table = [
      ['candle', 3],
      ['chick', 3],
      ['books', 2],
      ['beam', s > 80 ? 2.5 : 0],
      ['lantern', s > 200 ? 2 : 0],
      ['flyer', s > 300 ? 2 : 0],
    ];
    let total = 0;
    for (const [, w] of table) total += w;
    let r = Math.random() * total;
    for (const [k, w] of table) {
      if ((r -= w) < 0) return k;
    }
    return 'candle';
  }

  function spawnObstacle() {
    const kind = pickObstacle();
    const level = game.score < 150 ? 0 : game.score < 450 ? 1 : 2;
    const o = RH.Obstacles[kind].make(level, Math.random);
    o.kind = kind;
    o.x = W + 20;
    o.t = Math.random() * 10;
    o.yOff = 0;
    game.obstacles.push(o);
    // gaps scale with speed so every pattern stays jumpable
    const minGap = game.speed * 0.62 + 70;
    game.gap = minGap + Math.random() * game.speed * (game.score < 100 ? 1.1 : 0.85) + (o.flying ? 80 : 0);
  }

  function updateObstacles(dt) {
    for (const o of game.obstacles) {
      o.x -= (game.speed + (o.vx || 0)) * dt;
      o.t += dt;
      if (o.flying) o.yOff = Math.sin(o.t * 3) * 4;
    }
    game.obstacles = game.obstacles.filter((o) => o.x + o.w > -60);
    const last = game.obstacles[game.obstacles.length - 1];
    const free = last ? W - (last.x + last.w) : Infinity;
    if (free >= game.gap) spawnObstacle();
  }

  // Hitboxes for the hound, a little smaller than the art to feel fair.
  function dogBoxes() {
    const x = dog.x, y = dog.y;
    if (dog.crouch > 0.5) {
      return [
        { x: x + 5, y: y - 30, w: 56, h: 20 },
        { x: x + 66, y: y - 32, w: 22, h: 12 },
        { x: x + 10, y: y - 12, w: 48, h: 12 },
      ];
    }
    return [
      { x: x + 6, y: y - 40, w: 50, h: 22 },
      { x: x + 50, y: y - 55, w: 22, h: 14 },
      { x: x + 12, y: y - 20, w: 40, h: 19 },
    ];
  }

  function obstacleBoxes(o) {
    return o.boxes.map((b) => ({ x: o.x + b.x, y: GROUND_Y + b.y + o.yOff, w: b.w, h: b.h }));
  }

  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function checkCollisions() {
    if (DEV.god) return;
    const db = dogBoxes();
    for (const o of game.obstacles) {
      if (o.x > dog.x + 90 || o.x + o.w < dog.x) continue;
      for (const b of obstacleBoxes(o)) {
        for (const d of db) {
          if (overlap(b, d)) return gameOver(o);
        }
      }
    }
  }

  function updateParticles(dt) {
    for (const p of game.particles) {
      p.life -= dt;
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot != null) p.rot += dt * 6;
    }
    game.particles = game.particles.filter((p) => p.life > 0);
  }

  function updateSnow(dt) {
    const rate = game.night * 30;
    if (Math.random() < rate * dt) {
      game.snow.push({ x: Math.random() * (W + 200), y: -5, r: 0.8 + Math.random() * 1.6, vy: 25 + Math.random() * 30, ph: Math.random() * TAU });
    }
    const drift = game.state === 'playing' ? game.speed * 0.25 : 15;
    for (const f of game.snow) {
      f.y += f.vy * dt;
      f.x -= (drift + Math.sin(game.time + f.ph) * 12) * dt;
    }
    game.snow = game.snow.filter((f) => f.y < GROUND_Y + 4 && f.x > -10);
  }

  function update(dt) {
    game.time += dt;
    if (game.state === 'playing') {
      const pos = (game.score % DAY_NIGHT_CYCLE) / DAY_NIGHT_CYCLE;
      const target = pos < 0.42 || pos > 0.92 ? 1 : 0;
      game.night += (target - game.night) * Math.min(1, dt * 0.6);
    }
    game.shake = Math.max(0, game.shake - dt * 30);
    game.flashT = Math.max(0, game.flashT - dt);
    updateSnow(dt);
    updateParticles(dt);

    if (game.state === 'over') { game.overT += dt; return; }
    if (game.state === 'title') { dog.phase += dt; return; }
    if (game.state !== 'playing') return;

    game.speed = Math.min(SPEED.max, SPEED.start + game.distance * SPEED.accel);
    game.distance += game.speed * dt;
    game.score = Math.floor(game.distance * SCORE_PER_PX);
    if (game.score >= game.nextMilestone) {
      game.nextMilestone += 100;
      game.flashT = 1.2;
      RH.Audio.point();
    }
    updateDog(dt);
    updateObstacles(dt);
    checkCollisions();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function lerpColor(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = (pa >> 16) + (((pb >> 16) - (pa >> 16)) * t);
    const g = ((pa >> 8) & 255) + ((((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
    const bl = (pa & 255) + (((pb & 255) - (pa & 255)) * t);
    return `rgb(${r | 0},${g | 0},${bl | 0})`;
  }

  const STARS = (() => {
    const r = RH.rng(2024);
    return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * 170, s: 0.5 + r() * 1.3, ph: r() * TAU }));
  })();

  function drawSky() {
    const n = game.night;
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, lerpColor('#4F8DCB', '#03112E', n));
    g.addColorStop(0.7, lerpColor('#A9CDEB', '#14305F', n));
    g.addColorStop(1, lerpColor('#DCEBF6', '#2A4677', n));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);

    if (n > 0.02) {
      for (const s of STARS) {
        const tw = 0.55 + 0.45 * Math.sin(game.time * 2.2 + s.ph);
        ctx.globalAlpha = n * tw;
        ctx.fillStyle = '#FFF8E0';
        ctx.fillRect(s.x, s.y, s.s, s.s);
      }
      // crescent moon
      ctx.globalAlpha = n;
      RH.glow(ctx, 860, 52, 50, 'rgba(255,245,210,0.35)');
      ctx.fillStyle = '#FFF4D2';
      ctx.beginPath(); ctx.arc(860, 52, 17, 0, TAU); ctx.fill();
      ctx.fillStyle = lerpColor('#4F8DCB', '#061633', n);
      ctx.beginPath(); ctx.arc(868, 46, 15, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (n < 0.98) {
      ctx.globalAlpha = 1 - n;
      RH.glow(ctx, 150, 60, 70, 'rgba(255,240,180,0.6)');
      ctx.fillStyle = '#FFF2B8';
      ctx.beginPath(); ctx.arc(150, 60, 20, 0, TAU); ctx.fill();
      drawLoop(scenery.clouds.day, scenery.clouds.w, scenery.clouds.h, 0.03, 0);
      ctx.globalAlpha = 1;
    }
  }

  function drawLoop(img, w, h, factor, y) {
    const off = ((game.distance * factor) % w + w) % w;
    for (let x = -off; x < W; x += w) ctx.drawImage(img, x, y, w, h);
  }

  function drawLayer(layer, factor, y) {
    const n = game.night;
    if (n < 0.999) drawLoop(layer.day, layer.w, layer.h, factor, y || 0);
    if (n > 0.001) {
      ctx.globalAlpha = n;
      drawLoop(layer.night, layer.w, layer.h, factor, y || 0);
      ctx.globalAlpha = 1;
    }
  }

  function shadow(x, w, height) {
    const a = Math.max(0, 0.28 - height / 500);
    const s = Math.max(0.4, 1 - height / 300);
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 2, (w / 2) * s, 3 * s, 0, 0, TAU);
    ctx.fill();
  }

  function drawObstacles() {
    for (const o of game.obstacles) {
      if (!o.flying) shadow(o.x + o.w / 2, o.w + 6, 0);
      ctx.save();
      ctx.translate(0, o.yOff);
      o.draw(ctx, o.x, GROUND_Y, o.t);
      ctx.restore();
    }
  }

  function drawDog() {
    shadow(dog.x + 36, 64, GROUND_Y - dog.y);
    let mode = 'run';
    if (game.state === 'title') mode = 'idle';
    else if (game.state === 'over') mode = 'dead';
    else if (!dog.onGround) mode = 'jump';
    RH.drawGreyhound(ctx, dog.x, dog.y, { mode, phase: dog.phase, crouch: dog.crouch, vy: dog.vy });
  }

  function drawParticles() {
    for (const p of game.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max * 1.6));
      ctx.globalAlpha = a;
      if (p.kind === 'dust') {
        ctx.fillStyle = game.night > 0.5 ? '#8E93A6' : '#C9B9A6';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
      } else if (p.kind === 'star') {
        RH.drawMoravianStar(ctx, p.x, p.y, p.size * 2.2, p.rot, { lit: true });
      } else {
        ctx.fillStyle = C.goldLight;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow() {
    ctx.fillStyle = '#FFFFFF';
    for (const f of game.snow) {
      ctx.globalAlpha = 0.8 * Math.min(1, game.night * 1.5);
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawDebugBoxes() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#00FF88';
    for (const b of dogBoxes()) ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#FF3366';
    for (const o of game.obstacles) for (const b of obstacleBoxes(o)) ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  const pad = (n) => String(n).padStart(5, '0');

  function drawHUD() {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    const blink = game.flashT > 0 && Math.floor(game.flashT * 8) % 2 === 0;
    const scoreText = pad(game.flashT > 0 ? Math.floor(game.score / 100) * 100 : game.score);
    const hiX = W - 16 - ctx.measureText(scoreText).width - 22;
    ctx.fillStyle = 'rgba(0,20,50,0.55)';
    ctx.fillText(`HI ${pad(hi)}`, hiX + 1, 15);
    ctx.fillText(scoreText, W - 15, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`HI ${pad(hi)}`, hiX, 14);
    if (!blink) {
      ctx.fillStyle = game.flashT > 0 ? C.goldLight : C.white;
      ctx.fillText(scoreText, W - 16, 14);
    }

    ctx.textAlign = 'left';
    ctx.font = '11px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const snd = RH.Audio.muted ? 'SOUND OFF' : RH.Audio.musicOn ? 'SOUND ON · MUSIC ON' : 'SOUND ON · MUSIC OFF';
    ctx.fillText(`${snd}   [M] mute  [N] music  [P] pause`, 14, 14);
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y);
        line = w;
        y += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
    return y + lineH;
  }

  function panel(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    RH.roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(0,33,77,0.86)';
    ctx.fill();
    ctx.restore();
    RH.roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 9);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawTitle() {
    const x = 270, y = 34, w = 610, h = 196;
    panel(x, y, w, h);
    const cx = x + w / 2;
    RH.drawMoravianStar(ctx, x + 52, y + 56, 24, game.time * 0.6, { lit: true, glow: 2 });
    RH.drawMoravianStar(ctx, x + w - 52, y + 56, 24, -game.time * 0.6, { lit: true, glow: 2 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 46px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.white;
    ctx.fillText('RUNNY HOUND', cx, y + 72);
    ctx.font = 'italic 15px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.greyLight;
    ctx.fillText('A Greyhound’s dash through Bethlehem, PA — the Christmas City', cx, y + 100);
    if (Math.floor(game.time * 2) % 2 === 0) {
      ctx.font = 'bold 18px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      ctx.fillStyle = C.goldLight;
      ctx.fillText('PRESS SPACE OR TAP TO RUN', cx, y + 140);
    }
    ctx.font = '12px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('SPACE / ↑ jump (hold for higher)   ↓ duck   M mute   N music   P pause', cx, y + 172);
  }

  function drawGameOver() {
    const x = 250, y = 30, w = 640, h = 206;
    panel(x, y, w, h);
    const cx = x + w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 34px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.white;
    ctx.fillText('RUFF LANDING!', cx, y + 50);
    ctx.font = '15px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.goldLight;
    ctx.fillText(`Your Greyhound tripped over ${game.cause.name}.`, cx, y + 78);
    ctx.font = 'italic 13.5px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.greyLight;
    const after = wrapText(game.cause.fact, cx, y + 104, w - 90, 19);
    ctx.font = 'bold 17px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = C.white;
    ctx.fillText(`SCORE ${pad(game.score)}    BEST ${pad(hi)}${game.newHi ? '  ★ NEW!' : ''}`, cx, Math.max(after + 8, y + 160));
    if (game.overT > 0.5 && Math.floor(game.time * 2) % 2 === 0) {
      ctx.font = 'bold 14px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
      ctx.fillStyle = C.goldLight;
      ctx.fillText('PRESS SPACE OR TAP TO RUN AGAIN', cx, y + h - 18);
    }
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(0,20,50,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px Georgia, "Times New Roman", serif';
    ctx.fillStyle = C.white;
    ctx.fillText('PAUSED', W / 2, H / 2 - 14);
    ctx.font = '14px ui-monospace, "SF Mono", Menlo, Consolas, monospace';
    ctx.fillStyle = C.goldLight;
    ctx.fillText('Press P, SPACE or tap to resume', W / 2, H / 2 + 18);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    drawSky();
    drawLayer(scenery.far, 0.05);
    drawLayer(scenery.mid, 0.2);
    drawLayer(scenery.near, 0.5);
    drawLayer(scenery.ground, 1, GROUND_Y);
    drawObstacles();
    drawDog();
    drawParticles();
    drawSnow();
    if (DEV.boxes) drawDebugBoxes();
    ctx.restore();

    drawHUD();
    if (game.state === 'title') drawTitle();
    else if (game.state === 'over') drawGameOver();
    else if (game.state === 'paused') drawPaused();
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function setFavicon() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = C.navy;
    RH.roundRect(g, 0, 0, 64, 64, 14);
    g.fill();
    RH.drawMoravianStar(g, 32, 32, 27, 0, { lit: true });
    const link = document.querySelector('link[rel="icon"]') || document.head.appendChild(document.createElement('link'));
    link.rel = 'icon';
    link.href = c.toDataURL('image/png');
  }

  function drawLegend() {
    document.querySelectorAll('canvas[data-obstacle]').forEach((c) => {
      const kind = c.dataset.obstacle;
      const def = RH.Obstacles[kind];
      const r = Math.min(2, window.devicePixelRatio || 1);
      const cw = 96, ch = 80;
      c.width = cw * r;
      c.height = ch * r;
      const g = c.getContext('2d');
      g.scale(r, r);
      const gy = 70;
      g.fillStyle = 'rgba(0,43,92,0.12)';
      g.fillRect(0, gy, cw, ch - gy);
      if (kind === 'flyer') {
        RH.drawMoravianStar(g, cw / 2, 36, 20, 0.2, { lit: true, glow: 1.8 });
      } else {
        const o = def.make(1, RH.rng(kind.length * 7 + 3));
        o.draw(g, (cw - o.w) / 2, gy, 0.4);
      }
      const label = c.parentElement.querySelector('[data-fact]');
      if (label) label.textContent = def.fact;
    });
    const brand = document.getElementById('brand-star');
    if (brand) {
      const r = Math.min(2, window.devicePixelRatio || 1);
      brand.width = brand.height = 56 * r;
      const g = brand.getContext('2d');
      g.scale(r, r);
      RH.drawMoravianStar(g, 28, 28, 25, 0, { lit: true, glow: 1.1 });
    }
  }

  setupCanvas();
  setFavicon();
  drawLegend();
  window.addEventListener('resize', setupCanvas);
  if (DEV.autostart) startGame();
  for (let t = 0; t < DEV.sim; t += 1 / 60) update(1 / 60);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  RH.game = game; // handy for tinkering in the console
})(window.RH);
