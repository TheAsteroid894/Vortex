# Vortex Web - Manual GitHub Pages Deployment Guide

Your production web client is completely ready in the `/docs` directory (`/docs/index.html`, `/docs/app.js`, `/docs/style.css`).

Manual branch deployment is the official, zero-failure method that **does not require GitHub Actions, tokens, or workflow permissions**.

---

## 3-Step Manual Deployment

### Step 1: Push Your Code
Ensure your latest changes (including the `/docs` folder) are pushed to GitHub:
```bash
git add .
git commit -m "Add Vortex Web companion in /docs"
git push origin main
```

---

### Step 2: Enable GitHub Pages in 2 Clicks
1. Open your repository on GitHub:
   `https://github.com/<your-username>/<your-repo-name>`
2. Click **Settings** (top navigation bar, with the gear icon).
3. In the left-hand sidebar, click **Pages** (under the "Code and automation" section).
4. Under **Build and deployment** > **Source**, choose:
   - Source: **Deploy from a branch**
   - Branch: **`main`** (or `master`)
   - Folder: **`/docs`** *(critical: select `/docs`, not `/ (root)`)*
5. Click **Save**.

That's it! GitHub will publish your site in ~30–60 seconds at:
```
https://<your-username>.github.io/<your-repo-name>/
```
A green box will appear at the top of that page with the link once it finishes.

---

### Step 3: Authorize Google Sign-In on Your GitHub Domain
To allow users to sign in with their Google accounts on your live GitHub Pages URL:
1. Open [Firebase Console](https://console.firebase.google.com/) and click your project: **`gen-lang-client-0796013424`**.
2. In the left menu, click **Authentication** (under Build).
3. Click the **Settings** tab at the top.
4. Under **Authorized domains**, click **Add domain**.
5. Type your GitHub domain:
   ```
   <your-username>.github.io
   ```
6. Click **Done**.

---

### Summary of Live Features on Web:
- **Real-Time Cross-Platform Sync**: All servers, channels, and messages created on Android or Web sync instantly via Firebase Firestore.
- **End-to-End Encryption (E2EE)**: Messages encrypted with AES-GCM-256 before leaving your browser.
- **Voice & Video Stage**: Live participant tiles with speaking rings, mute, deafen, and screen sharing.
- **Direct Messages**: Chat 1-on-1 with friends using their username and tag.
- **Free Nitro Perks**: Drag & drop 500MB file uploads, custom emojis, and level 3 server boosts.
