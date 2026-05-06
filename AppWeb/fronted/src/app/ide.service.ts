import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';

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

  constructor(private notify: NotificationService) {}

  rootHandle: any = null;

  rootName = new BehaviorSubject<string>('');
  rootOpen = new BehaviorSubject<boolean>(true);

  fileTree = new BehaviorSubject<FileNode[]>([]);
  openFiles = new BehaviorSubject<string[]>([]);
  activeFile = new BehaviorSubject<string | null>(null);

  fileHandles: Record<string, any> = {};
  fileContents: Record<string, string> = {};
  savedFileContents: Record<string, string> = {};

  dirtyFiles = new BehaviorSubject<Set<string>>(new Set());

  terminalOpen = new BehaviorSubject<boolean>(true);

  // =========================
  // 📁 CARGAR PROYECTO
  // =========================
  async loadProject() {
    try {
      this.rootHandle = await (window as any).showDirectoryPicker();

      this.resetState();

      const children = await this.readDirectory(
        this.rootHandle,
        this.rootHandle.name
      );

      this.rootName.next(this.rootHandle.name);
      this.fileTree.next([...children]);

      this.notify.success('Proyecto cargado correctamente');
    } catch (e) {
      this.notify.error('Error al cargar proyecto');
    }
  }

  // =========================
  // 🆕 NUEVO PROYECTO
  // =========================
  async newProject(name: string) {
    try {
      const root = await (window as any).showDirectoryPicker();

      const projectHandle = await root.getDirectoryHandle(name, { create: true });

      this.rootHandle = projectHandle;

      this.resetState();

      const children = await this.readDirectory(projectHandle, name);

      this.rootName.next(name);
      this.fileTree.next([...children]);

      this.notify.success(`Proyecto "${name}" creado`);
    } catch (e) {
      this.notify.error('Error creando proyecto');
    }
  }

  // =========================
  // 🔄 RESET GLOBAL
  // =========================
  resetState() {
    this.fileHandles = {};
    this.fileContents = {};
    this.savedFileContents = {};
    this.openFiles.next([]);
    this.activeFile.next(null);
    this.dirtyFiles.next(new Set());
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

    this.notify.info(`Archivo abierto`);
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

    try {
      const writable = await handle.createWritable();
      await writable.write(this.fileContents[path]);
      await writable.close();

      this.savedFileContents[path] = this.fileContents[path];

      const dirty = new Set(this.dirtyFiles.value);
      dirty.delete(path);
      this.dirtyFiles.next(dirty);

      this.notify.success(`Archivo guardado`);
    } catch (e) {
      this.notify.error(`Error guardando archivo`);
    }
  }

  async saveAll() {
    try {
      for (const file of this.openFiles.value) {
        await this.saveFile(file);
      }

      this.notify.success('Todos los archivos guardados');
    } catch (e) {
      this.notify.error('Error guardando archivos');
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

    this.notify.success(`Archivo creado`);
  }

  async createFolder(name: string) {
    if (!this.rootHandle) return;

    await this.rootHandle.getDirectoryHandle(name, { create: true });

    await this.refreshTree();

    this.notify.success(`Carpeta creada`);
  }

  async createFileInFolder(folderPath: string, name: string) {
    const dir = await this.getDirectoryFromPath(folderPath);

    const fileHandle = await dir.getFileHandle(name, { create: true });

    const fullPath = `${folderPath}/${name}`;

    this.fileHandles[fullPath] = fileHandle;
    this.fileContents[fullPath] = '';

    await this.refreshTree();

    this.notify.success(`Archivo creado`);
  }

  async createFolderInFolder(folderPath: string, name: string) {
    const dir = await this.getDirectoryFromPath(folderPath);

    await dir.getDirectoryHandle(name, { create: true });

    await this.refreshTree();

    this.notify.success(`Carpeta creada`);
  }

  // =========================
  // 🔄 REFRESCAR
  // =========================
  async refreshTree() {
    if (!this.rootHandle) return;

    this.fileHandles = {};

    const children = await this.readDirectory(
      this.rootHandle,
      this.rootHandle.name
    );

    this.fileTree.next([...children]);
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

    this.notify.success(`Archivo movido`);
  }

  async deleteFile(path: string) {
    const parts = path.split('/');
    const fileName = parts.pop();

    let dir = this.rootHandle;

    if (parts[0] === this.rootHandle.name) {
      parts.shift();
    }

    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }

    await dir.removeEntry(fileName);

    this.notify.success(`Archivo eliminado`);
  }

  async getDirectoryFromPath(path: string): Promise<any> {
    const parts = path.split('/');

    let current = this.rootHandle;

    if (parts[0] === this.rootHandle.name) {
      parts.shift();
    }

    for (const part of parts) {
      current = await current.getDirectoryHandle(part);
    }

    return current;
  }

  toggleTerminal() {
    this.terminalOpen.next(!this.terminalOpen.value);
  }

  async deleteNode(node: FileNode) {
    if (!this.rootHandle) return;

    try {
      const parts = node.path.split('/');
      const name = parts.pop();

      let dir = this.rootHandle;

      if (parts[0] === this.rootHandle.name) {
        parts.shift();
      }

      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }

      await dir.removeEntry(name, { recursive: true });

      delete this.fileHandles[node.path];
      delete this.fileContents[node.path];
      delete this.savedFileContents[node.path];

      this.closeFile(node.path);

      await this.refreshTree();

      this.notify.success(`Eliminado correctamente`);

    } catch (err) {
      console.error('Error eliminando:', err);
      this.notify.error('Error eliminando');
    }
  }
}