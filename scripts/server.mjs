import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { query } from "../lib/career.mjs";
const root = resolve("dist");
const data = JSON.parse(
  await readFile(root + "/api/career/public.json", "utf8"),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".pdf": "application/pdf",
};
export const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }
  try {
    const url = new URL(req.url, "http://localhost");
    if (
      url.pathname.startsWith("/api/career/") &&
      !url.pathname.endsWith(".json")
    ) {
      if (
        [...url.searchParams.keys()].some(
          (k) => url.searchParams.getAll(k).length > 1,
        )
      )
        throw new Error("Duplicate query parameter");
      const result = query(
        data,
        url.pathname,
        Object.fromEntries(url.searchParams),
      );
      res.writeHead(200, {
        "Content-Type": types[".json"],
        "Cache-Control": "public, max-age=300",
      });
      return res.end(
        req.method === "HEAD" ? undefined : JSON.stringify(result),
      );
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = resolve(root, "." + path);
    if (!file.startsWith(root + sep))
      throw Object.assign(Error("Not found"), { status: 404 });
    const content = await readFile(file);
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : error.status || 400, {
      "Content-Type": types[".json"],
    });
    res.end(
      JSON.stringify({
        error: error.code === "ENOENT" ? "Not found" : error.message,
      }),
    );
  }
});
server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
  console.log(`Local: http://127.0.0.1:${server.address().port}`),
);
