// Pixie Wisp - motore della creatura (Canvas 2D), estratto dal mockup "CorpoScintille" (Claude Design).
// Generato da build_engine.py: non modificare a mano, si rigenera dal mockup.
// Logica in coordinate 760x440 (l'altezza resta 440, la larghezza segue lo schermo).
class DCLogic {
  constructor() {
    this.props = {"lunghezza": 2, "occhi": "maschera noBK", "saluta": false, "crucio": false, "finite": false, "incendio": false, "gelatina": false, "accio": false, "vieni": false, "mescola": "mercurio", "corpo": "scintille"};
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
      // rumori per gli incantesimi
      const noise = (dur, vol, att, lp, seed) => {
        const n = Math.floor(dur * rate), out = new Float32Array(n), r = seeded(seed || 77);
        let y = 0;
        for (let i = 0; i < n; i++) {
          const x = i / Math.max(1, n - 1), env = Math.min(1, x / att) * Math.pow(1 - x, 1.6);
          y += (r() * 2 - 1 - y) * lp;
          out[i] = y * vol * env;
        }
        return out;
      };
      const mixS = (...ts) => { const m = new Float32Array(Math.max(...ts.map((t) => t.length))); for (const t of ts) for (let i = 0; i < t.length; i++) m[i] += t[i]; return m; };
      Object.assign(this._bank, {
        ignite: toBuf(mixS(noise(0.32, 0.5, 0.02, 0.5, 5), tone(0.3, 320, 980, 0.12, 6, 0))),
        puff: toBuf(noise(0.55, 0.45, 0.05, 0.12, 9)),
        whoosh: toBuf(mixS(noise(0.32, 0.5, 0.7, 0.3, 11), tone(0.3, 300, 700, 0.05, 0, 0))),
        splat: toBuf(mixS(tone(0.24, 150, 55, 0.5, 4, 0.05), noise(0.2, 0.55, 0.02, 0.35, 13))),
        plop: toBuf(tone(0.2, 230, 560, 0.3, 18, 0)),
        blub: toBuf(tone(0.09, 280, 520, 0.22, 0, 0)),
        zap: toBuf(mixS(echo(tone(0.35, 1500, 300, 0.22, 25, 0.04), 0.03, 0.4, 2), noise(0.15, 0.3, 0.01, 0.6, 21))),
        purr: toBuf(mixS(tone(0.9, 135, 150, 0.22, 26, 0.03), tone(0.9, 270, 300, 0.06, 26, 0)))
      });
      // voce "alla Gizmo": sillabe acute con glissando e vibrato, ogni volta diverse
      const syl = (dur, f0, f1, vol, vib, br) => {
        const n = Math.floor(dur * rate), out = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
          const x = i / Math.max(1, n - 1), env = Math.min(1, x / 0.1) * Math.pow(1 - x, 0.7);
          const f = f0 * Math.pow(f1 / f0, x) * (1 + Math.sin(i / rate * Math.PI * 2 * 17) * vib);
          ph += Math.PI * 2 * f / rate;
          out[i] = (Math.sin(ph) + br * 0.35 * Math.sin(2 * ph) + br * 0.12 * Math.sin(3 * ph)) * vol * env;
        }
        return out;
      };
      const VOICE = {
        worry: { n: [2, 4], f: [950, 1400], up: 1.35, vol: 0.14, vib: 0.05, br: 0.4, d: [0.07, 0.13] },
        angry: { n: [3, 5], f: [430, 650], up: 0.72, vol: 0.16, vib: 0.03, br: 1, d: [0.08, 0.16] },
        whine: { n: [2, 3], f: [650, 880], up: 0.68, vol: 0.14, vib: 0.07, br: 0.5, d: [0.15, 0.26] },
        happy: { n: [2, 3], f: [1150, 1550], up: 1.25, vol: 0.09, vib: 0.04, br: 0.3, d: [0.05, 0.09] }
      };
      this._say = (mood) => {
        const P = VOICE[mood] || VOICE.happy, rr = Math.random;
        const n = P.n[0] + Math.floor(rr() * (P.n[1] - P.n[0] + 1)), parts = [];
        for (let k = 0; k < n; k++) {
          const f0 = P.f[0] + rr() * (P.f[1] - P.f[0]), up = k % 2 ? 1 / Math.sqrt(P.up) : P.up;
          parts.push(syl(P.d[0] + rr() * (P.d[1] - P.d[0]), f0, f0 * up, P.vol, P.vib, P.br));
          parts.push(new Float32Array(Math.floor(rate * (0.02 + rr() * 0.04))));
        }
        const tot = parts.reduce((a, b) => a + b.length, 0), out = new Float32Array(tot);
        let o = 0; for (const q of parts) { out.set(q, o); o += q.length; }
        try { const src = ac.createBufferSource(); src.buffer = toBuf(out); src.connect(ac.destination); src.start(); } catch (e) {}
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
    const DEPTH = LH * 1.5, FOC = 650, VY = LH / 2;
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
    const mix3e = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const PAL = {
      outer: [[18, 135, 225], [255, 40, 15]],
      mid: [[70, 222, 225], [255, 135, 35]],
      core: [[222, 255, 250], [255, 240, 200]],
      eye: [[240, 254, 255], [255, 238, 215]],
      dark: [[3, 10, 38], [45, 6, 0]]
    };
    // viola: quando viene colpito da "gelatina"
    const PURP = { outer: [125, 40, 255], mid: [185, 110, 255], core: [242, 218, 255], dark: [26, 4, 46] };
    // acquamarina: si mescola a strisce al colore di base
    const AQUA = { outer: [10, 150, 160], mid: [60, 225, 195], core: [205, 255, 238] };
    const col = (name, tint) => {
      const k = Math.round(clamp(tint, 0, 1) * 10) / 10, a = PAL[name][0], b = PAL[name][1];
      let c = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
      const pk = Math.round(clamp((typeof S !== 'undefined' && S.purp) || 0, 0, 1) * 10) / 10;
      if (pk > 0 && PURP[name]) c = c.map((v, i) => v + (PURP[name][i] - v) * pk);
      return c;
    };
    // tiffany: un terzo tono, a chiazze che si alternano con l'acquamarina
    const TIFF = { outer: [10, 186, 181], mid: [129, 216, 208], core: [218, 250, 246] };
    const tiffOf = (s) => s < 0.2 ? mix3e(TIFF.core, TIFF.mid, s / 0.2) : s < 0.6 ? mix3e(TIFF.mid, TIFF.outer, (s - 0.2) / 0.4) : TIFF.outer;
    const aquaOf = (s) => s < 0.2 ? mix3e(AQUA.core, AQUA.mid, s / 0.2) : s < 0.6 ? mix3e(AQUA.mid, AQUA.outer, (s - 0.2) / 0.4) : AQUA.outer;
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
      const bwA = Math.abs(S.brow || 0);
      const x = sqx(e.x + dx * kx), y = sqy(e.y + dy * ky + er0e * 0.22 * bwA);
      ctx.save(); ctx.translate(x, y); ctx.scale(kx, ky * (1 - 0.28 * bwA));
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprite(c), -r, -r, r * 2, r * 2);
      ctx.restore();
    };
    // ogni blob viene compresso contro le pareti invece di uscirne
    let curDS = 1;
    const blob = (c, x, y, r, a, z) => {
      if (z != null) { const k = scaleAt(z) / curDS; x = VX + (x - VX) * k; y = VY + (y - VY) * k; r *= k; }
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
    let prevSaluta = !!(self.props && self.props.saluta), prevStopP = !!(self.props && self.props.finite);
    const prevFx = { incendio: !!(self.props && self.props.incendio), gelatina: !!(self.props && self.props.gelatina), accio: !!(self.props && self.props.accio), vieni: !!(self.props && self.props.vieni) };
    // battito di ciglia piu' lungo e ben visibile
    const BL = 0.26;
    const ptr = { active: false, touch: false, x: VX, y: 260 };
    // angolo "coperto" (dove compare il pallino del microfono): la creatura non ci entra mai
    // e l'angolo resta sempre nero. zone = rettangolo in coordinate della scena, o null.
    let zone = null;
    const zoneDist = (x, y, z) => {
      // distanza (sullo schermo, in unita' di scena) tra il centro proiettato e la zona
      const s = scaleAt(z), px = VX + (x - VX) * s, py = VY + (y - VY) * s;
      const nx = clamp(px, zone.x0, zone.x1), ny = clamp(py, zone.y0, zone.y1);
      return { d: Math.hypot(px - nx, py - ny), dx: px - nx, dy: py - ny, s: s };
    };
    const zoneR = (z) => R * BODY * 1.35 * scaleAt(z) + 10;   // corpo + un po' di bagliore
    const inZone = (x, y, z) => !!zone && zoneDist(x, y, z).d < zoneR(z) * 1.15;
    const view = { s: 1, ox: 0, oy: 0 };

    // nuovo punto da raggiungere, anche in profondita'
    const newTarget = () => {
      for (let k = 0; k < 12; k++) {
        C.tz = rnd(0, DEPTH);
        const rg = rangeAt(C.tz, true);
        C.tx = rnd(rg.x0, Math.max(rg.x0, rg.x1)); C.ty = rnd(rg.y0, Math.max(rg.y0, rg.y1));
        if (!inZone(C.tx, C.ty, C.tz)) break;
      }
    };
    const smallTarget = () => {
      for (let k = 0; k < 12; k++) {
        C.tz = clamp(C.z + rnd(-90, 90), 0, DEPTH);
        const rg = rangeAt(C.tz, true);
        C.tx = clamp(C.x + rnd(-120, 120), rg.x0, Math.max(rg.x0, rg.x1)); C.ty = clamp(C.y + rnd(-60, 60), rg.y0, Math.max(rg.y0, rg.y1));
        if (!inZone(C.tx, C.ty, C.tz)) break;
      }
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
        if (Math.random() < 0.6) say('happy'); // quando scatta fa i suoi versetti
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

    // ---- incantesimi buffi: incendio (testa in fiamme), gelatina (si scioglie), accio (spiaccicato sul vetro)
    const FX = { incendio: 1, gelatina: 1, accio: 1, vieni: 1 };
    self._C = C; self._dr = () => drips; self._S = S;
    let flame = [], drips = [];
    Object.assign(S, { brow: 0, browT: 0, eyeBig: 1, eyeBigT: 1, melt: 0, mv: 0, fire: 0, spx: 1, spy: 1, vsx: 0, vsy: 0, eyeDy: 0, flash: 0, smear: null });
    const say = (m) => { try { if (self._say) self._say(m); } catch (e) {} };
    const spring = (k, c, dt) => {
      S.vsx += ((S.tsx - S.spx) * k - S.vsx * c) * dt; S.spx += S.vsx * dt;
      S.vsy += ((S.tsy - S.spy) * k - S.vsy * c) * dt; S.spy += S.vsy * dt;
    };
    const brake = (dt, k) => { const d = Math.pow(k, dt); C.vx *= d; C.vy *= d; C.x += C.vx * dt; C.y += C.vy * dt; };
    const goCenter = (dt) => {
      const tx = VX + (C.x - VX) * 0.25, ty = VY + 25, dx = tx - C.x, dy = ty - C.y;
      C.vx += dx * 6 * dt; C.vy += dy * 6 * dt; brake(dt, 0.03);
    };
    const toZ = (dt, z) => { C.vz += clamp((z - C.z) * 3, -420, 420) * dt; C.vz *= Math.pow(0.25, dt); C.z += C.vz * dt; };
    const headSpark = () => {
      const life = rnd(0.25, 0.6);
      return { x: C.x + rnd(-14, 14), y: C.y - R * 0.95, vx: rnd(-160, 160), vy: rnd(-240, -40), life: life, max: life, r: rnd(4, 9), warm: true };
    };
    const enterFx = (kind) => {
      if (kind === 'gelatina') { S.purpT = 1; S.gflash = 1; self._play('zap'); }
      Object.assign(S, { cut: 0, mode: kind, t: 0, sayIn: 0.4, bx: C.x, by: C.y, bz: C.z, f1: 0, f2: 0, f3: 0, f4: 0, runT: 0, squint: 0, blinkT: 0, smile: false, tsx: 1, tsy: 1, tgt: null, stir: 0, ang: 0 });
      C.shx = 0; C.shy = 0; Bh.kind = 'face'; Bh.t = 0;
    };
    const endFx = () => {
      Object.assign(S, { mode: 'normal', t: 0, browT: 0, eyeBigT: 1, squint: 0, melt: 0, mv: 0, eyeDy: 0, spx: 1, spy: 1, vsx: 0, vsy: 0, fire: 0, purpT: 0 });
      C.shx = 0; C.shy = 0; C.pitchT = 0; C.turnT = 0; drips = [];
      calmAfter();
    };

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
    const bodyVisible = () => S.mode === 'normal' || S.mode === 'ciao' || !!FX[S.mode] || S.mode === 'crucio' || S.mode === 'stop' || (S.mode === 'match' && S.t >= 1);

    // ---- spina della fiamma
    const computeSpine = () => {
      const lung = (self.props && self.props.lunghezza != null) ? self.props.lunghezza : 2;
      const len = Math.min(380, (150 + Math.hypot(C.vx, C.vy) * 0.3) * lung);
      let pts = trail.map((p) => ({ x: p.x, y: p.y, z: p.z == null ? C.z : p.z }));
      if (pts.length === 0) pts.push({ x: C.x, y: C.y, z: C.z });
      if (pts.length < 2) pts.push({ x: pts[0].x, y: pts[0].y - 10, z: pts[0].z });
      const lens = () => { const out = []; let tot = 0; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); out.push(l); tot += l; } return [out, tot]; };
      let [seg, total] = lens();
      if (total < len / 2) {
        const last = pts[pts.length - 1];
        pts.push({ x: last.x, y: last.y - (len / 2 - total), z: last.z });
        [seg, total] = lens();
      }
      const L = Math.min(total, len), N = 30, out = [];
      let k = 0, acc = 0;
      for (let j = 0; j < N; j++) {
        const target = L * j / (N - 1);
        while (k < seg.length - 1 && acc + seg[k] < target) { acc += seg[k]; k++; }
        const u = clamp((target - acc) / (seg[k] || 1e-6), 0, 1);
        out.push({ x: lerp(pts[k].x, pts[k + 1].x, u), y: lerp(pts[k].y, pts[k + 1].y, u), z: lerp(pts[k].z, pts[k + 1].z, u), nx: 0, ny: 0 });
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

      // reazioni dai Tweaks: "saluta" e "finite" scattano ad ogni cambio, "crucio" e' un interruttore
      const PP = self.props || {};
      if (!!PP.saluta !== prevSaluta) { prevSaluta = !!PP.saluta; self._ciaoCmd = true; }
      if (!!PP.finite !== prevStopP) { prevStopP = !!PP.finite; self._stopCmd = true; }
      // incantesimi dai Tweaks: scattano ad ogni cambio dell'interruttore
      for (const k of ['incendio', 'gelatina', 'accio', 'vieni']) if (!!PP[k] !== prevFx[k]) { prevFx[k] = !!PP[k]; self._fxCmd = k; self._audio(); }

      // crucio: parte solo quando la proprieta' passa da falso a vero
      const cru = !!self._crucio || !!PP.crucio;
      if (cru && !prevCrucio && S.mode === 'normal') enterCrucio();
      prevCrucio = cru;
      // FINITE (Finite Incantatem): annulla l'incantesimo in corso
      if (self._stopCmd) {
        self._stopCmd = false;
        if (S.mode === 'crucio') enterStop();
        else if (S.mode === 'incendio' && S.t < 7.2) { S.t = 7.2; S.cut = 1; S.sparkle = 1; self._play('stop'); }   // il fuoco si spegne subito
        else if (S.mode === 'gelatina' && S.t < 7.5) { S.t = 7.5; S.cut = 1; S.sparkle = 1; self._play('stop'); }  // si ricompone subito
        else if (S.mode === 'accio' || S.mode === 'vieni') {
          // anche "accio" e "vieni qui" si interrompono: torna subito normale
          Object.assign(S, { stir: 0, svx: 0, svy: 0, lobes: null, fing: null, ftr: null, fph: null, smile: false, tgt: null, ang: 0, sparkle: 1 });
          self._play('stop'); endFx();
        }
        else if (S.mode === 'ciao') { S.sparkle = 1; self._play('stop'); }
        else if (S.mode === 'normal' && Bh.kind !== 'ouch') { calmAfter(); self._play('stop'); } // se non soffre: si calma
      }
      if (self._ciaoCmd) { self._ciaoCmd = false; if (S.mode === 'normal') enterCiao(); }
      if (self._crucioCmd) { self._crucioCmd = false; if (S.mode === 'normal') enterCrucio(); }
      if (self._fxCmd) { const k = self._fxCmd; self._fxCmd = null; if (S.mode === 'normal') enterFx(k); }

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
      } else if (S.mode === 'incendio') {
        // INCENDIO: una scintilla gli accende la testa, la guarda, corre in giro preoccupato, poi ti guarda male
        const t = S.t;
        S.sayIn -= dt;
        if (t < 1.4) {
          brake(dt, 0.04); toZ(dt, S.bz); box();
          C.pitchT = -1.35 * smoothst(0.2, 0.8, t); C.turnT = 0.12 * Math.sin(t * 4);
          S.eyeBigT = 1.2; S.browT = -0.6 * smoothst(0.5, 1.1, t);
          S.fire = 0.1 + 0.3 * smoothst(0.5, 1.4, t);
          if (!S.f1) { S.f1 = 1; self._play('ignite'); S.hflash = 1; for (let i = 0; i < 45; i++) sparks.push(headSpark()); }
          S.hflash = Math.max(0, (S.hflash || 0) - dt * 2.5);
          if (t > 0.95 && !S.f2) { S.f2 = 1; say('worry'); S.sayIn = 0.5; }
        } else if (t < 7.2) {
          S.fire = Math.min(1, S.fire + dt * 1.3);
          S.browT = -1; S.eyeBigT = 1.15;
          S.runT -= dt;
          if (S.runT <= 0 || Math.hypot(C.tx - C.x, C.ty - C.y) < 40) {
            C.tz = C.z < DEPTH / 2 ? rnd(DEPTH * 0.88, DEPTH) : rnd(0, DEPTH * 0.08);   // sempre da un estremo all'altro della profondita'
            // niente urti: il punto d'arrivo sta ben dentro la scatola sia alla profondita' di partenza
            // sia a quella d'arrivo (la piu' vicina e' la piu' stretta), con margine verso il centro
            const rg = rangeAt(Math.min(C.z, C.tz), true);
            C.tx = VX + (rnd(rg.x0, Math.max(rg.x0, rg.x1)) - VX) * 0.72; C.ty = VY + (rnd(rg.y0, Math.max(rg.y0, rg.y1)) - VY) * 0.65;
            S.runT = rnd(0.55, 0.85);
          }
          const dx = C.tx - C.x, dy = C.ty - C.y, d = Math.max(1, Math.hypot(dx, dy)), ac = 3000 * Math.min(1, d / 120);
          C.vx += dx / d * ac * dt; C.vy += dy / d * ac * dt;
          brake(dt, 0.12);
          C.vz += clamp((C.tz - C.z) * 9, -1800, 1800) * dt; C.vz *= Math.pow(0.12, dt); C.z += C.vz * dt;
          // se si avvicina troppo a una parete viene richiamato verso l'interno prima di toccarla
          const rc = rangeAt(C.z, true), mg = R * 0.4;
          if (C.x < rc.x0 + mg) C.vx += (rc.x0 + mg - C.x) * 40 * dt; else if (C.x > rc.x1 - mg) C.vx -= (C.x - rc.x1 + mg) * 40 * dt;
          if (C.y < rc.y0 + mg) C.vy += (rc.y0 + mg - C.y) * 40 * dt; else if (C.y > rc.y1 - mg) C.vy -= (C.y - rc.y1 + mg) * 40 * dt;
          C.x = clamp(C.x, rc.x0, Math.max(rc.x0, rc.x1)); C.y = clamp(C.y, rc.y0, Math.max(rc.y0, rc.y1));
          C.z = clamp(C.z, 0, DEPTH);
          C.turnT = clamp(C.vx / 260, -1, 1); C.pitchT = clamp(C.vy / 300, -0.8, 0.8) - 0.25;
          if (S.sayIn <= 0) { say('worry'); S.sayIn = rnd(0.45, 0.8); }
        } else if (t < 8.3) {
          // il fuoco si spegne in uno sbuffo di fumo
          goCenter(dt); toZ(dt, 50); box();
          C.turnT = 0; C.pitchT = -0.8 * (1 - smoothst(7.7, 8.3, t));
          S.browT = -0.3; S.eyeBigT = 1;
          S.fire = Math.max(0, S.fire - dt * 3);
          if (!S.f3) {
            S.f3 = 1; self._play('puff');
            for (let i = 0; i < 26; i++) flame.push({ smoke: 1, z: C.z, x: C.x + rnd(-30, 30), y: C.y - R * 0.8 + rnd(-15, 15), vx: rnd(-40, 40), vy: rnd(-90, -30), age: 0, life: rnd(1.0, 1.8), r: R * rnd(0.18, 0.3), seed: Math.random() * 100 });
          }
        } else if (S.cut && t < 9.0) {
          // spento dal Finite: sollevato, sbatte gli occhi
          goCenter(dt); toZ(dt, 40); box(); C.turnT = 0; C.pitchT = 0; S.browT = -0.2; S.eyeBigT = 1;
          if (!S.f4) { S.f4 = 1; S.blinkT = BL; }
        } else if (S.cut) { S.cut = 0; endFx();
        } else if (t < 11.2) {
          // ti guarda male, borbotta e scuote la testa
          goCenter(dt); toZ(dt, 30); box();
          C.turnT = 0; C.pitchT = 0; S.browT = 1; S.eyeBigT = 0.95; S.squint = 0.3;
          if (S.sayIn <= 0) { say('angry'); S.sayIn = rnd(0.75, 1.05); S.nod = 0.35; }
          S.nod = Math.max(0, (S.nod || 0) - dt);
          C.shx = Math.sin(t * 26) * 7 * (S.nod / 0.35);
        } else endFx();
      } else if (S.mode === 'gelatina') {
        // GELATINA: si scioglie imbarazzato fino a restare solo gli occhi, poi si ricompone a molla
        const t = S.t, floorY = VY + VY / scaleAt(C.z) - 6;
        S.sayIn -= dt;
        C.vx = 0; C.vy = 0;
        if (t < 0.7) {
          C.pitchT = 0.55; S.eyeBigT = 1.22; S.browT = -0.6;
          if (!S.f1) { S.f1 = 1; self._play('blub'); }
        } else if (t < 6.2) {
          const k = smoothst(0.7, 6.2, t);
          S.melt = k;
          const g = Math.floor((t - 0.7) / 0.85);
          C.turnT = g % 3 === 2 ? 0 : (g % 2 ? 0.6 : -0.6); C.pitchT = 0.1;
          S.browT = g % 2 ? -0.85 : 0.65; S.eyeBigT = 1.05;
          // colano gocce dense che restano attaccate con un filo, come miele (o un gelato al sole)
          if (Math.random() < dt * 11 * Math.min(1, 0.25 + k * 5) && drips.filter((q) => !q.bubble && q.st === 0).length < 12) {
            drips.push({ rel: rnd(-0.85, 0.85), y: null, vy: rnd(14, 26), r: R * rnd(0.12, 0.21), age: 0, st: 0, th: 1, brk: R * rnd(1.0, 2.6), ph: Math.random() * 6 });
          }
          if (S.sayIn <= 0) { say('whine'); S.sayIn = rnd(0.9, 1.4); }
        } else if (t < 7.5) {
          // tutto sciolto: restano gli occhi sopra la pozza, che fa qualche bolla
          S.melt = 1; C.turnT = 0; C.pitchT = 0.15; S.browT = 0.75; S.eyeBigT = 1;
          if (Math.random() < dt * 5) {
            drips.push({ bubble: 1, x: C.x + rnd(-1.1, 1.1) * R, y: floorY - 4, vy: -rnd(30, 60), r: R * rnd(0.05, 0.09), age: 0, life: rnd(0.35, 0.6) });
            if (Math.random() < 0.6) self._play('blub');
          }
        } else if (t < 10) {
          // si ricompone: uno zampillo che rimbalza a molla e lo rimette in forma (non e' un video al contrario)
          if (!S.f2) { S.f2 = 1; S.mv = -2.6; self._play('plop'); }
          S.mv += (-S.melt * 170 - S.mv * 6.5) * dt; S.melt += S.mv * dt;
          S.melt = Math.max(-0.45, S.melt);
          C.pitchT = 0; C.turnT = 0; S.eyeBigT = t < 8.2 ? 1.2 : 1;
          if (S.cut) { C.shx = 0; S.squint = 0; S.browT = -0.2; if (t > 9.0) { S.cut = 0; S.melt = 0; endFx(); } }
          else {
            if (t > 8.3 && t < 9.1) { C.shx = Math.sin(t * 40) * 9 * (9.1 - t) / 0.8; S.squint = 0.9; } else { C.shx = 0; S.squint = t > 9.1 ? 0.3 : 0; }
            S.browT = t > 9.1 ? 0.9 : 0;
            if (t > 9.2 && !S.f3) { S.f3 = 1; say('angry'); }
          }
        } else endFx();
        if (S.mode === 'gelatina') {
          const m = clamp(S.melt, 0, 1);
          // resta sospeso mentre cola (i fili si allungano), scende a terra solo alla fine
          C.y = S.by + (floorY - R * 0.95 - S.by) * Math.pow(m, 2.4) + Math.min(0, S.melt) * R * 0.35;
          S.eyeDy = R * 0.6 * m;
        }
      } else if (S.mode === 'accio') {
        // ACCIO: viene tirato contro il vetro davanti, ci si spiaccica, cola un po', si stacca come gomma
        const t = S.t, Zg = -80;
        S.sayIn -= dt;
        S.flash = Math.max(0, S.flash - dt * 3);
        if (t < 0.3) {
          if (!S.f1) { S.f1 = 1; self._play('whoosh'); }
          const k = Math.pow(smoothst(0, 0.3, t), 2);
          C.z = S.bz + (Zg - S.bz) * k; C.x = S.bx + (clamp(S.bx, VX - 140, VX + 140) - S.bx) * k; C.y = S.by + (VY - 45 - S.by) * k;
          S.eyeBigT = 1.3; S.browT = -0.8; C.turnT = 0; C.pitchT = 0;
          S.tsx = 0.85; S.tsy = 1.15; spring(260, 14, dt);
        } else if (t < 2.7) {
          if (!S.f2) { S.f2 = 1; self._play('splat'); S.flash = 1; S.vsx = 7; S.vsy = 5; S.smear = { x: C.x, y0: C.y, y1: C.y, z: Zg, a: 1 }; }
          C.z = Zg;
          S.tsx = 1.38; S.tsy = 1.2; spring(240, 9, dt);
          const dS0 = scaleAt(Zg), yMax = VY + (LH - 8 - VY) / dS0 - R * BODY * S.spy;
          C.y = Math.min(yMax, C.y + 30 * dt * smoothst(0.5, 1.1, t));
          S.smear.y1 = C.y;
          S.squint = 0.4; S.eyeBigT = 1.15; S.browT = -0.3;
          if (t > 1.5 && !S.f3) { S.f3 = 1; say('whine'); }
        } else if (t < 3.5) {
          // si stacca: plop, rimbalzo gommoso e torna indietro nel box
          if (!S.f4) { S.f4 = 1; self._play('plop'); S.vsx = -6; S.vsy = -5; }
          S.tsx = 1; S.tsy = 1; spring(230, 5.5, dt);
          C.z = Zg + (140 - Zg) * smoothst(2.7, 3.3, t);
          S.squint = 0; S.eyeBigT = 1.2; S.browT = 0;
        } else if (t < 4.5) {
          // si scrolla
          spring(230, 8, dt);
          const k = 1 - (t - 3.5);
          C.shx = Math.sin(t * 38) * 10 * Math.pow(k, 1.3); C.shy = Math.sin(t * 23 + 1) * 3 * k;
          C.turnT = Math.sin(t * 26) * 0.7 * k; S.squint = 0.95;
        } else if (t < 6.4) {
          // ti guarda storto e borbotta
          C.shx = 0; C.shy = 0; C.turnT = 0; S.squint = 0.3; S.browT = 1; S.eyeBigT = 1;
          if (S.sayIn <= 0) { say('angry'); S.sayIn = rnd(0.8, 1.1); }
        } else endFx();
        if (S.smear && S.mode === 'accio' && t > 2.7) S.smear.a = Math.max(0, S.smear.a - dt * 0.6);
      } else if (S.mode === 'vieni') {
        const t = S.t;
        S.sayIn -= dt;
        if (t < 1.1) {
          // sente: guarda verso destra
          brake(dt, 0.04); box();
          C.turnT = 0.95 * smoothst(0.1, 0.5, t); C.pitchT = 0; S.eyeBigT = 1.12;
          if (t > 0.35 && !S.f1) { S.f1 = 1; say('happy'); }
        } else if (t < 1.9) {
          // poi torna a guardare avanti, come al solito
          brake(dt, 0.04); box();
          C.turnT = 0; S.eyeBigT = 1;
        } else if (!S.f2) {
          // si rigira e va piano piano sul lato destro, davanti
          C.turnT = 0.75; C.pitchT = 0.05;
          if (!S.tgt) {
            // sempre lo stesso punto: lato destro, davanti, a meta' altezza
            const tz = 60, rg = rangeAt(tz, true);
            S.tgt = { x: rg.x1, y: clamp(VY + 10, rg.y0, rg.y1), z: tz };
          }
          const dx = S.tgt.x - C.x, dy = S.tgt.y - C.y, d = Math.max(1, Math.hypot(dx, dy));
          const sp = Math.max(45, Math.min(110, d / 3.5)) * Math.min(1, d / 50);   // piano piano, ma ci arriva sempre
          C.vx += (dx / d * sp - C.vx) * Math.min(1, dt * 2); C.vy += (dy / d * sp - C.vy) * Math.min(1, dt * 2);
          C.x += C.vx * dt; C.y += C.vy * dt;
          C.z += (S.tgt.z - C.z) * Math.min(1, dt * 1.2);
          if (d < 6 && Math.abs(S.tgt.z - C.z) < 8) { S.f2 = 1; S.t0 = t; S.cx = C.x; S.cy = C.y; C.vx = 0; C.vy = 0; self._play('purr'); S.sayIn = 0.9; }
        } else {
          const u = t - S.t0;
          if (u < 7) {
            // grattatina: come se lo mescolassi per 5 secondi, poi in 2 secondi rallenta
            // tutto rimescolato in modo caotico: corpo, forma e anche gli occhi, ognuno per conto suo
            const k = u < 5 ? 1 : 1 - smoothst(5, 7, u), tt = time;
            S.stir = k;
            const ST = (self.props && self.props.mescola) || 'mercurio';
            S.mst = ST;
            if (ST === 'frullato') {
              // FRULLATO: scossoni rapidi e irregolari, la gelatina trema e rimbalza
              S.svx = (S.svx || 0) + (rnd(-1, 1) * 16000 * k + (S.cx - C.x) * 420 - (S.svx || 0) * 13) * dt;
              S.svy = (S.svy || 0) + (rnd(-1, 1) * 13000 * k + (S.cy - C.y) * 420 - (S.svy || 0) * 13) * dt;
              C.x += S.svx * dt; C.y += S.svy * dt;
              S.spx = 1 + 0.22 * Math.sin(tt * 55) * k + (n1(tt * 9) - 0.5) * 0.2 * k;
              S.spy = 1 - 0.22 * Math.sin(tt * 55 + 0.7) * k + (n1(tt * 9.4 + 3) - 0.5) * 0.2 * k;
            } else {
              // VORTICE (veloce, turbolento) o OLIO (si divide in gocce che si inseguono)
              const fast = ST !== 'olio';
              S.hang = (S.hang || 0) + dt * (fast ? 13 + 7 * (n1(tt * 1.3) - 0.5) : 6.5) * (n1(tt * 0.5 + 4) > 0.25 ? 1 : -1);
              const F = fast ? 4200 : 1500, horiz = ST === 'mercurio';
              const fx = (horiz ? Math.cos(S.fph ? S.fph[1] : tt * 10) * 3600 : Math.cos(S.hang) * F) * k + (n1(tt * 6 + 1) - 0.5) * F * (horiz ? 0.4 : 0.9) * k;
              const fy = (horiz ? 0 : Math.sin(S.hang) * F * 0.75) * k + (n1(tt * 6.3 + 8) - 0.5) * F * (horiz ? 0.25 : 0.7) * k;
              S.svx = (S.svx || 0) + (fx + (S.cx - C.x) * 160 - (S.svx || 0) * 9) * dt;
              S.svy = (S.svy || 0) + (fy + (S.cy - C.y) * 160 - (S.svy || 0) * 9) * dt;
              C.x += S.svx * dt; C.y += S.svy * dt;
              S.tsx = 1 + clamp(Math.abs(S.svx) / 1200, 0, 0.35) - clamp(Math.abs(S.svy) / 2400, 0, 0.15); S.tsy = 1 + clamp(Math.abs(S.svy) / 1200, 0, 0.3) - clamp(Math.abs(S.svx) / 2400, 0, 0.15);
              spring(260, 10, dt);
            }
            C.vx = S.svx; C.vy = S.svy;
            // mercurio: 2-3 dita passano nel corpo; il corpo si rompe in gocce che si respingono dalle dita
            // e poi si riattaccano tra loro
            if (ST === 'mercurio') {
              const nF = 2 + smoothst(0.4, 0.6, n1(tt * 0.4 + 9));
              // all'inizio le tre dita passano da sinistra a destra, dritte, e lo tagliano in tre fette
              const cutK = 0, sw = 0;
              const cutY = [-0.27, 0.27, 0.78];
              // ogni dito ha il suo ritmo, che cambia di continuo: tagli veloci e irregolari
              S.fph = S.fph || [rnd(0, 6.3), rnd(0, 6.3), rnd(0, 6.3)];
              for (let i = 0; i < 3; i++) S.fph[i] += dt * (10 + 7 * n1(tt * 0.9 + i * 4)) * (1 + 0.6 * (n1(tt * 2.7 + i) - 0.5));
              S.fing = [0, 1, 2].map((i) => {
                // avanti e indietro in orizzontale, a velocita', ampiezza e altezza sempre diverse
                const ph = S.fph[i];
                const fx0 = Math.sin(ph) * R * (0.85 + 0.7 * n1(tt * 1.7 + i * 2)), fy0 = R * cutY[i] * 0.9 + (n1(tt * 2.6 + i * 3) - 0.5) * R * 0.5;
                const cx = R * (-1.5 + 3.0 * sw) - i * R * 0.12, cy = R * cutY[i];
                return { x: cx + (fx0 - cx) * (1 - cutK), y: cy + (fy0 - cy) * (1 - cutK), w: u < 0.05 ? 0 : 1 };
              });
              for (const f of S.fing) { f.tr = f.tr || []; }
              S.ftr = S.ftr || [[], [], []];
              S.fing.forEach((f, i) => { S.ftr[i].unshift([C.x + f.x, C.y + f.y]); if (S.ftr[i].length > 14) S.ftr[i].pop(); });
              // si rompe e si ricompone: le gocce si separano quando le dita le tagliano, poi si attraggono
              const split = smoothst(0.25, 0.65, n1(tt * 1.4 + 2)) * k;
              S.lobA = (S.lobA || 0) + dt * 7;
              // tre fette (sopra, centro, sotto) che le dita separano e spostano nel verso del taglio
              const sp = smoothst(0.15, 0.85, u) * k, shear = R * 0.18 * sp;
              const cutL = [[-shear * 0.6, -R * 0.42 * sp], [shear, 0], [-shear * 0.3, R * 0.42 * sp]];
              S.lobes = [0, 1, 2].map((L) => {
                const ph = (S.fph ? S.fph[L] : tt * 10) - 0.5, through = 1 - Math.abs(Math.sin(ph + 0.5));   // 1 = dito al centro
                const sep = smoothst(0.1, 0.8, through) * k;
                const cross = Math.sin((S.fph ? S.fph[(L + 1) % 3] : tt) * 0.45 + L * 2.1);
                let ox = Math.sin(ph) * R * 0.45 * k, oy = (L - 1) * R * 0.3 * sep * Math.cos(ph * 0.3) + cross * R * 0.38 * k + (n1(tt * 4 + L * 5) - 0.5) * R * 0.16 * k;
                // spinta via dalle dita
                for (const f of S.fing) { const dx = ox - f.x, dy = oy - f.y, d = Math.hypot(dx, dy) + 1; if (d < R * 0.5) { ox += dx / d * (R * 0.5 - d) * 0.6 * f.w; oy += dy / d * (R * 0.5 - d) * 0.6 * f.w; } }
                // dal taglio iniziale si passa piano piano al rimescolamento
                return [cutL[L][0] + (ox - cutL[L][0]) * (1 - cutK), cutL[L][1] + (oy - cutL[L][1]) * (1 - cutK)];
              });
            } else S.fing = null;
            // olio: il corpo si divide in tre gocce che si inseguono
            if (ST === 'olio') {
              S.lobA = (S.lobA || 0) + dt * 5.5;
              S.lobes = [0, 1, 2].map((L) => {
                const a = S.lobA * (L % 2 ? -0.8 : 1) + L * 2.094 + (n1(tt * 1.7 + L * 5) - 0.5) * 1.6;
                const rr = R * 0.55 * k * (0.6 + 0.7 * n1(tt * 1.3 + L * 3));
                return [Math.cos(a) * rr, Math.sin(a) * rr * 0.8];
              });
            } else if (ST !== 'mercurio') S.lobes = null;
            C.turnT = (n1(tt * 2.3 + 1) - 0.5) * 1.3 * k; C.pitchT = (n1(tt * 2.1 + 7) - 0.5) * 0.9 * k;
            S.squint = (0.45 + 0.35 * n1(tt * 3 + 2)) * k; S.browT = -0.25 * k; S.eyeBigT = 1;
            if (S.sayIn <= 0 && k > 0.3) { self._play('purr'); S.sayIn = 0.85; }
          } else if (u < 8.6) {
            // finito: sorride contento
            S.stir = 0; S.spx = 1; S.spy = 1; S.svx = 0; S.svy = 0; S.lobes = null; S.fing = null; S.ftr = null; S.fph = null; S.squint = 0; S.browT = 0; C.turnT = 0; C.pitchT = 0;
            if (!S.f3) { S.f3 = 1; S.smile = true; say('happy'); }
          } else { S.smile = false; S.stir = 0; S.tgt = null; S.ang = 0; endFx(); }
        }
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

      // l'angolo coperto respinge la creatura (morbido da lontano, rigido da vicino)
      if (zone && bodyVisible()) {
        const q = zoneDist(C.x, C.y, C.z), rr = zoneR(C.z);
        if (q.d < rr * 1.6) {
          let ux = q.dx, uy = q.dy, l = Math.hypot(ux, uy);
          if (l < 1e-3) { ux = VX - (zone.x0 + zone.x1) / 2; uy = VY - (zone.y0 + zone.y1) / 2; l = Math.hypot(ux, uy) || 1; }
          ux /= l; uy /= l;
          const push = (rr * 1.6 - q.d) * 9;
          C.vx += ux * push * dt / q.s; C.vy += uy * push * dt / q.s;
          if (q.d < rr) { C.x += ux * (rr - q.d) / q.s; C.y += uy * (rr - q.d) / q.s; }
          if (S.mode === 'ciao') { S.bx += ux * Math.max(0, rr - q.d) / q.s; S.by += uy * Math.max(0, rr - q.d) / q.s; }
          if (Bh.kind === 'bump' && q.d < rr * 1.2) calmAfter();
        }
      }

      // testa: turn e pitch
      if (S.mode !== 'normal' && !FX[S.mode]) { C.turnT = 0; C.pitchT = 0; C.shx = 0; C.shy = 0; }
      S.brow += (S.browT - S.brow) * Math.min(1, dt * 9);
      // occhi che galleggiano nel corpo rimescolato: restano indietro rispetto al movimento e ondeggiano
      if (!S.ej) S.ej = [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0 }];
      {
        const mx = S.mode === 'vieni' ? (S.stir || 0) : 0;
        for (let i = 0; i < 2; i++) {
          const e = S.ej[i];
          let ax, ay;
          if (S.lobes && mx) { const L = S.lobes[S.mst === 'mercurio' ? 1 : i]; ax = (L[0] - e.x) * 140 - e.vx * 11; ay = (L[1] - e.y) * 140 - e.vy * 11; }
          else {
            const fr = S.mst === 'frullato', f = fr ? 6.5 : 4.2, amp = fr ? 4200 : 2600;
            ax = (-(C.vx || 0) * 0.9 + (n1(time * f + i * 7) - 0.5) * amp) * mx - e.x * (fr ? 160 : 90) - e.vx * 7;
            ay = (-(C.vy || 0) * 0.9 + (n1(time * f * 0.9 + i * 11 + 3) - 0.5) * amp * 0.8) * mx - e.y * (fr ? 160 : 90) - e.vy * 7;
          }
          e.vx += ax * dt; e.vy += ay * dt; e.x += e.vx * dt; e.y += e.vy * dt;
          const lim = R * 0.45; e.x = clamp(e.x, -lim, lim); e.y = clamp(e.y, -lim * 0.8, lim * 0.8);
        }
      }
      S.eyeBig += (S.eyeBigT - S.eyeBig) * Math.min(1, dt * 10);
      S.purp = (S.purp || 0) + ((S.purpT || 0) - (S.purp || 0)) * Math.min(1, dt * (S.purpT ? 6 : 1.5));
      S.gflash = Math.max(0, (S.gflash || 0) - dt * 1.8);
      S.sparkle = Math.max(0, (S.sparkle || 0) - dt * 2.2);
      if (S.mode === 'gelatina' && S.cut) S.purpT = 0;
      if (S.smear && S.mode !== 'accio') { S.smear.a -= dt * 0.6; if (S.smear.a <= 0) S.smear = null; }

      // fiammella sulla testa (incendio) e fumo
      if (S.fire > 0.02 && bodyVisible()) {
        const hx = C.x + Math.sin(C.turn * 0.9) * R * 0.25, hy = C.y - R * 0.88;
        S.fireAcc = (S.fireAcc || 0) + dt * 340 * S.fire;
        while (S.fireAcc >= 1) {
          S.fireAcc -= 1;
          flame.push({ z: C.z, x: hx + rnd(-0.45, 0.45) * R * (0.4 + S.fire), y: hy + rnd(-14, 10), vx: -C.vx * 0.45 + rnd(-35, 35), vy: -C.vy * 0.3 - rnd(70, 190), age: 0, life: rnd(0.4, 0.85), r: R * rnd(0.2, 0.34) * (0.5 + 0.8 * S.fire), seed: Math.random() * 100 });
        }
      }
      {
        let m = 0;
        for (const f of flame) {
          f.age += dt; if (f.age >= f.life) continue;
          f.vy -= (f.smoke ? 20 : 140) * dt; f.vx += (n1(f.seed + time * 4) - 0.5) * 160 * dt;
          f.x += f.vx * dt; f.y += f.vy * dt;
          flame[m++] = f;
        }
        flame.length = m;
      }
      // gocce e bolle di gelatina
      {
        const floorY = VY + VY / scaleAt(C.z) - 6;
        const mm = clamp(S.melt, 0, 1), msx = 1 + 0.9 * mm, msy = 1 - 0.8 * mm, yb = C.y + R * 0.9;
        const reform = S.mode !== 'gelatina' || S.t >= 7.5;
        let m = 0;
        for (const d of drips) {
          d.age += dt;
          if (d.bubble) { if (d.age >= d.life) continue; d.y += d.vy * dt; drips[m++] = d; continue; }
          // punto in cui la goccia e' attaccata al corpo (segue il corpo che si affloscia)
          d.ax = C.x + d.rel * R * 0.75 * msx; d.ay = yb - R * (0.45 + 0.2 * d.rel * d.rel) * msy;
          if (d.y === null) d.y = d.ay;
          if (reform && d.st !== 1) d.st = 3;
          if (d.st === 0) {
            // appesa: scende piano, densa, allungando il filo
            d.vy = Math.min(70, d.vy + 35 * dt); d.y += d.vy * dt;
            if (d.y >= floorY) { d.y = floorY; d.st = 2; }
            else if (d.y - d.ay > d.brk) { d.st = 1; d.vy = Math.max(d.vy, 60); }
          } else if (d.st === 1) {
            // il filo si spezza: la goccia cade, il pezzo di filo risale verso il corpo
            d.vy += 420 * dt; d.y += d.vy * dt; d.th -= dt * 2.5;
            if (d.y >= floorY) continue;
          } else if (d.st === 2) {
            // arrivata nella pozza: il filo resta teso e si assottiglia
            d.y = floorY; d.th -= dt * 0.45;
            if (d.th <= 0) continue;
          } else {
            // si ricompone: i fili vengono risucchiati nel corpo
            d.y += (d.ay - d.y) * Math.min(1, dt * 7);
            if (d.y - d.ay < 3) continue;
          }
          drips[m++] = d;
        }
        drips.length = m;
      }
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
          // ogni punto della scia resta alla sua profondita' e urta le pareti di quella profondita'
          const sp = scaleAt(p.z), pl = VX - VX / sp + 4, pr = VX + VX / sp - 4, ptp = VY - VY / sp + 4;
          p.age += dt; p.y -= 150 * dt; p.x += (n1(p.seed + time * 2) - 0.5) * 60 * dt;
          if (p.y < ptp) { p.y = ptp; p.x += (p.x >= C.x ? 1 : -1) * 90 * dt; } p.x = clamp(p.x, pl, pr);
        }
        while (trail.length > 2 && trail[trail.length - 1].age > 0.5) trail.pop();
        trail.unshift({ x: C.x, y: C.y, z: C.z, age: 0, seed: Math.random() * 100 });
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
        const ex = C.x + Rs * Math.sin(Lg) * Math.cos(B), ey = C.y - Rs * Math.sin(B) + (S.eyeDy || 0);
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
          fireAcc += dts * 560 * (1 + S.tint) * (1 - 0.75 * clamp(S.melt || 0, 0, 1)); // piu' fiammelle, in proporzione alla creatura ingrandita
          while (fireAcc >= 1) {
            fireAcc -= 1;
            const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * RB * 0.75;
            const bandY = Math.sin(a) * rr * 0.7;
            fire.push({ ly: bandY < -RB * 0.17 ? 0 : bandY > RB * 0.17 ? 2 : 1, aq: smoothst(0.3, 0.55, n1(a * 1.6 + time * 0.9)), tf: smoothst(0.45, 0.7, n1(a * 2.3 - time * 0.6 + 17)), x: C.x + Math.cos(a) * rr, y: C.y + Math.sin(a) * rr * 0.7, z: C.z, vx: -C.vx * 0.25 + (Math.random() - 0.5) * 20, vy: -C.vy * 0.2 - rnd(30, 70), age: 0, life: rnd(0.55, 1.15), r: RB * rnd(0.34, 0.54), seed: Math.random() * 100 });
          }
        }
        let n = 0;
        for (const p of fire) {
          p.age += dts; if (p.age >= p.life) continue;
          p.vy -= 260 * dts * (1 + 0.4 * S.tint);
          p.vx += (n1(p.seed + time * 3 + p.y * 0.01) - 0.5) * 240 * dts;
          p.vx *= Math.pow(0.3, dts);
          if (S.stir > 0.01) {
            // grattatina: il corpo viene mescolato, le fiammelle girano attorno al centro
            const ddx = p.x - C.x, ddy = p.y - C.y, dd = Math.hypot(ddx, ddy) + 1;
            if (S.mst === 'frullato') {
              const pulse = Math.sin(time * 30 + p.seed);
              p.vx += ((n1(p.seed + time * 11) - 0.5) * 4200 + ddx / dd * pulse * 900) * S.stir * dts;
              p.vy += ((n1(p.seed * 1.7 + time * 11 + 3) - 0.5) * 4200 + ddy / dd * pulse * 900) * S.stir * dts;
            } else if (S.mst === 'mercurio') {
              p.vx += (Math.cos(S.fph ? S.fph[p.ly != null ? p.ly : 1] : time * 10) * 1500 + (n1(p.seed + time * 9) - 0.5) * 1800) * S.stir * dts;
              p.vy += (n1(p.seed * 1.3 + time * 9 + 4) - 0.5) * 1200 * S.stir * dts;
              if (S.fing) for (const f of S.fing) {
                const fx = p.x - (C.x + f.x), fy = p.y - (C.y + f.y), fd = Math.hypot(fx, fy) + 1, Rf = R * 0.32;
                if (fd < Rf) { const push = (1 - fd / Rf) * 5200 * f.w * S.stir; p.vx += fx / fd * push * dts; p.vy += fy / fd * push * dts; }
              }
            } else if (S.mst === 'olio') {
              p.vx += (n1(p.seed + time * 4) - 0.5) * 700 * S.stir * dts;
              p.vy += (n1(p.seed * 1.7 + time * 4 + 3) - 0.5) * 700 * S.stir * dts;
            } else {
              // vortice turbolento: gira forte attorno al centro e si sfilaccia
              const sw = 1700 * (dd < R * 1.4 ? 1 : 0.5);
              p.vx += ((-ddy / dd) * sw + (n1(p.x * 0.03 + time * 3) - 0.5) * 2600) * S.stir * dts;
              p.vy += ((ddx / dd) * sw + (n1(p.y * 0.03 + time * 3 + 7) - 0.5) * 2600) * S.stir * dts;
            }
          }
          p.x += p.vx * dts; p.y += p.vy * dts;
          // pareti alla profondita' della fiammella, non a quella attuale della creatura
          const pr = p.r * 0.5, spz = scaleAt(p.z), wl = VX - VX / spz, wr = VX + VX / spz, wt = VY - VY / spz;
          if (p.x < wl + pr) { p.x = wl + pr; p.vx = Math.abs(p.vx) * 0.15; p.vy += (Math.random() - 0.5) * 60; }
          else if (p.x > wr - pr) { p.x = wr - pr; p.vx = -Math.abs(p.vx) * 0.15; p.vy += (Math.random() - 0.5) * 60; }
          if (p.y < wt + pr) { p.y = wt + pr; p.vy = Math.abs(p.vy) * 0.1; p.vx += (p.x >= C.x ? 1 : -1) * rnd(40, 120); p.r *= 1.01; }
          fire[n++] = p;
        }
        fire.length = n;
        // velo sottile che segue la forma (niente cerchi)
        const m = spine.length;
        for (let i = 0; i < m; i++) {
          const sv = i / (m - 1), p = spine[i];
          blob(cO, p.x, p.y, RB * 2.0 * Math.pow(1 - sv, 1.1) + 2, 0.07 * A, p.z);
        }
        for (const p of fire) {
          const s = p.age / p.life;
          const r = p.r * (1 - s * 0.85);
          // passaggio graduale: azzurro chiaro -> azzurro -> blu, con sfumature morbide
          const cAz = mix3(cM, cO, 0.35);
          let c = s < 0.2 ? mix3(cC, cM, 0.8 + 0.2 * smoothst(0, 0.2, s))
            : s < 0.55 ? mix3(cM, cAz, smoothst(0.2, 0.55, s))
            : mix3(cAz, cO, smoothst(0.55, 1, s));
          const a = smoothst(0, 0.3, s) * Math.pow(1 - s, 1.1) * 0.31 * A; // nascono tenui: niente accumulo bianco al centro
          const aqk = (0.35 + 0.65 * (p.aq || 0)) * 0.95 * (1 - S.tint) * (1 - (S.purp || 0));
          if (aqk > 0.01) { const ca = aquaOf(s); c[0] += (ca[0] - c[0]) * aqk; c[1] += (ca[1] - c[1]) * aqk; c[2] += (ca[2] - c[2]) * aqk; }
          const tfk = (0.15 + 0.85 * (p.tf || 0)) * 0.9 * (1 - S.tint) * (1 - (S.purp || 0));
          if (tfk > 0.01) { const ct = tiffOf(s); c[0] += (ct[0] - c[0]) * tfk; c[1] += (ct[1] - c[1]) * tfk; c[2] += (ct[2] - c[2]) * tfk; }
          if (S.lobes && S.mode === 'vieni') { const L = S.lobes[S.mst === 'mercurio' && p.ly != null ? p.ly : Math.floor(p.seed) % 3]; blob(q8(c), p.x + L[0], p.y + L[1], r * 0.9, a * 1.15, p.z); }
          else blob(q8(c), p.x, p.y, r, a, p.z);
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
        for (const arr of [trail, fire, tongues, flame, drips, exp, sparks]) for (const p of arr) if (p && p.x != null) p.x += sh;
        for (const tr of eyeTrail) for (const p of tr) p.x += sh;
        for (const tr of eyeTongues) for (const p of tr) p.x += sh;
        if (S.bx != null) S.bx += sh;
        if (S.cx != null) S.cx += sh;
        if (S.tgt) S.tgt.x += sh;
        if (S.smear) S.smear.x += sh;
        if (S.ftr) for (const tr of S.ftr) for (const p of tr) p[0] += sh;
      }
      const s = Math.min(cw / LW, ch / LH);
      view.s = s; view.ox = (cw - LW * s) / 2; view.oy = (ch - LH * s) / 2;
      const Z = self._zone;
      let zpx = null;
      if (Z && Z.on) {
        // misure in dp (pixel CSS) -> pixel del canvas -> unita' di scena
        const k = cw / cssW, zw = Z.w * k, zh = Z.h * k;
        const right = Z.corner === 'tr' || Z.corner === 'br', bottom = Z.corner === 'bl' || Z.corner === 'br';
        zpx = { x: right ? cw - zw : 0, y: bottom ? ch - zh : 0, w: zw, h: zh, cx: right ? cw : 0, cy: bottom ? ch : 0 };
        zone = { x0: (zpx.x - view.ox) / s, y0: (zpx.y - view.oy) / s, x1: (zpx.x + zw - view.ox) / s, y1: (zpx.y + zh - view.oy) / s };
      } else zone = null;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
      ctx.setTransform(s, 0, 0, s, view.ox, view.oy);
      // rete di sicurezza: niente viene disegnato fuori dalla scatola
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, LW, LH); ctx.clip();
      // scia di gelatina rimasta sul vetro davanti (accio)
      if (S.smear && S.smear.a > 0.01) {
        const sm = S.smear, dz = scaleAt(sm.z), cOs = col('outer', 0), cMs = col('mid', 0);
        ctx.save(); ctx.translate(VX, VY); ctx.scale(dz, dz); ctx.translate(-VX, -VY);
        ctx.globalCompositeOperation = 'lighter';
        const n = Math.max(2, Math.round((sm.y1 - sm.y0) / 6) + 2);
        for (let i = 0; i < n; i++) {
          const y = sm.y0 + (sm.y1 - sm.y0) * i / (n - 1);
          blob(cOs, sm.x + (n1(i * 0.7) - 0.5) * 14, y, R * 0.95, 0.05 * sm.a);
          blob(cMs, sm.x + (n1(i * 0.7 + 3) - 0.5) * 10, y, R * 0.45, 0.06 * sm.a);
        }
        ctx.restore();
      }
      // prospettiva: piu' e' lontana, piu' e' piccola e vicina al centro della scena
      const dS = scaleAt(C.z);
      curDS = dS;
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
        if (S.spx !== 1 || S.spy !== 1) { ctx.translate(C.x, C.y); ctx.scale(S.spx, S.spy); ctx.translate(-C.x, -C.y); }
      } else { JL.sx = 1; JL.vx = 0; JL.sy = 1; JL.vy = 0; }
      ctx.globalCompositeOperation = 'lighter';

      const A = S.alpha * (1 - 0.45 * (C.z / DEPTH)), tint = S.tint; // da lontano un po' piu' tenue
      // tipo di corpo: strati (attuale) | plasma | scintille | candela
      const CORPO = (self.props && self.props.corpo) || 'scintille';
      if (bodyVisible() && A > 0.005 && spine.length) {
        const Reff = R * S.pulse;
        const mlt = S.mode === 'gelatina' ? S.melt : 0;
        if (mlt !== 0) {
          const yb = C.y + R * 0.9, sy = mlt > 0 ? 1 - 0.8 * mlt : 1 - mlt * 0.9, sx = mlt > 0 ? 1 + 0.9 * mlt : 1 + mlt * 0.45;
          ctx.save(); ctx.translate(C.x, yb); ctx.scale(sx, sy); ctx.translate(-C.x, -yb);
        }
        // corpo a strati
        const flAmp = 0.4 * (1 + 1.5 * tint);
        // proposta occhi scelta: attuale | maschera | lanterna | nucleo | cartoon
        const OV = (self.props && self.props.occhi) || 'ombra';
        const ES = { attuale: 1, maschera: 1.1, 'maschera noBK': 1.1, lanterna: 1.35, nucleo: 1.15, cartoon: 1.12, anello: 1.1, sfera: 1.2, ombra: 1.12, mix: 1.15 }[OV] || 1;
        const NUC = OV === 'nucleo' || OV === 'mix';
        // primo strato: bagliore largo e tenue che segue la forma della fiamma (sostituisce l'alone tondo)
        const layers = [['outer', 2.7, 1.0, 0.045, 19], ['outer', 1.9, 1.0, 0.16, 1], ['mid', 1.25, 0.72, 0.22, 7], ['core', 0.75, 0.38, 0.24, 13]];
        for (const Ly of (CORPO === 'strati' ? layers : CORPO === 'scintille' ? layers.slice(1) : [])) {
          let c = col(Ly[0], tint);
          if (AQUA[Ly[0]]) c = q8(mix3(c, AQUA[Ly[0]], 0.45 * (1 - tint) * (1 - (S.purp || 0))));
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
            blob(c, p.x + p.nx * wob, p.y + p.ny * wob, rad, Ly[3] * (0.55 + 0.45 * (1 - sv)) * headDim * A * (S.lobes && S.mode === 'vieni' ? 1 - 0.8 * S.stir : 1), p.z);
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
        if (mlt !== 0) ctx.restore();
        // grattatina: mescolando si aprono buchi nel corpo, come olio che galleggia sull'acqua
        if (S.mode === 'vieni' && S.stir > 0.02 && S.mst === 'mercurio' && S.ftr) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          const sp0 = sprite([0, 0, 0]);
          S.ftr.forEach((tr, i) => {
            const w = S.fing ? S.fing[i].w : 1;
            // solco continuo: tra un punto e l'altro della scia riempio con tante macchie fitte
            for (let j = 0; j < tr.length - 1; j++) {
              const a0 = tr[j], a1 = tr[j + 1];
              const r0 = R * (0.16 - 0.008 * j) * S.stir * w, r1 = R * (0.16 - 0.008 * (j + 1)) * S.stir * w;
              if (r0 <= 0.5) break;
              const dd = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), n = Math.max(1, Math.ceil(dd / (Math.min(r0, r1) * 0.35 + 0.5)));
              for (let q = 0; q < n; q++) {
                const u2 = q / n, x = a0[0] + (a1[0] - a0[0]) * u2, y = a0[1] + (a1[1] - a0[1]) * u2, r = r0 + (r1 - r0) * u2;
                ctx.globalAlpha = Math.min(1, 0.32 * (1 - (j + u2) / tr.length) * S.stir * w);
                ctx.drawImage(sp0, sqx(x) - r * 1.6, sqy(y) - r * 1.6, r * 3.2, r * 3.2);
              }
            }
          });
          ctx.restore();
        }
        if (S.mode === 'vieni' && S.stir > 0.02 && S.mst === 'vortice') {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          const hk = S.stir, sp0 = sprite([0, 0, 0]);
          for (let i = 0; i < 6; i++) {
            const life = n1(time * 1.6 + i * 13.7);                       // si aprono e si richiudono in fretta
            const open = smoothst(0.4, 0.7, life) * hk;
            if (open < 0.03) continue;
            // una striscia irregolare che segue il vortice: tante macchie di grandezza diversa lungo una curva
            const a0 = time * (3.5 + i * 0.4) + i * 1.9, rad = R * (0.25 + 0.5 * n1(i * 4.1 + time * 0.8));
            for (let j = 0; j < 8; j++) {
              const a = a0 + j * 0.11 * (1 + n1(i + j * 0.7 + time)), rr = rad * (1 + (n1(time * 2 + i * 3 + j) - 0.5) * 0.35);
              const hx = C.x + Math.cos(a) * rr, hy = C.y + Math.sin(a) * rr * 0.8;
              const r = R * (0.1 + 0.14 * n1(i * 7 + j * 1.3 + time * 1.5)) * open * (0.35 + 0.65 * Math.sin(Math.PI * (j + 0.5) / 8));
              ctx.globalAlpha = Math.min(1, 0.9 * open);
              ctx.drawImage(sp0, sqx(hx) - r * 1.7, sqy(hy) - r * 1.7, r * 3.4, r * 3.4);
            }
          }
          ctx.restore();
        }
        // pozza e gocce di ectoplasma (gelatina)
        if (S.mode === 'gelatina' || drips.length) {
          const floorY = VY + VY / dS - 6, m = clamp(mlt, 0, 1);
          if (m > 0.02) {
            ctx.save(); ctx.translate(C.x, floorY); ctx.scale(1, 0.32); ctx.translate(-C.x, -floorY);
            blob(cO, C.x, floorY, R * (0.5 + 1.1 * m), 0.32 * m * A);
            blob(cM, C.x, floorY, R * (0.3 + 0.8 * m), 0.3 * m * A);
            blob(cC, C.x, floorY, R * (0.15 + 0.45 * m), 0.22 * m * A);
            ctx.restore();
          }
          for (const d of drips) {
            if (d.bubble) { const k = d.age / d.life; blob(cC, d.x, d.y, d.r * (1 + k), 0.5 * (1 - k) * A); continue; }
            if (d.ay == null) continue;
            const len = Math.max(0, d.y - d.ay), tl = d.st === 1 ? len * Math.max(0, d.th) : len;
            // attacco al corpo: un rigonfiamento da cui parte la colata
            blob(cM, d.ax, d.ay - d.r * 0.6, d.r * 2.2, 0.28 * A); blob(cC, d.ax, d.ay - d.r * 0.3, d.r * 1.2, 0.3 * A);
            const thin = d.st === 2 ? Math.max(0.25, d.th) : 1;
            // filo: piu' spesso vicino al corpo, sottilissimo in mezzo
            const n = Math.max(2, Math.ceil(tl / 6));
            for (let j = 0; j <= n; j++) {
              const u = j / n, y = d.ay + tl * u, x = d.ax + Math.sin(u * 3 + d.ph + d.age * 1.5) * 1.5 * u;
              const w = d.r * (0.28 + 0.8 * Math.pow(1 - u, 2.5)) * thin;
              blob(cM, x, y, w * 2.4, 0.18 * A);
              blob(cC, x, y, w, 0.26 * A);
            }
            // la goccia in fondo al filo (o il punto in cui tocca la pozza)
            if (d.st === 2) { blob(cM, d.ax, d.y, d.r * 1.8, 0.22 * A); continue; }
            blob(cO, d.ax, d.y, d.r * 2.3, 0.2 * A);
            blob(cM, d.ax, d.y, d.r * 1.35, 0.42 * A);
            blob(cC, d.ax, d.y - d.r * 0.25, d.r * 0.75, 0.4 * A);
          }
        }
        // lampo dell'accensione in testa (incendio)
        if (S.hflash > 0.01) { blob([255, 230, 170], C.x, C.y - R * 0.95, R * 0.7, 0.6 * S.hflash * A); blob([255, 255, 255], C.x, C.y - R * 0.95, R * 0.25, 0.8 * S.hflash * A); }
        // lampo dell'impatto (accio)
        if (S.flash > 0.01) blob([235, 250, 255], C.x, C.y, R * 1.6, 0.35 * S.flash * A);
        // Finite: un luccichio che annulla l'incantesimo
        if (S.sparkle > 0.01) { const g = S.sparkle; blob([200, 255, 245], C.x, C.y, R * (1 + 1.4 * (1 - g)), 0.4 * g * A); }
        // colpito dalla gelatina: lampo viola che si allarga
        if (S.gflash > 0.01) { const g = S.gflash; blob([170, 90, 255], C.x, C.y, R * (1.2 + 1.6 * (1 - g)), 0.55 * g * A); blob([245, 225, 255], C.x, C.y, R * 0.8 * g, 0.5 * g * A); }

        // occhi 3D
        const Rs = 0.86 * Reff, er = 0.25 * Reff * ES * (S.eyeBig || 1);
        er0e = er;
        const ap = S.blinkT > 0 ? Math.abs(Math.cos(Math.PI * (1 - S.blinkT / BL))) : 1;
        // durante il battito si spegne anche l'alone: la chiusura si vede bene
        const apH = 0.25 + 0.75 * ap;
        const eyes = [];
        [-0.46, 0.46].forEach((lon0, idx) => {
          const Lg = lon0 + C.turn * 0.95, B = -0.05 - C.pitch * 0.4; // occhi un po' piu' in basso
          const ej = (S.ej && S.ej[idx]) || { x: 0, y: 0 };
          const jx = ej.x, jy = ej.y;
          eyes.push({ idx: idx, x: C.x + Rs * Math.sin(Lg) * Math.cos(B) + jx, y: C.y - Rs * Math.sin(B) + (S.eyeDy || 0) + jy, z: Math.cos(Lg) * Math.cos(B), L: Lg, B: B });
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
        // "maschera noBK": come la maschera, ma invece del nero un tono scuro del colore del corpo
        if (OV === 'maschera' || OV === 'maschera noBK' || OV === 'mix' || OV === 'sfera') {
          const vs = eyes.filter((e) => e.z > 0.02);
          if (vs.length) {
            const mx = vs.reduce((s, e) => s + e.x, 0) / vs.length, my = vs.reduce((s, e) => s + e.y, 0) / vs.length;
            let mk = mixC([3, 8, 34], [40, 6, 0]);
            if (OV === 'maschera noBK') {
              const bc = mix3(col('outer', tint), AQUA.outer, 0.45 * (1 - tint) * (1 - (S.purp || 0)));
              mk = q8([bc[0] * 0.1, bc[1] * 0.1, bc[2] * 0.1]);
            }
            ctx.globalCompositeOperation = 'source-over';
            if (OV === 'maschera noBK') {
              // l'alone si disegna dopo, insieme al bianco, con la sua stessa forma
            } else {
              blob(mk, mx, my, er * 4.6, 0.5 * A);
              for (const e of vs) eblob(mk, e, 0, 0, er * 2.7, 0.65 * A);
            }
          }
        }

        // 1) aloni dietro agli occhi
        for (const e of eyes) {
          if (e.z <= 0.02) continue;
          e.vis = Math.min(1, (e.z - 0.02) / 0.25);
          e.rw = Math.max(0.3, er * Math.cos(e.L) / Math.cos(0.46));
          // chiusi non spariscono: restano una linea spessa
          const rawH = Math.cos(e.B) / Math.cos(0.06) * ap * (1 - S.squint);
          e.rh = Math.max(er * 0.2, er * rawH);
          // quanto e' chiuso: da 0 (aperto) a 1 (chiuso -> resta solo la pennellata delle ciglia)
          e.cl = Math.max(0, Math.min(1, (0.42 - rawH) / 0.27));
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
          if (OV === 'maschera' || OV === 'maschera noBK' || OV === 'cartoon' || OV === 'mix' || OV === 'sfera') continue;
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
          // occhio chiuso: arco delle ciglia (pancia in basso), piu' spesso al centro e appuntito ai lati
          const lashPts = () => {
            const kx = Math.max(0.35, e.rw / er), out = [];
            for (let i = 0; i <= 20; i++) {
              const t = i / 20, u = t * 2 - 1;
              out.push({ x: e.x + u * er * 1.05 * kx, y: e.y + er * (0.1 + 0.24 * (1 - u * u)), w: er * 0.22 * Math.pow(Math.sin(Math.PI * t), 0.8) + er * 0.02 });
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
          // dk: se passato, disegna la stessa forma tutta in quel colore scuro (serve per l'alone "maschera noBK")
          const drawWhite = (edge, dk, ak) => {
            const vA = va * (ak == null ? 1 : ak);
            const ce = dk || col('eye', tint);
            const ed = dk || (Array.isArray(edge) ? edge : mixC([200, 235, 255], [255, 220, 190]));
            const c3 = (c) => Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
            const sh = 1 + 0.035 * Math.sin(time * 7.3 + e.idx * 2.1);
            ctx.globalCompositeOperation = 'source-over';
            if (S.smile) {
              // occhi felici a ciglio, con i bordi sfumati
              const sp = smilePts();
              for (const st of [[2.2, 0.14, ed], [1.5, 0.4, ed], [1, 1, dk || [255, 255, 255]]]) {
                ctx.globalAlpha = vA * st[1]; ctx.fillStyle = 'rgb(' + c3(st[2]) + ')';
                fillStroke(sp, st[0] * sh);
              }
              return;
            }
            const cl = e.cl || 0;
            if (cl > 0.01) {
              // occhio chiuso: pennellata delle ciglia ad arco verso il basso, assottigliata alle punte
              const lp = lashPts();
              for (const st of [[2.2, 0.14, ed], [1.5, 0.4, ed], [1, 1, dk || [255, 255, 255]]]) {
                ctx.globalAlpha = vA * st[1] * cl; ctx.fillStyle = 'rgb(' + c3(st[2]) + ')';
                fillStroke(lp, st[0] * sh);
              }
              if (cl > 0.99) return;
            }
            const vO = vA * (1 - cl);
            const kx = Math.max(0.05, e.rw / er) * sh, ky = Math.max(0.03, e.rh / er) * (2 - sh);
            const R1 = er * 1.12;
            ctx.save();
            ctx.translate(e.x, e.y); ctx.scale(kx, ky);
            const paint = (c2) => {
              const g = c2.createRadialGradient(0, -er * 0.22, 0, 0, 0, R1);
              g.addColorStop(0, dk ? 'rgba(' + c3(dk) + ',1)' : 'rgba(255,255,255,1)');
              g.addColorStop(0.5, 'rgba(' + c3(ce) + ',1)');
              g.addColorStop(0.78, 'rgba(' + c3(ed) + ',0.97)');
              g.addColorStop(0.9, 'rgba(' + c3(ed) + ',0.45)');
              g.addColorStop(1, 'rgba(' + c3(ed) + ',0)');
              c2.fillStyle = g;
              c2.beginPath(); c2.arc(0, 0, R1, 0, Math.PI * 2); c2.fill();
            };
            const bw = S.brow || 0;
            if (Math.abs(bw) > 0.02) {
              // occhio arrabbiato / preoccupato: la palpebra inclinata sfuma, non taglia
              const N = 192, k2 = (N / 2) / (R1 * 1.25);
              const off = self._lidCv || (self._lidCv = document.createElement('canvas'));
              if (off.width !== N) { off.width = N; off.height = N; }
              const g2 = off.getContext('2d');
              g2.setTransform(1, 0, 0, 1, 0, 0); g2.globalCompositeOperation = 'source-over'; g2.globalAlpha = 1; g2.clearRect(0, 0, N, N);
              g2.setTransform(k2, 0, 0, k2, N / 2, N / 2);
              paint(g2);
              const dIn = e.x < C.x ? 1 : -1, y0 = -R1 + Math.abs(bw) * R1 * (bw > 0 ? 0.66 : 0.46), sl = bw * 0.6 * dIn;
              const nl = Math.hypot(sl, 1), nx = -sl / nl, ny = 1 / nl, soft = R1 * 0.32;
              const lg = g2.createLinearGradient(-nx * soft, y0 - ny * soft, nx * soft, y0 + ny * soft);
              lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
              g2.globalCompositeOperation = 'destination-out'; g2.fillStyle = lg; g2.fillRect(-4 * R1, -4 * R1, 8 * R1, 8 * R1);
              g2.globalCompositeOperation = 'source-over';
              ctx.globalAlpha = vO; ctx.drawImage(off, -N / 2 / k2, -N / 2 / k2, N / k2, N / k2);
            } else { ctx.globalAlpha = vO; paint(ctx); }
            ctx.restore();
          };
          // alone "maschera noBK": tono scuro del corpo con la STESSA forma dell'occhio (battito, palpebra, sorriso, crucio)
          const haloNoBK = () => {
            // e' la sagoma dell'occhio stesso (aperto, chiuso a ciglio, palpebra, sorriso), colorata scura e sfocata:
            // la sagoma vera si disegna fuori dal riquadro e qui arriva solo la sua ombra morbida, senza bordi
            const bc = mix3(col('outer', tint), AQUA.outer, 0.45 * (1 - tint) * (1 - (S.purp || 0)));
            // non nero: lo stesso colore del corpo, solo piu' scuro e profondo
            const dk = [bc[0] * 0.45, bc[1] * 0.45, bc[2] * 0.5], dks = 'rgb(' + dk.map(Math.round).join(',') + ')';
            const m = ctx.getTransform ? ctx.getTransform() : { a: 1, b: 0, d: 1 }, dp = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
            const OFF = (ctx.canvas ? ctx.canvas.width : 2000) / dp + er * 6;
            // la sfocatura segue l'altezza dell'occhio: chiuso o stretto -> alone basso e allungato, mai un cerchio
            const hk = S.smile ? 0.55 : Math.max(0.35, Math.min(1, (1 - (e.cl || 0)) * e.rh / er));
            // [ingrandimento, sfocatura, intensita']
            for (const ps of [[1.6, 1.4, 0.85], [1.3, 0.9, 0.8], [1.1, 0.5, 0.6]]) {
              ctx.save();
              ctx.translate(e.x + OFF, e.y); ctx.scale(ps[0], 1 + (ps[0] - 1) * hk); ctx.translate(-e.x, -e.y);
              ctx.shadowColor = dks; ctx.shadowOffsetX = -OFF * m.a; ctx.shadowOffsetY = -OFF * (m.b || 0); ctx.shadowBlur = er * ps[1] * (0.4 + 0.6 * hk) * dp;
              drawWhite(ec, dk, ps[2]);
              ctx.restore();
            }
            ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
          };
          if (S.smile) {
            if (OV === 'maschera noBK') haloNoBK();
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
          } else if (OV === 'maschera noBK') {
            haloNoBK();
            ctx.globalCompositeOperation = 'lighter';
            eblob(ecol, e, 0, 0, eb * 1.1, 0.8 * apH * va);
            drawWhite(ec);
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
        // fiammella in testa e fumo (incendio)
        for (const f of flame) {
          const sv = f.age / f.life;
          if (f.smoke) { blob([70, 90, 120], f.x, f.y, f.r * (1 + 2.2 * sv), 0.1 * (1 - sv) * A, f.z); continue; }
          // fuoco: cuore bianco piccolo, poi giallo, arancio e rosso ben presenti; sfumato, non a pallini
          const c = sv < 0.15 ? mix3([255, 236, 170], [255, 190, 60], sv / 0.15)
            : sv < 0.5 ? mix3([255, 190, 60], [255, 105, 20], (sv - 0.15) / 0.35)
            : mix3([255, 105, 20], [190, 30, 8], (sv - 0.5) / 0.5);
          const a = (sv < 0.1 ? sv / 0.1 : 1) * Math.pow(1 - sv, 1.1) * A;
          // un po' di colore "coprente" per non sparire sull'azzurro, ma largo e morbido
          ctx.globalCompositeOperation = 'source-over';
          blob(q8(mix3(c, [120, 30, 5], 0.25)), f.x, f.y, f.r * 1.6, a * 0.18, f.z);
          ctx.globalCompositeOperation = 'lighter';
          blob(q8(c), f.x, f.y, f.r * 1.25 * (1 - 0.3 * sv), a * 0.42, f.z);
          blob([255, 120, 30], f.x, f.y, f.r * 2.6, a * 0.08, f.z);
          if (sv < 0.25) blob([255, 248, 225], f.x, f.y, f.r * 0.55, a * 0.4 * (1 - sv / 0.25), f.z);
        }
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
      if (zpx) {
        // angolo coperto: nero pieno sulla zona, che sfuma dolcemente verso il resto della scena
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const r0 = Math.hypot(zpx.w, zpx.h), r1 = r0 * 2.2;
        const g = ctx.createRadialGradient(zpx.cx, zpx.cy, 0, zpx.cx, zpx.cy, r1);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(r0 / r1, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
        if (Z.show) {
          // anteprima: dove mettere il nastro
          ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,220,120,0.95)';
          ctx.strokeRect(zpx.x + 2, zpx.y + 2, zpx.w - 4, zpx.h - 4); ctx.setLineDash([]);
        }
      }
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
  const FXK = { incendio: 1, gelatina: 1, accio: 1, vieni: 1 };
  window.Wisp = {
    start(canvas) { wisp._cv = canvas; wisp._audio(); wisp._run(); },
    unlockAudio() { wisp._audio(); },
    // angolo coperto: { on, corner: 'tr'|'tl'|'br'|'bl', w, h (dp), show }
    setZone(z) { wisp._zone = z; },
    // comandi: crucio, finite (stop), ciao, incendio, gelatina, accio, vieni
    command(cmd) {
      wisp._audio();
      if (cmd === 'crucio') wisp._crucioCmd = true;
      else if (cmd === 'finite' || cmd === 'stop') wisp._stopCmd = true;
      else if (cmd === 'ciao') wisp._ciaoCmd = true;
      else if (FXK[cmd]) wisp._fxCmd = cmd;
    },
    // stato attuale (per i test): 'normal', 'crucio', 'incendio', ...
    mode() { return wisp._S ? wisp._S.mode : null; },
    // l'animazione la mette in pausa la WebView stessa; qui solo l'audio
    pause() { if (wisp._ac) { try { wisp._ac.suspend(); } catch (e) {} } },
    resume() { if (wisp._ac) { try { wisp._ac.resume(); } catch (e) {} } }
  };
})();
