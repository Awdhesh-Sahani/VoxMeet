import VideoTile from "./VideoTile";

export default function VideoGrid({
  localStream,
  localName,
  camOn,
  remoteParticipants, // { [socketId]: { stream, userName } }
}) {
  const remoteEntries = Object.entries(remoteParticipants);
  const tileCount = remoteEntries.length + 1;

  return (
    <div className="video-grid" data-count={Math.min(tileCount, 6)}>
      <VideoTile
        stream={localStream}
        userName={localName}
        camOn={camOn}
        isLocal
      />
      {remoteEntries.map(([socketId, { stream, userName }]) => (
        <VideoTile key={socketId} stream={stream} userName={userName} />
      ))}
    </div>
  );
}
