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
  selectedNode: { id: string; text: string; position: { x: number; y: number } } | null = null;
  saveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  private subs: Subscription[] = [];
  private saveTimeout: any;

  constructor(
    private diagram: DiagramService,
    private fileService: FileService,
  ) {
    this.subs.push(
      this.diagram.nodeSelected$.subscribe(node => {
        this.selectedNode = node;
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
    this.selectedNode = null;
    this.showSettings = false;
    this.diagram.clearSelection();
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
