import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <a routerLink="/" class="brand">Home</a>
      <a routerLink="/users" class="brand">Benutzer</a>
    </header>
    <main class="container">
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .topbar { padding: 10px 16px; background: #1f2937; color: #fff; }
    .brand { color: #fff; text-decoration: none; font-weight: 600; }
    .container { padding: 16px; }
  `]
})
export class AppComponent {}
