import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdeService, FileNode } from '../ide.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css'],
})
export class Sidebar implements OnInit {

  tree: FileNode[] = [];
  rootName = '';
  rootOpen = true;
  hasProject = false;

  draggedNode: FileNode | null = null;

  constructor(private ide: IdeService) {}

  ngOnInit() {
    this.ide.rootName.subscribe(name => this.rootName = name);
    this.ide.rootOpen.subscribe(open => this.rootOpen = open);

    this.ide.fileTree.subscribe(tree => {
      this.tree = this.assignDepth(tree, 0);
    });
    this.ide.rootName.subscribe(() => {
      this.hasProject = true;
    });
  }

  assignDepth(nodes: FileNode[], depth: number): FileNode[] {
    return nodes.map(node => ({
      ...node,
      depth,
      children: node.children
        ? this.assignDepth(node.children, depth + 1)
        : []
    }));
  }

  toggleRoot() {
    this.rootOpen = !this.rootOpen;
    this.ide.rootOpen.next(this.rootOpen);
  }

  toggle(node: FileNode) {
    if (node.type === 'folder') {
      node.isOpen = !node.isOpen;
    } else {
      this.ide.openFile(node.path);
    }
  }

  async loadProject() {
    await this.ide.loadProject();
  }

  // DRAG
  onDragStart(node: FileNode) {
    this.draggedNode = node;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async onDrop(target: FileNode) {
    if (!this.draggedNode) return;

    if (target.type === 'folder') {
      await this.ide.moveFile(this.draggedNode, target);
    }

    this.draggedNode = null;
  }

  getIcon(node: any): string {
  if (node.type === 'folder') {
    return node.isOpen ? '📂' : '📁';
  }

  // EXTENSIONES
  if (node.name.endsWith('.y')) {
    return '🧠'; // lógica principal
  }

  if (node.name.endsWith('.comp')) {
    return '🧩'; // componentes
  }

  if (node.name.endsWith('.styles')) {
    return '🎨'; // estilos
  }

  return '📄'; // default
}

}