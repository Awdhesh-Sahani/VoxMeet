import { useEffect, useRef, useState, useCallback } from "react";
import { ICE_SERVERS } from "../utils/constants";

/**
 * Mesh WebRTC: every participant opens a direct RTCPeerConnection to
 * every other participant. Fine for the MVP's 4-6 person cap
 * (see brief, Section 7) — would need an SFU beyond that.
 *
 * Signaling contract expected on `socket` (Socket.IO):
 *   emit   "join-room"        { meetingId, userName }
 *   on     "existing-peers"   [{ socketId, userName }]        -> we call these
 *   on     "peer-joined"      { socketId, userName }          -> they call us
 *   emit   "webrtc-offer"     { to, offer, userName }
 *   on     "webrtc-offer"     { from, offer, userName }
 *   emit   "webrtc-answer"    { to, answer }
 *   on     "webrtc-answer"    { from, answer }
 *   emit   "ice-candidate"    { to, candidate }
 *   on     "ice-candidate"    { from, candidate }
 *   on     "peer-left"        { socketId }
 */
export function useWebRTC({ socket, meetingId, userName, localStream }) {
  // { [socketId]: { stream: MediaStream, userName: string } }
  const [remoteParticipants, setRemoteParticipants] = useState({});
  const peerConnections = useRef({}); // { [socketId]: RTCPeerConnection }

  const createPeerConnection = useCallback(
    (remoteSocketId, remoteUserName) => {
      if (peerConnections.current[remoteSocketId]) {
        return peerConnections.current[remoteSocketId];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Push our local tracks (mic/cam) onto this new connection
      localStream?.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            to: remoteSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        setRemoteParticipants((prev) => ({
          ...prev,
          [remoteSocketId]: {
            userName: remoteUserName,
            stream: event.streams[0],
          },
        }));
      };

      pc.onconnectionstatechange = () => {
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          closePeer(remoteSocketId);
        }
      };

      peerConnections.current[remoteSocketId] = pc;
      return pc;
    },
    [localStream, socket]
  );

  const closePeer = (socketId) => {
    peerConnections.current[socketId]?.close();
    delete peerConnections.current[socketId];
    setRemoteParticipants((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  useEffect(() => {
    if (!socket || !localStream) return;

    socket.emit("join-room", { meetingId, userName });

    // We are the "caller" to everyone already in the room
    const handleExistingPeers = async (peers) => {
      for (const { socketId, userName: remoteName } of peers) {
        const pc = createPeerConnection(socketId, remoteName);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", { to: socketId, offer, userName });
      }
    };

    // A new peer joined after us — wait for their offer, don't send one
    const handlePeerJoined = ({ socketId, userName: remoteName }) => {
      createPeerConnection(socketId, remoteName);
    };

    const handleOffer = async ({ from, offer, userName: remoteName }) => {
      const pc = createPeerConnection(from, remoteName);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-answer", { to: from, answer });
    };

    const handleAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const handleIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("Failed to add ICE candidate", err);
        }
      }
    };

    const handlePeerLeft = ({ socketId }) => closePeer(socketId);

    socket.on("existing-peers", handleExistingPeers);
    socket.on("peer-joined", handlePeerJoined);
    socket.on("webrtc-offer", handleOffer);
    socket.on("webrtc-answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("peer-left", handlePeerLeft);

    return () => {
      socket.off("existing-peers", handleExistingPeers);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("webrtc-offer", handleOffer);
      socket.off("webrtc-answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("peer-left", handlePeerLeft);
      Object.keys(peerConnections.current).forEach(closePeer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, localStream, meetingId]);

  return { remoteParticipants };
}
