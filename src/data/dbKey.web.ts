// expo-secure-store (Android Keystore) has no functional web build, and the
// web SQLite driver is unencrypted anyway — so no key exists on this tier.
export async function getKeyHex(): Promise<string | null> {
  return null;
}
