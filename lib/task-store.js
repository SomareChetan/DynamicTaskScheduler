// Enhanced Task Store — localStorage persistence + full CRUD + reactive state
import { generateId, optimizeSchedule, predictDuration, updateWeights, calculateAutoPriority } from './ai-pipeline';
import { applySelfHealing, triggerRipple, optimizeGaps } from './self-healing';

const STORAGE_KEY = 'aetheris_state';

const DEFAULT_USER = {
  id: 'user-001',
  display_name: 'User',
  wake_time: 7,
  sleep_time: 23,
  chronotype: null,
  model_weights: { w1_chronotype: 0.35, w2_urgency: 0.30, w3_energy_diff: 0.20, w4_switch_cost: 0.15 },
  duration_history: {
    DEEP_WORK: { alpha: 12, beta: 1.38, sampleSize: 30 },
    SHALLOW_WORK: { alpha: 5, beta: 1.15, sampleSize: 20 },
    FIXED_EVENT: { alpha: 0, beta: 1.0, sampleSize: 10 },
  },
  stats: { tasksCompleted: 47, tasksSkipped: 3, streak: 4, totalFocusHours: 128.5, avgAccuracy: 0.82 },
  preferences: { deepWorkProtection: true, autoBreaks: true, breakDuration: 15, focusMode: false },
};

const CATEGORIES = ['general', 'work', 'personal', 'academics', 'fitness', 'creative'];
const PRIORITIES = ['high', 'medium', 'low'];
const REMINDERS = [
  { value: 'none', label: 'No reminder' },
  { value: '5min', label: '5 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '1day', label: '1 day before' },
];

export { CATEGORIES, PRIORITIES, REMINDERS };

function getDemoTasks() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];
  const makeTime = (h, m = 0) => { const d = new Date(today); d.setHours(h, m, 0, 0); return d.toISOString(); };
  return [
    { id: generateId(), task_name: 'Study Memory Management', description: 'Review chapter 5-7 on virtual memory and paging', task_type: 'DEEP_WORK', status: 'pending', priority: 'high', category: 'academics', estimated_duration_minutes: 90, adjusted_duration: 120, priority_score: 0.87, due_date: todayStr, due_time: '17:00', deadline: makeTime(17, 0), urgency_score: 0.78, stress_detected: false, tags: ['academics', 'os'], reminder: '30min', created_at: new Date().toISOString(), raw_input: 'Study memory management for OS exam', completed_at: null },
    { id: generateId(), task_name: 'Review Process Scheduling', description: 'Go through scheduling algorithms: FCFS, SJF, Round Robin', task_type: 'DEEP_WORK', status: 'pending', priority: 'medium', category: 'academics', estimated_duration_minutes: 60, adjusted_duration: 82, priority_score: 0.75, due_date: todayStr, due_time: null, deadline: makeTime(23, 59), urgency_score: 0.65, tags: ['academics', 'os'], reminder: '1hour', created_at: new Date().toISOString(), completed_at: null },
    { id: generateId(), task_name: 'Reply to Professor Email', description: 'Follow up on research proposal feedback', task_type: 'SHALLOW_WORK', status: 'pending', priority: 'medium', category: 'work', estimated_duration_minutes: 15, adjusted_duration: 17, priority_score: 0.5, due_date: todayStr, due_time: '14:00', deadline: makeTime(14, 0), urgency_score: 0.4, tags: ['work', 'email'], reminder: '15min', created_at: new Date().toISOString(), completed_at: null },
    { id: generateId(), task_name: 'Team Standup', description: 'Daily sync with the dev team', task_type: 'FIXED_EVENT', status: 'pending', priority: 'high', category: 'work', estimated_duration_minutes: 30, adjusted_duration: 30, priority_score: 0.9, due_date: todayStr, due_time: '14:00', deadline: makeTime(14, 0), urgency_score: 0.9, tags: ['work', 'meeting'], reminder: '5min', created_at: new Date().toISOString(), completed_at: null },
    { id: generateId(), task_name: 'Practice Paging Algorithms', description: 'Implement LRU and FIFO page replacement', task_type: 'DEEP_WORK', status: 'pending', priority: 'medium', category: 'academics', estimated_duration_minutes: 60, adjusted_duration: 82, priority_score: 0.7, due_date: tomorrowStr, due_time: null, deadline: null, urgency_score: 0.6, tags: ['academics', 'os'], reminder: '1hour', created_at: new Date().toISOString(), completed_at: null },
    { id: generateId(), task_name: 'Gym Workout', description: 'Upper body strength training day', task_type: 'FIXED_EVENT', status: 'pending', priority: 'low', category: 'fitness', estimated_duration_minutes: 60, adjusted_duration: 60, priority_score: 0.6, due_date: todayStr, due_time: '18:00', deadline: null, urgency_score: 0.3, tags: ['fitness'], reminder: '30min', created_at: new Date().toISOString(), completed_at: null },
    { id: generateId(), task_name: 'Grocery Shopping', description: 'Buy vegetables, milk, and bread', task_type: 'SHALLOW_WORK', status: 'pending', priority: 'low', category: 'personal', estimated_duration_minutes: 45, adjusted_duration: 45, priority_score: 0.3, due_date: tomorrowStr, due_time: null, deadline: null, urgency_score: 0.2, tags: ['personal'], reminder: 'none', created_at: new Date().toISOString(), completed_at: null },
  ];
}

function buildSchedule(tasks, user) {
  const today = new Date().toISOString().split('T')[0];
  const todayTasks = tasks.filter(t =>
    t.status !== 'done' && t.status !== 'skipped' &&
    (t.due_date === today || (!t.due_date && t.created_at && t.created_at.startsWith(today)))
  );
  const baseSchedule = optimizeSchedule(todayTasks, [], user.wake_time, user.sleep_time);
  return applySelfHealing(baseSchedule, todayTasks);
}

function getDemoSchedule(tasks) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayTasks = tasks.filter(t => t.due_date === todayStr && t.status !== 'done' && t.status !== 'skipped');
  const makeSlot = (task, sh, sm, eh, em, score, reason, prot = false) => {
    const s = new Date(today); s.setHours(sh, sm, 0, 0);
    const e = new Date(today); e.setHours(eh, em, 0, 0);
    return { slot_id: generateId(), task_id: task.id, task_name: task.task_name, task_type: task.task_type, start_time: s.toISOString(), end_time: e.toISOString(), placement_score: score, ct_score: 0.9, ai_reasoning: reason, is_protected: prot, tags: task.tags || [] };
  };

  const slots = [];
  if (todayTasks[0]) slots.push(makeSlot(todayTasks[0], 9, 0, 11, 0, 0.92, 'Scheduled at 9:00 AM because your focus is 40% higher than average at this hour. Deep Work Shield activated.', true));
  if (todayTasks[1]) slots.push(makeSlot(todayTasks[1], 11, 15, 12, 37, 0.85, 'Scheduled at 11:15 AM — follows another deep work block, reducing context-switching penalty.'));
  if (todayTasks[2]) slots.push(makeSlot(todayTasks[2], 12, 45, 13, 2, 0.68, 'Scheduled at 12:45 PM — low-energy shallow task ideal for the post-lunch dip.'));
  if (todayTasks[3]) slots.push(makeSlot(todayTasks[3], 14, 0, 14, 30, 0.95, 'Fixed calendar event — non-negotiable.'));
  if (todayTasks[4]) slots.push(makeSlot(todayTasks[4], 16, 0, 17, 22, 0.81, 'Scheduled at 4:00 PM — secondary focus peak between 4–6 PM.'));
  if (todayTasks[5]) slots.push(makeSlot(todayTasks[5], 18, 0, 19, 0, 0.72, 'Scheduled at 6:00 PM — evening exercise based on your routine.'));
  return slots;
}

// ── Persistence ──
function loadFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn('Failed to load state:', e); }
  return null;
}

function saveToStorage(state) {
  if (typeof window === 'undefined') return;
  try {
    const { activeView, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch (e) { console.warn('Failed to save state:', e); }
}

// ── State Core ──
let _state = null;
let _listeners = [];

function getInitialState() {
  const saved = loadFromStorage();
  if (saved) return { ...saved, activeView: 'myday', chatHistory: saved.chatHistory || [], notifications: saved.notifications || [] };
  const tasks = getDemoTasks();
  return { user: DEFAULT_USER, tasks, schedule: getDemoSchedule(tasks), feedbackEvents: [], conflicts: [], activeView: 'myday', chatHistory: [], notifications: [] };
}

export function getState() {
  if (!_state) _state = getInitialState();
  return _state;
}

export function setState(updater) {
  const prev = getState();
  _state = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
  _listeners.forEach(fn => fn(_state));
  saveToStorage(_state);
}

export function subscribe(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

// ── Task Operations ──
export function addTask(taskData) {
  const state = getState();
  const { adjusted, note } = predictDuration(taskData.task_type, taskData.estimated_duration_minutes, state.user.duration_history);

  // Build the full task object — preserve hierarchy fields from AI Decomposer
  const task = {
    id: taskData.id || generateId(),
    task_name: taskData.task_name || 'New Task',
    description: taskData.description || '',
    task_type: taskData.task_type || 'SHALLOW_WORK',
    status: taskData.status || 'pending',
    priority: taskData.priority || calculateAutoPriority(taskData),
    category: taskData.category || 'general',
    estimated_duration_minutes: taskData.estimated_duration_minutes || 60,
    adjusted_duration: taskData.adjusted_duration || adjusted,
    priority_score: taskData.urgency_score || 0.5,
    due_date: taskData.due_date || null,
    due_time: taskData.due_time || null,
    deadline: taskData.deadline || null,
    urgency_score: taskData.urgency_score || 0.5,
    stress_detected: taskData.stress_detected || false,
    tags: taskData.tags || [],
    reminder: taskData.reminder || 'none',
    raw_input: taskData.raw_input || '',
    xai_duration_note: taskData.velocity_note || note,
    created_at: new Date().toISOString(),
    completed_at: null,
    actual_duration: null,
    // Goal / Subtask hierarchy (from AI Decomposer)
    is_goal: taskData.is_goal || false,
    parent_id: taskData.parent_id || null,
    subtask_ids: taskData.subtask_ids || null,
    subtask_count: taskData.subtask_count || null,
    dependency_id: taskData.dependency_id || null,
    subtask_order: taskData.subtask_order ?? null,
    energy_requirement: taskData.energy_requirement || null,
    day_offset: taskData.day_offset ?? null,
    velocity_coefficient: taskData.velocity_coefficient || null,
    // Repeat / Recurrence
    repeat: taskData.repeat || 'none',
    repeat_custom_days: taskData.repeat_custom_days || null,
    repeat_end_date: taskData.repeat_end_date || null,
  };

  const newTasks = [...state.tasks, task];
  const newSchedule = buildSchedule(newTasks, state.user);
  setState({ tasks: newTasks, schedule: newSchedule });
  checkReminders();
  return task;
}

export function editTask(taskId, updates) {
  const state = getState();
  const newTasks = state.tasks.map(t => {
    if (t.id !== taskId) return t;
    // Merge updates, preserving hierarchy fields
    const updated = { ...t };
    // Apply each update field explicitly
    if (updates.task_name !== undefined) updated.task_name = updates.task_name;
    if (updates.description !== undefined) updated.description = updates.description;
    if (updates.task_type !== undefined) updated.task_type = updates.task_type;
    if (updates.due_date !== undefined) updated.due_date = updates.due_date;
    if (updates.due_time !== undefined) updated.due_time = updates.due_time;
    if (updates.estimated_duration_minutes !== undefined) updated.estimated_duration_minutes = updates.estimated_duration_minutes;
    if (updates.category !== undefined) updated.category = updates.category;
    if (updates.tags !== undefined) updated.tags = updates.tags;
    if (updates.reminder !== undefined) updated.reminder = updates.reminder;
    if (updates.priority !== undefined) updated.priority = updates.priority;
    if (updates.urgency_score !== undefined) updated.urgency_score = updates.urgency_score;
    if (updates.status !== undefined) updated.status = updates.status;
    if (updates.deadline !== undefined) updated.deadline = updates.deadline;
    if (updates.repeat !== undefined) updated.repeat = updates.repeat;
    if (updates.repeat_custom_days !== undefined) updated.repeat_custom_days = updates.repeat_custom_days;
    if (updates.repeat_end_date !== undefined) updated.repeat_end_date = updates.repeat_end_date;
    // Recalculate deadline from date+time if provided
    if (updates.due_date !== undefined || updates.due_time !== undefined) {
      const dd = updated.due_date;
      const dt = updated.due_time;
      updated.deadline = dd ? new Date(dd + (dt ? 'T' + dt : 'T23:59')).toISOString() : null;
    }
    // Recalculate auto-priority if relevant fields changed and no explicit priority
    if ((updates.due_date !== undefined || updates.urgency_score !== undefined || updates.task_type !== undefined) && !updates.priority) {
      updated.priority = calculateAutoPriority(updated);
    }
    return updated;
  });
  
  // Clear any existing notifications for edited tasks so they can re-trigger if time changed
  const newNotifications = (state.notifications || []).filter(n => n.taskId !== taskId);

  // Self-Healing Pipeline
  let newSchedule = state.schedule.map(s => ({ ...s }));
  const slot = newSchedule.find(s => s.task_id === taskId);
  
  if (slot) {
    let needsRipple = false;
    let timeDelta = 0;

    // 1. Check if start time changed
    if (updates.due_time !== undefined && updates.due_time) {
      const oldStart = new Date(slot.start_time).getTime();
      const [h, m] = updates.due_time.split(':');
      const newStart = new Date(slot.start_time);
      newStart.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      timeDelta = newStart.getTime() - oldStart;
      
      slot.start_time = newStart.toISOString();
      slot.end_time = new Date(new Date(slot.end_time).getTime() + timeDelta).toISOString();
      needsRipple = true;
    }
    
    // 2. Check if duration changed
    if (updates.estimated_duration_minutes !== undefined) {
      const oldDur = new Date(slot.end_time).getTime() - new Date(slot.start_time).getTime();
      const newDur = updates.estimated_duration_minutes * 60000;
      if (oldDur !== newDur) {
        slot.end_time = new Date(new Date(slot.start_time).getTime() + newDur).toISOString();
        needsRipple = true;
      }
    }

    if (needsRipple) {
      // Small delta ensures the ripple triggers collision resolution even if timeDelta is 0 (e.g. only duration grew)
      newSchedule = triggerRipple(newSchedule, newTasks, slot.slot_id, timeDelta !== 0 ? timeDelta : 1);
    }
  }

  // Always apply Vacuum Effect to squeeze out any new gaps
  newSchedule = optimizeGaps(newSchedule, newTasks);

  setState({ tasks: newTasks, schedule: newSchedule, notifications: newNotifications });
  checkReminders();
}

export function deleteTask(taskId) {
  const state = getState();
  const newTasks = state.tasks.filter(t => t.id !== taskId);
  
  // Self-Healing Vacuum Effect
  let newSchedule = state.schedule.filter(t => t.task_id !== taskId);
  newSchedule = optimizeGaps(newSchedule, newTasks);

  setState({ tasks: newTasks, schedule: newSchedule });
}

function createNextOccurrence(task, stateTasks) {
  if (!task.repeat || task.repeat === 'none') return null;
  if (!task.due_date) return null;

  const nextDate = new Date(task.due_date);
  
  if (task.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
  else if (task.repeat === 'every_2_days') nextDate.setDate(nextDate.getDate() + 2);
  else if (task.repeat === 'every_3_days') nextDate.setDate(nextDate.getDate() + 3);
  else if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (task.repeat === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
  else if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
  else if (task.repeat === 'weekdays') {
    nextDate.setDate(nextDate.getDate() + 1);
    while (nextDate.getDay() === 0 || nextDate.getDay() === 6) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
  } else if (task.repeat === 'custom') {
    const customDays = parseInt(task.repeat_custom_days) || 1;
    nextDate.setDate(nextDate.getDate() + customDays);
  } else {
    return null;
  }

  // Check end date
  if (task.repeat_end_date) {
    const end = new Date(task.repeat_end_date);
    if (nextDate > end) return null;
  }

  const nextDateStr = nextDate.toISOString().split('T')[0];
  
  // Prevent duplicate if already exists
  const exists = stateTasks.some(t => t.task_name === task.task_name && t.due_date === nextDateStr && t.status !== 'done' && t.status !== 'skipped');
  if (exists) return null;

  return {
    ...task,
    id: generateId(),
    status: 'pending',
    created_at: new Date().toISOString(),
    completed_at: null,
    actual_duration: null,
    due_date: nextDateStr,
    deadline: task.due_time ? new Date(nextDateStr + 'T' + task.due_time).toISOString() : new Date(nextDateStr + 'T23:59').toISOString()
  };
}

export function completeTask(taskId) {
  const state = getState();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const now = new Date();
  const slot = state.schedule.find(s => s.task_id === taskId);
  const actualDuration = slot ? Math.round((now - new Date(slot.start_time)) / 60000) : task.adjusted_duration;

  // RL feedback: positive signal
  const newWeights = updateWeights(1, [0.9, task.urgency_score, 0.5, 0.3], state.user.model_weights);
  const completedCount = state.user.stats.tasksCompleted + 1;
  const deepHours = task.task_type === 'DEEP_WORK' ? state.user.stats.totalFocusHours + (actualDuration / 60) : state.user.stats.totalFocusHours;

  let newTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: 'done', completed_at: now.toISOString(), actual_duration: actualDuration } : t);
  
  const nextOcc = createNextOccurrence(task, newTasks);
  if (nextOcc) newTasks.push(nextOcc);

  let newSchedule = state.schedule.filter(sl => sl.task_id !== taskId);
  newSchedule = optimizeGaps(newSchedule, newTasks);

  setState(s => ({
    ...s,
    tasks: newTasks,
    schedule: newSchedule,
    user: { ...s.user, model_weights: newWeights, stats: { ...s.user.stats, tasksCompleted: completedCount, totalFocusHours: deepHours, avgAccuracy: Math.min(0.99, s.user.stats.avgAccuracy + 0.002) } },
    feedbackEvents: [...s.feedbackEvents, { type: 'complete', taskId, timestamp: now.toISOString(), actualDuration }],
  }));
}

export function toggleTaskComplete(taskId) {
  const state = getState();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = new Date();
  const isDone = task.status === 'done';
  const newStatus = isDone ? 'pending' : 'done';
  
  let newTasks = state.tasks.map(t => t.id === taskId ? { ...t, status: newStatus, completed_at: isDone ? null : now.toISOString() } : t);
  
  if (!isDone) {
    const nextOcc = createNextOccurrence(task, newTasks);
    if (nextOcc) newTasks.push(nextOcc);
  }

  // Self-Healing Pipeline
  let newSchedule = state.schedule;
  if (!isDone) {
    // Marked as done: remove from timeline and squeeze gaps
    newSchedule = newSchedule.filter(sl => sl.task_id !== taskId);
    newSchedule = optimizeGaps(newSchedule, newTasks);
  } else {
    // Unmarked: We add it back by doing a full rebuild just to re-slot it properly
    newSchedule = buildSchedule(newTasks, state.user);
  }

  setState(s => ({ ...s, tasks: newTasks, schedule: newSchedule }));
}

export function skipTask(taskId) {
  const state = getState();
  const newWeights = updateWeights(-0.5, [0.9, 0.5, 0.5, 0.3], state.user.model_weights);
  setState(s => ({
    ...s,
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'skipped', skipped_at: new Date().toISOString() } : t),
    schedule: s.schedule.filter(sl => sl.task_id !== taskId),
    user: { ...s.user, model_weights: newWeights, stats: { ...s.user.stats, tasksSkipped: (s.user.stats.tasksSkipped || 0) + 1 } },
    feedbackEvents: [...s.feedbackEvents, { type: 'skip', taskId, timestamp: new Date().toISOString() }],
  }));
}

export function reoptimize() {
  const state = getState();
  // Rebuild full schedule from all pending tasks
  const today = new Date().toISOString().split('T')[0];
  const pendingTasks = state.tasks.filter(t =>
    t.status !== 'done' && t.status !== 'skipped' && !t.is_goal
  );
  const baseSchedule = optimizeSchedule(pendingTasks, [], state.user.wake_time, state.user.sleep_time);
  const healedSchedule = applySelfHealing(baseSchedule, pendingTasks);
  setState({ schedule: healedSchedule });
}

// ── Overdue Task Actions ──
export function rescheduleOverdueToToday() {
  const state = getState();
  const today = new Date().toISOString().split('T')[0];
  const overdue = getOverdueTasks();
  if (overdue.length === 0) return 0;
  const newTasks = state.tasks.map(t => {
    const isOverdue = overdue.find(o => o.id === t.id);
    if (!isOverdue) return t;
    return { ...t, due_date: today, due_time: null, deadline: new Date(today + 'T23:59').toISOString() };
  });
  const newSchedule = buildSchedule(newTasks, state.user);
  setState({ tasks: newTasks, schedule: newSchedule });
  return overdue.length;
}

export function skipAllOverdue() {
  const state = getState();
  const overdue = getOverdueTasks();
  if (overdue.length === 0) return 0;
  const overdueIds = new Set(overdue.map(t => t.id));
  const newTasks = state.tasks.map(t => {
    if (!overdueIds.has(t.id)) return t;
    return { ...t, status: 'skipped', skipped_at: new Date().toISOString() };
  });
  const newSchedule = buildSchedule(newTasks, state.user);
  setState({ tasks: newTasks, schedule: newSchedule });
  return overdue.length;
}

export function rescheduleTaskToDate(taskId, newDate) {
  const state = getState();
  const newTasks = state.tasks.map(t => {
    if (t.id !== taskId) return t;
    return { ...t, due_date: newDate, due_time: null, deadline: new Date(newDate + 'T23:59').toISOString() };
  });
  const newSchedule = buildSchedule(newTasks, state.user);
  setState({ tasks: newTasks, schedule: newSchedule });
}

export function updatePreferences(prefs) {
  setState(s => ({
    ...s,
    user: { ...s.user, preferences: { ...s.user.preferences, ...prefs } }
  }));
}

export function updateUserProfile(profile) {
  setState(s => ({
    ...s,
    user: { ...s.user, ...profile }
  }));
}

export function addChatMessage(role, content) {
  setState(s => ({
    ...s,
    chatHistory: [...(s.chatHistory || []), { id: generateId(), role, content, timestamp: new Date().toISOString() }]
  }));
}

export function clearData() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  _state = null;
  const fresh = getInitialState();
  _state = fresh;
  _listeners.forEach(fn => fn(_state));
}

// ── Notification / Reminder System ──
export function checkReminders() {
  const state = getState();
  const now = new Date();
  const newNotifications = [];

  state.tasks.forEach(task => {
    if (task.status === 'done' || task.status === 'skipped' || task.reminder === 'none' || !task.reminder) return;
    if (!task.due_date) return;

    const dueDate = new Date(task.due_date);
    if (task.due_time) {
      const [h, m] = task.due_time.split(':');
      dueDate.setHours(parseInt(h), parseInt(m));
    } else {
      dueDate.setHours(23, 59);
    }

    const minutesUntilDue = (dueDate - now) / (1000 * 60);
    const reminderMinutes = { '5min': 5, '15min': 15, '30min': 30, '1hour': 60, '1day': 1440 };
    const triggerAt = reminderMinutes[task.reminder] || 0;

    // Check if overdue
    if (minutesUntilDue < 0 && minutesUntilDue > -60) {
      const existingNotif = (state.notifications || []).find(n => n.taskId === task.id && n.type === 'overdue');
      if (!existingNotif) {
        newNotifications.push({ id: generateId(), taskId: task.id, type: 'overdue', title: 'Task Overdue', message: `"${task.task_name}" was due ${Math.abs(Math.round(minutesUntilDue))} minutes ago.`, timestamp: now.toISOString(), read: false });
      }
    }
    // Check if within reminder window
    else if (minutesUntilDue > 0 && minutesUntilDue <= triggerAt) {
      const existingNotif = (state.notifications || []).find(n => n.taskId === task.id && n.type === 'reminder');
      if (!existingNotif) {
        newNotifications.push({ id: generateId(), taskId: task.id, type: 'reminder', title: 'Upcoming Task', message: `"${task.task_name}" is due in ${Math.round(minutesUntilDue)} minutes.`, timestamp: now.toISOString(), read: false });
      }
    }
  });

  if (newNotifications.length > 0) {
    setState(s => ({ ...s, notifications: [...(s.notifications || []), ...newNotifications] }));
  }
  return newNotifications;
}

export function dismissNotification(notifId) {
  setState(s => ({ ...s, notifications: (s.notifications || []).filter(n => n.id !== notifId) }));
}

export function markNotificationRead(notifId) {
  setState(s => ({ ...s, notifications: (s.notifications || []).map(n => n.id === notifId ? { ...n, read: true } : n) }));
}

// ── Computed helpers ──
export function getCompletedTasks() {
  return getState().tasks.filter(t => t.status === 'done').sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
}

export function getDeepWorkHoursToday() {
  const state = getState();
  const todaySlots = state.schedule.filter(s => s.task_type === 'DEEP_WORK');
  return todaySlots.reduce((sum, s) => sum + (new Date(s.end_time) - new Date(s.start_time)) / 3600000, 0);
}

export function getTodayTasks() {
  const state = getState();
  const today = new Date().toISOString().split('T')[0];
  return state.tasks.filter(t =>
    t.due_date === today && t.status !== 'skipped'
  ).sort((a, b) => {
    // Sort: incomplete first, then by due time, then by priority
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (a.status !== 'done' && b.status === 'done') return -1;
    
    if (a.due_time && b.due_time) {
      const timeCmp = a.due_time.localeCompare(b.due_time);
      if (timeCmp !== 0) return timeCmp;
    } else if (a.due_time) {
      return -1;
    } else if (b.due_time) {
      return 1;
    }

    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    return pa - pb;
  });
}

export function getOverdueTasks() {
  const state = getState();
  const now = new Date();
  return state.tasks.filter(t => {
    if (t.status === 'done' || t.status === 'skipped' || !t.due_date) return false;
    const due = new Date(t.due_date);
    if (t.due_time) {
      const [h, m] = t.due_time.split(':');
      due.setHours(parseInt(h), parseInt(m));
    } else {
      due.setHours(23, 59, 59);
    }
    return due < now;
  });
}

export function getTasksByDate(dateStr) {
  const state = getState();
  return state.tasks.filter(t => t.due_date === dateStr);
}
