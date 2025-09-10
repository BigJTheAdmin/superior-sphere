// src/lib/auth.ts
import crypto from "node:crypto";

// ENV: JOB_SIGNING_SECRET

type TokenPayload = {
  draftId: string;
  email: string;
  plan: string;
  addons: string[];
  // Optional: exp
};

const secret = () => (import.meta.env.JOB_SIGNING_SECRET || "dev-secret");

export function signPostToken(payload: TokenPayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPostToken(token: string) {
  try {
    const [data, sig] = token.split(".");
    const calc = crypto.createHmac("sha256", secret()).update(data).digest("base64url");
    if (sig !== calc) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString());
    return payload as TokenPayload;
  } catch {
    return null;
  }
}
