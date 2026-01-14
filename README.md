# Claude Office Visualizer

Sometimes I wonder what Claude is actually doing when it works. When you give it a task, it sends out a stream of messages like "reading this file", "running this command", "writing new code". But it's just text flying by.

So I built this. An app that captures those messages and turns them into something visual. Imagine looking into a glass office building where you can see everyone working. Every time Claude uses a tool, a new "agent" appears on screen. It's like a reality show from an office. You see who's doing what, who's talking to whom, and when things get done.

**In short:**
1. You give Claude a task
2. Claude sends out live updates
3. The app catches them and draws agents in a virtual office

## The Agents

- **Manager**: The boss keeping track of everything
- **Developers**: Running bash commands and building stuff
- **Researchers**: Digging through files and searching for info
- **Writers**: Writing new code from scratch
- **Editors**: Fixing and improving existing code

They talk to each other, pick up new skills, and deliver work. All in real time.

---

## Step by Step Guide

### Step 1: Prerequisites

Make sure you have installed:
- **Node.js** (v18 or newer): [nodejs.org](https://nodejs.org)
- **Claude Code CLI**: [docs.anthropic.com](https://docs.anthropic.com)

Check that everything is installed:
```bash
node --version    # Should show v18.x.x or higher
claude --version  # Should show Claude Code version
```

### Step 2: Copy the Project

Copy the entire `claude-office-viz` folder to your preferred location:

```bash
cp -r claude-office-viz ~/claude-office-viz
cd ~/claude-office-viz
```

### Step 3: Install Dependencies

Run these commands:

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Step 4: Start the Visualization

You need **3 terminal windows**:

#### Terminal 1: Start WebSocket Bridge
```bash
cd ~/claude-office-viz/server
node bridge.js
```

You'll see:
```
Claude Office Bridge started on port 3001
Waiting for WebSocket connections...
```

#### Terminal 2: Start the React App
```bash
cd ~/claude-office-viz/client
npm run dev
```

Open your browser at: **http://localhost:3000**

#### Terminal 3: Run Claude Code with JSON Output
```bash
claude --output-format stream-json | node ~/claude-office-viz/server/bridge.js
```

**Or** just test with demo mode:
If you don't pipe Claude Code output, bridge.js will automatically start demo mode after 3 seconds.

---

## How to Use It

### Demo Mode (for testing)

1. Just start bridge.js without piping anything to it
2. Open the visualization in your browser
3. After 3 seconds, demo mode starts automatically

### Live Mode (with real Claude Code)

1. Start bridge and visualization as described above
2. In a new window, run Claude Code with JSON output:

```bash
claude --output-format stream-json "write a simple python script" 2>&1 | node ~/claude-office-viz/server/bridge.js
```

3. Watch the agents work in real time in your browser!

---

## Architecture

```
┌─────────────────┐     JSON stream      ┌──────────────────┐
│   Claude Code   │ ──────────────────▶  │   bridge.js      │
│   (CLI)         │                      │   (Node.js)      │
└─────────────────┘                      └────────┬─────────┘
                                                  │ WebSocket
                                                  ▼
                                         ┌──────────────────┐
                                         │   React App      │
                                         │   (Browser)      │
                                         └──────────────────┘
```

### Components

| Component | Port | Description |
|-----------|------|-------------|
| bridge.js | 3001 | WebSocket server that parses Claude Code output |
| React App | 3000 | Office visualization |

### Event Types

Bridge.js sends these events to the client:

| Event | Description |
|-------|-------------|
| `agent_joined` | New agent has joined the office |
| `agent_updated` | Agent has changed status/task |
| `work_completed` | Agent has completed a task |
| `communication` | Communication between agents |
| `new_task` | New task received from user |

---

## Customization

### Change Colors

In `bridge.js`, edit the `AGENT_COLORS` array:

```javascript
const AGENT_COLORS = [
  '#FF6B6B',  // Red
  '#4ECDC4',  // Teal
  '#45B7D1',  // Blue
  // Add more...
];
```

### Add New Agent Roles

In `bridge.js`, extend the `getAgentRole()` function:

```javascript
function getAgentRole(toolName) {
  const roles = {
    'bash': 'developer',
    'MyCustomTool': 'specialist',  // Add new
    // ...
  };
  return roles[toolName] || 'worker';
}
```

### Modify the Visualization

Edit `client/src/App.jsx` to:
- Change layout and positioning
- Add new animations
- Change agent avatars and icons

---

## Troubleshooting

### "Disconnected" in the Visualization

1. Check that bridge.js is running
2. Check that port 3001 isn't blocked by firewall
3. Try refreshing the browser

### No Agents Showing

1. Wait 3 seconds for demo mode
2. Or run Claude Code with `--output-format stream-json`

### Claude Code Gives Error

Make sure you have the right version of Claude Code:
```bash
claude --help | grep output-format
```

---

## File Structure

```
claude-office-viz/
├── server/
│   ├── package.json
│   └── bridge.js          # WebSocket bridge
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       └── App.jsx         # React visualization
├── start.sh                # Convenience script
└── README.md
```

---

## License

MIT. Do whatever you want with it!

---

Follow me for more sideways looks at the AI world: [LinkedIn](https://www.linkedin.com/in/anders-solstad/)

Made with ❤️ and Claude
