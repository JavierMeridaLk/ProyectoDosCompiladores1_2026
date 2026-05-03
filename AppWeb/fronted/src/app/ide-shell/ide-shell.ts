import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // 🔥 IMPORTANTE
import { Toolbar } from '../toolbar/toolbar';
import { Sidebar } from '../sidebar/sidebar';
import { EditorSpace } from '../editor-space/editor-space';
import { BottomPanel } from '../bottom-panel/bottom-panel';

@Component({
  selector: 'app-ide-shell',
  standalone: true,
  imports: [CommonModule, Toolbar, Sidebar, EditorSpace, BottomPanel],
  templateUrl: './ide-shell.html',
  styleUrls: ['./ide-shell.css'],
})
export class IdeShell {}