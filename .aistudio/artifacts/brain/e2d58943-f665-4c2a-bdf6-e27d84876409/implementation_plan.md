# Implementation Plan: Real-Time WebRTC Voice Channels & Video Streaming

Build a production-grade, zero-external-server WebRTC peer-to-peer audio and video communication pipeline for Vortex using Firebase Firestore as the real-time signaling backbone and Google's public STUN servers for NAT traversal.

## User Review Required

> [!IMPORTANT]
> - **Zero-Cost Infrastructure**: Uses Google's free public STUN servers (`stun:stun.l.google.com:19302`) for peer-to-peer NAT traversal without requiring paid TURN or media servers.
> - **Mesh WebRTC Network**: Ideal for Discord-style small community channels (2–8 active voice/video participants). Peers connect directly to each other via browser-native `RTCPeerConnection`.
> - **Browser Permissions**: First-time voice channel join prompts for Microphone (`audio`) and optional Camera (`video`) permissions.

---

## Architecture & Proposed Changes

### 1. Firestore WebRTC Signaling Layer
- **Channel Session Document**: `voice_sessions/{channelId}` tracks channel participants, active stream types (voice, video, screen), and encryption status.
- **Peer Signaling Subcollections**:
  - `voice_sessions/{channelId}/peers/{peerId}`: Stores SDP Offer and SDP Answer.
  - `voice_sessions/{channelId}/peers/{peerId}/candidates`: Real-time queue for ICE candidates (`RTCIceCandidate`) exchanged between connecting clients.
- **Presence & Heartbeat**: When disconnecting or closing the tab, `beforeunload` and `disconnectVoice()` automatically clean up peer signaling documents.

### 2. Audio & Video Engine (`docs/app.js` & `assets/web/app.js`)
- **`WebRTCVoiceEngine` Module**:
  - **Microphone & Camera Acquisition**: `navigator.mediaDevices.getUserMedia({ audio: true, video: isVideoOn })`.
  - **Peer Mesh Management**: Automatically initiates WebRTC offers to existing participants when joining a channel, and handles incoming offers from newcomers.
  - **Remote Audio Playback**: Attaches incoming remote `MediaStream` audio tracks to dynamic HTML5 `<audio>` elements for crystal-clear real-time playback.
  - **Live Camera & Screen Sharing**: Seamlessly replaces or adds video tracks to existing peer connections, rendering live camera feeds or screen streams onto stage video tiles (`<video autoplay playsinline>`).
  - **Voice Activity Detection (VAD) & Web Audio Analyser**: Uses `AudioContext` and `AnalyserNode` to compute RMS volume in real-time, illuminating the green speaking indicator ring around avatars when talking.
  - **Push-to-Talk (PTT)**:
    - Global key listener (default `Space` or `Control`) toggles audio track transmission only while held down.
    - Status badge in the voice bar displaying "Push-to-Talk (HOLD SPACE)" or "Voice Activity".

### 3. Voice Stage & Controls UI (`docs/index.html` & `docs/style.css`)
- **Interactive Stage Grid**: Responsive CSS grid supporting 1 to 8 camera/avatar tiles with speaker glow rings and status pills.
- **Enhanced Voice Bar**:
  - Live ping monitor, audio bitrate display, and active participant counter.
  - Quick action buttons: Mute (`🎙️`/`🔇`), Deafen (`🎧`), Camera (`📹`), Screen Share (`🖥️`), PTT Toggle, and Disconnect (`📞`).
- **Video Elements**: Added `<video>` tags with fallback avatar display when camera is muted.

### 4. Firestore Security Rules (`firestore.rules`)
- Update `match /voice_sessions/{channelId}` and subcollections `peers` and `candidates` to permit authenticated users to publish signaling SDPs and ICE candidates.
- Deploy updated security rules via `deploy_firebase`.

---

## Verification Plan

### Automated & Compilation Verification
1. Run `compile_applet` to verify Android build integrity and companion web asset syncing.
2. Deploy Firestore rules via `deploy_firebase` and verify emulator/remote rules acceptance.

### Manual CUJ Testing in Browser
1. **Microphone Capture & Voice Activity**:
   - Join `#voice-lounge`.
   - Grant microphone permission.
   - Verify green speaking glow illuminates when talking into the mic and turns off when silent or muted.
2. **Push-to-Talk**:
   - Enable Push-to-Talk mode and verify microphone only transmits while holding down the configured key.
3. **Multi-Peer WebRTC Audio Call**:
   - Open the development app URL in two browser windows or on two devices.
   - Join the same voice channel in both windows.
   - Verify WebRTC peer connection transitions to `"connected"`, and audio from Window A plays cleanly in Window B.
4. **Camera Video & Screen Share**:
   - Toggle Camera button and verify local and remote video feed renders on stage tile.
