import nodemailer from "nodemailer";

type InvitationEmail = {
  to: string;
  businessName: string;
  invitationUrl: string;
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

export async function sendInvitationEmail({
  to,
  businessName,
  invitationUrl,
}: InvitationEmail) {
  if (!process.env.EMAIL_SERVER) {
    throw new Error("EMAIL_SERVER no está configurado");
  }

  const transporter = nodemailer.createTransport(process.env.EMAIL_SERVER);
  const from = process.env.EMAIL_FROM ?? "Velora <no-reply@velora.test>";

  await transporter.sendMail({
    to,
    from,
    subject: `Invitación a ${businessName} en Velora`,
    text: [
      `Te han invitado a gestionar ${businessName} en Velora.`,
      "",
      "Abre este enlace para aceptar la invitación:",
      invitationUrl,
      "",
      "Si no esperabas esta invitación, puedes ignorar este mensaje.",
      "",
      `Velora · ${appUrl()}`,
    ].join("\n"),
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; line-height: 1.6; color: #18181b;">
        <h1 style="font-size: 22px;">Te han invitado a ${escapeHtml(businessName)}</h1>
        <p>Ya puedes entrar en Velora para configurar el negocio y su agenda.</p>
        <p style="margin: 24px 0;">
          <a href="${escapeHtml(invitationUrl)}" style="display:inline-block;background:#6d28d9;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">
            Aceptar invitación
          </a>
        </p>
        <p style="font-size: 13px; color: #71717a;">Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
        <p style="font-size: 13px; color: #71717a;">Velora · ${escapeHtml(appUrl())}</p>
      </div>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
