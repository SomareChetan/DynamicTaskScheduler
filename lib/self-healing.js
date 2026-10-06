import { addMinutes, differenceInMinutes, parseISO, isAfter } from 'date-fns';

// ── Function 1: resolveCollision (The Arbiter) ──
export function resolveCollision(schedule, tasks, taskA_slot, taskB_slot) {
  const taskA = tasks.find(t => t.id === taskA_slot.task_id) || {};
  const taskB = tasks.find(t => t.id === taskB_slot.task_id) || {};

  const getPriorityVal = p => p === 'high' ? 1 : p === 'medium' ? 0.5 : 0.1;
  
  const scoreA = (getPriorityVal(taskA.priority) * 0.7) + ((taskA.urgency_score || 0.5) * 0.3);
  const scoreB = (getPriorityVal(taskB.priority) * 0.7) + ((taskB.urgency_score || 0.5) * 0.3);

  const aFixed = taskA.task_type === 'FIXED_EVENT' || taskA.scheduled_start || taskA.due_time;
  const bFixed = taskB.task_type === 'FIXED_EVENT' || taskB.scheduled_start || taskB.due_time;

  let winner, loser;
  if (aFixed && !bFixed) {
    winner = taskA_slot; loser = taskB_slot;
  } else if (bFixed && !aFixed) {
    winner = taskB_slot; loser = taskA_slot;
  } else if (scoreA >= scoreB) {
    winner = taskA_slot; loser = taskB_slot;
  } else {
    winner = taskB_slot; loser = taskA_slot;
  }

  return { winner, loser, bothHigh: scoreA > 0.8 && scoreB > 0.8 };
}

// ── Function 2: triggerRipple (The Ripple Effect) ──
export function triggerRipple(schedule, tasks, anchorSlotId, timeDeltaMs) {
  let newSchedule = schedule.map(s => ({ ...s }));
  
  const anchorIndex = newSchedule.findIndex(s => s.slot_id === anchorSlotId);
  if (anchorIndex === -1 || timeDeltaMs === 0) return newSchedule;

  const anchorSlot = newSchedule[anchorIndex];
  const deltaMins = timeDeltaMs / 60000;
  
  anchorSlot.start_time = addMinutes(parseISO(anchorSlot.start_time), deltaMins).toISOString();
  anchorSlot.end_time = addMinutes(parseISO(anchorSlot.end_time), deltaMins).toISOString();

  // Recursive Dependency Shifting
  const shiftedTaskIds = new Set([anchorSlot.task_id]);
  let dependenciesShifted = true;
  
  while (dependenciesShifted) {
    dependenciesShifted = false;
    for (let slot of newSchedule) {
      if (shiftedTaskIds.has(slot.task_id)) continue;
      
      const taskObj = tasks.find(t => t.id === slot.task_id);
      if (taskObj && taskObj.dependency_ids && taskObj.dependency_ids.some(depId => shiftedTaskIds.has(depId))) {
        slot.start_time = addMinutes(parseISO(slot.start_time), deltaMins).toISOString();
        slot.end_time = addMinutes(parseISO(slot.end_time), deltaMins).toISOString();
        shiftedTaskIds.add(slot.task_id);
        dependenciesShifted = true;
      }
    }
  }

  // Physical Collision Resolution
  newSchedule.sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));

  for (let i = 0; i < newSchedule.length; i++) {
    for (let j = i + 1; j < newSchedule.length; j++) {
      const slotA = newSchedule[i];
      const slotB = newSchedule[j];
      
      if (isAfter(parseISO(slotA.end_time), parseISO(slotB.start_time))) {
        const { winner, loser } = resolveCollision(newSchedule, tasks, slotA, slotB);
        
        const overlapMins = differenceInMinutes(parseISO(winner.end_time), parseISO(loser.start_time));
        const shiftDeltaMins = overlapMins + 15; // 15 min buffer
        
        loser.start_time = addMinutes(parseISO(loser.start_time), shiftDeltaMins).toISOString();
        loser.end_time = addMinutes(parseISO(loser.end_time), shiftDeltaMins).toISOString();
      }
    }
  }

  return newSchedule.sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
}

// ── Function 3: optimizeGaps (The Vacuum Effect) ──
export function optimizeGaps(schedule, tasks) {
  let newSchedule = schedule.map(s => ({ ...s })).sort((a, b) => parseISO(a.start_time) - parseISO(b.start_time));
  
  for (let i = 0; i < newSchedule.length - 1; i++) {
    const current = newSchedule[i];
    const next = newSchedule[i + 1];
    
    const gapMins = differenceInMinutes(parseISO(next.start_time), parseISO(current.end_time));

    if (gapMins > 15) {
      const nextTask = tasks.find(t => t.id === next.task_id) || {};
      const isFixed = nextTask.task_type === 'FIXED_EVENT' || nextTask.due_time || nextTask.scheduled_start;
      
      if (!isFixed) {
        const pullDeltaMins = gapMins - 15;
        if (pullDeltaMins > 0) {
          next.start_time = addMinutes(parseISO(next.start_time), -pullDeltaMins).toISOString();
          next.end_time = addMinutes(parseISO(next.end_time), -pullDeltaMins).toISOString();
        }
      }
    }
  }
  
  return newSchedule;
}

export function applySelfHealing(schedule, tasks) {
  let healed = optimizeGaps(schedule, tasks);
  if (healed.length > 0) {
    healed = triggerRipple(healed, tasks, healed[0].slot_id, 0);
  }
  return healed;
}
