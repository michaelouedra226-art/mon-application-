package com.example

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.os.Bundle
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    private var webView: WebView? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Pré-créer les répertoires de cache JS Chromium pour éviter des erreurs de logs "No such file or directory"
        try {
            val cacheDirectory = java.io.File(this.cacheDir, "WebView/Default/HTTP Cache/Code Cache/js")
            if (!cacheDirectory.exists()) {
                cacheDirectory.mkdirs()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Gérer le retour arrière Android de façon naturelle pour retourner à la grille IPTV ou quitter
        onBackPressedDispatcher.addCallback(this) {
            webView?.let { view ->
                if (view.canGoBack()) {
                    view.goBack()
                } else {
                    // Si on est dans le lecteur vidéo ou ailleurs, on peut appeler une fonction JS de fermeture
                    view.evaluateJavascript("if (typeof closePlayer === 'function') { closePlayer(); } else { window.history.back(); }", null)
                }
            }
        }

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier.fillMaxSize()
                ) {
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { context ->
                            WebView(context).apply {
                                webView = this
                                layoutParams = FrameLayout.LayoutParams(
                                    FrameLayout.LayoutParams.MATCH_PARENT,
                                    FrameLayout.LayoutParams.MATCH_PARENT
                                )

                                // Configuration fine du WebViewClient
                                webViewClient = object : WebViewClient() {
                                    override fun shouldOverrideUrlLoading(
                                        view: WebView?,
                                        url: String?
                                    ): Boolean {
                                        // Tout charger au sein du WebView de l'application
                                        return false
                                    }
                                }

                                // Configuration du WebChromeClient pour émuler les fonctionnalités prompt() et alert()
                                webChromeClient = object : WebChromeClient() {
                                    // Gestion de JS alert()
                                    override fun onJsAlert(
                                        view: WebView?,
                                        url: String?,
                                        message: String?,
                                        result: JsResult?
                                    ): Boolean {
                                        AlertDialog.Builder(context)
                                            .setTitle("Mon IPTV Pro")
                                            .setMessage(message)
                                            .setPositiveButton(android.R.string.ok) { _, _ ->
                                                result?.confirm()
                                            }
                                            .setCancelable(false)
                                            .show()
                                        return true
                                    }

                                    // Gestion de JS confirm()
                                    override fun onJsConfirm(
                                        view: WebView?,
                                        url: String?,
                                        message: String?,
                                        result: JsResult?
                                    ): Boolean {
                                        AlertDialog.Builder(context)
                                            .setTitle("Mon IPTV Pro")
                                            .setMessage(message)
                                            .setPositiveButton(android.R.string.ok) { _, _ ->
                                                result?.confirm()
                                            }
                                            .setNegativeButton(android.R.string.cancel) { _, _ ->
                                                result?.cancel()
                                            }
                                            .setCancelable(false)
                                            .show()
                                        return true
                                    }

                                    // Gestion de JS prompt() : Indispensable pour l'import de playlists M3U et XMLTV
                                    override fun onJsPrompt(
                                        view: WebView?,
                                        url: String?,
                                        message: String?,
                                        defaultValue: String?,
                                        result: JsPromptResult?
                                    ): Boolean {
                                        val input = EditText(context).apply {
                                            setText(defaultValue)
                                            setSingleLine()
                                        }
                                        
                                        AlertDialog.Builder(context)
                                            .setTitle("Mon IPTV Pro")
                                            .setMessage(message)
                                            .setView(input)
                                            .setPositiveButton(android.R.string.ok) { _, _ ->
                                                result?.confirm(input.text.toString())
                                            }
                                            .setNegativeButton(android.R.string.cancel) { _, _ ->
                                                result?.cancel()
                                            }
                                            .setCancelable(false)
                                            .show()
                                        return true
                                    }
                                }

                                // Configuration optimale des paramètres de rendu et sécurité
                                settings.apply {
                                    javaScriptEnabled = true
                                    domStorageEnabled = true
                                    databaseEnabled = true
                                    allowFileAccess = true
                                    allowContentAccess = true
                                    mediaPlaybackRequiresUserGesture = false
                                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                                    useWideViewPort = true
                                    loadWithOverviewMode = true
                                }

                                // Charger le fichier index de l'application IPTV placé en assets
                                loadUrl("file:///android_asset/index.html")
                            }
                        }
                    )
                }
            }
        }
    }
}
