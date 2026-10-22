import { query } from "./lib/career.mjs";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/career/"))
      return env.ASSETS.fetch(request);
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    if (url.pathname.endsWith(".json")) return env.ASSETS.fetch(request);
    try {
      if (
        [...url.searchParams.keys()].some(
          (k) => url.searchParams.getAll(k).length > 1,
        )
      )
        throw Error("Duplicate query parameter");
      const response = await env.ASSETS.fetch(
        new Request(new URL("/api/career/public.json", url), { method: "GET" }),
      );
      if (!response.ok) throw Error("Dataset unavailable");
      const data = await response.json();
      const body = query(
        data,
        url.pathname,
        Object.fromEntries(url.searchParams),
      );
      return new Response(
        request.method === "HEAD" ? null : JSON.stringify(body),
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch (error) {
      return Response.json(
        { error: error.message },
        { status: error.status || 400 },
      );
    }
  },
};
