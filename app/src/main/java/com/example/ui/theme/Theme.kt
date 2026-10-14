package com.example.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.example.data.preferences.AppFontStyle
import com.example.data.preferences.AppThemeMode
import com.example.data.preferences.ClientAppearance

fun createVortexColorScheme(appearance: ClientAppearance): ColorScheme {
    val primaryAccent = parseColorHex(appearance.accentHex, DiscordBlurple)

    return when (appearance.themeMode) {
        AppThemeMode.LIGHT -> lightColorScheme(
            primary = primaryAccent,
            onPrimary = Color.White,
            primaryContainer = primaryAccent.copy(alpha = 0.15f),
            onPrimaryContainer = primaryAccent,
            secondary = DiscordNitroPink,
            onSecondary = Color.White,
            tertiary = DiscordNitroGold,
            background = VortexBgLight,
            onBackground = VortexTextLight,
            surface = VortexSurfaceLight,
            onSurface = VortexTextLight,
            surfaceVariant = VortexChannelLight,
            onSurfaceVariant = Color(0xFF4E5058),
            outline = Color(0xFFD1D3D8),
            error = DiscordRed,
            onError = Color.White
        )
        AppThemeMode.AMOLED -> darkColorScheme(
            primary = primaryAccent,
            onPrimary = Color.White,
            primaryContainer = primaryAccent.copy(alpha = 0.25f),
            onPrimaryContainer = Color.White,
            secondary = DiscordNitroPink,
            onSecondary = Color.White,
            secondaryContainer = Color(0xFF350B20),
            tertiary = DiscordNitroGold,
            onTertiary = Color.Black,
            background = VortexBgAmoled,
            onBackground = VortexTextPrimary,
            surface = VortexSurfaceAmoled,
            onSurface = VortexTextPrimary,
            surfaceVariant = VortexChannelAmoled,
            onSurfaceVariant = VortexTextMuted,
            outline = Color(0xFF22242F),
            error = DiscordRed,
            onError = Color.White
        )
        AppThemeMode.OCEAN -> darkColorScheme(
            primary = primaryAccent,
            onPrimary = Color.White,
            primaryContainer = primaryAccent.copy(alpha = 0.25f),
            onPrimaryContainer = Color.White,
            secondary = DiscordNitroPink,
            onSecondary = Color.White,
            secondaryContainer = Color(0xFF350B20),
            tertiary = DiscordCyan,
            onTertiary = Color.Black,
            background = VortexBgOcean,
            onBackground = Color(0xFFF1F5F9),
            surface = VortexSurfaceOcean,
            onSurface = Color(0xFFF1F5F9),
            surfaceVariant = VortexChannelOcean,
            onSurfaceVariant = Color(0xFF94A3B8),
            outline = Color(0xFF1E293B),
            error = DiscordRed,
            onError = Color.White
        )
        AppThemeMode.DARK -> darkColorScheme(
            primary = primaryAccent,
            onPrimary = Color.White,
            primaryContainer = primaryAccent.copy(alpha = 0.25f),
            onPrimaryContainer = Color.White,
            secondary = DiscordNitroPink,
            onSecondary = Color.White,
            secondaryContainer = Color(0xFF6B1D48),
            onSecondaryContainer = DiscordNitroPink,
            tertiary = DiscordNitroGold,
            onTertiary = Color.Black,
            background = VortexBgDark,
            onBackground = VortexTextPrimary,
            surface = VortexSurfaceDark,
            onSurface = VortexTextPrimary,
            surfaceVariant = VortexChannelDark,
            onSurfaceVariant = VortexTextMuted,
            outline = VortexAccentBorder,
            error = DiscordRed,
            onError = Color.White
        )
    }
}

@Composable
fun VortexTheme(
    appearance: ClientAppearance = ClientAppearance(),
    content: @Composable () -> Unit
) {
    val colorScheme = createVortexColorScheme(appearance)
    val typography = createVortexTypography(getFontFamily(appearance.fontStyle))

    MaterialTheme(
        colorScheme = colorScheme,
        typography = typography,
        content = content
    )
}
