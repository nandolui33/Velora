/** Normalización de datos de contacto, compartida por reservas y clientes. */

export function normalizeEmail(value?: string | null) {
  const trimmed = value?.trim().toLowerCase() ?? "";

  return trimmed.length > 0 ? trimmed : null;
}

/** Normaliza a E.164; devuelve null si no es un teléfono plausible. */
export function normalizePhone(value?: string | null) {
  const raw = value?.trim() ?? "";

  if (raw.length === 0) {
    return null;
  }

  const digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    return digits.length >= 9 ? digits : null;
  }

  const plain = digits.replace(/\D/g, "");

  if (plain.length === 9) {
    return `+34${plain}`;
  }

  if (plain.startsWith("34") && plain.length === 11) {
    return `+${plain}`;
  }

  return null;
}
