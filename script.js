const themeToggle = document.querySelector("#theme-toggle");

const applyTheme = (theme) => {
  document.body.classList.remove("light-theme", "dark-theme");
  if (theme === "light" || theme === "dark") {
    document.body.classList.add(`${theme}-theme`);
  }
};

const storedTheme = localStorage.getItem("theme");
if (storedTheme) {
  applyTheme(storedTheme);
}

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.contains("dark-theme");
    const nextTheme = isDark ? "light" : "dark";
    applyTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  });
}
