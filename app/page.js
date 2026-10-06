'use client';
import { useState, useEffect, useCallback } from 'react';
import { getState, setState, subscribe, addTask, editTask, completeTask, toggleTaskComplete, skipTask, deleteTask, reoptimize, rescheduleOverdueToToday, skipAllOverdue, rescheduleTaskToDate, getDeepWorkHoursToday, getTodayTasks, getOverdueTasks, checkReminders, dismissNotification } from '@/lib/task-store';
import { getChronotypeScore } from '@/lib/ai-pipeline';
import TimelineView from '@/components/TimelineView';
import SettingsView from '@/components/SettingsView';
import VaultView from '@/components/VaultView';
import AutomationsView from '@/components/AutomationsView';
import TasksView from '@/components/TasksView';
import TaskFormModal from '@/components/TaskFormModal';
import AIDecomposerView from '@/components/AIDecomposerView';

/* ═══════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════ */
function Toast({ message, icon, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="toast">
      <span className="material-icons-outlined" style={{ fontSize: 16, color: 'var(--tertiary)' }}>{icon || 'check_circle'}</span>
      {message}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   NOTIFICATION BELL
   ═══════════════════════════════════════════════════════ */
function NotificationBell({ notifications, onDismiss }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read);

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-icon" onClick={() => setOpen(!open)} style={{ position: 'relative' }}>
        <span className="material-icons-outlined" style={{ fontSize: 20 }}>notifications</span>
        {unread.length > 0 && (
          <div style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: '50%', background: 'var(--error)', border: '2px solid var(--bg)' }} />
        )}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 320, zIndex: 200,
          background: 'rgba(26,25,25,0.92)', backdropFilter: 'blur(32px)',
          borderRadius: 'var(--radius-xl)', border: '0.5px solid rgba(73,72,71,0.2)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(73,72,71,0.15)' }}>
            <span className="headline-sm">Notifications</span>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <p className="body-sm text-muted">No notifications</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ padding: '12px 16px', borderBottom: '0.5px solid rgba(73,72,71,0.08)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, color: n.type === 'overdue' ? 'var(--error)' : 'var(--shallow-work)', marginTop: 2 }}>
                    {n.type === 'overdue' ? 'warning' : 'notifications_active'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="body-sm" style={{ fontWeight: 600 }}>{n.title}</div>
                    <div className="body-sm text-muted">{n.message}</div>
                  </div>
                  <button className="btn-icon" onClick={() => onDismiss(n.id)} style={{ width: 24, height: 24 }}>
                    <span className="material-icons-outlined" style={{ fontSize: 14 }}>close</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════ */
function Sidebar({ activeView, onViewChange }) {
  const navItems = [
    { id: 'myday', icon: 'wb_sunny', label: 'My Day' },
    { id: 'tasks', icon: 'checklist', label: 'Tasks' },
    { id: 'decomposer', icon: 'account_tree', label: 'AI Decomposer' },
    { id: 'timeline', icon: 'timeline', label: 'Timeline' },
    { id: 'automations', icon: 'auto_awesome', label: 'Automations' },
    { id: 'vault', icon: 'inventory_2', label: 'Vault' },
  ];
  const s = {
    aside: { position:'fixed',left:0,top:0,bottom:0,width:240,display:'flex',flexDirection:'column',padding:'28px 14px',zIndex:100,background:'rgba(26,25,25,0.65)',backdropFilter:'blur(40px) saturate(1.2)',WebkitBackdropFilter:'blur(40px) saturate(1.2)',borderRight:'0.5px solid rgba(73,72,71,0.15)' },
    logo: { display:'flex',alignItems:'center',gap:10,marginBottom:44,padding:'0 10px' },
    logoIcon: { width:34,height:34,borderRadius:'var(--radius-lg)',background:'linear-gradient(135deg,var(--primary),var(--tertiary-dim))',display:'flex',alignItems:'center',justifyContent:'center' },
    navBtn: (active) => ({ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:'var(--radius-md)',border:'none',cursor:'pointer',background:active?'rgba(204,151,255,0.08)':'transparent',color:active?'var(--primary)':'var(--on-surface-variant)',fontFamily:'var(--font)',fontSize:'0.8125rem',fontWeight:active?600:400,transition:'all 0.2s',textAlign:'left',width:'100%' }),
    divider: { height:1,background:'rgba(73,72,71,0.1)',margin:'8px 12px' },
    footer: { display:'flex',flexDirection:'column',gap:2,paddingTop:16,marginTop:'auto' },
    footBtn: (active) => ({ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:'var(--radius-md)',border:'none',cursor:'pointer',background:active?'rgba(204,151,255,0.08)':'transparent',color:active?'var(--primary)':'var(--on-surface-variant)',fontFamily:'var(--font)',fontSize:'0.8125rem',textAlign:'left',width:'100%',fontWeight:active?600:400,transition:'all 0.2s' })
  };
  return (
    <aside style={s.aside}>
      <div style={s.logo}>
        <div style={s.logoIcon}><span className="material-icons-outlined" style={{ fontSize:18,color:'#fff' }}>hub</span></div>
        <div>
          <div style={{ fontWeight:700,fontSize:'1rem' }}>Aetheris</div>
          <div className="label-md" style={{ color:'var(--tertiary)',fontSize:'0.5625rem' }}>PRECISION ACTIVE</div>
        </div>
      </div>
      <nav style={{ display:'flex',flexDirection:'column',gap:2 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => onViewChange(item.id)} style={s.navBtn(activeView===item.id)}>
            <span className="material-icons-outlined" style={{ fontSize:18 }}>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
      <div style={s.footer}>
        <div style={s.divider} />
        <button onClick={() => onViewChange('settings')} style={s.footBtn(activeView==='settings')}>
          <span className="material-icons-outlined" style={{ fontSize:18 }}>settings</span>Settings
        </button>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════
   MY DAY — Today's focused view
   ═══════════════════════════════════════════════════════ */
function MyDayView({ state, showToast }) {
  const [time, setTime] = useState(new Date());
  const [formModal, setFormModal] = useState(null); // null | 'new' | task object
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const todayTasks = getTodayTasks();
  const overdueTasks = getOverdueTasks();
  const dwh = getDeepWorkHoursToday().toFixed(1);
  const completedToday = todayTasks.filter(t => t.status === 'done').length;
  const totalToday = todayTasks.length;
  const progress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const currentScore = getChronotypeScore(time.getHours());
  const energyLevel = currentScore > 0.8 ? 'Peak' : currentScore > 0.5 ? 'Good' : 'Low';
  const energyColor = currentScore > 0.8 ? 'var(--tertiary)' : currentScore > 0.5 ? 'var(--shallow-work)' : 'var(--error)';

  const priorityColors = { high: 'var(--error)', medium: 'var(--shallow-work)', low: 'var(--tertiary)' };
  const typeIcons = { DEEP_WORK: 'neurology', SHALLOW_WORK: 'mail', FIXED_EVENT: 'event' };

  const greeting = (() => {
    const h = time.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleSaveTask = (formData) => {
    if (formModal && typeof formModal === 'object' && formModal.id) {
      editTask(formModal.id, formData);
      showToast?.(`"${formData.task_name}" updated`, 'edit');
    } else {
      if (!formData.due_date) {
        formData.due_date = new Date().toISOString().split('T')[0];
      }
      addTask(formData);
      showToast?.(`"${formData.task_name}" added to My Day`, 'add_task');
    }
    setFormModal(null);
  };

  const handleToggle = (id) => {
    const task = state.tasks.find(t => t.id === id);
    toggleTaskComplete(id);
    showToast?.(task?.status === 'done' ? `"${task.task_name}" reopened` : `"${task?.task_name}" completed`, task?.status === 'done' ? 'undo' : 'check_circle');
  };

  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <>
      {/* Greeting Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="headline-lg" style={{ marginBottom: 4 }}>{greeting}, {state.user.display_name}</h1>
          <p className="body-md text-muted">{time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="title-md" style={{ fontVariantNumeric: 'tabular-nums' }}>{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: energyColor }} />
            <span className="body-sm" style={{ color: energyColor }}>Energy: {energyLevel}</span>
          </div>
        </div>
      </div>

      {/* Progress & Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '18px' }}>
          <div className="label-md text-muted" style={{ marginBottom: 10 }}>PROGRESS</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{progress}%</span>
            <span className="body-sm text-muted" style={{ marginBottom: 4 }}>{completedToday}/{totalToday}</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, var(--primary-dim), var(--primary))', borderRadius: 2, transition: 'width 0.5s ease' }} />
          </div>
        </div>
        <div className="glass-panel animate-fade-in" style={{ padding: '18px', animationDelay: '0.08s' }}>
          <div className="label-md text-muted" style={{ marginBottom: 10 }}>DEEP WORK</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--deep-work)' }}>{dwh}h</div>
        </div>
        <div className="glass-panel animate-fade-in" style={{ padding: '18px', animationDelay: '0.16s' }}>
          <div className="label-md text-muted" style={{ marginBottom: 10 }}>STREAK</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--tertiary)' }}>{state.user.stats.streak}d</div>
        </div>
        <div className="glass-panel animate-fade-in" style={{ padding: '18px', animationDelay: '0.24s' }}>
          <div className="label-md text-muted" style={{ marginBottom: 10 }}>OVERDUE</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: overdueTasks.length > 0 ? 'var(--error)' : 'var(--tertiary)' }}>{overdueTasks.length}</div>
        </div>
      </div>

      {/* Overdue Alert with Actions */}
      {overdueTasks.length > 0 && (
        <div className="glass-panel" style={{ padding: '18px 20px', borderLeft: '3px solid var(--error)', background: 'rgba(255,110,132,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--error)' }}>warning</span>
              <span className="body-md" style={{ fontWeight: 600 }}>{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-glass" style={{ fontSize: '0.6875rem', padding: '5px 10px' }} onClick={() => { const c = rescheduleOverdueToToday(); showToast?.(`${c} task${c > 1 ? 's' : ''} moved to today`, 'event_repeat'); }}>
                <span className="material-icons-outlined" style={{ fontSize: 13 }}>event_repeat</span>Move to Today
              </button>
              <button className="btn btn-glass" style={{ fontSize: '0.6875rem', padding: '5px 10px' }} onClick={() => { const c = skipAllOverdue(); showToast?.(`${c} task${c > 1 ? 's' : ''} skipped`, 'skip_next'); }}>
                <span className="material-icons-outlined" style={{ fontSize: 13 }}>skip_next</span>Skip All
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdueTasks.map(t => {
              const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
              const tomorrowStr = tomorrow.toISOString().split('T')[0];
              return (
                <div key={t.id} className="glass-panel-elevated" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: priorityColors[t.priority], fontSize: '0.75rem' }}>●</span>
                  <span className="body-sm" style={{ flex: 1, fontWeight: 500 }}>{t.task_name}</span>
                  <span className="body-sm" style={{ color: 'var(--error)', fontSize: '0.5625rem', flexShrink: 0 }}>{t.due_date}</span>
                  <button className="btn-icon" title="Move to today" style={{ width: 24, height: 24 }} onClick={() => { rescheduleTaskToDate(t.id, new Date().toISOString().split('T')[0]); showToast?.(`"${t.task_name}" moved to today`, 'event_repeat'); }}>
                    <span className="material-icons-outlined" style={{ fontSize: 13, color: 'var(--tertiary)' }}>today</span>
                  </button>
                  <button className="btn-icon" title="Move to tomorrow" style={{ width: 24, height: 24 }} onClick={() => { rescheduleTaskToDate(t.id, tomorrowStr); showToast?.(`"${t.task_name}" moved to tomorrow`, 'event'); }}>
                    <span className="material-icons-outlined" style={{ fontSize: 13, color: 'var(--shallow-work)' }}>event</span>
                  </button>
                  <button className="btn-icon" title="Skip" style={{ width: 24, height: 24 }} onClick={() => { skipTask(t.id); showToast?.(`"${t.task_name}" skipped`, 'skip_next'); }}>
                    <span className="material-icons-outlined" style={{ fontSize: 13, color: 'var(--on-surface-variant)' }}>skip_next</span>
                  </button>
                  <button className="btn-icon" title="Delete" style={{ width: 24, height: 24 }} onClick={() => { deleteTask(t.id); showToast?.(`"${t.task_name}" deleted`, 'delete'); }}>
                    <span className="material-icons-outlined" style={{ fontSize: 13, color: 'var(--error)' }}>delete_outline</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add task for today */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setFormModal('new')}>
        <span className="material-icons-outlined" style={{ fontSize: 20, color: 'var(--primary)', opacity: 0.6 }}>add_circle</span>
        <span className="body-md text-muted">Add a task for today...</span>
      </div>

      {/* Today's Task List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="headline-sm">Today's Tasks</h2>
            <button className="btn btn-glass" style={{ fontSize: '0.75rem', padding: '7px 14px' }} onClick={() => { reoptimize(); showToast?.('Schedule reoptimized', 'auto_fix_high'); }}>
              <span className="material-icons-outlined" style={{ fontSize: 14 }}>refresh</span>Reoptimize
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--on-surface-variant)', opacity: 0.15, display: 'block', marginBottom: 12 }}>wb_sunny</span>
              <p className="body-md text-muted" style={{ marginBottom: 12 }}>Your day is clear. Add tasks to get started.</p>
              <button className="btn btn-primary" onClick={() => setFormModal('new')}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>add</span>Add Task
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {todayTasks.map(task => (
                <div key={task.id} className="glass-panel-elevated" style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
                  opacity: task.status === 'done' ? 0.5 : 1, transition: 'all 0.25s',
                }}>
                  {/* Checkbox */}
                  <button onClick={() => handleToggle(task.id)} style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: `2px solid ${task.status === 'done' ? 'var(--tertiary)' : priorityColors[task.priority]}`,
                    background: task.status === 'done' ? 'var(--tertiary)' : 'transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s', flexShrink: 0,
                  }}>
                    {task.status === 'done' && <span className="material-icons-outlined" style={{ fontSize: 14, color: '#000' }}>check</span>}
                  </button>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setFormModal(task)}>
                    <div style={{
                      fontWeight: 600, fontSize: '0.875rem', marginBottom: 3,
                      textDecoration: task.status === 'done' ? 'line-through' : 'none',
                      color: task.status === 'done' ? 'var(--on-surface-variant)' : 'var(--on-surface)',
                    }}>{task.task_name}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 12, color: 'var(--on-surface-variant)', opacity: 0.5 }}>{typeIcons[task.task_type]}</span>
                      <span className="body-sm text-muted">{task.estimated_duration_minutes}m</span>
                      {task.due_time && <span className="body-sm text-muted">{formatTime(task.due_time)}</span>}
                      {task.reminder !== 'none' && <span className="material-icons-outlined" style={{ fontSize: 10, color: 'var(--shallow-work)', opacity: 0.5 }}>notifications_active</span>}
                      {task.tags?.slice(0, 2).map(tag => <span key={tag} style={{ fontSize: '0.5rem', color: 'var(--on-surface-variant)', background: 'rgba(255,255,255,0.03)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>#{tag}</span>)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Priority dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColors[task.priority], flexShrink: 0, opacity: 0.7 }} title={task.priority} />
                    
                    {/* Delete button */}
                    <button className="btn-icon" onClick={(e) => { e.stopPropagation(); deleteTask(task.id); showToast?.(`"${task.task_name}" deleted`, 'delete'); }} style={{ width: 24, height: 24, opacity: 0.5 }}>
                      <span className="material-icons-outlined" style={{ fontSize: 14, color: 'var(--error)' }}>delete_outline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar: Energy + Insights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Energy Forecast */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 className="headline-sm">Energy Forecast</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: energyColor }} />
                <span className="label-md" style={{ color: energyColor }}>{energyLevel}</span>
              </div>
            </div>
            <div style={{ height: 80, marginBottom: 6 }}>
              <svg viewBox="0 0 320 70" style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--tertiary)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--tertiary)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const hours = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
                  const pts = hours.map((h, i) => ({ x: (i / (hours.length - 1)) * 320, y: 65 - getChronotypeScore(h) * 60 }));
                  const line = `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`;
                  return (<>
                    <path d={`${line} L320,70 L0,70 Z`} fill="url(#eg)" />
                    <path d={line} fill="none" stroke="var(--tertiary)" strokeWidth="1.5" strokeLinecap="round" />
                    {pts.map((p, i) => hours[i] === time.getHours() ? <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--tertiary)" style={{ filter: 'drop-shadow(0 0 6px rgba(101,253,230,0.5))' }} /> : null)}
                  </>);
                })()}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'].map(l => <span key={l} style={{ fontSize: '0.5625rem', color: 'var(--on-surface-variant)' }}>{l}</span>)}
            </div>
          </div>

          {/* Quick Insights */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: 18, opacity: 0.7 }}>psychology</span>
              AI Insights
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: 'bolt', color: energyColor, text: `Energy is ${energyLevel.toLowerCase()} right now (${Math.round(currentScore * 100)}%).` },
                { icon: 'trending_up', color: 'var(--primary)', text: `${state.user.stats.streak}-day streak. ${state.user.stats.streak >= 3 ? 'Keep the momentum!' : 'Build consistency.'}` },
                todayTasks.filter(t => t.task_type === 'DEEP_WORK' && t.status !== 'done').length > 0
                  ? { icon: 'neurology', color: 'var(--deep-work)', text: `${todayTasks.filter(t => t.task_type === 'DEEP_WORK' && t.status !== 'done').length} deep work session${todayTasks.filter(t => t.task_type === 'DEEP_WORK' && t.status !== 'done').length > 1 ? 's' : ''} remaining.` }
                  : { icon: 'check_circle', color: 'var(--tertiary)', text: 'All deep work sessions complete.' },
              ].map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="material-icons-outlined" style={{ color: ins.color, fontSize: 16, marginTop: 1, opacity: 0.8 }}>{ins.icon}</span>
                  <span className="body-sm text-muted">{ins.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Task Form Modal */}
      {formModal && (
        <TaskFormModal
          task={typeof formModal === 'object' ? formModal : null}
          onSave={handleSaveTask}
          onClose={() => setFormModal(null)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════ */
export default function Home() {
  const [state, setLocalState] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => { setLocalState(getState()); return subscribe(s => setLocalState({ ...s })); }, []);

  // Check reminders periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const newNotifs = checkReminders();
      if (newNotifs.length > 0) {
        setToast({ message: newNotifs[0].message, icon: newNotifs[0].type === 'overdue' ? 'warning' : 'notifications_active', key: Date.now() });
      }
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const showToast = useCallback((message, icon) => { setToast({ message, icon, key: Date.now() }); }, []);

  if (!state) return null;

  const renderView = () => {
    switch (state.activeView) {
      case 'tasks': return <TasksView state={state} showToast={showToast} />;
      case 'decomposer': return <AIDecomposerView state={state} showToast={showToast} />;

      case 'timeline': return <TimelineView state={state} onComplete={id => { completeTask(id); showToast('Task completed', 'check_circle'); }} onSkip={id => { skipTask(id); showToast('Task skipped', 'skip_next'); }} onDelete={id => { deleteTask(id); showToast('Task deleted', 'delete'); }} />;
      case 'settings': return <SettingsView state={state} showToast={showToast} />;
      case 'vault': return <VaultView state={state} />;
      case 'automations': return <AutomationsView state={state} showToast={showToast} />;
      default: return <MyDayView state={state} showToast={showToast} />;
    }
  };

  return (
    <>
      <div className="mesh-bg"><div className="mesh-blob-3" /></div>
      <div className="app-layout">
        <Sidebar activeView={state.activeView} onViewChange={v => setState({ activeView: v })} />
        <main className="main-content">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: -12 }}>
            <NotificationBell notifications={state.notifications || []} onDismiss={dismissNotification} />
          </div>
          {renderView()}
        </main>
      </div>
      {toast && <Toast key={toast.key} message={toast.message} icon={toast.icon} onDone={() => setToast(null)} />}
    </>
  );
}
