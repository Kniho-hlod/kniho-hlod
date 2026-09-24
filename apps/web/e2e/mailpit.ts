const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 15_000;

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
}

/** Deletes every message, so a test only ever sees its own. */
export async function clearInbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

async function findMessageId(recipient: string): Promise<string | undefined> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  const { messages } = (await response.json()) as { messages: MailpitSummary[] };
  return messages.find((message) =>
    message.To.some((to) => to.Address.toLowerCase() === recipient.toLowerCase())
  )?.ID;
}

/** Waits for the newest email to `recipient` and returns its plain-text body. */
export async function waitForEmail(recipient: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const id = await findMessageId(recipient);
    if (id) {
      const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
      const { Text } = (await response.json()) as { Text: string };
      return Text;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`No email for ${recipient} arrived within ${POLL_TIMEOUT_MS} ms`);
}

/** The first link in an email body. */
export function findLink(emailText: string): string {
  const link = /https?:\/\/\S+/.exec(emailText)?.[0];
  if (!link) throw new Error('The email contains no link');
  return link;
}
