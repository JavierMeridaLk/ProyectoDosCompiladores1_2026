import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IdeService } from '../ide.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-editor-space',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './editor-space.html',
  styleUrls: ['./editor-space.css'],
})
export class EditorSpace implements AfterViewInit, OnInit {

  @ViewChild('editorContainer', { static: true }) container!: ElementRef;
  @ViewChild('colorPicker') colorPicker!: ElementRef<HTMLInputElement>;

  private isBrowser: boolean;
  editor: any;

  // MODELOS POR ARCHIVO
  models: Record<string, any> = {};
  tabs: string[] = [];
  activeFile: string = '';

  cursorPosition = { line: 1, column: 1 };
  selectedColor: string = '#ffffff';
  format: 'hex' | 'rgb' = 'hex';

  constructor(
    private ide: IdeService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    // ✅ 1. Suscribirse a los archivos
    this.ide.openFiles.subscribe((files: string[]) => {
      this.tabs = files;
    });

    // ✅ 2. Suscribirse al cursor global
    this.ide.cursorPosition.subscribe(pos => {
      this.cursorPosition = pos;
    });

    // ✅ 3. Suscribirse al archivo activo
    this.ide.activeFile.subscribe(async (file: string | null) => {
      if (!file || !this.editor) return;

      this.activeFile = file;
      const monaco = await import('monaco-editor');
      let model = this.models[file];

      // CREAR MODELO SI NO EXISTE
      if (!model) {
        const value = this.ide.getFileContent(file);
        model = monaco.editor.createModel(value, this.getLanguage(file));
        this.models[file] = model;
      }

      // ASIGNAR MODELO
      this.editor.setModel(model);
      this.editor.focus();

      // ACTUALIZAR CURSOR INICIAL AL CAMBIAR DE PESTAÑA
      const pos = this.editor.getPosition();
      if (pos) {
        this.ide.updateCursorPosition(pos.lineNumber, pos.column);
      }
    });
  }

  async ngAfterViewInit() {
    if (!this.isBrowser) return;
    const monaco = await import('monaco-editor');

    // =========================
    // 🎨 LENGUAJE PERSONALIZADO
    // =========================
    monaco.languages.register({ id: 'customLang' });
    monaco.languages.setMonarchTokensProvider('customLang', {
      tokenizer: {
        root: [
          [/\b(import|execute|load|function|main|int|float|string|boolean|char|if|else|switch|case|default|while|do|for|break|continue)\b/, 'keyword'],
          [/\b(True|False)\b/, 'custom-literal'],
          [/\b\d+(\.\d+)?\b/, 'custom-literal'],
          [/".*?"/, 'string'],
          [/'.*?'/, 'string'],
          [/`.*?`/, 'string'], 
          [/[a-zA-Z_]\w*/, 'identifier'],
          [/[+\-*/=<>!%&|@]+/, 'operator'],
          [/[{}()\[\]]/, 'delimiter'],
          [/[;,:]/, 'identifier'] 
        ]
      }
    });

    // =========================
    // 🎨 TEMA PERSONALIZADO
    // =========================
    monaco.editor.defineTheme('customTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0' },        
        { token: 'string', foreground: 'CE9178' },         
        { token: 'custom-literal', foreground: '4FC1FF' }, 
        { token: 'operator', foreground: '6A9955' },       
        { token: 'delimiter', foreground: '569CD6' },      
        { token: 'identifier', foreground: 'FFFFFF' }      
      ],
      colors: {
        'editor.foreground': '#FFFFFF' 
      }
    });

    // =========================
    // 🧠 EDITOR
    // =========================
    this.editor = monaco.editor.create(this.container.nativeElement, {
      value: '',
      language: 'customLang',
      theme: 'customTheme',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false 
    });

    // ✅ ENVIAR CAMBIOS DEL CURSOR AL SERVICIO
    this.editor.onDidChangeCursorPosition(() => {
      const pos = this.editor.getPosition();
      if (pos) {
        this.ide.updateCursorPosition(pos.lineNumber, pos.column);
      }
    });

    // ENVIAR CAMBIOS DE TEXTO AL SERVICIO
    this.editor.onDidChangeModelContent(() => {
      if (!this.activeFile) return;
      const model = this.editor.getModel();
      if (model) {
        this.ide.updateFileContent(this.activeFile, model.getValue());
      }
    });

    this.editor.focus();
  }

  // =========================
  // 📂 TABS
  // =========================
  selectTab(file: string) {
    this.ide.openFile(file);
  }

  closeTab(file: string) {
    this.ide.closeFile(file);
    if (this.models[file]) {
      this.models[file].dispose();
      delete this.models[file];
    }
  }

  // =========================
  // 🎨 COLOR PICKER
  // =========================
  openColorPicker() {
    this.colorPicker.nativeElement.click();
  }

  onColorSelected(event: any) {
    this.selectedColor = event.target.value;
  }

  getFormattedColor(): string {
    return this.format === 'hex' ? this.selectedColor : this.hexToRgb(this.selectedColor);
  }

  insertColor() {
    const value = this.getFormattedColor();
    this.insertAtCursor(value);
  }

  copyColor() {
    const value = this.getFormattedColor();
    navigator.clipboard.writeText(value);
  }

  insertAtCursor(text: string) {
    if (!this.editor) return;
    const selection = this.editor.getSelection();
    this.editor.executeEdits('', [
      { range: selection, text, forceMoveMarkers: true }
    ]);
    this.editor.focus();
  }

  hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r},${g},${b})`;
  }

  getLanguage(file: string): string {
    return 'customLang';
  }
}