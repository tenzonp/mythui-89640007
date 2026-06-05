// Aakash SMS sender (sms.aakashsms.com)
// Docs: POST https://sms.aakashsms.com/sms/v3/send with form fields auth_token, to, text

const AAKASH_URL = "https://sms.aakashsms.com/sms/v3/send";

export type AakashResult = {
  ok: boolean;
  status: number;
  body?: any;
  error?: string;
};

function normalizeNepaliPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Aakash expects local 10-digit numbers starting with 9
  if (digits.length === 10 && digits.startsWith("9")) return digits;
  if (digits.length === 13 && digits.startsWith("9779")) return digits.slice(3);
  if (digits.length === 12 && digits.startsWith("977")) return digits.slice(3);
  return digits;
}

export async function sendAakashSMS(opts: { to: string; text: string }): Promise<AakashResult> {
  const token = process.env.AAKASH_SMS_API_KEY;
  if (!token) return { ok: false, status: 0, error: "AAKASH_SMS_API_KEY not configured" };
  const to = normalizeNepaliPhone(opts.to);
  if (!to || to.length < 10) return { ok: false, status: 0, error: "Invalid phone number" };

  const body = new URLSearchParams({ auth_token: token, to, text: opts.text });
  try {
    const res = await fetch(AAKASH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const txt = await res.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { json = txt; }
    if (!res.ok) {
      return { ok: false, status: res.status, body: json, error: typeof json === "object" ? json?.error ?? json?.message ?? `HTTP ${res.status}` : `HTTP ${res.status}` };
    }
    // Aakash returns { error: false, ... } on success in most cases
    if (json && typeof json === "object" && json.error === true) {
      return { ok: false, status: res.status, body: json, error: json.message ?? "Aakash error" };
    }
    return { ok: true, status: res.status, body: json };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message ?? String(e) };
  }
}
