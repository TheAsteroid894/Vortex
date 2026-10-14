# How to Put Your Vortex Website on GitHub Pages (Beginner-Friendly Guide)

Hey! Don't worry at all about code or weird errors. This is the **super easy manual way** to put your website online. You do **not** need any code, command lines, or tokens for this. You just click a few buttons on GitHub!

---

## 🌟 What we already built for you
All of your website files are already built and sitting inside the **`docs`** folder (`docs/index.html`, `docs/app.js`, `docs/style.css`).

---

## 🚀 3 Easy Steps to Put It Online

### Step 1: Open Your Repo on GitHub
1. Open your web browser and go to your repository on [GitHub](https://github.com).
2. Make sure you are on your Vortex repository page.

---

### Step 2: Turn on GitHub Pages (Just 4 Clicks!)
1. At the very top of your repo page, click on **Settings** (the little gear ⚙️ icon on the right side of the menu bar).
2. On the left side of the screen, scroll down a bit and click on **Pages** (under "Code and automation").
3. Look for the box called **Build and deployment**:
   - Under **Source**, make sure it says: **Deploy from a branch**.
   - Under **Branch**, choose: **`main`** (or `master` if your branch is called master).
   - Right next to that, click the folder dropdown and choose: **`/docs`** ⚠️ *(Make sure to pick `/docs`, NOT `/ (root)`!)*
4. Click the **Save** button.

🎉 **That's it!**
GitHub will now build your website in about 1 minute.
Refresh the page after 60 seconds, and you will see a big green box at the top that says:
👉 **"Your site is live at `https://<your-username>.github.io/<your-repo-name>/`"**

Click that link to open your Vortex website!

---

### Step 3: Let Users Sign In with Google
If you want people to log in using their Google account on your new website:
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click your project (**`gen-lang-client-0796013424`**).
3. On the left menu, click **Build** > **Authentication**.
4. Click the **Settings** tab at the top.
5. Scroll down to **Authorized domains** and click **Add domain**.
6. Type:
   ```
   <your-username>.github.io
   ```
   *(Replace `<your-username>` with your actual GitHub username!)*
7. Click **Done**.

Now Google Sign-In will work on your live website too!

---

## 🎮 What Features Are Working Right Now?

1. **Profiles & Usernames:** Change your Display Name, unique `@username`, custom tag, and profile banner.
2. **Themes & Custom Fonts:** Pick between Dark, Midnight AMOLED, Deep Sea Slate, and Light themes, change accent colors, and choose your favorite font (Modern Sans, Cyber Mono, Friendly Rounded, or Classic Serif). Everything stays saved in your browser!
3. **Servers & Channels:** Create your own servers with custom emoji icons, create text/voice/video channels, and delete servers or channels whenever you want.
4. **Direct Messages:** No fake mock DMs! Start real 1-on-1 private encrypted chats with anyone by typing their username or clicking their profile.
5. **Reactions & Pinned Messages:** React to any message with emojis (👍, ❤️, 🔥, 🚀, 💎) and pin important messages to the channel.
6. **Ad-Supported Nitro & Server Boosts:**
   - Watch a short 15-second sponsor video in Settings to unlock **1 Month of Vortex Nitro** or **1 Month Server Boost**.
   - **Zero-Ad Guarantee:** Ads are **NEVER** shown in chat, servers, or voice calls. They only play when you choose to watch one to get your monthly reward!
7. **Full Settings Page & Legal Documents:** Full Discord-style settings with My Account, User Profile, Appearance, Nitro, Voice & Video, Privacy, and complete legal documents (Terms of Service, Privacy Policy, Community Guidelines, and E2EE Architecture).
