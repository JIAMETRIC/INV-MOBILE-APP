import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { font, radius, space, touch, type } from './tokens';
import type { Theme } from './tokens';

// A field that opens a list of choices in a Sheet. Looks like Input: label above,
// field 50 tall, radius 14, the same fill and border.
export function Dropdown({ label, value, options, onChange, theme, placeholder = 'Select' }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void; theme: Theme;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: space[2] }}>
      <Text style={[type.labelMedium, { color: theme.textMuted }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder }}
        onPress={() => setOpen(true)}
        style={{
          height: touch.input, paddingHorizontal: space[4],
          borderWidth: 1, borderColor: theme.inputBorder, borderRadius: radius.control,
          backgroundColor: theme.inputFill,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={[type.body, { color: value ? theme.text : theme.textDisabled }]}>{value || placeholder}</Text>
        <Feather name="chevron-down" size={18} color={theme.textMuted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} theme={theme}>
        {options.map((o, i) => {
          const picked = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              onPress={() => { onChange(o); setOpen(false); }}
              style={{
                minHeight: touch.min, justifyContent: 'center',
                borderBottomWidth: i < options.length - 1 ? 1 : 0, borderColor: theme.divider,
              }}
            >
              <Text style={[type.body, {
                color: picked ? theme.accent : theme.text,
                fontFamily: picked ? font.semibold : font.regular,
              }]}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </Sheet>
    </View>
  );
}
