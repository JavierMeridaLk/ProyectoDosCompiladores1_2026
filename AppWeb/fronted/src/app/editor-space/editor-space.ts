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

    this.ide.activeFile.subscribe((file: string | null) => {
      if (!file) return;

      this.activeFile = file;

      if (this.editor) {
        const value = this.ide.getFileContent(file);
        this.editor.setValue(value);
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
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      parameterHints: { enabled: false },
      wordBasedSuggestions: 'off',
      minimap: { enabled: false }
    });

    this.editor.onDidChangeCursorPosition((e: any) => {
      this.cursorPosition = {
        line: e.position.lineNumber,
        column: e.position.column
      };
    });

    this.editor.onDidChangeModelContent(() => {
      if (!this.activeFile) return;
      this.ide.updateFileContent(this.activeFile, this.editor.getValue());
    });
  }


  selectTab(file: string) {
    this.ide.openFile(file);
  }

  closeTab(file: string) {
    this.ide.closeFile(file);
  }

  // ABRIR SELECTOR
  openColorPicker() {
    this.colorPicker.nativeElement.click();
  }

  // GUARDAR COLOR (NO INSERTA)
  onColorSelected(event: any) {
    this.selectedColor = event.target.value;
  }

  // OBTENER VALOR FINAL
  getFormattedColor(): string {
    return this.format === 'hex'
      ? this.selectedColor
      : this.hexToRgb(this.selectedColor);
  }

  // INSERTAR CUANDO USUARIO QUIERA
  insertColor() {
    const value = this.getFormattedColor();
    this.insertAtCursor(value);
  }

  // COPIAR
  copyColor() {
    const value = this.getFormattedColor();
    navigator.clipboard.writeText(value);
  }

  // INSERTAR EN CURSOR
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

  // HEX → RGB
  hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgb(${r},${g},${b})`;
  }
}