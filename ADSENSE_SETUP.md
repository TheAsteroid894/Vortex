# Google AdSense Setup Guide for Vortex

This guide walks you through connecting your personal **Google AdSense** account to your Vortex Web deployment.

---

## 🔒 Policy Compliant & User-Friendly by Design
Your Vortex deployment is set up with a **Zero-Distraction Guarantee**:
- Ads are **NEVER** shown in chat channels, servers, direct messages, or voice calls.
- AdSense units load **ONLY** when a user clicks *"Watch Ad to Unlock 1 Month Nitro"* or *"Watch Ad to Boost Server"*.
- This adheres strictly to Google AdSense policies regarding content visibility and non-intrusive ad placement.

---

## 🛠️ Step-by-Step Setup

### Step 1: Find Your Google AdSense Publisher ID
1. Log in to [Google AdSense](https://www.google.com/adsense).
2. In the left navigation menu, click **Account** ➔ **Settings** ➔ **Account info**.
3. Locate your **Publisher ID**. It looks like:
   ```
   ca-pub-1234567890123456
   ```

---

### Step 2: Create a Display Ad Unit (Optional but Recommended)
1. In Google AdSense, click **Ads** ➔ **By ad unit**.
2. Select **Display ads**.
3. Choose **Responsive** as the ad size and name it (e.g. `Vortex Reward Unit`).
4. Click **Create**.
5. Copy the `data-ad-slot` number (e.g. `9876543210`).

---

### Step 3: Put Your IDs Into Your Code
You only need to update two files:

#### 1. In `docs/index.html`:
Find line 10:
```html
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
```
Replace `ca-pub-XXXXXXXXXXXXXXXX` with your real Publisher ID (e.g. `ca-pub-1234567890123456`).

#### 2. In `docs/app.js`:
At the top of the file (around line 50), look for:
```javascript
export const ADSENSE_CONFIG = {
  client: "ca-pub-XXXXXXXXXXXXXXXX",
  slotId: "1234567890",
  enabled: true
};
```
Replace:
- `client`: with your Publisher ID (`ca-pub-...`).
- `slotId`: with your Ad Unit Slot ID (or keep as is for auto responsive matching).

---

### Step 4: Add Your GitHub Pages URL to AdSense Sites
1. In Google AdSense, click **Sites** on the left menu.
2. Click **New site**.
3. Enter your live site URL:
   ```
   https://<your-username>.github.io/<your-repo-name>/
   ```
4. Click **Save and continue** to request a site review.

---

## 💡 How Testing Works in the Meantime
While your domain is pending review by Google, Vortex includes an automatic **Dual-Mode Engine**:
- If AdSense is pending review or an ad blocker is running, Vortex automatically displays a high-definition gaming partner sponsor preview.
- The 15-second countdown timer, progress bar, and "Claim 30 Days Nitro" reward buttons continue to function smoothly so users can always test and claim their monthly rewards.
