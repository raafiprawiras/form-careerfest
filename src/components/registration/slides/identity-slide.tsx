import { TextField } from "@/components/registration/ui";

export type SlideErrors = Partial<
  Record<"fullName" | "email" | "whatsapp", string>
>;

export function IdentitySlide({
  values,
  errors,
  onChange,
}: {
  values: { fullName: string; email: string; whatsapp: string };
  errors: SlideErrors;
  onChange: (patch: Partial<{ fullName: string; email: string; whatsapp: string }>) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Data diri
        </h1>
        <p className="text-base text-ink-muted">
          Isi sesuai identitas resmi dan gunakan email yang aktif.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <TextField
          id="full-name"
          label="Nama lengkap"
          value={values.fullName}
          onChange={(event) => onChange({ fullName: event.target.value })}
          error={errors.fullName}
          autoFocusOnSlide
          autoComplete="name"
          placeholder="Contoh: Siti Rahma Wulandari"
        />
        <TextField
          id="email"
          label="Email"
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(event) => onChange({ email: event.target.value })}
          error={errors.email}
          autoComplete="email"
          placeholder="Contoh: siti.rahma@email.com"
          helper="QR Code absensi akan dikirim ke email ini."
        />
        <TextField
          id="whatsapp"
          label="Nomor WhatsApp"
          type="tel"
          inputMode="tel"
          value={values.whatsapp}
          onChange={(event) => onChange({ whatsapp: event.target.value })}
          error={errors.whatsapp}
          autoComplete="tel"
          placeholder="Contoh: 081234567890"
          helper="Boleh memakai awalan 62, akan disimpan sebagai 0."
        />
      </div>
    </section>
  );
}
