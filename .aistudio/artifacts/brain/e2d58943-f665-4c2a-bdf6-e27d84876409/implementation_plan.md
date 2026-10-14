# Google AdSense Integration for Vortex

Integrate official Google AdSense into the Vortex Web client, specifically embedded within the **Nitro & Server Boosts** reward modal while preserving the zero-distraction guarantee across all chat channels and servers.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during clarification:
> - **Placement**: AdSense is restricted strictly to the reward modal when claiming 1 Month Nitro or Server Boosts.
> - **Publisher ID**: Configured with a ready-to-use placeholder (`ca-pub-XXXXXXXXXXXXXXXX`) and slot placeholder (`1234567890`), with simple configuration variables.
> - **Zero-Ad Chat Guarantee**: Chat channels, direct messages, servers, and voice/video rooms remain 100% ad-free.

---

## 1. Overview & Core Concept

- **What It Does**: Connects the Vortex Web reward center with Google AdSense. When users click "Watch Ad to Unlock 1 Month Nitro" or "Watch Ad to Boost Server", an AdSense responsive ad unit is displayed within the reward dialog. Completing the countdown unlocks 30 days of monthly Nitro perks and server boosts.
- **Target Audience**: Community members who want to support the server and unlock premium perks without recurring subscription costs.
- **Key Value**: Provides real monetization for the server administrator while keeping community communications completely ad-free.

---

## 2. User Experience & Visual Design

```
┌──────────────────────────────────────────────────────────────┐
│  💎 Nitro & Server Boosts (Settings Tab)                     │
│  ──────────────────────────────────────────────────────────  │
│  [🎬 Watch Ad for 1 Month Nitro]   [🚀 Boost Server (30d)]   │
└───────────────────────────────┬──────────────────────────────┘
                                │ User clicks "Watch Ad"
                                ▼
┌──────────────────────────────────────────────────────────────┐
│  🎬 SPONSORED REWARD AD                   ⏳ 15s Countdown   │
│  ──────────────────────────────────────────────────────────  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │   Google AdSense Responsive Unit                       │  │
│  │   <ins class="adsbygoogle"                             │  │
│  │        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"        │  │
│  │        data-ad-slot="1234567890"></ins>                │  │
│  │   (Interactive Ad Banner / Video Display)              │  │
│  └────────────────────────────────────────────────────────┘  │
│  [==========================                  ] Progress 60% │
│                                                              │
│  Reward: 1 Month Nitro                                       │
│  [ Claim 30 Days! (Enabled once countdown finishes) ]        │
└──────────────────────────────────────────────────────────────┘
```

- **Clean Reward Flow**:
  1. User navigates to Settings ➔ "Nitro & Server Boosts" or clicks the 💎 icon.
  2. User clicks "Watch Ad to Unlock 1 Month Nitro" or "Watch Ad to Boost Server".
  3. The reward modal opens, initializing the Google AdSense ad unit alongside a 15-second countdown timer and visual progress bar.
  4. If an ad is blocked by an adblocker or the AdSense account is still pending domain verification, a polished high-definition sponsor preview acts as an automatic fallback so users are never blocked from earning rewards.
  5. Upon timer completion, the "Claim 30 Days!" button activates with green highlight, granting the user monthly Nitro subscription status and boosting the server in Firestore.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Isolated Reward Modal Placement**:
  - *Chosen Approach*: Embed AdSense exclusively inside the reward modal dialogue, keeping the rest of the application completely free of banners or popups.
  - *Why*: AdSense policies strictly prohibit intrusive ads that interfere with user navigation. Isolating ads to explicit user-requested rewards provides higher click-through rates, adheres to Google Publisher Policies, and protects user trust.
- **Decision 2: Dual-Mode Engine (Live AdSense + Fallback)**:
  - *Chosen Approach*: Load `adsbygoogle.js` with responsive container formatting, while detecting ad load events. If AdSense is pending approval or blocked, seamlessly render the fallback interactive preview.
  - *Why*: Newly created AdSense accounts require site approval by Google before live ads appear. Dual-mode ensures the app functions immediately on development and testing environments without broken white boxes.
- **Decision 3: Dedicated AdSense Configuration & Setup Guide**:
  - *Chosen Approach*: Define centralized `ADSENSE_CONFIG` in `docs/app.js` and provide a step-by-step `ADSENSE_SETUP.md` guide explaining how to register the site and paste the publisher ID.

---

## 4. Technical Architecture & Implementation Steps

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend (docs/index.html & docs/app.js)                    │
│  ├── Google AdSense Library Script Tag                       │
│  │   └── pagead2.googlesyndication.com/pagead/js/adsbygoogle │
│  ├── ADSENSE_CONFIG Object                                   │
│  │   ├── client: "ca-pub-XXXXXXXXXXXXXXXX"                   │
│  │   ├── slotId: "1234567890"                                │
│  │   └── fallbackEnabled: true                               │
│  └── watchAdForReward(type) Handler                          │
│      ├── Dynamic <ins class="adsbygoogle"> Mount             │
│      ├── adsbygoogle.push({}) invocation                     │
│      ├── 15s Countdown Timer & Progress Animation            │
│      └── claimAdReward() ➔ Firestore & LocalStorage Sync     │
└──────────────────────────────────────────────────────────────┘
```

### Proposed Changes

1. **`docs/index.html`**:
   - Add AdSense script tag with configurable client publisher ID placeholder.
   - Add responsive CSS wrapper styles for the AdSense unit inside `.ad-modal-card`.

2. **`docs/app.js`**:
   - Add `ADSENSE_CONFIG` constant at the top of the file for quick user updates.
   - Update `watchAdForReward(rewardType)` to render the AdSense responsive ad container and invoke `(adsbygoogle = window.adsbygoogle || []).push({})`.
   - Maintain the timer countdown and reward claiming workflow.

3. **`ADSENSE_SETUP.md`**:
   - Create a dedicated guide detailing:
     - How to obtain an AdSense Publisher ID (`ca-pub-xxx`) and Ad Unit ID.
     - How to replace the placeholder in `docs/index.html` and `docs/app.js`.
     - How to add the GitHub Pages domain (`<username>.github.io`) to Google AdSense Sites list.
     - Policy compliance notes ensuring ads only trigger upon user reward requests.

4. **Android App (`Dialogs.kt`)**:
   - Ensure the Android companion reward dialog notes reference AdSense / AdMob compatibility and instructions.

---

## Verification Plan

1. **DOM & Script Loading**:
   - Verify `docs/index.html` correctly includes the AdSense script tag without breaking offline/local execution.
2. **Ad Modal Lifecycle**:
   - Open Settings ➔ Nitro & Boosts ➔ trigger "Watch Ad".
   - Confirm AdSense container initializes, countdown runs, and reward triggers properly.
3. **Android Build Verification**:
   - Run `compile_applet` to ensure full build compatibility.
