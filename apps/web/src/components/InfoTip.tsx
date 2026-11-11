import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
/** Shared non-interactive tooltip: hover, focus, click/tap, Escape and outside dismissal. */
export function InfoTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId(),
    button = useRef<HTMLButtonElement>(null),
    tip = useRef<HTMLDivElement>(null),
    pinned = useRef(false),
    dismissed = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ left: 12, top: 12 });
  const show = () => {
    clearTimeout(timer.current);
    if (!dismissed.current) setOpen(true);
  };
  const hide = () => {
    if (!pinned.current) timer.current = setTimeout(() => setOpen(false), 120);
  };
  const close = () => {
    setOpen(false);
    pinned.current = false;
    dismissed.current = true;
  };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const b = button.current?.getBoundingClientRect(),
        t = tip.current?.getBoundingClientRect();
      if (!b || !t) return;
      setPosition({
        left: Math.max(12, Math.min(b.left, innerWidth - t.width - 12)),
        top: Math.max(
          12,
          b.bottom + t.height + 12 < innerHeight
            ? b.bottom + 8
            : b.top - t.height - 8,
        ),
      });
    };
    place();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const outside = (e: PointerEvent) => {
      if (
        !button.current?.contains(e.target as Node) &&
        !tip.current?.contains(e.target as Node)
      )
        close();
    };
    addEventListener("resize", place);
    addEventListener("scroll", place, true);
    addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      removeEventListener("resize", place);
      removeEventListener("scroll", place, true);
      removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="info-trigger"
        aria-label={`About ${label}`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={() => {
          dismissed.current = false;
          hide();
        }}
        onFocus={show}
        onBlur={() => {
          dismissed.current = false;
          pinned.current = false;
          hide();
        }}
        onClick={() => {
          if (pinned.current) close();
          else {
            pinned.current = true;
            dismissed.current = false;
            setOpen(true);
          }
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="info-tooltip"
            style={position}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={hide}
          >
            <strong>{label}</strong>
            <div>{children}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
