// Riconoscimento dei comandi vocali.
// Riceve il testo capito dal microfono (riconoscimento in italiano) e restituisce il comando o null:
//   'crucio'   «Crucio», «Echo Insania»
//   'finite'   «Finite», «Finite Incantatem»  (ferma qualunque incantesimo)
//   'ciao'     «Ciao»
//   'incendio' «Incendio»
//   'accio'    «Accio»
//   'gelatina' «Locomotor Wibbly», «Epoximise»
//   'vieni'    «Vieni qui», «Dai vieni qui»
// Tolleranza: il riconoscimento scrive le parole magiche in tanti modi diversi ("a cio", "epoxy mise",
// "loco motor ubli"...): si confronta la parola "schiacciata" (senza doppie, ch->c, ...) con le varianti
// note e si accetta una piccola distanza; le parole italiane comuni simili sono escluse.
(function () {
  // ---- parole singole: varianti note di ogni comando
  const TARGETS = {
    crucio: ['crucio', 'krucio', 'cruzio', 'cruccio', 'crucchio', 'crocio', 'grucio', 'krutio', 'crucioo', 'crutio', 'crucyo', 'trucio', 'crusio', 'cruscio', 'crucial', 'crusho', 'kurucio', 'gruccio', 'cruxio', 'crucco', 'crrrucio', 'crrruccio', 'crrucio', 'crrucchio', 'crrruzio'],
    finite: ['finite', 'finiti', 'finitè', 'fenite', 'phinite', 'finnite', 'finitte', 'finitey', 'finitee', 'finit', 'feenite', 'finaite'],
    ciao: ['ciao', 'ciau', 'chao', 'tchao', 'cia', 'ciaoo', 'siao', 'ziao', 'ciauu', 'ciaoh', 'ciaone', 'sau', 'chiau', 'yao'],
    incendio: ['incendio', 'incendi', 'incendia', 'insendio', 'encendio', 'incendios', 'inchendio', 'insendjo', 'incendiu', 'incenzio', 'ingendio'],
    accio: ['accio', 'acio', 'ascio', 'asio', 'acchio', 'achio', 'atcio', 'axio', 'hacio', 'akkio', 'acciu', 'accioh', 'aciu', 'atchio', 'aschio', 'ahcio', 'haccio'],
    gelatina: ['locomotor', 'locomoto', 'locomotore', 'lokomotor', 'locomotar', 'locomotur', 'wibbly', 'wibly', 'uibli', 'wibli', 'vibli', 'uibbli', 'wiblì', 'uiblì',
      'epoximise', 'epoxymise', 'epoximize', 'epoxymize', 'epossimise', 'eposimise', 'epossimais', 'epoximais', 'epoksimise', 'epossimize', 'epocsimise', 'epoxsimise', 'epoximaise', 'epossimaiz']
  };
  // forma che la parola (schiacciata) deve avere per essere confrontata con un comando
  const SHAPES = {
    crucio: /^[ckgt]u?r+[uoi]*[cstzx]/,
    finite: /^(f|ph)[ie]+n+[ai]?[ie]*t/,
    ciao: /^[csztyg]i?a[ou]?(ne|h)?$/,
    incendio: /^[ie]n[cstzg]/,
    accio: /^h?a[cstxzk]+[iy]?[aeiou]?h?$/,
    gelatina: /^(lo[ck]o|[wuvb]i?b+l|[uw]i?bl|e?p+o[xksc])/
  };
  // distanza massima accettata (parola da sola / dentro una frase lunga)
  const MAXD = {
    crucio: (n, loose) => (loose && n >= 5 ? 5 : 4),
    finite: (n) => (n <= 5 ? 1 : 2),
    ciao: (n) => (n <= 3 ? 1 : 3),
    incendio: () => 1,
    accio: (n) => (n >= 4 ? 1 : 0),
    gelatina: (n) => (n <= 5 ? 1 : n <= 8 ? 2 : 3)
  };
  // frasi: si cercano anche spezzate in piu' parole ("echo in sania", "loco motor ubli", "vieni qui")
  const PHRASES = {
    crucio: { core: /[ie]n[sz][ao]/, list: ['echoinsania', 'ecoinsania', 'ecinsania', 'eccoinsania', 'ecoinsanja', 'ecoinsana', 'ecoinsonia', 'ecoinzania', 'egoinsania', 'ecoensania', 'insania'] },
    finite: { core: /^fin|fin[ie]t/, list: ['finiteincantatem', 'finiteincantatum', 'finiteincantem', 'finiteincantum', 'finitincantatem'] },
    // («Epoximise» spezzato in piu' parole lo ricompone il controllo sulle parole unite)
    gelatina: { core: /mot|bl/, list: ['locomotorwibbly', 'locomotorwibli', 'locomotoruibli', 'locomotorubli', 'locomotorvibli', 'locomotorbibli', 'locomotoreuibli', 'locomotowibbly', 'locomotouibli'] },
    vieni: { core: /ieni/, tol: 1, list: ['vieniqui', 'vieniqua', 'daivieniqui', 'bieniqui', 'vienigui'] }
  };
  // parole italiane comuni che somigliano a un comando ma non lo sono
  const NOT = new Set(['ca', 'cane', 'cha', 'chris', 'christi', 'christian', 'christie', 'christina', 'christine', 'christmas', 'christopher', 'church', 'churchill', 'cricca', 'criceto', 'cricket', 'crisi', 'crisis', 'cristalli', 'cristallo', 'cristian', 'cristiana', 'cristiane', 'cristiani', 'cristiano', 'cristina', 'cristo', 'criteri', 'criterio', 'critica', 'criticano', 'criticare', 'criticata', 'criticate', 'criticato', 'critiche', 'critici', 'criticita', 'critico', 'croccante', 'croce', 'crocetta', 'crocevia', 'croci', 'crociata', 'crociate', 'crociati', 'crociato', 'crociera', 'crociere', 'cross', 'crossover', 'crosta', 'crostacei', 'crostata', 'crotone', 'crozza', 'cruise', 'crusca', 'cruscotto', 'curiosa', 'curiose', 'curiosi', 'curiosita', 'curioso', 'curtis', 'gia', 'gross', 'grossa', 'grosse', 'grosseto', 'grossi', 'grosso', 'grotta', 'grotte', 'grottesco', 'isaac', 'isacco', 'kris', 'kristen', 'kurt', 'sa', 'saba', 'sacca', 'sacche', 'sacchi', 'sacco', 'sachs', 'sacro', 'sane', 'sap', 'saper', 'sappi', 'sapra', 'sapro', 'scacchi', 'scacco', 'scappa', 'scappi', 'scappo', 'scocca', 'scoop', 'scopa', 'scopano', 'scopato', 'scope', 'scopi', 'scopo', 'scoppia', 'scoppio', 'scopre', 'scopri', 'scopro', 'scotch', 'shah', 'shane', 'shock', 'shop', 'sia', 'soap', 'soccer', 'soci', 'socia', 'socio', 'sopra', 'stabia', 'stacca', 'stacchi', 'stacco', 'stack', 'stracci', 'strappa', 'strappi', 'strappo', 'stucchi', 'stucco', 'stupida', 'stupide', 'stupidi', 'stupido', 'stupire', 'stupita', 'stupito', 'stupore', 'stupri', 'stupro', 'subi', 'succhi', 'succo', 'sup', 'super', 'tao', 'trick', 'tricolore', 'tris', 'tristan', 'triste', 'tristi', 'trota', 'truccato', 'trucchi', 'trucco', 'trust', 'truth', 'turca', 'turche', 'turchi', 'turchia', 'turco', 'turismo', 'turista', 'turisti', 'turistico', 'ya', 'zack', 'zappa', 'zia', 'zoppo', 'zucca', 'zuppa',
    // incendio / accio / finite / gelatina
    'intenso', 'intensa', 'intendo', 'intende', 'intendi', 'intendere', 'incentivo', 'incendiare', 'incensi', 'incenso', 'indendo', 'invento', 'inverno', 'insieme', 'intero', 'interno', 'ingenuo', 'incerto', 'incerta', 'indizio', 'inizio', 'incidente',
    'asia', 'ascia', 'acido', 'acida', 'azioni', 'azione', 'asse', 'ascesa', 'ace', 'aceto', 'acqua', 'ago', 'agio', 'abito', 'atto', 'azzo', 'assai', 'asso', 'accento', 'accesso', 'acceso', 'accese', 'acciaio', 'accade', 'accanto', 'assi', 'astio', 'aci', 'azio',
    'finta', 'finto', 'finti', 'finte', 'fine', 'finire', 'finito', 'finita', 'finitura', 'fenice', 'fiat', 'fitte', 'fante', 'finanza', 'finale', 'fiocco', 'finestre', 'finestra',
    'locale', 'locali', 'loco', 'locomotiva', 'motore', 'motori', 'bibbia', 'bibita', 'biblioteca', 'epoca', 'epoche', 'esposto', 'esposizione', 'epico', 'epica', 'opposto', 'posso', 'possa', 'possiamo', 'epossibile', 'possibile', 'impossibile']);

  const normalize = (text) => {
    if (!text) return '';
    let t = String(text).toLowerCase().trim();
    t = t.replace(/[àá]/g, 'a').replace(/[èé]/g, 'e').replace(/[ìí]/g, 'i').replace(/[òó]/g, 'o').replace(/[ùú]/g, 'u');
    let out = '';
    for (const ch of t) out += (/[\p{L}\p{N}]/u.test(ch) || /\s/.test(ch)) ? ch : ' ';
    return out.split(/\s+/).filter(Boolean).join(' ');
  };
  const REPS = [['sch', 'sc'], ['tch', 'c'], ['ch', 'c'], ['sh', 's'], ['zh', 'z'], ['kh', 'k'], ['ph', 'f'], ['qu', 'cu'], ['ck', 'k'],
    ['oo', 'o'], ['uu', 'u'], ['ii', 'i'], ['aa', 'a'], ['ee', 'e'], ['tt', 't'], ['cc', 'c'], ['zz', 'z'], ['bb', 'b'], ['nn', 'n'], ['ss', 's'], ['ll', 'l'], ['kk', 'k'], ['pp', 'p'], ['mm', 'm']];
  const squash = (w) => {
    if (!w) return '';
    w = normalize(w);
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

  // tabelle precalcolate
  const EXACT = {};
  const SQT = {};
  for (const cmd in TARGETS) {
    SQT[cmd] = [];
    for (const v of TARGETS[cmd]) { const q = squash(v); EXACT[normalize(v)] = cmd; EXACT[q] = cmd; if (SQT[cmd].indexOf(q) < 0) SQT[cmd].push(q); }
  }
  const SQNOT = new Set(); for (const w of NOT) { SQNOT.add(w); SQNOT.add(squash(w)); }
  const SQPH = {};
  for (const cmd in PHRASES) SQPH[cmd] = PHRASES[cmd].list.map(squash);

  const bestForWord = (word, loose, maxdiff, strict) => {
    const raw = normalize(word).split(' ').join('');
    if (!raw) return null;
    const sq = squash(raw);
    if (EXACT[raw]) return EXACT[raw];
    if (EXACT[sq]) return EXACT[sq];
    if (SQNOT.has(raw) || SQNOT.has(sq)) return null;
    let best = null, bd = 999;
    for (const cmd in SQT) {
      if (!SHAPES[cmd].test(sq)) continue;
      for (const v of SQT[cmd]) {
        if (Math.abs(v.length - sq.length) > maxdiff) continue;
        const d = lev(sq, v);
        if (d < bd) { bd = d; best = cmd; }
      }
    }
    if (!best) return null;
    let lim = MAXD[best](sq.length, loose);
    if (strict) lim = Math.min(lim, best === 'crucio' ? 2 : 1);
    return bd <= lim ? best : null;
  };
  const checkPhrases = (full) => {
    const joined = squash(full);
    if (!joined) return null;
    for (const cmd in SQPH) {
      const core = PHRASES[cmd].core;
      for (const p of SQPH[cmd]) {
        const n = p.length, tol = PHRASES[cmd].tol != null ? PHRASES[cmd].tol : n <= 7 ? 1 : n <= 9 ? 2 : 3;
        for (let ln = Math.max(1, n - tol); ln <= n + tol; ln++) {
          for (let i = 0; i < Math.max(1, joined.length - ln + 1); i++) {
            const win = joined.slice(i, i + ln);
            if (!core.test(win)) continue;
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
  // elenco leggibile dei comandi (per il menu impostazioni)
  const LIST = [
    ['incendio', 'Incendio', ['Incendio']],
    ['gelatina', 'Gelatina', ['Locomotor Wibbly', 'Epoximise']],
    ['accio', 'Accio', ['Accio']],
    ['vieni', 'Vieni qui', ['Vieni qui', 'Dai vieni qui']],
    ['crucio', 'Crucio', ['Crucio', 'Echo Insania']],
    ['finite', 'Finite', ['Finite', 'Finite Incantatem']],
    ['ciao', 'Ciao', ['Ciao']]
  ];
  const api = { checkText: checkText, LIST: LIST };
  if (typeof module !== 'undefined') module.exports = api; else window.VoiceMatch = api;
})();
