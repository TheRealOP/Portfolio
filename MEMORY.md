# MEMORY.md

This file serves as a working memory for the project, documenting key decisions, progress, and relevant information.

## Project Goal:
- Build a pretty cool-looking portfolio that is easy to add projects to and easy to navigate.

## Initial Setup:
- Created `AGENTS.md` and `MEMORY.md` as per user request.

## Next Steps:
- Portfolio structure now uses static HTML/CSS/JS with data-driven projects.
- Update projects in `projects.json` to add new work.
- Added hero link strip and media block placeholders for projects.
- Updated `projects.json` with user-provided project details.
- Created individual HTML pages for each project and updated `projects.json` with new demo links.
- Replaced placeholder text in `index.html` with "this is a placeholder" and "Ojas Polakhare" where specified.
- Converted project display from a grid to an interactive timeline with hover-activated project cards by updating `index.html`, `styles.css`, and `script.js`.
- Refined timeline implementation: now only displays dots, with project cards appearing dynamically on hover, and project year integrated into the card.
- Completely refactored project display to an interactive horizontal timeline (based on user's video example), updating `index.html`, `styles.css`, and `script.js` to feature a main display area and clickable timeline items.
- Fixed `script.js` error at line 115 by removing orphaned and redundant code related to previous timeline implementations.
