package org.kivy.speech;

import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;

/**
 * Riceve gli eventi dello SpeechRecognizer di Android e li inoltra a Python
 * tramite CallbackWrapper.callback_data(chiave, valore).
 *
 * Chiavi inviate: "ready", "onPartial", "onResults", "onEndOfSpeech", "onError".
 */
public class KivyRecognitionListener implements RecognitionListener {

    private final CallbackWrapper cb;

    public KivyRecognitionListener(CallbackWrapper cb) {
        this.cb = cb;
    }

    @Override
    public void onReadyForSpeech(Bundle params) {
        if (cb != null) cb.callback_data("ready", "");
    }

    @Override
    public void onBeginningOfSpeech() { }

    @Override
    public void onRmsChanged(float rmsdB) { }

    @Override
    public void onBufferReceived(byte[] buffer) { }

    @Override
    public void onEndOfSpeech() {
        if (cb != null) cb.callback_data("onEndOfSpeech", "");
    }

    @Override
    public void onError(int error) {
        if (cb != null) cb.callback_data("onError", String.valueOf(error));
    }

    @Override
    public void onResults(Bundle results) {
        if (cb == null) return;
        ArrayList<String> list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list != null && !list.isEmpty()) {
            // inoltra fino a 5 interpretazioni alternative
            for (int i = 0; i < Math.min(list.size(), 5); i++) {
                cb.callback_data("onResults", list.get(i));
            }
        }
    }

    @Override
    public void onPartialResults(Bundle partialResults) {
        if (cb == null) return;
        ArrayList<String> list = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (list != null && !list.isEmpty()) {
            cb.callback_data("onPartial", list.get(0));
        }
    }

    @Override
    public void onEvent(int eventType, Bundle params) { }
}
