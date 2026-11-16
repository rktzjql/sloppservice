package com.aimi.standalone;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(CredentialStorePlugin.class);
        super.onCreate(state);
    }
}
