# Vortex Web - GitHub Pages Deployment Guide

This repository contains the complete cross-platform **Vortex** system:
1. **Android Native Application**: Built with Jetpack Compose, Kotlin, Credential Manager, and Firebase SDK.
2. **Web Companion Application**: Located in `/docs` (and bundled in Android assets), connecting directly to the same live Firebase Firestore database (`ai-studio-android-vortex-e2d58943-f665-4c2a-bdf6-e27d84876409`) with AES-GCM End-to-End Encryption.

---

## Deployment Methods

You have two easy ways to deploy on GitHub Pages:

### Method A: Native Branch Deployment (Recommended — No Actions Required)
This is the simplest, zero-failure way to deploy because it does not require configuring GitHub Actions permissions:
1. Go to your repository on GitHub.
2. Click **Settings** (top navigation bar) → **Pages** (in the left sidebar).
3. Under **Build and deployment** > **Source**:
   - Select **Deploy from a branch**
   - Branch: **`main`** (or `master`)
   - Folder: **`/docs`**
4. Click **Save**.
5. Your site is live immediately at `https://<your-username>.github.io/<your-repo-name>/`.

---

### Method B: GitHub Actions Workflow (`deploy-pages.yml`)
If you prefer automated CI/CD using GitHub Actions:
1. Go to **Settings** → **Pages**.
2. Under **Build and deployment** > **Source**, change the dropdown to **GitHub Actions**.
   > **Note:** If you run the workflow while Source is NOT set to "GitHub Actions", GitHub returns a `404 Not Found / Get Pages site failed` error.
3. The workflow in `.github/workflows/deploy-pages.yml` is already configured with:
   ```yaml
   with:
     enablement: true
     token: ${{ secrets.GITHUB_TOKEN }}
   ```
   This automatically enables the Pages API if it was not enabled before.
4. Go to **Actions** tab on GitHub → Click **Deploy Vortex Web to GitHub Pages** → Click **Run workflow**.

---

## Step 3: Enable Google Sign-In on Your GitHub Pages Domain
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
