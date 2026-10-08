import type { HubProps, PageName } from "@/app/types";
export function ResultsNavigation({
  page,
  go,
}: {
  page: PageName;
  go: HubProps["go"];
}) {
  const destinations: [PageName, string][] = [
    ["results", "Saved Studio results"],
    ["evaluation", "Evaluation & thresholds"],
    ["comparison", "Model comparison"],
  ];
  return (
    <div className="section-tabs" role="group" aria-label="Results workspaces">
      {destinations.map(([id, label]) => (
        <button
          key={id}
          className={page === id ? "active" : ""}
          aria-current={page === id ? "page" : undefined}
          onClick={() => go(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
