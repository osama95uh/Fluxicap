"use client";

import { useEffect, useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Trash2, X } from "lucide-react";

type IconComponent = React.ComponentType<{ className?: string }>;

const cardClass =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(15,23,42,0.20)] ring-1 ring-slate-900/[0.02]";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`${cardClass} ${className}`}>{children}</section>;
}

export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconComponent;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 px-4 py-4 sm:px-5 md:px-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-teal-100/70 text-teal-700 ring-1 ring-teal-100/80">
            <Icon className="h-[21px] w-[21px]" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs leading-snug text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="animate-fade-in absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-10px_44px_-14px_rgba(15,23,42,0.35)] ring-1 ring-black/5 sm:max-h-[min(85dvh,42rem)] sm:rounded-[24px] sm:shadow-2xl"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight tracking-tight text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-[13px] leading-snug text-slate-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-800 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6 sm:pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  tone = "default",
  className = "",
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: "default" | "danger";
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-transparent transition-all duration-150 active:scale-[0.98] ${
        tone === "danger"
          ? "text-slate-400 hover:bg-red-50 hover:text-red-600 hover:ring-red-100"
          : "text-slate-500 hover:bg-white hover:text-slate-800 hover:ring-slate-200"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function ConfirmButton({
  onConfirm,
  label = "Delete",
  title = "Delete entry",
}: {
  onConfirm: () => Promise<void>;
  label?: string;
  title?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  if (!confirming) {
    return (
      <IconButton label={title} tone="danger" onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-red-50 p-1 ring-1 ring-red-100">
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-white active:scale-[0.98]"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            await onConfirm();
          } finally {
            setPending(false);
            setConfirming(false);
          }
        }}
        className="min-h-11 rounded-lg bg-red-600 px-3 text-xs font-bold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "…" : label}
      </button>
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "amber";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/25 hover:from-emerald-700 hover:to-teal-700 hover:shadow-md",
  secondary:
    "border border-slate-200 bg-white text-slate-700 shadow-sm shadow-slate-900/[0.03] hover:border-emerald-200 hover:bg-emerald-50/40 hover:text-emerald-800",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700",
  amber: "bg-amber-500 text-white shadow-sm shadow-amber-500/25 hover:bg-amber-600",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1.5 block text-[11px] leading-snug text-slate-400">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm shadow-slate-900/[0.02] outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 tabular-nums";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${controlClass} ${className}`} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${controlClass} min-h-24 resize-y ${className}`} />;
}

type BadgeTone = "green" | "amber" | "red" | "slate" | "blue";

const badgeStyles: Record<BadgeTone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
  red: "bg-red-50 text-red-700 ring-red-200/80",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200/80",
};

export function Badge({
  tone = "slate",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight tabular-nums ring-1 ring-inset ${badgeStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: IconComponent;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/70 bg-gradient-to-b from-emerald-50/40 to-slate-50/40 px-5 py-9 text-center sm:py-11">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm ring-1 ring-emerald-100">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-bold text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">{description}</p> : null}
    </div>
  );
}
