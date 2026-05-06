import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="message"
         class="toast"
         [ngClass]="message.type">

      {{ message.text }}

    </div>
  `,
  styleUrls: ['./notification.css']
})
export class NotificationComponent {

  message: any = null;

  constructor(private notify: NotificationService) {
  this.notify.message$.subscribe((m: any) => this.message = m);
  }
}