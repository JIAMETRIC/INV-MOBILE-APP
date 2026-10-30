// The app lock (S7). The PIN screen covers the app, which stays mounted under it
// (a half-made invoice survives a lock), and the app is hidden from screen readers
// while it is covered. It shows:
//   setup      on first open, until a PIN is created
//   unlock     when the app opens, and when it comes back after LOCK.relockAfterMs in the background
//   change / new-code   from Settings → Security (cancellable)
// The web preview tier has no secure storage, so it is never locked.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { getBioEnabled, pinLength, setBioEnabled } from './authStore';
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
  const hiddenAt = useRef<number | null>(null);
  const gateRef = useRef(gate);
  gateRef.current = gate;

  const refreshBio = useCallback(async () => {
    if (!native) return;
    const [available, enabled] = await Promise.all([bioAvailable(), getBioEnabled()]);
    setBioState({ available, enabled });
  }, [native]);

  useEffect(() => {
    if (!native) return;
    void (async () => {
      await refreshBio();
      setGate((await pinLength()) === null ? 'setup' : 'unlock');
    })();
  }, [native, refreshBio]);

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
      if (gateRef.current === null && away >= LOCK.relockAfterMs) setGate('unlock');
    });
    return () => sub.remove();
  }, [native, refreshBio]);

  const setBio = useCallback(async (on: boolean) => {
    await setBioEnabled(on);
    await refreshBio();
  }, [refreshBio]);

  const api = useMemo<LockApi>(() => ({
    lockNow: () => setGate('unlock'),
    changePin: () => setGate('change'),
    showNewCode: () => setGate('new-code'),
    bio, setBio, refreshBio,
  }), [bio, setBio, refreshBio]);

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
            onDone={() => { if (gate === 'unlock') void logAudit('auth.signin', 'auth', 'unlock'); setGate(null); }}
            onCancel={gate === 'change' || gate === 'new-code' ? () => setGate(null) : undefined}
          />
        </View>
      ) : null}
    </LockContext.Provider>
  );
}
