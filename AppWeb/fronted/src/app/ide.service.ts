import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  handle?: any;
  isOpen?: boolean;
  children?: FileNode[];
  depth?: number;
}

@Injectable({ providedIn: 'root' })
export class IdeService {

  rootHandle: any = null;

  // 🔥 ROOT separado
  rootName = new BehaviorSubject<string>('');
  rootOpen = new BehaviorSubject<boolean>(true);

  fileTree = new BehaviorSubject<FileNode[]>([]);
  openFiles = new BehaviorSubject<string[]>([]);
  activeFile = new BehaviorSubject<string | null>(null);

  fileHandles: Record<string, any> = {};
  fileContents: Record<string, string> = {};
  savedFileContents: Record<string, string> = {};

  // =========================
  // 📁 CARGAR PROYECTO
  // =========================
  async loadProject() {
    this.rootHandle = await (window as any).showDirectoryPicker();

    const children = await this.readDirectory(this.rootHandle, this.rootHandle.name);

    this.rootName.next(this.rootHandle.name);
    this.fileTree.next(children);
  }

  // =========================
  // 📂 LEER DIRECTORIO
  // =========================
  async readDirectory(dirHandle: any, currentPath: string): Promise<FileNode[]> {
    const nodes: FileNode[] = [];

    for await (const [name, handle] of dirHandle.entries()) {

      const fullPath = `${currentPath}/${name}`;

      if (handle.kind === 'directory') {
        nodes.push({
          name,
          path: fullPath,
          type: 'folder',
          isOpen: false,
          handle,
          children: await this.readDirectory(handle, fullPath)
        });
      } else {
        this.fileHandles[fullPath] = handle;

        nodes.push({
          name,
          path: fullPath,
          type: 'file',
          handle
        });
      }
    }

    return nodes;
  }

  // =========================
  // 📄 ARCHIVOS
  // =========================
  async openFile(path: string) {
    const handle = this.fileHandles[path];
    if (!handle) return;

    const file = await handle.getFile();
    const content = await file.text();

    this.fileContents[path] = content;
    this.savedFileContents[path] = content;

    if (!this.openFiles.value.includes(path)) {
      this.openFiles.next([...this.openFiles.value, path]);
    }

    this.activeFile.next(path);
  }

  getFileContent(path: string): string {
    return this.fileContents[path] || '';
  }

  updateFileContent(path: string, content: string) {
    this.fileContents[path] = content;

    const saved = this.savedFileContents[path];
    const dirty = new Set(this.dirtyFiles.value);

    if (content !== saved) {
      dirty.add(path);
    } else {
      dirty.delete(path);
    }

    this.dirtyFiles.next(dirty);
  }

  async saveFile(path: string) {
    const handle = this.fileHandles[path];
    if (!handle) return;

    const writable = await handle.createWritable();
    await writable.write(this.fileContents[path]);
    await writable.close();

    this.savedFileContents[path] = this.fileContents[path];
  }

  async saveAll() {
    for (const file of this.openFiles.value) {
      await this.saveFile(file);
    }
  }

  closeFile(path: string) {
    const updated = this.openFiles.value.filter(f => f !== path);
    this.openFiles.next(updated);

    if (this.activeFile.value === path) {
      this.activeFile.next(updated.length ? updated[0] : null);
    }
  }

  // =========================
  // ➕ CREAR
  // =========================
  async createFile(name: string) {
    if (!this.rootHandle) return;

    await this.rootHandle.getFileHandle(name, { create: true });
    await this.refreshTree();
  }

  async createFolder(name: string) {
    if (!this.rootHandle) return;

    await this.rootHandle.getDirectoryHandle(name, { create: true });
    await this.refreshTree();
  }

  // =========================
  // 🔄 REFRESCAR
  // =========================
  async refreshTree() {
    const children = await this.readDirectory(this.rootHandle, this.rootHandle.name);
    this.fileTree.next(children);
  }

  // =========================
  // 🚚 MOVER ARCHIVOS
  // =========================
  async moveFile(fileNode: FileNode, targetFolder: FileNode) {

    if (fileNode.type !== 'file') return;

    const file = await fileNode.handle.getFile();
    const content = await file.text();

    const newHandle = await targetFolder.handle.getFileHandle(fileNode.name, { create: true });

    const writable = await newHandle.createWritable();
    await writable.write(content);
    await writable.close();

    await this.deleteFile(fileNode.path);

    const newPath = `${targetFolder.path}/${fileNode.name}`;

    this.fileHandles[newPath] = newHandle;
    delete this.fileHandles[fileNode.path];

    await this.refreshTree();
  }

  async deleteFile(path: string) {
    const parts = path.split('/');
    const fileName = parts.pop();

    let dir = this.rootHandle;

    for (const part of parts.slice(1)) {
      dir = await dir.getDirectoryHandle(part);
    }

    await dir.removeEntry(fileName);
  }

  terminalOpen = new BehaviorSubject<boolean>(true);

  toggleTerminal() {
    this.terminalOpen.next(!this.terminalOpen.value);
  }

  async newProject(name: string) {
    const root = await (window as any).showDirectoryPicker();

    const projectHandle = await root.getDirectoryHandle(name, { create: true });

    this.rootHandle = projectHandle;

    const children = await this.readDirectory(projectHandle, name);

    this.rootName.next(name);
    this.fileTree.next(children);
  }

  dirtyFiles = new BehaviorSubject<Set<string>>(new Set());


}