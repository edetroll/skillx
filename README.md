# SkillX Task Builder v1.2

A lightweight browser-based editor for creating portable SkillX task packages.

## Main fields
- Basic task: title, description, attachments
- Knowledge space
- Suggested solution / direction
- Guidance if the learner is stuck
- Any number of subtasks, each with its own attachments and guidance

## Package format
Export creates a `.skillx.zip` containing:
- `manifest.json`
- `task.json` — editable source data
- `START_HERE.md`
- `pedagogy.md`
- `SkillX_Task.md`
- `assets/` — task and subtask attachments

The same ZIP can later be opened in the Builder and edited again.

## Technical notes
The site is static and suitable for GitHub Pages. JSZip is bundled locally; no backend or API key is needed for editing, importing or exporting packages.

The official SkillX logo is loaded from the project website, with a text fallback if the remote image is unavailable.
