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

// Custom resize tool — extends abstract Control
class ResizeTool extends joint.elementTools.Control {
  protected override getPosition(view: joint.dia.ElementView) {
    const model = view.model;
    const size = model.size();
    return { x: size.width, y: size.height };
  }

  protected override setPosition(view: joint.dia.ElementView, coordinates: any) {
    const model = view.model;
    const newWidth = Math.max(60, coordinates.x);
    const newHeight = Math.max(30, coordinates.y);
    model.resize(newWidth, newHeight);
  }
}

// Custom shape with bold title + normal body text
const ConceptNode = joint.dia.Element.define('aiskemas.ConceptNode', {
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: '#ffffff',
      stroke: '#333333',
      strokeWidth: 2,
      rx: 8,
      ry: 8,
    },
    title: {
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fontWeight: 'bold',
      fontSize: 14,
      fontFamily: "'Inter', sans-serif",
      fill: '#333333',
      textWrap: { width: -20, ellipsis: true },
    },
    body_text: {
      refX: '50%',
      refY: null as any,
      textAnchor: 'middle',
      textVerticalAnchor: 'top',
      fontWeight: 'normal',
      fontSize: 13,
      fontFamily: "'Inter', sans-serif",
      fill: '#555555',
      textWrap: { width: -20, ellipsis: true },
      display: 'none',
    },
  },
}, {
  markup: [{
    tagName: 'rect',
    selector: 'body',
  }, {
    tagName: 'text',
    selector: 'title',
  }, {
    tagName: 'text',
    selector: 'body_text',
  }],
});
@Injectable({ providedIn: 'root' })
export class DiagramService {
  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;
  private selectedIds = new Set<string>();
  private muteChanges = false;
  private justCreatedId: string | null = null;

  private getCellText(cell: joint.dia.Cell): string {
    const title = (cell.attr('title/text') as string) || (cell.attr('label/text') as string) || '';
    const body = (cell.attr('body_text/text') as string) || '';
    return body ? `${title}\n${body}` : title;
  }

  nodeSelected$ = new Subject<{ id: string; text: string; position: { x: number; y: number } } | null>();
  selectionChanged$ = new Subject<string[]>();
  schemaChanged$ = new Subject<void>();
  editNode$ = new Subject<{ id: string; text: string; bbox: { x: number; y: number; width: number; height: number } }>();
  nodeHover$ = new Subject<{ id: string; text: string; bbox: { x: number; y: number; width: number; height: number } } | null>();

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
      interactive: {
        elementMove: true,
        linkMove: true,
        labelMove: false,
      },
      defaultConnector: { name: 'smooth' },
      defaultRouter: { name: 'normal' },
      connectionStrategy: joint.connectionStrategies.pinAbsolute,
      linkPinning: false, // links must connect to elements
      validateConnection: (cellViewS, _magnetS, cellViewT) => {
        // Prevent self-connections
        return cellViewS !== cellViewT;
      },
      defaultLink: () => new joint.shapes.standard.Link({
        attrs: {
          line: {
            stroke: DEFAULT_EDGE_STYLE.stroke,
            strokeWidth: DEFAULT_EDGE_STYLE.strokeWidth,
            targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 z' },
          },
        },
        connector: { name: 'smooth' },
      }),
    });

    this.setupEvents();
  }

  private setupEvents(): void {
    // Node click — single or multi select
    this.paper.on('element:pointerclick', (elementView: joint.dia.ElementView, evt: joint.dia.Event) => {
      this.zone.run(() => {
        const model = elementView.model;
        const id = model.id as string;
        const text = this.getCellText(model);
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
        this.removeAllTools();
      });
    });

    // Show element tools (resize + connect) on click
    this.paper.on('element:pointerclick', (elementView: joint.dia.ElementView) => {
      this.removeAllTools();
      const boundaryTool = new joint.elementTools.Boundary({ padding: 4 });
      const resizeTool = new ResizeTool({
        handleAttributes: {
          width: 10,
          height: 10,
          rx: 2,
          ry: 2,
          fill: '#4a90d9',
          stroke: '#fff',
          'stroke-width': 1,
          cursor: 'nwse-resize',
        },
      });
      const connectTool = new joint.elementTools.Connect({
        magnet: 'body',
      });
      const toolsView = new joint.dia.ToolsView({
        tools: [boundaryTool, resizeTool, connectTool],
      });
      elementView.addTools(toolsView);
    });

    // Show link tools (vertices + remove) on click
    this.paper.on('link:pointerclick', (linkView: joint.dia.LinkView) => {
      this.removeAllTools();
      const verticesTool = new joint.linkTools.Vertices();
      const removeTool = new joint.linkTools.Remove();
      const toolsView = new joint.dia.ToolsView({
        tools: [verticesTool, removeTool],
      });
      linkView.addTools(toolsView);
    });

    // Double-click on element — inline edit
    this.paper.on('element:pointerdblclick', (elementView: joint.dia.ElementView) => {
      this.zone.run(() => {
        const model = elementView.model;
        const id = model.id as string;
        const text = this.getCellText(model);
        const bbox = elementView.getBBox();
        this.editNode$.next({
          id,
          text,
          bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
        });
      });
    });

    // Hover on element
    this.paper.on('element:mouseenter', (elementView: joint.dia.ElementView) => {
      this.zone.run(() => {
        const model = elementView.model;
        const id = model.id as string;
        const text = this.getCellText(model);
        const bbox = elementView.getBBox();
        const paperRect = this.paper.el.getBoundingClientRect();
        this.nodeHover$.next({ id, text, bbox: {
          x: paperRect.left + bbox.x,
          y: paperRect.top + bbox.y,
          width: bbox.width,
          height: bbox.height,
        } });
      });
    });

    this.paper.on('element:mouseleave', () => {
      this.zone.run(() => {
        this.nodeHover$.next(null);
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

  private removeAllTools(): void {
    this.paper.removeTools();
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
          text: this.getCellText(el),
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

  private splitText(text: string): { title: string; body: string } {
    const idx = text.indexOf('\n');
    if (idx === -1) return { title: text, body: '' };
    return { title: text.substring(0, idx), body: text.substring(idx + 1) };
  }

  private applyTextToNode(cell: joint.dia.Cell, text: string): void {
    const { title, body } = this.splitText(text);
    if (body) {
      cell.attr('title/text', title);
      cell.attr('title/refY', 12);
      cell.attr('title/textVerticalAnchor', 'top');
      cell.attr('body_text/text', body);
      cell.attr('body_text/refY', 30);
      cell.attr('body_text/display', 'block');
    } else {
      cell.attr('title/text', title);
      cell.attr('title/refY', '50%');
      cell.attr('title/textVerticalAnchor', 'middle');
      cell.attr('body_text/text', '');
      cell.attr('body_text/display', 'none');
    }
  }

  addNode(text: string, x: number, y: number, style?: Partial<NodeStyle>): string {
    const nodeStyle = { ...DEFAULT_NODE_STYLE, ...style };
    const id = uuidv4();

    const node = new ConceptNode({
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
        title: {
          fontSize: nodeStyle.fontSize,
          fontFamily: nodeStyle.fontFamily,
          fill: nodeStyle.fontColor,
        },
        body_text: {
          fontSize: (nodeStyle.fontSize || 14) - 1,
          fontFamily: nodeStyle.fontFamily,
          fill: nodeStyle.fontColor,
        },
      },
    });

    this.graph.addCell(node);
    this.applyTextToNode(node, text);
    return id;
  }

  addEdge(sourceId: string, targetId: string, type: 'linear' | 'curve' = 'curve'): string {
    const id = uuidv4();

    const link = new joint.shapes.standard.Link({
      id,
      source: { id: sourceId },
      target: { id: targetId },
      connector: { name: 'smooth' },
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
      this.applyTextToNode(cell, text);
    }
  }

  updateNodeStyle(id: string, style: Partial<NodeStyle>): void {
    const cell = this.graph.getCell(id);
    if (!cell) return;
    if (style.fill) cell.attr('body/fill', style.fill);
    if (style.stroke) cell.attr('body/stroke', style.stroke);
    if (style.strokeWidth) cell.attr('body/strokeWidth', style.strokeWidth);
    if (style.fontSize) {
      cell.attr('title/fontSize', style.fontSize);
      cell.attr('body_text/fontSize', style.fontSize - 1);
    }
    if (style.fontFamily) {
      cell.attr('title/fontFamily', style.fontFamily);
      cell.attr('body_text/fontFamily', style.fontFamily);
    }
    if (style.fontColor) {
      cell.attr('title/fill', style.fontColor);
      cell.attr('body_text/fill', style.fontColor);
    }
  }

  getNodeText(id: string): string {
    const cell = this.graph.getCell(id);
    if (!cell) return '';
    const title = (cell.attr('title/text') as string) || '';
    const body = (cell.attr('body_text/text') as string) || '';
    return body ? `${title}\n${body}` : title;
  }

  getConnectedNodeTexts(id: string): string[] {
    const cell = this.graph.getCell(id);
    if (!cell) return [];
    const neighbors = this.graph.getNeighbors(cell as joint.dia.Element);
    return neighbors.map(n => this.getCellText(n));
  }

  getNodeContext(id: string): string {
    const cell = this.graph.getCell(id);
    if (!cell) return '';
    const el = cell as joint.dia.Element;
    const links = this.graph.getConnectedLinks(el);
    const parents: string[] = [];
    const children: string[] = [];
    for (const link of links) {
      const srcId = (link.source() as any).id;
      const tgtId = (link.target() as any).id;
      if (!srcId || !tgtId) continue;
      const otherId = srcId === id ? tgtId : srcId;
      const other = this.graph.getCell(otherId);
      if (!other) continue;
      const otherText = this.getCellText(other);
      if (srcId === id) {
        children.push(otherText);
      } else {
        parents.push(otherText);
      }
    }
    const parts: string[] = [];
    if (parents.length) {
      parts.push(`Parent nodes: ${parents.map(t => `"${t}"`).join(', ')}`);
    }
    if (children.length) {
      parts.push(`Child nodes: ${children.map(t => `"${t}"`).join(', ')}`);
    }
    return parts.join('\n') || 'No connections';
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
        text: this.getCellText(el),
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
      const rect = new ConceptNode({
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
          title: {
            fontSize: node.style.fontSize,
            fontFamily: node.style.fontFamily,
            fill: node.style.fontColor,
          },
          body_text: {
            fontSize: (node.style.fontSize || 14) - 1,
            fontFamily: node.style.fontFamily,
            fill: node.style.fontColor,
          },
        },
      });
      this.graph.addCell(rect);
      this.applyTextToNode(rect, node.text);
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

  pan(dx: number, dy: number): void {
    const tx = this.paper.translate();
    this.paper.translate(tx.tx + dx, tx.ty + dy);
  }

  zoomAtPoint(delta: number, clientX: number, clientY: number): void {
    const oldScale = this.paper.scale().sx;
    const factor = delta > 0 ? 0.95 : 1.05;
    const newScale = Math.min(Math.max(oldScale * factor, 0.2), 5);

    const svgPoint = this.paper.clientToLocalPoint(clientX, clientY);
    this.paper.scale(newScale, newScale);
    const newSvgPoint = this.paper.clientToLocalPoint(clientX, clientY);

    const tx = this.paper.translate();
    this.paper.translate(
      tx.tx + (newSvgPoint.x - svgPoint.x) * newScale,
      tx.ty + (newSvgPoint.y - svgPoint.y) * newScale,
    );
  }

  getElementViewBBox(id: string): { x: number; y: number; width: number; height: number } | null {
    const cell = this.graph.getCell(id);
    if (!cell || !cell.isElement()) return null;
    const view = this.paper.findViewByModel(cell);
    if (!view) return null;
    const bbox = view.getBBox();
    return { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height };
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
