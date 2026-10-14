package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = DiscordBlurple,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF4752C4),
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

private val LightColorScheme = lightColorScheme(
    primary = DiscordBlurple,
    onPrimary = Color.White,
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

@Composable
fun VortexTheme(
    darkTheme: Boolean = true, // Default to Discord dark theme
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
