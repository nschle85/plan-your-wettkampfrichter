import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from './env';
import { Observable } from 'rxjs';
import { Assignment, Meeting, MeetingFull, Section, Task, User } from './types';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMeetings(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(`${this.base}/api/meetings`);
  }

  createMeeting(name: string): Observable<Meeting> {
    return this.http.post<Meeting>(`${this.base}/api/meetings`, { name });
  }

  getMeetingFull(id: number): Observable<MeetingFull> {
    return this.http.get<MeetingFull>(`${this.base}/api/meetings/${id}/full`);
  }

  addTask(meetingId: number, name: string): Observable<Task> {
    return this.http.post<Task>(`${this.base}/api/meetings/${meetingId}/tasks`, { name });
  }

  addSection(meetingId: number, name: string): Observable<Section> {
    return this.http.post<Section>(`${this.base}/api/meetings/${meetingId}/sections`, { name });
  }

  getUsers(meetingId: number): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/api/meetings/${meetingId}/users`);
  }

  createUser(meetingId: number, name: string): Observable<User> {
    return this.http.post<User>(`${this.base}/api/meetings/${meetingId}/users`, { name });
  }

  setAssignment(meetingId: number, taskId: number, sectionId: number, userId: number, selected: boolean) {
    return this.http.post<{ok: true}>(`${this.base}/api/meetings/${meetingId}/assign`, { taskId, sectionId, userId, selected });
  }
}
