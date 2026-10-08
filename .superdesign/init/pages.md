# Page dependency trees

## Training

Entry: `src/pages/TrainingPage.tsx`

- `src/features/training/components/TrainingForm.tsx`
  - `src/components/forms/DeviceSelect.tsx`
  - `src/components/forms/Picker.tsx`
  - `src/components/forms/WorkflowStepper.tsx`
  - `src/components/ui/BusyButton.tsx`
  - `src/components/ui/Card.tsx`
  - `src/components/ui/Field.tsx`
  - `src/components/ui/Notice.tsx`
  - `src/hooks/useRemote.ts`
- `src/features/training/components/TrainingImportForm.tsx`
- `src/features/training/components/TrainingRunDetails.tsx`
- `src/components/data-display/Table.tsx`
- `src/components/data-display/runColumns.tsx`
- `src/components/ui/Card.tsx`
- `src/components/ui/Empty.tsx`
- `src/components/ui/Notice.tsx`
- `src/hooks/useRemote.ts`
- `src/styles/global.css`

The requested target is the four-step `TrainingForm`, especially Datasets and Configuration.
