import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, debounceTime } from 'rxjs';
import { CanvasComponent } from './components/canvas/canvas.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { AIContextMenuComponent } from './components/ai-context-menu/ai-context-menu.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { DiagramService } from './services/diagram.service';
import { FileService } from './services/file.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    CanvasComponent,
    ToolbarComponent,
    AIContextMenuComponent,
    SettingsPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnDestroy {
  showSettings = false;
  hoveredNode: { id: string; text: string; bbox: { x: number; y: number; width: number; height: number } } | null = null;
  aiMenuNode: { id: string; text: string } | null = null;
  aiMenuPosition = { x: 0, y: 0 };
  saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  private subs: Subscription[] = [];
  private saveTimeout: any;
  private hoverTimeout: any;

  constructor(
    private diagram: DiagramService,
    private fileService: FileService,
  ) {
    this.subs.push(
      this.diagram.nodeHover$.subscribe(node => {
        if (this.aiMenuNode) return;
        if (node) {
          clearTimeout(this.hoverTimeout);
          this.hoveredNode = node;
        } else {
          this.hoverTimeout = setTimeout(() => {
            this.hoveredNode = null;
          }, 200);
        }
      }),
      this.diagram.schemaChanged$.pipe(debounceTime(500)).subscribe(() => {
        this.saveStatus = 'saving';
        const schema = this.diagram.toSchema('Autosave');
        this.fileService.autosave(schema);
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
          this.saveStatus = 'saved';
          this.saveTimeout = setTimeout(() => {
            this.saveStatus = 'idle';
          }, 2000);
        }, 300);
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.aiMenuNode = null;
    this.hoveredNode = null;
    this.showSettings = false;
    this.diagram.clearSelection();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.aiMenuNode && !target.closest('.context-menu') && !target.closest('.ai-trigger-btn')) {
      this.aiMenuNode = null;
    }
  }

  keepHover(): void {
    clearTimeout(this.hoverTimeout);
  }

  clearHover(): void {
    this.hoverTimeout = setTimeout(() => {
      this.hoveredNode = null;
    }, 200);
  }

  openAiMenu(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    if (!this.hoveredNode) return;
    this.aiMenuNode = { id: this.hoveredNode.id, text: this.hoveredNode.text };
    this.aiMenuPosition = {
      x: this.hoveredNode.bbox.x + this.hoveredNode.bbox.width,
      y: this.hoveredNode.bbox.y,
    };
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      // Don't delete when typing in an input/textarea
      const tag = (event.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const ids = this.diagram.getSelectedIds();
      if (ids.length) {
        ids.forEach(id => this.diagram.removeElement(id));
        this.diagram.clearSelection();
      }
    }
  }
}
