[app]

# --- Dati ricavati dall'APK originale (pixie_13.apk) -------------------------
title = Pixie Wisp
package.name = pixiewisp
package.domain = org.pixiewisp
version = 3.4.0

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,mp3,wav
source.exclude_dirs = bin, .buildozer, java, docs

requirements = python3,kivy,pyjnius,android

# schermo orizzontale, a tutto schermo
orientation = landscape
fullscreen = 1

# icona e schermata di caricamento: nell'APK c'erano quelle standard di Kivy
#icon.filename = %(source.dir)s/icon.png
#presplash.filename = %(source.dir)s/presplash.png
android.presplash_color = #000000

# --- Android -----------------------------------------------------------------
android.permissions = INTERNET, RECORD_AUDIO, WAKE_LOCK
android.api = 34
android.minapi = 28
android.archs = arm64-v8a
android.accept_sdk_license = True

# tiene lo schermo acceso mentre l'app e' aperta
android.wakelock = True

# classi Java per il riconoscimento vocale (org.kivy.speech.*)
android.add_src = java


[buildozer]
log_level = 2
warn_on_root = 1
