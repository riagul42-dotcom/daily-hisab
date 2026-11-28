package com.glowora.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.Manifest;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_RESULT = 1001;
    private static final int DOWNLOAD_PERMISSION_RESULT = 1002;
    private static final String PREFS_NAME = "dailyhisab_settings";
    private static final String SERVER_URL_KEY = "server_url";

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout errorPanel;
    private TextView errorTitle;
    private TextView serverAddress;
    private String serverUrl;
    private ValueCallback<Uri[]> fileChooserCallback;
    private String pendingDownloadUrl;
    private String pendingDownloadDisposition;
    private String pendingDownloadMimeType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.web_view);
        progressBar = findViewById(R.id.progress_bar);
        errorPanel = findViewById(R.id.error_panel);
        errorTitle = findViewById(R.id.error_title);
        serverAddress = findViewById(R.id.server_address);
        Button retryButton = findViewById(R.id.retry_button);
        Button settingsButton = findViewById(R.id.settings_button);

        SharedPreferences preferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String savedServerUrl = preferences.getString(SERVER_URL_KEY, BuildConfig.SERVER_URL);
        serverUrl = savedServerUrl;
        serverAddress.setText(getString(R.string.current_server, serverUrl));
        retryButton.setOnClickListener(view -> loadSite());
        settingsButton.setOnClickListener(view -> showServerSettings());
        progressBar.setIndeterminateTintList(ColorStateList.valueOf(Color.rgb(5, 150, 105)));

        configureWebView();
        loadSite();
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setTextZoom(88);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        webView.setBackgroundColor(Color.rgb(238, 247, 241));

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                errorPanel.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                errorPanel.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showConnectionError(R.string.ssl_error);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if (request.getMethod().equals("GET") && ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && !sameOrigin(uri)) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
                return null;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setVisibility(newProgress > 0 && newProgress < 100 ? View.VISIBLE : View.GONE);
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/png", "image/jpeg", "image/webp", "image/gif"});
                try {
                    startActivityForResult(Intent.createChooser(intent, "ছবি বাছুন"), FILE_CHOOSER_RESULT);
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, R.string.external_error, Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            downloadFile(url, contentDisposition, mimeType));
    }

    private boolean handleNavigation(Uri uri) {
        String scheme = uri.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            if (sameOrigin(uri)) {
                if (isApk(uri)) {
                    downloadFile(uri.toString(), null, "application/vnd.android.package-archive");
                } else {
                    webView.loadUrl(uri.toString());
                }
            } else {
                openExternal(uri);
            }
            return true;
        }
        openExternal(uri);
        return true;
    }

    private boolean isApk(Uri uri) {
        String path = uri.getPath();
        return path != null && path.toLowerCase(Locale.ROOT).endsWith(".apk");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.external_error, Toast.LENGTH_LONG).show();
        }
    }

    private boolean sameOrigin(Uri uri) {
        Uri base = Uri.parse(serverUrl);
        return base.getHost() != null && base.getHost().equalsIgnoreCase(uri.getHost())
            && base.getScheme().equalsIgnoreCase(uri.getScheme())
            && effectivePort(base) == effectivePort(uri);
    }

    private int effectivePort(Uri uri) {
        int port = uri.getPort();
        if (port != -1) return port;
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80;
    }

    private void loadSite() {
        serverAddress.setText(getString(R.string.current_server, serverUrl));
        errorPanel.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        webView.setVisibility(View.VISIBLE);
        webView.loadUrl(serverUrl);
    }

    private void showConnectionError() {
        showConnectionError(R.string.connection_error);
    }

    private void showConnectionError(int titleRes) {
        progressBar.setVisibility(View.GONE);
        errorTitle.setText(titleRes);
        serverAddress.setText(getString(R.string.current_server, serverUrl));
        webView.setVisibility(View.GONE);
        errorPanel.setVisibility(View.VISIBLE);
    }

    private void showServerSettings() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(serverUrl);
        input.setSelection(serverUrl.length());
        input.setHint(R.string.server_hint);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(R.string.server_settings)
            .setView(input)
            .setPositiveButton(R.string.connect, (dialogInterface, which) -> {
                String normalized = normalizeUrl(input.getText().toString());
                if (normalized == null) {
                    Toast.makeText(this, R.string.invalid_url, Toast.LENGTH_LONG).show();
                    input.requestFocus();
                    return;
                }
                serverUrl = normalized;
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                    .putString(SERVER_URL_KEY, serverUrl).apply();
                webView.clearHistory();
                loadSite();
            })
            .setNegativeButton(R.string.cancel, null)
            .create();
        dialog.setOnShowListener(value -> dialog.getButton(DialogInterface.BUTTON_POSITIVE).setAllCaps(false));
        dialog.show();
    }

    private static String normalizeUrl(String value) {
        String candidate = value == null ? "" : value.trim();
        if (candidate.isEmpty()) return null;
        if (!candidate.contains("://")) candidate = "http://" + candidate;
        Uri uri = Uri.parse(candidate);
        String scheme = uri.getScheme();
        if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) return null;
        if (uri.getHost() == null || uri.getUserInfo() != null) return null;
        return new Uri.Builder().scheme(scheme.toLowerCase(Locale.ROOT)).authority(uri.getAuthority()).build().toString();
    }

    private void downloadFile(String url, String contentDisposition, String mimeType) {
        Uri uri = Uri.parse(url);
        if (!sameOrigin(uri)) return;
        if (Build.VERSION.SDK_INT <= 28
            && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            pendingDownloadUrl = url;
            pendingDownloadDisposition = contentDisposition;
            pendingDownloadMimeType = mimeType;
            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, DOWNLOAD_PERMISSION_RESULT);
            return;
        }
        enqueueDownload(url, contentDisposition, mimeType);
    }

    private void enqueueDownload(String url, String contentDisposition, String mimeType) {
        pendingDownloadUrl = null;
        pendingDownloadDisposition = null;
        pendingDownloadMimeType = null;
        Uri uri = Uri.parse(url);
        String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
        if (fileName == null || fileName.isEmpty()) fileName = "daily-hisab-file";
        fileName = fileName.replaceAll("[\\\\/]", "_");
        if (fileName.length() > 100) fileName = fileName.substring(fileName.length() - 100);

        try {
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setTitle(fileName);
            request.setDescription(getString(R.string.app_name));
            if (mimeType != null && !mimeType.isEmpty()) request.setMimeType(mimeType);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, R.string.download_started, Toast.LENGTH_LONG).show();
        } catch (IllegalArgumentException | SecurityException error) {
            Toast.makeText(this, R.string.download_permission_required, Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode != DOWNLOAD_PERMISSION_RESULT) {
            super.onRequestPermissionsResult(requestCode, permissions, grantResults);
            return;
        }
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED
            && pendingDownloadUrl != null) {
            enqueueDownload(pendingDownloadUrl, pendingDownloadDisposition, pendingDownloadMimeType);
            return;
        }
        pendingDownloadUrl = null;
        pendingDownloadDisposition = null;
        pendingDownloadMimeType = null;
        Toast.makeText(this, R.string.download_permission_required, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER_RESULT) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        Uri[] results = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clipData = data.getClipData();
            if (clipData != null) {
                results = new Uri[clipData.getItemCount()];
                for (int index = 0; index < clipData.getItemCount(); index++) {
                    results[index] = clipData.getItemAt(index).getUri();
                }
            } else if (data.getData() != null) {
                results = new Uri[]{data.getData()};
            }
        }
        if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(results);
        fileChooserCallback = null;
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        getMenuInflater().inflate(R.menu.main, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == R.id.action_reload) {
            loadSite();
            return true;
        }
        if (item.getItemId() == R.id.action_settings) {
            showServerSettings();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onBackPressed() {
        if (errorPanel.getVisibility() == View.VISIBLE) {
            finish();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override
    protected void onPause() {
        webView.onPause();
        webView.pauseTimers();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
