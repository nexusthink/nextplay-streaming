package com.getaruch.nextplay;

import android.app.UiModeManager;
import android.content.Context;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private Bitmap blackPosterBitmap;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Mantém a tela ligada durante reprodução de Canais Ao Vivo, Filmes e Séries
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);

        blackPosterBitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
        blackPosterBitmap.eraseColor(Color.BLACK);

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.setBackgroundColor(Color.BLACK);
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);

            // Substitui o poster cinza padrão do Android WebView por fundo 100% preto
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public Bitmap getDefaultVideoPoster() {
                    return blackPosterBitmap;
                }
            });

            // Identifica nativamente no Android se o aparelho é uma Smart TV / TV Box ou Celular / Tablet
            boolean isTelevision = false;
            try {
                UiModeManager uiModeManager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
                if (uiModeManager != null
                        && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) {
                    isTelevision = true;
                }
                PackageManager pm = getPackageManager();
                if (pm != null && (pm.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
                        || pm.hasSystemFeature("android.hardware.type.television"))) {
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

    private void triggerJsBackHandler() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.evaluateJavascript(
                    "(function() {" +
                            "  if (typeof window.__nextplayHandleBack === 'function') {" +
                            "    return window.__nextplayHandleBack();" +
                            "  }" +
                            "  var backBtn = document.querySelector('[data-tv-back=\"true\"]');" +
                            "  if (backBtn) { backBtn.click(); return 'handled'; }" +
                            "  var evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });" +
                            "  window.dispatchEvent(evt);" +
                            "  return 'dispatched';" +
                            "})()",
                    null);
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK || event.getKeyCode() == KeyEvent.KEYCODE_ESCAPE) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                triggerJsBackHandler();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        triggerJsBackHandler();
    }
}
