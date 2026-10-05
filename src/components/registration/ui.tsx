/**
 * Primitive UI form.
 *
 * Sistem bentuk (dipakai konsisten di seluruh aplikasi):
 * - tombol: rounded-full
 * - input dan area pilih file: rounded-xl (12px)
 * - panel dan kartu: rounded-2xl (16px)
 *
 * Aturan aksesibilitas yang dipakai di semua field:
 * - label selalu di atas input, placeholder tidak pernah menggantikan label
 * - teks bantuan di bawah input, error di bawahnya lagi
 * - error memakai ikon teks dan warna, tidak hanya warna
 * - fokus keyboard selalu terlihat
 */

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { motion } from "framer-motion";
import { ACCEPTED_FILE_EXTENSIONS } from "@/lib/validation";

const INPUT_BASE =
  "w-full rounded-xl border bg-surface px-4 py-3 text-base text-ink " +
  "placeholder:text-ink-muted transition-colors";

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  ...rest
}: {
  variant?: "primary" | "secondary";
  loading?: boolean;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-medium " +
    "transition-transform duration-150 active:translate-y-px " +
    "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:translate-y-0";

  if (variant === "primary") {
    return (
      <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.14 }} className="inline-flex">
        <button {...rest} className={`${base} bg-primary text-primary-ink hover:bg-primary-hover ${className}`}>
          {loading ? (
            <>
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Mengirim...
            </>
          ) : children}
        </button>
      </motion.span>
    );
  }

  return (
    <motion.span whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.14 }} className="inline-flex">
      <button {...rest} className={`${base} border border-line bg-surface text-ink hover:border-line-strong ${className}`}>
        {loading ? (
          <>
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Mengirim...
          </>
        ) : children}
      </button>
    </motion.span>
  );
}

export function TextField({
  id,
  label,
  helper,
  error,
  value,
  autoFocusOnSlide,
  optionalHint,
  ...rest
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string | null;
  value: string;
  autoFocusOnSlide?: boolean;
  optionalHint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy =
    [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {helper ? (
        <p id={helperId} className="text-sm text-ink-muted">
          {helper}
        </p>
      ) : null}
      <input
        {...rest}
        id={id}
        value={value}
        data-autofocus={autoFocusOnSlide ? "true" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${INPUT_BASE} ${error ? "border-danger" : "border-line"
          }`}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
      {optionalHint ? (
        <p className="text-sm text-ink-muted">{optionalHint}</p>
      ) : null}
    </div>
  );
}

export function FileField({
  id,
  label,
  helper,
  error,
  accept,
  value,
  onChange,
  onRemove,
  autoFocusOnSlide,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string | null;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  onRemove: () => void;
  autoFocusOnSlide?: boolean;
}) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy =
    [helper ? helperId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {helper ? (
        <p id={helperId} className="text-sm text-ink-muted">
          {helper}
        </p>
      ) : null}
      {value ? (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-alt px-4 py-3"
        >
          <p className="text-sm text-ink">
            File terpilih: <span className="font-mono">{value.name}</span> (
            {formatFileSize(value.size)})
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink hover:border-line-strong"
          >
            Hapus file
          </button>
        </motion.div>
      ) : (
        <input
          id={id}
          type="file"
          data-autofocus={autoFocusOnSlide ? "true" : undefined}
          accept={accept ?? ACCEPTED_FILE_EXTENSIONS}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onChange(file);
          }}
          className="block w-full cursor-pointer rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink file:mr-3 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-accent-ink"
        />
      )}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function RadioGroup({
  legend,
  helper,
  error,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  helper?: string;
  error?: string | null;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const errorId = `${name}-error`;

  return (
    <fieldset
      className="flex flex-col gap-3"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="text-sm font-medium text-ink">{legend}</legend>
      {helper ? <p className="text-sm text-ink-muted">{helper}</p> : null}
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <motion.label
            key={option.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base transition-colors ${value === option.value
              ? "border-accent bg-accent-soft text-accent-soft-ink"
              : "border-line bg-surface text-ink"
              }`}
            whileTap={{ scale: 0.99 }}
            transition={{ duration: 0.14 }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              data-autofocus="true"
              className="size-4 accent-[var(--accent)]"
            />
            {option.label}
          </motion.label>
        ))}
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </p>
      ) : null}
    </fieldset>
  );
}

export function Notice({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "error";
  title?: string;
  children: ReactNode;
}) {
  const isError = variant === "error";
  return (
    <div
      role={isError ? "alert" : "note"}
      className={`rounded-2xl border px-4 py-3 text-sm ${isError
        ? "border-danger bg-danger-soft text-danger-soft-ink"
        : "border-line bg-surface-alt text-ink"
        }`}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <p className="mt-1">{children}</p>
    </div>
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
