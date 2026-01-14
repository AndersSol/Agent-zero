# Claude Office Visualizer

Noen ganger lurer jeg på hva Claude egentlig driver med når den jobber. Så jeg lagde dette - en real-time visualisering hvor du kan se Claude Code som et team av agenter som husjer rundt i et lite virtuelt kontor.

## Hva er greia?

Når Claude Code kjører, dukker det opp agenter basert på hva den gjør:
- **Manager** - Sjefen som holder styr på alt
- **Developers** - Kjører bash-kommandoer og bygger ting
- **Researchers** - Graver rundt i filer og søker etter info
- **Writers** - Skriver ny kode fra scratch
- **Editors** - Fikser og forbedrer eksisterende kode

De snakker med hverandre, plukker opp nye skills, og leverer arbeid - og du ser alt live!

---

## Hvordan fungerer det egentlig?

Tenk deg at du ser på et glassbygning-kontor utenfra, hvor du kan se alle som jobber inne.

Når du gir Claude en oppgave, sender den ut en strøm av meldinger om hva den gjør akkurat nå - "jeg leser denne filen", "jeg kjører denne kommandoen", "jeg skriver ny kode". Normalt er dette bare tekst som flyr forbi.

Denne appen fanger opp disse meldingene og oversetter dem til visuelle figurer. Hver gang Claude bruker et verktøy - som å lese en fil eller kjøre en kommando - dukker det opp en ny "agent" på skjermen som representerer den oppgaven.

**Flyten er:**
1. Du gir Claude en oppgave
2. Claude sender ut live-oppdateringer om hva den gjør
3. En "bro" (bridge.js) fanger opp disse oppdateringene
4. Broen sender dem videre til en nettside som tegner agentene

Det er litt som å se et reality-show fra et kontor - du ser hvem som gjør hva, hvem som snakker med hvem, og når ting blir ferdig.

---

## Steg-for-steg guide

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
Claude Office Bridge startet på port 3001
Venter på WebSocket-tilkoblinger...
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

## Slik bruker du det

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

## Arkitektur

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

## Tilpasning

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

## Feilsøking

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

## Filstruktur

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

## Lisens

MIT - Bruk det som du vil!

---

Følg meg for flere skråblikk på AI verden: [LinkedIn](https://www.linkedin.com/in/anders-solstad/)

Laget med ❤️ og Claude
