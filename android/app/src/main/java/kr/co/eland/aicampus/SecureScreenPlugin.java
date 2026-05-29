package kr.co.eland.aicampus;

import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecureScreen")
public class SecureScreenPlugin extends Plugin {

    @PluginMethod
    public void setSecure(PluginCall call) {
        final boolean secure = call.getBoolean("secure", false) != null
                && Boolean.TRUE.equals(call.getBoolean("secure", false));

        getActivity().runOnUiThread(() -> {
            if (secure) {
                getActivity().getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_SECURE,
                        WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
        });

        call.resolve();
    }
}
