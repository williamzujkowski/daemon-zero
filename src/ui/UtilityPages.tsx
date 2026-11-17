/** Menu pages are ordinary content inside one utility surface, including confirmations. */
import AudioSettings from './AudioSettings';
import KernelLog from './KernelLog';
import PreviewMarker from './PreviewMarker';
import { TextInput } from 'react-native';
import { version } from '../../package.json';
import { Pressable, Text, View } from './PhaseTheme';
import { palette, theme } from './theme';
import type { UtilityMenu } from './useUtilityMenu';

export function MenuButton({ id, label, press, danger = false, caption = label }: {
  id: string; label: string; press: () => void; danger?: boolean; caption?: string;
}) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label}
    style={[theme.button, { maxWidth: '100%', flexShrink: 1 }]} onPress={press}><Text style={[theme.text, danger && theme.danger]}>[ {caption.toUpperCase()} ]</Text></Pressable>;
}

function RootPage({ menu }: { menu: UtilityMenu }) {
  return <View testID="menu-root" style={{ gap: 14 }}>
    <PreviewMarker id="preview-marker-menu" />
    <MenuButton id="save-open" label="Save code transfer" caption="Saves" press={() => { menu.navigate('save'); }} />
    <MenuButton id="menu-audio" label="Audio" press={() => { menu.navigate('audio'); }} />
    <MenuButton id="menu-help" label="Help and about" press={() => { menu.navigate('help'); }} />
    {/* The phone tier drops the kernel dock band to keep the first purchase above the fold
        (nexus vote, 6 of 6), so the history needs a home that costs no chrome. */}
    <MenuButton id="menu-kernel" label="Kernel log" press={() => { menu.navigate('log'); }} />
    <Text style={theme.muted}>Progress is saved automatically. Export a code to keep a backup.</Text>
  </View>;
}

function KernelPage({ menu }: { menu: UtilityMenu }) {
  return <View testID="menu-kernel-log" style={{ gap: 12, flex: 1, minHeight: 0 }}>
    <MenuButton id="kernel-back" label="Back to menu" press={menu.back} />
    <KernelLog />
  </View>;
}

function SavePage({ menu }: { menu: UtilityMenu }) {
  return <View testID="save-transfer" style={{ gap: 14 }}>
    <Text style={theme.text}>Export a backup or import a code to replace this run. Progress is also saved automatically.</Text>
    <TextInput testID="save-code" accessibilityLabel="Save code" autoCapitalize="none" autoCorrect={false}
      multiline maxLength={1_000_000} value={menu.code} onChangeText={menu.edit}
      style={[theme.text, { height: 160, borderWidth: 1, borderColor: palette.border, padding: 10 }]} />
    <MenuButton id="save-export" label="Export save code" press={menu.export} />
    <MenuButton id="save-import" label="Import save code" press={() => { menu.navigate('import'); }} />
    <View style={{ borderTopWidth: 1, borderColor: palette.warning, paddingTop: 12, gap: 12 }}>
      <Text style={theme.muted}>Want to begin again? Export and copy a backup first if you may want to return.</Text>
      <MenuButton id="save-reset" label="Start fresh from the beginning" danger press={() => { menu.navigate('reset'); }} />
    </View>
    {menu.status !== '' && <Text testID="save-transfer-status" accessibilityRole="alert" style={theme.text}>{menu.status}</Text>}
    <MenuButton id="save-close" label="Close save code transfer" press={menu.close} />
  </View>;
}

function HelpPage() {
  return <View testID="menu-help-page" style={{ gap: 14 }}>
    <Text style={theme.text}>DAEMON // 0 · {version}</Text>
    <PreviewMarker id="preview-marker-help" />
    <Text style={theme.text}>Read available hardware and its requirements, then use its purchase control. New interfaces appear as you discover them.</Text>
    <Text style={theme.text}>Use the game tabs to switch workspaces. Processes manages running hardware when available. The kernel log records events; expand it to read more.</Text>
    <Text style={theme.text}>Text size and reduced motion follow your device settings. Buttons can be reached by keyboard. Back or Escape returns through this menu.</Text>
    <Text style={theme.muted}>An offline game. No accounts or analytics. Code license: MIT. Created by William Zujkowski and contributors.</Text>
  </View>;
}

function Confirmation({ menu }: { menu: UtilityMenu }) {
  const importing = menu.route === 'import';
  const id = importing ? 'save-import' : 'save-reset';
  const title = importing ? 'Replace run from save code' : 'Start fresh from the beginning';
  return <View testID={id + '-dialog'} style={{ gap: 14 }}>
    <Text style={[theme.text, theme.danger]}>{importing
      ? 'Replace all current progress with this validated save. Export a backup first.'
      : 'Erase ALL game progress, including retained knowledge and run history. Return to the first boot with nothing carried over. This is a complete reset, not a voluntary wipe. Your current autosave will be replaced. Only an exported backup can restore it.'}</Text>
    <MenuButton id={id + '-confirm'} label={'Confirm ' + title} danger press={menu.confirm} />
    <MenuButton id={id + '-cancel'} label={'Cancel ' + title} press={menu.back} />
  </View>;
}

export default function UtilityPages({ menu }: { menu: UtilityMenu }) {
  if (menu.route === 'root') return <RootPage menu={menu} />;
  if (menu.route === 'save') return <SavePage menu={menu} />;
  if (menu.route === 'audio') return <AudioSettings />;
  if (menu.route === 'help') return <HelpPage />;
  if (menu.route === 'log') return <KernelPage menu={menu} />;
  return <Confirmation menu={menu} />;
}
