export interface SendEmailOpts {
  token: string; from: string; fromName?: string;
  to: string[]; subject: string; html: string; text?: string;
}

export async function sendEmail(o: SendEmailOpts): Promise<void> {
  const res = await fetch("https://api.mailersend.com/v1/email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${o.token}`,
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      from: { email: o.from, name: o.fromName ?? "DMARC Dashboard" },
      to: o.to.map((email) => ({ email })),
      subject: o.subject,
      html: o.html,
      text: o.text ?? o.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }),
  });
  if (!res.ok) throw new Error(`MailerSend send failed: ${res.status} ${await res.text()}`);
}
