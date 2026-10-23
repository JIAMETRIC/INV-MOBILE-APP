import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../shell/providers';
import { useBackIntercept, useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Button, Card, EmptyState, IconButton, Input, ListItem, SectionTitle, TopAppBar, initials, type IconName,
} from '../../ui/components';
import { useNavInset } from '../../ui/navMetrics';
import { useSnackbar } from '../../ui/Snackbar';
import { layout, space, type } from '../../ui/tokens';
import { formatPaise, formatDateDisplay } from '../../data/money';
import { getSettings, updateSettings } from '../../data/settingsRepo';
import { listDrafts, deleteDraft } from '../../data/draftsRepo';
import { exportDbBackup, listBackups, restoreDbBackup } from '../../data/backupRepo';
import { recentAudit } from '../../data/auditRepo';
import { shareFile } from '../../export/pdf';
import type { Draft, Settings } from '../../data/types';
import appVersion from '../../../app-version.json';

const VERSION_LABEL = `Invoice ERP ${appVersion.version} (build ${appVersion.versionCode})`;

type Section = 'company' | 'drafts' | 'backup' | 'activity';

const SECTIONS: Array<{ key: Section; label: string; hint: string; icon: IconName }> = [
  { key: 'company', label: 'Company', hint: 'Business details, bank, invoice numbering', icon: 'briefcase' },
  { key: 'drafts', label: 'Drafts', hint: 'Autosaved invoices not yet issued', icon: 'file' },
  { key: 'backup', label: 'Backup & restore', hint: 'Encrypted database export and import', icon: 'upload-cloud' },
  { key: 'activity', label: 'Activity log', hint: 'Recent changes made in the app', icon: 'clock' },
];

export function SettingsScreen() {
  const theme = useTheme();
  const nav = useNav();
  const bp = useBreakpoint();
  const [section, setSection] = useState<Section>('company');
  const [openOnPhone, setOpenOnPhone] = useState<Section | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [backups, setBackups] = useState<Awaited<ReturnType<typeof listBackups>>>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof recentAudit>>>([]);
  const [busy, setBusy] = useState(false);
  const snack = useSnackbar();
  const navInset = useNavInset();

  // Phone drill-in: system Back returns to the section list before leaving Settings.
  useBackIntercept(() => {
    if (bp.panes === 1 && openOnPhone !== null) { setOpenOnPhone(null); return true; }
    return false;
  });

  const load = useCallback(async () => {
    setSettings(await getSettings());
    setDrafts(await listDrafts());
    setBackups(await listBackups());
    setAudit(await recentAudit(50));
  }, []);

  useEffect(() => { void load(); }, [load, nav.refreshKey]);

  if (!settings) {
    return <Text style={[type.body, { color: theme.textMuted, padding: space[4] }]}>Loading settings…</Text>;
  }

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
        invoice_prefix: settings.invoice_prefix || 'PRE-',
      });
      setSettings(saved);
      nav.refresh();
      snack('Company settings saved');
    } finally {
      setBusy(false);
    }
  };

  const doExportBackup = async () => {
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

  const doImportBackup = async () => {
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

  const row = (a: React.ReactNode, b: React.ReactNode) => (
    <View style={{ flexDirection: 'row', gap: layout.grid }}>
      <View style={{ flex: 1 }}>{a}</View>
      <View style={{ flex: 1 }}>{b}</View>
    </View>
  );
  // The last Input in a card drops its 16 bottom margin, so card padding stays even.
  const last = { marginBottom: -space[4] };

  const companyForm = (
    <View style={{ gap: layout.gap }}>
      <Card theme={theme}>
        <SectionTitle title="Business" theme={theme} />
        <Input label="Business name" value={settings.name} onChange={v => setField('name', v)} theme={theme} />
        <Input label="Subtitle" value={settings.subtitle} onChange={v => setField('subtitle', v)} theme={theme} />
        <Input label="Address" value={settings.address} onChange={v => setField('address', v)} theme={theme} multiline />
        {row(
          <Input label="City" value={settings.city} onChange={v => setField('city', v)} theme={theme} />,
          <Input label="Pincode" value={settings.pincode} onChange={v => setField('pincode', v)} theme={theme} keyboardType="numeric" maxLength={6} />,
        )}
        {row(
          <Input label="PAN" value={settings.pan} onChange={v => setField('pan', v)} theme={theme} autoCapitalize="characters" maxLength={10} />,
          <Input label="Contact" value={settings.contact} onChange={v => setField('contact', v)} theme={theme} keyboardType="phone-pad" />,
        )}
        <View style={last}>
          <Input label="Email" value={settings.email} onChange={v => setField('email', v)} theme={theme} keyboardType="email-address" autoCapitalize="none" />
        </View>
      </Card>
      <Card theme={theme}>
        <SectionTitle title="Bank / UPI" theme={theme} />
        {row(
          <Input label="Bank" value={settings.bank_name} onChange={v => setField('bank_name', v)} theme={theme} />,
          <Input label="Branch" value={settings.bank_branch} onChange={v => setField('bank_branch', v)} theme={theme} />,
        )}
        {row(
          <Input label="A/C no" value={settings.bank_ac_no} onChange={v => setField('bank_ac_no', v)} theme={theme} tabular keyboardType="numeric" />,
          <Input label="IFSC" value={settings.bank_ifsc} onChange={v => setField('bank_ifsc', v)} theme={theme} autoCapitalize="characters" maxLength={11} />,
        )}
        <View style={last}>
          <Input label="UPI ID" value={settings.upi_id} onChange={v => setField('upi_id', v)} theme={theme} autoCapitalize="none" />
        </View>
      </Card>
      <Card theme={theme}>
        <SectionTitle title="Invoice numbering" theme={theme} />
        <View style={last}>
          {row(
            <Input label="Prefix" value={settings.invoice_prefix} onChange={v => setField('invoice_prefix', v)} theme={theme} />,
            <Input label="Next number" theme={theme} editable={false} tabular onChange={() => undefined}
              value={`${settings.invoice_prefix}${String(settings.next_seq).padStart(3, '0')}`} />,
          )}
        </View>
      </Card>
      <Button label="Save" icon="check" theme={theme} busy={busy} onPress={() => void saveCompany()} />
    </View>
  );

  const draftsPane = (
    <View>
      {bp.panes === 1 ? null : <SectionTitle title={`Drafts (${drafts.length})`} theme={theme} />}
      <Card theme={theme} list>
        {drafts.length === 0
          ? <EmptyState icon="file" title="No drafts" text="Invoices you leave unfinished are autosaved here." theme={theme} />
          : drafts.map((d, i) => (
            <ListItem
              key={d.id}
              theme={theme}
              flush
              leadingText={initials(d.party_name)}
              leadingAlt={i % 2 === 1}
              divider={i < drafts.length - 1}
              title={d.party_name || '(no party)'}
              subtitle={`${d.draft_no} · ${d.items_count} lines · ₹${formatPaise(d.total_paise)} · ${formatDateDisplay(d.updated_at.slice(0, 10))}`}
              onPress={() => nav.openCreate({ draftId: d.id })}
              trailing={(
                <IconButton icon="trash-2" label={`Delete draft ${d.draft_no}`} theme={theme}
                  onPress={() => {
                    alert('Delete draft?', d.draft_no, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete', style: 'destructive',
                        onPress: () => { void deleteDraft(d.id).then(() => { void load(); snack('Draft deleted'); }); },
                      },
                    ]);
                  }} />
              )}
            />
          ))}
      </Card>
    </View>
  );

  const backupPane = (
    <View style={{ gap: layout.gap }}>
      <Card theme={theme} style={{ gap: space[4] }}>
        <SectionTitle title="Backup & restore" theme={theme} />
        <Text style={[type.bodyMedium, { color: theme.textMuted, marginTop: -space[3] }]}>
          Backups are SQLCipher-encrypted files. They only open on this device unless the key
          is carried along; keep the exported file safe.
        </Text>
        <View style={{ flexDirection: 'row', gap: layout.grid }}>
          <Button label="Export" icon="share" theme={theme} busy={busy} onPress={() => void doExportBackup()} style={{ flex: 1 }} />
          <Button label="Restore" icon="download" variant="outline" theme={theme} busy={busy} onPress={() => void doImportBackup()} style={{ flex: 1 }} />
        </View>
      </Card>
      {backups.length > 0 ? (
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
      ) : null}
    </View>
  );

  const activityPane = (
    <View>
      {bp.panes === 1 ? null : <SectionTitle title="Recent activity" theme={theme} />}
      <Card theme={theme} list>
        {audit.length === 0 ? <EmptyState icon="clock" text="No activity yet." theme={theme} /> : null}
        {audit.map((a, i) => (
          <ListItem key={a.id} theme={theme} flush leadingIcon="clock" divider={i < audit.length - 1}
            title={`${a.action} — ${a.entity_type} ${a.entity_id}`}
            subtitle={a.created_at} />
        ))}
      </Card>
    </View>
  );

  const panes: Record<Section, React.ReactNode> = {
    company: companyForm, drafts: draftsPane, backup: backupPane, activity: activityPane,
  };

  const sectionList = (phone: boolean) => (
    <Card theme={theme} list>
      {SECTIONS.map((x, i) => (
        <ListItem key={x.key} theme={theme} flush leadingIcon={x.icon} title={x.label} subtitle={x.hint}
          chevron={phone} divider={i < SECTIONS.length - 1}
          selected={!phone && section === x.key}
          onPress={() => (phone ? setOpenOnPhone(x.key) : setSection(x.key))} />
      ))}
    </Card>
  );

  if (bp.panes === 1) { // phones and md tablets: list, then drill-in
    const open = SECTIONS.find(x => x.key === openOnPhone);
    return (
      <View style={{ flex: 1 }}>
        <TopAppBar
          title={open ? open.label : 'Settings'}
          subtitle={open ? undefined : 'Company, drafts, backup'}
          theme={theme}
          large={!open}
          onBack={open ? () => setOpenOnPhone(null) : undefined}
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: layout.side, paddingTop: space[1], paddingBottom: navInset, gap: layout.gap }}
          keyboardShouldPersistTaps="handled"
        >
          {open ? panes[open.key] : (
            <>
              {sectionList(true)}
              <Text style={[type.caption, { color: theme.textMuted, textAlign: 'center' }]}>
                {VERSION_LABEL}
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TopAppBar title="Settings" subtitle="Company, drafts, backup" theme={theme} large />
      <View style={{ flex: 1, flexDirection: 'row', gap: layout.gap }}>
        <View style={{ width: 300, paddingStart: layout.side, gap: layout.gap }}>
          {sectionList(false)}
          <Text style={[type.caption, { color: theme.textMuted, paddingHorizontal: space[1] }]}>
            {VERSION_LABEL}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ paddingEnd: layout.side, paddingBottom: navInset, maxWidth: 720, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {panes[section]}
        </ScrollView>
      </View>
    </View>
  );
}
