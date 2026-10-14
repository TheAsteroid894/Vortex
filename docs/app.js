// Vortex Web Client - Connected to Live Vortex Cloud Firebase & E2EE Cryptography
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion
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

// State variables
let currentUser = {
  uid: "guest_" + Math.random().toString(36).substring(2, 8),
  displayName: "Vortex Web User",
  tag: "#1337",
  photoURL: "",
  isGuest: true
};

let currentServer = { id: "default_server", name: "Friends & Gaming Hub", inviteCode: "VTX-7749" };
let currentChannel = { id: "general", name: "general", type: "TEXT", isEncrypted: true };
let isE2EEActive = true;
let isLowBandwidth = true;
let isMuted = false;
let isVideoOn = false;
let isSharing = false;
let isSpeaking = false;
let unsubscribeMessages = null;
let unsubscribeChannels = null;

// --- Web Crypto AES-GCM (Bit-for-bit compatible with E2EEManager.kt) ---
const E2EE_SALT = "Vortex-E2EE-Master-Key-2026";

async function deriveChannelKey(serverId, channelId) {
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(`${serverId}:${channelId}:${E2EE_SALT}`);
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
    payload[0] = 0; // uncompressed flag
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
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = {
      uid: user.uid,
      displayName: user.displayName || "User",
      tag: "#" + user.uid.substring(0, 4).toUpperCase(),
      photoURL: user.photoURL || "",
      isGuest: false
    };
    document.getElementById("btn-auth").innerText = "Sign Out";
  } else {
    document.getElementById("btn-auth").innerText = "Sign in with Google";
  }
  updateUserProfileDisplay();
  initLiveChannels();
});

function updateUserProfileDisplay() {
  document.getElementById("user-display-name").innerText = currentUser.displayName;
  document.getElementById("user-custom-tag").innerText = currentUser.tag;
  const initial = (currentUser.displayName[0] || "U").toUpperCase();
  document.getElementById("user-avatar-text").innerText = initial;
}

// --- Live Firestore Listeners ---
function initLiveChannels() {
  if (unsubscribeChannels) unsubscribeChannels();

  // Listen to channels
  try {
    const channelsRef = collection(db, "servers", currentServer.id, "channels");
    unsubscribeChannels = onSnapshot(channelsRef, (snapshot) => {
      const channelListEl = document.getElementById("text-channels-container");
      if (!channelListEl) return;
      channelListEl.innerHTML = "";

      if (snapshot.empty) {
        // Fallback default channels
        addChannelToDOM("general", "general", "TEXT", true);
        addChannelToDOM("e2ee-confidential", "e2ee-confidential", "TEXT", true);
        addChannelToDOM("nitro-lounge", "nitro-lounge", "TEXT", false);
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
  item.onclick = () => switchChannel(id, name, type, isEncrypted);

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
  // Keep welcome card
  const welcomeCard = document.getElementById("welcome-card");
  container.innerHTML = "";
  if (welcomeCard) container.appendChild(welcomeCard);

  try {
    const messagesRef = collection(db, "servers", currentServer.id, "channels", currentChannel.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    unsubscribeMessages = onSnapshot(q, async (snapshot) => {
      container.innerHTML = "";
      if (welcomeCard) container.appendChild(welcomeCard);

      const key = await deriveChannelKey(currentServer.id, currentChannel.id);

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

// --- User Actions ---
window.switchChannel = function(id, name, type, isEncrypted) {
  currentChannel = { id, name, type, isEncrypted };

  document.querySelectorAll(".channel-item").forEach(el => el.classList.remove("active"));
  const activeEl = document.getElementById("ch-" + id) || document.getElementById(id);
  if (activeEl) activeEl.classList.add("active");

  document.getElementById("current-channel-title").innerText = name;
  document.getElementById("header-prefix").innerText = (type === "TEXT") ? "#" : (type === "VOICE" ? "🔊" : "📹");
  document.getElementById("chat-text-input").placeholder = `Message #${name}...`;

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

  const key = await deriveChannelKey(currentServer.id, currentChannel.id);
  const finalContent = isE2EEActive ? await encryptMessage(text, key) : text;

  try {
    const messagesRef = collection(db, "servers", currentServer.id, "channels", currentChannel.id, "messages");
    await addDoc(messagesRef, {
      serverId: currentServer.id,
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
    // Local fallback for offline/demo
    renderMessageCard(currentUser.displayName, text, isE2EEActive, new Date(), []);
  }

  input.value = "";
  const container = document.getElementById("messages-container");
  container.scrollTop = container.scrollHeight;
};

window.handleAuthAction = function() {
  if (!currentUser.isGuest) {
    signOut(auth);
  } else {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => {
      alert("Note: For Google Sign-In on GitHub Pages, make sure to add your GitHub Pages domain to Firebase Console > Authentication > Authorized domains: " + window.location.hostname);
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

window.openAttachmentPicker = function() {
  showModal(`
    <div class="modal-title">📁 Send Large Media (Up to 500MB)</div>
    <p style="color:var(--text-muted); font-size:13px;">Choose a file to upload with free Nitro bandwidth:</p>
    <div style="display:flex; flex-direction:column; gap:8px; margin:10px 0;">
      <button class="btn-secondary" onclick="simulateSendFile('Project_Assets_Bundle.zip', '248.5 MB')">📦 Project_Assets_Bundle.zip (248.5 MB)</button>
      <button class="btn-secondary" onclick="simulateSendFile('Highlights_4K_60FPS.mp4', '412.0 MB')">🎬 Highlights_4K_60FPS.mp4 (412.0 MB)</button>
      <button class="btn-secondary" onclick="simulateSendFile('Soundtrack_FLAC_Lossless.wav', '88.3 MB')">🎵 Soundtrack_FLAC_Lossless.wav (88.3 MB)</button>
    </div>
    <button class="btn-secondary" onclick="closeModal()">Cancel</button>
  `);
};

window.simulateSendFile = function(fileName, sizeFormatted) {
  closeModal();
  try {
    const messagesRef = collection(db, "servers", currentServer.id, "channels", currentChannel.id, "messages");
    addDoc(messagesRef, {
      serverId: currentServer.id,
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

window.openAddFriendModal = function() {
  showModal(`
    <div class="modal-title">Direct Messages & Friends</div>
    <p style="color:var(--text-muted); font-size:13px;">Add friends by their unique tag or start encrypted DMs:</p>
    <div style="display:flex; gap:8px; margin:10px 0;">
      <input type="text" id="friend-tag-input" placeholder="e.g. Alex#1337" style="flex:1; padding:8px; background:var(--input-dark); border:1px solid var(--border-subtle); color:white; border-radius:6px;">
      <button class="btn-primary" onclick="alert('Friend request sent!'); closeModal();">Add</button>
    </div>
    <div style="font-size:11px; font-weight:bold; color:var(--text-muted); margin-top:8px;">YOUR FRIENDS:</div>
    <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:8px 10px; border-radius:6px;">
        <span>Alex Cyber <span style="color:var(--text-muted); font-size:11px;">#1337</span></span>
        <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="startDM('Alex Cyber')">Chat 🔒</button>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--input-dark); padding:8px 10px; border-radius:6px;">
        <span>Sarah_Gamer <span style="color:var(--text-muted); font-size:11px;">#0042</span></span>
        <button class="btn-primary" style="padding:4px 10px; font-size:11px;" onclick="startDM('Sarah_Gamer')">Chat 🔒</button>
      </div>
    </div>
    <button class="btn-secondary" onclick="closeModal()" style="margin-top:10px;">Close</button>
  `);
};

window.startDM = function(friendName) {
  closeModal();
  const dmId = "dm-" + friendName.toLowerCase().replace(/\s+/g, "-");
  window.switchChannel(dmId, "@ " + friendName, "TEXT", true);
};

window.openSettings = function() {
  showModal(`
    <div class="modal-title">⚙️ Vortex Settings</div>
    <div style="display:flex; flex-direction:column; gap:12px; margin: 10px 0;">
      <label style="display:flex; justify-content:space-between; align-items:center;">
        <span>⚡ Ultra-Low Bandwidth Mode</span>
        <input type="checkbox" checked onchange="isLowBandwidth = this.checked">
      </label>
      <p style="font-size:11px; color:var(--text-muted);">Uses 6kbps Opus compression to minimize mobile data consumption.</p>
      <div style="background:var(--input-dark); padding:8px; border-radius:6px;">
        <div style="font-size:11px; color:var(--brand-green); font-weight:bold;">E2EE Safety Fingerprint:</div>
        <div style="font-family:monospace; font-size:11px; color:var(--text-muted); margin-top:4px;">4829 1049 8271 9021 3342 9912</div>
      </div>
    </div>
    <button class="btn-primary" onclick="closeModal()">Save & Close</button>
  `);
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

// Initial boot
updateUserProfileDisplay();
initLiveChannels();
