package com.example.data.repository

import android.content.Context
import com.example.R
import com.example.data.crypto.E2EEManager
import com.example.data.model.Attachment
import com.example.data.model.Channel
import com.example.data.model.ChannelType
import com.example.data.model.Message
import com.example.data.model.Server
import com.example.data.model.User
import com.example.data.model.VoiceParticipant
import com.example.data.model.VoiceSession
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.snapshots
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.util.UUID

class VortexRepository(private val db: FirebaseFirestore) {

    constructor(context: Context) : this(
        FirebaseFirestore.getInstance(
            context.applicationContext.getString(R.string.firestore_database_id)
        )
    )

    private val auth = Firebase.auth

    private fun requireUserId(): String {
        return auth.currentUser?.uid
            ?: throw IllegalStateException("User must be signed in with Google before accessing Firestore.")
    }

    // --- USER PROFILE & NITRO PERKS ---

    fun observeUser(userId: String): Flow<User?> = flow {
        val path = "users/$userId"
        val docRef = db.collection("users").document(userId)
        val flow = docRef.snapshots().map { snapshot ->
            if (snapshot.exists()) snapshot.toObject(User::class.java) else null
        }.catch { e ->
            if (e is Exception) handleFirestoreError(e, OperationType.GET, path)
            throw e
        }
        emitAll(flow)
    }

    suspend fun syncCurrentUserProfile(): User {
        val uid = requireUserId()
        val firebaseUser = auth.currentUser ?: throw IllegalStateException("No authenticated user")
        val userRef = db.collection("users").document(uid)
        val snapshot = userRef.get().await()

        if (snapshot.exists()) {
            val existing = snapshot.toObject(User::class.java)!!
            return existing
        } else {
            val baseName = firebaseUser.displayName?.lowercase()?.replace("\\s+".toRegex(), "") ?: "user"
            val newUser = User(
                id = uid,
                userId = uid,
                displayName = firebaseUser.displayName ?: "Vortex User",
                username = baseName + "_" + (100..999).random(),
                email = firebaseUser.email ?: "",
                photoUrl = firebaseUser.photoUrl?.toString() ?: "",
                customTag = "#" + (1000 + (Math.random() * 8999).toInt()),
                bannerColor = "#5865F2",
                bio = "Hey there! I am using Vortex.",
                status = "online",
                nitroActive = false,
                nitroExpiresAt = null,
                boostsAvailable = 0,
                lowBandwidthMode = false,
                audioBitrateKbps = 64.0
            )
            val payload = mapOf(
                "userId" to uid,
                "displayName" to newUser.displayName,
                "username" to newUser.username,
                "email" to newUser.email,
                "photoUrl" to newUser.photoUrl,
                "customTag" to newUser.customTag,
                "bannerColor" to newUser.bannerColor,
                "bio" to newUser.bio,
                "status" to "online",
                "nitroActive" to false,
                "boostsAvailable" to 0,
                "lowBandwidthMode" to newUser.lowBandwidthMode,
                "audioBitrateKbps" to newUser.audioBitrateKbps,
                "createdAt" to FieldValue.serverTimestamp(),
                "updatedAt" to FieldValue.serverTimestamp()
            )
            try {
                userRef.set(payload).await()
            } catch (e: Exception) {
                handleFirestoreError(e, OperationType.CREATE, userRef.path)
            }
            return newUser
        }
    }

    suspend fun updateUserSettings(
        displayName: String,
        username: String = "",
        bio: String,
        customTag: String,
        bannerColor: String,
        lowBandwidthMode: Boolean,
        audioBitrateKbps: Double
    ) {
        val uid = requireUserId()
        val userRef = db.collection("users").document(uid)
        val updates = mutableMapOf<String, Any>(
            "displayName" to displayName,
            "username" to username,
            "bio" to bio,
            "customTag" to customTag,
            "bannerColor" to bannerColor,
            "lowBandwidthMode" to lowBandwidthMode,
            "audioBitrateKbps" to audioBitrateKbps,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            userRef.update(updates).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, userRef.path)
            throw e
        }
    }

    suspend fun claimNitroWithAd() {
        val uid = requireUserId()
        val userRef = db.collection("users").document(uid)
        val thirtyDaysMs = 30L * 24 * 60 * 60 * 1000
        val expiresAt = com.google.firebase.Timestamp(java.util.Date(System.currentTimeMillis() + thirtyDaysMs))
        val updates = mapOf(
            "nitroActive" to true,
            "nitroExpiresAt" to expiresAt,
            "boostsAvailable" to 2,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            userRef.update(updates).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, userRef.path)
            throw e
        }
    }

    suspend fun boostServerWithAd(serverId: String) {
        val uid = requireUserId()
        val sRef = db.collection("servers").document(serverId)
        val snapshot = sRef.get().await()
        val currentBoosts = snapshot.getLong("boostCount") ?: 0L
        val newBoosts = currentBoosts + 1
        val newLevel = when {
            newBoosts >= 14 -> 3
            newBoosts >= 7 -> 2
            newBoosts >= 2 -> 1
            else -> 0
        }
        val updates = mapOf(
            "boostCount" to newBoosts,
            "boostLevel" to newLevel,
            "updatedAt" to FieldValue.serverTimestamp()
        )
        try {
            sRef.update(updates).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, sRef.path)
            throw e
        }
    }

    suspend fun updateUserStatus(status: String) {
        val uid = requireUserId()
        val userRef = db.collection("users").document(uid)
        try {
            userRef.update("status", status, "updatedAt", FieldValue.serverTimestamp()).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, userRef.path)
            throw e
        }
    }

    // --- SERVERS & GUILDS ---

    fun observeServers(): Flow<List<Server>> = flow {
        val uid = requireUserId()
        val query = db.collection("servers").whereArrayContains("memberIds", uid)
        val flow = query.snapshots().map { snapshot ->
            snapshot.toObjects(Server::class.java)
        }.catch { e ->
            if (e is Exception) handleFirestoreError(e, OperationType.LIST, "servers")
            throw e
        }
        emitAll(flow)
    }

    suspend fun createServer(
        name: String,
        description: String,
        iconUrl: String = "",
        bannerUrl: String = ""
    ): Server {
        val uid = requireUserId()
        val serverDoc = db.collection("servers").document()
        val inviteCode = "VTX-" + (1000 + (Math.random() * 8999).toInt())

        val serverPayload = mapOf(
            "ownerId" to uid,
            "name" to name.trim(),
            "description" to description.trim(),
            "iconUrl" to iconUrl,
            "bannerUrl" to bannerUrl,
            "inviteCode" to inviteCode,
            "memberIds" to listOf(uid),
            "boostLevel" to 3.0,
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )

        try {
            serverDoc.set(serverPayload).await()

            // Automatically create default text and voice channels
            createDefaultChannels(serverDoc.id)

            return Server(
                id = serverDoc.id,
                ownerId = uid,
                name = name,
                description = description,
                iconUrl = iconUrl,
                bannerUrl = bannerUrl,
                inviteCode = inviteCode,
                memberIds = listOf(uid),
                boostLevel = 3
            )
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, serverDoc.path)
            throw e
        }
    }

    private suspend fun createDefaultChannels(serverId: String) {
        val defaultChannels = listOf(
            Triple("general", "General discussion & hangouts", ChannelType.TEXT),
            Triple("e2ee-confidential", "End-to-End Encrypted secret chat", ChannelType.TEXT),
            Triple("nitro-lounge", "Free Nitro 1080p 60fps streaming", ChannelType.VIDEO),
            Triple("voice-lounge", "Ultra-low bandwidth Opus voice room", ChannelType.VOICE)
        )

        for (c in defaultChannels) {
            val channelDoc = db.collection("servers").document(serverId)
                .collection("channels").document()
            val isEncrypted = c.first.contains("e2ee") || c.third == ChannelType.TEXT
            channelDoc.set(
                mapOf(
                    "serverId" to serverId,
                    "name" to c.first,
                    "topic" to c.second,
                    "type" to c.third.name,
                    "isEncrypted" to isEncrypted,
                    "bitrateKbps" to 64.0,
                    "createdAt" to FieldValue.serverTimestamp(),
                    "updatedAt" to FieldValue.serverTimestamp()
                )
            ).await()
        }
    }

    suspend fun joinServerByInviteCode(inviteCode: String): Result<Server> {
        val uid = requireUserId()
        return try {
            val querySnapshot = db.collection("servers")
                .whereEqualTo("inviteCode", inviteCode.trim().uppercase())
                .limit(1)
                .get()
                .await()

            if (querySnapshot.isEmpty) {
                return Result.failure(IllegalArgumentException("Invalid invite code. Server not found."))
            }

            val doc = querySnapshot.documents[0]
            val server = doc.toObject(Server::class.java)!!

            if (!server.memberIds.contains(uid)) {
                doc.reference.update(
                    "memberIds", FieldValue.arrayUnion(uid),
                    "updatedAt", FieldValue.serverTimestamp()
                ).await()
            }

            Result.success(server)
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, "servers")
            Result.failure(e)
        }
    }

    suspend fun leaveServer(serverId: String) {
        val uid = requireUserId()
        val serverDoc = db.collection("servers").document(serverId)
        try {
            serverDoc.update(
                "memberIds", FieldValue.arrayRemove(uid),
                "updatedAt", FieldValue.serverTimestamp()
            ).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, serverDoc.path)
            throw e
        }
    }

    suspend fun deleteServer(serverId: String) {
        val uid = requireUserId()
        val serverDoc = db.collection("servers").document(serverId)
        try {
            serverDoc.delete().await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, serverDoc.path)
            throw e
        }
    }

    // --- CHANNELS ---

    fun observeChannels(serverId: String): Flow<List<Channel>> = flow {
        val channelsRef = db.collection("servers").document(serverId)
            .collection("channels")
            .orderBy("createdAt", Query.Direction.ASCENDING)
        val flow = channelsRef.snapshots().map { snapshot ->
            snapshot.toObjects(Channel::class.java)
        }.catch { e ->
            if (e is Exception) handleFirestoreError(e, OperationType.LIST, "servers/$serverId/channels")
            throw e
        }
        emitAll(flow)
    }

    suspend fun createChannel(
        serverId: String,
        name: String,
        topic: String,
        type: ChannelType,
        isEncrypted: Boolean = true,
        bitrateKbps: Double = 64.0
    ): Channel {
        requireUserId()
        val channelDoc = db.collection("servers").document(serverId)
            .collection("channels").document()

        val cleanName = name.trim().lowercase().replace("\\s+".toRegex(), "-")
        val payload = mapOf(
            "serverId" to serverId,
            "name" to cleanName,
            "topic" to topic.trim(),
            "type" to type.name,
            "isEncrypted" to isEncrypted,
            "bitrateKbps" to bitrateKbps,
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )

        try {
            channelDoc.set(payload).await()
            return Channel(
                id = channelDoc.id,
                serverId = serverId,
                name = cleanName,
                topic = topic,
                type = type.name,
                isEncrypted = isEncrypted,
                bitrateKbps = bitrateKbps
            )
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, channelDoc.path)
            throw e
        }
    }

    suspend fun deleteChannel(serverId: String, channelId: String) {
        requireUserId()
        val channelDoc = db.collection("servers").document(serverId)
            .collection("channels").document(channelId)
        try {
            channelDoc.delete().await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.DELETE, channelDoc.path)
            throw e
        }
    }

    // --- MESSAGES (TEXT & LARGE MEDIA ATTACHMENTS & E2EE) ---

    fun observeMessages(serverId: String, channelId: String): Flow<List<Message>> = flow {
        val messagesRef = db.collection("servers").document(serverId)
            .collection("channels").document(channelId)
            .collection("messages")
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .limitToLast(100)

        val flow = messagesRef.snapshots().map { snapshot ->
            val list = snapshot.toObjects(Message::class.java)
            // If message was marked E2EE, decrypt it transparently with channel derived key
            val channelKey = E2EEManager.deriveChannelKey(serverId, channelId)
            list.map { msg ->
                if (msg.isEncrypted) {
                    val decrypted = E2EEManager.decrypt(msg.content, channelKey)
                    msg.copy(content = decrypted)
                } else {
                    msg
                }
            }
        }.catch { e ->
            if (e is Exception) handleFirestoreError(e, OperationType.LIST, "servers/$serverId/channels/$channelId/messages")
            throw e
        }
        emitAll(flow)
    }

    suspend fun sendMessage(
        serverId: String,
        channelId: String,
        content: String,
        isEncrypted: Boolean,
        attachments: List<Attachment> = emptyList(),
        lowBandwidthMode: Boolean = false
    ) {
        val uid = requireUserId()
        val user = auth.currentUser
        val messagesRef = db.collection("servers").document(serverId)
            .collection("channels").document(channelId)
            .collection("messages")

        val finalContent = if (isEncrypted) {
            val key = E2EEManager.deriveChannelKey(serverId, channelId)
            E2EEManager.encrypt(content, key, compress = lowBandwidthMode)
        } else {
            content
        }

        val attachmentsPayload = attachments.map { att ->
            mapOf(
                "fileName" to att.fileName,
                "fileType" to att.fileType,
                "fileSizeFormatted" to att.fileSizeFormatted,
                "mediaUrl" to att.mediaUrl,
                "isLargeMedia" to att.isLargeMedia,
                "lowBandwidthPlaceholder" to att.lowBandwidthPlaceholder
            )
        }

        val payload = mapOf(
            "serverId" to serverId,
            "channelId" to channelId,
            "senderId" to uid,
            "senderName" to (user?.displayName ?: "User"),
            "senderAvatar" to (user?.photoUrl?.toString() ?: ""),
            "content" to finalContent,
            "isEncrypted" to isEncrypted,
            "attachments" to attachmentsPayload,
            "reactions" to emptyList<Map<String, Any>>(),
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )

        try {
            messagesRef.add(payload).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.CREATE, messagesRef.path)
            throw e
        }
    }

    suspend fun toggleReaction(
        serverId: String,
        channelId: String,
        messageId: String,
        emoji: String
    ) {
        val uid = requireUserId()
        val msgRef = db.collection("servers").document(serverId)
            .collection("channels").document(channelId)
            .collection("messages").document(messageId)

        try {
            val doc = msgRef.get().await()
            if (!doc.exists()) return

            val currentReactions = doc.get("reactions") as? List<Map<String, Any>> ?: emptyList()
            val existing = currentReactions.find { it["emoji"] == emoji }

            val updatedReactions = if (existing != null) {
                val userIds = (existing["userIds"] as? List<String> ?: emptyList()).toMutableList()
                if (userIds.contains(uid)) {
                    userIds.remove(uid)
                } else {
                    userIds.add(uid)
                }
                if (userIds.isEmpty()) {
                    currentReactions.filter { it["emoji"] != emoji }
                } else {
                    currentReactions.map {
                        if (it["emoji"] == emoji) {
                            mapOf("emoji" to emoji, "count" to userIds.size.toLong(), "userIds" to userIds)
                        } else it
                    }
                }
            } else {
                currentReactions + mapOf("emoji" to emoji, "count" to 1L, "userIds" to listOf(uid))
            }

            msgRef.update("reactions", updatedReactions).await()
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, msgRef.path)
        }
    }

    // --- VOICE & VIDEO ROOM SESSION SIGNALING ---

    fun observeVoiceSession(channelId: String): Flow<VoiceSession?> = flow {
        val docRef = db.collection("voice_sessions").document(channelId)
        val flow = docRef.snapshots().map { snapshot ->
            if (snapshot.exists()) snapshot.toObject(VoiceSession::class.java) else null
        }.catch { e ->
            if (e is Exception) handleFirestoreError(e, OperationType.GET, "voice_sessions/$channelId")
            throw e
        }
        emitAll(flow)
    }

    suspend fun joinVoiceSession(
        channelId: String,
        serverId: String,
        isMuted: Boolean = false,
        isDeafened: Boolean = false,
        isVideoOn: Boolean = false,
        isScreenSharing: Boolean = false
    ) {
        val uid = requireUserId()
        val user = auth.currentUser
        val sessionDoc = db.collection("voice_sessions").document(channelId)

        val newParticipant = mapOf(
            "userId" to uid,
            "displayName" to (user?.displayName ?: "User"),
            "avatarUrl" to (user?.photoUrl?.toString() ?: ""),
            "isMuted" to isMuted,
            "isDeafened" to isDeafened,
            "isVideoOn" to isVideoOn,
            "isScreenSharing" to isScreenSharing,
            "isSpeaking" to false
        )

        try {
            val snapshot = sessionDoc.get().await()
            if (!snapshot.exists()) {
                sessionDoc.set(
                    mapOf(
                        "channelId" to channelId,
                        "serverId" to serverId,
                        "activeParticipants" to listOf(newParticipant),
                        "updatedAt" to FieldValue.serverTimestamp()
                    )
                ).await()
            } else {
                val current = snapshot.get("activeParticipants") as? List<Map<String, Any>> ?: emptyList()
                val filtered = current.filter { it["userId"] != uid }
                sessionDoc.update(
                    "activeParticipants", filtered + newParticipant,
                    "updatedAt", FieldValue.serverTimestamp()
                ).await()
            }
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, sessionDoc.path)
        }
    }

    suspend fun updateVoiceState(
        channelId: String,
        isMuted: Boolean,
        isDeafened: Boolean,
        isVideoOn: Boolean,
        isScreenSharing: Boolean,
        isSpeaking: Boolean
    ) {
        val uid = requireUserId()
        val sessionDoc = db.collection("voice_sessions").document(channelId)
        try {
            val snapshot = sessionDoc.get().await()
            if (snapshot.exists()) {
                val current = snapshot.get("activeParticipants") as? List<Map<String, Any>> ?: emptyList()
                val updated = current.map { p ->
                    if (p["userId"] == uid) {
                        p.toMutableMap().apply {
                            put("isMuted", isMuted)
                            put("isDeafened", isDeafened)
                            put("isVideoOn", isVideoOn)
                            put("isScreenSharing", isScreenSharing)
                            put("isSpeaking", isSpeaking)
                        }
                    } else p
                }
                sessionDoc.update(
                    "activeParticipants", updated,
                    "updatedAt", FieldValue.serverTimestamp()
                ).await()
            }
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, sessionDoc.path)
        }
    }

    suspend fun leaveVoiceSession(channelId: String) {
        val uid = requireUserId()
        val sessionDoc = db.collection("voice_sessions").document(channelId)
        try {
            val snapshot = sessionDoc.get().await()
            if (snapshot.exists()) {
                val current = snapshot.get("activeParticipants") as? List<Map<String, Any>> ?: emptyList()
                val updated = current.filter { it["userId"] != uid }
                sessionDoc.update(
                    "activeParticipants", updated,
                    "updatedAt", FieldValue.serverTimestamp()
                ).await()
            }
        } catch (e: Exception) {
            handleFirestoreError(e, OperationType.UPDATE, sessionDoc.path)
        }
    }

    private suspend fun <T> kotlinx.coroutines.flow.FlowCollector<T>.emitAll(flow: Flow<T>) {
        flow.collect { value -> emit(value) }
    }
}
