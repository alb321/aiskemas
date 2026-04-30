export interface AIProvider {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface AIRequest {
  action: 'generate-children' | 'describe' | 'improve' | 'summarize' | 'generate-schema' | 'prompt';
  nodeText?: string;
  context?: string;
  schema?: string;
  prompt?: string;
}

export interface AIGeneratedNode {
  text: string;
  children?: AIGeneratedNode[];
}

export interface AIResponse {
  nodes?: AIGeneratedNode[];
  text?: string;
}
