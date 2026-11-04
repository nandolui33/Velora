import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  type AvailabilityInput,
} from "@/modules/scheduling/availability";
import {
  localDateKey,
  localTimeLabel,
  zonedTimeToUtc,
} from "@/modules/scheduling/time";

const TZ = "Europe/Madrid";

function utc(year: number, month: number, day: number, hour = 0, minute = 0) {
  const value = zonedTimeToUtc(TZ, year, month, day, hour, minute);
  if (!value) {
    throw new Error(`Hora local inexistente: ${year}-${month}-${day} ${hour}:${minute}`);
  }
  return value;
}

function baseInput(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    timezone: TZ,
    now: new Date("2026-11-09T06:00:00Z"),
    from: utc(2026, 11, 10),
    to: utc(2026, 11, 11),
    serviceDurationMinutes: 30,
    serviceBufferMinutes: 0,
    slotIntervalMinutes: 15,
    minLeadMinutes: 0,
    maxAdvanceDays: 60,
    businessHours: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensAt: "09:00",
      closesAt: "18:00",
      closed: false,
    })),
    professionalSchedules: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      opensAt: "09:00",
      closesAt: "18:00",
    })),
    professionalTimeOff: [],
    appointments: [],
    resourceRequirements: [],
    resources: [],
    resourceBusy: [],
    ...overrides,
  };
}

function labels(input: AvailabilityInput, slots: ReturnType<typeof computeAvailability>) {
  return slots.map((slot) => localTimeLabel(slot.startsAt, input.timezone));
}

describe("motor de disponibilidad", () => {
  it("genera huecos cada intervalo hasta que la duración cabe antes del cierre", () => {
    const input = baseInput();
    const slots = computeAvailability(input);

    // 09:00–18:00 con 30 min de servicio y 15 de intervalo: 09:00 … 17:30.
    expect(slots).toHaveLength(35);
    expect(labels(input, slots)[0]).toBe("09:00");
    expect(labels(input, slots).at(-1)).toBe("17:30");
    expect(slots[0].serviceEndsAt.getTime() - slots[0].startsAt.getTime()).toBe(
      30 * 60_000,
    );
  });

  it("el margen posterior forma parte del intervalo ocupado", () => {
    const input = baseInput({ serviceBufferMinutes: 15 });
    const slots = computeAvailability(input);

    // El último hueco tiene que terminar (con margen) antes de las 18:00.
    expect(labels(input, slots).at(-1)).toBe("17:15");
    expect(slots.at(-1)?.blockedUntil.getTime()).toBe(utc(2026, 11, 10, 18).getTime());
  });

  it("respeta el intervalo semiabierto de las citas existentes", () => {
    const input = baseInput({
      appointments: [
        { start: utc(2026, 11, 10, 9), end: utc(2026, 11, 10, 10) },
      ],
    });
    const slots = labels(input, computeAvailability(input));

    expect(slots).not.toContain("09:00");
    expect(slots).not.toContain("09:45");
    // La cita termina a las 10:00, así que las 10:00 quedan libres.
    expect(slots).toContain("10:00");
  });

  it("aplica la antelación mínima y la máxima", () => {
    const input = baseInput({
      now: utc(2026, 11, 10, 9, 10),
      minLeadMinutes: 120,
      maxAdvanceDays: 1,
    });
    const slots = labels(input, computeAvailability(input));

    // 09:10 + 120 min = 11:10; el primer múltiplo de 15 es 11:15.
    expect(slots[0]).toBe("11:15");
    expect(slots.at(-1)).toBe("17:30");
  });

  it("descuenta ausencias del profesional", () => {
    const input = baseInput({
      professionalTimeOff: [
        { start: utc(2026, 11, 10, 9), end: utc(2026, 11, 10, 13) },
      ],
    });
    const slots = labels(input, computeAvailability(input));

    expect(slots[0]).toBe("13:00");
    expect(slots).toHaveLength(19);
  });

  it("no ofrece nada en un día cerrado", () => {
    const input = baseInput({
      businessHours: [{ weekday: 2, opensAt: "09:00", closesAt: "18:00", closed: true }],
    });

    expect(computeAvailability(input)).toHaveLength(0);
  });

  it("cruza el cambio al horario de verano sin adelantar la apertura local", () => {
    // 2026-03-29 es domingo: a las 02:00 se pasa de CET a CEST (día de 23 h).
    const input = baseInput({
      now: new Date("2026-03-27T06:00:00Z"),
      from: utc(2026, 3, 29),
      to: utc(2026, 3, 30),
      businessHours: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00", closed: false }],
      professionalSchedules: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00" }],
    });

    const slots = computeAvailability(input);
    expect(localTimeLabel(slots[0].startsAt, TZ)).toBe("09:00");
    // 09:00 en CEST es 07:00 UTC.
    expect(slots[0].startsAt.toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("cruza el cambio al horario de invierno manteniendo la hora local", () => {
    // 2026-10-25 es domingo: a las 03:00 se vuelve a las 02:00 (día de 25 h).
    const input = baseInput({
      now: new Date("2026-10-23T06:00:00Z"),
      from: utc(2026, 10, 25),
      to: utc(2026, 10, 26),
      businessHours: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00", closed: false }],
      professionalSchedules: [{ weekday: 7, opensAt: "09:00", closesAt: "18:00" }],
    });

    const slots = computeAvailability(input);
    expect(localTimeLabel(slots[0].startsAt, TZ)).toBe("09:00");
    // 09:00 en CET es 08:00 UTC.
    expect(slots[0].startsAt.toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(slots).toHaveLength(35);
  });

  it("descarta una ventana que solo existe en la hora inexistente", () => {
    const input = baseInput({
      now: new Date("2026-03-27T06:00:00Z"),
      from: utc(2026, 3, 29),
      to: utc(2026, 3, 30),
      businessHours: [{ weekday: 7, opensAt: "02:00", closesAt: "03:00", closed: false }],
      professionalSchedules: [{ weekday: 7, opensAt: "02:00", closesAt: "03:00" }],
    });

    expect(computeAvailability(input)).toHaveLength(0);
  });

  it("exige recursos libres y los asigna de forma determinista", () => {
    const input = baseInput({
      resourceRequirements: [{ resourceTypeId: "type-1", quantity: 1 }],
      resources: [
        { id: "b", resourceTypeId: "type-1", sortOrder: 2, active: true },
        { id: "a", resourceTypeId: "type-1", sortOrder: 1, active: true },
      ],
      resourceBusy: [
        { resourceId: "a", start: utc(2026, 11, 10, 9), end: utc(2026, 11, 10, 10) },
      ],
    });

    const slots = computeAvailability(input);
    expect(slots).toHaveLength(35);

    const first = slots.find(
      (slot) => localTimeLabel(slot.startsAt, TZ) === "09:00",
    );
    // "a" está ocupado a las 09:00: se elige "b".
    expect(first?.resources[0].resourceId).toBe("b");

    const second = slots.find(
      (slot) => localTimeLabel(slot.startsAt, TZ) === "10:00",
    );
    // A las 10:00 "a" vuelve a estar libre y tiene menos carga acumulada.
    expect(second?.resources[0].resourceId).toBe("a");
  });

  it("rechaza el hueco si no hay suficientes recursos del tipo pedido", () => {
    const input = baseInput({
      resourceRequirements: [{ resourceTypeId: "type-1", quantity: 2 }],
      resources: [{ id: "a", resourceTypeId: "type-1", sortOrder: 1, active: true }],
    });

    expect(computeAvailability(input)).toHaveLength(0);
  });

  it("un recurso concreto ocupado descarta el hueco", () => {
    const input = baseInput({
      resourceRequirements: [
        { resourceTypeId: "type-1", quantity: 1, resourceId: "a" },
      ],
      resources: [
        { id: "a", resourceTypeId: "type-1", sortOrder: 1, active: true },
        { id: "b", resourceTypeId: "type-1", sortOrder: 2, active: true },
      ],
      resourceBusy: [
        { resourceId: "a", start: utc(2026, 11, 10, 9), end: utc(2026, 11, 10, 18) },
      ],
    });

    expect(computeAvailability(input)).toHaveLength(0);
  });

  it("etiqueta las fechas locales del rango", () => {
    expect(localDateKey(utc(2026, 11, 10, 23, 30), TZ)).toBe("2026-11-10");
    expect(localDateKey(new Date("2026-11-10T23:30:00Z"), TZ)).toBe("2026-11-11");
  });
});
