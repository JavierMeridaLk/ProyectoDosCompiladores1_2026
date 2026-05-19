import { Component, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdeService } from '../ide.service';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toolbar.html',
  styleUrls: ['./toolbar.css'],
  
})
export class Toolbar {

  ideName = 'YFERA FRAMEWORK';

  menus = { archivo: false };

  constructor(private ide: IdeService) {}

  @HostListener('document:click')
  onDocumentClick() {
    this.closeAll();
  }

  toggle() {
    this.menus.archivo = !this.menus.archivo;
  }

  closeAll() {
    this.menus.archivo = false;
  }


  async newProject() {
    const name = prompt('Nombre del proyecto');
    if (!name) return;

    await this.ide.newProject(name);

    this.closeAll();
  }

  async loadProject() {
    await this.ide.loadProject();
    this.closeAll();
  }

  async newFile() {
    const name = prompt('Nombre del archivo');
    if (!name) return;

    await this.ide.createFile(name);
    this.closeAll();
  }

  async newFolder() {
    const name = prompt('Nombre de la carpeta');
    if (!name) return;

    await this.ide.createFolder(name);
    this.closeAll();
  }

  async save() {
    const file = this.ide.activeFile.value;
    if (!file) return;

    await this.ide.saveFile(file);
    this.closeAll();
  }

  async saveAll() {
    await this.ide.saveAll();
    this.closeAll();
  }

  openTerminal() {
    this.ide.toggleTerminal();
    this.closeAll();
  }

  async run() {
    this.closeAll();
    await this.ide.compileProject();
    if (this.ide.compileErrors.value.length === 0) {
      await this.ide.exportProject();
    }
  }

  async preview() {
    this.closeAll();
    await this.ide.previewProject();
  }
}