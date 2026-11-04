/**
 * Utilidades de zona horaria sin dependencias externas.
 *
 * Toda la lógica de agenda trabaja con instantes UTC (`Date`) y con reglas
 * semanales expresadas en hora local de la sede. Estas funciones convierten
 * entre ambas representaciones respetando DST mediante `Intl`.
 */

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MINUTE = 60_000;

function formatterFor(timeZone: string) {
  let formatter = formatterCache.get(timeZone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }

  return formatter;
}

/** Partes locales (fecha y hora) de un instante en una zona IANA. */
export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(date);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  const jsWeekday = new Date(Date.UTC(values.year, values.month - 1, values.day)).getUTCDay();

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
    // Convención de la base de datos: lunes = 1 … domingo = 7.
    weekday: jsWeekday === 0 ? 7 : jsWeekday,
  };
}

/** Desfase de la zona respecto a UTC, en minutos, para un instante dado. */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return Math.round((asUtc - date.getTime()) / 60_000);
}

/**
 * Convierte una hora local de la sede a un instante UTC.
 *
 * - Horas inexistentes (salto de primavera): devuelve `null`.
 * - Horas ambiguas (vuelta al horario de invierno): se elige la primera
 *   ocurrencia, es decir el instante anterior.
 */
export function zonedTimeToUtc(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date | null {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const probe = new Date(asUtc);

  // Los desfases posibles se toman alrededor del instante objetivo: así se
  // cubren el horario de verano y el de invierno aunque el cambio ocurra
  // justo ese día.
  const offsets = new Set([
    zoneOffsetMinutes(probe, timeZone),
    zoneOffsetMinutes(new Date(asUtc - 12 * 60 * MINUTE), timeZone),
    zoneOffsetMinutes(new Date(asUtc + 12 * 60 * MINUTE), timeZone),
  ]);

  const candidates: number[] = [];

  for (const offset of offsets) {
    const candidate = new Date(asUtc - offset * MINUTE);
    const check = localParts(candidate, timeZone);

    if (
      check.year === year &&
      check.month === month &&
      check.day === day &&
      check.hour === hour &&
      check.minute === minute
    ) {
      candidates.push(candidate.getTime());
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Hora ambigua: primera ocurrencia, el instante anterior.
  return new Date(Math.min(...candidates));
}

/** Inicio (00:00 local) del día indicado, como instante UTC. */
export function localDayStart(
  timeZone: string,
  year: number,
  month: number,
  day: number,
): Date | null {
  return zonedTimeToUtc(timeZone, year, month, day, 0, 0);
}

/** Suma días a una fecha local representada por sus partes. */
export function addLocalDays(
  parts: Pick<LocalParts, "year" | "month" | "day">,
  days: number,
) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  date.setUTCDate(date.getUTCDate() + days);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Clave local `YYYY-MM-DD` de un instante. */
export function localDateKey(date: Date, timeZone: string) {
  const parts = localParts(date, timeZone);

  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** `HH:MM` local de un instante. */
export function localTimeLabel(date: Date, timeZone: string) {
  const parts = localParts(date, timeZone);

  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/** Convierte una regla `HH:MM` en minutos desde medianoche. */
export function parseClock(value: string) {
  const [hours, minutes] = value.split(":");
  const parsedHours = Number(hours);
  const parsedMinutes = Number(minutes ?? 0);

  if (
    !Number.isInteger(parsedHours) ||
    !Number.isInteger(parsedMinutes) ||
    parsedHours < 0 ||
    parsedHours > 23 ||
    parsedMinutes < 0 ||
    parsedMinutes > 59
  ) {
    return null;
  }

  return parsedHours * 60 + parsedMinutes;
}

/** Instante UTC a partir de una fecha local y una hora `HH:MM`. */
export function zonedClockToUtc(
  timeZone: string,
  parts: Pick<LocalParts, "year" | "month" | "day">,
  clock: string,
): Date | null {
  const minutes = parseClock(clock);

  if (minutes === null) {
    return null;
  }

  return zonedTimeToUtc(
    timeZone,
    parts.year,
    parts.month,
    parts.day,
    Math.floor(minutes / 60),
    minutes % 60,
  );
}
