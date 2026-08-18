import { useEffect, useRef } from "react";

export default function VideoTile({ stream, userName, isLocal, camOn = true }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = (userName || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="video-tile">
      {camOn ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="video-el"
        />
      ) : (
        <div className="video-placeholder">
          <span className="avatar-initials">{initials}</span>
        </div>
      )}
      <span className="video-tile-name">
        {userName} {isLocal && "(You)"}
      </span>
    </div>
  );
}
