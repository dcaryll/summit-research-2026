# Why you might not see your changes (and how to fix it)

This doc explains common reasons the app looks unchanged after edits, and a repeatable way to always see the latest code.

## Root causes

### 1. **Wrong port / multiple dev servers**

- The app2 dev server is configured to use **port 5181** only (`strictPort: true`).
- If you (or another terminal) previously ran `npm run dev` and it bound to **5182**, **5183**, etc. (because 5181 was in use), you may have tabs open on those ports.
- **What you see:** An old bundle. Edits don’t show because the browser is talking to a different (or stale) server.

**Fix:** Use exactly the URL Vite prints when you start the server, e.g. `http://localhost:5181`. Close tabs on other ports (e.g. 5173, 5182).

### 2. **Port 5181 already in use**

- Another process (old `vite` or another app) is still using 5181.
- Vite will now **fail to start** with a clear error instead of switching to another port.

**Fix:** Stop the other process, then start again:

```bash
cd app2
npm run dev:single   # kills anything on 5181, then starts Vite
# or manually:
lsof -ti:5181 | xargs kill -9   # macOS/Linux
npm run dev
```

### 3. **Browser cache**

- The browser may serve cached JS/CSS instead of the new bundle.

**Fix:** Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux). Or open the app in an incognito/private window.

### 4. **Vite cache**

- Vite’s cache under `node_modules/.vite` can sometimes serve stale output.

**Fix:** Clear cache and restart:

```bash
cd app2
npm run dev:fresh
```

Then open **http://localhost:5181** and hard refresh (Cmd+Shift+R).

### 5. **Wrong app or build**

- **app1** (wizard-of-os) and **app2** (user-study-screener) are different apps and ports.
- If you’re viewing a **production build** (e.g. `npm run build` then `npm run preview`), you’re seeing the last build, not live dev.

**Fix:** Run dev from the app you’re editing:

```bash
cd app2
npm run dev
```

Use the printed URL (e.g. `http://localhost:5181`). In dev you should see a small label at bottom-right: **“dev · Take-study-on-card · http://localhost:5181”**. If you don’t see that label, you’re not on the app2 dev server.

---

## Repeatable “see my changes” workflow

1. **One dev server only**  
   From `app2`:
   ```bash
   npm run dev:single
   ```
   (Or `npm run dev` if you’re sure nothing is on 5181.)

2. **Open the printed URL**  
   Use exactly what Vite prints, e.g. `http://localhost:5181`.

3. **Confirm you’re on dev**  
   Check for the small “dev · Take-study-on-card · http://localhost:5181” text at bottom-right. If it’s missing, you’re on the wrong tab or build.

4. **After editing**  
   Hard refresh (**Cmd+Shift+R** / **Ctrl+Shift+R**). If changes still don’t appear, run `npm run dev:fresh` and repeat from step 2.

---

## Quick checklist

- [ ] I ran `npm run dev` (or `dev:single`) from **app2**.
- [ ] I opened the URL Vite printed (e.g. **http://localhost:5181**).
- [ ] I see the dev label at bottom-right (“dev · Take-study-on-card · http://localhost:5181”).
- [ ] I did a hard refresh (Cmd+Shift+R) after my last edit.
- [ ] I’m not on a tab with a different port (e.g. 5173 or 5182).

If all are true and the UI still doesn’t match the code, the next step is to confirm the exact URL in the address bar and that no other dev server is running on another port.
