/*
 * Runny Hound — procedural art.
 * Every sprite and background in the game is drawn here with Canvas 2D paths.
 * There are no image files.
 */
(function (RH) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Shared constants & helpers
  // ---------------------------------------------------------------------------
  RH.W = 960;
  RH.H = 320;
  RH.GROUND_Y = 268;
  const LW = (RH.LAYER_W = 1920); // width of each looping background layer

  // Palette inspired by Moravian University (Greyhounds: blue & grey) plus
  // the warm gold of a lit Moravian Star. Values are approximations.
  const C = (RH.COLORS = {
    navy: '#002B5C',
    blue: '#1D4F91',
    blueLight: '#5B8BC9',
    grey: '#A9B0B7',
    greyDark: '#66707A',
    greyDeep: '#3B434C',
    greyLight: '#D6DADF',
    gold: '#F4B223',
    goldLight: '#FFE29A',
    cream: '#F4EBDC',
    white: '#FFFFFF',
    red: '#C8102E',
  });

  const TAU = Math.PI * 2;
  const clamp = (RH.clamp = (v, a, b) => (v < a ? a : v > b ? b : v));

  RH.rng = function (seed) {
    // mulberry32 — small deterministic PRNG so scenery is identical every load
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  function rect(g, x, y, w, h, color) {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  }

  function poly(g, pts, color) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  function glow(g, x, y, r, color, alpha) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.globalAlpha = alpha == null ? 1 : alpha;
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.restore();
  }
  RH.glow = glow;

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  RH.roundRect = roundRect;

  // ---------------------------------------------------------------------------
  // The Moravian Star — a many-pointed star, each point a little pyramid.
  // ---------------------------------------------------------------------------
  function spike(g, ang, inner, len, half, light, dark) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const px = -sa * half, py = ca * half;
    const bx = ca * inner, by = sa * inner;
    const tx = ca * len, ty = sa * len;
    const plusLit = px + py < 0; // light comes from the upper left
    g.lineWidth = 0.6;
    g.lineJoin = 'round';
    g.fillStyle = g.strokeStyle = plusLit ? light : dark;
    g.beginPath(); g.moveTo(bx + px, by + py); g.lineTo(tx, ty); g.lineTo(bx, by); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = g.strokeStyle = plusLit ? dark : light;
    g.beginPath(); g.moveTo(bx - px, by - py); g.lineTo(tx, ty); g.lineTo(bx, by); g.closePath();
    g.fill(); g.stroke();
  }

  const STAR_LIT = ['#F2BF4E', '#B47A18', '#FFF7D6', '#EDAE36', '#FFFDF2'];
  const STAR_WHITE = ['#D3D8DE', '#8C949D', '#FFFFFF', '#B5BCC4', '#FFFFFF'];

  RH.drawMoravianStar = function (g, x, y, r, rot, opt) {
    opt = opt || {};
    const pal = opt.lit ? STAR_LIT : STAR_WHITE;
    g.save();
    g.translate(x, y);
    if (opt.glow) glow(g, 0, 0, r * opt.glow, 'rgba(255,214,120,0.55)');
    g.rotate(rot || 0);
    g.fillStyle = pal[1];
    g.beginPath(); g.arc(0, 0, r * 0.26, 0, TAU); g.fill();
    for (let k = 0; k < 8; k++) spike(g, k * TAU / 8 + TAU / 16, r * 0.1, r * 0.74, r * 0.17, pal[0], pal[1]);
    for (let k = 0; k < 8; k++) spike(g, k * TAU / 8, r * 0.1, r, r * 0.19, pal[2], pal[3]);
    for (let k = 0; k < 4; k++) spike(g, k * TAU / 4 + TAU / 8, r * 0.04, r * 0.36, r * 0.17, pal[4], pal[3]);
    g.restore();
  };

  // ---------------------------------------------------------------------------
  // The Greyhound (Moravian Greyhounds mascot) — grey hound in a blue racing coat.
  // Origin is the point on the ground under the dog's hindquarters; it faces +x.
  // ---------------------------------------------------------------------------
  function ik(hx, hy, tx, ty, l1, l2, kneeForward) {
    let dx = tx - hx, dy = ty - hy;
    let d = Math.hypot(dx, dy);
    const maxD = l1 + l2 - 0.01;
    if (d > maxD) {
      dx *= maxD / d; dy *= maxD / d; d = maxD;
      tx = hx + dx; ty = hy + dy;
    }
    d = Math.max(d, Math.abs(l1 - l2) + 0.01);
    const base = Math.atan2(dy, dx);
    const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const k1x = hx + Math.cos(base + a) * l1, k1y = hy + Math.sin(base + a) * l1;
    const k2x = hx + Math.cos(base - a) * l1, k2y = hy + Math.sin(base - a) * l1;
    const first = kneeForward ? k1x > k2x : k1x < k2x;
    return { kx: first ? k1x : k2x, ky: first ? k1y : k2y, ex: tx, ey: ty };
  }

  function limb(g, pts, widths, color, outline) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass === 0 ? outline : color;
      for (let i = 0; i < widths.length; i++) {
        g.lineWidth = widths[i] + (pass === 0 ? 2.2 : 0);
        g.beginPath();
        g.moveTo(pts[i * 2], pts[i * 2 + 1]);
        g.lineTo(pts[i * 2 + 2], pts[i * 2 + 3]);
        g.stroke();
      }
    }
  }

  function frontLeg(g, sx, sy, px, py, color, outline) {
    const wx = px - 1, wy = py - 5; // wrist sits just above the paw
    const j = ik(sx, sy, wx, wy, 14, 12.5, false);
    limb(g, [sx, sy, j.kx, j.ky, j.ex, j.ey, j.ex + 2.5, j.ey + 4.5], [6.5, 4, 3.4], color, outline);
  }

  function backLeg(g, hx, hy, px, py, color, outline) {
    const kx = px - 4, ky = py - 8; // hock sits behind and above the paw
    const j = ik(hx, hy, kx, ky, 15, 13, true);
    limb(g, [hx, hy, j.kx, j.ky, j.ex, j.ey, j.ex + 4, j.ey + 7.5], [9.5, 4.6, 3.4], color, outline);
  }

  const DOG = {
    body: '#AEB5BC',
    bodyDark: '#8D959D',
    far: '#858E97',
    outline: '#3D454E',
    ear: '#6F7882',
  };

  RH.drawGreyhound = function (g, x, y, s) {
    const p = s.phase || 0;
    const c = s.crouch || 0;
    const mode = s.mode;
    const running = mode === 'run' || mode === 'dead';
    const flex = running ? Math.sin(p) : mode === 'jump' ? 0.9 : 0;
    const bob = running ? 1 - Math.abs(Math.cos(p)) * 2.5 : 0;
    const sx = 46 + flex * 2.5 + c * 5; // shoulder
    const hx = 16 - flex * 2.5 - c * 2; // hip
    const by = -31 + bob + c * 10;      // height of the spine at the shoulder

    g.save();
    g.translate(x, y);
    if (mode === 'jump') {
      const tilt = clamp((s.vy || 0) * 0.00028, -0.22, 0.26);
      g.translate(32, -30); g.rotate(tilt); g.translate(-32, 30);
    }

    // ---- paw targets for each leg ----
    let fN, fF, bN, bF;
    if (running) {
      const S = 11 + c * 3, L = 7 - c * 2;
      const fpos = (o) => [sx + 2 + S * Math.sin(p + o), -L * Math.max(0, Math.cos(p + o))];
      const bpos = (o) => [hx + 3 + S * Math.sin(p + o + Math.PI), -L * Math.max(0, Math.cos(p + o + Math.PI))];
      fN = fpos(0); fF = fpos(0.55); bN = bpos(0); bF = bpos(0.55);
    } else if (mode === 'jump') {
      fN = [sx + 15, by + 22]; fF = [sx + 11, by + 24];
      bN = [hx - 16, by + 25]; bF = [hx - 11, by + 27];
    } else {
      fN = [sx + 1, 0]; fF = [sx + 5, 0];
      bN = [hx + 1, 0]; bF = [hx + 5, 0];
    }

    // ---- far legs ----
    backLeg(g, hx + 2, by + 1, bF[0], bF[1], DOG.far, DOG.outline);
    frontLeg(g, sx - 1, by + 2, fF[0], fF[1], DOG.far, DOG.outline);

    // ---- tail ----
    const tw = running ? Math.sin(p * 0.5) * 3 : mode === 'idle' ? Math.sin(p * 2) * 4 : 0;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx - 7, by - 3);
    if (mode === 'idle') {
      g.bezierCurveTo(hx - 13, by + 4, hx - 13 + tw, by + 18, hx - 7 + tw, by + 24);
    } else {
      g.bezierCurveTo(hx - 16, by + 0, hx - 22, by + 6 + tw, hx - 31, by + 3 + tw * 1.5);
    }
    g.strokeStyle = DOG.outline; g.lineWidth = 5; g.stroke();
    g.strokeStyle = DOG.bodyDark; g.lineWidth = 2.8; g.stroke();

    // ---- head position ----
    const headBob = running ? Math.cos(p) * 1.2 : 0;
    const hdx = sx + 15 + c * 9;
    const hdy = by - 17 + c * 12 + headBob;

    // ---- neck ----
    limb(g, [sx - 2, by - 3, hdx - 3, hdy + 3], [10], DOG.body, DOG.outline);

    // ---- body ----
    const bodyPath = new Path2D();
    bodyPath.moveTo(hx - 9, by + 2);
    bodyPath.bezierCurveTo(hx - 9, by - 7, hx + 2, by - 10, hx + 12, by - 9.5);
    bodyPath.bezierCurveTo(hx + 20, by - 9, sx - 10, by - 9, sx - 2, by - 8);
    bodyPath.bezierCurveTo(sx + 6, by - 8, sx + 9, by - 2, sx + 8, by + 3);
    bodyPath.bezierCurveTo(sx + 7, by + 10, sx - 4, by + 13, sx - 10, by + 11);
    bodyPath.bezierCurveTo(sx - 16, by + 9, hx + 14, by + 1, hx + 8, by + 1);
    bodyPath.bezierCurveTo(hx + 4, by + 7, hx - 7, by + 9, hx - 9, by + 2);
    bodyPath.closePath();
    const bg = g.createLinearGradient(0, by - 10, 0, by + 13);
    bg.addColorStop(0, '#C3C9CF');
    bg.addColorStop(1, DOG.bodyDark);
    g.fillStyle = bg;
    g.fill(bodyPath);

    // ---- Moravian-blue racing coat with gold trim and a white "M" ----
    g.save();
    g.clip(bodyPath);
    g.beginPath();
    g.moveTo(hx - 1, by - 14);
    g.lineTo(sx + 1, by - 14);
    g.lineTo(sx - 3, by + 6);
    g.lineTo(hx + 4, by + 3);
    g.closePath();
    g.fillStyle = C.navy;
    g.fill();
    g.strokeStyle = C.gold;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sx - 3, by + 6); g.lineTo(hx + 4, by + 3);
    g.moveTo(sx + 1, by - 14); g.lineTo(sx - 3, by + 6);
    g.moveTo(hx - 1, by - 14); g.lineTo(hx + 4, by + 3);
    g.stroke();
    g.fillStyle = C.white;
    g.font = 'bold 11px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('M', (hx + sx) / 2 + 1, by - 2.5);
    g.restore();
    g.lineWidth = 1.4;
    g.strokeStyle = DOG.outline;
    g.stroke(bodyPath); // outline drawn last so it sits over the coat

    // ---- collar ----
    {
      const nx = hdx - 3 - (sx - 2), ny = hdy + 3 - (by - 3);
      const nl = Math.hypot(nx, ny);
      const ux = nx / nl, uy = ny / nl;
      const cx = sx - 2 + nx * 0.62, cy = by - 3 + ny * 0.62;
      g.strokeStyle = C.blue;
      g.lineWidth = 3.2;
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(cx - uy * 6, cy + ux * 6);
      g.lineTo(cx + uy * 6, cy - ux * 6);
      g.stroke();
      RH.drawMoravianStar(g, cx - uy * 6.5, cy + ux * 6.5 + 1, 3, 0, { lit: true });
    }

    // ---- head ----
    g.fillStyle = DOG.body;
    g.strokeStyle = DOG.outline;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(hdx - 6, hdy + 1);
    g.bezierCurveTo(hdx - 6, hdy - 6, hdx + 2, hdy - 7, hdx + 5, hdy - 4);
    g.bezierCurveTo(hdx + 9, hdy - 2.5, hdx + 13, hdy - 0.5, hdx + 16, hdy + 1); // long narrow muzzle
    g.bezierCurveTo(hdx + 17, hdy + 2.5, hdx + 16, hdy + 4, hdx + 14, hdy + 4);
    g.bezierCurveTo(hdx + 9, hdy + 5, hdx + 3, hdy + 7, hdx - 1, hdy + 6);
    g.bezierCurveTo(hdx - 4, hdy + 5.5, hdx - 6, hdy + 4, hdx - 6, hdy + 1);
    g.closePath();
    g.fill();
    g.stroke();
    // nose
    g.fillStyle = '#1E2329';
    g.beginPath(); g.arc(hdx + 15.6, hdy + 1.6, 1.9, 0, TAU); g.fill();
    // mouth & tongue
    if (running && mode !== 'dead') {
      g.fillStyle = '#E8798A';
      g.beginPath(); g.ellipse(hdx + 7, hdy + 6.3, 2.6, 1.5, 0.25, 0, TAU); g.fill();
    }
    g.strokeStyle = DOG.outline; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(hdx + 14, hdy + 3.8); g.lineTo(hdx + 5, hdy + 5); g.stroke();
    // folded "rose" ear, flapping in the wind
    const flap = running ? Math.sin(p * 2) * 1.5 : 0;
    g.fillStyle = DOG.ear;
    g.beginPath();
    g.moveTo(hdx - 1, hdy - 5);
    g.quadraticCurveTo(hdx - 7, hdy - 9 + flap, hdx - 11, hdy - 5 + flap);
    g.quadraticCurveTo(hdx - 6, hdy - 3, hdx - 2, hdy - 1);
    g.closePath();
    g.fill();
    g.strokeStyle = DOG.outline; g.lineWidth = 1; g.stroke();
    // eye
    if (mode === 'dead') {
      g.strokeStyle = '#1E2329'; g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(hdx + 1, hdy - 3.5); g.lineTo(hdx + 5, hdy + 0.5);
      g.moveTo(hdx + 5, hdy - 3.5); g.lineTo(hdx + 1, hdy + 0.5);
      g.stroke();
    } else {
      g.fillStyle = '#1E2329';
      g.beginPath(); g.arc(hdx + 3, hdy - 1.5, 1.6, 0, TAU); g.fill();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(hdx + 3.5, hdy - 2, 0.55, 0, TAU); g.fill();
    }

    // ---- near legs ----
    backLeg(g, hx + 1, by, bN[0], bN[1], DOG.body, DOG.outline);
    frontLeg(g, sx - 2, by + 1, fN[0], fN[1], DOG.body, DOG.outline);

    g.restore();
  };

  // ---------------------------------------------------------------------------
  // Obstacles — things from Moravian University and Bethlehem, PA.
  // Each make() returns { w, boxes, draw }. Boxes are relative to (x, groundY).
  // ---------------------------------------------------------------------------
  function drawCandle(g, x, gy, h, t) {
    const top = gy - 5 - h;
    // beeswax body
    const wax = g.createLinearGradient(x - 5, 0, x + 5, 0);
    wax.addColorStop(0, '#E2BC63');
    wax.addColorStop(0.45, '#F7DE95');
    wax.addColorStop(1, '#C99B45');
    g.fillStyle = wax;
    roundRect(g, x - 5, top, 10, h + 2, 2);
    g.fill();
    g.strokeStyle = '#8F6A27'; g.lineWidth = 1; g.stroke();
    // a drip
    g.fillStyle = '#F7DE95';
    g.beginPath(); g.ellipse(x + 2, top + 5, 1.4, 3.5, 0, 0, TAU); g.fill();
    // red paper frill at the base
    g.beginPath();
    g.moveTo(x - 9, gy);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const fx = x - 9 + (18 * i) / n;
      g.lineTo(fx, gy - (i % 2 === 0 ? 10 : 6));
    }
    g.lineTo(x + 9, gy);
    g.closePath();
    g.fillStyle = C.red; g.fill();
    g.strokeStyle = '#7E0A1D'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    for (let i = 1; i < n; i += 2) {
      const fx = x - 9 + (18 * i) / n;
      g.moveTo(fx, gy - 1); g.lineTo(fx, gy - 5);
    }
    g.stroke();
    // wick & flickering flame
    g.strokeStyle = '#2B2118'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, top - 3); g.stroke();
    const f = 1 + 0.12 * Math.sin(t * 19) + 0.06 * Math.sin(t * 31);
    glow(g, x, top - 7, 13, 'rgba(255,200,90,0.45)');
    g.save();
    g.translate(x, top - 3);
    g.scale(1, f);
    g.fillStyle = '#FFA733';
    g.beginPath(); g.moveTo(0, -11); g.quadraticCurveTo(4.5, -3, 0, 0); g.quadraticCurveTo(-4.5, -3, 0, -11); g.fill();
    g.fillStyle = '#FFF4C2';
    g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(2.2, -2, 0, 0); g.quadraticCurveTo(-2.2, -2, 0, -7); g.fill();
    g.restore();
  }

  function drawChick(g, x, gy, t, seed) {
    g.save();
    g.translate(x, gy);
    g.scale(-1, 1); // face the oncoming hound
    const wob = Math.sin(t * 6 + seed) * 0.8;
    g.beginPath();
    g.moveTo(-13, 0);
    g.bezierCurveTo(-16, -9, -15, -16, -10, -15);
    g.bezierCurveTo(-7, -15, -6, -14, -4, -15);
    g.bezierCurveTo(-6, -25 + wob, 6, -30 + wob, 9, -21 + wob);
    g.bezierCurveTo(11, -16, 8, -13, 7, -12);
    g.bezierCurveTo(14, -10, 14, -2, 12, 0);
    g.closePath();
    const yg = g.createLinearGradient(0, -28, 0, 0);
    yg.addColorStop(0, '#FFE866');
    yg.addColorStop(1, '#F7C21B');
    g.fillStyle = yg; g.fill();
    g.strokeStyle = '#B98A00'; g.lineWidth = 1.2; g.stroke();
    // sugar sparkle
    const r = RH.rng(seed * 1000 + 7);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 14; i++) {
      const sx = -12 + r() * 24, sy = -2 - r() * 18;
      g.fillRect(sx, sy, 1, 1);
    }
    // wing
    g.strokeStyle = '#D9A400'; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(-6, -9); g.quadraticCurveTo(0, -4, 4, -9); g.stroke();
    // eye + beak
    g.fillStyle = '#3A2418';
    g.beginPath(); g.arc(4, -21 + wob, 1.7, 0, TAU); g.fill();
    g.fillStyle = '#F07F1A';
    g.beginPath(); g.moveTo(9, -22 + wob); g.lineTo(13.5, -20 + wob); g.lineTo(9, -18 + wob); g.closePath(); g.fill();
    g.restore();
  }

  function drawBeam(g, x, gy) {
    // A rusty Bethlehem Steel wide-flange ("Grey") beam lying on the ground,
    // seen from the end so the iconic I-profile faces the runner.
    const h = 22, w = 20, ft = 5, wt = 5, dx = 36, dy = -9;
    const x0 = x, y0 = gy - h;
    const top = '#B06A3F', side = '#6E3B22', face = '#94532F', line = '#3E2414';
    const wx = x0 + (w - wt) / 2;
    g.lineJoin = 'round';
    g.strokeStyle = line; g.lineWidth = 1;
    // top surface of the bottom flange (visible beside the web)
    poly(g, [wx + wt, gy - ft, x0 + w, gy - ft, x0 + w + dx, gy - ft + dy, wx + wt + dx, gy - ft + dy], top);
    // web side face
    poly(g, [wx + wt, y0 + ft, wx + wt + dx, y0 + ft + dy, wx + wt + dx, gy - ft + dy, wx + wt, gy - ft], side);
    // underside of top flange
    poly(g, [wx + wt, y0 + ft, x0 + w, y0 + ft, x0 + w + dx, y0 + ft + dy, wx + wt + dx, y0 + ft + dy], '#5A2F1B');
    // bottom flange side
    poly(g, [x0 + w, gy - ft, x0 + w + dx, gy - ft + dy, x0 + w + dx, gy + dy, x0 + w, gy], side);
    // top flange: top & side
    poly(g, [x0, y0, x0 + w, y0, x0 + w + dx, y0 + dy, x0 + dx, y0 + dy], top);
    poly(g, [x0 + w, y0, x0 + w + dx, y0 + dy, x0 + w + dx, y0 + ft + dy, x0 + w, y0 + ft], side);
    // the I-profile on the near end
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x0 + w, y0); g.lineTo(x0 + w, y0 + ft); g.lineTo(wx + wt, y0 + ft);
    g.lineTo(wx + wt, gy - ft); g.lineTo(x0 + w, gy - ft); g.lineTo(x0 + w, gy); g.lineTo(x0, gy);
    g.lineTo(x0, gy - ft); g.lineTo(wx, gy - ft); g.lineTo(wx, y0 + ft); g.lineTo(x0, y0 + ft);
    g.closePath();
    g.fillStyle = face; g.fill(); g.stroke();
    // outline the long edges
    g.beginPath();
    g.moveTo(x0, y0); g.lineTo(x0 + dx, y0 + dy); g.lineTo(x0 + w + dx, y0 + dy);
    g.lineTo(x0 + w + dx, y0 + ft + dy);
    g.moveTo(x0 + w + dx, gy - ft + dy); g.lineTo(x0 + w + dx, gy + dy); g.lineTo(x0 + w, gy);
    g.stroke();
    // rust speckles & a stamped star
    const r = RH.rng(42);
    g.fillStyle = 'rgba(60,25,10,0.45)';
    for (let i = 0; i < 18; i++) g.fillRect(x0 + w + r() * dx, y0 + dy + r() * 4 + (r() * dx * -dy) / dx, 1.2, 1.2);
  }

  function drawBooks(g, x, gy, seed) {
    const r = RH.rng(seed);
    const cols = [C.navy, C.blue, '#7A8590', C.gold, '#8C1D2B', '#2F5D46'];
    let y = gy;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const bh = 7 + Math.floor(r() * 3);
      const bw = 34 - i * 2 - Math.floor(r() * 5);
      const off = (r() - 0.5) * 6;
      const bx = x + (40 - bw) / 2 + off;
      y -= bh;
      const col = cols[Math.floor(r() * cols.length)];
      // pages
      roundRect(g, bx, y, bw, bh, 1.5);
      g.fillStyle = '#F3EEE2'; g.fill();
      // cover/spine facing us
      roundRect(g, bx, y, bw, bh, 1.5);
      g.fillStyle = col; g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1; g.stroke();
      // page edge on the right
      g.fillStyle = '#F3EEE2';
      g.fillRect(bx + bw - 3, y + 1.5, 2, bh - 3);
      // spine bands
      g.fillStyle = col === C.gold ? C.navy : C.goldLight;
      g.fillRect(bx + 4, y + 1.5, 1.4, bh - 3);
      g.fillRect(bx + bw - 9, y + 1.5, 1.4, bh - 3);
      g.fillRect(bx + 9, y + bh / 2 - 0.6, bw - 22, 1.2);
    }
    // a tiny Moravian star pennant tucked on top
    RH.drawMoravianStar(g, x + 28, y - 5, 5, 0.2, { lit: true });
    return gy - y;
  }

  function drawLantern(g, x, gy, t) {
    // Moravian Star lantern on a little iron post
    const cx = x + 12;
    g.fillStyle = '#23272E';
    g.fillRect(cx - 7, gy - 3, 14, 3);
    g.fillRect(cx - 1.8, gy - 40, 3.6, 38);
    g.fillRect(cx - 4, gy - 41, 8, 2.5);
    RH.drawMoravianStar(g, cx, gy - 50, 13, Math.sin(t * 1.3) * 0.08, { lit: true, glow: 2.4 });
  }

  RH.Obstacles = {
    candle: {
      name: 'a Lovefeast candle',
      fact: 'At Moravian Christmas Eve lovefeasts, every guest is handed a lit beeswax candle trimmed with a red paper frill.',
      make(level, rnd) {
        const n = 1 + Math.floor(rnd() * Math.min(3, level + 1.6));
        const hs = [];
        for (let i = 0; i < n; i++) hs.push(20 + Math.floor(rnd() * 9));
        const sp = 15;
        return {
          w: 18 + (n - 1) * sp,
          boxes: hs.map((h, i) => ({ x: i * sp + 3, y: -(h + 5), w: 12, h: h + 5 })),
          draw(g, x, gy, t) { hs.forEach((h, i) => drawCandle(g, x + 9 + i * sp, gy, h, t + i * 1.7)); },
        };
      },
    },
    chick: {
      name: 'a marshmallow chick',
      fact: 'Just Born, the candy company famous for its marshmallow chicks, has called Bethlehem home for decades.',
      make(level, rnd) {
        const n = 1 + Math.floor(rnd() * Math.min(3, level + 1.6));
        const sp = 25, seed = Math.floor(rnd() * 1000);
        return {
          w: 28 + (n - 1) * sp,
          boxes: Array.from({ length: n }, (_, i) => ({ x: i * sp + 3, y: -24, w: 22, h: 24 })),
          draw(g, x, gy, t) { for (let i = 0; i < n; i++) drawChick(g, x + 14 + i * sp, gy, t, seed + i); },
        };
      },
    },
    beam: {
      name: 'a Bethlehem Steel beam',
      fact: 'Bethlehem Steel rolled the wide-flange "Grey beam" that helped make skyscrapers possible, and it supplied steel for the Golden Gate Bridge.',
      make() {
        return {
          w: 56,
          boxes: [{ x: 2, y: -21, w: 22, h: 21 }, { x: 22, y: -27, w: 32, h: 22 }],
          draw(g, x, gy) { drawBeam(g, x, gy); },
        };
      },
    },
    books: {
      name: 'a stack of library books',
      fact: 'Moravian traces its roots to 1742, making it one of the oldest colleges in America and a pioneer in educating women.',
      make(level, rnd) {
        const seed = Math.floor(rnd() * 1e6);
        return {
          w: 40,
          boxes: [{ x: 4, y: -32, w: 32, h: 32 }],
          draw(g, x, gy) { drawBooks(g, x, gy, seed); },
        };
      },
    },
    lantern: {
      name: 'a Moravian Star lantern',
      fact: 'The Moravian Star is said to have begun in the 1830s as a geometry lesson at a Moravian boys’ school in Niesky, Germany.',
      make() {
        return {
          w: 24,
          boxes: [{ x: 3, y: -62, w: 18, h: 24 }, { x: 8, y: -40, w: 8, h: 40 }],
          draw(g, x, gy, t) { drawLantern(g, x, gy, t); },
        };
      },
    },
    flyer: {
      name: 'a flying Moravian Star',
      fact: 'Bethlehem became “Christmas City, USA” in 1937, the same year a giant star first shone atop South Mountain.',
      make(level, rnd) {
        const alts = [34, 58, 58, 96];
        const alt = alts[Math.floor(rnd() * alts.length)];
        return {
          w: 32,
          flying: true,
          vx: 45,
          boxes: [{ x: 6, y: -alt - 10, w: 20, h: 20 }],
          draw(g, x, gy, t) {
            RH.drawMoravianStar(g, x + 16, gy - alt, 16, t * 2.4, { lit: true, glow: 2.2 });
          },
        };
      },
    },
  };

  // ---------------------------------------------------------------------------
  // Scenery — Bethlehem, PA. Prerendered into looping day & night layers.
  // ---------------------------------------------------------------------------
  function makeCanvas(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    return [c, g];
  }

  // Draw a scene three times (shifted by ±LW) so features crossing an edge wrap.
  function looped(g, fn) {
    for (const off of [-LW, 0, LW]) {
      g.save();
      g.translate(off, 0);
      fn(g);
      g.restore();
    }
  }

  function ridgeFn(base, terms) {
    return (x) => {
      let y = base;
      for (const [k, a, ph] of terms) y -= a * Math.sin((TAU * k * x) / LW + ph);
      return y;
    };
  }

  function fillRidge(g, f, color) {
    g.beginPath();
    g.moveTo(0, RH.H);
    for (let x = 0; x <= LW; x += 6) g.lineTo(x, f(x));
    g.lineTo(LW, RH.H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  function bethlehemStar(g, x, y, night) {
    // the big star that shines over the city from South Mountain
    g.strokeStyle = night ? '#25335A' : '#7187A6';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - 7, y + 30); g.lineTo(x, y + 6); g.lineTo(x + 7, y + 30);
    g.moveTo(x - 4, y + 20); g.lineTo(x + 4, y + 20);
    g.moveTo(x - 5.5, y + 25); g.lineTo(x + 5.5, y + 25);
    g.stroke();
    if (night) glow(g, x, y, 46, 'rgba(255,236,170,0.55)');
    g.fillStyle = night ? '#FFF9E6' : '#E7ECF2';
    g.beginPath();
    const pts = [[0, -18], [3, -3], [12, 0], [3, 3], [0, 14], [-3, 3], [-12, 0], [-3, -3]];
    pts.forEach(([px, py], i) => (i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)));
    g.closePath();
    g.fill();
    g.beginPath();
    const d = [[7, -7], [2.5, 0], [7, 7], [0, 2.5], [-7, 7], [-2.5, 0], [-7, -7], [0, -2.5]];
    d.forEach(([px, py], i) => (i ? g.lineTo(x + px, y + py) : g.moveTo(x + px, y + py)));
    g.closePath();
    g.fill();
  }

  function buildFar(g, night) {
    const back = ridgeFn(200, [[2, 14, 0.3], [5, 7, 1.1], [9, 3, 2.0]]);
    const south = ridgeFn(218, [[3, 18, 1.7], [7, 6, 0.4], [13, 2.5, 2.5]]);
    looped(g, (g) => {
      fillRidge(g, back, night ? '#14254D' : '#A9BED6');
      fillRidge(g, south, night ? '#0E1C3D' : '#8CA4C2');
      bethlehemStar(g, 700, south(700) - 34, night);
      bethlehemStar(g, 700 + LW / 2, south(700 + LW / 2) - 34, night);
    });
  }

  function trees(g, x, B, night, seed, n) {
    const geo = RH.rng(seed), lights = RH.rng(seed * 17);
    for (let i = 0; i < n; i++) {
      const tx = x + i * 26 + geo() * 10;
      const s = 0.8 + geo() * 0.5;
      g.fillStyle = night ? '#121B31' : '#5A4636';
      g.fillRect(tx - 2, B - 18 * s, 4, 18 * s);
      const col = night ? ['#13203A', '#172540'] : ['#4E7A4B', '#5F8C55'];
      for (let k = 0; k < 4; k++) {
        g.fillStyle = col[k % 2];
        g.beginPath();
        g.arc(tx + (geo() - 0.5) * 18 * s, B - 26 * s - geo() * 16 * s, (10 + geo() * 6) * s, 0, TAU);
        g.fill();
      }
      if (night && lights() < 0.7) {
        // white holiday lights
        for (let k = 0; k < 10; k++) {
          const lx = tx + (lights() - 0.5) * 30 * s, ly = B - 18 * s - lights() * 34 * s;
          glow(g, lx, ly, 3, 'rgba(255,240,200,0.9)');
        }
      }
    }
  }

  function steelStacks(g, x0, B, night) {
    const body = night ? '#1A2443' : '#6E5246';
    const dark = night ? '#141C36' : '#523A31';
    const pipe = night ? '#222D4E' : '#7E5E50';
    if (night) glow(g, x0 + 190, B - 80, 220, 'rgba(120,110,255,0.22)');
    g.fillStyle = dark;
    g.fillRect(x0 + 6, B - 172, 9, 172);
    g.fillRect(x0 + 362, B - 158, 9, 158);
    for (let i = 0; i < 4; i++) {
      const fx = x0 + 62 + i * 90;
      for (let j = 0; j < 3; j++) {
        const sx = fx + 22 + j * 15;
        g.fillStyle = dark;
        g.fillRect(sx, B - 80, 13, 80);
        g.beginPath(); g.arc(sx + 6.5, B - 80, 6.5, Math.PI, 0); g.fill();
      }
      g.strokeStyle = pipe;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(fx - 44, B); g.lineTo(fx - 8, B - 118);
      g.moveTo(fx - 36, B); g.lineTo(fx - 2, B - 112);
      for (let k = 1; k < 7; k++) {
        const t = k / 7;
        g.moveTo(fx - 44 + 36 * t, B - 118 * t); g.lineTo(fx - 36 + 34 * t, B - 112 * t);
      }
      g.stroke();
      poly(g, [fx - 16, B, fx - 11, B - 92, fx + 11, B - 92, fx + 16, B], body);
      rect(g, fx - 14, B - 100, 28, 8, dark);
      rect(g, fx - 9, B - 122, 18, 22, body);
      rect(g, fx - 8, B - 152, 4, 30, pipe);
      rect(g, fx + 4, B - 146, 4, 24, pipe);
      g.strokeStyle = pipe;
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(fx - 6, B - 150);
      g.quadraticCurveTo(fx + 30, B - 152, fx + 30, B - 96);
      g.lineTo(fx + 30, B - 64);
      g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = dark;
      g.beginPath();
      g.moveTo(fx - 16, B - 42); g.lineTo(fx + 66, B - 42);
      g.moveTo(fx - 13, B - 70); g.lineTo(fx + 66, B - 70);
      g.stroke();
    }
    if (night) {
      // the furnaces are lit in shifting colors at night
      const cols = ['rgba(110,170,255,0.9)', 'rgba(190,140,255,0.9)', 'rgba(255,180,90,0.9)', 'rgba(255,110,160,0.85)'];
      const r = RH.rng(9);
      for (let i = 0; i < 4; i++) {
        const fx = x0 + 62 + i * 90;
        const col = cols[i % cols.length];
        glow(g, fx, B - 92, 34, col, 0.55);
        glow(g, fx + 37, B - 60, 30, cols[(i + 1) % cols.length], 0.4);
        for (let k = 0; k < 6; k++) glow(g, fx - 14 + r() * 80, B - 20 - r() * 120, 3.5, 'rgba(255,240,210,0.95)');
      }
    }
  }

  // Geometry and window lights use separate RNGs so day & night layers line up.
  function rowhouses(g, x0, B, night, count, seed) {
    const geo = RH.rng(seed), lights = RH.rng(seed * 31);
    const walls = night ? ['#1E2B4A', '#1A2644', '#223051'] : ['#9A5A45', '#B7A68C', '#D6C7A8', '#8D4E3D'];
    let x = x0;
    for (let i = 0; i < count; i++) {
      const w = 62 + Math.floor(geo() * 20);
      const h = 46 + Math.floor(geo() * 22);
      rect(g, x, B - h, w, h, walls[Math.floor(geo() * walls.length)]);
      poly(g, [x - 3, B - h, x + w / 2, B - h - 20, x + w + 3, B - h], night ? '#131C33' : '#4F3F3A');
      rect(g, x + w * 0.7, B - h - 18, 6, 12, night ? '#131C33' : '#5E4740');
      const cols = Math.floor((w - 10) / 18);
      for (let row = 0; row < 2; row++) {
        const wy = B - h + 10 + row * 22;
        if (wy + 14 > B - 6) continue;
        for (let k = 0; k < cols; k++) {
          const wx = x + 8 + k * ((w - 16) / cols) + ((w - 16) / cols - 9) / 2;
          if (night) {
            const on = lights() < 0.75;
            rect(g, wx, wy, 9, 13, on ? '#FFD27A' : '#2A3656');
            // a Moravian Star hanging in the window
            if (on && lights() < 0.45) RH.drawMoravianStar(g, wx + 4.5, wy + 5.5, 3.6, 0, { lit: true, glow: 2.5 });
          } else {
            rect(g, wx - 1, wy - 1, 11, 15, '#EDE6D6');
            rect(g, wx, wy, 9, 13, '#3A4C63');
            rect(g, wx + 4, wy, 1, 13, '#EDE6D6');
          }
        }
      }
      rect(g, x + w / 2 - 5, B - 16, 10, 16, night ? '#0F172B' : '#3D2A22');
      x += w + 3;
    }
  }

  function centralMoravianChurch(g, x0, B, night) {
    const wall = night ? '#25324F' : '#E6DCC6';
    const roof = night ? '#151E35' : '#6B5A52';
    const white = night ? '#C9D3E8' : '#FFFFFF';
    const w = 170, h = 58;
    const cx = x0 + w / 2;
    if (night) glow(g, cx, B - h - 60, 70, 'rgba(200,220,255,0.25)');
    rect(g, x0, B - h, w, h, wall);
    poly(g, [x0 - 4, B - h, x0 + 22, B - h - 24, x0 + w - 22, B - h - 24, x0 + w + 4, B - h], roof);
    for (let i = 0; i < 5; i++) {
      const wx = x0 + 17 + i * 31;
      g.fillStyle = night ? '#FFCF7A' : '#5A6E8A';
      g.beginPath();
      g.moveTo(wx, B - 12); g.lineTo(wx, B - 40); g.arc(wx + 6, B - 40, 6, Math.PI, 0); g.lineTo(wx + 12, B - 12);
      g.closePath(); g.fill();
    }
    // belfry
    const t0 = B - h - 24;
    rect(g, cx - 15, t0 - 20, 30, 20, white);
    rect(g, cx - 17, t0 - 22, 34, 3, white);
    rect(g, cx - 11, t0 - 46, 22, 24, white);
    g.fillStyle = night ? '#2A3654' : '#7B8792';
    for (const ox of [-7, 2]) {
      g.beginPath();
      g.moveTo(cx + ox, t0 - 27); g.lineTo(cx + ox, t0 - 38); g.arc(cx + ox + 2.5, t0 - 38, 2.5, Math.PI, 0); g.lineTo(cx + ox + 5, t0 - 27);
      g.closePath(); g.fill();
    }
    rect(g, cx - 13, t0 - 48, 26, 3, white);
    const dome = night ? '#2E3B5C' : '#6F8A80';
    g.fillStyle = dome;
    g.beginPath();
    g.moveTo(cx - 12, t0 - 48);
    g.bezierCurveTo(cx - 12, t0 - 58, cx - 2, t0 - 58, cx - 2, t0 - 66);
    g.lineTo(cx + 2, t0 - 66);
    g.bezierCurveTo(cx + 2, t0 - 58, cx + 12, t0 - 58, cx + 12, t0 - 48);
    g.closePath(); g.fill();
    rect(g, cx - 3.5, t0 - 76, 7, 10, white);
    if (night) glow(g, cx, t0 - 71, 12, 'rgba(255,230,160,0.8)');
    g.strokeStyle = night ? '#8892AA' : '#3B434C';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx, t0 - 76); g.lineTo(cx, t0 - 88); g.stroke();
    g.fillStyle = night ? '#FFE29A' : C.gold;
    g.beginPath(); g.arc(cx, t0 - 79, 1.6, 0, TAU); g.fill();
  }

  function comeniusHall(g, x0, B, night, rnd) {
    const stone = night ? '#1E2A47' : '#8E8373';
    const dark = night ? '#151F38' : '#6E6456';
    const roof = night ? '#131B30' : '#4D4A4E';
    const w = 300, h = 56, tx = x0 + 130;
    rect(g, x0, B - h, w, h, stone);
    poly(g, [x0 - 4, B - h, x0 + 12, B - h - 18, x0 + w - 12, B - h - 18, x0 + w + 4, B - h], roof);
    for (let row = 0; row < 2; row++) {
      for (let wx = x0 + 10; wx < x0 + w - 12; wx += 22) {
        if (wx > tx - 14 && wx < tx + 46) continue;
        const wy = B - 48 + row * 24;
        g.fillStyle = night ? (rnd() < 0.6 ? '#FFD27A' : '#2A3656') : '#4B5868';
        g.beginPath();
        g.moveTo(wx, wy + 16); g.lineTo(wx, wy + 5); g.lineTo(wx + 4.5, wy); g.lineTo(wx + 9, wy + 5); g.lineTo(wx + 9, wy + 16);
        g.closePath(); g.fill();
      }
    }
    // the central tower
    rect(g, tx, B - 140, 40, 140, stone);
    rect(g, tx - 2, B - 104, 44, 3, dark);
    for (let i = 0; i < 5; i++) rect(g, tx + i * 9, B - 147, 5, 7, stone);
    for (const px of [tx, tx + 40]) poly(g, [px - 3, B - 140, px, B - 158, px + 3, B - 140], stone);
    g.fillStyle = night ? '#FFE7A8' : '#F1EBDD';
    if (night) glow(g, tx + 20, B - 120, 22, 'rgba(255,230,160,0.6)');
    g.beginPath(); g.arc(tx + 20, B - 120, 8, 0, TAU); g.fill();
    g.strokeStyle = '#2B2F36'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(tx + 20, B - 120); g.lineTo(tx + 20, B - 126); g.moveTo(tx + 20, B - 120); g.lineTo(tx + 24, B - 118); g.stroke();
    g.fillStyle = night ? '#FFD27A' : '#4B5868';
    g.beginPath();
    g.moveTo(tx + 14, B - 62); g.lineTo(tx + 14, B - 88); g.lineTo(tx + 20, B - 96); g.lineTo(tx + 26, B - 88); g.lineTo(tx + 26, B - 62);
    g.closePath(); g.fill();
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(tx + 10, B); g.lineTo(tx + 10, B - 22); g.lineTo(tx + 20, B - 32); g.lineTo(tx + 30, B - 22); g.lineTo(tx + 30, B);
    g.closePath(); g.fill();
  }

  function buildMid(g, night) {
    const B = 262;
    looped(g, (g) => {
      rect(g, 0, B - 2, LW, RH.H, night ? '#16223F' : '#76935F');
      trees(g, 0, B, night, 1, 2);
      steelStacks(g, 50, B, night);
      trees(g, 440, B, night, 2, 3);
      rowhouses(g, 540, B, night, 4, 11);
      centralMoravianChurch(g, 905, B, night);
      trees(g, 1090, B, night, 3, 5);
      comeniusHall(g, 1240, B, night, RH.rng(77));
      rowhouses(g, 1570, B, night, 4, 23);
      trees(g, 1880, B, night, 4, 2);
    });
  }

  function lampPost(g, x, B, night) {
    const iron = night ? '#0C1222' : '#2B2F36';
    rect(g, x - 2, B - 70, 4, 70, iron);
    rect(g, x - 5, B - 4, 10, 4, iron);
    poly(g, [x - 7, B - 72, x + 7, B - 72, x + 5, B - 86, x - 5, B - 86], night ? '#FFE3A0' : '#DDE3EA');
    poly(g, [x - 8, B - 86, x + 8, B - 86, x, B - 93], iron);
    rect(g, x - 8, B - 73, 16, 2, iron);
    if (night) glow(g, x, B - 79, 40, 'rgba(255,220,140,0.55)');
    // a navy banner with a gold star
    rect(g, x + 2, B - 64, 14, 2, iron);
    poly(g, [x + 3, B - 62, x + 16, B - 62, x + 16, B - 34, x + 9.5, B - 39, x + 3, B - 34], night ? '#0F2147' : C.navy);
    RH.drawMoravianStar(g, x + 9.5, B - 52, 4.5, 0, { lit: true });
  }

  function campusSign(g, x, B, night) {
    const stone = night ? '#2A3350' : '#9C9282';
    const cap = night ? '#323C5C' : '#B4AA98';
    rect(g, x, B - 30, 150, 30, stone);
    rect(g, x - 4, B - 34, 158, 5, cap);
    g.strokeStyle = night ? '#222A44' : '#857B6C';
    g.lineWidth = 1;
    g.beginPath();
    for (let row = 0; row < 3; row++) {
      const y = B - 29 + row * 10;
      g.moveTo(x, y); g.lineTo(x + 150, y);
      for (let k = 0; k < 7; k++) {
        const bx = x + 12 + k * 22 + (row % 2) * 11;
        g.moveTo(bx, y); g.lineTo(bx, y + 10);
      }
    }
    g.stroke();
    rect(g, x + 14, B - 27, 122, 20, night ? '#0F2147' : C.navy);
    g.strokeStyle = C.gold;
    g.strokeRect(x + 15.5, B - 25.5, 119, 17);
    g.fillStyle = '#FFFFFF';
    g.font = 'bold 8.5px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('MORAVIAN UNIVERSITY', x + 75, B - 19.5);
    g.fillStyle = C.goldLight;
    g.font = '6px Georgia, serif';
    g.fillText('BETHLEHEM, PA · 1742', x + 75, B - 12);
  }

  function hedge(g, x, w, B, night, rnd) {
    g.fillStyle = night ? '#0F1A30' : '#3F6B3E';
    for (let i = 0; i < w; i += 9) {
      g.beginPath();
      g.arc(x + i, B - 6 - rnd() * 3, 8 + rnd() * 3, 0, TAU);
      g.fill();
    }
    rect(g, x - 6, B - 8, w + 10, 8, night ? '#0F1A30' : '#3F6B3E');
  }

  function fence(g, x, w, B, night) {
    g.fillStyle = night ? '#0C1222' : '#2B2F36';
    g.fillRect(x, B - 22, w, 2);
    g.fillRect(x, B - 6, w, 2);
    for (let i = 0; i <= w; i += 7) {
      g.fillRect(x + i - 1, B - 26, 2, 26);
      g.beginPath(); g.moveTo(x + i - 2.5, B - 26); g.lineTo(x + i, B - 30); g.lineTo(x + i + 2.5, B - 26); g.fill();
    }
  }

  function buildNear(g, night) {
    const B = RH.GROUND_Y;
    looped(g, (g) => {
      const rnd = RH.rng(303);
      hedge(g, 180, 110, B, night, rnd);
      lampPost(g, 120, B, night);
      lampPost(g, 600, B, night);
      campusSign(g, 760, B, night);
      lampPost(g, 1080, B, night);
      fence(g, 1180, 230, B, night);
      hedge(g, 1460, 70, B, night, rnd);
      lampPost(g, 1560, B, night);
    });
  }

  function buildClouds(g) {
    const r = RH.rng(55);
    looped(g, (g) => {
      for (let i = 0; i < 7; i++) {
        const cx = (i / 7) * LW + r() * 120, cy = 40 + r() * 70, s = 0.6 + r() * 0.7;
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (let k = 0; k < 5; k++) {
          g.beginPath();
          g.arc(cx + (k - 2) * 16 * s, cy - Math.sin((k / 4) * Math.PI) * 10 * s, (12 + Math.sin((k / 4) * Math.PI) * 8) * s, 0, TAU);
          g.fill();
        }
        g.fillRect(cx - 34 * s, cy, 68 * s, 10 * s);
      }
    });
  }

  function buildGround(g, night) {
    const w = 240, h = RH.H - RH.GROUND_Y;
    rect(g, 0, 0, w, h, night ? '#1E1626' : '#6B3427');
    const rowH = 9;
    for (let row = 0; row * rowH + 5 < h; row++) {
      const y = 5 + row * rowH;
      const off = row % 2 ? 12 : 0;
      for (let k = 0; k <= 10; k++) {
        const x = -off + k * 24;
        const r = RH.rng((k % 10) * 97 + row * 13 + 1)();
        const shade = Math.floor(r * 3);
        const cols = night ? ['#3A2A3C', '#34263A', '#40303F'] : ['#A0533F', '#93493A', '#AD5E47'];
        rect(g, x + 1, y + 1, 22, rowH - 1.5, cols[shade]);
      }
    }
    rect(g, 0, 0, w, 6, night ? '#3C4766' : '#9AA0A7');
    rect(g, 0, 0, w, 1.5, night ? '#56638A' : '#C3C8CE');
    rect(g, 0, 6, w, 1, 'rgba(0,0,0,0.3)');
  }

  RH.buildScenery = function (dpr) {
    const pair = (w, h, fn) => {
      const [dc, dg] = makeCanvas(w, h, dpr);
      fn(dg, false);
      const [nc, ng] = makeCanvas(w, h, dpr);
      fn(ng, true);
      return { day: dc, night: nc, w, h };
    };
    const [cc, cg] = makeCanvas(LW, 160, dpr);
    buildClouds(cg);
    return {
      clouds: { day: cc, w: LW, h: 160 },
      far: pair(LW, RH.H, buildFar),
      mid: pair(LW, RH.H, buildMid),
      near: pair(LW, RH.H, buildNear),
      ground: pair(240, RH.H - RH.GROUND_Y, buildGround),
    };
  };
})((window.RH = window.RH || {}));
