import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class IdeShell {

  panelHeight = 220;

  private _resizing  = false;
  private _startY    = 0;
  private _startH    = 0;

  startResize(e: MouseEvent) {
    e.preventDefault();
    this._resizing = true;
    this._startY   = e.clientY;
    this._startH   = this.panelHeight;
    document.body.style.cursor     = 'ns-resize';
    document.body.style.userSelect = 'none';
  }

  //Logica para poder modioficar el panel 
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this._resizing) return;
    const delta  = this._startY - e.clientY; 
    const minH   = 80;
    const maxH   = window.innerHeight - 40 - 100;     
    this.panelHeight = Math.max(minH, Math.min(maxH, this._startH + delta));
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    if (!this._resizing) return;
    this._resizing = false;
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  }
}
