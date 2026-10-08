export function WorkflowStepper({
  steps,
  current,
  reached,
  onChange,
}: {
  steps: string[];
  current: number;
  reached: number;
  onChange: (step: number) => void;
}) {
  return (
    <ol className="stepper" aria-label="Training setup steps">
      {steps.map((label, index) => (
        <li
          key={label}
          className={
            index === current ? "active" : index < current ? "completed" : ""
          }
        >
          <button
            type="button"
            disabled={index > reached}
            aria-current={index === current ? "step" : undefined}
            onClick={() => onChange(index)}
          >
            <span className="step-number">
              {index < current ? "✓" : index + 1}
            </span>
            <span>{label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
