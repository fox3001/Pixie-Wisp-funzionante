package org.pixiewisp.remote;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHidDevice;
import android.bluetooth.BluetoothHidDeviceAppSdpSettings;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Executor;

/**
 * Pixie Remote: il telefono diventa una tastiera Bluetooth.
 * I tre pulsanti mandano i tasti 1, 2, 3 all'iPad (o a un altro telefono),
 * dove Pixie Wisp li usa come Crucio, Stop e Ciao.
 */
@SuppressLint("MissingPermission")
public class RemoteActivity extends Activity {

    // tasti HID (tabella "Keyboard/Keypad"): 1, 2, 3
    private static final byte KEY_1 = 0x1E, KEY_2 = 0x1F, KEY_3 = 0x20;
    private static final int REQ_PERMS = 1, REQ_ENABLE = 2;

    // tastiera standard con Report ID 1: [modificatori, riservato, 6 tasti]
    private static final byte[] KEYBOARD_DESCRIPTOR = new byte[]{
            0x05, 0x01, 0x09, 0x06, (byte) 0xA1, 0x01, (byte) 0x85, 0x01,
            0x05, 0x07, 0x19, (byte) 0xE0, 0x29, (byte) 0xE7, 0x15, 0x00, 0x25, 0x01,
            0x75, 0x01, (byte) 0x95, 0x08, (byte) 0x81, 0x02,
            (byte) 0x95, 0x01, 0x75, 0x08, (byte) 0x81, 0x01,
            (byte) 0x95, 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65,
            0x05, 0x07, 0x19, 0x00, 0x29, 0x65, (byte) 0x81, 0x00,
            (byte) 0xC0
    };

    private final Handler ui = new Handler(Looper.getMainLooper());
    private final Executor uiExec = ui::post;
    private SharedPreferences prefs;

    private BluetoothAdapter adapter;
    private BluetoothHidDevice hid;
    private boolean registered = false;
    private BluetoothDevice host;

    private TextView status;
    private LinearLayout devicesBox;
    private final List<Button> actionButtons = new ArrayList<>();

    // ------------------------------------------------------------------
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("remote", MODE_PRIVATE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();
        if (hasPerms()) init(); else requestPerms();
    }

    @Override
    protected void onDestroy() {
        if (hid != null) {
            try { if (host != null) hid.disconnect(host); } catch (Exception ignored) { }
            try { hid.unregisterApp(); } catch (Exception ignored) { }
            try { adapter.closeProfileProxy(BluetoothProfile.HID_DEVICE, hid); } catch (Exception ignored) { }
        }
        super.onDestroy();
    }

    private boolean hasPerms() {
        if (Build.VERSION.SDK_INT < 31) return true;
        return checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestPerms() {
        requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_ADVERTISE}, REQ_PERMS);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (hasPerms()) init();
        else setStatus("Serve il permesso «Dispositivi nelle vicinanze» per usare il Bluetooth.", false);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_ENABLE) init();
    }

    // ------------------------------------------------------------------
    // Bluetooth: il telefono si registra come tastiera

    private void init() {
        BluetoothManager bm = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        adapter = bm != null ? bm.getAdapter() : null;
        if (adapter == null) { setStatus("Questo telefono non ha il Bluetooth.", false); return; }
        if (!adapter.isEnabled()) {
            setStatus("Accendi il Bluetooth.", false);
            try { startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQ_ENABLE); } catch (Exception ignored) { }
            return;
        }
        if (hid != null) { refreshDevices(); return; }
        setStatus("Avvio…", false);
        boolean ok = adapter.getProfileProxy(this, new BluetoothProfile.ServiceListener() {
            @Override
            public void onServiceConnected(int profile, BluetoothProfile proxy) {
                hid = (BluetoothHidDevice) proxy;
                BluetoothHidDeviceAppSdpSettings sdp = new BluetoothHidDeviceAppSdpSettings(
                        "Pixie Remote", "Telecomando di Pixie Wisp", "Pixie Wisp",
                        BluetoothHidDevice.SUBCLASS1_KEYBOARD, KEYBOARD_DESCRIPTOR);
                boolean r = hid.registerApp(sdp, null, null, uiExec, callback);
                if (!r) setStatus("Il telefono non accetta di fare da tastiera Bluetooth.", false);
            }

            @Override
            public void onServiceDisconnected(int profile) {
                hid = null; registered = false; host = null;
                setStatus("Bluetooth interrotto.", false);
            }
        }, BluetoothProfile.HID_DEVICE);
        if (!ok) setStatus("Questo telefono non supporta il profilo «tastiera Bluetooth».", false);
    }

    private final BluetoothHidDevice.Callback callback = new BluetoothHidDevice.Callback() {
        @Override
        public void onAppStatusChanged(BluetoothDevice plugged, boolean reg) {
            registered = reg;
            if (!reg) { setStatus("Non registrato come tastiera.", false); return; }
            setStatus("Pronto. Collega l'iPad (vedi sotto).", false);
            refreshDevices();
            // riprova a collegarsi all'ultimo dispositivo usato
            String last = prefs.getString("last", null);
            BluetoothDevice target = plugged;
            if (target == null && last != null) {
                try { target = adapter.getRemoteDevice(last); } catch (Exception ignored) { }
            }
            if (target != null) {
                try { hid.connect(target); setStatus("Mi collego a " + name(target) + "…", false); } catch (Exception ignored) { }
            }
        }

        @Override
        public void onConnectionStateChanged(BluetoothDevice device, int state) {
            if (state == BluetoothProfile.STATE_CONNECTED) {
                host = device;
                prefs.edit().putString("last", device.getAddress()).apply();
                setStatus("Collegato a " + name(device), true);
            } else if (state == BluetoothProfile.STATE_CONNECTING) {
                setStatus("Mi collego a " + name(device) + "…", false);
            } else if (state == BluetoothProfile.STATE_DISCONNECTED) {
                if (host == null || host.equals(device)) {
                    host = null;
                    setStatus("Non collegato. Tocca il dispositivo qui sotto per ricollegarti.", false);
                }
            }
            refreshDevices();
        }
    };

    private void makeDiscoverable() {
        try {
            Intent i = new Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE);
            i.putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 120);
            startActivity(i);
        } catch (Exception ignored) { }
    }

    private void connect(BluetoothDevice d) {
        if (hid == null || !registered) { setStatus("Non ancora pronto, riprova tra un attimo.", false); return; }
        try {
            if (host != null && !host.equals(d)) hid.disconnect(host);
            hid.connect(d);
            setStatus("Mi collego a " + name(d) + "…", false);
        } catch (Exception e) {
            setStatus("Collegamento non riuscito.", false);
        }
    }

    /** Preme e rilascia un tasto. */
    private void press(byte key) {
        if (hid == null || host == null) { setStatus("Non collegato: collega prima l'iPad.", false); return; }
        byte[] down = new byte[8];
        down[2] = key;
        hid.sendReport(host, 1, down);
        ui.postDelayed(() -> { if (hid != null && host != null) hid.sendReport(host, 1, new byte[8]); }, 60);
    }

    private String name(BluetoothDevice d) {
        String n = null;
        try { n = d.getName(); } catch (Exception ignored) { }
        return n != null && !n.isEmpty() ? n : d.getAddress();
    }

    // ------------------------------------------------------------------
    // interfaccia

    private int dp(float v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    private GradientDrawable round(int fill, int stroke) {
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(22));
        g.setColor(fill);
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }

    private Button bigButton(String text, int color, byte key) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 30);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setTextColor(Color.parseColor("#021018"));
        b.setBackground(round(color, 0));
        b.setStateListAnimator(null);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f);
        lp.setMargins(0, dp(8), 0, dp(8));
        b.setLayoutParams(lp);
        b.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY);
            press(key);
        });
        actionButtons.add(b);
        return b;
    }

    private Button smallButton(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        b.setTextColor(Color.parseColor("#E8F7FF"));
        b.setBackground(round(Color.parseColor("#141C2B"), Color.parseColor("#2A3A50")));
        b.setStateListAnimator(null);
        b.setPadding(dp(18), 0, dp(18), 0);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(52));
        lp.setMargins(0, dp(6), 0, dp(6));
        b.setLayoutParams(lp);
        return b;
    }

    private TextView text(String s, int sp, String color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(Color.parseColor(color));
        t.setLineSpacing(0, 1.15f);
        return t;
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.BLACK);
        root.setPadding(dp(20), dp(28), dp(20), dp(16));

        TextView title = text("Pixie Remote", 22, "#8FB3C9");
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);
        status = text("…", 16, "#FFB36B");
        status.setPadding(0, dp(6), 0, dp(10));
        root.addView(status);

        LinearLayout pad = new LinearLayout(this);
        pad.setOrientation(LinearLayout.VERTICAL);
        pad.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        pad.addView(bigButton("Crucio", Color.parseColor("#FF7A5C"), KEY_1));
        pad.addView(bigButton("Stop", Color.parseColor("#5FD0FF"), KEY_2));
        pad.addView(bigButton("Ciao", Color.parseColor("#7EE2A8"), KEY_3));
        root.addView(pad);

        ScrollView sv = new ScrollView(this);
        sv.setLayoutParams(new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(230)));
        LinearLayout setup = new LinearLayout(this);
        setup.setOrientation(LinearLayout.VERTICAL);
        setup.setPadding(0, dp(10), 0, 0);

        Button vis = smallButton("Rendi il telefono visibile all'iPad");
        vis.setOnClickListener(v -> makeDiscoverable());
        setup.addView(vis);
        setup.addView(text("1. Tocca il pulsante qui sopra.\n"
                + "2. Sull'iPad: Impostazioni → Bluetooth → tocca il nome di questo telefono.\n"
                + "3. Nella pagina di Pixie Wisp (doppio tap → menu) attiva «Usa un telecomando»: "
                + "Crucio, Stop e Ciao sono già assegnati ai tasti 1, 2, 3.", 14, "#8FB3C9"));
        TextView dt = text("Dispositivi associati", 14, "#8FB3C9");
        dt.setTypeface(Typeface.DEFAULT_BOLD);
        dt.setPadding(0, dp(14), 0, 0);
        setup.addView(dt);
        devicesBox = new LinearLayout(this);
        devicesBox.setOrientation(LinearLayout.VERTICAL);
        setup.addView(devicesBox);
        sv.addView(setup);
        root.addView(sv);

        setContentView(root);
        setStatus("Avvio…", false);
    }

    private void refreshDevices() {
        ui.post(() -> {
            devicesBox.removeAllViews();
            if (adapter == null) return;
            Set<BluetoothDevice> bonded;
            try { bonded = adapter.getBondedDevices(); } catch (Exception e) { return; }
            if (bonded == null || bonded.isEmpty()) {
                devicesBox.addView(text("Nessuno ancora: associa l'iPad con i passi qui sopra.", 14, "#8FB3C9"));
                return;
            }
            for (BluetoothDevice d : bonded) {
                boolean on = d.equals(host);
                Button b = smallButton((on ? "● " : "") + name(d) + (on ? "  (collegato)" : ""));
                b.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
                b.setOnClickListener(v -> connect(d));
                devicesBox.addView(b);
            }
        });
    }

    private void setStatus(String s, boolean ok) {
        ui.post(() -> {
            status.setText(s);
            status.setTextColor(Color.parseColor(ok ? "#7EE2A8" : "#FFB36B"));
            for (Button b : actionButtons) b.setAlpha(ok ? 1f : 0.45f);
        });
    }
}
