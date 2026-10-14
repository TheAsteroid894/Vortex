package com.example.ui.server

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.Divider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Channel
import com.example.data.model.ChannelType
import com.example.data.model.Server
import com.example.data.model.User
import com.example.ui.theme.DiscordBlurple
import com.example.ui.theme.DiscordGreen
import com.example.ui.theme.DiscordNitroGold
import com.example.ui.theme.DiscordNitroPink
import com.example.ui.theme.DiscordRed
import com.example.ui.theme.VortexAccentBorder
import com.example.ui.theme.VortexChannelDark
import com.example.ui.theme.VortexInputDark
import com.example.ui.theme.VortexSurfaceDark
import com.example.ui.theme.VortexTextMuted
import com.example.ui.theme.VortexTextPrimary
import com.example.ui.viewmodel.ActiveVoiceCallState

@Composable
fun ChannelDrawer(
    server: Server?,
    channels: List<Channel>,
    selectedChannel: Channel?,
    currentUser: User?,
    activeVoiceCall: ActiveVoiceCallState?,
    onSelectChannel: (Channel) -> Unit,
    onCreateChannelClick: () -> Unit,
    onInviteFriendsClick: () -> Unit,
    onServerSettingsClick: () -> Unit,
    onUserSettingsClick: () -> Unit,
    onToggleMute: () -> Unit,
    onToggleDeafen: () -> Unit,
    onDisconnectVoice: () -> Unit,
    onExpandVoiceStage: () -> Unit,
    onAddFriendClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val dmChannels = channels.filter { it.type == ChannelType.TEXT.name && it.name.startsWith("dm-") }
    val regularTextChannels = channels.filter { it.type == ChannelType.TEXT.name && !it.name.startsWith("dm-") }
    val voiceChannels = channels.filter { it.type == ChannelType.VOICE.name || it.type == ChannelType.VIDEO.name }

    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(VortexSurfaceDark)
    ) {
        // Server Header
        if (server != null) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onServerSettingsClick() }
                    .testTag("server_header_button"),
                color = VortexSurfaceDark
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = server.name,
                                color = VortexTextPrimary,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            // Boost Level 3 pill
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(4.dp))
                                    .background(DiscordNitroPink.copy(alpha = 0.2f))
                                    .padding(horizontal = 4.dp, vertical = 1.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.Diamond,
                                        contentDescription = "Boost Level 3",
                                        tint = DiscordNitroPink,
                                        modifier = Modifier.size(10.dp)
                                    )
                                    Spacer(modifier = Modifier.width(2.dp))
                                    Text(
                                        text = "LVL 3",
                                        color = DiscordNitroPink,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                        Text(
                            text = "Code: ${server.inviteCode}",
                            color = VortexTextMuted,
                            fontSize = 11.sp
                        )
                    }

                    IconButton(
                        onClick = { onInviteFriendsClick() },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PersonAdd,
                            contentDescription = "Invite Friends",
                            tint = DiscordBlurple,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
            Divider(color = VortexAccentBorder, thickness = 1.dp)
        }

        // Channel list
        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 8.dp, vertical = 8.dp)
        ) {
            // Direct Messages Section Header
            item {
                ChannelSectionHeader(
                    title = "DIRECT MESSAGES",
                    onAddClick = { onAddFriendClick() }
                )
            }

            if (dmChannels.isEmpty()) {
                item {
                    Text(
                        text = "No direct messages yet.\nTap + to start a chat.",
                        color = VortexTextMuted.copy(alpha = 0.7f),
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                }
            } else {
                items(dmChannels, key = { it.id }) { dm ->
                    val friendName = dm.name.removePrefix("dm-").replace("-", " ")
                    val isSelected = dm.id == selectedChannel?.id
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(6.dp))
                            .background(if (isSelected) VortexInputDark else Color.Transparent)
                            .clickable { onSelectChannel(dm) }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .clip(CircleShape)
                                .background(DiscordBlurple),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("@", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = friendName,
                            color = if (isSelected) Color.White else VortexTextPrimary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f)
                        )
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(DiscordGreen.copy(alpha = 0.2f))
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Text("E2EE", color = DiscordGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(10.dp)) }
            }

            // Text Channels Section Header
            item {
                ChannelSectionHeader(
                    title = "TEXT CHANNELS",
                    onAddClick = { onCreateChannelClick() }
                )
            }

            items(regularTextChannels, key = { it.id }) { channel ->
                val isSelected = channel.id == selectedChannel?.id
                ChannelItemRow(
                    channel = channel,
                    isSelected = isSelected,
                    onClick = { onSelectChannel(channel) }
                )
            }

            // Voice & Video Channels Section Header
            item {
                Spacer(modifier = Modifier.height(16.dp))
                ChannelSectionHeader(
                    title = "VOICE & VIDEO CHANNELS",
                    onAddClick = { onCreateChannelClick() }
                )
            }

            items(voiceChannels, key = { it.id }) { channel ->
                val isConnected = activeVoiceCall?.channel?.id == channel.id
                ChannelItemRow(
                    channel = channel,
                    isSelected = isConnected,
                    onClick = { onSelectChannel(channel) }
                )
            }
        }

        // Active Voice Connected Bar (Discord style)
        if (activeVoiceCall != null) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onExpandVoiceStage() }
                    .testTag("active_voice_bar"),
                color = VortexChannelDark
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.VolumeUp,
                        contentDescription = "Voice Connected",
                        tint = DiscordGreen,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Voice Connected",
                            color = DiscordGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${activeVoiceCall.channel.name} / ${activeVoiceCall.bitrateKbps.toInt()}kbps (${activeVoiceCall.latencyMs}ms)",
                            color = VortexTextMuted,
                            fontSize = 10.sp
                        )
                    }

                    IconButton(
                        onClick = { onExpandVoiceStage() },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.OpenInFull,
                            contentDescription = "Expand Call Stage",
                            tint = VortexTextPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    IconButton(
                        onClick = { onDisconnectVoice() },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = "Disconnect Voice",
                            tint = DiscordRed,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }

        // User Status Control Footer (Discord style)
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexChannelDark
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // User Avatar with status dot
                Box(modifier = Modifier.size(36.dp)) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(DiscordBlurple),
                        contentAlignment = Alignment.Center
                    ) {
                        val initial = (currentUser?.displayName?.firstOrNull() ?: 'U').uppercase()
                        Text(
                            text = "$initial",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }
                    // Green online dot
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(DiscordGreen)
                            .align(Alignment.BottomEnd)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onUserSettingsClick() }
                ) {
                    Text(
                        text = currentUser?.displayName ?: "User",
                        color = VortexTextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    val userHandle = if (!currentUser?.username.isNullOrBlank()) "@${currentUser?.username}" else (currentUser?.customTag ?: "#0001")
                    Text(
                        text = userHandle,
                        color = VortexTextMuted,
                        fontSize = 10.sp
                    )
                }

                // Mic Mute button
                IconButton(
                    onClick = { onToggleMute() },
                    modifier = Modifier.size(32.dp)
                ) {
                    val isMuted = activeVoiceCall?.isMuted ?: false
                    Icon(
                        imageVector = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = "Toggle Mute",
                        tint = if (isMuted) DiscordRed else VortexTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Deafen button
                IconButton(
                    onClick = { onToggleDeafen() },
                    modifier = Modifier.size(32.dp)
                ) {
                    val isDeafened = activeVoiceCall?.isDeafened ?: false
                    Icon(
                        imageVector = if (isDeafened) Icons.Default.HeadsetOff else Icons.Default.Headset,
                        contentDescription = "Toggle Deafen",
                        tint = if (isDeafened) DiscordRed else VortexTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Settings button
                IconButton(
                    onClick = { onUserSettingsClick() },
                    modifier = Modifier.size(32.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Settings,
                        contentDescription = "User Settings",
                        tint = VortexTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ChannelSectionHeader(
    title: String,
    onAddClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = title,
            color = VortexTextMuted,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp
        )
        IconButton(
            onClick = onAddClick,
            modifier = Modifier.size(20.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Add Channel",
                tint = VortexTextMuted,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
private fun ChannelItemRow(
    channel: Channel,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bgColor = if (isSelected) VortexInputDark else Color.Transparent
    val textColor = if (isSelected) VortexTextPrimary else VortexTextMuted

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(bgColor)
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 7.dp)
            .testTag("channel_item_${channel.id}"),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Icon
        when (channel.type) {
            ChannelType.VOICE.name -> {
                Icon(
                    imageVector = Icons.Default.VolumeUp,
                    contentDescription = "Voice Channel",
                    tint = textColor,
                    modifier = Modifier.size(18.dp)
                )
            }
            ChannelType.VIDEO.name -> {
                Icon(
                    imageVector = Icons.Default.Videocam,
                    contentDescription = "Video Channel",
                    tint = textColor,
                    modifier = Modifier.size(18.dp)
                )
            }
            else -> {
                Text(
                    text = "#",
                    color = textColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        Text(
            text = channel.name,
            color = textColor,
            fontSize = 14.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
            modifier = Modifier.weight(1f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        // E2EE lock icon if encrypted
        if (channel.isEncrypted) {
            Icon(
                imageVector = Icons.Default.Lock,
                contentDescription = "E2EE Encrypted",
                tint = DiscordGreen.copy(alpha = 0.8f),
                modifier = Modifier.size(14.dp)
            )
        }
    }
}
