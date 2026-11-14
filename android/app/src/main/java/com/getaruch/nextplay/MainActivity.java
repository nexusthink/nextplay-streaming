package com.getaruch.nextplay;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mantém a tela ligada durante reprodução de Canais Ao Vivo, Filmes e Séries (Celular, Tablet e Android TV)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);

            // Identifica nativamente no Android se o aparelho é uma Smart TV / TV Box ou Celular / Tablet
            boolean isTelevision = false;
            try {
                UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
                if (uiModeManager != null && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
                    isTelevision = true;
                }
                PackageManager pm = getPackageManager();
                if (pm != null && (pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK) || pm.hasSystemFeature("android.hardware.type.television"))) {
                    isTelevision = true;
                }
            } catch (Exception ignored) {
            }

            String platformTag = isTelevision ? "NextPlayApp/TV" : "NextPlayApp/Android";

            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);

            // Remove marcador "; wv" do WebView para permitir login oficial Google OAuth (accounts.google.com)
            // e anexa o identificador de plataforma (NextPlayApp/TV ou NextPlayApp/Android) para o Switch Inteligente de Auth ID
            String defaultUa = settings.getUserAgentString();
            if (defaultUa != null) {
                String cleanChromeUa = defaultUa
                    .replace("; wv)", ")")
                    .replace("; wv", "")
                    .replace("Version/4.0 ", "");
                settings.setUserAgentString(cleanChromeUa + " " + platformTag);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.evaluateJavascript(
                "(function() {" +
                "  var backBtn = document.querySelector('[data-tv-back=\"true\"]');" +
                "  if (backBtn) { backBtn.click(); return 'handled'; }" +
                "  var evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });" +
                "  window.dispatchEvent(evt);" +
                "  return 'dispatched';" +
                "})()",
                null
            );
            return;
        }
        super.onBackPressed();
    }
}
