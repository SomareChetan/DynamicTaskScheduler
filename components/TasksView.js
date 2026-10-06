'use client';
import { useState, useMemo } from 'react';
import { addTask, editTask, deleteTask, toggleTaskComplete, CATEGORIES, PRIORITIES } from '@/lib/task-store';
import TaskFormModal from './TaskFormModal';

const priorityColors = { high: 'var(--error)', medium: 'var(--shallow-work)', low: 'var(--tertiary)' };
const priorityIcons = { high: 'priority_high', medium: 'remove', low: 'arrow_downward' };
const typeColors = { DEEP_WORK: 'var(--deep-work)', SHALLOW_WORK: 'var(--shallow-work)', FIXED_EVENT: 'var(--fixed-event)' };
const CATEGORY_ICONS = { general: 'category', work: 'work', personal: 'person', academics: 'school', fitness: 'fitness_center', creative: 'brush' };

function TaskRow({ task, onEdit, onToggle, onDelete }) {
  const isOverdue = (() => {
    if (task.status === 'done' || !task.due_date) return false;
    const due = new Date(task.due_date);
    if (task.due_time) { const [h, m] = task.due_time.split(':'); due.setHours(parseInt(h), parseInt(m)); }
    else due.setHours(23, 59, 59);
    return due < new Date();
  })();

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="glass-panel-elevated" style={{
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      opacity: task.status === 'done' ? 0.55 : 1,
      transition: 'all 0.25s ease',
    }}>
      {/* Checkbox */}
      <button onClick={() => onToggle(task.id)} style={{
        width: 22, height: 22, borderRadius: 6, border: `2px solid ${task.status === 'done' ? 'var(--tertiary)' : priorityColors[task.priority] || 'var(--outline)'}`,
        background: task.status === 'done' ? 'var(--tertiary)' : 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s', flexShrink: 0,
      }}>
        {task.status === 'done' && <span className="material-icons-outlined" style={{ fontSize: 14, color: '#000' }}>check</span>}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onEdit(task)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontWeight: 600, fontSize: '0.875rem',
            textDecoration: task.status === 'done' ? 'line-through' : 'none',
            color: task.status === 'done' ? 'var(--on-surface-variant)' : 'var(--on-surface)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{task.task_name}</span>
          {isOverdue && <span style={{ fontSize: '0.5625rem', color: 'var(--error)', fontWeight: 700, letterSpacing: '0.06em' }}>OVERDUE</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Priority badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            color: priorityColors[task.priority], opacity: 0.8,
          }}>
            <span className="material-icons-outlined" style={{ fontSize: 10 }}>{priorityIcons[task.priority]}</span>
            {task.priority}
          </span>
          {/* Category */}
          <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span className="material-icons-outlined" style={{ fontSize: 10 }}>{CATEGORY_ICONS[task.category] || 'category'}</span>
            {task.category}
          </span>
          {/* Due date/time */}
          {task.due_date && (
            <span style={{ fontSize: '0.5625rem', color: isOverdue ? 'var(--error)' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="material-icons-outlined" style={{ fontSize: 10 }}>schedule</span>
              {formatDate(task.due_date)}{task.due_time ? ` ${formatTime(task.due_time)}` : ''}
            </span>
          )}
          {/* Duration */}
          <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)' }}>
            {task.estimated_duration_minutes}m
          </span>
          {/* Reminder icon */}
          {task.reminder && task.reminder !== 'none' && (
            <span className="material-icons-outlined" style={{ fontSize: 10, color: 'var(--shallow-work)', opacity: 0.6 }} title={`Reminder: ${task.reminder}`}>notifications_active</span>
          )}
        </div>
      </div>

      {/* Type indicator */}
      <div style={{ width: 4, height: 32, borderRadius: 2, background: typeColors[task.task_type] || 'var(--outline)', flexShrink: 0, opacity: 0.6 }} />

      {/* Delete */}
      <button className="btn-icon" onClick={() => onDelete(task.id)} title="Delete" style={{ opacity: 0.4 }}>
        <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--error)' }}>delete_outline</span>
      </button>
    </div>
  );
}

export default function TasksView({ state, showToast }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active', 'done'
  const [sortBy, setSortBy] = useState('priority'); // 'priority', 'date', 'name', 'created'
  const [formModal, setFormModal] = useState(null); // null | 'new' | task object
  const [deleteTarget, setDeleteTarget] = useState(null);

  const allTasks = state.tasks;

  const filteredTasks = useMemo(() => {
    let tasks = [...allTasks];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t =>
        t.task_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.includes(q)) ||
        t.category?.includes(q)
      );
    }

    // Filter priority
    if (filterPriority !== 'all') tasks = tasks.filter(t => t.priority === filterPriority);

    // Filter category
    if (filterCategory !== 'all') tasks = tasks.filter(t => t.category === filterCategory);

    // Filter status
    if (filterStatus === 'active') tasks = tasks.filter(t => t.status !== 'done' && t.status !== 'skipped');
    else if (filterStatus === 'done') tasks = tasks.filter(t => t.status === 'done');

    // Sort
    tasks.sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        const diff = (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
        if (diff !== 0) return diff;
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        const dateComp = a.due_date.localeCompare(b.due_date);
        if (dateComp !== 0) return dateComp;
        if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time);
        return 0;
      }
      if (sortBy === 'name') return (a.task_name || '').localeCompare(b.task_name || '');
      if (sortBy === 'created') return new Date(b.created_at) - new Date(a.created_at);
      return 0;
    });

    return tasks;
  }, [allTasks, searchQuery, filterPriority, filterCategory, filterStatus, sortBy]);

  const handleSaveTask = (formData) => {
    if (formModal && typeof formModal === 'object' && formModal.id) {
      editTask(formModal.id, formData);
      showToast?.(`"${formData.task_name}" updated`, 'edit');
    } else {
      addTask(formData);
      showToast?.(`"${formData.task_name}" created`, 'add_task');
    }
    setFormModal(null);
  };

  const handleToggle = (id) => {
    const task = state.tasks.find(t => t.id === id);
    toggleTaskComplete(id);
    showToast?.(task?.status === 'done' ? `"${task.task_name}" reopened` : `"${task?.task_name}" completed`, task?.status === 'done' ? 'undo' : 'check_circle');
  };

  const handleDelete = (id) => {
    const task = state.tasks.find(t => t.id === id);
    setDeleteTarget({ id, name: task?.task_name || 'Task' });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteTask(deleteTarget.id);
      showToast?.(`"${deleteTarget.name}" deleted`, 'delete');
      setDeleteTarget(null);
    }
  };

  const activeCount = allTasks.filter(t => t.status !== 'done' && t.status !== 'skipped').length;
  const doneCount = allTasks.filter(t => t.status === 'done').length;

  const usedCategories = [...new Set(allTasks.map(t => t.category).filter(Boolean))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="headline-lg">Tasks</h2>
          <p className="body-sm text-muted" style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{activeCount}</span> active · <span style={{ color: 'var(--tertiary)', fontWeight: 600 }}>{doneCount}</span> completed
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormModal('new')}>
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>
          New Task
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span className="material-icons-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--on-surface-variant)', opacity: 0.5 }}>search</span>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks, tags, categories..."
              className="input-field"
              style={{ paddingLeft: 34 }}
            />
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', padding: 2 }}>
            {[{ id: 'active', label: 'Active' }, { id: 'done', label: 'Done' }, { id: 'all', label: 'All' }].map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: filterStatus === f.id ? 'rgba(204,151,255,0.15)' : 'transparent',
                color: filterStatus === f.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                fontFamily: 'var(--font)', fontSize: '0.6875rem', fontWeight: filterStatus === f.id ? 600 : 400,
                transition: 'all 0.2s',
              }}>{f.label}</button>
            ))}
          </div>

          {/* Priority filter */}
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="input-field" style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '0.6875rem' }}>
            <option value="all">All Priorities</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>

          {/* Category filter */}
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input-field" style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '0.6875rem' }}>
            <option value="all">All Categories</option>
            {usedCategories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field" style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '0.6875rem' }}>
            <option value="priority">Sort: Priority</option>
            <option value="date">Sort: Due Date</option>
            <option value="name">Sort: Name</option>
            <option value="created">Sort: Newest</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredTasks.map(task => (
            <TaskRow key={task.id} task={task} onEdit={setFormModal} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--on-surface-variant)', opacity: 0.15, display: 'block', marginBottom: 12 }}>
            {searchQuery ? 'search_off' : 'task_alt'}
          </span>
          <p className="body-md text-muted" style={{ marginBottom: 16 }}>
            {searchQuery ? `No tasks matching "${searchQuery}"` : filterStatus === 'done' ? 'No completed tasks yet.' : 'No tasks yet. Create one to get started.'}
          </p>
          {!searchQuery && filterStatus !== 'done' && (
            <button className="btn btn-primary" onClick={() => setFormModal('new')}>
              <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>Create Your First Task
            </button>
          )}
        </div>
      )}

      {/* Task Form Modal */}
      {formModal && (
        <TaskFormModal
          task={typeof formModal === 'object' ? formModal : null}
          onSave={handleSaveTask}
          onClose={() => setFormModal(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span className="material-icons-outlined" style={{ color: 'var(--error)', fontSize: 24 }}>delete_forever</span>
              <h3 className="headline-sm">Delete Task</h3>
            </div>
            <p className="body-md text-muted" style={{ marginBottom: 24 }}>Remove <strong style={{ color: 'var(--on-surface)' }}>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-glass" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: 'var(--error)', color: '#fff' }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
