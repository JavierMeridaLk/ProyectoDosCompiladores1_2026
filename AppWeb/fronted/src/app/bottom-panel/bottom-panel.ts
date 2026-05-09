import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IdeService } from '../ide.service';
import { ApiService, DbRow, CompileError } from '../api.service';

interface DbEntry {
  query: string;           // lo que escribió el usuario
  sql?: string;            // SQL generado por el traductor
  rows: DbRow[];
  errores?: { tipo: string; descripcion: string; linea: number; columna: number }[];
  error?: string;
}

@Component({
  selector: 'app-bottom-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bottom-panel.html',
  styleUrls: ['./bottom-panel.css'],
})
export class BottomPanel implements OnInit, AfterViewChecked {

  @ViewChild('terminalScroll') terminalScroll!: ElementRef;

  activeTab: 'terminal' | 'errores' = 'terminal';

  dbCommand  = '';
  dbHistory: DbEntry[] = [];
  dbLoading  = false;

  errors: (CompileError & { archivo?: string })[] = [];
  compiling = false;

  constructor(private ide: IdeService, private api: ApiService) {}

  ngOnInit() {
    this.ide.compileErrors.subscribe(errs => {
      this.errors = errs as any;
      if (errs.length) this.activeTab = 'errores';
    });
    this.ide.compiling.subscribe(v => this.compiling = v);
  }

  ngAfterViewChecked() {
    try {
      const el = this.terminalScroll?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  async executeDb() {
    const query = this.dbCommand.trim();
    if (!query || this.dbLoading) return;

    this.dbLoading = true;
    this.dbCommand = '';

    try {
      const res = await this.api.executeDbTerminal(query);
      this.dbHistory.push({
        query,
        sql:    res.sql,
        rows:   res.ok ? (res.rows ?? []) : [],
        errores: res.errores?.length ? res.errores : undefined,
        error:   res.ok ? undefined : res.error,
      });
    } catch (e: any) {
      this.dbHistory.push({
        query,
        rows:  [],
        error: e?.message ?? 'Error de conexión con el servidor',
      });
    } finally {
      this.dbLoading = false;
    }
  }

  clearDb() {
    this.dbHistory = [];
  }

  rowKeys(row: any): string[] {
    return Object.keys(row);
  }
}
