"use client";

type VoiceDebugPanelProps = {
  info: {
    enabled: boolean;
    isNativePlatform: boolean;
    path: string;
    languages: string[];
    voices: string[];
    lastError: string | null;
  };
};

export default function VoiceDebugPanel({ info }: VoiceDebugPanelProps) {
  if (!info.enabled) return null;

  return (
    <aside
      className="voice-debug-panel"
      aria-label="Voice diagnostics"
      style={{ marginTop: "16px", padding: "12px", border: "1px solid currentColor", fontSize: "0.85rem" }}
    >
      <strong>Voice diagnostics</strong>
      <dl>
        <dt>Capacitor native platform</dt>
        <dd>{String(info.isNativePlatform)}</dd>
        <dt>Speech path</dt>
        <dd>{info.path}</dd>
        <dt>Plugin languages</dt>
        <dd>{info.languages.length ? info.languages.join(", ") : "None reported"}</dd>
        <dt>Plugin voices</dt>
        <dd>{info.voices.length ? info.voices.join(", ") : "None reported"}</dd>
        <dt>Last error</dt>
        <dd>{info.lastError ?? "None"}</dd>
      </dl>
    </aside>
  );
}
