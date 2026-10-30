// Copies the app's fonts and icon into desktop/renderer (git-ignored copies),
// so the desktop page uses exactly the phone app's Inter / Bebas Neue files.
// Run from desktop/ (npm run build does).
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const app = path.resolve('..');
const fonts = path.join('renderer', 'fonts');
mkdirSync(fonts, { recursive: true });
const files = [
  ['inter', '300Light', 'Inter_300Light.ttf'],
  ['inter', '400Regular', 'Inter_400Regular.ttf'],
  ['inter', '500Medium', 'Inter_500Medium.ttf'],
  ['inter', '600SemiBold', 'Inter_600SemiBold.ttf'],
  ['bebas-neue', '400Regular', 'BebasNeue_400Regular.ttf'],
];
for (const [pkg, dir, file] of files) {
  copyFileSync(path.join(app, 'node_modules', '@expo-google-fonts', pkg, dir, file), path.join(fonts, file));
}
copyFileSync(path.join(app, 'assets', 'icon.png'), path.join('renderer', 'icon.png'));
console.log(`copied ${files.length} fonts and the icon into renderer/`);
