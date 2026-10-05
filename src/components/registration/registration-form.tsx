"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button, Notice } from "@/components/registration/ui";
import { ProgressBar } from "@/components/registration/progress-bar";
import { WelcomeSlide } from "@/components/registration/slides/welcome-slide";
import { ConsentSlide } from "@/components/registration/slides/consent-slide";
import { IdentitySlide } from "@/components/registration/slides/identity-slide";
import { AffiliationSlide } from "@/components/registration/slides/affiliation-slide";
import {
  InstagramProofSlide,
  PaymentProofSlide,
} from "@/components/registration/slides/upload-slides";
import { SuccessSlide } from "@/components/registration/slides/success-slide";
import { INITIAL_VALUES, SLIDE_ORDER, progressPercent } from "@/lib/types";
import type { RegistrationValues, SlideId } from "@/lib/types";
import {
  createIdempotencyKey,
  submitRegistration,
} from "@/lib/submit";import {
  normalizeEmail,
  normalizeFullName,
  validateAffiliation,
  validateEmail,
  validateFileMeta,
  validateFullName,
  validateInstagramProfileUrl,
  validateWhatsapp,
} from "@/lib/validation";

type FieldKey =
  | "consent"
  | "fullName"
  | "email"
  | "whatsapp"
  | "affiliation"
  | "instagramUrl"
  | "instagramFile"
  | "paymentFile"
  | "form";

type FieldErrors = Partial<Record<FieldKey, string>>;

/** Index slide terakhir yang punya isian, dipakai untuk memisahkan navigasi dan submit. */
const LAST_FILLABLE_INDEX = 5;

/**
 * Slide yang harus dibuka ketika server menolak salah satu field.
 * Dipakai agar peserta langsung melihat bagian yang salah, bukan mentok di
 * slide terakhir.
 */
const SLIDE_INDEX_BY_FIELD: Record<string, number> = {
  consent: SLIDE_ORDER.indexOf("consent"),
  fullName: SLIDE_ORDER.indexOf("identity"),
  email: SLIDE_ORDER.indexOf("identity"),
  whatsapp: SLIDE_ORDER.indexOf("identity"),
  affiliation: SLIDE_ORDER.indexOf("affiliation"),
  instagramUrl: SLIDE_ORDER.indexOf("instagram_proof"),
  instagramFile: SLIDE_ORDER.indexOf("instagram_proof"),
  paymentFile: SLIDE_ORDER.indexOf("payment_proof"),
};

/** Urutan field saat menentukan slide yang dibuka lebih dulu. */
const FIELD_ORDER: FieldKey[] = [
  "consent",
  "fullName",
  "email",
  "whatsapp",
  "affiliation",
  "instagramUrl",
  "instagramFile",
  "paymentFile",
];

export function RegistrationForm() {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<RegistrationValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedRegistrationId, setSubmittedRegistrationId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");

  // Kunci dibuat satu kali per sesi form (spesifikasi 6.1: server menolak
  // request kedua dengan kunci yang sama).
  const [idempotencyKey] = useState(() => createIdempotencyKey());

  const containerRef = useRef<HTMLDivElement>(null);
  const slide: SlideId = SLIDE_ORDER[index] ?? "welcome";

  const patchValues = useCallback((patch: Partial<RegistrationValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  const clearError = useCallback((field: FieldKey) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  // Setiap slide berpindah, fokus pindah ke kontrol pertama slide tersebut.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>("[data-autofocus]");
    target?.focus();
  }, [index]);

  const validateCurrentSlide = useCallback((): boolean => {
    const next: FieldErrors = {};

    switch (slide) {
      case "consent":
        if (values.consent !== true) {
          next.consent = "Persetujuan penggunaan data wajib disetujui.";
        }
        break;
      case "identity":
        next.fullName = validateFullName(values.fullName) ?? undefined;
        next.email = validateEmail(values.email) ?? undefined;
        next.whatsapp = validateWhatsapp(values.whatsapp) ?? undefined;
        break;
      case "affiliation":
        next.affiliation = validateAffiliation(values.affiliation) ?? undefined;
        break;
      case "instagram_proof": {
        next.instagramUrl =
          validateInstagramProfileUrl(values.instagramUrl) ?? undefined;
        next.instagramFile = values.instagramFile
          ? validateFileMeta({
              name: values.instagramFile.name,
              size: values.instagramFile.size,
              type: values.instagramFile.type,
            }) ?? undefined
          : "Screenshot bukti follow Instagram wajib diunggah.";
        break;
      }
      case "payment_proof":
        next.paymentFile = values.paymentFile
          ? validateFileMeta({
              name: values.paymentFile.name,
              size: values.paymentFile.size,
              type: values.paymentFile.type,
            }) ?? undefined
          : "Bukti transfer wajib diunggah.";
        break;
      default:
        break;
    }

    const cleaned: FieldErrors = {};
    for (const key of Object.keys(next) as FieldKey[]) {
      if (next[key]) cleaned[key] = next[key];
    }

    setErrors(cleaned);

    if (Object.keys(cleaned).length > 0) {
      const firstInvalid =
        containerRef.current?.querySelector<HTMLElement>(
          "[aria-invalid='true']",
        );
      firstInvalid?.focus();
      return false;
    }
    return true;
  }, [slide, values]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateCurrentSlide()) return;

    if (index < LAST_FILLABLE_INDEX) {
      setIndex(index + 1);
      return;
    }

    setSubmitting(true);
    clearError("form");

    try {
      const outcome = await submitRegistration(values, idempotencyKey);

      if (outcome.status === "submitted") {
        setSubmittedRegistrationId(outcome.registrationId);
        setSubmittedAt(outcome.submittedAt);
        setIndex(SLIDE_ORDER.length - 1);
        return;
      }

      // Error per field dari server: tampilkan di slide pemiliknya.
      if (outcome.fields && Object.keys(outcome.fields).length > 0) {
        const fieldErrors: FieldErrors = {};
        let jumpTo: number | null = null;

        for (const key of FIELD_ORDER) {
          const message = outcome.fields[key];
          if (!message) continue;
          fieldErrors[key] = message;
          if (jumpTo === null) {
            jumpTo = SLIDE_INDEX_BY_FIELD[key] ?? null;
          }
        }

        setErrors(fieldErrors);

        if (jumpTo !== null && jumpTo !== index) {
          setIndex(jumpTo);
          return;
        }
      }

      setErrors((current) => ({ ...current, form: outcome.message }));
    } catch {
      setErrors((current) => ({
        ...current,
        form: "Terjadi kesalahan saat memproses pendaftaran. Coba lagi dalam beberapa saat.",
      }));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => setIndex((current) => Math.max(0, current - 1));

  return (
    <div ref={containerRef} className="flex flex-1 flex-col gap-6">
      {slide !== "welcome" && slide !== "success" ? (
        <ProgressBar slideId={slide} percent={progressPercent(slide)} />
      ) : null}

      <p aria-live="polite" className="sr-only">
        {slide === "welcome"
          ? "Selamat datang di form registrasi Career Fest 2026."
          : slide === "success"
            ? "Pendaftaran berhasil."
            : `Langkah ${progressPercent(slide)} persen dari pengisian form selesai.`}
      </p>

      {slide === "success" ? (
        <SuccessSlide
          fullName={normalizeFullName(values.fullName)}
          email={normalizeEmail(values.email)}
          whatsapp={values.whatsapp}
          registrationId={submittedRegistrationId}
          submittedAt={submittedAt}
          onDone={() => {
            setValues(INITIAL_VALUES);
            setErrors({});
            setIndex(0);
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-6">
          {slide === "welcome" ? (
            <WelcomeSlide onStart={() => setIndex(1)} />
          ) : null}

          {slide === "consent" ? (
            <ConsentSlide
              checked={values.consent}
              error={errors.consent ?? null}
              onChange={(checked) => {
                patchValues({ consent: checked });
                clearError("consent");
              }}
            />
          ) : null}

          {slide === "identity" ? (
            <IdentitySlide
              values={{
                fullName: values.fullName,
                email: values.email,
                whatsapp: values.whatsapp,
              }}
              errors={{
                fullName: errors.fullName,
                email: errors.email,
                whatsapp: errors.whatsapp,
              }}
              onChange={(patch) => {
                patchValues(patch);
                for (const key of Object.keys(patch) as FieldKey[]) {
                  clearError(key);
                }
              }}
            />
          ) : null}

          {slide === "affiliation" ? (
            <AffiliationSlide
              value={values.affiliation}
              error={errors.affiliation ?? null}
              onChange={(affiliation) => {
                patchValues({ affiliation });
                clearError("affiliation");
              }}
            />
          ) : null}

          {slide === "instagram_proof" ? (
            <InstagramProofSlide
              instagramUrl={values.instagramUrl}
              instagramFile={values.instagramFile}
              errors={{
                instagramUrl: errors.instagramUrl,
                instagramFile: errors.instagramFile,
              }}
              onUrlChange={(instagramUrl) => {
                patchValues({ instagramUrl });
                clearError("instagramUrl");
              }}
              onFileChange={(instagramFile) => {
                patchValues({ instagramFile });
                clearError("instagramFile");
              }}
            />
          ) : null}

          {slide === "payment_proof" ? (
            <PaymentProofSlide
              paymentFile={values.paymentFile}
              error={errors.paymentFile ?? null}
              onFileChange={(paymentFile) => {
                patchValues({ paymentFile });
                clearError("paymentFile");
              }}
            />
          ) : null}

          {slide !== "welcome" ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                loading={submitting}
                disabled={submitting}
              >
                {index === LAST_FILLABLE_INDEX ? "Kirim pendaftaran" : "Lanjut"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={goBack}
              >
                Kembali
              </Button>
            </div>
          ) : null}

          {errors.form ? (
            <Notice variant="error" title="Pendaftaran belum terkirim">
              {errors.form}
            </Notice>
          ) : null}
        </form>
      )}
    </div>
  );
}
