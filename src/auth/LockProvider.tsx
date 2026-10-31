// The app lock (S7). The PIN screen covers the app, which stays mounted under it
// (a half-made invoice survives a lock), and the app is hidden from screen readers
// while it is covered. It shows:
//   setup      on first open, until a PIN is created
//   unlock     when the app opens, and when it comes back after LOCK.relockAfterMs in the background
//   person     instead of unlock once the phone is paired and the desktop has people
//              (LAN_SYNC Phase 5): who's using, then that person's PIN
//   change / new-code   from Settings → Security (cancellable)
// The web preview tier has no secure storage, so it is never locked.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { getBioEnabled, pinLength, setBioEnabled } from './authStore';
import { currentPerson, may, peopleMode, type Person } from './people';
import type { UserPerm } from '../data/schema';
import { logAudit } from '../data/auditRepo';
import { bioAvailable } from './biometrics';
import { AuthScreen, type AuthFlow } from '../features/auth/AuthScreen';
import { dark } from '../ui/tokens';

export const LOCK = {
  relockAfterMs: 5 * 60_000, // back from the background after this long → PIN again
} as const;

type Gate = 'checking' | AuthFlow | null; // null = the app is showing

type LockApi = {
  lockNow: () => void;
  changePin: () => void;
  showNewCode: () => void;
  bio: { available: boolean; enabled: boolean };
  setBio: (on: boolean) => Promise<void>;
  refreshBio: () => Promise<void>;
  person: Person | null; // who is signed in (people mode), else null
  can: (perm: UserPerm) => boolean; // D4 limits for the signed-in person
  refreshPeople: () => Promise<void>; // after a sync brought people: sign in again if needed
};

const LockContext = createContext<LockApi | null>(null);

export function useLock(): LockApi {
  const v = useContext(LockContext);
  if (!v) throw new Error('useLock outside LockProvider');
  return v;
}

export function LockProvider({ children }: { children: React.ReactNode }) {
  const native = Platform.OS !== 'web';
  const [gate, setGate] = useState<Gate>(native ? 'checking' : null);
  const [bio, setBioState] = useState({ available: false, enabled: false });
  const [person, setPerson] = useState<Person | null>(null);
  const hiddenAt = useRef<number | null>(null);
  const gateRef = useRef(gate);
  gateRef.current = gate;

  const refreshBio = useCallback(async () => {
    if (!native) return;
    const [available, enabled] = await Promise.all([bioAvailable(), getBioEnabled()]);
    setBioState({ available, enabled });
  }, [native]);

  // Device PIN, or who's using once the desktop has people.
  const lock = useCallback(async () => {
    setGate((await peopleMode()) ? 'person' : 'unlock');
  }, []);

  useEffect(() => {
    if (!native) return;
    void (async () => {
      await refreshBio();
      if ((await pinLength()) === null) setGate('setup');
      else await lock();
    })();
  }, [native, refreshBio, lock]);

  // Relock after a long enough time away. Short trips (the share sheet, the file
  // picker, the fingerprint prompt) come back without the PIN.
  useEffect(() => {
    if (!native) return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'background') { hiddenAt.current = Date.now(); return; }
      if (s !== 'active' || hiddenAt.current === null) return;
      const away = Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      void refreshBio(); // a fingerprint may have been added in Android Settings
      if (gateRef.current === null && away >= LOCK.relockAfterMs) void lock();
    });
    return () => sub.remove();
  }, [native, refreshBio, lock]);

  // A sync brought people (new, changed or switched off): the signed-in person
  // is read again, and the lock asks who's using when nobody valid is. That
  // includes a device-PIN screen already showing (the first sync after an
  // update runs under the lock): the device PIN no longer opens the app.
  const refreshPeople = useCallback(async () => {
    if (!native) return;
    const p = await currentPerson();
    setPerson(p);
    const g = gateRef.current;
    if (!p && (g === null || g === 'unlock') && await peopleMode()) setGate('person');
  }, [native]);

  const unlocked = useCallback(async (flow: Gate) => {
    // Device PIN right, but the desktop has people by now: who's using, too.
    if (flow === 'unlock' && await peopleMode()) { setGate('person'); return; }
    if (flow === 'unlock' || flow === 'person') void logAudit('auth.signin', 'auth', flow);
    setGate(null);
    setPerson(await currentPerson());
  }, []);

  const setBio = useCallback(async (on: boolean) => {
    await setBioEnabled(on);
    await refreshBio();
  }, [refreshBio]);

  const api = useMemo<LockApi>(() => ({
    lockNow: () => void lock(),
    changePin: () => setGate('change'),
    showNewCode: () => setGate('new-code'),
    bio, setBio, refreshBio,
    person, can: perm => may(person, perm), refreshPeople,
  }), [bio, setBio, refreshBio, lock, person, refreshPeople]);

  const covered = gate !== null;
  return (
    <LockContext.Provider value={api}>
      <View style={{ flex: 1 }} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>
        {children}
      </View>
      {gate === 'checking' ? <View style={[StyleSheet.absoluteFill, { backgroundColor: dark.bg }]} /> : null}
      {gate !== null && gate !== 'checking' ? (
        <View style={StyleSheet.absoluteFill}>
          <AuthScreen
            key={gate}
            flow={gate}
            bio={bio}
            setBio={setBio}
            onDone={() => void unlocked(gate)}
            onCancel={gate === 'change' || gate === 'new-code' ? () => setGate(null) : undefined}
          />
        </View>
      ) : null}
    </LockContext.Provider>
  );
}
