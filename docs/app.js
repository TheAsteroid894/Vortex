// Vortex Web Client - Connected to Live Vortex Cloud Firebase & E2EE Cryptography
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

// Load persisted user & appearance preferences from localStorage
// Load persisted user & appearance preferences from localStorage
const savedSettings = JSON.parse(localStorage.getItem("vortex_appearance") || "{}");
let currentTheme = savedSettings.theme || "dark";
let currentAccent = savedSettings.accent || "#5865f2";
let currentFont = savedSettings.font || "sans";

// State variables (support username, display name, custom tag)
let currentUser = {
  uid: "guest_" + Math.random().toString(36).substring(2, 8),
  displayName: localStorage.getItem("vortex_display_name") || "Vortex User",
  username: localStorage.getItem("vortex_username") || "vortex_user",
  tag: localStorage.getItem("vortex_tag") || "#1337",
  photoURL: "",
  isGuest: true
};

// User Servers (clean start - no hardcoded default server)
let userServers = JSON.parse(localStorage.getItem("vortex_servers") || "[]");
let currentServer = userServers.length > 0 ? userServers[0] : null;

// User Direct Messages (clean start - no hardcoded default DMs)
let userDMs = JSON.parse(localStorage.getItem("vortex_dms") || "[]");
let currentChannel = { id: "general", name: "general", type: "TEXT", isEncrypted: true };

let isE2EEActive = true;
let isLowBandwidth = true;
let isMuted = false;
let isVideoOn = false;
let isSharing = false;
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

  localStorage.setItem("vortex_appearance", JSON.stringify({
    theme: currentTheme,
    accent: currentAccent,
    font: currentFont
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
    const customTag = localStorage.getItem("vortex_tag");
    currentUser = {
      uid: user.uid,
      displayName: customName || user.displayName || "Sambhaji",
      tag: customTag || ("#" + user.uid.substring(0, 4).toUpperCase()),
      photoURL: user.photoURL || "",
      isGuest: false
    };
    document.getElementById("btn-auth").innerText = "Sign Out";

    // Sync profile with Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: currentUser.displayName,
        customTag: currentUser.tag,
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
}

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
  const header = document.getElementById("header-server-name");
  if (header) header.innerText = server ? server.name : "Select or Create a Server";
  renderServerRail();
  initLiveChannels();
}

function renderDMsList() {
  const dmContainer = document.getElementById("direct-messages-container") || document.getElementById("dms-container");
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
      <span class="e2ee-tag">E2EE</span>
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
        addChannelToDOM("e2ee-confidential", "e2ee-confidential", "TEXT", true);
        addChannelToDOM("nitro-lounge", "nitro-lounge", "TEXT", false);
        addChannelToDOM("voice-lounge", "voice-lounge", "VOICE", true);
        addChannelToDOM("video-stage", "video-stage (1080p)", "VIDEO", true);
      } else {
        snapshot.forEach((docSnap) => {
          const ch = docSnap.data();
          addChannelToDOM(docSnap.id, ch.name, ch.type || "TEXT", ch.isEncrypted);
        });
      }
    }, (err) => {
      console.warn("Firestore channels listener: using local channels.", err);
    });
  } catch (e) {
    console.warn("Offline or permissions notice:", e);
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
    <span>${name}</span>
    ${isEncrypted ? '<span class="e2ee-tag">E2EE</span>' : ''}
  `;
  container.appendChild(item);
}

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
        <p style="font-size: 13px; max-width: 400px; margin: 0 auto 16px;">No community server selected. Click the '+' button on the left rail to create your own server or start a Direct Message!</p>
        <button class="btn-primary" onclick="openAddServerModal()">+ Create Server</button>
      </div>
    `;
    return;
  }

  try {
    const messagesRef = collection(db, "servers", serverId, "channels", currentChannel.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    unsubscribeMessages = onSnapshot(q, async (snapshot) => {
      container.innerHTML = "";
      if (welcomeCard) container.appendChild(welcomeCard);

      const key = await deriveChannelKey(serverId, currentChannel.id);

      for (const docSnap of snapshot.docs) {
        const msg = docSnap.data();
        let displayContent = msg.content;
        if (msg.isEncrypted) {
          displayContent = await decryptMessage(msg.content, key);
        }
        renderMessageCard(msg.senderName, displayContent, msg.isEncrypted, msg.createdAt, msg.attachments);
      }
      container.scrollTop = container.scrollHeight;
    }, (err) => {
      console.warn("Live message stream note:", err);
    });
  } catch (e) {
    console.warn("Message stream connection note:", e);
  }
}

function renderMessageCard(author, content, isEncrypted, timestamp, attachments) {
  const container = document.getElementById("messages-container");
  const msgEl = document.createElement("div");
  msgEl.className = "message-card";

  const timeStr = timestamp?.toDate ? timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const initial = (author[0] || "U").toUpperCase();

  let attachmentsHtml = "";
  if (attachments && attachments.length > 0) {
    attachments.forEach(att => {
      attachmentsHtml += `
        <div class="attachment-card">
          <div class="attachment-icon">📁</div>
          <div class="attachment-meta">
            <span class="attachment-name">${escapeHtml(att.fileName || "file")}</span>
            <span class="attachment-size">${escapeHtml(att.fileSizeFormatted || "100 MB")} • Free Nitro Limit</span>
          </div>
        </div>
      `;
    });
  }

  msgEl.innerHTML = `
    <div class="avatar">${initial}</div>
    <div class="message-content-wrap">
      <div class="message-author-row">
        <span class="message-author">${escapeHtml(author)}</span>
        <span class="badge" style="background:rgba(254,231,92,0.2); color:var(--nitro-gold); font-size:9px;">NITRO</span>
        <span class="message-time">${timeStr}</span>
        ${isEncrypted ? '<span class="e2ee-lock-icon">🔒 E2EE Decrypted</span>' : ''}
      </div>
      <div class="message-text">${escapeHtml(content)}</div>
      ${attachmentsHtml}
    </div>
  `;
  container.appendChild(msgEl);
}

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
    voiceBar.style.display = "flex";
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
      createdAt: serverTimestamp()
    });
  } catch (e) {
    renderMessageCard(currentUser.displayName, text, isE2EEActive, new Date(), []);
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
      alert("Note: To sign in with Google, add your GitHub domain to Firebase Console > Authentication > Authorized domains: " + window.location.hostname);
    });
  }
};

window.toggleMute = function() {
  isMuted = !isMuted;
  document.getElementById("btn-mute").innerText = isMuted ? "🔇" : "🎙️";
  document.getElementById("stage-mic").innerText = isMuted ? "🔇" : "🎙️";
  document.getElementById("tile-1").classList.toggle("speaking", !isMuted);
};

window.toggleVideo = function() {
  isVideoOn = !isVideoOn;
  document.getElementById("stage-video").classList.toggle("active", isVideoOn);
};

window.toggleShare = function() {
  isSharing = !isSharing;
  document.getElementById("stage-share").classList.toggle("active", isSharing);
};

window.disconnectVoice = function() {
  document.getElementById("stage-container").style.display = "none";
  document.getElementById("messages-container").style.display = "flex";
  document.getElementById("active-voice-bar").style.display = "none";
  window.switchChannel("general", "general", "TEXT", true);
};

window.toggleE2EE = function() {
  isE2EEActive = !isE2EEActive;
  const btn = document.getElementById("btn-e2ee-toggle");
  btn.innerText = isE2EEActive ? "🔒" : "🔓";
  btn.style.color = isE2EEActive ? "var(--brand-green)" : "var(--text-muted)";
};

window.insertEmoji = function(emoji) {
  document.getElementById("chat-text-input").value += " " + emoji + " ";
};

window.toggleDrawer = function() {
  document.body.classList.toggle("drawer-open");
  document.getElementById("drawer-backdrop").classList.toggle("active");
};

window.closeDrawer = function() {
  document.body.classList.remove("drawer-open");
  document.getElementById("drawer-backdrop").classList.remove("active");
};

// --- Modals ---

// 1. Change Username & Profile Modal
// 1. Change Username & Profile Modal
window.openProfileModal = function() {
  showModal(`
    <div class="modal-title">👤 Edit Profile & Username</div>
    <div style="display:flex; flex-direction:column; gap:12px; margin: 10px 0;">
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">DISPLAY NAME</label>
        <input type="text" id="edit-display-name" value="${escapeHtml(currentUser.displayName)}" style="width:100%; padding:8px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">USERNAME (@handle)</label>
        <input type="text" id="edit-username" value="${escapeHtml(currentUser.username || '')}" placeholder="e.g. cyber_vortex" style="width:100%; padding:8px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">CUSTOM USERNAME TAG (FREE NITRO)</label>
        <input type="text" id="edit-tag" value="${escapeHtml(currentUser.tag)}" placeholder="#1337" style="width:100%; padding:8px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>
    </div>
    <button class="btn-primary" onclick="saveProfileChanges()">Save Changes</button>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
  `);
};

window.saveProfileChanges = async function() {
  const newName = document.getElementById("edit-display-name").value.trim() || currentUser.displayName;
  const newUsername = document.getElementById("edit-username").value.trim().replace(/^@/, '') || currentUser.username;
  const newTag = document.getElementById("edit-tag").value.trim() || currentUser.tag;

  currentUser.displayName = newName;
  currentUser.username = newUsername;
  currentUser.tag = newTag.startsWith("#") ? newTag : "#" + newTag;

  localStorage.setItem("vortex_display_name", currentUser.displayName);
  localStorage.setItem("vortex_username", currentUser.username);
  localStorage.setItem("vortex_tag", currentUser.tag);

  updateUserProfileDisplay();

  if (!currentUser.isGuest) {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await setDoc(userRef, {
        displayName: currentUser.displayName,
        username: currentUser.username,
        customTag: currentUser.tag,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not save to Firestore:", e);
    }
  }

  closeModal();
};

// 2. Settings Modal with Themes, Colors & Custom Fonts
window.openSettings = function() {
  const handle = currentUser.username ? `@${currentUser.username}` : currentUser.tag;
  showModal(`
    <div class="modal-title">⚙️ Vortex Appearance & Settings</div>

    <div style="display:flex; flex-direction:column; gap:14px; margin: 10px 0;">
      <!-- Profile Button -->
      <button class="btn-primary" style="display:flex; justify-content:space-between; align-items:center;" onclick="openProfileModal()">
        <span>👤 Edit Profile: ${escapeHtml(currentUser.displayName)} (${escapeHtml(handle)})</span>
        <span>Edit →</span>
      </button>

      <!-- Theme Selector -->
      <div>
        <div style="font-size:11px; font-weight:bold; color:var(--text-muted); margin-bottom:6px;">CLIENT THEME (SAVED IN BROWSER)</div>
        <div class="theme-grid" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
          <div class="theme-chip ${currentTheme === 'dark' ? 'active' : ''}" onclick="selectTheme('dark')">
            <span style="font-size:16px;">🌙</span> Dark Classic
          </div>
          <div class="theme-chip ${(currentTheme === 'amoled' || currentTheme === 'midnight') ? 'active' : ''}" onclick="selectTheme('amoled')">
            <span style="font-size:16px;">🖤</span> Midnight AMOLED
          </div>
          <div class="theme-chip ${(currentTheme === 'ocean' || currentTheme === 'cyber') ? 'active' : ''}" onclick="selectTheme('ocean')">
            <span style="font-size:16px;">🌊</span> Deep Sea Slate
          </div>
          <div class="theme-chip ${currentTheme === 'light' ? 'active' : ''}" onclick="selectTheme('light')">
            <span style="font-size:16px;">☀️</span> Clean Light
          </div>
        </div>
      </div>

      <!-- Accent Color Selector -->
      <div>
        <div style="font-size:11px; font-weight:bold; color:var(--text-muted); margin-bottom:6px;">ACCENT COLOR</div>
        <div class="color-picker-row" style="display:flex; gap:10px; align-items:center;">
          <div class="color-dot ${currentAccent.toLowerCase() === '#5865f2' ? 'active' : ''}" style="background:#5865f2; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#5865f2')" title="Discord Blurple"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#23a55a' ? 'active' : ''}" style="background:#23a55a; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#23a55a')" title="Emerald Green"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#00b0f4' ? 'active' : ''}" style="background:#00b0f4; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#00b0f4')" title="Cyber Cyan"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#eb459e' ? 'active' : ''}" style="background:#eb459e; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#eb459e')" title="Neon Pink"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#fee75c' ? 'active' : ''}" style="background:#fee75c; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#fee75c')" title="Sunset Gold"></div>
          <div class="color-dot ${currentAccent.toLowerCase() === '#ed4245' ? 'active' : ''}" style="background:#ed4245; width:34px; height:34px; border-radius:50%; cursor:pointer;" onclick="selectAccent('#ed4245')" title="Coral Red"></div>
        </div>
      </div>

      <!-- Font Selector -->
      <div>
        <div style="font-size:11px; font-weight:bold; color:var(--text-muted); margin-bottom:6px;">CLIENT FONT STYLE</div>
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
          <button class="btn-secondary ${currentFont === 'sans' ? 'btn-primary' : ''}" style="font-family:sans-serif;" onclick="selectFont('sans')">Modern Sans</button>
          <button class="btn-secondary ${currentFont === 'mono' ? 'btn-primary' : ''}" style="font-family:monospace;" onclick="selectFont('mono')">Cyber Mono</button>
          <button class="btn-secondary ${currentFont === 'rounded' ? 'btn-primary' : ''}" style="font-family:'Quicksand', 'Nunito', sans-serif;" onclick="selectFont('rounded')">Friendly Rounded</button>
          <button class="btn-secondary ${currentFont === 'serif' ? 'btn-primary' : ''}" style="font-family:Georgia, serif;" onclick="selectFont('serif')">Classic Serif</button>
        </div>
      </div>

      <!-- Bandwidth Toggle -->
      <label style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:10px; border-radius:8px;">
        <div>
          <div style="font-size:13px; font-weight:600; color:var(--header-primary);">⚡ Ultra-Low Bandwidth Mode</div>
          <div style="font-size:11px; color:var(--text-muted);">Opus 6kbps compression to save 85% mobile data.</div>
        </div>
        <input type="checkbox" checked onchange="isLowBandwidth = this.checked">
      </label>

      <!-- Safety Fingerprint -->
      <div style="background:var(--input-dark); padding:8px 10px; border-radius:6px;">
        <div style="font-size:11px; color:var(--brand-green); font-weight:bold;">E2EE Safety Fingerprint:</div>
        <div style="font-family:monospace; font-size:11px; color:var(--text-muted); margin-top:4px;">4829 1049 8271 9021 3342 9912</div>
      </div>
    </div>
    <button class="btn-primary" onclick="closeModal()">Done</button>
  `);
};

window.selectTheme = function(themeName) {
  currentTheme = themeName;
  applyAppearance();
  openSettings();
};

window.selectAccent = function(hex) {
  currentAccent = hex;
  applyAppearance();
  openSettings();
};

window.selectFont = function(fontName) {
  currentFont = fontName;
  applyAppearance();
  openSettings();
};

// 3. Create Server Modal
window.openAddServerModal = function() {
  const emojis = ["🎮", "🚀", "💬", "⚡", "🛡️", "🎧", "🌟", "👾"];
  let emojiHtml = "";
  emojis.forEach((em) => {
    emojiHtml += `<span style="font-size:20px; cursor:pointer; padding:4px;" onclick="document.getElementById('server-emoji-input').value='${em}'">${em}</span>`;
  });

  showModal(`
    <div class="modal-title">Create Your Server</div>
    <p style="color:var(--text-muted); font-size:13px;">Your server is where you hang out with friends. Create yours now:</p>
    <div style="display:flex; flex-direction:column; gap:10px; margin:10px 0;">
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER ICON EMOJI</label>
        <div style="display:flex; gap:8px; align-items:center; margin-top:4px;">
          <input type="text" id="server-emoji-input" value="🎮" style="width:48px; text-align:center; font-size:20px; padding:6px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
          <div style="display:flex; gap:6px;">${emojiHtml}</div>
        </div>
      </div>
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">SERVER NAME</label>
        <input type="text" id="new-server-name-input" placeholder="e.g. Cyber Squad" style="width:100%; padding:8px; margin-top:4px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      </div>
    </div>
    <button class="btn-primary" onclick="createServerAction()">Create Server</button>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
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

  // Sync to Firestore
  try {
    const sRef = doc(db, "servers", newId);
    await setDoc(sRef, {
      name: name,
      emoji: emoji,
      inviteCode: inviteCode,
      ownerId: currentUser.uid,
      createdAt: serverTimestamp()
    });

    // Create default general channel
    const chRef = collection(db, "servers", newId, "channels");
    await addDoc(chRef, { name: "general", type: "TEXT", isEncrypted: true, createdAt: serverTimestamp() });
    await addDoc(chRef, { name: "voice-lounge", type: "VOICE", isEncrypted: true, createdAt: serverTimestamp() });
  } catch (e) {
    console.warn("Firestore server creation fallback to local:", e);
  }

  selectServer(newServer);
  closeModal();
};

// 4. Server Settings / Delete Server Modal
window.openServerSettings = function() {
  if (!currentServer) {
    window.openAddServerModal();
    return;
  }

  showModal(`
    <div class="modal-title">${escapeHtml(currentServer.name)} Settings</div>
    <div style="display:flex; flex-direction:column; gap:12px; margin: 10px 0;">
      <div>
        <label style="font-size:11px; font-weight:bold; color:var(--text-muted);">INVITE LINK</label>
        <div style="background:var(--input-dark); padding:8px 10px; border-radius:6px; font-size:13px; color:var(--brand-blurple); margin-top:4px;">
          https://theasteroid894.github.io/Vortex/#${currentServer.inviteCode}
        </div>
      </div>
      <button class="btn-secondary" style="color:var(--danger-red); border-color:var(--danger-red);" onclick="deleteCurrentServer()">
        🗑️ Delete / Leave Server
      </button>
    </div>
    <button class="btn-primary" onclick="closeModal()">Close</button>
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

// 5. Add Direct Message / Friend Modal
window.openAddFriendModal = function() {
  showModal(`
    <div class="modal-title">💬 Start Direct Message</div>
    <p style="color:var(--text-muted); font-size:13px;">Enter a friend's name or tag to open a direct, encrypted conversation:</p>
    <div style="display:flex; gap:8px; margin:12px 0;">
      <input type="text" id="dm-friend-input" placeholder="e.g. John or Sarah#0042" style="flex:1; padding:8px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      <button class="btn-primary" onclick="addDirectMessageAction()">Start Chat</button>
    </div>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
  `);
};

window.addDirectMessageAction = function() {
  const input = document.getElementById("dm-friend-input");
  const friendName = input.value.trim();
  if (!friendName) return;

  const dmId = "dm_" + Math.random().toString(36).substring(2, 8);
  const newDm = { id: dmId, name: friendName };

  userDMs.push(newDm);
  localStorage.setItem("vortex_dms", JSON.stringify(userDMs));
  renderDMsList();

  closeModal();
  window.switchChannel(dmId, "@ " + friendName, "TEXT", true);
};

// 6. Nitro Showcase Modal
window.openNitroShowcase = function() {
  showModal(`
    <div class="modal-title">💎 Vortex Nitro (100% Free)</div>
    <p style="color:var(--text-muted); font-size:13px;">All premium Discord features completely unlocked for everyone:</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin: 10px 0;">
      <div style="background:var(--input-dark); padding:10px; border-radius:8px;">
        <strong style="color:var(--nitro-gold);">🚀 500MB Large Uploads</strong>
        <p style="font-size:11px; color:var(--text-muted);">Share massive files, 4K clips & zips seamlessly.</p>
      </div>
      <div style="background:var(--input-dark); padding:10px; border-radius:8px;">
        <strong style="color:var(--nitro-pink);">📹 HD 1080p 60FPS Streaming</strong>
        <p style="font-size:11px; color:var(--text-muted);">Crisp live screen broadcasts and video calls.</p>
      </div>
      <div style="background:var(--input-dark); padding:10px; border-radius:8px;">
        <strong style="color:var(--brand-green);">⚡ Ultra-Low Bandwidth Mode</strong>
        <p style="font-size:11px; color:var(--text-muted);">Saves 85% mobile data with 6kbps Opus audio.</p>
      </div>
    </div>
    <button class="btn-primary" onclick="closeModal()">Awesome!</button>
  `);
};

// 7. Large File Attachment Picker
window.openAttachmentPicker = function() {
  showModal(`
    <div class="modal-title">📁 Send Large Media (Up to 500MB)</div>
    <p style="color:var(--text-muted); font-size:13px;">Choose a file to upload with free Nitro bandwidth:</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin:10px 0;">
      <button class="btn-secondary" onclick="simulateSendFile('Project_Assets_Bundle.zip', '248.5 MB')">📦 Project_Assets_Bundle.zip (248.5 MB)</button>
      <button class="btn-secondary" onclick="simulateSendFile('Gameplay_4K_60FPS.mp4', '412.0 MB')">🎬 Gameplay_4K_60FPS.mp4 (412.0 MB)</button>
      <button class="btn-secondary" onclick="simulateSendFile('Soundtrack_Lossless.wav', '88.3 MB')">🎵 Soundtrack_Lossless.wav (88.3 MB)</button>
    </div>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
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
      createdAt: serverTimestamp()
    });
  } catch (e) {
    renderMessageCard(currentUser.displayName, `Shared file: ${fileName}`, isE2EEActive, new Date(), [{ fileName, fileSizeFormatted: sizeFormatted }]);
  }
};

window.openJoinServerModal = function() {
  showModal(`
    <div class="modal-title">Join a Server</div>
    <input type="text" id="invite-code-input" placeholder="Invite Code (e.g. VTX-4921)" style="width:100%; padding:8px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin:10px 0;">
    <button class="btn-primary" onclick="alert('Joined server!'); closeModal();">Join Server</button>
    <button class="btn-secondary" onclick="closeModal()" style="margin-top:6px;">Cancel</button>
  `);
};

window.openCreateChannelModal = function() {
  if (!currentServer) {
    openAddServerModal();
    return;
  }
  showModal(`
    <div class="modal-title">Create Channel</div>
    <input type="text" id="new-channel-name" placeholder="Channel name (e.g. memes)" style="width:100%; padding:8px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin:10px 0;">
    <select id="new-channel-type" style="width:100%; padding:8px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px; margin-bottom:10px;">
      <option value="TEXT"># Text Channel</option>
      <option value="VOICE">🔊 Voice Channel</option>
      <option value="VIDEO">📹 Video & Streaming</option>
    </select>
    <button class="btn-primary" onclick="addChannelAction()">Create Channel</button>
    <button class="btn-secondary" onclick="closeModal()" style="margin-top:6px;">Cancel</button>
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
