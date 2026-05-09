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
}
