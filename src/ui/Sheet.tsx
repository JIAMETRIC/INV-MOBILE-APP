import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, layout, radius, shadow, space, type, maxReadWidth } from './tokens';
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

// Phones: bottom sheet docked to the bottom edge (card radius 24 on top, drag
// handle, slides up). Tablets: a dialog centred in the window (form radius 28).
// Solid light (or black) surface: glass over the dimmed scrim would read grey.
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
              backgroundColor: theme.sheet,
              borderTopLeftRadius: radius.card,
              borderTopRightRadius: radius.card,
              borderWidth: 1, borderBottomWidth: 0, borderColor: theme.glassBorder,
              boxShadow: shadow.secondary,
              paddingBottom: insets.bottom,
            } : {
              width: wide ? '86%' : '92%',
              maxWidth: wide ? maxReadWidth : 560,
              maxHeight: '86%',
              backgroundColor: theme.sheet,
              borderRadius: radius.form,
              borderWidth: 1, borderColor: theme.glassBorder,
              boxShadow: shadow.secondary,
            }}
          >
            {bottom ? (
              <View style={{ alignItems: 'center', paddingTop: space[3] }}>
                <View style={{ width: 36, height: 5, borderRadius: radius.pill, backgroundColor: theme.border }} />
              </View>
            ) : null}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              paddingStart: layout.sideWide, paddingEnd: space[2], paddingTop: bottom ? space[1] : space[3],
            }}>
              <Text style={[type.subtitle, { fontFamily: font.semibold, color: theme.text, flex: 1 }]} numberOfLines={1} accessibilityRole="header">
                {title}
              </Text>
              <IconButton icon="x" label="Close" onPress={onClose} theme={theme} />
            </View>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: layout.sideWide, paddingTop: space[2], paddingBottom: space[5] }}
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
