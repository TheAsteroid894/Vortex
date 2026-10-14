package com.example.ui.web

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.DiscordBlurple
import com.example.ui.theme.DiscordGreen
import com.example.ui.theme.VortexAccentBorder
import com.example.ui.theme.VortexBgDark
import com.example.ui.theme.VortexSurfaceDark
import com.example.ui.theme.VortexTextMuted
import com.example.ui.theme.VortexTextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebCompanionScreen(
    onBackToNative: () -> Unit,
    modifier: Modifier = Modifier
) {
    BackHandler {
        onBackToNative()
    }

    var webViewInstance: WebView? = remember { null }
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

    val fileChooserLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uri = result.data?.data
        val clipData = result.data?.clipData
        val results: Array<Uri>? = if (clipData != null) {
            Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
        } else if (uri != null) {
            arrayOf(uri)
        } else null
        filePathCallback?.onReceiveValue(results)
        filePathCallback = null
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(VortexBgDark)
    ) {
        // Top Web Bar
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexSurfaceDark,
            shadowElevation = 2.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onBackToNative,
                    modifier = Modifier.testTag("back_from_web_button")
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back to Native App",
                        tint = VortexTextPrimary
                    )
                }

                Icon(
                    imageVector = Icons.Default.Language,
                    contentDescription = "Web",
                    tint = DiscordBlurple,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Vortex Web Companion",
                            color = VortexTextPrimary,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(DiscordGreen.copy(alpha = 0.2f))
                                .padding(horizontal = 4.dp, vertical = 1.dp)
                        ) {
                            Text(
                                text = "LIVE WEB CLIENT",
                                color = DiscordGreen,
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Text(
                        text = "Browser & Desktop compatible • Low Bandwidth & E2EE",
                        color = VortexTextMuted,
                        fontSize = 11.sp
                    )
                }

                IconButton(
                    onClick = {
                        webViewInstance?.reload()
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Reload Web App",
                        tint = VortexTextMuted
                    )
                }
            }
        }
        Divider(color = VortexAccentBorder, thickness = 1.dp)

        // Android WebView container running the HTML5 Discord Web Companion
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    webViewInstance = this
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = true
                    settings.allowContentAccess = true
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    webViewClient = WebViewClient()
                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            view: WebView?,
                            callback: ValueCallback<Array<Uri>>?,
                            params: FileChooserParams?
                        ): Boolean {
                            filePathCallback?.onReceiveValue(null)
                            filePathCallback = callback
                            val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                                type = "*/*"
                            }
                            try {
                                fileChooserLauncher.launch(intent)
                            } catch (e: Exception) {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = null
                                return false
                            }
                            return true
                        }
                    }
                    loadUrl("file:///android_asset/web/index.html")
                }
            }
        )
    }
}
