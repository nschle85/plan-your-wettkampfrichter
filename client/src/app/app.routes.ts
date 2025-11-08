import { Routes } from '@angular/router';
import { MeetingListComponent } from './meeting-list.component';
import { MeetingBoardComponent } from './meeting-board.component';

export const routes: Routes = [
  { path: '', component: MeetingListComponent },
  { path: 'meeting/:id', component: MeetingBoardComponent },
  { path: '**', redirectTo: '' }
];
