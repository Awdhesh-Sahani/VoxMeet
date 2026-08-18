import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SIGNALING_URL } from "../utils/constants";

/**
 * Opens one socket.io connection for the meeting room lifetime.
 * Kept separate from useWebRTC so the signaling transport can be
 * reused later (e.g. text chat) without touching peer-connection logic.
 */
export function useSignaling() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token"); // undefined for guests, that's fine
    const socket = io(SIGNALING_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, connected };
}
