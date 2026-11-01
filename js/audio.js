/*
 * Runny Hound — synthesized audio.
 * All sound effects and music are generated live with the Web Audio API.
 * The music is a short original chorale voiced like a Moravian trombone choir.
 */
(function (RH) {
  'use strict';

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v === '1'; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* ignore */ } },
  };

  let ac = null, master, sfx, music, noiseBuf;
  let muted = store.get('rhMuted', false);
  let musicOn = store.get('rhMusic', true);

  function unlock() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
      sfx = ac.createGain();
      sfx.gain.value = 0.9;
      sfx.connect(master);
      music = ac.createGain();
      music.gain.value = musicOn ? 0.2 : 0;
      music.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function envGain(t, attack, peak, decay, dest) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(dest);
    return g;
  }

  function tone(type, f, t, dur, peak, dest, fEnd, attack) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    o.connect(envGain(t, attack || 0.005, peak, dur, dest));
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  function noise(t, dur, peak, dest, filterType, f0, f1) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    src.connect(f).connect(envGain(t, 0.004, peak, dur, dest));
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  function bell(f, t, peak) {
    // inharmonic partials give a church-bell shimmer
    [[1, 1], [2, 0.5], [2.76, 0.35], [5.4, 0.15]].forEach(([m, a]) => tone('sine', f * m, t, 1.1 / m + 0.25, peak * a, sfx));
  }

  const SFX = {
    jump() {
      if (!unlock()) return;
      const t = ac.currentTime;
      tone('square', 380, t, 0.13, 0.09, sfx, 760);
      tone('triangle', 760, t, 0.1, 0.07, sfx, 1250);
    },
    land() {
      if (!unlock()) return;
      noise(ac.currentTime, 0.07, 0.08, sfx, 'lowpass', 500);
    },
    point() {
      if (!unlock()) return;
      const t = ac.currentTime;
      bell(mtof(84), t, 0.12);
      bell(mtof(89), t + 0.13, 0.12);
    },
    crash() {
      if (!unlock()) return;
      const t = ac.currentTime;
      noise(t, 0.45, 0.4, sfx, 'lowpass', 2400, 180);
      tone('sawtooth', 220, t, 0.45, 0.18, sfx, 48);
      tone('square', 110, t + 0.02, 0.3, 0.08, sfx, 40);
    },
    start() {
      if (!unlock()) return;
      const t = ac.currentTime;
      [65, 69, 72, 77].forEach((m, i) => tone('triangle', mtof(m + 12), t + i * 0.07, 0.18, 0.12, sfx));
    },
    duck() {
      if (!unlock()) return;
      noise(ac.currentTime, 0.12, 0.05, sfx, 'bandpass', 1800, 600);
    },
  };

  // ---------------------------------------------------------------------------
  // Music — an original 8-bar chorale in F major, looped.
  // ---------------------------------------------------------------------------
  const CHORDS = [
    [41, 57, 60, 65], // F
    [46, 58, 62, 65], // Bb
    [48, 55, 64, 67], // C
    [41, 57, 60, 65], // F
    [50, 57, 62, 65], // Dm
    [43, 58, 62, 67], // Gm
    [48, 55, 64, 70], // C7
    [41, 57, 60, 65], // F
  ];
  const MELODY = [
    [72, 74, 72, 69],
    [70, 72, 74, 77],
    [76, 74, 72, 67],
    [69, 72, 77, null],
    [74, 72, 74, 77],
    [79, 77, 74, 70],
    [72, 76, 74, 72],
    [77, null, null, null],
  ];
  const BPM = 128;
  const BEAT = 60 / BPM;
  let timer = null, nextTime = 0, step = 0;

  function brassChord(notes, t, dur) {
    const filt = ac.createBiquadFilter();
    filt.type = 'lowpass';
    filt.Q.value = 1.5;
    filt.frequency.setValueAtTime(500, t);
    filt.frequency.linearRampToValueAtTime(1700, t + 0.08);
    filt.frequency.linearRampToValueAtTime(1000, t + 0.5);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.setValueAtTime(0.13, t + dur - 0.12);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    filt.connect(g).connect(music);
    notes.slice(1).forEach((m) => {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(filt);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / 8) % 8;
    const e = s % 8; // eighth-note within the bar
    if (e === 0) brassChord(CHORDS[bar], t, BEAT * 4);
    if (e % 4 === 0) tone('triangle', mtof(CHORDS[bar][0]), t, BEAT * 1.6, 0.35, music);
    if (e % 4 === 2) tone('triangle', mtof(CHORDS[bar][0] + 7), t, BEAT * 0.8, 0.22, music);
    if (e % 2 === 0) {
      const m = MELODY[bar][e / 2];
      if (m) {
        const held = MELODY[bar][e / 2 + 1] === null ? (bar === 7 ? 3.5 : 1.8) : 0.85;
        tone('square', mtof(m), t, BEAT * held, 0.07, music, null, 0.02);
        tone('triangle', mtof(m), t, BEAT * held, 0.12, music, null, 0.02);
      }
    } else {
      noise(t, 0.03, 0.05, music, 'highpass', 7000);
    }
  }

  function tick() {
    while (nextTime < ac.currentTime + 0.25) {
      scheduleStep(step, nextTime);
      nextTime += BEAT / 2;
      step++;
    }
  }

  function startMusic() {
    if (timer || !unlock()) return;
    nextTime = ac.currentTime + 0.12;
    step = 0;
    tick();
    timer = setInterval(tick, 50);
  }

  function stopMusic() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function setMuted(v) {
    muted = v;
    store.set('rhMuted', v);
    if (ac) master.gain.setTargetAtTime(v ? 0 : 0.55, ac.currentTime, 0.02);
  }

  function setMusic(v) {
    musicOn = v;
    store.set('rhMusic', v);
    if (ac) music.gain.setTargetAtTime(v ? 0.2 : 0, ac.currentTime, 0.05);
  }

  RH.Audio = Object.assign(SFX, {
    unlock,
    startMusic,
    stopMusic,
    toggleMute() { setMuted(!muted); return muted; },
    toggleMusic() { setMusic(!musicOn); return musicOn; },
    get muted() { return muted; },
    get musicOn() { return musicOn; },
  });
})((window.RH = window.RH || {}));
