import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bottom-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bottom-panel.html',
  styleUrls: ['./bottom-panel.css'],
})
export class BottomPanel {

  command = '';
  history: string[] = [];

  execute() {
    if (!this.command.trim()) return;

    this.history.push('> ' + this.command);

    // ❌ eliminado "command not found"
    // puedes agregar lógica aquí después

    this.command = '';
  }
}