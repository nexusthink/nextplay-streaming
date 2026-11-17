package com.getaruch.nextplay;

import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    private Bitmap blackPosterBitmap;
    private boolean isTelevisionDevice = false;

    public class NextPlayNativeBridge {
        @JavascriptInterface
        public void setFullScreen(final boolean enable, final boolean landscape) {
            runOnUiThread(() -> {
                View decorView = getWindow().getDecorView();
                if (enable) {
                    decorView.setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_FULLSCREEN);
                    if (landscape && !isTelevisionDevice) {
                        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                    }
                } else {
                    decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
                    if (!isTelevisionDevice) {
                        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
                    }
                }
            });
        }

        @JavascriptInterface
        public void openExternalUrl(final String url) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o link.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void downloadAndInstallApk(final String apkUrl) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, "Baixando atualização do NextPlay...", Toast.LENGTH_SHORT).show());
            new Thread(() -> {
                try {
                    URL url = new URL(apkUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.connect();

                    int status = conn.getResponseCode();
                    if (status >= 300 && status < 400) {
                        String redirect = conn.getHeaderField("Location");
                        if (redirect != null) {
                            conn = (HttpURLConnection) new URL(redirect).openConnection();
                            conn.connect();
                        }
                    }

                    long totalLength = conn.getContentLength();
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir != null && !dir.exists()) {
                        dir.mkdirs();
                    }
                    File outFile = new File(dir, "nextplay-update.apk");
                    if (outFile.exists()) {
                        outFile.delete();
                    }

                    InputStream in = conn.getInputStream();
                    FileOutputStream out = new FileOutputStream(outFile);
                    byte[] buffer = new byte[16384];
                    long downloaded = 0;
                    int lastPct = -1;
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                        downloaded += len;
                        if (totalLength > 0) {
                            final int pct = (int) ((downloaded * 100) / totalLength);
                            if (pct != lastPct && (pct % 5 == 0 || pct == 100)) {
                                lastPct = pct;
                                notifyJsUpdateStatus("downloading", pct, null);
                            }
                        }
                    }
                    out.flush();
                    out.close();
                    in.close();

                    notifyJsUpdateStatus("installing", 100, null);

                    runOnUiThread(() -> {
                        try {
                            Uri apkUri = FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    outFile);
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(installIntent);
                        } catch (Exception ex) {
                            openExternalUrl(apkUrl);
                        }
                    });
                } catch (Exception e) {
                    notifyJsUpdateStatus("error", 0, e.getMessage());
                    openExternalUrl(apkUrl);
                }
            }).start();
        }

        @JavascriptInterface
        public void openCastSettings() {
            runOnUiThread(() -> {
                String[] actions = new String[] {
                        "android.settings.CAST_SETTINGS",
                        "android.settings.WIFI_DISPLAY_SETTINGS",
                        Settings.ACTION_DISPLAY_SETTINGS
                };
                for (String action : actions) {
                    try {
                        Intent intent = new Intent(action);
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return;
                    } catch (Exception ignored) {
                    }
                }
                Toast.makeText(MainActivity.this, "Abra Transmitir / Smart View no painel rápido do celular.", Toast.LENGTH_LONG).show();
            });
        }

        @JavascriptInterface
        public void openExternalCastPlayer(final String streamUrl, final String title) {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW);
                    intent.setDataAndType(Uri.parse(streamUrl), "video/*");
                    if (title != null && !title.isEmpty()) {
                        intent.putExtra("title", title);
                        intent.putExtra(Intent.EXTRA_TITLE, title);
                    }
                    Intent chooser = Intent.createChooser(intent, "Transmitir via DLNA / Cast");
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(chooser);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Nenhum aplicativo DLNA/Cast encontrado neste aparelho.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private void notifyJsUpdateStatus(final String status, final int progress, final String error) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            final WebView webView = getBridge().getWebView();
            final String safeErr = error == null ? "null" : ("\"" + error.replace("\"", "'") + "\"");
            runOnUiThread(() -> webView.evaluateJavascript(
                    "if (typeof window.__nextplayApkUpdateEvent === 'function') { window.__nextplayApkUpdateEvent('" + status + "', " + progress + ", " + safeErr + "); }",
                    null));
        }
    }

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
            webView.addJavascriptInterface(new NextPlayNativeBridge(), "NextPlayNative");

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
            isTelevisionDevice = isTelevision;

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
