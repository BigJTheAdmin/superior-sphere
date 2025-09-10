// src/lib/jobsStore.ts
import fs from "node:fs/promises";
import path from "node:path";

type Plan = "standard" | "featured";

export type Draft = {
  id: string;
  email: string;
  company?: string;
  plan: Plan;
  addons: string[];
  stripeSessionId: string;
  createdAt: number;
  publishedAt?: number;
  // published fields
  title?: string;
  location?: string;
  type?: string;
  applyUrl?: string;
  comp?: string;
  tags?: string;
  description?: string;
  highlight?: boolean;
  pinUntil?: number | null;
  featured?: boolean;
  liveUntil?: number;
};

const DATA = path.join(process.cwd(), "data");
const FILE = path.join(DATA, "jobs.json");

async function ensureFile() {
  await fs.mkdir(DATA, { recursive: true });
  try {
    await fs.access(FILE);
  } catch {
    await fs.writeFile(FILE, JSON.stringify({ drafts: [], jobs: [] }, null, 2));
  }
}

export async function addDraftFromCheckout(input: {
  email: string;
  company?: string;
  plan: Plan;
  addons: string[];
  stripeSessionId: string;
}) {
  await ensureFile();
  const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
  const id = cryptoRandomId();
  const now = Date.now();

  const draft: Draft = {
    id,
    email: input.email,
    company: input.company,
    plan: input.plan,
    addons: input.addons,
    stripeSessionId: input.stripeSessionId,
    createdAt: now,
  };

  raw.drafts.push(draft);
  await fs.writeFile(FILE, JSON.stringify(raw, null, 2));
  return id;
}

export async function getDraftById(id: string) {
  await ensureFile();
  const raw = JSON.parse(await fs.readFile(FILE, "utf8"));
  return raw.drafts.find((d: Draft) => d.id === id) || null;
}

export async function publishDraft(
  draftId: string,
  post: {
    title: string;
    company: string;
    location: string;
    type: string;
    applyUrl: string;
    comp?: string;
    tags?: string;
    description: string;
  }
) {
  await ensureFile();
  const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as {
    drafts: Draft[];
    jobs: Draft[];
  };

  const idx = raw.drafts.findIndex((d) => d.id === draftId);
  if (idx === -1) throw new Error("Draft not found");

  const draft = raw.drafts[idx];

  const now = Date.now();
  const LIVE_DAYS = 30;
  const liveUntil = now + LIVE_DAYS * 24 * 60 * 60 * 1000;

  const featured = draft.plan === "featured";
  const highlight = draft.addons.includes("highlight");
  const pinUntil = draft.addons.includes("pin") ? now + 7 * 86400000 : null;

  const merged: Draft = {
    ...draft,
    ...post,
    featured,
    highlight,
    pinUntil,
    liveUntil,
    publishedAt: now,
  };

  raw.jobs.push(merged);
  raw.drafts.splice(idx, 1);

  await fs.writeFile(FILE, JSON.stringify(raw, null, 2));
  return merged.id;
}

export async function getLiveJobs() {
  await ensureFile();
  const raw = JSON.parse(await fs.readFile(FILE, "utf8")) as {
    jobs: Draft[];
  };
  const now = Date.now();
  const live = raw.jobs.filter((j) => (j.liveUntil || 0) > now);

  const featured = live
    .filter((j) => j.featured)
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  const pinned = live
    .filter((j) => j.pinUntil && j.pinUntil > now)
    .sort((a, b) => (b.pinUntil || 0) - (a.pinUntil || 0));

  const standard = live
    .filter((j) => !j.featured && !(j.pinUntil && j.pinUntil > now))
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  return { featured, pinned, standard };
}

function cryptoRandomId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)))
    .map((n) => n.toString(16).padStart(8, "0"))
    .join("");
}

// Vite polyfill for getRandomValues in Node 18:
import { webcrypto as _wc } from "node:crypto";
const crypto = { getRandomValues: _wc.getRandomValues.bind(_wc) };
