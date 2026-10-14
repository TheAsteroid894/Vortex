package com.example.ui.server

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Security
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Server
import com.example.ui.theme.DiscordBlurple
import com.example.ui.theme.DiscordGreen
import com.example.ui.theme.DiscordNitroGold
import com.example.ui.theme.DiscordNitroPink
import com.example.ui.theme.VortexAccentBorder
import com.example.ui.theme.VortexBgDark
import com.example.ui.theme.VortexChannelDark
import com.example.ui.theme.VortexSurfaceDark
import com.example.ui.theme.VortexTextPrimary

@Composable
fun ServerRail(
    servers: List<Server>,
    selectedServer: Server?,
    onSelectServer: (Server) -> Unit,
    onCreateServerClick: () -> Unit,
    onJoinServerClick: () -> Unit,
    onNitroClick: () -> Unit,
    onWebCompanionClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .width(72.dp)
            .fillMaxHeight()
            .background(VortexBgDark)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Direct Messages / Home Vortex Icon
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(DiscordBlurple)
                .clickable {
                    servers.firstOrNull()?.let { onSelectServer(it) }
                }
                .testTag("home_server_button"),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Security,
                contentDescription = "Vortex Home",
                tint = Color.White,
                modifier = Modifier.size(26.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))
        Box(
            modifier = Modifier
                .width(32.dp)
                .height(2.dp)
                .background(VortexAccentBorder)
        )
        Spacer(modifier = Modifier.height(8.dp))

        // List of Servers
        LazyColumn(
            modifier = Modifier.weight(1f),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(servers, key = { it.id }) { server ->
                val isSelected = server.id == selectedServer?.id
                ServerIconItem(
                    server = server,
                    isSelected = isSelected,
                    onClick = { onSelectServer(server) }
                )
            }

            item {
                // Add Server Button (+)
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(VortexChannelDark)
                        .clickable { onCreateServerClick() }
                        .testTag("add_server_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Create Server",
                        tint = DiscordGreen,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            item {
                // Join Server with Code Button
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(VortexChannelDark)
                        .clickable { onJoinServerClick() }
                        .testTag("join_server_button"),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.GroupAdd,
                        contentDescription = "Join Server with Code",
                        tint = DiscordBlurple,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }

        // Web Companion Launcher Button
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(VortexChannelDark)
                .border(1.dp, DiscordBlurple, CircleShape)
                .clickable { onWebCompanionClick() }
                .testTag("web_companion_button"),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Explore,
                contentDescription = "Web Companion Client",
                tint = DiscordBlurple,
                modifier = Modifier.size(24.dp)
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Nitro Diamond Showcase Button at bottom
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(DiscordNitroPink.copy(alpha = 0.2f))
                .border(1.5.dp, DiscordNitroGold, CircleShape)
                .clickable { onNitroClick() }
                .testTag("nitro_showcase_button"),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Diamond,
                contentDescription = "Free Nitro Perks",
                tint = DiscordNitroGold,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

@Composable
private fun ServerIconItem(
    server: Server,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val shape = if (isSelected) RoundedCornerShape(14.dp) else CircleShape
    val bgColor = if (isSelected) DiscordBlurple else VortexSurfaceDark

    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(shape)
            .background(bgColor)
            .clickable { onClick() }
            .testTag("server_item_${server.id}"),
        contentAlignment = Alignment.Center
    ) {
        if (server.iconUrl.isNotBlank() && server.iconUrl.length <= 4) {
            // Emoji icon (e.g. 🎮, 🚀, 💬)
            Text(
                text = server.iconUrl,
                fontSize = 22.sp,
                textAlign = TextAlign.Center
            )
        } else {
            // Acronym initials
            val initials = server.name
                .split(" ")
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase()
                .ifBlank { "V" }
            Text(
                text = initials,
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }
    }
}
