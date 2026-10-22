import { readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { publicCareer, evidence, score } from "../lib/career.mjs";
export const texEscape = (s) =>
  String(s).replace(
    /[\\{}$&#%_~^]/g,
    (c) =>
      ({
        "\\": "\\textbackslash{}",
        "{": "\\{",
        "}": "\\}",
        $: "\\$",
        "&": "\\&",
        "#": "\\#",
        "%": "\\%",
        _: "\\_",
        "~": "\\textasciitilde{}",
        "^": "\\textasciicircum{}",
      })[c],
  );
export function renderResume(template, data, job, limit = 7) {
  if (typeof job !== "string" || job.length < 10 || job.length > 20000)
    throw Error("Job description must be 10–20000 characters");
  const ranked = evidence(data, {
    relevance: job.replace(/\s+/g, " ").slice(0, 2000),
  }).filter((c) => c.relevanceScore > 0);
  // Prefer personal contributions. Repository architecture describes the project, not authorship.
  const candidates = ranked.filter(
    (c) =>
      c.kind === "experience" ||
      c.section === "contributions" ||
      (c.section === "overview" && c.status === "user_confirmed"),
  );
  const selected = candidates.slice(0, limit);
  if (!selected.length) throw Error("No matching approved accomplishments");
  const esc = texEscape;
  const groups = new Map();
  for (const c of selected) {
    if (!groups.has(c.title)) groups.set(c.title, []);
    groups.get(c.title).push(c);
  }
  const part = (kind) =>
    [...groups]
      .filter(([, rows]) => rows[0].kind === kind)
      .map(
        ([title, rows]) =>
          `\\resumeProjectHeading{\\textbf{${esc(title)}}}{}\n\\resumeItemListStart\n${rows.map((c) => `\\resumeItem{${esc(c.text)}}`).join("\n")}\n\\resumeItemListEnd`,
      )
      .join("\n");
  const education = data.education.filter((c) =>
    ["verified", "user_confirmed"].includes(c.status),
  );
  const skills = [
    ...new Map(
      selected.flatMap((c) => c.skills).map((s) => [s.toLowerCase(), s]),
    ).values(),
  ]
    .sort((a, b) => score(b, job) - score(a, job))
    .slice(0, 12);
  const header = template
    .split("\\begin{document}")[0]
    .replace(
      "\\input{glyphtounicode}",
      "\\ifdefined\\pdfglyphtounicode\\input{glyphtounicode}\\fi",
    )
    .replace(
      "\\pdfgentounicode=1",
      "\\ifdefined\\pdfgentounicode\\pdfgentounicode=1\\fi",
    );
  if (!header.includes("\\resumeProjectHeading"))
    throw Error("Unexpected resume template");
  const body = `\\begin{document}\n\\begin{center}\\textbf{\\Huge \\scshape ${esc(data.profile.name.text)}}\\\\\\vspace{1pt}\\small\\href{https://github.com/TheRealOP}{\\faGithub \\ TheRealOP} $|$ \\href{https://ojaspolakhare.com}{ojaspolakhare.com}\\end{center}\n\\section{Education}\n${education.map((c) => esc(c.text)).join("\\\\\n")}\n\\section{Technical Skills}\n${esc(skills.join(", "))}\n${part("experience") ? "\\section{Experience}\n\\resumeSubHeadingListStart\n" + part("experience") + "\n\\resumeSubHeadingListEnd" : ""}\n${part("project") ? "\\section{Projects}\n\\resumeSubHeadingListStart\n" + part("project") + "\n\\resumeSubHeadingListEnd" : ""}\n\\end{document}\n`;
  return {
    tex: header + body,
    selected,
    requirements: [
      ...new Set(job.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []),
    ],
    method: "Deterministic keyword overlap; no generated factual claims.",
  };
}
const run = (cmd, args) => {
  const p = spawnSync(cmd, args, { encoding: "utf8", timeout: 120000 });
  if (p.error) throw p.error;
  if (p.status !== 0)
    throw Error(`${cmd} failed: ${(p.stderr || p.stdout).slice(-3000)}`);
  return p.stdout;
};
export function checkPDF(info, log) {
  if (!/^Pages:\s+1\s*$/m.test(info))
    throw Error("Resume must be exactly one page");
  if (
    /Overfull \\[hv]box/.test(log) ||
    /LaTeX Error|Emergency stop|Fatal error|Missing character:/.test(log)
  )
    throw Error("LaTeX errors or overflow detected");
}
export async function main() {
  const args = process.argv.slice(2);
  const jobPath = args.find((a) => !a.startsWith("--"));
  if (!jobPath)
    throw Error("Usage: npm run resume -- job-description.txt [--source-only]");
  const data = publicCareer(
    JSON.parse(await readFile("career/database.json", "utf8")),
  );
  const template = await readFile("resume/template.tex", "utf8");
  const job = await readFile(jobPath, "utf8");
  await mkdir("output/resume", { recursive: true });
  await rm("output/resume/resume.pdf", { force: true });
  await rm("output/resume/preview.png", { force: true });
  await rm("output/resume/.build", { recursive: true, force: true });
  await mkdir("output/resume/.build");
  for (let limit = 7; limit >= 1; limit--) {
    const result = renderResume(template, data, job, limit);
    await writeFile("output/resume/resume.tex", result.tex);
    await writeFile(
      "output/resume/evidence.json",
      JSON.stringify(
        { ...result, tex: undefined, sources: data.sources },
        null,
        2,
      ),
    );
    if (args.includes("--source-only")) {
      console.log("Prepared TeX and evidence manifest. PDF not compiled.");
      return;
    }
    if (args.includes("--tectonic"))
      run(process.env.TECTONIC_BIN || "tectonic", [
        "-X",
        "compile",
        "--untrusted",
        "--keep-logs",
        "--outdir",
        "output/resume/.build",
        "output/resume/resume.tex",
      ]);
    else
      run("pdflatex", [
        "-no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-output-directory=output/resume/.build",
        "output/resume/resume.tex",
      ]);
    const info = run(process.env.PDFINFO_BIN || "pdfinfo", [
      "output/resume/.build/resume.pdf",
    ]);
    const log = await readFile("output/resume/.build/resume.log", "utf8");
    try {
      checkPDF(info, log);
      run(process.env.PDFTOPPM_BIN || "pdftoppm", [
        "-png",
        "-scale-to",
        "1400",
        "-singlefile",
        "output/resume/.build/resume.pdf",
        "output/resume/preview",
      ]);
      await copyFile(
        "output/resume/.build/resume.pdf",
        "output/resume/resume.pdf",
      );
      await copyFile(
        "output/resume/.build/resume.log",
        "output/resume/resume.log",
      );
      console.log(
        "Validated exactly one page, no LaTeX errors or overflow. Review output/resume/preview.png.",
      );
      return;
    } catch (error) {
      await rm("output/resume/resume.pdf", { force: true });
      if (limit === 1) throw error;
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
