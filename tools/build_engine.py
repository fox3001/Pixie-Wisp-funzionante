#!/usr/bin/env python3
"""Rigenera android/app/src/main/assets/engine.js dal mockup CorpoScintille.dc.html.
Uso: python3 tools/build_engine.py design/CorpoScintille.dc.html android/app/src/main/assets/engine.js "occhi=maschera noBK"
"""
import sys, re, html, json

src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
props = json.loads(html.unescape(re.search(r'data-props="([^"]*)"', s).group(1)))
a = s.index('class Component extends DCLogic {')
b = s.index('  renderVals() {', a)
code = s[a:b].rstrip() + '\n}\n'

def rep(old, new, count=1):
    global code
    n = code.count(old)
    assert n == count, (n, old[:90])
    code = code.replace(old, new)

# lamento: dal file lament.js invece che dal blob del mockup
rep("""      fetch('/_blob/c6cafc5a6419402041aceeb351c79972')
        .then((r) => r.arrayBuffer())""",
"""      Promise.resolve(window.LAMENT_B64 || '')
        .then((b64) => { if (!b64) throw new Error('no lament'); const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; })""")

# larghezza della scena che segue lo schermo
rep("    const LW = 760, LH = 440, R = 120.8 * ((self.props && +self.props.grandezza) || 1);\n",
"""    // l'altezza della scena e' fissa (440): la larghezza segue lo schermo, cosi' la creatura
    // non si deforma mai e su schermi piu' lunghi ha solo piu' spazio ai lati
    const LH = 440, R = 120.8 * ((self.props && +self.props.grandezza) || 1);
    let LW = 760;
""")
rep("    const DEPTH = LH * 1.5, FOC = 650, VX = LW / 2, VY = LH / 2;\n",
    "    const DEPTH = LH * 1.5, FOC = 650, VY = LH / 2;\n    let VX = LW / 2;\n")
rep("const C = { x: 380, y: 260, vx: 0, vy: 0, tx: 380, ty: 260,", "const C = { x: VX, y: 260, vx: 0, vy: 0, tx: VX, ty: 260,")
rep("    const ptr = { active: false, touch: false, x: 380, y: 260 };\n",
"""    const ptr = { active: false, touch: false, x: VX, y: 260 };
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
""")
rep("""      C.tz = rnd(0, DEPTH);
      const rg = rangeAt(C.tz, true);
      C.tx = rnd(rg.x0, Math.max(rg.x0, rg.x1)); C.ty = rnd(rg.y0, Math.max(rg.y0, rg.y1));
""", """      for (let k = 0; k < 12; k++) {
        C.tz = rnd(0, DEPTH);
        const rg = rangeAt(C.tz, true);
        C.tx = rnd(rg.x0, Math.max(rg.x0, rg.x1)); C.ty = rnd(rg.y0, Math.max(rg.y0, rg.y1));
        if (!inZone(C.tx, C.ty, C.tz)) break;
      }
""")
rep("""      C.tz = clamp(C.z + rnd(-90, 90), 0, DEPTH);
      const rg = rangeAt(C.tz, true);
      C.tx = clamp(C.x + rnd(-120, 120), rg.x0, Math.max(rg.x0, rg.x1)); C.ty = clamp(C.y + rnd(-60, 60), rg.y0, Math.max(rg.y0, rg.y1));
""", """      for (let k = 0; k < 12; k++) {
        C.tz = clamp(C.z + rnd(-90, 90), 0, DEPTH);
        const rg = rangeAt(C.tz, true);
        C.tx = clamp(C.x + rnd(-120, 120), rg.x0, Math.max(rg.x0, rg.x1)); C.ty = clamp(C.y + rnd(-60, 60), rg.y0, Math.max(rg.y0, rg.y1));
        if (!inZone(C.tx, C.ty, C.tz)) break;
      }
""")
rep("return { x: 380 + rnd(-2.5, 2.5), y: 220", "return { x: VX + rnd(-2.5, 2.5), y: 220")
rep("C.x = 380; C.y = 220; C.vx = 0;", "C.x = VX; C.y = 220; C.vx = 0;")

# FINITE: ferma qualunque incantesimo in corso
rep("""        else if (S.mode === 'gelatina' && S.t < 7.5) { S.t = 7.5; S.cut = 1; S.sparkle = 1; self._play('stop'); }  // si ricompone subito
      }
""", """        else if (S.mode === 'gelatina' && S.t < 7.5) { S.t = 7.5; S.cut = 1; S.sparkle = 1; self._play('stop'); }  // si ricompone subito
        else if (S.mode === 'accio' || S.mode === 'vieni') {
          // anche "accio" e "vieni qui" si interrompono: torna subito normale
          Object.assign(S, { stir: 0, svx: 0, svy: 0, lobes: null, fing: null, ftr: null, fph: null, smile: false, tgt: null, ang: 0, sparkle: 1 });
          self._play('stop'); endFx();
        }
        else if (S.mode === 'ciao') { S.sparkle = 1; self._play('stop'); }
        else if (S.mode === 'normal' && Bh.kind !== 'ouch') { calmAfter(); self._play('stop'); } // se non soffre: si calma
      }
""")

# l'angolo coperto respinge la creatura
rep("""      }

      // testa: turn e pitch
""", """      }

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
""")

# disegno: risoluzione, larghezza adattiva, zona, sfondo nero
rep("      const dpr = Math.min(2, window.devicePixelRatio || 1);", "      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // 1.5: fluido anche sui telefoni")
rep("""      const s = Math.min(cw / LW, ch / LH);
      view.s = s; view.ox = (cw - LW * s) / 2; view.oy = (ch - LH * s) / 2;
""", """      // scena larga quanto lo schermo, alta sempre 440: stessa scala in x e y
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
""")
rep("      ctx.fillStyle = '#04060b'; ctx.fillRect(0, 0, cw, ch);", "      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);")
rep("""edge(W, 0, W - f, 0, W - f, 0, f, H);
      }
    };
""", """edge(W, 0, W - f, 0, W - f, 0, f, H);
      }
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
""")
assert '380' not in re.sub(r'Math.min\(380', '', code), [l for l in code.split('\n') if '380' in l]

# proprieta' fisse = scelte fatte nei Tweaks del mockup
P = {k: v.get('default') for k, v in props.items() if not k.startswith('$')}
for k in ('saluta', 'crucio', 'finite', 'incendio', 'gelatina', 'accio', 'vieni'):
    P[k] = False
# scelte fisse per l'app (gli altri valori restano quelli dei Tweaks): occhi=... corpo=...
for kv in sys.argv[3:]:
    k, v = kv.split('=', 1)
    P[k] = v
head = """// Pixie Wisp - motore della creatura (Canvas 2D), estratto dal mockup "CorpoScintille" (Claude Design).
// Generato da build_engine.py: non modificare a mano, si rigenera dal mockup.
// Logica in coordinate 760x440 (l'altezza resta 440, la larghezza segue lo schermo).
class DCLogic {
  constructor() {
    this.props = %s;
    this.state = {};
  }
  setState() {}
}
""" % json.dumps(P, ensure_ascii=False, separators=(', ', ': '))
api = """
// ---- API usata dall'app (voce, telecomando, menu)
(function () {
  const wisp = new Component();
  const FXK = { incendio: 1, gelatina: 1, accio: 1, vieni: 1 };
  window.Wisp = {
    // impostazioni prima di start(): { grandezza: 5/3 } = creatura piu' grande di 2/3
    config(p) { Object.assign(wisp.props, p || {}); },
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
"""
open(out, 'w').write(head + code + api)
print('ok', len(head + code + api))
