import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { safeSlug, excluded, sections } from "../lib/career.mjs";
const owner = "TheRealOP";
export async function github(path, token = process.env.GITHUB_TOKEN) {
  const response = await fetch("https://api.github.com/" + path, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "portfolio-career-intake",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw Error(`GitHub ${response.status}: ${path}`);
  return response.json();
}
export async function analyze(repo, api = github) {
  if (
    repo.private ||
    repo.visibility === "private" ||
    repo.owner.login !== owner ||
    repo.fork ||
    repo.archived
  )
    return null;
  const name = repo.name.toLowerCase();
  if (!safeSlug(name)) return null;
  const prefix = `repos/${owner}/${encodeURIComponent(repo.name)}`;
  const commit = await api(
    `${prefix}/commits/${encodeURIComponent(repo.default_branch)}`,
  );
  const tree = await api(`${prefix}/git/trees/${commit.sha}?recursive=1`);
  if (tree.truncated)
    throw Error("Truncated repository tree; manual inspection required");
  const paths = tree.tree.filter((x) => x.type === "blob").map((x) => x.path);
  const relevant = paths.filter((p) =>
    /(^|\/)(readme\.md|package\.json|pyproject\.toml|cargo\.toml|go\.mod)$/i.test(
      p,
    ),
  );
  const source = paths.filter(
    (p) =>
      /\.(py|ts|js|swift|rs|go|cpp)$/.test(p) &&
      !/(^|\/)(node_modules|vendor|dist|tests?|\.git)\//.test(p),
  );
  const sampleable = new Set(
    tree.tree
      .filter((x) => x.type === "blob" && x.size <= 100000)
      .map((x) => x.path),
  );
  const selected = [
    ...relevant.filter((p) => sampleable.has(p)).slice(0, 5),
    ...source.filter((p) => sampleable.has(p)).slice(0, 5),
  ];
  const samples = [];
  for (const path of selected) {
    const file = await api(
      `${prefix}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${commit.sha}`,
    );
    if (file.encoding !== "base64" || !file.content) continue;
    const text = Buffer.from(file.content, "base64")
      .toString("utf8")
      .slice(0, 16000);
    samples.push({ path, sha: file.sha, text });
  }
  const languages = await api(`${prefix}/languages`);
  const dependencies = [];
  for (const sample of samples)
    if (sample.path.endsWith("package.json")) {
      try {
        const p = JSON.parse(sample.text);
        dependencies.push(
          ...Object.keys({ ...p.dependencies, ...p.devDependencies }),
        );
      } catch {
        /* malformed manifests remain untrusted samples */
      }
    }
  const readme = samples.find((s) => /readme\.md$/i.test(s.path));
  const planned =
    readme?.text
      .split("\n")
      .filter((l) => /todo|planned|roadmap|future|\[ \]/i.test(l))
      .slice(0, 15) || [];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        files: tree.tree
          .filter(
            (x) =>
              x.type === "blob" && [...relevant, ...source].includes(x.path),
          )
          .map((x) => [x.path, x.sha]),
        samples: samples.map((s) => [s.path, s.sha]),
        languages,
      }),
    )
    .digest("hex");
  const primary = Object.keys(languages)[0] || "the primary implementation";
  return {
    schemaVersion: 1,
    repository: repo.full_name,
    slug: name,
    head: commit.sha,
    fingerprint,
    lifecycle: "discovered",
    approved: false,
    status: "needs_review",
    observations: {
      languages: Object.keys(languages),
      dependencies,
      sourceFiles: source.slice(0, 30),
      sampledFiles: samples.map(({ path, sha }) => ({ path, sha })),
      readmePresent: !!readme,
    },
    // Repository prose is data only. Never execute it or promote it into agent instructions.
    untrustedReadme: { text: readme?.text || "", plannedStatements: planned },
    implementedFeatures: [],
    plannedFeatures: planned,
    questions: [
      `What problem does ${repo.name} solve, and who has used it?`,
      `Which ${primary} modules did you personally implement, and who else contributed?`,
      `How do ${source.slice(0, 2).join(" and ") || "the main components"} interact, and which features actually run today?`,
      `Why did you choose ${dependencies.slice(0, 3).join(", ") || primary}, and what tradeoffs or failures did you encounter?`,
      "What results, limitations, and lessons can you support with screenshots, tests, or measurements?",
    ],
    answers: {},
    snippet: null,
    caseStudy: Object.fromEntries(sections.map((s) => [s, []])),
  };
}
export async function discover(repos, state, db, api = github) {
  const drafts = [];
  const next = structuredClone(state);
  for (const repo of repos) {
    if (excluded(repo.name, db) || repo.name.toLowerCase() === "portfolio")
      continue;
    const draft = await analyze(repo, api);
    if (!draft) continue;
    const existing = db.projects.find(
      (p) =>
        p.repository?.toLowerCase() ===
        `https://github.com/${repo.full_name}`.toLowerCase(),
    );
    if (existing) draft.slug = existing.slug;
    const previous = state[draft.repository];
    if (previous?.fingerprint === draft.fingerprint) continue;
    next[draft.repository] = {
      head: draft.head,
      fingerprint: draft.fingerprint,
      reviewStatus: "awaiting_owner",
    };
    drafts.push(draft);
  }
  return { drafts, state: next };
}
export async function main() {
  const db = JSON.parse(await readFile("career/database.json", "utf8"));
  const api = process.argv.includes("--github-cli")
    ? async (path) =>
        JSON.parse(
          execFileSync("gh", ["api", path], {
            encoding: "utf8",
            timeout: 30000,
            maxBuffer: 4000000,
          }),
        )
    : github;
  const repoIndex = process.argv.indexOf("--repo");
  const selected = repoIndex < 0 ? null : process.argv[repoIndex + 1];
  if (
    selected &&
    (!selected.startsWith(owner + "/") ||
      !safeSlug(selected.split("/")[1].toLowerCase()))
  )
    throw Error("Expected an owned repository");
  let state = {};
  try {
    state = JSON.parse(await readFile("career/intake/state.json", "utf8"));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const repos = [];
  if (selected) repos.push(await api(`repos/${selected}`));
  else
    for (let page = 1; ; page++) {
      const list = await api(
        `users/${owner}/repos?per_page=100&page=${page}&type=owner`,
      );
      repos.push(...list);
      if (list.length < 100) break;
    }
  const result = await discover(repos, state, db, api);
  await mkdir("career/intake/drafts", { recursive: true });
  for (const draft of result.drafts) {
    const path = `career/intake/drafts/${draft.slug}.json`;
    let previous;
    try {
      previous = JSON.parse(await readFile(path, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    if (previous) {
      draft.answers = previous.answers || {};
      draft.previousHead = previous.head;
      draft.reviewRequiredAfterChange = true;
    }
    await writeFile(path, JSON.stringify(draft, null, 2) + "\n");
  }
  await writeFile(
    "career/intake/state.json",
    JSON.stringify(result.state, null, 2) + "\n",
  );
  console.log(
    `Prepared ${result.drafts.length} drafts; no publication changes.`,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
