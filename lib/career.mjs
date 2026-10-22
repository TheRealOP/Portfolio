export const statuses = [
  "verified",
  "user_confirmed",
  "needs_review",
  "excluded",
];
export const lifecycles = [
  "discovered",
  "in_development",
  "ready_for_review",
  "published",
];
export const sections = [
  "overview",
  "motivation",
  "contributions",
  "architecture",
  "decisions",
  "challenges",
  "results",
  "limitations",
  "lessons",
];
export const safeSlug = (s) =>
  typeof s === "string" &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) &&
  s.length <= 100;
export const excluded = (slug, db) =>
  db.exclusions.some((x) =>
    slug
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .includes(x),
  );
export const visibleClaim = (c) =>
  c.approved === true && c.status !== "excluded";
export const resumeClaim = (c) =>
  visibleClaim(c) && ["verified", "user_confirmed"].includes(c.status);
export function validate(db) {
  const fail = (m) => {
    throw new Error(`Invalid career database: ${m}`);
  };
  if (
    db.schemaVersion !== 1 ||
    !Array.isArray(db.exclusions) ||
    !db.exclusions.includes("orbit") ||
    !db.exclusions.includes("orbits")
  )
    fail("schema/exclusions");
  const ids = new Set();
  const checkClaim = (c) => {
    if (
      !c ||
      typeof c.text !== "string" ||
      !c.text.trim() ||
      !statuses.includes(c.status) ||
      typeof c.approved !== "boolean" ||
      !safeSlug(c.id) ||
      ids.has(c.id)
    )
      fail("claim");
    ids.add(c.id);
    if (
      !Array.isArray(c.sources) ||
      !c.sources.length ||
      c.sources.some((s) => !db.sources[s])
    )
      fail(`sources for ${c.id}`);
  };
  for (const s of Object.values(db.sources))
    if (!s.url.startsWith("https://")) fail("source URL");
  Object.values(db.profile).forEach(checkClaim);
  db.education.forEach(checkClaim);
  db.skills.forEach(checkClaim);
  const slugs = new Set();
  for (const p of db.projects) {
    if (
      !safeSlug(p.slug) ||
      slugs.has(p.slug) ||
      !lifecycles.includes(p.lifecycle) ||
      typeof p.title !== "string" ||
      typeof p.category !== "string" ||
      typeof p.approved !== "boolean"
    )
      fail("project");
    slugs.add(p.slug);
    if (p.approved && !p.approvalSource) fail("approval provenance");
    if (
      [p.slug, p.title, p.repository || ""].some((value) =>
        excluded(value, db),
      ) &&
      p.approved
    )
      fail("excluded project approved");
    if (
      p.repository &&
      !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(p.repository)
    )
      fail("repository URL");
    if (
      Object.keys(p.sections).some((k) => !sections.includes(k)) ||
      sections.some((k) => !Array.isArray(p.sections[k]))
    )
      fail("sections");
    p.skills.forEach(checkClaim);
    Object.values(p.sections).flat().forEach(checkClaim);
  }
  for (const e of db.experience) {
    if (!safeSlug(e.slug) || typeof e.approved !== "boolean")
      fail("experience");
    e.claims.forEach(checkClaim);
    e.skills.forEach(checkClaim);
  }
  return db;
}
// Explicit public projection: internal notes, interviews and drafts never cross this boundary.
export function publicCareer(db) {
  validate(db);
  const sourceIds = new Set();
  const projectClaim = (c) => {
    c.sources.forEach((s) => sourceIds.add(s));
    return { id: c.id, text: c.text, status: c.status, sources: c.sources };
  };
  const claims = (list) => list.filter(visibleClaim).map(projectClaim);
  const projects = db.projects
    .filter(
      (p) =>
        p.approved &&
        p.lifecycle === "published" &&
        ![p.slug, p.title, p.repository || ""].some((value) =>
          excluded(value, db),
        ),
    )
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      lifecycle: p.lifecycle,
      repository: p.repository,
      skills: claims(p.skills),
      sections: Object.fromEntries(
        sections.map((k) => [k, claims(p.sections[k])]),
      ),
    }));
  const profile = Object.fromEntries(
    Object.entries(db.profile)
      .filter(([, c]) => visibleClaim(c))
      .map(([k, c]) => [k, projectClaim(c)]),
  );
  const education = claims(db.education);
  const experience = db.experience
    .filter((e) => e.approved)
    .map((e) => ({
      slug: e.slug,
      title: e.title,
      claims: claims(e.claims),
      skills: claims(e.skills),
    }));
  const skills = claims(db.skills);
  return {
    schemaVersion: 1,
    profile,
    education,
    experience,
    skills,
    projects,
    sources: Object.fromEntries(
      [...sourceIds].map((id) => [id, { url: db.sources[id].url }]),
    ),
  };
}
export function parseFilters(
  input = {},
  allowed = ["skills", "category", "relevance"],
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected an object");
  for (const [k, v] of Object.entries(input))
    if (
      !allowed.includes(k) ||
      typeof v !== "string" ||
      v.length > 2000 ||
      /[\x00-\x1f]/.test(v)
    )
      throw new Error(`Invalid parameter: ${k}`);
  return input;
}
const stopWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "this",
  "from",
  "you",
  "your",
  "are",
  "our",
  "will",
  "have",
  "has",
  "working",
  "work",
  "using",
]);
const words = (s) =>
  (s.toLowerCase().match(/[a-z0-9+#]+/g) || []).filter(
    (w) => !stopWords.has(w),
  );
export function score(text, job) {
  const corpus = new Set(words(text));
  return [...new Set(words(job))].filter((t) => t.length > 1 && corpus.has(t))
    .length;
}
export function listProjects(data, input = {}) {
  const { skills = "", category = "", relevance = "" } = parseFilters(input);
  const required = skills
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return data.projects
    .filter(
      (p) =>
        (!category || p.category.toLowerCase() === category.toLowerCase()) &&
        required.every((s) => p.skills.some((c) => c.text.toLowerCase() === s)),
    )
    .map((p) => ({ ...p, relevanceScore: score(JSON.stringify(p), relevance) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
export function evidence(data, input = {}) {
  parseFilters(input);
  const out = [];
  for (const p of listProjects(data, input))
    for (const key of [
      "contributions",
      "results",
      "overview",
      "architecture",
      "decisions",
    ])
      for (const c of p.sections[key]) {
        if (["verified", "user_confirmed"].includes(c.status))
          out.push({
            ...c,
            kind: "project",
            project: p.slug,
            title: p.title,
            section: key,
            skills: p.skills
              .filter((c) => ["verified", "user_confirmed"].includes(c.status))
              .map((c) => c.text),
          });
      }
  if (!input.category)
    for (const e of data.experience)
      for (const c of e.claims)
        if (
          ["verified", "user_confirmed"].includes(c.status) &&
          (!input.skills ||
            input.skills
              .toLowerCase()
              .split(",")
              .every((s) =>
                e.skills.some((x) => x.text.toLowerCase() === s.trim()),
              ))
        )
          out.push({
            ...c,
            kind: "experience",
            title: e.title,
            section: "contributions",
            skills: e.skills
              .filter((c) => ["verified", "user_confirmed"].includes(c.status))
              .map((s) => s.text),
          });
  return out
    .map((c) => ({
      ...c,
      relevanceScore:
        3 * score(c.text, input.relevance || "") +
        score(c.skills.join(" "), input.relevance || ""),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
export function query(data, path, input = {}) {
  if (path === "/api/career/profile") {
    parseFilters(input, []);
    const { projects, ...profile } = data;
    return profile;
  }
  if (path === "/api/career/projects")
    return { projects: listProjects(data, input), sources: data.sources };
  if (path === "/api/career/resume-evidence")
    return { evidence: evidence(data, input), sources: data.sources };
  const slug = path.slice("/api/career/projects/".length);
  if (!path.startsWith("/api/career/projects/") || !safeSlug(slug))
    throw Object.assign(new Error("Not found"), { status: 404 });
  parseFilters(input, []);
  const project = data.projects.find((p) => p.slug === slug);
  if (!project) throw Object.assign(new Error("Not found"), { status: 404 });
  return { project, sources: data.sources };
}
