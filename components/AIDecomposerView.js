'use client';
import { useState } from 'react';
import { addTask, toggleTaskComplete, deleteTask, editTask } from '@/lib/task-store';
import useAIEngine from '@/lib/useAIEngine';
import TaskFormModal from './TaskFormModal';

const priorityColors = { high: 'var(--error)', medium: 'var(--shallow-work)', low: 'var(--tertiary)' };
const typeColors = { DEEP_WORK: 'var(--deep-work)', SHALLOW_WORK: 'var(--shallow-work)', FIXED_EVENT: 'var(--fixed-event)' };

function GoalCard({ goal, allTasks, onToggle, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const subtasks = allTasks.filter(t => t.parent_id === goal.id).sort((a, b) => (a.subtask_order || 0) - (b.subtask_order || 0));
  const completed = subtasks.filter(t => t.status === 'done').length;
  const progress = subtasks.length > 0 ? Math.round((completed / subtasks.length) * 100) : 0;
  const totalMin = subtasks.reduce((s, t) => s + (t.estimated_duration_minutes || 0), 0);
  return (
    <div className="glass-panel animate-fade-in" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: progress === 100 ? 'rgba(101,253,230,0.15)' : 'linear-gradient(135deg,rgba(204,151,255,0.15),rgba(156,72,234,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-icons-outlined" style={{ fontSize: 20, color: progress === 100 ? 'var(--tertiary)' : 'var(--primary)' }}>{progress === 100 ? 'check_circle' : 'flag'}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{goal.task_name}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="body-sm text-muted">{subtasks.length} subtasks</span>
              <span className="body-sm text-muted">{Math.round(totalMin / 60 * 10) / 10}h</span>
              <span className="body-sm" style={{ color: priorityColors[goal.priority] || 'var(--shallow-work)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.5625rem' }}>{goal.priority || 'medium'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: progress === 100 ? 'var(--tertiary)' : 'var(--primary)' }}>{progress}%</div>
          </div>
          <span className="material-icons-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : '' }}>expand_more</span>
        </div>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 14 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? 'var(--tertiary)' : 'linear-gradient(90deg,var(--primary-dim),var(--primary))', borderRadius: 2, transition: 'width 0.5s ease' }} />
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 20px 18px', borderTop: '0.5px solid rgba(73,72,71,0.1)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subtasks.map(task => {
            const depTask = task.dependency_id ? subtasks.find(s => s.id === task.dependency_id) : null;
            const isBlocked = depTask && depTask.status !== 'done';
            return (
              <div key={task.id} className="glass-panel-elevated" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, opacity: task.status === 'done' ? 0.5 : isBlocked ? 0.4 : 1, borderLeft: `2px solid ${typeColors[task.task_type] || 'var(--outline)'}` }}>
                <button onClick={() => !isBlocked && onToggle(task.id)} disabled={isBlocked} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${task.status === 'done' ? 'var(--tertiary)' : priorityColors[task.priority] || 'var(--outline)'}`, background: task.status === 'done' ? 'var(--tertiary)' : 'transparent', cursor: isBlocked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {task.status === 'done' && <span className="material-icons-outlined" style={{ fontSize: 12, color: '#000' }}>check</span>}
                </button>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onEdit(task)}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.task_name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span className="body-sm text-muted" style={{ fontSize: '0.5625rem' }}>{task.estimated_duration_minutes}m</span>
                    {task.due_time && <span className="body-sm text-muted" style={{ fontSize: '0.5625rem' }}>{task.due_time}</span>}
                    {isBlocked && <span style={{ fontSize: '0.5rem', color: 'var(--on-surface-variant)' }}>🔒 Blocked</span>}
                  </div>
                </div>
                <button className="btn-icon" onClick={() => onDelete(task.id)} style={{ opacity: 0.3 }}>
                  <span className="material-icons-outlined" style={{ fontSize: 14, color: 'var(--error)' }}>close</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AIDecomposerView({ state, showToast }) {
  const { parseInput, decomposeGoal, loading, error, usingLLM } = useAIEngine();
  const [mode, setMode] = useState('simple'); // 'simple' | 'complex'
  const [simpleInput, setSimpleInput] = useState('');
  const [complexInput, setComplexInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [decomposedResult, setDecomposedResult] = useState(null);
  const [editModal, setEditModal] = useState(null);

  const goals = state.tasks.filter(t => t.is_goal);

  // ── Simple Task: parse and add directly ──
  const handleSimpleAdd = async () => {
    if (!simpleInput.trim()) return;
    setProcessing(true);
    const parseResult = await parseInput(simpleInput);
    const parsed = parseResult.data;
    
    // Convert parsed priority
    let priorityStr = 'medium';
    if (parsed.priority) {
      if (typeof parsed.priority === 'number') {
        if (parsed.priority <= 1) {
          priorityStr = parsed.priority >= 0.7 ? 'high' : parsed.priority >= 0.4 ? 'medium' : 'low';
        } else {
          priorityStr = parsed.priority <= 2 ? 'high' : parsed.priority <= 3 ? 'medium' : 'low';
        }
      } else if (typeof parsed.priority === 'string') {
        priorityStr = parsed.priority.toLowerCase();
      }
    }

    const taskData = {
      task_name: parsed.title || simpleInput.trim(),
      description: parsed.description || '',
      task_type: parsed.task_type || (parsed.energy_requirement === 'High' ? 'DEEP_WORK' : 'SHALLOW_WORK'),
      priority: priorityStr,
      category: parsed.category || 'general',
      estimated_duration_minutes: parsed.duration_minutes || 60,
      due_date: parsed.deadline ? new Date(parsed.deadline).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      due_time: parsed.due_time || (parsed.deadline ? new Date(parsed.deadline).toTimeString().slice(0, 5) : null),
      deadline: parsed.deadline || null,
      urgency_score: parsed.urgency_score || 0.5,
      tags: parsed.tags || [],
      reminder: '30min',
      raw_input: simpleInput,
    };
    
    // Add to task store
    addTask(taskData);
    showToast?.(`"${taskData.task_name}" added to tasks`, 'add_task');
    setSimpleInput('');
    setProcessing(false);
  };

  // ── Complex Goal: decompose into subtasks ──
  const handleComplexDecompose = async () => {
    if (!complexInput.trim()) return;
    setProcessing(true);
    setDecomposedResult(null);
    const parseResult = await parseInput(complexInput);
    const parsed = parseResult.data;
    // Force complex
    parsed.is_complex_objective = true;
    const result = await decomposeGoal(parsed);
    setDecomposedResult(result);
    setProcessing(false);
  };

  const handleAcceptAll = () => {
    if (!decomposedResult) return;
    const g = decomposedResult.goal;
    addTask({ ...g, is_goal: true, status: 'pending', task_type: 'DEEP_WORK', tags: g.tags || [] });
    decomposedResult.subtasks.forEach(st => addTask({ ...st, parent_id: g.id }));
    showToast?.(`"${g.task_name}" → ${decomposedResult.subtasks.length} subtasks added`, 'auto_awesome');
    setComplexInput('');
    setDecomposedResult(null);
  };

  const handleToggle = (id) => { const t = state.tasks.find(x => x.id === id); toggleTaskComplete(id); showToast?.(t?.status === 'done' ? 'Reopened' : 'Completed', t?.status === 'done' ? 'undo' : 'check_circle'); };
  const handleDelete = (id) => { deleteTask(id); showToast?.('Removed', 'delete'); };
  const handleEditSave = (d) => { if (editModal?.id) { editTask(editModal.id, d); showToast?.('Updated', 'edit'); } setEditModal(null); };

  const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':'); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`; };

  const simpleExamples = ['Reply to professor email at 3pm', 'Gym workout at 6pm', 'Buy groceries', 'Call dentist at 3pm tomorrow'];
  const complexExamples = ['Study for OS exam by Friday', 'Build a portfolio website', 'Prepare for ML final — 3 days', 'Write research paper on NLP'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h2 className="headline-lg" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>auto_awesome</span>
          AI Decomposer
        </h2>
        <p className="body-md text-muted" style={{ marginTop: 4 }}>Add a quick task or decompose a complex goal into a time-stamped roadmap.</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: usingLLM === true ? 'var(--tertiary)' : usingLLM === false ? 'var(--shallow-work)' : 'var(--on-surface-variant)' }} />
          <span className="body-sm" style={{ color: usingLLM === true ? 'var(--tertiary)' : 'var(--on-surface-variant)' }}>
            {usingLLM === true ? 'Gemini LLM Active' : usingLLM === false ? 'Local AI Engine' : 'AI Engine Ready'}
          </span>
        </div>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-lg)', padding: 3, width: 'fit-content' }}>
        <button onClick={() => setMode('simple')} style={{
          padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: mode === 'simple' ? 'rgba(101,253,230,0.12)' : 'transparent',
          color: mode === 'simple' ? 'var(--tertiary)' : 'var(--on-surface-variant)',
          fontFamily: 'var(--font)', fontSize: '0.8125rem', fontWeight: mode === 'simple' ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
        }}>
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>bolt</span>
          Quick Task
        </button>
        <button onClick={() => setMode('complex')} style={{
          padding: '10px 24px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          background: mode === 'complex' ? 'rgba(204,151,255,0.12)' : 'transparent',
          color: mode === 'complex' ? 'var(--primary)' : 'var(--on-surface-variant)',
          fontFamily: 'var(--font)', fontSize: '0.8125rem', fontWeight: mode === 'complex' ? 600 : 400,
          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
        }}>
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>account_tree</span>
          Decompose Goal
        </button>
      </div>

      {/* ════════════ SIMPLE TASK MODE ════════════ */}
      {mode === 'simple' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 28 }}>
          <div className="label-md" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tertiary)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>bolt</span> QUICK ADD TASK
          </div>
          <p className="body-sm text-muted" style={{ marginBottom: 14 }}>
            Describe a simple task in natural language. The AI extracts the name, time, duration, and priority — then adds it to your task list instantly.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={simpleInput} onChange={e => setSimpleInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSimpleAdd(); }}
              placeholder='e.g., "Reply to email at 3pm" or "Gym at 6pm for 1 hour"'
              className="input-field" disabled={processing}
              style={{ flex: 1, fontSize: '0.9375rem', padding: '12px 14px' }}
            />
            <button className="btn btn-primary" onClick={handleSimpleAdd} disabled={!simpleInput.trim() || processing} style={{ minWidth: 120, whiteSpace: 'nowrap' }}>
              {processing ? <><span className="material-icons-outlined" style={{ fontSize: 16, animation: 'pulse 1s infinite' }}>hourglass_top</span> Adding...</>
                : <><span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span> Add Task</>}
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="body-sm text-muted">Try: </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {simpleExamples.map(ex => (
                <button key={ex} onClick={() => setSimpleInput(ex)} className="btn btn-outline" style={{ fontSize: '0.6875rem', padding: '4px 10px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: 10, color: 'var(--tertiary)' }}>bolt</span> {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════ COMPLEX GOAL MODE ════════════ */}
      {mode === 'complex' && !decomposedResult && (
        <div className="glass-panel animate-fade-in" style={{ padding: 28 }}>
          <div className="label-md" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>account_tree</span> DECOMPOSE COMPLEX GOAL
          </div>
          <p className="body-sm text-muted" style={{ marginBottom: 14 }}>
            Describe a big goal with a deadline and details. The AI breaks it into atomic subtasks (≤60 min each) with scheduled times, dependencies, and priority ordering.
          </p>
          <textarea value={complexInput} onChange={e => setComplexInput(e.target.value)}
            placeholder='e.g., "Study for OS exam by Friday — need to cover memory management, process scheduling, and file systems. About 8 hours total."'
            className="input-field" rows={4} disabled={processing}
            style={{ fontSize: '0.9375rem', lineHeight: 1.6, resize: 'vertical', marginBottom: 16 }}
          />
          <button className="btn btn-primary" onClick={handleComplexDecompose} disabled={!complexInput.trim() || processing} style={{ minWidth: 180 }}>
            {processing ? <><span className="material-icons-outlined" style={{ fontSize: 16, animation: 'pulse 1s infinite' }}>psychology</span> Decomposing...</>
              : <><span className="material-icons-outlined" style={{ fontSize: 16 }}>account_tree</span> Decompose Goal</>}
          </button>
          <div style={{ marginTop: 14 }}>
            <span className="body-sm text-muted">Try: </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {complexExamples.map(ex => (
                <button key={ex} onClick={() => setComplexInput(ex)} className="btn btn-outline" style={{ fontSize: '0.6875rem', padding: '4px 10px' }}>
                  <span className="material-icons-outlined" style={{ fontSize: 10, color: 'var(--primary)' }}>account_tree</span> {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Processing spinner */}
      {processing && (
        <div className="glass-panel animate-fade-in" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(204,151,255,0.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <span className="material-icons-outlined" style={{ fontSize: 28, color: 'var(--primary)', animation: 'pulse 1.5s infinite' }}>psychology</span>
          </div>
          <h3 className="headline-sm" style={{ marginBottom: 8 }}>{mode === 'simple' ? 'Parsing your task...' : 'Decomposing your goal...'}</h3>
          <p className="body-md text-muted">{mode === 'simple' ? 'Extracting name, time, and priority.' : 'Building a time-stamped roadmap with dependencies and scheduling.'}</p>
        </div>
      )}

      {/* ════════════ REVIEW DECOMPOSED RESULT ════════════ */}
      {decomposedResult && mode === 'complex' && (
        <div className="glass-panel animate-fade-in" style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>account_tree</span>
                {decomposedResult.goal.task_name}
              </h3>
              <p className="body-sm text-muted" style={{ marginTop: 4 }}>
                {decomposedResult.subtasks.length} subtasks · {Math.round(decomposedResult.subtasks.reduce((s, t) => s + t.estimated_duration_minutes, 0) / 60 * 10) / 10}h total
                {decomposedResult.source === 'llm' && <span style={{ marginLeft: 8, color: 'var(--tertiary)', fontWeight: 600 }}>⚡ Aether Logic Core</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-glass" onClick={() => setDecomposedResult(null)}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>restart_alt</span> Redo
              </button>
              <button className="btn btn-primary" onClick={handleAcceptAll}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>check</span> Accept & Add All
              </button>
            </div>
          </div>
          {/* Group by day using the day field */}
          {Array.from(new Set(decomposedResult.subtasks.map(s => s.day || new Date(Date.now() + (s.day_offset || 0) * 86400000).toISOString().split('T')[0]))).sort().map((dayStr, dayIdx) => {
            const dayTasks = decomposedResult.subtasks.filter(s => {
              const taskDay = s.day || new Date(Date.now() + (s.day_offset || 0) * 86400000).toISOString().split('T')[0];
              return taskDay === dayStr;
            });
            const dayDate = new Date(dayStr + 'T00:00:00');
            const dayTotalMin = dayTasks.reduce((s, t) => s + t.estimated_duration_minutes, 0);
            return (
              <div key={dayStr} style={{ marginBottom: 16 }}>
                <div className="label-md text-muted" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-icons-outlined" style={{ fontSize: 14 }}>calendar_today</span>
                  Day {dayIdx + 1} — {dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  <span style={{ marginLeft: 'auto', fontSize: '0.5625rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>{dayTasks.length} tasks</span>
                    <span>{Math.round(dayTotalMin / 60 * 10) / 10}h</span>
                    {dayTotalMin > 240 && <span style={{ color: 'var(--error)', fontWeight: 700 }}>⚠ OVER 4H LIMIT</span>}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayTasks.map((task, i) => {
                    const fmtScheduleTime = (isoStr) => {
                      if (!isoStr) return null;
                      try {
                        const parts = isoStr.split('T')[1];
                        if (!parts) return null;
                        const [h, m] = parts.split(':');
                        const hr = parseInt(h);
                        return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                      } catch { return null; }
                    };
                    const startFmt = fmtScheduleTime(task.scheduled_start);
                    const endFmt = fmtScheduleTime(task.scheduled_end);
                    const typeLabel = task.task_subtype || (task.task_type === 'DEEP_WORK' ? 'Theory' : 'Practice');
                    const typeColor = typeLabel === 'Theory' ? 'var(--deep-work)' : 'var(--shallow-work)';
                    return (
                      <div key={task.id} className="glass-panel-elevated" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `2px solid ${typeColors[task.task_type] || 'var(--outline)'}` }}>
                        <div style={{ width: 22, height: 22, borderRadius: 6, background: task.is_critical ? 'rgba(255,110,132,0.1)' : 'rgba(204,151,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: task.is_critical ? 'var(--error)' : 'var(--primary)', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {task.task_name}
                            {task.is_critical && <span style={{ fontSize: '0.5rem', color: 'var(--error)', fontWeight: 700, border: '1px solid rgba(255,110,132,0.3)', padding: '1px 4px', borderRadius: 3 }}>CRITICAL</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            {startFmt && endFmt && (
                              <span className="body-sm" style={{ fontSize: '0.5625rem', color: 'var(--tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <span className="material-icons-outlined" style={{ fontSize: 10 }}>schedule</span>
                                {startFmt} – {endFmt}
                              </span>
                            )}
                            <span className="body-sm text-muted" style={{ fontSize: '0.5625rem' }}>{task.estimated_duration_minutes}m</span>
                            <span style={{ fontSize: '0.5rem', color: typeColor, fontWeight: 600, background: `${typeColor}15`, padding: '1px 5px', borderRadius: 3 }}>{typeLabel}</span>
                            <span style={{ fontSize: '0.5rem', color: task.energy_requirement === 'High' ? 'var(--deep-work)' : 'var(--shallow-work)', fontWeight: 600 }}>{task.energy_requirement}</span>
                          </div>
                          {task.ai_logic && (
                            <div className="body-sm text-muted" style={{ fontSize: '0.5rem', marginTop: 3, fontStyle: 'italic', opacity: 0.7 }}>
                              💡 {task.ai_logic}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.5rem', color: priorityColors[task.priority], fontWeight: 700, textTransform: 'uppercase' }}>{task.priority}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-panel" style={{ padding: '14px 18px', borderLeft: '3px solid var(--error)', background: 'rgba(255,110,132,0.04)' }}>
          <div className="body-sm" style={{ color: 'var(--error)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14, verticalAlign: 'middle', marginRight: 6 }}>warning</span>
            {error} — Using local AI engine as fallback.
          </div>
        </div>
      )}

      {/* Existing Goals */}
      {goals.length > 0 && (
        <div>
          <h3 className="headline-sm" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--primary)', opacity: 0.7 }}>flag</span>
            Your Goals ({goals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {goals.map(goal => (
              <GoalCard key={goal.id} goal={goal} allTasks={state.tasks} onToggle={handleToggle} onEdit={setEditModal} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {editModal && <TaskFormModal task={editModal} onSave={handleEditSave} onClose={() => setEditModal(null)} />}
    </div>
  );
}
