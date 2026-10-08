import { useState } from "react";
import type { HubProps } from "@/app/types";
import { DatasetCollectionSources } from "@/features/datasets/components/DatasetCollectionSources";
import { DatasetPreview } from "@/features/datasets/components/DatasetPreview";
import { DatasetSourceBrowser } from "@/features/datasets/components/DatasetSourceBrowser";
import { DatasetTable } from "@/features/datasets/components/DatasetTable";

export function DatasetsPage(props: HubProps) {
  const [selected, setSelected] = useState("");
  const selectedDataset = props.datasets.find(
    (dataset) => dataset.id === selected,
  );
  return (
    <div className="workspace-grid dataset-workspace">
      <div>
        <DatasetSourceBrowser {...props} onCreated={setSelected} />
      </div>
      <div>
        <DatasetTable
          datasets={props.datasets}
          busy={props.busy}
          act={props.act}
          selected={selected}
          onSelect={setSelected}
        />
        {selectedDataset && (
          <DatasetCollectionSources dataset={selectedDataset} />
        )}
        {selected && (
          <DatasetPreview {...props} key={selected} selected={selected} />
        )}
      </div>
    </div>
  );
}
