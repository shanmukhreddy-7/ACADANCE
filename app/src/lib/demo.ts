import type { ProfessorData, PortalData, Component } from './types';
import { today } from './core.ts';
import { addDemoWeek } from './demo-week.ts';
export const demoSubjects = [
  {
    code: 'CSE 202',
    name: 'Object Oriented Programming with C++',
    credits: 4,
    faculty: 'Dr. Meera Rao',
    room: 'C 609',
  },
  {
    code: 'CSE 204',
    name: 'Design and Analysis of Algorithms',
    credits: 4,
    faculty: 'Dr. Arjun Menon',
    room: 'C 808',
  },
  {
    code: 'CSE 203',
    name: 'Discrete Mathematics',
    credits: 3,
    faculty: 'Dr. Kavya Nair',
    room: 'C 609',
  },
];
export function defaultComponents(code: string): Component[] {
  return [
    { id: code + '-cla1', name: 'CLA 1', max: 20, weight: 5, type: 'exam' },
    { id: code + '-cla2', name: 'CLA 2', max: 20, weight: 5, type: 'exam' },
    { id: code + '-cla3', name: 'CLA 3', max: 20, weight: 5, type: 'exam' },
    { id: code + '-mid', name: 'Mid exam', max: 50, weight: 15, type: 'exam' },
    { id: code + '-project', name: 'Project', max: 100, weight: 10, type: 'exam' },
    { id: code + '-lab', name: 'Lab', max: 30, weight: 5, type: 'exam' },
    { id: code + '-attendance', name: 'Attendance', max: 100, weight: 5, type: 'attendance' },
  ];
}
export function emptyProfessor(): ProfessorData {
  return {
    students: [],
    subjects: demoSubjects,
    components: Object.fromEntries(demoSubjects.map((s) => [s.code, defaultComponents(s.code)])),
    marks: {},
    sessions: [],
    history: [],
    internalTotal: 50,
    threshold: 75,
    name: 'Professor',
  };
}
export function createProfessorDemo(): ProfessorData {
  const data = emptyProfessor();
  data.name = 'Dr. Meera Rao';
  data.demo = true;
  const names = [
    'Aarav Sharma',
    'Ananya Reddy',
    'Arjun Kumar',
    'Diya Patel',
    'Ishaan Mehta',
    'Kavya Rao',
    'Rohan Nair',
    'Saanvi Iyer',
    'Aditya Das',
    'Meera Kapoor',
    'Vihaan Singh',
    'Isha Verma',
    'Krishna Menon',
    'Nisha Gupta',
    'Pranav Joshi',
    'Riya Shah',
    'Dev Malhotra',
    'Tara Pillai',
    'Vedant Rao',
    'Zoya Khan',
    'Aditi Sinha',
    'Dhruv Jain',
    'Maya Thomas',
    'Neil Reddy',
  ];
  data.students = names.map((name, i) => ({ id: 'AP26' + String(110080001 + i), name }));
  data.subjects.forEach((s, si) => {
    data.students.forEach((st, i) => {
      data.marks[st.id] ??= {};
      data.components[s.code]
        .filter((c) => c.type === 'exam')
        .forEach((c, ci) => {
          const ratio = [0.92, 0.72, 0.45, 0.84, 0.62, 0.95, 0.53, 0.78][(i + si) % 8];
          data.marks[st.id][c.id] = Math.min(
            c.max,
            Math.round(c.max * (ratio + (((i + ci) % 3) - 1) * 0.035)),
          );
        });
    });
  });
  return addDemoWeek(data, today());
}
export function createStudentDemo(): PortalData {
  return {
    profile: {
      name: 'Ananya Reddy',
      registration: 'DEMO STUDENT',
      semester: 'III SEMESTER',
      program: 'B.Tech · Computer Science',
      institution: 'SRM University AP',
      section: 'CSE · A',
      specialization: 'Computer Science and Engineering',
    },
    attendance: [
      {
        code: 'CSE 202',
        name: demoSubjects[0].name,
        present: 35,
        absent: 5,
        total: 40,
        od: 0,
        percentage: 87.5,
        approvedOdPercentage: 0,
      },
      {
        code: 'CSE 204',
        name: demoSubjects[1].name,
        present: 25,
        absent: 11,
        total: 36,
        od: 0,
        percentage: 69.44,
        approvedOdPercentage: 0,
      },
      {
        code: 'CSE 203',
        name: demoSubjects[2].name,
        present: 30,
        absent: 2,
        total: 32,
        od: 0,
        percentage: 93.75,
        approvedOdPercentage: 0,
      },
    ],
    subjects: demoSubjects,
    timetable: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, i) => ({
      day,
      slots: [
        i % 2 ? 'CSE 204' : 'CSE 202',
        'CSE 203',
        'Free',
        'CSE 202',
        'Lunch',
        'CSE 204',
        'Free',
      ],
    })),
    timeHeaders: [
      '9:00–9:50',
      '10:00–10:50',
      '11:00–11:50',
      '12:00–12:50',
      '13:00–13:50',
      '14:00–14:50',
      '15:00–15:50',
    ],
    internals: demoSubjects.map((s, i) => ({
      code: s.code,
      name: s.name,
      score: [35.9, 23.3, 40.48][i],
      max: 50,
      exams: [
        {
          name: 'CLA 1',
          conductedScore: [18, 12, 19][i],
          conductedMax: 20,
          convertedScore: [4.5, 3, 4.75][i],
          convertedMax: 5,
          conductedText: [18, 12, 19][i] + '/20',
          convertedText: [4.5, 3, 4.75][i] + '/5',
        },
        {
          name: 'CLA 2',
          conductedScore: [16, 10, 18][i],
          conductedMax: 20,
          convertedScore: [4, 2.5, 4.5][i],
          convertedMax: 5,
          conductedText: [16, 10, 18][i] + '/20',
          convertedText: [4, 2.5, 4.5][i] + '/5',
        },
        {
          name: 'CLA 3',
          conductedScore: null,
          conductedMax: 20,
          convertedScore: null,
          convertedMax: 5,
          conductedText: 'Not published',
          convertedText: 'Not published',
        },
        {
          name: 'Mid exam',
          conductedScore: [38, 28, 44][i],
          conductedMax: 50,
          convertedScore: [11.4, 8.4, 13.2][i],
          convertedMax: 15,
          conductedText: [38, 28, 44][i] + '/50',
          convertedText: [11.4, 8.4, 13.2][i] + '/15',
        },
        {
          name: 'Project',
          conductedScore: [85, 64, 92][i],
          conductedMax: 100,
          convertedScore: [8.5, 6.4, 9.2][i],
          convertedMax: 10,
          conductedText: [85, 64, 92][i] + '/100',
          convertedText: [8.5, 6.4, 9.2][i] + '/10',
        },
        {
          name: 'Lab',
          conductedScore: [27, 18, 29][i],
          conductedMax: 30,
          convertedScore: [4.5, 3, 4.83][i],
          convertedMax: 5,
          conductedText: [27, 18, 29][i] + '/30',
          convertedText: [4.5, 3, 4.83][i] + '/5',
        },
        {
          name: 'Attendance',
          conductedScore: [87.5, 69.44, 93.75][i],
          conductedMax: 100,
          convertedScore: [3, 0, 4][i],
          convertedMax: 5,
          conductedText: [87.5, 69.44, 93.75][i] + '/100',
          convertedText: [3, 0, 4][i] + '/5',
        },
      ],
    })),
    ledger: [
      {
        semester: 'I',
        code: 'MAT 101',
        name: 'Calculus',
        credits: 4,
        grade: 'A+',
        points: 9,
        result: 'PASS',
        attempt: '1',
      },
      {
        semester: 'I',
        code: 'CSE 101',
        name: 'Programming fundamentals',
        credits: 4,
        grade: 'O',
        points: 10,
        result: 'PASS',
        attempt: '1',
      },
      {
        semester: 'II',
        code: 'CSE 102',
        name: 'Data structures',
        credits: 4,
        grade: 'A+',
        points: 9,
        result: 'PASS',
        attempt: '1',
      },
      {
        semester: 'II',
        code: 'MAT 102',
        name: 'Linear algebra',
        credits: 3,
        grade: 'A',
        points: 8,
        result: 'PASS',
        attempt: '1',
      },
    ],
    cgpa: null,
    syncedAt: new Date().toISOString(),
    period: today(),
    demo: true,
    warnings: [],
  };
}
