'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, GraduationCap } from 'lucide-react';
import { Brand } from '@/components/ui';
import dynamic from 'next/dynamic';
import styles from './home.module.css';
import { loadCore } from '@/lib/core';
import type { Core } from '@/lib/types';

const Professor = dynamic(() => import('@/components/professor'));
const StudentApp = dynamic(() => import('@/components/student'));

export default function Home() {
  const [role, setRole] = useState<'welcome' | 'professor' | 'student'>('welcome');
  const [core, setCore] = useState<Core | null>(null);
  const [error, setError] = useState('');
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    loadCore().then(setCore).catch((e) => setError(e.message));
    const timer = setTimeout(() => setIntro(false), 1450);
    return () => clearTimeout(timer);
  }, []);

  if (role === 'professor' && core)
    return <Professor core={core} onExit={() => setRole('welcome')} />;
  if (role === 'student' && core)
    return <StudentApp core={core} onExit={() => setRole('welcome')} />;

  return (
    <main className={styles.home}>
      {intro && (
        <div className="intro">
          <div className="intro-orbit">
            <img src="/brand/acadence-mark.svg" width="74" height="74" alt="" />
          </div>
          <span>acadence.</span>
          <button onClick={() => setIntro(false)}>Skip intro</button>
        </div>
      )}
      <header className={styles.header}>
        <Brand />
        <span>SRM AP</span>
      </header>
      <section className={styles.workspace} id="workspaces" aria-labelledby="workspace-title">
        <h1 id="workspace-title">Your workspace.</h1>
        <p>Choose your role to continue.</p>
        <div className={styles.choices}>
          <button
            className={styles.professor}
            onClick={() => setRole('professor')}
            disabled={!core}
            aria-label="Professor workspace"
          >
            <BookOpen size={30} strokeWidth={1.8} aria-hidden="true" />
            <span className={styles.choiceName}>Professor</span>
            <span className={styles.choiceDetail}>Demo workspace</span>
            <span className={styles.arrow}><ArrowUpRight size={25} aria-hidden="true" /></span>
          </button>
          <button
            className={styles.student}
            onClick={() => setRole('student')}
            disabled={!core}
            aria-label="Student workspace"
          >
            <GraduationCap size={33} strokeWidth={1.8} aria-hidden="true" />
            <span className={styles.choiceName}>Student</span>
            <span className={styles.choiceDetail}>University sign-in</span>
            <span className={styles.arrow}><ArrowUpRight size={25} aria-hidden="true" /></span>
          </button>
        </div>
        {!core && !error && <span className={styles.status} role="status">Loading workspace…</span>}
        {error && (
          <p role="alert" className={styles.error}>
            {error} <button onClick={() => location.reload()}>Reload</button>
          </p>
        )}
      </section>
      <footer className={styles.footer}>Attendance. Marks. Timetable.</footer>
    </main>
  );
}
