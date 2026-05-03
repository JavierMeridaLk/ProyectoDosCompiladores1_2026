import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdeService } from '../ide.service';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  children?: FileNode[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar {

  constructor(private ide: IdeService) {}

  tree: FileNode[] = [
    {
      name: 'src',
      type: 'folder',
      isOpen: true,
      children: [
        {
          name: 'index.ts',
          type: 'file'
        },
        {
          name: 'app.ts',
          type: 'file'
        },
        {
          name: 'components',
          type: 'folder',
          isOpen: false,
          children: [
            { name: 'header.ts', type: 'file' }
          ]
        }
      ]
    }
  ];

  toggle(node: FileNode) {
    if (node.type === 'folder') {
      node.isOpen = !node.isOpen;
    } else {
      this.ide.openFile(node.name);
    }
  }

  addFile() {
    const name = prompt('Nombre del archivo');
    if (!name) return;

    this.tree[0].children?.push({
      name,
      type: 'file'
    });
  }

  addFolder() {
    const name = prompt('Nombre de la carpeta');
    if (!name) return;

    this.tree[0].children?.push({
      name,
      type: 'folder',
      isOpen: false,
      children: []
    });
  }

}