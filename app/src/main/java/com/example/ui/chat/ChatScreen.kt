package com.example.ui.chat

import android.content.Intent
import android.net.Uri
import android.util.Base64
import android.widget.Toast
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import coil.compose.AsyncImage
import java.io.File
import java.io.FileOutputStream
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddReaction
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Diamond
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.InsertDriveFile
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Mood
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.Attachment
import com.example.data.model.Channel
import com.example.data.model.Message
import com.example.data.model.Server
import com.example.data.model.User
import com.example.ui.theme.DiscordBlurple
import com.example.ui.theme.DiscordGreen
import com.example.ui.theme.DiscordNitroGold
import com.example.ui.theme.DiscordNitroPink
import com.example.ui.theme.VortexAccentBorder
import com.example.ui.theme.VortexBgDark
import com.example.ui.theme.VortexChannelDark
import com.example.ui.theme.VortexInputDark
import com.example.ui.theme.VortexSurfaceDark
import com.example.ui.theme.VortexTextMuted
import com.example.ui.theme.VortexTextPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    server: Server?,
    channel: Channel?,
    messages: List<Message>,
    currentUser: User?,
    onSendMessage: (content: String, isEncrypted: Boolean, attachments: List<Attachment>) -> Unit,
    onToggleReaction: (messageId: String, emoji: String) -> Unit,
    onOpenDrawer: () -> Unit,
    onOpenNitroShowcase: () -> Unit,
    onOpenAttachmentPicker: () -> Unit,
    modifier: Modifier = Modifier
) {
    var inputText by remember { mutableStateOf("") }
    var isE2EEActive by remember(channel) { mutableStateOf(channel?.isEncrypted ?: true) }
    var showEmojiQuickBar by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    // Auto-scroll to bottom on new message
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    if (server == null) {
        Column(
            modifier = modifier
                .fillMaxSize()
                .background(VortexChannelDark),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(DiscordBlurple.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Text("🚀", fontSize = 36.sp)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Welcome to Vortex",
                color = VortexTextPrimary,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "No community server selected.\nTap + on the left rail to create a new server or join with an invite code!",
                color = VortexTextMuted,
                fontSize = 13.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.padding(horizontal = 32.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onOpenDrawer,
                colors = ButtonDefaults.buttonColors(containerColor = DiscordBlurple),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Open Menu")
            }
        }
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(VortexChannelDark)
    ) {
        // Chat Header
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexSurfaceDark,
            shadowElevation = 2.dp
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = onOpenDrawer,
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Menu,
                        contentDescription = "Toggle Channel List",
                        tint = VortexTextPrimary
                    )
                }

                Text(
                    text = "#",
                    color = VortexTextMuted,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(4.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = channel?.name ?: "select-a-channel",
                        color = VortexTextPrimary,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (!channel?.topic.isNullOrBlank()) {
                        Text(
                            text = channel?.topic ?: "",
                            color = VortexTextMuted,
                            fontSize = 11.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
        Divider(color = VortexAccentBorder, thickness = 1.dp)

        // Messages LazyColumn
        Box(modifier = Modifier.weight(1f)) {
            if (messages.isEmpty()) {
                // Empty state greeting
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(VortexSurfaceDark),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "#",
                            color = DiscordBlurple,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Welcome to #${channel?.name ?: "channel"}!",
                        color = VortexTextPrimary,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "This is the start of the #${channel?.name} channel. Messages here are protected with End-to-End Encryption and optimized for minimum bandwidth.",
                        color = VortexTextMuted,
                        fontSize = 13.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp, start = 16.dp, end = 16.dp)
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        MessageItem(
                            message = msg,
                            currentUser = currentUser,
                            onToggleReaction = { emoji -> onToggleReaction(msg.id, emoji) }
                        )
                    }
                }
            }
        }

        // Quick Nitro Emoji Selector Bar
        AnimatedVisibility(visible = showEmojiQuickBar) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = VortexSurfaceDark
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val nitroEmojis = listOf("🚀", "✨", "🔥", "💎", "👾", "🎉", "⚡", "❤️")
                    nitroEmojis.forEach { emoji ->
                        Text(
                            text = emoji,
                            fontSize = 24.sp,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable {
                                    inputText += " $emoji "
                                    showEmojiQuickBar = false
                                }
                                .padding(4.dp)
                        )
                    }
                }
            }
        }

        // Chat Input Box
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = VortexSurfaceDark
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Attach file / large media button
                IconButton(
                    onClick = onOpenAttachmentPicker,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(VortexInputDark)
                        .testTag("attach_file_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Attach Files or Large Media",
                        tint = VortexTextPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Spacer(modifier = Modifier.width(6.dp))

                // E2EE Lock Toggle
                IconButton(
                    onClick = { isE2EEActive = !isE2EEActive },
                    modifier = Modifier.size(34.dp)
                ) {
                    Icon(
                        imageVector = if (isE2EEActive) Icons.Default.Lock else Icons.Default.LockOpen,
                        contentDescription = "Toggle E2EE",
                        tint = if (isE2EEActive) DiscordGreen else VortexTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Message Text Field
                TextField(
                    value = inputText,
                    onValueChange = { inputText = it },
                    placeholder = {
                        Text(
                            text = if (isE2EEActive) "E2EE Message #${channel?.name}..." else "Message #${channel?.name}...",
                            color = VortexTextMuted,
                            fontSize = 14.sp
                        )
                    },
                    modifier = Modifier
                        .weight(1f)
                        .testTag("message_input_field"),
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.colors(
                        focusedContainerColor = VortexInputDark,
                        unfocusedContainerColor = VortexInputDark,
                        focusedIndicatorColor = Color.Transparent,
                        unfocusedIndicatorColor = Color.Transparent,
                        focusedTextColor = VortexTextPrimary,
                        unfocusedTextColor = VortexTextPrimary
                    ),
                    maxLines = 4
                )

                Spacer(modifier = Modifier.width(6.dp))

                // Emoji Picker button
                IconButton(
                    onClick = { showEmojiQuickBar = !showEmojiQuickBar },
                    modifier = Modifier.size(34.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Mood,
                        contentDescription = "Nitro Emojis",
                        tint = if (showEmojiQuickBar) DiscordNitroGold else VortexTextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Send Button
                IconButton(
                    onClick = {
                        if (inputText.isNotBlank()) {
                            onSendMessage(inputText.trim(), isE2EEActive, emptyList())
                            inputText = ""
                            showEmojiQuickBar = false
                        }
                    },
                    enabled = inputText.isNotBlank(),
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(if (inputText.isNotBlank()) DiscordBlurple else VortexInputDark)
                        .testTag("send_message_button")
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = "Send Message",
                        tint = if (inputText.isNotBlank()) Color.White else VortexTextMuted,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun MessageItem(
    message: Message,
    currentUser: User?,
    onToggleReaction: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("message_item_${message.id}"),
        verticalAlignment = Alignment.Top
    ) {
        // Sender Avatar
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(DiscordBlurple),
            contentAlignment = Alignment.Center
        ) {
            val initial = (message.senderName.firstOrNull() ?: 'U').uppercase()
            Text(
                text = "$initial",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
        }

        Spacer(modifier = Modifier.width(10.dp))

        Column(modifier = Modifier.weight(1f)) {
            // Header: Name, timestamp, E2EE pill
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = message.senderName,
                    color = VortexTextPrimary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )

                // Nitro Badge Pill
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(3.dp))
                        .background(DiscordNitroGold.copy(alpha = 0.2f))
                        .padding(horizontal = 4.dp, vertical = 1.dp)
                ) {
                    Text(
                        text = "NITRO",
                        color = DiscordNitroGold,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                // Formatted timestamp
                val timeStr = message.createdAt?.toDate()?.let {
                    SimpleDateFormat("HH:mm", Locale.getDefault()).format(it)
                } ?: "Now"
                Text(
                    text = timeStr,
                    color = VortexTextMuted,
                    fontSize = 11.sp
                )

                if (message.isEncrypted) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Decrypted on-device",
                        tint = DiscordGreen,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            // Message text content
            Text(
                text = message.content,
                color = VortexTextPrimary,
                fontSize = 14.sp,
                lineHeight = 19.sp
            )

            // Real File & Media Attachments
            if (message.attachments.isNotEmpty()) {
                val context = LocalContext.current
                Spacer(modifier = Modifier.height(6.dp))
                message.attachments.forEach { attMap ->
                    val fileName = attMap["fileName"] as? String ?: "attachment"
                    val fileSize = attMap["fileSizeFormatted"] as? String ?: ""
                    val mediaUrl = attMap["mediaUrl"] as? String ?: ""
                    val fileType = attMap["fileType"] as? String ?: ""
                    val isImg = (attMap["isImage"] as? Boolean) == true ||
                            fileType.startsWith("image/") ||
                            mediaUrl.startsWith("data:image/") ||
                            fileName.lowercase().matches(".*\\.(png|jpg|jpeg|webp|gif|svg)$".toRegex())

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 4.dp),
                        shape = RoundedCornerShape(10.dp),
                        color = VortexInputDark,
                        border = androidx.compose.foundation.BorderStroke(1.dp, VortexAccentBorder)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            if (isImg && mediaUrl.isNotBlank()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .heightIn(min = 120.dp, max = 220.dp)
                                        .clip(RoundedCornerShape(topStart = 10.dp, topEnd = 10.dp))
                                        .background(androidx.compose.ui.graphics.Color.Black)
                                        .clickable {
                                            openOrShareAttachment(context, fileName, mediaUrl, fileType)
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    AsyncImage(
                                        model = mediaUrl,
                                        contentDescription = fileName,
                                        modifier = Modifier.fillMaxSize(),
                                        contentScale = ContentScale.Fit
                                    )
                                }
                            }

                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        openOrShareAttachment(context, fileName, mediaUrl, fileType)
                                    }
                                    .padding(10.dp),
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
                                        imageVector = if (isImg) Icons.Default.Mood else Icons.Default.InsertDriveFile,
                                        contentDescription = "File",
                                        tint = DiscordBlurple,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = fileName,
                                        color = VortexTextPrimary,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = if (fileSize.isNotBlank()) "$fileSize • High-Speed Transfer" else "File Attachment",
                                        color = VortexTextMuted,
                                        fontSize = 11.sp
                                    )
                                }
                                IconButton(
                                    onClick = {
                                        openOrShareAttachment(context, fileName, mediaUrl, fileType)
                                    }
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Download,
                                        contentDescription = "Download / Open File",
                                        tint = DiscordBlurple,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Reactions Row
            if (message.reactions.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    message.reactions.forEach { rMap ->
                        val emoji = rMap["emoji"] as? String ?: "👍"
                        val count = (rMap["count"] as? Number)?.toLong() ?: 1L
                        val userIds = rMap["userIds"] as? List<String> ?: emptyList()
                        val hasUserReacted = currentUser?.userId?.let { userIds.contains(it) } ?: false

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (hasUserReacted) DiscordBlurple.copy(alpha = 0.25f) else VortexInputDark)
                                .border(
                                    1.dp,
                                    if (hasUserReacted) DiscordBlurple else VortexAccentBorder,
                                    RoundedCornerShape(6.dp)
                                )
                                .clickable { onToggleReaction(emoji) }
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "$emoji $count",
                                color = if (hasUserReacted) DiscordBlurple else VortexTextPrimary,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun openOrShareAttachment(
    context: android.content.Context,
    fileName: String,
    mediaUrl: String,
    fileType: String
) {
    if (mediaUrl.isBlank()) {
        Toast.makeText(context, "File: $fileName ($fileType)", Toast.LENGTH_SHORT).show()
        return
    }

    try {
        if (mediaUrl.startsWith("data:")) {
            val commaIdx = mediaUrl.indexOf(",")
            if (commaIdx != -1) {
                val b64 = mediaUrl.substring(commaIdx + 1)
                val bytes = Base64.decode(b64, Base64.DEFAULT)
                val safeFileName = fileName.ifBlank { "attachment.dat" }
                val cacheFile = File(context.cacheDir, safeFileName)
                FileOutputStream(cacheFile).use { it.write(bytes) }

                val uri = androidx.core.content.FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    cacheFile
                )
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, fileType.ifEmpty { "*/*" })
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Open $fileName"))
                return
            }
        }

        // Fallback for Uri or URL
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(mediaUrl)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "Ready: $fileName", Toast.LENGTH_SHORT).show()
    }
}

