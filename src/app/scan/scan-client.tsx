"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button, Notice, TextField } from "@/components/registration/ui";

const PIN_KEY = "cf_scan_pin";
const NAME_KEY = "cf_scan_name";
const CREDS_EVENT = "cf-scan-creds";

type ApiResult =
  | {
      status: "checked_in";
      registrationId: string;
      fullName: string;
      affiliation: string;
      checkedInAt: string;
    }
  | {
      status: "error";
      code: string;
      registrationId?: string;
      fullName?: string;
      checkedInAt?: string;
      checkedInBy?: string;
    };

type ScanState = null | "checking" | "network" | ApiResult;

/* ---------- penyimpanan nama + PIN panitia di HP ini ---------- */

function subscribeCreds(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(CREDS_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CREDS_EVENT, callback);
  };
}

function readCreds(): string {
  try {
    const name = localStorage.getItem(NAME_KEY) ?? "";
    const pin = localStorage.getItem(PIN_KEY) ?? "";
    return `${name}\n${pin}`;
  } catch {
    return "\n";
  }
}

function saveCreds(name: string, pin: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(PIN_KEY, pin);
  } catch {
    /* mode privat: PIN tidak tersimpan, panitia diminta login lagi */
  }
  window.dispatchEvent(new Event(CREDS_EVENT));
}

function clearPin() {
  try {
    localStorage.removeItem(PIN_KEY);
  } catch {
    /* diabaikan */
  }
  window.dispatchEvent(new Event(CREDS_EVENT));
}

function newScanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `scan-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "medium" });
}

/* ---------- komponen utama ---------- */

export function ScanClient() {
  const token = useSearchParams().get("t")?.trim() ?? "";

  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const credsRaw = useSyncExternalStore(subscribeCreds, readCreds, () => "\n");
  const [scannerName, pin] = credsRaw.split("\n");
  const hasCreds = scannerName.length > 0 && pin.length > 0;

  const [state, setState] = useState<ScanState>(null);
  const [scanId] = useState(newScanId);
  const startedRef = useRef(false);

  const pinRejected = state !== null && typeof state === "object" &&
    state.status === "error" && state.code === "INVALID_PIN";

  async function runCheckIn(): Promise<ApiResult | "network"> {
    try {
      const response = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, pin, scannerName, scanId }),
      });
      const json = (await response.json()) as ApiResult;
      if (json.status === "checked_in" || json.status === "error") return json;
      return "network";
    } catch {
      return "network";
    }
  }

  function handleResult(result: ApiResult | "network") {
    if (typeof result === "object" && result.status === "error" && result.code === "INVALID_PIN") {
      clearPin();
    }
    setState(result);
  }

  // Satu pemindaian = satu pemanggilan. `startedRef` mencegah panggilan ganda
  // (mis. Strict Mode di mode dev) yang akan membuat QR terbaca "sudah dipakai".
  const shouldAutoRun = mounted && token.length > 0 && hasCreds;
  useEffect(() => {
    if (!shouldAutoRun || startedRef.current) return;
    startedRef.current = true;
    void runCheckIn().then(handleResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoRun]);

  function handleLogin(name: string, newPin: string) {
    startedRef.current = false;
    setState(null);
    saveCreds(name, newPin);
  }

  function handleRetry() {
    setState("checking");
    void runCheckIn().then(handleResult);
  }

  function handleLogout() {
    startedRef.current = false;
    setState(null);
    try {
      localStorage.removeItem(PIN_KEY);
      localStorage.removeItem(NAME_KEY);
    } catch {
      /* diabaikan */
    }
    window.dispatchEvent(new Event(CREDS_EVENT));
  }

  const effective: ScanState =
    state === null && shouldAutoRun ? "checking" : state;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex items-center gap-3">
        <Image
          src="/logo-careerfest.png"
          alt="Logo Career Fest 2026"
          width={480}
          height={668}
          className="h-12 w-auto rounded-xl"
        />
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Absensi Career Fest 2026
          </h1>
          {mounted && hasCreds && !pinRejected ? (
            <p className="text-sm text-ink-muted">Panitia: {scannerName}</p>
          ) : null}
        </div>
      </header>

      {!mounted ? null : !hasCreds || pinRejected ? (
        <LoginForm
          defaultName={scannerName}
          error={pinRejected ? "PIN salah. Periksa PIN dari ketua panitia." : null}
          onSubmit={handleLogin}
        />
      ) : effective === null ? (
        <IdlePanel onLogout={handleLogout} />
      ) : (
        <ResultPanel state={effective} onRetry={handleRetry} onLogout={handleLogout} />
      )}
    </div>
  );
}

/* ---------- tampilan ---------- */

function LoginForm({
  defaultName,
  error,
  onSubmit,
}: {
  defaultName: string;
  error: string | null;
  onSubmit: (name: string, pin: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [pinValue, setPinValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setLocalError("Isi nama panitia (minimal 2 huruf).");
      return;
    }
    if (pinValue.trim().length < 4) {
      setLocalError("Isi PIN panitia.");
      return;
    }
    setLocalError(null);
    onSubmit(name.trim(), pinValue.trim());
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5"
    >
      <p className="text-base text-ink-muted">
        Masuk sekali di HP ini. Setelah itu, setiap QR yang dipindai dengan
        kamera HP langsung tercatat.
      </p>
      <TextField
        id="scanner-name"
        label="Nama panitia"
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="name"
        maxLength={60}
      />
      <TextField
        id="scanner-pin"
        label="PIN panitia"
        type="password"
        inputMode="text"
        value={pinValue}
        onChange={(event) => setPinValue(event.target.value)}
        autoComplete="off"
        maxLength={100}
        error={localError ?? error}
      />
      <Button type="submit" className="self-start">
        Masuk
      </Button>
    </form>
  );
}

function IdlePanel({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink">Siap memindai</h2>
        <p className="mt-2 text-base text-ink-muted">
          Buka aplikasi kamera bawaan HP, arahkan ke QR peserta, lalu ketuk
          tautan yang muncul. Hasilnya tampil di halaman ini.
        </p>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="self-start text-sm text-ink-muted underline underline-offset-4"
      >
        Keluar dari HP ini
      </button>
    </div>
  );
}

function ResultPanel({
  state,
  onRetry,
  onLogout,
}: {
  state: Exclude<ScanState, null>;
  onRetry: () => void;
  onLogout: () => void;
}) {
  if (state === "checking") {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-5 text-base text-ink">
        <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Memeriksa QR...
      </div>
    );
  }

  if (state === "network") {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant="error" title="Koneksi bermasalah">
          QR belum diperiksa. Pastikan HP terhubung internet, lalu coba lagi.
          Mencoba ulang aman: peserta tidak akan tercatat dua kali.
        </Notice>
        <Button type="button" onClick={onRetry} className="self-start">
          Coba lagi
        </Button>
      </div>
    );
  }

  if (state.status === "checked_in") {
    return (
      <div className="flex flex-col gap-4">
        <section
          aria-live="assertive"
          className="rounded-2xl bg-success px-5 py-6 text-primary-ink"
        >
          <p className="text-3xl font-semibold tracking-tight">
            <span aria-hidden="true">✓ </span>HADIR
          </p>
          <p className="mt-4 text-2xl font-semibold leading-snug break-words">
            {state.fullName}
          </p>
          <dl className="mt-3 flex flex-col gap-1 text-base">
            <div className="flex justify-between gap-3">
              <dt className="opacity-80">Asal</dt>
              <dd>{state.affiliation}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="opacity-80">No. daftar</dt>
              <dd className="font-mono">{state.registrationId}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="opacity-80">Dicatat</dt>
              <dd>{formatTime(state.checkedInAt)}</dd>
            </div>
          </dl>
        </section>
        <p className="text-sm text-ink-muted">
          Untuk peserta berikutnya, pindai QR-nya dengan kamera HP.
        </p>
        <LogoutLink onLogout={onLogout} />
      </div>
    );
  }

  const copy = ERROR_COPY[state.code] ?? ERROR_COPY.DEFAULT;

  return (
    <div className="flex flex-col gap-4">
      <section aria-live="assertive" className="rounded-2xl bg-danger px-5 py-6 text-danger-ink">
        <p className="text-3xl font-semibold tracking-tight">
          <span aria-hidden="true">✕ </span>
          {copy.title}
        </p>
        <p className="mt-3 text-base leading-relaxed">{copy.detail}</p>
        {state.code === "ALREADY_USED" ? (
          <dl className="mt-4 flex flex-col gap-1 text-base">
            {state.fullName ? (
              <div className="flex justify-between gap-3">
                <dt className="opacity-80">Peserta</dt>
                <dd className="text-right font-semibold">{state.fullName}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="opacity-80">Hadir pada</dt>
              <dd>{formatTime(state.checkedInAt)}</dd>
            </div>
            {state.checkedInBy ? (
              <div className="flex justify-between gap-3">
                <dt className="opacity-80">Dicatat oleh</dt>
                <dd>{state.checkedInBy}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>
      <LogoutLink onLogout={onLogout} />
    </div>
  );
}

function LogoutLink({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      type="button"
      onClick={onLogout}
      className="self-start text-sm text-ink-muted underline underline-offset-4"
    >
      Keluar dari HP ini
    </button>
  );
}

const ERROR_COPY: Record<string, { title: string; detail: string }> = {
  ALREADY_USED: {
    title: "SUDAH DIPAKAI",
    detail: "QR ini sudah pernah dipindai. Jangan izinkan masuk dua kali.",
  },
  INVALID_QR: {
    title: "QR TIDAK VALID",
    detail: "QR ini bukan QR Career Fest 2026 yang sah atau sudah diubah.",
  },
  NOT_FOUND: {
    title: "PESERTA TIDAK ADA",
    detail: "Nomor pendaftaran tidak ditemukan di daftar peserta.",
  },
  NOT_ELIGIBLE: {
    title: "PENDAFTARAN BELUM SAH",
    detail: "Pendaftaran peserta ini belum berstatus berhasil. Arahkan ke meja panitia.",
  },
  RATE_LIMITED: {
    title: "TERLALU BANYAK PERCOBAAN",
    detail: "PIN salah terlalu sering dari jaringan ini. Tunggu 10 menit, lalu coba lagi.",
  },
  CONFIG_ERROR: {
    title: "SISTEM BELUM SIAP",
    detail: "Pengaturan absensi belum lengkap. Hubungi ketua panitia.",
  },
  DEFAULT: {
    title: "GAGAL MEMERIKSA",
    detail: "Terjadi gangguan di server. Pindai ulang QR dalam beberapa detik.",
  },
};