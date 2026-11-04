import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type ExportFormat = "csv" | "json";

function escapeCsv(value: string | number | null) {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",;\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/**
 * Exporta las fichas de clientes de una empresa.
 *
 * La consulta pasa por RLS con contexto de empresa, así que el resultado nunca
 * incluye datos de otras empresas.
 */
export async function exportClients(
  tx: Tx,
  input: { businessId: string; format: ExportFormat },
) {
  const clients = await tx.client.findMany({
    where: { businessId: input.businessId, deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 10_000,
    include: {
      _count: { select: { appointments: true } },
      consents: {
        where: { type: "marketing" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const rows = clients.map((client) => ({
    nombre: client.firstName,
    apellidos: client.lastName ?? "",
    email: client.email ?? "",
    telefono: client.phoneE164 ?? client.phoneRaw ?? "",
    ultima_visita: client.lastVisitAt?.toISOString() ?? "",
    alta: client.createdAt.toISOString(),
    citas: client._count.appointments,
    consentimiento_privacidad: client.privacyAcceptedAt ? "si" : "no",
    consentimiento_marketing: client.marketingConsent ? "si" : "no",
  }));

  if (input.format === "json") {
    return {
      filename: `clientes-${new Date().toISOString().slice(0, 10)}.json`,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ exportedAt: new Date().toISOString(), clients: rows }, null, 2),
    };
  }

  const headers = Object.keys(
    rows[0] ?? {
      nombre: "",
      apellidos: "",
      email: "",
      telefono: "",
      ultima_visita: "",
      alta: "",
      citas: 0,
      consentimiento_privacidad: "",
      consentimiento_marketing: "",
    },
  );

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => escapeCsv(row[header as keyof typeof row]))
        .join(","),
    ),
  ];

  return {
    filename: `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    contentType: "text/csv; charset=utf-8",
    body: `\uFEFF${lines.join("\r\n")}\r\n`,
  };
}
