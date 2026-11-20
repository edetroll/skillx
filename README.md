# SkillX Task Builder v1.7

Static GitHub Pages-compatible authoring tool for SkillX task packages.

## Main functions
- six task/interface languages: English, Turkish, Lithuanian, Romanian, Hungarian and Greek;
- task + optional-titled subtasks;
- attachments on the main task and each subtask;
- formatted teacher preview;
- light, dark-blue and separate high-contrast themes;
- local browser draft storage;
- editable `.skillx.zip` project import/export;
- separate **Prepare for AI** workflow that generates one complete `.md` instruction file and lets the teacher download attachments separately;
- generated pedagogical protocol with fixed session language, mandatory automatic session start, simulation-first behaviour and tutor-on-demand guidance.

## Two export formats

### Save project
Creates an editable `.skillx.zip` package for archiving, sharing with another teacher and reopening in SkillX Task Builder.

### Prepare for AI
Creates a single Markdown file containing the task and the full pedagogical protocol. If the task has attachments, the interface lists them separately so they can be uploaded together with the Markdown file to ChatGPT, Gemini or another AI service.

The `.skillx.zip` file is **not** intended to be uploaded directly to an AI chat service, because some AI interfaces only expose the ZIP file list and do not read the files inside the archive.

No server or API key is required.


## Interaction model

The generated AI file is designed for general chat systems such as ChatGPT, Gemini, Claude or Grok. When the task describes a realistic professional situation, the AI should preserve the simulation, reveal hidden scenario information only when it becomes relevant, and switch temporarily to tutoring only when the learner needs pedagogical support. For non-simulated tasks, the same minimum-assistance rules are used in tutor mode.
