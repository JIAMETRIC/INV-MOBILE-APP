import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, type, maxReadWidth } from './tokens';
import type { Theme } from './tokens';
import { useBreakpoint } from './useBreakpoint';
import { IconButton } from './components';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  theme: Theme;
  wide?: boolean;
  children: React.ReactNode;
};

// Phones: M3 modal bottom sheet (docked to the bottom edge, 28dp top corners,
// drag handle, slides up). Tablets: M3 dialog centred in the window.
// System Back closes it through Modal.onRequestClose.
export function Sheet({ visible, onClose, title, theme, wide, children }: SheetProps) {
  const bp = useBreakpoint();
  const insets = useSafeAreaInsets();
  const bottom = bp.isPhone;
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType={bottom ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'android' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          accessibilityLabel="Close"
          style={{
            flex: 1, backgroundColor: theme.overlay,
            alignItems: 'center', justifyContent: bottom ? 'flex-end' : 'center',
          }}
          onPress={onClose}
        >
          <Pressable
            onStartShouldSetResponder={() => true}
            accessibilityViewIsModal
            style={bottom ? {
              width: '100%',
              maxHeight: '92%',
              backgroundColor: theme.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom,
            } : {
              width: wide ? '86%' : '92%',
              maxWidth: wide ? maxReadWidth : 560,
              maxHeight: '86%',
              backgroundColor: theme.surface,
              borderRadius: radius.xl,
            }}
          >
            {bottom ? (
              <View style={{ alignItems: 'center', paddingTop: space[3] }}>
                <View style={{ width: 32, height: 4, borderRadius: 2, backgroundColor: theme.outline, opacity: 0.6 }} />
              </View>
            ) : null}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingStart: space[5], paddingEnd: space[2], paddingTop: bottom ? space[1] : space[3],
            }}>
              <Text style={[type.title, { color: theme.text, flex: 1 }]} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              <IconButton icon="close" label="Close" onPress={onClose} theme={theme} />
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: space[5], paddingTop: space[2], paddingBottom: space[5] }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
