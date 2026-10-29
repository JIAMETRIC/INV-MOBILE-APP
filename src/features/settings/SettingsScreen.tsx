// S6 — Settings. Read top to bottom:
//   SECTIONS, VERSION_LABEL, S6   the text and the numbers you are most likely to edit
//   useSettings()                 all state, data and actions (no JSX)
//   SettingsScreen()              the one-pane / master-detail switch, built on <Screen>
//   Header … ActivityPane         one function per region, in the order they appear on screen
// IDs (S6.1, S6.2.1 …) are from SCREEN_LAYOUT_REFERENCE/SCREEN_LAYOUT_REFERENCE.md.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../shell/providers';
import { useBackIntercept, useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Button, Card, EmptyState, Input, ListItem, SectionTitle, TopAppBar, type IconName,
} from '../../ui/components';
import { useNavInset } from '../../ui/navMetrics';
import { Screen } from '../../ui/Screen';
import { Columns } from '../../ui/Columns';
import { useSnackbar } from '../../ui/Snackbar';
import { layout, space, type } from '../../ui/tokens';
import type { Theme } from '../../ui/tokens';
import { getSettings, updateSettings } from '../../data/settingsRepo';
import { exportDbBackup, listBackups, restoreDbBackup } from '../../data/backupRepo';
import { recentAudit } from '../../data/auditRepo';
import { shareFile } from '../../export/pdf';
import { LOCK, useLock } from '../../auth/LockProvider';
import { bioUnlock } from '../../auth/biometrics';
import type { Settings } from '../../data/types';
import appVersion from '../../../app-version.json';

type Section = 'company' | 'security' | 'backup' | 'activity';

// S6.1 — the four sections, in order: key · label · hint · Feather icon.
const SECTIONS: Array<{ key: Section; label: string; hint: string; icon: IconName }> = [
  { key: 'company', label: 'Company', hint: 'Business details, bank, invoice numbering', icon: 'briefcase' },
  { key: 'security', label: 'Security', hint: 'PIN, fingerprint, recovery code, lock', icon: 'lock' },
  { key: 'backup', label: 'Backup & restore', hint: 'Encrypted database export and import', icon: 'upload-cloud' },
  { key: 'activity', label: 'Activity log', hint: 'Recent changes made in the app', icon: 'clock' },
];

const VERSION_LABEL = `Invoice ERP ${appVersion.version} (build ${appVersion.versionCode})`;

// Every number that is specific to this screen. Shared spacing comes from
// tokens.ts (layout.side 20, layout.gap 16, layout.grid 12).
const S6 = {
  listWidth: 300, // S6.1 on lg+: the section list's width
  paneMaxWidth: 720, // lg+: the selected section's reading width
  auditRows: 50, // S6.5: how many audit rows to load
  inputPull: -space[4], // the last Input in a card drops its 16 bottom margin, so card padding stays even
  pincodeLength: 6, // S6.2.1
  panLength: 10, // S6.2.1
  ifscLength: 11, // S6.2.2
  numberPad: 3, // S6.2.3: "INV-002" pads the sequence to 3 digits
} as const;

type Backup = Awaited<ReturnType<typeof listBackups>>[number];
type AuditRow = Awaited<ReturnType<typeof recentAudit>>[number];

// ---------------------------------------------------------------------------
// State and data: the selected section (lg+) or the drilled-in one (one pane),
// the settings form, drafts, backups, the audit log, and every action.
// ---------------------------------------------------------------------------
function useSettings() {
  const nav = useNav();
  const bp = useBreakpoint();
  const snack = useSnackbar();
  const [section, setSection] = useState<Section>('company');
  const [openOnPhone, setOpenOnPhone] = useState<Section | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useLock();

  // One pane (phones, md): system Back returns to the section list before leaving Settings.
  useBackIntercept(() => {
    if (bp.panes === 1 && openOnPhone !== null) { setOpenOnPhone(null); return true; }
    return false;
  });

  const load = useCallback(async () => {
    setSettings(await getSettings());
    setBackups(await listBackups());
    setAudit(await recentAudit(S6.auditRows));
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  const setField = (k: keyof Settings, v: string) => {
    setSettings(s => (s ? { ...s, [k]: v } : s));
  };

  const saveCompany = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const saved = await updateSettings({
        name: settings.name, subtitle: settings.subtitle, address: settings.address,
        city: settings.city, pincode: settings.pincode,
        pan: settings.pan, contact: settings.contact, email: settings.email,
        bank_name: settings.bank_name, bank_branch: settings.bank_branch,
        bank_ac_no: settings.bank_ac_no, bank_ifsc: settings.bank_ifsc, upi_id: settings.upi_id,
        invoice_prefix: settings.invoice_prefix || 'INV-',
      });
      setSettings(saved);
      nav.refresh();
      snack('Company settings saved');
    } finally {
      setBusy(false);
    }
  };

  const exportBackup = async () => {
    setBusy(true);
    try {
      const f = await exportDbBackup();
      await shareFile(f.uri);
      void load();
    } catch (e) {
      alert('Backup failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const importBackup = async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['application/x-sqlite3', 'application/octet-stream'], copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const doc = picked.assets[0];
    if (!doc) return;
    const ok = await new Promise<boolean>(resolve => {
      alert(
        'Restore backup?',
        'This replaces the current database. A safety copy of the current data is taken automatically. The restore only works on this device (the encryption key never leaves it).',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Restore', style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });
    if (!ok) return;
    setBusy(true);
    try {
      await restoreDbBackup(doc.uri);
      nav.refresh();
      void load();
      snack('Database restored from backup');
    } catch (e) {
      alert('Restore failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // S6.6: turning fingerprint unlock on asks for a fingerprint first, so it is known to work.
  const toggleBio = async (on: boolean) => {
    if (on && !(await bioUnlock('Confirm your fingerprint'))) return;
    await lock.setBio(on);
    snack(on ? 'Fingerprint unlock on' : 'Fingerprint unlock off');
  };

  return {
    section, setSection, openOnPhone, setOpenOnPhone,
    settings, backups, audit, busy, lock,
    setField, saveCompany, exportBackup, importBackup, toggleBio,
  };
}
type SettingsState = ReturnType<typeof useSettings>;
// Below the loading screen every region sees loaded settings.
type Loaded = SettingsState & { settings: Settings };

// ---------------------------------------------------------------------------
// The screen: one pane (phones, md) = header + the section list, or the opened
// section; lg+ = header + [ section list 300 | the selected section ].
// ---------------------------------------------------------------------------
export function SettingsScreen() {
  const theme = useTheme();
  const bp = useBreakpoint();
  const s = useSettings();

  if (!s.settings) {
    return <Text style={[type.body, { color: theme.textMuted, padding: space[4] }]}>Loading settings…</Text>;
  }
  const st = s as Loaded;

  if (bp.panes === 1) {
    const open = SECTIONS.find(x => x.key === st.openOnPhone);
    return (
      <Screen header={<Header s={st} theme={theme} open={open} />}>
        <SectionScroll side>
          {open
            ? <SectionBody s={st} theme={theme} section={open.key} />
            : <SectionList s={st} theme={theme} phone />}
        </SectionScroll>
      </Screen>
    );
  }

  return (
    <Screen header={<Header s={st} theme={theme} />}>
      <View style={{ flex: 1, flexDirection: 'row', gap: layout.gap }}>
        <SectionListPane s={st} theme={theme} />
        <SectionScroll maxWidth={S6.paneMaxWidth}>
          <SectionBody s={st} theme={theme} section={st.section} />
        </SectionScroll>
      </View>
    </Screen>
  );
}

// S6.0 — "Settings" with "Company, drafts, backup" (large); on one pane with a section open,
// that section's label with a glass back button.
function Header({ s, theme, open }: { s: Loaded; theme: Theme; open?: (typeof SECTIONS)[number] }) {
  return (
    <TopAppBar
      title={open ? open.label : 'Settings'}
      subtitle={open ? undefined : 'Company, security, backup'}
      theme={theme}
      large={!open}
      onBack={open ? () => s.setOpenOnPhone(null) : undefined}
    />
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// The one scroller of Main: `side` pads both sides (one pane); otherwise only the end
// (the lg+ section pane, capped at a reading width). Bottom clears the nav.
function SectionScroll({ children, side, maxWidth }: { children: React.ReactNode; side?: boolean; maxWidth?: number }) {
  const navInset = useNavInset();
  return (
    <ScrollView
      contentContainerStyle={side
        ? { paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: navInset, gap: layout.gap }
        : { paddingEnd: layout.side, paddingBottom: navInset, maxWidth, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// S6.1 — the four section rows: icon chip · label · hint. One pane: chevrons, tap drills in;
// lg+: the selected row is tinted, tap switches the pane. The version line sits under the list.
function SectionList({ s, theme, phone }: { s: Loaded; theme: Theme; phone: boolean }) {
  return (
    <>
      <Card theme={theme} list>
        {SECTIONS.map((x, i) => (
          <ListItem key={x.key} theme={theme} flush leadingIcon={x.icon} title={x.label} subtitle={x.hint}
            chevron={phone} divider={i < SECTIONS.length - 1}
            selected={!phone && s.section === x.key}
            onPress={() => (phone ? s.setOpenOnPhone(x.key) : s.setSection(x.key))} />
        ))}
      </Card>
      <Text style={[type.caption, { color: theme.textMuted, ...(phone ? { textAlign: 'center' as const } : { paddingHorizontal: space[1] }) }]}>
        {VERSION_LABEL}
      </Text>
    </>
  );
}

// lg+ — the fixed left column holding the section list (S6.listWidth).
function SectionListPane({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ width: S6.listWidth, paddingStart: layout.side, gap: layout.gap }}>
      <SectionList s={s} theme={theme} phone={false} />
    </View>
  );
}

// Picks the section's content.
function SectionBody({ s, theme, section }: { s: Loaded; theme: Theme; section: Section }) {
  switch (section) {
    case 'company': return <CompanyForm s={s} theme={theme} />;
    case 'security': return <SecurityPane s={s} theme={theme} />;
    case 'backup': return <BackupPane s={s} theme={theme} />;
    case 'activity': return <ActivityPane s={s} theme={theme} />;
  }
}

// One row, two equal columns of inputs (stacks only under 128 dp per cell).
function FieldRow({ children }: { children: React.ReactNode }) {
  return <Columns kind="input">{children}</Columns>;
}

// S6.2 — Company: the Business, Bank / UPI and Invoice numbering cards, then Save (S6.2.4).
function CompanyForm({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ gap: layout.gap }}>
      <BusinessCard s={s} theme={theme} />
      <BankCard s={s} theme={theme} />
      <NumberingCard s={s} theme={theme} />
      <Button label="Save" icon="check" theme={theme} busy={s.busy} onPress={() => void s.saveCompany()} />
    </View>
  );
}

// S6.2.1 — Business name · Subtitle · Address (multiline) · City | Pincode · PAN | Contact · Email.
function BusinessCard({ s, theme }: { s: Loaded; theme: Theme }) {
  const v = s.settings;
  return (
    <Card theme={theme}>
      <SectionTitle title="Business" theme={theme} />
      <Input label="Business name" value={v.name} onChange={x => s.setField('name', x)} theme={theme} />
      <Input label="Subtitle" value={v.subtitle} onChange={x => s.setField('subtitle', x)} theme={theme} />
      <Input label="Address" value={v.address} onChange={x => s.setField('address', x)} theme={theme} multiline />
      <FieldRow>
        <Input label="City" value={v.city} onChange={x => s.setField('city', x)} theme={theme} />
        <Input label="Pincode" value={v.pincode} onChange={x => s.setField('pincode', x)} theme={theme} keyboardType="numeric" maxLength={S6.pincodeLength} />
      </FieldRow>
      <FieldRow>
        <Input label="PAN" value={v.pan} onChange={x => s.setField('pan', x)} theme={theme} autoCapitalize="characters" maxLength={S6.panLength} />
        <Input label="Contact" value={v.contact} onChange={x => s.setField('contact', x)} theme={theme} keyboardType="phone-pad" />
      </FieldRow>
      <View style={{ marginBottom: S6.inputPull }}>
        <Input label="Email" value={v.email} onChange={x => s.setField('email', x)} theme={theme} keyboardType="email-address" autoCapitalize="none" />
      </View>
    </Card>
  );
}

// S6.2.2 — Bank | Branch · A/C no | IFSC · UPI ID.
function BankCard({ s, theme }: { s: Loaded; theme: Theme }) {
  const v = s.settings;
  return (
    <Card theme={theme}>
      <SectionTitle title="Bank / UPI" theme={theme} />
      <FieldRow>
        <Input label="Bank" value={v.bank_name} onChange={x => s.setField('bank_name', x)} theme={theme} />
        <Input label="Branch" value={v.bank_branch} onChange={x => s.setField('bank_branch', x)} theme={theme} />
      </FieldRow>
      <FieldRow>
        <Input label="A/C no" value={v.bank_ac_no} onChange={x => s.setField('bank_ac_no', x)} theme={theme} tabular keyboardType="numeric" />
        <Input label="IFSC" value={v.bank_ifsc} onChange={x => s.setField('bank_ifsc', x)} theme={theme} autoCapitalize="characters" maxLength={S6.ifscLength} />
      </FieldRow>
      <View style={{ marginBottom: S6.inputPull }}>
        <Input label="UPI ID" value={v.upi_id} onChange={x => s.setField('upi_id', x)} theme={theme} autoCapitalize="none" />
      </View>
    </Card>
  );
}

// S6.2.3 — Prefix | Next number (read-only, e.g. "INV-002").
function NumberingCard({ s, theme }: { s: Loaded; theme: Theme }) {
  const v = s.settings;
  return (
    <Card theme={theme}>
      <SectionTitle title="Invoice numbering" theme={theme} />
      <View style={{ marginBottom: S6.inputPull }}>
        <FieldRow>
          <Input label="Prefix" value={v.invoice_prefix} onChange={x => s.setField('invoice_prefix', x)} theme={theme} />
          <Input label="Next number" theme={theme} editable={false} tabular onChange={() => undefined}
            value={`${v.invoice_prefix}${String(v.next_seq).padStart(S6.numberPad, '0')}`} />
        </FieldRow>
      </View>
    </Card>
  );
}

// S6.6 — Security: when the app locks, then a list card (fingerprint switch · Change PIN ·
// New recovery code), then Lock now. The PIN screens themselves are S7.
function SecurityPane({ s, theme }: { s: Loaded; theme: Theme }) {
  const { bio } = s.lock;
  const minutes = LOCK.relockAfterMs / 60_000;
  return (
    <View style={{ gap: layout.gap }}>
      <Card theme={theme} style={{ gap: space[4] }}>
        <SectionTitle title="App lock" theme={theme} />
        <Text style={[type.bodyMedium, { color: theme.textMuted, marginTop: -space[3] }]}>
          The app asks for your PIN when it opens and after {minutes} minutes in the background.
        </Text>
      </Card>
      <Card theme={theme} list>
        <ListItem theme={theme} flush leadingIcon="smartphone"
          title="Fingerprint / face unlock"
          subtitle={bio.available ? 'Unlock without typing the PIN' : 'Add a fingerprint in Android Settings to use this'}
          trailing={(
            <Switch
              value={bio.available && bio.enabled}
              disabled={!bio.available}
              onValueChange={on => void s.toggleBio(on)}
              accessibilityLabel="Fingerprint or face unlock"
              trackColor={{ true: theme.accent, false: theme.outline }}
              thumbColor={theme.accentOn}
            />
          )} />
        <ListItem theme={theme} flush leadingIcon="key" title="Change PIN" subtitle="Enter the current PIN, then a new one"
          chevron onPress={s.lock.changePin} />
        <ListItem theme={theme} flush leadingIcon="file-text" title="New recovery code" subtitle="The old code stops working"
          chevron divider={false} onPress={s.lock.showNewCode} />
      </Card>
      <Button label="Lock now" icon="lock" theme={theme} onPress={s.lock.lockNow} />
    </View>
  );
}

// S6.4 — Backup & restore: the info card with Export | Restore, then "Recent backups" when there are any.
function BackupPane({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ gap: layout.gap }}>
      <Card theme={theme} style={{ gap: space[4] }}>
        <SectionTitle title="Backup & restore" theme={theme} />
        <Text style={[type.bodyMedium, { color: theme.textMuted, marginTop: -space[3] }]}>
          Backups are SQLCipher-encrypted files. They only open on this device unless the key
          is carried along; keep the exported file safe.
        </Text>
        <ExportRestoreRow s={s} theme={theme} />
      </Card>
      {s.backups.length > 0 ? <RecentBackups backups={s.backups} theme={theme} /> : null}
    </View>
  );
}

// S6.4 row — one row, two equal columns: Export (blue) | Restore (glass).
function ExportRestoreRow({ s, theme }: { s: Loaded; theme: Theme }) {
  return (
    <View style={{ flexDirection: 'row', gap: layout.grid }}>
      <Button label="Export" icon="share" theme={theme} busy={s.busy} onPress={() => void s.exportBackup()} style={{ flex: 1 }} />
      <Button label="Restore" icon="download" variant="outline" theme={theme} busy={s.busy} onPress={() => void s.importBackup()} style={{ flex: 1 }} />
    </View>
  );
}

// S6.4 list — "Recent backups": archive icon · file name · "kind · KB · date".
function RecentBackups({ backups, theme }: { backups: Backup[]; theme: Theme }) {
  return (
    <View>
      <SectionTitle title="Recent backups" theme={theme} />
      <Card theme={theme} list>
        {backups.map((b, i) => (
          <ListItem key={b.id} theme={theme} flush leadingIcon="archive" divider={i < backups.length - 1}
            title={b.file_name}
            subtitle={`${b.kind} · ${Math.round(b.size_bytes / 1024)} KB · ${b.created_at}`} />
        ))}
      </Card>
    </View>
  );
}

// S6.5 — Activity log: "Recent activity" title on lg+, then a list card: "action — entity id" · date.
function ActivityPane({ s, theme }: { s: Loaded; theme: Theme }) {
  const bp = useBreakpoint();
  return (
    <View>
      {bp.panes === 1 ? null : <SectionTitle title="Recent activity" theme={theme} />}
      <Card theme={theme} list>
        {s.audit.length === 0 ? <EmptyState icon="clock" text="No activity yet." theme={theme} /> : null}
        {s.audit.map((a, i) => (
          <ListItem key={a.id} theme={theme} flush leadingIcon="clock" divider={i < s.audit.length - 1}
            title={`${a.action} — ${a.entity_type} ${a.entity_id}`}
            subtitle={a.created_at} />
        ))}
      </Card>
    </View>
  );
}
