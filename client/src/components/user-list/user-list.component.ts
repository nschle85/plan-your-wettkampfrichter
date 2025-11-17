import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/types';

@Component({
  standalone: true,
  selector: 'app-user-list',
  imports: [CommonModule],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss']
})
export class UserListComponent {
  users: User[] = [];
  loading = true;
  error: string | null = null;

  constructor(private api: ApiService) {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;
    this.api.getAllUsers().subscribe({
      next: (u) => { this.users = u; this.loading = false; },
      error: (e) => { this.error = 'Fehler beim Laden der Benutzer.'; this.loading = false; }
    });
  }

  delete(u: User) {
    const ok = confirm(`Benutzer "${u.name}" dauerhaft löschen?`);
    if (!ok) return;
    this.loading = true;
    this.error = null;
    this.api.deleteUser(u.id).subscribe({
      next: () => {
        // Lokales Entfernen, um kein zusätzliches Laden zu benötigen
        this.users = this.users.filter(x => x.id !== u.id);
        this.loading = false;
      },
      error: () => {
        this.error = 'Löschen des Benutzers fehlgeschlagen.';
        this.loading = false;
      }
    });
  }
}
