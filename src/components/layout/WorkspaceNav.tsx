import { navigation } from "@/app/navigation";
import type { HubProps, PageName } from "@/app/types";
import { HubIcon } from "@/components/ui/HubIcon";
export function WorkspaceNav({
  page,
  go,
}: {
  page: PageName;
  go: HubProps["go"];
}) {
  return (
    <div className="workspace-nav-wrap">
      <nav className="workspace-nav" aria-label="Main navigation">
        {navigation.map(([id, label]) => (
          <button
            key={id}
            className={page === id ? "nav-link active" : "nav-link"}
            aria-current={page === id ? "page" : undefined}
            onClick={() => go(id)}
          >
            <HubIcon name={id} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
