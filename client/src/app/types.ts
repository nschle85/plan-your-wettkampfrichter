export interface Meeting { id: number; name: string; created_at: string; }
export interface Task { id: number; meeting_id: number; name: string; ord: number; }
export interface Section { id: number; meeting_id: number; name: string; ord: number; }
export interface User { id: number; meeting_id: number; name: string; created_at?: string; }
export interface Assignment { meeting_id: number; task_id: number; section_id: number; user_id: number; created_at?: string; }

export interface MeetingFull {
  meeting: Meeting;
  tasks: Task[];
  sections: Section[];
  users: User[];
  assignments: Assignment[];
}
