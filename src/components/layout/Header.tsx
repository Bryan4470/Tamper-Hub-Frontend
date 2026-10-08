import type { HubProps, PageName } from "@/app/types";
import { HubIcon } from "@/components/ui/HubIcon";
export function Header({
  page,
  go,
  connected,
  loading,
}: {
  page: PageName;
  go: HubProps["go"];
  connected: boolean;
  loading: boolean;
}) {
  return (
    <header className="topbar">
      <div className="header-content">
        <button
          className="brand"
          onClick={() => go("overview")}
          aria-label="Tamper Hub home"
        >
          <span className="brand-mark">T</span>
          <span>
            <strong>Tamper Hub</strong>
            <small>Model operations for tamper detection</small>
          </span>
        </button>
        <div className="topbar-right">
          <span className={connected ? "connection online" : "connection"}>
            <i />
            {connected
              ? "API connected"
              : loading
                ? "Connecting…"
                : "API offline"}
          </span>
          {page !== "overview" && (
            <button className="home-button" onClick={() => go("overview")}>
              ← Home
            </button>
          )}
          <button
            className="settings-button"
            aria-label="Settings"
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => go("settings")}
          >
            <HubIcon name="settings" />
          </button>
        </div>
      </div>
    </header>
  );
}
