// Fingerprint / face unlock through the phone's own prompt (expo-local-authentication).
// The PIN always works too: the prompt has no device-passcode fallback of its own.
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

// True when the phone has a sensor and at least one fingerprint or face enrolled.
export async function bioAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

// Shows the system prompt; true only on a matched fingerprint or face.
export async function bioUnlock(promptMessage = 'Unlock Invoice ERP'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage, cancelLabel: 'Use PIN', disableDeviceFallback: true,
    });
    return r.success;
  } catch {
    return false;
  }
}
