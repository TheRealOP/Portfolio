import { parseFilters, query, safeSlug } from "/lib/career.mjs";
export async function registerCareerTools(context, data) {
  if (!context?.registerTool) return false;
  const filters = {
    skills: {
      type: "string",
      maxLength: 2000,
      description: "Comma-separated skill names; all must match.",
    },
    category: { type: "string", maxLength: 2000 },
    relevance: {
      type: "string",
      maxLength: 2000,
      description:
        "Job description or keywords for deterministic relevance ranking.",
    },
  };
  const definitions = [
    [
      "get_profile",
      "Read Ojas Polakhare’s approved profile and experience.",
      "/api/career/profile",
      {},
    ],
    [
      "list_projects",
      "List approved published projects, with source references and verification status.",
      "/api/career/projects",
      filters,
    ],
    [
      "get_project",
      "Read an approved project case study by slug.",
      "/api/career/projects/",
      {
        slug: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          maxLength: 100,
        },
      },
    ],
    [
      "get_resume_evidence",
      "Retrieve approved verified or owner-confirmed evidence, ranked by job relevance.",
      "/api/career/resume-evidence",
      filters,
    ],
  ];
  for (const [name, description, path, properties] of definitions)
    await context.registerTool({
      name,
      description,
      inputSchema: {
        type: "object",
        properties,
        additionalProperties: false,
        ...(name === "get_project" ? { required: ["slug"] } : {}),
      },
      annotations: { readOnlyHint: true },
      execute: async (input = {}) => {
        parseFilters(input, Object.keys(properties));
        if (name === "get_project" && !safeSlug(input.slug))
          throw new Error("Invalid slug");
        return JSON.stringify(
          query(
            data,
            path + (name === "get_project" ? input.slug : ""),
            name === "get_project" ? {} : input,
          ),
        );
      },
    });
  return true;
}
if (typeof document !== "undefined" && document.modelContext?.registerTool) {
  fetch("/api/career/public.json")
    .then((r) => {
      if (!r.ok) throw new Error("Career data unavailable");
      return r.json();
    })
    .then((data) => registerCareerTools(document.modelContext, data))
    .catch(() => {
      /* Human pages and JSON discovery remain available. */
    });
}
