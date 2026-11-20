# SkillX Task Builder v1.8

Static GitHub Pages-compatible authoring tool for SkillX task packages.

## Main functions
- six task/interface languages: English, Turkish, Lithuanian, Romanian, Hungarian and Greek;
- task + optional-titled subtasks;
- attachments on the main task and each subtask;
- formatted teacher preview;
- light, dark-blue and separate high-contrast themes;
- local browser draft storage;
- editable `.skillx.zip` project import/export;
- separate **Download AI task** workflow: one `.md` file when there are no attachments, or one transport ZIP containing `SkillX_Task.md`, `README.txt` and all attachments when attachments exist;
- generated pedagogical protocol with fixed session language, mandatory automatic session start, simulation-first behaviour, tutor-on-demand guidance, hidden teacher information protection, prompt-override resistance and an explicit task-focus guard that refuses unrelated learner requests and returns to the pending task state.

## Two export formats

### Download reusable project
Creates an editable `.skillx.zip` package for archiving, sharing with another teacher and reopening in SkillX Task Builder.

### Download AI task
If the task has no attachments, downloads a single `SkillX_Task.md` file containing the task and the full pedagogical protocol. If attachments exist, downloads one AI-task ZIP containing `SkillX_Task.md`, a short `README.txt`, and every attachment. The ZIP is only a transport package: extract it first, then upload the Markdown file and all extracted attachments together to ChatGPT, Gemini, Claude, Grok or another AI service.

The `.skillx.zip` file is **not** intended to be uploaded directly to an AI chat service, because some AI interfaces only expose the ZIP file list and do not read the files inside the archive.

No server or API key is required.


## Interaction model

The generated AI file is designed for general chat systems such as ChatGPT, Gemini, Claude or Grok. When the task describes a realistic professional situation, the AI should preserve the simulation, reveal hidden scenario information only when it becomes relevant, and switch temporarily to tutoring only when the learner needs pedagogical support. For non-simulated tasks, the same minimum-assistance rules are used in tutor mode.
