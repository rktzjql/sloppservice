package com.aimi.standalone;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "CredentialStore")
public class CredentialStorePlugin extends Plugin {
    private static final String ALIAS = "aimi.auth.v1";
    private SharedPreferences prefs() { return getContext().getSharedPreferences("aimi_credentials", Context.MODE_PRIVATE); }
    private boolean allowed(String key) { return key != null && key.startsWith("aimi.android.") && key.length() < 120; }
    private synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            gen.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            gen.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    @PluginMethod public void get(PluginCall call) {
        String name = call.getString("key");
        if (!allowed(name)) { call.reject("INVALID_STORAGE_KEY"); return; }
        try {
            String encoded = prefs().getString(name, null); JSObject result = new JSObject();
            if (encoded == null) { result.put("value", org.json.JSONObject.NULL); call.resolve(result); return; }
            String[] parts = encoded.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception e) { call.reject("CREDENTIAL_READ_FAILED"); }
    }
    @PluginMethod public void set(PluginCall call) {
        String name = call.getString("key"), value = call.getString("value");
        if (!allowed(name) || value == null || value.length() > 65536) { call.reject("INVALID_STORAGE_VALUE"); return; }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key());
            cipher.updateAAD(name.getBytes(StandardCharsets.UTF_8));
            String encoded = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!prefs().edit().putString(name, encoded).commit()) throw new Exception();
            call.resolve();
        } catch (Exception e) { call.reject("CREDENTIAL_WRITE_FAILED"); }
    }
    @PluginMethod public void remove(PluginCall call) {
        String name = call.getString("key");
        if (!allowed(name)) { call.reject("INVALID_STORAGE_KEY"); return; }
        if (prefs().edit().remove(name).commit()) call.resolve(); else call.reject("CREDENTIAL_WRITE_FAILED");
    }
}
