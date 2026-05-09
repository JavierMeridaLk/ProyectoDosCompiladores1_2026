import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface CompileFile {
  path: string;
  content: string;
}

export interface CompileError {
  tipo: string;
  descripcion: string;
  linea: number;
  columna: number;
}

export interface CompileResult {
  file: string;
  tipo: string;
  salida: string | null;
  errores: CompileError[];
  dbResultado?: any[] | null;
  ignorado?: boolean;
}

export interface DbRow {
  tipo: 'select' | 'change';
  resultado?: any[];
  changes?: number;
  lastID?: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {

  private readonly base = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  async compileProject(files: CompileFile[]): Promise<CompileResult[]> {
    const res = await firstValueFrom(
      this.http.post<{ results: CompileResult[] }>(`${this.base}/compile`, { files })
    );
    return res.results;
  }

  async executeQuery(query: string): Promise<{ ok: boolean; rows?: DbRow[]; error?: string }> {
    return firstValueFrom(
      this.http.post<{ ok: boolean; rows?: DbRow[]; error?: string }>(
        `${this.base}/execute-db`,
        { query }
      )
    );
  }

  async executeDbTerminal(query: string): Promise<{
    ok: boolean;
    sql?: string;
    rows?: DbRow[];
    errores?: { tipo: string; descripcion: string; linea: number; columna: number }[];
    error?: string;
  }> {
    return firstValueFrom(
      this.http.post<any>(`${this.base}/db-terminal`, { query })
    );
  }

  async previewProject(files: CompileFile[], titulo?: string): Promise<string> {
    const html = await firstValueFrom(
      this.http.post(`${this.base}/preview`, { files, titulo },
        { responseType: 'text' }
      )
    );
    return html;
  }

  async exportProject(files: CompileFile[], nombre?: string): Promise<{
    ok: boolean;
    archivos?: { nombre: string; contenido: string }[];
    error?: string;
    results?: CompileResult[];
  }> {
    return firstValueFrom(
      this.http.post<any>(`${this.base}/export`, { files, nombre })
    );
  }
}
