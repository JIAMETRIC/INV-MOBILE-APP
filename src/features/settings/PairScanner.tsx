// S6.7.4 — full-screen QR scanner for the desktop's pairing code (Settings →
// Sync with desktop → Scan pairing code). Dark screen (the Sign In recipe):
// camera behind, the kit's top bar, a blue frame to aim with, one line of help.
// Only codes starting invoiceerp://pair? are taken; the first one closes it.
import React, { useEffect, useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, TopAppBar } from '../../ui/components';
import { dark, layout, radius, space, type } from '../../ui/tokens';

const PAIR_PREFIX = 'invoiceerp://pair?';

// Every number specific to this screen.
const S67 = {
  frame: 240, // the aiming square
  frameBorder: 2,
} as const;

export function PairScanner({ visible, onCode, onClose }: {
  visible: boolean; onCode: (code: string) => void; onClose: () => void;
}) {
  const theme = dark;
  const [perm, request] = useCameraPermissions();
  const taken = useRef(false);

  useEffect(() => {
    if (!visible) return;
    taken.current = false;
    if (perm && !perm.granted && perm.canAskAgain) void request();
  }, [visible, perm, request]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {perm?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={r => {
              if (taken.current || !r.data.startsWith(PAIR_PREFIX)) return;
              taken.current = true;
              onCode(r.data);
            }}
          />
        ) : null}
        <TopAppBar title="Scan pairing code" subtitle="Desktop: Add phone" onBack={onClose} theme={theme} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: layout.gap, padding: layout.side }}>
          {perm?.granted ? (
            <>
              <View style={{
                width: S67.frame, height: S67.frame, borderRadius: radius.frame,
                borderWidth: S67.frameBorder, borderColor: theme.accent,
              }} />
              <Text style={[type.bodyMedium, { color: theme.text, textAlign: 'center' }]}>
                Point the camera at the code on the desktop screen.
              </Text>
            </>
          ) : (
            <>
              <Text style={[type.bodyMedium, { color: theme.textMuted, textAlign: 'center' }]}>
                {perm && !perm.canAskAgain
                  ? 'Camera access is off for Invoice ERP. Turn it on in Android Settings, or paste the pairing link instead.'
                  : 'Invoice ERP needs the camera to read the pairing code.'}
              </Text>
              {perm?.canAskAgain !== false ? (
                <Button label="Allow camera" icon="camera" theme={theme} onPress={() => void request()} />
              ) : null}
            </>
          )}
        </View>
        <View style={{ height: space[8] }} />
      </View>
    </Modal>
  );
}
