import { useEffect, useRef, useState, useCallback } from "react";
import { ICE_SERVERS } from "../utils/constants";

/**
 * usePeerConnections — the WebRTC mesh layer.
 *
 * Mesh topology: every participant opens ONE RTCPeerConnection to
 * EVERY other participant directly (no central media server). For
 * N participants that's N-1 connections per browser — fine up to
 * ~4-6 people (this project's MVP cap), collapses beyond that
 * because upload bandwidth multiplies per peer. An SFU would be the
 * fix at scale, out of scope here.
 *
 * THE OFFER/ANSWER/ICE FLOW (viva notes):
 *
 * 1. getUserMedia() grabs local mic+camera as a MediaStream.
 *
 * 2. When we join a room that already has people in it, WE are the
 *    "caller" to each of them: for each existing peer we create an
 *    RTCPeerConnection, attach our local tracks, call
 *    createOffer() (this generates an SDP blob describing our
 *    codecs/resolution/etc.), setLocalDescription(offer) on our own
 *    connection, then send that SDP over the WebSocket signaling
 *    channel to the specific peer.
 *
 * 3. The receiving peer gets our "offer" message. They create their
 *    OWN RTCPeerConnection for us, call
 *    setRemoteDescription(offer) (now they know our capabilities),
 *    then createAnswer() (their own SDP), setLocalDescription(answer),
 *    and send the answer back to us over the socket.
 *
 * 4. We receive their "answer" and call setRemoteDescription(answer)
 *    on the SAME peer connection we made the offer on. Both sides
 *    now agree on codecs/formats — the SDP negotiation is done.
 *
 * 5. Separately and asynchronously, ICE candidates: the moment
 *    either side creates a peer connection, the browser starts
 *    discovering possible network paths (local IP, public IP via
 *    STUN, relay via TURN) and fires `onicecandidate` repeatedly.
 *    Each candidate is sent to the other peer immediately over the
 *    socket as it's found — this does NOT wait for the offer/answer
 *    exchange to finish. The other side calls addIceCandidate() for
 *    each one it receives. Once both sides have exchanged enough
 *    candidates to find a working path, `connectionState` flips to
 *    "connected" and media starts flowing peer-to-peer.
 *
 * SDP = what to send (codecs, resolution). ICE = how to send it
 * (which network path). Both are required; they're negotiated in
 * parallel, not sequentially.
 *
 * STUN vs TURN: STUN (Google's public server, used below) just
 * tells a peer its own public IP:port so the OTHER peer can try to
 * connect directly — works for most home/office NATs. It fails for
 * symmetric NATs or strict corporate firewalls. TURN is a relay
 * server that both peers' media flows THROUGH when a direct path
 * isn't possible — you'd add one (e.g. self-hosted coturn) in
 * ICE_SERVERS in src/utils/constants.js as a paid/self-hosted
 * fallback before a real deployment; STUN alone is enough for local
 * dev and most demo environments.
 *
 * Signaling contract expected on `socket` (matches the WebSocket
 * server from Phase 1):
 *   emit "join-room"      { meetingId, userName }
 *   on   "existing-peers"  [{ socketId, userName }]
 *   on   "peer-joined"     { socketId, userName }
 *   emit "offer"           { to, sdp, userName }
 *   on   "offer"           { from, sdp, userName }
 *   emit "answer"          { to, sdp }
 *   on   "answer"          { from, sdp }
 *   emit "ice-candidate"   { to, candidate }
 *   on   "ice-candidate"   { from, candidate }
 *   on   "peer-left"       { socketId }
 */
export function usePeerConnections({ socket, meetingId, userName }) {
  const [localStream, setLocalStream] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  // { [socketId]: { stream: MediaStream, userName: string } }
  const [remoteStreams, setRemoteStreams] = useState({});

  const peerConnections = useRef({}); // { [socketId]: RTCPeerConnection }
  const localStreamRef = useRef(null); // mirrors localStream for use inside closures/handlers

  // ---- Step 2 (part 1): getUserMedia on mount ----
  useEffect(() => {
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch((err) => {
        console.error("getUserMedia failed", err);
        setMediaError(
          "Camera/mic access denied or unavailable. Check browser permissions."
        );
      });

    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const closePeer = useCallback((socketId) => {
    peerConnections.current[socketId]?.close();
    delete peerConnections.current[socketId];
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  }, []);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const toggleMic = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }, []);

  // ---- Step 6: full leave-meeting cleanup ----
  // Called explicitly from the "Leave" button — distinct from the
  // socket-disconnect cleanup in the effect's return, so leaving is
  // deliberate and immediate rather than waiting on a disconnect event.
  const leaveRoom = useCallback(() => {
    socket?.emit("leave-room", { meetingId });

    Object.keys(peerConnections.current).forEach((socketId) => {
      peerConnections.current[socketId]?.close();
    });
    peerConnections.current = {};

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    setLocalStream(null);
    setRemoteStreams({});
  }, [socket, meetingId]);

  // ---- Step 1: one RTCPeerConnection per remote participant ----
  const createPeerConnection = useCallback(
    (remoteSocketId, remoteUserName) => {
      if (peerConnections.current[remoteSocketId]) {
        return peerConnections.current[remoteSocketId];
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);

      // Push our local mic/cam tracks onto this connection so the
      // remote side receives them
      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      // ---- Step 5: ICE candidates, fired continuously as the
      // browser discovers network paths ----
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            to: remoteSocketId,
            candidate: event.candidate,
          });
        }
      };

      // ---- Step 7: track remote streams per participant ----
      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({
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
    [socket, closePeer]
  );

  useEffect(() => {
    if (!socket || !localStream) return;

    socket.emit("join-room", { meetingId, userName });

    // ---- Step 2: we are the caller to everyone already in the room ----
    const handleExistingPeers = async (peers) => {
      for (const { socketId, userName: remoteName } of peers) {
        const pc = createPeerConnection(socketId, remoteName);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: socketId, sdp: offer, userName });
      }
    };

    // A new peer joined after us — we wait for THEIR offer, we don't
    // send one (avoids both sides racing to offer each other)
    const handlePeerJoined = ({ socketId, userName: remoteName }) => {
      createPeerConnection(socketId, remoteName);
    };

    // ---- Step 3: handle an incoming offer ----
    const handleOffer = async ({ from, sdp, userName: remoteName }) => {
      const pc = createPeerConnection(from, remoteName);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { to: from, sdp: answer });
    };

    // ---- Step 4: handle an incoming answer ----
    const handleAnswer = async ({ from, sdp }) => {
      const pc = peerConnections.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    };

    // ---- Step 5: handle an incoming ICE candidate ----
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
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("peer-left", handlePeerLeft);

    return () => {
      socket.off("existing-peers", handleExistingPeers);
      socket.off("peer-joined", handlePeerJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("peer-left", handlePeerLeft);
      Object.keys(peerConnections.current).forEach(closePeer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, localStream, meetingId, createPeerConnection, closePeer]);

  return {
    localStream,
    mediaError,
    remoteStreams,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    leaveRoom,
  };
}
