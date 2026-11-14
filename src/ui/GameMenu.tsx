/** One utility surface hosts save/help/confirmation pages; gameplay controls stay outside. */
import { useEffect, useRef, type ComponentRef } from 'react';
import { Modal, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Pressable, Text, View } from './PhaseTheme';
import { palette, theme } from './theme';
import UtilityPages, { MenuButton } from './UtilityPages';
import UtilityStatus from './UtilityStatus';
import { useUtilityMenu, type UtilityMenu } from './useUtilityMenu';

const titles = { root: 'GAME MENU', save: 'SAVE CODE', help: 'HELP // ABOUT', import: 'REPLACE RUN', reset: 'START FRESH' };

export function MenuLauncher({ menu: { setTrigger, route, disabled, open } }: { menu: UtilityMenu }) {
  return <Pressable ref={setTrigger} testID="menu-open" accessibilityRole="button" accessibilityLabel="Game menu"
    accessibilityState={{ expanded: route !== null, disabled }} aria-expanded={route !== null}
    disabled={disabled} style={theme.button} onPress={open}><Text style={theme.text}>[ MENU ]</Text></Pressable>;
}

export function UtilityPanel({ menu, ending = false }: { menu: UtilityMenu; ending?: boolean }) {
  const focus = useRef<ComponentRef<typeof Pressable>>(null);
  useEffect(() => { focus.current?.focus(); }, [menu.route]);
  if (menu.route === null) return null;
  return <View testID="menu-dialog" style={styles.panel}>
    <View style={styles.navigation}>
      {menu.route !== 'root' && <MenuButton id="menu-back" label="Back in game menu" caption="Back" press={menu.back} />}
      <Text accessibilityRole="header" style={[theme.heading, { flexShrink: 1 }]}>{titles[menu.route]}</Text>
      <Pressable ref={focus} testID="menu-close" accessibilityRole="button" accessibilityLabel="Close game menu"
        style={theme.button} onPress={menu.close}><Text style={theme.text}>[ CLOSE ]</Text></Pressable>
    </View>
    <ScrollView testID="menu-scroll" contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!ending && <Text style={theme.muted}>Simulation continues while this menu is open.</Text>}
      <UtilityStatus /><UtilityPages menu={menu} />
      <MenuButton id="menu-return-game" label={ending ? 'Return to ending' : 'Return to game'} press={menu.close} />
    </ScrollView>
  </View>;
}

export default function GameMenu() {
  const menu = useUtilityMenu();
  const { width } = useWindowDimensions();
  return <><MenuLauncher menu={menu} />
    {menu.route !== null && <Modal visible transparent animationType="none" accessibilityLabel="Game menu" onRequestClose={menu.back}>
      <View style={[styles.overlay, width >= 900 && styles.wide]}><UtilityPanel menu={menu} /></View>
    </Modal>}
  </>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, padding: 12, backgroundColor: '#000e', alignItems: 'center', justifyContent: 'center' },
  wide: { alignItems: 'flex-end' },
  panel: { width: '100%', maxWidth: 680, maxHeight: '100%', flexShrink: 1, backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: palette.border },
  content: { padding: 16, gap: 14 },
});
