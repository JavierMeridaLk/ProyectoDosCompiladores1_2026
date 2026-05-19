import { Component, ElementRef, ViewChild, AfterViewInit, OnInit, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { IdeService } from '../ide.service';
import { FormsModule } from '@angular/forms';

function getParser(mod: any): any {
  return mod?.parser ?? mod?.default?.parser ?? null;
}

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

  private editorReady!: Promise<void>;
  private resolveEditorReady!: () => void;

  // modelo de caeda archivo
  models: Record<string, any> = {};
  tabs: string[] = [];
  activeFile: string = '';

  cursorPosition = { line: 1, column: 1 };
  selectedColor: string = '#ffffff';
  format: 'hex' | 'rgb' = 'hex';

  constructor(
    private ide: IdeService,
    @Inject(PLATFORM_ID) platformId: Object,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.editorReady = new Promise(resolve => { this.resolveEditorReady = resolve; });
  }

  ngOnInit() {

    this.ide.openFiles.subscribe((files: string[]) => {
      this.tabs = files;
      this.cdr.markForCheck();
    });

    // Suscribirse al archivo activo 
    this.ide.activeFile.subscribe(async (file: string | null) => {
      if (!file) return;

      await this.editorReady;

      this.activeFile = file;
      this.cdr.markForCheck();

      const monaco = await import('monaco-editor');
      let model = this.models[file];

      if (!model) {
        const value = this.ide.getFileContent(file);
        model = monaco.editor.createModel(value, this.getLanguage(file));
        this.models[file] = model;
      }

      this.editor.setModel(model);
      this.editor.focus();

      const pos = this.editor.getPosition();
      if (pos) {
        this.cursorPosition = { line: pos.lineNumber, column: pos.column };
        this.cdr.markForCheck();
      }
    });
  }

  async ngAfterViewInit() {
    if (!this.isBrowser) return;

    // Cargar Monaco y los 4 parsers Jison en paralelo
    const [monaco, dbMod, principalMod, componentsMod, stylesMod] = await Promise.all([
      import('monaco-editor'),
      import('../../lexers/DBJison.js'),
      import('../../lexers/PrincipalJison.js'),
      import('../../lexers/ComponentsJison.js'),
      import('../../lexers/StylesJison.js'),
    ]);

    const dbParser         = getParser(dbMod);
    const principalParser  = getParser(principalMod);
    const componentsParser = getParser(componentsMod);
    const stylesParser     = getParser(stylesMod);

    // coloreado
    monaco.editor.defineTheme('customTheme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword',    foreground: 'C586C0' }, // Morado  — palabras reservadas
        { token: 'string',     foreground: 'CE9178' }, // Naranja — strings literales
        { token: 'number',     foreground: '4FC1FF' }, // Celeste — números y otros literales
        { token: 'literal',    foreground: '4FC1FF' }, // Celeste — booleanos (true/false)
        { token: 'operator',   foreground: '6A9955' }, // Verde   — operadores
        { token: 'delimiter',  foreground: '569CD6' }, // Azul    — { } ( ) [ ]
        { token: 'identifier', foreground: 'FFFFFF' }, // Blanco  — identificadores y otros
        { token: 'variable',   foreground: 'FFFFFF' }, // Blanco  — variables ($var)
        { token: 'comment',    foreground: '608B4E', fontStyle: 'italic' },
      ],
      colors: { 'editor.foreground': '#FFFFFF' }
    });

    //metodo que llama al lexer para el coloreado
    class LexState {
      constructor(public inBlockComment = false) {}
      equals(o: any)  { return o instanceof LexState && o.inBlockComment === this.inBlockComment; }
      clone(): LexState { return new LexState(this.inBlockComment); }
    }

    const makeProvider = (jisonParser: any): any => ({
      getInitialState: () => new LexState(),
      tokenize(line: string, state: any): any {
        try {
          const res = jisonParser.tokenizeLine(line, (state as LexState).inBlockComment);
          return { tokens: res.tokens, endState: new LexState(!!res.endState) };
        } catch {
          return { tokens: [], endState: state.clone() };
        }
      },
    });

    monaco.languages.register({ id: 'lang-y' });
    monaco.languages.register({ id: 'lang-comp' });
    monaco.languages.register({ id: 'lang-db' });
    monaco.languages.register({ id: 'lang-styles' });

    if (principalParser)  monaco.languages.setTokensProvider('lang-y',      makeProvider(principalParser));
    if (componentsParser) monaco.languages.setTokensProvider('lang-comp',   makeProvider(componentsParser));
    if (dbParser)         monaco.languages.setTokensProvider('lang-db',     makeProvider(dbParser));
    if (stylesParser)     monaco.languages.setTokensProvider('lang-styles', makeProvider(stylesParser));

    // Editor de codigo
    this.editor = monaco.editor.create(this.container.nativeElement, {
      value: '',
      language: 'lang-y',
      theme: 'customTheme',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false
    });

    this.resolveEditorReady();

    // columna y fila
    this.editor.onDidChangeCursorPosition(() => {
      const pos = this.editor.getPosition();
      if (pos) {
        this.cursorPosition = { line: pos.lineNumber, column: pos.column };
        this.cdr.markForCheck();
      }
    });

    // ssincronizacion
    this.editor.onDidChangeModelContent(() => {
      if (!this.activeFile) return;
      const model = this.editor.getModel();
      if (model) {
        this.ide.updateFileContent(this.activeFile, model.getValue());
      }
    });

    this.editor.focus();
  }

  // tabulaciones de los archivos abiertos
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

  // selector de colroes
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

  // Auto idendado
  autoIndent() {
    if (!this.editor) return;
    const model = this.editor.getModel();
    if (!model) return;

    const text  = model.getValue();
    const lines = text.split('\n');
    const SP    = '    '; 

    let level          = 0;
    let inString       = false;
    let strCh          = '';
    let inBlockComment = false;
    const out: string[] = [];

    for (const raw of lines) {
      const trimmed       = raw.trim();
      const startsInStr   = inString;
      const startsInBlock = inBlockComment;

      let opens = 0, closes = 0, i = 0;
      while (i < trimmed.length) {
        const ch  = trimmed[i];
        const ch2 = trimmed[i + 1] ?? '';

        if (inBlockComment) {
          if (ch === '*' && ch2 === '/') { inBlockComment = false; i += 2; }
          else i++;
          continue;
        }
        if (inString) {
          if (ch === strCh) { inString = false; strCh = ''; }
          i++;
          continue;
        }
        if (ch === '/' && ch2 === '*') { inBlockComment = true;  i += 2; continue; }
        if (ch === '/' && ch2 === '/') break; // line comment: stop
        if (ch === '"' || ch === "'")  { inString = true; strCh = ch; i++; continue; }

        if      (ch === '{' || ch === '[' || ch === '(') opens++;
        else if (ch === '}' || ch === ']' || ch === ')') closes++;
        i++;
      }

      if (startsInStr || startsInBlock) {
        out.push(raw);
        level = Math.max(0, level + opens - closes);
        continue;
      }

      if (!trimmed) { out.push(''); continue; }

      let leadingClosers = 0;
      for (const ch of trimmed) {
        if (ch === '}' || ch === ']' || ch === ')') leadingClosers++;
        else break;
      }

      const printLevel = Math.max(0, level - leadingClosers);
      out.push(SP.repeat(printLevel) + trimmed);
      level = Math.max(0, level + opens - closes);
    }

    const newText = out.join('\n');
    if (newText === text) return;

    const fullRange = model.getFullModelRange();
    this.editor.executeEdits('auto-indent', [{
      range: fullRange,
      text:  newText,
      forceMoveMarkers: true
    }]);
    this.editor.focus();
  }

  getLanguage(file: string): string {
    const ext = file.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'y':      return 'lang-y';
      case 'comp':   return 'lang-comp';
      case 'db':     return 'lang-db';
      case 'styles': return 'lang-styles';
      default:       return 'plaintext';
    }
  }
}