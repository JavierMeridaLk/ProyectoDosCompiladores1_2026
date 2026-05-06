import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface NotificationMessage {
  type: 'success' | 'info' | 'error';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private _message = new BehaviorSubject<NotificationMessage | null>(null);
  message$ = this._message.asObservable();

  show(message: NotificationMessage) {
    this._message.next(message);

    setTimeout(() => {
      this._message.next(null);
    }, 3000);
  }

  success(text: string) {
    this.show({ type: 'success', text });
  }

  info(text: string) {
    this.show({ type: 'info', text });
  }

  error(text: string) {
    this.show({ type: 'error', text });
  }
}