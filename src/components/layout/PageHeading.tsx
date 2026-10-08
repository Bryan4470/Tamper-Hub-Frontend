import { titles } from "@/app/navigation";
import type { PageName } from "@/app/types";

export function PageHeading({
  page,
  onRefresh,
}: {
  page: PageName;
  onRefresh: () => void;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">TAMPER DETECTION</div>
        <h1>{titles[page][0]}</h1>
        <p>{titles[page][1]}</p>
      </div>
      <button className="secondary" onClick={onRefresh}>
        ↻ Refresh
      </button>
    </div>
  );
}
