import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  title,
  busy = false,
  onClose,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="notebook-modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="notebook-modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="secondary small"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
