import { Card } from "@/components/ui/Card";
import { Empty } from "@/components/ui/Empty";

export function DatasetCollectionSources({
  dataset,
}: {
  dataset: {
    name?: string;
    source_paths?: string[] | null;
    source_path?: string | null;
  };
}) {
  const paths = dataset.source_paths?.length
    ? dataset.source_paths
    : dataset.source_path
      ? [dataset.source_path]
      : [];

  return (
    <Card
      title="Collection CSVs"
      subtitle={`${dataset.name} · ${paths.length} CSV ${paths.length === 1 ? "file" : "files"}`}
    >
      {paths.length ? (
        <ul className="collection-csv-list" aria-label="Collection CSV files">
          {paths.map((path, index) => (
            <li key={`${index}:${path}`}>
              <strong>{path.split(/[\\/]/).pop()}</strong>
              <code>{path}</code>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No source CSVs recorded">
          This dataset does not include saved source CSV paths.
        </Empty>
      )}
    </Card>
  );
}
