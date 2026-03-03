# draw.io AI Chat Plugin

A draw.io plugin that adds an **AI-powered right sidebar** (Google Gemini) which
reads your diagram and can create, modify, or delete elements on your behalf.

> **Repository:** <https://github.com/alb321/aiskemas>

---

## Features

| Capability | Description |
|---|---|
| **Graph-aware context** | The AI always receives a JSON snapshot of all current nodes and edges |
| **Create nodes** | Add shapes with labels, positions, and styles |
| **Create edges** | Connect two existing nodes by their labels |
| **Delete elements** | Remove nodes or edges by label |
| **Rename elements** | Change any node or edge label |
| **Restyle elements** | Apply draw.io CSS-style properties (fill colour, font, etc.) |
| **Auto-layout** | Rearrange the whole diagram (organic, tree, horizontal tree, circle) |
| **Persistent chat history** | Context is maintained across the whole session |

---

## Installation

> **Requirements:** The plugin works with the **web version** (`app.diagrams.net`)
> or a **self-hosted Docker** instance. It does **not** work with draw.io Desktop,
> Confluence, or Jira.

### Option A – One-click (hosted on GitHub)

Click the link below to open draw.io with the plugin already loaded:

```
https://app.diagrams.net/?plugins=1&p=https%3A%2F%2Fraw.githubusercontent.com%2Falb321%2Faiskemas%2Fmain%2Faichat.js
```

Or use the raw file URL directly in any host-via-URL workflow:

```
https://raw.githubusercontent.com/alb321/aiskemas/main/aichat.js
```

### Option B – Load as a custom plugin (permanent)

1. In draw.io: **Extras → Edit Diagram → Plugins tab** (or **Extras → Load Plugin…**).
2. Paste the raw URL above and click **OK / Apply**.
3. Reload the tab.

### Option C – Local development server (quick test)

> Use this when you want to test local edits to `aichat.js` before pushing.

```bash
# from the project folder
npx serve .
# then open: https://app.diagrams.net/?plugins=1&p=http://localhost:3000/aichat.js
```

---

## First-time setup

1. Click **Extras → AI Chat Assistant** to open the sidebar.
2. Click **Set Key** and enter your [Google Gemini API key](https://aistudio.google.com/app/apikey).
   - The key is stored in `localStorage` in your browser — it never leaves your machine.

---

## Usage examples

| You type | What happens |
|---|---|
| `Add a node called "Database"` | A new rounded rectangle labelled "Database" is inserted |
| `Connect "User" to "Database"` | An edge is drawn between the two nodes |
| `Delete the Cache node` | The "Cache" node is removed |
| `Make the Server node red` | The Server node's fill becomes red |
| `Rename "API" to "REST API"` | The label is updated |
| `Auto-layout as a tree` | Nodes are rearranged in a vertical tree |
| `What nodes are in the diagram?` | AI answers without modifying the diagram |

---

## Architecture

```
plugin (aichat.js)
│
├── getGraphContext()      → serialises nodes+edges to JSON
├── buildGeminiPayload()   → injects context + chat history into Gemini request
├── callGemini()           → POST to Gemini 2.0 Flash REST API
├── executeCommands()      → applies returned commands to the mxGraph model
└── Chat panel UI          → right-sidebar with input, history, key management
```

The AI is instructed (via a system prompt) to always return a strict JSON object:

```json
{
  "message": "Human-readable explanation",
  "commands": [
    { "type": "create_node", "label": "DB", "x": 300, "y": 200 },
    { "type": "create_edge", "source_label": "API", "target_label": "DB" }
  ]
}
```

---

## References

- draw.io plugin documentation: <https://www.drawio.com/doc/faq/plugins>
- draw.io built-in plugin examples: <https://github.com/jgraph/drawio/tree/dev/src/main/webapp/plugins>
- Google Gemini API: <https://ai.google.dev/gemini-api/docs>
- Gemini API key: <https://aistudio.google.com/app/apikey>
