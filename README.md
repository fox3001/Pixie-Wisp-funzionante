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
| **"Crucio"** o **"Echo Insania"** | Il wisp si blocca, strizza gli occhi, trema sempre più forte e diventa rosso, con un lamento. Se nessuno lo ferma, dopo **5 secondi esplode**. Dopo l'esplosione lo schermo resta buio 5 secondi, poi un "fiammifero" lo riaccende. |
| **"Stop"** | Se sta soffrendo (crucio), si calma: torna azzurro in 2 secondi e sbatte gli occhi due volte. Se non sta soffrendo, rallenta e vola calmo per qualche secondo. |
| **"Ciao"** | Fa gli occhi sorridenti a mezzaluna, ondeggia per 3 secondi e fa un suono allegro. |

Il riconoscimento è "tollerante": capisce anche storpiature tipo *cruccio, krucio, eco insania, stopp, ciau, ciaone*… (vedi `VOICE_COMMANDS` e `VOICE_PHRASES` in `main.py`).
Per evitare falsi allarmi, una parola conta come comando solo se ne ha la "forma" (`VOICE_SHAPES`) e non è una parola italiana comune (`NOT_COMMANDS`): così "grazie", "musica" o "sto bene" non fanno scattare niente.

---

## App Android (APK)

La versione da installare sul telefono è nella cartella `android/`: è la creatura del mockup "Fiamma viva"
(pagina `android/app/src/main/assets/`) dentro un'app Android nativa.

- Si apre a schermo intero, sopra la schermata di blocco, con lo schermo sempre acceso.
- Mentre è aperta: **silenzio totale** (niente notifiche, chiamate o suoni del telefono, serve autorizzarlo una volta)
  e **app fissata** sullo schermo (Home e app recenti non la chiudono).
- Nessuna scritta sullo schermo. **Doppio tap** apre il menu: torna al wisp, prova le reazioni,
  telecomando Bluetooth (solo se attivato, con i tasti assegnabili alle azioni), silenzio, esci.
- Comandi vocali come sopra (stessa logica, in `voice.js`).

**Scaricare l'APK:** ad ogni modifica GitHub lo compila da solo (Actions → "APK") e lo pubblica
nella release **"Pixie Wisp — ultima versione"** della repo: dal telefono si apre la release e si scarica `PixieWisp.apk`.

## iPad / Safari

La stessa creatura gira anche nel browser: **https://fox3001.github.io/Pixie-Wisp-funzionante/**
(il sito si aggiorna da solo ad ogni modifica, con la cartella `web/` e il motore dell'app Android).

- Da Safari: Condividi → *Aggiungi alla schermata Home*, poi si apre da lì a tutto schermo.
- Al primo avvio un tocco ("Tocca per iniziare") sblocca l'audio. Doppio tap: menu.
- Telecomando: deve funzionare come tastiera Bluetooth. Voce: sperimentale e spenta di base.
- Silenzio, blocco rotazione, schermo sempre acceso e Accesso guidato si impostano sull'iPad (istruzioni nel menu).

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
