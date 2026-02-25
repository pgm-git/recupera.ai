/**
 * Ralph Parser - Extrai tarefas de stories/PRDs
 *
 * Funções:
 * - Extrai próxima tarefa [ ] não completada
 * - Conta progresso (completed vs total)
 * - Lê checkboxes do story/PRD
 * - Marca tarefas como [x] completadas
 *
 * Uso via CLI:
 *   node ralph-parser.js next <file>       → Próxima tarefa [ ]
 *   node ralph-parser.js progress <file>   → Contagem de progresso
 *   node ralph-parser.js mark <file> <n>   → Marca tarefa N como [x]
 *   node ralph-parser.js list <file>       → Lista todas as tarefas
 */

const fs = require('fs');
const path = require('path');

// Flexible checkbox pattern: accepts both [] and [ ], [x] and [ x ]
const CHECKBOX_PATTERN = /^(\s*)-\s*\[\s*([x]?)\s*\]\s*(.+)$/gm;

function parseTasks(content) {
  const tasks = [];
  let match;
  let index = 0;

  const regex = new RegExp(CHECKBOX_PATTERN.source, 'gm');
  while ((match = regex.exec(content)) !== null) {
    // match[2] can be: '', ' ', 'x', or ' x '
    const checkboxContent = match[2].trim();
    tasks.push({
      index: index++,
      indent: match[1].length,
      completed: checkboxContent === 'x',
      text: match[3].trim(),
      fullMatch: match[0],
      position: match.index,
    });
  }

  return tasks;
}

function getProgress(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const tasks = parseTasks(content);
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    total,
    percentage,
    remaining: total - completed,
  };
}

function getNextTask(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const tasks = parseTasks(content);
  const next = tasks.find((t) => !t.completed);

  if (!next) {
    return { done: true, message: 'All tasks completed' };
  }

  return {
    done: false,
    index: next.index,
    text: next.text,
    totalRemaining: tasks.filter((t) => !t.completed).length,
  };
}

function markTaskComplete(filePath, taskIndex) {
  let content = fs.readFileSync(filePath, 'utf8');
  const tasks = parseTasks(content);

  if (taskIndex < 0 || taskIndex >= tasks.length) {
    throw new Error(`Task index ${taskIndex} out of range (0-${tasks.length - 1})`);
  }

  const task = tasks[taskIndex];
  const newLine = task.fullMatch.replace('[ ]', '[x]');
  content =
    content.substring(0, task.position) +
    newLine +
    content.substring(task.position + task.fullMatch.length);

  fs.writeFileSync(filePath, content, 'utf8');
  return { marked: true, task: task.text };
}

function listTasks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return parseTasks(content);
}

// ============================================================================
// SECTION-AWARE PARSING (for stories with validation gates)
// ============================================================================

/**
 * Find the end position of the "## Tasks" section in the story.
 * Implementation tasks live in this section only.
 * Tasks in ## QA Results, ## UX Review etc. are NOT implementation tasks.
 */
function getTasksSectionRange(content) {
  // Match various task section headers
  const headerMatch = content.match(/^## Tasks[^\n]*/im);
  if (!headerMatch) {
    // No explicit tasks section - entire file is tasks
    return { start: 0, end: content.length };
  }

  const sectionStart = headerMatch.index;

  // Find end: next ## heading (not ###) after the tasks section
  const afterHeader = content.substring(sectionStart + headerMatch[0].length);
  const nextH2 = afterHeader.match(/\n## (?!#)/);
  const sectionEnd = nextH2
    ? sectionStart + headerMatch[0].length + nextH2.index
    : content.length;

  return { start: sectionStart, end: sectionEnd };
}

/**
 * Get only implementation tasks (from ## Tasks section).
 * Excludes tasks in QA Results, UX Review, etc.
 * Indices are preserved from the full parseTasks result so markTaskComplete works.
 */
function getImplementationTasks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const allTasks = parseTasks(content);
  const range = getTasksSectionRange(content);

  return allTasks.filter((t) => t.position >= range.start && t.position < range.end);
}

/**
 * Get next uncompleted implementation task.
 * Only looks in ## Tasks section, ignores UX checklists etc.
 */
function getNextImplementationTask(filePath) {
  const implTasks = getImplementationTasks(filePath);
  const next = implTasks.find((t) => !t.completed);

  if (!next) {
    return { done: true, message: 'All implementation tasks completed' };
  }

  return {
    done: false,
    index: next.index,
    text: next.text,
    totalRemaining: implTasks.filter((t) => !t.completed).length,
  };
}

/**
 * Get implementation progress (tasks in ## Tasks section only).
 */
function getImplementationProgress(filePath) {
  const implTasks = getImplementationTasks(filePath);
  const completed = implTasks.filter((t) => t.completed).length;
  const total = implTasks.length;

  return {
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    remaining: total - completed,
  };
}

// ============================================================================
// VALIDATION GATE STATUS PARSING
// ============================================================================

/**
 * Extract a ## section from story content.
 * Returns the content between the header and the next ## header.
 */
function extractSection(content, sectionHeader) {
  const startIdx = content.indexOf(sectionHeader);
  if (startIdx === -1) return null;

  const afterHeader = content.substring(startIdx + sectionHeader.length);

  // End at next ## heading (not ### subsection)
  const nextH2 = afterHeader.match(/\n## (?!#)/);
  const endIdx = nextH2
    ? startIdx + sectionHeader.length + nextH2.index
    : content.length;

  return content.substring(startIdx, endIdx).trim();
}

/**
 * Parse a **Status:** line from a section string.
 * Returns normalized uppercase status or null.
 */
function parseStatusFromSection(sectionContent) {
  if (!sectionContent) return null;

  // Section is unfilled (placeholder text)
  if (
    sectionContent.includes('_A ser preenchido') ||
    sectionContent.includes('_To be filled')
  ) {
    return 'PENDING';
  }

  const statusMatch = sectionContent.match(/\*\*Status:\*\*\s*(.+)/);
  if (!statusMatch) return 'PENDING';

  let raw = statusMatch[1].trim();

  // Strip everything except ASCII letters, numbers, spaces, underscores, hyphens
  // This removes ALL emojis, variation selectors, and invisible unicode chars
  raw = raw.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();

  // Handle Portuguese "Pendente"
  if (raw.toLowerCase() === 'pendente') return 'PENDING';

  // Extract known status keyword (agents may append extra text like "APPROVED - PHASE_DONE")
  const knownStatuses = ['APPROVED', 'REQUIRES_FIXES', 'REQUIRES_REFINEMENT', 'REJECTED', 'PENDING'];
  const upper = raw.toUpperCase();
  for (const status of knownStatuses) {
    if (upper.includes(status)) return status;
  }

  // Fallback: normalize full string
  return upper.replace(/\s+/g, '_');
}

/**
 * Parse validation gate status from story file.
 * Detects ## QA Results and ## UX Review sections and their statuses.
 *
 * Possible statuses:
 *   NOT_FOUND - section doesn't exist in story
 *   PENDING - section exists but is unfilled or has "Pendente"
 *   APPROVED - reviewer approved
 *   REQUIRES_FIXES - QA found issues, fix tasks added
 *   REQUIRES_REFINEMENT - UX found issues, refinement tasks added
 *   REJECTED - reviewer rejected
 */
function getValidationGateStatus(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  const result = {
    qa: { status: 'NOT_FOUND', hasSection: false },
    ux: { status: 'NOT_FOUND', hasSection: false },
  };

  // Parse QA Results section
  const qaSection = extractSection(content, '## QA Results');
  if (qaSection) {
    result.qa.hasSection = true;
    result.qa.status = parseStatusFromSection(qaSection) || 'PENDING';
  }

  // Parse UX Review section
  const uxSection = extractSection(content, '## UX Review');
  if (uxSection) {
    result.ux.hasSection = true;
    result.ux.status = parseStatusFromSection(uxSection) || 'PENDING';
  }

  return result;
}

// CLI
if (require.main === module) {
  const [, , command, filePath, arg] = process.argv;

  if (!command || !filePath) {
    console.log('Usage: node ralph-parser.js <command> <file> [arg]');
    console.log('Commands: next, impl-next, progress, impl-progress, gates, mark <n>, list');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  switch (command) {
    case 'next':
      console.log(JSON.stringify(getNextTask(resolvedPath)));
      break;
    case 'progress':
      console.log(JSON.stringify(getProgress(resolvedPath)));
      break;
    case 'mark':
      console.log(JSON.stringify(markTaskComplete(resolvedPath, parseInt(arg, 10))));
      break;
    case 'impl-next':
      console.log(JSON.stringify(getNextImplementationTask(resolvedPath)));
      break;
    case 'impl-progress':
      console.log(JSON.stringify(getImplementationProgress(resolvedPath)));
      break;
    case 'gates':
      console.log(JSON.stringify(getValidationGateStatus(resolvedPath), null, 2));
      break;
    case 'list':
      console.log(JSON.stringify(listTasks(resolvedPath), null, 2));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

module.exports = {
  parseTasks,
  getProgress,
  getNextTask,
  markTaskComplete,
  listTasks,
  getImplementationTasks,
  getNextImplementationTask,
  getImplementationProgress,
  getValidationGateStatus,
  extractSection,
};
