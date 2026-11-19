(() => {
  'use strict';

  const FORMAT = 'SkillX Task Package';
  const FORMAT_VERSION = '1.2';
  const DB_NAME = 'skillx-task-builder';
  const STORE_NAME = 'drafts';
  const DRAFT_KEY = 'current';
  const RECOMMENDED_FILE_SIZE = 10 * 1024 * 1024;
  const HARD_FILE_SIZE = 15 * 1024 * 1024;
  const RECOMMENDED_PACKAGE_SIZE = 25 * 1024 * 1024;
  const BLOCKED_EXT = new Set(['exe','bat','cmd','com','msi','js','vbs','ps1','sh','jar','zip','rar','7z','tar','gz']);

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const ext = (name='') => name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const bytes = n => n < 1024 ? `${n} B` : n < 1024**2 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024**2).toFixed(1)} MB`;
  const slugify = (s='skillx-task') => (s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'skillx-task');
  const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

  function emptyProject() {
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      id: uid(),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      task: {
        title: '',
        description: '',
        knowledge: '',
        solutionGuidance: '',
        generalHelp: ''
      },
      subtasks: [],
      attachments: []
    };
  }

  let project = emptyProject();
  let db = null;
  let saveTimer = null;
  let attachmentTarget = { ownerType: 'task', ownerId: null };
  let focusedTextarea = null;
  let confirmResolver = null;

  async function openDb() {
    if (!('indexedDB' in window)) return null;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDraft() {
    project.modifiedAt = new Date().toISOString();
    $('#saveStatus').textContent = 'Saving…';
    try {
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(project, DRAFT_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      }
      $('#saveStatus').textContent = 'Saved locally';
    } catch (e) {
      console.error(e);
      $('#saveStatus').textContent = 'Local save failed';
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    $('#saveStatus').textContent = 'Unsaved changes';
    saveTimer = setTimeout(saveDraft, 450);
  }

  async function loadDraft() {
    if (!db) return null;
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }

  function migrateProject(data) {
    const base = emptyProject();
    const task = data?.task || {};
    const subtasks = Array.isArray(data?.subtasks) ? data.subtasks : [];
    return {
      ...base,
      ...data,
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      task: {
        ...base.task,
        title: task.title || '',
        description: task.description || '',
        knowledge: task.knowledge || '',
        solutionGuidance: task.solutionGuidance || task.solution || '',
        generalHelp: task.generalHelp || task.help || ''
      },
      subtasks: subtasks.map(s => ({
        id: s.id || uid(),
        title: s.title || '',
        description: s.description || '',
        solution: s.solution || s.solutionGuidance || '',
        help: s.help || s.generalHelp || ''
      })),
      attachments: Array.isArray(data?.attachments) ? data.attachments : []
    };
  }

  function syncFormFromState() {
    $('#taskTitle').value = project.task.title || '';
    $('#taskDescription').value = project.task.description || '';
    $('#knowledgeText').value = project.task.knowledge || '';
    $('#solutionGuidance').value = project.task.solutionGuidance || '';
    $('#generalHelp').value = project.task.generalHelp || '';
    renderAll();
  }

  function syncStateFromForm() {
    project.task.title = $('#taskTitle').value;
    project.task.description = $('#taskDescription').value;
    project.task.knowledge = $('#knowledgeText').value;
    project.task.solutionGuidance = $('#solutionGuidance').value;
    project.task.generalHelp = $('#generalHelp').value;
    project.modifiedAt = new Date().toISOString();
    document.title = `${project.task.title.trim() || 'SkillX Task Builder'} · SkillX`;
    scheduleSave();
  }

  function addSubtask() {
    const item = { id: uid(), title: '', description: '', solution: '', help: '' };
    project.subtasks.push(item);
    renderSubtasks();
    renderSubtaskNav();
    scheduleSave();
    requestAnimationFrame(() => {
      const card = $(`[data-subtask-card="${item.id}"]`);
      card?.classList.add('open');
      card?.scrollIntoView({behavior:'smooth', block:'center'});
      card?.querySelector('[data-key="title"]')?.focus();
    });
  }

  async function removeSubtask(id) {
    const ok = await confirmBox('Remove subtask?', 'Its attachments will also be removed.');
    if (!ok) return;
    project.subtasks = project.subtasks.filter(s => s.id !== id);
    project.attachments = project.attachments.filter(a => !(a.ownerType === 'subtask' && a.ownerId === id));
    renderAll();
    scheduleSave();
  }

  function renderSubtasks() {
    const host = $('#subtasksContainer');
    if (!project.subtasks.length) {
      host.innerHTML = '<div class="empty-subtasks">No subtasks added.</div>';
      return;
    }

    host.innerHTML = project.subtasks.map((s, i) => {
      const files = project.attachments.filter(a => a.ownerType === 'subtask' && a.ownerId === s.id);
      return `
        <article class="subtask-card" data-subtask-card="${s.id}" draggable="true">
          <div class="subtask-header">
            <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
            <div class="subtask-summary" data-toggle-subtask="${s.id}">
              <div class="subtask-name">${esc(s.title || `Subtask ${i+1}`)}</div>
              <div class="subtask-small">${esc(s.description || '')}</div>
            </div>
            <button class="subtask-toggle" type="button" data-toggle-subtask="${s.id}" aria-label="Open subtask">⌄</button>
          </div>
          <div class="subtask-body">
            <label class="field">
              <span class="label">Title <span class="required">*</span></span>
              <input type="text" data-subtask="${s.id}" data-key="title" value="${esc(s.title)}" />
            </label>
            <label class="field">
              <span class="label">Description <span class="required">*</span></span>
              <textarea rows="6" data-subtask="${s.id}" data-key="description">${esc(s.description)}</textarea>
            </label>
            <div class="attachment-block">
              <div class="attachment-head">
                <span class="label">Attachments</span>
                <button class="link-btn" type="button" data-add-attachment="subtask" data-owner-id="${s.id}">＋ Add attachment</button>
              </div>
              <div class="attachment-list">${renderAttachmentItems(files)}</div>
            </div>
            <label class="field">
              <span class="label">Suggested solution / direction</span>
              <textarea rows="5" data-subtask="${s.id}" data-key="solution">${esc(s.solution)}</textarea>
            </label>
            <label class="field">
              <span class="label">Guidance if the learner is stuck</span>
              <textarea rows="4" data-subtask="${s.id}" data-key="help">${esc(s.help)}</textarea>
            </label>
            <button class="remove-subtask" type="button" data-remove-subtask="${s.id}">Remove subtask</button>
          </div>
        </article>`;
    }).join('');

    $$('[data-toggle-subtask]', host).forEach(el => {
      el.addEventListener('click', () => $(`[data-subtask-card="${el.dataset.toggleSubtask}"]`)?.classList.toggle('open'));
    });

    $$('[data-subtask]', host).forEach(el => {
      el.addEventListener('focus', () => { if (el.tagName === 'TEXTAREA') focusedTextarea = el; });
      el.addEventListener('input', () => {
        const s = project.subtasks.find(x => x.id === el.dataset.subtask);
        if (!s) return;
        s[el.dataset.key] = el.value;
        const card = $(`[data-subtask-card="${s.id}"]`);
        if (card) {
          $('.subtask-name', card).textContent = s.title || `Subtask ${project.subtasks.indexOf(s)+1}`;
          $('.subtask-small', card).textContent = s.description || '';
        }
        renderSubtaskNav();
        scheduleSave();
      });
    });

    $$('[data-remove-subtask]', host).forEach(btn => btn.addEventListener('click', () => removeSubtask(btn.dataset.removeSubtask)));
    bindAttachmentButtons(host);
    bindAttachmentActions(host);
    setupDrag();
  }

  function renderSubtaskNav() {
    const nav = $('#subtaskNav');
    nav.innerHTML = project.subtasks.map((s, i) => `<a href="#subtasks" class="nav-link" data-nav-subtask="${s.id}">${esc(s.title || `Subtask ${i+1}`)}</a>`).join('');
    $$('[data-nav-subtask]', nav).forEach(link => link.addEventListener('click', () => {
      const card = $(`[data-subtask-card="${link.dataset.navSubtask}"]`);
      requestAnimationFrame(() => {
        card?.classList.add('open');
        card?.scrollIntoView({behavior:'smooth', block:'center'});
      });
    }));
  }

  function setupDrag() {
    let dragId = null;
    $$('.subtask-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = card.dataset.subtaskCard;
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragover', e => e.preventDefault());
      card.addEventListener('drop', e => {
        e.preventDefault();
        const targetId = card.dataset.subtaskCard;
        if (!dragId || dragId === targetId) return;
        const from = project.subtasks.findIndex(s => s.id === dragId);
        const to = project.subtasks.findIndex(s => s.id === targetId);
        if (from < 0 || to < 0) return;
        const [moved] = project.subtasks.splice(from, 1);
        project.subtasks.splice(to, 0, moved);
        refreshAttachmentPaths();
        renderSubtasks();
        renderSubtaskNav();
        scheduleSave();
      });
    });
  }

  function renderAttachmentItems(files) {
    if (!files.length) return '<div class="empty-files">No attachments.</div>';
    return files.map(a => `
      <div class="attachment-item">
        <div class="file-icon">${esc(ext(a.name).slice(0,4) || 'file')}</div>
        <div>
          <div class="file-name">${esc(a.name)}</div>
          <div class="file-meta">${bytes(a.size || 0)}</div>
        </div>
        <div class="file-actions">
          <button type="button" data-insert-file="${a.id}">Insert</button>
          <button type="button" data-remove-file="${a.id}" aria-label="Remove">×</button>
        </div>
      </div>`).join('');
  }

  function renderAttachments() {
    const taskFiles = project.attachments.filter(a => a.ownerType === 'task');
    $('#taskAttachmentList').innerHTML = renderAttachmentItems(taskFiles);
    bindAttachmentActions($('#taskAttachmentList'));
    updatePackageSize();
  }

  function bindAttachmentButtons(root=document) {
    $$('[data-add-attachment]', root).forEach(btn => {
      btn.onclick = () => {
        attachmentTarget = { ownerType: btn.dataset.addAttachment, ownerId: btn.dataset.ownerId || null };
        $('#attachmentInput').value = '';
        $('#attachmentInput').click();
      };
    });
  }

  function bindAttachmentActions(root) {
    if (!root) return;
    $$('[data-remove-file]', root).forEach(btn => btn.onclick = () => removeAttachment(btn.dataset.removeFile));
    $$('[data-insert-file]', root).forEach(btn => btn.onclick = () => insertAttachmentReference(btn.dataset.insertFile));
  }

  function removeAttachment(id) {
    project.attachments = project.attachments.filter(a => a.id !== id);
    renderAttachments();
    renderSubtasks();
    scheduleSave();
  }

  function insertAttachmentReference(id) {
    const a = project.attachments.find(x => x.id === id);
    if (!a) return;
    let target = focusedTextarea;
    if (!target || !document.body.contains(target)) {
      target = a.ownerType === 'subtask'
        ? $(`[data-subtask="${a.ownerId}"][data-key="description"]`)
        : $('#taskDescription');
    }
    if (!target) return;
    const ref = `[Attachment: ${a.name}]`;
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const before = target.value.slice(0, start);
    const after = target.value.slice(end);
    const spacer = before && !/[\s\n]$/.test(before) ? ' ' : '';
    target.value = `${before}${spacer}${ref}${after}`;
    target.dispatchEvent(new Event('input', {bubbles:true}));
    target.focus();
    toast(`Inserted ${a.name}`);
  }

  async function optimizeImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 2 * 1024 * 1024) {
      return { blob:file, name:file.name };
    }
    try {
      const img = await createImageBitmap(file);
      const scale = Math.min(1, 2048 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
      if (!blob || blob.size >= file.size) return { blob:file, name:file.name };
      return { blob, name:file.name.replace(/\.[^.]+$/, '') + '.jpg' };
    } catch {
      return { blob:file, name:file.name };
    }
  }

  async function addFiles(fileList) {
    const target = {...attachmentTarget};
    for (const file of [...fileList]) {
      const e = ext(file.name);
      if (BLOCKED_EXT.has(e)) {
        toast(`${file.name}: this file type is not allowed.`);
        continue;
      }
      if (file.size > HARD_FILE_SIZE) {
        toast(`${file.name}: maximum file size is 15 MB.`);
        continue;
      }
      const optimized = await optimizeImage(file);
      const name = uniqueName(optimized.name, target);
      project.attachments.push({
        id: uid(),
        name,
        type: optimized.blob.type || file.type || 'application/octet-stream',
        size: optimized.blob.size,
        blob: optimized.blob,
        ownerType: target.ownerType,
        ownerId: target.ownerId,
        path: buildAttachmentPath(name, target)
      });
      if (file.size > RECOMMENDED_FILE_SIZE) toast(`${file.name} is larger than the recommended 10 MB.`);
    }
    renderAttachments();
    renderSubtasks();
    scheduleSave();
  }

  function uniqueName(name, target) {
    const sameOwner = project.attachments.filter(a => a.ownerType === target.ownerType && (a.ownerId || null) === (target.ownerId || null));
    if (!sameOwner.some(a => a.name === name)) return name;
    const e = ext(name);
    const stem = e ? name.slice(0, -(e.length + 1)) : name;
    let i = 2;
    let candidate = '';
    do { candidate = `${stem}-${i}${e ? '.'+e : ''}`; i++; } while (sameOwner.some(a => a.name === candidate));
    return candidate;
  }

  function buildAttachmentPath(name, target) {
    if (target.ownerType === 'subtask') {
      const index = project.subtasks.findIndex(s => s.id === target.ownerId);
      return `assets/subtask-${String(Math.max(0, index)+1).padStart(2,'0')}/${name}`;
    }
    return `assets/task/${name}`;
  }

  function refreshAttachmentPaths() {
    project.attachments.forEach(a => { a.path = buildAttachmentPath(a.name, {ownerType:a.ownerType, ownerId:a.ownerId}); });
  }

  function updatePackageSize() {
    const total = project.attachments.reduce((sum, a) => sum + (a.size || 0), 0) + 50000;
    $('#packageSizeText').textContent = `${(total/1024**2).toFixed(1)} MB`;
    const pct = Math.min(100, total / RECOMMENDED_PACKAGE_SIZE * 100);
    $('#packageMeter').style.width = `${pct}%`;
    $('#packageMeter').style.background = total > RECOMMENDED_PACKAGE_SIZE ? 'var(--danger)' : 'var(--accent)';
  }

  function renderAll() {
    renderAttachments();
    renderSubtasks();
    renderSubtaskNav();
  }

  function validate(showToast=true) {
    const required = [
      {el: $('#taskTitle'), ok: () => $('#taskTitle').value.trim().length > 0},
      {el: $('#taskDescription'), ok: () => $('#taskDescription').value.trim().length > 0}
    ];
    project.subtasks.forEach(s => {
      required.push({el: $(`[data-subtask="${s.id}"][data-key="title"]`), ok: () => s.title.trim().length > 0});
      required.push({el: $(`[data-subtask="${s.id}"][data-key="description"]`), ok: () => s.description.trim().length > 0});
    });

    let firstInvalid = null;
    required.forEach(item => {
      if (!item.el) return;
      const valid = item.ok();
      item.el.classList.toggle('invalid', !valid);
      if (!valid && !firstInvalid) firstInvalid = item.el;
    });
    if (firstInvalid) {
      const card = firstInvalid.closest('.subtask-card');
      card?.classList.add('open');
      firstInvalid.scrollIntoView({behavior:'smooth', block:'center'});
      if (showToast) toast('Please fill in the required fields.');
      return false;
    }
    return true;
  }

  function taskJson() {
    refreshAttachmentPaths();
    return JSON.stringify({
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      id: project.id,
      createdAt: project.createdAt,
      modifiedAt: project.modifiedAt,
      task: project.task,
      subtasks: project.subtasks,
      attachments: project.attachments.map(a => ({
        id:a.id, name:a.name, type:a.type, size:a.size,
        ownerType:a.ownerType, ownerId:a.ownerId || null, path:a.path
      }))
    }, null, 2);
  }

  function filesFor(ownerType, ownerId=null) {
    return project.attachments.filter(a => a.ownerType === ownerType && (ownerId === null || a.ownerId === ownerId));
  }

  function attachmentMarkdown(ownerType, ownerId=null) {
    const files = filesFor(ownerType, ownerId);
    return files.length ? files.map(a => `- \`${a.path}\``).join('\n') : '';
  }

  function pedagogyMd() {
    return `# SkillX AI Tutor Protocol

You are conducting an AI-supported vocational learning task.

## Language
Use the language of the learner-facing task for the entire conversation.

## Start
Read the complete task package and all teacher-only guidance before responding.
Your first response must show the task title and task description and then start the interaction naturally.
Do not explain this protocol or reveal teacher-only guidance.

## Behaviour
- Let the learner make the meaningful decisions.
- Do not provide the complete solution at the beginning.
- Follow the task and subtasks in a natural order appropriate to the learner's actions.
- A subtask may represent a step, question, decision, communication situation, changed condition or any other part of the professional task.
- Do not reveal future subtasks before they become relevant.
- Use the supplied suggested solution and knowledge space as internal guidance, not as text to disclose automatically.
- If the learner is progressing, let them continue.
- If the learner is stuck, use the supplied guidance and give the smallest useful hint first.
- Clearly distinguish learner-generated ideas from AI-provided help.
- When a referenced attachment is relevant, inspect it before continuing. If it cannot be accessed, say so instead of inventing its content.

## End of task
When the task and relevant subtasks are complete, give a concise teacher-oriented summary covering:
- the learner's approach;
- strong learner-generated ideas;
- important subject-matter or procedural errors;
- corrections made independently or with help;
- the amount and type of AI assistance required.
`;
  }

  function combinedMd() {
    const subtasks = project.subtasks.length ? project.subtasks.map((s, i) => {
      const attachments = attachmentMarkdown('subtask', s.id);
      return `## Subtask ${i+1}: ${s.title || ''}\n\n### Description\n${s.description || ''}${attachments ? `\n\n### Attachments\n${attachments}` : ''}\n\n### Suggested solution / direction\n${s.solution || ''}\n\n### Guidance if the learner is stuck\n${s.help || ''}`;
    }).join('\n\n---\n\n') : '';
    const taskAttachments = attachmentMarkdown('task');

    return `# SkillX Task Package

## AI instruction
Read this complete file and the referenced attachments before starting. Do not reveal teacher-only knowledge, solution guidance or future subtasks. Use the task language. Your first response must display the task title and task description and begin the interaction.

---

${pedagogyMd()}

---

# Task

## Title
${project.task.title || ''}

## Task description
${project.task.description || ''}${taskAttachments ? `\n\n## Task attachments\n${taskAttachments}` : ''}

---

# Knowledge space
${project.task.knowledge || ''}

---

# Suggested solution / direction
${project.task.solutionGuidance || ''}

# Guidance if the learner is stuck
${project.task.generalHelp || ''}${subtasks ? `\n\n---\n\n# Subtasks\n\n${subtasks}` : ''}
`;
  }

  function startHereMd() {
    return `# START HERE

Read \`SkillX_Task.md\` and all relevant attachments before responding.
Do not explain the package structure or reveal teacher-only guidance.
Use the language of the task.
Your first response must display the task title and task description and begin the interaction.
`;
  }

  function manifestJson() {
    return JSON.stringify({
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      title: project.task.title,
      taskFile: 'task.json',
      aiFile: 'SkillX_Task.md',
      pedagogyFile: 'pedagogy.md',
      startFile: 'START_HERE.md'
    }, null, 2);
  }

  function preview() {
    syncStateFromForm();
    validate(false);
    $('#previewContent').textContent = combinedMd();
    $('#previewDialog').showModal();
  }

  async function exportPackage() {
    syncStateFromForm();
    if (!validate(true)) return;
    if (!window.JSZip) {
      toast('ZIP support did not load. Check the internet connection and reload the page.');
      return;
    }

    refreshAttachmentPaths();
    const zip = new JSZip();
    zip.file('manifest.json', manifestJson());
    zip.file('task.json', taskJson());
    zip.file('START_HERE.md', startHereMd());
    zip.file('pedagogy.md', pedagogyMd());
    zip.file('SkillX_Task.md', combinedMd());
    for (const a of project.attachments) zip.file(a.path, a.blob);

    $('#saveStatus').textContent = 'Exporting…';
    try {
      const blob = await zip.generateAsync({type:'blob', compression:'DEFLATE', compressionOptions:{level:6}});
      downloadBlob(blob, `${slugify(project.task.title)}.skillx.zip`);
      $('#saveStatus').textContent = 'Saved locally';
      toast('Package exported.');
    } catch (e) {
      console.error(e);
      $('#saveStatus').textContent = 'Export failed';
      toast('Could not export the package.');
    }
  }

  async function importPackage(file) {
    if (!window.JSZip) {
      toast('ZIP support did not load.');
      return;
    }
    try {
      const zip = await JSZip.loadAsync(file);
      const taskFile = zip.file('task.json');
      if (!taskFile) throw new Error('task.json is missing.');
      const data = JSON.parse(await taskFile.async('string'));
      const loaded = migrateProject(data);
      loaded.attachments = [];
      for (const meta of (data.attachments || [])) {
        const zf = zip.file(meta.path);
        if (!zf) continue;
        const blob = await zf.async('blob');
        loaded.attachments.push({...meta, size:blob.size, blob});
      }
      project = loaded;
      syncFormFromState();
      await saveDraft();
      if ($('#startDialog').open) $('#startDialog').close();
      toast(`Opened: ${project.task.title || file.name}`);
    } catch (e) {
      console.error(e);
      toast(`Could not open package: ${e.message}`);
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function confirmBox(title, text) {
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmDialog').showModal();
    return new Promise(resolve => { confirmResolver = resolve; });
  }

  function resetProject() {
    project = emptyProject();
    syncFormFromState();
    saveDraft();
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function cycleTheme() {
    const themes = ['light','dark','contrast'];
    const current = document.documentElement.dataset.theme || 'light';
    const next = themes[(themes.indexOf(current)+1) % themes.length];
    document.documentElement.dataset.theme = next;
    storageSet('skillx-theme', next);
  }

  function setupNavObserver() {
    const sections = $$('.section');
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      $$('.sidebar-nav > .nav-link, .nav-group-head > .nav-link').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${visible.target.id}`));
    }, {rootMargin:'-100px 0px -65% 0px', threshold:[0,.1,.3]});
    sections.forEach(s => observer.observe(s));
  }

  function setupEvents() {
    ['taskTitle','taskDescription','knowledgeText','solutionGuidance','generalHelp'].forEach(id => {
      $('#'+id).addEventListener('input', () => {
        $('#'+id).classList.remove('invalid');
        syncStateFromForm();
      });
    });

    document.addEventListener('focusin', e => {
      if (e.target.tagName === 'TEXTAREA') focusedTextarea = e.target;
    });

    $('#addSubtaskBtn').onclick = addSubtask;
    $('#sideAddSubtask').onclick = addSubtask;

    bindAttachmentButtons();
    $('#attachmentInput').addEventListener('change', e => addFiles(e.target.files));

    $('#previewBtn').onclick = preview;
    $('#bottomPreviewBtn').onclick = preview;
    $('#exportBtn').onclick = exportPackage;
    $('#bottomExportBtn').onclick = exportPackage;
    $('#downloadMdBtn').onclick = () => downloadBlob(new Blob([combinedMd()], {type:'text/markdown;charset=utf-8'}), `${slugify(project.task.title)}-SkillX_Task.md`);

    $$('[data-close-dialog]').forEach(btn => btn.onclick = () => $('#'+btn.dataset.closeDialog).close());

    const openChooser = () => {
      $('#openPackageInput').value = '';
      $('#openPackageInput').click();
    };
    $('#openBtn').onclick = openChooser;
    $('#startOpenBtn').onclick = openChooser;
    $('#openPackageInput').addEventListener('change', e => {
      if (e.target.files[0]) importPackage(e.target.files[0]);
    });

    $('#newBtn').onclick = async () => {
      if (await confirmBox('Start a new task?', 'The current draft will be replaced.')) resetProject();
    };
    $('#startNewBtn').onclick = () => {
      resetProject();
      $('#startDialog').close();
    };
    $('#resumeBtn').onclick = async () => {
      const draft = await loadDraft();
      if (draft) {
        project = migrateProject(draft);
        syncFormFromState();
      }
      $('#startDialog').close();
    };

    $('#confirmCancel').onclick = () => {
      $('#confirmDialog').close();
      confirmResolver?.(false);
      confirmResolver = null;
    };
    $('#confirmOk').onclick = () => {
      $('#confirmDialog').close();
      confirmResolver?.(true);
      confirmResolver = null;
    };

    $('#themeBtn').onclick = cycleTheme;
    $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
    $$('.nav-link').forEach(link => link.addEventListener('click', () => $('#sidebar').classList.remove('open')));
  }

  async function init() {
    document.documentElement.dataset.theme = storageGet('skillx-theme') || 'light';
    try { db = await openDb(); } catch (e) { console.warn(e); }
    setupEvents();
    setupNavObserver();
    const draft = await loadDraft();
    if (draft) {
      project = migrateProject(draft);
      $('#resumeBtn').classList.remove('hidden');
    }
    syncFormFromState();
    $('#startDialog').showModal();
  }

  init();
})();
