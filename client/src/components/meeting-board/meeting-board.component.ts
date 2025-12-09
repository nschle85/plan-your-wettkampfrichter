import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Assignment, MeetingFull, Section, Task, User } from '../../models/types';
import { SocketService } from '../../services/socket.service';

@Component({
  standalone: true,
  selector: 'app-meeting-board',
  imports: [CommonModule, FormsModule],
  templateUrl: './meeting-board.component.html',
  styleUrls: ['./meeting-board.component.scss']
})
export class MeetingBoardComponent implements OnDestroy {
  meetingId!: number;
  data: MeetingFull | null = null;
  // Global users list for selection (should offer all users)
  allUsers: User[] = [];
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
      case 'task:remove': {
        const taskId = (msg as any).taskId as number;
        this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
        // Remove related assignments
        this.data.assignments = this.data.assignments.filter(a => a.task_id !== taskId);
        // Prune users that no longer have any assignments in this meeting
        const stillUsedIds = new Set(this.data.assignments.filter(a => a.meeting_id === this.meetingId).map(a => a.user_id));
        this.data.users = this.data.users.filter(u => stillUsedIds.has(u.id));
        if (this.currentUserId && !stillUsedIds.has(this.currentUserId)) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
        break;
      }
      case 'section:add':
        this.data.sections = [...this.data.sections, msg.section as Section];
        break;
      case 'section:remove': {
        const sectionId = (msg as any).sectionId as number;
        this.data.sections = this.data.sections.filter(s => s.id !== sectionId);
        // Remove related assignments
        this.data.assignments = this.data.assignments.filter(a => a.section_id !== sectionId);
        // Prune users that no longer have any assignments in this meeting
        const stillUsedIds = new Set(this.data.assignments.filter(a => a.meeting_id === this.meetingId).map(a => a.user_id));
        this.data.users = this.data.users.filter(u => stillUsedIds.has(u.id));
        if (this.currentUserId && !stillUsedIds.has(this.currentUserId)) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
        break;
      }
      case 'user:add': {
        const u = msg.user as User;
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
    // Load global users to offer in selection dropdown
    this.api.getAllUsers().subscribe(users => {
      this.allUsers = users;
      // If we couldn't resolve current user from meeting users, try global users
      if (!this.currentUserId && this.userName?.trim()) {
        const found = users.find(u => u.name === this.userName.trim());
        if (found) this.setCurrentUser(found);
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
    const existing = this.allUsers.find(u => u.name === name) || this.data.users.find(u => u.name === name);
    if (existing) {
      this.setCurrentUser(existing);
    } else {
      this.api.createUser(this.meetingId, name).subscribe(u => {
        // Ensure new user is available in global selection
        if (!this.allUsers.some(x => x.id === u.id)) {
          this.allUsers = [...this.allUsers, u];
        }
        this.setCurrentUser(u);
      });
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

  deleteTask(t: Task) {
    if (!this.data) return;
    const ok = confirm(`WKR Funktion '${t.name}' löschen?`);
    if (!ok) return;
    this.api.deleteTask(this.meetingId, t.id).subscribe({
      next: () => {
        // Update immediately; socket event will also arrive
        this.data!.tasks = this.data!.tasks.filter(x => x.id !== t.id);
        this.data!.assignments = this.data!.assignments.filter(a => a.task_id !== t.id);
        const stillUsedIds = new Set(this.data!.assignments.filter(a => a.meeting_id === this.meetingId).map(a => a.user_id));
        this.data!.users = this.data!.users.filter(u => stillUsedIds.has(u.id));
        if (this.currentUserId && !stillUsedIds.has(this.currentUserId)) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
      }
    });
  }

  deleteSection(s: Section) {
    if (!this.data) return;
    const ok = confirm(`Abschnitt '${s.name}' löschen?`);
    if (!ok) return;
    this.api.deleteSection(this.meetingId, s.id).subscribe({
      next: () => {
        // Update immediately; socket event will also arrive
        this.data!.sections = this.data!.sections.filter(x => x.id !== s.id);
        this.data!.assignments = this.data!.assignments.filter(a => a.section_id !== s.id);
        const stillUsedIds = new Set(this.data!.assignments.filter(a => a.meeting_id === this.meetingId).map(a => a.user_id));
        this.data!.users = this.data!.users.filter(u => stillUsedIds.has(u.id));
        if (this.currentUserId && !stillUsedIds.has(this.currentUserId)) {
          this.currentUserId = null;
          localStorage.removeItem(this.userStorageKey());
        }
      }
    });
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
    const u = this.allUsers.find(x => x.id === id) || this.data.users.find(x => x.id === id);
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
    // Do NOT add to data.users here. data.users must only contain users
    // that have at least one assignment in this meeting. It will be
    // updated via assign:update socket events when assignments change.
  }
}
