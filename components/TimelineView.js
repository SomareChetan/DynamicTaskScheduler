'use client';
import { useState, useMemo } from 'react';

export default function TimelineView({ state, onComplete, onSkip, onDelete }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 7 AM to 10 PM
  const isToday = (d) => d.toDateString() === today.toDateString();
  const nowHour = today.getHours();
  const nowMinutes = today.getMinutes();

  const typeColors = {
    DEEP_WORK: { bg: 'rgba(179,136,255,0.15)', border: 'var(--deep-work)', text: 'var(--deep-work)' },
    SHALLOW_WORK: { bg: 'rgba(255,213,79,0.12)', border: 'var(--shallow-work)', text: 'var(--shallow-work)' },
    FIXED_EVENT: { bg: 'rgba(101,253,230,0.12)', border: 'var(--fixed-event)', text: 'var(--fixed-event)' },
  };

  // Pre-process: map slots to their start hours for each day
  const slotMap = useMemo(() => {
    const map = {};
    state.schedule.forEach(s => {
      const st = new Date(s.start_time);
      const dateKey = st.toDateString();
      const hour = st.getHours();
      if (!map[dateKey]) map[dateKey] = {};
      if (!map[dateKey][hour]) map[dateKey][hour] = [];
      map[dateKey][hour].push(s);
    });
    return map;
  }, [state.schedule]);

  // Build occupied set per render
  const occupied = useMemo(() => {
    const set = new Set();
    state.schedule.forEach(s => {
      const st = new Date(s.start_time);
      const et = new Date(s.end_time);
      const dateKey = st.toDateString();
      const startHour = st.getHours();
      const span = Math.max(1, Math.ceil((et - st) / 3600000));
      for (let i = 1; i < span; i++) {
        set.add(`${dateKey}-${startHour + i}`);
      }
    });
    return set;
  }, [state.schedule]);

  const getSlotSpan = (slot) => Math.max(1, Math.ceil((new Date(slot.end_time) - new Date(slot.start_time)) / 3600000));

  // Context menu state
  const [contextMenu, setContextMenu] = useState(null);

  const handleSlotContextMenu = (e, slot) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, slot });
  };

  const weekLabel = (() => {
    const first = days[0], last = days[6];
    if (first.getMonth() === last.getMonth()) {
      return `${first.toLocaleDateString('en-US', { month: 'long' })} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`;
    }
    return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="headline-lg">Timeline</h2>
          <p className="body-sm text-muted" style={{ marginTop: 4 }}>{weekLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-glass" style={{ padding: '7px 12px' }} onClick={() => setWeekOffset(w => w - 1)}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>chevron_left</span>
          </button>
          <button className="btn btn-glass" style={{ padding: '7px 12px', fontSize: '0.75rem' }} onClick={() => setWeekOffset(0)}>Today</button>
          <button className="btn btn-glass" style={{ padding: '7px 12px' }} onClick={() => setWeekOffset(w => w + 1)}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>chevron_right</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Day Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', borderBottom: '0.5px solid rgba(73,72,71,0.15)' }}>
          <div style={{ padding: 12 }} />
          {days.map((d, i) => (
            <div key={i} style={{
              padding: '12px 8px', textAlign: 'center',
              background: isToday(d) ? 'rgba(204,151,255,0.06)' : 'transparent',
              borderLeft: '0.5px solid rgba(73,72,71,0.1)',
            }}>
              <div className="label-md text-muted" style={{ marginBottom: 4 }}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div style={{
                fontWeight: 700, fontSize: '1.125rem',
                color: isToday(d) ? 'var(--primary)' : 'var(--on-surface)',
                width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: isToday(d) ? 'rgba(204,151,255,0.12)' : 'transparent',
              }}>{d.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Hour Rows */}
        <div style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
          {hours.map(hour => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: 56, borderBottom: '0.5px solid rgba(73,72,71,0.06)', position: 'relative' }}>
              <div style={{ padding: '6px 8px', textAlign: 'right', fontSize: '0.625rem', color: 'var(--on-surface-variant)' }}>
                {hour > 12 ? hour - 12 : hour}{hour >= 12 ? 'PM' : 'AM'}
              </div>
              {days.map((day, di) => {
                const dateKey = day.toDateString();
                const cellKey = `${dateKey}-${hour}`;

                // If this cell is occupied by a multi-hour slot starting above, render empty
                if (occupied.has(cellKey)) {
                  return <div key={di} style={{ borderLeft: '0.5px solid rgba(73,72,71,0.06)' }} />;
                }

                const daySlots = slotMap[dateKey];
                const slots = daySlots ? daySlots[hour] : null;

                // Current time indicator
                const showNowLine = isToday(day) && hour === nowHour;

                if (slots && slots.length > 0) {
                  const slot = slots[0];
                  const span = getSlotSpan(slot);
                  const tc = typeColors[slot.task_type] || typeColors.SHALLOW_WORK;
                  const dur = Math.round((new Date(slot.end_time) - new Date(slot.start_time)) / 60000);

                  return (
                    <div key={di} style={{
                      borderLeft: '0.5px solid rgba(73,72,71,0.06)', padding: 3,
                      position: 'relative',
                    }}>
                      {showNowLine && <div style={{ position: 'absolute', top: `${(nowMinutes / 60) * 100}%`, left: 0, right: 0, height: 2, background: 'var(--error)', zIndex: 5, borderRadius: 1 }} />}
                      <div
                        onContextMenu={(e) => handleSlotContextMenu(e, slot)}
                        style={{
                          height: span > 1 ? `${span * 56 - 6}px` : '100%',
                          padding: '6px 8px', borderRadius: 'var(--radius-md)',
                          background: tc.bg, borderLeft: `2px solid ${tc.border}`,
                          fontSize: '0.6875rem', cursor: 'pointer',
                          overflow: 'hidden', position: 'relative', zIndex: 2,
                          transition: 'background 0.2s ease',
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2, fontSize: '0.6875rem', color: 'var(--on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.task_name}</div>
                        <div style={{ opacity: 0.7, fontSize: '0.5625rem', color: tc.text }}>{dur} min</div>
                        {slot.is_protected && <div style={{ fontSize: '0.5rem', color: 'var(--primary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <span className="material-icons-outlined" style={{ fontSize: 8 }}>lock</span>Shield
                        </div>}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={di} style={{ borderLeft: '0.5px solid rgba(73,72,71,0.06)', position: 'relative' }}>
                    {showNowLine && <div style={{ position: 'absolute', top: `${(nowMinutes / 60) * 100}%`, left: 0, right: 0, height: 2, background: 'var(--error)', zIndex: 5, borderRadius: 1 }}>
                      <div style={{ position: 'absolute', left: -3, top: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--error)' }} />
                    </div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{
          position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000,
          background: 'rgba(26,25,25,0.9)', backdropFilter: 'blur(24px)',
          borderRadius: 'var(--radius-lg)', border: '0.5px solid rgba(73,72,71,0.2)',
          padding: '6px', minWidth: 160,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.15s ease',
        }} onClick={e => e.stopPropagation()}>
          <div className="body-sm" style={{ padding: '6px 12px', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{contextMenu.slot.task_name}</div>
          <div style={{ height: 1, background: 'rgba(73,72,71,0.15)', margin: '4px 0' }} />
          <button onClick={() => { onComplete(contextMenu.slot.task_id); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', border: 'none', background: 'transparent', color: 'var(--tertiary)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontFamily: 'var(--font)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>check_circle</span>Complete
          </button>
          <button onClick={() => { onSkip(contextMenu.slot.task_id); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', border: 'none', background: 'transparent', color: 'var(--on-surface-variant)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontFamily: 'var(--font)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>skip_next</span>Skip
          </button>
          <button onClick={() => { onDelete(contextMenu.slot.task_id); setContextMenu(null); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%', border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontFamily: 'var(--font)' }}>
            <span className="material-icons-outlined" style={{ fontSize: 14 }}>delete</span>Delete
          </button>
        </div>
      )}
    </div>
  );
}
