import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdeService } from '../ide.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule], // 🔥 CLAVE
  templateUrl: './toolbar.html',
  styleUrls: ['./toolbar.css'],
})
export class Toolbar {

  ideName = 'CodeForge ⚡';

  menus = {
    archivo: false
  };

  constructor(private ide: IdeService) {}

  toggle(menu: string) {
    this.menus[menu as keyof typeof this.menus] =
      !this.menus[menu as keyof typeof this.menus];
  }

  openTerminal() {
    this.ide.toggleTerminal();
  }

newFile() {
  const name = prompt('Nombre del archivo');
  if (!name) return;

  this.ide.createFile(name);
}

newFolder() {
  const name = prompt('Nombre de la carpeta');
  if (!name) return;

  this.ide.createFolder(name);
}

run() {
  console.log('Ejecutar proyecto');
}

preview() {
  console.log('Vista previa');
}
  
}