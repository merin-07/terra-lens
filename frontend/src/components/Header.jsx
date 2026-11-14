import { Globe2, FileText, Activity } from "lucide-react";

export default function Header({
  activeTarget,
  activeAnalog,
  onOpenDossier,
}) {
  return (
    <header className="workbench-topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <Globe2 size={24} className="brand-logo-icon" />
          <div className="brand-titles">
            <h2>TERRA-LENS</h2>
            <span>PLANETARY ANALOG WORKBENCH</span>
          </div>
        </div>

        <div className="topbar-telemetry-tag">
          <span className="telemetry-live-dot" />
          <span>MISSION CONTEXT: </span>
          <strong>{activeTarget?.name?.split("&")[0].trim()}</strong>
          <span className="telemetry-separator">⟷</span>
          <strong>{activeAnalog?.name}</strong>
        </div>
      </div>

      <div className="topbar-right">
        <div className="system-pill">
          <Activity size={12} color="#76d8c0" />
          <span>DUAL SCOPE: LOCKED</span>
        </div>

        <button className="generate-dossier-btn" onClick={onOpenDossier}>
          <FileText size={15} />
          <span>GENERATE CAMPAIGN BRIEF</span>
        </button>
      </div>
    </header>
  );
}
