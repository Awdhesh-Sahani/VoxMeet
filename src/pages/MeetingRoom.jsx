import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSignaling } from "../hooks/useSignaling";
import { usePeerConnections } from "../hooks/usePeerConnections";
import { useTranslation } from "../hooks/useTranslation";
import VideoGrid from "../components/VideoGrid";
import Controls from "../components/Controls";
import TranslationPanel from "../components/TranslationPanel";

export default function MeetingRoom() {
  const { meetingCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const userName =
    user?.name ||
    sessionStorage.getItem(`meeting-${meetingCode}-name`) ||
    "Guest";

  const { socket, connected } = useSignaling();
  const {
    localStream,
    mediaError,
    remoteStreams: remoteParticipants,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    leaveRoom,
  } = usePeerConnections({ socket, meetingId: meetingCode, userName });

  const [translationOpen, setTranslationOpen] = useState(false);
  const [targetLang, setTargetLang] = useState("ta");
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  const {
    enabled: translating,
    lastTranscript,
    startTranslating,
    stopTranslating,
    listenForTranslatedAudio,
  } = useTranslation({ socket, targetLang });

  useEffect(() => {
    if (!socket) return;
    return listenForTranslatedAudio();
  }, [socket, listenForTranslatedAudio]);

  // If no name was set (direct URL hit, no pre-join), send guests back
  useEffect(() => {
    if (!user && userName === "Guest") {
      navigate(`/meeting/${meetingCode}`, { replace: true });
    }
  }, [user, userName, meetingCode, navigate]);

  const handleStartTranslation = (speakerSocketId) => {
    const remoteStream = remoteParticipants[speakerSocketId]?.stream;
    if (!remoteStream) return;
    setActiveSpeakerId(speakerSocketId);
    startTranslating(remoteStream, speakerSocketId);
  };

  const handleStopTranslation = () => {
    stopTranslating();
    setActiveSpeakerId(null);
  };

  const handleLeave = () => {
    stopTranslating();
    leaveRoom(); // closes all RTCPeerConnections, stops local tracks, notifies signaling server
    navigate("/dashboard");
  };

  const meetingLink = `${window.location.origin}/meeting/${meetingCode}`;

  return (
    <div className="meeting-room">
      {mediaError && <p className="form-error">{mediaError}</p>}
      {!connected && <p className="connecting-banner">Connecting…</p>}

      <div className="meeting-body">
        <VideoGrid
          localStream={localStream}
          localName={userName}
          camOn={camOn}
          remoteParticipants={remoteParticipants}
        />

        {translationOpen && (
          <TranslationPanel
            remoteParticipants={remoteParticipants}
            targetLang={targetLang}
            onLangChange={setTargetLang}
            activeSpeakerId={activeSpeakerId}
            onStart={handleStartTranslation}
            onStop={handleStopTranslation}
            translating={translating}
            lastTranscript={lastTranscript}
          />
        )}
      </div>

      <Controls
        micOn={micOn}
        camOn={camOn}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        translationOpen={translationOpen}
        onToggleTranslation={() => setTranslationOpen((v) => !v)}
        onLeave={handleLeave}
        meetingLink={meetingLink}
      />
    </div>
  );
}
