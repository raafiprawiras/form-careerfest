import { describe, expect, it } from "vitest";
import {
  FILLABLE_SLIDES,
  isFillableSlide,
  progressPercent,
  stepNumberOfSlide,
} from "./types";

describe("struktur slide", () => {
  it("punya tujuh slide", () => {
    expect(FILLABLE_SLIDES).toHaveLength(5);
  });

  it("menghitung langkah hanya untuk slide isian", () => {
    expect(stepNumberOfSlide("welcome")).toBeNull();
    expect(stepNumberOfSlide("consent")).toBe(1);
    expect(stepNumberOfSlide("payment_proof")).toBe(5);
    expect(stepNumberOfSlide("success")).toBeNull();
  });

  it("menghitung persentase progres", () => {
    expect(progressPercent("welcome")).toBe(0);
    expect(progressPercent("identity")).toBe(40);
    expect(progressPercent("payment_proof")).toBe(100);
  });

  it("menandai slide isian", () => {
    expect(isFillableSlide("affiliation")).toBe(true);
    expect(isFillableSlide("success")).toBe(false);
  });
});
