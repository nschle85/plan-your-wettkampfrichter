import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/env';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (!this.socket) {
      this.socket = io(environment.apiUrl, {
        // Explicit path to be robust behind proxies; default is '/socket.io'
        path: '/socket.io',
        // Allow fallback to polling for environments where WS upgrade is blocked
        transports: ['websocket', 'polling']
      });
    }
    return this.socket!;
  }

  joinMeeting(meetingId: number) {
    this.connect().emit('join', meetingId);
  }

  leaveMeeting(meetingId: number) {
    this.socket?.emit('leave', meetingId);
  }

  on(event: string, handler: (...args: any[]) => void) {
    this.connect().on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void) {
    if (handler) this.socket?.off(event, handler);
    else this.socket?.off(event);
  }
}
