// Pixie Wisp - motore della creatura (Canvas 2D), estratto dal mockup "Fiamma viva".
// Logica in coordinate 760x440 (l'altezza resta 440, la larghezza segue lo schermo).
class DCLogic {
  constructor() {
    this.props = { lunghezza: 2, occhi: 'ombra', corpo: 'scintille', saluta: false, crucio: false, stopCrucio: false };
    this.state = {};
  }
  setState() {}
}
class Component extends DCLogic {
  componentWillUnmount() {
    this._halt(); this._detach(); this._cv = null;
    if (this._ac) { try { this._ac.close(); } catch (e) {} this._ac = null; }
  }
  _halt() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }
  _detach() { if (this._unlisten) { this._unlisten(); this._unlisten = null; } }

  // ---- suoni (WebAudio, 22050 Hz, generati in codice)
  _audio() {
    if (this._ac) {
      if (this._ac.state === 'suspended') { try { this._ac.resume(); } catch (e) {} }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      this._ac = ac; this._srcs = {};
      const rate = 22050;
      const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const tone = (dur, f0, f1, vol, vib, noise) => {
        const n = Math.floor(dur * rate), out = new Float32Array(n), r = seeded(321);
        let ph = 0;
        for (let i = 0; i < n; i++) {
          const x = i / Math.max(1, n - 1);
          const env = Math.pow(Math.sin(Math.PI * x), 1.65);
          const f = f0 + (f1 - f0) * x + Math.sin(x * Math.PI * 2 * 6) * vib;
          ph += Math.PI * 2 * f / rate;
          out[i] = Math.sin(ph) * vol * env + (noise ? (r() * 2 - 1) * noise * env : 0);
        }
        return out;
      };
      const echo = (sig, delay, decay, n) => {
        const d = Math.max(1, Math.floor(delay * rate));
        const out = new Float32Array(sig.length + d * n); out.set(sig);
        for (let k = 1; k <= n; k++) { const g = Math.pow(decay, k), off = d * k; for (let i = 0; i < sig.length; i++) out[i + off] += sig[i] * g; }
        return out;
      };
      const toBuf = (sig) => { const b = ac.createBuffer(1, sig.length, rate); b.getChannelData(0).set(sig); return b; };
      this._bank = {
        lament: toBuf(tone(0.7, 250, 90, 0.34, 14, 0.02)),
        stop: toBuf(tone(0.18, 260, 150, 0.2, 0, 0.015)),
        explode: toBuf(echo(tone(0.62, 160, 40, 0.46, 10, 0.12), 0.038, 0.42, 3)),
        bonk: toBuf(echo(tone(0.16, 210, 80, 0.34, 0, 0.1), 0.03, 0.35, 2)),
        ciao: toBuf((() => {
          const a = tone(0.28, 1040, 1460, 0.16, 5, 0), b = tone(0.2, 1560, 1860, 0.06, 2, 0);
          const m = new Float32Array(Math.max(a.length, b.length));
          for (let i = 0; i < a.length; i++) m[i] += a[i];
          for (let i = 0; i < b.length; i++) m[i] += b[i];
          return echo(m, 0.024, 0.48, 3);
        })())
      };
      // il lamento vero dell'app (MP3 originale); finche' non e' caricato resta il tono di riserva
      const bank = this._bank;
      Promise.resolve(window.LAMENT_B64 || '')
        .then((b64) => { if (!b64) throw new Error('no lament'); const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; })
        .then((ab) => new Promise((res, rej) => ac.decodeAudioData(ab, res, rej)))
        .then((b) => { bank.lament = b; })
        .catch(() => {});
    } catch (e) { this._ac = null; }
  }
  _play(key) {
    try {
      const ac = this._ac;
      if (!ac || !this._bank || !this._bank[key]) return;
      if (ac.state === 'suspended') ac.resume();
      const prev = this._srcs[key];
      if (prev) { try { prev.stop(); } catch (e) {} }
      const s = ac.createBufferSource(); s.buffer = this._bank[key]; s.connect(ac.destination); s.start();
      this._srcs[key] = s;
    } catch (e) {}
  }

  _run() {
    if (this._raf || !this._cv) return;
    const self = this, cv = this._cv;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // ---- costanti e utilita'
    // l'altezza della scena e' fissa (440): la larghezza segue lo schermo, cosi' la creatura
    // non si deforma mai e su schermi piu' lunghi ha solo piu' spazio ai lati
    const LH = 440, R = 120.8;
    let LW = 760;
    // profondita' della scatola = lato corto della scena; prospettiva verso il centro
    const DEPTH = LH, FOC = 1000, VY = LH / 2;
    let VX = LW / 2;
    const scaleAt = (z) => FOC / (FOC + z);
    // margine della testa: raggio dello strato esterno piu' la pulsazione
    // corpo centrale un pochettino piu' grande (solo gli strati, non l'alone di fondo)
    const BODY = 1.15;
    // margine: la parte visibile del bagliore resta dentro; le code piu' tenui sfumano sul bordo
    const M = 0.62 * 1.9 * R * BODY * 1.06 + 4;
    // tiene il centro dentro la scatola e rimbalza sui bordi
    // zona in cui puo' stare il centro alla profondita' z (piu' lontano = piu' piccolo = piu' spazio)
    const rangeAt = (z, comfy) => {
      const s = scaleAt(z);
      // zona "comoda": tutto il corpo resta lontano dalle pareti (ci si avvicina solo per sbatterci)
      if (comfy) {
        const MC = R * BODY * 1.05;
        return { x0: VX - VX / s + MC, x1: VX + VX / s - MC, y0: VY - VY / s + MC * 0.95, y1: VY + VY / s - MC * 0.8 };
      }
      // il centro si ferma quando l'AREA DEGLI OCCHI tocca la parete (non il bagliore)
      const MX = 0.86 * R * Math.sin(Math.min(1.5, 0.46 + 0.95 * Math.abs(C.turn || 0))) + 0.25 * R * 1.15 + 2;
      const MT = 0.36 * R, MB = 0.5 * R;
      return { x0: VX - VX / s + MX, x1: VX + VX / s - MX, y0: VY - VY / s + MT, y1: VY + VY / s - MB };
    };
    const box = () => {
      const rg = rangeAt(C.z);
      let hit = null;
      if (C.x < rg.x0) { C.x = rg.x0; C.vx = Math.abs(C.vx) * 0.5; hit = 'left'; }
      else if (C.x > rg.x1) { C.x = rg.x1; C.vx = -Math.abs(C.vx) * 0.5; hit = 'right'; }
      if (C.y < rg.y0) { C.y = rg.y0; C.vy = Math.abs(C.vy) * 0.5; hit = hit || 'top'; }
      else if (C.y > rg.y1) { C.y = rg.y1; C.vy = -Math.abs(C.vy) * 0.5; hit = hit || 'bottom'; }
      if (C.z < 0) { C.z = 0; C.vz = Math.abs(C.vz) * 0.5; } else if (C.z > DEPTH) { C.z = DEPTH; C.vz = -Math.abs(C.vz) * 0.5; }
      return hit;
    };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const h = (a) => { const s = Math.sin(a * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const n1 = (x) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return h(i) * (1 - u) + h(i + 1) * u; };
    const PAL = {
      outer: [[30, 90, 255], [255, 40, 15]],
      mid: [[60, 205, 255], [255, 135, 35]],
      core: [[228, 252, 255], [255, 240, 200]],
      eye: [[240, 254, 255], [255, 238, 215]],
      dark: [[3, 10, 38], [45, 6, 0]]
    };
    const col = (name, tint) => {
      const k = Math.round(clamp(tint, 0, 1) * 10) / 10, a = PAL[name][0], b = PAL[name][1];
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    };
    const rgb = (c) => 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')';

    // sprite "blob" 128x128 in cache per colore
    const sprites = {};
    const sprite = (c) => {
      const key = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
      let sp = sprites[key];
      if (!sp) {
        sp = document.createElement('canvas'); sp.width = 128; sp.height = 128;
        const g = sp.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        // sfumatura gaussiana: uniforme, senza gradini ne' anelli visibili
        for (let i = 0; i <= 12; i++) {
          const rr = i / 12, al = Math.exp(-4.5 * rr * rr) * (1 - rr * rr);
          gr.addColorStop(rr, 'rgba(' + key + ',' + al.toFixed(4) + ')');
        }
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        sprites[key] = sp;
      }
      return sp;
    };
    const q8 = (c) => [Math.round(c[0] / 8) * 8, Math.round(c[1] / 8) * 8, Math.round(c[2] / 8) * 8].map((v) => clamp(v, 0, 255));
    // pareti della scatola alla profondita' attuale; vicino alle pareti la luce si comprime
    // (g = z - a(1 - e^((d - z)/a)): liscia, non supera mai la parete)
    const SQZ = { l: 0, r: LW, t: 0, b: LH, zone: 0 };
    // ectoplasma: molle per lo schiacciamento contro le pareti (rimbalzo gelatinoso)
    const JL = { sx: 1, vx: 0, sy: 1, vy: 0 };
    const sq1 = (d) => { const z = SQZ.zone, a = 0.75 * z; return d < z ? z - a * (1 - Math.exp((d - z) / a)) : d; };
    const usq1 = (g) => { const z = SQZ.zone, a = 0.75 * z; return g < z ? z + a * Math.log(Math.max(1e-4, 1 - (z - g) / a)) : g; };
    const sqx = (x) => { if (SQZ.zone <= 0) return x; x = SQZ.l + sq1(x - SQZ.l); return SQZ.r - sq1(SQZ.r - x); };
    const sqy = (y) => { if (SQZ.zone <= 0) return y; y = SQZ.t + sq1(y - SQZ.t); return SQZ.b - sq1(SQZ.b - y); };
    const unsqx = (x) => { if (SQZ.zone <= 0) return x; x = SQZ.r - usq1(SQZ.r - x); return SQZ.l + usq1(x - SQZ.l); };
    const unsqy = (y) => { if (SQZ.zone <= 0) return y; y = SQZ.b - usq1(SQZ.b - y); return SQZ.t + usq1(y - SQZ.t); };
    // bagliore dell'occhio: si stringe in prospettiva insieme all'occhio (stessa forma ovale)
    let er0e = 1;
    const eblob = (c, e, dx, dy, r, a) => {
      if (r <= 0.3 || a <= 0.003) return;
      const kx = Math.max(0.15, Math.min(1, Math.cos(e.L) / Math.cos(0.46)));
      // segue SEMPRE la forma dell'occhio: anche quando si chiude (battito, crucio, urto) il bagliore si chiude con lui
      const ky = e.rh != null ? Math.max(0.06, Math.min(1.2, e.rh / er0e)) : Math.max(0.3, Math.min(1.2, Math.cos(e.B) / Math.cos(0.06)));
      a *= 0.25 + 0.75 * Math.min(1, ky);
      const x = sqx(e.x + dx * kx), y = sqy(e.y + dy * ky);
      ctx.save(); ctx.translate(x, y); ctx.scale(kx, ky);
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprite(c), -r, -r, r * 2, r * 2);
      ctx.restore();
    };
    // ogni blob viene compresso contro le pareti invece di uscirne
    const blob = (c, x, y, r, a) => {
      if (r <= 0.3 || a <= 0.003) return;
      x = sqx(x); y = sqy(y);
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprite(c), x - r, y - r, r * 2, r * 2);
    };

    // ---- stato
    const C = { x: VX, y: 260, vx: 0, vy: 0, tx: VX, ty: 260, timer: 0, sp: 1, turn: 0, pitch: 0, z: 200, vz: 0, tz: 200 };
    const S = { mode: 'normal', t: 0, tint: 0, squint: 0, tint0: 0, sq0: 0, blinks: 0, alpha: 1, blinkIn: rnd(2, 5), blinkT: 0, pulse: 1 };
    let trail = [], spine = [], tongues = [], tongueIn = rnd(0.25, 0.75), exp = [], sparks = [];
    // lingue delle fiamme nere degli occhi (posizioni relative all'occhio)
    const eyeTongues = [[], []], eyeTIn = [rnd(0.3, 0.6), rnd(0.3, 0.6)];
    const eyeTrail = [[], []], eyeSpine = [[], []];
    let time = 0, prevCrucio = !!self._crucio || !!(self.props && self.props.crucio);
    let prevSaluta = !!(self.props && self.props.saluta), prevStopP = !!(self.props && self.props.stopCrucio);
    // battito di ciglia piu' lungo e ben visibile
    const BL = 0.26;
    const ptr = { active: false, touch: false, x: VX, y: 260 };
    const view = { s: 1, ox: 0, oy: 0 };

    // nuovo punto da raggiungere, anche in profondita'
    const newTarget = () => {
      C.tz = rnd(0, DEPTH);
      const rg = rangeAt(C.tz, true);
      C.tx = rnd(rg.x0, Math.max(rg.x0, rg.x1)); C.ty = rnd(rg.y0, Math.max(rg.y0, rg.y1));
    };
    const smallTarget = () => {
      C.tz = clamp(C.z + rnd(-90, 90), 0, DEPTH);
      const rg = rangeAt(C.tz, true);
      C.tx = clamp(C.x + rnd(-120, 120), rg.x0, Math.max(rg.x0, rg.x1)); C.ty = clamp(C.y + rnd(-60, 60), rg.y0, Math.max(rg.y0, rg.y1));
    };
    C.turnT = 0; C.pitchT = 0;
    const Bh = { kind: 'face', t: 0, dur: 1.5, next: 0 };
    const pickBehavior = () => {
      const r = Math.random();
      Bh.t = 0; S.squint = 0; C.shx = 0; C.shy = 0;
      if (r < 0.30) {
        // momenti calmi: gironzola piano
        Bh.kind = 'drift'; Bh.dur = rnd(3, 7); C.sp = rnd(0.18, 0.35); smallTarget();
      } else if (r < 0.48) {
        // guarda verso un punto, poi ci va con calma
        Bh.kind = 'aim'; Bh.dur = rnd(0.5, 1.1); newTarget(); C.sp = rnd(0.45, 1.0);
      } else if (r < 0.60) {
        Bh.kind = 'look'; Bh.dur = rnd(1.8, 4); Bh.next = 0;
      } else if (r < 0.71) {
        Bh.kind = 'face'; Bh.dur = rnd(1.2, 3); C.tz = rnd(0, 60); // quando ti guarda si avvicina
      } else if (r < 0.92) {
        // scatto brevissimo e veloce
        Bh.kind = 'dash'; Bh.dur = rnd(0.35, 0.8); newTarget(); C.sp = rnd(2.6, 3.6);
      } else if (r < 0.96) {
        // raramente si gira del tutto per guardarsi dietro: per un attimo gli occhi spariscono
        Bh.kind = 'behind'; Bh.dur = rnd(0.7, 1.4); Bh.dir = Math.random() < 0.5 ? -1 : 1;
      } else {
        // raramente va a sbattere contro una parete laterale o il soffitto
        const rg = rangeAt(C.z), wall = ['left', 'right', 'top'][Math.floor(Math.random() * 3)];
        C.tz = C.z;
        if (wall === 'left') { C.tx = rg.x0 - 260; C.ty = C.y + rnd(-40, 40); }
        else if (wall === 'right') { C.tx = rg.x1 + 260; C.ty = C.y + rnd(-40, 40); }
        else { C.tx = C.x + rnd(-60, 60); C.ty = rg.y0 - 260; }
        Bh.kind = 'bump'; Bh.dur = 3; C.sp = rnd(1.8, 2.4);
      }
    };
    // dopo uno scatto o un urto torna calmo
    const calmAfter = () => { Bh.kind = 'drift'; Bh.t = 0; Bh.dur = rnd(2.5, 5); C.sp = rnd(0.18, 0.32); smallTarget(); };
    const enterOuch = () => { Bh.kind = 'ouch'; Bh.t = 0; Bh.dur = 1.15; S.blinkT = 0; self._play('bonk'); };

    // ---- puntatore (mouse o dito)
    const toLogical = (e) => {
      const r = cv.getBoundingClientRect();
      const px = (e.clientX - r.left) * (cv.width / (r.width || 1));
      const py = (e.clientY - r.top) * (cv.height / (r.height || 1));
      return [(px - view.ox) / view.s, (py - view.oy) / view.s];
    };
    // il puntatore non guida piu' la creatura: il tocco serve solo a sbloccare l'audio
    const onMove = () => {};
    const onDown = () => { self._audio(); };
    const onUp = (e) => { if (e.pointerType !== 'mouse') { ptr.touch = false; ptr.active = false; } };
    const onLeave = () => { ptr.active = false; ptr.touch = false; };
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onLeave);
    cv.addEventListener('pointerleave', onLeave);
    self._unlisten = () => {
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onLeave);
      cv.removeEventListener('pointerleave', onLeave);
    };

    // ---- reazioni
    const enterCrucio = () => {
      S.mode = 'crucio'; S.t = 0; C.vx = 0; C.vy = 0; C.turn = 0; C.pitch = 0; S.blinkT = 0;
      self._play('lament');
    };
    const enterCiao = () => {
      S.mode = 'ciao'; S.t = 0; C.vx = 0; C.vy = 0; S.bx = C.x; S.by = C.y; S.smile = true; S.blinkT = 0;
      self._play('ciao');
    };
    const enterStop = () => {
      S.mode = 'stop'; S.t = 0; S.tint0 = S.tint; S.sq0 = S.squint; S.blinks = 0;
      self._play('stop');
    };
    const enterExplode = () => {
      S.mode = 'explode'; S.t = 0; exp = []; trail = []; spine = []; tongues = [];
      for (let i = 0; i < 270; i++) {
        const ang = Math.random() * Math.PI * 2, sp = rnd(114, 570), life = rnd(0.4, 2.0);
        exp.push({ x: C.x, y: C.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: life, max: life, r: rnd(9.5, 47.5) });
      }
      self._play('explode');
    };
    const spark = (warm) => {
      const life = rnd(0.2, 0.6);
      return { x: VX + rnd(-2.5, 2.5), y: 220 + rnd(-2.5, 2.5), vx: rnd(-4.75, 4.75), vy: rnd(6, 16), life: life, max: life, r: rnd(1.6, 6.3), warm: warm };
    };
    const expColor = (r) => {
      if (r > 0.6) { const t = (r - 0.6) / 0.4; return [255, lerp(179, 77, t), lerp(219, 0, t)]; }
      if (r > 0.25) { const t = (r - 0.25) / 0.35; return [lerp(0, 255, t), lerp(219, 161, t), lerp(255, 77, t)]; }
      return [255, 255, 255];
    };
    const bodyVisible = () => S.mode === 'normal' || S.mode === 'ciao' || S.mode === 'crucio' || S.mode === 'stop' || (S.mode === 'match' && S.t >= 1);

    // ---- spina della fiamma
    const computeSpine = () => {
      const lung = (self.props && self.props.lunghezza != null) ? self.props.lunghezza : 2;
      const len = Math.min(380, (150 + Math.hypot(C.vx, C.vy) * 0.3) * lung);
      let pts = trail.map((p) => ({ x: p.x, y: p.y }));
      if (pts.length === 0) pts.push({ x: C.x, y: C.y });
      if (pts.length < 2) pts.push({ x: pts[0].x, y: pts[0].y - 10 });
      const lens = () => { const out = []; let tot = 0; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); out.push(l); tot += l; } return [out, tot]; };
      let [seg, total] = lens();
      if (total < len / 2) {
        const last = pts[pts.length - 1];
        pts.push({ x: last.x, y: last.y - (len / 2 - total) });
        [seg, total] = lens();
      }
      const L = Math.min(total, len), N = 30, out = [];
      let k = 0, acc = 0;
      for (let j = 0; j < N; j++) {
        const target = L * j / (N - 1);
        while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
        const u = clamp((target - acc) / (seg[k] || 1e-6), 0, 1);
        out.push({ x: lerp(pts[k].x, pts[k + 1].x, u), y: lerp(pts[k].y, pts[k + 1].y, u), nx: 0, ny: 0 });
      }
      for (let i = 0; i < N; i++) {
        const a = out[Math.max(0, i - 1)], b = out[Math.min(N - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        out[i].nx = -ty; out[i].ny = tx;
      }
      return out;
    };

    // spina generica da una scia (usata per le fiamme degli occhi), stessa logica del corpo
    const spineFrom = (tr, len, N) => {
      const pts = tr.map((p) => ({ x: p.x, y: p.y }));
      if (pts.length === 0) return [];
      if (pts.length < 2) pts.push({ x: pts[0].x, y: pts[0].y - 10 });
      const lens = () => { const out = []; let tot = 0; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); out.push(l); tot += l; } return [out, tot]; };
      let [seg, total] = lens();
      if (total < len / 2) { const last = pts[pts.length - 1]; pts.push({ x: last.x, y: last.y - (len / 2 - total) }); [seg, total] = lens(); }
      const L = Math.min(total, len), out = [];
      let k = 0, acc = 0;
      for (let j = 0; j < N; j++) {
        const target = L * j / (N - 1);
        while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
        const u = clamp((target - acc) / (seg[k] || 1e-6), 0, 1);
        out.push({ x: lerp(pts[k].x, pts[k + 1].x, u), y: lerp(pts[k].y, pts[k + 1].y, u), nx: 0, ny: 0 });
      }
      for (let i = 0; i < N; i++) {
        const a = out[Math.max(0, i - 1)], b = out[Math.min(N - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        out[i].nx = -ty; out[i].ny = tx;
      }
      return out;
    };

    // ---- step(dt): logica
    const step = (dt) => {
      time += dt; S.t += dt; S.dt = dt;
      const f60 = dt * 60;
      const sN = scaleAt(C.z), WL = VX - VX / sN + 4, WR = VX + VX / sN - 4, WT = VY - VY / sN + 4;

      // reazioni dai Tweaks: "saluta" e "stopCrucio" scattano ad ogni cambio, "crucio" e' un interruttore
      const PP = self.props || {};
      if (!!PP.saluta !== prevSaluta) { prevSaluta = !!PP.saluta; self._ciaoCmd = true; }
      if (!!PP.stopCrucio !== prevStopP) { prevStopP = !!PP.stopCrucio; self._stopCmd = true; }

      // crucio: parte solo quando la proprieta' passa da falso a vero
      const cru = !!self._crucio || !!PP.crucio;
      if (cru && !prevCrucio && S.mode === 'normal') enterCrucio();
      prevCrucio = cru;
      if (self._crucioCmd) { self._crucioCmd = false; if (S.mode === 'normal') enterCrucio(); }
      if (self._stopCmd) {
        self._stopCmd = false;
        if (S.mode === 'crucio') enterStop();
        else if (S.mode === 'normal' && Bh.kind !== 'ouch') { calmAfter(); self._play('stop'); } // se non soffre: si calma
      }
      if (self._ciaoCmd) { self._ciaoCmd = false; if (S.mode === 'normal') enterCiao(); }

      S.pulse = 1;
      if (S.mode === 'normal') {
        // comportamento casuale: si guarda in giro, mira e va, guarda te, gironzola
        Bh.t += dt;
        const dx = C.tx - C.x, dy = C.ty - C.y, d = Math.max(1, Math.hypot(dx, dy));
        if (Bh.kind === 'ouch') {
          // ha sbattuto: strizza gli occhi e si scrolla, poi li riapre
          const t = Bh.t, D = Bh.dur, k = Math.max(0, 1 - t / D);
          const damp = Math.pow(0.02, dt); C.vx *= damp; C.vy *= damp; C.vz *= damp;
          C.shx = Math.sin(t * 38) * 9 * Math.pow(k, 1.4);
          C.shy = Math.sin(t * 23 + 1) * 3 * Math.pow(k, 1.4);
          C.turnT = Math.sin(t * 26) * 0.8 * k; C.pitchT = 0;
          S.squint = t < D - 0.3 ? 1 : Math.max(0, (D - t) / 0.3);
          if (t >= D) { C.shx = 0; C.shy = 0; S.squint = 0; calmAfter(); }
        } else if (Bh.kind === 'go' || Bh.kind === 'drift' || Bh.kind === 'dash' || Bh.kind === 'bump') {
          const acc = 650 * C.sp * Math.min(1, d / 140) * (Bh.kind === 'bump' ? 1.6 : 1);
          C.vx += dx / d * acc * dt; C.vy += dy / d * acc * dt;
          const damp = Math.pow(0.2, dt); C.vx *= damp; C.vy *= damp;
          C.turnT = clamp(C.vx / 300, -1, 1); C.pitchT = clamp(C.vy / 300, -1, 1);
          if (Bh.kind === 'drift') { if (d < 20) smallTarget(); if (Bh.t >= Bh.dur) pickBehavior(); }
          else if (Bh.kind === 'dash') { if (Bh.t >= Bh.dur || d < 25) calmAfter(); }
          else if (Bh.kind === 'bump') { if (Bh.t > 3) pickBehavior(); }
          else if (d < 25 || Bh.t > 8) pickBehavior();
        } else {
          // fermo (frena dolcemente) mentre guarda
          const damp = Math.pow(0.03, dt); C.vx *= damp; C.vy *= damp;
          if (Bh.kind === 'aim') {
            C.turnT = clamp(dx / 220, -0.95, 0.95); C.pitchT = clamp(dy / 220, -0.8, 0.8);
            if (Bh.t >= Bh.dur) { Bh.kind = 'go'; Bh.t = 0; }
          } else if (Bh.kind === 'look') {
            Bh.next -= dt;
            if (Bh.next <= 0) { C.turnT = rnd(-0.95, 0.95); C.pitchT = rnd(-0.6, 0.6); Bh.next = rnd(0.5, 1.3); }
            if (Bh.t >= Bh.dur) pickBehavior();
          } else if (Bh.kind === 'behind') {
            C.turnT = Bh.dir * 3.3; C.pitchT = 0;
            if (Bh.t >= Bh.dur) pickBehavior();
          } else {
            // guarda verso di te
            C.turnT = 0; C.pitchT = 0;
            if (Bh.t >= Bh.dur) pickBehavior();
          }
        }
        // fuori dagli urti voluti non resta mai addosso alle pareti: viene spinto dolcemente verso l'interno
        if (Bh.kind !== 'bump' && Bh.kind !== 'ouch') {
          const rc = rangeAt(C.z, true);
          if (C.x < rc.x0) C.vx += (rc.x0 - C.x) * 10 * dt; else if (C.x > rc.x1) C.vx -= (C.x - rc.x1) * 10 * dt;
          if (C.y < rc.y0) C.vy += (rc.y0 - C.y) * 10 * dt; else if (C.y > rc.y1) C.vy -= (C.y - rc.y1) * 10 * dt;
        }
        C.x += C.vx * dt; C.y += C.vy * dt;
        // movimento in profondita' verso C.tz, morbido
        C.vz += clamp((C.tz - C.z) * 2.2, -320, 320) * dt;
        C.vz *= Math.pow(0.25, dt);
        C.z += C.vz * dt;
        const hitWall = box();
        if (Bh.kind === 'bump' && hitWall && hitWall !== 'bottom') enterOuch();
      } else if (S.mode === 'crucio') {
        C.vx = 0; C.vy = 0;
        const t = S.t, ax = 1.3 + 2.5 * t, ay = 0.65 + 1.25 * t;
        const rgc = rangeAt(C.z);
        C.x = clamp(C.x + rnd(-ax, ax) * f60, rgc.x0, rgc.x1);
        C.y = clamp(C.y + rnd(-ay, ay) * f60, rgc.y0, rgc.y1);
        S.tint = Math.min(1, t / 5); S.squint = Math.pow(Math.min(1, t / 5), 1.3); // si chiudono piano piano fino al secondo 5
        S.pulse = 1 + 0.06 * Math.sin(60 * t);
        if (t >= 5) enterExplode();
      } else if (S.mode === 'stop') {
        C.vx = 0; C.vy = 0;
        const k = Math.max(0, 1 - S.t / 2);
        S.tint = S.tint0 * k; S.squint = S.sq0 * k;
        if (S.blinks === 0 && S.t >= 0.6) { S.blinkT = BL; S.blinks = 1; }
        else if (S.blinks === 1 && S.t >= 1.3) { S.blinkT = BL; S.blinks = 2; }
        if (S.t >= 2) { S.mode = 'normal'; S.t = 0; S.tint = 0; S.squint = 0; pickBehavior(); }
      } else if (S.mode === 'ciao') {
        // saluto: occhi sorridenti, ondeggia per 3 secondi attorno al punto di partenza
        const t = S.t;
        const env = Math.sin(Math.min(1, t / 0.55) * Math.PI / 2);
        const fade = clamp(1 - Math.max(0, t - 2.35) / 0.65, 0, 1);
        const nx = S.bx + Math.sin(t * Math.PI * 1.65) * 36 * env * fade;
        const ny = S.by + Math.sin(t * Math.PI * 3.3) * 4 * env * fade;
        C.vx = dt > 0 ? (nx - C.x) / dt : 0; C.vy = dt > 0 ? (ny - C.y) / dt : 0;
        C.x = nx; C.y = ny;
        if (t >= 3) { S.mode = 'normal'; S.t = 0; S.smile = false; C.x = S.bx; C.y = S.by; C.vx = 0; C.vy = 0; pickBehavior(); }
      } else if (S.mode === 'explode') {
        if (S.t >= 2) { S.mode = 'dead'; S.t = 0; exp = []; }
      } else if (S.mode === 'dead') {
        if (S.t >= 5) {
          S.mode = 'match'; S.t = 0; S.alpha = 0; S.tint = 0; S.squint = 0;
          C.x = VX; C.y = 220; C.vx = 0; C.vy = 0; C.turn = 0; C.pitch = 0; C.z = 150; C.vz = 0; C.tz = 150;
          trail = []; spine = []; tongues = []; sparks = [];
        }
      } else if (S.mode === 'match') {
        const t = S.t;
        if (t < 1) { const n = Math.floor(t * 6) + 1; for (let i = 0; i < n; i++) sparks.push(spark(true)); }
        else if (t < 4 && Math.random() < 0.25) sparks.push(spark(false));
        S.alpha = t < 1 ? 0 : Math.min(1, (t - 1) / 3);
        if (t >= 4) {
          S.mode = 'normal'; S.t = 0; S.alpha = 1; S.tint = 0; S.squint = 0;
          trail = []; tongues = []; sparks = []; S.blinkT = 0; S.blinkIn = rnd(2, 5);
          Bh.kind = 'face'; Bh.t = 0; Bh.dur = rnd(1.2, 2.5);
        }
      }

      // testa: turn e pitch
      if (S.mode !== 'normal') { C.turnT = 0; C.pitchT = 0; C.shx = 0; C.shy = 0; }
      const k5 = Math.min(1, dt * 5);
      C.turn = lerp(C.turn, C.turnT, k5);
      C.pitch = lerp(C.pitch, C.pitchT, k5);

      // battito di ciglia
      // ogni 1.5-4 s, a volte doppio (secondo battito subito dopo)
      if (S.blinkT > 0) { S.blinkT = Math.max(0, S.blinkT - dt); }
      else if (!S.smile) { S.blinkIn -= dt; if (S.blinkIn <= 0) { S.blinkT = BL; S.blinkIn = Math.random() < 0.3 ? 0.12 : rnd(1.5, 4); } }

      // scia, spina, lingue
      if (bodyVisible()) {
        // la scia sale ma si ferma contro le pareti e il soffitto della scatola
        for (const p of trail) {
          p.age += dt; p.y -= 150 * dt; p.x += (n1(p.seed + time * 2) - 0.5) * 60 * dt;
          if (p.y < WT) { p.y = WT; p.x += (p.x >= C.x ? 1 : -1) * 90 * dt; } p.x = clamp(p.x, WL, WR);
        }
        while (trail.length > 2 && trail[trail.length - 1].age > 0.5) trail.pop();
        trail.unshift({ x: C.x, y: C.y, age: 0, seed: Math.random() * 100 });
        spine = computeSpine();
        tongueIn -= dt;
        if (tongueIn <= 0 && spine.length) {
          const tip = spine[Math.round((spine.length - 1) * 0.8)];
          tongues.push({ x: tip.x, y: tip.y, vx: -C.vx * 0.15 + (Math.random() - 0.5) * 30, vy: -C.vy * 0.15 - 50, age: 0, life: rnd(0.45, 0.85), r: R * rnd(0.22, 0.36), seed: Math.random() * 100 });
          tongueIn = rnd(0.25, 0.75) / (1 + S.tint);
        }
      }
      let n = 0;
      for (const g of tongues) {
        g.age += dt; if (g.age >= g.life) continue;
        g.vy -= 80 * dt; g.vx += (n1(g.seed + time * 4) - 0.5) * 120 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt;
        tongues[n++] = g;
      }
      tongues.length = n;

      // fiamme blu degli occhi: stesso meccanismo del corpo (scia che sale -> spina -> strati)
      const er0 = 0.25 * R;
      for (let k = 0; k < 2; k++) {
        const arr = eyeTongues[k], tr = eyeTrail[k];
        if (!bodyVisible()) { arr.length = 0; tr.length = 0; eyeSpine[k] = []; continue; }
        const Lg = (k ? 0.46 : -0.46) + C.turn * 0.95, B = 0.06 - C.pitch * 0.4, Rs = 0.86 * R * S.pulse;
        const ex = C.x + Rs * Math.sin(Lg) * Math.cos(B), ey = C.y - Rs * Math.sin(B);
        for (const p of tr) {
          p.age += dt; p.y -= 110 * dt; p.x += (n1(p.seed + time * 2) - 0.5) * 40 * dt;
          if (p.y < WT) { p.y = WT; p.x += (p.x >= C.x ? 1 : -1) * 90 * dt; } p.x = clamp(p.x, WL, WR);
        }
        while (tr.length > 2 && tr[tr.length - 1].age > 0.45) tr.pop();
        tr.unshift({ x: ex, y: ey, age: 0, seed: Math.random() * 100 });
        const eLen = er0 * 3.4 * (1 + 0.35 * S.tint) * (1 + Math.hypot(C.vx, C.vy) * 0.001);
        eyeSpine[k] = spineFrom(tr, eLen, 20);
        eyeTIn[k] -= dt;
        if (eyeTIn[k] <= 0 && eyeSpine[k].length) {
          const tip = eyeSpine[k][Math.round((eyeSpine[k].length - 1) * 0.8)];
          arr.push({ x: tip.x, y: tip.y, vx: -C.vx * 0.15 + (Math.random() - 0.5) * 20, vy: -C.vy * 0.15 - 40, age: 0, life: rnd(0.35, 0.65), r: er0 * rnd(0.3, 0.45), seed: Math.random() * 100 });
          eyeTIn[k] = rnd(0.25, 0.6) / (1 + S.tint);
        }
        let m2 = 0;
        for (const g of arr) {
          g.age += dt; if (g.age >= g.life) continue;
          g.vy -= 60 * dt; g.vx += (n1(g.seed + time * 4) - 0.5) * 90 * dt;
          g.x += g.vx * dt; g.y += g.vy * dt;
          arr[m2++] = g;
        }
        arr.length = m2;
      }

      // particelle
      n = 0;
      for (const p of exp) {
        p.life -= dt; if (p.life <= 0) continue;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const dm = Math.pow(0.88, f60); p.vx *= dm; p.vy *= dm;
        // rimbalza sulle pareti tenendo conto del suo alone
        const vr = Math.min(LH / 2, p.r * (p.life / p.max) * 2.45);
        if (p.x < vr) { p.x = vr; p.vx = Math.abs(p.vx); } else if (p.x > LW - vr) { p.x = LW - vr; p.vx = -Math.abs(p.vx); }
        if (p.y < vr) { p.y = vr; p.vy = Math.abs(p.vy); } else if (p.y > LH - vr) { p.y = LH - vr; p.vy = -Math.abs(p.vy); }
        exp[n++] = p;
      }
      exp.length = n;
      n = 0;
      for (const p of sparks) {
        p.life -= dt; if (p.life <= 0) continue;
        p.vy += 2.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        sparks[n++] = p;
      }
      sparks.length = n;
    };

    // ---- corpi alternativi: fiamme di luce piu' realistiche
    let fire = [], fireAcc = 0, plasmaBuf = null, plasmaImg = null;
    const PW = 84, PH = 136;
    const hsh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
    const vn = (x, y) => {
      const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      const a = hsh(i, j), b = hsh(i + 1, j), c = hsh(i, j + 1), d = hsh(i + 1, j + 1);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    };
    const fbm2 = (x, y) => { let v = 0, a = 0.5; for (let o = 0; o < 4; o++) { v += a * vn(x, y); x = x * 2.03 + 1.7; y = y * 2.03 + 9.2; a *= 0.5; } return v; };
    const smoothst = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const mix3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const drawAltBody = (kind, Reff, A, cO, cM, cC) => {
      const RB = Reff * BODY, dts = S.dt || 0.016;
      const blurPx = (px) => 'blur(' + Math.max(0.5, px * view.s * scaleAt(C.z)).toFixed(1) + 'px)';
      ctx.globalCompositeOperation = 'lighter';
      if (kind === 'plasma') {
        // fiamma "di plasma" che segue la scia: si costruisce lungo il percorso appena fatto,
        // quindi negli spostamenti resta indietro, si curva e sfuma come fumo trascinato
        const sp = [];
        for (let i = 0; i < spine.length; i += 2) sp.push(spine[i]);
        if (spine.length && sp[sp.length - 1] !== spine[spine.length - 1]) sp.push(spine[spine.length - 1]);
        if (sp.length < 2) return;
        const ns = sp.length - 1, sx0 = [], sy0 = [], sdx = [], sdy = [], sl2 = [], scum = [];
        let Ltot = 0;
        for (let i = 0; i < ns; i++) {
          const ddx = sp[i + 1].x - sp[i].x, ddy = sp[i + 1].y - sp[i].y;
          sx0.push(sp[i].x); sy0.push(sp[i].y); sdx.push(ddx); sdy.push(ddy);
          sl2.push(Math.max(1e-6, ddx * ddx + ddy * ddy)); scum.push(Ltot); Ltot += Math.sqrt(ddx * ddx + ddy * ddy);
        }
        Ltot = Math.max(Ltot, 1);
        // zona da calcolare: attorno alla scia, sempre dentro le pareti
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
        for (const p of sp) { bx0 = Math.min(bx0, p.x); by0 = Math.min(by0, p.y); bx1 = Math.max(bx1, p.x); by1 = Math.max(by1, p.y); }
        const pad = RB * 2.2;
        bx0 = Math.max(SQZ.l, bx0 - pad); bx1 = Math.min(SQZ.r, bx1 + pad); by0 = Math.max(SQZ.t, by0 - pad); by1 = Math.min(SQZ.b, by1 + pad);
        const bw = Math.max(8, bx1 - bx0), bh = Math.max(8, by1 - by0);
        const PWd = Math.max(16, Math.round(Math.sqrt(11000 * bw / bh))), PHd = Math.max(16, Math.round(11000 / PWd));
        if (!plasmaBuf || plasmaBuf.width !== PWd || plasmaBuf.height !== PHd) {
          plasmaBuf = document.createElement('canvas'); plasmaBuf.width = PWd; plasmaBuf.height = PHd;
          plasmaImg = plasmaBuf.getContext('2d').createImageData(PWd, PHd);
        }
        const data = plasmaImg.data, t = time, spd = 1 + 0.8 * S.tint;
        let k = 0;
        for (let j = 0; j < PHd; j++) {
          // il punto mostrato e' gia' compresso contro le pareti: risalgo al punto "vero"
          const wy = unsqy(by0 + (j + 0.5) / PHd * bh);
          for (let i = 0; i < PWd; i++) {
            const wx = unsqx(bx0 + (i + 0.5) / PWd * bw);
            let best = 1e18, bs = 0, side = 1, behind = false;
            for (let q = 0; q < ns; q++) {
              const raw = ((wx - sx0[q]) * sdx[q] + (wy - sy0[q]) * sdy[q]) / sl2[q];
              const u = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
              const ex = sx0[q] + sdx[q] * u - wx, ey = sy0[q] + sdy[q] * u - wy, d2 = ex * ex + ey * ey;
              if (d2 < best) {
                best = d2; bs = scum[q] + u * Math.sqrt(sl2[q]);
                side = sdx[q] * (wy - sy0[q]) - sdy[q] * (wx - sx0[q]) > 0 ? 1 : -1;
                behind = q === 0 && raw < 0;
              }
            }
            const s = bs / Ltot, dist = Math.sqrt(best), lat = dist * side;
            const rise = smoothst(0, 0.45, s), along = bs / RB;
            const n1v = fbm2(lat / RB * 2.2, along * 1.6 - t * 2.2 * spd);
            const n2v = fbm2(lat / RB * 4.5 + 7, along * 3.2 - t * 3.6 * spd);
            const prof = Math.pow(1 - s, 1.1) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, s / 0.3)));
            const w = RB * 1.25 * prof + 1;
            let d = behind ? dist / (RB * 1.25) : Math.abs(lat + (n2v - 0.5) * 0.7 * RB * rise) / w;
            d += (n1v - 0.5) * 1.1 * rise + (n2v - 0.5) * 0.3 + smoothst(0.8, 1, s) * 0.5;
            const I = clamp(1 - d, 0, 1);
            let c = mix3(cO, cM, smoothst(0.25, 0.65, I));
            c = mix3(c, cC, smoothst(0.62, 1, I));
            data[k++] = c[0]; data[k++] = c[1]; data[k++] = c[2];
            data[k++] = 255 * smoothst(0, 0.4, I) * 0.9;
          }
        }
        plasmaBuf.getContext('2d').putImageData(plasmaImg, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.globalAlpha = A;
        ctx.filter = blurPx(bw / PWd * 0.9);
        ctx.drawImage(plasmaBuf, bx0, by0, bw, bh);
        ctx.filter = 'none';
      } else if (kind === 'scintille') {
        // fiamma "viva": centinaia di piccole fiammelle che nascono dal corpo, salgono, si torcono e svaniscono
        if (S.alpha > 0.05) {
          fireAcc += dts * 560 * (1 + S.tint); // piu' fiammelle, in proporzione alla creatura ingrandita
          while (fireAcc >= 1) {
            fireAcc -= 1;
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * RB * 0.75;
            fire.push({ x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr * 0.7, vx: -C.vx * 0.25 + (Math.random() - 0.5) * 20, vy: -C.vy * 0.2 - rnd(30, 70), age: 0, life: rnd(0.55, 1.15), r: RB * rnd(0.34, 0.54), seed: Math.random() * 100 });
          }
        }
        let n = 0;
        for (const p of fire) {
          p.age += dts; if (p.age >= p.life) continue;
          p.vy -= 260 * dts * (1 + 0.4 * S.tint);
          p.vx += (n1(p.seed + time * 3 + p.y * 0.01) - 0.5) * 240 * dts;
          p.vx *= Math.pow(0.3, dts);
          p.x += p.vx * dts; p.y += p.vy * dts;
          const pr = p.r * 0.5;
          if (p.x < SQZ.l + pr) { p.x = SQZ.l + pr; p.vx = Math.abs(p.vx) * 0.15; p.vy += (Math.random() - 0.5) * 60; }
          else if (p.x > SQZ.r - pr) { p.x = SQZ.r - pr; p.vx = -Math.abs(p.vx) * 0.15; p.vy += (Math.random() - 0.5) * 60; }
          if (p.y < SQZ.t + pr) { p.y = SQZ.t + pr; p.vy = Math.abs(p.vy) * 0.1; p.vx += (p.x >= C.x ? 1 : -1) * rnd(40, 120); p.r *= 1.01; }
          fire[n++] = p;
        }
        fire.length = n;
        // velo sottile che segue la forma (niente cerchi)
        const m = spine.length;
        for (let i = 0; i < m; i++) {
          const sv = i / (m - 1), p = spine[i];
          blob(cO, p.x, p.y, RB * 2.0 * Math.pow(1 - sv, 1.1) + 2, 0.07 * A);
        }
        for (const p of fire) {
          const s = p.age / p.life;
          const r = p.r * (1 - s * 0.85);
          // passaggio graduale: azzurro chiaro -> azzurro -> blu, con sfumature morbide
          const cAz = mix3(cM, cO, 0.35);
          const c = s < 0.2 ? mix3(cC, cM, 0.8 + 0.2 * smoothst(0, 0.2, s))
            : s < 0.55 ? mix3(cM, cAz, smoothst(0.2, 0.55, s))
            : mix3(cAz, cO, smoothst(0.55, 1, s));
          const a = smoothst(0, 0.3, s) * Math.pow(1 - s, 1.1) * 0.31 * A; // nascono tenui: niente accumulo bianco al centro
          blob(q8(c), p.x, p.y, r, a);
        }
      } else if (kind === 'candela') {
        // fiamma "a candela": forma liscia e continua, bordo sfumato, cuore luminoso, ondeggia piano
        const N = spine.length;
        if (N < 2) return;
        const shape = (mul) => {
          const L = [], Rr = [];
          for (let i = 0; i < N; i++) {
            const s = i / (N - 1), p = spine[i];
            const prof = Math.pow(1 - s, 0.9) * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, s / 0.25)));
            const fl = 1 + 0.12 * (n1(time * 6 + i * 0.5) - 0.5) * s * (1 + 2 * S.tint);
            const w = RB * 1.05 * prof * fl * mul;
            const sw = (n1(time * 3 + i * 0.3) - 0.5) * RB * 0.35 * s * s;
            L.push([sqx(p.x + p.nx * (w + sw)), sqy(p.y + p.ny * (w + sw))]);
            Rr.push([sqx(p.x - p.nx * (w - sw)), sqy(p.y - p.ny * (w - sw))]);
          }
          const p0 = spine[0], tx = p0.ny, ty = -p0.nx, w0 = RB * 1.05 * mul;
          ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
          for (const q of L) ctx.lineTo(q[0], q[1]);
          for (let i = N - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
          // base arrotondata
          for (let a = 0; a <= 12; a++) {
            const an = Math.PI * a / 12, cx = -p0.nx * Math.cos(an) - tx * Math.sin(an), cy = -p0.ny * Math.cos(an) - ty * Math.sin(an);
            ctx.lineTo(sqx(p0.x + cx * w0), sqy(p0.y + cy * w0));
          }
          ctx.closePath(); ctx.fill();
        };
        for (const st of [[1.5, cO, 0.32, 0.38], [1.0, cM, 0.45, 0.2], [0.55, cC, 0.7, 0.12]]) {
          ctx.filter = blurPx(RB * st[3]);
          ctx.globalAlpha = st[2] * A; ctx.fillStyle = rgb(st[1]);
          shape(st[0]);
        }
        ctx.filter = 'none';
      }
      ctx.globalCompositeOperation = 'lighter';
    };

    // ---- draw(): disegno
    const draw = () => {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // 1.5: fluido anche sui telefoni
      const rect = cv.getBoundingClientRect();
      const cssW = Math.max(cv.clientWidth, rect.width), cssH = Math.max(cv.clientHeight, rect.height);
      if (!cssW || !cssH) return;
      const cw = Math.round(Math.min(3000, cssW * dpr)), ch = Math.round(Math.min(3000, cssH * dpr));
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      // scena larga quanto lo schermo, alta sempre 440: stessa scala in x e y
      const nLW = Math.max(LH, LH * cw / ch);
      if (Math.abs(nLW - LW) > 0.5) {
        const sh = (nLW - LW) / 2;
        LW = nLW; VX = LW / 2;
        C.x += sh; C.tx += sh;
        for (const p of trail) p.x += sh;
        for (const p of fire) p.x += sh;
        for (const p of tongues) p.x += sh;
        for (const tr of eyeTrail) for (const p of tr) p.x += sh;
        for (const tr of eyeTongues) for (const p of tr) p.x += sh;
      }
      const s = Math.min(cw / LW, ch / LH);
      view.s = s; view.ox = (cw - LW * s) / 2; view.oy = (ch - LH * s) / 2;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(s, 0, 0, s, view.ox, view.oy);
      // rete di sicurezza: niente viene disegnato fuori dalla scatola
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
      // prospettiva: piu' e' lontana, piu' e' piccola e vicina al centro della scena
      const dS = scaleAt(C.z);
      ctx.translate(VX, VY); ctx.scale(dS, dS); ctx.translate(-VX, -VY);
      // scrollata dopo un urto
      ctx.translate(C.shx || 0, C.shy || 0);
      SQZ.l = VX - VX / dS; SQZ.r = VX + VX / dS; SQZ.t = VY - VY / dS; SQZ.b = VY + VY / dS; SQZ.zone = 0.5 * R;
      // ---- ectoplasma: sembra luce ma e' solido
      // contro una parete si schiaccia (piu' corto verso il muro, piu' largo nell'altro verso),
      // staccandosi rimbalza tremolando; negli scatti si allunga un po' nella direzione del moto
      if (bodyVisible()) {
        const dtj = S.dt || 0.016, Wb = R * BODY;
        const tgx = clamp(Math.min(C.x - SQZ.l, SQZ.r - C.x) / Wb, 0.55, 1);
        const tgy = clamp((C.y - SQZ.t) / (Wb * 0.9), 0.55, 1);
        JL.vx += ((tgx - JL.sx) * 180 - JL.vx * 9) * dtj; JL.sx += JL.vx * dtj;
        JL.vy += ((tgy - JL.sy) * 180 - JL.vy * 9) * dtj; JL.sy += JL.vy * dtj;
        const qx = clamp(JL.sx, 0.45, 1.15), qy = clamp(JL.sy, 0.45, 1.15);
        ctx.translate(C.x, C.y);
        ctx.scale(qx * (1 + (1 - qy) * 0.6), qy * (1 + (1 - qx) * 0.6));
        const spd = Math.hypot(C.vx, C.vy);
        if (spd > 20) {
          const st = Math.min(0.16, spd / 2600), an = Math.atan2(C.vy, C.vx);
          ctx.rotate(an); ctx.scale(1 + st, 1 / (1 + st)); ctx.rotate(-an);
        }
        ctx.translate(-C.x, -C.y);
      } else { JL.sx = 1; JL.vx = 0; JL.sy = 1; JL.vy = 0; }
      ctx.globalCompositeOperation = 'lighter';

      const A = S.alpha * (1 - 0.3 * (C.z / DEPTH)), tint = S.tint; // da lontano un po' piu' tenue
      // tipo di corpo: strati (attuale) | plasma | scintille | candela
      const CORPO = (self.props && self.props.corpo) || 'scintille';
      if (bodyVisible() && A > 0.005 && spine.length) {
        const Reff = R * S.pulse;
        // corpo a strati
        const flAmp = 0.4 * (1 + 1.5 * tint);
        // proposta occhi scelta: attuale | maschera | lanterna | nucleo | cartoon
        const OV = (self.props && self.props.occhi) || 'ombra';
        const ES = { attuale: 1, maschera: 1.1, lanterna: 1.35, nucleo: 1.15, cartoon: 1.12, anello: 1.1, sfera: 1.2, ombra: 1.12, mix: 1.15 }[OV] || 1;
        const NUC = OV === 'nucleo' || OV === 'mix';
        // primo strato: bagliore largo e tenue che segue la forma della fiamma (sostituisce l'alone tondo)
        const layers = [['outer', 2.7, 1.0, 0.045, 19], ['outer', 1.9, 1.0, 0.16, 1], ['mid', 1.25, 0.72, 0.22, 7], ['core', 0.75, 0.38, 0.24, 13]];
        for (const Ly of (CORPO === 'strati' ? layers : CORPO === 'scintille' ? layers.slice(1) : [])) {
          const c = col(Ly[0], tint);
          const m = Math.max(2, Math.round(spine.length * Ly[2]));
          for (let i = 0; i < m; i++) {
            const p = spine[i], sv = i / (m - 1);
            // proposta "nucleo": la parte piu' chiara del corpo sale sopra gli occhi
            if (NUC && Ly[0] === 'core' && sv < 0.35) continue;
            const headDim = (NUC && Ly[0] === 'mid') ? 0.45 + 0.55 * Math.min(1, sv / 0.3) : 1;
            const prof = Math.pow(1 - sv, 1.1) * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, sv / 0.3)));
            const fl = 1 + flAmp * (n1(time * 8 + i * 0.7 + Ly[4]) - 0.5) * sv;
            const wob = (n1(time * 5 + i * 0.35 + Ly[4] * 2) - 0.5) * Reff * 0.9 * sv * sv;
            const rad = Reff * BODY * Ly[1] * prof * fl * (CORPO === 'scintille' ? 0.8 : 1) + 2;
            blob(c, p.x + p.nx * wob, p.y + p.ny * wob, rad, Ly[3] * (0.55 + 0.45 * (1 - sv)) * headDim * A);
          }
        }
        // lingue
        const cO = col('outer', tint), cM = col('mid', tint), cC = col('core', tint);
        for (const g of (CORPO === 'strati' ? tongues : [])) {
          const sv = g.age / g.life;
          const a = Math.sin(Math.PI * Math.min(1, sv * 1.4)) * (1 - sv) * A;
          const r = g.r * (1 - sv * 0.5);
          blob(cO, g.x, g.y + r * 0.4, r * 2.2, 0.3 * a);
          blob(cM, g.x, g.y, r * 1.3, 0.55 * a);
          blob(cM, g.x, g.y - r * 0.6, r, 0.4 * a);
          blob(cC, g.x, g.y + r * 0.2, r * 0.6, 0.5 * a);
        }
        // riflesso di luce
        const lon = -0.55 + C.turn * 0.9, lat = 0.45 - C.pitch * 0.35;
        if (!NUC) if (CORPO === 'strati') blob(cC, C.x + 0.9 * Reff * Math.sin(lon) * Math.cos(lat), C.y - 0.9 * Reff * Math.sin(lat), 0.55 * Reff, 0.22 * A);

        if (CORPO !== 'strati') drawAltBody(CORPO, Reff, A, cO, cM, cC);

        // occhi 3D
        const Rs = 0.86 * Reff, er = 0.25 * Reff * ES;
        er0e = er;
        const ap = S.blinkT > 0 ? Math.abs(Math.cos(Math.PI * (1 - S.blinkT / BL))) : 1;
        // durante il battito si spegne anche l'alone: la chiusura si vede bene
        const apH = 0.25 + 0.75 * ap;
        const eyes = [];
        [-0.46, 0.46].forEach((lon0, idx) => {
          const Lg = lon0 + C.turn * 0.95, B = -0.05 - C.pitch * 0.4; // occhi un po' piu' in basso
          eyes.push({ idx: idx, x: C.x + Rs * Math.sin(Lg) * Math.cos(B), y: C.y - Rs * Math.sin(B), z: Math.cos(Lg) * Math.cos(B), L: Lg, B: B });
        });
        eyes.sort((a, b) => a.z - b.z);
        const dkc = col('dark', tint), ec = rgb(col('eye', tint));
        // strati della fiamma NERA: [colore, k, frazione, alpha, seed] come il corpo
        // piu' larga e tonda attorno all'occhio, poco a punta
        // colori BLU della fiammella degli occhi (con il crucio virano al rosso scuro)
        const tk = Math.round(tint * 10) / 10;
        const mixC = (a, b) => [a[0] + (b[0] - a[0]) * tk, a[1] + (b[1] - a[1]) * tk, a[2] + (b[2] - a[2]) * tk];
        const bOut = mixC([25, 75, 215], [170, 30, 10]), bMid = mixC([15, 60, 200], [140, 22, 6]), bCore = mixC([8, 35, 150], [95, 12, 2]);
        const blk = [[bOut, 2.1, 1.0, 0.3, 3], [bMid, 1.6, 0.8, 0.45, 9], [bCore, 1.15, 0.6, 0.7, 15]];
        const EN = 12, Lf = er * 1.7 * (1 + 0.35 * tint), lean = -C.vx * 0.0008;

        // proposta "maschera": una zona scura e morbida dietro tutti e due gli occhi, come un viso in ombra
        if (OV === 'maschera' || OV === 'mix' || OV === 'sfera') {
          const vs = eyes.filter((e) => e.z > 0.02);
          if (vs.length) {
            const mx = vs.reduce((s, e) => s + e.x, 0) / vs.length, my = vs.reduce((s, e) => s + e.y, 0) / vs.length;
            const mk = mixC([3, 8, 34], [40, 6, 0]);
            ctx.globalCompositeOperation = 'source-over';
            blob(mk, mx, my, er * 4.6, 0.5 * A);
            for (const e of vs) eblob(mk, e, 0, 0, er * 2.7, 0.65 * A);
          }
        }

        // 1) aloni dietro agli occhi
        for (const e of eyes) {
          if (e.z <= 0.02) continue;
          e.vis = Math.min(1, (e.z - 0.02) / 0.25);
          e.rw = Math.max(0.3, er * Math.cos(e.L) / Math.cos(0.46));
          // chiusi non spariscono: restano una linea spessa
          e.rh = Math.max(er * 0.2, er * Math.cos(e.B) / Math.cos(0.06) * ap * (1 - S.squint));
          ctx.globalCompositeOperation = 'lighter';
          eblob(cM, e, 0, 0, 0.4 * Reff, 0.45 * e.vis * A);
          ctx.globalCompositeOperation = 'source-over';
          const sd = e.idx * 31.7;
          // alone blu mobile e molto sfumato dietro l'occhio (nessuna punta):
          // tante macchie larghe e tenui che si spostano piano, respirano e cambiano forma
          ctx.globalCompositeOperation = 'source-over';
          if (OV === 'anello') {
            // proposta "anello": disco blu notte dietro l'occhio, crea lo stacco tra bianco e anello luminoso
            eblob(mixC([4, 12, 50], [50, 6, 0]), e, 0, 0, er * 2.2, 0.85 * e.vis * A);
            continue;
          }
          if (OV === 'maschera' || OV === 'cartoon' || OV === 'mix' || OV === 'sfera') continue;
          const hk = OV === 'lanterna' ? 1.6 : 1;
          eblob(bOut, e, 0, 0, er * 3.3, 0.14 * hk * e.vis * A);
          for (let j = 0; j < 7; j++) {
            const ox = (n1(time * 0.9 + j * 3.1 + sd) - 0.5) * er * 0.9;
            const oy = (n1(time * 0.8 + j * 5.7 + sd + 40) - 0.5) * er * 0.7;
            const rr = er * (2.1 + 0.7 * n1(time * 1.3 + j * 2.3 + sd)) * (1 + 0.15 * tint);
            eblob(j % 2 ? bMid : bCore, e, ox, oy, rr, 0.13 * hk * e.vis * A);
          }
          ctx.globalCompositeOperation = 'source-over';
        }
        // 2) cerchi bianchi sopra, dopo tutte e due le fiamme
        const ecol = col('eye', tint);
        for (const e of eyes) {
          if (e.z <= 0.02) continue;
          const eb = er; // la forma ovale la da' eblob
          const va = e.vis * A;
          // il bianco: cerchio (tagliato dalla palpebra) oppure mezzaluna sorridente nel saluto
          // occhio felice "a ciglio": pennellata ad arco, esterno corto e arrotondato,
          // coda interna lunga che scende verso il centro del viso e si assottiglia
          const smilePts = () => {
            const d = e.x < C.x ? 1 : -1, kx = Math.max(0.35, e.rw / er);
            const P = [[-1.15, 0.25], [-0.55, -0.62], [0.55, -0.62], [1.0, 0.45]];
            const out = [];
            for (let i = 0; i <= 24; i++) {
              const t = i / 24, u = 1 - t;
              const bx = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0];
              const by = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1];
              const w = er * 0.34 * (0.6 + 0.4 * Math.sin(Math.PI * t * 0.9)) * (1 - 0.9 * t * t * t);
              out.push({ x: e.x + bx * er * d * kx, y: e.y + by * er, w: w });
            }
            return out;
          };
          // riempie la pennellata con spessore variabile (mul = quanto piu' larga)
          const fillStroke = (pts, mul) => {
            const L = [], Rr = [];
            for (let i = 0; i < pts.length; i++) {
              const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
              let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
              const hw = pts[i].w * mul / 2;
              L.push([pts[i].x - ty * hw, pts[i].y + tx * hw]); Rr.push([pts[i].x + ty * hw, pts[i].y - tx * hw]);
            }
            ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
            for (const q of L) ctx.lineTo(q[0], q[1]);
            for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
            ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, pts[0].w * mul / 2, 0, Math.PI * 2); ctx.fill();
          };
          // occhio "di luce": niente bordo netto, sfuma verso l'esterno, ha volume e vibra appena
          const drawWhite = (edge) => {
            const ce = col('eye', tint);
            const ed = Array.isArray(edge) ? edge : mixC([200, 235, 255], [255, 220, 190]);
            const c3 = (c) => Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
            const sh = 1 + 0.035 * Math.sin(time * 7.3 + e.idx * 2.1);
            ctx.globalCompositeOperation = 'source-over';
            if (S.smile) {
              // occhi felici a ciglio, con i bordi sfumati
              const sp = smilePts();
              for (const st of [[2.2, 0.14, ed], [1.5, 0.4, ed], [1, 1, [255, 255, 255]]]) {
                ctx.globalAlpha = va * st[1]; ctx.fillStyle = 'rgb(' + c3(st[2]) + ')';
                fillStroke(sp, st[0] * sh);
              }
              return;
            }
            const kx = Math.max(0.05, e.rw / er) * sh, ky = Math.max(0.03, e.rh / er) * (2 - sh);
            const R1 = er * 1.12;
            ctx.save();
            ctx.translate(e.x, e.y); ctx.scale(kx, ky);
            const g = ctx.createRadialGradient(0, -er * 0.22, 0, 0, 0, R1);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.5, 'rgba(' + c3(ce) + ',1)');
            g.addColorStop(0.78, 'rgba(' + c3(ed) + ',0.97)');
            g.addColorStop(0.9, 'rgba(' + c3(ed) + ',0.45)');
            g.addColorStop(1, 'rgba(' + c3(ed) + ',0)');
            ctx.globalAlpha = va; ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, R1, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          };
          if (S.smile) {
            // nel saluto anche l'alone prende la forma dell'arco: fondo scuro e bagliore lungo la mezzaluna
            const pts = smilePts().filter((p, i) => i % 2 === 0).map((p) => [p.x, p.y]);
            ctx.globalCompositeOperation = 'source-over';
            const back = mixC([4, 12, 50], [50, 6, 0]);
            for (const q of pts) blob(back, q[0], q[1], er * 0.85, 0.35 * va);
            ctx.globalCompositeOperation = 'lighter';
            for (const q of pts) blob(ecol, q[0], q[1], er * 0.6, 0.3 * va);
            drawWhite(ec);
          } else if (OV === 'cartoon') {
            // anello blu notte pieno e morbido attorno al bianco
            const rc = mixC([6, 18, 72], [60, 8, 0]);
            ctx.globalCompositeOperation = 'source-over';
            eblob(rc, e, 0, 0, eb * 2.0, 0.6 * va);
            if (!S.smile) { ctx.globalAlpha = va; ctx.fillStyle = rgb(rc); ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rw + er * 0.38, e.rh + er * 0.38 * ap, 0, 0, Math.PI * 2); ctx.fill(); }
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.2, 0.5 * apH * va);
            drawWhite(ec);
          } else if (OV === 'anello') {
            // anello sottile azzurro brillante, staccato dal bianco da una fascia scura
            const cy = mixC([110, 225, 255], [255, 150, 90]);
            ctx.globalCompositeOperation = 'lighter';
            eblob(cy, e, 0, 0, eb * 2.3, 0.45 * apH * va);
            if (!S.smile) {
              ctx.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = va; ctx.strokeStyle = rgb(cy); ctx.lineWidth = er * 0.16;
              ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rw + er * 0.5, e.rh + er * 0.5 * ap, 0, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.15, 0.6 * apH * va);
            drawWhite(ec);
          } else if (OV === 'sfera') {
            // sfera di luce: bianco pieno in alto, azzurro verso il bordo
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.9, 0.5 * apH * va);
            eblob(ecol, e, 0, 0, eb * 1.3, 0.7 * apH * va);
            drawWhite(mixC([120, 200, 255], [255, 160, 110]));
          } else if (OV === 'ombra') {
            // ombra scura sotto ogni occhio: lo fa "staccare" dalla fiamma
            ctx.globalCompositeOperation = 'source-over';
            eblob(mixC([2, 6, 26], [35, 5, 0]), e, 0, er * 0.55, er * 1.7, 0.8 * va);
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.6, 0.6 * apH * va);
            eblob(ecol, e, 0, 0, eb * 1.15, 0.9 * apH * va);
            drawWhite(ec);
          } else {
            // alone bianco; nella proposta "lanterna" e' piu' ampio e pulsa piano
            const pl = OV === 'lanterna' ? 0.85 + 0.15 * Math.sin(time * 2.2 + e.idx) : 1;
            const wide = OV === 'lanterna' ? 1.35 : 1;
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.9 * wide, 0.55 * pl * apH * va);
            eblob(ecol, e, 0, 0, eb * 1.4 * wide, 0.85 * pl * apH * va);
            eblob(ecol, e, 0, 0, eb * 1.15, 1.0 * apH * va);
            drawWhite(ec);
          }
        }
        ctx.globalCompositeOperation = 'lighter';
      }

      // esplosione e fiammifero
      for (const p of exp) {
        const r = p.life / p.max, a = 0.9 * r, rad = p.r * r;
        blob([255, 255, 255], p.x, p.y, rad * 2.45, a * 0.08);
        blob(q8(expColor(r)), p.x, p.y, rad * 1.28, a * 0.42);
      }
      for (const p of sparks) {
        const r = p.life / p.max, a = 0.8 * r, rad = p.r * r;
        blob([255, 255, 255], p.x, p.y, rad * 2.45, a * 0.08);
        blob(p.warm ? [255, 219, 150] : [0, 199, 255], p.x, p.y, rad * 1.28, a * 0.42);
      }
      ctx.restore();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };

    let last = performance.now();
    const loop = (now) => {
      if (!self._cv) { self._raf = null; return; }
      self._raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      step(dt);
      draw();
    };
    this._raf = requestAnimationFrame(loop);
  }
}

// ---- API usata dall'app (voce, telecomando, menu)
(function () {
  const wisp = new Component();
  window.Wisp = {
    start(canvas) { wisp._cv = canvas; wisp._audio(); wisp._run(); },
    unlockAudio() { wisp._audio(); },
    command(cmd) {
      wisp._audio();
      if (cmd === 'crucio') wisp._crucioCmd = true;
      else if (cmd === 'stop') wisp._stopCmd = true;
      else if (cmd === 'ciao') wisp._ciaoCmd = true;
    },
    // l'animazione la mette in pausa la WebView stessa; qui solo l'audio
    pause() { if (wisp._ac) { try { wisp._ac.suspend(); } catch (e) {} } },
    resume() { if (wisp._ac) { try { wisp._ac.resume(); } catch (e) {} } }
  };
})();
