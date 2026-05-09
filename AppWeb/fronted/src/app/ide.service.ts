import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationService } from './notification.service';
import { ApiService, CompileResult, CompileError } from './api.service';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

  constructor(
    private notify: NotificationService, 
    private api: ApiService,
    private ngZone: NgZone // ✅ NgZone inyectado para reactividad global
  ) {}

  rootHandle: any = null;

  rootName = new BehaviorSubject<string>('');
  rootOpen = new BehaviorSubject<boolean>(true);

  fileTree = new BehaviorSubject<FileNode[]>([]);
  openFiles = new BehaviorSubject<string[]>([]);
  activeFile = new BehaviorSubject<string | null>(null);
  
  // ✅ Indicador del cursor global
  cursorPosition = new BehaviorSubject<{line: number, column: number}>({line: 1, column: 1});

  fileHandles: Record<string, any> = {};
  fileContents: Record<string, string> = {};
  savedFileContents: Record<string, string> = {};

  dirtyFiles = new BehaviorSubject<Set<string>>(new Set());

  terminalOpen = new BehaviorSubject<boolean>(true);

  projectName: string = 'Proyecto_Sin_Nombre';

  // ==========================================
  // 🧠 MOTOR DE REACTIVIDAD (NUEVO)
  // ==========================================
  private emitirCambioGlobal(accion: () => void) {
    this.ngZone.run(() => {
      accion();
    });
  }

  // =========================
  // 📁 CARGAR PROYECTO
  // =========================
  async loadProject() {
    try {
      this.rootHandle = await (window as any).showDirectoryPicker();
      this.resetState();

      const children = await this.readDirectory(this.rootHandle, this.rootHandle.name);

      this.projectName = this.rootHandle.name; // ✅ Actualizamos el nombre para el ZIP

      this.emitirCambioGlobal(() => {
        this.rootName.next(this.rootHandle.name);
        this.fileTree.next([...children]);
      });

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

      this.projectName = name; // ✅ Actualizamos el nombre para el ZIP

      this.emitirCambioGlobal(() => {
        this.rootName.next(name);
        this.fileTree.next([...children]);
      });

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
    
    this.emitirCambioGlobal(() => {
      this.openFiles.next([]);
      this.activeFile.next(null);
      this.dirtyFiles.next(new Set());
    });
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

    this.emitirCambioGlobal(() => {
      const actuales = this.openFiles.getValue();
      if (!actuales.includes(path)) {
        this.openFiles.next([...actuales, path]);
      }
      this.activeFile.next(path);
    });

    this.notify.info(`Archivo abierto`);
  }

  getFileContent(path: string): string {
    return this.fileContents[path] || '';
  }

  updateFileContent(path: string, content: string) {
    this.fileContents[path] = content;
    const saved = this.savedFileContents[path];
    
    this.emitirCambioGlobal(() => {
      const dirty = new Set(this.dirtyFiles.value);
      if (content !== saved) {
        dirty.add(path);
      } else {
        dirty.delete(path);
      }
      this.dirtyFiles.next(dirty);
    });
  }

  async saveFile(path: string) {
    const handle = this.fileHandles[path];
    if (!handle) return;

    try {
      const writable = await handle.createWritable();
      await writable.write(this.fileContents[path]);
      await writable.close();

      this.savedFileContents[path] = this.fileContents[path];

      this.emitirCambioGlobal(() => {
        const dirty = new Set(this.dirtyFiles.value);
        dirty.delete(path);
        this.dirtyFiles.next(dirty);
      });

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
    this.emitirCambioGlobal(() => {
      const updated = this.openFiles.value.filter(f => f !== path);
      this.openFiles.next(updated);

      if (this.activeFile.value === path) {
        this.activeFile.next(updated.length ? updated[0] : null);
      }
    });
  }

  // =========================
  // 📍 CURSOR
  // =========================
  updateCursorPosition(line: number, column: number) {
    this.emitirCambioGlobal(() => {
      this.cursorPosition.next({ line, column });
    });
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
    const children = await this.readDirectory(this.rootHandle, this.rootHandle.name);

    this.emitirCambioGlobal(() => {
      this.fileTree.next([...children]);
    });
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
    this.emitirCambioGlobal(() => {
      this.terminalOpen.next(!this.terminalOpen.value);
    });
  }

  // =========================
  // ▶️ COMPILAR PROYECTO
  // =========================
  compileErrors = new BehaviorSubject<CompileError[]>([]);
  compiling = new BehaviorSubject<boolean>(false);

  async compileProject() {
    const files = Object.entries(this.fileContents)
      .filter(([p]) => /\.(y|comp|styles|db)$/.test(p))
      .map(([path, content]) => ({ path, content }));

    if (!files.length) {
      this.notify.error('No hay archivos del proyecto para compilar');
      return;
    }

    this.emitirCambioGlobal(() => {
      this.terminalOpen.next(true);
      this.compileErrors.next([]);
      this.compiling.next(true);
    });

    let results: CompileResult[];
    try {
      results = await this.api.compileProject(files);
    } catch {
      this.notify.error('Error de conexión con el backend (http://localhost:3000)');
      this.emitirCambioGlobal(() => this.compiling.next(false));
      return;
    }

    const allErrors: CompileError[] = [];
    for (const r of results) {
      if (!r.ignorado && r.errores?.length) {
        const nombre = r.file.split('/').pop() ?? r.file;
        for (const e of r.errores) {
          allErrors.push({ ...e, archivo: nombre } as any);
        }
      }
    }

    this.emitirCambioGlobal(() => {
      this.compileErrors.next(allErrors);
      this.compiling.next(false);
    });

    if (allErrors.length === 0) {
      this.notify.success('Compilación exitosa — sin errores');
    } else {
      this.notify.error(`Compilación con ${allErrors.length} error(es)`);
    }
  }

  // =========================
  // 👁️ VISTA PREVIA
  // =========================
  async previewProject() {
    const files = Object.entries(this.fileContents)
      .filter(([p]) => /\.(y|comp|styles|db)$/.test(p))
      .map(([path, content]) => ({ path, content }));

    if (!files.length) {
      this.notify.error('No hay archivos del proyecto para previsualizar');
      return;
    }

    try {
      const titulo = this.rootName.value || 'Proyecto LSS';
      const html   = await this.api.previewProject(files, titulo);
      const blob   = new Blob([html], { type: 'text/html' });
      const url    = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      this.notify.error('Error al generar la vista previa');
    }
  }

  // =========================
  // 📦 EXPORTAR PRODUCCIÓN
  // =========================
  async exportProject() {
    if (!this.rootHandle) {
      this.notify.error('Carga un proyecto primero');
      return;
    }

    const files = Object.entries(this.fileContents)
      .filter(([p]) => /\.(y|comp|styles|db)$/.test(p))
      .map(([path, content]) => ({ path, content }));

    if (!files.length) {
      this.notify.error('No hay archivos del proyecto para exportar');
      return;
    }

    const nombre = this.rootName.value || 'proyecto';

    let res: any;
    try {
      res = await this.api.exportProject(files, nombre);
    } catch {
      this.notify.error('Error de conexión con el backend');
      return;
    }

    if (!res.ok) {
      this.notify.error(res.error ?? 'Error al exportar');
      if (res.results) {
        const errs = res.results
          .flatMap((r: any) => r.errores?.map((e: any) => `[${r.file.split('/').pop()}] ${e.descripcion}`) ?? []);
        alert(`❌ No se puede exportar — hay errores:\n\n${errs.join('\n')}`);
      }
      return;
    }

    // Crear carpeta dist/ dentro del proyecto y escribir los archivos
    try {
      const distHandle = await this.rootHandle.getDirectoryHandle('dist', { create: true });

      for (const archivo of (res.archivos ?? [])) {
        const fileHandle = await distHandle.getFileHandle(archivo.nombre, { create: true });
        const writable   = await fileHandle.createWritable();
        await writable.write(archivo.contenido);
        await writable.close();
      }

      await this.refreshTree();
      this.notify.success(`Proyecto exportado en dist/ (${res.archivos?.length} archivos)`);

    } catch (err: any) {
      this.notify.error('Error al escribir archivos: ' + (err?.message ?? ''));
    }
  }

  // =========================
  // 🗑 ELIMINAR NODO
  // =========================
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

  // =========================
  // 📦 EXPORTAR ZIP
  // =========================
  async exportProjectAsZip() {
    const zip = new JSZip();
    const projectFiles = this.getAllFilesContent();
  
    for (const [filePath, content] of Object.entries(projectFiles)) {
      zip.file(filePath, content as string);
    }
  
    const content = await zip.generateAsync({ type: 'blob' });
  
    const nombreLimpio = this.projectName.replace(/\s+/g, '_'); 
    const nombreZip = `${nombreLimpio}.zip`;

    saveAs(content, nombreZip);
  }

  // ✅ Ahora exporta TODOS los archivos del proyecto, no solo las pestañas abiertas
  getAllFilesContent(): Record<string, string> {
    return this.fileContents; 
  }
}