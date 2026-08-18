import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLocalMedia } from "../hooks/useLocalMedia";

/**
 * Shown before entering the actual meeting room. Lets guests type a
 * display name (logged-in users skip that) and confirm mic/cam look
 * right — mirrors the "no login needed for guests" requirement
 * (brief Section 2).
 */
export default function PreJoin() {
  const { meetingCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState("");
  const videoRef = useRef(null);
  const { stream, micOn, camOn, toggleMic, toggleCam, error } = useLocalMedia();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleEnter = (e) => {
    e.preventDefault();
    const name = user?.name || guestName.trim();
    if (!name) return;
    sessionStorage.setItem(`meeting-${meetingCode}-name`, name);
    navigate(`/meeting/${meetingCode}/room`);
  };

  return (
    <div className="prejoin-page">
      <div className="prejoin-preview">
        <video ref={videoRef} autoPlay muted playsInline />
        {error && <p className="form-error">{error}</p>}
        <div className="prejoin-controls">
          <button onClick={toggleMic}>{micOn ? "Mute mic" : "Unmute mic"}</button>
          <button onClick={toggleCam}>{camOn ? "Turn off camera" : "Turn on camera"}</button>
        </div>
      </div>

      <form className="prejoin-form" onSubmit={handleEnter}>
        <h2>Ready to join?</h2>
        {!user && (
          <label>
            Your name
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </label>
        )}
        <button type="submit">Join meeting</button>
      </form>
    </div>
  );
}
