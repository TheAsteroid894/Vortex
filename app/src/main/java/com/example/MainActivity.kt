package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.model.ChannelType
import com.example.ui.auth.AuthScreen
import com.example.ui.auth.signOut
import com.example.ui.chat.ChatScreen
import com.example.ui.dialogs.AddFriendDialog
import com.example.ui.dialogs.AttachmentPickerDialog
import com.example.ui.dialogs.CreateChannelDialog
import com.example.ui.dialogs.CreateServerDialog
import com.example.ui.dialogs.JoinServerDialog
import com.example.ui.dialogs.NitroShowcaseDialog
import com.example.ui.dialogs.ServerSettingsDialog
import com.example.ui.dialogs.UserSettingsDialog
import com.example.ui.web.WebCompanionScreen
import com.example.ui.server.ChannelDrawer
import com.example.ui.server.ServerRail
import com.example.ui.theme.VortexBgDark
import com.example.ui.theme.VortexTheme
import com.example.ui.viewmodel.VortexViewModel
import com.example.ui.voice.VoiceRoomScreen
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.auth
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VortexTheme {
                AppGate()
            }
        }
    }
}

@Composable
fun AppGate() {
    var currentUser by remember { mutableStateOf(Firebase.auth.currentUser) }

    DisposableEffect(Unit) {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            currentUser = auth.currentUser
        }
        Firebase.auth.addAuthStateListener(listener)
        onDispose {
            Firebase.auth.removeAuthStateListener(listener)
        }
    }

    if (currentUser == null) {
        AuthScreen(
            onAuthSuccess = {
                currentUser = Firebase.auth.currentUser
            }
        )
    } else {
        MainAppContent()
    }
}

@Composable
fun MainAppContent(
    viewModel: VortexViewModel = viewModel()
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val credentialManager = remember { androidx.credentials.CredentialManager.create(context) }

    val currentUser by viewModel.currentUser.collectAsState()
    val servers by viewModel.servers.collectAsState()
    val selectedServer by viewModel.selectedServer.collectAsState()
    val channels by viewModel.channels.collectAsState()
    val selectedChannel by viewModel.selectedChannel.collectAsState()
    val messages by viewModel.messages.collectAsState()
    val activeVoiceCall by viewModel.activeVoiceCall.collectAsState()
    val voiceSession by viewModel.voiceSession.collectAsState()
    val statusMessage by viewModel.statusMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)

    var showCreateServerDialog by remember { mutableStateOf(false) }
    var showJoinServerDialog by remember { mutableStateOf(false) }
    var showCreateChannelDialog by remember { mutableStateOf(false) }
    var showServerSettingsDialog by remember { mutableStateOf(false) }
    var showUserSettingsDialog by remember { mutableStateOf(false) }
    var showNitroShowcaseDialog by remember { mutableStateOf(false) }
    var showAttachmentPickerDialog by remember { mutableStateOf(false) }
    var isVoiceStageExpanded by remember { mutableStateOf(false) }
    var showWebCompanion by remember { mutableStateOf(false) }
    var showAddFriendDialog by remember { mutableStateOf(false) }

    // Handle snackbar updates
    LaunchedEffect(statusMessage) {
        statusMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearStatusMessage()
        }
    }

    // Intercept back button if drawer or stage or web companion is open
    BackHandler(enabled = drawerState.isOpen || isVoiceStageExpanded || showWebCompanion) {
        if (showWebCompanion) {
            showWebCompanion = false
        } else if (isVoiceStageExpanded) {
            isVoiceStageExpanded = false
        } else if (drawerState.isOpen) {
            coroutineScope.launch { drawerState.close() }
        }
    }

    // Dialogs
    if (showCreateServerDialog) {
        CreateServerDialog(
            onDismiss = { showCreateServerDialog = false },
            onCreateServer = { name, desc, emoji ->
                viewModel.createServer(name, desc, emoji)
            }
        )
    }

    if (showJoinServerDialog) {
        JoinServerDialog(
            onDismiss = { showJoinServerDialog = false },
            onJoinServer = { code ->
                viewModel.joinServerByInvite(code)
            }
        )
    }

    if (showCreateChannelDialog) {
        CreateChannelDialog(
            onDismiss = { showCreateChannelDialog = false },
            onCreateChannel = { name, topic, type, isEncrypted ->
                viewModel.createChannel(name, topic, type, isEncrypted)
            }
        )
    }

    if (showServerSettingsDialog) {
        ServerSettingsDialog(
            server = selectedServer,
            onDismiss = { showServerSettingsDialog = false }
        )
    }

    if (showUserSettingsDialog) {
        UserSettingsDialog(
            user = currentUser,
            onDismiss = { showUserSettingsDialog = false },
            onSaveBandwidthSettings = { lowBw, bitrate ->
                viewModel.updateBandwidthMode(lowBw, bitrate)
            },
            onSaveProfile = { name, bio, tag, color ->
                viewModel.updateProfile(name, bio, tag, color)
            },
            onSignOut = {
                showUserSettingsDialog = false
                signOut(context, credentialManager, {}, coroutineScope)
            }
        )
    }

    if (showNitroShowcaseDialog) {
        NitroShowcaseDialog(
            onDismiss = { showNitroShowcaseDialog = false }
        )
    }

    if (showAttachmentPickerDialog) {
        AttachmentPickerDialog(
            onDismiss = { showAttachmentPickerDialog = false },
            onSendAttachment = { att ->
                viewModel.sendMessage(
                    content = "Shared attachment: ${att.fileName}",
                    isEncrypted = selectedChannel?.isEncrypted ?: true,
                    attachments = listOf(att)
                )
            }
        )
    }

    if (showAddFriendDialog) {
        AddFriendDialog(
            currentUser = currentUser,
            onDismiss = { showAddFriendDialog = false },
            onStartDm = { friendName ->
                val dmName = "dm-" + friendName.lowercase().replace("\\s+".toRegex(), "-")
                viewModel.createChannel(
                    name = dmName,
                    topic = "Direct encrypted message with $friendName",
                    type = ChannelType.TEXT,
                    isEncrypted = true
                )
            }
        )
    }

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        if (showWebCompanion) {
            WebCompanionScreen(
                onBackToNative = { showWebCompanion = false }
            )
            return@BoxWithConstraints
        }

        val isWideScreen = maxWidth >= 768.dp

        if (isWideScreen) {
            // Adaptive 3-Pane Desktop / Tablet Layout
            Scaffold(
                snackbarHost = { SnackbarHost(snackbarHostState) },
                containerColor = VortexBgDark
            ) { padding ->
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                ) {
                    // Left Rail: Servers
                    ServerRail(
                        servers = servers,
                        selectedServer = selectedServer,
                        onSelectServer = { viewModel.selectServer(it) },
                        onCreateServerClick = { showCreateServerDialog = true },
                        onJoinServerClick = { showJoinServerDialog = true },
                        onNitroClick = { showNitroShowcaseDialog = true },
                        onWebCompanionClick = { showWebCompanion = true }
                    )

                    // Middle Pane: Channels & Categories
                    ChannelDrawer(
                        server = selectedServer,
                        channels = channels,
                        selectedChannel = selectedChannel,
                        currentUser = currentUser,
                        activeVoiceCall = activeVoiceCall,
                        onSelectChannel = { ch ->
                            if (ch.type == ChannelType.VOICE.name || ch.type == ChannelType.VIDEO.name) {
                                viewModel.joinVoiceChannel(ch)
                                isVoiceStageExpanded = true
                            } else {
                                viewModel.selectChannel(ch)
                            }
                        },
                        onCreateChannelClick = { showCreateChannelDialog = true },
                        onInviteFriendsClick = { showServerSettingsDialog = true },
                        onServerSettingsClick = { showServerSettingsDialog = true },
                        onUserSettingsClick = { showUserSettingsDialog = true },
                        onToggleMute = { viewModel.toggleMute() },
                        onToggleDeafen = { viewModel.toggleDeafen() },
                        onDisconnectVoice = {
                            viewModel.disconnectVoice()
                            isVoiceStageExpanded = false
                        },
                        onExpandVoiceStage = { isVoiceStageExpanded = true },
                        onAddFriendClick = { showAddFriendDialog = true },
                        modifier = Modifier.width(240.dp)
                    )

                    // Right Pane: Active Voice Room or Chat Screen
                    Box(modifier = Modifier.weight(1f)) {
                        if (isVoiceStageExpanded && activeVoiceCall != null) {
                            VoiceRoomScreen(
                                voiceState = activeVoiceCall!!,
                                voiceSession = voiceSession,
                                currentUser = currentUser,
                                onToggleMute = { viewModel.toggleMute() },
                                onToggleDeafen = { viewModel.toggleDeafen() },
                                onToggleVideo = { viewModel.toggleVideo() },
                                onToggleScreenShare = { viewModel.toggleScreenShare() },
                                onSimulateSpeaking = { viewModel.setSpeaking(it) },
                                onDisconnect = {
                                    viewModel.disconnectVoice()
                                    isVoiceStageExpanded = false
                                },
                                onCloseStage = { isVoiceStageExpanded = false }
                            )
                        } else {
                            ChatScreen(
                                server = selectedServer,
                                channel = selectedChannel,
                                messages = messages,
                                currentUser = currentUser,
                                onSendMessage = { text, enc, atts ->
                                    viewModel.sendMessage(text, enc, atts)
                                },
                                onToggleReaction = { msgId, emoji ->
                                    viewModel.toggleReaction(msgId, emoji)
                                },
                                onOpenDrawer = {},
                                onOpenNitroShowcase = { showNitroShowcaseDialog = true },
                                onOpenAttachmentPicker = { showAttachmentPickerDialog = true }
                            )
                        }
                    }
                }
            }
        } else {
            // Mobile Layout with Modal Navigation Drawer
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth(0.85f)
                            .fillMaxHeight()
                    ) {
                        ServerRail(
                            servers = servers,
                            selectedServer = selectedServer,
                            onSelectServer = { s ->
                                viewModel.selectServer(s)
                            },
                            onCreateServerClick = { showCreateServerDialog = true },
                            onJoinServerClick = { showJoinServerDialog = true },
                            onNitroClick = { showNitroShowcaseDialog = true },
                            onWebCompanionClick = {
                                coroutineScope.launch { drawerState.close() }
                                showWebCompanion = true
                            }
                        )

                        ChannelDrawer(
                            server = selectedServer,
                            channels = channels,
                            selectedChannel = selectedChannel,
                            currentUser = currentUser,
                            activeVoiceCall = activeVoiceCall,
                            onSelectChannel = { ch ->
                                coroutineScope.launch { drawerState.close() }
                                if (ch.type == ChannelType.VOICE.name || ch.type == ChannelType.VIDEO.name) {
                                    viewModel.joinVoiceChannel(ch)
                                    isVoiceStageExpanded = true
                                } else {
                                    viewModel.selectChannel(ch)
                                }
                            },
                            onCreateChannelClick = { showCreateChannelDialog = true },
                            onInviteFriendsClick = { showServerSettingsDialog = true },
                            onServerSettingsClick = { showServerSettingsDialog = true },
                            onUserSettingsClick = { showUserSettingsDialog = true },
                            onToggleMute = { viewModel.toggleMute() },
                            onToggleDeafen = { viewModel.toggleDeafen() },
                            onDisconnectVoice = {
                                viewModel.disconnectVoice()
                                isVoiceStageExpanded = false
                            },
                            onExpandVoiceStage = {
                                coroutineScope.launch { drawerState.close() }
                                isVoiceStageExpanded = true
                            },
                            onAddFriendClick = {
                                coroutineScope.launch { drawerState.close() }
                                showAddFriendDialog = true
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            ) {
                Scaffold(
                    snackbarHost = { SnackbarHost(snackbarHostState) },
                    containerColor = VortexBgDark
                ) { padding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding)
                    ) {
                        if (isVoiceStageExpanded && activeVoiceCall != null) {
                            VoiceRoomScreen(
                                voiceState = activeVoiceCall!!,
                                voiceSession = voiceSession,
                                currentUser = currentUser,
                                onToggleMute = { viewModel.toggleMute() },
                                onToggleDeafen = { viewModel.toggleDeafen() },
                                onToggleVideo = { viewModel.toggleVideo() },
                                onToggleScreenShare = { viewModel.toggleScreenShare() },
                                onSimulateSpeaking = { viewModel.setSpeaking(it) },
                                onDisconnect = {
                                    viewModel.disconnectVoice()
                                    isVoiceStageExpanded = false
                                },
                                onCloseStage = { isVoiceStageExpanded = false }
                            )
                        } else {
                            ChatScreen(
                                server = selectedServer,
                                channel = selectedChannel,
                                messages = messages,
                                currentUser = currentUser,
                                onSendMessage = { text, enc, atts ->
                                    viewModel.sendMessage(text, enc, atts)
                                },
                                onToggleReaction = { msgId, emoji ->
                                    viewModel.toggleReaction(msgId, emoji)
                                },
                                onOpenDrawer = {
                                    coroutineScope.launch { drawerState.open() }
                                },
                                onOpenNitroShowcase = { showNitroShowcaseDialog = true },
                                onOpenAttachmentPicker = { showAttachmentPickerDialog = true }
                            )
                        }
                    }
                }
            }
        }
    }
}
