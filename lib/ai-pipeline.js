// AI Pipeline — NLP Parser, Task Decomposition, Optimization, Learning

// ── Auto-Priority Engine ──
export function calculateAutoPriority(task) {
  let score = 0;
  const now = new Date();

  // Deadline proximity
  if (task.due_date) {
    const deadline = new Date(task.due_date);
    if (task.due_time) {
      const [h, m] = task.due_time.split(':');
      deadline.setHours(parseInt(h), parseInt(m));
    }
    const hoursUntil = (deadline - now) / (1000 * 60 * 60);
    if (hoursUntil < 0) score += 50; // overdue
    else if (hoursUntil < 6) score += 40;
    else if (hoursUntil < 24) score += 30;
    else if (hoursUntil < 48) score += 20;
    else if (hoursUntil < 72) score += 10;
  }

  // Urgency score contribution
  score += (task.urgency_score || 0.5) * 20;

  // Stress signals
  if (task.stress_detected) score += 15;

  // Task type — deep work inherently more important
  if (task.task_type === 'DEEP_WORK') score += 10;
  else if (task.task_type === 'FIXED_EVENT') score += 15;

  // Map to priority
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

// ── NLP Parser (Stage 1: Perception) ──
export function parseNaturalLanguage(rawInput) {
  const input = rawInput.toLowerCase();
  const result = {
    task_name: '',
    description: '',
    deadline: null,
    due_date: null,
    due_time: null,
    estimated_duration_minutes: 60,
    task_type: 'SHALLOW_WORK',
    urgency_score: 0.5,
    stress_detected: false,
    tags: [],
    category: 'general',
    reminder: 'none',
    raw_input: rawInput,
  };

  // Entity extraction
  result.task_name = extractTaskName(rawInput);
  result.deadline = extractDeadline(input);
  result.due_date = result.deadline ? result.deadline.split('T')[0] : null;
  result.due_time = extractTime(input);
  result.estimated_duration_minutes = extractDuration(input);
  result.task_type = classifyTaskType(input);
  result.tags = extractTags(input);
  result.category = extractCategory(input);

  // Auto-set reminder if deadline exists
  if (result.deadline) {
    const hoursUntil = (new Date(result.deadline) - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 24) result.reminder = '30min';
    else if (hoursUntil < 72) result.reminder = '1hour';
    else result.reminder = '1day';
  }

  // Sentiment & urgency enrichment
  const stressWords = ['stressed', 'anxious', 'worried', 'urgent', 'asap', 'critical', 'emergency', 'desperate', 'overwhelmed'];
  const urgencyWords = ['need to', 'must', 'have to', 'deadline', 'before', 'by tomorrow', 'today', 'right away', 'immediately'];
  result.stress_detected = stressWords.some(w => input.includes(w));
  const urgencyCount = urgencyWords.filter(w => input.includes(w)).length;
  result.urgency_score = Math.min(1.0, 0.3 + urgencyCount * 0.15 + (result.stress_detected ? 0.25 : 0));
  if (result.deadline) {
    const hoursUntil = (new Date(result.deadline) - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 24) result.urgency_score = Math.min(1.0, result.urgency_score + 0.3);
    else if (hoursUntil < 48) result.urgency_score = Math.min(1.0, result.urgency_score + 0.15);
  }

  return result;
}

function extractTaskName(input) {
  let name = input
    .replace(/i need to |i have to |i want to |i should |please |remind me to |can you |let me |gotta |gonna /gi, '')
    .replace(/before .+|by .+|tomorrow|today|tonight|this week|next week|in \d+ .+|about \d+ .+|around \d+ .+|it'll .+|it will .+|should take .+|probably take .+|and i'm .+/gi, '')
    .replace(/,?\s*(?:about|around|roughly|approximately)?\s*\d+\.?\d*\s*(?:hours?|hrs?|minutes?|mins?)\b/gi, '')
    .replace(/,?\s*for\s+\d+\.?\d*\s*(?:hours?|hrs?|minutes?|mins?)\b/gi, '')
    .replace(/at \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, '')
    .replace(/[.!?,\s]+$/, '')
    .trim();
  if (name.length > 60) name = name.substring(0, 60) + '...';
  return name.charAt(0).toUpperCase() + name.slice(1) || 'New Task';
}

function extractDeadline(input) {
  const now = new Date();
  if (input.includes('today') || input.includes('tonight')) {
    const d = new Date(now); d.setHours(23, 59, 0, 0); return d.toISOString();
  }
  if (input.includes('tomorrow')) {
    const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d.toISOString();
  }
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < days.length; i++) {
    if (input.includes(days[i]) || input.includes(days[i].substring(0, 3))) {
      const d = new Date(now); const diff = ((i - d.getDay()) + 7) % 7 || 7;
      d.setDate(d.getDate() + diff); d.setHours(23, 59, 0, 0); return d.toISOString();
    }
  }
  if (input.includes('next week')) {
    const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d.toISOString();
  }
  return null;
}

function extractTime(input) {
  const match = input.match(/(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2] ? parseInt(match[2]) : 0;
    const period = match[3].toLowerCase();
    if (period === 'pm' && h < 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return null;
}

function extractDuration(input) {
  const hourMatch = input.match(/(\d+\.?\d*)\s*(?:hours?|hrs?|h)\b/);
  const minMatch = input.match(/(\d+)\s*(?:minutes?|mins?)\b/);
  let mins = 0;
  if (hourMatch) mins += Math.round(parseFloat(hourMatch[1]) * 60);
  if (minMatch) mins += parseInt(minMatch[1]);
  if (mins > 0) return mins;
  if (/quick|brief|short|fast/.test(input)) return 15;
  if (/most of the day|all day|full day/.test(input)) return 360;
  if (/half day|half a day/.test(input)) return 180;
  return 60;
}

function classifyTaskType(input) {
  const deepWork = ['study', 'code', 'coding', 'write', 'writing', 'research', 'design', 'develop', 'assignment', 'exam', 'thesis', 'project', 'analyze', 'build', 'implement', 'presentation prep'];
  const fixedEvent = ['meeting', 'class', 'lecture', 'appointment', 'call with', 'interview', 'doctor', 'dentist', 'dinner', 'lunch with', 'conference'];
  const shallowWork = ['email', 'reply', 'message', 'file', 'organize', 'clean', 'update', 'review', 'check', 'admin', 'invoice', 'grocery', 'errand'];
  if (fixedEvent.some(w => input.includes(w))) return 'FIXED_EVENT';
  if (deepWork.some(w => input.includes(w))) return 'DEEP_WORK';
  if (shallowWork.some(w => input.includes(w))) return 'SHALLOW_WORK';
  return 'SHALLOW_WORK';
}

function extractTags(input) {
  const tagMap = {
    academics: ['study', 'exam', 'assignment', 'homework', 'lecture', 'thesis', 'research', 'class'],
    coding: ['code', 'coding', 'programming', 'develop', 'build', 'debug', 'deploy', 'api'],
    writing: ['write', 'essay', 'report', 'blog', 'article', 'document'],
    fitness: ['gym', 'workout', 'run', 'exercise', 'yoga', 'swim'],
    personal: ['call', 'grocery', 'doctor', 'clean', 'cook', 'laundry'],
    work: ['meeting', 'presentation', 'client', 'email', 'project', 'deadline'],
  };
  const tags = [];
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some(k => input.includes(k))) tags.push(tag);
  }
  return tags.length ? tags : ['general'];
}

function extractCategory(input) {
  const catMap = {
    work: ['meeting', 'presentation', 'client', 'email', 'project', 'deadline', 'office', 'report'],
    academics: ['study', 'exam', 'assignment', 'homework', 'lecture', 'thesis', 'research', 'class'],
    personal: ['call', 'grocery', 'doctor', 'clean', 'cook', 'laundry', 'appointment'],
    fitness: ['gym', 'workout', 'run', 'exercise', 'yoga', 'swim'],
    creative: ['write', 'design', 'draw', 'art', 'music', 'blog'],
  };
  for (const [cat, keywords] of Object.entries(catMap)) {
    if (keywords.some(k => input.includes(k))) return cat;
  }
  return 'general';
}

// ── Task Decomposition (Stage 2: Planning) ──
export function decomposeTask(task) {
  if (task.estimated_duration_minutes <= 90) {
    return [{ ...task, id: generateId(), parent_goal_id: task.id, depends_on: [], buffer_minutes: 10 }];
  }
  const numChunks = Math.ceil(task.estimated_duration_minutes / 75);
  const chunkDuration = Math.round(task.estimated_duration_minutes / numChunks);
  const subtasks = [];
  for (let i = 0; i < numChunks; i++) {
    subtasks.push({
      id: generateId(),
      parent_goal_id: task.id,
      name: `${task.task_name} — Part ${i + 1}`,
      duration_minutes: Math.min(chunkDuration, 90),
      buffer_minutes: 10,
      depends_on: i > 0 ? [subtasks[i - 1].id] : [],
      task_type: task.task_type,
      scheduled_slot: null,
    });
  }
  return subtasks;
}

// ── Optimization Engine (Stage 3) ──
const DEFAULT_WEIGHTS = { w1_chronotype: 0.35, w2_urgency: 0.30, w3_energy_diff: 0.20, w4_switch_cost: 0.15 };

export function getChronotypeScore(hour) {
  const curve = { 6: 0.3, 7: 0.5, 8: 0.7, 9: 0.9, 10: 1.0, 11: 0.95, 12: 0.7, 13: 0.5, 14: 0.4, 15: 0.5, 16: 0.7, 17: 0.85, 18: 0.75, 19: 0.6, 20: 0.4, 21: 0.3, 22: 0.2 };
  return curve[hour] || 0.2;
}

export function calculatePlacementScore(task, slotHour, prevTaskType, weights = DEFAULT_WEIGHTS) {
  const Ct = getChronotypeScore(slotHour);
  const Utask = task.urgency_score || 0.5;
  const difficultyMap = { DEEP_WORK: 0.9, SHALLOW_WORK: 0.3, FIXED_EVENT: 0.5 };
  const taskDifficulty = difficultyMap[task.task_type] || 0.5;
  const Ediff = Math.abs(Ct - taskDifficulty);
  const Scost = prevTaskType && prevTaskType !== task.task_type ? 0.8 : 0.1;
  const score = (weights.w1_chronotype * Ct) + (weights.w2_urgency * Utask) - (weights.w3_energy_diff * Ediff) - (weights.w4_switch_cost * Scost);
  return Math.max(0, Math.min(1, score));
}

export function generateExplanation(task, slotHour, score) {
  const parts = [];
  const ct = getChronotypeScore(slotHour);
  if (ct > 0.8) parts.push(`your focus is ${Math.round(ct * 100 - 50)}% higher than average at this hour`);
  if (task.urgency_score > 0.6) {
    if (task.deadline || task.due_date) {
      const dl = task.deadline || task.due_date;
      const hrs = Math.round((new Date(dl) - new Date()) / (1000 * 60 * 60));
      parts.push(`this task is due in ${hrs} hours`);
    } else { parts.push('this task has high urgency'); }
  }
  if (task.task_type === 'DEEP_WORK' && ct > 0.7) parts.push('peak focus window for deep work');
  if (parts.length === 0) parts.push('this was the best available slot given your current schedule');
  const timeStr = `${slotHour > 12 ? slotHour - 12 : slotHour}:00 ${slotHour >= 12 ? 'PM' : 'AM'}`;
  return `Scheduled at ${timeStr} because ${parts.join(', and ')}.`;
}

// ── Simplified Optimizer (GA-inspired) ──
export function optimizeSchedule(tasks, existingSlots = [], wakeHour = 7, sleepHour = 23) {
  const schedule = [];
  const fixedTasks = [];
  const flexTasks = [];

  // Separate tasks into fixed (has specific time) and flexible
  tasks.forEach(task => {
    if (task.scheduled_start || task.due_time) {
      fixedTasks.push(task);
    } else {
      flexTasks.push(task);
    }
  });

  const takenHours = new Set();

  // 1. Mark existing external slots as taken
  existingSlots.forEach(s => {
    const sH = new Date(s.start_time).getHours();
    const eH = new Date(s.end_time).getHours();
    for (let h = sH; h < Math.max(sH + 1, eH); h++) takenHours.add(h);
  });

  // 2. Pre-place fixed tasks
  for (const task of fixedTasks) {
    const dur = task.adjusted_duration || task.estimated_duration_minutes || 60;
    let start;
    if (task.scheduled_start) {
      start = new Date(task.scheduled_start);
    } else if (task.due_time) {
      const [hh, mm] = task.due_time.split(':');
      // Use due_date if available, otherwise today
      start = task.due_date ? new Date(task.due_date) : new Date();
      start.setHours(parseInt(hh), parseInt(mm), 0, 0);
    }

    const end = new Date(start); 
    if (task.scheduled_end) {
      end.setTime(new Date(task.scheduled_end).getTime());
    } else {
      end.setMinutes(end.getMinutes() + dur);
    }

    // Mark hours as taken
    const sH = start.getHours();
    const eH = end.getHours() || sH + 1;
    for (let h = sH; h <= eH; h++) takenHours.add(h);

    schedule.push({
      slot_id: generateId(), task_id: task.id, task_name: task.task_name || task.name,
      task_type: task.task_type, start_time: start.toISOString(), end_time: end.toISOString(),
      placement_score: 1.0, ct_score: getChronotypeScore(sH),
      ai_reasoning: task.ai_logic || 'Scheduled at fixed requested time.',
      is_protected: task.is_critical || task.task_type === 'FIXED_EVENT' || (task.task_type === 'DEEP_WORK' && dur >= 90),
      tags: task.tags || [],
    });
  }

  // 3. Find remaining available hours
  const available = [];
  for (let h = wakeHour; h < sleepHour; h++) {
    if (!takenHours.has(h)) available.push(h);
  }

  // 4. Place flexible tasks into available slots based on score
  const getPriorityVal = p => p === 'high' ? 1 : p === 'medium' ? 0.5 : 0.1;
  const sortedFlex = [...flexTasks].sort((a, b) => {
    const pA = getPriorityVal(a.priority);
    const pB = getPriorityVal(b.priority);
    if (pB !== pA) return pB - pA;
    return (b.urgency_score || 0.5) - (a.urgency_score || 0.5);
  });
  let prevType = null;

  for (const task of sortedFlex) {
    let bestSlot = null, bestScore = -1;
    const slotsNeeded = Math.ceil((task.adjusted_duration || task.estimated_duration_minutes || 60) / 60);
    
    for (let i = 0; i <= available.length - slotsNeeded; i++) {
      let contiguous = true;
      for (let j = 1; j < slotsNeeded; j++) {
        if (available[i + j] !== available[i] + j) { contiguous = false; break; }
      }
      if (!contiguous) continue;
      
      const score = calculatePlacementScore(task, available[i], prevType);
      if (score > bestScore) { bestScore = score; bestSlot = i; }
    }
    
    if (bestSlot !== null) {
      const startHour = available[bestSlot];
      const dur = task.adjusted_duration || task.estimated_duration_minutes || 60;
      
      // Use due_date if available, otherwise today
      const start = task.due_date ? new Date(task.due_date) : new Date();
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(start); 
      end.setMinutes(end.getMinutes() + dur);
      
      schedule.push({
        slot_id: generateId(), task_id: task.id, task_name: task.task_name || task.name,
        task_type: task.task_type, start_time: start.toISOString(), end_time: end.toISOString(),
        placement_score: bestScore, ct_score: getChronotypeScore(startHour),
        ai_reasoning: generateExplanation(task, startHour, bestScore),
        is_protected: task.task_type === 'DEEP_WORK' && dur >= 90,
        tags: task.tags || [],
      });
      
      for (let j = 0; j < slotsNeeded; j++) available.splice(bestSlot, 1);
      prevType = task.task_type;
    }
  }
  
  return schedule.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

// ── RL Learning (Stage 4) ──
export function updateWeights(feedbackSignal, slotFeatures, currentWeights) {
  const lr = 0.05;
  const newWeights = { ...currentWeights };
  const keys = Object.keys(newWeights);
  keys.forEach((key, i) => {
    newWeights[key] += lr * feedbackSignal * (slotFeatures[i] || 0);
  });
  const sum = Object.values(newWeights).reduce((a, b) => a + Math.abs(b), 0);
  keys.forEach(k => { newWeights[k] = Math.abs(newWeights[k]) / sum; });
  return newWeights;
}

// ── Duration Predictor ──
export function predictDuration(taskType, userEstimate, history = {}) {
  const model = history[taskType];
  if (model && model.sampleSize >= 5) {
    const adjusted = Math.round(model.beta * userEstimate + model.alpha);
    return { adjusted: Math.max(adjusted, userEstimate), multiplier: model.beta, note: `Based on your history, ${taskType.toLowerCase().replace('_', ' ')} tasks tend to take ~${Math.round((model.beta - 1) * 100)}% longer. Added ${adjusted - userEstimate} min buffer.` };
  }
  return { adjusted: userEstimate, multiplier: 1.0, note: null };
}

export function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}
