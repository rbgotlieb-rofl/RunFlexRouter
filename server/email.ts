import { Resend } from "resend";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(
      `[Email] RESEND_API_KEY not set — skipping email. Reset URL: ${resetUrl}`
    );
    return;
  }

  const fromAddress = process.env.EMAIL_FROM || "RunFlex <noreply@runflex.app>";
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: fromAddress,
    to,
    subject: "Reset your RunFlex password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p style="color: #4a4a4a; line-height: 1.6;">
          We received a request to reset the password for your RunFlex account.
          Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; padding: 12px 24px; background-color: #2563eb;
                  color: #ffffff; text-decoration: none; border-radius: 8px;
                  font-weight: 600; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #6b7280; font-size: 14px; line-height: 1.5;">
          This link will expire in 1 hour. If you didn't request a password reset,
          you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
        </p>
      </div>
    `,
  });

  console.log(`[Email] Password reset email sent to ${to}`);
}
