import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const KEY_NAME = 'db_key_v1';

export async function getKeyHex(): Promise<string> {
  let k = await SecureStore.getItemAsync(KEY_NAME);
  if (!k) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    k = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_NAME, k, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return k;
}
