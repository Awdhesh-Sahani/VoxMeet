import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { meetingApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

// Phase 1 stops here: validate the link, collect a guest name, hit
// the guest-join endpoint, and land on a placeholder. The actual
// video room (WebRTC mesh) is Phase 2 — see MeetingRoom.jsx, which
// this page will eventually hand off to.
export default function Join() {
  const { meetingId } = useParams();
  const { user } = useAuth();

  const [status, setStatus] = useState("valid"); // checking | valid | invalid | joining | connected
  const [meeting, setMeeting] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    meetingApi
      .getByCode(meetingId)
      .then((res) => {
        if (cancelled) return;
        setMeeting(res.data);
        setStatus("valid");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("invalid");
        setError("This meeting link is invalid or has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [meetingId]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("joining");
    try {
      if (!user) {
        await meetingApi.joinAsGuest(meetingId, guestName.trim());
      }
      setStatus("connected");
    } catch (err) {
      setStatus("valid");
      setError(err.response?.data?.message || "Couldn't join. Try again.");
    }
  };

  if (status === "checking") {
    return (
      <div className="join-page">
        <p>Checking meeting link…</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="join-page">
        <p className="form-error">{error}</p>
      </div>
    );
  }

  if (status === "connected") {
    return (
      <div className="join-page">
        <h2>Connected</h2>
        <p className="panel-hint">
          Waiting for video features — the meeting room UI lands in Phase 2.
        </p>
      </div>
    );
  }

  return (
    <div className="join-page">
      <form className="auth-card" onSubmit={handleJoin}>
        <h1>Join meeting</h1>
        {meeting && (
          <p className="panel-hint">Meeting: {meeting.title || meetingId}</p>
        )}
        {error && <p className="form-error">{error}</p>}

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

        <button type="submit" disabled={status === "joining"}>
          {status === "joining" ? "Joining…" : "Join"}
        </button>
      </form>
    </div>
  );
}
