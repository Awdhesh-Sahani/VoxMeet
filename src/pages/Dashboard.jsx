import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { meetingApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    setMeetingLink("");
    try {
      const { data } = await meetingApi.create();
      const link =
        data.joinLink || `${window.location.origin}/join/${data.meetingId}`;
      setMeetingLink(link);
    } catch (err) {
      setError("Couldn't create meeting. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    // Accept either a bare meetingId or a full pasted link
    const meetingId = joinCode.trim().split("/").pop();
    navigate(`/join/${meetingId}`);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>VoxMeet</h1>
        <div>
          <span className="user-name">{user?.name}</span>
          <button className="btn-link" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="dashboard-actions">
        <div className="action-card">
          <h2>Start a meeting</h2>
          <p>Get a sharable link instantly. No one needs an account to join.</p>
          <button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating…" : "New meeting"}
          </button>

          {meetingLink && (
            <div className="generated-link">
              <input value={meetingLink} readOnly />
              <button type="button" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>

        <div className="action-card">
          <h2>Join a meeting</h2>
          <form onSubmit={handleJoin}>
            <input
              placeholder="Paste link or enter meeting ID"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    </div>
  );
}
