# Vortex Web - GitHub Pages Live Deployment Plan

Deploy the Vortex Discord-style web client directly to GitHub Pages with live Firebase Firestore real-time synchronization, WebRTC-compatible voice and video stages, End-to-End Encryption, and 100% feature parity with the Android mobile application.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and deployment decisions have been confirmed for this implementation:

- **Confirmed Decision 1 (Feature Parity)**: The web client will function identically to the Android application, featuring server management, channel creation, Direct Messages with friend tags, E2EE message cryptography, interactive voice/video stages, ultra-low bandwidth mode (6kbps), and 500MB free Nitro uploads.
- **Confirmed Decision 2 (Live Cloud Sync)**: The web app connects directly to the live Vortex Firebase backend (`gen-lang-client-0796013424`, database `ai-studio-android-vortex-e2d58943-f665-4c2a-bdf6-e27d84876409`) via the official Firebase Web Modular SDK v10+. Any message or server created on Android appears instantly on the web and vice versa.
- **Confirmed Decision 3 (GitHub Pages Structure)**: Deploy via a dedicated `/docs` root directory containing the production-ready web application (`index.html`, `app.js`, `style.css`, assets) alongside a preconfigured GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) for seamless one-click publishing.

---

## 1. Overview & Core Concept

- **What It Does**: Delivers a full-featured, zero-install, Discord-style community web platform hosted for free on GitHub Pages (`https://<username>.github.io/<repo>/`). Users can access the app from any browser (desktop, tablet, or smartphone) with instant cross-platform real-time sync with mobile Android users.
- **Target Audience**: Gamers, developer communities, and privacy-focused groups needing lightweight, end-to-end encrypted voice and text chat that works anywhere without requiring app installation or paid subscriptions.
- **Key Value**: Free global hosting via GitHub Pages + serverless real-time database via Firebase Firestore + client-side AES-GCM privacy.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Launch & Authentication**:
   - The user opens the GitHub Pages URL.
   - A modern Discord-style login screen offers one-click Google Sign-In via Firebase Auth or guest session mode.
2. **Server & Channel Navigation**:
   - 3-column layout on wide screens: Left Server Rail (72px) → Middle Channel Sidebar (240px) → Main Chat / Stage Area.
   - On mobile viewports: Responsive drawer navigation with smooth slide-over gesture controls.
3. **Real-Time Encrypted Chatting**:
   - User types messages in `#general` or private Direct Messages.
   - Messages are encrypted on-device with AES-GCM and stored in Cloud Firestore.
   - Live snapshot listeners immediately update chat bubbles across all connected Web and Android devices.
4. **Voice & Video Calling Stage**:
   - Clicking a voice or video channel transitions into the live stage grid with glowing green speaking indicators, mute/deafen controls, camera feed, and screen sharing.
5. **Nitro Perks & Large Media Sharing**:
   - Seamless drag-and-drop file uploads supporting up to 500MB files with free Nitro tier badges.

### Visual Identity & Theme Tokens
- **Theme**: Premium Discord Cyber Dark
- **Color Tokens**:
  - Background Base: `#1E1F22`
  - Sidebar & Surfaces: `#2B2D31`
  - Chat Area: `#313338`
  - Input & Cards: `#383A40`
  - Discord Blurple: `#5865F2`
  - Online Green: `#23A55A`
  - Nitro Pink: `#EB459E`
  - Nitro Gold: `#FEE75C`
  - Danger Red: `#ED4245`
- **Typography**: Clean sans-serif hierarchy matching modern Discord UI (`gg sans`, system-ui, BlinkMacSystemFont).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Modular Firebase Web SDK vs REST API**
  - *Chosen Approach*: Official Firebase JS SDK v10 (modular CDN bundle).
  - *Why*: Provides native WebSocket real-time snapshot listeners (`onSnapshot`), offline caching, and automatic reconnection matching the Android Firestore client.
  - *Alternative Considered*: Fetching via REST API—rejected due to lack of real-time multi-user push updates without heavy polling.

- **Decision 2: Dual Deployment Pipeline (/docs + GitHub Actions)**
  - *Chosen Approach*: Provide both `/docs` directory for instant one-click GitHub Pages setup and `.github/workflows/deploy-pages.yml` for automated CI/CD.
  - *Why*: Allows beginners to enable GitHub Pages in 2 clicks under repository settings, while giving advanced developers automated deployment on git push.

- **Decision 3: Web Crypto API (SubtleCrypto) for E2EE**
  - *Chosen Approach*: Native browser `window.crypto.subtle` AES-GCM (256-bit) with PBKDF2/SHA-256 key derivation.
  - *Why*: Matches Android's `javax.crypto.Cipher` AES-GCM implementation bit-for-bit, allowing Android and Web clients to decrypt each other's messages seamlessly.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Vortex Community Ecosystem                       │
└────────────────────────────────────────────────────────────────────────┘
          ▲                                              ▲
          │ WebRTC / Firestore                           │ Real-time Flow
          ▼                                              ▼
┌───────────────────────────────┐              ┌─────────────────────────┐
│     Android Mobile App        │              │   GitHub Pages Web App  │
│  (Kotlin, Compose, Firebase)  │              │  (/docs or gh-pages)    │
│  • Jetpack Credential Manager │              │  • Firebase Web SDK     │
│  • AES-GCM E2EE Engine        │              │  • SubtleCrypto E2EE    │
│  • Low-Bandwidth Opus (6kbps) │              │  • Responsive 3-Pane UI │
└──────────────┬────────────────┘              └────────────┬────────────┘
               │                                            │
               ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Google Cloud / Firebase Project                         │
│            Project ID: gen-lang-client-0796013424                      │
│            Database: ai-studio-android-vortex-...                      │
│  • /users/{userId}           • /servers/{serverId}                     │
│  • /channels/{channelId}     • /messages/{messageId}                   │
│  • /voice_sessions/{chId}    • /friend_requests/{reqId}                │
└────────────────────────────────────────────────────────────────────────┘
```

### Components to Build & Deploy:
1. **`/docs/index.html`**: Production-ready, responsive single-page web app with Firebase v10 SDK, Web Crypto AES-GCM, real-time Firestore listeners, and Discord UI.
2. **`/docs/app.js`**: Core client business logic, authentication state observer, server/channel manager, voice room signaling, and E2EE cryptography matching `E2EEManager.kt`.
3. **`/docs/style.css`**: Pixel-perfect Discord design system with desktop, tablet, and mobile breakpoints.
4. **`.github/workflows/deploy-pages.yml`**: Official GitHub Pages Actions workflow for automated deployment.
5. **`DEPLOYMENT.md`**: Clear, step-by-step documentation on how to push the repo to GitHub and activate GitHub Pages in repository settings.
