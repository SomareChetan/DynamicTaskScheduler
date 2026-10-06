'use client';
import { useState } from 'react';
import { updatePreferences, updateUserProfile, clearData } from '@/lib/task-store';

export default function SettingsView({ state, showToast }) {
  const [wake, setWake] = useState(state.user.wake_time);
  const [sleep, setSleep] = useState(state.user.sleep_time);
  const [name, setName] = useState(state.user.display_name);
  const prefs = state.user.preferences || {};
  const [deepProtect, setDeepProtect] = useState(prefs.deepWorkProtection !== false);
  const [autoBreaks, setAutoBreaks] = useState(prefs.autoBreaks !== false);
  const [breakDur, setBreakDur] = useState(prefs.breakDuration || 15);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateUserProfile({ display_name: name, wake_time: wake, sleep_time: sleep });
    updatePreferences({ deepWorkProtection: deepProtect, autoBreaks, breakDuration: breakDur });
    setSaved(true);
    showToast?.('Settings saved', 'check_circle');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    if (confirm('This will reset all tasks, schedule, and AI learning. Continue?')) {
      clearData();
      showToast?.('All data reset', 'restart_alt');
    }
  };

  const Toggle = ({ checked, onChange, label, description }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '0.5px solid rgba(73,72,71,0.08)' }}>
      <div>
        <span className="body-md">{label}</span>
        {description && <div className="body-sm text-muted" style={{ marginTop: 2 }}>{description}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--primary-dim)' : 'rgba(73,72,71,0.3)',
        position: 'relative', transition: 'background 0.25s ease', flexShrink: 0, marginLeft: 16,
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3, left: checked ? 23 : 3, transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );

  const Section = ({ title, icon, children }) => (
    <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
      <h3 className="headline-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {icon && <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--primary)', opacity: 0.7 }}>{icon}</span>}
        {title}
      </h3>
      {children}
    </div>
  );

  const weights = state.user.model_weights;

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ marginBottom: 8 }}>
        <h2 className="headline-lg">Settings</h2>
        <p className="body-sm text-muted" style={{ marginTop: 4 }}>Configure your profile, preferences, and view learned AI parameters.</p>
      </div>

      <Section title="Profile" icon="person">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="label-md text-muted" style={{ display: 'block', marginBottom: 6 }}>Display Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="label-md text-muted" style={{ display: 'block', marginBottom: 6 }}>Wake Time</label>
              <select value={wake} onChange={e => setWake(Number(e.target.value))} className="input-field">
                {Array.from({ length: 8 }, (_, i) => i + 5).map(h => <option key={h} value={h}>{h}:00 AM</option>)}
              </select>
            </div>
            <div>
              <label className="label-md text-muted" style={{ display: 'block', marginBottom: 6 }}>Sleep Time</label>
              <select value={sleep} onChange={e => setSleep(Number(e.target.value))} className="input-field">
                {Array.from({ length: 6 }, (_, i) => i + 20).map(h => <option key={h} value={h}>{h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Scheduling Preferences" icon="tune">
        <Toggle checked={deepProtect} onChange={setDeepProtect} label="Deep Work Protection" description="Activate Focus Shield during long deep work sessions" />
        <Toggle checked={autoBreaks} onChange={setAutoBreaks} label="Auto-insert breaks" description="Add buffer time between consecutive tasks" />
        <div style={{ padding: '14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <span className="body-md">Break Duration</span>
              <div className="body-sm text-muted" style={{ marginTop: 2 }}>Minimum break between tasks</div>
            </div>
            <span className="body-md" style={{ color: 'var(--primary)', fontWeight: 600 }}>{breakDur} min</span>
          </div>
          <input type="range" min="5" max="30" step="5" value={breakDur} onChange={e => setBreakDur(Number(e.target.value))} style={{ width: '100%' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="body-sm text-muted">5 min</span>
            <span className="body-sm text-muted">30 min</span>
          </div>
        </div>
      </Section>

      <Section title="AI Model Weights" icon="model_training">
        <div className="body-sm text-muted" style={{ marginBottom: 14 }}>These weights are automatically tuned by the RL system based on your task completion patterns. They are read-only.</div>
        {Object.entries(weights).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(73,72,71,0.06)' }}>
            <span className="body-sm">{k.replace(/w\d_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 120, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${v * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-dim), var(--primary))', borderRadius: 2, transition: 'width 0.5s ease' }} />
              </div>
              <span className="body-sm" style={{ color: 'var(--primary)', fontWeight: 600, width: 36, textAlign: 'right' }}>{(v * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </Section>

      <Section title="Duration Multipliers" icon="timer">
        <div className="body-sm text-muted" style={{ marginBottom: 14 }}>Learned correction factors for your time estimates by task category.</div>
        {Object.entries(state.user.duration_history).map(([type, data]) => (
          <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid rgba(73,72,71,0.06)' }}>
            <div>
              <span className="body-sm">{type.replace('_', ' ')}</span>
              <div className="body-sm text-muted" style={{ fontSize: '0.5625rem' }}>{data.sampleSize} samples</div>
            </div>
            <span className="body-sm" style={{ color: data.beta > 1.2 ? 'var(--shallow-work)' : 'var(--tertiary)', fontWeight: 600 }}>×{data.beta.toFixed(2)}</span>
          </div>
        ))}
      </Section>

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
          {saved ? <><span className="material-icons-outlined" style={{ fontSize: 16 }}>check</span>Saved!</> : <><span className="material-icons-outlined" style={{ fontSize: 16 }}>save</span>Save Changes</>}
        </button>
        <button className="btn btn-glass" onClick={handleClear} style={{ color: 'var(--error)' }}>
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete_forever</span>Reset All Data
        </button>
      </div>
    </div>
  );
}
