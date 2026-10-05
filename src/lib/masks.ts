/**
 * Menyamarkan data pribadi di layar, mengikuti kebijakan privasi pada
 * FORM-SPECIFICATION.md bagian 6.3.
 */

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "****";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const first = local.slice(0, 1);
  return `${first}****${domain}`;
}

export function maskWhatsapp(digits: string): string {
  const cleaned = digits.replace(/\D/g, "");
  if (cleaned.length <= 4) return "****";
  return `******${cleaned.slice(-4)}`;
}
