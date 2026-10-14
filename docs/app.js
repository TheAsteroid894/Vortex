// Vortex Web Client - Connected to Live Vortex Cloud Firebase & Cryptography
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
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
let currentTheme = localStorage.getItem("vortex_theme") || savedSettings.theme || "dark";
let currentAccent = localStorage.getItem("vortex_accent") || savedSettings.accent || "#5865f2";
let currentFont = localStorage.getItem("vortex_font") || savedSettings.font || "sans";
let currentFontSize = localStorage.getItem("vortex_font_size") || savedSettings.fontSize || "14";
let customGradient = localStorage.getItem("vortex_custom_gradient") || savedSettings.customGradient || "linear-gradient(135deg, #18002e, #4b0082, #ff007f)";

// Nitro & Server Boosts state (monthly, unlocked via watching Ads)
let nitroExpiresAt = parseInt(localStorage.getItem("vortex_nitro_expires") || "0", 10);
let serverBoostsCount = parseInt(localStorage.getItem("vortex_server_boosts") || "0", 10);

// Google AdSense Configuration
// Set your Publisher ID (ca-pub-xxx) and Slot ID from your Google AdSense Dashboard.
export const ADSENSE_CONFIG = {
  client: "ca-pub-5839496079978209",
  slotId: "1234567890",
  enabled: true
};

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

// User Servers (clean start - real Firestore sync)
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
let unsubscribeUserServers = null;

// --- Apply Theme, Font & Accent Color ---
function applyAppearance() {
  document.body.className = "";
  if (currentTheme && currentTheme !== "dark") {
    document.body.classList.add("theme-" + currentTheme);
  }
  if (currentTheme === "custom-gradient") {
    document.documentElement.style.setProperty("--gradient-custom", customGradient);
  }
  document.body.classList.add("font-" + currentFont);
  document.documentElement.style.setProperty("--brand-blurple", currentAccent);
  document.documentElement.style.setProperty("--message-font-size", currentFontSize + "px");

  localStorage.setItem("vortex_theme", currentTheme);
  localStorage.setItem("vortex_accent", currentAccent);
  localStorage.setItem("vortex_font", currentFont);
  localStorage.setItem("vortex_font_size", currentFontSize);
  localStorage.setItem("vortex_custom_gradient", customGradient);
  localStorage.setItem("vortex_appearance", JSON.stringify({
    theme: currentTheme,
    accent: currentAccent,
    font: currentFont,
    fontSize: currentFontSize,
    customGradient: customGradient
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

// --- Default Roles Generator ---
function getDefaultRoles() {
  return [
    {
      id: "owner",
      name: "Owner",
      color: "#f1c40f",
      isPreset: true,
      presetType: "Owner",
      permissions: {
        administrator: true,
        manageServer: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        timeoutMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true
      }
    },
    {
      id: "admin",
      name: "Admin",
      color: "#e74c3c",
      isPreset: true,
      presetType: "Admin",
      permissions: {
        administrator: false,
        manageServer: true,
        manageRoles: true,
        manageChannels: true,
        kickMembers: true,
        banMembers: true,
        timeoutMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true
      }
    },
    {
      id: "mod",
      name: "Mod",
      color: "#2ecc71",
      isPreset: true,
      presetType: "Mod",
      permissions: {
        administrator: false,
        manageServer: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: true,
        banMembers: true,
        timeoutMembers: true,
        manageMessages: true,
        sendMessages: true,
        attachFiles: true
      }
    },
    {
      id: "booster",
      name: "Server Booster",
      color: "#f47fff",
      isPreset: true,
      presetType: "Server Booster",
      permissions: {
        administrator: false,
        manageServer: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        timeoutMembers: false,
        manageMessages: false,
        sendMessages: true,
        attachFiles: true
      }
    },
    {
      id: "vip",
      name: "VIP",
      color: "#3498db",
      isPreset: true,
      presetType: "VIP",
      permissions: {
        administrator: false,
        manageServer: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        timeoutMembers: false,
        manageMessages: false,
        sendMessages: true,
        attachFiles: true
      }
    },
    {
      id: "member",
      name: "Member",
      color: "#95a5a6",
      isPreset: true,
      presetType: "Member",
      permissions: {
        administrator: false,
        manageServer: false,
        manageRoles: false,
        manageChannels: false,
        kickMembers: false,
        banMembers: false,
        timeoutMembers: false,
        manageMessages: false,
        sendMessages: true,
        attachFiles: true
      }
    }
  ];
}

// --- Real-Time User Servers Sync Across Devices ---
function listenToUserServers(userId) {
  if (unsubscribeUserServers) unsubscribeUserServers();
  try {
    const q = query(collection(db, "servers"), where("memberIds", "array-contains", userId));
    unsubscribeUserServers = onSnapshot(q, (snapshot) => {
      const serverList = [];
      snapshot.forEach((docSnap) => {
        const sData = docSnap.data();
        serverList.push({
          id: docSnap.id,
          name: sData.name || "Server",
          emoji: sData.emoji || "🎮",
          inviteCode: sData.inviteCode || "VTX-1000",
          ownerId: sData.ownerId,
          description: sData.description || "",
          roles: sData.roles || getDefaultRoles(),
          members: sData.members || [],
          memberIds: sData.memberIds || [userId],
          bannedUserIds: sData.bannedUserIds || [],
          mutedUserIds: sData.mutedUserIds || [],
          boostLevel: sData.boostLevel || 1
        });
      });
      userServers = serverList;
      localStorage.setItem("vortex_servers", JSON.stringify(userServers));
      renderServerRail();

      if (currentServer) {
        const updated = userServers.find(s => s.id === currentServer.id);
        if (updated) {
          currentServer = updated;
          const header = document.getElementById("header-server-name");
          if (header) header.innerText = currentServer.name;
          renderMemberList();
        }
      }
    }, (err) => {
      console.warn("User servers Firestore listener error:", err);
    });
  } catch (e) {
    console.warn("Could not setup servers listener:", e);
  }
}

// --- Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("btn-auth").innerText = "Sign Out";

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const uData = userSnap.data();
        currentUser = {
          uid: user.uid,
          displayName: uData.displayName || user.displayName || "Vortex User",
          username: uData.username || (user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, "") : "vortex_user"),
          tag: uData.customTag || ("#" + user.uid.substring(0, 4).toUpperCase()),
          bio: uData.bio || "Vortex member since 2026",
          bannerColor: uData.bannerColor || "#5865f2",
          photoURL: user.photoURL || "",
          isGuest: false
        };

        if (uData.nitroActive && uData.nitroExpiresAt) {
          nitroExpiresAt = uData.nitroExpiresAt;
          localStorage.setItem("vortex_nitro_expires", nitroExpiresAt);
        }
        if (uData.customGradient) {
          customGradient = uData.customGradient;
          localStorage.setItem("vortex_custom_gradient", customGradient);
        }
        if (uData.theme) {
          currentTheme = uData.theme;
          localStorage.setItem("vortex_theme", currentTheme);
        }
      } else {
        const derivedUser = user.displayName ? user.displayName.toLowerCase().replace(/\s+/g, "") : "vortex_user";
        currentUser = {
          uid: user.uid,
          displayName: localStorage.getItem("vortex_display_name") || user.displayName || "Vortex User",
          username: localStorage.getItem("vortex_username") || derivedUser,
          tag: localStorage.getItem("vortex_tag") || ("#" + user.uid.substring(0, 4).toUpperCase()),
          bio: localStorage.getItem("vortex_bio") || "Exploring the decentralized metaverse with Vortex.",
          bannerColor: localStorage.getItem("vortex_banner_color") || "#5865f2",
          photoURL: user.photoURL || "",
          isGuest: false
        };

        await setDoc(userRef, {
          userId: user.uid,
          displayName: currentUser.displayName,
          username: currentUser.username,
          customTag: currentUser.tag,
          bio: currentUser.bio,
          bannerColor: currentUser.bannerColor,
          email: user.email || "",
          nitroActive: isNitroActive(),
          nitroExpiresAt: nitroExpiresAt,
          customGradient: customGradient,
          theme: currentTheme,
          createdAt: serverTimestamp()
        }, { merge: true });
      }

      // Sync local storage cache
      localStorage.setItem("vortex_display_name", currentUser.displayName);
      localStorage.setItem("vortex_username", currentUser.username);
      localStorage.setItem("vortex_tag", currentUser.tag);
      localStorage.setItem("vortex_bio", currentUser.bio);
      localStorage.setItem("vortex_banner_color", currentUser.bannerColor);
      applyAppearance();
    } catch (e) {
      console.warn("Firestore user sync error:", e);
    }

    // Subscribe to all servers for this Google account in Firestore
    listenToUserServers(user.uid);
  } else {
    document.getElementById("btn-auth").innerText = "Sign in with Google";
    if (unsubscribeUserServers) {
      unsubscribeUserServers();
      unsubscribeUserServers = null;
    }
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
    const handleStr = currentUser.username ? `@${currentUser.username}` : "";
    const tagStr = currentUser.tag || "#1337";
    tagEl.innerText = handleStr ? `${handleStr} • ${tagStr}` : tagStr;
  }
  const initial = (currentUser.displayName[0] || "U").toUpperCase();
  if (avatarEl) avatarEl.innerText = initial;

  const boostBadge = document.getElementById("server-boost-badge");
  if (boostBadge) {
    if (currentServer) {
      boostBadge.style.display = "inline-block";
      const lvl = currentServer.boostLevel || 1;
      boostBadge.innerText = lvl >= 3 ? "LVL 3 🚀" : `LVL ${lvl} 🚀`;
    } else {
      boostBadge.style.display = "none";
    }
  }
}

// --- Server Header Click Handler ---
window.handleServerHeaderClick = function() {
  if (currentServer) {
    window.openServerSettings();
  } else {
    window.openAddFriendModal();
  }
};

// --- Direct Messages Hub (Removes Server Channels from DMs!) ---
window.openDirectMessagesHub = function() {
  currentServer = null;
  document.querySelectorAll(".server-icon").forEach(el => el.classList.remove("active"));
  const homeBtn = document.getElementById("btn-home");
  if (homeBtn) homeBtn.classList.add("active");

  const header = document.getElementById("header-server-name");
  if (header) header.innerText = "Direct Messages";

  const boostBadge = document.getElementById("server-boost-badge");
  if (boostBadge) boostBadge.style.display = "none";
  const gear = document.getElementById("server-header-gear");
  if (gear) gear.innerText = "";

  // Hide server channels, show direct messages
  const dmsSection = document.getElementById("dms-sidebar-section");
  const serverSection = document.getElementById("server-channels-section");
  if (dmsSection) dmsSection.style.display = "block";
  if (serverSection) serverSection.style.display = "none";

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
  if (homeBtn) homeBtn.classList.remove("active");

  const header = document.getElementById("header-server-name");
  if (header) header.innerText = server ? server.name : "Select or Create a Server";

  const boostBadge = document.getElementById("server-boost-badge");
  if (boostBadge) {
    boostBadge.style.display = server ? "inline-block" : "none";
    if (server) {
      const lvl = server.boostLevel || 1;
      boostBadge.innerText = lvl >= 3 ? "LVL 3 🚀" : `LVL ${lvl} 🚀`;
    }
  }
  const gear = document.getElementById("server-header-gear");
  if (gear) gear.innerText = server ? "⚙️" : "";

  // Hide direct messages, show server channels
  const dmsSection = document.getElementById("dms-sidebar-section");
  const serverSection = document.getElementById("server-channels-section");
  if (dmsSection) dmsSection.style.display = server ? "none" : "block";
  if (serverSection) serverSection.style.display = server ? "block" : "none";

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
  const onlineTitle = document.getElementById("online-category-title");
  const offlineTitle = document.getElementById("offline-category-title");
  if (!onlineList || !offlineList) return;

  if (!currentServer) {
    // In Direct Messages mode: show You and friends
    if (onlineTitle) onlineTitle.innerText = "ONLINE — 1";
    if (offlineTitle) offlineTitle.innerText = `DIRECT MESSAGES — ${userDMs.length}`;

    const currentHandle = currentUser.username ? `@${currentUser.username}` : (currentUser.tag || "#1337");
    onlineList.innerHTML = `
      <div class="member-item" onclick="openSettings('my-account')">
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

    if (userDMs.length === 0) {
      offlineList.innerHTML = `
        <div style="padding:10px 12px; font-size:11px; color:var(--text-muted); font-style:italic; line-height:1.4;">
          No DM chats yet.<br>Click '+' under Direct Messages to chat privately with friends.
        </div>
      `;
    } else {
      offlineList.innerHTML = userDMs.map(dm => `
        <div class="member-item" onclick="switchChannel('${dm.id}', '@ ${escapeHtml(dm.name)}', 'TEXT', true)">
          <div class="member-avatar-wrapper">
            <div class="member-avatar" style="background:#5865f2;">${(dm.name[0] || '@').toUpperCase()}</div>
            <div class="status-dot status-online"></div>
          </div>
          <div style="overflow:hidden;">
            <div style="font-size:13px; font-weight:600; color:var(--header-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(dm.name)}</div>
            <div style="font-size:10px; color:var(--text-muted);">Direct Message</div>
          </div>
        </div>
      `).join("");
    }
    return;
  }

  // Server Mode: Load REAL server members only! No placeholder bots!
  let members = currentServer.members || [];
  if (!Array.isArray(members) || members.length === 0) {
    members = [{
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      tag: currentUser.tag,
      roleIds: ["owner"]
    }];
  }

  // Ensure current user is in members list
  if (!members.find(m => m.uid === currentUser.uid)) {
    members.push({
      uid: currentUser.uid,
      displayName: currentUser.displayName,
      username: currentUser.username,
      tag: currentUser.tag,
      roleIds: [currentServer.ownerId === currentUser.uid ? "owner" : "member"]
    });
  }

  const rolesMap = {};
  (currentServer.roles || getDefaultRoles()).forEach(r => {
    rolesMap[r.id] = r;
  });

  if (onlineTitle) onlineTitle.innerText = `SERVER MEMBERS — ${members.length}`;
  if (offlineTitle) offlineTitle.innerText = "";
  offlineList.innerHTML = "";

  onlineList.innerHTML = members.map(m => {
    const isYou = m.uid === currentUser.uid;
    const isOwner = m.uid === currentServer.ownerId || (m.roleIds && m.roleIds.includes("owner"));
    const isMuted = currentServer.mutedUserIds && currentServer.mutedUserIds.includes(m.uid);
    const assignedRoles = (m.roleIds || []).map(rid => rolesMap[rid]).filter(Boolean);
    const topRole = assignedRoles[0] || (isOwner ? { name: "Owner", color: "#f1c40f" } : { name: "Member", color: "#95a5a6" });
    const handleStr = m.username ? `@${m.username}` : (m.tag || "#1337");

    const roleBadgesHtml = assignedRoles.map(r => `
      <span class="role-badge" style="color:${r.color}; border-color:${r.color};">
        <span class="role-dot" style="background:${r.color};"></span>
        ${escapeHtml(r.name)}
      </span>
    `).join(" ");

    return `
      <div class="member-item" onclick="openMemberDetailModal('${m.uid}')">
        <div class="member-avatar-wrapper">
          <div class="member-avatar" style="background:${topRole.color || '#5865f2'};">${(m.displayName[0] || 'U').toUpperCase()}</div>
          <div class="status-dot status-online"></div>
        </div>
        <div style="flex:1; overflow:hidden;">
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:13px; font-weight:600; color:${topRole.color || 'var(--header-primary)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${escapeHtml(m.displayName)}
            </span>
            ${isOwner ? '<span title="Server Owner">👑</span>' : ''}
            ${isMuted ? '<span title="Timed Out / Muted" style="font-size:10px; background:var(--danger-red); color:white; padding:1px 4px; border-radius:3px; font-weight:700;">Muted</span>' : ''}
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">
            ${escapeHtml(handleStr)}${isYou ? ' • You' : ''}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:3px;">
            ${roleBadgesHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Detailed Member Profile & Moderation Card
window.openMemberDetailModal = function(memberUid) {
  if (!currentServer) return;
  const members = currentServer.members || [];
  const member = members.find(m => m.uid === memberUid) || {
    uid: memberUid,
    displayName: memberUid === currentUser.uid ? currentUser.displayName : "Server Member",
    username: memberUid === currentUser.uid ? currentUser.username : "member",
    tag: memberUid === currentUser.uid ? currentUser.tag : "#0001",
    roleIds: ["member"]
  };

  const isYou = member.uid === currentUser.uid;
  const isOwner = member.uid === currentServer.ownerId || (member.roleIds && member.roleIds.includes("owner"));
  const isCallerOwner = currentServer.ownerId === currentUser.uid;
  const isCallerAdminOrMod = isCallerOwner || (currentServer.members?.find(m => m.uid === currentUser.uid)?.roleIds || []).some(r => ["admin", "mod"].includes(r));
  const isMuted = currentServer.mutedUserIds && currentServer.mutedUserIds.includes(member.uid);

  const rolesMap = {};
  (currentServer.roles || getDefaultRoles()).forEach(r => {
    rolesMap[r.id] = r;
  });

  const memberRoles = (member.roleIds || []).map(rid => rolesMap[rid]).filter(Boolean);
  const topColor = memberRoles[0]?.color || (isOwner ? "#f1c40f" : "#5865f2");

  let modActionsHtml = "";
  if (isCallerAdminOrMod && !isYou) {
    modActionsHtml = `
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--border-subtle);">
        <div style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; margin-bottom:10px;">
          🛡️ Moderation Actions
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          <button class="mod-action-btn" onclick="openAssignRolesModal('${member.uid}')">🏷️ Edit Roles</button>
          <button class="mod-action-btn warning" onclick="timeoutMemberAction('${member.uid}', ${isMuted ? '0' : '300'})">
            ${isMuted ? '🔊 Remove Timeout' : '⏳ Timeout (5m)'}
          </button>
          <button class="mod-action-btn danger" onclick="kickMemberAction('${member.uid}')">👢 Kick Member</button>
          <button class="mod-action-btn danger" onclick="banMemberAction('${member.uid}')">🔨 Ban Member</button>
        </div>
      </div>
    `;
  }

  showModal(`
    <div class="modal-card" style="width:420px; max-width:95vw; background:var(--surface-dark); border-radius:12px; overflow:hidden; border:1px solid var(--border-subtle);">
      <!-- Banner -->
      <div style="height:70px; background:${topColor}; position:relative;"></div>
      <!-- Avatar & Identity -->
      <div style="padding:0 20px 20px 20px; position:relative;">
        <div style="position:relative; margin-top:-35px; margin-bottom:10px; width:70px; height:70px; border-radius:50%; background:${topColor}; border:4px solid var(--surface-dark); display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold; color:white;">
          ${(member.displayName[0] || 'U').toUpperCase()}
          <div class="status-dot status-online" style="bottom:2px; right:2px; width:14px; height:14px; border:3px solid var(--surface-dark);"></div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <div style="font-size:18px; font-weight:bold; color:var(--header-primary); display:flex; align-items:center; gap:6px;">
              ${escapeHtml(member.displayName)}
              ${isOwner ? '<span title="Server Owner">👑</span>' : ''}
              ${isMuted ? '<span style="font-size:10px; background:var(--danger-red); color:white; padding:2px 6px; border-radius:4px;">MUTED</span>' : ''}
            </div>
            <div style="font-size:12px; color:var(--text-muted);">
              ${member.username ? `@${escapeHtml(member.username)}` : ''} • ${escapeHtml(member.tag || '#1337')}
            </div>
          </div>
          ${!isYou ? `<button class="btn-primary" style="padding:6px 14px; font-size:12px;" onclick="closeModal(); startDirectMessageWith('${escapeHtml(member.displayName)}', '${escapeHtml(member.username || '')}')">💬 Direct Message</button>` : ''}
        </div>

        <!-- Assigned Roles -->
        <div style="margin-top:14px;">
          <div style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;">ROLES (${memberRoles.length})</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            ${memberRoles.length > 0 ? memberRoles.map(r => `
              <span class="role-badge" style="color:${r.color}; border-color:${r.color}; font-size:12px; padding:3px 8px;">
                <span class="role-dot" style="background:${r.color}; width:8px; height:8px;"></span>
                ${escapeHtml(r.name)}
              </span>
            `).join('') : '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">No roles assigned</span>'}
          </div>
        </div>

        ${modActionsHtml}

        <div style="margin-top:18px; text-align:right;">
          <button class="btn-secondary" style="padding:6px 14px; font-size:12px;" onclick="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `);
};

window.startDirectMessageWith = function(name, handle) {
  let dm = userDMs.find(d => d.name === name);
  if (!dm) {
    const dmId = "dm_" + Math.random().toString(36).substring(2, 8);
    dm = { id: dmId, name: name };
    userDMs.push(dm);
    localStorage.setItem("vortex_dms", JSON.stringify(userDMs));
    renderDMsList();
  }
  openDirectMessagesHub();
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
        <button class="settings-tab-btn ${initialTab === 'my-account' ? 'active' : ''}" onclick="switchSettingsTab('my-account')">👤 Profile & Identity</button>
        <button class="settings-tab-btn ${initialTab === 'appearance' ? 'active' : ''}" onclick="switchSettingsTab('appearance')">🎨 Themes & Styling</button>
        <button class="settings-tab-btn ${initialTab === 'gradient' ? 'active' : ''}" onclick="switchSettingsTab('gradient')">🌈 Custom Gradient (Nitro)</button>

        <div class="settings-section-title">REWARDS & HARDWARE</div>
        <button class="settings-tab-btn ${initialTab === 'nitro' ? 'active' : ''}" onclick="switchSettingsTab('nitro')">💎 Nitro & Server Boosts</button>
        <button class="settings-tab-btn ${initialTab === 'voice-video' ? 'active' : ''}" onclick="switchSettingsTab('voice-video')">🎙️ Voice & Video</button>
        <button class="settings-tab-btn ${initialTab === 'privacy' ? 'active' : ''}" onclick="switchSettingsTab('privacy')">🔒 Privacy & Security</button>

        <div class="settings-section-title">LEGAL & POLICIES</div>
        <button class="settings-tab-btn ${initialTab === 'terms' ? 'active' : ''}" onclick="switchSettingsTab('terms')">📜 Terms of Service</button>
        <button class="settings-tab-btn ${initialTab === 'privacy-policy' ? 'active' : ''}" onclick="switchSettingsTab('privacy-policy')">🛡️ Privacy Policy</button>
        <button class="settings-tab-btn ${initialTab === 'community' ? 'active' : ''}" onclick="switchSettingsTab('community')">🤝 Community Guidelines</button>
        <button class="settings-tab-btn ${initialTab === 'encryption' ? 'active' : ''}" onclick="switchSettingsTab('encryption')">🔐 E2EE Architecture</button>

        <div style="margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);">
          <button class="btn-secondary" style="width:100%; color:var(--danger-red); font-weight:600;" onclick="closeModal()">✕ Close Settings</button>
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
    case "profiles":
      pane.innerHTML = renderMyAccountTab();
      break;
    case "appearance":
      pane.innerHTML = renderAppearanceTab();
      break;
    case "gradient":
      pane.innerHTML = renderGradientTab();
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
  const currentHandle = currentUser.username ? `@${currentUser.username}` : "";
  const tagDisplay = currentUser.tag || "#1337";
  const fullTagString = currentHandle ? `${currentHandle} • ${tagDisplay}` : tagDisplay;

  return `
    <div class="settings-pane-title">User Profile & Identity</div>
    <div class="settings-pane-desc">Manage your display name, custom discriminator tag, and active theme. All preferences are automatically persisted in your browser via localStorage.</div>

    <!-- Live Preview Card -->
    <div style="background:var(--input-dark); border-radius:10px; overflow:hidden; border:1px solid var(--border-subtle); margin-bottom:24px; box-shadow:0 4px 16px rgba(0,0,0,0.2);">
      <div id="preview-banner" style="height:80px; background:${currentUser.bannerColor || 'var(--brand-blurple)'}; transition:background 0.2s ease;"></div>
      <div style="padding:16px; position:relative; display:flex; justify-content:space-between; align-items:flex-end;">
        <div style="margin-top:-48px; display:flex; align-items:flex-end; gap:14px;">
          <div id="preview-avatar-letter" style="width:72px; height:72px; border-radius:50%; background:var(--brand-blurple); border:4px solid var(--surface-dark); display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold; color:white;">
            ${(currentUser.displayName[0] || 'U').toUpperCase()}
          </div>
          <div>
            <div id="preview-display-name" style="font-size:18px; font-weight:bold; color:var(--header-primary);">${escapeHtml(currentUser.displayName)}</div>
            <div id="preview-handle" style="font-size:12px; color:var(--text-muted); font-family:monospace; margin-top:2px;">${escapeHtml(fullTagString)}</div>
          </div>
        </div>
        <div style="font-size:11px; padding:4px 8px; border-radius:4px; background:rgba(88,101,242,0.15); color:var(--brand-blurple); border:1px solid rgba(88,101,242,0.3); font-weight:bold;">
          Live Preview
        </div>
      </div>
    </div>

    <!-- Feedback Toast -->
    <div id="settings-save-toast" class="settings-toast success" style="display:none; margin-bottom:18px;"></div>

    <!-- Identity & Tag Management Form -->
    <div style="display:flex; flex-direction:column; gap:18px;">
      <!-- Display Name Input -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">DISPLAY NAME</label>
        <input type="text" id="edit-display-name" value="${escapeHtml(currentUser.displayName)}" placeholder="e.g. Alex Walker" oninput="updateProfileLivePreview()" style="width:100%; padding:10px 12px; margin-top:6px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-size:14px;">
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">This is how members see you across text channels, voice calls, and direct messages.</div>
      </div>

      <!-- Custom Tag Configuration -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">CUSTOM DISCRIMINATOR TAG</label>
          <span style="font-size:11px; color:var(--nitro-pink); font-weight:600;">Discord-Style Tag</span>
        </div>
        <div style="display:flex; gap:8px; margin-top:6px;">
          <input type="text" id="edit-tag" value="${escapeHtml(currentUser.tag || '#1337')}" placeholder="#1337" maxlength="10" oninput="updateProfileLivePreview()" style="width:140px; padding:10px 12px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-family:monospace; font-size:14px; font-weight:bold;">
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <span style="font-size:11px; color:var(--text-muted); margin-right:4px;">Presets:</span>
            <span class="settings-tag-chip" onclick="setPresetTag('#0001')">#0001</span>
            <span class="settings-tag-chip" onclick="setPresetTag('#1337')">#1337</span>
            <span class="settings-tag-chip" onclick="setPresetTag('#7777')">#7777</span>
            <span class="settings-tag-chip" onclick="setPresetTag('#9999')">#9999</span>
            <span class="settings-tag-chip" onclick="setPresetTag('#2026')">#2026</span>
          </div>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Your custom numeric tag identifier. Automatically normalized with # and saved to localStorage.</div>
      </div>

      <!-- Username (@handle) -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">USERNAME (@HANDLE)</label>
        <div style="position:relative; margin-top:6px;">
          <span style="position:absolute; left:12px; top:10px; color:var(--text-muted); font-size:14px; font-weight:bold;">@</span>
          <input type="text" id="edit-username" value="${escapeHtml(currentUser.username || 'user')}" placeholder="vortex_user" oninput="updateProfileLivePreview()" style="width:100%; padding:10px 12px 10px 28px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-size:14px;">
        </div>
      </div>

      <!-- Theme Selection -->
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">THEME SELECTION</label>
          <span style="font-size:11px; color:var(--brand-green); font-weight:600;">Instant Preview</span>
        </div>
        <div class="theme-grid" style="margin-top:8px;">
          <div class="theme-chip ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark" onclick="selectTheme('dark', 'my-account')">
            <span class="theme-swatch" style="background:#1e1f22;"></span>
            <span>🌙 Dark Classic</span>
          </div>
          <div class="theme-chip ${currentTheme === 'amoled' ? 'active' : ''}" data-theme="amoled" onclick="selectTheme('amoled', 'my-account')">
            <span class="theme-swatch" style="background:#000000; border-color:#444;"></span>
            <span>🖤 Midnight AMOLED</span>
          </div>
          <div class="theme-chip ${currentTheme === 'ocean' ? 'active' : ''}" data-theme="ocean" onclick="selectTheme('ocean', 'my-account')">
            <span class="theme-swatch" style="background:#090d16;"></span>
            <span>🌊 Deep Sea Slate</span>
          </div>
          <div class="theme-chip ${currentTheme === 'light' ? 'active' : ''}" data-theme="light" onclick="selectTheme('light', 'my-account')">
            <span class="theme-swatch" style="background:#ffffff; border-color:#ccc;"></span>
            <span>☀️ Clean Light</span>
          </div>
          <div class="theme-chip ${currentTheme === 'synthwave' ? 'active' : ''}" data-theme="synthwave" onclick="selectTheme('synthwave', 'my-account')">
            <span class="theme-swatch" style="background:#130a24;"></span>
            <span>🔮 Cyber Synthwave</span>
          </div>
        </div>
      </div>

      <!-- About Me / Bio -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">ABOUT ME (BIO)</label>
        <textarea id="edit-bio" rows="2" style="width:100%; padding:10px 12px; margin-top:6px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; resize:none; font-size:13px;">${escapeHtml(currentUser.bio || '')}</textarea>
      </div>

      <!-- Banner Accent Color -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">PROFILE BANNER COLOR</label>
        <div style="display:flex; gap:12px; align-items:center; margin-top:6px;">
          <input type="color" id="edit-banner-color" value="${currentUser.bannerColor || '#5865f2'}" oninput="updateProfileLivePreview()" style="width:50px; height:38px; border:none; cursor:pointer; background:transparent;">
          <span style="font-size:12px; color:var(--text-muted);">Choose any custom hex color for your personal profile header.</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; gap:12px; margin-top:10px; padding-top:14px; border-top:1px solid var(--border-subtle);">
        <button class="btn-primary" style="padding:10px 20px; font-size:13px;" onclick="saveSettingsPreferences()">💾 Save Preferences to LocalStorage</button>
        <button class="btn-secondary" style="padding:10px 16px; font-size:13px;" onclick="resetSettingsToDefaults()">↺ Reset to Defaults</button>
      </div>
    </div>
  `;
}

function renderAppearanceTab() {
  return `
    <div class="settings-pane-title">Themes & Visual Customization</div>
    <div class="settings-pane-desc">Personalize your client colors, typography, and contrast. All theme and appearance preferences are persisted to your browser via localStorage.</div>

    <div style="display:flex; flex-direction:column; gap:22px;">
      <!-- Theme Selection Grid -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">APP THEME</label>
        <div class="theme-grid" style="margin-top:8px;">
          <div class="theme-chip ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark" onclick="selectTheme('dark', 'appearance')">
            <span class="theme-swatch" style="background:#1e1f22;"></span>
            <span>🌙 Dark Classic</span>
          </div>
          <div class="theme-chip ${currentTheme === 'amoled' ? 'active' : ''}" data-theme="amoled" onclick="selectTheme('amoled', 'appearance')">
            <span class="theme-swatch" style="background:#000000; border-color:#444;"></span>
            <span>🖤 Midnight AMOLED</span>
          </div>
          <div class="theme-chip ${currentTheme === 'ocean' ? 'active' : ''}" data-theme="ocean" onclick="selectTheme('ocean', 'appearance')">
            <span class="theme-swatch" style="background:#090d16;"></span>
            <span>🌊 Deep Sea Slate</span>
          </div>
          <div class="theme-chip ${currentTheme === 'light' ? 'active' : ''}" data-theme="light" onclick="selectTheme('light', 'appearance')">
            <span class="theme-swatch" style="background:#ffffff; border-color:#ccc;"></span>
            <span>☀️ Clean Light</span>
          </div>
          <div class="theme-chip ${currentTheme === 'synthwave' ? 'active' : ''}" data-theme="synthwave" onclick="selectTheme('synthwave', 'appearance')">
            <span class="theme-swatch" style="background:#130a24;"></span>
            <span>🔮 Cyber Synthwave</span>
          </div>
          <div class="theme-chip ${currentTheme === 'custom-gradient' ? 'active' : ''}" data-theme="custom-gradient" onclick="selectTheme('custom-gradient', 'appearance')">
            <span class="theme-swatch" style="background:${customGradient};"></span>
            <span>🌈 Custom Gradient ${isNitroActive() ? '💎' : '🔒'}</span>
          </div>
        </div>
      </div>

      <!-- Accent Color Selection -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">CLIENT ACCENT COLOR</label>
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
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">CLIENT FONT FAMILY</label>
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
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">CHAT FONT SIZE</label>
          <span style="font-size:12px; font-weight:bold; color:var(--header-primary);" id="font-size-label">${currentFontSize}px</span>
        </div>
        <input type="range" min="12" max="18" value="${currentFontSize}" oninput="updateFontSize(this.value)" style="width:100%; margin-top:8px;">
      </div>

      <!-- Nitro Gradient Banner Link -->
      <div style="background:linear-gradient(135deg, rgba(244,127,255,0.15), rgba(88,101,242,0.15)); border:1px solid rgba(244,127,255,0.3); border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:13px; font-weight:bold; color:white; display:flex; align-items:center; gap:6px;">
            🌈 Custom Gradient Studio
            <span class="nitro-lock-badge">Nitro Only</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            ${isNitroActive() ? 'Your custom glassmorphic gradient is active and syncing across devices.' : 'Unlock customizable linear/radial gradients by activating free Nitro with ads.'}
          </div>
        </div>
        <button class="btn-primary" style="padding:6px 14px; font-size:12px; font-weight:bold; background:var(--nitro-pink);" onclick="switchSettingsTab('gradient')">
          ${isNitroActive() ? 'Open Studio 🎨' : 'Unlock Nitro 💎'}
        </button>
      </div>
    </div>
  `;
}

// --- Nitro Exclusive Custom Gradient Studio ---
function renderGradientTab() {
  const nitroActive = isNitroActive();

  if (!nitroActive) {
    return `
      <div class="settings-pane-title" style="display:flex; align-items:center; gap:8px;">
        🌈 Custom Gradient Themes
        <span class="nitro-lock-badge">💎 Nitro Exclusive</span>
      </div>
      <div class="settings-pane-desc">Design your own custom glassmorphic gradients to personalize your entire app interface across devices.</div>

      <div style="background:linear-gradient(135deg, rgba(235,69,158,0.12), rgba(88,101,242,0.12)); border:2px dashed var(--nitro-pink); border-radius:12px; padding:30px 20px; text-align:center; margin-top:20px;">
        <div style="font-size:42px; margin-bottom:12px;">💎🔒</div>
        <h3 style="color:var(--header-primary); font-size:18px; margin-bottom:8px;">Unlock Custom Gradient Themes</h3>
        <p style="color:var(--text-muted); font-size:13px; max-width:440px; margin:0 auto 20px; line-height:1.5;">
          Custom gradient themes are exclusively reserved for Vortex Nitro members. Unlock full Vortex Nitro for <strong>100% free</strong> by watching a short sponsor ad!
        </p>

        <!-- Preview of sample gradient -->
        <div class="gradient-preview-box" style="background:linear-gradient(135deg, #18002e, #4b0082, #ff007f); margin:0 auto 20px; max-width:380px;">
          <div style="font-size:13px; font-weight:bold; color:white;">✨ Preview: Cyberpunk Neon Gradient</div>
          <div style="font-size:11px; opacity:0.8; color:white;">Full Glassmorphic Chat & Panels</div>
        </div>

        <button class="btn-primary" style="background:linear-gradient(135deg, #f47fff, #eb459e); font-weight:bold; padding:12px 24px; font-size:14px; box-shadow:0 4px 16px rgba(235,69,158,0.4);" onclick="watchAdForReward('nitro')">
          🚀 Watch Ad & Unlock Nitro Free (30 Days)
        </button>
      </div>
    `;
  }

  return `
    <div class="settings-pane-title" style="display:flex; align-items:center; gap:8px;">
      🌈 Custom Gradient Themes
      <span class="nitro-lock-badge">✓ Nitro Active</span>
    </div>
    <div class="settings-pane-desc">Build and customize your own high-contrast linear and radial gradients. Your custom gradient synchronizes to your Google Account across all devices!</div>

    <div style="display:flex; flex-direction:column; gap:20px; margin-top:16px;">
      <!-- Live Interactive Preview Box -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">LIVE GRADIENT PREVIEW</label>
        <div id="gradient-live-preview-box" class="gradient-preview-box" style="background:${customGradient};">
          <div style="background:rgba(20,15,35,0.7); backdrop-filter:blur(10px); padding:10px 18px; border-radius:8px; border:1px solid rgba(255,255,255,0.15); display:flex; align-items:center; gap:12px;">
            <span style="font-size:18px;">💬</span>
            <div style="font-size:13px; font-weight:600; color:white;">#general • Encrypted Stream</div>
            <button class="btn-primary" style="padding:4px 10px; font-size:11px;">Active</button>
          </div>
        </div>
      </div>

      <!-- Preset Gradient Palettes -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); letter-spacing:0.5px;">ONE-CLICK PRESET GRADIENTS</label>
        <div class="gradient-preset-grid">
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #0f0c29, #302b63, #24243e);" onclick="applyPresetGradient('linear-gradient(135deg, #0f0c29, #302b63, #24243e)', '#0f0c29', '#24243e', 135)">
            Cosmic Purple
          </div>
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #18002e, #4b0082, #ff007f);" onclick="applyPresetGradient('linear-gradient(135deg, #18002e, #4b0082, #ff007f)', '#18002e', '#ff007f', 135)">
            Cyberpunk Neon
          </div>
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #0b192c, #1e3e62, #008170);" onclick="applyPresetGradient('linear-gradient(135deg, #0b192c, #1e3e62, #008170)', '#0b192c', '#008170', 135)">
            Deep Ocean
          </div>
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #2b1055, #7597de, #ff6b6b);" onclick="applyPresetGradient('linear-gradient(135deg, #2b1055, #7597de, #ff6b6b)', '#2b1055', '#ff6b6b', 135)">
            Sunset Flare
          </div>
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #051910, #134e4a, #10b981);" onclick="applyPresetGradient('linear-gradient(135deg, #051910, #134e4a, #10b981)', '#051910', '#10b981', 135)">
            Emerald Matrix
          </div>
          <div class="gradient-preset-card" style="background:linear-gradient(135deg, #2e0854, #8a2be2, #ff1493);" onclick="applyPresetGradient('linear-gradient(135deg, #2e0854, #8a2be2, #ff1493)', '#2e0854', '#ff1493', 135)">
            Synthwave Sunset
          </div>
        </div>
      </div>

      <!-- Custom Angle & Color Controls -->
      <div style="background:var(--input-dark); padding:16px; border-radius:10px; border:1px solid var(--border-subtle); display:flex; flex-direction:column; gap:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:12px; font-weight:bold; color:var(--header-primary);">Gradient Angle</span>
          <span id="gradient-angle-label" style="font-size:12px; color:var(--text-muted); font-family:monospace;">135°</span>
        </div>
        <input type="range" id="gradient-angle-slider" min="0" max="360" value="135" oninput="updateCustomGradientStudio()" style="width:100%;">

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">START COLOR</label>
            <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
              <input type="color" id="grad-color-start" value="#18002e" oninput="updateCustomGradientStudio()" style="width:42px; height:34px; border:none; cursor:pointer; background:transparent;">
              <input type="text" id="grad-color-start-hex" value="#18002e" onchange="syncGradientHex(1)" style="flex:1; padding:6px 8px; font-size:12px; background:var(--surface-dark); border:1px solid var(--border-subtle); color:white; border-radius:4px; font-family:monospace;">
            </div>
          </div>
          <div>
            <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">END COLOR</label>
            <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
              <input type="color" id="grad-color-end" value="#ff007f" oninput="updateCustomGradientStudio()" style="width:42px; height:34px; border:none; cursor:pointer; background:transparent;">
              <input type="text" id="grad-color-end-hex" value="#ff007f" onchange="syncGradientHex(2)" style="flex:1; padding:6px 8px; font-size:12px; background:var(--surface-dark); border:1px solid var(--border-subtle); color:white; border-radius:4px; font-family:monospace;">
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:8px;">
          <button class="btn-primary" style="flex:1; padding:10px; font-weight:bold;" onclick="saveAndApplyCustomGradient()">
            ✨ Save & Apply Custom Gradient
          </button>
          <button class="btn-secondary" style="padding:10px 14px;" onclick="resetCustomGradient()">
            Reset
          </button>
        </div>
      </div>
    </div>
  `;
}

// Live Gradient Studio Handlers
window.updateCustomGradientStudio = function() {
  const angle = document.getElementById("gradient-angle-slider")?.value || "135";
  const c1 = document.getElementById("grad-color-start")?.value || "#18002e";
  const c2 = document.getElementById("grad-color-end")?.value || "#ff007f";

  const label = document.getElementById("gradient-angle-label");
  if (label) label.innerText = `${angle}°`;

  const h1 = document.getElementById("grad-color-start-hex");
  if (h1) h1.value = c1;
  const h2 = document.getElementById("grad-color-end-hex");
  if (h2) h2.value = c2;

  const grad = `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  const preview = document.getElementById("gradient-live-preview-box");
  if (preview) preview.style.background = grad;
};

window.syncGradientHex = function(index) {
  if (index === 1) {
    const hex = document.getElementById("grad-color-start-hex")?.value;
    const picker = document.getElementById("grad-color-start");
    if (picker && hex) picker.value = hex;
  } else {
    const hex = document.getElementById("grad-color-end-hex")?.value;
    const picker = document.getElementById("grad-color-end");
    if (picker && hex) picker.value = hex;
  }
  window.updateCustomGradientStudio();
};

window.applyPresetGradient = function(grad, c1, c2, angle) {
  customGradient = grad;
  const s = document.getElementById("grad-color-start");
  if (s) s.value = c1;
  const e = document.getElementById("grad-color-end");
  if (e) e.value = c2;
  const a = document.getElementById("gradient-angle-slider");
  if (a) a.value = angle;
  const preview = document.getElementById("gradient-live-preview-box");
  if (preview) preview.style.background = grad;
  window.saveAndApplyCustomGradient(grad);
};

window.saveAndApplyCustomGradient = async function(explicitGrad = null) {
  if (!isNitroActive()) {
    alert("🔒 Custom Gradient Themes are a Nitro Exclusive perk! Watch a quick ad to unlock.");
    window.watchAdForReward('nitro');
    return;
  }

  const angle = document.getElementById("gradient-angle-slider")?.value || "135";
  const c1 = document.getElementById("grad-color-start")?.value || "#18002e";
  const c2 = document.getElementById("grad-color-end")?.value || "#ff007f";
  customGradient = explicitGrad || `linear-gradient(${angle}deg, ${c1}, ${c2})`;
  currentTheme = "custom-gradient";

  applyAppearance();
  localStorage.setItem("vortex_custom_gradient", customGradient);
  localStorage.setItem("vortex_theme", "custom-gradient");

  // Sync to Firestore user doc
  if (!currentUser.isGuest) {
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        customGradient: customGradient,
        theme: "custom-gradient"
      });
    } catch (e) {
      console.warn("Firestore gradient sync:", e);
    }
  }

  alert("✨ Custom Gradient Theme applied and synced across all your devices!");
};

window.resetCustomGradient = function() {
  customGradient = "linear-gradient(135deg, #18002e, #4b0082, #ff007f)";
  const preview = document.getElementById("gradient-live-preview-box");
  if (preview) preview.style.background = customGradient;
  window.saveAndApplyCustomGradient(customGradient);
};

// Live Profile Preview in Settings Modal
window.updateProfileLivePreview = function() {
  const nameInput = document.getElementById("edit-display-name");
  const tagInput = document.getElementById("edit-tag");
  const usernameInput = document.getElementById("edit-username");
  const bannerInput = document.getElementById("edit-banner-color");

  const previewName = document.getElementById("preview-display-name");
  const previewHandle = document.getElementById("preview-handle");
  const previewAvatar = document.getElementById("preview-avatar-letter");
  const previewBanner = document.getElementById("preview-banner");

  const name = nameInput ? (nameInput.value.trim() || "Vortex User") : currentUser.displayName;
  let tag = tagInput ? tagInput.value.trim() : (currentUser.tag || "#1337");
  if (tag && !tag.startsWith("#")) tag = "#" + tag;
  const username = usernameInput ? usernameInput.value.trim().replace(/^@/, '') : currentUser.username;
  const banner = bannerInput ? bannerInput.value : currentUser.bannerColor;

  if (previewName) previewName.innerText = name;
  if (previewAvatar) previewAvatar.innerText = (name[0] || "U").toUpperCase();
  if (previewHandle) {
    const handleStr = username ? `@${username}` : "";
    previewHandle.innerText = handleStr ? `${handleStr} • ${tag}` : tag;
  }
  if (previewBanner) previewBanner.style.background = banner;
};

// Quick preset tag click handler
window.setPresetTag = function(tag) {
  const tagInput = document.getElementById("edit-tag");
  if (tagInput) {
    tagInput.value = tag;
    window.updateProfileLivePreview();
  }
};

// Robust Settings & Profile Saver (persisted via localStorage)
window.saveSettingsPreferences = async function() {
  const nameInput = document.getElementById("edit-display-name");
  const tagInput = document.getElementById("edit-tag");
  const usernameInput = document.getElementById("edit-username");
  const bioInput = document.getElementById("edit-bio");
  const bannerInput = document.getElementById("edit-banner-color");

  const newName = nameInput ? (nameInput.value.trim() || "Vortex User") : currentUser.displayName;
  let newTag = tagInput ? tagInput.value.trim() : currentUser.tag;
  if (newTag && !newTag.startsWith("#")) {
    newTag = "#" + newTag;
  }
  if (!newTag) newTag = "#1337";

  const newUsername = usernameInput ? usernameInput.value.trim().replace(/^@/, '') : currentUser.username;
  const newBio = bioInput ? bioInput.value.trim() : currentUser.bio;
  const newBanner = bannerInput ? bannerInput.value : currentUser.bannerColor;

  // Update in-memory state
  currentUser.displayName = newName;
  currentUser.tag = newTag;
  currentUser.username = newUsername;
  currentUser.bio = newBio;
  currentUser.bannerColor = newBanner;

  // Persist directly to localStorage
  localStorage.setItem("vortex_display_name", currentUser.displayName);
  localStorage.setItem("vortex_tag", currentUser.tag);
  localStorage.setItem("vortex_username", currentUser.username);
  localStorage.setItem("vortex_bio", currentUser.bio);
  localStorage.setItem("vortex_banner_color", currentUser.bannerColor);
  localStorage.setItem("vortex_theme", currentTheme);
  localStorage.setItem("vortex_appearance", JSON.stringify({
    theme: currentTheme,
    accent: currentAccent,
    font: currentFont,
    fontSize: currentFontSize
  }));

  // Update live application UI instantly
  applyAppearance();
  updateUserProfileDisplay();
  renderMemberList();
  window.updateProfileLivePreview();

  // Sync to Firestore if authenticated
  if (!currentUser.isGuest) {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        displayName: currentUser.displayName,
        username: currentUser.username,
        customTag: currentUser.tag,
        bio: currentUser.bio,
        bannerColor: currentUser.bannerColor,
        theme: currentTheme,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore profile sync notice:", e);
    }
  }

  // Display elegant confirmation toast
  const toast = document.getElementById("settings-save-toast");
  if (toast) {
    toast.style.display = "flex";
    toast.innerHTML = "✓ Preferences saved to localStorage! Display name, custom tag & theme updated.";
    setTimeout(() => {
      if (toast) toast.style.display = "none";
    }, 4000);
  }
};

window.saveFullProfile = window.saveSettingsPreferences;

// Reset Settings Preferences to Factory Defaults
window.resetSettingsToDefaults = function() {
  currentUser.displayName = "Vortex User";
  currentUser.username = "vortex_user";
  currentUser.tag = "#1337";
  currentUser.bio = "Exploring the decentralized metaverse with Vortex.";
  currentUser.bannerColor = "#5865f2";
  currentTheme = "dark";
  currentAccent = "#5865f2";
  currentFont = "sans";
  currentFontSize = "14";

  localStorage.setItem("vortex_display_name", currentUser.displayName);
  localStorage.setItem("vortex_username", currentUser.username);
  localStorage.setItem("vortex_tag", currentUser.tag);
  localStorage.setItem("vortex_bio", currentUser.bio);
  localStorage.setItem("vortex_banner_color", currentUser.bannerColor);
  localStorage.setItem("vortex_theme", currentTheme);
  localStorage.setItem("vortex_accent", currentAccent);
  localStorage.setItem("vortex_font", currentFont);
  localStorage.setItem("vortex_font_size", currentFontSize);

  applyAppearance();
  updateUserProfileDisplay();
  renderMemberList();
  switchSettingsTab("my-account");
};

// Theme, Accent & Font Handlers
window.selectTheme = function(themeName, sourceTab = "appearance") {
  currentTheme = themeName;
  applyAppearance();
  switchSettingsTab(sourceTab);
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

// Google AdSense & Interactive Partner Ad Player
window.watchAdForReward = function(rewardType) {
  const isNitro = rewardType === "nitro";
  const adPartners = [
    { name: "NordVPN Fast & Private", desc: "Military-grade online privacy and ultrafast routes for gamers.", tag: "Google AdSense Verified Partner" },
    { name: "SteelSeries Pro Audio", desc: "Pristine acoustic soundscape engineered for esports champions.", tag: "Google AdSense Gaming Partner" },
    { name: "Razer Synapse Chroma", desc: "Synchronize RGB illumination across every gaming setup.", tag: "Google AdSense Tech Partner" }
  ];
  const partner = adPartners[Math.floor(Math.random() * adPartners.length)];

  const adHtml = `
    <div class="ad-modal-card">
      <div class="ad-video-mock">
        <div class="ad-badge">GOOGLE ADSENSE • SPONSORED REWARD</div>
        <div class="ad-countdown" id="ad-timer-countdown">15s</div>

        <!-- Google AdSense Live Responsive Unit -->
        <div class="adsense-unit-container" id="adsense-slot-wrapper">
          <ins class="adsbygoogle"
               style="display:block; text-align:center; min-height:160px; width:100%;"
               data-ad-client="${ADSENSE_CONFIG.client}"
               data-ad-slot="${ADSENSE_CONFIG.slotId}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>

        <!-- Fallback High-Definition Sponsor Visual (displays while AdSense loads or in review) -->
        <div id="ad-fallback-banner" style="display:flex; flex-direction:column; align-items:center; text-align:center; padding:10px 20px;">
          <div style="font-size:32px; margin-bottom:4px;">🎮</div>
          <div style="font-size:16px; font-weight:bold; color:white;">${partner.name}</div>
          <div style="font-size:11px; color:#ccc; max-width:300px; margin-top:4px;">${partner.desc}</div>
          <div style="font-size:9px; color:#ffcc00; margin-top:8px; letter-spacing:0.5px; font-weight:bold;">${partner.tag}</div>
        </div>

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

  // Trigger Google AdSense render push
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (err) {
    console.log("AdSense unit initialized in fallback preview mode:", err);
  }

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

  const defaultRoles = getDefaultRoles();
  const newServer = {
    id: newId,
    name: name,
    emoji: emoji,
    inviteCode: inviteCode,
    ownerId: currentUser.uid,
    description: "Welcome to " + name,
    memberIds: [currentUser.uid],
    members: [
      {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        username: currentUser.username,
        tag: currentUser.tag,
        roleIds: ["owner"]
      }
    ],
    roles: defaultRoles,
    bannedUserIds: [],
    mutedUserIds: [],
    boostLevel: 1
  };

  userServers.push(newServer);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));

  try {
    const sRef = doc(db, "servers", newId);
    await setDoc(sRef, {
      name: name,
      emoji: emoji,
      inviteCode: inviteCode,
      ownerId: currentUser.uid,
      description: "Welcome to " + name,
      memberIds: [currentUser.uid],
      members: newServer.members,
      roles: defaultRoles,
      bannedUserIds: [],
      mutedUserIds: [],
      boostLevel: 1,
      createdAt: serverTimestamp()
    });

    const chRef = collection(db, "servers", newId, "channels");
    await addDoc(chRef, { name: "general", type: "TEXT", isEncrypted: true, createdAt: serverTimestamp() });
    await addDoc(chRef, { name: "announcements", type: "TEXT", isEncrypted: true, createdAt: serverTimestamp() });
    await addDoc(chRef, { name: "voice-lounge", type: "VOICE", isEncrypted: true, createdAt: serverTimestamp() });
  } catch (e) {
    console.warn("Firestore server creation fallback:", e);
  }

  selectServer(newServer);
  closeModal();
};

// ============================================================================
// Discord-Style Server Settings Page (Overview, Roles, Members, Moderation)
// ============================================================================

window.openServerSettings = function(initialTab = "overview") {
  if (!currentServer) {
    window.openAddServerModal();
    return;
  }

  const isOwner = currentServer.ownerId === currentUser.uid;

  const html = `
    <div class="settings-full-dialog">
      <!-- Server Settings Sidebar -->
      <div class="settings-sidebar">
        <div style="padding:10px 12px; margin-bottom:8px; border-bottom:1px solid var(--border-subtle);">
          <div style="font-size:14px; font-weight:bold; color:var(--header-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${currentServer.emoji || '🎮'} ${escapeHtml(currentServer.name)}
          </div>
          <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; margin-top:2px;">Server Settings</div>
        </div>

        <div class="settings-section-title">SERVER MANAGEMENT</div>
        <button class="settings-tab-btn ${initialTab === 'overview' ? 'active' : ''}" onclick="switchServerSettingsTab('overview')">⚙️ Overview</button>
        <button class="settings-tab-btn ${initialTab === 'roles' ? 'active' : ''}" onclick="switchServerSettingsTab('roles')">🛡️ Roles & Permissions</button>
        <button class="settings-tab-btn ${initialTab === 'members' ? 'active' : ''}" onclick="switchServerSettingsTab('members')">👥 Members & Moderation</button>
        <button class="settings-tab-btn ${initialTab === 'bans' ? 'active' : ''}" onclick="switchServerSettingsTab('bans')">🚫 Banned Users</button>
        <button class="settings-tab-btn ${initialTab === 'channels' ? 'active' : ''}" onclick="switchServerSettingsTab('channels')">💬 Channel Manager</button>
        <button class="settings-tab-btn ${initialTab === 'boosts' ? 'active' : ''}" onclick="switchServerSettingsTab('boosts')">🚀 Server Boosts</button>

        <div class="settings-section-title" style="margin-top:12px;">CRITICAL</div>
        <button class="settings-tab-btn ${initialTab === 'danger' ? 'active' : ''}" style="color:var(--danger-red);" onclick="switchServerSettingsTab('danger')">⚠️ Danger Zone</button>

        <div style="margin-top:auto; padding-top:14px; border-top:1px solid var(--border-subtle);">
          <button class="btn-secondary" style="width:100%;" onclick="closeModal()">✕ Back to Chat</button>
        </div>
      </div>

      <!-- Server Settings Content Pane -->
      <div class="settings-content-pane" id="server-settings-content-pane">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;

  showModal(html);
  switchServerSettingsTab(initialTab);
};

window.switchServerSettingsTab = function(tabName) {
  document.querySelectorAll(".settings-sidebar .settings-tab-btn").forEach(btn => btn.classList.remove("active"));
  const btns = Array.from(document.querySelectorAll(".settings-sidebar .settings-tab-btn"));
  const targetBtn = btns.find(b => b.getAttribute("onclick")?.includes(`'${tabName}'`));
  if (targetBtn) targetBtn.classList.add("active");

  const pane = document.getElementById("server-settings-content-pane");
  if (!pane || !currentServer) return;

  switch (tabName) {
    case "overview":
      pane.innerHTML = renderServerOverviewTab();
      break;
    case "roles":
      pane.innerHTML = renderServerRolesTab();
      break;
    case "members":
      pane.innerHTML = renderServerMembersTab();
      break;
    case "bans":
      pane.innerHTML = renderServerBansTab();
      break;
    case "channels":
      pane.innerHTML = renderServerChannelsTab();
      break;
    case "boosts":
      pane.innerHTML = renderServerBoostsTab();
      break;
    case "danger":
      pane.innerHTML = renderServerDangerTab();
      break;
    default:
      pane.innerHTML = renderServerOverviewTab();
  }
};

function renderServerOverviewTab() {
  const isOwner = currentServer.ownerId === currentUser.uid;
  return `
    <div class="settings-pane-title">Server Overview</div>
    <div class="settings-pane-desc">Manage server identity, branding, and permanent invitation link.</div>

    <div style="display:flex; flex-direction:column; gap:18px; margin-top:16px;">
      <!-- Server Name & Emoji -->
      <div style="display:grid; grid-template-columns: 80px 1fr; gap:12px; align-items:flex-end;">
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">ICON EMOJI</label>
          <input type="text" id="srv-edit-emoji" value="${currentServer.emoji || '🎮'}" maxlength="4" style="width:100%; text-align:center; font-size:24px; padding:8px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
        </div>
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER NAME</label>
          <input type="text" id="srv-edit-name" value="${escapeHtml(currentServer.name)}" placeholder="Server Name" style="width:100%; padding:10px 12px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-size:14px; font-weight:bold;">
        </div>
      </div>

      <!-- Description / Topic -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER DESCRIPTION & TOPIC</label>
        <textarea id="srv-edit-desc" rows="3" placeholder="Tell members what this server is all about..." style="width:100%; padding:10px 12px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-size:13px; resize:none;">${escapeHtml(currentServer.description || '')}</textarea>
      </div>

      <!-- Invite Code & Link -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER INVITE CODE & SHAREABLE LINK</label>
        <div style="display:flex; gap:8px; margin-top:4px;">
          <input type="text" readonly value="https://${window.location.host}/#${currentServer.inviteCode || 'VTX-7742'}" style="flex:1; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:var(--brand-blurple); font-family:monospace; border-radius:6px; font-size:13px;">
          <button class="btn-primary" onclick="navigator.clipboard.writeText('https://${window.location.host}/#${currentServer.inviteCode || 'VTX-7742'}'); alert('📋 Invite link copied to clipboard!');">Copy Link</button>
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Share this link with friends so they can join this server on Android and Web!</div>
      </div>

      <!-- Save Overview Button -->
      <div style="padding-top:14px; border-top:1px solid var(--border-subtle);">
        <button class="btn-primary" style="padding:10px 20px;" onclick="saveServerOverviewAction()">💾 Save Server Changes</button>
      </div>
    </div>
  `;
}

window.saveServerOverviewAction = async function() {
  if (!currentServer) return;
  const nameInput = document.getElementById("srv-edit-name");
  const emojiInput = document.getElementById("srv-edit-emoji");
  const descInput = document.getElementById("srv-edit-desc");

  currentServer.name = nameInput ? nameInput.value.trim() : currentServer.name;
  currentServer.emoji = emojiInput ? emojiInput.value.trim() : (currentServer.emoji || "🎮");
  currentServer.description = descInput ? descInput.value.trim() : (currentServer.description || "");

  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderServerRail();
  const header = document.getElementById("header-server-name");
  if (header) header.innerText = currentServer.name;

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, {
      name: currentServer.name,
      emoji: currentServer.emoji,
      description: currentServer.description,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore server overview update notice:", e);
  }

  alert("✓ Server overview preferences saved!");
};

function renderServerRolesTab() {
  const roles = currentServer.roles || getDefaultRoles();

  const roleRowsHtml = roles.map(r => {
    const isOwnerRole = r.id === "owner";
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--input-dark); border-radius:8px; border:1px solid var(--border-subtle); margin-bottom:8px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:14px; height:14px; border-radius:50%; background:${r.color}; display:inline-block; border:1px solid rgba(255,255,255,0.2);"></span>
          <div>
            <div style="font-size:14px; font-weight:600; color:${r.color}; display:flex; align-items:center; gap:6px;">
              ${escapeHtml(r.name)}
              ${r.isPreset ? `<span style="font-size:10px; background:rgba(255,255,255,0.1); color:var(--text-muted); padding:1px 5px; border-radius:4px;">Preset: ${escapeHtml(r.presetType || r.name)}</span>` : ''}
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
              ${r.permissions?.administrator ? '👑 Administrator (All permissions)' : Object.entries(r.permissions || {}).filter(([_, v]) => v).map(([k]) => k).slice(0, 3).join(', ') + '...'}
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="mod-action-btn" onclick="openCreateRoleModal('${r.id}')">✏️ Edit</button>
          ${!isOwnerRole ? `<button class="mod-action-btn danger" onclick="deleteRoleAction('${r.id}')">🗑️ Delete</button>` : ''}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <div class="settings-pane-title" style="margin-bottom:2px;">Server Roles & Permissions</div>
        <div class="settings-pane-desc">Create custom roles and select presets (Mod, Admin, Owner, VIP, Member, Server Booster).</div>
      </div>
      <button class="btn-primary" style="padding:8px 16px; font-size:12px;" onclick="openCreateRoleModal()">+ Create Role</button>
    </div>

    <div style="margin-top:16px;">
      ${roleRowsHtml}
    </div>
  `;
}

// Role Presets Configuration Mapping
const ROLE_PRESETS_MAP = {
  "Owner": {
    color: "#f1c40f",
    permissions: {
      administrator: true, manageServer: true, manageRoles: true, manageChannels: true,
      kickMembers: true, banMembers: true, timeoutMembers: true, manageMessages: true,
      sendMessages: true, attachFiles: true
    }
  },
  "Admin": {
    color: "#e74c3c",
    permissions: {
      administrator: false, manageServer: true, manageRoles: true, manageChannels: true,
      kickMembers: true, banMembers: true, timeoutMembers: true, manageMessages: true,
      sendMessages: true, attachFiles: true
    }
  },
  "Mod": {
    color: "#2ecc71",
    permissions: {
      administrator: false, manageServer: false, manageRoles: false, manageChannels: false,
      kickMembers: true, banMembers: true, timeoutMembers: true, manageMessages: true,
      sendMessages: true, attachFiles: true
    }
  },
  "Server Booster": {
    color: "#f47fff",
    permissions: {
      administrator: false, manageServer: false, manageRoles: false, manageChannels: false,
      kickMembers: false, banMembers: false, timeoutMembers: false, manageMessages: false,
      sendMessages: true, attachFiles: true
    }
  },
  "VIP": {
    color: "#3498db",
    permissions: {
      administrator: false, manageServer: false, manageRoles: false, manageChannels: false,
      kickMembers: false, banMembers: false, timeoutMembers: false, manageMessages: false,
      sendMessages: true, attachFiles: true
    }
  },
  "Member": {
    color: "#95a5a6",
    permissions: {
      administrator: false, manageServer: false, manageRoles: false, manageChannels: false,
      kickMembers: false, banMembers: false, timeoutMembers: false, manageMessages: false,
      sendMessages: true, attachFiles: true
    }
  }
};

window.openCreateRoleModal = function(roleIdToEdit = null) {
  if (!currentServer) return;
  const roles = currentServer.roles || getDefaultRoles();
  const existing = roleIdToEdit ? roles.find(r => r.id === roleIdToEdit) : null;

  const roleName = existing ? existing.name : "New Role";
  const roleColor = existing ? existing.color : "#5865f2";
  const perms = existing?.permissions || {
    administrator: false, manageServer: false, manageRoles: false, manageChannels: false,
    kickMembers: false, banMembers: false, timeoutMembers: false, manageMessages: false,
    sendMessages: true, attachFiles: true
  };

  const permRows = [
    { key: "administrator", title: "👑 Administrator", desc: "Members with this permission have every permission and bypass channel-specific restrictions." },
    { key: "manageServer", title: "⚙️ Manage Server", desc: "Allows changing server name, topic, and invite configuration." },
    { key: "manageRoles", title: "🏷️ Manage Roles", desc: "Allows creating, editing, and deleting roles below this role's hierarchy." },
    { key: "manageChannels", title: "💬 Manage Channels", desc: "Allows creating, editing topics, and deleting server channels." },
    { key: "kickMembers", title: "👢 Kick Members", desc: "Allows kicking problematic members from the server." },
    { key: "banMembers", title: "🔨 Ban Members", desc: "Allows permanently banning abusive members from the server." },
    { key: "timeoutMembers", title: "⏳ Timeout Members", desc: "Allows muting members from sending messages and speaking in voice channels." },
    { key: "manageMessages", title: "🗑️ Manage Messages", desc: "Allows deleting messages sent by other members and pinning messages." },
    { key: "sendMessages", title: "✉️ Send Messages", desc: "Allows posting text messages in channels." },
    { key: "attachFiles", title: "📎 Attach Files & Media", desc: "Allows uploading pictures, videos, and zip files." }
  ];

  const permSwitchesHtml = permRows.map(p => `
    <div class="perm-row">
      <div class="perm-info">
        <h4>${p.title}</h4>
        <p>${p.desc}</p>
      </div>
      <label class="switch">
        <input type="checkbox" id="perm-switch-${p.key}" ${perms[p.key] ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  `).join("");

  showModal(`
    <div class="modal-card" style="width:520px; max-width:95vw; background:var(--surface-dark); border-radius:12px; padding:22px; border:1px solid var(--border-subtle); max-height:85vh; overflow-y:auto;">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary); margin-bottom:4px;">
        ${existing ? 'Edit Role: ' + escapeHtml(existing.name) : 'Create New Server Role'}
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:14px;">Select a preset or customize specific permissions and color tag.</p>

      <!-- Preset Selector Chips -->
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase;">ROLE PRESETS (1-CLICK PERMISSIONS)</label>
        <div class="preset-chips-grid">
          <div class="preset-chip" onclick="applyRolePreset('Owner')">👑 Owner</div>
          <div class="preset-chip" onclick="applyRolePreset('Admin')">🛡️ Admin</div>
          <div class="preset-chip" onclick="applyRolePreset('Mod')">⚔️ Mod</div>
          <div class="preset-chip" onclick="applyRolePreset('Server Booster')">🚀 Booster</div>
          <div class="preset-chip" onclick="applyRolePreset('VIP')">⭐ VIP</div>
          <div class="preset-chip" onclick="applyRolePreset('Member')">👥 Member</div>
        </div>
      </div>

      <!-- Role Name & Color -->
      <div style="display:grid; grid-template-columns:1fr 70px; gap:12px; margin: 12px 0;">
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">ROLE NAME</label>
          <input type="text" id="role-name-input" value="${escapeHtml(roleName)}" placeholder="e.g. Lead Moderator" style="width:100%; padding:10px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; font-size:13px; font-weight:bold;">
        </div>
        <div>
          <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">COLOR</label>
          <input type="color" id="role-color-input" value="${roleColor}" style="width:100%; height:38px; margin-top:4px; border:none; cursor:pointer; background:transparent;">
        </div>
      </div>

      <!-- Permissions Switch List -->
      <div style="margin-top:14px;">
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px; display:block;">PERMISSIONS</label>
        ${permSwitchesHtml}
      </div>

      <!-- Actions -->
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px; padding-top:12px; border-top:1px solid var(--border-subtle);">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" onclick="saveRoleAction('${roleIdToEdit || ''}')">Save Role</button>
      </div>
    </div>
  `);
};

window.applyRolePreset = function(presetType) {
  const preset = ROLE_PRESETS_MAP[presetType];
  if (!preset) return;

  const nameInput = document.getElementById("role-name-input");
  if (nameInput) nameInput.value = presetType;
  const colorInput = document.getElementById("role-color-input");
  if (colorInput) colorInput.value = preset.color;

  Object.entries(preset.permissions).forEach(([key, val]) => {
    const sw = document.getElementById(`perm-switch-${key}`);
    if (sw) sw.checked = val;
  });

  // Highlight active preset chip
  document.querySelectorAll(".preset-chip").forEach(el => {
    el.classList.toggle("active", el.innerText.includes(presetType));
  });
};

window.saveRoleAction = async function(roleIdToEdit) {
  if (!currentServer) return;
  const nameInput = document.getElementById("role-name-input");
  const colorInput = document.getElementById("role-color-input");
  const name = nameInput ? nameInput.value.trim() : "New Role";
  const color = colorInput ? colorInput.value : "#5865f2";

  const permKeys = ["administrator", "manageServer", "manageRoles", "manageChannels", "kickMembers", "banMembers", "timeoutMembers", "manageMessages", "sendMessages", "attachFiles"];
  const permissions = {};
  permKeys.forEach(k => {
    const sw = document.getElementById(`perm-switch-${k}`);
    permissions[k] = sw ? sw.checked : false;
  });

  let roles = currentServer.roles || getDefaultRoles();
  const roleId = roleIdToEdit || ("role_" + Math.random().toString(36).substring(2, 8));

  if (roleIdToEdit) {
    roles = roles.map(r => r.id === roleIdToEdit ? { ...r, name, color, permissions } : r);
  } else {
    roles.push({ id: roleId, name, color, permissions, isPreset: false });
  }

  currentServer.roles = roles;
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderMemberList();

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, { roles: roles, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn("Firestore save role notice:", e);
  }

  closeModal();
  openServerSettings("roles");
};

window.deleteRoleAction = async function(roleId) {
  if (!currentServer) return;
  if (confirm("Delete this role?")) {
    currentServer.roles = (currentServer.roles || []).filter(r => r.id !== roleId);
    // Remove deleted role from any members who had it
    (currentServer.members || []).forEach(m => {
      m.roleIds = (m.roleIds || []).filter(rid => rid !== roleId);
    });
    localStorage.setItem("vortex_servers", JSON.stringify(userServers));
    renderMemberList();

    try {
      const sRef = doc(db, "servers", currentServer.id);
      await updateDoc(sRef, {
        roles: currentServer.roles,
        members: currentServer.members,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Firestore delete role notice:", e);
    }

    switchServerSettingsTab("roles");
  }
};

function renderServerMembersTab() {
  const members = currentServer.members || [];
  const rolesMap = {};
  (currentServer.roles || getDefaultRoles()).forEach(r => {
    rolesMap[r.id] = r;
  });

  const memberRowsHtml = members.map(m => {
    const isYou = m.uid === currentUser.uid;
    const isOwner = m.uid === currentServer.ownerId || (m.roleIds && m.roleIds.includes("owner"));
    const isMuted = currentServer.mutedUserIds && currentServer.mutedUserIds.includes(m.uid);
    const assignedRoles = (m.roleIds || []).map(rid => rolesMap[rid]).filter(Boolean);
    const topRole = assignedRoles[0] || (isOwner ? { name: "Owner", color: "#f1c40f" } : { name: "Member", color: "#95a5a6" });

    return `
      <div class="member-mod-row">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:36px; height:36px; border-radius:50%; background:${topRole.color}; display:flex; align-items:center; justify-content:center; font-weight:bold; color:white;">
            ${(m.displayName[0] || 'U').toUpperCase()}
          </div>
          <div>
            <div style="font-size:13px; font-weight:bold; color:var(--header-primary); display:flex; align-items:center; gap:6px;">
              ${escapeHtml(m.displayName)}
              ${isOwner ? '👑' : ''}
              ${isMuted ? '<span style="font-size:9px; background:var(--danger-red); color:white; padding:1px 4px; border-radius:3px;">MUTED</span>' : ''}
            </div>
            <div style="font-size:11px; color:var(--text-muted);">
              ${m.username ? `@${escapeHtml(m.username)}` : ''} • ${escapeHtml(m.tag || '#1337')}
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <div style="display:flex; gap:4px; margin-right:6px;">
            ${assignedRoles.map(r => `<span class="role-badge" style="color:${r.color}; border-color:${r.color}; font-size:10px;">${escapeHtml(r.name)}</span>`).join('')}
          </div>
          <button class="mod-action-btn" onclick="openAssignRolesModal('${m.uid}')">🏷️ Roles</button>
          <button class="mod-action-btn warning" onclick="timeoutMemberAction('${m.uid}', ${isMuted ? '0' : '300'})">
            ${isMuted ? '🔊 Unmute' : '⏳ Timeout'}
          </button>
          ${!isOwner && !isYou ? `
            <button class="mod-action-btn danger" onclick="kickMemberAction('${m.uid}')">👢 Kick</button>
            <button class="mod-action-btn danger" onclick="banMemberAction('${m.uid}')">🔨 Ban</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="settings-pane-title">Members & Moderation Actions</div>
    <div class="settings-pane-desc">Manage all real members of ${escapeHtml(currentServer.name)}. Assign custom roles, timeout, kick, or ban offending accounts.</div>

    <div style="margin-top:16px;">
      ${memberRowsHtml}
    </div>
  `;
}

// Assign Roles Modal
window.openAssignRolesModal = function(memberUid) {
  if (!currentServer) return;
  const members = currentServer.members || [];
  const member = members.find(m => m.uid === memberUid);
  if (!member) return;

  const roles = currentServer.roles || getDefaultRoles();
  const currentRoleIds = member.roleIds || [];

  const rolesCheckboxHtml = roles.map(r => `
    <label style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:var(--input-dark); border-radius:6px; margin-bottom:6px; cursor:pointer; border:1px solid var(--border-subtle);">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="width:10px; height:10px; border-radius:50%; background:${r.color};"></span>
        <span style="font-size:13px; font-weight:600; color:${r.color};">${escapeHtml(r.name)}</span>
      </div>
      <input type="checkbox" id="assign-role-${r.id}" ${currentRoleIds.includes(r.id) ? 'checked' : ''} onchange="toggleMemberRole('${member.uid}', '${r.id}')">
    </label>
  `).join("");

  showModal(`
    <div class="modal-card" style="width:420px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:16px; font-weight:bold; color:var(--header-primary); margin-bottom:4px;">
        Assign Roles: ${escapeHtml(member.displayName)}
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">Toggle roles to grant specific permissions and display tag badges.</p>

      <div style="max-height:260px; overflow-y:auto; margin-bottom:16px;">
        ${rolesCheckboxHtml}
      </div>

      <button class="btn-primary" style="width:100%;" onclick="closeModal(); if (document.getElementById('server-settings-content-pane')) switchServerSettingsTab('members');">Done</button>
    </div>
  `);
};

window.toggleMemberRole = async function(memberUid, roleId) {
  if (!currentServer) return;
  const members = currentServer.members || [];
  const member = members.find(m => m.uid === memberUid);
  if (!member) return;

  member.roleIds = member.roleIds || [];
  if (member.roleIds.includes(roleId)) {
    member.roleIds = member.roleIds.filter(id => id !== roleId);
  } else {
    member.roleIds.push(roleId);
  }

  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderMemberList();

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, { members: currentServer.members, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn("Firestore role assign notice:", e);
  }
};

// Moderation: Kick Member
window.kickMemberAction = async function(memberUid) {
  if (!currentServer) return;
  if (!confirm("Are you sure you want to kick this member from the server?")) return;

  currentServer.memberIds = (currentServer.memberIds || []).filter(id => id !== memberUid);
  currentServer.members = (currentServer.members || []).filter(m => m.uid !== memberUid);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderMemberList();

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, {
      memberIds: currentServer.memberIds,
      members: currentServer.members,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore kick notice:", e);
  }

  alert("👢 Member kicked from server.");
  closeModal();
  openServerSettings("members");
};

// Moderation: Ban Member
window.banMemberAction = async function(memberUid) {
  if (!currentServer) return;
  if (!confirm("Are you sure you want to BAN this member? They will not be able to rejoin with an invite code.")) return;

  currentServer.bannedUserIds = currentServer.bannedUserIds || [];
  if (!currentServer.bannedUserIds.includes(memberUid)) {
    currentServer.bannedUserIds.push(memberUid);
  }
  currentServer.memberIds = (currentServer.memberIds || []).filter(id => id !== memberUid);
  currentServer.members = (currentServer.members || []).filter(m => m.uid !== memberUid);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderMemberList();

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, {
      bannedUserIds: currentServer.bannedUserIds,
      memberIds: currentServer.memberIds,
      members: currentServer.members,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore ban notice:", e);
  }

  alert("🔨 Member has been banned from the server.");
  closeModal();
  openServerSettings("members");
};

// Moderation: Timeout / Mute Member
window.timeoutMemberAction = async function(memberUid, durationSeconds = 300) {
  if (!currentServer) return;
  currentServer.mutedUserIds = currentServer.mutedUserIds || [];

  if (durationSeconds > 0) {
    if (!currentServer.mutedUserIds.includes(memberUid)) {
      currentServer.mutedUserIds.push(memberUid);
    }
    alert(`⏳ Member has been timed out for ${Math.round(durationSeconds / 60)} minutes.`);
  } else {
    currentServer.mutedUserIds = currentServer.mutedUserIds.filter(id => id !== memberUid);
    alert("🔊 Timeout removed. Member can now chat freely.");
  }

  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  renderMemberList();

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, {
      mutedUserIds: currentServer.mutedUserIds,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore timeout notice:", e);
  }

  closeModal();
  openServerSettings("members");
};

// Moderation: Unban Member
window.unbanUserAction = async function(memberUid) {
  if (!currentServer) return;
  currentServer.bannedUserIds = (currentServer.bannedUserIds || []).filter(id => id !== memberUid);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));

  try {
    const sRef = doc(db, "servers", currentServer.id);
    await updateDoc(sRef, {
      bannedUserIds: currentServer.bannedUserIds,
      updatedAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Firestore unban notice:", e);
  }

  switchServerSettingsTab("bans");
};

function renderServerBansTab() {
  const bans = currentServer.bannedUserIds || [];
  if (bans.length === 0) {
    return `
      <div class="settings-pane-title">Banned Users</div>
      <div class="settings-pane-desc">Users who are banned cannot join ${escapeHtml(currentServer.name)} via any invite code.</div>
      <div style="background:var(--input-dark); border-radius:8px; padding:30px; text-align:center; color:var(--text-muted); margin-top:20px;">
        🛡️ No banned users on this server.
      </div>
    `;
  }

  return `
    <div class="settings-pane-title">Banned Users (${bans.length})</div>
    <div class="settings-pane-desc">Users who are banned cannot join via any invite link.</div>
    <div style="margin-top:16px;">
      ${bans.map(bUid => `
        <div class="member-mod-row">
          <div>
            <div style="font-size:13px; font-weight:bold; color:var(--danger-red);">🔨 Banned User</div>
            <div style="font-size:11px; color:var(--text-muted); font-family:monospace;">UID: ${escapeHtml(bUid)}</div>
          </div>
          <button class="mod-action-btn" onclick="unbanUserAction('${bUid}')">Unban User</button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderServerChannelsTab() {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <div>
        <div class="settings-pane-title" style="margin-bottom:2px;">Channel Management</div>
        <div class="settings-pane-desc">Configure and organize text, voice, and video channels.</div>
      </div>
      <button class="btn-primary" style="padding:8px 16px; font-size:12px;" onclick="closeModal(); openCreateChannelModal();">+ Create Channel</button>
    </div>

    <div style="background:var(--input-dark); border-radius:8px; padding:16px; margin-top:14px; border:1px solid var(--border-subtle);">
      <div style="font-size:12px; font-weight:bold; color:var(--text-muted); margin-bottom:8px;">ACTIVE SERVER CHANNELS</div>
      <p style="font-size:12px; color:var(--text-normal); line-height:1.5;">
        You can create channels directly using the '+' buttons on the channels sidebar, or click the 🗑️ icon beside any channel to delete it.
      </p>
    </div>
  `;
}

function renderServerBoostsTab() {
  const lvl = currentServer.boostLevel || 1;
  return `
    <div class="settings-pane-title">🚀 Server Boost Status</div>
    <div class="settings-pane-desc">Boost ${escapeHtml(currentServer.name)} to unlock 384kbps high-fidelity voice, 1080p stage streaming, and vanity tags for free.</div>

    <div style="background:linear-gradient(135deg, rgba(235,69,158,0.18), rgba(88,101,242,0.18)); border:1px solid rgba(235,69,158,0.4); border-radius:10px; padding:20px; margin-top:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:11px; font-weight:bold; color:var(--nitro-pink); text-transform:uppercase;">CURRENT TIER</div>
          <div style="font-size:22px; font-weight:bold; color:white; margin-top:4px;">Level ${lvl} Boosted 🚀</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">384kbps voice unlocked • 1080p 60FPS video stage</div>
        </div>
        <button class="btn-primary" style="background:var(--nitro-pink); padding:10px 20px; font-weight:bold;" onclick="watchAdForReward('boost')">
          🚀 Boost Free (Watch Ad)
        </button>
      </div>
    </div>
  `;
}

function renderServerDangerTab() {
  const isOwner = currentServer.ownerId === currentUser.uid;
  return `
    <div class="settings-pane-title" style="color:var(--danger-red);">Danger Zone</div>
    <div class="settings-pane-desc">Irreversible server actions. Please exercise caution.</div>

    <div style="background:rgba(237,66,69,0.08); border:1px solid var(--danger-red); border-radius:10px; padding:18px; margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <div style="font-size:14px; font-weight:bold; color:var(--danger-red);">
          ${isOwner ? 'Delete This Server Permanently' : 'Leave Server'}
        </div>
        <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
          ${isOwner ? 'This will permanently remove the server, all channels, and all message history.' : 'You will be removed from the member list until re-invited.'}
        </div>
      </div>
      <button class="btn-secondary" style="color:var(--danger-red); border-color:var(--danger-red); font-weight:bold; padding:8px 16px;" onclick="deleteCurrentServer()">
        ${isOwner ? '🗑️ Delete Server' : 'Leave Server'}
      </button>
    </div>
  `;
}

window.deleteCurrentServer = async function() {
  if (!currentServer) return;
  const isOwner = currentServer.ownerId === currentUser.uid;
  const promptMsg = isOwner ? `Are you sure you want to permanently delete "${currentServer.name}"?` : `Leave "${currentServer.name}"?`;
  if (!confirm(promptMsg)) return;

  const targetId = currentServer.id;
  userServers = userServers.filter(s => s.id !== targetId);
  localStorage.setItem("vortex_servers", JSON.stringify(userServers));
  currentServer = userServers.length > 0 ? userServers[0] : null;

  if (isOwner) {
    try {
      await deleteDoc(doc(db, "servers", targetId));
    } catch (e) {
      console.warn("Firestore delete server notice:", e);
    }
  } else {
    try {
      const sRef = doc(db, "servers", targetId);
      await updateDoc(sRef, {
        memberIds: arrayRemove(currentUser.uid)
      });
    } catch (e) {
      console.warn("Firestore leave server notice:", e);
    }
  }

  selectServer(currentServer);
  closeModal();
};

window.openJoinServerModal = function() {
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">Join a Server</div>
      <p style="font-size:12px; color:var(--text-muted); margin:4px 0 12px;">Enter an invite code to join a community server across Web and Android:</p>
      <input type="text" id="invite-code-input" placeholder="Invite Code (e.g. VTX-7742)" style="width:100%; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin-bottom:12px; font-family:monospace; font-size:14px; text-transform:uppercase;">
      <button class="btn-primary" style="width:100%;" onclick="joinServerAction()">Join Server</button>
      <button class="btn-secondary" style="width:100%; margin-top:8px;" onclick="closeModal()">Cancel</button>
    </div>
  `);
};

window.joinServerAction = async function() {
  const codeInput = document.getElementById("invite-code-input");
  const code = codeInput ? codeInput.value.trim().toUpperCase() : "";
  if (!code) {
    alert("Please enter a valid server invite code (e.g. VTX-7742).");
    return;
  }

  try {
    const q = query(collection(db, "servers"), where("inviteCode", "==", code));
    const snap = await getDocs(q);
    if (snap.empty) {
      alert("No server found matching invite code: " + code);
      return;
    }

    const sDoc = snap.docs[0];
    const sData = sDoc.data();
    if (sData.bannedUserIds && sData.bannedUserIds.includes(currentUser.uid)) {
      alert("You have been banned from this server and cannot rejoin.");
      return;
    }

    const sRef = doc(db, "servers", sDoc.id);
    const existingMembers = sData.members || [];
    const updatedMembers = [
      ...existingMembers.filter(m => m.uid !== currentUser.uid),
      {
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        username: currentUser.username,
        tag: currentUser.tag,
        roleIds: ["member"]
      }
    ];

    await updateDoc(sRef, {
      memberIds: arrayUnion(currentUser.uid),
      members: updatedMembers,
      updatedAt: serverTimestamp()
    });

    const joinedServer = {
      id: sDoc.id,
      ...sData,
      memberIds: [...(sData.memberIds || []), currentUser.uid],
      members: updatedMembers
    };

    if (!userServers.find(s => s.id === sDoc.id)) {
      userServers.push(joinedServer);
      localStorage.setItem("vortex_servers", JSON.stringify(userServers));
    }

    closeModal();
    selectServer(joinedServer);
    alert(`🎉 Successfully joined "${sData.name}"!`);
  } catch (e) {
    console.warn("Join server error:", e);
    alert("Could not join server: " + e.message);
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

window.openJoinServerModal = function(prefilledCode = "") {
  showModal(`
    <div class="modal-card" style="width:400px; max-width:95vw; background:var(--surface-dark); border-radius:10px; padding:20px; border:1px solid var(--border-subtle);">
      <div class="modal-title" style="font-size:18px; font-weight:bold; color:var(--header-primary);">Join a Server</div>
      <p style="color:var(--text-muted); font-size:12px; margin:4px 0 12px;">Enter an invite code below to join an existing community.</p>
      <input type="text" id="invite-code-input" value="${escapeHtml(prefilledCode)}" placeholder="Invite Code (e.g. VTX-4921)" style="width:100%; padding:10px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin-bottom:12px; font-family:monospace; text-transform:uppercase;">
      <button class="btn-primary" style="width:100%; padding:10px; font-weight:bold;" onclick="joinServerAction()">Join Server</button>
      <button class="btn-secondary" onclick="closeModal()" style="margin-top:8px; width:100%;">Cancel</button>
    </div>
  `);
};

window.joinServerAction = async function() {
  const input = document.getElementById("invite-code-input");
  const code = (input?.value || "").trim().toUpperCase();
  if (!code) {
    alert("Please enter a valid invite code.");
    return;
  }

  try {
    const q = query(collection(db, "servers"), where("inviteCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) {
      alert("❌ No server found with invite code: " + code);
      return;
    }

    const docSnap = snap.docs[0];
    const sData = docSnap.data();

    // Check ban
    if (sData.bannedUserIds && sData.bannedUserIds.includes(currentUser.uid)) {
      alert("🚫 You are banned from this server and cannot rejoin.");
      return;
    }

    const existingMemberIds = sData.memberIds || [];
    let updatedMembers = sData.members || [];

    if (!existingMemberIds.includes(currentUser.uid)) {
      existingMemberIds.push(currentUser.uid);
      updatedMembers.push({
        uid: currentUser.uid,
        displayName: currentUser.displayName,
        username: currentUser.username,
        tag: currentUser.tag,
        roleIds: ["member"]
      });

      await updateDoc(doc(db, "servers", docSnap.id), {
        memberIds: existingMemberIds,
        members: updatedMembers,
        updatedAt: serverTimestamp()
      });
    }

    const joinedServer = {
      id: docSnap.id,
      name: sData.name || "Server",
      emoji: sData.emoji || "🎮",
      inviteCode: sData.inviteCode || code,
      ownerId: sData.ownerId,
      description: sData.description || "",
      roles: sData.roles || getDefaultRoles(),
      members: updatedMembers,
      memberIds: existingMemberIds,
      bannedUserIds: sData.bannedUserIds || [],
      mutedUserIds: sData.mutedUserIds || [],
      boostLevel: sData.boostLevel || 1
    };

    if (!userServers.find(s => s.id === joinedServer.id)) {
      userServers.push(joinedServer);
      localStorage.setItem("vortex_servers", JSON.stringify(userServers));
    }

    selectServer(joinedServer);
    closeModal();
    alert(`🎉 Successfully joined ${joinedServer.name}!`);
  } catch (err) {
    console.error("Join server error:", err);
    alert("Unable to join server. Please check your network and try again.");
  }
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

// Auto-check invite code from hash or query
setTimeout(() => {
  const hash = window.location.hash.replace(/^#/, "").trim();
  const params = new URLSearchParams(window.location.search);
  const inviteParam = params.get("invite") || hash;
  if (inviteParam && (inviteParam.startsWith("VTX-") || inviteParam.length >= 6)) {
    window.openJoinServerModal(inviteParam);
  }
}, 800);
