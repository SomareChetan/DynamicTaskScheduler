// ═══════════════════════════════════════════════════════════════
// AI ENGINES — NLP Parser, Decomposer, Optimizer, Learner
// ═══════════════════════════════════════════════════════════════
// These engines transform simple task input into an autonomously
// optimized schedule using LLM integration + local algorithms.

import { generateId } from './ai-pipeline';

// ── Constants ──
const SLOT_DURATION_MINUTES = 15;
const MAX_ATOMIC_TASK_MINUTES = 60;
const ENERGY_CURVE = {
  6: 0.3, 7: 0.5, 8: 0.75, 9: 0.95, 10: 1.0, 11: 0.95, 12: 0.7,
  13: 0.5, 14: 0.4, 15: 0.5, 16: 0.72, 17: 0.85, 18: 0.75,
  19: 0.6, 20: 0.4, 21: 0.3, 22: 0.2,
};

// ── Default optimization weights ──
const DEFAULT_WEIGHTS = {
  W_focus: 0.40,     // Chronotype alignment
  W_deadline: 0.35,  // Urgency pressure
  W_switch: 0.25,    // Context switching penalty
};

// ═══════════════════════════════════════════════════════════════
// ENGINE 1: NLP Intent Parser (Zero-Shot Extraction)
// ═══════════════════════════════════════════════════════════════
// Calls the LLM API to convert a natural language string into
// a structured JSON schema. Falls back to local parser on error.

export function buildParserPrompt(input) {
  const now = new Date();
  return `You are an expert NLP task parser. Extract structured task data from the user's natural language input. Today is ${now.toISOString()}.

RULES:
1. "title" — a clean, concise task name (strip filler words like "I need to")
2. "deadline" — ISO 8601 format date-time if a hard deadline is given. Resolve relative dates: "tomorrow" = ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}, "Friday" = next Friday's date.
3. "due_time" — The specific time the task should happen in "HH:MM" 24-hour format (e.g., "gym at 1pm" -> "13:00", "meeting at 4:30pm" -> "16:30"). Null if no specific time is mentioned.
4. "duration_minutes" — integer. "3 hours" = 180, "an hour" = 60, "quick" = 15
5. "priority" — float 0.0 to 1.0 (1.0 = critical/urgent, 0.0 = nice-to-have). "critical"/"urgent"/"ASAP" = 1.0, "important" = 0.8, default = 0.5, "whenever"/"low priority" = 0.2
6. "energy_requirement" — "High" for deep focus work (coding, studying, writing), "Low" for admin/email/errands
7. "category" — one of: work, academics, personal, fitness, creative, general
8. "tags" — array of relevant short keywords
9. "is_complex_objective" — true if this is a large multi-day goal (e.g. "Build an AI app", "Prepare for finals"), false for single tasks
10. "description" — a brief helpful description of the task

USER INPUT: "${input}"

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "title": "",
  "deadline": null,
  "due_time": null,
  "duration_minutes": 60,
  "priority": 0.5,
  "energy_requirement": "High",
  "category": "general",
  "tags": [],
  "is_complex_objective": false,
  "description": ""
}`;
}

// Local fallback parser when LLM is unavailable
export function localParse(input) {
  const lower = input.toLowerCase();
  const now = new Date();

  // Title extraction
  let title = input
    .replace(/i need to |i have to |i want to |i should |please |remind me to |can you |let me |gotta |gonna /gi, '')
    .replace(/before .+|by .+|tomorrow|today|tonight|this week|next week/gi, '')
    .replace(/,?\s*(?:about|around|roughly|approximately)?\s*\d+\.?\d*\s*(?:hours?|hrs?|minutes?|mins?)\b/gi, '')
    .replace(/,?\s*for\s+\d+\.?\d*\s*(?:hours?|hrs?|minutes?|mins?)\b/gi, '')
    .replace(/it'?s (?:critical|urgent|important|high priority|low priority).*/gi, '')
    .replace(/[.!?,\s]+$/, '')
    .trim();
  title = title.charAt(0).toUpperCase() + title.slice(1) || 'New Task';

  // Deadline
  let deadline = null;
  if (/today|tonight/.test(lower)) {
    const d = new Date(now); d.setHours(/tonight/.test(lower) ? 21 : 23, 59, 0, 0); deadline = d.toISOString();
  } else if (/tomorrow/.test(lower)) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    if (/morning/.test(lower)) d.setHours(9, 0, 0, 0);
    else if (/evening/.test(lower)) d.setHours(18, 0, 0, 0);
    else if (/night/.test(lower)) d.setHours(21, 0, 0, 0);
    else d.setHours(23, 59, 0, 0);
    deadline = d.toISOString();
  } else {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (lower.includes(days[i]) || lower.includes(days[i].substring(0, 3))) {
        const d = new Date(now);
        const diff = ((i - d.getDay()) + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        if (/morning/.test(lower)) d.setHours(9, 0, 0, 0);
        else if (/evening/.test(lower)) d.setHours(18, 0, 0, 0);
        else if (/night/.test(lower)) d.setHours(21, 0, 0, 0);
        else d.setHours(23, 59, 0, 0);
        deadline = d.toISOString();
        break;
      }
    }
  }
  if (/next week/.test(lower)) {
    const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0);
    deadline = d.toISOString();
  }

  // Time extraction for due_time
  let due_time = null;
  const timeMatch = lower.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1]);
    const m = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3].toLowerCase();
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    due_time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Duration
  let duration_minutes = 60;
  const hourMatch = lower.match(/(\d+\.?\d*)\s*(?:hours?|hrs?|h)\b/);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?)\b/);
  if (hourMatch) duration_minutes = Math.round(parseFloat(hourMatch[1]) * 60);
  if (minMatch) duration_minutes += parseInt(minMatch[1]);
  if (/quick|brief|short/.test(lower)) duration_minutes = 15;
  if (/all day|full day/.test(lower)) duration_minutes = 360;

  // Priority
  let priority = 3;
  if (/critical|urgent|asap|emergency/.test(lower)) priority = 1;
  else if (/important|high priority/.test(lower)) priority = 2;
  else if (/whenever|low priority|not urgent/.test(lower)) priority = 5;

  // Energy
  const highEnergy = ['study', 'code', 'coding', 'write', 'writing', 'research', 'design', 'develop', 'build', 'implement', 'analyze', 'thesis', 'exam'];
  const energy_requirement = highEnergy.some(w => lower.includes(w)) ? 'High' : 'Low';

  // Category
  const catMap = {
    work: ['meeting', 'presentation', 'client', 'email', 'project', 'deadline', 'office', 'report'],
    academics: ['study', 'exam', 'assignment', 'homework', 'lecture', 'thesis', 'research', 'class', 'lab'],
    personal: ['call', 'grocery', 'doctor', 'clean', 'cook', 'laundry', 'appointment'],
    fitness: ['gym', 'workout', 'run', 'exercise', 'yoga', 'swim'],
    creative: ['write', 'design', 'draw', 'art', 'music', 'blog'],
  };
  let category = 'general';
  for (const [cat, keywords] of Object.entries(catMap)) {
    if (keywords.some(k => lower.includes(k))) { category = cat; break; }
  }

  // Complex objective detection
  const complexIndicators = ['build', 'create', 'develop', 'launch', 'prepare for', 'study for', 'learn', 'master', 'complete the course', 'finish the project', 'design the entire', 'plan the'];
  const wordCount = input.split(/\s+/).length;
  const is_complex_objective = complexIndicators.some(ind => lower.includes(ind)) && (duration_minutes >= 180 || wordCount >= 8 || /app|project|system|course|program|portfolio|website/.test(lower));

  // Tags
  const tagMap = {
    academics: ['study', 'exam', 'assignment', 'homework', 'lecture', 'thesis', 'research', 'class', 'lab'],
    coding: ['code', 'coding', 'programming', 'develop', 'build', 'debug', 'deploy', 'api', 'app'],
    writing: ['write', 'essay', 'report', 'blog', 'article', 'document'],
    fitness: ['gym', 'workout', 'run', 'exercise', 'yoga', 'swim'],
    personal: ['call', 'grocery', 'doctor', 'clean', 'cook', 'laundry'],
    work: ['meeting', 'presentation', 'client', 'email', 'project', 'deadline'],
  };
  const tags = [];
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(k => lower.includes(k))) tags.push(tag);
  }
  if (tags.length === 0) tags.push('general');

  return {
    title, deadline, due_time, duration_minutes, priority, energy_requirement,
    category, tags, is_complex_objective,
    description: `Parsed from: "${input}"`,
  };
}


// ═══════════════════════════════════════════════════════════════
// ENGINE 2: Recursive Decomposition Engine ("The Architect")
// ═══════════════════════════════════════════════════════════════
// Breaks complex objectives into atomic tasks with dependencies.

export function buildDecompositionPrompt(parsedTask) {
  const now = new Date();
  const baseDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);

  // Calculate available days until deadline
  let deadlineInfo = 'Open-Ended (no fixed deadline)';
  let daysUntilDeadline = null;
  if (parsedTask.deadline) {
    const dl = new Date(parsedTask.deadline);
    daysUntilDeadline = Math.max(0, Math.ceil((dl - now) / 86400000));
    deadlineInfo = `${parsedTask.deadline} (${daysUntilDeadline} days from today)`;
  }

  // Build date labels for upcoming days
  const dayLabels = [];
  for (let i = 0; i < Math.min(daysUntilDeadline || 14, 14); i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dayLabels.push(`Day ${i} = ${d.toISOString().split('T')[0]} (${d.toLocaleDateString('en-US', { weekday: 'long' })})`);
  }

  return `**Role:** You are the Aether Logic Core — an elite AI curriculum planner and scheduler. Your goal is to transform a high-level educational or project objective into a deterministic, day-wise execution roadmap.

═══════════════════════════════════════════
OBJECTIVE: "${parsedTask.title}"
DESCRIPTION: ${parsedTask.description || 'N/A'}
ESTIMATED TOTAL HOURS: ${Math.round((parsedTask.duration_minutes || 180) / 60 * 10) / 10} hours (${parsedTask.duration_minutes || 180} minutes)
DEADLINE: ${deadlineInfo}
EXPLICIT TIME REQUESTED: ${parsedTask.due_time || 'None'}
CATEGORY: ${parsedTask.category}
BASE DATE: ${baseDate} (${now.toLocaleDateString('en-US', { weekday: 'long' })})
CURRENT TIME: ${now.toISOString()}
AVAILABLE DAYS:
${dayLabels.join('\n')}
═══════════════════════════════════════════

## Protocol 1: The Decomposition Protocol (Syllabus Generation)

1. First, generate a **comprehensive hierarchy of subtopics** for the objective. Think like a professor designing a syllabus.
2. **Granularity Rule**: Every subtask MUST be "Atomic" — between 30 and 60 minutes. If a topic naturally takes 2-3 hours, you MUST split it into "Part 1", "Part 2", "Part 3" etc.
3. **Dependency Rule**: Tasks MUST follow a logical learning/execution order. Foundational concepts come before advanced ones (e.g., "Variables & Types" before "Functions", "Matrices" before "Eigenvalues").
4. **Type Classification**: Classify each task as "Theory" (reading, watching, conceptual understanding) or "Practice" (exercises, coding, problem-solving, hands-on application).

## Protocol 2: Temporal Window Enforcement

You MUST strictly schedule tasks ONLY within these Designated Windows:
${parsedTask.due_time ? `- **OVERRIDE**: The user requested a specific time (${parsedTask.due_time}). Start the FIRST task at this time. Schedule subsequent tasks sequentially after it with 15-minute buffers.` : `- **Morning Block**: 07:00 – 09:00 (High-energy theory & deep focus work)
- **Evening Block**: 18:00 – 20:30 (Practice, review, lighter study)
- **Night Block**: 21:00 – 22:30 (Revision, flashcards, light reading)`}

**Window Rules:**
- NEVER schedule outside designated windows.
- NEVER schedule more than 4 hours of total study/work per day.
- Prefer Morning for high-energy "Theory" tasks, Evening for "Practice" tasks.
- Insert a 15-minute buffer between consecutive tasks.

## Protocol 3: Deadline & Horizon Logic

${daysUntilDeadline !== null ? `- **Fixed Deadline Mode**: The deadline is in ${daysUntilDeadline} day(s). Work BACKWARD from ${parsedTask.deadline} to ensure the entire syllabus completes on time.
- If the total hours required EXCEED the available window capacity (${daysUntilDeadline} days × ~4h/day = ~${daysUntilDeadline * 4}h max), you MUST flag a "temporal_overflow" warning in your response and trim lower-priority tasks.` : `- **Open-Ended Mode**: No deadline given. Calculate total hours needed for the full syllabus, then schedule day-by-day into the next available designated windows until the topic is "Mastered."`}

## Protocol 4: Output Format (Strict JSON)

Return ONLY a valid JSON array of flat task objects. Each task must include absolute ISO timestamps for scheduling. No markdown, no explanation — pure JSON.

[
  {
    "title": "Topic Name: Specific Sub-block",
    "description": "Brief pedagogical goal for this block",
    "duration_minutes": 45,
    "day": "${baseDate}",
    "day_offset": 0,
    "scheduled_start": "${baseDate}T07:00:00",
    "scheduled_end": "${baseDate}T07:45:00",
    "due_time": "07:00",
    "priority": 0.9,
    "type": "Theory",
    "energy_requirement": "High",
    "is_critical": true,
    "ai_logic": "Scheduled in Morning Block — foundational concept, must precede X.",
    "category": "${parsedTask.category}",
    "tags": ["tag1"],
    "dependency_index": -1
  }
]

## Critical Rules Summary
- Every task gets an absolute "scheduled_start" and "scheduled_end" in ISO format using the correct day.
- Tasks within a day are sequential with 15-min buffers.
- "day_offset": 0 = today (${baseDate}), 1 = tomorrow, etc.
- "dependency_index": index of the prerequisite task in the array (-1 = no dependency).
- "priority": float 0.0–1.0 (1.0 = most critical for deadline).
- "type": must be exactly "Theory" or "Practice".
- Generate enough tasks to cover the FULL estimated duration. Do NOT truncate.
- If 8 hours of content → produce ~12-16 atomic tasks across multiple days.
${daysUntilDeadline !== null && daysUntilDeadline <= 1 ? `- URGENT: Only ${daysUntilDeadline} day(s) remain! Pack tasks tightly within all available windows today.` : ''}`;
}

// Local fallback decomposition (rule-based) — Aether Logic Core compatible
export function localDecompose(parsedTask) {
  const { title, duration_minutes, category, priority, tags, deadline } = parsedTask;
  const lower = title.toLowerCase();
  const totalMinutes = duration_minutes || 180;
  const now = new Date();

  // Designated Windows (hour, minute) — matching the Aether Logic Core protocol
  const WINDOWS = [
    { label: 'Morning', slots: [{ h: 7, m: 0 }, { h: 7, m: 45 }, { h: 8, m: 0 }, { h: 8, m: 45 }], preferType: 'Theory' },
    { label: 'Evening', slots: [{ h: 18, m: 0 }, { h: 18, m: 45 }, { h: 19, m: 30 }, { h: 20, m: 0 }], preferType: 'Practice' },
    { label: 'Night',   slots: [{ h: 21, m: 0 }, { h: 21, m: 45 }], preferType: 'Theory' },
  ];

  // Max 4 hours per day = 240 minutes
  const MAX_DAILY_MINUTES = 240;

  // Build slots across all windows for a given day
  function getSlotsForDay(dayOffset) {
    const dayDate = new Date(now);
    dayDate.setDate(dayDate.getDate() + dayOffset);
    const dateStr = dayDate.toISOString().split('T')[0];
    const result = [];
    for (const win of WINDOWS) {
      for (const slot of win.slots) {
        result.push({ dateStr, dayOffset, h: slot.h, m: slot.m, window: win.label, preferType: win.preferType });
      }
    }
    return result;
  }

  // Generate template-based subtasks
  const templates = getDecompositionTemplate(lower, category);
  let rawTasks;

  if (templates.length > 0) {
    rawTasks = templates.map((t, i) => ({
      title: t.title,
      description: t.description,
      duration_minutes: Math.min(60, Math.max(30, t.duration || 45)),
      type: (t.energy || 'High') === 'High' ? 'Theory' : 'Practice',
      energy_requirement: t.energy || 'High',
      priority: typeof priority === 'number' && priority <= 1
        ? Math.max(0.1, priority - i * 0.05)
        : Math.max(0.1, 1 - (i / templates.length) * 0.6),
      is_critical: i < Math.ceil(templates.length * 0.4),
      category,
      tags: [...(tags || []), ...(t.tags || [])],
      dependency_index: t.depends ?? (i > 0 ? i - 1 : -1),
    }));
  } else {
    // Generic decomposition into phases
    const numTasks = Math.max(3, Math.ceil(totalMinutes / 45));
    const taskDuration = Math.min(60, Math.max(30, Math.ceil(totalMinutes / numTasks)));
    const phases = ['Research & Planning', 'Core Implementation', 'Review & Polish'];
    rawTasks = [];
    let taskIndex = 0;

    for (let phase = 0; phase < phases.length; phase++) {
      const phaseTasks = Math.ceil(numTasks / phases.length);
      for (let j = 0; j < phaseTasks && taskIndex < numTasks; j++) {
        const isTheory = phase === 0 || (phase === 2 && j === phaseTasks - 1);
        rawTasks.push({
          title: `${title} — ${phases[phase]} (Part ${j + 1})`,
          description: `Phase ${phase + 1}: ${phases[phase]} work for "${title}"`,
          duration_minutes: taskDuration,
          type: isTheory ? 'Theory' : 'Practice',
          energy_requirement: phase === 1 ? 'High' : 'Low',
          priority: Math.max(0.1, 0.9 - taskIndex * 0.05),
          is_critical: taskIndex < Math.ceil(numTasks * 0.5),
          category,
          tags: tags || [],
          dependency_index: taskIndex > 0 ? taskIndex - 1 : -1,
        });
        taskIndex++;
      }
    }
  }

  // Assign scheduled_start / scheduled_end using designated windows
  let currentDay = 0;
  let dayMinutesUsed = 0;
  let slotIndex = 0;
  let currentDaySlots = getSlotsForDay(0);

  const scheduled = rawTasks.map((task, i) => {
    // Check if we need to advance to the next day
    if (slotIndex >= currentDaySlots.length || dayMinutesUsed + task.duration_minutes > MAX_DAILY_MINUTES) {
      currentDay++;
      dayMinutesUsed = 0;
      slotIndex = 0;
      currentDaySlots = getSlotsForDay(currentDay);
    }

    const slot = currentDaySlots[slotIndex] || currentDaySlots[0];
    const dateStr = slot.dateStr;

    // Calculate start time
    const startH = slot.h;
    const startM = slot.m;
    const startStr = `${dateStr}T${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}:00`;

    // Calculate end time
    const endTotal = startH * 60 + startM + task.duration_minutes;
    const endH = Math.floor(endTotal / 60);
    const endM = endTotal % 60;
    const endStr = `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

    const due_time = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;

    dayMinutesUsed += task.duration_minutes + 15; // 15 min buffer
    slotIndex++;

    return {
      ...task,
      day: dateStr,
      day_offset: currentDay,
      scheduled_start: startStr,
      scheduled_end: endStr,
      due_time,
      ai_logic: `Scheduled in ${slot.window} Block (${slot.preferType} preferred) — ${task.is_critical ? 'critical path task' : 'supports learning progression'}.`,
    };
  });

  return scheduled;
}

function getDecompositionTemplate(lowerTitle, category) {
  // Coding / App building
  if (/build|create|develop|app|website|system|api/.test(lowerTitle)) {
    return [
      { title: 'Define requirements & scope', description: 'List features, constraints, and success criteria', duration: 30, energy: 'High', tags: ['planning'], depends: -1 },
      { title: 'Research architecture & tools', description: 'Evaluate tech stack, read documentation', duration: 45, energy: 'High', tags: ['research'], depends: 0 },
      { title: 'Set up project structure', description: 'Initialize repo, install dependencies, configure tooling', duration: 30, energy: 'Low', tags: ['setup'], depends: 1 },
      { title: 'Build core data models', description: 'Define schemas, types, and interfaces', duration: 45, energy: 'High', tags: ['coding'], depends: 2 },
      { title: 'Implement main feature (Part 1)', description: 'Build the primary functionality', duration: 60, energy: 'High', tags: ['coding'], depends: 3 },
      { title: 'Implement main feature (Part 2)', description: 'Continue core implementation', duration: 60, energy: 'High', tags: ['coding'], depends: 4 },
      { title: 'Build UI components', description: 'Create the user interface layer', duration: 60, energy: 'High', tags: ['coding', 'design'], depends: 5 },
      { title: 'Integration & wiring', description: 'Connect frontend to backend, test data flow', duration: 45, energy: 'High', tags: ['coding'], depends: 6 },
      { title: 'Testing & debugging', description: 'Write tests, fix edge cases', duration: 45, energy: 'High', tags: ['testing'], depends: 7 },
      { title: 'Polish & documentation', description: 'Clean code, add comments, write README', duration: 30, energy: 'Low', tags: ['docs'], depends: 8 },
    ];
  }

  // Study / Exam prep
  if (/study|exam|prepare|learn|course|chapter/.test(lowerTitle)) {
    return [
      { title: 'Review syllabus & outline key topics', description: 'Identify all topics to cover, prioritize by weight', duration: 20, energy: 'Low', tags: ['planning'], depends: -1 },
      { title: 'Study core concepts & theory', description: 'Read through main material, take notes on key ideas', duration: 60, energy: 'High', tags: ['study'], depends: 0 },
      { title: 'Deep dive: difficult topics', description: 'Focus on challenging concepts that need extra attention', duration: 60, energy: 'High', tags: ['study'], depends: 1 },
      { title: 'Practice problems (Set 1)', description: 'Work through practice questions and exercises', duration: 45, energy: 'High', tags: ['practice'], depends: 2 },
      { title: 'Practice problems (Set 2)', description: 'Continue with more advanced problems', duration: 45, energy: 'High', tags: ['practice'], depends: 3 },
      { title: 'Create summary notes / flashcards', description: 'Condense key points into review material', duration: 30, energy: 'Low', tags: ['review'], depends: 4 },
      { title: 'Mock test / self-assessment', description: 'Simulate exam conditions, identify weak areas', duration: 45, energy: 'High', tags: ['testing'], depends: 5 },
      { title: 'Final review & gap filling', description: 'Address weak areas found in self-assessment', duration: 30, energy: 'High', tags: ['review'], depends: 6 },
    ];
  }

  // Writing / Research
  if (/write|essay|report|paper|thesis|article|blog/.test(lowerTitle)) {
    return [
      { title: 'Research & gather sources', description: 'Find references, papers, and supporting material', duration: 45, energy: 'High', tags: ['research'], depends: -1 },
      { title: 'Create outline & structure', description: 'Draft section headings and key points', duration: 30, energy: 'High', tags: ['planning'], depends: 0 },
      { title: 'Write introduction', description: 'Draft the opening section', duration: 30, energy: 'High', tags: ['writing'], depends: 1 },
      { title: 'Write body (Part 1)', description: 'Draft main content sections', duration: 60, energy: 'High', tags: ['writing'], depends: 2 },
      { title: 'Write body (Part 2)', description: 'Continue main content', duration: 60, energy: 'High', tags: ['writing'], depends: 3 },
      { title: 'Write conclusion', description: 'Summarize findings and close', duration: 30, energy: 'High', tags: ['writing'], depends: 4 },
      { title: 'Edit & revise', description: 'Review for clarity, grammar, flow', duration: 45, energy: 'Low', tags: ['editing'], depends: 5 },
      { title: 'Final proofread & format', description: 'Polish formatting, citations, final check', duration: 20, energy: 'Low', tags: ['editing'], depends: 6 },
    ];
  }

  return []; // No template matched, use generic
}


// ═══════════════════════════════════════════════════════════════
// ENGINE 3: Optimization Engine (Constraint Solving)
// ═══════════════════════════════════════════════════════════════
// Weighted Scoring Algorithm for every 15-minute slot.
//
// Score(s) = (W_focus · C_s) + (W_deadline · U_task) - (W_switch · S_cost)
//
// C_s = Chronotype factor (energy at this time)
// U_task = Urgency (increases as deadline approaches)
// S_cost = Context switching penalty

export function calculateSlotScore(slotHour, slotMinute, task, prevCategory, weights = DEFAULT_WEIGHTS) {
  // C_s: Chronotype factor — interpolated energy score
  const fractionalHour = slotHour + slotMinute / 60;
  const floorH = Math.floor(fractionalHour);
  const ceilH = Math.ceil(fractionalHour);
  const eFloor = ENERGY_CURVE[floorH] || 0.2;
  const eCeil = ENERGY_CURVE[ceilH] || 0.2;
  const Cs_raw = eFloor + (eCeil - eFloor) * (fractionalHour - floorH);

  // Boost Cs for High-energy tasks during peak hours (8 AM - 12 PM)
  let Cs = Cs_raw;
  if (task.energy_requirement === 'High' && slotHour >= 8 && slotHour <= 12) {
    Cs *= 1.3; // 30% bonus for high-energy tasks in peak window
  } else if (task.energy_requirement === 'Low' && (slotHour < 8 || slotHour > 17)) {
    Cs *= 1.2; // Low-energy tasks get bonus outside peak hours
  }
  Cs = Math.min(1.0, Cs);

  // U_task: Urgency factor
  let Utask = 0.5;
  if (task.deadline || task.due_date) {
    const deadlineDate = new Date(task.deadline || task.due_date);
    const now = new Date();
    const hoursUntil = (deadlineDate - now) / (1000 * 60 * 60);
    if (hoursUntil <= 0) Utask = 1.0;        // Overdue — max urgency
    else if (hoursUntil <= 6) Utask = 0.95;
    else if (hoursUntil <= 12) Utask = 0.85;
    else if (hoursUntil <= 24) Utask = 0.75;
    else if (hoursUntil <= 48) Utask = 0.55;
    else if (hoursUntil <= 72) Utask = 0.4;
    else Utask = 0.2;
  }
  // Amplify by priority (1 = critical → boost, 5 = low → dampen)
  Utask *= (1.0 + (5 - (task.priority || 3)) * 0.1);
  Utask = Math.min(1.0, Utask);

  // S_cost: Context switching penalty
  let Scost = 0;
  if (prevCategory && prevCategory !== (task.category || 'general')) {
    Scost = 0.7; // Heavy penalty for switching context
  }
  if (prevCategory === (task.category || 'general')) {
    Scost = -0.1; // Small bonus for staying in same context
  }

  const score = (weights.W_focus * Cs) + (weights.W_deadline * Utask) - (weights.W_switch * Scost);
  return { score: Math.max(0, Math.min(1, score)), Cs, Utask, Scost };
}

export function optimizeTimeline(tasks, wakeHour = 7, sleepHour = 23, existingSlots = []) {
  // Generate 15-minute slots
  const slots = [];
  for (let h = wakeHour; h < sleepHour; h++) {
    for (let m = 0; m < 60; m += SLOT_DURATION_MINUTES) {
      slots.push({ hour: h, minute: m, occupied: false, taskId: null });
    }
  }

  // Mark existing slots as occupied
  existingSlots.forEach(es => {
    const st = new Date(es.start_time);
    const et = new Date(es.end_time);
    slots.forEach(slot => {
      const slotTime = new Date();
      slotTime.setHours(slot.hour, slot.minute, 0, 0);
      const slotEnd = new Date(slotTime.getTime() + SLOT_DURATION_MINUTES * 60000);
      if (slotTime < et && slotEnd > st) {
        slot.occupied = true;
      }
    });
  });

  // Sort tasks: respect dependencies (topological sort), then urgency
  const sorted = topologicalSort(tasks);

  const placements = [];
  let prevCategory = null;

  for (const task of sorted) {
    // Check dependency constraints
    const depSatisfied = !task.dependency_id || placements.some(p => p.taskId === task.dependency_id);
    if (!depSatisfied) continue; // Skip if dependency not yet placed

    const slotsNeeded = Math.ceil((task.duration_minutes || 60) / SLOT_DURATION_MINUTES);
    let bestIndex = -1;
    let bestScore = -Infinity;
    let bestScoreDetails = {};

    // Find the best contiguous block of free slots
    for (let i = 0; i <= slots.length - slotsNeeded; i++) {
      // Check if all needed slots are free
      let allFree = true;
      for (let j = 0; j < slotsNeeded; j++) {
        if (slots[i + j].occupied) { allFree = false; break; }
      }
      if (!allFree) continue;

      // Check dependency timing: must start after dependency ends
      if (task.dependency_id) {
        const depPlacement = placements.find(p => p.taskId === task.dependency_id);
        if (depPlacement) {
          const depEnd = new Date(depPlacement.end_time);
          const slotStart = new Date();
          slotStart.setHours(slots[i].hour, slots[i].minute, 0, 0);
          if (slotStart < depEnd) continue; // Must start after dependency
        }
      }

      const details = calculateSlotScore(slots[i].hour, slots[i].minute, task, prevCategory);
      if (details.score > bestScore) {
        bestScore = details.score;
        bestIndex = i;
        bestScoreDetails = details;
      }
    }

    if (bestIndex >= 0) {
      // Reserve slots
      for (let j = 0; j < slotsNeeded; j++) {
        slots[bestIndex + j].occupied = true;
        slots[bestIndex + j].taskId = task.id;
      }

      const startSlot = slots[bestIndex];
      const start = new Date();
      start.setHours(startSlot.hour, startSlot.minute, 0, 0);
      const end = new Date(start.getTime() + (task.duration_minutes || 60) * 60000);

      const reasoning = generatePlacementReasoning(task, startSlot.hour, bestScoreDetails);

      placements.push({
        taskId: task.id,
        task_name: task.task_name || task.title,
        task_type: task.task_type || (task.energy_requirement === 'High' ? 'DEEP_WORK' : 'SHALLOW_WORK'),
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        placement_score: bestScore,
        score_details: bestScoreDetails,
        ai_reasoning: reasoning,
        is_protected: task.energy_requirement === 'High' && (task.duration_minutes || 60) >= 60,
      });

      prevCategory = task.category || 'general';
    }
  }

  return placements.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function topologicalSort(tasks) {
  // Build adjacency from dependency_id
  const result = [];
  const visited = new Set();
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  function visit(task) {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    if (task.dependency_id && taskMap.has(task.dependency_id)) {
      visit(taskMap.get(task.dependency_id));
    }
    result.push(task);
  }

  // Sort by urgency first, then topological
  const byUrgency = [...tasks].sort((a, b) => (a.priority || 3) - (b.priority || 3));
  byUrgency.forEach(visit);

  return result;
}

function generatePlacementReasoning(task, slotHour, details) {
  const parts = [];
  const timeStr = `${slotHour > 12 ? slotHour - 12 : slotHour}:00 ${slotHour >= 12 ? 'PM' : 'AM'}`;

  if (details.Cs > 0.8) {
    parts.push(`your focus score is ${Math.round(details.Cs * 100)}% at this hour — ideal for ${task.energy_requirement === 'High' ? 'deep work' : 'this task type'}`);
  } else if (details.Cs > 0.5) {
    parts.push(`moderate focus window (${Math.round(details.Cs * 100)}%)`);
  } else {
    parts.push(`placed here due to scheduling constraints — focus is at ${Math.round(details.Cs * 100)}%`);
  }

  if (details.Utask > 0.7) {
    parts.push('deadline pressure is high — prioritized placement');
  }

  if (details.Scost < 0) {
    parts.push('same category as the previous task — minimizes context switching');
  } else if (details.Scost > 0.5) {
    parts.push('note: this switches context from the previous task');
  }

  return `Placed at ${timeStr} because ${parts.join(', ')}.`;
}


// ═══════════════════════════════════════════════════════════════
// ENGINE 4: Predictive Feedback Loop ("The Learner")
// ═══════════════════════════════════════════════════════════════
// Monitors scheduled_duration vs actual_completion_time.
// Maintains per-category velocity coefficients.

const VELOCITY_STORAGE_KEY = 'aetheris_velocity_coefficients';

export function getVelocityCoefficients() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(VELOCITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function saveVelocityCoefficients(coefficients) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VELOCITY_STORAGE_KEY, JSON.stringify(coefficients));
}

/**
 * Record a task completion and update velocity coefficients.
 * @param {string} category - Task category (e.g., "coding", "academics")
 * @param {number} scheduledMinutes - How long the task was scheduled for
 * @param {number} actualMinutes - How long it actually took
 */
export function recordCompletion(category, scheduledMinutes, actualMinutes) {
  const coefficients = getVelocityCoefficients();

  if (!coefficients[category]) {
    coefficients[category] = {
      samples: [],
      coefficient: 1.0,
      totalScheduled: 0,
      totalActual: 0,
      avgOverrun: 0,
    };
  }

  const entry = coefficients[category];
  entry.samples.push({ scheduled: scheduledMinutes, actual: actualMinutes, timestamp: Date.now() });

  // Keep last 50 samples per category
  if (entry.samples.length > 50) entry.samples = entry.samples.slice(-50);

  entry.totalScheduled += scheduledMinutes;
  entry.totalActual += actualMinutes;

  // Recalculate coefficient: weighted moving average
  const recentSamples = entry.samples.slice(-10); // Last 10 for recency bias
  const avgRatio = recentSamples.reduce((sum, s) => sum + (s.actual / s.scheduled), 0) / recentSamples.length;

  // Only apply padding if consistently > 20% slower
  if (avgRatio > 1.2) {
    entry.coefficient = Math.round(avgRatio * 100) / 100; // e.g., 1.23
    entry.avgOverrun = Math.round((avgRatio - 1) * 100); // e.g., 23%
  } else if (avgRatio < 0.8) {
    // User is faster than estimated — gently reduce
    entry.coefficient = Math.max(0.8, Math.round(avgRatio * 100) / 100);
    entry.avgOverrun = Math.round((avgRatio - 1) * 100);
  } else {
    entry.coefficient = 1.0;
    entry.avgOverrun = 0;
  }

  saveVelocityCoefficients(coefficients);
  return entry;
}

/**
 * Apply velocity correction to a task's duration estimate.
 * @param {string} category - Task category
 * @param {number} estimatedMinutes - User's estimate
 * @returns {{ adjusted: number, coefficient: number, note: string|null }}
 */
export function applyVelocityCorrection(category, estimatedMinutes) {
  const coefficients = getVelocityCoefficients();
  const entry = coefficients[category];

  if (!entry || entry.samples.length < 5 || entry.coefficient === 1.0) {
    return { adjusted: estimatedMinutes, coefficient: 1.0, note: null };
  }

  const adjusted = Math.round(estimatedMinutes * entry.coefficient);
  const diff = adjusted - estimatedMinutes;
  const note = diff > 0
    ? `Auto-padded by ${diff} min (+${entry.avgOverrun}%) based on your ${category} velocity history (${entry.samples.length} samples).`
    : `Optimized: you typically finish ${category} tasks ${Math.abs(entry.avgOverrun)}% faster. Reduced by ${Math.abs(diff)} min.`;

  return { adjusted, coefficient: entry.coefficient, note };
}


// ═══════════════════════════════════════════════════════════════
// RIPPLE EFFECT — Dependency chain recalculation
// ═══════════════════════════════════════════════════════════════
// When a task is moved or resized, all dependent tasks must shift.

export function calculateRippleEffect(tasks, movedTaskId, newStartTime, newEndTime) {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  const movedTask = taskMap.get(movedTaskId);
  if (!movedTask) return tasks;

  movedTask.start_time = newStartTime;
  movedTask.end_time = newEndTime;

  // Find all tasks that depend on the moved task (directly or transitively)
  const affected = new Set();
  function findDependents(taskId) {
    tasks.forEach(t => {
      if (t.dependency_id === taskId && !affected.has(t.id)) {
        affected.add(t.id);
        findDependents(t.id);
      }
    });
  }
  findDependents(movedTaskId);

  // Shift each affected task
  const movedEnd = new Date(newEndTime);
  affected.forEach(depId => {
    const depTask = taskMap.get(depId);
    if (!depTask) return;
    const depParentEnd = new Date(taskMap.get(depTask.dependency_id)?.end_time || newEndTime);
    const depStart = new Date(depParentEnd.getTime() + 15 * 60000); // 15 min buffer
    const depDuration = (new Date(depTask.end_time) - new Date(depTask.start_time));
    depTask.start_time = depStart.toISOString();
    depTask.end_time = new Date(depStart.getTime() + depDuration).toISOString();
    depTask.ai_reasoning = `Shifted due to dependency on "${movedTask.task_name || movedTask.title}" — ripple effect recalculation.`;
  });

  return Array.from(taskMap.values());
}
