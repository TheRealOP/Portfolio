import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { publicCareer, query, sections } from "../lib/career.mjs";
const db = JSON.parse(await readFile("career/database.json", "utf8"));
const data = publicCareer(db);
import { escapeHTML as h, fillTemplate } from "../lib/html.mjs";
const write = async (path, text) => {
  await mkdir("dist/" + path.split("/").slice(0, -1).join("/"), {
    recursive: true,
  });
  await writeFile("dist/" + path, text);
};
const json = (path, value) =>
  write(path, JSON.stringify(value, null, 2) + "\n");
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const path of [
  "styles.css",
  "script.js",
  "CNAME",
  "Ojas__Resume (20).pdf",
])
  await copyFile(path, "dist/" + path);
await mkdir("dist/lib");
await copyFile("lib/career.mjs", "dist/lib/career.mjs");
await copyFile("public/agent-tools.js", "dist/agent-tools.js");
const url = "https://ojaspolakhare.com";
const template = await readFile("index.html", "utf8");
const layout = (title, desc, path, body, ld) =>
  fillTemplate(template, {
    TITLE: h(title),
    DESCRIPTION: h(desc),
    URL: url + path,
    BODY: body,
    JSONLD: JSON.stringify(ld).replace(/</g, "\\u003c"),
  });
const renderClaims = (claims) =>
  claims
    .map(
      (c) =>
        `<p>${h(c.text)}${c.status === "needs_review" ? '<small class="status">Previously published · awaiting evidence review</small>' : ""}</p>`,
    )
    .join("");
const tags = (p) =>
  `<div class="tags">${p.skills.map((s) => `<span>${h(s.text)}</span>`).join("")}</div>`;
const cards = data.projects
  .map(
    (p) =>
      `<li class="project-card"><div class="eyebrow">${h(p.category)}</div><h3><a href="/projects/${p.slug}/">${h(p.title)}</a></h3><p>${h((p.sections.overview[0]?.text || "").split(/(?<=\.)\s/)[0])}</p>${tags(p)}<a href="/projects/${p.slug}/" aria-label="Read ${h(p.title)} case study">Read case study →</a></li>`,
  )
  .join("");
const home = layout(
  "Engineering, research & AI agents",
  data.profile.summary.text,
  "/",
  `<section class="hero"><p class="eyebrow">Engineering · Research · Autonomous agents</p><h1>${h(data.profile.name.text)}</h1><p class="lede">${h(data.profile.summary.text)}</p><div class="actions"><a class="button" href="#projects">Explore my work</a><a href="/resume/">Resume & evidence →</a></div></section><section id="projects"><h2>Projects</h2><p>Explore the systems, implementation details, and evidence behind the work.</p><ul id="projects-list" class="project-list">${cards}</ul></section><section id="experience"><h2>Experience</h2>${data.experience.map((e) => `<article><h3><a href="/experience/${e.slug}/">${h(e.title)}</a></h3><p>${h(e.claims[0]?.text || "")}</p></article>`).join("")}</section><section><h2>Education</h2>${renderClaims(data.education)}</section>`,
  {
    "@context": "https://schema.org",
    "@type": "Person",
    name: data.profile.name.text,
    url,
    sameAs: [data.profile.github.text],
  },
);
await write("index.html", home);
for (const p of data.projects) {
  const body = `<p class="eyebrow">Project case study / ${h(p.category)}</p><h1>${h(p.title)}</h1>${tags(p)}${sections.map((k) => `<section><h2>${h({ overview: "Overview", motivation: "Problem & motivation", contributions: "Individual contributions", architecture: "System architecture", decisions: "Engineering decisions", challenges: "Technical challenges", results: "Results", limitations: "Limitations", lessons: "Lessons learned" }[k])}</h2>${p.sections[k].length ? renderClaims(p.sections[k]) : '<p class="muted">Details await owner review. No claim is made for this section.</p>'}</section>`).join("")}<section><h2>Sources & verification</h2><p>Verified means source code was inspected. Owner-confirmed means supplied in the owner’s resume. Neither implies independently measured performance.</p><ul>${[
    ...new Set(
      Object.values(p.sections)
        .flat()
        .flatMap((c) => c.sources),
    ),
  ]
    .map((s) => `<li><a href="${h(data.sources[s].url)}">${h(s)}</a></li>`)
    .join(
      "",
    )}</ul>${p.repository ? `<a href="${h(p.repository)}">Source repository →</a>` : ""}</section><a class="back-link" href="/#projects">← All projects</a>`;
  await write(
    `projects/${p.slug}/index.html`,
    layout(
      p.title,
      p.sections.overview[0]?.text || p.title,
      `/projects/${p.slug}/`,
      body,
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: p.title,
        url: `${url}/projects/${p.slug}/`,
      },
    ),
  );
  await json(
    `api/career/projects/${p.slug}.json`,
    query(data, `/api/career/projects/${p.slug}`),
  );
}
for (const e of data.experience)
  await write(
    `experience/${e.slug}/index.html`,
    layout(
      e.title,
      e.claims[0]?.text || e.title,
      `/experience/${e.slug}/`,
      `<h1>${h(e.title)}</h1>${tags(e)}${renderClaims(e.claims)}<a href="/#experience">← Experience</a>`,
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: e.title,
      },
    ),
  );
await json("api/career/public.json", data);
for (const name of ["profile", "projects", "resume-evidence"])
  await json(`api/career/${name}.json`, query(data, `/api/career/${name}`));
const agentBody = `<h1>Career data for AI agents</h1><p>Read-only, approved career information with verification metadata and source references.</p><ul><li><a href="/api/career/profile.json">Profile JSON</a></li><li><a href="/api/career/projects.json">Projects JSON</a></li><li><a href="/api/career/resume-evidence.json">Resume evidence JSON</a></li><li><a href="/api/career/public.json">Complete public knowledge base</a></li><li><a href="/llms.txt">llms.txt</a></li></ul><p>Per-project snapshots: /api/career/projects/{slug}.json. These snapshots work on GitHub Pages. The optional server provides extensionless endpoints and query filtering by skills, category, and relevance.</p><p>On browsers supporting WebMCP, this page registers get_profile, list_projects, get_project and get_resume_evidence. All use the same public data and validation. Unsupported browsers can read the JSON links above.</p><p>needs_review is historical self-reported material, excluded from resume evidence. verified and user_confirmed are distinct; use each source to assess the claim. Missing case-study sections are unknown.</p>`;
await write(
  "agents/index.html",
  layout(
    "Agent access",
    "Structured career data and read-only tools.",
    "/agents/",
    agentBody,
    {},
  ),
);
await write(
  "resume/index.html",
  layout(
    "Resume",
    "Explore relevant approved career evidence.",
    "/resume/",
    `<h1>Resume & career evidence</h1><p><a class="button" href="/Ojas__Resume%20(20).pdf">Download existing resume (PDF)</a></p><p>The existing PDF is a historical document. Tailored resumes use approved verified or owner-confirmed evidence only, and must pass a one-page build check.</p><form id="evidence-form"><label for="job">Job description or requirements</label><textarea id="job" name="relevance" maxlength="2000" rows="7" required></textarea><button type="submit">Find matching evidence</button></form><p id="evidence-status" role="status"></p><ol id="evidence-results"></ol><p>PDF generation is restricted to the authenticated owner’s GitHub workflow. This form ranks evidence locally and sends no job description to a server.</p><script type="module" src="/resume.js"></script>`,
    {},
  ),
);
await copyFile("public/resume.js", "dist/resume.js");
await write(
  "llms.txt",
  `# Ojas Polakhare\n\n${data.profile.summary.text}\n\n## Public data\n- [Profile](${url}/api/career/profile.json)\n- [Projects](${url}/api/career/projects.json)\n- [Resume evidence](${url}/api/career/resume-evidence.json)\n- [Complete public dataset](${url}/api/career/public.json)\n- [Tool and API documentation](${url}/agents/)\n\nOnly approved published records are included. Historical needs_review claims are excluded from resume evidence. Never infer personal contributions from repository functionality. WebMCP uses document.modelContext when supported.\n`,
);
const paths = [
  "/",
  "/agents/",
  "/resume/",
  ...data.projects.map((p) => `/projects/${p.slug}/`),
  ...data.experience.map((e) => `/experience/${e.slug}/`),
];
await write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((p) => `<url><loc>${url}${p}</loc></url>`).join("")}</urlset>`,
);
await write(
  "robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${url}/sitemap.xml\n`,
);
await write(".nojekyll", "");
console.log(
  `Built ${data.projects.length} approved projects; public output in dist/`,
);
