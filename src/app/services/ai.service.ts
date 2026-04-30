import { Injectable } from '@angular/core';
import OpenAI from 'openai';
import { AIProvider, AIRequest, AIResponse } from '../models/ai.model';

const STORAGE_KEY = 'aiskemas_ai_provider';

@Injectable({ providedIn: 'root' })
export class AIService {
  private client: OpenAI | null = null;
  private provider: AIProvider | null = null;

  constructor() {
    this.loadProvider();
  }

  getProvider(): AIProvider | null {
    return this.provider;
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(provider));
    this.initClient();
  }

  isConfigured(): boolean {
    return this.client !== null && this.provider !== null;
  }

  private loadProvider(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this.provider = JSON.parse(stored);
      this.initClient();
    }
  }

  private initClient(): void {
    if (!this.provider) return;
    this.client = new OpenAI({
      apiKey: this.provider.apiKey,
      baseURL: this.provider.endpoint,
      defaultHeaders: { 'api-key': this.provider.apiKey },
      dangerouslyAllowBrowser: true,
    });
  }

  async request(req: AIRequest): Promise<AIResponse> {
    if (!this.client || !this.provider) {
      throw new Error('AI provider not configured');
    }

    const systemPrompt = this.buildSystemPrompt(req.action);
    const userPrompt = this.buildUserPrompt(req);

    const response = await this.client.chat.completions.create({
      model: this.provider.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    return this.parseResponse(req.action, content);
  }

  private buildSystemPrompt(action: string): string {
    switch (action) {
      case 'generate-children':
        return `You are a study assistant that helps break down concepts into sub-topics.
Given a concept, generate 3-6 direct child concepts that are key sub-topics.
Respond ONLY with a JSON array of objects: [{"text": "concept name"}]
Keep each concept name short (1-4 words).`;
      case 'describe':
        return `You are a study assistant. Given a concept, provide two versions:
1. A detailed explanation (2-4 sentences) suitable for studying.
2. A short summary (max 8-10 words) to annotate a concept map node.
Respond ONLY with JSON: {"long": "detailed explanation", "short": "brief summary"}`;
      case 'improve':
        return `You are a study assistant. Given a concept (which may have a title and a description separated by a newline), suggest improved wording.
Respond ONLY with JSON: {"title": "improved title", "description": "improved description or empty string if none"}
Keep the title short (1-5 words). If the original has no description, set description to empty string.`;
      case 'summarize':
        return `You are a study assistant. Given a concept and its related sub-concepts, create a brief study summary.
Respond with plain text only.`;
      case 'generate-schema':
        return `You are a study assistant that creates concept maps.
Given a topic, generate a hierarchical structure of concepts.
Respond ONLY with JSON: {"nodes": [{"text": "...", "children": [{"text": "..."}]}]}
Keep it to 2 levels deep max, 3-6 children per node.`;
      case 'prompt':
        return `You are a study assistant that helps build concept maps.
Given a concept and a user instruction, generate the requested nodes.
Respond ONLY with a JSON array of objects: [{"text": "concept name", "description": "optional short description"}]
The "text" field is the concept title (1-4 words). The "description" field is optional — include it only if the user asks for descriptions or explanations.
If the instruction asks for something that doesn't map to nodes, respond with plain text instead.`;
      default:
        return 'You are a helpful study assistant.';
    }
  }

  private buildUserPrompt(req: AIRequest): string {
    const ctx = req.context ? `\nConnected nodes:\n${req.context}` : '';
    switch (req.action) {
      case 'generate-children':
        return `Break down the concept: "${req.nodeText}"${ctx}`;
      case 'describe':
        return `Explain the concept: "${req.nodeText}"${ctx}`;
      case 'improve':
        return `Improve this concept label: "${req.nodeText}"${ctx}`;
      case 'summarize':
        return `Summarize this concept and its relationships:\nConcept: "${req.nodeText}"${ctx}`;
      case 'generate-schema':
        return `Create a concept map for: "${req.nodeText}"`;
      case 'prompt':
        return `Current node: "${req.nodeText || ''}"${ctx}\nInstruction: ${req.prompt || ''}`;
      default:
        return req.nodeText || '';
    }
  }

  private parseResponse(action: string, content: string): AIResponse {
    switch (action) {
      case 'generate-children': {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const raw = JSON.parse(jsonMatch[0]);
          const nodes = raw.map((n: any) => ({
            text: n.description ? `${n.text}\n${n.description}` : n.text,
          }));
          return { nodes };
        }
        return { nodes: [] };
      }
      case 'generate-schema': {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return { nodes: parsed.nodes || [] };
        }
        return { nodes: [] };
      }
      case 'prompt': {
        const jsonMatch2 = content.match(/\[[\s\S]*\]/);
        if (jsonMatch2) {
          try {
            const raw = JSON.parse(jsonMatch2[0]);
            const nodes = raw.map((n: any) => ({
              text: n.description ? `${n.text}\n${n.description}` : n.text,
            }));
            return { nodes };
          } catch {
            return { text: content.trim() };
          }
        }
        return { text: content.trim() };
      }
      case 'describe': {
        const jsonMatch3 = content.match(/\{[\s\S]*\}/);
        if (jsonMatch3) {
          try {
            const parsed = JSON.parse(jsonMatch3[0]);
            return { text: parsed.long || content.trim(), shortText: parsed.short || '' };
          } catch {
            return { text: content.trim() };
          }
        }
        return { text: content.trim() };
      }
      case 'improve': {
        const jsonMatch4 = content.match(/\{[\s\S]*\}/);
        if (jsonMatch4) {
          try {
            const parsed = JSON.parse(jsonMatch4[0]);
            const improved = parsed.description
              ? `${parsed.title}\n${parsed.description}`
              : parsed.title || content.trim();
            return { text: improved };
          } catch {
            return { text: content.trim() };
          }
        }
        return { text: content.trim() };
      }
      default:
        return { text: content.trim() };
    }
  }
}
