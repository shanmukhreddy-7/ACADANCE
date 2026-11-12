export type Student = { id: string; name: string };
export type Subject = {
  code: string;
  name: string;
  credits: number;
  faculty?: string;
  room?: string;
};
export type Component = {
  id: string;
  name: string;
  max: number;
  weight: number;
  type: 'exam' | 'attendance';
};
export type Session = {
  id: string;
  date: string;
  subject: string;
  label: string;
  cancelled: boolean;
  records: Record<string, 'present' | 'absent' | 'leave'>;
};
export type ProfessorData = {
  demo?: boolean;
  photoPlan?: SeatPlan;
  students: Student[];
  subjects: Subject[];
  components: Record<string, Component[]>;
  marks: Record<string, Record<string, number | null>>;
  sessions: Session[];
  history: { at: string; message: string }[];
  internalTotal: number;
  threshold: number;
  name: string;
};
export type Attendance = {
  code: string;
  name: string;
  present: number;
  absent: number;
  total: number;
  od: number;
  percentage: number;
  approvedOdPercentage: number;
};
export type Ledger = {
  semester: string;
  code: string;
  name: string;
  credits: number;
  grade: string;
  points: number;
  result: string;
  attempt: string;
};
export type InternalExam = {
  name: string;
  conductedScore: number | null;
  conductedMax: number | null;
  convertedScore: number | null;
  convertedMax: number | null;
  conductedText: string;
  convertedText: string;
};
export type InternalMark = {
  code: string;
  name: string;
  score: number | null;
  max: number | null;
  exams?: InternalExam[];
};
export type UniversityProfile = {
  name: string;
  registration: string;
  semester: string;
  program: string;
  institution?: string;
  section?: string;
  specialization?: string;
  dateOfBirth?: string;
  gender?: string;
};
export type PortalData = {
  profile: UniversityProfile;
  attendance: Attendance[];
  subjects: Subject[];
  timetable: { day: string; slots: string[] }[];
  timeHeaders: string[];
  internals: InternalMark[];
  ledger: Ledger[];
  cgpa: number | null;
  syncedAt: string;
  period: string;
  demo?: boolean;
  warnings: string[];
};
export type Core = {
  photo_set_pixel: (
    index: number,
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
  ) => void;
  photo_brightness_shift: (count: number) => number;
  photo_changed_fraction: (count: number, threshold: number, shift: number) => number;
  photo_seat_state: (fraction: number, low: number, high: number) => number;
  attendance: (p: number, t: number) => number;
  can_skip: (p: number, t: number, r: number) => number;
  need_attend: (p: number, t: number, r: number) => number;
  attendance_scenario: (
    p: number,
    t: number,
    attend: number,
    miss: number,
    approved: number,
  ) => number;
  scenario_can_skip: (
    p: number,
    t: number,
    attend: number,
    miss: number,
    approved: number,
    target: number,
  ) => number;
  scenario_need_attend: (
    p: number,
    t: number,
    attend: number,
    miss: number,
    approved: number,
    target: number,
  ) => number;
  marks_needed: (score: number, maximum: number, target: number) => number;
  convert_marks: (s: number, m: number, w: number) => number;
  attendance_marks: (p: number, w: number) => number;
  set_input: (i: number, s: number, w: number) => void;
  weighted_gpa: (n: number) => number;
  sum_scores: (n: number) => number;
  best_scores: (n: number, k: number) => number;
  performance_band: (s: number) => number;
  generate_teams: (n: number, size: number, seed: number) => number;
  team_for: (i: number) => number;
};

export type SeatPlan = {
  rows: number;
  columns: number;
  assignments: string[];
  left: number;
  top: number;
  width: number;
  height: number;
  sampleWidth: number;
  sampleHeight: number;
  offsetY: number;
};
