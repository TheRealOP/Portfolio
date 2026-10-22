const toggle = document.querySelector("#theme-toggle");
const applyTheme = (theme) => {
  document.body.classList.remove("light-theme", "dark-theme");
  if (["light", "dark"].includes(theme))
    document.body.classList.add(`${theme}-theme`);
  if (toggle)
    toggle.setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" || (!["light", "dark"].includes(theme) && matchMedia("(prefers-color-scheme: dark)").matches) ? "light" : "dark"} theme`,
    );
};
try {
  applyTheme(localStorage.getItem("theme"));
} catch {
  /* Storage can be disabled. */
}
toggle?.addEventListener("click", () => {
  const dark =
    document.body.classList.contains("dark-theme") ||
    (!document.body.classList.contains("light-theme") &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  const next = dark ? "light" : "dark";
  applyTheme(next);
  try {
    localStorage.setItem("theme", next);
  } catch {}
});
