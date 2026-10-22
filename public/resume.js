import { evidence } from "/lib/career.mjs";
const form = document.querySelector("#evidence-form");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#evidence-status"),
    list = document.querySelector("#evidence-results");
  list.replaceChildren();
  status.textContent = "Loading evidence…";
  try {
    const response = await fetch("/api/career/public.json");
    if (!response.ok) throw Error();
    const data = await response.json();
    const rows = evidence(data, { relevance: form.elements.relevance.value })
      .filter((x) => x.relevanceScore > 0)
      .slice(0, 10);
    for (const row of rows) {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      strong.textContent = row.title;
      const p = document.createElement("p");
      p.textContent = row.text;
      li.append(strong, p);
      for (const id of row.sources) {
        const a = document.createElement("a");
        a.href = data.sources[id].url;
        a.textContent = `Source: ${id} `;
        li.append(a);
      }
      list.append(li);
    }
    status.textContent = rows.length
      ? `${rows.length} relevant evidence records. Ranked by keyword overlap; review against the full job requirements.`
      : "No matching approved evidence. Try broader requirements.";
  } catch {
    status.textContent = "Evidence is unavailable. Please try again.";
  }
});
