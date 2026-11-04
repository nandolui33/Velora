import {
  addLocalDays,
  localDayStart,
  localParts,
  parseClock,
  zonedClockToUtc,
  type LocalParts,
} from "./time";

/**
 * Motor de disponibilidad puro.
 *
 * No conoce Prisma, cookies ni HTTP: recibe los datos ya cargados de un
 * profesional en una sede y devuelve los huecos reservables. Así se puede
 * probar con DST, márgenes, ausencias y requisitos de recursos sin base de
 * datos.
 *
 * Convenciones:
 * - Intervalos semiabiertos `[inicio, fin)`: una cita que termina a las 10:00
 *   no bloquea la que empieza a las 10:00.
 * - El margen posterior forma parte del intervalo ocupado: la cita ocupa
 *   `[starts_at, blocked_until)`.
 * - Las reglas semanales se expresan en hora local de la sede.
 */

export type TimeRange = {
  start: Date;
  end: Date;
};

export type BusinessHourRule = {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
};

export type ProfessionalScheduleRule = {
  weekday: number;
  opensAt: string;
  closesAt: string;
};

export type ResourceRequirement = {
  resourceTypeId: string;
  quantity: number;
  /** Si se indica, el servicio exige ese recurso concreto. */
  resourceId?: string | null;
};

export type ResourceInfo = {
  id: string;
  resourceTypeId: string;
  sortOrder: number;
  active: boolean;
};

export type ResourceBusyRange = {
  resourceId: string;
  start: Date;
  end: Date;
};

export type AvailabilityInput = {
  timezone: string;
  now: Date;
  from: Date;
  to: Date;
  serviceDurationMinutes: number;
  serviceBufferMinutes: number;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  businessHours: BusinessHourRule[];
  professionalSchedules: ProfessionalScheduleRule[];
  professionalTimeOff: TimeRange[];
  /** Citas activas del profesional, con el margen ya incluido. */
  appointments: TimeRange[];
  resourceRequirements: ResourceRequirement[];
  resources: ResourceInfo[];
  resourceBusy: ResourceBusyRange[];
  /** Ocupación previa del día por recurso, para repartir de forma determinista. */
  resourceLoadMinutes?: Record<string, number>;
};

export type AvailabilitySlot = {
  startsAt: Date;
  serviceEndsAt: Date;
  blockedUntil: Date;
  resources: { resourceId: string; resourceTypeId: string }[];
};

const MINUTE = 60_000;
const MAX_DAYS = 400;

function overlaps(a: TimeRange, b: TimeRange) {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

function clampRange(range: TimeRange, bounds: TimeRange): TimeRange | null {
  const start = new Date(Math.max(range.start.getTime(), bounds.start.getTime()));
  const end = new Date(Math.min(range.end.getTime(), bounds.end.getTime()));

  return start.getTime() < end.getTime() ? { start, end } : null;
}

function mergeRanges(ranges: TimeRange[]) {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const last = merged.at(-1);

    if (last && range.start.getTime() <= last.end.getTime()) {
      last.end = new Date(Math.max(last.end.getTime(), range.end.getTime()));
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }

  return merged;
}

function subtractRanges(base: TimeRange[], cuts: TimeRange[]) {
  const busy = mergeRanges(cuts);
  let free = base;

  for (const cut of busy) {
    const next: TimeRange[] = [];

    for (const range of free) {
      if (!overlaps(range, cut)) {
        next.push(range);
        continue;
      }

      if (range.start.getTime() < cut.start.getTime()) {
        next.push({ start: range.start, end: cut.start });
      }

      if (range.end.getTime() > cut.end.getTime()) {
        next.push({ start: cut.end, end: range.end });
      }
    }

    free = next;
  }

  return free;
}

function intersectRanges(left: TimeRange[], right: TimeRange[]) {
  const result: TimeRange[] = [];

  for (const a of left) {
    for (const b of right) {
      const start = new Date(Math.max(a.start.getTime(), b.start.getTime()));
      const end = new Date(Math.min(a.end.getTime(), b.end.getTime()));

      if (start.getTime() < end.getTime()) {
        result.push({ start, end });
      }
    }
  }

  return mergeRanges(result);
}

function buildClockWindow(
  timezone: string,
  day: Pick<LocalParts, "year" | "month" | "day">,
  opensAt: string,
  closesAt: string,
): TimeRange | null {
  const openMinutes = parseClock(opensAt);
  const closeMinutes = parseClock(closesAt);

  // El MVP no admite horarios que crucen medianoche.
  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return null;
  }

  const start = zonedClockToUtc(timezone, day, opensAt);
  const end = zonedClockToUtc(timezone, day, closesAt);

  if (!start || !end || start.getTime() >= end.getTime()) {
    return null;
  }

  return { start, end };
}

function chooseResources(
  requirements: ResourceRequirement[],
  resources: ResourceInfo[],
  busyByResource: Map<string, TimeRange[]>,
  window: TimeRange,
  load: Map<string, number>,
) {
  const chosen: { resourceId: string; resourceTypeId: string }[] = [];
  const used = new Set<string>();

  for (const requirement of requirements) {
    if (requirement.quantity <= 0) {
      continue;
    }

    const candidates = resources
      .filter(
        (resource) =>
          resource.active &&
          resource.resourceTypeId === requirement.resourceTypeId &&
          (!requirement.resourceId || resource.id === requirement.resourceId) &&
          !used.has(resource.id),
      )
      .filter((resource) => {
        const busy = busyByResource.get(resource.id) ?? [];
        return !busy.some((range) => overlaps(range, window));
      })
      .sort((a, b) => {
        const loadDiff = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0);
        if (loadDiff !== 0) return loadDiff;
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.id.localeCompare(b.id);
      });

    if (candidates.length < requirement.quantity) {
      return null;
    }

    for (const resource of candidates.slice(0, requirement.quantity)) {
      used.add(resource.id);
      chosen.push({ resourceId: resource.id, resourceTypeId: resource.resourceTypeId });
      load.set(
        resource.id,
        (load.get(resource.id) ?? 0) +
          Math.round((window.end.getTime() - window.start.getTime()) / MINUTE),
      );
    }
  }

  return chosen;
}

/** Calcula los huecos reservables de un profesional en un rango de fechas. */
export function computeAvailability(input: AvailabilityInput): AvailabilitySlot[] {
  const {
    timezone,
    now,
    from,
    to,
    serviceDurationMinutes,
    serviceBufferMinutes,
    slotIntervalMinutes,
    minLeadMinutes,
    maxAdvanceDays,
  } = input;

  if (
    serviceDurationMinutes <= 0 ||
    slotIntervalMinutes <= 0 ||
    to.getTime() <= from.getTime()
  ) {
    return [];
  }

  const durationMs = serviceDurationMinutes * MINUTE;
  const bufferMs = Math.max(0, serviceBufferMinutes) * MINUTE;
  const intervalMs = slotIntervalMinutes * MINUTE;
  const minStartMs = now.getTime() + minLeadMinutes * MINUTE;
  const maxStartMs = now.getTime() + maxAdvanceDays * 24 * 60 * MINUTE;

  const busyByResource = new Map<string, TimeRange[]>();
  for (const busy of input.resourceBusy) {
    const list = busyByResource.get(busy.resourceId) ?? [];
    list.push({ start: busy.start, end: busy.end });
    busyByResource.set(busy.resourceId, list);
  }

  const load = new Map<string, number>(Object.entries(input.resourceLoadMinutes ?? {}));
  const professionalBusy = mergeRanges([...input.appointments, ...input.professionalTimeOff]);

  const slots: AvailabilitySlot[] = [];
  const seen = new Set<number>();

  const startParts = localParts(from, timezone);
  let cursor: Pick<LocalParts, "year" | "month" | "day"> = {
    year: startParts.year,
    month: startParts.month,
    day: startParts.day,
  };

  for (let iteration = 0; iteration < MAX_DAYS; iteration += 1) {
    const dayStart = localDayStart(timezone, cursor.year, cursor.month, cursor.day);
    const next = addLocalDays(cursor, 1);
    const dayEnd = localDayStart(timezone, next.year, next.month, next.day);

    if (!dayStart || !dayEnd || dayStart.getTime() >= to.getTime()) {
      break;
    }

    if (dayEnd.getTime() > from.getTime()) {
      const weekday = localParts(dayStart, timezone).weekday;

      const businessWindows = input.businessHours
        .filter((rule) => rule.weekday === weekday && !rule.closed)
        .map((rule) => buildClockWindow(timezone, cursor, rule.opensAt, rule.closesAt))
        .filter((window): window is TimeRange => window !== null);

      const scheduleWindows = input.professionalSchedules
        .filter((rule) => rule.weekday === weekday)
        .map((rule) => buildClockWindow(timezone, cursor, rule.opensAt, rule.closesAt))
        .filter((window): window is TimeRange => window !== null);

      const bounds: TimeRange = { start: from, end: to };
      const working = intersectRanges(businessWindows, scheduleWindows)
        .map((window) => clampRange(window, bounds))
        .filter((window): window is TimeRange => window !== null);

      const free = subtractRanges(working, professionalBusy);

      for (const window of free) {
        for (
          let startMs = window.start.getTime();
          startMs + durationMs <= window.end.getTime();
          startMs += intervalMs
        ) {
          const startsAt = new Date(startMs);
          const serviceEndsAt = new Date(startMs + durationMs);
          const blockedUntil = new Date(startMs + durationMs + bufferMs);

          if (startMs < minStartMs || startMs > maxStartMs) {
            continue;
          }

          if (blockedUntil.getTime() > window.end.getTime()) {
            continue;
          }

          const bookingWindow: TimeRange = { start: startsAt, end: blockedUntil };

          if (professionalBusy.some((range) => overlaps(range, bookingWindow))) {
            continue;
          }

          const chosen = chooseResources(
            input.resourceRequirements,
            input.resources,
            busyByResource,
            bookingWindow,
            load,
          );

          if (!chosen) {
            continue;
          }

          if (seen.has(startMs)) {
            continue;
          }

          seen.add(startMs);
          slots.push({ startsAt, serviceEndsAt, blockedUntil, resources: chosen });
        }
      }
    }

    if (dayEnd.getTime() >= to.getTime()) {
      break;
    }

    cursor = next;
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
