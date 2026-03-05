const projectsList = document.querySelector("#projects-list");
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

fetch("projects.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} - Could not load projects.json.`);
    }
    return response.json();
  })
  .then((projects) => {
    if (!projectsList) {
      console.error("Projects list container not found.");
      return;
    }

    const list = document.createElement("ul");

    projects.forEach((project) => {
      const listItem = document.createElement("li");
      listItem.innerHTML = `
        <a href="${project.links.demo}">${project.title}</a>
      `;
      list.appendChild(listItem);
    });

    projectsList.appendChild(list);
  })
  .catch((error) => {
    console.error("Error loading or parsing projects:", error);
    if (projectsList) {
      projectsList.innerHTML = `<p>Unable to load projects right now: ${error.message}.</p>`;
    } else {
      console.error("Projects list container not found, cannot display error message on page.");
    }
  });
