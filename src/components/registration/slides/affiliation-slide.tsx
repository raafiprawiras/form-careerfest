import { RadioGroup } from "@/components/registration/ui";
import type { Affiliation } from "@/lib/types";

export function AffiliationSlide({
  value,
  error,
  onChange,
}: {
  value: Affiliation | "";
  error: string | null;
  onChange: (value: Affiliation) => void;
}) {
  return (
    <section className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Asal instansi
        </h1>
        <p className="text-base text-ink-muted">
          Pilih asal atau kelompok peserta.
        </p>
      </div>

      <RadioGroup
        name="affiliation"
        legend="Asal instansi"
        value={value}
        error={error}
        options={[
          { value: "UNISSULA", label: "UNISSULA" },
          { value: "Umum", label: "Umum (bukan mahasiswa UNISSULA)" },
        ]}
        onChange={(next) => {
          if (next === "UNISSULA" || next === "Umum") onChange(next);
        }}
      />
    </section>
  );
}
