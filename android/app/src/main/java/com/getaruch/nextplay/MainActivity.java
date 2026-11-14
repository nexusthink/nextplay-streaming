package com.getaruch.nextplay;

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

            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setJavaScriptCanOpenWindowsAutomatically(true);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);

            // Remove marcador "; wv" do WebView para permitir login oficial Google OAuth (accounts.google.com)
            // usando o mesmo Client ID Web em Celular, Tablet e Android TV sem erro 403 disallowed_useragent
            String defaultUa = settings.getUserAgentString();
            if (defaultUa != null) {
                String cleanChromeUa = defaultUa
                    .replace("; wv)", ")")
                    .replace("; wv", "")
                    .replace("Version/4.0 ", "");
                settings.setUserAgentString(cleanChromeUa);
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
