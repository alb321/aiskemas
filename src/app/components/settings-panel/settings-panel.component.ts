import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService } from '../../services/ai.service';
import { AIProvider } from '../../models/ai.model';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay" (click)="close.emit()"></div>
    <div class="panel">
      <h2>AI Settings</h2>

      <div class="form-group">
        <label>Provider Name</label>
        <input [(ngModel)]="provider.name" placeholder="Azure AI Foundry" />
      </div>

      <div class="form-group">
        <label>Endpoint URL</label>
        <input [(ngModel)]="provider.endpoint"
               placeholder="https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/" />
      </div>

      <div class="form-group">
        <label>API Key</label>
        <input [(ngModel)]="provider.apiKey" type="password" placeholder="Your API key" />
      </div>

      <div class="form-group">
        <label>Model</label>
        <input [(ngModel)]="provider.model" placeholder="gpt-4o" />
      </div>

      <div class="actions">
        <button class="btn-secondary" (click)="close.emit()">Cancel</button>
        <button class="btn-primary" (click)="onSave()">Save</button>
      </div>

      @if (saved) {
        <div class="success">✅ Settings saved</div>
      }
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 2000;
    }
    .panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-primary);
      border-radius: 12px;
      padding: 32px;
      z-index: 2001;
      width: 480px;
      max-width: 90vw;
      box-shadow: 0 8px 32px var(--shadow-strong);
      transition: background 0.2s;
    }
    h2 {
      margin: 0 0 24px;
      font-size: 20px;
      color: var(--text-primary);
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
      color: var(--text-secondary);
    }
    input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
      background: var(--bg-secondary);
      color: var(--text-primary);
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    input:focus {
      border-color: var(--accent);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
    .btn-primary {
      background: var(--accent);
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
    }
    .btn-secondary {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-primary);
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
    }
    .success {
      margin-top: 12px;
      color: var(--success);
      font-size: 14px;
    }
  `],
})
export class SettingsPanelComponent {
  @Output() close = new EventEmitter<void>();

  provider: AIProvider = {
    id: 'azure',
    name: 'Azure AI Foundry',
    endpoint: '',
    apiKey: '',
    model: 'gpt-4o',
  };

  saved = false;

  constructor(private ai: AIService) {
    const existing = this.ai.getProvider();
    if (existing) {
      this.provider = { ...existing };
    }
  }

  onSave(): void {
    this.ai.setProvider(this.provider);
    this.saved = true;
    setTimeout(() => this.close.emit(), 800);
  }
}
