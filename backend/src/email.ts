import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPurchaseConfirmation(opts: {
  buyerEmail: string;
  buyerName: string;
  buildTitle: string;
  importCode: string;
  amount: number;
}) {
  if (!process.env.SMTP_USER) return; // Skip if not configured
  await transporter.sendMail({
    from: `"Sports Builds Market" <${process.env.SMTP_USER}>`,
    to: opts.buyerEmail,
    subject: `Your Build is Ready: ${opts.buildTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#7C3AED;">Sports Builds Market</h2>
        <p>Hi ${opts.buyerName},</p>
        <p>Your purchase of <strong>${opts.buildTitle}</strong> ($${opts.amount.toFixed(2)}) is confirmed!</p>
        <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
          <p style="margin:0;font-size:12px;color:#6b7280;">IMPORT CODE</p>
          <code style="font-size:14px;word-break:break-all;">${opts.importCode}</code>
        </div>
        <p style="color:#6b7280;font-size:12px;">Templates are user-generated; no affiliation with game publishers. Predictions are estimates only. Users assume risk.</p>
      </div>
    `,
  });
}

export async function sendBuildApprovedEmail(opts: {
  sellerEmail: string;
  sellerName: string;
  buildTitle: string;
}) {
  if (!process.env.SMTP_USER) return;
  await transporter.sendMail({
    from: `"Sports Builds Market" <${process.env.SMTP_USER}>`,
    to: opts.sellerEmail,
    subject: `Build Approved: ${opts.buildTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#7C3AED;">Sports Builds Market</h2>
        <p>Hi ${opts.sellerName},</p>
        <p>Great news! Your build <strong>${opts.buildTitle}</strong> has been approved and is now live on the marketplace.</p>
      </div>
    `,
  });
}
