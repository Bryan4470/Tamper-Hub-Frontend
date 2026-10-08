# Extractable components

## AppLayout

- Source: `src/components/layout/AppLayout.tsx`
- Category: layout
- Description: Persistent operations dashboard shell and navigation.
- Extractable props: active page, connection state.
- Hardcoded: navigation labels, icons, shell classes.

## Card

- Source: `src/components/ui/Card.tsx`
- Category: basic
- Description: Standard titled workspace surface.
- Extractable props: title, subtitle, action, children.

## Field

- Source: `src/components/ui/Field.tsx`
- Category: basic
- Description: Label, form control, and optional hint.
- Extractable props: label, hint, children.

## Picker

- Source: `src/components/forms/Picker.tsx`
- Category: basic
- Description: Checkbox collection with selected count and sample metadata.
- Extractable props: label, items, selected, onChange.

## WorkflowStepper

- Source: `src/components/forms/WorkflowStepper.tsx`
- Category: basic
- Description: Four-step training workflow navigation.
- Extractable props: steps, current, reached, onChange.
