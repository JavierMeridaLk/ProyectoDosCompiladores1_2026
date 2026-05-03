import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IdeService {

  openFiles = new BehaviorSubject<string[]>([]);
  activeFile = new BehaviorSubject<string | null>(null);

  private filesContent: Record<string, string> = {};

  openFile(file: string) {
    const current = this.openFiles.value;

    if (!current.includes(file)) {
      this.openFiles.next([...current, file]);
    }

    this.activeFile.next(file);
  }

  closeFile(file: string) {
    const updated = this.openFiles.value.filter(f => f !== file);
    this.openFiles.next(updated);

    if (this.activeFile.value === file) {
      const next = updated[updated.length - 1] || null;
      this.activeFile.next(next);
    }
  }

  getFileContent(file: string): string {
    return this.filesContent[file] || '';
  }

  updateFileContent(file: string, content: string) {
    this.filesContent[file] = content;
  }

  toggleTerminal() {}

  createFile(name: string) {
  this.filesContent[name] = '';

  const current = this.openFiles.value;
  this.openFiles.next([...current, name]);

  this.activeFile.next(name);
}

createFolder(name: string) {
  console.log('Carpeta creada:', name);
}
}