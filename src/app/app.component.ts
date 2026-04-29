import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CanvasComponent } from './components/canvas/canvas.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { AIContextMenuComponent } from './components/ai-context-menu/ai-context-menu.component';
import { SettingsPanelComponent } from './components/settings-panel/settings-panel.component';
import { DiagramService } from './services/diagram.service';

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
export class AppComponent {
  showSettings = false;
  selectedNode: { id: string; text: string; position: { x: number; y: number } } | null = null;

  constructor(private diagram: DiagramService) {
    this.diagram.nodeSelected$.subscribe(node => {
      this.selectedNode = node;
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.selectedNode = null;
    this.showSettings = false;
  }
}
