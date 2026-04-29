import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'aiskemas_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private themeSubject: BehaviorSubject<Theme>;
  theme$;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored || this.getSystemPreference();
    this.themeSubject = new BehaviorSubject<Theme>(initial);
    this.theme$ = this.themeSubject.asObservable();
    this.applyTheme(initial);
  }

  get current(): Theme {
    return this.themeSubject.value;
  }

  toggle(): void {
    const next = this.current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  setTheme(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private getSystemPreference(): Theme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
