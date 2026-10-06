'use client';
import { useState, useEffect } from 'react';
import { CATEGORIES, PRIORITIES, REMINDERS } from '@/lib/task-store';
import { calculateAutoPriority } from '@/lib/ai-pipeline';

const TASK_TYPES = [
  { value: 'DEEP_WORK', label: 'Deep Work', icon: 'neurology', color: 'var(--deep-work)' },
  { value: 'SHALLOW_WORK', label: 'Shallow Work', icon: 'mail', color: 'var(--shallow-work)' },
  { value: 'FIXED_EVENT', label: 'Fixed Event', icon: 'event', color: 'var(--fixed-event)' },
];

const REPEAT_OPTIONS = [
  { value: 'none', label: 'No repeat', icon: 'block' },
  { value: 'daily', label: 'Daily', icon: 'today' },
  { value: 'every_2_days', label: 'Every 2 days', icon: 'date_range' },
  { value: 'every_3_days', label: 'Every 3 days', icon: 'date_range' },
  { value: 'weekdays', label: 'Weekdays (Mon–Fri)', icon: 'work' },
  { value: 'weekly', label: 'Weekly', icon: 'view_week' },
  { value: 'biweekly', label: 'Every 2 weeks', icon: 'event_repeat' },
  { value: 'monthly', label: 'Monthly', icon: 'calendar_month' },
  { value: 'custom', label: 'Custom days...', icon: 'tune' },
];

const CATEGORY_ICONS = {
  general: 'category', work: 'work', personal: 'person', academics: 'school', fitness: 'fitness_center', creative: 'brush',
};

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div className="label-md text-muted" style={{ marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);

export default function TaskFormModal({ task, onSave, onClose }) {
  const isEdit = task && typeof task === 'object';

  const getInitialForm = () => ({
    task_name: task?.task_name || '',
    description: task?.description || '',
    task_type: task?.task_type || 'SHALLOW_WORK',
    due_date: task?.due_date || '',
    due_time: task?.due_time || '',
    estimated_duration_minutes: task?.estimated_duration_minutes || 60,
    category: task?.category || 'general',
    tags: task?.tags ? [...task.tags] : [],
    reminder: task?.reminder || 'none',
    priority: task?.priority || '',
    urgency_score: task?.urgency_score || 0.5,
    repeat: task?.repeat || 'none',
    repeat_custom_days: task?.repeat_custom_days || 1,
    repeat_end_date: task?.repeat_end_date || '',
  });

  const [form, setForm] = useState(getInitialForm);
  const [tagInput, setTagInput] = useState('');
  const [autoP, setAutoP] = useState('medium');
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);

  useEffect(() => { setForm(getInitialForm()); }, [task]);

  useEffect(() => {
    const p = calculateAutoPriority({ ...form, due_date: form.due_date || null, due_time: form.due_time || null });
    setAutoP(p);
  }, [form.due_date, form.due_time, form.urgency_score, form.task_type]);

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const addTag = () => { const t = tagInput.trim().toLowerCase(); if (t && !form.tags.includes(t)) update('tags', [...form.tags, t]); setTagInput(''); };
  const removeTag = (tag) => update('tags', form.tags.filter(t => t !== tag));

  const handleSubmit = () => {
    if (!form.task_name.trim()) return;
    const finalPriority = form.priority || autoP;
    const payload = {
      ...(isEdit ? task : {}),
      task_name: form.task_name.trim(),
      description: form.description,
      task_type: form.task_type,
      due_date: form.due_date || null,
      due_time: form.due_time || null,
      estimated_duration_minutes: form.estimated_duration_minutes,
      category: form.category,
      tags: form.tags,
      reminder: form.reminder,
      priority: finalPriority,
      urgency_score: form.urgency_score,
      deadline: form.due_date ? new Date(form.due_date + (form.due_time ? 'T' + form.due_time : 'T23:59')).toISOString() : null,
      repeat: form.repeat,
      repeat_custom_days: form.repeat === 'custom' ? form.repeat_custom_days : null,
      repeat_end_date: form.repeat !== 'none' && form.repeat_end_date ? form.repeat_end_date : null,
    };
    onSave(payload);
  };

  const priorityColors = { high: 'var(--error)', medium: 'var(--shallow-work)', low: 'var(--tertiary)' };
  const repeatLabel = REPEAT_OPTIONS.find(r => r.value === form.repeat)?.label || 'No repeat';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>{isEdit ? 'edit' : 'add_circle'}</span>
            {isEdit ? 'Edit Task' : 'New Task'}
          </h3>
          <button className="btn-icon" onClick={onClose}><span className="material-icons-outlined">close</span></button>
        </div>

        {/* Task Name */}
        <Section title="TASK NAME">
          <input value={form.task_name} onChange={e => update('task_name', e.target.value)}
            placeholder="What needs to be done?" className="input-field"
            style={{ fontSize: '1rem', padding: '12px 14px', fontWeight: 500 }} autoFocus
          />
        </Section>

        {/* Description */}
        <Section title="DESCRIPTION">
          <textarea value={form.description} onChange={e => update('description', e.target.value)}
            placeholder="Add details, notes, or context..." className="input-field" rows={3}
            style={{ resize: 'vertical', lineHeight: 1.5 }}
          />
        </Section>

        {/* Date & Time Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <div className="label-md text-muted" style={{ marginBottom: 8 }}>DUE DATE</div>
            <input type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)}
              className="input-field" style={{ colorScheme: 'dark' }}
            />
          </div>
          <div>
            <div className="label-md text-muted" style={{ marginBottom: 8 }}>DUE TIME</div>
            <input type="time" value={form.due_time} onChange={e => update('due_time', e.target.value)}
              className="input-field" style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Duration & Reminder Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <div className="label-md text-muted" style={{ marginBottom: 8 }}>DURATION</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={form.estimated_duration_minutes}
                onChange={e => update('estimated_duration_minutes', Math.max(5, parseInt(e.target.value) || 0))}
                className="input-field" min="5" step="5" style={{ width: 80, textAlign: 'center' }}
              />
              <span className="body-sm text-muted">minutes</span>
            </div>
          </div>
          <div>
            <div className="label-md text-muted" style={{ marginBottom: 8 }}>REMINDER</div>
            <select
              value={form.reminder}
              onChange={e => update('reminder', e.target.value)}
              className="input-field"
            >
              {REMINDERS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Repeat / Recurrence ── */}
        <Section title="REPEAT">
          <div style={{ position: 'relative' }}>
            <button
              className="input-field"
              onClick={() => setShowRepeatMenu(!showRepeatMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: 16, color: form.repeat !== 'none' ? 'var(--primary)' : 'var(--on-surface-variant)' }}>
                {REPEAT_OPTIONS.find(r => r.value === form.repeat)?.icon || 'block'}
              </span>
              <span style={{ flex: 1 }}>{repeatLabel}</span>
              {form.repeat !== 'none' && (
                <span style={{ fontSize: '0.5625rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase' }}>Active</span>
              )}
              <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--on-surface-variant)', transition: 'transform 0.2s', transform: showRepeatMenu ? 'rotate(180deg)' : 'rotate(0)' }}>expand_more</span>
            </button>

            {showRepeatMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
                background: 'rgba(26,25,25,0.95)', backdropFilter: 'blur(24px)',
                border: '0.5px solid rgba(73,72,71,0.25)', borderRadius: 'var(--radius-lg)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)', overflow: 'hidden',
                animation: 'fadeIn 0.15s ease',
              }}>
                {REPEAT_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => { update('repeat', opt.value); setShowRepeatMenu(false); }}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: form.repeat === opt.value ? 'rgba(204,151,255,0.1)' : 'transparent',
                      color: form.repeat === opt.value ? 'var(--primary)' : 'var(--on-surface)',
                      fontFamily: 'var(--font)', fontSize: '0.8125rem', fontWeight: form.repeat === opt.value ? 600 : 400,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.target.style.background = form.repeat === opt.value ? 'rgba(204,151,255,0.15)' : 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.target.style.background = form.repeat === opt.value ? 'rgba(204,151,255,0.1)' : 'transparent'}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: 16, opacity: 0.7 }}>{opt.icon}</span>
                    {opt.label}
                    {form.repeat === opt.value && <span className="material-icons-outlined" style={{ fontSize: 14, marginLeft: 'auto', color: 'var(--primary)' }}>check</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom interval input */}
          {form.repeat === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <span className="body-sm text-muted">Every</span>
              <input type="number" value={form.repeat_custom_days}
                onChange={e => update('repeat_custom_days', Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field" min="1" style={{ width: 60, textAlign: 'center' }}
              />
              <span className="body-sm text-muted">days</span>
            </div>
          )}

          {/* Repeat end date */}
          {form.repeat !== 'none' && (
            <div style={{ marginTop: 10 }}>
              <div className="body-sm text-muted" style={{ marginBottom: 4 }}>Repeat until (optional)</div>
              <input type="date" value={form.repeat_end_date}
                onChange={e => update('repeat_end_date', e.target.value)}
                className="input-field" style={{ colorScheme: 'dark', maxWidth: 200 }}
              />
            </div>
          )}
        </Section>

        {/* Task Type */}
        <Section title="TASK TYPE">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {TASK_TYPES.map(tt => (
              <button key={tt.value} onClick={() => update('task_type', tt.value)} style={{
                padding: '10px 12px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: form.task_type === tt.value ? `${tt.color}18` : 'rgba(255,255,255,0.03)',
                color: form.task_type === tt.value ? tt.color : 'var(--on-surface-variant)',
                fontFamily: 'var(--font)', fontSize: '0.75rem', fontWeight: form.task_type === tt.value ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                outline: form.task_type === tt.value ? `1px solid ${tt.color}40` : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>{tt.icon}</span>
                {tt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Priority */}
        <Section title="PRIORITY">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {PRIORITIES.map(p => (
              <button key={p} onClick={() => update('priority', form.priority === p ? '' : p)} style={{
                padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: form.priority === p ? `${priorityColors[p]}18` : 'rgba(255,255,255,0.03)',
                color: form.priority === p ? priorityColors[p] : 'var(--on-surface-variant)',
                fontFamily: 'var(--font)', fontSize: '0.75rem', fontWeight: form.priority === p ? 600 : 400,
                outline: form.priority === p ? `1px solid ${priorityColors[p]}40` : '1px solid transparent',
                transition: 'all 0.2s', textTransform: 'capitalize',
              }}>{p}</button>
            ))}
            <span className="body-sm text-muted" style={{ marginLeft: 8 }}>
              {!form.priority && <>AI suggests: <span style={{ color: priorityColors[autoP], fontWeight: 600, textTransform: 'capitalize' }}>{autoP}</span></>}
            </span>
          </div>
        </Section>

        {/* Category */}
        <Section title="CATEGORY">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => update('category', cat)} style={{
                padding: '7px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                background: form.category === cat ? 'rgba(204,151,255,0.12)' : 'rgba(255,255,255,0.03)',
                color: form.category === cat ? 'var(--primary)' : 'var(--on-surface-variant)',
                fontFamily: 'var(--font)', fontSize: '0.6875rem', fontWeight: form.category === cat ? 600 : 400,
                display: 'flex', alignItems: 'center', gap: 5,
                outline: form.category === cat ? '1px solid rgba(204,151,255,0.25)' : '1px solid transparent',
                transition: 'all 0.2s', textTransform: 'capitalize',
              }}>
                <span className="material-icons-outlined" style={{ fontSize: 14 }}>{CATEGORY_ICONS[cat] || 'category'}</span>
                {cat}
              </button>
            ))}
          </div>
        </Section>

        {/* Tags */}
        <Section title="TAGS">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add a tag..." className="input-field" style={{ flex: 1 }}
            />
            <button className="btn btn-glass" onClick={addTag} style={{ padding: '8px 12px', fontSize: '0.75rem' }}>Add</button>
          </div>
          {form.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {form.tags.map(tag => (
                <span key={tag} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(204,151,255,0.08)', color: 'var(--primary)',
                  fontSize: '0.6875rem', fontWeight: 500,
                }}>
                  #{tag}
                  <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: 0, display: 'flex' }}>
                    <span className="material-icons-outlined" style={{ fontSize: 12 }}>close</span>
                  </button>
                </span>
              ))}
            </div>
          )}
        </Section>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-glass" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.task_name.trim()} style={{ flex: 2 }}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>{isEdit ? 'save' : 'add'}</span>
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
