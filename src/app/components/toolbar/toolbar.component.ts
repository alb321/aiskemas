import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramService } from '../../services/diagram.service';
import { FileService } from '../../services/file.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <button (click)="onNewSchema()" title="New schema">
          <span class="icon">📄</span>
        </button>
        <button (click)="onOpen()" title="Open file">
          <span class="icon">📂</span>
        </button>
        <button (click)="onSave()" title="Save to file">
          <span class="icon">💾</span>
        </button>
      </div>

      <div class="toolbar-group">
        <button (click)="diagram.zoomIn()" title="Zoom in">
          <span class="icon">🔍+</span>
        </button>
        <button (click)="diagram.zoomOut()" title="Zoom out">
          <span class="icon">🔍-</span>
        </button>
        <button (click)="diagram.resetZoom()" title="Reset zoom">
          <span class="icon">🎯</span>
        </button>
      </div>

      <div class="toolbar-group">
        <button (click)="theme.toggle()" [title]="theme.current === 'light' ? 'Switch to dark' : 'Switch to light'">
          <span class="icon">{{ theme.current === 'light' ? '🌙' : '☀️' }}</span>
        </button>
        <button (click)="openSettings.emit()" title="AI Settings">
          <span class="icon">⚙️</span>
        </button>
      </div>

      <div class="toolbar-group">
        <input
          class="schema-name"
          [(value)]="schemaName"
          (input)="schemaName = $any($event.target).value"
          placeholder="Schema name..."
        />
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 16px;
      background: var(--bg-primary);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 1px 3px var(--shadow);
      transition: background 0.2s, border-color 0.2s;
    }
    .toolbar-group {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    button {
      border: none;
      background: transparent;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: background 0.15s;
    }
    button:hover {
      background: var(--bg-tertiary);
    }
    .schema-name {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 14px;
      width: 200px;
      outline: none;
      background: var(--bg-secondary);
      color: var(--text-primary);
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    .schema-name:focus {
      border-color: var(--accent);
    }
  `],
})
export class ToolbarComponent {
  @Output() openSettings = new EventEmitter<void>();

  schemaName = 'Untitled Schema';

  constructor(
    public diagram: DiagramService,
    public theme: ThemeService,
    private fileService: FileService,
  ) {}

  onNewSchema(): void {
    if (confirm('Create new schema? Unsaved changes will be lost.')) {
      this.diagram.clear();
      this.schemaName = 'Untitled Schema';
    }
  }

  onSave(): void {
    const schema = this.diagram.toSchema(this.schemaName);
    this.fileService.exportToFile(schema);
  }

  async onOpen(): Promise<void> {
    try {
      const schema = await this.fileService.importFromFile();
      this.diagram.loadSchema(schema);
      this.schemaName = schema.name;
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  }
}
