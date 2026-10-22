import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a silent no-op, so the web preview tier
// maps it to window.alert/confirm. Button semantics: the negative button is
// the one styled/named "cancel", the affirmative callback is the last other
// button. Native builds keep the real platform dialog untouched.
type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons as never);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const negative = buttons.find(b => b.style === 'cancel' || /cancel|close|keep|no$/i.test(b.text));
  const affirmative = buttons.filter(b => b !== negative).pop();
  if (window.confirm(text)) affirmative?.onPress?.();
  else negative?.onPress?.();
}
