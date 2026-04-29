import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DiagramService } from '../../services/diagram.service';
import { AIService } from '../../services/ai.service';

@Component({
  selector: 'app-ai-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible && nodeId) {
      <div class="context-menu" [style.left.px]="position.x" [style.top.px]="position.y">
        <div class="menu-header">{{ nodeText }}</div>
        <button (click)="onAction('generate-children')" [disabled]="loading">
          🌳 Generate children
        </button>
        <button (click)="onAction('describe')" [disabled]="loading">
          📝 Describe
        </button>
        <button (click)="onAction('improve')" [disabled]="loading">
          ✨ Improve label
        </button>
        <button (click)="onAction('summarize')" [disabled]="loading">
          📋 Summarize
        </button>
        <hr />
        <button (click)="onDelete()" class="danger">
          🗑️ Delete
        </button>

        @if (loading) {
          <div class="loading">Thinking...</div>
        }
        @if (resultText) {
          <div class="result">{{ resultText }}</div>
        }
      </div>
    }
  `,
  styles: [`
    .context-menu {
      position: fixed;
      z-index: 1000;
      background: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 8px;
      box-shadow: 0 4px 16px var(--shadow-strong);
      padding: 8px 0;
      min-width: 200px;
      max-width: 320px;
      transition: background 0.2s, border-color 0.2s;
    }
    .menu-header {
      padding: 8px 16px;
      font-weight: 600;
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    button {
      display: block;
      width: 100%;
      border: none;
      background: transparent;
      padding: 8px 16px;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      color: var(--text-primary);
      transition: background 0.1s;
    }
    button:hover:not(:disabled) {
      background: var(--bg-tertiary);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.danger {
      color: var(--danger);
    }
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 4px 0;
    }
    .loading {
      padding: 8px 16px;
      color: var(--accent);
      font-style: italic;
      font-size: 13px;
    }
    .result {
      padding: 8px 16px;
      font-size: 13px;
      color: var(--text-primary);
      border-top: 1px solid var(--border);
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  `],
})
export class AIContextMenuComponent {
  @Input() visible = false;
  @Input() nodeId: string | null = null;
  @Input() nodeText = '';
  @Input() position = { x: 0, y: 0 };

  loading = false;
  resultText = '';

  constructor(
    private diagram: DiagramService,
    private ai: AIService,
  ) {}

  async onAction(action: 'generate-children' | 'describe' | 'improve' | 'summarize'): Promise<void> {
    if (!this.nodeId || !this.ai.isConfigured()) {
      this.resultText = '⚠️ Configure AI settings first (⚙️)';
      return;
    }

    this.loading = true;
    this.resultText = '';

    try {
      const context = this.diagram.getConnectedNodeTexts(this.nodeId).join(', ');
      const response = await this.ai.request({
        action,
        nodeText: this.nodeText,
        context,
      });

      switch (action) {
        case 'generate-children':
          if (response.nodes?.length) {
            this.diagram.addChildNodes(this.nodeId, response.nodes.map(n => n.text));
            this.resultText = `Added ${response.nodes.length} concepts`;
          }
          break;
        case 'improve':
          if (response.text) {
            this.diagram.updateNodeText(this.nodeId, response.text);
            this.resultText = `Updated: "${response.text}"`;
          }
          break;
        case 'describe':
        case 'summarize':
          this.resultText = response.text || 'No response';
          break;
      }
    } catch (e: any) {
      this.resultText = `❌ Error: ${e.message || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }

  onDelete(): void {
    if (this.nodeId) {
      this.diagram.removeElement(this.nodeId);
      this.visible = false;
    }
  }
}
