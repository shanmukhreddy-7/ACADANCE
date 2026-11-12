'use client';
import { Plus, ArrowRight, Check } from 'lucide-react';
import { Button, Modal } from './ui';
import type { PortalData } from '@/lib/types';
import styles from './saved-accounts.module.css';

export default function SavedAccounts({
  accounts,
  current,
  onClose,
  onSwitch,
  onAdd,
}: {
  accounts: PortalData[];
  current: string;
  onClose: () => void;
  onSwitch: (registration: string) => void;
  onAdd: () => void;
}) {
  return (
    <Modal title="Saved accounts" onClose={onClose}>
      <div className={styles.list}>
        {accounts.length === 0 && <p>No saved accounts yet.</p>}
        {accounts.map((account) => {
          const registration = account.profile.registration;
          const active = registration === current;
          return (
            <div className={styles.account} key={registration}>
              <span className={styles.avatar} aria-hidden="true">
                {account.profile.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('') || 'S'}
              </span>
              <div className={styles.identity}>
                <strong>{account.profile.name || registration}</strong>
                <span>{registration}</span>
              </div>
              {active ? (
                <span className={styles.current}>
                  <Check size={15} /> Current
                </span>
              ) : (
                <Button kind="secondary" onClick={() => onSwitch(registration)}>
                  Switch <ArrowRight size={15} />
                </Button>
              )}
            </div>
          );
        })}
        <Button disabled={accounts.length >= 5} onClick={onAdd}>
          <Plus size={16} /> Add account
        </Button>
        <p className={styles.note}>Up to five accounts. Expired sessions need sign-in again.</p>
      </div>
    </Modal>
  );
}
