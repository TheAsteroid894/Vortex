package com.example.ui.dialogs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.FolderZip
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.crypto.E2EEManager
import com.example.data.model.Attachment
import com.example.data.model.ChannelType
import com.example.data.model.Server
import com.example.data.model.User
import com.example.ui.theme.DiscordBlurple
import com.example.ui.theme.DiscordGreen
import com.example.ui.theme.DiscordNitroGold
import com.example.ui.theme.DiscordNitroPink
import com.example.ui.theme.DiscordRed
import com.example.ui.theme.VortexAccentBorder
import com.example.ui.theme.VortexBgDark
import com.example.ui.theme.VortexChannelDark
import com.example.ui.theme.VortexInputDark
import com.example.ui.theme.VortexSurfaceDark
import com.example.ui.theme.VortexTextMuted
import com.example.ui.theme.VortexTextPrimary
import com.example.ui.theme.DiscordCyan
import com.example.ui.theme.parseColorHex
import com.example.data.preferences.AppFontStyle
import com.example.data.preferences.AppThemeMode
import com.example.data.preferences.ClientAppearance

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateServerDialog(
    onDismiss: () -> Unit,
    onCreateServer: (name: String, description: String, iconEmoji: String) -> Unit
) {
    var serverName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var selectedEmoji by remember { mutableStateOf("🎮") }
    val emojiOptions = listOf("🎮", "🚀", "💬", "⚡", "🛡️", "🎧", "🌟", "👾")

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = "Create Your Server",
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Your server is where you and your friends hang out. Make yours and start talking.",
                    color = VortexTextMuted,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "SERVER ICON",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    emojiOptions.forEach { emoji ->
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (selectedEmoji == emoji) DiscordBlurple else VortexInputDark)
                                .clickable { selectedEmoji = emoji },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(text = emoji, fontSize = 18.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = serverName,
                    onValueChange = { serverName = it },
                    label = { Text("SERVER NAME") },
                    placeholder = { Text("e.g. Cyber Squad") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("server_name_input"),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = description,
                    onValueChange = { description = it },
                    label = { Text("TOPIC / DESCRIPTION") },
                    placeholder = { Text("e.g. Gaming, coding and voice chats") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (serverName.isNotBlank()) {
                        onCreateServer(serverName.trim(), description.trim(), selectedEmoji)
                        onDismiss()
                    }
                },
                enabled = serverName.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.testTag("confirm_create_server_button")
            ) {
                Text("Create Server")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Cancel", color = VortexTextMuted)
            }
        }
    )
}

@Composable
fun JoinServerDialog(
    onDismiss: () -> Unit,
    onJoinServer: (inviteCode: String) -> Unit
) {
    var inviteCodeInput by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = "Join a Server",
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Enter an invite code below to join an existing friend's server.",
                    color = VortexTextMuted,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = inviteCodeInput,
                    onValueChange = { inviteCodeInput = it },
                    label = { Text("INVITE CODE") },
                    placeholder = { Text("e.g. VTX-4921") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("join_invite_code_input"),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (inviteCodeInput.isNotBlank()) {
                        onJoinServer(inviteCodeInput.trim())
                        onDismiss()
                    }
                },
                enabled = inviteCodeInput.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.testTag("confirm_join_server_button")
            ) {
                Text("Join Server")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Cancel", color = VortexTextMuted)
            }
        }
    )
}

@Composable
fun CreateChannelDialog(
    onDismiss: () -> Unit,
    onCreateChannel: (name: String, topic: String, type: ChannelType, isEncrypted: Boolean) -> Unit
) {
    var channelName by remember { mutableStateOf("") }
    var topic by remember { mutableStateOf("") }
    var channelType by remember { mutableStateOf(ChannelType.TEXT) }
    var isEncrypted by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = "Create Channel",
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "CHANNEL TYPE",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                // Channel Type Pickers
                ChannelTypeOptionCard(
                    title = "Text",
                    subtitle = "Post messages, images, memes, and files",
                    icon = Icons.Default.InsertDriveFile,
                    isSelected = channelType == ChannelType.TEXT,
                    onClick = { channelType = ChannelType.TEXT }
                )
                Spacer(modifier = Modifier.height(8.dp))
                ChannelTypeOptionCard(
                    title = "Voice",
                    subtitle = "Hang out together with voice and audio",
                    icon = Icons.Default.VolumeUp,
                    isSelected = channelType == ChannelType.VOICE,
                    onClick = { channelType = ChannelType.VOICE }
                )
                Spacer(modifier = Modifier.height(8.dp))
                ChannelTypeOptionCard(
                    title = "Video & Streaming",
                    subtitle = "HD 1080p 60FPS video and screen sharing",
                    icon = Icons.Default.Videocam,
                    isSelected = channelType == ChannelType.VIDEO,
                    onClick = { channelType = ChannelType.VIDEO }
                )

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = channelName,
                    onValueChange = { channelName = it },
                    label = { Text("CHANNEL NAME") },
                    placeholder = { Text("new-channel") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("channel_name_input"),
                    shape = RoundedCornerShape(10.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // E2EE Switch
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(VortexInputDark)
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "E2EE",
                            tint = DiscordGreen,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Column {
                            Text(
                                text = "End-to-End Encrypted",
                                color = VortexTextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Text(
                                text = "Zero-knowledge AES-GCM privacy",
                                color = VortexTextMuted,
                                fontSize = 11.sp
                            )
                        }
                    }
                    Switch(
                        checked = isEncrypted,
                        onCheckedChange = { isEncrypted = it },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = DiscordGreen,
                            checkedTrackColor = DiscordGreen.copy(alpha = 0.3f)
                        )
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (channelName.isNotBlank()) {
                        onCreateChannel(channelName.trim(), topic.trim(), channelType, isEncrypted)
                        onDismiss()
                    }
                },
                enabled = channelName.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.testTag("confirm_create_channel_button")
            ) {
                Text("Create Channel")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Cancel", color = VortexTextMuted)
            }
        }
    )
}

@Composable
private fun ChannelTypeOptionCard(
    title: String,
    subtitle: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) DiscordBlurple.copy(alpha = 0.2f) else VortexInputDark)
            .border(
                1.dp,
                if (isSelected) DiscordBlurple else Color.Transparent,
                RoundedCornerShape(8.dp)
            )
            .clickable { onClick() }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (isSelected) DiscordBlurple else VortexTextMuted,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = VortexTextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = subtitle,
                color = VortexTextMuted,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
fun NitroShowcaseDialog(
    onDismiss: () -> Unit,
    onWatchAdForNitro: () -> Unit = {},
    onWatchAdForBoost: () -> Unit = {}
) {
    var showAdDialog by remember { mutableStateOf<String?>(null) }
    var rewardClaimedNotice by remember { mutableStateOf<String?>(null) }

    if (showAdDialog != null) {
        AdRewardDialog(
            rewardType = showAdDialog!!,
            onDismiss = { showAdDialog = null },
            onRewardEarned = { type ->
                showAdDialog = null
                rewardClaimedNotice = if (type == "nitro") "1 Month Vortex Nitro activated!" else "Server boosted for 30 days!"
                if (type == "nitro") onWatchAdForNitro() else onWatchAdForBoost()
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Diamond,
                    contentDescription = "Nitro",
                    tint = DiscordNitroGold,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Nitro & Server Boosts",
                    color = VortexTextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                if (rewardClaimedNotice != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(DiscordGreen.copy(alpha = 0.2f))
                            .border(1.dp, DiscordGreen, RoundedCornerShape(8.dp))
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "🎉 $rewardClaimedNotice",
                            color = DiscordGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                }

                Text(
                    text = "Watch a short partner sponsor video to unlock 1 Month of full Nitro and Server Boost perks. Ads are NEVER shown in chat, servers, or calls.",
                    color = VortexTextMuted,
                    fontSize = 13.sp,
                    lineHeight = 17.sp
                )
                Spacer(modifier = Modifier.height(12.dp))

                // Watch Ad for Nitro Button
                Button(
                    onClick = { showAdDialog = "nitro" },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = DiscordNitroPink),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("🎬 Watch Ad to Unlock 1 Month Nitro", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Watch Ad for Server Boost Button
                Button(
                    onClick = { showAdDialog = "boost" },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("🚀 Watch Ad to Boost Server (30 Days)", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(14.dp))

                NitroPerkItem(
                    emoji = "🚀",
                    title = "500MB Large File Uploads",
                    desc = "Share high-resolution 4K clips, game recordings, and massive zip archives seamlessly."
                )
                Spacer(modifier = Modifier.height(8.dp))
                NitroPerkItem(
                    emoji = "📹",
                    title = "HD 1080p 60FPS Streaming",
                    desc = "Crisp screen broadcasts and video stages with ultra-low latency."
                )
                Spacer(modifier = Modifier.height(8.dp))
                NitroPerkItem(
                    emoji = "💎",
                    title = "Server Boost Level 3 Included",
                    desc = "384kbps high-fidelity audio and custom server vanity links."
                )
                Spacer(modifier = Modifier.height(8.dp))
                NitroPerkItem(
                    emoji = "✨",
                    title = "Custom Discriminator & Banner",
                    desc = "Personalize your @handle, custom tag, and header banner color."
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = VortexInputDark),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Close", color = VortexTextPrimary)
            }
        }
    )
}

@Composable
fun AdRewardDialog(
    rewardType: String,
    onDismiss: () -> Unit,
    onRewardEarned: (String) -> Unit
) {
    var secondsLeft by remember { mutableStateOf(15) }
    var isCompleted by remember { mutableStateOf(false) }

    androidx.compose.runtime.LaunchedEffect(Unit) {
        while (secondsLeft > 0) {
            kotlinx.coroutines.delay(1000)
            secondsLeft--
        }
        isCompleted = true
    }

    AlertDialog(
        onDismissRequest = {
            if (isCompleted) onDismiss()
        },
        containerColor = Color(0xFF111214),
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "SPONSORED PARTNER AD",
                    color = DiscordNitroGold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = if (isCompleted) "Ready! 🎉" else "${secondsLeft}s",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(160.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF1A1C23)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "🎮", fontSize = 38.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "NordVPN • Secure Gaming",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Ultrafast encrypted gaming routes & DDoS defense",
                            color = VortexTextMuted,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 16.dp),
                            textAlign = TextAlign.Center
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Progress Bar
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color(0xFF2B2D31))
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction = (15 - secondsLeft) / 15f)
                            .height(6.dp)
                            .background(DiscordBlurple)
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = if (isCompleted)
                        "Reward unlocked! Claim your ${if (rewardType == "nitro") "1 Month Nitro" else "Server Boost"} below."
                    else
                        "Watching sponsor video to unlock ${if (rewardType == "nitro") "1 Month Nitro" else "Server Boost"}...",
                    color = if (isCompleted) DiscordGreen else VortexTextMuted,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onRewardEarned(rewardType) },
                enabled = isCompleted,
                colors = ButtonDefaults.buttonColors(
                    containerColor = DiscordGreen,
                    disabledContainerColor = VortexInputDark
                ),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = if (isCompleted) "Claim 30 Days!" else "Watch (${secondsLeft}s)",
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        dismissButton = {
            if (isCompleted) {
                OutlinedButton(onClick = onDismiss, shape = RoundedCornerShape(8.dp)) {
                    Text("Close", color = VortexTextMuted)
                }
            }
        }
    )
}

@Composable
private fun NitroPerkItem(
    emoji: String,
    title: String,
    desc: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(VortexInputDark)
            .padding(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(text = emoji, fontSize = 22.sp)
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = DiscordNitroGold,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = desc,
                color = VortexTextMuted,
                fontSize = 11.sp,
                lineHeight = 15.sp
            )
        }
    }
}

@Composable
fun UserSettingsDialog(
    user: User?,
    appearance: ClientAppearance = ClientAppearance(),
    onDismiss: () -> Unit,
    onSaveBandwidthSettings: (lowBandwidth: Boolean, audioBitrate: Double) -> Unit,
    onSaveProfile: (displayName: String, username: String, bio: String, customTag: String, bannerColor: String) -> Unit,
    onSaveAppearance: (AppThemeMode, String, AppFontStyle) -> Unit,
    onSignOut: () -> Unit
) {
    var lowBandwidth by remember(user) { mutableStateOf(user?.lowBandwidthMode ?: false) }
    var displayName by remember(user) { mutableStateOf(user?.displayName ?: "") }
    var username by remember(user) { mutableStateOf(user?.username ?: "") }
    var bio by remember(user) { mutableStateOf(user?.bio ?: "") }
    var customTag by remember(user) { mutableStateOf(user?.customTag ?: "#1337") }
    var bannerColor by remember(user) { mutableStateOf(user?.bannerColor ?: "#5865F2") }

    var selectedTheme by remember(appearance) { mutableStateOf(appearance.themeMode) }
    var selectedAccent by remember(appearance) { mutableStateOf(appearance.accentHex) }
    var selectedFont by remember(appearance) { mutableStateOf(appearance.fontStyle) }

    val safetyFingerprint = remember { E2EEManager.generateSafetyFingerprint(user?.userId ?: "vortex") }

    val accentColors = listOf(
        "#5865F2" to "Blurple",
        "#23A55A" to "Green",
        "#00B0F4" to "Cyan",
        "#EB459E" to "Pink",
        "#FEE75C" to "Amber",
        "#ED4245" to "Red"
    )

    var showAdDialog by remember { mutableStateOf<String?>(null) }
    var adRewardNotice by remember { mutableStateOf<String?>(null) }
    var legalDialogContent by remember { mutableStateOf<Pair<String, String>?>(null) }

    if (showAdDialog != null) {
        AdRewardDialog(
            rewardType = showAdDialog!!,
            onDismiss = { showAdDialog = null },
            onRewardEarned = { type ->
                showAdDialog = null
                adRewardNotice = if (type == "nitro") "1 Month Nitro activated!" else "Server boosted for 30 days!"
            }
        )
    }

    if (legalDialogContent != null) {
        LegalViewerDialog(
            title = legalDialogContent!!.first,
            content = legalDialogContent!!.second,
            onDismiss = { legalDialogContent = null }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = "Settings & Client Appearance",
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                // Profile Customization
                Text(
                    text = "PROFILE & USERNAME",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = displayName,
                    onValueChange = { displayName = it },
                    label = { Text("DISPLAY NAME") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = username,
                    onValueChange = { username = it },
                    label = { Text("USERNAME (@handle)") },
                    placeholder = { Text("e.g. cyber_vortex") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = customTag,
                    onValueChange = { customTag = it },
                    label = { Text("CUSTOM TAG") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )
                Spacer(modifier = Modifier.height(8.dp))

                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it },
                    label = { Text("ABOUT ME") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Custom Themes
                Text(
                    text = "CLIENT THEME (SAVED IN APP)",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    AppThemeMode.values().forEach { mode ->
                        val isSelected = selectedTheme == mode
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) parseColorHex(selectedAccent) else VortexInputDark)
                                .clickable { selectedTheme = mode }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = when (mode) {
                                    AppThemeMode.DARK -> "Dark"
                                    AppThemeMode.LIGHT -> "Light"
                                    AppThemeMode.AMOLED -> "AMOLED"
                                    AppThemeMode.OCEAN -> "Ocean"
                                },
                                color = if (isSelected) Color.White else VortexTextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Custom Accent Colors
                Text(
                    text = "ACCENT COLOR",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    accentColors.forEach { (hex, name) ->
                        val isSelected = selectedAccent.equals(hex, ignoreCase = true)
                        val color = parseColorHex(hex)
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(color)
                                .border(
                                    width = if (isSelected) 3.dp else 1.dp,
                                    color = if (isSelected) Color.White else Color.Transparent,
                                    shape = CircleShape
                                )
                                .clickable { selectedAccent = hex },
                            contentAlignment = Alignment.Center
                        ) {
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Custom Typography Fonts
                Text(
                    text = "CLIENT FONT STYLE",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    AppFontStyle.values().forEach { font ->
                        val isSelected = selectedFont == font
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) parseColorHex(selectedAccent) else VortexInputDark)
                                .clickable { selectedFont = font }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = when (font) {
                                    AppFontStyle.SANS -> "Sans"
                                    AppFontStyle.MONO -> "Mono"
                                    AppFontStyle.ROUNDED -> "Round"
                                    AppFontStyle.SERIF -> "Serif"
                                },
                                color = if (isSelected) Color.White else VortexTextPrimary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Low Bandwidth Mode Section
                Text(
                    text = "BANDWIDTH & PERFORMANCE",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(VortexInputDark)
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Bolt,
                                contentDescription = "Low Bandwidth",
                                tint = Color(0xFF00B0F4),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Ultra-Low Bandwidth Mode",
                                color = VortexTextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                        Text(
                            text = "Compresses messages with GZIP and tunes voice audio to 6kbps Opus codec. Saves 85% mobile data.",
                            color = VortexTextMuted,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                    Switch(
                        checked = lowBandwidth,
                        onCheckedChange = {
                            lowBandwidth = it
                            onSaveBandwidthSettings(it, if (it) 6.0 else 64.0)
                        },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color(0xFF00B0F4),
                            checkedTrackColor = Color(0xFF00B0F4).copy(alpha = 0.3f)
                        )
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // End-to-End Encryption Safety Fingerprint
                Text(
                    text = "E2EE ENCRYPTION FINGERPRINT",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(VortexInputDark)
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Security,
                        contentDescription = "Fingerprint",
                        tint = DiscordGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = safetyFingerprint,
                        color = DiscordGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                    )
                }

                if (adRewardNotice != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(DiscordGreen.copy(alpha = 0.2f))
                            .border(1.dp, DiscordGreen, RoundedCornerShape(8.dp))
                            .padding(10.dp)
                    ) {
                        Text(
                            text = "🎉 $adRewardNotice",
                            color = DiscordGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Nitro & Server Boosts through Ads
                Text(
                    text = "NITRO & SERVER BOOSTS (AD-SUPPORTED)",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Button(
                    onClick = { showAdDialog = "nitro" },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = DiscordNitroPink),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("🎬 Watch Ad to Unlock 1 Month Nitro", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(6.dp))

                Button(
                    onClick = { showAdDialog = "boost" },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("🚀 Watch Ad to Boost Server (30 Days)", color = Color.White, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Zero-Distraction Guarantee: Ads are only shown when watching to claim Nitro/Boost rewards. Chat, servers & calls are 100% ad-free.",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    modifier = Modifier.padding(horizontal = 4.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Legal Pages
                Text(
                    text = "LEGAL & POLICIES",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            legalDialogContent = "Terms of Service" to """
                                1. AGREEMENT TO TERMS
                                By using Vortex across Android, Web, or API clients, you agree to these Terms of Service.

                                2. PRIVACY & ZERO-KNOWLEDGE ARCHITECTURE
                                Vortex provides an encrypted, low-bandwidth communication service. Encrypted messages are sealed using client-side AES-GCM cryptography. We cannot read, decrypt, or sell your encrypted transmissions.

                                3. USER CONTENT & OWNERSHIP
                                You retain ownership of all intellectual property in content, messages, and files transmitted through Vortex.

                                4. AD-SUPPORTED REWARDS MODEL
                                Sponsored advertisements are only presented when you explicitly request to watch a reward ad to claim monthly Nitro or Server Boosts. No ads are injected into chat channels.

                                5. PROHIBITED CONDUCT
                                Harassment, unauthorized access, malware distribution, and illegal content are strictly prohibited and result in immediate termination of access.
                            """.trimIndent()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Terms", fontSize = 11.sp)
                    }

                    OutlinedButton(
                        onClick = {
                            legalDialogContent = "Privacy Policy" to """
                                1. INFORMATION WE STORE
                                We practice strict data minimization. We store your chosen display name, username (@handle), custom tag, bio, and client appearance preferences.

                                2. END-TO-END CRYPTOGRAPHY
                                Encrypted channel messages are encrypted on your device using AES-256-GCM before transmission. Database records contain only ciphertexts (vtx_enc:).

                                3. ADVERTISING & PRIVACY
                                We do NOT track your behavior, sell personal data, or inject banner ads. Ads are strictly user-initiated for rewards.

                                4. DATA SECURITY & RIGHTS
                                Data is stored with Firestore security rules enforcing per-user access control. You may update or delete your profile at any time.
                            """.trimIndent()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Privacy", fontSize = 11.sp)
                    }

                    OutlinedButton(
                        onClick = {
                            legalDialogContent = "Community Guidelines" to """
                                1. RESPECTFUL COMMUNITY
                                Treat all members with respect. Hate speech, harassment, intimidation, and abuse are strictly forbidden.

                                2. SAFETY & PROTECTION
                                Child endangerment, self-harm promotion, and illegal threats will lead to permanent account removal.

                                3. ANTI-SPAM
                                Automated flooding, spamming, and bot exploitation are prohibited.

                                4. SERVER MODERATION
                                Server owners have full discretion to moderate their communities and remove disruptive members.
                            """.trimIndent()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Guidelines", fontSize = 11.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Sign Out Button
                OutlinedButton(
                    onClick = onSignOut,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = DiscordRed),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Sign Out",
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Sign Out")
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSaveProfile(displayName, username, bio, customTag, bannerColor)
                    onSaveAppearance(selectedTheme, selectedAccent, selectedFont)
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = parseColorHex(selectedAccent)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Save Changes")
            }
        },
        dismissButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Close", color = VortexTextMuted)
            }
        }
    )
}

@Composable
fun LegalViewerDialog(
    title: String,
    content: String,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = title,
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(350.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(VortexInputDark)
                    .padding(14.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = content,
                    color = VortexTextPrimary,
                    fontSize = 12.sp,
                    lineHeight = 18.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Close", color = Color.White)
            }
        }
    )
}

@Composable
fun AttachmentPickerDialog(
    onDismiss: () -> Unit,
    onSendAttachment: (Attachment) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Diamond,
                    contentDescription = "Nitro Uploads",
                    tint = DiscordNitroGold,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Send Large Media & Files",
                    color = VortexTextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Seamless uploads up to 500MB:",
                    color = VortexTextMuted,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                MediaSampleTile(
                    icon = Icons.Default.Movie,
                    title = "Gameplay_Clips_4K_60FPS.mp4",
                    size = "412.5 MB",
                    type = "video/mp4",
                    onClick = {
                        onSendAttachment(
                            Attachment(
                                fileName = "Gameplay_Clips_4K_60FPS.mp4",
                                fileType = "video/mp4",
                                fileSizeFormatted = "412.5 MB",
                                isLargeMedia = true
                            )
                        )
                        onDismiss()
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                MediaSampleTile(
                    icon = Icons.Default.FolderZip,
                    title = "Vortex_Project_Source_Assets.zip",
                    size = "184.2 MB",
                    type = "application/zip",
                    onClick = {
                        onSendAttachment(
                            Attachment(
                                fileName = "Vortex_Project_Source_Assets.zip",
                                fileType = "application/zip",
                                fileSizeFormatted = "184.2 MB",
                                isLargeMedia = true
                            )
                        )
                        onDismiss()
                    }
                )

                Spacer(modifier = Modifier.height(8.dp))

                MediaSampleTile(
                    icon = Icons.Default.Image,
                    title = "Cyberpunk_Hologram_Render.png",
                    size = "48.6 MB",
                    type = "image/png",
                    onClick = {
                        onSendAttachment(
                            Attachment(
                                fileName = "Cyberpunk_Hologram_Render.png",
                                fileType = "image/png",
                                fileSizeFormatted = "48.6 MB",
                                isLargeMedia = false
                            )
                        )
                        onDismiss()
                    }
                )
            }
        },
        confirmButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Cancel", color = VortexTextMuted)
            }
        }
    )
}

@Composable
private fun MediaSampleTile(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    size: String,
    type: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(VortexInputDark)
            .border(1.dp, VortexAccentBorder, RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(DiscordBlurple.copy(alpha = 0.2f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = DiscordBlurple,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = VortexTextPrimary,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "$size • Media Upload",
                color = VortexTextMuted,
                fontSize = 11.sp
            )
        }
    }
}

@Composable
fun ServerSettingsDialog(
    server: Server?,
    onDismiss: () -> Unit
) {
    if (server == null) return

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Text(
                text = server.name,
                color = VortexTextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = server.description.ifBlank { "No description set." },
                    color = VortexTextMuted,
                    fontSize = 13.sp
                )
                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "INVITE LINK / CODE",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(VortexInputDark)
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "https://vortex.chat/invite/${server.inviteCode}",
                        color = DiscordBlurple,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(DiscordNitroPink.copy(alpha = 0.15f))
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Diamond,
                        contentDescription = null,
                        tint = DiscordNitroPink,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Server Boost Level 3 Unlocked",
                            color = DiscordNitroPink,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "Boosted Perks: 384Kbps Audio, 1080p 60FPS Streams",
                            color = VortexTextMuted,
                            fontSize = 11.sp
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = onDismiss,
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Done")
            }
        }
    )
}

@Composable
fun AddFriendDialog(
    currentUser: User?,
    onDismiss: () -> Unit,
    onStartDm: (friendName: String) -> Unit
) {
    var friendTagInput by remember { mutableStateOf("") }
    var requestSent by remember { mutableStateOf(false) }

    val friendsList = remember {
        listOf(
            Triple("Alex Cyber", "#1337", true),
            Triple("Sarah_Gamer", "#0042", true),
            Triple("NeonNinja", "#8821", false)
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = VortexSurfaceDark,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Security,
                    contentDescription = "Friends",
                    tint = DiscordBlurple,
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Direct Messages & Friends",
                    color = VortexTextPrimary,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = "ADD FRIEND BY USERNAME#TAG",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = friendTagInput,
                        onValueChange = { friendTagInput = it },
                        placeholder = { Text("e.g. Alex#1337") },
                        modifier = Modifier
                            .weight(1f)
                            .testTag("friend_tag_input"),
                        shape = RoundedCornerShape(8.dp),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = VortexInputDark,
                            unfocusedContainerColor = VortexInputDark,
                            focusedTextColor = VortexTextPrimary,
                            unfocusedTextColor = VortexTextPrimary
                        )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (friendTagInput.isNotBlank()) {
                                requestSent = true
                                friendTagInput = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Add")
                    }
                }

                if (requestSent) {
                    Text(
                        text = "✓ Friend request sent! Encrypted DM ready.",
                        color = DiscordGreen,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 6.dp)
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = "YOUR FRIENDS (${friendsList.size})",
                    color = VortexTextMuted,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))

                friendsList.forEach { (name, tag, isOnline) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(VortexInputDark)
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .clip(CircleShape)
                                    .background(DiscordBlurple),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = name.first().toString(),
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text(
                                    text = name,
                                    color = VortexTextPrimary,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = tag,
                                    color = VortexTextMuted,
                                    fontSize = 11.sp
                                )
                            }
                        }

                        Button(
                            onClick = {
                                onStartDm(name)
                                onDismiss()
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text("Chat 🔒", fontSize = 11.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                }
            }
        },
        confirmButton = {
            OutlinedButton(
                onClick = onDismiss,
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Close", color = VortexTextMuted)
            }
        }
    )
}

