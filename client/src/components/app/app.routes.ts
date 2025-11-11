import { Routes } from '@angular/router';
import { MeetingListComponent } from '../meeting-list/meeting-list.component';
import { MeetingBoardComponent } from '../meeting-board/meeting-board.component';
import { UserListComponent } from '../user-list/user-list.component';

export const routes: Routes = [
  { path: '', component: MeetingListComponent },
  { path: 'meeting/:id', component: MeetingBoardComponent },
  { path: 'users', component: UserListComponent },
  { path: '**', redirectTo: '' }
];
