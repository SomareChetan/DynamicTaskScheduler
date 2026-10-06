'use client';
import { useState } from 'react';
import { updatePreferences, getState } from '@/lib/task-store';

const DEFAULT_AUTOMATIONS = [
  {
    id: 'deep-work-shield',
    name: 'Deep Work Shield',
    description: 'Automatically protect focus blocks ≥90 min. Merges adjacent free slots and activates DND mode.',
    icon: 'shield',
    color: 'var(--deep-work)',
    enabled: true,
    category: 'focus',
  },
  {
    id: 'auto-breaks',
    name: 'Smart Breaks',
    description: 'Insert recovery breaks between tasks based on cognitive load. Adjusted by task type transition.',
    icon: 'coffee',
    color: 'var(--tertiary)',
    enabled: true,
    category: 'wellness',
  },
  {
    id: 'duration-correction',
    name: 'Duration Correction',
    description: 'Learn from your completion history to silently adjust overly optimistic time estimates.',
    icon: 'timer',
    color: 'var(--shallow-work)',
    enabled: true,
    category: 'ai',
  },
  {
    id: 'conflict-resolver',
    name: 'Conflict Auto-Resolve',
    description: 'When scheduling conflicts arise, automatically apply Compress → Ripple → Eject resolution strategy.',
    icon: 'auto_fix_high',
    color: 'var(--primary)',
    enabled: true,
    category: 'scheduling',
  },
  {
    id: 'energy-routing',
    name: 'Energy-Aware Routing',
    description: 'Route deep work to peak chronotype hours and shallow work to energy troughs. Updates with RL feedback.',
    icon: 'bolt',
    color: 'var(--tertiary)',
    enabled: true,
    category: 'ai',
  },
  {
    id: 'streak-tracker',
    name: 'Streak & Habits',
    description: 'Track completion streaks and notify when patterns break. Positive reinforcement for consistency.',
    icon: 'local_fire_department',
    color: 'var(--error)',
    enabled: true,
    category: 'wellness',
  },
  {
    id: 'context-grouping',
    name: 'Context Grouping',
    description: 'Group similar task types together to minimize switching cost. Reduces cognitive overhead by ~14%.',
    icon: 'group_work',
    color: 'var(--primary)',
    enabled: false,
    category: 'scheduling',
  },
  {
    id: 'deadline-guardian',
    name: 'Deadline Guardian',
    description: 'Monitor upcoming deadlines and escalate tasks that risk missing their due dates.',
    icon: 'alarm',
    color: 'var(--error)',
    enabled: true,
    category: 'scheduling',
  },
];

const CATEGORIES = {
  all: { label: 'All', icon: 'apps' },
  focus: { label: 'Focus', icon: 'center_focus_strong' },
  scheduling: { label: 'Scheduling', icon: 'calendar_today' },
  ai: { label: 'AI & Learning', icon: 'psychology' },
  wellness: { label: 'Wellness', icon: 'spa' },
};

export default function AutomationsView({ state, showToast }) {
  const [automations, setAutomations] = useState(DEFAULT_AUTOMATIONS);
  const [activeCategory, setActiveCategory] = useState('all');

  const toggleAutomation = (id) => {
    setAutomations(prev => prev.map(a => {
      if (a.id === id) {
        const newEnabled = !a.enabled;
        showToast?.(`${a.name} ${newEnabled ? 'activated' : 'deactivated'}`, newEnabled ? 'check_circle' : 'pause_circle');
        return { ...a, enabled: newEnabled };
      }
      return a;
    }));
  };

  const filtered = activeCategory === 'all' ? automations : automations.filter(a => a.category === activeCategory);
  const enabledCount = automations.filter(a => a.enabled).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="headline-lg">Automations</h2>
          <p className="body-md text-muted" style={{ marginTop: 4 }}>Configure AI behaviors that run continuously in the background.</p>
        </div>
        <div className="glass-panel" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tertiary)', animation: 'breathe 3s infinite' }} />
          <span className="body-sm"><strong style={{ color: 'var(--tertiary)' }}>{enabledCount}</strong> <span className="text-muted">of {automations.length} active</span></span>
        </div>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(44,44,44,0.35)', borderRadius: 'var(--radius-lg)', padding: 3, width: 'fit-content' }}>
        {Object.entries(CATEGORIES).map(([id, cat]) => (
          <button key={id} onClick={() => setActiveCategory(id)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: activeCategory === id ? 'rgba(204,151,255,0.12)' : 'transparent',
            color: activeCategory === id ? 'var(--primary)' : 'var(--on-surface-variant)',
            fontFamily: 'var(--font)', fontSize: '0.75rem', fontWeight: activeCategory === id ? 600 : 400,
            transition: 'all 0.2s',
          }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Automations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {filtered.map((auto) => (
          <div key={auto.id} className="glass-panel" style={{
            padding: '20px', display: 'flex', flexDirection: 'column', gap: 12,
            opacity: auto.enabled ? 1 : 0.55, transition: 'opacity 0.3s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: auto.enabled ? `${auto.color}15` : 'rgba(73,72,71,0.1)',
                  transition: 'background 0.3s ease',
                }}>
                  <span className="material-icons-outlined" style={{ fontSize: 18, color: auto.enabled ? auto.color : 'var(--on-surface-variant)' }}>{auto.icon}</span>
                </div>
                <div>
                  <div className="body-md" style={{ fontWeight: 600 }}>{auto.name}</div>
                  <div className="body-sm text-muted" style={{ fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{auto.category}</div>
                </div>
              </div>
              <button onClick={() => toggleAutomation(auto.id)} style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: auto.enabled ? 'var(--primary-dim)' : 'rgba(73,72,71,0.3)',
                position: 'relative', transition: 'background 0.25s ease', flexShrink: 0,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: auto.enabled ? 23 : 3, transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
            <p className="body-sm text-muted" style={{ lineHeight: 1.5 }}>{auto.description}</p>
            {auto.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: auto.color, opacity: 0.7 }} />
                <span className="body-sm" style={{ color: auto.color, fontSize: '0.5625rem', fontWeight: 600 }}>Running</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--primary)', opacity: 0.6 }}>info</span>
        <p className="body-sm text-muted">
          Automations run as part of the scheduling pipeline. Disabling one removes its influence from future optimizations. Previously scheduled tasks are not affected retroactively.
        </p>
      </div>
    </div>
  );
}
