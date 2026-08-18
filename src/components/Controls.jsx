export default function Controls({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  translationOpen,
  onToggleTranslation,
  onLeave,
  meetingLink,
}) {
  const copyLink = () => {
    navigator.clipboard.writeText(meetingLink);
  };

  return (
    <div className="controls-bar">
      <button
        className={micOn ? "control-btn" : "control-btn control-off"}
        onClick={onToggleMic}
        aria-pressed={!micOn}
      >
        {micOn ? "Mute" : "Unmute"}
      </button>

      <button
        className={camOn ? "control-btn" : "control-btn control-off"}
        onClick={onToggleCam}
        aria-pressed={!camOn}
      >
        {camOn ? "Stop video" : "Start video"}
      </button>

      <button
        className={translationOpen ? "control-btn control-active" : "control-btn"}
        onClick={onToggleTranslation}
      >
        Translate
      </button>

      <button className="control-btn" onClick={copyLink}>
        Copy link
      </button>

      <button className="control-btn control-leave" onClick={onLeave}>
        Leave
      </button>
    </div>
  );
}
