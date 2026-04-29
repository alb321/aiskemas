import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DiagramService } from '../../services/diagram.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  template: `
    <div class="canvas-container" #canvasContainer
         (dblclick)="onDoubleClick($event)">
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .canvas-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--canvas-bg);
      transition: background 0.2s;
    }
  `],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLElement>;
  private themeSub!: Subscription;

  constructor(
    private diagram: DiagramService,
    private theme: ThemeService,
  ) {}

  ngAfterViewInit(): void {
    this.diagram.initialize(this.containerRef.nativeElement);
    this.themeSub = this.theme.theme$.subscribe(t => {
      this.diagram.updateCanvasTheme(t);
    });
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
  }

  onDoubleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('canvas-container') ||
        target.tagName === 'svg' ||
        (target.classList.contains('joint-paper'))) {
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.diagram.addNode('New concept', x - 80, y - 30);
    }
  }
}
