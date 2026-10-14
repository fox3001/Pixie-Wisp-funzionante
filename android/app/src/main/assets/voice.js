// Riconoscimento dei comandi vocali (stessa logica di _check_text in main.py).
// Riceve il testo capito dal microfono e restituisce 'crucio', 'stop', 'ciao' o null.
(function () {
  const D = {"commands": {"crucio": "crucio", "krucio": "crucio", "cruzio": "crucio", "cruccio": "crucio", "crucchio": "crucio", "crocio": "crucio", "grucio": "crucio", "krutio": "crucio", "crucioo": "crucio", "crutio": "crucio", "crucyo": "crucio", "trucio": "crucio", "crusio": "crucio", "cruscio": "crucio", "crucial": "crucio", "crusho": "crucio", "kurucio": "crucio", "gruccio": "crucio", "cruxio": "crucio", "crucco": "crucio", "crrrucio": "crucio", "crrruccio": "crucio", "crrucio": "crucio", "crrucchio": "crucio", "crrruzio": "crucio", "stop": "stop", "stopp": "stop", "stoop": "stop", "stob": "stop", "shtop": "stop", "istop": "stop", "estop": "stop", "stap": "stop", "stup": "stop", "sdop": "stop", "strop": "stop", "ztop": "stop", "stock": "stop", "stoppo": "stop", "ciao": "ciao", "ciau": "ciao", "chao": "ciao", "tchao": "ciao", "cia": "ciao", "ciaoo": "ciao", "siao": "ciao", "ziao": "ciao", "ciauu": "ciao", "ciaoh": "ciao", "ciaone": "ciao", "sau": "ciao", "chiau": "ciao", "yao": "ciao"}, "targets": {"crucio": ["crucio", "krucio", "cruzio", "cruccio", "crucchio", "crocio", "grucio", "krutio", "crucioo", "crutio", "crucyo", "trucio", "crusio", "cruscio", "crucial", "crusho", "kurucio", "gruccio", "cruxio", "crucco", "crrrucio", "crrruccio", "crrucio", "crrucchio", "crrruzio"], "stop": ["stop", "stopp", "stoop", "stob", "shtop", "istop", "estop", "stap", "stup", "sdop", "strop", "ztop", "stock", "stoppo"], "ciao": ["ciao", "ciau", "chao", "tchao", "cia", "ciaoo", "siao", "ziao", "ciauu", "ciaoh", "ciaone", "sau", "chiau", "yao"]}, "shapes": {"crucio": "^[ckgt]u?r+[uoi]*[cstzx]", "stop": "^[ei]?[sz][tdc]?r?[aou]+[pbkc]", "ciao": "^[csztyg]i?a[ou]?(ne|h)?$"}, "notCommands": ["ca", "cane", "cha", "chris", "christi", "christian", "christie", "christina", "christine", "christmas", "christopher", "church", "churchill", "cricca", "criceto", "cricket", "crisi", "crisis", "cristalli", "cristallo", "cristian", "cristiana", "cristiane", "cristiani", "cristiano", "cristina", "cristo", "criteri", "criterio", "critica", "criticano", "criticare", "criticata", "criticate", "criticato", "critiche", "critici", "criticita", "critico", "croccante", "croce", "crocetta", "crocevia", "croci", "crociata", "crociate", "crociati", "crociato", "crociera", "crociere", "cross", "crossover", "crosta", "crostacei", "crostata", "crotone", "crozza", "cruise", "crusca", "cruscotto", "curiosa", "curiose", "curiosi", "curiosita", "curioso", "curtis", "gia", "gross", "grossa", "grosse", "grosseto", "grossi", "grosso", "grotta", "grotte", "grottesco", "isaac", "isacco", "kris", "kristen", "kurt", "sa", "saba", "sacca", "sacche", "sacchi", "sacco", "sachs", "sacro", "sane", "sap", "saper", "sappi", "sapra", "sapro", "scacchi", "scacco", "scappa", "scappi", "scappo", "scocca", "scoop", "scopa", "scopano", "scopato", "scope", "scopi", "scopo", "scoppia", "scoppio", "scopre", "scopri", "scopro", "scotch", "shah", "shane", "shock", "shop", "sia", "soap", "soccer", "soci", "socia", "socio", "sopra", "stabia", "stacca", "stacchi", "stacco", "stack", "stracci", "strappa", "strappi", "strappo", "stucchi", "stucco", "stupida", "stupide", "stupidi", "stupido", "stupire", "stupita", "stupito", "stupore", "stupri", "stupro", "subi", "succhi", "succo", "sup", "super", "tao", "trick", "tricolore", "tris", "tristan", "triste", "tristi", "trota", "truccato", "trucchi", "trucco", "trust", "truth", "turca", "turche", "turchi", "turchia", "turco", "turismo", "turista", "turisti", "turistico", "ya", "zack", "zappa", "zia", "zoppo", "zucca", "zuppa"], "phrases": {"crucio": ["echoinsania", "ecoinsania", "ecinsania", "eccoinsania", "ecoinsanja", "ecoinsana", "ecoinsonia", "ecoinzania", "egoinsania", "ecoensania", "insania"]}};
  const SHAPES = {};
  for (const k in D.shapes) SHAPES[k] = new RegExp(D.shapes[k]);
  const NOT = new Set(D.notCommands);
  const PHRASE_CORE = /[ie]n[sz][ao]/;

  const normalize = (text) => {
    if (!text) return '';
    let t = String(text).toLowerCase().trim();
    t = t.replace(/à/g, 'a').replace(/[èé]/g, 'e').replace(/ì/g, 'i').replace(/ò/g, 'o').replace(/ù/g, 'u');
    let out = '';
    for (const ch of t) out += (/[\p{L}\p{N}]/u.test(ch) || /\s/.test(ch)) ? ch : ' ';
    return out.split(/\s+/).filter(Boolean).join(' ');
  };
  const REPS = [['sch', 'sc'], ['tch', 'c'], ['ch', 'c'], ['sh', 's'], ['zh', 'z'], ['kh', 'k'], ['ph', 'f'], ['qu', 'cu'],
    ['oo', 'o'], ['uu', 'u'], ['ii', 'i'], ['aa', 'a'], ['tt', 't'], ['cc', 'c'], ['zz', 'z']];
  const squash = (w) => {
    if (!w) return '';
    for (const [a, b] of REPS) w = w.split(a).join(b);
    return w.split(' ').join('');
  };
  const lev = (a, b) => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = [];
    for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost));
      }
      prev = cur;
    }
    return prev[b.length];
  };
  const bestForWord = (word, loose, maxdiff, strict) => {
    if (maxdiff == null) maxdiff = 1;
    const raw = normalize(word);
    if (!raw) return null;
    const sq = squash(raw);
    if (D.commands[raw]) return D.commands[raw];
    if (D.commands[sq]) return D.commands[sq];
    if (NOT.has(raw) || NOT.has(sq)) return null;
    let best = null, bd = 999;
    for (const cmd in D.targets) {
      if (!SHAPES[cmd].test(sq)) continue;
      for (const variant of D.targets[cmd]) {
        const v = squash(variant);
        if (Math.abs(v.length - sq.length) > maxdiff) continue;
        const d = lev(sq, v);
        if (d < bd) { bd = d; best = cmd; }
      }
    }
    if (strict) return bd <= (best === 'crucio' ? 2 : 1) ? best : null;
    if (best === 'stop' && bd <= (sq.length <= 3 ? 1 : 3)) return best;
    if (best === 'ciao' && bd <= (sq.length <= 3 ? 1 : 3)) return best;
    if (best === 'crucio' && (bd <= 4 || (loose && bd <= 5 && sq.length >= 5))) return best;
    return null;
  };
  const checkPhrases = (full) => {
    const joined = squash(full.split(' ').join(''));
    if (!joined) return null;
    for (const cmd in D.phrases) {
      for (const ph of D.phrases[cmd]) {
        const p = squash(ph), n = p.length, tol = n <= 7 ? 1 : 3;
        for (let ln = Math.max(1, n - tol); ln <= n + tol; ln++) {
          for (let i = 0; i < Math.max(1, joined.length - ln + 1); i++) {
            const win = joined.slice(i, i + ln);
            if (!PHRASE_CORE.test(win)) continue;
            if (lev(win, p) <= tol) return cmd;
          }
        }
      }
    }
    return null;
  };
  const checkText = (text) => {
    const full = normalize(text);
    if (!full) return null;
    let cmd = checkPhrases(full);
    if (cmd) return cmd;
    cmd = bestForWord(full, false, 1, full.indexOf(' ') >= 0);
    if (cmd) return cmd;
    const words = full.split(' ');
    for (const w of words) { cmd = bestForWord(w, true, 3, false); if (cmd) return cmd; }
    if (words.length >= 2) for (let i = 0; i < words.length - 1; i++) { cmd = bestForWord(words[i] + words[i + 1], false, 1, true); if (cmd) return cmd; }
    cmd = bestForWord(words.join(''), false, 1, true);
    return cmd || null;
  };
  const api = { checkText: checkText };
  if (typeof module !== 'undefined') module.exports = api; else window.VoiceMatch = api;
})();
