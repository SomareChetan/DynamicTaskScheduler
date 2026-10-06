'use client';
// ═══════════════════════════════════════════════════════════════
// useAIEngine — React Hook orchestrating all 4 AI engines
// ═══════════════════════════════════════════════════════════════
// Manages: NLP parsing, decomposition, optimization, learning
// Handles: Ripple effect, XAI reasoning, velocity correction

import { useState, useCallback } from 'react';
import {
  buildParserPrompt, localParse,
  buildDecompositionPrompt, localDecompose,
  optimizeTimeline, calculateRippleEffect,
  applyVelocityCorrection, recordCompletion,
  getVelocityCoefficients,
} from './ai-engines';
import { generateId } from './ai-pipeline';

export default function useAIEngine() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [usingLLM, setUsingLLM] = useState(null); // null = unknown, true = LLM, false = local

  // ── Call the server-side API route ──
  const callAI = useCallback(async (action, prompt) => {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, prompt }),
      });

      const result = await response.json();

      // Successful LLM response
      if (response.ok && result.success) {
        setUsingLLM(true);
        console.log(`[AI Engine] LLM responded successfully for action="${action}"`);
        return { success: true, data: result.data };
      }

      // API returned an error — log it clearly so the user knows why it fell back
      const errorType = result.error || 'UNKNOWN';
      const errorMsg = result.message || `API returned status ${response.status}`;
      console.warn(`[AI Engine] LLM unavailable (${errorType}): ${errorMsg}`);

      setUsingLLM(false);
      setError(errorMsg);
      return { fallback: true, error: errorType, message: errorMsg };
    } catch (err) {
      console.error('[AI Engine] Network/fetch error:', err.message);
      setUsingLLM(false);
      setError(err.message);
      return { fallback: true, error: 'NETWORK_ERROR', message: err.message };
    }
  }, []);

  // ═══════════════════════════════════════════════════════════
  // ENGINE 1: Parse natural language input
  // ═══════════════════════════════════════════════════════════
  const parseInput = useCallback(async (input) => {
    setLoading(true);
    setError(null);
    setLastAction('parse');

    try {
      // Try LLM first
      const prompt = buildParserPrompt(input);
      const result = await callAI('parse', prompt);

      if (result.success && result.data) {
        setLoading(false);
        return { source: 'llm', data: result.data };
      }

      // Fallback to local parser
      const local = localParse(input);
      setLoading(false);
      return { source: 'local', data: local };
    } catch (err) {
      setError(err.message);
      setLoading(false);
      // Always return something
      return { source: 'local', data: localParse(input) };
    }
  }, [callAI]);

  // ═══════════════════════════════════════════════════════════
  // ENGINE 2: Decompose complex objective into subtasks
  // ═══════════════════════════════════════════════════════════
  const decomposeGoal = useCallback(async (parsedTask) => {
    setLoading(true);
    setError(null);
    setLastAction('decompose');

    try {
      // Try LLM
      const prompt = buildDecompositionPrompt(parsedTask);
      const result = await callAI('decompose', prompt);

      let subtasks;
      if (result.success && Array.isArray(result.data)) {
        subtasks = result.data;
      } else {
        // Fallback to local decomposition
        subtasks = localDecompose(parsedTask);
      }

      // Post-process: assign IDs, map dependencies, apply velocity correction
      const goalId = generateId();
      const idMap = {}; // index → generated ID

      const processed = subtasks.map((st, index) => {
        const id = generateId();
        idMap[index] = id;

        // Apply velocity correction
        const { adjusted, coefficient, note } = applyVelocityCorrection(
          st.category || parsedTask.category || 'general',
          st.duration_minutes || 45
        );

        // Calculate due date from day field or day_offset
        let dueDate;
        if (st.day) {
          dueDate = new Date(st.day);
        } else {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (st.day_offset || 0));
        }

        // Map priority — handle float (0.0-1.0 from Aether Logic Core) and int (1-5 legacy)
        const rawP = st.priority;
        let priorityStr;
        if (typeof rawP === 'number' && rawP <= 1) {
          priorityStr = rawP >= 0.7 ? 'high' : rawP >= 0.4 ? 'medium' : 'low';
        } else {
          priorityStr = rawP <= 2 ? 'high' : rawP <= 3 ? 'medium' : 'low';
        }

        // Map type field (Theory/Practice) to task_type
        let taskType = 'DEEP_WORK';
        if (st.type === 'Practice') {
          taskType = 'SHALLOW_WORK';
        } else if (st.type === 'Theory') {
          taskType = 'DEEP_WORK';
        } else if (st.energy_requirement === 'Low') {
          taskType = 'SHALLOW_WORK';
        }

        return {
          id,
          task_name: st.title,
          description: st.description || '',
          task_type: taskType,
          status: 'pending',
          priority: priorityStr,
          priority_numeric: st.priority || 3,
          category: st.category || parsedTask.category || 'general',
          estimated_duration_minutes: st.duration_minutes || 45,
          adjusted_duration: adjusted,
          velocity_note: note,
          velocity_coefficient: coefficient,
          due_date: dueDate.toISOString().split('T')[0],
          due_time: st.due_time || null,
          scheduled_start: st.scheduled_start || null,
          scheduled_end: st.scheduled_end || null,
          deadline: parsedTask.deadline || null,
          urgency_score: typeof rawP === 'number' && rawP <= 1 ? rawP : Math.min(1, (6 - (rawP || 3)) / 5),
          is_critical: st.is_critical || false,
          ai_logic: st.ai_logic || null,
          task_subtype: st.type || null, // Theory / Practice from Aether Logic Core
          stress_detected: false,
          tags: st.tags || parsedTask.tags || [],
          reminder: '30min',
          raw_input: parsedTask.title,
          created_at: new Date().toISOString(),
          completed_at: null,
          // Hierarchy & dependency fields
          parent_id: goalId,
          dependency_id: st.dependency_index >= 0 ? idMap[st.dependency_index] || null : null,
          dependency_index: st.dependency_index,
          subtask_order: index,
          energy_requirement: st.energy_requirement || 'High',
          day_offset: st.day_offset || 0,
          day: st.day || dueDate.toISOString().split('T')[0],
        };
      });

      // Second pass: resolve any dependency IDs that weren't yet assigned
      processed.forEach((task, index) => {
        if (task.dependency_index >= 0 && !task.dependency_id) {
          task.dependency_id = idMap[task.dependency_index] || null;
        }
      });

      const goal = {
        id: goalId,
        task_name: parsedTask.title,
        description: parsedTask.description || `Complex objective decomposed into ${processed.length} subtasks`,
        task_type: 'DEEP_WORK',
        status: 'pending',
        priority: parsedTask.priority <= 2 ? 'high' : parsedTask.priority <= 3 ? 'medium' : 'low',
        category: parsedTask.category || 'general',
        estimated_duration_minutes: parsedTask.duration_minutes || subtasks.reduce((sum, s) => sum + (s.duration_minutes || 45), 0),
        due_date: parsedTask.deadline ? new Date(parsedTask.deadline).toISOString().split('T')[0] : null,
        deadline: parsedTask.deadline || null,
        urgency_score: parsedTask.urgency_score || 0.5,
        tags: parsedTask.tags || [],
        reminder: '1hour',
        created_at: new Date().toISOString(),
        completed_at: null,
        // Goal-specific fields
        is_goal: true,
        subtask_count: processed.length,
        subtask_ids: processed.map(p => p.id),
      };

      setLoading(false);
      return {
        source: result.success ? 'llm' : 'local',
        goal,
        subtasks: processed,
      };
    } catch (err) {
      setError(err.message);
      setLoading(false);

      // Emergency fallback
      const subtasks = localDecompose(parsedTask);
      const goalId = generateId();
      const processed = subtasks.map((st, i) => ({
        id: generateId(),
        task_name: st.title,
        description: st.description || '',
        task_type: st.type === 'Practice' ? 'SHALLOW_WORK' : 'DEEP_WORK',
        status: 'pending',
        priority: 'medium',
        category: parsedTask.category || 'general',
        estimated_duration_minutes: st.duration_minutes || 45,
        adjusted_duration: st.duration_minutes || 45,
        due_date: st.day || new Date(Date.now() + (st.day_offset || 0) * 86400000).toISOString().split('T')[0],
        due_time: st.due_time || null,
        scheduled_start: st.scheduled_start || null,
        scheduled_end: st.scheduled_end || null,
        task_subtype: st.type || null,
        tags: parsedTask.tags || [],
        reminder: '30min',
        created_at: new Date().toISOString(),
        parent_id: goalId,
        dependency_id: null,
        subtask_order: i,
        energy_requirement: st.energy_requirement || 'High',
        day_offset: st.day_offset || 0,
        day: st.day || new Date(Date.now() + (st.day_offset || 0) * 86400000).toISOString().split('T')[0],
      }));

      return { source: 'local', goal: { id: goalId, task_name: parsedTask.title, is_goal: true, subtask_count: processed.length, subtask_ids: processed.map(p => p.id) }, subtasks: processed };
    }
  }, [callAI]);

  // ═══════════════════════════════════════════════════════════
  // ENGINE 3: Optimize timeline placement
  // ═══════════════════════════════════════════════════════════
  const optimizeSchedule = useCallback((tasks, wakeHour = 7, sleepHour = 23, existingSlots = []) => {
    return optimizeTimeline(tasks, wakeHour, sleepHour, existingSlots);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // ENGINE 4: Record feedback & update velocity
  // ═══════════════════════════════════════════════════════════
  const recordTaskCompletion = useCallback((category, scheduledMinutes, actualMinutes) => {
    return recordCompletion(category, scheduledMinutes, actualMinutes);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // RIPPLE EFFECT: Recalculate dependent tasks
  // ═══════════════════════════════════════════════════════════
  const applyRippleEffect = useCallback((tasks, movedTaskId, newStart, newEnd) => {
    return calculateRippleEffect(tasks, movedTaskId, newStart, newEnd);
  }, []);

  return {
    // State
    loading,
    error,
    lastAction,
    usingLLM,

    // Engine methods
    parseInput,
    decomposeGoal,
    optimizeSchedule,
    recordTaskCompletion,
    applyRippleEffect,

    // Utilities
    getVelocityCoefficients,
    applyVelocityCorrection,
  };
}
