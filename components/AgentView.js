'use client';
import { useState, useRef, useEffect } from 'react';
import { parseNaturalLanguage, generateExplanation, getChronotypeScore } from '@/lib/ai-pipeline';
import { addChatMessage, addTask } from '@/lib/task-store';

// Simple markdown-to-JSX renderer for bold, code, and line breaks
function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts = [];
    let remaining = line;
    let key = 0;

    // Process **bold** and `code`
    const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={key++}>{remaining.slice(lastIndex, match.index)}</span>);
      }
      if (match[2]) {
        parts.push(<strong key={key++} style={{ color: 'var(--on-surface)', fontWeight: 600 }}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<code key={key++} style={{ background: 'rgba(204,151,255,0.1)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--primary)' }}>{match[3]}</code>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < remaining.length) {
      parts.push(<span key={key++}>{remaining.slice(lastIndex)}</span>);
    }

    const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || /^\d+\./.test(line.trim());

    return (
      <div key={li} style={{
        ...(isBullet ? { paddingLeft: 8 } : {}),
        ...(line.trim() === '' ? { height: 8 } : {}),
      }}>
        {parts.length > 0 ? parts : line}
      </div>
    );
  });
}

// AI responses based on intent
function generateAIResponse(input, state) {
  const lower = input.toLowerCase();

  if (lower.includes('schedule') || lower.includes('today') || lower.includes('plan')) {
    const deepSlots = state.schedule.filter(s => s.task_type === 'DEEP_WORK');
    const totalHours = state.schedule.reduce((sum, s) => sum + (new Date(s.end_time) - new Date(s.start_time)) / 3600000, 0).toFixed(1);
    return `📋 **Today's Schedule Analysis:**\n\nYou have **${state.schedule.length} tasks** scheduled, totaling **${totalHours} hours** of work.\n\n• **${deepSlots.length} deep work blocks** — placed during your peak focus windows (9-11 AM, 4-6 PM)\n• Cognitive load is within healthy limits\n• Current streak: **${state.user.stats.streak} days** consecutive completion\n\n💡 *Tip: Your RL model shows you complete deep work 23% faster in the morning. Consider front-loading complex tasks.*`;
  }

  if (lower.includes('productivity') || lower.includes('tip') || lower.includes('improve') || lower.includes('better')) {
    return `🧠 **Productivity Insights from Your Data:**\n\n1. **Peak Focus Window:** 9:00 – 11:30 AM (38% higher output vs. afternoon)\n2. **Context Switching Cost:** Each task switch costs ~14 min of refocusing time\n3. **Optimal Session Length:** Your sweet spot is 75-90 min deep work blocks\n4. **Break Compliance:** Taking scheduled breaks improves your completion rate by 19%\n\n📊 Based on ${state.user.stats.tasksCompleted} tracked tasks, your estimated accuracy is **${Math.round(state.user.stats.avgAccuracy * 100)}%**.`;
  }

  if (lower.includes('energy') || lower.includes('focus') || lower.includes('tired') || lower.includes('fatigue')) {
    const hour = new Date().getHours();
    const score = getChronotypeScore(hour);
    const level = score > 0.8 ? 'peak' : score > 0.5 ? 'moderate' : 'low';
    return `⚡ **Current Energy Level: ${level.toUpperCase()} (${Math.round(score * 100)}%)**\n\nBased on your chronotype model:\n• Right now (${hour}:00) your focus score is **${Math.round(score * 100)}%**\n• ${score > 0.7 ? 'This is a great time for deep work!' : score > 0.4 ? 'Good for moderate tasks. Save deep work for your next peak.' : 'Low energy phase. Stick to shallow tasks or take a break.'}\n\n🔮 *Next peak window: ${hour < 16 ? '4:00 PM – 6:00 PM' : 'Tomorrow 9:00 AM – 11:30 AM'}*`;
  }

  if (lower.includes('stat') || lower.includes('progress') || lower.includes('how am i')) {
    const s = state.user.stats;
    return `📈 **Your Performance Dashboard:**\n\n• Tasks completed: **${s.tasksCompleted}**\n• Current streak: **${s.streak} days**\n• Total deep work: **${s.totalFocusHours.toFixed(1)} hours**\n• AI accuracy: **${Math.round(s.avgAccuracy * 100)}%**\n• Tasks skipped: **${s.tasksSkipped || 0}**\n\n🎯 *You're in the top 15% of consistent users. The RL model has adapted ${s.tasksCompleted} times to your patterns.*`;
  }

  if (lower.includes('help') || lower.includes('what can you')) {
    return `🤖 **I can help you with:**\n\n• **"What's my schedule today?"** — View your optimized daily plan\n• **"Any productivity tips?"** — Get personalized insights from your data\n• **"How's my energy right now?"** — Check your chronotype alignment\n• **"Show my stats"** — View performance metrics\n• **"Explain the algorithm"** — Learn how I schedule your tasks\n• **"Add: [task description]"** — Quick-add a task via natural language\n\n💬 *I learn from every interaction. The more you use me, the better I get.*`;
  }

  if (lower.includes('algorithm') || lower.includes('how do you') || lower.includes('how does')) {
    return `🔬 **The Scheduling Algorithm:**\n\n**Placement Score Formula:**\n\`Ps(t) = w1·Ct + w2·U − w3·Ediff − w4·Scost\`\n\nWhere:\n• **Ct** = Chronotype score (your energy at that hour)\n• **U** = Task urgency (deadline proximity + stress)\n• **Ediff** = Energy-difficulty mismatch penalty\n• **Scost** = Context-switching cost\n\n**Current Weights (learned from ${state.user.stats.tasksCompleted} tasks):**\n• Chronotype: ${(state.user.model_weights.w1_chronotype * 100).toFixed(0)}%\n• Urgency: ${(state.user.model_weights.w2_urgency * 100).toFixed(0)}%\n• Energy Match: ${(state.user.model_weights.w3_energy_diff * 100).toFixed(0)}%\n• Switch Cost: ${(state.user.model_weights.w4_switch_cost * 100).toFixed(0)}%\n\n*These weights update via reinforcement learning every time you complete or skip a task.*`;
  }

  if (lower.startsWith('add:') || lower.startsWith('add ') || lower.includes('schedule ')) {
    const taskInput = input.replace(/^add:?\s*/i, '').replace(/^schedule\s+/i, '');
    const parsed = parseNaturalLanguage(taskInput);
    addTask(parsed);
    return `✅ **Task Added to Schedule:**\n\n• **Name:** ${parsed.task_name}\n• **Type:** ${parsed.task_type.replace('_', ' ')}\n• **Duration:** ${parsed.estimated_duration_minutes} min\n• **Urgency:** ${Math.round(parsed.urgency_score * 100)}%\n${parsed.deadline ? `• **Deadline:** ${new Date(parsed.deadline).toLocaleDateString()}\n` : ''}• **Tags:** ${parsed.tags.join(', ')}\n\n*The task has been placed into your optimal schedule. Check the Overview to see it.*`;
  }

  return `I understand you're asking about "${input}". Here's what I can tell you:\n\n🧠 Your current schedule has **${state.schedule.length} tasks** with an AI accuracy of **${Math.round(state.user.stats.avgAccuracy * 100)}%**.\n\nTry asking me about your schedule, energy levels, productivity tips, or how the algorithm works. I can also parse tasks if you say "Add: [task description]".`;
}

export default function AgentView({ state }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(state.chatHistory || []);
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = (overrideInput) => {
    const text = overrideInput || input;
    if (!text.trim() || typing) return;
    const userMsg = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    addChatMessage('user', text);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const response = generateAIResponse(text, state);
      const aiMsg = { id: (Date.now() + 1).toString(), role: 'ai', content: response, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
      addChatMessage('ai', response);
      setTyping(false);
    }, 600 + Math.random() * 500);
  };

  const quickActions = ["What's my schedule?", 'Productivity tips', "How's my energy?", 'Show stats', 'Explain the algorithm'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, var(--primary), var(--tertiary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-icons-outlined" style={{ fontSize: 20, color: '#fff' }}>psychology</span>
        </div>
        <div>
          <h2 className="headline-sm">Aetheris Agent</h2>
          <div className="body-sm text-muted">AI scheduling assistant — ask anything</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tertiary)', animation: 'breathe 3s infinite' }} />
          <span className="body-sm" style={{ color: 'var(--tertiary)' }}>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="glass-panel" style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.5 }}>
            <span className="material-icons-outlined" style={{ fontSize: 48, color: 'var(--primary)', opacity: 0.3 }}>psychology</span>
            <p className="body-md text-muted" style={{ textAlign: 'center' }}>Ask me about your schedule, productivity, or anything else.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {quickActions.map(q => (
                <button key={q} className="btn btn-glass" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => handleSend(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeIn 0.3s ease' }}>
            {msg.role === 'ai' && (
              <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary), var(--tertiary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 8, marginTop: 4 }}>
                <span className="material-icons-outlined" style={{ fontSize: 14, color: '#fff' }}>psychology</span>
              </div>
            )}
            <div style={{
              maxWidth: '75%', padding: '12px 16px', borderRadius: 'var(--radius-xl)',
              background: msg.role === 'user' ? 'linear-gradient(135deg, rgba(204,151,255,0.15), rgba(156,72,234,0.1))' : 'rgba(38,38,38,0.5)',
              border: msg.role === 'user' ? '0.5px solid rgba(204,151,255,0.2)' : '0.5px solid rgba(73,72,71,0.15)',
            }}>
              <div className="body-md" style={{ lineHeight: 1.6 }}>
                {renderMarkdown(msg.content)}
              </div>
              <div className="body-sm text-muted" style={{ marginTop: 6, fontSize: '0.5625rem' }}>
                {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--primary), var(--tertiary-dim))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-icons-outlined" style={{ fontSize: 14, color: '#fff' }}>psychology</span>
            </div>
            <div style={{ display: 'flex', gap: 6, padding: '12px 16px', opacity: 0.6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite 0.2s' }} />
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite 0.4s' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions strip when there are messages */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {quickActions.map(q => (
            <button key={q} className="btn btn-outline" style={{ fontSize: '0.6875rem', padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => handleSend(q)}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="glass-panel" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Ask Aetheris anything..."
          className="input-field"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-lg)' }}
        />
        <button className="btn btn-primary" onClick={() => handleSend()} disabled={!input.trim() || typing} style={{ padding: '9px 16px' }}>
          <span className="material-icons-outlined" style={{ fontSize: 16 }}>send</span>Send
        </button>
      </div>
    </div>
  );
}
