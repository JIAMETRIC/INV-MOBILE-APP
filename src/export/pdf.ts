import { Alert, Platform } from 'react-native';
import { getContentUriAsync } from 'expo-file-system/legacy';
import WhatsAppShare from '../../modules/whatsapp-share';
import { Directory, File, Paths } from 'expo-file-system';

export const isWeb = Platform.OS === 'web';

export function docsDir(...segments: string[]): Directory {
  if (isWeb) throw new Error('File storage is Android-only');
  const dir = new Directory(Paths.document, ...segments);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

// Web preview tier: no native PDF engine, so downloads go through blob URLs.
export function webBlobDownload(data: Blob | string, filename: string, mime = 'text/html'): string {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  return url;
}

export type ShareTarget = 'whatsapp' | 'device';

const MIME: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
};
const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

// Every Share / Download button ends here, with only two destinations:
// WhatsApp, or a folder on the phone's own storage that the user picks.
// With no `target` the user is asked which one.
export async function shareFile(uri: string, target?: ShareTarget): Promise<void> {
  if (isWeb) {
    if (uri.startsWith('blob:')) return; // blob downloads already triggered themselves
    throw new Error('Sharing is Android-only');
  }
  const to = target ?? await askTarget();
  if (to === 'whatsapp') await sendToWhatsApp(uri);
  else if (to === 'device') await saveToDevice(uri);
}

function askTarget(): Promise<ShareTarget | null> {
  return new Promise(resolve => {
    Alert.alert('Share file', undefined, [
      { text: 'WhatsApp', onPress: () => resolve('whatsapp') },
      { text: 'Save to phone', onPress: () => resolve('device') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

// WhatsApp, else WhatsApp Business. "Not installed" only when neither package is on the phone;
// any other failure keeps Android's own message.
async function sendToWhatsApp(uri: string): Promise<void> {
  const packageName = WhatsAppShare.installedPackage(WHATSAPP_PACKAGES);
  if (!packageName) throw new Error('WhatsApp is not installed on this phone');
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const content = await getContentUriAsync(uri);
  await WhatsAppShare.share(content, MIME[ext] ?? 'application/octet-stream', packageName);
}

async function saveToDevice(uri: string): Promise<void> {
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch {
    return; // the folder picker was closed without a choice
  }
  const source = new File(uri);
  const target = new File(dir, source.name);
  if (target.exists) target.delete();
  source.copy(dir);
}
