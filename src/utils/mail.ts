import { Resend } from "resend";

const getClient = () => {
  const apiKey = process.env.RESEND_API_KEY!;
  return new Resend(apiKey);
};

interface SendEmailOptions {
  to: string;
  toName?: string; // Made optional using '?' so you don't always have to provide it
  subject: string;
  html: string;
}

export const sendEmail = async ({ to, subject, html, toName }: SendEmailOptions) => {
  const resend = getClient();
  await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || "Resale"} <${process.env.RESEND_FROM_EMAIL!}>`,
    to: toName ? `${toName} <${to}>` : to, // Nicely formats the recipient name if provided
    subject,
    html,
  });
};

const sendVerification = async (email: string, link: string) => {
  await sendEmail({
    to: email,
    subject: "Verify your email account", // Added a clear subject lines
    html: `<h1>Please click on <a href="${link}">this link</a> to verify your account.</h1>`,
  });
};

const sendPasswordResetLink = async (email: string, link: string) => {
  // FIXED: Changed from transport.sendMail to your custom sendEmail helper
  await sendEmail({
    to: email,
    subject: "Reset your password",
    html: `<h1>Please click on <a href="${link}">this link</a> to update your password.</h1>`,
  });
};

const sendPasswordUpdateMessage = async (email: string) => {
  // FIXED: Changed from transport.sendMail to your custom sendEmail helper
  await sendEmail({
    to: email,
    subject: "Password Updated Successfully",
    html: `<h1>Your password is updated, you can now use your new password.</h1>`,
  });
};

const mail = {
  sendVerification,
  sendPasswordResetLink,
  sendPasswordUpdateMessage,
};

export default mail;