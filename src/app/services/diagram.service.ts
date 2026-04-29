import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import * as joint from '@joint/core';
import { v4 as uuidv4 } from 'uuid';
import {
  Schema,
  SchemaNode,
  SchemaEdge,
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
  NodeStyle,
} from '../models/schema.model';
import { Theme } from './theme.service';

@Injectable({ providedIn: 'root' })
export class DiagramService {
  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;
  private selectedIds = new Set<string>();
  private muteChanges = false;

  nodeSelected$ = new Subject<{ id: string; text: string; position: { x: number; y: number } } | null>();
  selectionChanged$ = new Subject<string[]>();
  schemaChanged$ = new Subject<void>();
  editNode$ = new Subject<{ id: string; text: string; bbox: { x: number; y: number; width: number; height: number } }>();

  constructor(private zone: NgZone) {}

  initialize(container: HTMLElement): void {
    this.graph = new joint.dia.Graph();

    this.paper = new joint.dia.Paper({
      el: container,
      model: this.graph,
      width: '100%',
      height: '100%',
      gridSize: 10,
      drawGrid: { name: 'dot', args: { color: '#e0e0e0' } },
      background: { color: '#fafafa' },
      interactive: true,
      defaultConnector: { name: 'smooth' },
      defaultRouter: { name: 'manhattan' },
      connectionStrategy: joint.connectionStrategies.pinAbsolute,
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    // Node click — single or multi select
    this.paper.on('element:pointerclick', (elementView: joint.dia.ElementView, evt: joint.dia.Event) => {
      this.zone.run(() => {
        const model = elementView.model;
        const id = model.id as string;
        const text = (model.attr('label/text') as string) || '';
        const bbox = elementView.getBBox();
        const nativeEvt = (evt as any).originalEvent || evt;
        const isMulti = nativeEvt?.shiftKey || nativeEvt?.metaKey || nativeEvt?.ctrlKey;

        if (isMulti) {
          if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
          } else {
            this.selectedIds.add(id);
          }
        } else {
          this.selectedIds.clear();
          this.selectedIds.add(id);
        }

        this.applySelectionHighlight();
        this.selectionChanged$.next([...this.selectedIds]);

        // Emit single node info for context menu
        if (this.selectedIds.size === 1) {
          this.nodeSelected$.next({
            id,
            text,
            position: { x: bbox.x + bbox.width, y: bbox.y },
          });
        } else {
          this.nodeSelected$.next(null);
        }
      });
    });

    // Blank click - deselect all
    this.paper.on('blank:pointerclick', () => {
      this.zone.run(() => {
        this.clearSelection();
      });
    });

    // Double-click on element — inline edit
    this.paper.on('element:pointerdblclick', (elementView: joint.dia.ElementView) => {
      this.zone.run(() => {
        const model = elementView.model;
        const id = model.id as string;
        const text = (model.attr('label/text') as string) || '';
        const bbox = elementView.getBBox();
        this.editNode$.next({
          id,
          text,
          bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
        });
      });
    });

    // Any change
    this.graph.on('change', () => {
      if (this.muteChanges) return;
      this.zone.run(() => {
        this.schemaChanged$.next();
      });
    });
    this.graph.on('add remove', () => {
      if (this.muteChanges) return;
      this.zone.run(() => {
        this.schemaChanged$.next();
      });
    });
  }

  // --- Selection API ---

  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.applySelectionHighlight();
    this.selectionChanged$.next([]);
    this.nodeSelected$.next(null);
  }

  selectByArea(rect: { x: number; y: number; width: number; height: number }): void {
    this.selectedIds.clear();
    this.graph.getElements().forEach(el => {
      const pos = el.position();
      const size = el.size();
      const elRight = pos.x + size.width;
      const elBottom = pos.y + size.height;
      const rectRight = rect.x + rect.width;
      const rectBottom = rect.y + rect.height;

      // Element intersects selection rectangle
      if (pos.x < rectRight && elRight > rect.x &&
          pos.y < rectBottom && elBottom > rect.y) {
        this.selectedIds.add(el.id as string);
      }
    });
    this.applySelectionHighlight();
    this.selectionChanged$.next([...this.selectedIds]);
    if (this.selectedIds.size === 1) {
      const id = [...this.selectedIds][0];
      const el = this.graph.getCell(id) as joint.dia.Element;
      const view = this.paper.findViewByModel(el);
      if (view) {
        const bbox = view.getBBox();
        this.nodeSelected$.next({
          id,
          text: (el.attr('label/text') as string) || '',
          position: { x: bbox.x + bbox.width, y: bbox.y },
        });
      }
    } else {
      this.nodeSelected$.next(null);
    }
  }

  private applySelectionHighlight(): void {
    this.muteChanges = true;
    this.graph.getElements().forEach(el => {
      const id = el.id as string;
      if (this.selectedIds.has(id)) {
        el.attr('body/strokeWidth', 3);
        el.attr('body/stroke', '#4a90d9');
      } else {
        el.attr('body/strokeWidth', 2);
        el.attr('body/stroke', '#333333');
      }
    });
    this.muteChanges = false;
  }

  clientToLocalPoint(clientX: number, clientY: number): { x: number; y: number } {
    const point = this.paper.clientToLocalPoint({ x: clientX, y: clientY });
    return { x: point.x, y: point.y };
  }

  addNode(text: string, x: number, y: number, style?: Partial<NodeStyle>): string {
    const nodeStyle = { ...DEFAULT_NODE_STYLE, ...style };
    const id = uuidv4();

    const rect = new joint.shapes.standard.Rectangle({
      id,
      position: { x, y },
      size: { width: 160, height: 60 },
      attrs: {
        body: {
          fill: nodeStyle.fill,
          stroke: nodeStyle.stroke,
          strokeWidth: nodeStyle.strokeWidth,
          rx: 8,
          ry: 8,
        },
        label: {
          text,
          fontSize: nodeStyle.fontSize,
          fontFamily: nodeStyle.fontFamily,
          fill: nodeStyle.fontColor,
          textWrap: { width: -20, height: -10, ellipsis: true },
        },
      },
    });

    this.graph.addCell(rect);
    return id;
  }

  addEdge(sourceId: string, targetId: string, type: 'linear' | 'curve' = 'curve'): string {
    const id = uuidv4();

    const link = new joint.shapes.standard.Link({
      id,
      source: { id: sourceId },
      target: { id: targetId },
      connector: { name: type === 'curve' ? 'smooth' : 'normal' },
      router: { name: 'manhattan' },
      attrs: {
        line: {
          stroke: DEFAULT_EDGE_STYLE.stroke,
          strokeWidth: DEFAULT_EDGE_STYLE.strokeWidth,
          targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z' },
        },
      },
    });

    this.graph.addCell(link);
    return id;
  }

  removeElement(id: string): void {
    const cell = this.graph.getCell(id);
    if (cell) cell.remove();
  }

  updateNodeText(id: string, text: string): void {
    const cell = this.graph.getCell(id);
    if (cell) {
      cell.attr('label/text', text);
    }
  }

  updateNodeStyle(id: string, style: Partial<NodeStyle>): void {
    const cell = this.graph.getCell(id);
    if (!cell) return;
    if (style.fill) cell.attr('body/fill', style.fill);
    if (style.stroke) cell.attr('body/stroke', style.stroke);
    if (style.strokeWidth) cell.attr('body/strokeWidth', style.strokeWidth);
    if (style.fontSize) cell.attr('label/fontSize', style.fontSize);
    if (style.fontFamily) cell.attr('label/fontFamily', style.fontFamily);
    if (style.fontColor) cell.attr('label/fill', style.fontColor);
  }

  getNodeText(id: string): string {
    const cell = this.graph.getCell(id);
    return cell ? (cell.attr('label/text') as string) || '' : '';
  }

  getConnectedNodeTexts(id: string): string[] {
    const cell = this.graph.getCell(id);
    if (!cell) return [];
    const neighbors = this.graph.getNeighbors(cell as joint.dia.Element);
    return neighbors.map(n => (n.attr('label/text') as string) || '');
  }

  addChildNodes(parentId: string, texts: string[]): void {
    const parent = this.graph.getCell(parentId) as joint.dia.Element;
    if (!parent) return;

    const pos = parent.position();
    const spacing = 180;
    const startX = pos.x - ((texts.length - 1) * spacing) / 2;
    const childY = pos.y + 120;

    texts.forEach((text, i) => {
      const childId = this.addNode(text, startX + i * spacing, childY);
      this.addEdge(parentId, childId);
    });
  }

  toSchema(name: string): Schema {
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    this.graph.getElements().forEach(el => {
      const pos = el.position();
      const size = el.size();
      nodes.push({
        id: el.id as string,
        text: (el.attr('label/text') as string) || '',
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        style: {
          fill: (el.attr('body/fill') as string) || DEFAULT_NODE_STYLE.fill,
          stroke: (el.attr('body/stroke') as string) || DEFAULT_NODE_STYLE.stroke,
          strokeWidth: (el.attr('body/strokeWidth') as number) || DEFAULT_NODE_STYLE.strokeWidth,
          fontSize: (el.attr('label/fontSize') as number) || DEFAULT_NODE_STYLE.fontSize,
          fontFamily: (el.attr('label/fontFamily') as string) || DEFAULT_NODE_STYLE.fontFamily,
          fontColor: (el.attr('label/fill') as string) || DEFAULT_NODE_STYLE.fontColor,
        },
      });
    });

    this.graph.getLinks().forEach(link => {
      const source = link.source();
      const target = link.target();
      if (source.id && target.id) {
        edges.push({
          id: link.id as string,
          source: source.id as string,
          target: target.id as string,
          type: link.connector()?.name === 'smooth' ? 'curve' : 'linear',
          style: {
            stroke: (link.attr('line/stroke') as string) || DEFAULT_EDGE_STYLE.stroke,
            strokeWidth: (link.attr('line/strokeWidth') as number) || DEFAULT_EDGE_STYLE.strokeWidth,
          },
        });
      }
    });

    return {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes,
      edges,
      metadata: { aiProvider: '', model: '' },
    };
  }

  loadSchema(schema: Schema): void {
    this.graph.clear();

    schema.nodes.forEach(node => {
      const rect = new joint.shapes.standard.Rectangle({
        id: node.id,
        position: { x: node.x, y: node.y },
        size: { width: node.width, height: node.height },
        attrs: {
          body: {
            fill: node.style.fill,
            stroke: node.style.stroke,
            strokeWidth: node.style.strokeWidth,
            rx: 8,
            ry: 8,
          },
          label: {
            text: node.text,
            fontSize: node.style.fontSize,
            fontFamily: node.style.fontFamily,
            fill: node.style.fontColor,
            textWrap: { width: -20, height: -10, ellipsis: true },
          },
        },
      });
      this.graph.addCell(rect);
    });

    schema.edges.forEach(edge => {
      const link = new joint.shapes.standard.Link({
        id: edge.id,
        source: { id: edge.source },
        target: { id: edge.target },
        connector: { name: edge.type === 'curve' ? 'smooth' : 'normal' },
        router: { name: 'manhattan' },
        attrs: {
          line: {
            stroke: edge.style.stroke,
            strokeWidth: edge.style.strokeWidth,
            targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z' },
          },
        },
      });
      this.graph.addCell(link);
    });
  }

  clear(): void {
    this.graph.clear();
  }

  zoomIn(): void {
    const scale = this.paper.scale();
    this.paper.scale(scale.sx * 1.2, scale.sy * 1.2);
  }

  zoomOut(): void {
    const scale = this.paper.scale();
    this.paper.scale(scale.sx / 1.2, scale.sy / 1.2);
  }

  resetZoom(): void {
    this.paper.scale(1, 1);
    this.paper.translate(0, 0);
  }

  updateCanvasTheme(theme: Theme): void {
    if (!this.paper) return;
    const isDark = theme === 'dark';
    this.paper.drawBackground({
      color: isDark ? '#1a1a1a' : '#fafafa',
    });
    this.paper.setGrid({
      name: 'dot',
      args: { color: isDark ? '#333333' : '#e0e0e0' },
    });
  }
}
