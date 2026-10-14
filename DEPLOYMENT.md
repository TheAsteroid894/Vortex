# Vortex Web - GitHub Pages Deployment Guide

This repository contains the complete cross-platform **Vortex** system:
1. **Android Native Application**: Built with Jetpack Compose, Kotlin, Credential Manager, and Firebase SDK.
2. **Web Companion Application**: Located in `/docs` (and bundled in Android assets), connecting directly to the same live Firebase Firestore database (`ai-studio-android-vortex-e2d58943-f665-4c2a-bdf6-e27d84876409`) with AES-GCM End-to-End Encryption.

---

## Quick Step-by-Step GitHub Pages Deployment

### Step 1: Push Repository to GitHub
If you haven't already pushed this project to your GitHub account:
1. In AI Studio, click the **Settings / GitHub** icon or export the project as a ZIP.
2. Or in your local git repository:
   ```bash
   git add .
   git commit -m "Add Vortex Web companion and GitHub Pages deployment"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

---

### Step 2: Enable GitHub Pages in 2 Clicks
1. On GitHub, open your repository: `https://github.com/<your-username>/<your-repo-name>`
2. Click **Settings** (top navigation tab with gear icon).
3. In the left sidebar, click **Pages** (under the "Code and automation" section).
4. Under **Build and deployment** > **Source**, select:
   - **Deploy from a branch**
   - Branch: **`main`** (or `master`)
   - Folder: **`/docs`**
5. Click **Save**!
6. In ~60 seconds, GitHub Pages will display your live site link:
   `https://<your-username>.github.io/<your-repo-name>/`

*(Alternative: You can also select **GitHub Actions** as the source, which will automatically run `.github/workflows/deploy-pages.yml` on every push!)*

---

### Step 3: Enable Google Sign-In on Your GitHub Pages Domain
To allow users to sign in with their Google accounts on your custom GitHub Pages domain:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select the project: **`gen-lang-client-0796013424`**.
3. In the left navigation menu, click **Authentication** (under Build).
4. Go to the **Settings** tab at the top.
5. Under **Authorized domains**, click **Add domain**.
6. Type your GitHub domain:
   ```
   <your-username>.github.io
   ```
7. Click **Done**.

Now your web users can sign in with Google, send encrypted messages, join voice stages, and share large media files seamlessly with all Android mobile users in real time!
