# Pixie Wisp 🔵✨

Un **fuoco fatuo animato** (una lucina azzurra con due occhi) che vola sullo schermo del telefono e **reagisce alla voce**.
App Android fatta in Python con [Kivy](https://kivy.org), versione **3.4.0**.

> Il codice di questo progetto è stato **ricostruito dall'APK** `pixie_13.apk`.
> La ricostruzione è stata verificata: ricompilando `main.py` si ottiene lo stesso identico programma dell'APK.

---

## Cosa fa

Il wisp vola tranquillo da un punto all'altro dello schermo, gira la "testa", sbatte gli occhi e lascia una scia di scintille.
L'app ascolta continuamente il microfono (in italiano) e capisce tre parole:

| Parola detta | Cosa succede |
|---|---|
| **"Crucio"** | Il wisp si blocca, strizza gli occhi, trema sempre più forte e diventa rosso, con un lamento. Se nessuno lo ferma, dopo **5 secondi esplode**. Dopo l'esplosione lo schermo resta buio 5 secondi, poi un "fiammifero" lo riaccende. |
| **"Stop"** | Se sta soffrendo (crucio), si calma: torna azzurro in 2 secondi e sbatte gli occhi due volte. Se non sta soffrendo, rallenta e vola calmo per qualche secondo. |
| **"Ciao"** | Fa gli occhi sorridenti a mezzaluna, ondeggia per 3 secondi e fa un suono allegro. |

Il riconoscimento è "tollerante": capisce anche varianti tipo *cruccio, krucio, stopp, ciau, ciaone*… (vedi `VOICE_COMMANDS` in `main.py`).

### Stati già pronti ma non ancora collegati alla voce
Nel codice ci sono altri comportamenti già programmati, che però **nessuna parola attiva** in questa versione.
Per usarli basta aggiungere le parole in `VOICE_COMMANDS` / `VOICE_TARGETS`:

`explode` (esplode subito) · `freeze` (si congela) · `scared` (spaventato, si agita) · `angry` (arrabbiato, diventa rosso) ·
`calm` (calmo) · `multiply` (compaiono 3 copie che gli girano attorno) · `spin` (fa una giravolta) · `hide` (sparisce e ricompare) ·
`come` (viene al centro) · `go` (va verso un bordo)

---

## I file

```
main.py              il programma (tutta l'app)
embedded_audio.py    il suono del "crucio" (MP3 trasformato in testo)
java/org/kivy/speech/
    KivyRecognitionListener.java   ascolta il microfono di Android
    CallbackWrapper.java           "ponte" tra Java e Python
buildozer.spec       le impostazioni per creare l'APK
```

Come è organizzato `main.py`:

- **VoiceEngine** – accende il riconoscimento vocale di Android e lo fa ripartire ogni volta che si ferma
- **SoundFX** – crea i suoni (bip generati al volo + il lamento MP3)
- **Particle / ExplosionParticle / MatchParticle** – scintille, esplosione, fiammifero
- **Eyes** – gli occhi (battito di ciglia, sorriso, strizzati)
- **Wisp** – il personaggio: movimento e tutti gli stati
- **WispCanvas** – disegna tutto 60 volte al secondo
- **PixieWispApp** – l'app vera e propria

La scena è disegnata in coordinate "finte" di **2400 × 1080** e poi adattata allo schermo reale.

---

## Creare l'APK

Si usa **Buildozer** (l'APK originale è stato costruito su Google Colab).
In un notebook Colab, dentro la cartella del progetto:

```bash
pip install buildozer cython
sudo apt-get install -y openjdk-17-jdk autoconf libtool pkg-config zlib1g-dev libncurses5-dev libffi-dev libssl-dev
buildozer -v android debug
```

L'APK finisce nella cartella `bin/`.

**Permessi:** l'app chiede il microfono al primo avvio. Se viene negato, il wisp vola lo stesso ma non sente i comandi.

---

## Note tecniche

- Python 3.11, Kivy, pyjnius · Android minimo 9 (API 28), target API 34 · solo arm64
- Lingua del riconoscimento: `it-IT` (usa il servizio vocale di Google del telefono, serve Internet)
- Nell'APK originale il suono MP3 era scritto direttamente dentro `main.py`; qui è stato spostato in `embedded_audio.py` solo per rendere il codice più leggibile.
