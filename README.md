# 🏢 Claude Office Visualizer

En real-time visualisering av Claude Code som et team av agenter som jobber sammen i et kontor.

## Hva gjør dette?

Når du kjører Claude Code, visualiseres aktiviteten som:
- 👔 **Manager** - Hovedagenten som koordinerer arbeidet
- 💻 **Developers** - Agenter som kjører bash-kommandoer
- 🔍 **Researchers** - Agenter som søker og leser filer
- ✍️ **Writers** - Agenter som skriver ny kode
- 📝 **Editors** - Agenter som redigerer eksisterende filer

Agentene kommuniserer med hverandre, får nye skills, og leverer ferdig arbeid - alt i sanntid!

---

## 📋 Steg-for-steg guide

### Steg 1: Forutsetninger

Sørg for at du har installert:
- **Node.js** (v18 eller nyere) - [nodejs.org](https://nodejs.org)
- **Claude Code CLI** - [docs.anthropic.com](https://docs.anthropic.com)

Sjekk at alt er installert:
```bash
node --version    # Bør vise v18.x.x eller høyere
claude --version  # Bør vise Claude Code versjon
```

### Steg 2: Kopier prosjektet

Kopier hele `claude-office-viz` mappen til ønsket lokasjon:

```bash
# Eksempel: kopier til hjemmemappen din
cp -r claude-office-viz ~/claude-office-viz
cd ~/claude-office-viz
```

### Steg 3: Installer avhengigheter

Kjør disse kommandoene:

```bash
# Installer server-avhengigheter
cd server
npm install

# Installer klient-avhengigheter
cd ../client
npm install
```

### Steg 4: Start visualiseringen

Du trenger **3 terminal-vinduer**:

#### Terminal 1: Start WebSocket Bridge
```bash
cd ~/claude-office-viz/server
node bridge.js
```

Du vil se:
```
🏢 Claude Office Bridge startet på port 3001
📡 Venter på WebSocket-tilkoblinger...
```

#### Terminal 2: Start React-appen
```bash
cd ~/claude-office-viz/client
npm run dev
```

Åpne nettleseren på: **http://localhost:3000**

#### Terminal 3: Kjør Claude Code med JSON output
```bash
claude --output-format stream-json | node ~/claude-office-viz/server/bridge.js
```

**Alternativt** - bare test med demo-modus:
Hvis du ikke piper Claude Code output, vil bridge.js automatisk starte demo-modus etter 3 sekunder.

---

## 🎮 Slik bruker du det

### Demo-modus (for testing)

1. Start bare bridge.js uten å pipe noe til den
2. Åpne visualiseringen i nettleseren
3. Etter 3 sekunder starter demo-modus automatisk

### Live-modus (med ekte Claude Code)

1. Start bridge og visualisering som beskrevet over
2. I et nytt vindu, kjør Claude Code med JSON output:

```bash
claude --output-format stream-json "lag en enkel python script" 2>&1 | node ~/claude-office-viz/server/bridge.js
```

3. Se agentene jobbe i sanntid i nettleseren!

---

## 🔧 Arkitektur

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

### Komponenter

| Komponent | Port | Beskrivelse |
|-----------|------|-------------|
| bridge.js | 3001 | WebSocket server som parser Claude Code output |
| React App | 3000 | Visualisering av kontoret |

### Event-typer

Bridge.js sender disse eventene til klienten:

| Event | Beskrivelse |
|-------|-------------|
| `agent_joined` | Ny agent har kommet til kontoret |
| `agent_updated` | Agent har endret status/oppgave |
| `work_completed` | Agent har fullført en oppgave |
| `communication` | Kommunikasjon mellom agenter |
| `new_task` | Ny oppgave mottatt fra bruker |

---

## 🎨 Tilpasning

### Endre farger

I `bridge.js`, endre `AGENT_COLORS` arrayet:

```javascript
const AGENT_COLORS = [
  '#FF6B6B',  // Rød
  '#4ECDC4',  // Turkis
  '#45B7D1',  // Blå
  // Legg til flere...
];
```

### Legge til nye agent-roller

I `bridge.js`, utvid `getAgentRole()` funksjonen:

```javascript
function getAgentRole(toolName) {
  const roles = {
    'bash': 'developer',
    'MyCustomTool': 'specialist',  // Legg til ny
    // ...
  };
  return roles[toolName] || 'worker';
}
```

### Endre visualiseringen

Rediger `client/src/App.jsx` for å:
- Endre layout og posisjonering
- Legge til nye animasjoner
- Endre agent-avatarer og ikoner

---

## 🐛 Feilsøking

### "Frakoblet" i visualiseringen

1. Sjekk at bridge.js kjører
2. Sjekk at port 3001 ikke er blokkert av brannmur
3. Prøv å refreshe nettleseren

### Ingen agenter vises

1. Vent 3 sekunder for demo-modus
2. Eller kjør Claude Code med `--output-format stream-json`

### Claude Code gir feilmelding

Sørg for at du har riktig versjon av Claude Code:
```bash
claude --help | grep output-format
```

---

## 📁 Filstruktur

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
│       └── App.jsx         # React visualisering
├── start.sh                # Convenience script
└── README.md
```

---

## 🚀 Neste steg

Ideer for utvidelser:
- [ ] Legg til lyd-effekter når agenter jobber
- [ ] Vis en tidslinje over fullførte oppgaver
- [ ] Legg til "kontor-møbler" som agenter kan sitte ved
- [ ] Implementer drag-and-drop for å flytte agenter
- [ ] Koble til flere Claude Code-instanser samtidig

---

## 📜 Lisens

MIT - Bruk det som du vil!

---

Laget med ❤️ og Claude
