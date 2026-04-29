import { Component, ElementRef, AfterViewInit, ViewChild, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DiagramService } from '../../services/diagram.service';
import { ThemeService } from '../../services/theme.service';
import { FileService } from '../../services/file.service';

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="canvas-container" #canvasContainer
         (dblclick)="onDoubleClick($event)"
         (mousedown)="onMouseDown($event)"
         (mousemove)="onMouseMove($event)"
         (mouseup)="onMouseUp($event)"
         (wheel)="onWheel($event)">>
    </div>
    @if (selecting) {
      <div class="selection-box"
           [style.left.px]="selectionRect.x"
           [style.top.px]="selectionRect.y"
           [style.width.px]="selectionRect.width"
           [style.height.px]="selectionRect.height">
      </div>
    }
    @if (editing) {
      <textarea
        #editInput
        class="inline-edit"
        [style.left.px]="editBox.x"
        [style.top.px]="editBox.y"
        [style.width.px]="editBox.width"
        [style.min-height.px]="editBox.height"
        [(ngModel)]="editText"
        (keydown)="onEditKeydown($event)"
        (blur)="commitEdit()">
      </textarea>
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
    .inline-edit {
      position: absolute;
      z-index: 20;
      border: 2px solid var(--accent, #4a90d9);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 14px;
      font-family: 'Inter', sans-serif;
      background: var(--bg-primary, #fff);
      color: var(--text-primary, #333);
      resize: none;
      outline: none;
      overflow: hidden;
      text-align: center;
      line-height: 1.4;
      box-shadow: 0 2px 8px var(--shadow, rgba(0,0,0,0.1));
    }
  `],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLElement>;
  @ViewChild('editInput') editInputRef?: ElementRef<HTMLTextAreaElement>;
  private themeSub!: Subscription;
  private editSub!: Subscription;

  selecting = false;
  private dragStart: { x: number; y: number } | null = null;
  selectionRect = { x: 0, y: 0, width: 0, height: 0 };

  // Inline editing state
  editing = false;
  editText = '';
  editBox = { x: 0, y: 0, width: 0, height: 0 };
  private editingNodeId: string | null = null;
  private editOriginalText = '';

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

    this.editSub = this.diagram.editNode$.subscribe(({ id, text, bbox }) => {
      this.editingNodeId = id;
      this.editText = text;
      this.editOriginalText = text;
      this.editBox = { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
      this.editing = true;
      setTimeout(() => {
        this.editInputRef?.nativeElement.focus();
        this.editInputRef?.nativeElement.select();
      });
    });

    // Restore autosaved schema
    const saved = this.fileService.loadAutosave();
    if (saved) {
      this.diagram.loadSchema(saved);
    }
  }

  ngOnDestroy(): void {
    this.themeSub?.unsubscribe();
    this.editSub?.unsubscribe();
  }

  @HostListener('document:mousedown', ['$event'])
  onDocMouseDown(event: MouseEvent): void {
    if (!this.editing) return;
    const textarea = this.editInputRef?.nativeElement;
    if (textarea && !textarea.contains(event.target as Node)) {
      this.commitEdit();
    }
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.commitEdit();
    }
    if (event.key === 'Escape') {
      this.cancelEdit();
    }
  }

  commitEdit(): void {
    if (!this.editing) return;
    const trimmed = this.editText.trim();
    if (this.editingNodeId && trimmed !== this.editOriginalText) {
      this.diagram.updateNodeText(this.editingNodeId, trimmed);
    }
    this.editing = false;
    this.editingNodeId = null;
  }

  private cancelEdit(): void {
    this.editing = false;
    this.editingNodeId = null;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      // Pinch zoom (trackpad reports pinch as ctrl+wheel)
      this.diagram.zoomAtPoint(event.deltaY, event.clientX, event.clientY);
    } else {
      // Two-finger pan
      this.diagram.pan(-event.deltaX, -event.deltaY);
    }
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
