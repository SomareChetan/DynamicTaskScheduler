'use client';
import { useState } from 'react';
import { getCompletedTasks } from '@/lib/task-store';

export default function VaultView({ state }) {
  const [filter, setFilter] = useState('all'); // 'all', 'done', 'skipped'
  const [searchQuery, setSearchQuery] = useState('');

  const completed = state.tasks.filter(t => t.status === 'done').sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  const skipped = state.tasks.filter(t => t.status === 'skipped');
  const allArchived = [...completed, ...skipped].sort((a, b) => new Date(b.completed_at || b.skipped_at || 0) - new Date(a.completed_at || a.skipped_at || 0));

  const typeColors = { DEEP_WORK: 'var(--deep-work)', SHALLOW_WORK: 'var(--shallow-work)', FIXED_EVENT: 'var(--fixed-event)' };

  const filterTasks = (tasks) => {
    let filtered = tasks;
    if (filter === 'done') filtered = filtered.filter(t => t.status === 'done');
    if (filter === 'skipped') filtered = filtered.filter(t => t.status === 'skipped');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => t.task_name?.toLowerCase().includes(q) || t.tags?.some(tag => tag.includes(q)));
    }
    return filtered;
  };

  // Group by date
  const grouped = {};
  filterTasks(allArchived).forEach(t => {
    const dateVal = t.completed_at || t.skipped_at;
    const date = dateVal ? new Date(dateVal).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Unknown';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(t);
  });

  const totalMinutes = completed.reduce((s, t) => s + (t.actual_duration || t.adjusted_duration || t.estimated_duration_minutes || 0), 0);
  const deepCount = completed.filter(t => t.task_type === 'DEEP_WORK').length;
  const avgDuration = completed.length > 0 ? Math.round(totalMinutes / completed.length) : 0;

  const filters = [
    { id: 'all', label: 'All', count: allArchived.length },
    { id: 'done', label: 'Completed', count: completed.length },
    { id: 'skipped', label: 'Skipped', count: skipped.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 className="headline-lg">Vault</h2>
        <p className="body-md text-muted" style={{ marginTop: 4 }}>Archive of completed and skipped tasks with performance metrics.</p>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
          <div className="label-md text-muted" style={{ marginBottom: 8 }}>COMPLETED</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--tertiary)' }}>{completed.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
          <div className="label-md text-muted" style={{ marginBottom: 8 }}>TOTAL TIME</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)' }}>{(totalMinutes / 60).toFixed(1)}h</div>
        </div>
        <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
          <div className="label-md text-muted" style={{ marginBottom: 8 }}>DEEP WORK</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--deep-work)' }}>{deepCount}</div>
        </div>
        <div className="glass-panel" style={{ padding: '18px', textAlign: 'center' }}>
          <div className="label-md text-muted" style={{ marginBottom: 8 }}>AVG DURATION</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--shallow-work)' }}>{avgDuration}m</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(44,44,44,0.35)', borderRadius: 'var(--radius-lg)', padding: 3 }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
              background: filter === f.id ? 'rgba(204,151,255,0.12)' : 'transparent',
              color: filter === f.id ? 'var(--primary)' : 'var(--on-surface-variant)',
              fontFamily: 'var(--font)', fontSize: '0.75rem', fontWeight: filter === f.id ? 600 : 400,
              transition: 'all 0.2s',
            }}>
              {f.label} <span style={{ opacity: 0.5, marginLeft: 4 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks or tags..."
            className="input-field"
            style={{ padding: '7px 12px', fontSize: '0.75rem' }}
          />
        </div>
      </div>

      {/* Task List */}
      {Object.keys(grouped).length > 0 ? (
        Object.entries(grouped).map(([date, tasks]) => (
          <div key={date}>
            <div className="label-md text-muted" style={{ marginBottom: 8, marginTop: 4 }}>{date}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tasks.map(t => (
                <div key={t.id} className="glass-panel-elevated" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: t.status === 'skipped' ? 0.55 : 1 }}>
                  <span className="material-icons-outlined" style={{ fontSize: 18, color: t.status === 'done' ? 'var(--tertiary)' : 'var(--on-surface-variant)' }}>
                    {t.status === 'done' ? 'check_circle' : 'skip_next'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="body-md" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.task_name}</div>
                    <div className="body-sm text-muted">
                      {t.actual_duration || t.adjusted_duration || t.estimated_duration_minutes} min
                      {t.tags?.length > 0 && <> · {t.tags.map(tag => `#${tag}`).join(' ')}</>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.625rem', color: typeColors[t.task_type], fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{t.task_type?.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--on-surface-variant)', opacity: 0.2, marginBottom: 12, display: 'block' }}>
            {searchQuery ? 'search_off' : 'inventory_2'}
          </span>
          <p className="body-md text-muted">
            {searchQuery ? `No tasks matching "${searchQuery}"` : 'No completed tasks yet. Complete tasks from your schedule to see them here.'}
          </p>
        </div>
      )}
    </div>
  );
}
