package com.example.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.ServerTimestamp

@IgnoreExtraProperties
data class User(
    @DocumentId val id: String = "",
    val userId: String = "",
    val displayName: String = "",
    val username: String = "",
    val email: String = "",
    val photoUrl: String = "",
    val customTag: String = "#0001",
    val bannerColor: String = "#5865F2",
    val bio: String = "Hey there! I am using Vortex.",
    val status: String = "online", // online, idle, dnd, invisible
    val nitroActive: Boolean = false, // Earned via rewarded monthly ad
    val nitroExpiresAt: Timestamp? = null,
    val boostsAvailable: Int = 0,
    val lowBandwidthMode: Boolean = false,
    val audioBitrateKbps: Double = 64.0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class Server(
    @DocumentId val id: String = "",
    val ownerId: String = "",
    val name: String = "",
    val description: String = "",
    val iconUrl: String = "",
    val bannerUrl: String = "",
    val inviteCode: String = "",
    val memberIds: List<String> = emptyList(),
    val boostCount: Int = 0, // Boost count earned via watching ads
    val boostLevel: Int = 0, // 0, 1, 2, or 3
    val pinnedMessageIds: List<String> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

enum class ChannelType {
    TEXT,
    VOICE,
    VIDEO
}

@IgnoreExtraProperties
data class Channel(
    @DocumentId val id: String = "",
    val serverId: String = "",
    val name: String = "",
    val topic: String = "",
    val type: String = "TEXT",
    val isEncrypted: Boolean = true,
    val bitrateKbps: Double = 64.0,
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class Attachment(
    val fileName: String = "",
    val fileType: String = "",
    val fileSizeFormatted: String = "",
    val mediaUrl: String = "",
    val isLargeMedia: Boolean = false,
    val lowBandwidthPlaceholder: String = ""
)

@IgnoreExtraProperties
data class MessageReaction(
    val emoji: String = "",
    val count: Long = 0L,
    val userIds: List<String> = emptyList()
)

@IgnoreExtraProperties
data class Message(
    @DocumentId val id: String = "",
    val serverId: String = "",
    val channelId: String = "",
    val senderId: String = "",
    val senderName: String = "",
    val senderAvatar: String = "",
    val content: String = "",
    val isEncrypted: Boolean = false,
    val attachments: List<Map<String, Any>> = emptyList(),
    val reactions: List<Map<String, Any>> = emptyList(),
    @ServerTimestamp val createdAt: Timestamp? = null,
    @ServerTimestamp val updatedAt: Timestamp? = null
)

@IgnoreExtraProperties
data class VoiceParticipant(
    val userId: String = "",
    val displayName: String = "",
    val avatarUrl: String = "",
    val isMuted: Boolean = false,
    val isDeafened: Boolean = false,
    val isVideoOn: Boolean = false,
    val isScreenSharing: Boolean = false,
    val isSpeaking: Boolean = false
)

@IgnoreExtraProperties
data class VoiceSession(
    @DocumentId val id: String = "",
    val channelId: String = "",
    val serverId: String = "",
    val activeParticipants: List<Map<String, Any>> = emptyList(),
    @ServerTimestamp val updatedAt: Timestamp? = null
)
