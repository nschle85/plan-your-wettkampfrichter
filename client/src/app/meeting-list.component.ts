import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { Meeting } from './types';
import { SocketService } from './socket.service';

@Component({
  standalone: true,
  selector: 'app-meeting-list',
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="card">
      <h2>Neues Meeting erstellen</h2>
      <div class="row">
        <input type="text" [(ngModel)]="name" placeholder="Meeting-Name" />
        <button class="btn" (click)="create()" [disabled]="!name.trim() || creating">Erstellen</button>
      </div>
    </div>

    <div class="card">
      <h2>Meetings</h2>
      <div *ngIf="loading">Laden…</div>
      <ul>
        <li *ngFor="let m of meetings">
          <a [routerLink]="['/meeting', m.id]">{{m.name}}</a>
          <small style="color:#6b7280">#{{m.id}} · {{m.created_at}}</small>
        </li>
      </ul>
    </div>
  `,
  styles: [`
    h2 { margin: 0 0 8px; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 6px 0; display: flex; gap: 8px; align-items: baseline; }
    input { flex: 1; }
  `]
})
export class MeetingListComponent implements OnDestroy {
  name = '';
  meetings: Meeting[] = [];
  loading = true;
  creating = false;

  private onMeetingsUpdate = (msg: any) => {
    if (msg?.type === 'meeting:add' && msg.meeting) {
      const m: Meeting = msg.meeting as Meeting;
      const exists = this.meetings.some(x => x.id === m.id);
      if (!exists) {
        this.meetings = [m, ...this.meetings];
      }
    }
  };

  constructor(private api: ApiService, private router: Router, private socket: SocketService) {
    this.load();
    // Subscribe to global meetings updates
    this.socket.on('meetings:update', this.onMeetingsUpdate);
  }

  ngOnDestroy(): void {
    this.socket.off('meetings:update', this.onMeetingsUpdate);
  }

  load() {
    this.loading = true;
    this.api.getMeetings().subscribe({
      next: ms => { this.meetings = ms; this.loading = false; },
      error: _ => { this.loading = false; }
    });
  }

  create() {
    const n = this.name.trim();
    if (!n) return;
    this.creating = true;
    this.api.createMeeting(n).subscribe({
      next: m => this.router.navigate(['/meeting', m.id]),
      error: _ => this.creating = false
    });
  }
}
