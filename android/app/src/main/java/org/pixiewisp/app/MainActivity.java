package org.pixiewisp.app;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.hardware.input.InputManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;

/**
 * Pixie Wisp: la creatura a tutto schermo (pagina HTML in una WebView) con
 * - schermo intero, sopra la schermata di blocco, schermo sempre acceso
 * - "silenzio totale" (non disturbare: niente notifiche, chiamate, suoni del telefono)
 * - app fissata sullo schermo (non si esce con Home / app recenti)
 * - ascolto continuo dei comandi vocali (il riconoscimento delle parole e' in voice.js)
 * - tasti di un telecomando Bluetooth inoltrati alla pagina, solo se attivato dal menu
 */
public class MainActivity extends Activity {

    private static final String TAG = "PixieWisp";
    private static final int REQ_MIC = 1;

    private WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private SharedPreferences prefs;
    private NotificationManager nm;
    private AudioManager am;

    // impostazioni decise dalla pagina (menu)
    private volatile boolean remoteEnabled = false;
    private volatile boolean pinWanted = true;

    private boolean resumed = false;

    // ---- silenzio totale
    private boolean dndApplied = false;
    private int savedFilter = NotificationManager.INTERRUPTION_FILTER_ALL;
    private NotificationManager.Policy savedPolicy = null;
    private boolean mutedSystem = false;

    // ---- voce
    private SpeechRecognizer sr;
    private boolean listening = false;
    private String micState = "off";

    private final Runnable pinTask = this::startPin;
    private final Runnable listenTask = this::listenNow;

    // ------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("wisp", MODE_PRIVATE);
        nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);
        web.setLongClickable(false);
        web.setOnLongClickListener(v -> true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "Android");
        web.loadUrl("file:///android_asset/index.html");
        setContentView(web);
        hideSystemUi();

        InputManager im = (InputManager) getSystemService(Context.INPUT_SERVICE);
        if (im != null) {
            im.registerInputDeviceListener(new InputManager.InputDeviceListener() {
                @Override public void onInputDeviceAdded(int id) { js("window.onStatus && onStatus()"); }
                @Override public void onInputDeviceRemoved(int id) { js("window.onStatus && onStatus()"); }
                @Override public void onInputDeviceChanged(int id) { }
            }, ui);
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            micState = "on";
            ui.postDelayed(this::maybeAskDnd, 800);
        } else {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_MIC) {
            boolean ok = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            micState = ok ? "on" : "denied";
            if (ok && resumed) scheduleListen(500);
            ui.postDelayed(this::maybeAskDnd, 500);
        }
    }

    /** La prima volta porta alla schermata in cui si autorizza il "non disturbare". */
    private void maybeAskDnd() {
        if (nm == null || nm.isNotificationPolicyAccessGranted()) return;
        if (prefs.getBoolean("dndAsked", false)) return;
        prefs.edit().putBoolean("dndAsked", true).apply();
        openSettings(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        hideSystemUi();
        web.onResume();
        applyDnd();
        js("window.onAppResume && onAppResume()");
        if ("on".equals(micState)) scheduleListen(600);
        ui.removeCallbacks(pinTask);
        ui.postDelayed(pinTask, 1200);
    }

    @Override
    protected void onPause() {
        resumed = false;
        ui.removeCallbacks(pinTask);
        js("window.onAppPause && onAppPause()");
        stopListening();
        restoreDnd();
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        stopListening();
        restoreDnd();
        if (sr != null) { try { sr.destroy(); } catch (Exception ignored) { } sr = null; }
        web.destroy();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    /** Il tasto Indietro non chiude l'app: chiude il menu, se e' aperto. */
    @Override
    public void onBackPressed() {
        js("window.onBack && onBack()");
    }

    // ------------------------------------------------------------------
    // schermo intero

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }

    // ------------------------------------------------------------------
    // app fissata sullo schermo

    private boolean isPinned() {
        ActivityManager a = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return a != null && a.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void startPin() {
        if (!pinWanted || !resumed || isPinned()) return;
        try { startLockTask(); } catch (Exception e) { Log.w(TAG, "pin", e); }
    }

    private void stopPin() {
        if (!isPinned()) return;
        try { stopLockTask(); } catch (Exception e) { Log.w(TAG, "unpin", e); }
    }

    /** Per aprire le impostazioni bisogna prima "sfissare" l'app. */
    private void openSettings(Intent i) {
        stopPin();
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            try { startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
            catch (Exception ignored) { }
        }
    }

    // ------------------------------------------------------------------
    // silenzio totale: solo sveglie e audio dell'app, niente notifiche/chiamate/suoni

    @SuppressWarnings("deprecation")
    private void applyDnd() {
        if (nm == null || !nm.isNotificationPolicyAccessGranted() || dndApplied) {
            muteSystemSounds(true);
            return;
        }
        try {
            savedFilter = nm.getCurrentInterruptionFilter();
            savedPolicy = nm.getNotificationPolicy();
            if (Build.VERSION.SDK_INT >= 28) {
                int fx = NotificationManager.Policy.SUPPRESSED_EFFECT_FULL_SCREEN_INTENT
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_LIGHTS
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_PEEK
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_STATUS_BAR
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_BADGE
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_AMBIENT
                        | NotificationManager.Policy.SUPPRESSED_EFFECT_NOTIFICATION_LIST;
                nm.setNotificationPolicy(new NotificationManager.Policy(0, 0, 0, fx));
            } else {
                nm.setNotificationPolicy(new NotificationManager.Policy(0, 0, 0,
                        NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_ON
                                | NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_OFF));
            }
            // "solo sveglie": blocca chiamate e notifiche, lascia passare l'audio dell'app
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS);
            dndApplied = true;
        } catch (Exception e) {
            Log.w(TAG, "dnd", e);
        }
        muteSystemSounds(true);
    }

    private void restoreDnd() {
        muteSystemSounds(false);
        if (!dndApplied || nm == null) return;
        try {
            if (savedPolicy != null) nm.setNotificationPolicy(savedPolicy);
            nm.setInterruptionFilter(savedFilter == NotificationManager.INTERRUPTION_FILTER_UNKNOWN
                    ? NotificationManager.INTERRUPTION_FILTER_ALL : savedFilter);
        } catch (Exception e) {
            Log.w(TAG, "dnd restore", e);
        }
        dndApplied = false;
    }

    /** Toglie i suoni di sistema (tocchi, bip del microfono) mentre l'app e' aperta. */
    private void muteSystemSounds(boolean mute) {
        if (am == null || mute == mutedSystem) return;
        int dir = mute ? AudioManager.ADJUST_MUTE : AudioManager.ADJUST_UNMUTE;
        for (int stream : new int[]{AudioManager.STREAM_SYSTEM}) {
            try { am.adjustStreamVolume(stream, dir, 0); } catch (Exception ignored) { }
        }
        mutedSystem = mute;
    }

    // ------------------------------------------------------------------
    // telecomando Bluetooth (solo se attivato dal menu)

    private static boolean isRemote(InputDevice d) {
        if (d == null || d.isVirtual()) return false;
        if (Build.VERSION.SDK_INT >= 29) return d.isExternal();
        return d.getVendorId() != 0;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (remoteEnabled && isRemote(e.getDevice())) {
            if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
                InputDevice d = e.getDevice();
                js("window.onRemoteKey && onRemoteKey(" + e.getKeyCode() + ","
                        + JSONObject.quote(keyLabel(e.getKeyCode())) + ","
                        + JSONObject.quote(d != null ? d.getName() : "") + ")");
            }
            return true; // il tasto del telecomando non fa altro (niente volume, niente uscita)
        }
        return super.dispatchKeyEvent(e);
    }

    private static String keyLabel(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_VOLUME_UP: return "Volume +";
            case KeyEvent.KEYCODE_VOLUME_DOWN: return "Volume −";
            case KeyEvent.KEYCODE_ENTER: return "Invio";
            case KeyEvent.KEYCODE_SPACE: return "Spazio";
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: return "Play/Pausa";
            case KeyEvent.KEYCODE_MEDIA_PLAY: return "Play";
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return "Pausa";
            case KeyEvent.KEYCODE_MEDIA_NEXT: return "Avanti";
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: return "Indietro";
            case KeyEvent.KEYCODE_DPAD_UP: return "Su";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "Giù";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "Sinistra";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "Destra";
            case KeyEvent.KEYCODE_DPAD_CENTER: return "OK";
            case KeyEvent.KEYCODE_BACK: return "Indietro (tasto)";
            case KeyEvent.KEYCODE_PAGE_UP: return "Pagina su";
            case KeyEvent.KEYCODE_PAGE_DOWN: return "Pagina giù";
            case KeyEvent.KEYCODE_CAMERA: return "Fotocamera";
            default:
                String s = KeyEvent.keyCodeToString(code);
                if (s.startsWith("KEYCODE_")) s = s.substring(8);
                s = s.replace('_', ' ').toLowerCase();
                return s.isEmpty() ? ("Tasto " + code) : Character.toUpperCase(s.charAt(0)) + s.substring(1);
        }
    }

    private JSONArray remoteNames() {
        JSONArray out = new JSONArray();
        for (int id : InputDevice.getDeviceIds()) {
            InputDevice d = InputDevice.getDevice(id);
            if (!isRemote(d)) continue;
            if ((d.getSources() & (InputDevice.SOURCE_KEYBOARD | InputDevice.SOURCE_DPAD
                    | InputDevice.SOURCE_GAMEPAD | InputDevice.SOURCE_JOYSTICK)) == 0) continue;
            String n = d.getName();
            boolean dup = false;
            for (int i = 0; i < out.length(); i++) if (n.equals(out.optString(i))) dup = true;
            if (!dup) out.put(n);
        }
        return out;
    }

    // ------------------------------------------------------------------
    // ascolto continuo dei comandi vocali

    private void scheduleListen(long delay) {
        ui.removeCallbacks(listenTask);
        ui.postDelayed(listenTask, delay);
    }

    private void listenNow() {
        if (!resumed || !"on".equals(micState)) return;
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { micState = "unavailable"; return; }
        try {
            if (sr == null) {
                sr = SpeechRecognizer.createSpeechRecognizer(this);
                sr.setRecognitionListener(new Listener());
            }
            Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "it-IT");
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "it-IT");
            i.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "it-IT");
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
            sr.startListening(i);
            listening = true;
        } catch (Exception e) {
            Log.w(TAG, "listen", e);
            resetRecognizer();
            scheduleListen(2000);
        }
    }

    private void stopListening() {
        ui.removeCallbacks(listenTask);
        listening = false;
        if (sr != null) { try { sr.cancel(); } catch (Exception ignored) { } }
    }

    private void resetRecognizer() {
        if (sr != null) { try { sr.destroy(); } catch (Exception ignored) { } }
        sr = null;
    }

    private class Listener implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) { }
        @Override public void onBeginningOfSpeech() { }
        @Override public void onRmsChanged(float rmsdB) { }
        @Override public void onBufferReceived(byte[] buffer) { }
        @Override public void onEndOfSpeech() { }
        @Override public void onEvent(int eventType, Bundle params) { }

        @Override public void onPartialResults(Bundle b) { send(b, 1); }

        @Override public void onResults(Bundle b) {
            send(b, 5);
            listening = false;
            scheduleListen(250);
        }

        @Override public void onError(int error) {
            listening = false;
            if (!resumed) return;
            // 6 = silenzio, 7 = nessuna parola: si riparte subito
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                scheduleListen(250);
            } else if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || error == SpeechRecognizer.ERROR_CLIENT) {
                resetRecognizer();
                scheduleListen(900);
            } else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                micState = "denied";
            } else {
                resetRecognizer();
                scheduleListen(2000);
            }
        }

        private void send(Bundle b, int max) {
            if (b == null) return;
            ArrayList<String> list = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (list == null) return;
            for (int i = 0; i < Math.min(max, list.size()); i++) {
                String t = list.get(i);
                if (t != null && !t.isEmpty()) js("window.onSpeech && onSpeech(" + JSONObject.quote(t) + ")");
            }
        }
    }

    // ------------------------------------------------------------------
    // pagina <-> app

    private void js(String code) {
        ui.post(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    private class Bridge {
        @JavascriptInterface
        public void setRemoteEnabled(boolean on) { remoteEnabled = on; }

        @JavascriptInterface
        public void setPinned(boolean on) {
            pinWanted = on;
            ui.post(() -> { if (on) startPin(); else stopPin(); });
        }

        @JavascriptInterface
        public void openBluetoothSettings() {
            ui.post(() -> openSettings(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS)));
        }

        @JavascriptInterface
        public void openDndSettings() {
            ui.post(() -> openSettings(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)));
        }

        @JavascriptInterface
        public void exitApp() {
            ui.post(() -> {
                stopPin();
                stopListening();
                restoreDnd();
                finishAndRemoveTask();
            });
        }

        @JavascriptInterface
        public String getStatus() {
            JSONObject o = new JSONObject();
            try {
                boolean granted = nm != null && nm.isNotificationPolicyAccessGranted();
                o.put("dnd", granted ? "on" : "off");
                o.put("mic", micState);
                o.put("devices", remoteNames());
                o.put("pinned", isPinned());
            } catch (Exception ignored) { }
            return o.toString();
        }
    }
}
