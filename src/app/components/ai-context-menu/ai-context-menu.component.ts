import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiagramService } from '../../services/diagram.service';
import { AIService } from '../../services/ai.service';

@Component({
  selector: 'app-ai-context-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        <div class="prompt-row">
          <input #promptInput
                 class="prompt-input"
                 type="text"
                 [(ngModel)]="promptText"
                 placeholder="Ask AI anything..."
                 (keydown.enter)="onPrompt()"
                 [disabled]="loading" />
          <button class="prompt-send" (click)="onPrompt()" [disabled]="loading || !promptText.trim()">
            ➤
          </button>
        </div>
        <hr />
        <button (click)="onDelete()" class="danger">
          🗑️ Delete
        </button>

        @if (loading) {
          <div class="loading">Thinking...</div>
        }
        @if (resultText) {
          <div class="result">
            {{ resultText }}
            @if (pendingShortText) {
              <button class="save-to-shape" (click)="saveToShape()">💾 Save to shape</button>
            }
          </div>
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
    .prompt-row {
      display: flex;
      padding: 4px 8px;
      gap: 4px;
    }
    .prompt-input {
      flex: 1;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 13px;
      background: var(--bg-secondary, #f5f5f5);
      color: var(--text-primary);
      outline: none;
    }
    .prompt-input:focus {
      border-color: var(--accent, #4a90d9);
    }
    .prompt-send {
      width: 32px !important;
      min-width: 32px;
      padding: 4px !important;
      text-align: center !important;
      border-radius: 4px;
      font-size: 14px;
    }
    .save-to-shape {
      display: inline-block;
      margin-top: 6px;
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid var(--accent, #4a90d9);
      border-radius: 4px;
      background: var(--bg-secondary, #f5f5f5);
      color: var(--accent, #4a90d9);
      cursor: pointer;
      width: auto !important;
    }
    .save-to-shape:hover {
      background: var(--accent, #4a90d9);
      color: #fff;
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
  promptText = '';
  pendingShortText: string | null = null;

  constructor(
    private diagram: DiagramService,
    private ai: AIService,
  ) {}

  async onPrompt(): Promise<void> {
    const text = this.promptText.trim();
    if (!text || !this.nodeId) return;
    if (!this.ai.isConfigured()) {
      this.resultText = '⚠️ Configure AI settings first (⚙️)';
      return;
    }

    this.loading = true;
    this.resultText = '';

    try {
      const context = this.diagram.getNodeContext(this.nodeId);
      const response = await this.ai.request({
        action: 'prompt',
        nodeText: this.nodeText,
        context,
        prompt: text,
      });

      if (response.nodes?.length) {
        this.diagram.addChildNodes(this.nodeId, response.nodes.map(n => n.text));
        this.resultText = `Added ${response.nodes.length} concepts`;
      } else if (response.text) {
        this.resultText = response.text;
      }
      this.promptText = '';
    } catch (e: any) {
      this.resultText = `❌ Error: ${e.message || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }

  async onAction(action: 'generate-children' | 'describe' | 'improve' | 'summarize'): Promise<void> {
    if (!this.nodeId || !this.ai.isConfigured()) {
      this.resultText = '⚠️ Configure AI settings first (⚙️)';
      return;
    }

    this.loading = true;
    this.resultText = '';
    this.pendingShortText = null;

    try {
      const context = this.diagram.getNodeContext(this.nodeId);
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
          this.resultText = response.text || 'No response';
          if (response.shortText) {
            this.pendingShortText = response.shortText;
          }
          break;
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

  saveToShape(): void {
    if (!this.nodeId || !this.pendingShortText) return;
    const current = this.diagram.getNodeText(this.nodeId);
    this.diagram.updateNodeText(this.nodeId, current + '\n' + this.pendingShortText);
    this.pendingShortText = null;
    this.resultText = '✅ Saved to shape';
  }
}
