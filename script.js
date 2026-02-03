const projectDisplayArea = document.querySelector("#project-display-area");
const horizontalTimelineContainer = document.querySelector("#horizontal-timeline-container");

// Helper function to render project details into the display area
const displayProjectDetails = (project) => {
  if (!projectDisplayArea) {
    console.error("Project display area not found.");
    return;
  }

  const tagsMarkup = project.tags
    .map((tag) => `<span>${tag}</span>`)
    .join("");

  projectDisplayArea.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.description}</p>
    <div class="project-meta">
      <div class="project-tags">${tagsMarkup}</div>
      <div class="project-links">
        <a href="${project.links.demo}" target="_blank" rel="noreferrer">Live</a>
        <a href="${project.links.repo}" target="_blank" rel="noreferrer">Code</a>
      </div>
    </div>
  `;
  projectDisplayArea.style.setProperty('--accent', project.accent);
};

const renderHorizontalTimeline = (projects) => {
  if (!horizontalTimelineContainer) {
    console.error("Horizontal timeline container not found.");
    return;
  }

  horizontalTimelineContainer.innerHTML = ''; // Clear previous content

  projects.forEach((project, index) => {
    const timelineItem = document.createElement("div");
    timelineItem.classList.add("horizontal-timeline-item");
    timelineItem.dataset.projectId = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-*|-*$/g, '');

    timelineItem.innerHTML = `
      <div class="timeline-dot-small"></div>
      <span>${project.title}</span>
    `;

    // Add click event listener to update the display area
    timelineItem.addEventListener("click", () => {
      // Remove active class from all items
      document.querySelectorAll(".horizontal-timeline-item").forEach(item => item.classList.remove("active"));
      // Add active class to the clicked item
      timelineItem.classList.add("active");
      displayProjectDetails(project);
    });

    horizontalTimelineContainer.appendChild(timelineItem);
  });

  // Activate the first project by default
  if (projects.length > 0) {
    document.querySelector(".horizontal-timeline-item").classList.add("active");
    displayProjectDetails(projects[0]);
  }
};

// Initial fetch and render
fetch("projects.json")
  .then((response) => {
    console.log("Fetch response received:", response);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status} - Could not load projects.json.`);
    }
    return response.json();
  })
  .then((projects) => {
    console.log("Projects loaded successfully:", projects);
    renderHorizontalTimeline(projects);
  })
  .catch((error) => {
    console.error("Error loading or parsing projects:", error);
    if (projectDisplayArea) {
      projectDisplayArea.innerHTML = `<p>Unable to load projects right now: ${error.message}. Please check the console and network tab for details.</p>`;
    } else {
      console.error("Project display area not found, cannot display error message on page.");
    }
  });
