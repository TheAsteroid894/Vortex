package com.example.ui.voice

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.Headset
import androidx.compose.material.icons.filled.HeadsetOff
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.ScreenShare
import androidx.compose.material.icons.filled.StopScreenShare
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material.icons.filled.VideocamOff
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.User
import com.example.data.model.VoiceSession
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
import com.example.ui.viewmodel.ActiveVoiceCallState

@Composable
fun VoiceRoomScreen(
    voiceState: ActiveVoiceCallState,
    voiceSession: VoiceSession?,
    currentUser: User?,
    onToggleMute: () -> Unit,
    onToggleDeafen: () -> Unit,
    onToggleVideo: () -> Unit,
    onToggleScreenShare: () -> Unit,
    onSimulateSpeaking: (Boolean) -> Unit,
    onDisconnect: () -> Unit,
    onCloseStage: () -> Unit,
    modifier: Modifier = Modifier
) {
    val participants = voiceSession?.activeParticipants ?: emptyList()
    val isSpeaking = voiceState.isSpeaking
    val isLowBandwidth = currentUser?.lowBandwidthMode == true

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(VortexBgDark)
    ) {
        // Top Room Header
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexSurfaceDark
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(DiscordGreen)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = voiceState.channel.name,
                            color = VortexTextPrimary,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Lock,
                                contentDescription = "SRTP E2EE",
                                tint = DiscordGreen,
                                modifier = Modifier.size(11.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = if (isLowBandwidth) "E2EE • Opus Ultra-Low 6kbps" else "E2EE • Opus Hi-Fi 64kbps",
                                color = DiscordGreen,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Free Nitro HD Streaming badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(DiscordNitroPink.copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 3.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Diamond,
                                contentDescription = "Nitro Stream",
                                tint = DiscordNitroPink,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = "1080p 60FPS",
                                color = DiscordNitroPink,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    IconButton(onClick = onCloseStage) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Minimize Stage",
                            tint = VortexTextMuted
                        )
                    }
                }
            }
        }
        Divider(color = VortexAccentBorder, thickness = 1.dp)

        // Stage Main View / Video Grid
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(12.dp)
        ) {
            if (voiceState.isScreenSharing) {
                // Large Screen Share Display
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF111214))
                        .border(2.dp, DiscordNitroPink, RoundedCornerShape(16.dp)),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ScreenShare,
                        contentDescription = "Screen Streaming",
                        tint = DiscordNitroPink,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "${currentUser?.displayName ?: "User"}'s Screen",
                        color = VortexTextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Broadcasting HD 1080p 60FPS with End-to-End Encryption",
                        color = VortexTextMuted,
                        fontSize = 12.sp
                    )
                }
            } else {
                // Grid of participants
                val participantList = if (participants.isNotEmpty()) participants else listOf(
                    mapOf(
                        "userId" to (currentUser?.userId ?: "me"),
                        "displayName" to (currentUser?.displayName ?: "Me"),
                        "isMuted" to voiceState.isMuted,
                        "isDeafened" to voiceState.isDeafened,
                        "isVideoOn" to voiceState.isVideoOn,
                        "isSpeaking" to isSpeaking
                    )
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(if (participantList.size > 2) 2 else 1),
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(participantList) { p ->
                        val name = p["displayName"] as? String ?: "User"
                        val pMuted = p["isMuted"] as? Boolean ?: false
                        val pSpeaking = p["isSpeaking"] as? Boolean ?: isSpeaking
                        val pVideo = p["isVideoOn"] as? Boolean ?: voiceState.isVideoOn

                        ParticipantStageCard(
                            displayName = name,
                            isSpeaking = pSpeaking,
                            isMuted = pMuted,
                            isVideoOn = pVideo,
                            onCardClick = { onSimulateSpeaking(!isSpeaking) }
                        )
                    }
                }
            }
        }

        // Live Audio Telemetry Ribbon
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexChannelDark
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (isLowBandwidth) "⚡ Mode: Ultra-Low Bandwidth (6 kbps)" else "🚀 Mode: High-Fi Stereo (64 kbps)",
                    color = if (isLowBandwidth) Color(0xFF00B0F4) else DiscordNitroGold,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "RTT: ${voiceState.latencyMs}ms • Loss: 0.0%",
                    color = VortexTextMuted,
                    fontSize = 11.sp
                )
            }
        }

        // Bottom Controls Bar
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexSurfaceDark,
            shadowElevation = 8.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Mic Mute Button
                VoiceControlCircleButton(
                    icon = if (voiceState.isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    isActive = !voiceState.isMuted,
                    activeColor = VortexInputDark,
                    inactiveColor = DiscordRed,
                    contentDescription = "Mute Microphone",
                    testTag = "voice_toggle_mute",
                    onClick = onToggleMute
                )

                // Deafen Button
                VoiceControlCircleButton(
                    icon = if (voiceState.isDeafened) Icons.Default.HeadsetOff else Icons.Default.Headset,
                    isActive = !voiceState.isDeafened,
                    activeColor = VortexInputDark,
                    inactiveColor = DiscordRed,
                    contentDescription = "Deafen Audio",
                    testTag = "voice_toggle_deafen",
                    onClick = onToggleDeafen
                )

                // Camera Video Button
                VoiceControlCircleButton(
                    icon = if (voiceState.isVideoOn) Icons.Default.Videocam else Icons.Default.VideocamOff,
                    isActive = voiceState.isVideoOn,
                    activeColor = DiscordBlurple,
                    inactiveColor = VortexInputDark,
                    contentDescription = "Toggle Video",
                    testTag = "voice_toggle_video",
                    onClick = onToggleVideo
                )

                // Screen Share Button
                VoiceControlCircleButton(
                    icon = if (voiceState.isScreenSharing) Icons.Default.StopScreenShare else Icons.Default.ScreenShare,
                    isActive = voiceState.isScreenSharing,
                    activeColor = DiscordNitroPink,
                    inactiveColor = VortexInputDark,
                    contentDescription = "Share Screen",
                    testTag = "voice_toggle_screenshare",
                    onClick = onToggleScreenShare
                )

                // Disconnect Button (Red)
                VoiceControlCircleButton(
                    icon = Icons.Default.CallEnd,
                    isActive = true,
                    activeColor = DiscordRed,
                    inactiveColor = DiscordRed,
                    contentDescription = "Disconnect",
                    testTag = "voice_disconnect_button",
                    onClick = onDisconnect
                )
            }
        }
    }
}

@Composable
private fun ParticipantStageCard(
    displayName: String,
    isSpeaking: Boolean,
    isMuted: Boolean,
    isVideoOn: Boolean,
    onCardClick: () -> Unit
) {
    val borderColor = if (isSpeaking) DiscordGreen else Color.Transparent

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(1.2f)
            .clip(RoundedCornerShape(14.dp))
            .background(VortexChannelDark)
            .border(2.5.dp, borderColor, RoundedCornerShape(14.dp))
            .clickable { onCardClick() },
        contentAlignment = Alignment.Center
    ) {
        if (isVideoOn) {
            // Simulated camera video feed
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF1E293B)),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Videocam,
                        contentDescription = "Camera Active",
                        tint = DiscordBlurple,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Live Video Feed",
                        color = VortexTextMuted,
                        fontSize = 11.sp
                    )
                }
            }
        } else {
            // Large Avatar Circle with speaking wave ring
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(DiscordBlurple)
                    .border(3.dp, if (isSpeaking) DiscordGreen else Color.Transparent, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                val initial = (displayName.firstOrNull() ?: 'U').uppercase()
                Text(
                    text = "$initial",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 28.sp
                )
            }
        }

        // Overlay participant name & mic state at bottom
        Row(
            modifier = Modifier
                .align(Alignment.BottomStart)
                .padding(8.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color.Black.copy(alpha = 0.65f))
                .padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = displayName,
                color = Color.White,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold
            )
            if (isMuted) {
                Spacer(modifier = Modifier.width(4.dp))
                Icon(
                    imageVector = Icons.Default.MicOff,
                    contentDescription = "Muted",
                    tint = DiscordRed,
                    modifier = Modifier.size(13.dp)
                )
            }
        }
    }
}

@Composable
private fun VoiceControlCircleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isActive: Boolean,
    activeColor: Color,
    inactiveColor: Color,
    contentDescription: String,
    testTag: String,
    onClick: () -> Unit
) {
    val bgColor = if (isActive) activeColor else inactiveColor
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(bgColor)
            .clickable { onClick() }
            .testTag(testTag),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = Color.White,
            modifier = Modifier.size(22.dp)
        )
    }
}
