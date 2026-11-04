/**
 * Plantillas de email de la agenda.
 *
 * Cada plantilla recibe el `payload` guardado en `notification_outbox` y
 * devuelve asunto, HTML y texto. Sin dependencias: el HTML se construye con
 * un layout compartido y todas las variables se escapan.
 */

export type NotificationPayload = {
  bookingReference?: string;
  businessName?: string;
  locationName?: string;
  address?: string;
  timezone?: string;
  startsAt?: string;
  serviceEndsAt?: string;
  serviceName?: string;
  professionalName?: string;
  clientName?: string;
  manageUrl?: string;
  businessEmail?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatWhen(payload: NotificationPayload) {
  if (!payload.startsAt) {
    return "";
  }

  const timeZone = payload.timezone ?? "Europe/Madrid";

  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone,
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(payload.startsAt));
  } catch {
    return payload.startsAt;
  }
}

function detailRows(payload: NotificationPayload) {
  const rows: [string, string][] = [];

  if (payload.serviceName) rows.push(["Servicio", payload.serviceName]);
  if (payload.professionalName) rows.push(["Profesional", payload.professionalName]);
  const when = formatWhen(payload);
  if (when) rows.push(["Fecha", when]);
  if (payload.locationName) rows.push(["Sede", payload.locationName]);
  if (payload.address) rows.push(["Dirección", payload.address]);
  if (payload.bookingReference) rows.push(["Referencia", payload.bookingReference]);

  return rows;
}

function layout(input: {
  heading: string;
  intro: string;
  payload: NotificationPayload;
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const rows = detailRows(input.payload);

  const details = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 0;color:#71717a;font-size:13px;">${escapeHtml(label)}</td><td style="padding:4px 0 4px 16px;font-size:14px;color:#18181b;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const button = input.cta
    ? `<p style="margin:24px 0;"><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:#6d28d9;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">${escapeHtml(input.cta.label)}</a></p>`
    : "";

  return `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#18181b;max-width:560px;">
    <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(input.heading)}</h1>
    <p style="margin:0 0 20px;color:#3f3f46;">${escapeHtml(input.intro)}</p>
    <table style="border-collapse:collapse;">${details}</table>
    ${button}
    ${input.footer ? `<p style="font-size:13px;color:#71717a;">${escapeHtml(input.footer)}</p>` : ""}
    <p style="font-size:13px;color:#a1a1aa;margin-top:28px;">${escapeHtml(input.payload.businessName ?? "Velora")} · Velora</p>
  </div>`;
}

function toText(input: {
  heading: string;
  intro: string;
  payload: NotificationPayload;
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const lines = [input.heading, "", input.intro, ""];

  for (const [label, value] of detailRows(input.payload)) {
    lines.push(`${label}: ${value}`);
  }

  if (input.cta) {
    lines.push("", `${input.cta.label}: ${input.cta.url}`);
  }

  if (input.footer) {
    lines.push("", input.footer);
  }

  lines.push("", `${input.payload.businessName ?? "Velora"} · Velora`);
  return lines.join("\n");
}

function confirmation(payload: NotificationPayload): RenderedEmail {
  const heading = "Tu cita está confirmada";
  const intro = `${payload.businessName ?? "El negocio"} te espera. Aquí tienes los detalles de tu reserva.`;

  return {
    subject: `Cita confirmada en ${payload.businessName ?? "Velora"}${payload.bookingReference ? ` · ${payload.bookingReference}` : ""}`,
    html: layout({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Ver o cancelar mi cita", url: payload.manageUrl }
        : undefined,
      footer: "Si no puedes asistir, cancela desde el enlace. Así otra persona puede aprovechar el hueco.",
    }),
    text: toText({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Ver o cancelar mi cita", url: payload.manageUrl }
        : undefined,
      footer: "Si no puedes asistir, cancela desde el enlace.",
    }),
  };
}

function reminder(payload: NotificationPayload): RenderedEmail {
  const heading = "Recordatorio de tu cita";
  const intro = `Te recordamos tu cita en ${payload.businessName ?? "el negocio"}.`;

  return {
    subject: `Recordatorio: ${payload.serviceName ?? "tu cita"} en ${payload.businessName ?? "Velora"}`,
    html: layout({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Gestionar mi cita", url: payload.manageUrl }
        : undefined,
      footer: "Si ya no puedes acudir, cancela con antelación.",
    }),
    text: toText({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Gestionar mi cita", url: payload.manageUrl }
        : undefined,
    }),
  };
}

function businessNotice(payload: NotificationPayload): RenderedEmail {
  const heading = "Nueva cita en tu agenda";
  const intro = `${payload.clientName ?? "Un cliente"} ha reservado ${payload.serviceName ?? "un servicio"}.`;

  return {
    subject: `Nueva cita: ${payload.clientName ?? "cliente"} · ${payload.bookingReference ?? ""}`.trim(),
    html: layout({
      heading,
      intro,
      payload,
      footer: "Puedes verla en la agenda del panel.",
    }),
    text: toText({
      heading,
      intro,
      payload,
      footer: "Puedes verla en la agenda del panel.",
    }),
  };
}

function cancelledForClient(payload: NotificationPayload): RenderedEmail {
  const heading = "Tu cita se ha cancelado";
  const intro = `La cita en ${payload.businessName ?? "el negocio"} ha quedado cancelada.`;

  return {
    subject: `Cita cancelada en ${payload.businessName ?? "Velora"}`,
    html: layout({
      heading,
      intro,
      payload,
      footer: `Si quieres, puedes reservar de nuevo en ${payload.businessName ?? "la web del negocio"}.`,
    }),
    text: toText({
      heading,
      intro,
      payload,
      footer: "Puedes reservar de nuevo cuando quieras.",
    }),
  };
}

function cancellationNotice(payload: NotificationPayload): RenderedEmail {
  const heading = "Una cita se ha cancelado";
  const intro = `${payload.clientName ?? "Un cliente"} ha cancelado ${payload.serviceName ?? "una cita"}.`;

  return {
    subject: `Cita cancelada: ${payload.clientName ?? "cliente"} · ${payload.bookingReference ?? ""}`.trim(),
    html: layout({ heading, intro, payload }),
    text: toText({ heading, intro, payload }),
  };
}

function rescheduled(payload: NotificationPayload): RenderedEmail {
  const heading = "Tu cita ha cambiado";
  const intro = `La cita en ${payload.businessName ?? "el negocio"} se ha movido a la nueva fecha que ves abajo.`;

  return {
    subject: `Tu cita en ${payload.businessName ?? "Velora"} ha cambiado`,
    html: layout({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Ver mi cita", url: payload.manageUrl }
        : undefined,
    }),
    text: toText({
      heading,
      intro,
      payload,
      cta: payload.manageUrl
        ? { label: "Ver mi cita", url: payload.manageUrl }
        : undefined,
    }),
  };
}

const registry: Record<string, (payload: NotificationPayload) => RenderedEmail> = {
  appointment_confirmed: confirmation,
  appointment_reminder: reminder,
  appointment_notice_business: businessNotice,
  appointment_cancelled_client: cancelledForClient,
  appointment_cancelled_business: cancellationNotice,
  appointment_rescheduled: rescheduled,
  appointment_rescheduled_business: businessNotice,
};

export function renderEmail(
  template: string,
  payload: NotificationPayload,
): RenderedEmail | null {
  const renderer = registry[template];

  return renderer ? renderer(payload) : null;
}
