package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.model.Attachment
import com.example.data.model.Channel
import com.example.data.model.ChannelType
import com.example.data.model.Message
import com.example.data.model.Server
import com.example.data.model.User
import com.example.data.model.VoiceParticipant
import com.example.data.model.VoiceSession
import com.example.data.repository.VortexRepository
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

data class ActiveVoiceCallState(
    val channel: Channel,
    val serverId: String,
    val isMuted: Boolean = false,
    val isDeafened: Boolean = false,
    val isVideoOn: Boolean = false,
    val isScreenSharing: Boolean = false,
    val isSpeaking: Boolean = false,
    val bitrateKbps: Double = 64.0,
    val latencyMs: Int = 14
)

class VortexViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = VortexRepository(application)
    val auth = Firebase.auth

    // User Profile
    private val _currentUser = MutableStateFlow<User?>(null)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    // Servers
    private val _servers = MutableStateFlow<List<Server>>(emptyList())
    val servers: StateFlow<List<Server>> = _servers.asStateFlow()

    private val _selectedServer = MutableStateFlow<Server?>(null)
    val selectedServer: StateFlow<Server?> = _selectedServer.asStateFlow()

    // Channels
    private val _channels = MutableStateFlow<List<Channel>>(emptyList())
    val channels: StateFlow<List<Channel>> = _channels.asStateFlow()

    private val _selectedChannel = MutableStateFlow<Channel?>(null)
    val selectedChannel: StateFlow<Channel?> = _selectedChannel.asStateFlow()

    // Messages
    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    // Active Voice Connection
    private val _activeVoiceCall = MutableStateFlow<ActiveVoiceCallState?>(null)
    val activeVoiceCall: StateFlow<ActiveVoiceCallState?> = _activeVoiceCall.asStateFlow()

    private val _voiceSession = MutableStateFlow<VoiceSession?>(null)
    val voiceSession: StateFlow<VoiceSession?> = _voiceSession.asStateFlow()

    // Status / Snackbars
    private val _statusMessage = MutableStateFlow<String?>(null)
    val statusMessage: StateFlow<String?> = _statusMessage.asStateFlow()

    private var channelsJob: Job? = null
    private var messagesJob: Job? = null
    private var voiceSessionJob: Job? = null

    init {
        val uid = auth.currentUser?.uid
        if (uid != null) {
            loadInitialData(uid)
        }
    }

    fun onUserAuthenticated() {
        val uid = auth.currentUser?.uid ?: return
        loadInitialData(uid)
    }

    private fun loadInitialData(uid: String) {
        viewModelScope.launch {
            try {
                val profile = repository.syncCurrentUserProfile()
                _currentUser.value = profile
            } catch (e: Exception) {
                // Ignore initial sync error
            }

            // Observe User updates
            launch {
                repository.observeUser(uid).collect { user ->
                    if (user != null) {
                        _currentUser.value = user
                    }
                }
            }

            // Observe Servers
            launch {
                repository.observeServers().collect { serverList ->
                    _servers.value = serverList
                    if (_selectedServer.value == null && serverList.isNotEmpty()) {
                        selectServer(serverList[0])
                    } else if (serverList.isEmpty()) {
                        // Create default server if brand new user!
                        createDefaultServerForUser()
                    }
                }
            }
        }
    }

    private fun createDefaultServerForUser() {
        viewModelScope.launch {
            try {
                val created = repository.createServer(
                    name = "Friends & Gaming Hub",
                    description = "Official Discord-style community space with free Nitro & E2EE encryption!",
                    iconUrl = "🎮"
                )
                selectServer(created)
            } catch (e: Exception) {
                _statusMessage.value = "Failed to create default server: ${e.message}"
            }
        }
    }

    fun selectServer(server: Server) {
        _selectedServer.value = server
        channelsJob?.cancel()
        channelsJob = viewModelScope.launch {
            repository.observeChannels(server.id).collect { channelList ->
                _channels.value = channelList
                val currentSelected = _selectedChannel.value
                if (currentSelected == null || channelList.none { it.id == currentSelected.id }) {
                    val defaultText = channelList.find { it.type == ChannelType.TEXT.name }
                        ?: channelList.firstOrNull()
                    if (defaultText != null) {
                        selectChannel(defaultText)
                    }
                }
            }
        }
    }

    fun selectChannel(channel: Channel) {
        _selectedChannel.value = channel
        val server = _selectedServer.value ?: return

        if (channel.type == ChannelType.TEXT.name) {
            messagesJob?.cancel()
            messagesJob = viewModelScope.launch {
                repository.observeMessages(server.id, channel.id).collect { msgList ->
                    _messages.value = msgList
                }
            }
        }
    }

    fun createServer(name: String, description: String, iconEmoji: String) {
        viewModelScope.launch {
            try {
                val newServer = repository.createServer(name, description, iconEmoji)
                selectServer(newServer)
                _statusMessage.value = "Server '${newServer.name}' created!"
            } catch (e: Exception) {
                _statusMessage.value = "Failed to create server: ${e.message}"
            }
        }
    }

    fun joinServerByInvite(inviteCode: String) {
        viewModelScope.launch {
            val result = repository.joinServerByInviteCode(inviteCode)
            result.onSuccess { server ->
                selectServer(server)
                _statusMessage.value = "Joined '${server.name}' successfully!"
            }.onFailure { err ->
                _statusMessage.value = err.message ?: "Could not join server"
            }
        }
    }

    fun createChannel(name: String, topic: String, type: ChannelType, isEncrypted: Boolean) {
        val server = _selectedServer.value ?: return
        viewModelScope.launch {
            try {
                val channel = repository.createChannel(
                    serverId = server.id,
                    name = name,
                    topic = topic,
                    type = type,
                    isEncrypted = isEncrypted,
                    bitrateKbps = if (_currentUser.value?.lowBandwidthMode == true) 6.0 else 64.0
                )
                selectChannel(channel)
                _statusMessage.value = "Channel #${channel.name} created!"
            } catch (e: Exception) {
                _statusMessage.value = "Failed to create channel: ${e.message}"
            }
        }
    }

    fun sendMessage(
        content: String,
        isEncrypted: Boolean = true,
        attachments: List<Attachment> = emptyList()
    ) {
        val server = _selectedServer.value ?: return
        val channel = _selectedChannel.value ?: return
        val user = _currentUser.value

        viewModelScope.launch {
            try {
                repository.sendMessage(
                    serverId = server.id,
                    channelId = channel.id,
                    content = content,
                    isEncrypted = isEncrypted,
                    attachments = attachments,
                    lowBandwidthMode = user?.lowBandwidthMode ?: false
                )
            } catch (e: Exception) {
                _statusMessage.value = "Failed to send: ${e.message}"
            }
        }
    }

    fun toggleReaction(messageId: String, emoji: String) {
        val server = _selectedServer.value ?: return
        val channel = _selectedChannel.value ?: return
        viewModelScope.launch {
            repository.toggleReaction(server.id, channel.id, messageId, emoji)
        }
    }

    // --- VOICE & VIDEO CALLING & STREAMING ---

    fun joinVoiceChannel(channel: Channel) {
        val server = _selectedServer.value ?: return
        val isLowBandwidth = _currentUser.value?.lowBandwidthMode ?: false
        val bitrate = if (isLowBandwidth) 6.0 else 64.0

        _activeVoiceCall.value = ActiveVoiceCallState(
            channel = channel,
            serverId = server.id,
            isMuted = false,
            isDeafened = false,
            isVideoOn = channel.type == ChannelType.VIDEO.name,
            isScreenSharing = false,
            isSpeaking = false,
            bitrateKbps = bitrate,
            latencyMs = if (isLowBandwidth) 8 else 18
        )

        voiceSessionJob?.cancel()
        voiceSessionJob = viewModelScope.launch {
            repository.joinVoiceSession(
                channelId = channel.id,
                serverId = server.id,
                isMuted = false,
                isDeafened = false,
                isVideoOn = channel.type == ChannelType.VIDEO.name,
                isScreenSharing = false
            )
            repository.observeVoiceSession(channel.id).collect { session ->
                _voiceSession.value = session
            }
        }
    }

    fun toggleMute() {
        val current = _activeVoiceCall.value ?: return
        val nextMuted = !current.isMuted
        _activeVoiceCall.value = current.copy(isMuted = nextMuted)
        viewModelScope.launch {
            repository.updateVoiceState(
                channelId = current.channel.id,
                isMuted = nextMuted,
                isDeafened = current.isDeafened,
                isVideoOn = current.isVideoOn,
                isScreenSharing = current.isScreenSharing,
                isSpeaking = false
            )
        }
    }

    fun toggleDeafen() {
        val current = _activeVoiceCall.value ?: return
        val nextDeafened = !current.isDeafened
        val nextMuted = if (nextDeafened) true else current.isMuted
        _activeVoiceCall.value = current.copy(isDeafened = nextDeafened, isMuted = nextMuted)
        viewModelScope.launch {
            repository.updateVoiceState(
                channelId = current.channel.id,
                isMuted = nextMuted,
                isDeafened = nextDeafened,
                isVideoOn = current.isVideoOn,
                isScreenSharing = current.isScreenSharing,
                isSpeaking = false
            )
        }
    }

    fun toggleVideo() {
        val current = _activeVoiceCall.value ?: return
        val nextVideo = !current.isVideoOn
        _activeVoiceCall.value = current.copy(isVideoOn = nextVideo)
        viewModelScope.launch {
            repository.updateVoiceState(
                channelId = current.channel.id,
                isMuted = current.isMuted,
                isDeafened = current.isDeafened,
                isVideoOn = nextVideo,
                isScreenSharing = current.isScreenSharing,
                isSpeaking = current.isSpeaking
            )
        }
    }

    fun toggleScreenSharing() {
        val current = _activeVoiceCall.value ?: return
        val nextScreen = !current.isScreenSharing
        _activeVoiceCall.value = current.copy(isScreenSharing = nextScreen)
        viewModelScope.launch {
            repository.updateVoiceState(
                channelId = current.channel.id,
                isMuted = current.isMuted,
                isDeafened = current.isDeafened,
                isVideoOn = current.isVideoOn,
                isScreenSharing = nextScreen,
                isSpeaking = current.isSpeaking
            )
        }
    }

    fun toggleScreenShare() {
        toggleScreenSharing()
    }

    fun setSpeaking(speaking: Boolean) {
        val current = _activeVoiceCall.value ?: return
        if (current.isMuted) return
        _activeVoiceCall.value = current.copy(isSpeaking = speaking)
        viewModelScope.launch {
            repository.updateVoiceState(
                channelId = current.channel.id,
                isMuted = current.isMuted,
                isDeafened = current.isDeafened,
                isVideoOn = current.isVideoOn,
                isScreenSharing = current.isScreenSharing,
                isSpeaking = speaking
            )
        }
    }

    fun disconnectVoice() {
        val current = _activeVoiceCall.value ?: return
        _activeVoiceCall.value = null
        voiceSessionJob?.cancel()
        viewModelScope.launch {
            repository.leaveVoiceSession(current.channel.id)
            _voiceSession.value = null
        }
    }

    fun updateBandwidthMode(lowBandwidth: Boolean, audioBitrate: Double) {
        val user = _currentUser.value ?: return
        viewModelScope.launch {
            try {
                repository.updateUserSettings(
                    displayName = user.displayName,
                    bio = user.bio,
                    customTag = user.customTag,
                    bannerColor = user.bannerColor,
                    lowBandwidthMode = lowBandwidth,
                    audioBitrateKbps = audioBitrate
                )
                _statusMessage.value = if (lowBandwidth) {
                    "Ultra-Low Bandwidth Mode Enabled (Opus 6kbps, compressed payload)"
                } else {
                    "Standard High-Fidelity Bandwidth Mode"
                }
            } catch (e: Exception) {
                _statusMessage.value = "Failed to update settings: ${e.message}"
            }
        }
    }

    fun updateProfile(displayName: String, bio: String, customTag: String, bannerColor: String) {
        val user = _currentUser.value ?: return
        viewModelScope.launch {
            try {
                repository.updateUserSettings(
                    displayName = displayName,
                    bio = bio,
                    customTag = customTag,
                    bannerColor = bannerColor,
                    lowBandwidthMode = user.lowBandwidthMode,
                    audioBitrateKbps = user.audioBitrateKbps
                )
                _statusMessage.value = "Profile updated!"
            } catch (e: Exception) {
                _statusMessage.value = "Failed to update profile: ${e.message}"
            }
        }
    }

    fun clearStatusMessage() {
        _statusMessage.value = null
    }
}
