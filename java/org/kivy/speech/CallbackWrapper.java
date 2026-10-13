package org.kivy.speech;

/**
 * Interfaccia implementata dal lato Python (classe _CB in main.py, via pyjnius).
 * Il listener Java la chiama per passare a Python ogni evento del riconoscitore.
 */
public interface CallbackWrapper {
    void callback_data(String key, String value);
}
