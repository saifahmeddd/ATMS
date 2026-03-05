import nodemailer from "nodemailer";

const smtpConfigured =
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASSWORD;

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? "587", 10),
      secure: process.env.SMTP_PORT === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  : null;

async function sendEmail(to: string, subject: string, html: string) {
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "noreply@almnfthen.com",
      to,
      subject,
      html,
    });
  } else {
    console.log("=== TMS EMAIL (SMTP not configured) ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("======================================");
  }
}

export async function sendEnrollmentNotificationEmail(
  to: string,
  courseTitle: string,
  approved: boolean,
  comment?: string
) {
  const verb = approved ? "approved" : "rejected";
  const subject = `TMS - Enrollment ${verb}: ${courseTitle}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Enrollment ${verb.charAt(0).toUpperCase() + verb.slice(1)}</h2>
      <p>Your enrollment request for <strong>${courseTitle}</strong> has been ${verb}.</p>
      ${comment ? `<p>Comment from your manager: ${comment}</p>` : ""}
      <p>Log in to your TMS account to view your courses.</p>
    </div>
  `;
  await sendEmail(to, subject, html);
}

export async function sendCertificateEmail(to: string, courseTitle: string) {
  const subject = `TMS - Certificate Issued: ${courseTitle}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Congratulations!</h2>
      <p>You have successfully completed <strong>${courseTitle}</strong>.</p>
      <p>Your certificate is now available. Log in to your TMS account to download it.</p>
    </div>
  `;
  await sendEmail(to, subject, html);
}

export async function sendDeadlineReminderEmail(
  to: string,
  courseTitle: string,
  daysLeft: number,
  progressPct: number
) {
  const subject = `TMS - Deadline Reminder: ${courseTitle} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left)`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Deadline Reminder</h2>
      <p>Your deadline for <strong>${courseTitle}</strong> is in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.</p>
      <p>Current progress: ${progressPct}%</p>
      <p>Log in to continue your training.</p>
    </div>
  `;
  await sendEmail(to, subject, html);
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
) {
  const subject = "TMS - Password Reset Request";
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Password Reset</h2>
      <p>You requested a password reset for your TMS account.</p>
      <p>Click the link below to set a new password. This link expires in 1 hour.</p>
      <p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "noreply@almnfthen.com",
      to,
      subject,
      html,
    });
  } else {
    console.log("=== PASSWORD RESET EMAIL (SMTP not configured) ===");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log("==================================================");
  }
}
