import { Component, OnInit, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IdeService } from '../ide.service';
import { ApiService, DbRow, CompileError } from '../api.service';

interface DbEntry {
  query: string;
  rows: DbRow[];
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

    const res = await this.api.executeQuery(query);
    this.dbHistory.push({
      query,
      rows:  res.ok ? (res.rows ?? []) : [],
      error: res.ok ? undefined : res.error,
    });

    this.dbLoading = false;
  }

  clearDb() {
    this.dbHistory = [];
  }

  rowKeys(row: any): string[] {
    return Object.keys(row);
  }
}