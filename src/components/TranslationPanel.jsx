import { SUPPORTED_LANGUAGES } from "../utils/constants";

export default function TranslationPanel({
  remoteParticipants, // { [socketId]: { stream, userName } }
  targetLang,
  onLangChange,
  activeSpeakerId,
  onStart,
  onStop,
  translating,
  lastTranscript,
}) {
  const participantList = Object.entries(remoteParticipants);

  return (
    <aside className="translation-panel">
      <h3>Live translation</h3>
      <p className="panel-hint">
        Hindi speech se aapki chuni hui bhasha mein — near real-time.
      </p>

      <label>
        Translate into
        <select value={targetLang} onChange={(e) => onLangChange(e.target.value)}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </label>

      {participantList.length === 0 ? (
        <p className="panel-empty">Waiting for other participants to join…</p>
      ) : (
        <ul className="speaker-list">
          {participantList.map(([socketId, { userName }]) => (
            <li key={socketId}>
              <span>{userName}</span>
              {translating && activeSpeakerId === socketId ? (
                <button onClick={() => onStop()}>Stop</button>
              ) : (
                <button onClick={() => onStart(socketId)} disabled={translating}>
                  Translate them
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {lastTranscript && (
        <div className="live-transcript">
          <strong>Last translated line:</strong>
          <p>{lastTranscript}</p>
        </div>
      )}
    </aside>
  );
}
