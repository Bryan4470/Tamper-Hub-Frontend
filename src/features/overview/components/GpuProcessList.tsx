import type { Row } from "@/api/types";
import { number } from "@/utils/format";

export function GpuProcessList({ processes }: { processes?: Row[] }) {
  return (
    <details className="gpu-processes">
      <summary>
        GPU processes{processes ? ` (${processes.length})` : ""}
      </summary>
      {!processes ? (
        <p>Process details are unavailable from this backend.</p>
      ) : processes.length === 0 ? (
        <p>No active compute processes reported.</p>
      ) : (
        <ul>
          {processes.map((process, index) => (
            <li key={process.pid ?? index}>
              <dl>
                <div>
                  <dt>Owner</dt>
                  <dd>{process.owner ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>PID</dt>
                  <dd>{process.pid ?? "Unavailable"}</dd>
                </div>
                <div>
                  <dt>GPU memory</dt>
                  <dd>
                    {process.memory_mb == null
                      ? "Unavailable"
                      : `${number(process.memory_mb)} MiB`}
                  </dd>
                </div>
              </dl>
              <code>
                {process.command || process.process || "Command unavailable"}
              </code>
            </li>
          ))}
        </ul>
      )}
      <p>
        Linux account owners. Compute processes only; their memory may not add
        up to the GPU total.
      </p>
    </details>
  );
}
