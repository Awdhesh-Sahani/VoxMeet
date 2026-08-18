// Central place for env-driven config. Set these in a .env file
// (Vite requires the VITE_ prefix) — see .env.example.

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api";

export const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "http://localhost:8080";

// Public Google STUN server + your own coturn TURN server as fallback
// (mesh calls on real networks WILL fail without a TURN fallback —
// don't skip this in production).
export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: import.meta.env.VITE_TURN_URL || "turn:your-coturn-server:3478",
      username: import.meta.env.VITE_TURN_USERNAME || "",
      credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
    },
  ],
};

// Mesh topology cap per the project brief (Section 7 — known limitation)
export const MAX_MESH_PARTICIPANTS = 6;

export const SUPPORTED_LANGUAGES = [
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "bn", label: "Bengali" },
  { code: "mr", label: "Marathi" },
];
