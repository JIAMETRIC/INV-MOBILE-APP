// S7 — Sign in (the app lock). Always the dark Sign In recipe (design/screens/04-sign-in).
// Read top to bottom:
//   TEXT, S7            the text and the numbers you are most likely to edit
//   useAuthFlow()       all state and every step (no JSX)
//   AuthScreen()        the portrait / short-landscape switch
//   Header … Footer     one function per region, in the order they appear on screen
// IDs (S7.0 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBreakpoint } from '../../ui/useBreakpoint';
import { Button, Card, Input, ripple } from '../../ui/components';
import { dark, font, layout, motion, radius, shadow, space, touch, type } from '../../ui/tokens';
import {
  CODE_LENGTH, PIN, checkPin, checkRecoveryCode, lockoutRemaining, newRecoveryCode, normaliseCode, pinLength, setPin,
} from '../../auth/authStore';
import { bioUnlock } from '../../auth/biometrics';

export type AuthFlow = 'setup' | 'unlock' | 'change' | 'new-code';
type Step = 'enter' | 'recover' | 'create' | 'confirm' | 'code' | 'bio';

// The words on each step: title (H1) and the line under it.
const TEXT: Record<Step, { title: string; sub: string }> = {
  enter: { title: 'Welcome back', sub: 'Enter your PIN to open Invoice ERP' },
  recover: { title: 'Use recovery code', sub: 'Enter the 12-character code you wrote down when you set up your PIN' },
  create: { title: 'Create a PIN', sub: 'Choose 4 to 6 digits. You will enter it each time you open the app.' },
  confirm: { title: 'Confirm your PIN', sub: 'Enter the same PIN again' },
  code: { title: 'Your recovery code', sub: 'Write it down and keep it safe. It is the only way back in if you forget your PIN.' },
  bio: { title: 'Unlock with fingerprint?', sub: 'Use your fingerprint or face instead of typing the PIN. The PIN always works too.' },
};
const VERIFY_TEXT = { title: 'Enter your PIN', sub: 'Confirm it is you before changing security settings' };

// Every number that is specific to this screen (kit §7.4: top 88, sides 24, gap 28).
const S7 = {
  top: 88, // S7.0: distance from the top of the screen to the logo
  gap: 28, // between blocks
  logo: 64, logoIcon: 30, // S7.0
  maxWidth: 400, // the column on tablets
  dot: 14, dotGap: 16, // S7.1 PIN dots
  key: 72, keyCompact: 60, keyGap: 14, // S7.2 keypad
  compactHeight: 700, // under this window height the keys shrink
  shortScreen: 600, // landscape phones: keypad in a second column
  codeSpacing: 2, // S7.1 recovery code letter-spacing
  messageLines: 2, // S7.1 message line: space kept on the PIN steps
} as const;

const theme = dark;

// ---------------------------------------------------------------------------
// State: the current step, the digits typed, the lockout countdown, and every
// transition between steps.
// ---------------------------------------------------------------------------
function useAuthFlow({ flow, bio, setBio, onDone, onCancel }: AuthScreenProps) {
  const [step, setStep] = useState<Step>(flow === 'setup' ? 'create' : 'enter');
  const [entry, setEntry] = useState('');
  const [first, setFirst] = useState(''); // the PIN typed on `create`, checked on `confirm`
  const [len, setLen] = useState<number>(PIN.max); // dots on `enter`: the stored PIN's length
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState(''); // the recovery code being shown
  const [recovered, setRecovered] = useState(false); // came through the recovery code
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [until, setUntil] = useState(0); // lockout end (ms epoch)
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const bioTried = useRef(false);

  const waitMs = Math.max(0, until - now);
  const canBio = flow === 'unlock' && step === 'enter' && bio.available && bio.enabled;

  useEffect(() => {
    void pinLength().then(n => { if (n) setLen(n); });
    void lockoutRemaining().then(ms => { if (ms > 0) setUntil(Date.now() + ms); });
  }, []);

  // Lockout countdown, once a second while it runs.
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) { clearInterval(t); setMsg(null); }
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const tryBio = useCallback(async () => {
    if (await bioUnlock()) onDone();
  }, [onDone]);

  // Unlock: the fingerprint prompt opens by itself once.
  useEffect(() => {
    if (canBio && !bioTried.current) { bioTried.current = true; void tryBio(); }
  }, [canBio, tryBio]);

  const showFailure = (r: { waitMs: number; triesLeft: number }, what: string) => {
    if (r.waitMs > 0) {
      setUntil(Date.now() + r.waitMs); setNow(Date.now());
      setMsg({ text: 'Too many wrong tries.', error: true });
    } else {
      setMsg({ text: r.triesLeft <= 2 ? `${what} ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left before a wait.` : what, error: true });
    }
  };

  const showCode = async () => { setCode(await newRecoveryCode()); setStep('code'); setMsg(null); };

  const afterEnter = async () => {
    if (flow === 'unlock') onDone();
    else if (flow === 'change') { setStep('create'); setMsg(null); }
    else await showCode();
  };

  const verify = async (pin: string) => {
    setBusy(true);
    try {
      const r = await checkPin(pin);
      if (r.ok) await afterEnter();
      else showFailure(r, 'Wrong PIN.');
    } finally { setEntry(''); setBusy(false); }
  };

  const toConfirm = (pin: string) => { setFirst(pin); setEntry(''); setStep('confirm'); setMsg(null); };

  const confirm = async (pin: string) => {
    if (pin !== first) {
      setFirst(''); setEntry(''); setStep('create');
      setMsg({ text: 'The PINs did not match. Choose your PIN again.', error: true });
      return;
    }
    setBusy(true);
    try {
      await setPin(pin);
      setEntry('');
      if (flow === 'setup' || recovered) await showCode();
      else onDone();
    } finally { setBusy(false); }
  };

  // S7.2 keypad: a digit. Unlock and confirm check as soon as enough digits are in.
  const press = (d: string) => {
    if (busy || waitMs > 0) return;
    const max = step === 'enter' ? len : step === 'confirm' ? first.length : PIN.max;
    if (entry.length >= max) return;
    const next = entry + d;
    setEntry(next);
    if (msg?.error && step !== 'create') setMsg(null);
    if (next.length < max) return;
    if (step === 'enter') void verify(next);
    else if (step === 'confirm') void confirm(next);
    else toConfirm(next);
  };
  const backspace = () => setEntry(e => e.slice(0, -1));

  const submitCode = async () => {
    if (busy || waitMs > 0) return;
    setBusy(true);
    try {
      const r = await checkRecoveryCode(codeInput);
      if (r.ok) { setRecovered(true); setCodeInput(''); setStep('create'); setMsg(null); }
      else showFailure(r, 'That code is not right.');
    } finally { setBusy(false); }
  };

  const codeWritten = () => {
    if (flow === 'setup' && bio.available) { setStep('bio'); setMsg(null); } else onDone();
  };

  const turnOnBio = async () => {
    if (await bioUnlock('Confirm your fingerprint')) { await setBio(true); onDone(); }
    else setMsg({ text: 'Not recognised. You can turn it on later in Settings → Security.', error: true });
  };

  const goRecover = () => { setEntry(''); setStep('recover'); setMsg(null); };
  const backToPin = () => { setCodeInput(''); setStep('enter'); setMsg(null); };

  // Android Back: cancel from Settings; recovery → PIN; otherwise leave the app (never reveal it).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'recover') { backToPin(); return true; }
      if (onCancel && step !== 'code') { onCancel(); return true; }
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  });

  const text = step === 'enter' && flow !== 'unlock' ? VERIFY_TEXT
    : step === 'create' && (flow === 'change' || recovered) ? { ...TEXT.create, title: 'Choose a new PIN' }
    : TEXT[step];

  return {
    flow, step, text, entry, len, first, msg, waitMs, busy, canBio, code, codeInput, setCodeInput, onCancel,
    dots: step === 'enter' ? len : step === 'confirm' ? first.length : PIN.max,
    canContinue: step === 'create' && entry.length >= PIN.min,
    press, backspace, tryBio, toConfirm, submitCode, codeWritten, turnOnBio, goRecover, backToPin, onDone,
  };
}
type AuthState = ReturnType<typeof useAuthFlow>;

type AuthScreenProps = {
  flow: AuthFlow;
  bio: { available: boolean; enabled: boolean };
  setBio: (on: boolean) => Promise<void>;
  onDone: () => void;
  onCancel?: () => void;
};

// ---------------------------------------------------------------------------
// The screen: one centred column (phones, tablets); a short landscape phone puts
// the keypad in a second column.
// ---------------------------------------------------------------------------
export function AuthScreen(props: AuthScreenProps) {
  const a = useAuthFlow(props);
  const bp = useBreakpoint();
  const insets = useSafeAreaInsets();
  const key = bp.height < S7.compactHeight ? S7.keyCompact : S7.key;
  const pinStep = a.step === 'enter' || a.step === 'create' || a.step === 'confirm';
  const twoCols = pinStep && bp.isLandscape && bp.height < S7.shortScreen;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1, alignItems: 'center',
          paddingTop: twoCols ? insets.top + space[5] : Math.max(S7.top, insets.top + space[6]),
          paddingBottom: insets.bottom + space[6],
          paddingHorizontal: layout.sideWide + Math.max(insets.left, insets.right),
        }}
      >
        {twoCols ? (
          <View style={{ flexDirection: 'row', gap: S7.gap * 2, alignItems: 'center', flexGrow: 1 }}>
            <View style={{ width: S7.maxWidth * 0.8, gap: layout.gap }}>
              <Header a={a} compact />
              <StepCard a={a} />
              <Footer a={a} />
            </View>
            <Keypad a={a} size={S7.keyCompact} />
          </View>
        ) : (
          <View style={{ width: '100%', maxWidth: S7.maxWidth, gap: S7.gap, flexGrow: 1 }}>
            <Header a={a} />
            <StepCard a={a} />
            {pinStep ? <Keypad a={a} size={key} /> : null}
            <Footer a={a} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// S7.0 — logo (64, App Blue, white lock) · title (H1) · the line under it (15, #ebeaea).
function Header({ a, compact }: { a: AuthState; compact?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: space[4] }}>
      {compact ? null : (
        <View style={{
          width: S7.logo, height: S7.logo, borderRadius: radius.bar, backgroundColor: theme.accent,
          alignItems: 'center', justifyContent: 'center', boxShadow: shadow.secondary,
        }}>
          <Feather name="lock" size={S7.logoIcon} color={theme.accentOn} />
        </View>
      )}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={[type.h1, { color: theme.text, textAlign: 'center' }]} accessibilityRole="header">{a.text.title}</Text>
        <Text style={[type.body, { color: theme.textMuted, textAlign: 'center' }]}>{a.text.sub}</Text>
      </View>
    </View>
  );
}

// S7.1 — the dark-glass form card; its content depends on the step.
function StepCard({ a }: { a: AuthState }) {
  return (
    <Card theme={theme} style={{ borderRadius: radius.form, padding: space[5], gap: layout.gap }}>
      {a.step === 'recover' ? <RecoveryEntry a={a} />
        : a.step === 'code' ? <RecoveryCode a={a} />
        : a.step === 'bio' ? <BioOffer a={a} />
        : <PinEntry a={a} />}
      <Message a={a} />
    </Card>
  );
}

// S7.1 PIN — the dots (filled App Blue as digits go in); on `create`, Continue once 4+ digits are in.
function PinEntry({ a }: { a: AuthState }) {
  return (
    <>
      <View
        accessible
        accessibilityLabel={`${a.entry.length} of ${a.dots} digits entered`}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: S7.dotGap, paddingVertical: space[2] }}
      >
        {Array.from({ length: a.dots }, (_, i) => {
          const on = i < a.entry.length;
          return (
            <View key={i} style={{
              width: S7.dot, height: S7.dot, borderRadius: S7.dot / 2, borderWidth: 1.5,
              borderColor: on ? theme.accent : theme.textDisabled, backgroundColor: on ? theme.accent : 'transparent',
            }} />
          );
        })}
      </View>
      {a.step === 'create' ? (
        <Button label="Continue" theme={theme} disabled={!a.canContinue} onPress={() => a.toConfirm(a.entry)} />
      ) : null}
    </>
  );
}

// S7.1 recover — the code field and Continue.
function RecoveryEntry({ a }: { a: AuthState }) {
  return (
    <>
      <Input
        label="Recovery code"
        value={a.codeInput}
        onChange={a.setCodeInput}
        theme={theme}
        placeholder="ABCD-EFGH-JKLM"
        autoCapitalize="characters"
        maxLength={CODE_LENGTH + 4}
      />
      <View style={{ marginTop: -space[4] }}>
        <Button label="Continue" theme={theme} busy={a.busy}
          disabled={normaliseCode(a.codeInput).length !== CODE_LENGTH || a.waitMs > 0} onPress={() => void a.submitCode()} />
      </View>
    </>
  );
}

// S7.1 code — the new recovery code, large and selectable, then "I've written it down".
function RecoveryCode({ a }: { a: AuthState }) {
  return (
    <>
      <Text selectable style={[type.h1, { color: theme.text, textAlign: 'center', letterSpacing: S7.codeSpacing, fontFamily: font.medium }]}>
        {a.code}
      </Text>
      <Text style={[type.caption, { color: theme.textMuted, textAlign: 'center' }]}>
        Shown only now. You can make a new one in Settings → Security.
      </Text>
      <Button label="I have written it down" theme={theme} onPress={a.codeWritten} />
    </>
  );
}

// S7.1 bio — Turn on (runs the fingerprint prompt once) · Not now.
function BioOffer({ a }: { a: AuthState }) {
  return (
    <>
      <View style={{ alignItems: 'center' }}><FingerprintIcon size={40} color={theme.accent} /></View>
      <Button label="Turn on" theme={theme} onPress={() => void a.turnOnBio()} />
      <Button label="Not now" variant="tonal" theme={theme} onPress={a.onDone} />
    </>
  );
}

// S7.1 message line: the error (red is real status) or the lockout countdown. On the PIN
// steps it keeps its two lines even when empty, so the keypad never moves under a finger.
function Message({ a }: { a: AuthState }) {
  const wait = a.waitMs > 0 ? `Try again in ${formatWait(a.waitMs)}.` : '';
  const text = [a.msg?.text, wait].filter(Boolean).join(' ');
  const pinStep = a.step === 'enter' || a.step === 'create' || a.step === 'confirm';
  if (!text && !pinStep) return null;
  return (
    <Text accessibilityLiveRegion="polite" style={[type.bodyMedium, {
      color: a.msg?.error || wait ? theme.error : theme.textMuted, textAlign: 'center',
      minHeight: pinStep ? S7.messageLines * type.bodyMedium.lineHeight : undefined,
    }]}>
      {text}
    </Text>
  );
}

// S7.2 — 3 × 4 keypad: 1–9, then [fingerprint | 0 | delete]. Keys are round dark glass.
function Keypad({ a, size }: { a: AuthState; size: number }) {
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['bio', '0', 'del']];
  const off = a.busy || a.waitMs > 0;
  return (
    <View style={{ alignSelf: 'center', gap: S7.keyGap }}>
      {rows.map(r => (
        <View key={r.join()} style={{ flexDirection: 'row', gap: S7.keyGap * 2 }}>
          {r.map(k => {
            if (k === 'bio') {
              return a.canBio
                ? <KeypadKey key={k} size={size} label="Unlock with fingerprint or face" ghost onPress={() => void a.tryBio()}>
                    <FingerprintIcon size={28} color={theme.accent} />
                  </KeypadKey>
                : <View key={k} style={{ width: size, height: size }} />;
            }
            if (k === 'del') {
              return (
                <KeypadKey key={k} size={size} label="Delete digit" ghost disabled={!a.entry || off} onPress={a.backspace}>
                  <Feather name="delete" size={24} color={theme.text} />
                </KeypadKey>
              );
            }
            return (
              <KeypadKey key={k} size={size} label={k} disabled={off} onPress={() => a.press(k)}>
                <Text style={{ fontFamily: font.light, fontSize: 28, lineHeight: 34, color: theme.text }}>{k}</Text>
              </KeypadKey>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// One key: a round dark-glass button (digits) or a ghost button (icons), ≥ 44.
function KeypadKey({ size, label, ghost, disabled, onPress, children }: {
  size: number; label: string; ghost?: boolean; disabled?: boolean; onPress: () => void; children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={ripple(theme, true)}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: size / 2, minWidth: touch.min, minHeight: touch.min,
        alignItems: 'center', justifyContent: 'center',
      },
      !ghost && { backgroundColor: theme.glass, borderWidth: 1, borderColor: theme.glassBorder, boxShadow: theme.tileShadow },
      pressed && { transform: [{ scale: motion.pressScaleSmall }] },
      disabled && !ghost && { opacity: 0.38 }]}
    >
      {children}
    </Pressable>
  );
}

// S7.3 — the links under everything: Forgot PIN? / Back to PIN / Cancel (14, #ebeaea; link 600 white).
function Footer({ a }: { a: AuthState }) {
  const links: Array<{ lead?: string; label: string; onPress: () => void }> = [];
  if (a.step === 'enter') links.push({ lead: 'Forgot PIN?', label: 'Use recovery code', onPress: a.goRecover });
  if (a.step === 'recover') links.push({ label: 'Back to PIN', onPress: a.backToPin });
  if (a.onCancel && a.step !== 'code') links.push({ label: 'Cancel', onPress: a.onCancel });
  if (!links.length) return null;
  return (
    <View style={{ marginTop: 'auto', alignItems: 'center' }}>
      {links.map(l => (
        <Pressable key={l.label} onPress={l.onPress} accessibilityRole="button" accessibilityLabel={l.label}
          style={{ minHeight: touch.min, justifyContent: 'center', paddingHorizontal: space[2] }}>
          <Text style={[type.bodyMedium, { color: theme.textMuted, textAlign: 'center' }]}>
            {l.lead ? `${l.lead} ` : ''}
            <Text style={{ fontFamily: font.semibold, color: theme.link }}>{l.label}</Text>
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// Lucide "fingerprint" (ISC), stroke 1.8, round caps: Feather has no fingerprint glyph.
function FingerprintIcon({ size, color }: { size: number; color: string }) {
  const p = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path {...p} d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <Path {...p} d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <Path {...p} d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <Path {...p} d="M2 12a10 10 0 0 1 18-6" />
      <Path {...p} d="M2 16h.01" />
      <Path {...p} d="M21.8 16c.2-2 .131-5.354 0-6" />
      <Path {...p} d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <Path {...p} d="M8.65 22c.21-.66.45-1.32.57-2" />
      <Path {...p} d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </Svg>
  );
}

// 95_000 -> "1:35"
function formatWait(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
