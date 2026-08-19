# VoxMeet — Frontend (Member A scope)

React + native WebRTC frontend for the project brief's MVP:
auth pages, dashboard, meeting room with mesh video/audio, and the
client side of the live-translation feature.

## Setup

```bash
npm install
cp .env.example .env   # fill in backend URL, TURN creds, Google client id
npm run dev
```

Runs on `http://localhost:5173`. Expects the Spring Boot backend
(Member B) at the URL in `.env` for both REST (`/api/...`) and the
Socket.IO signaling server.

## Folder structure

```
src/
  api/            axios client + REST calls (auth, meetings)
  context/        AuthContext (JWT in localStorage, current user)
  hooks/
    useLocalMedia.js   getUserMedia + mic/cam toggle
    useSignaling.js    Socket.IO connection
    useWebRTC.js       mesh: one RTCPeerConnection per remote peer
    useTranslation.js  captures a peer's audio, sends to backend,
                        plays back the translated audio it returns
  components/     VideoGrid, VideoTile, Controls, TranslationPanel
  pages/
    Login / Signup      email+password (Google OAuth button stubbed)
    Dashboard            create meeting / join by code or link
    PreJoin              mic/cam check + guest name before entering
    MeetingRoom          the actual call screen
```

## JWT storage decision (viva-ready answer)

Token is kept **in memory only** (`src/state/authStore.js`), not in
localStorage or a cookie. Full reasoning is in that file's header
comment — short version: httpOnly cookies are the most secure option
but need the backend to `Set-Cookie` (ours returns JSON), and between
localStorage and memory, memory isn't readable by an injected XSS
script. Trade-off accepted: a page refresh logs you out.

## What's real vs. stubbed

- **WebRTC mesh signaling** (`useWebRTC.js`) is fully implemented
  against a specific socket event contract — see the comment at the
  top of the file. Match those event names on the Spring Boot
  WebSocket/Socket.IO server, or rename on either side.
- **Translation** (`useTranslation.js`) records 2s audio chunks and
  emits them over the socket; it expects the backend to run
  STT → MT → TTS (Bhashini) and emit `translated-audio` back. The
  frontend does not talk to Bhashini directly.
- **Google OAuth** button is present but disabled — wire it to
  Google Identity Services and call `authApi.googleLogin(idToken)`
  once you have a client ID.
- REST endpoints in `api/authApi.js` are guesses at a REST shape
  (`/auth/login`, `/meetings`, etc.) — align field names with
  whatever Member B actually builds.

## Known limitation (by design, per brief Section 7)

Mesh tops out around 4-6 participants — each browser opens N-1 peer
connections. Fine for the MVP demo; would need an SFU to scale
further.
