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
        return `You are a study assistant. Given a concept, provide a clear, concise explanation (2-4 sentences) suitable for studying.
Respond with plain text only.`;
      case 'improve':
        return `You are a study assistant. Given a concept label, suggest a better, more precise or memorable wording.
Respond with plain text: just the improved label.`;
      case 'summarize':
        return `You are a study assistant. Given a concept and its related sub-concepts, create a brief study summary.
Respond with plain text only.`;
      case 'generate-schema':
        return `You are a study assistant that creates concept maps.
Given a topic, generate a hierarchical structure of concepts.
Respond ONLY with JSON: {"nodes": [{"text": "...", "children": [{"text": "..."}]}]}
Keep it to 2 levels deep max, 3-6 children per node.`;
      default:
        return 'You are a helpful study assistant.';
    }
  }

  private buildUserPrompt(req: AIRequest): string {
    switch (req.action) {
      case 'generate-children':
        return `Break down the concept: "${req.nodeText}"`;
      case 'describe':
        return `Explain the concept: "${req.nodeText}"`;
      case 'improve':
        return `Improve this concept label: "${req.nodeText}"`;
      case 'summarize':
        return `Summarize this concept and context:\nConcept: "${req.nodeText}"\nContext: ${req.context || 'none'}`;
      case 'generate-schema':
        return `Create a concept map for: "${req.nodeText}"`;
      default:
        return req.nodeText || '';
    }
  }

  private parseResponse(action: string, content: string): AIResponse {
    switch (action) {
      case 'generate-children': {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const nodes = JSON.parse(jsonMatch[0]);
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
      default:
        return { text: content.trim() };
    }
  }
}
