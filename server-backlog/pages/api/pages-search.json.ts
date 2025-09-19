// src/pages/api/pages-search.json.ts
import type { APIRoute } from "astro";
import { PAGES } from "@/data/pages.search";

export const prerender = true;

export const GET: APIRoute = async () => {
  // Keep payload small—client filters.
  return new Response(JSON.stringify(PAGES), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    status: 200,
  });
};
