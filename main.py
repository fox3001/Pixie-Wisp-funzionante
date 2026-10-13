# -*- coding: utf-8 -*-
"""
Pixie Wisp v3.4
Un fuoco fatuo (wisp) animato che reagisce ai comandi vocali in italiano:
  - "crucio" / "Echo Insania" -> il wisp soffre, si arrossa e trema
  - "stop"    -> interrompe la sofferenza e torna normale
  - "ciao"    -> saluta con un sorriso e fa una giravolta

Codice ricostruito dall'APK pixie_13.apk (org.pixiewisp.pixiewisp 3.4.0).
"""

import sys
import os
import random
import math
import re
import traceback
import tempfile
import wave
import struct
import base64

# ---------------------------------------------------------------------------
# Impostazioni SDL / Kivy (vanno messe PRIMA di importare Kivy)
# ---------------------------------------------------------------------------
# niente joystick / HID (evita crash su alcuni Android)
os.environ['SDL_JOYSTICK_HIDAPI'] = '0'
os.environ['SDL_HIDAPI_DISABLED'] = '1'
os.environ['SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS'] = '0'

# non minimizzare la finestra quando perde il focus
os.environ['SDL_VIDEO_MINIMIZE_ON_FOCUS_LOSS'] = '0'

# niente "always on top"
os.environ['SDL_ALLOW_TOPMOST'] = '0'

os.environ['KIVY_BCM_DISPMANX_ID'] = '0'

# densita' fissa: la scena e' disegnata in coordinate logiche 2400x1080
os.environ['KIVY_METRICS_DENSITY'] = '1'
os.environ['KCFG_GRAPHICS_MAXFPS'] = '60'
os.environ['KCFG_GRAPHICS_MULTISAMPLES'] = '0'


def _exc_handler(exc_type, exc_value, exc_tb):
    msg = ''.join(traceback.format_exception(exc_type, exc_value, exc_tb))
    print('[CRASH PIXIE]', msg, flush=True)
    sys.__excepthook__(exc_type, exc_value, exc_tb)


sys.excepthook = _exc_handler

try:
    from kivy.config import Config
    Config.set('graphics', 'width', '2400')
    Config.set('graphics', 'height', '1080')
    Config.set('graphics', 'fullscreen', '0')
    Config.set('graphics', 'show_cursor', '0')
    Config.set('graphics', 'multisamples', '0')
    Config.set('graphics', 'maxfps', '60')
    Config.set('input', 'mouse', 'mouse,multitouch_on_demand')
    Config.set('kivy', 'exit_on_escape', '0')
except Exception as _e:
    print('[config] Config error:', _e, flush=True)

from kivy.app import App
from kivy.core.audio import SoundLoader
from kivy.core.window import Window
from kivy.clock import Clock
from kivy.uix.widget import Widget
from kivy.uix.floatlayout import FloatLayout
from kivy.graphics import Color, Ellipse, Rectangle, Line
from kivy.graphics.texture import Texture

# Suono "crucio" (lamento del wisp) incorporato come MP3 in base64.
# Nell'originale era scritto direttamente qui (174 KB di testo):
# per comodita' e' stato spostato nel file embedded_audio.py
import embedded_audio
EMBEDDED_CRUCIO_MP3 = embedded_audio.EMBEDDED_CRUCIO_MP3

# ---------------------------------------------------------------------------
# Costanti di scena (coordinate logiche, schermo 2400 x 1080)
# ---------------------------------------------------------------------------
LW = 2400.0          # larghezza logica
LH = 1080.0          # altezza logica
WALL = 430.0         # margine dai bordi entro cui il wisp si muove
TRAIL_N = 11         # punti di scia per ogni particella
MAX_P = 14           # numero massimo di particelle
SCALE = 20.16
INNER_R = int(26 * SCALE)

# Stati del wisp
STATE_NORMAL = 'normal'
STATE_CRUCIO = 'crucio'
STATE_STOP = 'stop'
STATE_EXPLODE = 'explode'
STATE_DEAD = 'dead'
STATE_MATCH = 'match'
STATE_CIAO = 'ciao'
STATE_CALM = 'calm'   # dopo "stop" quando non sta soffrendo

# ---------------------------------------------------------------------------
# Comandi vocali: parola sentita -> comando
# (molte varianti perche' il riconoscimento vocale sbaglia spesso)
# ---------------------------------------------------------------------------
VOICE_COMMANDS = {
    # crucio
    'crucio': 'crucio',
    'krucio': 'crucio',
    'cruzio': 'crucio',
    'cruccio': 'crucio',
    'crucchio': 'crucio',
    'crocio': 'crucio',
    'grucio': 'crucio',
    'krutio': 'crucio',
    'crucioo': 'crucio',
    'crutio': 'crucio',
    'crucyo': 'crucio',
    'trucio': 'crucio',
    'crusio': 'crucio',
    'cruscio': 'crucio',
    'crucial': 'crucio',
    'crusho': 'crucio',
    'kurucio': 'crucio',
    'gruccio': 'crucio',
    'cruxio': 'crucio',
    'crucco': 'crucio',
    'crrrucio': 'crucio',
    'crrruccio': 'crucio',
    'crrucio': 'crucio',
    'crrucchio': 'crucio',
    'crrruzio': 'crucio',

    # stop
    'stop': 'stop',
    'stopp': 'stop',
    'stoop': 'stop',
    'stob': 'stop',
    'shtop': 'stop',
    'istop': 'stop',
    'estop': 'stop',
    'stap': 'stop',
    'stup': 'stop',
    'sdop': 'stop',
    'strop': 'stop',
    'ztop': 'stop',
    'stock': 'stop',
    'stoppo': 'stop',

    # ciao
    'ciao': 'ciao',
    'ciau': 'ciao',
    'chao': 'ciao',
    'tchao': 'ciao',
    'cia': 'ciao',
    'ciaoo': 'ciao',
    'siao': 'ciao',
    'ziao': 'ciao',
    'ciauu': 'ciao',
    'ciaoh': 'ciao',
    'ciaone': 'ciao',
    'sau': 'ciao',
    'chiau': 'ciao',
    'yao': 'ciao',
}

VOICE_TARGETS = {
    'crucio': ['crucio', 'krucio', 'cruzio', 'cruccio', 'crucchio', 'crocio', 'grucio', 'krutio', 'crucioo', 'crutio', 'crucyo', 'trucio', 'crusio', 'cruscio', 'crucial', 'crusho', 'kurucio', 'gruccio', 'cruxio', 'crucco', 'crrrucio', 'crrruccio', 'crrucio', 'crrucchio', 'crrruzio'],
    'stop': ['stop', 'stopp', 'stoop', 'stob', 'shtop', 'istop', 'estop', 'stap', 'stup', 'sdop', 'strop', 'ztop', 'stock', 'stoppo'],
    'ciao': ['ciao', 'ciau', 'chao', 'tchao', 'cia', 'ciaoo', 'siao', 'ziao', 'ciauu', 'ciaoh', 'ciaone', 'sau', 'chiau', 'yao'],
}


def _normalize_voice_text(text):
    if not text:
        return ''
    text = text.lower().strip()
    text = text.replace('à', 'a').replace('è', 'e').replace('é', 'e')
    text = text.replace('ì', 'i').replace('ò', 'o').replace('ù', 'u')
    out = []
    for ch in text:
        if ch.isalnum() or ch.isspace():
            out.append(ch)
        else:
            out.append(' ')
    text = ''.join(out)
    text = ' '.join(text.split())
    return text


def _squash_word(w):
    if not w:
        return ''
    # semplifica la pronuncia: suoni simili diventano uguali
    reps = (
        ('sch', 'sc'), ('tch', 'c'), ('ch', 'c'), ('sh', 's'), ('zh', 'z'),
        ('kh', 'k'), ('ph', 'f'), ('qu', 'cu'),
        ('oo', 'o'), ('uu', 'u'), ('ii', 'i'), ('aa', 'a'),
        ('tt', 't'), ('cc', 'c'), ('zz', 'z'),
    )
    for a, b in reps:
        w = w.replace(a, b)
    return w.replace(' ', '')


def _lev(a, b):
    """Distanza di Levenshtein (quante lettere bisogna cambiare)."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            cost = 0 if ca == cb else 1
            curr.append(min(
                prev[j] + 1,
                curr[j - 1] + 1,
                prev[j - 1] + cost,
            ))
        prev = curr
    return prev[-1]


# "Forma" che una parola deve avere per poter essere un comando.
# Serve a evitare che parole qualsiasi vengano scambiate per comandi
# solo perche' hanno qualche lettera in comune (es. "musica" -> crucio).
VOICE_SHAPES = {
    'crucio': re.compile(r'^[ckgt]u?r+[uoi]*[cstzx]'),     # cr/kr/gr/tr + u/o + c/s/z/t
    'stop': re.compile(r'^[ei]?[sz][tdc]?r?[aou]+[pbkc]'),  # s(t) + vocale + p/b
    'ciao': re.compile(r'^[csztyg]i?a[ou]?(ne|h)?$'),        # c/s/z + (i) + a + o/u
}

# Parole italiane vere che hanno la "forma" di un comando ma non lo sono:
# non devono mai far scattare niente (generata da un elenco di parole italiane comuni)
NOT_COMMANDS = frozenset([
    'ca', 'cane', 'cha', 'chris', 'christi', 'christian', 'christie', 'christina',
    'christine', 'christmas', 'christopher', 'church', 'churchill', 'cricca', 'criceto',
    'cricket', 'crisi', 'crisis', 'cristalli', 'cristallo', 'cristian', 'cristiana',
    'cristiane', 'cristiani', 'cristiano', 'cristina', 'cristo', 'criteri', 'criterio',
    'critica', 'criticano', 'criticare', 'criticata', 'criticate', 'criticato', 'critiche',
    'critici', 'criticita', 'critico', 'croccante', 'croce', 'crocetta', 'crocevia',
    'croci', 'crociata', 'crociate', 'crociati', 'crociato', 'crociera', 'crociere',
    'cross', 'crossover', 'crosta', 'crostacei', 'crostata', 'crotone', 'crozza', 'cruise',
    'crusca', 'cruscotto', 'curiosa', 'curiose', 'curiosi', 'curiosita', 'curioso',
    'curtis', 'gia', 'gross', 'grossa', 'grosse', 'grosseto', 'grossi', 'grosso', 'grotta',
    'grotte', 'grottesco', 'isaac', 'isacco', 'kris', 'kristen', 'kurt', 'sa', 'saba',
    'sacca', 'sacche', 'sacchi', 'sacco', 'sachs', 'sacro', 'sane', 'sap', 'saper', 'sappi',
    'sapra', 'sapro', 'scacchi', 'scacco', 'scappa', 'scappi', 'scappo', 'scocca', 'scoop',
    'scopa', 'scopano', 'scopato', 'scope', 'scopi', 'scopo', 'scoppia', 'scoppio',
    'scopre', 'scopri', 'scopro', 'scotch', 'shah', 'shane', 'shock', 'shop', 'sia', 'soap',
    'soccer', 'soci', 'socia', 'socio', 'sopra', 'stabia', 'stacca', 'stacchi', 'stacco',
    'stack', 'stracci', 'strappa', 'strappi', 'strappo', 'stucchi', 'stucco', 'stupida',
    'stupide', 'stupidi', 'stupido', 'stupire', 'stupita', 'stupito', 'stupore', 'stupri',
    'stupro', 'subi', 'succhi', 'succo', 'sup', 'super', 'tao', 'trick', 'tricolore',
    'tris', 'tristan', 'triste', 'tristi', 'trota', 'truccato', 'trucchi', 'trucco',
    'trust', 'truth', 'turca', 'turche', 'turchi', 'turchia', 'turco', 'turismo', 'turista',
    'turisti', 'turistico', 'ya', 'zack', 'zappa', 'zia', 'zoppo', 'zucca', 'zuppa',
])


def _best_command_for_word(word, loose=False, maxdiff=1, strict=False):
    raw = _normalize_voice_text(word)
    if not raw:
        return None
    sq = _squash_word(raw)

    # corrispondenza esatta
    if raw in VOICE_COMMANDS:
        return VOICE_COMMANDS[raw]
    if sq in VOICE_COMMANDS:
        return VOICE_COMMANDS[sq]
    if raw in NOT_COMMANDS or sq in NOT_COMMANDS:
        return None

    best_cmd = None
    best_dist = 999
    for cmd, variants in VOICE_TARGETS.items():
        if not VOICE_SHAPES[cmd].match(sq):
            continue
        for variant in variants:
            v = _squash_word(variant)
            # lunghezza simile: niente match tra una parola corta e una frase intera
            if abs(len(v) - len(sq)) > maxdiff:
                continue
            d = _lev(sq, v)
            if d < best_dist:
                best_dist = d
                best_cmd = cmd

    # pezzi di parole riattaccati ("cru cio"): devono somigliare molto
    if strict:
        return best_cmd if best_dist <= (2 if best_cmd == 'crucio' else 1) else None

    # soglie di tolleranza per comando
    if best_cmd == 'stop' and best_dist <= (1 if len(sq) <= 3 else 3):
        return best_cmd
    if best_cmd == 'ciao' and best_dist <= (1 if len(sq) <= 3 else 3):
        return best_cmd
    # crucio: tolleranza alta (le parole troppo corte restano escluse)
    if best_cmd == 'crucio' and (best_dist <= 4 or (loose and best_dist <= 5 and len(sq) >= 5)):
        return best_cmd
    return None


# Formule a piu' parole che fanno la stessa cosa di un comando
# ("Echo Insania" = crucio). Confrontate tutte attaccate e semplificate,
# cosi' reggono "eco insania", "echo in sania", "ecoinsanya"...
VOICE_PHRASES = {
    'crucio': ['echoinsania', 'ecoinsania', 'ecinsania', 'eccoinsania', 'ecoinsanja',
               'ecoinsana', 'ecoinsonia', 'ecoinzania', 'egoinsania', 'ecoensania', 'insania'],
}


_PHRASE_CORE = re.compile(r'[ie]n[sz][ao]')


def _check_phrases(full):
    joined = _squash_word(full.replace(' ', ''))
    if not joined:
        return None
    for cmd, phrases in VOICE_PHRASES.items():
        for ph in phrases:
            p = _squash_word(ph)
            n = len(p)
            # tolleranza alta per la formula intera, bassa per "insania" da sola
            # (cosi' "insonnia" non fa scattare niente)
            tol = 1 if n <= 7 else 3
            for ln in range(max(1, n - tol), n + tol + 1):
                for i in range(0, max(1, len(joined) - ln + 1)):
                    win = joined[i:i + ln]
                    # il cuore della formula ("insa"/"inso"/"inza") deve esserci davvero
                    if not _PHRASE_CORE.search(win):
                        continue
                    if _lev(win, p) <= tol:
                        return cmd
    return None


def _check_text(text):
    # 1) frase intera
    full = _normalize_voice_text(text)
    if not full:
        return None

    # 0) formule a piu' parole (es. "Echo Insania")
    cmd = _check_phrases(full)
    if cmd:
        return cmd

    cmd = _best_command_for_word(full, strict=' ' in full)
    if cmd:
        return cmd

    # 2) parola per parola
    words = full.split()
    for w in words:
        cmd = _best_command_for_word(w, loose=True, maxdiff=3)
        if cmd:
            return cmd

    # 3) coppie di parole attaccate ("cru cio" -> "crucio")
    if len(words) >= 2:
        for i in range(len(words) - 1):
            cmd = _best_command_for_word(words[i] + words[i + 1], strict=True)
            if cmd:
                return cmd

    # 4) tutto attaccato
    squashed = ''.join(words)
    cmd = _best_command_for_word(squashed, strict=True)
    if cmd:
        return cmd

    return None


class VoiceEngine:
    """
    Riconoscimento vocale continuo con lo SpeechRecognizer di Android.
    Usa due classi Java aggiunte al progetto:
      - org.kivy.speech.KivyRecognitionListener
      - org.kivy.speech.CallbackWrapper
    Ogni volta che il riconoscitore finisce (risultato o errore) viene
    ricreato, cosi' l'ascolto non si ferma mai.
    """

    def __init__(self):
        self.last_command = None
        self.active = False
        self._sr = None
        self._cb = None
        self._listener = None
        self._restart_pending = False
        self._initialized = False
        self._SR = None
        self._RI = None
        self._Intent = None
        self._KL = None
        self._activity = None
        self._PJC = None
        self._jm = None

    def init(self):
        if self._initialized:
            return
        try:
            from jnius import autoclass, PythonJavaClass, java_method
            from android import mActivity
            from android.permissions import (request_permissions,
                                             check_permission, Permission)
            from android.runnable import run_on_ui_thread
            self._PJC = PythonJavaClass
            self._jm = java_method
            self._activity = mActivity
            self._perm = Permission
            self._check_p = check_permission
            self._req_p = request_permissions
            self._run_ui = run_on_ui_thread

            SR = autoclass('android.speech.SpeechRecognizer')
            if not SR.isRecognitionAvailable(mActivity):
                print('[voice] SR non disponibile', flush=True)
                return

            self._SR = SR
            self._RI = autoclass('android.speech.RecognizerIntent')
            self._Intent = autoclass('android.content.Intent')
            self._KL = autoclass('org.kivy.speech.KivyRecognitionListener')
            self._initialized = True
            print('[voice] Java OK', flush=True)

            if check_permission(Permission.RECORD_AUDIO):
                Clock.schedule_once(lambda dt: self.start(), 0.5)
            else:
                request_permissions(
                    [Permission.RECORD_AUDIO],
                    lambda p, g: Clock.schedule_once(lambda dt: self._on_perm(g), 0),
                )
        except Exception as e:
            print('[voice] init error:', e, flush=True)

    def _on_perm(self, grants):
        if grants and grants[0]:
            print('[voice] permesso OK', flush=True)
            Clock.schedule_once(lambda dt: self.start(), 0.8)
        else:
            print('[voice] NEGATO', flush=True)

    def start(self):
        self.active = True
        self._schedule_restart(1.0)

    def stop(self):
        self.active = False
        self._destroy()

    def _schedule_restart(self, delay=1.0):
        if self._restart_pending:
            return
        self._restart_pending = True
        Clock.schedule_once(lambda dt: self._restart(), delay)

    def _restart(self):
        self._restart_pending = False
        if not self.active or not self._initialized:
            return
        self._create()

    def _create(self):
        try:
            if not self.active:
                return

            engine = self

            @self._run_ui
            def _do_create():
                try:
                    engine._destroy()
                    if not engine.active:
                        return

                    class _CB(engine._PJC):
                        __javacontext__ = 'app'
                        __javainterfaces__ = ['org/kivy/speech/CallbackWrapper']

                        @engine._jm('(Ljava/lang/String;Ljava/lang/String;)V')
                        def callback_data(self, key, value):
                            Clock.schedule_once(
                                lambda dt: engine._on_cb(key, value), 0
                            )

                    engine._cb = _CB()
                    engine._listener = engine._KL(engine._cb)

                    sr = engine._SR.createSpeechRecognizer(engine._activity)
                    if sr is None:
                        print('[voice] SR=None', flush=True)
                        engine._schedule_restart(3.0)
                        return

                    sr.setRecognitionListener(engine._listener)
                    i = engine._Intent(engine._RI.ACTION_RECOGNIZE_SPEECH)
                    i.putExtra(engine._RI.EXTRA_LANGUAGE_MODEL,
                               engine._RI.LANGUAGE_MODEL_FREE_FORM)
                    i.putExtra(engine._RI.EXTRA_LANGUAGE, 'it-IT')
                    i.putExtra(engine._RI.EXTRA_LANGUAGE_PREFERENCE, 'it-IT')
                    i.putExtra(engine._RI.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, 'it-IT')
                    i.putExtra(engine._RI.EXTRA_MAX_RESULTS, 3)
                    i.putExtra(engine._RI.EXTRA_PARTIAL_RESULTS, True)
                    i.putExtra(engine._RI.EXTRA_CALLING_PACKAGE,
                               engine._activity.getPackageName())
                    try:
                        i.putExtra(engine._RI.EXTRA_PREFER_OFFLINE, False)
                    except Exception:
                        pass
                    sr.startListening(i)
                    engine._sr = sr
                    print('[voice] listening', flush=True)
                except Exception as e:
                    print('[voice] create/ui error:', e, flush=True)
                    if engine.active:
                        engine._schedule_restart(3.0)

            _do_create()
        except Exception as e:
            print('[voice] create error:', e, flush=True)
            if self.active:
                self._schedule_restart(3.0)

    def _destroy(self):
        sr = self._sr
        self._sr = None
        if sr is None:
            return
        try:
            @self._run_ui
            def _do_destroy():
                try:
                    sr.cancel()
                except Exception:
                    pass
                try:
                    sr.stopListening()
                except Exception:
                    pass
                try:
                    sr.destroy()
                except Exception:
                    pass

            _do_destroy()
        except Exception:
            try:
                sr.destroy()
            except Exception:
                pass

    def _on_cb(self, key, value):
        # chiamata sul thread di Kivy
        if not self.active:
            return
        if key == 'ready':
            print('[voice] ready', flush=True)
        if key in ('onResults', 'onPartial') and value:
            print('[voice] heard:', key, value, flush=True)
            cmd = _check_text(value)
            if cmd:
                self.last_command = cmd
                print('[voice] cmd:', cmd, value, flush=True)
        if key == 'onError':
            try:
                code = int(value)
            except Exception:
                code = -1
            print('[voice] err', code, flush=True)
            # 7 = nessuna corrispondenza, 8 = riconoscitore occupato
            self._schedule_restart(0.5 if code in (7, 8) else 2.5)
        elif key in ('onResults', 'onEndOfSpeech'):
            self._schedule_restart(0.8)


voice = VoiceEngine()


class SoundFX:
    def __init__(self):
        self.sounds = {}
        self.loaded = False

    def _write_wav(self, path, frames, rate=22050):
        with wave.open(path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(rate)
            wf.writeframes(b''.join(struct.pack('<h', max(-32767, min(32767, int(v * 32767)))) for v in frames))

    def _tone(self, dur, f0, f1=None, amp=0.35, wobble=0.0, noise=0.0, rate=22050):
        f1 = f0 if f1 is None else f1
        n = int(dur * rate)
        out = []
        ph = 0.0
        rnd = random.Random(321)
        for i in range(n):
            t = i / max(1, n - 1)
            env = math.sin(t * math.pi) ** 1.65
            freq = f0 + (f1 - f0) * t + math.sin(t * math.tau * 6.0) * wobble
            ph += math.tau * freq / rate
            val = math.sin(ph) * amp * env
            if noise:
                val += (rnd.random() * 2.0 - 1.0) * noise * env
            out.append(val)
        return out

    def _reverb(self, frames, delay=0.03, decay=0.35, repeats=3, rate=22050):
        out = list(frames)
        d = max(1, int(delay * rate))
        for rep in range(1, repeats + 1):
            off = d * rep
            gain = decay ** rep
            if len(out) < len(frames) + off:
                out.extend([0.0] * (len(frames) + off - len(out)))
            for i, v in enumerate(frames):
                out[i + off] += v * gain
        return out

    def _mix(self, *tracks):
        n = max(len(t) for t in tracks)
        out = [0.0] * n
        for tr in tracks:
            for i, v in enumerate(tr):
                out[i] += v
        return out

    def load(self):
        if self.loaded:
            return
        root = tempfile.gettempdir()
        app_root = os.path.dirname(__file__) if '__file__' in globals() else os.getcwd()
        bank = {
            'crucio': os.path.join(root, 'pixie_crucio.wav'),
            'ciao': os.path.join(root, 'pixie_ciao_v2.wav'),
            'stop': os.path.join(root, 'pixie_stop.wav'),
            'explode': os.path.join(root, 'pixie_explode_v2.wav'),
        }
        if not os.path.exists(bank['crucio']):
            self._write_wav(bank['crucio'], self._tone(0.7, 250, 90, amp=0.34, wobble=14, noise=0.02))
        ciao_base = self._mix(
            self._tone(0.28, 1040, 1460, amp=0.16, wobble=5),
            self._tone(0.2, 1560, 1860, amp=0.06, wobble=2),
        )
        self._write_wav(bank['ciao'], self._reverb(ciao_base, delay=0.024, decay=0.48, repeats=3))
        if not os.path.exists(bank['stop']):
            self._write_wav(bank['stop'], self._tone(0.18, 260, 150, amp=0.2, noise=0.015))
        explode_base = self._tone(0.62, 160, 40, amp=0.46, wobble=10, noise=0.12)
        self._write_wav(bank['explode'], self._reverb(explode_base, delay=0.038, decay=0.42, repeats=3))

        snd = None
        try:
            payload = base64.b64decode(EMBEDDED_CRUCIO_MP3.encode('ascii'))
            embedded_crucio = os.path.join(app_root, 'piwo_suffering_embedded.mp3')
            with open(embedded_crucio, 'wb') as fh:
                fh.write(payload)
            snd = SoundLoader.load(embedded_crucio)
            if snd is not None:
                snd.volume = 1.0
        except Exception as e:
            print('[sfx] embedded crucio err', e, flush=True)
        self.sounds['crucio'] = snd

        for key, path in bank.items():
            if key == 'crucio' and self.sounds.get('crucio') is not None:
                continue
            snd = SoundLoader.load(path)
            if snd is not None:
                snd.volume = 1.0
            self.sounds[key] = snd
        self.loaded = True

    def play(self, key):
        snd = self.sounds.get(key)
        if snd is None:
            print('[sfx] missing', key, flush=True)
            return
        try:
            snd.stop()
        except Exception:
            pass
        try:
            snd.play()
        except Exception as e:
            print('[sfx] play err', key, e, flush=True)


sfx = SoundFX()


def clamp(v, lo, hi):
    return max(lo, min(hi, v))



# ---------------------------------------------------------------------------
# Particelle
# ---------------------------------------------------------------------------
class Particle:
    """Scintilla che si stacca dal wisp e sale lasciando una scia."""
    __slots__ = ('trail', 'vx', 'vy', 'life', 'max_life', 'r0',
                 'spin_ph', 'spin_sp', 'spin_r', 'color_tint')

    def __init__(self, x, y, wvx=0, wvy=0, color_tint=0.0):
        self.vx = random.uniform(-2.5, 2.5) - wvx * 0.15
        self.vy = random.uniform(-75, -35) - wvy * 0.15
        self.life = random.uniform(1.0, 1.8)
        self.max_life = self.life
        self.r0 = INNER_R * random.uniform(0.45, 0.7)
        self.spin_ph = random.uniform(0, math.tau)
        self.spin_sp = random.uniform(0.6, 2.0)
        self.spin_r = random.uniform(2, 12)
        self.trail = [(float(x), float(y))] * TRAIL_N
        self.color_tint = color_tint

    def update(self, dt):
        self.spin_ph += self.spin_sp * dt
        swirl = math.sin(self.spin_ph) * self.spin_r
        self.vx = self.vx * 0.972 + swirl * dt * 0.5
        self.vy -= 5 * dt
        x = self.trail[-1][0] + self.vx * dt * 60
        y = self.trail[-1][1] + self.vy * dt
        self.trail.pop(0)
        self.trail.append((x, y))
        self.life -= dt
        return self.life > 0

    def get_draw_data(self):
        result = []
        ratio = max(0.0, self.life / self.max_life)
        base_r = self.r0 * ratio
        if base_r < 2:
            return result
        base_a = 0.48 * ratio
        tnt = self.color_tint
        for i, (tx, ty) in enumerate(self.trail):
            t = i / (TRAIL_N - 1)
            r = max(2, base_r * (0.18 + 0.82 * t))
            op = 1.0 if t >= 0.5 else t / 0.5
            a = base_a * op * (0.12 + 0.88 * t)
            if a < 0.01:
                continue
            if t >= 0.5:
                blend = (1.0 - t) / 0.5
                ri0 = (1 - blend) * 0.91
                gi0 = 1.0
                bi0 = (1 - blend) * 0.97 + blend * 0.78
            else:
                t2 = t / 0.5
                ri0 = 0.0
                gi0 = 0.48 + t2 * 0.52
                bi0 = 0.39 + t2 * 0.39
            ri = ri0 + (1.0 - ri0) * tnt
            gi = gi0 * (1 - tnt * 0.85)
            bi = bi0 * (1 - tnt)
            result.append((tx, ty, r, ri, gi, bi, a))
        return result


class ExplosionParticle:
    """Frammento dell'esplosione."""

    def __init__(self, x, y):
        angle = random.uniform(0, math.tau)
        speed = random.uniform(360, 1800)
        self.x = float(x)
        self.y = float(y)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed
        self.life = random.uniform(0.4, 2.0)
        self.max_life = self.life
        self.r = random.uniform(30, 150)

    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.vx *= 0.88
        self.vy *= 0.88
        self.life -= dt
        return self.life > 0

    def get_draw_data(self):
        ratio = max(0.0, self.life / self.max_life)
        r = self.r * ratio
        a = 0.9 * ratio
        if ratio > 0.6:
            t = (ratio - 0.6) / 0.4
            ri, gi, bi = 1.0, (1 - t) * 0.7 + t * 0.3, (1 - t) * 0.86
        elif ratio > 0.25:
            t = (ratio - 0.25) / 0.35
            ri = t
            gi = (1 - t) * 0.86 + t * 0.63
            bi = (1 - t) * 1.0 + t * 0.3
        else:
            ri, gi, bi = 1.0, 1.0, 1.0
        return (self.x, self.y, r, ri, gi, bi, a)


class MatchParticle:
    """Scintilla del "fiammifero" che riaccende il wisp dopo l'esplosione."""

    def __init__(self, x, y, phase):
        self.x = float(x) + random.uniform(-8, 8)
        self.y = float(y) + random.uniform(-8, 8)
        self.vx = random.uniform(-15, 15)
        self.vy = random.uniform(-50, -20)
        self.life = random.uniform(0.2, 0.6)
        self.max_life = self.life
        self.r = random.uniform(5, 20)
        self.phase = phase

    def update(self, dt):
        self.vy -= 8 * dt
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.life -= dt
        return self.life > 0

    def get_draw_data(self):
        ratio = max(0.0, self.life / self.max_life)
        r = self.r * ratio
        a = 0.8 * ratio
        if self.phase == 0:
            return (self.x, self.y, r, 1.0, 0.86, 0.59, a)
        return (self.x, self.y, r, 0.0, 0.78, 1.0, a)


# ---------------------------------------------------------------------------
# Occhi
# ---------------------------------------------------------------------------
class Eyes:
    def __init__(self):
        self.timer = random.uniform(2, 5)
        self.blink = False
        self.prog = 0.0
        self.smile = False

    def update(self, dt):
        if self.smile:
            return
        if self.blink:
            self.prog += dt * 8
            if self.prog >= 2:
                self.blink = False
                self.prog = 0.0
                self.timer = random.uniform(2, 5)
        else:
            self.timer -= dt
            if self.timer <= 0:
                self.blink = True

    def force_blink(self):
        self.blink = True
        self.prog = 0.0

    def squint(self):
        self.blink = False
        self.smile = False
        self.prog = 0.0

    def set_smile(self, on):
        self.smile = on
        if on:
            self.blink = False
            self.prog = 0.0


# ---------------------------------------------------------------------------
# Corpo luminoso: lista di cerchi (raggio, R, G, B, alfa) dal piu' grande
# al piu' piccolo. "tint" = 0 azzurro normale, 1 rosso (sofferenza).
# ---------------------------------------------------------------------------
def make_body_data(tint=0.0):
    MAX_GLOW = int(INNER_R * 1.15)
    result = []
    steps = 40
    for i in range(steps, -1, -1):
        t = i / steps
        r = MAX_GLOW * t
        if r < 1:
            continue
        inv = 1.0 - t
        R0 = inv ** 1.6 * 0.72
        G0 = min(1.0, 0.66 + inv ** 0.42 * 0.34)
        B0 = min(1.0, 0.72 + inv ** 0.55 * 0.34)
        R1 = 0.82
        G1 = 0.26 + inv ** 0.45 * 0.18
        B1 = 0.2 + inv ** 1.25 * 0.14
        R = min(1.0, R0 + (R1 - R0) * tint)
        G = min(1.0, G0 + (G1 - G0) * tint)
        B = min(1.0, B0 + (B1 - B0) * tint)
        A = inv ** 2.55 * 0.32
        result.append((r, R, G, B, A))
    for i in range(10, -1, -1):
        t = i / 10
        r = INNER_R * t * 0.8
        if r < 1:
            continue
        inv = 1.0 - t
        result.append((
            r,
            min(1.0, 0.7 * inv),
            min(1.0, 0.66 + inv * 0.34),
            min(1.0, 0.74 + inv * 0.3),
            inv ** 0.3 * 0.54,
        ))
    return result


# corpi gia' calcolati per tint = 0.0, 0.1, ... 1.0
BODY_CACHE = {round(i / 10, 1): make_body_data(i / 10) for i in range(11)}


# ---------------------------------------------------------------------------
# Il Wisp: posizione, movimento e stati
# ---------------------------------------------------------------------------
class Wisp:
    def __init__(self):
        self.x = LW / 2
        self.y = LH / 2
        self.vx = 0.0
        self.vy = 0.0
        self.tx = self.x
        self.ty = self.y
        self.timer = 0.0
        self.particles = []
        self.exp_particles = []
        self.match_particles = []
        self.eyes = Eyes()
        self.pulse_t = 0.0
        self.match_t = 0.0
        self.turn = 0.0
        self.turn_target = 0.0
        self.turn_timer = random.uniform(1.2, 3.0)
        self.pitch = 0.0
        self.pitch_target = 0.0
        self.roll = 0.0
        self.speed_factor = 1.0
        self.speed_target = random.uniform(0.75, 1.35)
        self.state = STATE_NORMAL
        self.state_t = 0.0
        self.color_tint = 0.0
        self.alpha_override = 1.0
        self._stop_tint_start = 0.0
        self._stop_blinks_done = 0
        self._body_data = BODY_CACHE[0.0]
        self._body_tint_cache = 0.0
        self.depth_scale = 1.0
        self.depth_target = 0.975
        self.new_target()

    def _rebuild_body(self, tint):
        t = round(tint * 10) / 10
        if t != self._body_tint_cache:
            self._body_tint_cache = t
            self._body_data = BODY_CACHE.get(t, BODY_CACHE[0.0])

    def new_target(self):
        """Sceglie un nuovo punto verso cui volare (piu' spesso in basso)."""
        self.tx = random.uniform(WALL + 50, LW - WALL - 50)
        usable_h = LH - WALL - 50 - (WALL + 50)
        low_bias = random.random() ** 1.85
        self.ty = WALL + 50 + usable_h * low_bias
        if random.random() < 0.14:
            self.ty = random.uniform(LH * 0.46, LH - WALL - 50)
        self.timer = random.uniform(2.0, 5.5)
        self.speed_target = random.uniform(0.72, 1.42)
        self.depth_target = random.uniform(0.94, 1.0)

    def _bounce(self):
        if self.x < WALL: self.x = WALL; self.vx = abs(self.vx) * 0.7
        elif self.x > LW - WALL: self.x = LW - WALL; self.vx = -abs(self.vx) * 0.7
        if self.y < WALL: self.y = WALL; self.vy = abs(self.vy) * 0.7
        elif self.y > LH - WALL: self.y = LH - WALL; self.vy = -abs(self.vy) * 0.7

    def _enter(self, state):
        if state == STATE_STOP:
            self._enter_stop()
            return
        self.state = state
        self.state_t = 0.0

    def update(self, dt, command):
        self.state_t += dt
        if command:
            self._dispatch(command)
        if self.state == STATE_NORMAL: self._upd_normal(dt)
        elif self.state == STATE_CRUCIO: self._upd_crucio(dt)
        elif self.state == STATE_STOP: self._upd_stop(dt)
        elif self.state == STATE_EXPLODE: self._upd_explode(dt)
        elif self.state == STATE_DEAD:
            if self.state_t >= 5.0: self._enter_match()
        elif self.state == STATE_MATCH: self._upd_match(dt)
        elif self.state == STATE_CIAO: self._upd_ciao(dt)
        elif self.state == STATE_CALM: self._upd_calm(dt)

    def _dispatch(self, cmd):
        if cmd == 'stop':
            if self.state == STATE_CRUCIO:
                self._enter_stop()
            elif self.state in (STATE_NORMAL, STATE_CALM):
                self._enter(STATE_CALM)
            return
        if self.state not in (STATE_NORMAL, STATE_CALM):
            return
        if cmd == 'crucio': self._enter_crucio()
        elif cmd == 'ciao': self._enter_ciao()

    # --- normale: vola tranquillo da un punto all'altro --------------------
    def _upd_normal(self, dt):
        dx = self.tx - self.x
        dy = self.ty - self.y
        dist = math.hypot(dx, dy)
        self.speed_factor += (self.speed_target - self.speed_factor) * 0.05
        accel = 40 * self.speed_factor
        ax = dx / dist * accel if dist > 10 else 0
        ay = dy / dist * accel if dist > 10 else 0
        jitter = 0.02 + 0.04 * self.speed_factor
        drag = 0.978 - (self.speed_factor - 1.0) * 0.01
        self.vx = self.vx * drag + ax * dt + random.uniform(-jitter, jitter)
        self.vy = self.vy * drag + ay * dt + random.uniform(-jitter, jitter)
        self.x += self.vx
        self.y += self.vy
        self._bounce()
        self.timer -= dt
        if self.timer <= 0 or dist < 30:
            self.new_target()
        if len(self.particles) < MAX_P:
            for _ in range(1 if self.speed_factor < 1.0 else 2):
                self.particles.append(Particle(self.x, self.y, self.vx, self.vy))
        self.particles = [p for p in self.particles if p.update(dt)]
        self.eyes.update(dt)
        self.pulse_t += dt
        self.color_tint = 0.0
        self._rebuild_body(0.0)
        self.alpha_override = 1.0
        self.turn_timer -= dt
        if self.turn_timer <= 0:
            self.turn_target = random.uniform(-0.95, 0.95)
            self.pitch_target = random.uniform(-0.85, 0.85)
            self.turn_timer = random.uniform(1.0, 2.6)
        self.turn += (self.turn_target - self.turn) * 0.11
        self.pitch += (self.pitch_target - self.pitch) * 0.1
        self.roll = clamp(self.roll * 0.86 + self.vx / 18.0 * 0.14, -0.85, 0.85)
        self.depth_scale += (self.depth_target - self.depth_scale) * 0.04

    # --- crucio: soffre, trema e diventa rosso; dopo 5 s esplode -----------
    def _enter_crucio(self):
        self.state = STATE_CRUCIO
        self.state_t = 0.0
        self.vx = self.vy = 0.0
        self.turn = self.pitch = self.roll = 0.0
        self.turn_target = self.pitch_target = 0.0
        self.eyes.squint()
        sfx.play('crucio')

    def _upd_crucio(self, dt):
        t = self.state_t
        shake = 4 + t * 8
        self.x += random.uniform(-shake, shake)
        self.y += random.uniform(-shake * 0.5, shake * 0.5)
        self.color_tint = clamp(t / 5.0, 0, 1)
        self._rebuild_body(self.color_tint)
        if len(self.particles) < MAX_P:
            for _ in range(random.randint(1, 2)):
                self.particles.append(Particle(self.x, self.y, 0, 0, self.color_tint))
        self.particles = [p for p in self.particles if p.update(dt)]
        self.pulse_t += dt
        if t >= 5.0:
            self._enter_explode()

    # --- stop: si calma, sbatte gli occhi due volte e torna azzurro --------
    def _enter_stop(self):
        self.state = STATE_STOP
        self.state_t = 0.0
        self.vx = self.vy = 0.0
        self._stop_tint_start = self.color_tint
        self._stop_blinks_done = 0
        sfx.play('stop')

    def _upd_stop(self, dt):
        t = self.state_t
        self.color_tint = self._stop_tint_start * max(0.0, 1.0 - t / 2.0)
        self._rebuild_body(self.color_tint)
        if len(self.particles) < MAX_P:
            for _ in range(random.randint(1, 2)):
                self.particles.append(Particle(self.x, self.y, 0, 0, self.color_tint))
        self.particles = [p for p in self.particles if p.update(dt)]
        self.pulse_t += dt
        if self._stop_blinks_done == 0 and t >= 0.6:
            self.eyes.force_blink()
            self._stop_blinks_done = 1
        elif self._stop_blinks_done == 1 and t >= 1.3:
            self.eyes.force_blink()
            self._stop_blinks_done = 2
        self.eyes.update(dt)
        if t >= 2.0:
            self.color_tint = 0.0
            self._rebuild_body(0.0)
            self.state = STATE_NORMAL
            self.state_t = 0.0
            self.new_target()

    # --- esplosione -> morto (5 s) -> riacceso col fiammifero ---------------
    def _enter_explode(self):
        self.state = STATE_EXPLODE
        self.state_t = 0.0
        for _ in range(270):
            self.exp_particles.append(ExplosionParticle(self.x, self.y))
        self.particles.clear()
        sfx.play('explode')

    def _upd_explode(self, dt):
        self.exp_particles = [p for p in self.exp_particles if p.update(dt)]
        if self.state_t >= 2.0:
            self.exp_particles.clear()
            self.state = STATE_DEAD
            self.state_t = 0.0

    def _enter_match(self):
        self.state = STATE_MATCH
        self.state_t = 0.0
        self.match_t = 0.0
        self.x = LW / 2
        self.y = LH / 2
        self.color_tint = 0.0
        self._rebuild_body(0.0)

    def _upd_match(self, dt):
        self.match_t += dt
        t = self.match_t
        if t < 1.0:
            for _ in range(int(t * 6) + 1):
                self.match_particles.append(MatchParticle(self.x, self.y, 0))
        elif t < 4.0:
            if random.random() < 0.25:
                self.match_particles.append(MatchParticle(self.x, self.y, 1))
        self.match_particles = [p for p in self.match_particles if p.update(dt)]
        if t >= 4.0:
            self.state = STATE_NORMAL
            self.state_t = 0.0
            self.color_tint = 0.0
            self._rebuild_body(0.0)
            self.eyes = Eyes()
            self.new_target()

    # --- ciao: sorride e ondeggia per 3 secondi -----------------------------
    def _enter_ciao(self):
        self.state = STATE_CIAO
        self.state_t = 0.0
        self.vx = self.vy = 0.0
        self.color_tint = 0.0
        self._rebuild_body(0.0)
        self.eyes.set_smile(True)
        self._ciao_base_x = self.x
        self._ciao_base_y = self.y
        self.turn_target = 0.0
        self.pitch_target = 0.0
        sfx.play('ciao')

    def _upd_ciao(self, dt):
        t = self.state_t
        self.turn += (0.0 - self.turn) * 0.16
        self.pitch += (0.0 - self.pitch) * 0.16
        self.roll += (0.0 - self.roll) * 0.18
        bob = INNER_R * 0.22
        env = math.sin(min(1.0, t / 0.55) * math.pi * 0.5)
        fade = 1.0 - max(0.0, (t - 2.35) / 0.65)
        ox = math.sin(t * math.pi * 1.65) * bob * env * max(0.0, fade)
        oy = math.sin(t * math.pi * 3.3) * (INNER_R * 0.022) * env * max(0.0, fade)
        self.x += (self._ciao_base_x + ox - self.x) * 0.1
        self.y += (self._ciao_base_y + oy - self.y) * 0.1
        if len(self.particles) < MAX_P:
            self.particles.append(Particle(self.x, self.y, self.vx, self.vy))
        self.particles = [p for p in self.particles if p.update(dt)]
        self.pulse_t += dt
        self.depth_scale += (1.0 - self.depth_scale) * 0.1
        if t >= 3.0:
            self.eyes.set_smile(False)
            self.state = STATE_NORMAL
            self.state_t = 0.0
            self.x = self._ciao_base_x
            self.y = self._ciao_base_y
            self.turn = self.pitch = self.roll = 0.0
            self.new_target()

    # --- calmo: dopo "stop" (se non stava soffrendo) vola piano per 6 s ---
    def _upd_calm(self, dt):
        dx = self.tx - self.x
        dy = self.ty - self.y
        dist = math.hypot(dx, dy)
        ax = dx / dist * 15 if dist > 30 else 0
        ay = dy / dist * 15 if dist > 30 else 0
        self.vx = self.vx * 0.99 + ax * dt
        self.vy = self.vy * 0.99 + ay * dt
        self.x += self.vx
        self.y += self.vy
        self._bounce()
        self.timer -= dt
        if self.timer <= 0 or dist < 50:
            self.new_target()
        if len(self.particles) < MAX_P // 2:
            self.particles.append(Particle(self.x, self.y, self.vx * 0.3, self.vy * 0.3))
        self.particles = [p for p in self.particles if p.update(dt)]
        self.eyes.update(dt)
        self.pulse_t += dt
        self.color_tint = 0.0
        self._rebuild_body(0.0)
        if self.state_t >= 6.0:
            self._enter(STATE_NORMAL)


# ---------------------------------------------------------------------------
# Disegno
# ---------------------------------------------------------------------------
class WispCanvas(Widget):

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._wisp = Wisp()
        self._sx = 1.0
        self._sy = 1.0
        # texture morbide (cerchi sfumati) usate per disegnare la luce
        self._smoke_tex = self._make_soft_texture(384, gamma=3.1, boost=1.0)
        self._core_tex = self._make_soft_texture(320, gamma=2.0, boost=1.18)
        self._body_glow_tex = self._make_soft_texture(820, gamma=6.2, boost=1.06)
        self._body_core_tex = self._make_soft_texture(620, gamma=4.2, boost=1.12)
        self._eye_glow_tex = self._make_soft_texture(280, gamma=5.6, boost=1.08)
        self.bind(size=self._on_size)
        Clock.schedule_interval(self._frame, 1.0 / 60.0)

    def _make_soft_texture(self, size, gamma=2.2, boost=1.0):
        tex = Texture.create(size=(size, size), colorfmt='rgba')
        tex.mag_filter = 'linear'
        tex.min_filter = 'linear'
        buf = bytearray(size * size * 4)
        half = (size - 1) * 0.5
        inv = 1.0 / max(1.0, half)
        p = 0
        for y in range(size):
            dy = (y - half) * inv
            for x in range(size):
                dx = (x - half) * inv
                d = (dx * dx + dy * dy) ** 0.5
                if d >= 1.0:
                    a = 0
                else:
                    t = 1.0 - d
                    # centro pieno + alone esponenziale
                    soft = t ** gamma
                    halo = math.exp(-(d * d) * 5.5) * 0.22
                    a = int(max(0, min(255, (soft + halo) * 255 * boost)))
                buf[p] = 255
                buf[p + 1] = 255
                buf[p + 2] = 255
                buf[p + 3] = a
                p += 4
        tex.blit_buffer(bytes(buf), colorfmt='rgba', bufferfmt='ubyte')
        return tex

    def _on_size(self, *args):
        if self.size[0] > 0 and self.size[1] > 0:
            self._sx = self.size[0] / LW
            self._sy = self.size[1] / LH

    # da coordinate logiche (2400x1080) a pixel reali
    def _px(self, x): return x * self._sx
    def _py(self, y): return y * self._sy
    def _pr(self, r): return r * min(self._sx, self._sy)

    def _ellipse(self, cx, cy, r, ri, gi, bi, a):
        if r < 1 or a < 0.01:
            return
        px = self._px(cx)
        py = self._py(cy)
        pr = self._pr(r)

        # fumo esterno
        rr = pr * 2.45
        dd = rr * 2
        Color(1, 1, 1, a * 0.08)
        Rectangle(texture=self._smoke_tex, pos=(px - rr, py - rr), size=(dd, dd))
        # nucleo colorato
        rr2 = pr * 1.28
        dd2 = rr2 * 2
        Color(ri, gi, bi, a * 0.42)
        Rectangle(texture=self._core_tex, pos=(px - rr2, py - rr2), size=(dd2, dd2))

    def _frame(self, dt):
        """Chiamata 60 volte al secondo: aggiorna il wisp e ridisegna tutto."""
        dt = min(dt, 0.05)
        w = self._wisp
        cmd = voice.last_command
        if cmd is not None:
            voice.last_command = None
        w.update(dt, cmd)

        self.canvas.clear()
        with self.canvas:
            Color(0, 0, 0, 1)
            Rectangle(pos=(0, 0), size=self.size)

            if w.state == STATE_DEAD:
                return

            if w.state == STATE_EXPLODE:
                for p in w.exp_particles:
                    self._ellipse(*p.get_draw_data())
                return

            if w.state == STATE_MATCH:
                for p in w.match_particles:
                    self._ellipse(*p.get_draw_data())
                if w.match_t >= 1.0:
                    fade = clamp((w.match_t - 1.0) / 3.0, 0, 1)
                    self._draw_wisp_at(w, w.x, w.y, fade, 0.0, False)
                return

            for p in w.particles:
                for d in p.get_draw_data():
                    self._ellipse(*d)

            squint = 0.0
            if w.state == STATE_CRUCIO:
                squint = clamp(w.state_t / 2.0, 0, 1)
            elif w.state == STATE_STOP:
                squint = max(0.0, w._stop_tint_start * (1.0 - w.state_t / 2.0) * 0.95)

            self._draw_wisp_at(w, w.x, w.y, w.alpha_override, squint, w.state == STATE_CIAO)

    def _draw_wisp_at(self, w, cx, cy, alpha, squint, smile):
        if alpha < 0.01:
            return

        raw = math.sin(w.pulse_t * 0.7)
        smooth = raw * abs(raw)
        pulse = 1.0 + 0.022 * smooth
        if w.state == STATE_CRUCIO:
            pulse += math.sin(w.state_t * 60) * 0.06
        depth_mul = getattr(w, 'depth_scale', 1.0)
        stretch_x = (1.0 + abs(w.turn) * 0.28) * depth_mul
        stretch_y = (1.0 + abs(w.pitch) * 0.12) * depth_mul

        # alone esterno
        halo_rx = self._pr(INNER_R * 2.52 * stretch_x)
        halo_ry = self._pr(INNER_R * 2.44 * stretch_y)
        Color(0.78, 0.96, 1.0, 0.04 * alpha)
        Rectangle(texture=self._body_glow_tex,
                  pos=(self._px(cx) - halo_rx, self._py(cy) - halo_ry),
                  size=(halo_rx * 2, halo_ry * 2))

        # corpo
        core_rx = self._pr(INNER_R * 2.04 * stretch_x)
        core_ry = self._pr(INNER_R * 1.98 * stretch_y)
        tnt = w.color_tint
        body_r = 0.56 + tnt * 0.16
        body_g = 0.92 * (1 - tnt * 0.08)
        body_b = 1.1 * (1 - tnt * 0.12)
        Color(body_r, body_g, body_b, 0.42 * alpha)
        Rectangle(texture=self._body_core_tex,
                  pos=(self._px(cx) - core_rx, self._py(cy) - core_ry),
                  size=(core_rx * 2, core_ry * 2))

        for r, R, G, B, A in w._body_data:
            rr = r * (pulse if r > INNER_R * 0.25 else 1.0)
            dxr = self._pr(rr * stretch_x)
            dyr = self._pr(rr * stretch_y)

            halo_mix = clamp((r - INNER_R * 0.34) / (INNER_R * 1.25), 0.0, 1.0)
            cr = R * (1.0 - halo_mix * 0.26) + halo_mix * 0.22
            cg = G * (1.0 - halo_mix * 0.1) + halo_mix * 0.14
            cb = B * (1.0 - halo_mix * 0.05) + halo_mix * 0.18
            aa = A * alpha * 0.7
            Color(cr, cg, cb, aa * 0.55)
            Rectangle(texture=self._core_tex,
                      pos=(self._px(cx) - dxr, self._py(cy) - dyr),
                      size=(dxr * 2, dyr * 2))

        # occhi
        sep = int(22 * SCALE * 0.5)
        r_base = int(8 * SCALE * 0.5)
        eye_y = cy + int(INNER_R * (0.05 + w.pitch * 0.18))
        eye_shift = w.turn * sep * 1.18
        tnt = w.color_tint
        ec_r = 0.91 * (1 - tnt * 0.9)
        ec_g = 1.0 * (1 - tnt * 0.1)
        ec_b = 0.97 * (1 - tnt)
        glow_r = 0.22 + tnt * 0.34
        glow_g = 0.92 * (1 - tnt * 0.72)
        glow_b = 1.0 * (1 - tnt * 0.36)

        glow_layers = [
            (8.8, 0.0028), (7.6, 0.0048), (6.4, 0.0086),
            (5.2, 0.013), (4.2, 0.021), (3.2, 0.036),
            (2.4, 0.06), (1.8, 0.098), (1.32, 0.15),
        ]

        for side in (-1, 1):
            # l'occhio dal lato verso cui gira si stringe (effetto 3D)
            turn_eye = w.turn * side > 0
            ox = cx + side * sep + eye_shift
            if turn_eye:
                ox += side * abs(w.turn) * r_base * 0.22
            oy = eye_y + side * w.roll * r_base * 0.14
            y_scale = clamp(1.0 + w.pitch * 0.18 - abs(w.roll) * 0.04, 0.78, 1.22)
            r = r_base
            ew = max(2, r * (1.0 - abs(w.turn) * 0.72)) if turn_eye else max(2, r * 0.98)
            eh = max(1, r * (1.0 - squint * 0.95) * y_scale)
            x_scale = ew / max(1.0, r)

            if smile:
                # occhi "a mezzaluna" sorridenti
                arc_pts = []
                arc_w = self._pr(max(1.0, r * 0.27))
                arc_rx = self._pr(max(ew * 1.04, r * 0.98))
                arc_ry = self._pr(max(r * 0.84, eh * 0.98))
                px = self._px(ox)
                py = self._py(oy) + arc_ry * 0.15

                blur_rx = self._pr(max(ew * 3.4, r * 3.0))
                blur_ry = self._pr(max(eh * 2.1, r * 1.9))
                Color(0.78, 0.96, 1.0, 0.085 * alpha)
                Rectangle(texture=self._eye_glow_tex,
                          pos=(px - blur_rx, py - blur_ry),
                          size=(blur_rx * 2, blur_ry * 2))

                for i in range(15):
                    tt = i / 14.0
                    ang = math.pi * (0.02 + tt * 0.96)
                    arc_pts.extend([
                        px + math.cos(ang) * arc_rx,
                        py + math.sin(ang) * arc_ry,
                    ])

                for width_mul, aa in ((1.7, 0.04), (1.25, 0.07), (1.0, 0.11)):
                    Color(0.8, 0.97, 1.0, aa * alpha)
                    Line(points=arc_pts, width=max(0.8, arc_w * width_mul), cap='round', joint='round')
                Color(1, 1, 1, 0.94 * alpha)
                Line(points=arc_pts, width=max(0.8, arc_w), cap='round', joint='round')
                continue

            # bagliore attorno all'occhio
            for mul, ga in glow_layers:
                gw = max(2, r * x_scale * mul)
                gh = max(2, r * mul * (1.0 - squint * 0.9))
                Color(0.76, 0.96, 1.0, ga * alpha)
                dw = self._pr(gw)
                dh = self._pr(gh)
                Rectangle(texture=self._eye_glow_tex,
                          pos=(self._px(ox) - dw, self._py(oy) - dh),
                          size=(dw * 2, dh * 2))
            for mul, ga in ((3.8, 0.016), (2.7, 0.038), (1.8, 0.09)):
                gw = max(2, r * x_scale * mul)
                gh = max(2, r * mul * (1.0 - squint * 0.9))
                Color(ec_r, ec_g, ec_b, ga * alpha)
                dw = self._pr(gw)
                dh = self._pr(gh)
                Rectangle(texture=self._eye_glow_tex,
                          pos=(self._px(ox) - dw, self._py(oy) - dh),
                          size=(dw * 2, dh * 2))
            # pupilla piena
            if ew >= 2 and eh >= 1:
                Color(ec_r, ec_g, ec_b, 0.9 * alpha)
                dw = self._pr(ew) * 2
                dh = self._pr(eh) * 2
                Ellipse(pos=(self._px(ox) - dw / 2, self._py(oy) - dh / 2), size=(dw, dh))


class RootLayout(FloatLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.add_widget(WispCanvas(size_hint=(1, 1), pos_hint={'x': 0, 'y': 0}))


class PixieWispApp(App):

    def build(self):
        # finestra nera, a tutto schermo
        try:
            Window.clearcolor = (0, 0, 0, 1)
            Window.softinput_mode = 'below_resize'
            Window.keyboard_anim_args = {'d': 0.2, 't': 'in_out_expo'}
        except Exception as _e:
            print('[build] Window config err:', _e, flush=True)
        return RootLayout()

    def on_start(self):
        print('[app] on_start', flush=True)
        try:
            Window.fullscreen = 'auto'
        except Exception as _e:
            print('[app] fullscreen err:', _e, flush=True)
        try:
            sfx.load()
        except Exception as _e:
            print('[sfx] load err:', _e, flush=True)
        # il microfono parte 2 secondi dopo l'avvio
        Clock.schedule_once(lambda dt: voice.init(), 2.0)

    def on_pause(self):
        voice.stop()
        return True

    def on_resume(self):
        Clock.schedule_once(lambda dt: voice.start(), 1.0)


if __name__ == '__main__':
    try:
        print('[app] avvio v3.4', flush=True)
        PixieWispApp().run()
    except Exception as e:
        print('[app] ECCEZIONE:', e, flush=True)
        traceback.print_exc()
        raise
