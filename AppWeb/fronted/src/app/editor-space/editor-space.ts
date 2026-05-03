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

@Component({
  selector: 'app-editor-space',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './editor-space.html',
  styleUrls: ['./editor-space.css'],
})
export class EditorSpace implements AfterViewInit, OnInit {

  @ViewChild('editorContainer', { static: true }) container!: ElementRef;

  private isBrowser: boolean;
  editor: any;

  tabs: string[] = [];
  activeFile: string = '';

  cursorPosition = { line: 1, column: 1 };

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
  }

  selectTab(file: string) {
    this.ide.openFile(file);
  }

  closeTab(file: string) {
    this.ide.closeFile(file);
  }
}