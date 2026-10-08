import { ModelsPage } from "@/pages/ModelsPage";
import { ResultsNavigation } from "@/components/layout/ResultsNavigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { Notice } from "@/components/ui/Notice";
import { useHub } from "@/hooks/useHub";
import { ComparisonPage } from "@/pages/ComparisonPage";
import { DatasetsPage } from "@/pages/DatasetsPage";
import { EvaluationPage } from "@/pages/EvaluationPage";
import { InferencePage } from "@/pages/InferencePage";
import { JobsPage } from "@/pages/JobsPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { SavedResultsPage } from "@/pages/SavedResultsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TrainingPage } from "@/pages/TrainingPage";

export function App() {
  const {
    page,
    props,
    health,
    workers,
    connected,
    refresh,
    actionError,
    message,
  } = useHub();
  return (
    <AppLayout
      page={page}
      go={props.go}
      connected={connected}
      loading={health.loading}
      onRefresh={refresh}
    >
      {health.error && (
        <Notice error>
          Cannot reach the backend: {health.error}.{" "}
          <button className="text-button" onClick={() => props.go("settings")}>
            Check connection settings
          </button>
        </Notice>
      )}
      <Notice error>{actionError}</Notice>
      <Notice>{message}</Notice>
      {["results", "evaluation", "comparison"].includes(page) && (
        <ResultsNavigation page={page} go={props.go} />
      )}
      {page === "models" && <ModelsPage {...props} />}
      {page === "results" && <SavedResultsPage {...props} />}
      {page === "overview" && <OverviewPage {...props} workers={workers} />}
      {page === "datasets" && <DatasetsPage {...props} />}
      {page === "training" && <TrainingPage {...props} />}
      {page === "inference" && <InferencePage {...props} />}
      {page === "evaluation" && <EvaluationPage {...props} />}
      {page === "comparison" && <ComparisonPage {...props} />}
      {page === "jobs" && <JobsPage {...props} />}
      {page === "settings" && <SettingsPage {...props} onSave={refresh} />}
    </AppLayout>
  );
}
