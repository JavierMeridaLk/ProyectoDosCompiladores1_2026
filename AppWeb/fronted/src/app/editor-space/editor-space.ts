import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnInit,
  Inject,
  PLATFORM_ID
} from '@angular/core';

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

    this.ide.openFiles.subscribe((files: string[]) => {
      this.tabs = files;
    });

    this.ide.activeFile.subscribe(async (file: string | null) => {
      if (!file || !this.editor) return;

      this.activeFile = file;

      const monaco = await import('monaco-editor');

      let model = this.models[file];

      // CREAR MODELO SI NO EXISTE
      if (!model) {
        const value = this.ide.getFileContent(file);

        model = monaco.editor.createModel(
          value,
          this.getLanguage(file)
        );

        this.models[file] = model;
      }

      // ASIGNAR MODELO
      this.editor.setModel(model);
      this.editor.focus();

      // ACTUALIZAR CURSOR
      const pos = this.editor.getPosition();
      if (pos) {
        this.cursorPosition = {
          line: pos.lineNumber,
          column: pos.column
        };
      }
    });
  }

  async ngAfterViewInit() {
    if (!this.isBrowser) return;

    const monaco = await import('monaco-editor');

    this.editor = monaco.editor.create(this.container.nativeElement, {
      value: '',
      language: 'typescript',
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false }
    });

    this.editor.onDidChangeCursorPosition(() => {
      const pos = this.editor.getPosition();

      if (pos) {
        this.cursorPosition = {
          line: pos.lineNumber,
          column: pos.column
        };
      }
    });

    this.editor.onDidChangeModelContent(() => {
      if (!this.activeFile) return;

      const model = this.editor.getModel();

      if (model) {
        this.ide.updateFileContent(
          this.activeFile,
          model.getValue()
        );
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
    return this.format === 'hex'
      ? this.selectedColor
      : this.hexToRgb(this.selectedColor);
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
      {
        range: selection,
        text,
        forceMoveMarkers: true
      }
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

    if (file.endsWith('.y')) {
      return 'javascript'; // lógica
    }

    if (file.endsWith('.comp')) {
      return 'html'; // componentes
    }

    if (file.endsWith('.styles')) {
      return 'css'; // estilos
    }

    return 'plaintext';
  }
}