'use client';
import { useEffect, useRef } from 'react';
import styles from './student-login.module.css';

export default function CursorFollow() {
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0,
      y = 0,
      targetX = 0,
      targetY = 0;
    let visible = false;

    function hide() {
      visible = false;
      cancelAnimationFrame(frame);
      frame = 0;
      if (ring.current) ring.current.style.opacity = '0';
    }
    function draw() {
      frame = 0;
      if (!visible || !ring.current) return;
      x += (targetX - x) * 0.2;
      y += (targetY - y) * 0.2;
      ring.current.style.transform = `translate3d(${x - 19}px, ${y - 19}px, 0)`;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > 0.25) frame = requestAnimationFrame(draw);
    }
    function move(event: PointerEvent) {
      if (!finePointer.matches || reducedMotion.matches || event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;
      if (!visible) {
        x = targetX;
        y = targetY;
        visible = true;
        if (ring.current) ring.current.style.opacity = '0.6';
      }
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function visibility() {
      if (document.hidden) hide();
    }
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', hide);
    finePointer.addEventListener('change', hide);
    reducedMotion.addEventListener('change', hide);
    return () => {
      hide();
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', hide);
      finePointer.removeEventListener('change', hide);
      reducedMotion.removeEventListener('change', hide);
    };
  }, []);

  return <div ref={ring} className={styles.cursor} aria-hidden="true" />;
}
