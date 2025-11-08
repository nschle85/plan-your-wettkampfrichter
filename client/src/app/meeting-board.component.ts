import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from './api.service';
import { Assignment, MeetingFull, Section, Task } from './types';
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
      <div class="row">
        <label>Ihr Name:</label>
        <input type="text" [(ngModel)]="user" (ngModelChange)="onUserChange()" placeholder="Name" style="width:220px;" />
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
                       [checked]="isChecked(t.id, s.id, user)"
                       (change)="toggle(t, s, $event.target?.checked)"
                       [disabled]="!user.trim()" />
                <span class="cell-users">{{usersFor(t.id, s.id).join(', ')}}</span>
              </label>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p style="color:#6b7280; font-size:12px; margin-top:8px;">
      Hinweis: Der eigene Name wird in LocalStorage gespeichert. Änderungen werden in anderen Tabs sofort angezeigt.
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
  user: string = localStorage.getItem('mm_user') || '';
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
      case 'assign:update': {
        const { taskId, sectionId, user, selected } = msg as { taskId:number; sectionId:number; user:string; selected:boolean };
        const key = (a: Assignment) => a.meeting_id===this.meetingId && a.task_id===taskId && a.section_id===sectionId && a.user===user;
        if (selected) {
          const exists = this.data.assignments.some(key);
          if (!exists) this.data.assignments = [...this.data.assignments, { meeting_id: this.meetingId, task_id: taskId, section_id: sectionId, user }];
        } else {
          this.data.assignments = this.data.assignments.filter(a => !key(a));
        }
        break;
      }
    }
  };

  constructor(private route: ActivatedRoute, private api: ApiService, private socket: SocketService) {
    this.meetingId = Number(this.route.snapshot.paramMap.get('id'));
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
    });
  }

  onUserChange() {
    localStorage.setItem('mm_user', this.user);
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

  isChecked(taskId: number, sectionId: number, user: string) {
    if (!user?.trim()) return false;
    return this.data?.assignments.some(a => a.task_id === taskId && a.section_id === sectionId && a.user === user) ?? false;
  }

  usersFor(taskId: number, sectionId: number): string[] {
    return this.data?.assignments.filter(a => a.task_id === taskId && a.section_id === sectionId).map(a => a.user) ?? [];
  }

  toggle(task: Task, section: Section, checked: boolean | undefined) {
    if (checked == null) return;
    const u = this.user.trim();
    if (!u) return;
    this.api.setAssignment(this.meetingId, task.id, section.id, u, checked).subscribe();
  }
}
