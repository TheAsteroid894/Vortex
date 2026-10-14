package com.example.data.preferences

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class AppThemeMode(val id: String, val displayName: String) {
    DARK("dark", "Discord Dark"),
    LIGHT("light", "Discord Light"),
    AMOLED("amoled", "Midnight AMOLED"),
    OCEAN("ocean", "Deep Sea Slate")
}

enum class AppFontStyle(val id: String, val displayName: String) {
    SANS("sans", "Modern Sans"),
    MONO("mono", "Cyber Mono"),
    ROUNDED("rounded", "Friendly Rounded"),
    SERIF("serif", "Classic Serif")
}

data class ClientAppearance(
    val themeMode: AppThemeMode = AppThemeMode.DARK,
    val accentHex: String = "#5865F2",
    val fontStyle: AppFontStyle = AppFontStyle.SANS
)

class ThemePreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("vortex_client_appearance", Context.MODE_PRIVATE)

    private val _appearance = MutableStateFlow(loadAppearance())
    val appearance: StateFlow<ClientAppearance> = _appearance.asStateFlow()

    private fun loadAppearance(): ClientAppearance {
        val themeId = prefs.getString(KEY_THEME, AppThemeMode.DARK.id) ?: AppThemeMode.DARK.id
        val accent = prefs.getString(KEY_ACCENT, "#5865F2") ?: "#5865F2"
        val fontId = prefs.getString(KEY_FONT, AppFontStyle.SANS.id) ?: AppFontStyle.SANS.id

        val theme = AppThemeMode.values().find { it.id == themeId } ?: AppThemeMode.DARK
        val font = AppFontStyle.values().find { it.id == fontId } ?: AppFontStyle.SANS

        return ClientAppearance(
            themeMode = theme,
            accentHex = accent,
            fontStyle = font
        )
    }

    fun setThemeMode(theme: AppThemeMode) {
        prefs.edit().putString(KEY_THEME, theme.id).apply()
        _appearance.value = _appearance.value.copy(themeMode = theme)
    }

    fun setAccentHex(hex: String) {
        prefs.edit().putString(KEY_ACCENT, hex).apply()
        _appearance.value = _appearance.value.copy(accentHex = hex)
    }

    fun setFontStyle(font: AppFontStyle) {
        prefs.edit().putString(KEY_FONT, font.id).apply()
        _appearance.value = _appearance.value.copy(fontStyle = font)
    }

    companion object {
        private const val KEY_THEME = "client_theme"
        private const val KEY_ACCENT = "client_accent_color"
        private const val KEY_FONT = "client_font_style"
    }
}
