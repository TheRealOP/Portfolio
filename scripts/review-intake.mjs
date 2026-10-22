import { readFile, writeFile } from "node:fs/promises";
import { safeSlug, excluded, sections, validate } from "../lib/career.mjs";
// Owner runs this after filling answers in the draft; never called by discovery.
const slug = process.argv[2];
if (!safeSlug(slug))
  throw Error("Usage: node scripts/review-intake.mjs <slug>");
const db = JSON.parse(await readFile("career/database.json", "utf8"));
if (excluded(slug, db)) throw Error("Excluded project");
const draft = JSON.parse(
  await readFile(`career/intake/drafts/${slug}.json`, "utf8"),
);
const required = [
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
for (const key of required)
  if (typeof draft.answers[key] !== "string" || !draft.answers[key].trim())
    throw Error(`Owner answer required: ${key}`);
if (
  !Array.isArray(draft.answerSources) ||
  !draft.answerSources.length ||
  draft.answerSources.some((s) => !/^https:\/\//.test(s))
)
  throw Error("Add answerSources: HTTPS evidence links");
const sourceId = `${slug}-owner-interview`;
db.sources[sourceId] = {
  url: draft.answerSources[0],
  note: "Owner interview answers, submitted for review; public approval is separate.",
  supportingUrls: draft.answerSources,
};
const claim = (field, text) => ({
  id: `${slug}-${field}`,
  text,
  status: "user_confirmed",
  approved: false,
  sources: [sourceId],
});
const project = {
  slug,
  title: draft.title || slug,
  category: draft.category || "software",
  lifecycle: "ready_for_review",
  approved: false,
  approvalSource: null,
  repository: `https://github.com/${draft.repository}`,
  skills: (draft.confirmedSkills || []).map((s, i) => claim(`skill-${i}`, s)),
  sections: Object.fromEntries(
    sections.map((k) => [k, [claim(k, draft.answers[k])]]),
  ),
  questions: draft.questions,
};
const index = db.projects.findIndex((p) => p.slug === slug);
if (index < 0) db.projects.push(project);
else db.projects[index] = project;
validate(db);
await writeFile("career/database.json", JSON.stringify(db, null, 2) + "\n");
console.log(
  "Prepared case study and overview card. To publish, explicitly approve the record and its claims, set lifecycle=published, record approvalSource, and review the PR.",
);
