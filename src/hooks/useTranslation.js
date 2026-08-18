import { useCallback, useRef, useState } from "react";

/**
 * Frontend half of the STT -> MT -> TTS pipeline (brief Section 1, Flow 05).
 * The heavy lifting (Bhashini orchestration) lives on the backend —
 * this hook only:
 *   1. Records short audio chunks from a MediaStream (remote peer's audio)
 *   2. Ships each chunk to the backend over the signaling socket
 *   3. Plays back whatever translated-audio blob the backend returns
 *
 * Backend contract (adjust to match Member B's actual implementation):
 *   emit "translate-audio-chunk" { to, targetLang, audioBlob }
 *   on   "translated-audio"      { from, audioUrl, translatedText }
 */
export function useTranslation({ socket, targetLang }) {
  const [enabled, setEnabled] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const recorderRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());

  const startTranslating = useCallback(
    (remoteStream, remoteSocketId) => {
      if (!remoteStream || !socket) return;

      const audioOnlyStream = new MediaStream(remoteStream.getAudioTracks());
      const recorder = new MediaRecorder(audioOnlyStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      // Stream ~2s chunks — small enough to keep latency near the
      // brief's 2-3s target (Section 7), large enough for usable STT.
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          socket.emit("translate-audio-chunk", {
            to: remoteSocketId,
            targetLang,
            audioBlob: event.data,
          });
        }
      };

      recorder.start(2000);
      recorderRef.current = recorder;
      setEnabled(true);
    },
    [socket, targetLang]
  );

  const stopTranslating = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setEnabled(false);
  }, []);

  const listenForTranslatedAudio = useCallback(() => {
    if (!socket) return () => {};

    const handler = ({ audioUrl, translatedText }) => {
      setLastTranscript(translatedText || "");
      if (audioUrl) {
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play().catch((e) =>
          console.warn("Autoplay of translated audio blocked", e)
        );
      }
    };

    socket.on("translated-audio", handler);
    return () => socket.off("translated-audio", handler);
  }, [socket]);

  return {
    enabled,
    lastTranscript,
    startTranslating,
    stopTranslating,
    listenForTranslatedAudio,
  };
}
