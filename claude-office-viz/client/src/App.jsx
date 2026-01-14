import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/*
 * AI Workflow Visualizer
 * Premium pedagogisk visualisering med individuelle agent-detaljer
 */

const ROLES = {
  manager: {
    title: 'Koordinator',
    color: '#8B5CF6',
    description: 'Analyserer oppgaven og koordinerer teamet',
    detail: 'Koordinatoren er alltid den første som aktiveres. Den forstår hva du trenger, bryter oppgaven ned i håndterbare deler, og velger hvilke spesialister som skal jobbe med hver del.',
  },
  researcher: {
    title: 'Analytiker',
    color: '#3B82F6',
    description: 'Samler og analyserer informasjon',
    detail: 'Analytikeren undersøker eksisterende kode, dokumenter og data. De bygger forståelsen som resten av teamet trenger.',
  },
  developer: {
    title: 'Utfører',
    color: '#F59E0B',
    description: 'Gjennomfører tekniske oppgaver',
    detail: 'Utføreren handler. De kjører kommandoer, tester løsninger, og implementerer endringer.',
  },
  writer: {
    title: 'Skaper',
    color: '#10B981',
    description: 'Produserer nytt innhold',
    detail: 'Skaperen lager nye ting - kode, dokumentasjon, eller annet innhold basert på planen.',
  },
  editor: {
    title: 'Forbedrer',
    color: '#EC4899',
    description: 'Raffinerer og kvalitetssikrer',
    detail: 'Forbedreren tar eksisterende arbeid og gjør det bedre. De finner feil og optimaliserer.',
  },
};

export default function WorkflowVisualizer() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [phase, setPhase] = useState(0);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ tasks: 0, time: 0 });
  const wsRef = useRef(null);
  const startTime = useRef(null);

  // Timer
  useEffect(() => {
    if (agents.length > 0 && !startTime.current) {
      startTime.current = Date.now();
    }
    const interval = setInterval(() => {
      if (startTime.current) {
        setStats(s => ({ ...s, time: Math.floor((Date.now() - startTime.current) / 1000) }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [agents.length]);

  // WebSocket
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:3001');
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => handleEvent(JSON.parse(e.data));
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  const addMessage = useCallback((text, type = 'info', agentId = null) => {
    const msg = { id: Date.now(), text, type, agentId, time: new Date() };
    setMessages(prev => [msg, ...prev].slice(0, 100));
  }, []);

  const handleEvent = useCallback((event) => {
    switch (event.type) {
      case 'agent_joined':
        const roleType = mapRole(event.agent.role);
        const agentNum = agents.filter(a => a.role === roleType).length + 1;
        
        setAgents(prev => {
          if (prev.find(a => a.id === event.agent.id)) return prev;
          return [...prev, { 
            id: event.agent.id, 
            role: roleType,
            name: `${ROLES[roleType]?.title || 'Agent'} #${agentNum}`,
            status: 'active',
            joinedAt: Date.now(),
            taskHistory: [],
            tasksCompleted: 0,
          }];
        });
        setPhase(p => Math.max(p, roleType === 'manager' ? 1 : 2));
        addMessage(`${ROLES[roleType]?.title || 'Agent'} #${agentNum} aktivert`, 'join', event.agent.id);
        break;

      case 'agent_updated':
        setAgents(prev => prev.map(a => {
          if (a.id !== event.agent.id) return a;
          
          const newTask = event.agent.currentTask;
          const taskHistory = [...a.taskHistory];
          
          // Legg til ny oppgave i historikken hvis den er forskjellig
          if (newTask && (taskHistory.length === 0 || taskHistory[0].task !== newTask)) {
            taskHistory.unshift({
              task: newTask,
              simplified: simplifyTask(newTask),
              startedAt: new Date(),
              status: 'working',
            });
          }
          
          return { 
            ...a, 
            status: 'working', 
            currentTask: newTask,
            taskHistory: taskHistory.slice(0, 20), // Behold siste 20
          };
        }));
        
        if (event.agent.currentTask) {
          setPhase(3);
          addMessage(simplifyTask(event.agent.currentTask), 'work', event.agent.id);
        }
        break;

      case 'work_completed':
        setStats(s => ({ ...s, tasks: s.tasks + 1 }));
        
        setAgents(prev => prev.map(a => {
          if (a.id !== event.agentId) return a;
          
          // Marker første "working" oppgave som fullført
          const taskHistory = a.taskHistory.map((t, i) => {
            if (i === 0 && t.status === 'working') {
              return { ...t, status: 'completed', completedAt: new Date() };
            }
            return t;
          });
          
          return {
            ...a,
            taskHistory,
            tasksCompleted: a.tasksCompleted + 1,
          };
        }));
        
        addMessage('Deloppgave fullført', 'success', event.agentId);
        break;

      case 'stream_ended':
        setPhase(4);
        addMessage('Oppgaven er fullført!', 'complete');
        break;
    }
  }, [addMessage, agents]);

  // Oppdater selectedAgent når agents endres
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find(a => a.id === selectedAgent.id);
      if (updated) {
        setSelectedAgent(updated);
      }
    }
  }, [agents, selectedAgent?.id]);

  // Grupper agenter etter rolle
  const agentsByRole = useMemo(() => {
    const grouped = { manager: [], researcher: [], developer: [], writer: [], editor: [] };
    agents.forEach(agent => {
      if (grouped[agent.role]) {
        grouped[agent.role].push(agent);
      }
    });
    return grouped;
  }, [agents]);

  const workingCount = agents.filter(a => a.status === 'working').length;

  return (
    <div style={styles.app}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>AI Arbeidsprosess</h1>
          <p style={styles.subtitle}>Se hvordan oppgaver løses steg for steg</p>
        </div>
        <StatusBadge connected={connected} phase={phase} />
      </header>

      {/* Main content */}
      <div style={styles.content}>
        {/* Left panel - Process */}
        <aside style={styles.processPanel}>
          <PhaseList phase={phase} />
          
          <div style={styles.statsGrid}>
            <StatBox label="Fullført" value={stats.tasks} color="#10B981" />
            <StatBox label="Aktive" value={workingCount} color="#3B82F6" />
            <StatBox label="Tid" value={formatTime(stats.time)} color="#8B5CF6" />
          </div>

          <ConceptList />
        </aside>

        {/* Center - Visualization */}
        <main style={styles.main}>
          <div style={styles.workspace}>
            {/* Coordinator row */}
            <AgentRow 
              label="Ledelse" 
              agents={agentsByRole.manager} 
              role="manager"
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />

            {/* Analysis row */}
            <AgentRow 
              label="Analyse" 
              agents={agentsByRole.researcher} 
              role="researcher"
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />

            {/* Execution row */}
            <AgentRow 
              label="Utførelse" 
              agents={agentsByRole.developer} 
              role="developer"
              selectedAgent={selectedAgent}
              onSelect={setSelectedAgent}
            />

            {/* Production row */}
            <div style={styles.row}>
              <div style={styles.rowLabel}>Produksjon</div>
              <div style={styles.agentRow}>
                {agentsByRole.writer.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent}
                    isSelected={selectedAgent?.id === agent.id}
                    onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                  />
                ))}
                {agentsByRole.writer.length === 0 && <EmptySlot role="writer" />}
                
                {agentsByRole.editor.map(agent => (
                  <AgentCard 
                    key={agent.id} 
                    agent={agent}
                    isSelected={selectedAgent?.id === agent.id}
                    onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
                  />
                ))}
                {agentsByRole.editor.length === 0 && <EmptySlot role="editor" />}
              </div>
            </div>

            {/* Empty state */}
            {agents.length === 0 && (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                  </svg>
                </div>
                <h3 style={styles.emptyTitle}>Venter på oppgave</h3>
                <p style={styles.emptyText}>Kjør Claude Code for å se arbeidsprosessen</p>
                <code style={styles.emptyCode}>
                  claude --output-format stream-json --verbose | node bridge.js
                </code>
              </div>
            )}
          </div>
        </main>

        {/* Right panel - Detail & Activity */}
        <aside style={styles.detailPanel}>
          {selectedAgent ? (
            <AgentDetail 
              agent={selectedAgent} 
              onClose={() => setSelectedAgent(null)} 
            />
          ) : (
            <DefaultDetail agents={agents} onSelect={setSelectedAgent} />
          )}
          
          <ActivityFeed messages={messages} agents={agents} onAgentClick={setSelectedAgent} />
        </aside>
      </div>
    </div>
  );
}

// --- Components ---

function StatusBadge({ connected, phase }) {
  const states = [
    { label: 'Klar', color: '#6B7280' },
    { label: 'Starter', color: '#8B5CF6' },
    { label: 'Fordeler', color: '#3B82F6' },
    { label: 'Arbeider', color: '#10B981' },
    { label: 'Fullført', color: '#10B981' },
  ];
  
  const state = connected ? states[Math.min(phase, 4)] : { label: 'Kobler til...', color: '#EF4444' };
  
  return (
    <div style={{
      ...styles.badge,
      backgroundColor: `${state.color}15`,
      color: state.color,
    }}>
      <span style={{
        ...styles.badgeDot,
        backgroundColor: state.color,
        animation: connected && phase > 0 && phase < 4 ? 'pulse 2s infinite' : 'none',
      }} />
      {state.label}
    </div>
  );
}

function PhaseList({ phase }) {
  const phases = [
    { num: 1, label: 'Analyser', desc: 'Forstå oppgaven' },
    { num: 2, label: 'Fordel', desc: 'Sett sammen team' },
    { num: 3, label: 'Utfør', desc: 'Gjør arbeidet' },
    { num: 4, label: 'Lever', desc: 'Fullfør og valider' },
  ];

  return (
    <div style={styles.phaseList}>
      <h3 style={styles.panelTitle}>Prosess</h3>
      {phases.map(p => (
        <div 
          key={p.num} 
          style={{
            ...styles.phaseItem,
            opacity: phase >= p.num ? 1 : 0.4,
            backgroundColor: phase === p.num ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
          }}
        >
          <div style={{
            ...styles.phaseNum,
            backgroundColor: phase > p.num ? '#10B981' : phase === p.num ? '#8B5CF6' : 'rgba(255,255,255,0.1)',
            color: phase >= p.num ? '#fff' : 'rgba(255,255,255,0.4)',
          }}>
            {phase > p.num ? '✓' : p.num}
          </div>
          <div>
            <div style={styles.phaseLabel}>{p.label}</div>
            <div style={styles.phaseDesc}>{p.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={styles.statBox}>
      <div style={{ ...styles.statValue, color }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ConceptList() {
  return (
    <div style={styles.conceptSection}>
      <h3 style={styles.panelTitle}>Nøkkelkonsepter</h3>
      <div style={styles.conceptItem}>
        <div style={{ ...styles.conceptDot, backgroundColor: '#8B5CF6' }} />
        <div>
          <strong>Spesialisering</strong>
          <p style={styles.conceptText}>Hver agent har én ekspertise</p>
        </div>
      </div>
      <div style={styles.conceptItem}>
        <div style={{ ...styles.conceptDot, backgroundColor: '#3B82F6' }} />
        <div>
          <strong>Parallellitet</strong>
          <p style={styles.conceptText}>Flere kan jobbe samtidig</p>
        </div>
      </div>
      <div style={styles.conceptItem}>
        <div style={{ ...styles.conceptDot, backgroundColor: '#10B981' }} />
        <div>
          <strong>Koordinering</strong>
          <p style={styles.conceptText}>Én leder styrer arbeidet</p>
        </div>
      </div>
    </div>
  );
}

function AgentRow({ label, agents, role, selectedAgent, onSelect }) {
  return (
    <div style={styles.row}>
      <div style={styles.rowLabel}>{label}</div>
      <div style={styles.agentRow}>
        {agents.length > 0 ? (
          agents.map(agent => (
            <AgentCard 
              key={agent.id} 
              agent={agent}
              isSelected={selectedAgent?.id === agent.id}
              onClick={() => onSelect(selectedAgent?.id === agent.id ? null : agent)}
            />
          ))
        ) : (
          <EmptySlot role={role} />
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, isSelected, onClick }) {
  const role = ROLES[agent.role];
  const isWorking = agent.status === 'working';

  return (
    <div 
      style={{
        ...styles.agentCard,
        borderColor: isSelected ? role.color : isWorking ? `${role.color}60` : 'rgba(255,255,255,0.08)',
        backgroundColor: isSelected ? `${role.color}15` : isWorking ? `${role.color}08` : 'rgba(255,255,255,0.02)',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={onClick}
    >
      {/* Working indicator */}
      {isWorking && (
        <div style={styles.workingIndicator}>
          <div style={{ ...styles.workingBar, backgroundColor: role.color }} />
        </div>
      )}

      {/* Icon */}
      <div style={{
        ...styles.agentIcon,
        backgroundColor: role.color,
        boxShadow: isWorking ? `0 4px 20px ${role.color}40` : 'none',
      }}>
        <RoleIcon role={agent.role} />
      </div>

      {/* Info */}
      <div style={styles.agentInfo}>
        <div style={styles.agentTitle}>{agent.name}</div>
        <div style={styles.agentStatus}>
          {isWorking ? simplifyTask(agent.currentTask) : `${agent.tasksCompleted} oppgaver fullført`}
        </div>
      </div>

      {/* Task count badge */}
      {agent.tasksCompleted > 0 && (
        <div style={{...styles.taskBadge, backgroundColor: `${role.color}20`, color: role.color}}>
          {agent.tasksCompleted}
        </div>
      )}

      {/* Status dot */}
      <div style={{
        ...styles.statusDot,
        backgroundColor: isWorking ? '#10B981' : '#6B7280',
      }} />
    </div>
  );
}

function EmptySlot({ role }) {
  const roleInfo = ROLES[role];
  return (
    <div style={styles.emptySlot}>
      <div style={styles.emptySlotIcon}>
        <RoleIcon role={role} />
      </div>
      <span style={styles.emptySlotLabel}>{roleInfo.title}</span>
    </div>
  );
}

function RoleIcon({ role }) {
  const icons = {
    manager: <path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"/>,
    researcher: <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></>,
    developer: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
    writer: <path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586"/>,
    editor: <path d="M20 6L9 17l-5-5"/>,
  };

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {icons[role]}
    </svg>
  );
}

function AgentDetail({ agent, onClose }) {
  const role = ROLES[agent.role];
  const isWorking = agent.status === 'working';
  
  return (
    <div style={styles.detail}>
      <div style={styles.detailHeader}>
        <div>
          <h3 style={styles.detailTitle}>{agent.name}</h3>
          <p style={styles.detailRole}>{role.title}</p>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      
      {/* Status */}
      <div style={{
        ...styles.statusCard,
        backgroundColor: isWorking ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
        borderColor: isWorking ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)',
      }}>
        <div style={styles.statusHeader}>
          <div style={{
            ...styles.statusIndicator,
            backgroundColor: isWorking ? '#10B981' : '#6B7280',
          }} />
          <span style={styles.statusText}>
            {isWorking ? 'Jobber nå' : 'Inaktiv'}
          </span>
        </div>
        {isWorking && agent.currentTask && (
          <p style={styles.currentTask}>{simplifyTask(agent.currentTask)}</p>
        )}
      </div>

      {/* Stats */}
      <div style={styles.agentStats}>
        <div style={styles.agentStat}>
          <span style={styles.agentStatValue}>{agent.tasksCompleted}</span>
          <span style={styles.agentStatLabel}>Fullført</span>
        </div>
        <div style={styles.agentStat}>
          <span style={styles.agentStatValue}>{agent.taskHistory.length}</span>
          <span style={styles.agentStatLabel}>Totalt</span>
        </div>
        <div style={styles.agentStat}>
          <span style={styles.agentStatValue}>{formatDuration(Date.now() - agent.joinedAt)}</span>
          <span style={styles.agentStatLabel}>Aktiv</span>
        </div>
      </div>

      {/* Task history */}
      <div style={styles.taskHistory}>
        <h4 style={styles.taskHistoryTitle}>Oppgavehistorikk</h4>
        {agent.taskHistory.length === 0 ? (
          <p style={styles.noTasks}>Ingen oppgaver ennå</p>
        ) : (
          <div style={styles.taskList}>
            {agent.taskHistory.map((task, i) => (
              <div key={i} style={styles.taskItem}>
                <div style={{
                  ...styles.taskStatus,
                  backgroundColor: task.status === 'completed' ? '#10B981' : '#F59E0B',
                }}>
                  {task.status === 'completed' ? '✓' : '●'}
                </div>
                <div style={styles.taskContent}>
                  <p style={styles.taskText}>{task.simplified}</p>
                  <span style={styles.taskTime}>
                    {task.startedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    {task.completedAt && ` → ${task.completedAt.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role explanation */}
      <div style={styles.roleExplainer}>
        <h4 style={styles.roleExplainerTitle}>Om denne rollen</h4>
        <p style={styles.roleExplainerText}>{role.detail}</p>
        <div style={styles.analogyBox}>
          <span style={styles.analogyIcon}>💡</span>
          <p style={styles.analogyText}>{getAnalogy(agent.role)}</p>
        </div>
      </div>
    </div>
  );
}

function DefaultDetail({ agents, onSelect }) {
  return (
    <div style={styles.detail}>
      <h3 style={styles.detailTitle}>Velg en agent</h3>
      <p style={styles.detailDesc}>
        Klikk på en agent for å se deres spesifikke oppgaver og arbeidshistorikk.
      </p>
      
      {agents.length > 0 && (
        <div style={styles.agentList}>
          <h4 style={styles.agentListTitle}>Aktive agenter</h4>
          {agents.map(agent => {
            const role = ROLES[agent.role];
            return (
              <div 
                key={agent.id} 
                style={styles.agentListItem}
                onClick={() => onSelect(agent)}
              >
                <div style={{...styles.agentListDot, backgroundColor: role.color}} />
                <span style={styles.agentListName}>{agent.name}</span>
                <span style={styles.agentListTasks}>{agent.tasksCompleted} oppgaver</span>
              </div>
            );
          })}
        </div>
      )}
      
      <div style={styles.rolePreview}>
        <h4 style={styles.rolePreviewTitle}>Roller</h4>
        {Object.entries(ROLES).map(([key, role]) => (
          <div key={key} style={styles.rolePreviewItem}>
            <div style={{ ...styles.rolePreviewDot, backgroundColor: role.color }} />
            <span>{role.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityFeed({ messages, agents, onAgentClick }) {
  return (
    <div style={styles.feed}>
      <h3 style={styles.panelTitle}>Aktivitet</h3>
      <div style={styles.feedList}>
        {messages.length === 0 ? (
          <p style={styles.feedEmpty}>Venter på aktivitet...</p>
        ) : (
          messages.map(msg => {
            const agent = msg.agentId ? agents.find(a => a.id === msg.agentId) : null;
            const role = agent ? ROLES[agent.role] : null;
            
            return (
              <div 
                key={msg.id} 
                style={{
                  ...styles.feedItem,
                  cursor: agent ? 'pointer' : 'default',
                }}
                onClick={() => agent && onAgentClick(agent)}
              >
                <div style={{
                  ...styles.feedDot,
                  backgroundColor: role?.color || (
                    msg.type === 'success' ? '#10B981' : 
                    msg.type === 'join' ? '#8B5CF6' : '#3B82F6'
                  ),
                }} />
                <div style={styles.feedContent}>
                  {agent && (
                    <span style={{...styles.feedAgent, color: role.color}}>
                      {agent.name}
                    </span>
                  )}
                  <span style={styles.feedText}>{msg.text}</span>
                </div>
                <span style={styles.feedTime}>
                  {msg.time.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- Helpers ---

function mapRole(role) {
  const map = { manager: 'manager', researcher: 'researcher', developer: 'developer', writer: 'writer', editor: 'editor', worker: 'developer' };
  return map[role] || 'developer';
}

function simplifyTask(task) {
  if (!task) return 'Arbeider...';
  const t = task.toLowerCase();
  if (t.includes('read') || t.includes('les')) return 'Analyserer innhold...';
  if (t.includes('search') || t.includes('søk')) return 'Søker informasjon...';
  if (t.includes('write') || t.includes('skriv')) return 'Skriver innhold...';
  if (t.includes('edit') || t.includes('endre')) return 'Forbedrer innhold...';
  if (t.includes('bash') || t.includes('run')) return 'Kjører kommando...';
  if (t.includes('test')) return 'Tester løsning...';
  return 'Arbeider...';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}t`;
}

function getAnalogy(role) {
  const analogies = {
    manager: 'Som en prosjektleder som fordeler oppgaver i et team.',
    researcher: 'Som en konsulent som gjør research før et prosjekt.',
    developer: 'Som en håndverker som utfører selve arbeidet.',
    writer: 'Som en forfatter som skaper innhold fra bunnen.',
    editor: 'Som en redaktør som polerer et manuskript.',
  };
  return analogies[role];
}

// --- Styles ---

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0f',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },

  // Header
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft: {},
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },

  // Content
  content: {
    display: 'grid',
    gridTemplateColumns: '240px 1fr 320px',
    flex: 1,
    minHeight: 0,
  },

  // Process panel
  processPanel: {
    padding: 20,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    overflow: 'auto',
  },
  panelTitle: {
    margin: '0 0 12px',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  phaseList: {},
  phaseItem: {
    display: 'flex',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 8,
    marginBottom: 4,
    transition: 'all 0.2s ease',
  },
  phaseNum: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
    transition: 'all 0.2s ease',
  },
  phaseLabel: {
    fontSize: 14,
    fontWeight: 600,
  },
  phaseDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },

  // Stats
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  statBox: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    marginTop: 4,
  },

  // Concepts
  conceptSection: {},
  conceptItem: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  conceptDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    marginTop: 6,
    flexShrink: 0,
  },
  conceptText: {
    margin: '4px 0 0',
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },

  // Main workspace
  main: {
    padding: 24,
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    gap: 16,
    alignItems: 'flex-start',
  },
  rowLabel: {
    width: 80,
    paddingTop: 16,
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    flexShrink: 0,
  },
  agentRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },

  // Agent card
  agentCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 220,
    flex: '0 1 auto',
  },
  workingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  workingBar: {
    height: '100%',
    width: '30%',
    borderRadius: 2,
    animation: 'loading 1.5s ease-in-out infinite',
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    flexShrink: 0,
    transition: 'box-shadow 0.2s ease',
  },
  agentInfo: {
    flex: 1,
    minWidth: 0,
  },
  agentTitle: {
    fontSize: 14,
    fontWeight: 600,
  },
  agentStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  taskBadge: {
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },

  // Empty slot
  emptySlot: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 12,
    border: '1.5px dashed rgba(255,255,255,0.1)',
    minWidth: 220,
    opacity: 0.5,
  },
  emptySlotIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.3)',
  },
  emptySlotLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // Empty state
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 40,
  },
  emptyIcon: {
    color: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyText: {
    margin: '8px 0 20px',
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyCode: {
    padding: '12px 20px',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    fontSize: 12,
    color: '#10B981',
    fontFamily: 'SF Mono, Monaco, monospace',
  },

  // Detail panel
  detailPanel: {
    padding: 20,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  detail: {
    paddingBottom: 20,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    marginBottom: 20,
    overflow: 'auto',
    flex: '0 1 auto',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
  },
  detailRole: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  detailDesc: {
    margin: '0 0 16px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 24,
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },

  // Status card
  statusCard: {
    padding: 14,
    borderRadius: 10,
    border: '1px solid',
    marginBottom: 16,
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusText: {
    fontSize: 13,
    fontWeight: 600,
  },
  currentTask: {
    margin: '10px 0 0',
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },

  // Agent stats
  agentStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
    marginBottom: 16,
  },
  agentStat: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    textAlign: 'center',
  },
  agentStatValue: {
    display: 'block',
    fontSize: 18,
    fontWeight: 700,
    color: '#fff',
  },
  agentStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
  },

  // Task history
  taskHistory: {
    marginBottom: 16,
  },
  taskHistoryTitle: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  noTasks: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  taskItem: {
    display: 'flex',
    gap: 10,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
  },
  taskStatus: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: '#fff',
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskText: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  taskTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'SF Mono, Monaco, monospace',
  },

  // Role explainer
  roleExplainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  roleExplainerTitle: {
    margin: '0 0 8px',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  roleExplainerText: {
    margin: '0 0 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
  },
  analogyBox: {
    display: 'flex',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
  },
  analogyIcon: {
    fontSize: 16,
  },
  analogyText: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.4,
  },

  // Agent list in default detail
  agentList: {
    marginBottom: 20,
  },
  agentListTitle: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  agentListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 8,
    marginBottom: 6,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  agentListDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  agentListName: {
    flex: 1,
    fontSize: 13,
    fontWeight: 500,
  },
  agentListTasks: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },

  // Role preview
  rolePreview: {
    marginTop: 16,
  },
  rolePreviewTitle: {
    margin: '0 0 10px',
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  rolePreviewItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  rolePreviewDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },

  // Feed
  feed: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
  },
  feedList: {
    flex: 1,
    overflow: 'auto',
  },
  feedEmpty: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },
  feedItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    transition: 'background-color 0.2s ease',
  },
  feedDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    marginTop: 6,
    flexShrink: 0,
  },
  feedContent: {
    flex: 1,
    minWidth: 0,
  },
  feedAgent: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 2,
  },
  feedText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 1.4,
  },
  feedTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'SF Mono, Monaco, monospace',
    flexShrink: 0,
  },
};

// Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
  *::-webkit-scrollbar { width: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
`;
document.head.appendChild(styleSheet);
