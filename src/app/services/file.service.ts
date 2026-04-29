import { Injectable } from '@angular/core';
import { Schema } from '../models/schema.model';

const AUTOSAVE_KEY = 'aiskemas_autosave';

@Injectable({ providedIn: 'root' })
export class FileService {

  autosave(schema: Schema): void {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(schema));
  }

  loadAutosave(): Schema | null {
    const data = localStorage.getItem(AUTOSAVE_KEY);
    return data ? JSON.parse(data) : null;
  }

  exportToFile(schema: Schema): void {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schema.name || 'schema'}.aiskemas.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importFromFile(): Promise<Schema> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.aiskemas.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const schema = JSON.parse(reader.result as string) as Schema;
            resolve(schema);
          } catch {
            reject(new Error('Invalid file format'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      };
      input.click();
    });
  }
}
