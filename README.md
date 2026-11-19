# SkillX Task Builder v1.1

Browser-based authoring tool for portable SkillX vocational learning packages.

## Design goal

The builder translates the SkillX **Immersive Practice–Feedback–Mastery Cycle** into a reusable teacher authoring workflow:

1. authentic task;
2. knowledge space;
3. professional workflow guidance;
4. generic subtasks and optional changed conditions;
5. inclusive support;
6. Attempt 2 / adaptation;
7. professional and learning-process assessment;
8. learner reflection;
9. attachments.

The generated AI protocol prioritises **simulation and observation over tutoring during Attempt 1**. Progressive support is used when needed, AI feedback is treated as a draft for teacher validation, and Attempt 2 is used to demonstrate improvement and adaptation.

## Technology

- Static HTML/CSS/JavaScript
- Suitable for GitHub Pages
- No server or database required
- Local draft storage via IndexedDB
- ZIP import/export via JSZip
- v1.0 packages are migrated when opened

## Package format

Exported `.skillx.zip` packages contain:

- `manifest.json`
- `task.json` — editable source
- `START_HERE.md`
- `pedagogy.md`
- `knowledge.md`
- `assessment.md`
- `SkillX_Task.md`
- `README.txt`
- `assets/` attachments

## Branding

The interface uses the official project logo URL from the SkillX project website and includes an SX fallback. The project-site-inspired visual palette is kept in one CSS token block at the top of `css/style.css` so exact brand colours can be adjusted without changing components.

Official project website: https://skillx-elearningpills.com/
