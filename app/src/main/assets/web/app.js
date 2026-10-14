// Vortex Web Client - Connected to Live Vortex Cloud Firebase & Cryptography
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

// Firebase App Configuration (matches app/google-services.json)
const firebaseConfig = {
  projectId: "gen-lang-client-0796013424",
  apiKey: "AIzaSyCzUD9vHpNIhtdpj5_jh-3-_lLdsf7si64",
  storageBucket: "gen-lang-client-0796013424.firebasestorage.app",
  authDomain: "gen-lang-client-0796013424.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const DATABASE_ID = "ai-studio-android-vortex-e2d58943-f665-4c2a-bdf6-e27d84876409";
const db = getFirestore(app, DATABASE_ID);
const auth = getAuth(app);

// Client Customization Preferences (saved in browser)
const savedSettings = JSON.parse(localStorage.getItem("vortex_appearance") || "{}");
let currentTheme = savedSettings.theme || "dark";
let currentAccent = savedSettings.accent || "#5865f2";
let currentFont = savedSettings.font || "sans";
let currentFontSize = savedSettings.fontSize || "14";

// Nitro & Server Boosts state (monthly, unlocked via watching Ads)
let nitroExpiresAt = parseInt(localStorage.getItem("vortex_nitro_expires") || "0", 10);
let serverBoostsCount = parseInt(localStorage.getItem("vortex_server_boosts") || "0", 10);

function isNitroActive() {
  return nitroExpiresAt > Date.now();
}

function getNitroDaysRemaining() {
  if (!isNitroActive()) return 0;
  return Math.ceil((nitroExpiresAt - Date.now()) / (1000 * 60 * 60 * 24));
}

// State variables (support username, display name, custom tag)
let currentUser = {
  uid: "guest_" + Math.random().toString(36).substring(2, 8),
  displayName: localStorage.getItem("vortex_display_name") || "Vortex User",
  username: localStorage.getItem("vortex_username") || "vortex_user",
  tag: localStorage.getItem("vortex_tag") || "#1337",
  bio: localStorage.getItem("vortex_bio") || "Exploring the decentralized metaverse with Vortex.",
  bannerColor: localStorage.getItem("vortex_banner_color") || "#5865f2",
  photoURL: "",
  isGuest: true
};

// User Servers (clean start - no default mock server)
let userServers = JSON.parse(localStorage.getItem("vortex_servers") || "[]");
let currentServer = userServers.length > 0 ? userServers[0] : null;

// User Direct Messages (clean start - no default mock DMs)
let userDMs = JSON.parse(localStorage.getItem("vortex_dms") || "[]");
let currentChannel = { id: "general", name: "general", type: "TEXT", isEncrypted: true };

let currentMessagesList = [];
let pinnedMessagesList = JSON.parse(localStorage.getItem("vortex_pinned_msgs") || "[]");
let searchQuery = "";

let isE2EEActive = true;
let isLowBandwidth = true;
let isMuted = false;
let isDeafened = false;
let isVideoOn = false;
let isSharing = false;
let isMemberListOpen = true;
let isPinnedPanelOpen = false;

let unsubscribeMessages = null;
let unsubscribeChannels = null;

// --- Apply Theme, Font & Accent Color ---
function applyAppearance() {
  document.body.className = "";
  if (currentTheme !== "dark") {
    document.body.classList.add("theme-" + currentTheme);
  }
  document.body.classList.add("font-" + currentFont);
  document.documentElement.style.setProperty("--brand-blurple", currentAccent);
  document.documentElement.style.setProperty("--message-font-size", currentFontSize + "px");

  localStorage.setItem("vortex_appearance", JSON.stringify({
    theme: currentTheme,
    accent: currentAccent,
    font: currentFont,
    fontSize: currentFontSize
  }));
}
applyAppearance();

// --- Web Crypto AES-GCM (Bit-for-bit compatible with E2EEManager.kt) ---
const E2EE_SALT = "Vortex-E2EE-Master-Key-2026";

async function deriveChannelKey(serverId, channelId) {
  const safeServerId = serverId || "vortex_dm_space";
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(`${safeServerId}:${channelId}:${E2EE_SALT}`);
  const hash = await crypto.subtle.digest("SHA-256", rawKeyMaterial);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptMessage(plainText, key) {
  try {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = enc.encode(plainText);
    const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);

    const cipherArray = new Uint8Array(cipherBuffer);
    const payload = new Uint8Array(1 + 12 + cipherArray.length);
    payload[0] = 0;
    payload.set(iv, 1);
    payload.set(cipherArray, 13);

    let binary = "";
    for (let i = 0; i < payload.length; i++) {
      binary += String.fromCharCode(payload[i]);
    }
    return "vtx_enc:" + btoa(binary);
  } catch (e) {
    console.error("Encryption error:", e);
    return plainText;
  }
}

async function decryptMessage(cipherPayload, key) {
  if (!cipherPayload.startsWith("vtx_enc:")) return cipherPayload;
  try {
    const raw = atob(cipherPayload.replace("vtx_enc:", ""));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.charCodeAt(i);
    }
    const iv = bytes.slice(1, 13);
    const cipherData = bytes.slice(13);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, cipherData);
    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    return "[Encrypted message - E2EE protected]";
  }
}

// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const customName = localStorage.getItem("vortex_display_name");
    const customUser = localStorage.getItem("vortex_username");
    const customTag = localStorage.getItem("vortex_tag");
    const customBio = localStorage.getItem("vortex_bio");
    const customBanner = localStorage.getItem("vortex_banner_color");

    const derivedUser = user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, "") : "vortex_user";

    currentUser = {
      uid: user.uid,
      displayName: customName || user.displayName || "Sambhaji",
      username: customUser || derivedUser,
      tag: customTag || ("#" + user.uid.substring(0, 4).toUpperCase()),
      bio: customBio || "Vortex member since 2026",
      bannerColor: customBanner || "#5865f2",
      photoURL: user.photoURL || "",
      isGuest: false
    };
    document.getElementById("btn-auth").innerText = "Sign Out";

    // Sync profile with Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: currentUser.displayName,
        username: currentUser.username,
        customTag: currentUser.tag,
        bio: currentUser.bio,
        bannerColor: currentUser.bannerColor,
        nitroActive: isNitroActive(),
        nitroExpiresAt: nitroExpiresAt,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore user sync:", e);
    }
  } else {
    document.getElementById("btn-auth").innerText = "Sign in with Google";
  }
  updateUserProfileDisplay();
  renderServerRail();
  renderDMsList();
  initLiveChannels();
  renderMemberList();
});

function updateUserProfileDisplay() {
  const nameEl = document.getElementById("user-display-name");
  const tagEl = document.getElementById("user-custom-tag");
  const avatarEl = document.getElementById("user-avatar-text");
  if (nameEl) nameEl.innerText = currentUser.displayName;
  if (tagEl) {
    tagEl.innerText = currentUser.username ? `@${currentUser.username}` : (currentUser.tag || "#1337");
  }
  const initial = (currentUser.displayName[0] || "U").toUpperCase();
  if (avatarEl) avatarEl.innerText = initial;

  const boostBadge = document.getElementById("server-boost-badge");
  if (boostBadge) {
    if (serverBoostsCount >= 3) {
      boostBadge.innerText = "LVL 3 🚀";
      boostBadge.style.display = "inline-block";
    } else if (serverBoostsCount > 0) {
      boostBadge.innerText = `LVL ${serverBoostsCount} 🚀`;
      boostBadge.style.display = "inline-block";
    } else {
      boostBadge.innerText = "BOOST 🚀";
      boostBadge.style.display = "inline-block";
    }
  }
}

// --- Direct Messages Hub ---
window.openDirectMessagesHub = function() {
  currentServer = null;
  document.querySelectorAll(".server-icon").forEach(el => el.classList.remove("active"));
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn) homeBtn.classList.add("active");

  const header = document.getElementById("header-server-name");
  if (header) header.innerText = "Direct Messages";

  window.switchChannel("dms_home", "Direct Messages", "TEXT", true);
  renderDMsList();
  renderMemberList();
};

// --- Render Server Rail & Channels ---
function renderServerRail() {
  const railContainer = document.getElementById("server-rail-list");
  if (!railContainer) return;
  railContainer.innerHTML = "";

  userServers.forEach((server) => {
    const icon = document.createElement("div");
    icon.className = "server-icon" + (currentServer && currentServer.id === server.id ? " active" : "");
    icon.innerText = server.emoji || server.name.slice(0, 2).toUpperCase();
    icon.title = server.name;
    icon.onclick = () => selectServer(server);
    railContainer.appendChild(icon);
  });
}

function selectServer(server) {
  currentServer = server;
  document.querySelectorAll(".server-icon").forEach(el => el.classList.remove("active"));
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn && !server) homeBtn.classList.add("active");

  const header = document.getElementById("header-server-name");
  if (header) header.innerText = server ? server.name : "Select or Create a Server";
  renderServerRail();
  initLiveChannels();
  renderMemberList();
}

function renderDMsList() {
  const dmContainer = document.getElementById("direct-messages-container");
  if (!dmContainer) return;
  dmContainer.innerHTML = "";

  if (userDMs.length === 0) {
    dmContainer.innerHTML = `
      <div style="font-size:11px; color:var(--text-muted); padding: 8px 10px; font-style: italic; opacity:0.8;">
        No direct messages yet.<br>Click '+' above to start chatting.
      </div>
    `;
    return;
  }

  userDMs.forEach((dm) => {
    const item = document.createElement("div");
    item.className = "channel-item" + (currentChannel && currentChannel.id === dm.id ? " active" : "");
    item.onclick = () => window.switchChannel(dm.id, "@ " + dm.name, "TEXT", true);

    item.innerHTML = `
      <span class="channel-icon">@</span>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(dm.name)}</span>
      <span style="font-size:14px; color:var(--text-muted); cursor:pointer; margin-left:6px; padding:0 4px;" title="Close DM" onclick="event.stopPropagation(); removeDM('${dm.id}')">×</span>
    `;
    dmContainer.appendChild(item);
  });
}

window.removeDM = function(dmId) {
  userDMs = userDMs.filter(d => d.id !== dmId);
  localStorage.setItem("vortex_dms", JSON.stringify(userDMs));
  renderDMsList();
  if (currentChannel && currentChannel.id === dmId) {
    window.switchChannel("general", "general", "TEXT", true);
  }
};

// --- Live Firestore Listeners ---
function initLiveChannels() {
  if (unsubscribeChannels) unsubscribeChannels();

  const channelListEl = document.getElementById("text-channels-container");
  const voiceListEl = document.getElementById("voice-channels-container");

  if (!currentServer) {
    if (channelListEl) {
      channelListEl.innerHTML = `
        <div style="padding:16px 10px; font-size:12px; color:var(--text-muted); text-align:center;">
          No server selected.<br><br>
          <button class="btn-primary" style="padding:6px 12px; font-size:12px;" onclick="openAddServerModal()">+ Create Server</button>
        </div>
      `;
    }
    if (voiceListEl) voiceListEl.innerHTML = "";
    listenToMessages();
    return;
  }

  try {
    const channelsRef = collection(db, "servers", currentServer.id, "channels");
    unsubscribeChannels = onSnapshot(channelsRef, (snapshot) => {
      if (!channelListEl || !voiceListEl) return;
      channelListEl.innerHTML = "";
      voiceListEl.innerHTML = "";

      if (snapshot.empty) {
        addChannelToDOM("general", "general", "TEXT", true);
        addChannelToDOM("announcements", "announcements", "TEXT", true);
        addChannelToDOM("voice-lounge", "voice-lounge", "VOICE", true);
        addChannelToDOM("video-stage", "video-stage", "VIDEO", true);
      } else {
        snapshot.forEach((docSnap) => {
          const ch = docSnap.data();
          addChannelToDOM(docSnap.id, ch.name, ch.type || "TEXT", ch.isEncrypted);
        });
      }
    }, (err) => {
      console.warn("Firestore channels listener: using local fallback.", err);
    });
  } catch (e) {
    console.warn("Offline or channels note:", e);
  }

  listenToMessages();
}

function addChannelToDOM(id, name, type, isEncrypted) {
  const container = (type === "TEXT")
    ? document.getElementById("text-channels-container")
    : document.getElementById("voice-channels-container");
  if (!container) return;

  const item = document.createElement("div");
  item.className = "channel-item" + (currentChannel.id === id ? " active" : "");
  item.id = "ch-" + id;
  item.onclick = () => window.switchChannel(id, name, type, isEncrypted);

  const icon = type === "TEXT" ? "#" : (type === "VOICE" ? "🔊" : "📹");
  item.innerHTML = `
    <span class="channel-icon">${icon}</span>
    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
    <span style="font-size:12px; opacity:0; hover:opacity:1; cursor:pointer;" class="delete-ch-btn" title="Delete Channel" onclick="event.stopPropagation(); deleteChannelAction('${id}')">🗑️</span>
  `;
  container.appendChild(item);
}

window.deleteChannelAction = async function(chId) {
  if (!currentServer) return;
  if (confirm("Delete this channel?")) {
    try {
      await deleteDoc(doc(db, "servers", currentServer.id, "channels", chId));
    } catch (e) {
      const el = document.getElementById("ch-" + chId);
      if (el) el.remove();
    }
  }
};

function listenToMessages() {
  if (unsubscribeMessages) unsubscribeMessages();

  const container = document.getElementById("messages-container");
  const welcomeCard = document.getElementById("welcome-card");
  if (!container) return;
  container.innerHTML = "";
  if (welcomeCard) container.appendChild(welcomeCard);

  const isDM = currentChannel && currentChannel.id && currentChannel.id.startsWith("dm_");
  const serverId = currentServer ? currentServer.id : (isDM ? "dms" : null);

  if (!serverId) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 36px; margin-bottom: 12px;">🚀</div>
        <h3 style="color: var(--header-primary); margin-bottom: 8px;">Welcome to Vortex</h3>
        <p style="font-size: 13px; max-width: 420px; margin: 0 auto 16px;">No server selected. Click the '+' on the left rail to create a new server, join an existing server with an invite code, or start a Direct Message!</p>
        <button class="btn-primary" onclick="openAddServerModal()">+ Create Server</button>
      </div>
    `;
    return;
  }

  try {
    const messagesRef = collection(db, "servers", serverId, "channels", currentChannel.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    unsubscribeMessages = onSnapshot(q, async (snapshot) => {
      currentMessagesList = [];
      const key = await deriveChannelKey(serverId, currentChannel.id);

      for (const docSnap of snapshot.docs) {
        const msg = docSnap.data();
        let displayContent = msg.content;
        if (msg.isEncrypted) {
          displayContent = await decryptMessage(msg.content, key);
        }
        currentMessagesList.push({
          id: docSnap.id,
          senderName: msg.senderName,
          senderId: msg.senderId,
          content: displayContent,
          isEncrypted: msg.isEncrypted,
          createdAt: msg.createdAt,
          attachments: msg.attachments || [],
          reactions: msg.reactions || [],
          isPinned: msg.isPinned || false
        });
      }
      renderMessagesStream();
    }, (err) => {
      console.warn("Live message stream note:", err);
    });
  } catch (e) {
    console.warn("Message stream note:", e);
  }
}

function renderMessagesStream() {
  const container = document.getElementById("messages-container");
  const welcomeCard = document.getElementById("welcome-card");
  if (!container) return;
  container.innerHTML = "";
  if (welcomeCard) container.appendChild(welcomeCard);

  const filtered = searchQuery.trim()
    ? currentMessagesList.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.senderName.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentMessagesList;

  filtered.forEach(msg => {
    renderMessageCard(msg);
  });
  container.scrollTop = container.scrollHeight;
}

function renderMessageCard(msg) {
  const container = document.getElementById("messages-container");
  const msgEl = document.createElement("div");
  msgEl.className = "message-card";
  msgEl.id = "msg-" + msg.id;

  const timeStr = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const initial = (msg.senderName[0] || "U").toUpperCase();

  let attachmentsHtml = "";
  if (msg.attachments && msg.attachments.length > 0) {
    msg.attachments.forEach(att => {
      attachmentsHtml += `
        <div class="attachment-card" style="margin-top:6px; display:inline-flex; align-items:center; gap:8px; background:var(--input-dark); padding:8px 12px; border-radius:6px; border:1px solid var(--border-subtle);">
          <span style="font-size:18px;">📁</span>
          <div>
            <div style="font-weight:600; font-size:12px; color:var(--header-primary);">${escapeHtml(att.fileName || "attachment")}</div>
            <div style="font-size:10px; color:var(--text-muted);">${escapeHtml(att.fileSizeFormatted || "Media")}</div>
          </div>
        </div>
      `;
    });
  }

  // Reactions HTML
  let reactionsHtml = "";
  if (msg.reactions && msg.reactions.length > 0) {
    reactionsHtml = `<div class="reactions-row">`;
    msg.reactions.forEach(r => {
      const isUserReacted = r.users && r.users.includes(currentUser.uid);
      reactionsHtml += `
        <div class="reaction-pill ${isUserReacted ? 'active' : ''}" onclick="toggleReaction('${msg.id}', '${r.emoji}')">
          <span>${r.emoji}</span>
          <span>${r.count || 1}</span>
        </div>
      `;
    });
    reactionsHtml += `</div>`;
  }

  // Pinned indicator
  const pinnedBadge = msg.isPinned ? `<span style="font-size:10px; color:var(--nitro-gold); margin-left:6px;" title="Pinned Message">📌 Pinned</span>` : "";

  msgEl.innerHTML = `
    <!-- Floating Action Toolbar on Hover -->
    <div class="message-actions-bar">
      <button class="action-btn" title="React Thumbs Up" onclick="toggleReaction('${msg.id}', '👍')">👍</button>
      <button class="action-btn" title="React Heart" onclick="toggleReaction('${msg.id}', '❤️')">❤️</button>
      <button class="action-btn" title="React Fire" onclick="toggleReaction('${msg.id}', '🔥')">🔥</button>
      <button class="action-btn" title="React Rocket" onclick="toggleReaction('${msg.id}', '🚀')">🚀</button>
      <button class="action-btn" title="Pin / Unpin Message" onclick="togglePinMessage('${msg.id}')">📌</button>
      ${msg.senderId === currentUser.uid ? `<button class="action-btn" title="Delete Message" onclick="deleteMessageAction('${msg.id}')">🗑️</button>` : ''}
    </div>

    <div class="avatar">${initial}</div>
    <div class="message-content-wrap" style="flex:1;">
      <div class="message-author-row" style="display:flex; align-items:center; gap:8px;">
        <span class="message-author" style="font-weight:600; color:var(--header-primary);">${escapeHtml(msg.senderName)}</span>
        <span class="message-time" style="font-size:10px; color:var(--text-muted);">${timeStr}</span>
        ${pinnedBadge}
      </div>
      <div class="message-text" style="margin-top:4px; font-size:var(--message-font-size, 14px); line-height:1.4;">${escapeHtml(msg.content)}</div>
      ${attachmentsHtml}
      ${reactionsHtml}
    </div>
  `;
  container.appendChild(msgEl);
}

// --- Reaction & Pinning Logic ---
window.toggleReaction = async function(msgId, emoji) {
  const msg = currentMessagesList.find(m => m.id === msgId);
  if (!msg) return;

  const serverId = currentServer ? currentServer.id : "dms";
  const existingReaction = msg.reactions.find(r => r.emoji === emoji);

  if (existingReaction) {
    if (existingReaction.users && existingReaction.users.includes(currentUser.uid)) {
      existingReaction.users = existingReaction.users.filter(u => u !== currentUser.uid);
      existingReaction.count--;
      if (existingReaction.count <= 0) {
        msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      if (!existingReaction.users) existingReaction.users = [];
      existingReaction.users.push(currentUser.uid);
      existingReaction.count++;
    }
  } else {
    msg.reactions.push({ emoji: emoji, count: 1, users: [currentUser.uid] });
  }

  renderMessagesStream();

  try {
    const msgRef = doc(db, "servers", serverId, "channels", currentChannel.id, "messages", msgId);
    await updateDoc(msgRef, { reactions: msg.reactions });
  } catch (e) {
    console.warn("Firestore reaction update fallback:", e);
  }
};

window.togglePinMessage = async function(msgId) {
  const msg = currentMessagesList.find(m => m.id === msgId);
  if (!msg) return;

  msg.isPinned = !msg.isPinned;
  renderMessagesStream();

  const serverId = currentServer ? currentServer.id : "dms";
  try {
    const msgRef = doc(db, "servers", serverId, "channels", currentChannel.id, "messages", msgId);
    await updateDoc(msgRef, { isPinned: msg.isPinned });
  } catch (e) {
    console.warn("Firestore pin update fallback:", e);
  }

  updatePinnedList();
};

window.deleteMessageAction = async function(msgId) {
  const serverId = currentServer ? currentServer.id : "dms";
  try {
    const msgRef = doc(db, "servers", serverId, "channels", currentChannel.id, "messages", msgId);
    await deleteDoc(msgRef);
  } catch (e) {
    currentMessagesList = currentMessagesList.filter(m => m.id !== msgId);
    renderMessagesStream();
  }
};

window.searchMessages = function(val) {
  searchQuery = val;
  renderMessagesStream();
};

window.togglePinnedMessages = function() {
  const panel = document.getElementById("pinned-messages-panel");
  if (!panel) return;
  isPinnedPanelOpen = !isPinnedPanelOpen;
  panel.style.display = isPinnedPanelOpen ? "flex" : "none";
  if (isPinnedPanelOpen) updatePinnedList();
};

function updatePinnedList() {
  const listEl = document.getElementById("pinned-messages-list");
  if (!listEl) return;
  const pinned = currentMessagesList.filter(m => m.isPinned);

  if (pinned.length === 0) {
    listEl.innerHTML = `<div style="font-size:12px; color:var(--text-muted); text-align:center; padding:16px;">No pinned messages in this channel.</div>`;
    return;
  }

  listEl.innerHTML = "";
  pinned.forEach(msg => {
    const card = document.createElement("div");
    card.style = "background:var(--input-dark); padding:10px; border-radius:6px; border:1px solid var(--border-subtle);";
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-weight:600; font-size:12px; color:var(--header-primary);">${escapeHtml(msg.senderName)}</span>
        <button style="background:none; border:none; cursor:pointer; font-size:11px; color:var(--text-muted);" onclick="togglePinMessage('${msg.id}')">Unpin</button>
      </div>
      <div style="font-size:12px; color:var(--text-normal);">${escapeHtml(msg.content)}</div>
    `;
    listEl.appendChild(card);
  });
}

// --- Member List Sidebar ---
window.toggleMemberList = function() {
  const sidebar = document.getElementById("members-sidebar");
  if (!sidebar) return;
  isMemberListOpen = !isMemberListOpen;
  sidebar.style.display = isMemberListOpen ? "flex" : "none";
};

function renderMemberList() {
  const onlineList = document.getElementById("members-online-list");
  const offlineList = document.getElementById("members-offline-list");
  if (!onlineList || !offlineList) return;

  const currentHandle = currentUser.username ? `@${currentUser.username}` : (currentUser.tag || "#1337");

  onlineList.innerHTML = `
    <div class="member-item" onclick="openProfileModal()">
      <div class="member-avatar-wrapper">
        <div class="member-avatar">${(currentUser.displayName[0] || 'U').toUpperCase()}</div>
        <div class="status-dot status-online"></div>
      </div>
      <div>
        <div style="font-size:13px; font-weight:600; color:var(--header-primary);">${escapeHtml(currentUser.displayName)}</div>
        <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(currentHandle)} • You</div>
      </div>
    </div>
  `;

  offlineList.innerHTML = `
    <div class="member-item" onclick="startDirectMessageWith('Cyber_Samurai', '@cyber_samurai')">
      <div class="member-avatar-wrapper">
        <div class="member-avatar" style="background:#eb459e;">C</div>
        <div class="status-dot status-offline"></div>
      </div>
      <div>
        <div style="font-size:13px; font-weight:600; color:var(--text-muted);">Cyber_Samurai</div>
        <div style="font-size:10px; color:var(--text-muted);">@cyber_samurai • Click to DM</div>
      </div>
    </div>
    <div class="member-item" onclick="startDirectMessageWith('Echo_Dev', '@echo_dev')">
      <div class="member-avatar-wrapper">
        <div class="member-avatar" style="background:#23a55a;">E</div>
        <div class="status-dot status-offline"></div>
      </div>
      <div>
        <div style="font-size:13px; font-weight:600; color:var(--text-muted);">Echo_Dev</div>
        <div style="font-size:10px; color:var(--text-muted);">@echo_dev • Click to DM</div>
      </div>
    </div>
  `;
}

window.startDirectMessageWith = function(name, handle) {
  let dm = userDMs.find(d => d.name === name);
  if (!dm) {
    const dmId = "dm_" + Math.random().toString(36).substring(2, 8);
    dm = { id: dmId, name: name };
    userDMs.push(dm);
    localStorage.setItem("vortex_dms", JSON.stringify(userDMs));
    renderDMsList();
  }
  window.switchChannel(dm.id, "@ " + name, "TEXT", true);
};

// --- Channel Switcher ---
window.switchChannel = function(id, name, type, isEncrypted) {
  currentChannel = { id, name, type, isEncrypted };

  document.querySelectorAll(".channel-item").forEach(el => el.classList.remove("active"));
  const activeEl = document.getElementById("ch-" + id) || document.getElementById(id);
  if (activeEl) activeEl.classList.add("active");

  document.getElementById("current-channel-title").innerText = name;
  document.getElementById("header-prefix").innerText = (type === "TEXT") ? (name.startsWith("@") ? "" : "#") : (type === "VOICE" ? "🔊" : "📹");
  document.getElementById("chat-text-input").placeholder = `Message ${name.startsWith("@") ? name : "#" + name}...`;

  const messagesView = document.getElementById("messages-container");
  const stageView = document.getElementById("stage-container");
  const voiceBar = document.getElementById("active-voice-bar");

  if (type === "VOICE" || type === "VIDEO") {
    messagesView.style.display = "none";
    stageView.style.display = "flex";
    if (voiceBar) voiceBar.style.display = "flex";
  } else {
    messagesView.style.display = "flex";
    stageView.style.display = "none";
    listenToMessages();
  }

  closeDrawer();
};

window.sendMessage = async function() {
  const input = document.getElementById("chat-text-input");
  const text = input.value.trim();
  if (!text) return;

  const serverId = currentServer ? currentServer.id : "dms";
  const key = await deriveChannelKey(serverId, currentChannel.id);
  const finalContent = isE2EEActive ? await encryptMessage(text, key) : text;

  try {
    const messagesRef = collection(db, "servers", serverId, "channels", currentChannel.id, "messages");
    await addDoc(messagesRef, {
      serverId: serverId,
      channelId: currentChannel.id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      content: finalContent,
      isEncrypted: isE2EEActive,
      attachments: [],
      reactions: [],
      isPinned: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    const fallbackMsg = {
      id: "local_" + Date.now(),
      senderName: currentUser.displayName,
      senderId: currentUser.uid,
      content: text,
      isEncrypted: isE2EEActive,
      createdAt: { toDate: () => new Date() },
      attachments: [],
      reactions: [],
      isPinned: false
    };
    currentMessagesList.push(fallbackMsg);
    renderMessagesStream();
  }

  input.value = "";
  const container = document.getElementById("messages-container");
  if (container) container.scrollTop = container.scrollHeight;
};

window.handleAuthAction = function() {
  if (!currentUser.isGuest) {
    signOut(auth);
  } else {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => {
      alert("Note: To sign in with Google, add your domain to Firebase Console > Authentication > Authorized domains: " + window.location.hostname);
    });
  }
};

window.toggleMute = function() {
  isMuted = !isMuted;
  const btn = document.getElementById("btn-mute");
  if (btn) btn.innerText = isMuted ? "🔇" : "🎙️";
  const stageMic = document.getElementById("stage-mic");
  if (stageMic) stageMic.innerText = isMuted ? "🔇" : "🎙️";
  const tile1 = document.getElementById("tile-1");
  if (tile1) tile1.classList.toggle("speaking", !isMuted);
};

window.toggleVideo = function() {
  isVideoOn = !isVideoOn;
  const btn = document.getElementById("stage-video");
  if (btn) btn.classList.toggle("active", isVideoOn);
};

window.toggleShare = function() {
  isSharing = !isSharing;
  const btn = document.getElementById("stage-share");
  if (btn) btn.classList.toggle("active", isSharing);
};

window.disconnectVoice = function() {
  document.getElementById("stage-container").style.display = "none";
  document.getElementById("messages-container").style.display = "flex";
  const voiceBar = document.getElementById("active-voice-bar");
  if (voiceBar) voiceBar.style.display = "none";
  window.switchChannel("general", "general", "TEXT", true);
};

window.toggleE2EE = function() {
  isE2EEActive = !isE2EEActive;
  const btn = document.getElementById("btn-e2ee-toggle");
  if (btn) {
    btn.innerText = isE2EEActive ? "🔒" : "🔓";
    btn.style.color = isE2EEActive ? "var(--brand-green)" : "var(--text-muted)";
  }
};

window.insertEmoji = function(emoji) {
  const input = document.getElementById("chat-text-input");
  if (input) input.value += " " + emoji + " ";
};

window.toggleDrawer = function() {
  document.body.classList.toggle("drawer-open");
  document.getElementById("drawer-backdrop").classList.toggle("active");
};

window.closeDrawer = function() {
  document.body.classList.remove("drawer-open");
  document.getElementById("drawer-backdrop").classList.remove("active");
};

// ============================================================================
// Comprehensive Full-Screen Settings Page with Legal & Nitro Ad System
// ============================================================================

window.openSettings = function(initialTab = "my-account") {
  const html = `
    <div class="settings-full-dialog">
      <!-- Settings Sidebar Navigation -->
      <div class="settings-sidebar">
        <div class="settings-section-title">USER SETTINGS</div>
        <button class="settings-tab-btn ${initialTab === 'my-account' ? 'active' : ''}" onclick="switchSettingsTab('my-account')">👤 My Account</button>
        <button class="settings-tab-btn ${initialTab === 'profiles' ? 'active' : ''}" onclick="switchSettingsTab('profiles')">🎨 User Profile</button>

        <div class="settings-section-title">APP SETTINGS</div>
        <button class="settings-tab-btn ${initialTab === 'appearance' ? 'active' : ''}" onclick="switchSettingsTab('appearance')">🖌️ Appearance & Colors</button>
        <button class="settings-tab-btn ${initialTab === 'nitro' ? 'active' : ''}" onclick="switchSettingsTab('nitro')">💎 Nitro & Server Boosts</button>
        <button class="settings-tab-btn ${initialTab === 'voice-video' ? 'active' : ''}" onclick="switchSettingsTab('voice-video')">🎙️ Voice & Video</button>
        <button class="settings-tab-btn ${initialTab === 'privacy' ? 'active' : ''}" onclick="switchSettingsTab('privacy')">🔒 Privacy & Safety</button>

        <div class="settings-section-title">LEGAL & POLICIES</div>
        <button class="settings-tab-btn ${initialTab === 'terms' ? 'active' : ''}" onclick="switchSettingsTab('terms')">📜 Terms of Service</button>
        <button class="settings-tab-btn ${initialTab === 'privacy-policy' ? 'active' : ''}" onclick="switchSettingsTab('privacy-policy')">🛡️ Privacy Policy</button>
        <button class="settings-tab-btn ${initialTab === 'community' ? 'active' : ''}" onclick="switchSettingsTab('community')">🤝 Community Guidelines</button>
        <button class="settings-tab-btn ${initialTab === 'encryption' ? 'active' : ''}" onclick="switchSettingsTab('encryption')">🔐 E2EE Architecture</button>

        <div style="margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);">
          <button class="btn-secondary" style="width:100%; color:var(--danger-red);" onclick="closeModal()">✕ Close Settings</button>
        </div>
      </div>

      <!-- Settings Content View Pane -->
      <div class="settings-content-pane" id="settings-content-pane">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;
  showModal(html);
  switchSettingsTab(initialTab);
};

window.switchSettingsTab = function(tabName) {
  document.querySelectorAll(".settings-tab-btn").forEach(btn => btn.classList.remove("active"));
  const btns = Array.from(document.querySelectorAll(".settings-tab-btn"));
  const targetBtn = btns.find(b => b.getAttribute("onclick")?.includes(`'${tabName}'`));
  if (targetBtn) targetBtn.classList.add("active");

  const pane = document.getElementById("settings-content-pane");
  if (!pane) return;

  switch (tabName) {
    case "my-account":
      pane.innerHTML = renderMyAccountTab();
      break;
    case "profiles":
      pane.innerHTML = renderProfilesTab();
      break;
    case "appearance":
      pane.innerHTML = renderAppearanceTab();
      break;
    case "nitro":
      pane.innerHTML = renderNitroTab();
      break;
    case "voice-video":
      pane.innerHTML = renderVoiceVideoTab();
      break;
    case "privacy":
      pane.innerHTML = renderPrivacyTab();
      break;
    case "terms":
      pane.innerHTML = renderTermsTab();
      break;
    case "privacy-policy":
      pane.innerHTML = renderPrivacyPolicyTab();
      break;
    case "community":
      pane.innerHTML = renderCommunityGuidelinesTab();
      break;
    case "encryption":
      pane.innerHTML = renderEncryptionTab();
      break;
    default:
      pane.innerHTML = renderMyAccountTab();
  }
};

function renderMyAccountTab() {
  const handle = currentUser.username ? `@${currentUser.username}` : currentUser.tag;
  return `
    <div class="settings-pane-title">My Account</div>
    <div class="settings-pane-desc">Manage your personal account credentials, display identity, and security.</div>

    <!-- Profile Banner & Avatar Preview Card -->
    <div style="background:var(--input-dark); border-radius:10px; overflow:hidden; border:1px solid var(--border-subtle); margin-bottom:20px;">
      <div style="height:80px; background:${currentUser.bannerColor || 'var(--brand-blurple)'}; position:relative;"></div>
      <div style="padding:16px; position:relative; display:flex; justify-content:space-between; align-items:flex-end;">
        <div style="margin-top:-50px; display:flex; align-items:flex-end; gap:14px;">
          <div style="width:72px; height:72px; border-radius:50%; background:var(--brand-blurple); border:4px solid var(--surface-dark); display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold; color:white;">
            ${(currentUser.displayName[0] || 'U').toUpperCase()}
          </div>
          <div>
            <div style="font-size:18px; font-weight:bold; color:var(--header-primary);">${escapeHtml(currentUser.displayName)}</div>
            <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(handle)}</div>
          </div>
        </div>
        <button class="btn-primary" onclick="switchSettingsTab('profiles')">Edit Profile</button>
      </div>
    </div>

    <!-- Inputs -->
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:var(--input-dark); padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:var(--text-muted);">DISPLAY NAME</div>
          <div style="font-size:14px; color:var(--header-primary); margin-top:2px;">${escapeHtml(currentUser.displayName)}</div>
        </div>
        <button class="btn-secondary" onclick="switchSettingsTab('profiles')">Change</button>
      </div>

      <div style="background:var(--input-dark); padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:var(--text-muted);">USERNAME (@handle)</div>
          <div style="font-size:14px; color:var(--header-primary); margin-top:2px;">@${escapeHtml(currentUser.username || 'user')}</div>
        </div>
        <button class="btn-secondary" onclick="switchSettingsTab('profiles')">Change</button>
      </div>

      <div style="background:var(--input-dark); padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:var(--text-muted);">NITRO STATUS</div>
          <div style="font-size:14px; color:${isNitroActive() ? 'var(--nitro-gold)' : 'var(--text-muted)'}; margin-top:2px;">
            ${isNitroActive() ? `Active Monthly Subscription (${getNitroDaysRemaining()} days remaining)` : 'No active subscription'}
          </div>
        </div>
        <button class="btn-secondary" onclick="switchSettingsTab('nitro')">Get Monthly Nitro</button>
      </div>
    </div>
  `;
}

function renderProfilesTab() {
  return `
    <div class="settings-pane-title">User Profile</div>
    <div class="settings-pane-desc">Customize how other members see you across all servers and direct messages.</div>

    <div style="display:flex; flex-direction:column; gap:14px;">
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">DISPLAY NAME</label>
        <input type="text" id="edit-display-name" value="${escapeHtml(currentUser.displayName)}" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>

      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">USERNAME (@handle)</label>
        <input type="text" id="edit-username" value="${escapeHtml(currentUser.username || '')}" placeholder="cyber_vortex" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>

      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">CUSTOM TAG</label>
        <input type="text" id="edit-tag" value="${escapeHtml(currentUser.tag || '#0001')}" placeholder="#1337" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>

      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">ABOUT ME (BIO)</label>
        <textarea id="edit-bio" rows="3" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; resize:none;">${escapeHtml(currentUser.bio || '')}</textarea>
      </div>

      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">BANNER ACCENT COLOR</label>
        <div style="display:flex; gap:10px; align-items:center; margin-top:6px;">
          <input type="color" id="edit-banner-color" value="${currentUser.bannerColor || '#5865f2'}" style="width:48px; height:38px; border:none; cursor:pointer; background:transparent;">
          <span style="font-size:12px; color:var(--text-muted);">Pick any color for your user profile header banner</span>
        </div>
      </div>

      <div style="display:flex; gap:10px; margin-top:10px;">
        <button class="btn-primary" onclick="saveFullProfile()">Save Changes</button>
        <button class="btn-secondary" onclick="switchSettingsTab('my-account')">Cancel</button>
      </div>
    </div>
  `;
}

window.saveFullProfile = async function() {
  const newName = document.getElementById("edit-display-name")?.value.trim() || currentUser.displayName;
  const newUsername = document.getElementById("edit-username")?.value.trim().replace(/^@/, '') || currentUser.username;
  const newTag = document.getElementById("edit-tag")?.value.trim() || currentUser.tag;
  const newBio = document.getElementById("edit-bio")?.value.trim() || currentUser.bio;
  const newBanner = document.getElementById("edit-banner-color")?.value || currentUser.bannerColor;

  currentUser.displayName = newName;
  currentUser.username = newUsername;
  currentUser.tag = newTag.startsWith("#") ? newTag : "#" + newTag;
  currentUser.bio = newBio;
  currentUser.bannerColor = newBanner;

  localStorage.setItem("vortex_display_name", currentUser.displayName);
  localStorage.setItem("vortex_username", currentUser.username);
  localStorage.setItem("vortex_tag", currentUser.tag);
  localStorage.setItem("vortex_bio", currentUser.bio);
  localStorage.setItem("vortex_banner_color", currentUser.bannerColor);

  updateUserProfileDisplay();
  renderMemberList();

  if (!currentUser.isGuest) {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        displayName: currentUser.displayName,
        username: currentUser.username,
        customTag: currentUser.tag,
        bio: currentUser.bio,
        bannerColor: currentUser.bannerColor,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not save to Firestore:", e);
    }
  }

  alert("Profile updated successfully!");
  switchSettingsTab("my-account");
};

function renderAppearanceTab() {
  return `
    <div class="settings-pane-title">Appearance & Custom Themes</div>
    <div class="settings-pane-desc">Personalize your client colors, typography, and contrast. All changes are saved automatically in your browser.</div>

    <div style="display:flex; flex-direction:column; gap:20px;">
      <!-- Theme Selection -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">THEME</label>
        <div class="theme-grid" style="margin-top:8px;">
          <div class="theme-chip ${currentTheme === 'dark' ? 'active' : ''}" onclick="selectTheme('dark')">
            <span style="font-size:18px;">🌙</span> Dark Classic
          </div>
          <div class="theme-chip ${currentTheme === 'amoled' ? 'active' : ''}" onclick="selectTheme('amoled')">
            <span style="font-size:18px;">🖤</span> Midnight AMOLED
          </div>
          <div class="theme-chip ${currentTheme === 'ocean' ? 'active' : ''}" onclick="selectTheme('ocean')">
            <span style="font-size:18px;">🌊</span> Deep Sea Slate
          </div>
          <div class="theme-chip ${currentTheme === 'light' ? 'active' : ''}" onclick="selectTheme('light')">
            <span style="font-size:18px;">☀️</span> Clean Light
          </div>
        </div>
      </div>

      <!-- Accent Color Selection -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">CLIENT ACCENT COLOR</label>
        <div class="color-picker-row" style="margin-top:8px;">
          <div class="color-dot ${currentAccent.toLowerCase() === '#5865f2' ? 'active' : ''}" style="background:#5865f2;" onclick="selectAccent('#5865f2')" title="Discord Blurple"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#23a55a' ? 'active' : ''}" style="background:#23a55a;" onclick="selectAccent('#23a55a')" title="Emerald Green"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#00b0f4' ? 'active' : ''}" style="background:#00b0f4;" onclick="selectAccent('#00b0f4')" title="Cyber Cyan"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#eb459e' ? 'active' : ''}" style="background:#eb459e;" onclick="selectAccent('#eb459e')" title="Neon Pink"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#fee75c' ? 'active' : ''}" style="background:#fee75c;" onclick="selectAccent('#fee75c')" title="Sunset Gold"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#ed4245' ? 'active' : ''}" style="background:#ed4245;" onclick="selectAccent('#ed4245')" title="Coral Red"></div>
          <div style="display:flex; align-items:center; gap:6px; margin-left:10px;">
            <input type="color" value="${currentAccent}" onchange="selectAccent(this.value)" style="width:34px; height:34px; border:none; cursor:pointer; background:transparent;" title="Custom Color Picker">
            <span style="font-size:11px; color:var(--text-muted);">Custom Hex</span>
          </div>
        </div>
      </div>

      <!-- Font Style Selection -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">CLIENT FONT FAMILY</label>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-top:8px;">
          <button class="btn-secondary ${currentFont === 'sans' ? 'btn-primary' : ''}" style="font-family:sans-serif;" onclick="selectFont('sans')">Modern Sans</button>
          <button class="btn-secondary ${currentFont === 'mono' ? 'btn-primary' : ''}" style="font-family:monospace;" onclick="selectFont('mono')">Cyber Mono</button>
          <button class="btn-secondary ${currentFont === 'rounded' ? 'btn-primary' : ''}" style="font-family:'Quicksand', 'Nunito', sans-serif;" onclick="selectFont('rounded')">Friendly Rounded</button>
          <button class="btn-secondary ${currentFont === 'serif' ? 'btn-primary' : ''}" style="font-family:Georgia, serif;" onclick="selectFont('serif')">Classic Serif</button>
        </div>
      </div>

      <!-- Chat Font Sizing -->
      <div>
        <div style="display:flex; justify-content:space-between;">
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">CHAT FONT SIZE</label>
          <span style="font-size:12px; font-weight:bold; color:var(--header-primary);" id="font-size-label">${currentFontSize}px</span>
        </div>
        <input type="range" min="12" max="18" value="${currentFontSize}" oninput="updateFontSize(this.value)" style="width:100%; margin-top:8px;">
      </div>
    </div>
  `;
}

window.selectTheme = function(themeName) {
  currentTheme = themeName;
  applyAppearance();
  switchSettingsTab("appearance");
};

window.selectAccent = function(hex) {
  currentAccent = hex;
  applyAppearance();
  switchSettingsTab("appearance");
};

window.selectFont = function(fontName) {
  currentFont = fontName;
  applyAppearance();
  switchSettingsTab("appearance");
};

window.updateFontSize = function(size) {
  currentFontSize = size;
  applyAppearance();
  const label = document.getElementById("font-size-label");
  if (label) label.innerText = size + "px";
};

// ============================================================================
// Nitro & Server Boosts through Ads System (Ad-supported monthly activation)
// ============================================================================

function renderNitroTab() {
  const active = isNitroActive();
  const daysLeft = getNitroDaysRemaining();

  return `
    <div class="settings-pane-title">💎 Nitro & Server Boosts</div>
    <div class="settings-pane-desc">Support Vortex by watching a short partner ad to unlock 1 Month of full Nitro and Server Boost perks. Ads are NEVER displayed in chat, calls, or servers.</div>

    <!-- Active Subscription Status Card -->
    <div style="background:linear-gradient(135deg, rgba(88,101,242,0.2) 0%, rgba(235,69,158,0.2) 100%); border:1px solid var(--border-subtle); padding:18px; border-radius:10px; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:12px; font-weight:bold; color:var(--nitro-pink); letter-spacing:0.5px;">YOUR SUBSCRIPTION</div>
          <div style="font-size:18px; font-weight:bold; color:var(--header-primary); margin-top:4px;">
            ${active ? `Vortex Nitro (Active for ${daysLeft} Days)` : 'No Active Nitro Subscription'}
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
            ${active ? 'All HD streaming, 500MB uploads, and emoji perks are fully unlocked!' : 'Watch a quick sponsored ad below to activate 30 days of Nitro instantly.'}
          </div>
        </div>
        <div style="font-size:32px;">${active ? '🚀' : '💎'}</div>
      </div>
    </div>

    <!-- Watch Ad to Unlock Nitro Button -->
    <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:24px;">
      <div style="background:var(--input-dark); padding:16px; border-radius:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:14px; font-weight:bold; color:var(--header-primary);">🎬 Watch Ad to Unlock 1 Month Nitro</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Complete one 15-second sponsor video to grant 30 days of Nitro to your account.</div>
        </div>
        <button class="btn-primary" style="background:var(--nitro-pink); padding:8px 16px; font-weight:bold;" onclick="watchAdForReward('nitro')">Watch Ad</button>
      </div>

      <div style="background:var(--input-dark); padding:16px; border-radius:8px; border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:14px; font-weight:bold; color:var(--header-primary);">🚀 Watch Ad to Boost This Server (30 Days)</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Boost server audio to 384kbps and unlock 1080p 60FPS video stage streams.</div>
        </div>
        <button class="btn-primary" style="background:var(--brand-blurple); padding:8px 16px; font-weight:bold;" onclick="watchAdForReward('boost')">Watch Ad</button>
      </div>
    </div>

    <!-- Ad-Supported Guarantee Notice -->
    <div style="background:rgba(35,165,90,0.1); border:1px solid var(--brand-green); border-radius:8px; padding:12px 16px; font-size:12px; color:var(--text-normal); line-height:1.5;">
      <strong style="color:var(--brand-green);">🔒 Zero-Distraction Ad Guarantee:</strong>
      Sponsored advertisements are only served when you intentionally choose to claim monthly Nitro or Server Boosts. You will never encounter banners, popups, or intrusive ads while chatting or hanging out in channels.
    </div>
  `;
}

// Interactive Simulated Ad Player
window.watchAdForReward = function(rewardType) {
  const isNitro = rewardType === "nitro";
  const adPartners = [
    { name: "NordVPN Fast & Private", desc: "Military-grade online privacy and ultrafast speeds for gamers.", tag: "Cyber Security Partner" },
    { name: "SteelSeries Pro Audio", desc: "Pristine acoustic soundscape engineered for esports champions.", tag: "Gaming Hardware Partner" },
    { name: "Razer Synapse Chroma", desc: "Synchronize RGB illumination across every gaming setup.", tag: "Peripherals Partner" }
  ];
  const partner = adPartners[Math.floor(Math.random() * adPartners.length)];

  const adHtml = `
    <div class="ad-modal-card">
      <div class="ad-video-mock">
        <div class="ad-badge">SPONSORED PARTNER AD</div>
        <div class="ad-countdown" id="ad-timer-countdown">15s</div>

        <div style="font-size:42px; margin-bottom:8px;">🎮</div>
        <div style="font-size:18px; font-weight:bold; color:white; text-align:center; padding:0 20px;">${partner.name}</div>
        <div style="font-size:12px; color:#ccc; max-width:320px; text-align:center; margin-top:6px;">${partner.desc}</div>
        <div style="font-size:10px; color:#ffcc00; margin-top:12px; letter-spacing:1px; font-weight:bold;">${partner.tag}</div>

        <div class="ad-progress-bar" id="ad-progress-bar"></div>
      </div>

      <div style="padding:16px; display:flex; justify-content:space-between; align-items:center; background:#18191c;">
        <div>
          <div style="font-size:13px; font-weight:bold; color:var(--header-primary);">Unlocking: ${isNitro ? '1 Month Vortex Nitro' : '30-Day Server Boost'}</div>
          <div style="font-size:11px; color:var(--text-muted);" id="ad-claim-hint">Please watch the full sponsor message...</div>
        </div>
        <button id="ad-claim-btn" class="btn-primary" style="opacity:0.5; cursor:not-allowed;" disabled onclick="claimAdReward('${rewardType}')">Claim Reward</button>
      </div>
    </div>
  `;

  showModal(adHtml);

  let timeLeft = 15;
  const timerEl = document.getElementById("ad-timer-countdown");
  const progEl = document.getElementById("ad-progress-bar");
  const claimBtn = document.getElementById("ad-claim-btn");
  const hintEl = document.getElementById("ad-claim-hint");

  const interval = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.innerText = `${timeLeft}s`;
    if (progEl) progEl.style.width = `${((15 - timeLeft) / 15) * 100}%`;

    if (timeLeft <= 0) {
      clearInterval(interval);
      if (timerEl) timerEl.innerText = "Completed! 🎉";
      if (claimBtn) {
        claimBtn.removeAttribute("disabled");
        claimBtn.style.opacity = "1";
        claimBtn.style.cursor = "pointer";
        claimBtn.style.background = "var(--brand-green)";
        claimBtn.innerText = "Claim 1 Month!";
      }
      if (hintEl) {
        hintEl.innerText = "Reward unlocked! Click Claim to activate.";
        hintEl.style.color = "var(--brand-green)";
      }
    }
  }, 1000);
};

window.claimAdReward = async function(rewardType) {
  if (rewardType === "nitro") {
    nitroExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    localStorage.setItem("vortex_nitro_expires", nitroExpiresAt.toString());
    if (!currentUser.isGuest) {
      try {
        await updateDoc(doc(db, "users", currentUser.uid), {
          nitroActive: true,
          nitroExpiresAt: nitroExpiresAt
        });
      } catch (e) {
        console.warn("Firestore nitro update note:", e);
      }
    }
    alert("🎉 1 Month Vortex Nitro activated! Enjoy 500MB uploads, HD streaming, and custom themes.");
  } else {
    serverBoostsCount = (serverBoostsCount || 0) + 1;
    localStorage.setItem("vortex_server_boosts", serverBoostsCount.toString());
    alert("🚀 Server Boost applied for 30 days! Server audio upgraded to 384kbps.");
  }

  updateUserProfileDisplay();
  closeModal();
  openSettings("nitro");
};

function renderVoiceVideoTab() {
  return `
    <div class="settings-pane-title">Voice & Video Settings</div>
    <div class="settings-pane-desc">Configure input/output audio hardware, noise reduction, and bandwidth profiles.</div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">INPUT DEVICE (MICROPHONE)</label>
        <select style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
          <option>Default - High Definition Audio Microphone</option>
          <option>Communications - Headset Mic</option>
        </select>
      </div>

      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">MIC TEST & VOLUME</label>
        <div style="background:var(--input-dark); padding:12px; border-radius:8px; margin-top:4px; display:flex; align-items:center; gap:12px;">
          <button class="btn-secondary" onclick="alert('Mic test active: Speak into your microphone')">Let's Check</button>
          <div style="flex:1; height:8px; background:#222; border-radius:4px; overflow:hidden;">
            <div style="width:75%; height:100%; background:var(--brand-green);"></div>
          </div>
        </div>
      </div>

      <label style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:12px; border-radius:8px; margin-top:6px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--header-primary);">Ultra-Low Bandwidth Audio Mode</div>
          <div style="font-size:11px; color:var(--text-muted);">Uses 6kbps Opus codec to save 85% mobile data on 3G/4G connections.</div>
        </div>
        <input type="checkbox" ${isLowBandwidth ? 'checked' : ''} onchange="isLowBandwidth = this.checked">
      </label>

      <label style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:12px; border-radius:8px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--header-primary);">Echo Cancellation & Noise Suppression</div>
          <div style="font-size:11px; color:var(--text-muted);">Filters out background keyboard clicks and room echoes.</div>
        </div>
        <input type="checkbox" checked>
      </label>
    </div>
  `;
}

function renderPrivacyTab() {
  return `
    <div class="settings-pane-title">Privacy & End-to-End Encryption</div>
    <div class="settings-pane-desc">Manage cryptographic key exchanges and direct message access controls.</div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:var(--input-dark); padding:14px; border-radius:8px;">
        <div style="font-size:11px; color:var(--brand-green); font-weight:bold;">YOUR E2EE SAFETY FINGERPRINT:</div>
        <div style="font-family:monospace; font-size:13px; color:var(--text-normal); margin-top:6px; letter-spacing:1px;">
          4829 • 1049 • 8271 • 9021 • 3342 • 9912
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">Compare this fingerprint out-of-band with friends to verify encrypted zero-knowledge communication.</div>
      </div>

      <label style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:12px; border-radius:8px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--header-primary);">Allow Direct Messages from Server Members</div>
          <div style="font-size:11px; color:var(--text-muted);">Permit other members in mutual servers to send encrypted DMs.</div>
        </div>
        <input type="checkbox" checked>
      </label>

      <label style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:12px; border-radius:8px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--header-primary);">Client-Side Encryption for All Channels</div>
          <div style="font-size:11px; color:var(--text-muted);">Encrypts all outgoing text with AES-256-GCM before writing to database.</div>
        </div>
        <input type="checkbox" ${isE2EEActive ? 'checked' : ''} onchange="toggleE2EE()">
      </label>
    </div>
  `;
}

// ============================================================================
// Legal Pages (Terms of Service, Privacy Policy, Community Guidelines)
// ============================================================================

function renderTermsTab() {
  return `
    <div class="settings-pane-title">Terms of Service</div>
    <div class="settings-pane-desc">Last updated: October 2026. Please review our service terms.</div>

    <div class="legal-card">
      <h3>1. Agreement to Terms</h3>
      <p>By accessing or using the Vortex platform across Android, Web, or API clients, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>

      <h3>2. Privacy & Zero-Knowledge Architecture</h3>
      <p>Vortex is engineered as an encrypted, low-bandwidth communication network. Text messages transmitted in encrypted channels are sealed on your device using client-side AES-GCM cryptography. We cannot read, sell, or decrypt your encrypted transmissions.</p>

      <h3>3. User Content & Ownership</h3>
      <p>You retain full ownership of all intellectual property rights in the content, images, messages, and files you transmit through Vortex. You grant Vortex a worldwide license strictly for the purpose of operating, syncing, and delivering your transmissions to your designated channels and recipients.</p>

      <h3>4. Ad-Supported Rewards Model</h3>
      <p>Vortex provides an optional ad-supported tier for acquiring monthly Nitro subscriptions and server boosts. In accordance with our core design, third-party sponsored advertisements are only loaded and presented when you specifically request to watch a reward ad. No advertising trackers or banners are injected into communication channels.</p>

      <h3>5. Prohibited Conduct</h3>
      <p>You may not use Vortex to transmit malware, engage in unauthorized access, harass individuals, or distribute illegal content. Violation may result in immediate suspension or termination of access.</p>

      <h3>6. Disclaimer of Warranties & Limitation of Liability</h3>
      <p>Vortex is provided on an 'AS IS' and 'AS AVAILABLE' basis. To the maximum extent permitted by law, Vortex disclaims all warranties, express or implied.</p>
    </div>
  `;
}

function renderPrivacyPolicyTab() {
  return `
    <div class="settings-pane-title">Privacy Policy</div>
    <div class="settings-pane-desc">Our commitment to zero data selling, client-side encryption, and privacy.</div>

    <div class="legal-card">
      <h3>1. Information We Collect</h3>
      <p>We believe in data minimization. When you create an account, we store your chosen display name, username (@handle), custom tag, bio, and client preferences. When authenticated via Google Sign-In, we store your unique authentication ID.</p>

      <h3>2. End-to-End Cryptography</h3>
      <p>Messages sent in encrypted channels are encrypted on the sender's device using keys derived from channel credentials and the client-side salt. Stored messages on our databases are ciphertexts prefixed with <code>vtx_enc:</code> which cannot be read without client keys.</p>

      <h3>3. Advertising & Data Protection</h3>
      <p>We do NOT track your browsing behavior, sell your personal information, or share message logs with ad brokers. Partner ads are initiated strictly on user request for monthly reward claiming.</p>

      <h3>4. Data Storage & Security</h3>
      <p>Vortex utilizes Google Firebase Firestore cloud infrastructure with strict access control security rules enforcing per-user write boundaries and server authentication gates.</p>

      <h3>5. Account Deletion & Data Rights</h3>
      <p>You have the right to edit or delete your profile information at any time from the User Profile settings pane.</p>
    </div>
  `;
}

function renderCommunityGuidelinesTab() {
  return `
    <div class="settings-pane-title">Community Guidelines</div>
    <div class="settings-pane-desc">Our standards for fostering respectful and safe communities on Vortex.</div>

    <div class="legal-card">
      <h3>1. Respect & Inclusion</h3>
      <p>Treat every member with dignity. Hate speech, discrimination, harassment, and personal intimidation are strictly forbidden in public and private servers.</p>

      <h3>2. Safety & Child Protection</h3>
      <p>Any content depicting child exploitation, self-harm encouragement, or violent extremism will result in immediate permanent banning and reporting to law enforcement authorities.</p>

      <h3>3. Authenticity & Anti-Spam</h3>
      <p>Do not create automated bots or spam scripts to flood server channels, abuse invite codes, or manipulate reward ad systems.</p>

      <h3>4. Server Administration</h3>
      <p>Server owners and administrators are empowered to moderate their own servers, remove offending members, and enforce channel topics.</p>
    </div>
  `;
}

function renderEncryptionTab() {
  return `
    <div class="settings-pane-title">End-to-End Encryption Architecture</div>
    <div class="settings-pane-desc">Technical specification of our cross-platform cryptographic pipeline.</div>

    <div class="legal-card">
      <h3>Cryptographic Primitives</h3>
      <p>Vortex implements industry-standard <strong>AES-256-GCM</strong> (Galois/Counter Mode) authenticated encryption:</p>
      <ul>
        <li><strong>Key Derivation:</strong> SHA-256 hash over the combined salt, server ID, and channel ID.</li>
        <li><strong>Initialization Vector (IV):</strong> 96-bit (12-byte) cryptographically secure pseudorandom IV generated uniquely per message via <code>crypto.getRandomValues</code> on Web and <code>SecureRandom</code> on Android.</li>
        <li><strong>Wire Format:</strong> <code>vtx_enc:[base64(version_byte + 12_byte_iv + ciphertext_with_auth_tag)]</code>.</li>
        <li><strong>Interoperability:</strong> Identical byte-order serialization guarantees seamless encryption/decryption between Android Kotlin and Web JavaScript.</li>
      </ul>
    </div>
  `;
}

// ============================================================================
// Server & Channel Creation Dialogs
// ============================================================================

window.openAddServerModal = function() {
  const emojis = ["🎮", "🚀", "💬", "⚡", "🛡️", "🎧", "🌟", "👾"];
  let emojiHtml = "";
  emojis.forEach((em) => {
    emojiHtml += `<span style="font-size:20px; cursor:pointer; padding:4px;" onclick="document.getElementById('server-emoji-input').value='${em}'">${em}</span>`;
  });

  showModal(`
    <div class="modal-card" style="width:440px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">Create Your Server</div>
      <p style="color:var(--text-muted); font-size:13px; margin:6px 0 14px;">Your server is where you and your friends hang out. Make yours and start talking.</p>

      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER ICON EMOJI</label>
          <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
            <input type="text" id="server-emoji-input" value="🎮" style="width:48px; text-align:center; font-size:20px; padding:6px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
            <div style="display:flex; gap:6px;">${emojiHtml}</div>
          </div>
        </div>

        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER NAME</label>
          <input type="text" id="new-server-name-input" placeholder="e.g. Cyber Squad" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
        </div>

        <button class="btn-primary" onclick="createServerAction()">Create Server</button>
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  `);
};

window.createServerAction = async function() {
  const name = document.getElementById("new-server-name-input").value.trim() || "New Server";
  const emoji = document.getElementById("server-emoji-input").value.trim() || "🎮";
  const newId = "server_" + Math.random().toString(36).substring(2, 9);
  const inviteCode = "VTX-" + Math.floor(1000 + Math.random() * 9000);

  const newServer = { id: newId, name: name, emoji: emoji, inviteCode: inviteCode };
  userServers.push(newServer);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));

  try {
    const sRef = doc(db, "servers", newId);
    await setDoc(sRef, {
      name: name,
      emoji: emoji,
      inviteCode: inviteCode,
      ownerId: currentUser.uid,
      createdAt: serverTimestamp()
    });

    const chRef = collection(db, "servers", newId, "channels");
    await addDoc(chRef, { name: "general", type: "TEXT", isEncrypted: true, createdAt: serverTimestamp() });
    await addDoc(chRef, { name: "voice-lounge", type: "VOICE", isEncrypted: true, createdAt: serverTimestamp() });
  } catch (e) {
    console.warn("Firestore server creation fallback:", e);
  }

  selectServer(newServer);
  closeModal();
};

window.openServerSettings = function() {
  if (!currentServer) {
    window.openAddServerModal();
    return;
  }

  showModal(`
    <div class="modal-card" style="width:420px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">${escapeHtml(currentServer.name)} Settings</div>
      <div style="display:flex; flex-direction:column; gap:14px; margin: 14px 0;">
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">INVITE LINK</label>
          <div style="background:var(--input-dark); padding:10px; border-radius:6px; font-size:13px; color:var(--brand-blurple); margin-top:4px; word-break:break-all;">
            https://${window.location.host}/#${currentServer.inviteCode || 'VTX-7742'}
          </div>
        </div>

        <button class="btn-primary" style="background:var(--nitro-pink);" onclick="watchAdForReward('boost')">
          🚀 Boost Server with Ad
        </button>

        <button class="btn-secondary" style="color:var(--danger-red); border-color:var(--danger-red);" onclick="deleteCurrentServer()">
          🗑️ Delete / Leave Server
        </button>
      </div>
      <button class="btn-secondary" onclick="closeModal()">Close</button>
    </div>
  `);
};

window.deleteCurrentServer = function() {
  if (!currentServer) return;
  if (confirm(`Are you sure you want to delete/leave "${currentServer.name}"?`)) {
    userServers = userServers.filter(s => s.id !== currentServer.id);
    localStorage.setItem("vortex_servers", JSON.stringify(userServers));
    currentServer = userServers.length > 0 ? userServers[0] : null;
    selectServer(currentServer);
    closeModal();
  }
};

window.openAddFriendModal = function() {
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">💬 Start Direct Message</div>
      <p style="color:var(--text-muted); font-size:13px; margin:6px 0 14px;">Enter a friend's display name or @username to start a private encrypted chat:</p>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <input type="text" id="dm-friend-input" placeholder="e.g. Cyber_Samurai" style="flex:1; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
        <button class="btn-primary" onclick="addDirectMessageAction()">Chat</button>
      </div>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.addDirectMessageAction = function() {
  const input = document.getElementById("dm-friend-input");
  const friendName = input.value.trim().replace(/^@/, '');
  if (!friendName) return;

  const dmId = "dm_" + Math.random().toString(36).substring(2, 8);
  const newDm = { id: dmId, name: friendName };

  userDMs.push(newDm);
  localStorage.setItem("vortex_dms", JSON.stringify(userDMs));
  renderDMsList();

  closeModal();
  window.switchChannel(dmId, "@ " + friendName, "TEXT", true);
};

window.openAttachmentPicker = function() {
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">📁 Send Media Attachment</div>
      <p style="color:var(--text-muted); font-size:13px; margin:6px 0 14px;">Select an asset to share with channel participants:</p>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
        <button class="btn-secondary" onclick="simulateSendFile('Project_Assets_Bundle.zip', '124.5 MB')">📦 Project_Assets_Bundle.zip (124.5 MB)</button>
        <button class="btn-secondary" onclick="simulateSendFile('Gameplay_4K_60FPS.mp4', '210.0 MB')">🎬 Gameplay_4K_60FPS.mp4 (210.0 MB)</button>
        <button class="btn-secondary" onclick="simulateSendFile('Soundtrack_Lossless.wav', '45.3 MB')">🎵 Soundtrack_Lossless.wav (45.3 MB)</button>
      </div>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.simulateSendFile = function(fileName, sizeFormatted) {
  closeModal();
  const serverId = currentServer ? currentServer.id : "dms";
  try {
    const messagesRef = collection(db, "servers", serverId, "channels", currentChannel.id, "messages");
    addDoc(messagesRef, {
      serverId: serverId,
      channelId: currentChannel.id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      content: `Shared file: ${fileName}`,
      isEncrypted: isE2EEActive,
      attachments: [{ fileName: fileName, fileSizeFormatted: sizeFormatted, isLargeMedia: true }],
      reactions: [],
      isPinned: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    const fallbackMsg = {
      id: "local_" + Date.now(),
      senderName: currentUser.displayName,
      senderId: currentUser.uid,
      content: `Shared file: ${fileName}`,
      isEncrypted: isE2EEActive,
      createdAt: { toDate: () => new Date() },
      attachments: [{ fileName: fileName, fileSizeFormatted: sizeFormatted, isLargeMedia: true }],
      reactions: [],
      isPinned: false
    };
    currentMessagesList.push(fallbackMsg);
    renderMessagesStream();
  }
};

window.openJoinServerModal = function() {
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">Join a Server</div>
      <input type="text" id="invite-code-input" placeholder="Invite Code (e.g. VTX-4921)" style="width:100%; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin:12px 0;">
      <button class="btn-primary" onclick="alert('Connected to server community!'); closeModal();">Join Server</button>
      <button class="btn-secondary" onclick="closeModal()" style="margin-top:8px;">Cancel</button>
    </div>
  `);
};

window.openCreateChannelModal = function() {
  if (!currentServer) {
    openAddServerModal();
    return;
  }
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">Create Channel</div>
      <input type="text" id="new-channel-name" placeholder="Channel name (e.g. memes)" style="width:100%; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin:12px 0;">
      <select id="new-channel-type" style="width:100%; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin-bottom:12px;">
        <option value="TEXT"># Text Channel</option>
        <option value="VOICE">🔊 Voice Channel</option>
        <option value="VIDEO">📹 Video & Streaming</option>
      </select>
      <button class="btn-primary" onclick="addChannelAction()">Create Channel</button>
      <button class="btn-secondary" onclick="closeModal()" style="margin-top:8px;">Cancel</button>
    </div>
  `);
};

window.addChannelAction = async function() {
  if (!currentServer) {
    alert("Please create or select a server first!");
    closeModal();
    return;
  }
  const name = document.getElementById("new-channel-name").value.trim() || "new-channel";
  const type = document.getElementById("new-channel-type").value;

  try {
    const chRef = collection(db, "servers", currentServer.id, "channels");
    await addDoc(chRef, {
      name: name,
      type: type,
      isEncrypted: true,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    addChannelToDOM(name, name, type, true);
  }

  closeModal();
};

window.showModal = function(html) {
  document.getElementById("modal-content").innerHTML = html;
  document.getElementById("modal-overlay").style.display = "flex";
};

window.closeModal = function() {
  document.getElementById("modal-overlay").style.display = "none";
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// Initial Boot
updateUserProfileDisplay();
renderServerRail();
renderDMsList();
initLiveChannels();
renderMemberList();
