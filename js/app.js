(() => {
  'use strict';

  const FORMAT = 'SkillX Task Package';
  const FORMAT_VERSION = '1.1';
  const DRAFT_DB = 'skillx-task-builder';
  const DRAFT_STORE = 'drafts';
  const DRAFT_KEY = 'current';
  const RECOMMENDED_FILE_SIZE = 10 * 1024 * 1024;
  const HARD_FILE_SIZE = 15 * 1024 * 1024;
  const RECOMMENDED_PACKAGE_SIZE = 25 * 1024 * 1024;
  const COMMON_EXT = new Set(['jpg','jpeg','png','webp','pdf','docx','doc','xlsx','xls','pptx','ppt','txt','md','csv','json','rtf','odt','ods','odp','svg','xml']);
  const BLOCKED_EXT = new Set(['exe','bat','cmd','com','msi','js','vbs','ps1','sh','jar','zip','rar','7z','tar','gz']);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const esc = (s='') => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const bytes = n => n < 1024 ? `${n} B` : n < 1024**2 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024**2).toFixed(1)} MB`;
  const slugify = (s='skillx-task') => (s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) || 'skillx-task');
  const delay = ms => new Promise(r => setTimeout(r, ms));

  let db = null;
  let saveTimer = null;
  let attachmentTarget = { ownerType: 'task', ownerId: null };
  let focusedTextarea = null;
  let confirmResolve = null;

  function emptyProject() {
    return {
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      id: uid(),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      task: {
        title: '', field: '', description: '', knowledge: '',
        solutionGuidance: '', keyDecisions: '', generalHelp: '', inclusiveSupport: ''
      },
      subtasks: [],
      attempt2: { enabled: false, description: '', same: '', change: '' },
      professionalAssessment: [
        'Workflow completeness and sequencing',
        'Procedural accuracy and compliance',
        'Decision quality and justification',
        'Quality of professional output / documentation',
        'Professional communication where relevant',
        'Adaptation to changed conditions',
        'Error recognition and recovery',
        'Safety and risk awareness where relevant'
      ],
      learningAssessment: [
        'Independent learner-generated ideas and decisions',
        'Amount and type of assistance required',
        'Self-correction and response to feedback',
        'Improvement from Attempt 1 to Attempt 2'
      ],
      reflection: [
        'What did you change in your second attempt?',
        'Which part of the task was the most difficult, and why?',
        'What would you do differently in a similar professional situation?'
      ],
      attachments: []
    };
  }

  async function openDb() {
    if (!('indexedDB' in window)) return null;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DRAFT_DB, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(DRAFT_STORE)) d.createObjectStore(DRAFT_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function serializableProject(includeBlobs = true) {
    return {
      ...project,
      attachments: project.attachments.map(a => includeBlobs ? a : ({
        id: a.id, name: a.name, type: a.type, size: a.size, ownerType: a.ownerType,
        ownerId: a.ownerId || null, path: a.path, optimized: !!a.optimized
      }))
    };
  }

  async function saveDraft() {
    project.modifiedAt = new Date().toISOString();
    $('#saveStatus').textContent = 'Saving…';
    try {
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DRAFT_STORE, 'readwrite');
          tx.objectStore(DRAFT_STORE).put(serializableProject(true), DRAFT_KEY);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } else {
        const light = serializableProject(false);
        localStorage.setItem('skillx-draft', JSON.stringify(light));
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
    saveTimer = setTimeout(saveDraft, 550);
  }

  async function loadDraft() {
    try {
      if (db) {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(DRAFT_STORE, 'readonly');
          const req = tx.objectStore(DRAFT_STORE).get(DRAFT_KEY);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      }
      const raw = localStorage.getItem('skillx-draft');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function clearDraft() {
    if (db) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DRAFT_STORE, 'readwrite');
        tx.objectStore(DRAFT_STORE).delete(DRAFT_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
    localStorage.removeItem('skillx-draft');
  }

  function syncFormFromState() {
    $('#taskTitle').value = project.task.title || '';
    $('#taskField').value = project.task.field || '';
    $('#taskDescription').value = project.task.description || '';
    $('#knowledgeText').value = project.task.knowledge || '';
    $('#solutionGuidance').value = project.task.solutionGuidance || '';
    $('#keyDecisions').value = project.task.keyDecisions || '';
    $('#generalHelp').value = project.task.generalHelp || '';
    $('#inclusiveSupport').value = project.task.inclusiveSupport || '';
    $('#attempt2Enabled').checked = !!project.attempt2.enabled;
    $('#attempt2Description').value = project.attempt2.description || '';
    $('#attempt2Same').value = project.attempt2.same || '';
    $('#attempt2Change').value = project.attempt2.change || '';
    $('#attempt2Fields').classList.toggle('disabled-panel', !project.attempt2.enabled);
    renderAll();
  }

  function syncStateFromForm() {
    project.task.title = $('#taskTitle').value.trim();
    project.task.field = $('#taskField').value.trim();
    project.task.description = $('#taskDescription').value.trim();
    project.task.knowledge = $('#knowledgeText').value.trim();
    project.task.solutionGuidance = $('#solutionGuidance').value.trim();
    project.task.keyDecisions = $('#keyDecisions').value.trim();
    project.task.generalHelp = $('#generalHelp').value.trim();
    project.task.inclusiveSupport = $('#inclusiveSupport').value.trim();
    project.attempt2.enabled = $('#attempt2Enabled').checked;
    project.attempt2.description = $('#attempt2Description').value.trim();
    project.attempt2.same = $('#attempt2Same').value.trim();
    project.attempt2.change = $('#attempt2Change').value.trim();
    project.modifiedAt = new Date().toISOString();
    updatePageTitle();
    updateSidebarStatus();
    scheduleSave();
  }

  function updatePageTitle() {
    $('#pageTitle').textContent = project.task.title || 'Untitled task';
    document.title = `${project.task.title || 'Untitled task'} · SkillX Task Builder`;
  }

  function addSubtask(open = true) {
    const s = {
      id: uid(), title: '', description: '', solution: '', help: '',
      trigger: '', acceptable: '', commonErrors: '', assessment: '',
      changedCondition: '', aiRole: ''
    };
    project.subtasks.push(s);
    renderSubtasks();
    renderSubtaskNav();
    updateSidebarStatus();
    scheduleSave();
    if (open) {
      requestAnimationFrame(() => {
        const card = $(`[data-subtask-card="${s.id}"]`);
        card?.classList.add('open');
        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card?.querySelector('input[data-key="title"]')?.focus();
      });
    }
  }

  function removeSubtask(id) {
    project.subtasks = project.subtasks.filter(s => s.id !== id);
    project.attachments = project.attachments.filter(a => !(a.ownerType === 'subtask' && a.ownerId === id));
    renderAll();
    scheduleSave();
  }

  function renderSubtasks() {
    const host = $('#subtasksContainer');
    if (!project.subtasks.length) {
      host.innerHTML = `<div class="notice" style="background:var(--surface-2);color:var(--muted);border:1px solid var(--border)">No subtasks yet. Add one if the task contains additional steps, decisions, interactions, documents or changing conditions.</div>`;
      return;
    }
    host.innerHTML = project.subtasks.map((s, i) => {
      const files = project.attachments.filter(a => a.ownerType === 'subtask' && a.ownerId === s.id);
      return `<article class="subtask-card" data-subtask-card="${s.id}" draggable="true">
        <div class="subtask-head" data-toggle-subtask="${s.id}">
          <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
          <span class="subtask-number">${String(i+1).padStart(2,'0')}</span>
          <div class="subtask-summary"><div class="subtask-title-display">${esc(s.title || 'Untitled subtask')}</div><div class="subtask-desc-display">${esc(s.description || 'No description yet')}</div></div>
          <span class="subtask-chevron">⌄</span>
        </div>
        <div class="subtask-body">
          <label class="field"><span class="field-label">Subtask title</span><input type="text" data-subtask="${s.id}" data-key="title" value="${esc(s.title)}" maxlength="160" placeholder="Short title" /></label>
          <label class="field"><span class="field-label">Subtask description</span><textarea rows="5" data-subtask="${s.id}" data-key="description" placeholder="What should happen or what should the learner do?">${esc(s.description)}</textarea></label>
          <div class="inline-assets"><div class="inline-assets-head"><span>Subtask attachments</span><button class="text-btn" type="button" data-add-attachment="subtask" data-owner-id="${s.id}">＋ Add attachment</button></div><div class="attachment-list compact">${renderAttachmentItems(files)}</div></div>
          <label class="field"><span class="field-label">Expected outcome / acceptable direction</span><textarea rows="4" data-subtask="${s.id}" data-key="solution" placeholder="Describe what would count as a good or acceptable response, decision, action or output.">${esc(s.solution)}</textarea></label>
          <label class="field"><span class="field-label">Support if the learner is stuck</span><textarea rows="3" data-subtask="${s.id}" data-key="help" placeholder="How should the AI support the learner without immediately revealing the answer?">${esc(s.help)}</textarea></label>
          <details class="advanced">
            <summary>Advanced options</summary>
            <label class="field"><span class="field-label">When should this subtask be introduced? <span class="optional">optional</span></span><textarea rows="2" data-subtask="${s.id}" data-key="trigger" placeholder="e.g. after Subtask 1; after the learner proposes a solution; when a certain question is asked...">${esc(s.trigger || '')}</textarea></label>
            <label class="field"><span class="field-label">Changed condition / unexpected situation <span class="optional">optional</span></span><textarea rows="3" data-subtask="${s.id}" data-key="changedCondition" placeholder="Use only if this subtask introduces a changed requirement, missing information, constraint or unexpected event.">${esc(s.changedCondition || '')}</textarea></label>
            <label class="field"><span class="field-label">AI role / behaviour <span class="optional">optional</span></span><textarea rows="2" data-subtask="${s.id}" data-key="aiRole" placeholder="e.g. act as a customer, colleague, system, supervisor, or simply provide the next task information.">${esc(s.aiRole || '')}</textarea></label>
            <label class="field"><span class="field-label">Other acceptable solutions <span class="optional">optional</span></span><textarea rows="3" data-subtask="${s.id}" data-key="acceptable" placeholder="List alternatives that should also be accepted...">${esc(s.acceptable || '')}</textarea></label>
            <label class="field"><span class="field-label">Typical errors <span class="optional">optional</span></span><textarea rows="3" data-subtask="${s.id}" data-key="commonErrors" placeholder="Important mistakes the AI should recognise...">${esc(s.commonErrors || '')}</textarea></label>
            <label class="field"><span class="field-label">Subtask-specific assessment <span class="optional">optional</span></span><textarea rows="2" data-subtask="${s.id}" data-key="assessment" placeholder="What should be observed or assessed here?">${esc(s.assessment || '')}</textarea></label>
          </details>
          <div class="subtask-toolbar"><button type="button" class="small-danger" data-remove-subtask="${s.id}">Remove subtask</button></div>
        </div>
      </article>`;
    }).join('');

    $$('[data-toggle-subtask]').forEach(el => el.addEventListener('click', () => {
      $(`[data-subtask-card="${el.dataset.toggleSubtask}"]`)?.classList.toggle('open');
    }));
    $$('[data-subtask]').forEach(el => el.addEventListener('input', () => {
      const item = project.subtasks.find(x => x.id === el.dataset.subtask);
      if (item) item[el.dataset.key] = el.value;
      const card = $(`[data-subtask-card="${el.dataset.subtask}"]`);
      if (card && item) {
        $('.subtask-title-display', card).textContent = item.title || 'Untitled subtask';
        $('.subtask-desc-display', card).textContent = item.description || 'No description yet';
      }
      renderSubtaskNav(); updateSidebarStatus(); scheduleSave();
    }));
    $$('[data-remove-subtask]').forEach(btn => btn.addEventListener('click', async () => {
      const ok = await confirmBox('Remove this subtask?', 'Its associated attachments will also be removed.');
      if (ok) removeSubtask(btn.dataset.removeSubtask);
    }));
    bindAttachmentButtons(host);
    bindAttachmentActions(host);
    setupSubtaskDrag();
  }

  function setupSubtaskDrag() {
    let dragId = null;
    $$('.subtask-card').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = card.dataset.subtaskCard; card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); });
      card.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      card.addEventListener('drop', e => {
        e.preventDefault();
        const targetId = card.dataset.subtaskCard;
        if (!dragId || dragId === targetId) return;
        const from = project.subtasks.findIndex(s => s.id === dragId);
        const to = project.subtasks.findIndex(s => s.id === targetId);
        const [moved] = project.subtasks.splice(from, 1);
        project.subtasks.splice(to, 0, moved);
        renderSubtasks(); renderSubtaskNav(); scheduleSave();
      });
    });
  }

  function renderSubtaskNav() {
    const nav = $('#subtaskNav');
    if (!project.subtasks.length) { nav.innerHTML = `<div class="small-note" style="padding:0 10px">No subtasks</div>`; return; }
    nav.innerHTML = project.subtasks.map((s,i) => `<a class="side-link" href="#subtasks" data-nav-subtask="${s.id}"><span class="status-dot ${s.description.trim() ? 'complete' : ''}"></span>${String(i+1).padStart(2,'0')} ${esc(s.title || 'Untitled')}</a>`).join('');
    $$('[data-nav-subtask]', nav).forEach(a => a.addEventListener('click', () => {
      const card = $(`[data-subtask-card="${a.dataset.navSubtask}"]`);
      requestAnimationFrame(() => { card?.classList.add('open'); card?.scrollIntoView({behavior:'smooth',block:'center'}); });
    }));
  }

  function renderCriteria() {
    renderEditableList('professionalCriteriaList', project.professionalAssessment, 'professional');
    renderEditableList('learningCriteriaList', project.learningAssessment, 'learning');
    renderEditableList('reflectionList', project.reflection, 'reflection');
  }

  function renderEditableList(hostId, list, kind) {
    const host = $('#'+hostId);
    host.innerHTML = list.map((c,i) => `<div class="criterion-row"><span class="step-no">${String(i+1).padStart(2,'0')}</span><input type="text" data-list-kind="${kind}" data-list-index="${i}" value="${esc(c)}" placeholder="${kind === 'reflection' ? 'Reflection question' : 'Assessment criterion'}" /><button type="button" data-remove-list-kind="${kind}" data-remove-list-index="${i}" aria-label="Remove">×</button></div>`).join('');
    $$('[data-list-kind]', host).forEach(inp => inp.addEventListener('input', () => {
      listForKind(inp.dataset.listKind)[+inp.dataset.listIndex] = inp.value;
      updateSidebarStatus(); scheduleSave();
    }));
    $$('[data-remove-list-kind]', host).forEach(btn => btn.addEventListener('click', () => {
      listForKind(btn.dataset.removeListKind).splice(+btn.dataset.removeListIndex, 1);
      renderCriteria(); updateSidebarStatus(); scheduleSave();
    }));
  }

  function listForKind(kind) {
    if (kind === 'professional') return project.professionalAssessment;
    if (kind === 'learning') return project.learningAssessment;
    return project.reflection;
  }

  function renderAttachmentItems(files) {
    if (!files.length) return `<div class="small-note">No attachments</div>`;
    return files.map(a => `<div class="attachment-item" data-attachment="${a.id}"><div class="file-icon">${esc(ext(a.name).slice(0,4) || 'file')}</div><div><div class="file-name" title="${esc(a.name)}">${esc(a.name)}</div><div class="file-meta">${bytes(a.size)}${a.optimized ? ' · optimized' : ''}</div></div><div class="file-actions"><button type="button" data-insert-file="${a.id}" title="Insert reference">Insert</button><button type="button" data-remove-file="${a.id}" title="Remove">×</button></div></div>`).join('');
  }

  function ownerLabel(a) {
    if (a.ownerType === 'subtask') {
      const i = project.subtasks.findIndex(s => s.id === a.ownerId);
      return i >= 0 ? `Subtask ${i+1}` : 'Subtask';
    }
    if (a.ownerType === 'knowledge') return 'Knowledge space';
    if (a.ownerType === 'attempt2') return 'Attempt 2';
    return 'Basic task';
  }

  function renderAttachments() {
    const groups = {
      task: project.attachments.filter(a => a.ownerType === 'task'),
      knowledge: project.attachments.filter(a => a.ownerType === 'knowledge'),
      attempt2: project.attachments.filter(a => a.ownerType === 'attempt2')
    };
    $('#taskAttachmentList').innerHTML = renderAttachmentItems(groups.task);
    $('#knowledgeAttachmentList').innerHTML = renderAttachmentItems(groups.knowledge);
    $('#attempt2AttachmentList').innerHTML = renderAttachmentItems(groups.attempt2);
    [$('#taskAttachmentList'),$('#knowledgeAttachmentList'),$('#attempt2AttachmentList')].forEach(bindAttachmentActions);

    const all = $('#allAttachmentsList');
    all.innerHTML = project.attachments.length ? project.attachments.map(a => `<div class="attachment-item"><div class="file-icon">${esc(ext(a.name).slice(0,4) || 'file')}</div><div><div class="file-name">${esc(a.name)}</div><div class="file-meta">${esc(ownerLabel(a))} · ${bytes(a.size)}${a.optimized ? ' · optimized' : ''}</div></div><div class="file-actions"><button type="button" data-insert-file="${a.id}">Insert</button><button type="button" data-remove-file="${a.id}">×</button></div></div>`).join('') : `<div class="small-note">No attachments added yet.</div>`;
    bindAttachmentActions(all);
    updatePackageSize();
  }

  function bindAttachmentButtons(root = document) {
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

  function ext(name='') { return name.includes('.') ? name.split('.').pop().toLowerCase() : ''; }

  function insertAttachmentReference(id) {
    const a = project.attachments.find(x => x.id === id);
    if (!a) return;
    const text = `[Attachment: ${a.name}]`;
    const ta = focusedTextarea && document.body.contains(focusedTextarea) ? focusedTextarea : $('#taskDescription');
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const pre = ta.value.slice(0,start), post = ta.value.slice(end);
    const prefix = pre && !pre.endsWith('\n') && !pre.endsWith(' ') ? ' ' : '';
    ta.value = `${pre}${prefix}${text}${post}`;
    ta.dispatchEvent(new Event('input', {bubbles:true}));
    ta.focus();
    toast(`Inserted reference to ${a.name}`);
  }

  function removeAttachment(id) {
    project.attachments = project.attachments.filter(a => a.id !== id);
    renderAttachments(); renderSubtasks(); updateSidebarStatus(); scheduleSave();
  }

  async function optimizeImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 1.8 * 1024 * 1024) return { blob: file, name: file.name, optimized: false };
    try {
      const img = await createImageBitmap(file);
      const max = 2048;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale === 1 && file.size < 3 * 1024 * 1024) return { blob: file, name: file.name, optimized: false };
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d'); ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const usePng = file.type === 'image/png' && file.size < 4 * 1024 * 1024;
      const mime = usePng ? 'image/png' : 'image/jpeg';
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, usePng ? undefined : .84));
      if (!blob || blob.size >= file.size) return { blob: file, name: file.name, optimized: false };
      const base = file.name.replace(/\.[^.]+$/,'');
      return { blob, name: `${base}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`, optimized: true };
    } catch { return { blob: file, name: file.name, optimized: false }; }
  }

  async function addFiles(fileList, target = attachmentTarget) {
    for (const file of [...fileList]) {
      const e = ext(file.name);
      if (BLOCKED_EXT.has(e)) {
        toast(`This file type is blocked in SkillX packages: ${file.name}`); continue;
      }
      if (e && !COMMON_EXT.has(e)) toast(`Added ${file.name}. Check that your target AI service can read this file type.`);
      if (file.size > HARD_FILE_SIZE) {
        toast(`${file.name} is larger than 15 MB and was not added.`); continue;
      }
      const optimized = await optimizeImage(file);
      const name = uniqueAttachmentName(optimized.name, target);
      const path = buildAttachmentPath(name, target);
      project.attachments.push({
        id: uid(), name, type: optimized.blob.type || file.type || 'application/octet-stream',
        size: optimized.blob.size, blob: optimized.blob, ownerType: target.ownerType,
        ownerId: target.ownerId || null, path, optimized: optimized.optimized
      });
      if (file.size > RECOMMENDED_FILE_SIZE) toast(`${file.name} is large; consider a smaller source file.`);
    }
    renderAttachments(); renderSubtasks(); updateSidebarStatus(); scheduleSave();
  }

  function uniqueAttachmentName(name, target) {
    const relevant = project.attachments.filter(a => a.ownerType === target.ownerType && (a.ownerId||null)===(target.ownerId||null));
    if (!relevant.some(a => a.name === name)) return name;
    const e = ext(name); const stem = e ? name.slice(0,-e.length-1) : name;
    let i=2, candidate;
    do { candidate = `${stem}-${i}${e ? '.'+e : ''}`; i++; } while (relevant.some(a=>a.name===candidate));
    return candidate;
  }

  function buildAttachmentPath(name, target) {
    if (target.ownerType === 'subtask') {
      const idx = project.subtasks.findIndex(s => s.id === target.ownerId);
      return `assets/subtask-${String(Math.max(idx,0)+1).padStart(2,'0')}/${name}`;
    }
    if (target.ownerType === 'knowledge') return `assets/knowledge/${name}`;
    if (target.ownerType === 'attempt2') return `assets/attempt-2/${name}`;
    return `assets/task/${name}`;
  }

  function refreshAttachmentPaths() {
    project.attachments.forEach(a => { a.path = buildAttachmentPath(a.name, {ownerType:a.ownerType,ownerId:a.ownerId}); });
  }

  function packageBytes() { return project.attachments.reduce((s,a)=>s+(a.size||0),0) + 80_000; }
  function updatePackageSize() {
    const total = packageBytes();
    $('#packageSizeText').textContent = `${(total/1024**2).toFixed(1)} MB / 25 MB`;
    const pct = Math.min(100, total/RECOMMENDED_PACKAGE_SIZE*100);
    $('#packageMeter').style.width = `${pct}%`;
    $('#packageMeter').style.background = total > RECOMMENDED_PACKAGE_SIZE ? 'var(--warning)' : 'var(--accent)';
    const warn = $('#sizeWarning');
    if (total > RECOMMENDED_PACKAGE_SIZE) {
      warn.classList.remove('hidden');
      warn.textContent = `Recommended package size exceeded (${(total/1024**2).toFixed(1)} MB). Export is still possible, but some AI services may reject large uploads.`;
    } else warn.classList.add('hidden');
  }

  function renderAll() {
    updatePageTitle(); renderSubtasks(); renderSubtaskNav(); renderCriteria(); renderAttachments(); updateSidebarStatus();
  }

  function updateSidebarStatus() {
    const states = {
      basic: project.task.title.trim() && project.task.description.trim() ? 'complete' : (project.task.title.trim() || project.task.description.trim() ? 'partial' : ''),
      knowledge: project.task.knowledge.trim() || project.attachments.some(a=>a.ownerType==='knowledge') ? 'complete' : '',
      workflow: project.task.solutionGuidance.trim() ? 'complete' : (project.task.keyDecisions.trim() || project.task.generalHelp.trim() ? 'partial' : ''),
      inclusive: project.task.inclusiveSupport.trim() ? 'complete' : '',
      attempt2: project.attempt2.enabled && (project.attempt2.description.trim() || project.attempt2.change.trim()) ? 'complete' : (project.attempt2.enabled ? 'partial' : ''),
      assessment: [...project.professionalAssessment, ...project.learningAssessment].some(x=>x.trim()) ? 'complete' : '',
      reflection: project.reflection.some(x=>x.trim()) ? 'complete' : '',
      assets: project.attachments.length ? 'complete' : ''
    };
    Object.entries(states).forEach(([k,v]) => {
      const el = $(`[data-status="${k}"]`); if (el) el.className = `status-dot ${v}`;
    });
  }

  function taskJson() {
    refreshAttachmentPaths();
    return JSON.stringify({
      format: project.format, formatVersion: project.formatVersion, id: project.id,
      createdAt: project.createdAt, modifiedAt: project.modifiedAt,
      task: project.task, subtasks: project.subtasks, attempt2: project.attempt2,
      professionalAssessment: project.professionalAssessment,
      learningAssessment: project.learningAssessment,
      reflection: project.reflection,
      attachments: project.attachments.map(a => ({id:a.id,name:a.name,type:a.type,size:a.size,ownerType:a.ownerType,ownerId:a.ownerId||null,path:a.path,optimized:!!a.optimized}))
    }, null, 2);
  }

  function attachmentLines(ownerType, ownerId=null) {
    const files = project.attachments.filter(a => a.ownerType === ownerType && (ownerId===null || a.ownerId === ownerId));
    if (!files.length) return 'None.';
    return files.map(a => `- \`${a.path}\` (${a.name})`).join('\n');
  }

  function pedagogyMd() {
    return `# SkillX Pedagogical Protocol

## Purpose
You are facilitating a SkillX vocational learning task based on the **Immersive Practice–Feedback–Mastery Cycle**. The learner must remain responsible for professional decisions and task execution. Your primary role during performance is to simulate the task environment, provide information or role-play when required, observe the learner's workflow, and provide graduated support only when needed.

## Language
- Determine the language of the learning conversation from the learner-facing task text.
- Conduct the task, support, feedback, reflection and final report in that language.
- If the task language is genuinely ambiguous, ask one short clarification question.

## Core learning cycle
**PRACTISE → ANALYSE & RECEIVE FEEDBACK → IMPROVE & REPEAT → DEMONSTRATE MASTERY**

Operationally:
**Attempt 1 → AI-supported performance analysis → teacher validation → Attempt 2 → adaptation/mastery comparison → reflection**

## Mandatory behaviour
1. Read the complete task package before starting.
2. Do not reveal teacher-only workflow guidance, expected outcomes, future subtasks, changed conditions, acceptable solutions, common errors or assessment notes in advance.
3. Display the task title and learner-facing task description, including relevant attachments, then begin the task immediately.
4. During Attempt 1, prioritise **simulation and observation over tutoring**. Let the learner make professional decisions and complete as much of the workflow independently as possible.
5. Ask for clarification or justification when needed to understand the learner's decision. Do not continuously coach a learner who is progressing independently.
6. If the learner is genuinely stuck, provide progressive support: clarification → directional hint → error-focused guidance → limited routine execution. Give the smallest useful amount of help.
7. Do not provide the complete solution merely because the learner asks for it.
8. A subtask may represent any professional step, question, decision, communication event, document activity, changed condition, constraint or other learning event. Introduce it according to its trigger or when pedagogically appropriate.
9. When a subtask defines an AI role or behaviour, adopt that role naturally without exposing teacher-only instructions.
10. When a subtask introduces a changed condition, present only the learner-facing consequence at the appropriate time.
11. When an attachment is referenced, inspect it before using it. If the current AI environment cannot access or interpret it, say so instead of inventing its content.
12. Apply any inclusive support defined in the package progressively, while preserving the same expected occupational competence.
13. Distinguish learner-generated ideas from AI-supported ideas. Track substantive errors, omissions, sequencing issues, self-corrections, hints, explicit guidance and routine AI execution.

## Attempt 1 — PRACTISE
Let the learner perform the authentic task and relevant subtasks. Observe workflow completeness, sequencing, decisions, outputs, communication, compliance and error recovery where relevant. Do not interrupt merely to improve an answer that is still professionally acceptable.

When the learner appears finished, ask whether this is their final Attempt 1 performance.

## ANALYSE & RECEIVE FEEDBACK
After Attempt 1, stop the learner-facing simulation and prepare **AI Feedback Draft — Attempt 1** for teacher validation. Include:
- summary of the learner's workflow and decisions;
- strong learner-generated actions or ideas;
- missing, inaccurate or incorrectly sequenced steps;
- decision, communication, documentation, compliance or safety issues where relevant;
- amount and type of assistance required;
- recommended targeted feedback;
- suggested focus for Attempt 2.

End with: **Teacher: please approve, edit, or replace this feedback before Attempt 2.**
Do not begin Attempt 2 until teacher validation is provided. Teacher-validated feedback is authoritative.

## Attempt 2 — IMPROVE & REPEAT
Use only the teacher-approved feedback. Repeat the original task unless modified conditions or a transfer version are defined. Give less support where possible and observe whether previously supported actions can now be performed independently.

## Adaptation and mastery
Where modified requirements, constraints or new conditions are defined, require the learner to adapt while maintaining professional standards. Compare observable performance rather than task completion alone.

## Reflection
After Attempt 2, ask the reflection questions in the package. Keep reflection concise and evidence-based.

## Final report
Provide a concise **SkillX Learning Report** using the package assessment criteria. Explicitly compare Attempt 1 and Attempt 2 and distinguish independent performance from AI-supported performance. Do not make personality, intelligence or diagnostic judgments.
`;
  }

  function knowledgeMd() {
    const body = project.task.knowledge.trim() || 'No separate knowledge space was supplied.';
    return `# Knowledge Space\n\n${body}\n\n## Knowledge attachments\n${attachmentLines('knowledge')}\n`;
  }

  function assessmentMd() {
    const professional = project.professionalAssessment.filter(x=>x.trim()).map((x,i)=>`${i+1}. ${x.trim()}`).join('\n') || 'No additional professional-performance criteria supplied.';
    const learning = project.learningAssessment.filter(x=>x.trim()).map((x,i)=>`${i+1}. ${x.trim()}`).join('\n') || 'No additional learning-process criteria supplied.';
    return `# Assessment Criteria

## Professional performance
${professional}

## Learning process
${learning}

The final report must use observable evidence, compare both attempts, and distinguish independent learner performance from AI-supported performance.
`;
  }

  function combinedMd() {
    const subtasks = project.subtasks.length ? project.subtasks.map((s,i) => `
### Subtask ${i+1}: ${s.title || 'Untitled'}

**Learner-facing description**
${s.description || 'No description supplied.'}

**Attachments**
${attachmentLines('subtask', s.id)}

**Teacher-only expected outcome / acceptable direction**
${s.solution || 'Not supplied.'}

**Support if learner is stuck**
${s.help || 'Use the general progressive-support protocol.'}

**Trigger / timing**
${s.trigger || 'Introduce when pedagogically appropriate after prior relevant work.'}

**Changed condition / unexpected situation**
${s.changedCondition || 'Not defined.'}

**AI role / behaviour**
${s.aiRole || 'No special role defined.'}

**Other acceptable solutions**
${s.acceptable || 'Not supplied.'}

**Typical errors**
${s.commonErrors || 'Not supplied.'}

**Subtask-specific assessment**
${s.assessment || 'Use the general assessment criteria.'}
`).join('\n') : '\nNo subtasks are defined.\n';

    const attempt2 = project.attempt2.enabled ? `
## Attempt 2 — Adaptation / Transfer

**Learner-facing instructions**
${project.attempt2.description || 'Repeat the original task with the changed conditions below.'}

**Changed conditions / unexpected constraints**
${project.attempt2.change || 'No separate changed condition supplied.'}

**Competence / workflow that should remain comparable**
${project.attempt2.same || 'The core occupational competence and professional standards.'}

**Attachments**
${attachmentLines('attempt2')}
` : `
## Attempt 2

No separate variation is defined. After teacher-validated feedback, repeat the original task while expecting greater independence and improved performance.
`;

    const professional = project.professionalAssessment.filter(x=>x.trim()).map((x,i)=>`${i+1}. ${x.trim()}`).join('\n') || 'Use the general SkillX professional-performance dimensions.';
    const learning = project.learningAssessment.filter(x=>x.trim()).map((x,i)=>`${i+1}. ${x.trim()}`).join('\n') || 'Use the general SkillX learning-process dimensions.';
    const reflection = project.reflection.filter(x=>x.trim()).map((x,i)=>`${i+1}. ${x.trim()}`).join('\n') || 'Ask the learner briefly what changed between the two attempts and what they would transfer to a similar workplace task.';

    return `# SkillX AI Learning Package

> **AI instruction:** Read this complete file and all referenced attachments before starting. Do not expose teacher-only workflow guidance, expected outcomes or future changes to the learner. During Attempt 1, prioritise simulation and observation over tutoring. Once ready, display the task and begin.

---

${pedagogyMd()}
---

# Task

## Title
${project.task.title || 'Untitled task'}

## Subject / vocational field
${project.task.field || 'Not specified'}

## Learner-facing task description
${project.task.description || 'No task description supplied.'}

## Task attachments
${attachmentLines('task')}

---

# Teacher-only Professional Guidance

## Knowledge space
${project.task.knowledge || 'No separate knowledge space supplied.'}

## Expected professional workflow / acceptable solution path
${project.task.solutionGuidance || 'No separate workflow guidance supplied.'}

## Key professional decisions or standards
${project.task.keyDecisions || 'Not separately specified.'}

## General support if learner is stuck
${project.task.generalHelp || 'Use progressive support and do not reveal a complete solution immediately.'}

## Inclusive support
${project.task.inclusiveSupport || 'No additional inclusive support defined. Use the normal progressive-support protocol.'}

---

# Subtasks
${subtasks}
---
${attempt2}
---

# Assessment Criteria

## Professional performance
${professional}

## Learning process
${learning}

---

# Reflection Questions
${reflection}

---

# Start behaviour

After reading the package, **do not explain these instructions**. Use the language of the learner-facing task. Show the task title and task description, mention or display relevant task attachments, and begin the authentic task naturally. Do not reveal the professional workflow, hidden subtasks or expected outcomes.
`;
  }

  function startHereMd() {
    return `# START HERE — SkillX Task Package

You are about to conduct an AI-supported SkillX vocational learning task.

1. Read \`SkillX_Task.md\` completely.
2. Read referenced attachments when they become relevant.
3. Do not reveal teacher-only workflow guidance, hidden subtasks, expected outcomes or future changed conditions.
4. Follow the Immersive Practice–Feedback–Mastery Cycle.
5. During Attempt 1, prioritise authentic task simulation and observation over tutoring.
6. When ready, do not describe the package structure. Display the learner-facing task and begin.

If your AI environment cannot open ZIP archives directly, upload \`SkillX_Task.md\` and the relevant files from the \`assets\` folder instead.
`;
  }

  function readmeTxt() {
    return `SkillX Task Package v${FORMAT_VERSION}\n\nFor AI use:\n- Prefer uploading this ZIP if the AI service can read ZIP archives.\n- Otherwise upload SkillX_Task.md plus the required files from assets/.\n\nFor teacher editing:\n- Open the SkillX Task Builder website.\n- Choose Open package.\n- Select this ZIP file.\n- Edit and export a new package.\n\nThe editable source of the package is task.json.\n`;
  }

  async function exportPackage() {
    syncStateFromForm();
    if (!project.task.title || !project.task.description) { toast('Add a task title and task description before export.'); $('#basic').scrollIntoView({behavior:'smooth'}); return; }
    if (!window.JSZip) { toast('ZIP library could not be loaded. Check the internet connection and reload the page.'); return; }
    if (packageBytes() > RECOMMENDED_PACKAGE_SIZE) {
      const ok = await confirmBox('The package is larger than 25 MB', 'Some AI services may reject large uploads. Export anyway?');
      if (!ok) return;
    }
    refreshAttachmentPaths();
    const zip = new JSZip();
    const manifest = {
      format: FORMAT, formatVersion: FORMAT_VERSION, title: project.task.title,
      taskFile: 'task.json', aiFile: 'SkillX_Task.md', pedagogyFile: 'pedagogy.md',
      knowledgeFile: 'knowledge.md', assessmentFile: 'assessment.md', startFile: 'START_HERE.md',
      createdAt: project.createdAt, modifiedAt: new Date().toISOString()
    };
    zip.file('manifest.json', JSON.stringify(manifest,null,2));
    zip.file('task.json', taskJson());
    zip.file('START_HERE.md', startHereMd());
    zip.file('pedagogy.md', pedagogyMd());
    zip.file('knowledge.md', knowledgeMd());
    zip.file('assessment.md', assessmentMd());
    zip.file('SkillX_Task.md', combinedMd());
    zip.file('README.txt', readmeTxt());
    for (const a of project.attachments) zip.file(a.path, a.blob);
    const blob = await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}, meta => {
      $('#saveStatus').textContent = `Exporting ${Math.round(meta.percent)}%`;
    });
    downloadBlob(blob, `${slugify(project.task.title)}.skillx.zip`);
    $('#saveStatus').textContent = 'Saved locally';
    toast('SkillX package exported.');
  }

  async function importPackage(file) {
    if (!window.JSZip) { toast('ZIP library could not be loaded.'); return; }
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('manifest.json');
      const taskFile = zip.file('task.json');
      if (!manifestFile || !taskFile) throw new Error('Not a SkillX package: manifest.json or task.json is missing.');
      const manifest = JSON.parse(await manifestFile.async('string'));
      if (manifest.format !== FORMAT) throw new Error('This ZIP is not a recognised SkillX Task Package.');
      const data = JSON.parse(await taskFile.async('string'));
      const defaults = emptyProject();
      const loaded = {
        ...defaults, ...data,
        formatVersion: FORMAT_VERSION,
        task: {...defaults.task, ...(data.task||{})},
        attempt2: {...defaults.attempt2, ...(data.attempt2||{})},
        subtasks: Array.isArray(data.subtasks) ? data.subtasks.map(s => ({changedCondition:'', aiRole:'', ...s})) : [],
        professionalAssessment: Array.isArray(data.professionalAssessment) ? data.professionalAssessment : defaults.professionalAssessment,
        learningAssessment: Array.isArray(data.learningAssessment) ? data.learningAssessment : (Array.isArray(data.assessment) ? data.assessment : defaults.learningAssessment),
        reflection: Array.isArray(data.reflection) ? data.reflection : defaults.reflection,
        attachments: []
      };
      for (const meta of (data.attachments || [])) {
        const zf = zip.file(meta.path);
        if (!zf) continue;
        const blob = await zf.async('blob');
        loaded.attachments.push({...meta, size:blob.size, blob});
      }
      project = loaded;
      syncFormFromState();
      await saveDraft();
      $('#startDialog').close();
      toast(`Opened: ${project.task.title || file.name}`);
      window.scrollTo({top:0,behavior:'smooth'});
    } catch (e) {
      console.error(e); toast(e.message || 'Could not open package.');
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function preview() {
    syncStateFromForm();
    $('#previewContent').textContent = combinedMd();
    $('#previewDialog').showModal();
  }

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._timer); t._timer = setTimeout(()=>t.classList.remove('show'),2600);
  }

  function confirmBox(title, text) {
    $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmDialog').showModal();
    return new Promise(resolve => { confirmResolve = resolve; });
  }

  function resetProject() {
    project = emptyProject(); syncFormFromState(); saveDraft(); window.scrollTo({top:0,behavior:'smooth'});
  }

  function cycleTheme() {
    const themes = ['light','dark','contrast'];
    const cur = document.documentElement.dataset.theme || 'light';
    const next = themes[(themes.indexOf(cur)+1)%themes.length];
    document.documentElement.dataset.theme = next;
    localStorage.setItem('skillx-theme', next);
    $('#themeBtn').title = `Theme: ${next}`;
  }

  function setupSectionObserver() {
    const obs = new IntersectionObserver(entries => {
      const visible = entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      $$('.side-link[data-section]').forEach(x=>x.classList.toggle('active', x.dataset.section===visible.target.id));
    }, {rootMargin:'-100px 0px -60% 0px',threshold:[0,.1,.3]});
    $$('section[data-watch]').forEach(s=>obs.observe(s));
  }

  function setupGlobalDropzone() {
    const dz = $('#globalDropzone');
    dz.addEventListener('click', () => { attachmentTarget={ownerType:'task',ownerId:null}; $('#attachmentInput').value=''; $('#attachmentInput').click(); });
    dz.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') dz.click(); });
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('dragover');}));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('dragover');}));
    dz.addEventListener('drop', e => addFiles(e.dataTransfer.files,{ownerType:'task',ownerId:null}));
  }

  function migrateDraft(data) {
    const defaults = emptyProject();
    return {
      ...defaults, ...data,
      formatVersion: FORMAT_VERSION,
      task: {...defaults.task, ...(data.task||{})},
      attempt2: {...defaults.attempt2, ...(data.attempt2||{})},
      subtasks: Array.isArray(data.subtasks) ? data.subtasks.map(s => ({changedCondition:'', aiRole:'', ...s})) : [],
      professionalAssessment: Array.isArray(data.professionalAssessment) ? data.professionalAssessment : defaults.professionalAssessment,
      learningAssessment: Array.isArray(data.learningAssessment) ? data.learningAssessment : (Array.isArray(data.assessment) ? data.assessment : defaults.learningAssessment),
      reflection: Array.isArray(data.reflection) ? data.reflection : defaults.reflection,
      attachments: Array.isArray(data.attachments) ? data.attachments : []
    };
  }

  function setupEvents() {
    ['taskTitle','taskField','taskDescription','knowledgeText','solutionGuidance','keyDecisions','generalHelp','inclusiveSupport','attempt2Description','attempt2Same','attempt2Change'].forEach(id => $('#'+id).addEventListener('input', syncStateFromForm));
    $('#attempt2Enabled').addEventListener('change', () => { $('#attempt2Fields').classList.toggle('disabled-panel', !$('#attempt2Enabled').checked); syncStateFromForm(); });
    $$('textarea').forEach(t => t.addEventListener('focus', () => focusedTextarea=t));
    document.addEventListener('focusin', e => { if (e.target.tagName === 'TEXTAREA') focusedTextarea=e.target; });

    $('#addSubtaskBtn').onclick = $('#addSubtaskBottomBtn').onclick = $('#sideAddSubtask').onclick = () => addSubtask();
    $('#addProfessionalCriterionBtn').onclick = () => { project.professionalAssessment.push(''); renderCriteria(); requestAnimationFrame(()=>$$('[data-list-kind="professional"]').at(-1)?.focus()); scheduleSave(); };
    $('#addLearningCriterionBtn').onclick = () => { project.learningAssessment.push(''); renderCriteria(); requestAnimationFrame(()=>$$('[data-list-kind="learning"]').at(-1)?.focus()); scheduleSave(); };
    $('#addReflectionBtn').onclick = () => { project.reflection.push(''); renderCriteria(); requestAnimationFrame(()=>$$('[data-list-kind="reflection"]').at(-1)?.focus()); scheduleSave(); };
    bindAttachmentButtons();
    $('#attachmentInput').addEventListener('change', e => addFiles(e.target.files));
    setupGlobalDropzone();

    $('#previewBtn').onclick = $('#footerPreviewBtn').onclick = preview;
    $('#exportBtn').onclick = $('#footerExportBtn').onclick = exportPackage;
    $('#downloadMdBtn').onclick = () => downloadBlob(new Blob([combinedMd()],{type:'text/markdown;charset=utf-8'}), `${slugify(project.task.title)}-SkillX_Task.md`);
    $$('[data-close-dialog]').forEach(btn => btn.onclick = () => $('#'+btn.dataset.closeDialog).close());

    const openChooser = () => { $('#openPackageInput').value=''; $('#openPackageInput').click(); };
    $('#openBtn').onclick = openChooser; $('#startOpenBtn').onclick = openChooser;
    $('#openPackageInput').addEventListener('change', e => { if (e.target.files[0]) importPackage(e.target.files[0]); });

    $('#newBtn').onclick = async () => { if (await confirmBox('Start a new task?', 'Your current draft will be replaced by a blank task.')) resetProject(); };
    $('#startNewBtn').onclick = async () => { resetProject(); $('#startDialog').close(); };
    $('#resumeBtn').onclick = async () => { const d=await loadDraft(); if(d){project=migrateDraft(d);syncFormFromState();} $('#startDialog').close(); };

    $('#confirmCancel').onclick = () => { $('#confirmDialog').close(); confirmResolve?.(false); confirmResolve=null; };
    $('#confirmOk').onclick = () => { $('#confirmDialog').close(); confirmResolve?.(true); confirmResolve=null; };

    $('#themeBtn').onclick = cycleTheme;
    $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
    $$('.side-link').forEach(a => a.addEventListener('click',()=>$('#sidebar').classList.remove('open')));
  }

  async function init() {
    document.documentElement.dataset.theme = localStorage.getItem('skillx-theme') || 'light';
    try { db = await openDb(); } catch(e) { console.warn('IndexedDB unavailable',e); }
    setupEvents(); setupSectionObserver();
    const draft = await loadDraft();
    if (draft) {
      $('#resumeBtn').classList.remove('hidden');
      project = migrateDraft(draft);
    } else $('#resumeBtn').classList.add('hidden');
    syncFormFromState();
    $('#startDialog').showModal();
  }

  init();
})();
