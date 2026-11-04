import type { Prisma } from "@prisma/client";
import {
  computeAvailability,
  type AvailabilityInput,
  type AvailabilitySlot,
  type BusinessHourRule,
  type ProfessionalScheduleRule,
  type ResourceBusyRange,
  type ResourceInfo,
  type ResourceRequirement,
  type TimeRange,
} from "./availability";
import { addLocalDays, localDateKey, zonedTimeToUtc } from "./time";

export type AvailabilityQuery = {
  businessId: string;
  locationId: string;
  serviceId: string;
  serviceVariantId?: string | null;
  professionalId?: string | null;
  from: Date;
  to: Date;
  now?: Date;
};

export type ProfessionalSlot = AvailabilitySlot & {
  professionalId: string;
  professionalName: string;
  professionalColor: string;
};

export type AvailabilitySlotDto = {
  startsAt: string;
  serviceEndsAt: string;
  professionalId: string;
  professionalName: string;
  professionalColor: string;
  resources: { id: string; name: string }[];
};

export type AvailabilityDayDto = {
  date: string;
  slots: AvailabilitySlotDto[];
};

export type SchedulingBase = {
  businessId: string;
  serviceId: string;
  locationId: string;
  businessName: string;
  locationName: string;
  addressLine: string;
  businessEmail: string | null;
  timezone: string;
  currency: string;
  slotIntervalMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  reminderHours: number;
  cancellationCutoffMinutes: number;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  serviceName: string;
  serviceVariantName: string | null;
  businessHours: BusinessHourRule[];
  resourceRequirements: ResourceRequirement[];
  resources: ResourceInfo[];
  resourceNames: Map<string, string>;
};

export type ProfessionalContext = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  schedules: ProfessionalScheduleRule[];
  timeOff: TimeRange[];
  appointments: TimeRange[];
  appointmentCount: number;
};

type Tx = Prisma.TransactionClient;

export class AvailabilityError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AvailabilityError";
  }
}

async function serviceOfferedAtLocation(
  tx: Tx,
  input: { businessId: string; serviceId: string; locationId: string },
) {
  const link = await tx.serviceLocation.findFirst({
    where: {
      businessId: input.businessId,
      serviceId: input.serviceId,
      locationId: input.locationId,
      active: true,
    },
  });

  return Boolean(link);
}

export async function loadSchedulingBase(
  tx: Tx,
  input: {
    businessId: string;
    locationId: string;
    serviceId: string;
    serviceVariantId?: string | null;
  },
): Promise<SchedulingBase | null> {
  const { businessId, locationId, serviceId, serviceVariantId } = input;

  const business = await tx.business.findFirst({
    where: { id: businessId, deletedAt: null },
  });

  if (!business) {
    return null;
  }

  const location = await tx.location.findFirst({
    where: { id: locationId, businessId, active: true },
  });

  if (!location) {
    return null;
  }

  const service = await tx.service.findFirst({
    where: { id: serviceId, businessId, active: true },
  });

  if (!service) {
    return null;
  }

  const offered = await serviceOfferedAtLocation(tx, {
    businessId,
    serviceId,
    locationId,
  });

  if (!offered) {
    return null;
  }

  const variant = serviceVariantId
    ? await tx.serviceVariant.findFirst({
        where: { id: serviceVariantId, businessId, serviceId, active: true },
      })
    : null;

  if (serviceVariantId && !variant) {
    return null;
  }

  const [requirements, resources, hours] = await Promise.all([
    tx.serviceResourceRequirement.findMany({
      where: {
        businessId,
        serviceId,
        OR: [{ locationId }, { locationId: null }],
      },
    }),
    tx.resource.findMany({
      where: { businessId, locationId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    tx.businessHours.findMany({
      where: { businessId, locationId },
      orderBy: { weekday: "asc" },
    }),
  ]);

  const resourceRequirements: ResourceRequirement[] = requirements
    .filter((requirement) => requirement.required)
    .map((requirement) => ({
      resourceTypeId: requirement.resourceTypeId,
      quantity: requirement.quantity,
      resourceId: requirement.resourceId,
    }));

  return {
    businessId,
    serviceId,
    locationId,
    businessName: business.name,
    locationName: location.name,
    addressLine: [location.addressLine1, location.addressLine2, location.city]
      .filter(Boolean)
      .join(", "),
    businessEmail: business.email ?? location.email ?? null,
    timezone: location.timezone ?? business.timezone,
    currency: service.currency || business.currency,
    slotIntervalMinutes: Math.max(5, business.slotIntervalMinutes),
    minLeadMinutes: Math.max(0, business.minLeadMinutes),
    maxAdvanceDays: Math.max(1, business.maxAdvanceDays),
    reminderHours: Math.max(0, business.reminderHoursBefore),
    cancellationCutoffMinutes: Math.max(0, business.cancellationCutoffMinutes),
    durationMinutes: variant?.durationMinutes ?? service.durationMinutes,
    bufferMinutes: variant?.bufferAfterMinutes ?? service.bufferAfterMinutes,
    priceCents: variant?.priceCents ?? service.priceCents,
    serviceName: service.name,
    serviceVariantName: variant?.name ?? null,
    businessHours: hours.map((hour) => ({
      weekday: hour.weekday,
      opensAt: hour.opensAt,
      closesAt: hour.closesAt,
      closed: hour.closed,
    })),
    resourceRequirements,
    resources: resources.map((resource) => ({
      id: resource.id,
      resourceTypeId: resource.resourceTypeId,
      sortOrder: resource.sortOrder,
      active: resource.active,
    })),
    resourceNames: new Map(resources.map((resource) => [resource.id, resource.name])),
  };
}

export async function qualifiedProfessionals(
  tx: Tx,
  input: { businessId: string; locationId: string; serviceId: string },
) {
  const professionals = await tx.professional.findMany({
    where: {
      businessId: input.businessId,
      active: true,
      locations: {
        some: { locationId: input.locationId, active: true },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  const links = await tx.professionalService.count({
    where: { businessId: input.businessId, serviceId: input.serviceId },
  });

  if (links === 0) {
    // Negocios anteriores a la fase 2 sin asignaciones explícitas: todo el
    // equipo de la sede puede realizar el servicio.
    return professionals;
  }

  const assignments = await tx.professionalService.findMany({
    where: {
      businessId: input.businessId,
      serviceId: input.serviceId,
      active: true,
    },
    select: { professionalId: true },
  });

  const allowed = new Set(assignments.map((assignment) => assignment.professionalId));

  return professionals.filter((professional) => allowed.has(professional.id));
}

async function loadProfessionalContexts(
  tx: Tx,
  base: SchedulingBase,
  range: { from: Date; to: Date },
  professionalId?: string | null,
  ignoreAppointmentId?: string | null,
): Promise<ProfessionalContext[]> {
  const professionals = await qualifiedProfessionals(tx, {
    businessId: base.businessId,
    locationId: base.locationId,
    serviceId: base.serviceId,
  });

  const filtered = professionalId
    ? professionals.filter((professional) => professional.id === professionalId)
    : professionals;

  if (filtered.length === 0) {
    return [];
  }

  const ids = filtered.map((professional) => professional.id);

  const [schedules, timeOff, appointments] = await Promise.all([
    tx.professionalSchedule.findMany({
      where: {
        businessId: base.businessId,
        locationId: base.locationId,
        professionalId: { in: ids },
        active: true,
      },
    }),
    tx.professionalTimeOff.findMany({
      where: {
        businessId: base.businessId,
        professionalId: { in: ids },
        OR: [{ locationId: base.locationId }, { locationId: null }],
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
    }),
    tx.appointment.findMany({
      where: {
        businessId: base.businessId,
        professionalId: { in: ids },
        status: { in: ["confirmed", "completed"] },
        startsAt: { lt: range.to },
        blockedUntil: { gt: range.from },
        ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
      },
      select: { professionalId: true, startsAt: true, blockedUntil: true },
    }),
  ]);

  return filtered.map((professional) => {
    const ownAppointments = appointments.filter(
      (appointment) => appointment.professionalId === professional.id,
    );

    return {
      id: professional.id,
      name: professional.displayName,
      color: professional.color,
      sortOrder: professional.sortOrder,
      schedules: schedules
        .filter((schedule) => schedule.professionalId === professional.id)
        .map((schedule) => ({
          weekday: schedule.weekday,
          opensAt: schedule.opensAt,
          closesAt: schedule.closesAt,
        })),
      timeOff: timeOff
        .filter((entry) => entry.professionalId === professional.id)
        .map((entry) => ({ start: entry.startsAt, end: entry.endsAt })),
      appointments: ownAppointments.map((appointment) => ({
        start: appointment.startsAt,
        end: appointment.blockedUntil,
      })),
      appointmentCount: ownAppointments.length,
    };
  });
}

async function loadResourceBusy(
  tx: Tx,
  base: SchedulingBase,
  range: { from: Date; to: Date },
): Promise<ResourceBusyRange[]> {
  if (base.resources.length === 0) {
    return [];
  }

  const resourceIds = base.resources.map((resource) => resource.id);

  const [reservations, blocks] = await Promise.all([
    tx.resourceReservation.findMany({
      where: {
        businessId: base.businessId,
        resourceId: { in: resourceIds },
        releasedAt: null,
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
    tx.resourceBlock.findMany({
      where: {
        businessId: base.businessId,
        resourceId: { in: resourceIds },
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
  ]);

  return [
    ...reservations.map((row) => ({
      resourceId: row.resourceId,
      start: row.startsAt,
      end: row.endsAt,
    })),
    ...blocks.map((row) => ({
      resourceId: row.resourceId,
      start: row.startsAt,
      end: row.endsAt,
    })),
  ];
}

function buildInput(
  base: SchedulingBase,
  professional: ProfessionalContext,
  range: { from: Date; to: Date },
  resourceBusy: ResourceBusyRange[],
  now: Date,
): AvailabilityInput {
  return {
    timezone: base.timezone,
    now,
    from: range.from,
    to: range.to,
    serviceDurationMinutes: base.durationMinutes,
    serviceBufferMinutes: base.bufferMinutes,
    slotIntervalMinutes: base.slotIntervalMinutes,
    minLeadMinutes: base.minLeadMinutes,
    maxAdvanceDays: base.maxAdvanceDays,
    businessHours: base.businessHours,
    professionalSchedules: professional.schedules,
    professionalTimeOff: professional.timeOff,
    appointments: professional.appointments,
    resourceRequirements: base.resourceRequirements,
    resources: base.resources,
    resourceBusy,
  };
}

export type ProfessionalSlots = {
  professional: ProfessionalContext;
  slots: AvailabilitySlot[];
};

/** Calcula los huecos de cada profesional cualificado, en bloque. */
export async function computeProfessionalSlots(
  tx: Tx,
  base: SchedulingBase,
  input: {
    from: Date;
    to: Date;
    professionalId?: string | null;
    now?: Date;
    ignoreAppointmentId?: string | null;
  },
): Promise<ProfessionalSlots[]> {
  const now = input.now ?? new Date();
  const professionals = await loadProfessionalContexts(
    tx,
    base,
    { from: input.from, to: input.to },
    input.professionalId,
    input.ignoreAppointmentId,
  );

  if (professionals.length === 0) {
    return [];
  }

  const resourceBusy = await loadResourceBusy(tx, base, {
    from: input.from,
    to: input.to,
  });

  return professionals.map((professional) => ({
    professional,
    slots: computeAvailability(
      buildInput(base, professional, { from: input.from, to: input.to }, resourceBusy, now),
    ),
  }));
}

/**
 * Une los huecos de todos los profesionales. Cuando varios pueden atender la
 * misma hora se elige el de menor carga del día, con desempate por orden y
 * luego por identificador.
 */
export function mergeProfessionalSlots(
  results: ProfessionalSlots[],
): ProfessionalSlot[] {
  const byStart = new Map<number, { slot: ProfessionalSlot; professional: ProfessionalContext }>();

  for (const { professional, slots } of results) {
    for (const slot of slots) {
      const key = slot.startsAt.getTime();
      const current = byStart.get(key);

      if (!current || beats(professional, current.professional)) {
        byStart.set(key, {
          slot: {
            ...slot,
            professionalId: professional.id,
            professionalName: professional.name,
            professionalColor: professional.color,
          },
          professional,
        });
      }
    }
  }

  return [...byStart.values()]
    .map((entry) => entry.slot)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

function beats(candidate: ProfessionalContext, current: ProfessionalContext) {
  if (candidate.appointmentCount !== current.appointmentCount) {
    return candidate.appointmentCount < current.appointmentCount;
  }

  if (candidate.sortOrder !== current.sortOrder) {
    return candidate.sortOrder < current.sortOrder;
  }

  return candidate.id < current.id;
}

/** Disponibilidad agrupada por día local, lista para la API y la web pública. */
export async function getAvailability(
  tx: Tx,
  query: AvailabilityQuery,
): Promise<AvailabilityDayDto[]> {
  const base = await loadSchedulingBase(tx, {
    businessId: query.businessId,
    locationId: query.locationId,
    serviceId: query.serviceId,
    serviceVariantId: query.serviceVariantId,
  });

  if (!base) {
    return [];
  }

  const results = await computeProfessionalSlots(tx, base, {
    from: query.from,
    to: query.to,
    professionalId: query.professionalId,
    now: query.now,
  });

  const slots = mergeProfessionalSlots(results);
  const days = new Map<string, AvailabilitySlotDto[]>();

  for (const slot of slots) {
    const date = localDateKey(slot.startsAt, base.timezone);
    const list = days.get(date) ?? [];
    list.push({
      startsAt: slot.startsAt.toISOString(),
      serviceEndsAt: slot.serviceEndsAt.toISOString(),
      professionalId: slot.professionalId,
      professionalName: slot.professionalName,
      professionalColor: slot.professionalColor,
      resources: slot.resources.map((resource) => ({
        id: resource.resourceId,
        name: base.resourceNames.get(resource.resourceId) ?? resource.resourceId,
      })),
    });
    days.set(date, list);
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots]) => ({ date, slots: daySlots }));
}

/** Rango de instantes que cubre las fechas locales indicadas. */
export function dayRange(
  timezone: string,
  fromDate: string,
  days: number,
): { from: Date; to: Date } {
  const [year, month, day] = fromDate.split("-").map(Number);
  const next = addLocalDays({ year, month, day }, days);
  const from = zonedTimeToUtc(timezone, year, month, day, 0, 0);
  const to = zonedTimeToUtc(timezone, next.year, next.month, next.day, 0, 0);

  if (from && to) {
    return { from, to };
  }

  // Zonas con cambio de hora a medianoche: se desplaza una hora.
  const fallbackFrom = new Date(Date.UTC(year, month - 1, day, 1));
  const fallbackTo = new Date(Date.UTC(next.year, next.month - 1, next.day, 1));

  return { from: fallbackFrom, to: fallbackTo };
}
