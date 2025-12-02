import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Meeting } from '../../models/types';
import { SocketService } from '../../services/socket.service';

@Component({
  standalone: true,
  selector: 'app-meeting-list',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './meeting-list.component.html',
  styleUrls: ['./meeting-list.component.scss']
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
    if (msg?.type === 'meeting:remove' && msg.meetingId) {
      const id: number = Number(msg.meetingId);
      this.meetings = this.meetings.filter(x => x.id !== id);
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

  delete(meeting: Meeting) {
    if (!meeting?.id) return;
    const ok = confirm(`Meeting "${meeting.name}" wirklich löschen?`);
    if (!ok) return;
    this.api.deleteMeeting(meeting.id).subscribe({
      next: _ => {
        this.meetings = this.meetings.filter(x => x.id !== meeting.id);
      },
      error: _ => {}
    });
  }
}
