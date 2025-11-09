import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { Assignment, MeetingFull, Section, Task, User } from './types';
import { SocketService } from './socket.service';

@Component({
  standalone: true,
  selector: 'app-meeting-board',
  imports: [CommonModule, FormsModule],
  template: `
  <div *ngIf="!data" class="card">Laden…</div>
  <div *ngIf="data" class="card">
    <div class="row" style="justify-content: space-between; align-items: center;">
      <h2 style="margin:0;">{{data.meeting.name}}</h2>
      <div class="row" style="gap:8px; align-items:center;">
        <label>Ihr Name:</label>
        <input type="text" [(ngModel)]="userName" (ngModelChange)="onUserInputChange()" (keyup.enter)="confirmUser()" (blur)="confirmUserOnBlur()" placeholder="Name" style="width:220px;" />
        <button class="btn" (click)="confirmUser()" [disabled]="!userName.trim()">Erzeugen</button>
        <span style="color:#6b7280;">oder wählen:</span>
        <select [(ngModel)]="currentUserId" (ngModelChange)="onCurrentUserSelect($event)">
          <option [ngValue]="null">– auswählen –</option>
          <option *ngFor="let u of data.users" [ngValue]="u.id">{{u.name}}</option>
        </select>
      </div>
    </div>

    <div class="row" style="margin-top:8px; gap:16px;">
      <div class="row" style="gap:8px;">
        <input type="text" [(ngModel)]="newTask" placeholder="Neue Task" />
        <button class="btn" (click)="addTask()" [disabled]="!newTask.trim()">+ Task</button>
      </div>
      <div class="row" style="gap:8px;">
        <input type="text" [(ngModel)]="newSection" placeholder="Neue Section" />
        <button class="btn" (click)="addSection()" [disabled]="!newSection.trim()">+ Section</button>
      </div>
    </div>

    <div style="overflow:auto; margin-top:12px;">
      <table class="table">
        <thead>
          <tr>
            <th class="sticky-left">Tasks \\ Sections</th>
            <th *ngFor="let s of data.sections">{{s.name}}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of data.tasks">
            <th class="sticky-left" style="text-align:left;">{{t.name}}</th>
            <td *ngFor="let s of data.sections">
              <label style="display:flex; gap:6px; align-items:center; justify-content:center;">
                <input type="checkbox"
                       [checked]="isChecked(t.id, s.id)"
                       (change)="toggle(t, s, $event.target?.checked)"
                       [disabled]="!currentUserId" />
                <span class="cell-users">{{usersFor(t.id, s.id).join(', ')}}</span>
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top:12px;">
      <h3 style="margin:0 0 6px; font-size:14px; color:#374151;">Benutzer im Meeting</h3>
      <ul style="list-style:none; padding:0; margin:0; display:flex; gap:8px; flex-wrap:wrap;">
        <li *ngFor="let u of data.users" style="border:1px solid #e5e7eb; padding:4px 8px; border-radius:6px; display:flex; gap:8px; align-items:center;">
          <span [style.fontWeight]="u.id===currentUserId ? '600' : '400'">{{u.name}}</span>
          <button class="btn" style="background:#ef4444;" (click)="deleteUser(u)" [disabled]="false">Löschen</button>
        </li>
      </ul>
    </div>

    <p style="color:#6b7280; font-size:12px; margin-top:8px;">
      Hinweis: Der eigene Name und die Benutzer-ID werden in LocalStorage gespeichert. Änderungen werden in anderen Tabs sofort angezeigt.
    </p>
  </div>
  `,
  styles: [`
    h2 { margin: 0 0 8px; }
    .cell-users { color:#374151; font-size: 12px; }
  `]
})
export class MeetingBoardComponent implements OnDestroy {
  meetingId!: number;
  data: MeetingFull | null = null;
  userName: string = localStorage.getItem('mm_user_name') || '';
  currentUserId: number | null = null;
  newTask = '';
  newSection = '';

  private socketHandler = (msg: any) => {
    if (!this.data) return;
    switch (msg?.type) {
      case 'task:add':
        this.data.tasks = [...this.data.tasks, msg.task as Task];
        break;
      case 'section:add':
        this.data.sections = [...this.data.sections, msg.section as Section];
        break;
      case 'user:add': {
        const u = msg.user as User;
        if (!this.data.users.some(x => x.id === u.id)) {
          this.data.users = [...this.data.users, u];
        }
        break;
      }
      case 'assign:update': {
        const { taskId, sectionId, userId, selected, user } = msg as { taskId:number; sectionId:number; userId:number; selected:boolean; user?: User };
        const key = (a: Assignment) => a.meeting_id===this.meetingId && a.task_id===taskId && a.section_id===sectionId && a.user_id===userId;
        if (selected) {
          const exists = this.data.assignments.some(key);
          if (!exists) this.data.assignments = [...this.data.assignments, { meeting_id: this.meetingId, task_id: taskId, section_id: sectionId, user_id: userId } as Assignment];
          // Ensure the user list contains this user (users are derived from assignments)
          if (user && !this.data.users.some(u => u.id === user.id)) {
            this.data.users = [...this.data.users, user];
          } else if (!this.data.users.some(u => u.id === userId)) {
            // Fallback: if server didn't provide user object, try to infer from current selection
            const inferred: User | undefined = this.currentUserId === userId ? { id: userId, name: this.userName.trim() } as User : undefined;
            if (inferred) this.data.users = [...this.data.users, inferred];
          }
        } else {
          this.data.assignments = this.data.assignments.filter(a => !key(a));
          // If the user has no more assignments in this meeting, remove from users list
          const stillAssigned = this.data.assignments.some(a => a.user_id === userId && a.meeting_id === this.meetingId);
          if (!stillAssigned) {
            this.data.users = this.data.users.filter(u => u.id !== userId);
            if (this.currentUserId === userId) {
              this.currentUserId = null;
              localStorage.removeItem(this.userStorageKey());
            }
          }
        }
        break;
      }
      case 'user:delete': {
        const userId = (msg as any).userId as number;
        this.data.users = this.data.users.filter(u => u.id !== userId);
        this.data.assignments = this.data.assignments.filter(a => a.user_id !== userId);
        if (this.currentUserId === userId) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
        break;
      }
    }
  };

  constructor(private route: ActivatedRoute, private api: ApiService, private socket: SocketService) {
    this.meetingId = Number(this.route.snapshot.paramMap.get('id'));
    this.currentUserId = this.loadStoredUserId();
    this.load();
    this.socket.joinMeeting(this.meetingId);
    this.socket.on('meeting:update', this.socketHandler);
  }

  ngOnDestroy() {
    this.socket.off('meeting:update', this.socketHandler);
    this.socket.leaveMeeting(this.meetingId);
  }

  load() {
    this.api.getMeetingFull(this.meetingId).subscribe(full => {
      this.data = full;
      // Try to resolve currentUserId from stored info
      if (!this.currentUserId && this.userName?.trim()) {
        const found = full.users.find(u => u.name === this.userName.trim());
        if (found) {
          this.setCurrentUser(found);
        }
        // Do NOT auto-create a user here; wait for explicit confirmation (Enter/Blur/Button)
      }
    });
  }

  // Track last explicit confirmation to prevent double-call from Enter + Blur
  private lastConfirmAt = 0;

  onUserInputChange() {
    const name = this.userName.trim();
    localStorage.setItem('mm_user_name', name);
    if (!name) {
      this.currentUserId = null;
      localStorage.removeItem(this.userStorageKey());
      return;
    }
    // Do not create/select user on each keystroke; wait for confirm
  }

  confirmUser() {
    const name = this.userName.trim();
    this.lastConfirmAt = Date.now();
    localStorage.setItem('mm_user_name', name);
    if (!this.data) return;
    if (!name) {
      this.currentUserId = null;
      localStorage.removeItem(this.userStorageKey());
      return;
    }
    const existing = this.data.users.find(u => u.name === name);
    if (existing) {
      this.setCurrentUser(existing);
    } else {
      this.api.createUser(this.meetingId, name).subscribe(u => this.setCurrentUser(u));
    }
  }

  confirmUserOnBlur() {
    // If Enter was just pressed, blur will fire immediately after; avoid duplicate call
    if (Date.now() - this.lastConfirmAt < 150) return;
    this.confirmUser();
  }

  addTask() {
    const n = this.newTask.trim();
    if (!n) return;
    this.api.addTask(this.meetingId, n).subscribe(_ => this.newTask = '');
  }

  addSection() {
    const n = this.newSection.trim();
    if (!n) return;
    this.api.addSection(this.meetingId, n).subscribe(_ => this.newSection = '');
  }

  isChecked(taskId: number, sectionId: number) {
    if (!this.currentUserId) return false;
    return this.data?.assignments.some(a => a.task_id === taskId && a.section_id === sectionId && a.user_id === this.currentUserId) ?? false;
  }

  usersFor(taskId: number, sectionId: number): string[] {
    if (!this.data) return [];
    const ids = this.data.assignments.filter(a => a.task_id === taskId && a.section_id === sectionId).map(a => a.user_id);
    const names = ids
      .map(id => this.data!.users.find(u => u.id === id)?.name)
      .filter((n): n is string => !!n);
    return names;
  }

  toggle(task: Task, section: Section, checked: boolean | undefined) {
    if (checked == null || !this.currentUserId) return;
    this.api.setAssignment(this.meetingId, task.id, section.id, this.currentUserId, checked).subscribe();
  }

  onCurrentUserSelect(id: number | null) {
    if (!id || !this.data) {
      this.currentUserId = null;
      localStorage.removeItem(this.userStorageKey());
      return;
    }
    const u = this.data.users.find(x => x.id === id);
    if (u) this.setCurrentUser(u);
  }

  deleteUser(u: User) {
    if (!this.data) return;
    const ok = confirm(`Benutzer \'${u.name}\' löschen?`);
    if (!ok) return;
    this.api.deleteUserFromMeeting(this.meetingId, u.id).subscribe({
      next: () => {
        // Update immediately; socket event will also arrive
        this.data!.users = this.data!.users.filter(x => x.id !== u.id);
        this.data!.assignments = this.data!.assignments.filter(a => a.user_id !== u.id);
        if (this.currentUserId === u.id) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
      }
    });
  }

  private userStorageKey(): string {
    return `mm_user_id_${this.meetingId}`;
  }

  private loadStoredUserId(): number | null {
    const raw = localStorage.getItem(this.userStorageKey());
    const id = raw ? Number(raw) : NaN;
    return isNaN(id) ? null : id;
  }

  private setCurrentUser(u: User) {
    this.currentUserId = u.id;
    // Keep the typed name in sync with the selected user for clarity
    this.userName = u.name;
    localStorage.setItem(this.userStorageKey(), String(u.id));
    // Ensure user list contains this user
    if (this.data && !this.data.users.some(x => x.id === u.id)) {
      this.data.users = [...this.data.users, u];
    }
  }
}
