import type { ReactNode } from "react";
import type { HubProps, PageName } from "@/app/types";
import { Header } from "@/components/layout/Header";
import { PageHeading } from "@/components/layout/PageHeading";
import { WorkspaceNav } from "@/components/layout/WorkspaceNav";

export function AppLayout({
  page,
  go,
  connected,
  loading,
  onRefresh,
  children,
}: {
  page: PageName;
  go: HubProps["go"];
  connected: boolean;
  loading: boolean;
  onRefresh: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        "app-shell",
        "theme-" + page,
        page === "overview" ? "home-shell" : "",
      ].join(" ")}
    >
      <div className="main-shell">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <Header page={page} go={go} connected={connected} loading={loading} />
        <WorkspaceNav page={page} go={go} />
        <main id="main-content" tabIndex={-1}>
          {page !== "overview" && (
            <PageHeading page={page} onRefresh={onRefresh} />
          )}
          {children}
        </main>
        <footer className="page-footer">
          Tamper Hub <span>Train · Infer · Evaluate</span>
        </footer>
      </div>
    </div>
  );
}
