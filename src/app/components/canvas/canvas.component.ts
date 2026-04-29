import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DiagramService } from '../../services/diagram.service';
import { ThemeService } from '../../services/theme.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="canvas-container" #canvasContainer
         (dblclick)="onDoubleClick($event)"
         (mousedown)="onMouseDown($event)"
         (mousemove)="onMouseMove($event)"
         (mouseup)="onMouseUp($event)">
    </div>
    @if (selecting) {
      <div class="selection-box"
           [style.left.px]="selectionRect.x"
           [style.top.px]="selectionRect.y"
           [style.width.px]="selectionRect.width"
           [style.height.px]="selectionRect.height">
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .canvas-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: var(--canvas-bg);
      transition: background 0.2s;
    }
    .selection-box {
      position: absolute;
      border: 2px dashed var(--accent, #4a90d9);
      background: rgba(74, 144, 217, 0.08);
      pointer-events: none;
      z-index: 10;
    }
  `],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLElement>;
  private themeSub!: Subscription;

  selecting = false;
  private dragStart: { x: number; y: number } | null = null;
  selectionRect = { x: 0, y: 0, width: 0, height: 0 };

  constructor(
    private diagram: DiagramService,
    private theme: ThemeService,
    private fileService: FileService,
  ) {}

  ngAfterViewInit(): void {
    this.diagram.initialize(this.containerRef.nativeElement);
    this.themeSub = this.theme.theme$.subscribe(t => {
      this.diagram.updateCanvasTheme(t);
    });

    // Restore autosaved schema
    const saved = this.fileService.loadAutosave();
    if (saved) {
      this.diagram.loadSchema(saved);
    }
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

  onMouseDown(event: MouseEvent): void {
    // Only start area select on blank canvas (left button, no element under cursor)
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const isSvgBlank = target.tagName === 'svg' ||
      target.classList.contains('canvas-container') ||
      target.classList.contains('joint-paper-background') ||
      target.classList.contains('joint-paper-grid');

    if (!isSvgBlank) return;

    const containerRect = this.containerRef.nativeElement.getBoundingClientRect();
    this.dragStart = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top,
    };
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.dragStart) return;

    const containerRect = this.containerRef.nativeElement.getBoundingClientRect();
    const currentX = event.clientX - containerRect.left;
    const currentY = event.clientY - containerRect.top;

    const dx = Math.abs(currentX - this.dragStart.x);
    const dy = Math.abs(currentY - this.dragStart.y);

    // Start rubber-band after 5px threshold
    if (!this.selecting && (dx > 5 || dy > 5)) {
      this.selecting = true;
    }

    if (this.selecting) {
      this.selectionRect = {
        x: Math.min(this.dragStart.x, currentX),
        y: Math.min(this.dragStart.y, currentY),
        width: dx,
        height: dy,
      };
    }
  }

  onMouseUp(event: MouseEvent): void {
    if (this.selecting && this.dragStart) {
      // Convert screen rect to local paper coordinates
      const containerRect = this.containerRef.nativeElement.getBoundingClientRect();
      const topLeft = this.diagram.clientToLocalPoint(
        containerRect.left + this.selectionRect.x,
        containerRect.top + this.selectionRect.y,
      );
      const bottomRight = this.diagram.clientToLocalPoint(
        containerRect.left + this.selectionRect.x + this.selectionRect.width,
        containerRect.top + this.selectionRect.y + this.selectionRect.height,
      );

      this.diagram.selectByArea({
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      });
    }

    this.selecting = false;
    this.dragStart = null;
    this.selectionRect = { x: 0, y: 0, width: 0, height: 0 };
  }
}
