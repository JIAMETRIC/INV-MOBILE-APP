import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { alert } from '../../ui/alert';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../shell/providers';
import { useBackIntercept, useNav } from '../../shell/navigation';
import { useBreakpoint } from '../../ui/useBreakpoint';
import {
  Button, Card, EmptyState, IconButton, Input, ListItem, SectionTitle, TopAppBar, type IconName,
} from '../../ui/components';
import { useSnackbar } from '../../ui/Snackbar';
import { space, type } from '../../ui/tokens';
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
  { key: 'company', label: 'Company', hint: 'Business details, bank, invoice numbering', icon: 'business-outline' },
  { key: 'drafts', label: 'Drafts', hint: 'Autosaved invoices not yet issued', icon: 'document-outline' },
  { key: 'backup', label: 'Backup & restore', hint: 'Encrypted database export and import', icon: 'cloud-upload-outline' },
  { key: 'activity', label: 'Activity log', hint: 'Recent changes made in the app', icon: 'time-outline' },
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

  // Phone drill-in: system Back returns to the section list before leaving Settings.
  useBackIntercept(() => {
    if (bp.isPhone && openOnPhone !== null) { setOpenOnPhone(null); return true; }
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

  const companyForm = (
    <View>
      <Input label="Business name" value={settings.name} onChange={v => setField('name', v)} theme={theme} />
      <Input label="Subtitle" value={settings.subtitle} onChange={v => setField('subtitle', v)} theme={theme} />
      <Input label="Address" value={settings.address} onChange={v => setField('address', v)} theme={theme} multiline />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Input label="City" value={settings.city} onChange={v => setField('city', v)} theme={theme} /></View>
        <View style={{ flex: 1 }}><Input label="Pincode" value={settings.pincode} onChange={v => setField('pincode', v)} theme={theme} keyboardType="numeric" maxLength={6} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Input label="PAN" value={settings.pan} onChange={v => setField('pan', v)} theme={theme} autoCapitalize="characters" maxLength={10} /></View>
        <View style={{ flex: 1 }}><Input label="Contact" value={settings.contact} onChange={v => setField('contact', v)} theme={theme} keyboardType="phone-pad" /></View>
      </View>
      <Input label="Email" value={settings.email} onChange={v => setField('email', v)} theme={theme} keyboardType="email-address" autoCapitalize="none" />
      <SectionTitle title="Bank / UPI" theme={theme} />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Input label="Bank" value={settings.bank_name} onChange={v => setField('bank_name', v)} theme={theme} /></View>
        <View style={{ flex: 1 }}><Input label="Branch" value={settings.bank_branch} onChange={v => setField('bank_branch', v)} theme={theme} /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}><Input label="A/C no" value={settings.bank_ac_no} onChange={v => setField('bank_ac_no', v)} theme={theme} tabular keyboardType="numeric" /></View>
        <View style={{ flex: 1 }}><Input label="IFSC" value={settings.bank_ifsc} onChange={v => setField('bank_ifsc', v)} theme={theme} autoCapitalize="characters" maxLength={11} /></View>
      </View>
      <Input label="UPI ID" value={settings.upi_id} onChange={v => setField('upi_id', v)} theme={theme} autoCapitalize="none" />
      <SectionTitle title="Invoice numbering" theme={theme} />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Input label="Prefix" value={settings.invoice_prefix} onChange={v => setField('invoice_prefix', v)} theme={theme} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Next number" theme={theme} editable={false} tabular onChange={() => undefined}
            value={`${settings.invoice_prefix}${String(settings.next_seq).padStart(3, '0')}`} />
        </View>
      </View>
      <Button label="Save" icon="checkmark" theme={theme} busy={busy} onPress={() => void saveCompany()}
        style={{ alignSelf: 'flex-end', marginTop: space[3] }} />
    </View>
  );

  const draftsPane = (
    <View>
      {bp.isPhone ? null : <SectionTitle title={`Drafts (${drafts.length})`} theme={theme} />}
      {drafts.length === 0
        ? <EmptyState icon="document-outline" title="No drafts" text="Invoices you leave unfinished are autosaved here." theme={theme} />
        : (
          <Card theme={theme} style={{ padding: 0, overflow: 'hidden' }}>
            {drafts.map((d, i) => (
              <ListItem
                key={d.id}
                theme={theme}
                divider={i < drafts.length - 1}
                title={d.party_name || '(no party)'}
                subtitle={`${d.draft_no} · ${d.items_count} lines · ₹${formatPaise(d.total_paise)} · ${formatDateDisplay(d.updated_at.slice(0, 10))}`}
                onPress={() => nav.openCreate({ draftId: d.id })}
                trailing={(
                  <IconButton icon="trash-outline" label={`Delete draft ${d.draft_no}`} theme={theme}
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
        )}
    </View>
  );

  const backupPane = (
    <View>
      {bp.isPhone ? null : <SectionTitle title="Backup & restore" theme={theme} />}
      <Text style={[type.bodyMedium, { color: theme.textMuted, marginBottom: space[4] }]}>
        Backups are SQLCipher-encrypted files. They only open on this device unless the key
        is carried along; keep the exported file safe.
      </Text>
      <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[4] }}>
        <Button label="Export" icon="share-outline" theme={theme} busy={busy} onPress={() => void doExportBackup()} style={{ flex: 1 }} />
        <Button label="Restore" icon="download-outline" variant="outline" theme={theme} busy={busy} onPress={() => void doImportBackup()} style={{ flex: 1 }} />
      </View>
      {backups.length > 0 ? <SectionTitle title="Recent backups" theme={theme} /> : null}
      {backups.map(b => (
        <ListItem key={b.id} theme={theme} leadingIcon="archive-outline"
          title={b.file_name}
          subtitle={`${b.kind} · ${Math.round(b.size_bytes / 1024)} KB · ${b.created_at}`} />
      ))}
    </View>
  );

  const activityPane = (
    <View>
      {bp.isPhone ? null : <SectionTitle title="Recent activity" theme={theme} />}
      {audit.length === 0 ? <EmptyState icon="time-outline" text="No activity yet." theme={theme} /> : null}
      {audit.map(a => (
        <ListItem key={a.id} theme={theme}
          title={`${a.action} — ${a.entity_type} ${a.entity_id}`}
          subtitle={a.created_at} />
      ))}
    </View>
  );

  const panes: Record<Section, React.ReactNode> = {
    company: companyForm, drafts: draftsPane, backup: backupPane, activity: activityPane,
  };

  if (bp.isPhone) {
    const open = SECTIONS.find(x => x.key === openOnPhone);
    return (
      <View style={{ flex: 1 }}>
        <TopAppBar
          title={open ? open.label : 'Settings'}
          theme={theme}
          large={!open}
          onBack={open ? () => setOpenOnPhone(null) : undefined}
        />
        <ScrollView
          contentContainerStyle={open ? { padding: bp.margin, paddingBottom: space[7] } : { paddingVertical: space[2] }}
          keyboardShouldPersistTaps="handled"
        >
          {open ? panes[open.key] : (
            <>
              {SECTIONS.map(x => (
                <ListItem key={x.key} theme={theme} leadingIcon={x.icon} title={x.label} subtitle={x.hint}
                  chevron divider={false} onPress={() => setOpenOnPhone(x.key)} />
              ))}
              <Text style={[type.caption, { color: theme.textMuted, textAlign: 'center', marginTop: space[5] }]}>
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
      <TopAppBar title="Settings" theme={theme} />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: 300, borderRightWidth: 1, borderColor: theme.border, paddingVertical: space[2] }}>
          {SECTIONS.map(x => (
            <ListItem key={x.key} theme={theme} leadingIcon={x.icon} title={x.label} subtitle={x.hint}
              divider={false} selected={section === x.key} onPress={() => setSection(x.key)} />
          ))}
          <Text style={[type.caption, { color: theme.textMuted, paddingHorizontal: space[4], marginTop: space[4] }]}>
            {VERSION_LABEL}
          </Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: bp.margin, maxWidth: 720, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {panes[section]}
        </ScrollView>
      </View>
    </View>
  );
}
