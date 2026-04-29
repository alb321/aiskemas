# AISkemas

AI-powered study schema/concept-map builder.

## Stack

- **Framework:** Angular 19 + TypeScript
- **Diagram engine:** @joint/core (JointJS successor) — rectangles, arrows with manhattan routing
- **AI:** Azure AI Foundry via OpenAI SDK (client-side, pluggable)
- **Storage:** JSON export/import + localStorage autosave
- **Styling:** SCSS with CSS variables for dark/light theme

## Project Structure

```
src/app/
├── models/
│   ├── schema.model.ts       — Node, Edge, Schema interfaces + defaults
│   └── ai.model.ts           — AIProvider, AIRequest, AIResponse types
├── services/
│   ├── diagram.service.ts    — JointJS wrapper (CRUD nodes/edges, serialize, zoom, theme)
│   ├── ai.service.ts         — OpenAI SDK client, prompt building, response parsing
│   ├── file.service.ts       — JSON export/import + IndexedDB autosave
│   └── theme.service.ts      — Dark/light toggle, persists to localStorage, system pref default
├── components/
│   ├── canvas/               — JointJS paper container, double-click to add nodes
│   ├── toolbar/              — New/Open/Save, zoom, theme toggle, settings button
│   ├── ai-context-menu/      — Node right-click: generate children, describe, improve, summarize, delete
│   └── settings-panel/       — AI endpoint/key/model configuration modal
├── app.component.ts/html/scss — Layout shell, wires everything together
```

## Done (MVP Phase 1)

- [x] Angular 19 project scaffold
- [x] @joint/core + openai + uuid dependencies
- [x] Data models (Schema, Node, Edge, AI types)
- [x] DiagramService — add/remove/style nodes, add edges, serialize to/from JSON, zoom, theme
- [x] AIService — Azure AI Foundry via OpenAI SDK, configurable provider
- [x] FileService — JSON export/import, localStorage autosave
- [x] ThemeService — dark/light with CSS variables, system preference detection
- [x] CanvasComponent — JointJS paper, double-click to create nodes
- [x] ToolbarComponent — file ops, zoom, theme toggle, settings
- [x] AIContextMenuComponent — generate children, describe, improve, summarize
- [x] SettingsPanelComponent — configure AI provider/key/model
- [x] App layout wired up
- [x] CSS variables for all components (theme-aware)

## TODO (Phase 2+)

- [ ] Inline text editing on nodes (double-click node to edit text)
- [ ] Connection mode (click source → click target to draw arrow)
- [ ] Node style panel (color picker, font selector on selected node)
- [ ] Generate entire schema from text prompt (prompt modal)
- [ ] Auto-layout via Dagre integration
- [ ] Web search enrichment (Bing API → AI incorporates results)
- [ ] Gap detection ("you're missing X concept")
- [ ] Export to PNG/SVG/PDF
- [ ] Undo/Redo (JSON snapshot stack)
- [ ] PWA (service worker + manifest for offline/mobile install)
- [ ] Minimap + fit-to-content
- [ ] Keyboard shortcuts (Del to remove, Ctrl+S to save, etc.)
- [ ] Drag-select multiple nodes
- [ ] Node resize handles

## Dev Commands

```bash
npx ng serve        # dev server (http://localhost:4200)
npx ng build        # production build → dist/aiskemas
```

## AI Provider Config

Settings panel stores in localStorage (`aiskemas_ai_provider`):
- Endpoint: `https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/`
- API Key: sent as both `Authorization: Bearer` and `api-key` header
- Model: e.g. `gpt-4o`

## Notes

- JointJS Paper API: use `setGrid()` not `drawGrid()`, use `drawBackground()` for bg color
- `@joint/core` is the current package name (old `jointjs` is deprecated)
- Theme changes update both CSS variables (UI) and JointJS paper (canvas bg + grid)
