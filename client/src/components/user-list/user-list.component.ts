import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/types';
import { SocketService } from '../../services/socket.service';

@Component({
  standalone: true,
  selector: 'app-user-list',
  imports: [CommonModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent implements OnDestroy {
  users: User[] = [];
  loading = true;
  error: string | null = null;

  private onUsersUpdate = (msg: any) => {
    if (msg?.type === 'user:add' && msg.user) {
      const u: User = msg.user as User;
      if (!this.users.some(x => x.id === u.id)) {
        this.users = [...this.users, u];
      }
    }
    if (msg?.type === 'user:remove' && msg.userId != null) {
      const id = Number(msg.userId);
      this.users = this.users.filter(x => x.id !== id);
    }
  };

  constructor(private api: ApiService, private socket: SocketService) {
    this.load();
    // Subscribe to global users updates
    this.socket.on('users:update', this.onUsersUpdate);
  }

  ngOnDestroy(): void {
    this.socket.off('users:update', this.onUsersUpdate);
  }

  load() {
    this.loading = true;
    this.error = null;
    this.api.getUsers().subscribe({
      next: (u) => { this.users = u; this.loading = false; },
      error: (e) => { this.error = 'Fehler beim Laden der Benutzer.'; this.loading = false; }
    });
  }

  add(nameInput: HTMLInputElement) {
    const name = (nameInput?.value || '').trim();
    if (!name) return;
    this.loading = true;
    this.error = null;
    this.api.createUser(name).subscribe({
      next: (u) => {
        // Locally add if not already present; socket may also deliver an add event
        if (u && !this.users.some(x => x.id === u.id)) {
          this.users = [...this.users, u];
        }
        nameInput.value = '';
        this.loading = false;
      },
      error: () => {
        this.error = 'Erstellen des Benutzers fehlgeschlagen.';
        this.loading = false;
      }
    });
  }

  delete(u: User) {
    const ok = confirm(`Benutzer "${u.name}" dauerhaft löschen?`);
    if (!ok) return;
    this.loading = true;
    this.error = null;
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        // Socket-Event 'users:update' mit type 'user:remove' wird die Liste aktualisieren
        this.loading = false;
      },
      error: () => {
        this.error = 'Löschen des Benutzers fehlgeschlagen.';
        this.loading = false;
      }
    });
  }
}
