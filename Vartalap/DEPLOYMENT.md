# Vartalap — Deployment Guide

## The important constraint

**Vercel cannot run the Spring Boot backend.**

Vercel runs *serverless functions* — short-lived, stateless, and with no Java
runtime. This chat app needs a **long-running JVM process that keeps WebSocket
connections open**, which is the opposite of that model.

So the deployment is **split in two**:

| Part | What goes there | Host |
|---|---|---|
| Frontend | `index.html`, `css/`, `js/` | **Vercel** |
| Backend | Spring Boot + WebSocket | **Render / Railway / Fly.io** |

---

## Project hierarchy

The repo stays a single Maven project. Vercel is pointed at the static folder,
and the backend host uses the `Dockerfile`.

```
Vartalap/
├── pom.xml                 # Maven build (backend)
├── Dockerfile              # Used by Render/Railway/Fly
├── .dockerignore
├── .gitignore
├── vercel.json             # Tells Vercel: static only, no build
└── src/main/
    ├── java/org/example/vartalap/
    │   ├── VartalapApplication.java
    │   ├── config/WebSocketConfig.java
    │   ├── controller/ChatController.java
    │   ├── listener/WebSocketEventListener.java
    │   └── model/ChatMessage.java
    └── resources/
        ├── application.properties
        └── static/            <-- Vercel serves THIS folder
            ├── index.html
            ├── css/style.css
            └── js/
                ├── config.js  <-- points at the backend URL
                └── chat.js
```

`vercel.json` sets `outputDirectory` to `src/main/resources/static` with no
build step, so Vercel just serves those files.

---

## Step 1 — Deploy the backend first

You need its URL before configuring the frontend.

**Render (free tier):**
1. Push this repo to GitHub.
2. Render → **New → Web Service** → pick the repo.
3. Runtime: **Docker** (it detects the `Dockerfile`).
4. Deploy, then copy the URL, e.g. `https://vartalap-backend.onrender.com`.

Railway and Fly.io work the same way — both read the `Dockerfile`.
`PORT` is injected automatically and `application.properties` already reads it.

> Note: Render's free tier sleeps after inactivity, so the first
> connection may take ~30s to wake up.

## Step 2 — Point the frontend at the backend

Edit `src/main/resources/static/js/config.js`:

```js
window.BACKEND_URL = "https://vartalap-backend.onrender.com";
```

Leave it as `""` for local development, where Spring Boot serves the page itself.

## Step 3 — Deploy the frontend to Vercel

1. Vercel → **Add New → Project** → same repo.
2. Framework Preset: **Other**. `vercel.json` handles the rest.
3. Deploy → you get e.g. `https://vartalap.vercel.app`.

## Step 4 — Lock down CORS

On the **backend** host, set an environment variable:

```
ALLOWED_ORIGINS=https://vartalap.vercel.app
```

Then redeploy. Without this it defaults to `*`, which works but allows any site
to connect.

---

## Running locally

`BACKEND_URL` must be `""`, then:

```
mvn spring-boot:run
```

Open <http://localhost:8080> — Spring Boot serves both the page and the
WebSocket, so no CORS issues.

To test with two people, open a normal window and an **incognito** window,
use different names and the same room code.

---

## Simpler alternative

If the split feels like overhead, **skip Vercel entirely**. Deploying the
Docker image to Render alone serves the frontend *and* the backend from one
origin — one deploy, no CORS, no `config.js` to manage.

Use Vercel only if you specifically want its CDN and preview deployments.

---

## Note on message storage

Messages are held in memory only, so a restart clears history and it won't
scale past one instance. Adding Redis or Postgres would fix both.

