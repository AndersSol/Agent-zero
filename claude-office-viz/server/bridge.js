#!/usr/bin/env node

/**
 * Claude Office Bridge
 * 
 * Parser Claude Code JSON stream output og sender events til visualiseringen.
 * 
 * Bruk: claude --output-format stream-json | node bridge.js
 */

const WebSocket = require('ws');
const readline = require('readline');

const PORT = 3001;
const wss = new WebSocket.Server({ port: PORT });

// Hold styr på alle agenter og deres tilstand
const agents = new Map();
let agentIdCounter = 0;

// Farger for agenter
const AGENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];

console.log(`🏢 Claude Office Bridge startet på port ${PORT}`);
console.log(`📡 Venter på WebSocket-tilkoblinger...`);
console.log(`\n💡 Tips: Pipe Claude Code output hit:`);
console.log(`   claude --output-format stream-json | node bridge.js\n`);

// Håndter WebSocket-tilkoblinger
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('✅ Ny klient tilkoblet');
  clients.add(ws);
  
  // Send nåværende tilstand til ny klient
  ws.send(JSON.stringify({
    type: 'init',
    agents: Array.from(agents.values())
  }));
  
  ws.on('close', () => {
    console.log('👋 Klient frakoblet');
    clients.delete(ws);
  });
});

// Broadcast til alle klienter
function broadcast(event) {
  const message = JSON.stringify(event);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Opprett ny agent
function createAgent(id, role = 'worker') {
  const agent = {
    id: id || `agent-${++agentIdCounter}`,
    role: role,
    color: AGENT_COLORS[agentIdCounter % AGENT_COLORS.length],
    status: 'idle',
    currentTask: null,
    skills: [],
    completedTasks: 0,
    x: 100 + Math.random() * 400,
    y: 100 + Math.random() * 300,
    createdAt: Date.now()
  };
  agents.set(agent.id, agent);
  
  broadcast({
    type: 'agent_joined',
    agent: agent
  });
  
  console.log(`👤 Ny agent: ${agent.id} (${role})`);
  return agent;
}

// Oppdater agent-status
function updateAgent(id, updates) {
  const agent = agents.get(id);
  if (agent) {
    Object.assign(agent, updates);
    broadcast({
      type: 'agent_updated',
      agent: agent
    });
  }
}

// Parser Claude Code events
function parseClaudeEvent(data) {
  try {
    const event = JSON.parse(data);
    
    switch (event.type) {
      case 'system':
        // System-meldinger - kan indikere oppstart
        if (event.subtype === 'init') {
          createAgent('main', 'manager');
        }
        break;
        
      case 'assistant':
        // Claude tenker eller responderer
        const mainAgent = agents.get('main') || createAgent('main', 'manager');
        updateAgent('main', {
          status: 'thinking',
          currentTask: 'Analyserer oppgave...'
        });
        
        // Sjekk for tool bruk i meldingen
        if (event.message?.content) {
          const content = event.message.content;
          if (Array.isArray(content)) {
            content.forEach(block => {
              if (block.type === 'tool_use') {
                handleToolUse(block);
              }
            });
          }
        }
        break;
        
      case 'user':
        // Ny oppgave fra bruker
        broadcast({
          type: 'new_task',
          task: {
            id: `task-${Date.now()}`,
            description: event.message?.content?.substring(0, 100) || 'Ny oppgave',
            timestamp: Date.now()
          }
        });
        break;
        
      case 'result':
        // Resultat fra tool
        handleToolResult(event);
        break;
    }
    
  } catch (e) {
    // Ignorer parsing-feil for ikke-JSON linjer
  }
}

// Håndter tool-bruk
function handleToolUse(block) {
  const toolName = block.name;
  const agentId = `tool-${toolName}-${Date.now()}`;
  
  // Opprett en "spesialist" agent for denne toolen
  const skills = getSkillsForTool(toolName);
  const agent = createAgent(agentId, getAgentRole(toolName));
  
  updateAgent(agentId, {
    status: 'working',
    currentTask: `Bruker ${toolName}`,
    skills: skills
  });
  
  broadcast({
    type: 'work_started',
    agentId: agentId,
    tool: toolName,
    input: block.input
  });
  
  console.log(`🔧 Tool: ${toolName}`);
}

// Håndter tool-resultat
function handleToolResult(event) {
  // Finn agent som jobbet med dette
  agents.forEach((agent, id) => {
    if (agent.status === 'working') {
      updateAgent(id, {
        status: 'completed',
        completedTasks: agent.completedTasks + 1,
        currentTask: null
      });
      
      broadcast({
        type: 'work_completed',
        agentId: id
      });
      
      // Sett tilbake til idle etter en stund
      setTimeout(() => {
        if (agents.has(id)) {
          updateAgent(id, { status: 'idle' });
        }
      }, 2000);
    }
  });
}

// Mapper tool til agent-rolle
function getAgentRole(toolName) {
  const roles = {
    'bash': 'developer',
    'Read': 'researcher',
    'Write': 'writer',
    'Edit': 'editor',
    'Glob': 'finder',
    'Grep': 'searcher',
    'LS': 'organizer',
    'TodoRead': 'planner',
    'TodoWrite': 'planner',
    'WebFetch': 'researcher',
    'WebSearch': 'researcher'
  };
  return roles[toolName] || 'worker';
}

// Mapper tool til skills
function getSkillsForTool(toolName) {
  const skillMap = {
    'bash': ['shell', 'scripting', 'automation'],
    'Read': ['file-reading', 'analysis'],
    'Write': ['file-creation', 'coding'],
    'Edit': ['refactoring', 'bug-fixing'],
    'Glob': ['pattern-matching', 'file-search'],
    'Grep': ['text-search', 'regex'],
    'WebFetch': ['web-scraping', 'data-fetching'],
    'WebSearch': ['research', 'information-gathering']
  };
  return skillMap[toolName] || ['general'];
}

// Les fra stdin (piped fra Claude Code)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  parseClaudeEvent(line);
});

rl.on('close', () => {
  console.log('\n📭 Input-strøm lukket');
  broadcast({ type: 'stream_ended' });
});

// Demo-modus hvis ingen input
let hasReceivedInput = false;
rl.on('line', () => { hasReceivedInput = true; });

setTimeout(() => {
  if (!hasReceivedInput && clients.size > 0) {
    console.log('🎭 Starter demo-modus...');
    runDemoMode();
  }
}, 3000);

// Demo-modus for testing
function runDemoMode() {
  const demoTasks = [
    { tool: 'Read', task: 'Leser prosjektfiler...' },
    { tool: 'bash', task: 'Kjører tester...' },
    { tool: 'Write', task: 'Skriver ny kode...' },
    { tool: 'Edit', task: 'Fikser bugs...' },
    { tool: 'WebSearch', task: 'Researcher løsninger...' }
  ];
  
  // Opprett main agent
  createAgent('main', 'manager');
  
  let taskIndex = 0;
  
  setInterval(() => {
    const task = demoTasks[taskIndex % demoTasks.length];
    const agentId = `demo-${task.tool}-${Date.now()}`;
    
    // Opprett worker
    const agent = createAgent(agentId, getAgentRole(task.tool));
    updateAgent(agentId, {
      status: 'working',
      currentTask: task.task,
      skills: getSkillsForTool(task.tool)
    });
    
    // Kommunikasjon mellom agenter
    setTimeout(() => {
      broadcast({
        type: 'communication',
        from: 'main',
        to: agentId,
        message: `Kan du ${task.task.toLowerCase()}`
      });
    }, 500);
    
    // Fullfør etter en stund
    setTimeout(() => {
      if (agents.has(agentId)) {
        updateAgent(agentId, {
          status: 'completed',
          completedTasks: 1
        });
        
        broadcast({
          type: 'work_completed',
          agentId: agentId
        });
        
        // Rapport tilbake til manager
        setTimeout(() => {
          broadcast({
            type: 'communication',
            from: agentId,
            to: 'main',
            message: 'Ferdig!'
          });
        }, 300);
      }
    }, 3000 + Math.random() * 2000);
    
    taskIndex++;
  }, 4000);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Avslutter...');
  wss.close();
  process.exit(0);
});
