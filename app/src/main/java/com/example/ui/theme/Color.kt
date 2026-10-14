package com.example.ui.theme

import androidx.compose.ui.graphics.Color

// Discord & Vortex signature palette
val DiscordBlurple = Color(0xFF5865F2)
val DiscordGreen = Color(0xFF23A55A)
val DiscordCyan = Color(0xFF00B0F4)
val DiscordNitroPink = Color(0xFFEB459E)
val DiscordNitroGold = Color(0xFFFEE75C)
val DiscordRed = Color(0xFFED4245)

// Discord Dark Mode Hierarchy
val VortexBgDark = Color(0xFF1E1F22)
val VortexSurfaceDark = Color(0xFF2B2D31)
val VortexChannelDark = Color(0xFF313338)
val VortexInputDark = Color(0xFF383A40)
val VortexTextPrimary = Color(0xFFF2F3F5)
val VortexTextMuted = Color(0xFF949BA4)
val VortexAccentBorder = Color(0xFF3F4147)

// Light Mode equivalents
val VortexBgLight = Color(0xFFF2F3F5)
val VortexSurfaceLight = Color(0xFFE3E5E8)
val VortexChannelLight = Color(0xFFEBEDEF)
val VortexInputLight = Color(0xFFFFFFFF)
val VortexTextLight = Color(0xFF060607)

// AMOLED Mode
val VortexBgAmoled = Color(0xFF000000)
val VortexSurfaceAmoled = Color(0xFF0B0D13)
val VortexChannelAmoled = Color(0xFF13151D)
val VortexInputAmoled = Color(0xFF1C1E28)

// Ocean Slate Mode
val VortexBgOcean = Color(0xFF090D16)
val VortexSurfaceOcean = Color(0xFF0F172A)
val VortexChannelOcean = Color(0xFF1E293B)
val VortexInputOcean = Color(0xFF334155)

fun parseColorHex(hex: String, default: Color = DiscordBlurple): Color {
    return try {
        val clean = hex.removePrefix("#")
        val colorInt = clean.toLong(16)
        if (clean.length == 6) {
            Color(0xFF000000 or colorInt)
        } else if (clean.length == 8) {
            Color(colorInt)
        } else {
            default
        }
    } catch (e: Exception) {
        default
    }
}
