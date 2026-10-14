# Pixie Wisp 🔵✨

> Spiegazione completa (cos'è, come si usa, processo creativo): **[PIWO_PIXIE_FUOCO_FATUO.txt](PIWO_PIXIE_FUOCO_FATUO.txt)**

Un **fuoco fatuo animato** (una lucina azzurra con due occhi) che vola sullo schermo del telefono e **reagisce alla voce**.
App Android fatta in Python con [Kivy](https://kivy.org), versione **3.4.0**.

> Il codice di questo progetto è stato **ricostruito dall'APK** `pixie_13.apk`.
> La ricostruzione è stata verificata: ricompilando `main.py` si ottiene lo stesso identico programma dell'APK.

---

## Cosa fa

Il wisp vola tranquillo da un punto all'altro dello schermo, gira la "testa", sbatte gli occhi e lascia una scia di scintille.
L'app ascolta continuamente il microfono (in italiano) e capisce questi comandi (tasto = Pixie Remote / tastiera):

| Comando | Tasto | Cosa succede |
|---|---|---|
| **"Crucio"** o **"Echo Insania"** | 1 | Si blocca, strizza gli occhi, trema sempre più forte e diventa rosso, con un lamento. Se nessuno lo ferma, dopo **5 secondi esplode**; dopo 5 secondi di buio un "fiammifero" lo riaccende. |
| **"Finite"** o **"Finite Incantatem"** | 2 | Ferma **qualunque** incantesimo in corso (crucio, incendio, gelatina, accio, vieni qui). Se non c'è niente da fermare, si calma. |
| **"Ciao"** | 3 | Occhi sorridenti a mezzaluna, ondeggia e fa un suono allegro. |
| **"Incendio"** | 4 | Una scintilla gli accende la testa: corre in giro preoccupato per tutta la profondità del box, poi il fuoco si spegne in uno sbuffo di fumo e ti guarda male. |
| **"Locomotor Wibbly"** o **"Epoximise"** | 5 | Lampo viola: si scioglie come miele fino a restare solo gli occhi, poi si ricompone a molla. |
| **"Accio"** | 6 | Viene tirato contro il vetro davanti, ci si spiaccica, cola un po' e si stacca come gomma. |
| **"Vieni qui"** o **"Dai vieni qui"** | 7 | Va piano piano sul lato destro e si fa "grattare": si rimescola come mercurio, poi rallenta e sorride. |

Il riconoscimento è "tollerante" (logica in `android/app/src/main/assets/voice.js`): capisce anche storpiature tipo
*cruccio, eco insania, a cio, in cendio, loco motor ubli, epoxy mise, finiti*… ma una parola conta come comando solo se ne ha
la "forma" e non è una parola italiana comune simile (*intendo, Asia, finito, possibile*…). L'elenco dei comandi è anche nel menu (doppio tap).

---

## App Android (APK)

La versione da installare sul telefono è nella cartella `android/`: è la creatura del mockup Claude Design
`design/CorpoScintille.dc.html` (pagina `android/app/src/main/assets/`) dentro un'app Android nativa.
Il motore `engine.js` si rigenera dal mockup con `python3 tools/build_engine.py design/CorpoScintille.dc.html android/app/src/main/assets/engine.js "occhi=maschera noBK"`.

- Si apre a schermo intero, sopra la schermata di blocco, con lo schermo sempre acceso.
- Mentre è aperta: **silenzio totale** (niente notifiche, chiamate o suoni del telefono, serve autorizzarlo una volta)
  e **app fissata** sullo schermo (Home e app recenti non la chiudono).
- Nessuna scritta sullo schermo. **Doppio tap** apre il menu: torna al wisp, prova le reazioni,
  elenco dei comandi vocali, telecomando Bluetooth (solo se attivato, con i tasti assegnabili alle azioni), silenzio, esci.
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

## Pixie Remote (telefono come telecomando)

`android/remote/`: mini app Android che fa diventare il telefono una **tastiera Bluetooth**
con un pulsante per ogni comando: Crucio 1, Finite 2, Ciao 3, Incendio 4, Gelatina 5, Accio 6, Vieni qui 7.
Funziona con l'iPad (pagina Safari) e con l'app Pixie Wisp su un altro Android: in entrambe i tasti da 1 a 7 sono
già assegnati, basta attivare «Usa un telecomando».
Serve Android 9 o più recente. Si scarica dalla stessa release (`PixieRemote.apk`).

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
