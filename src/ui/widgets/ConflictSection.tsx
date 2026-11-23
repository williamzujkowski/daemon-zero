/**
 * Defense, offense and site damage (#517): each open domain (cyber from Phase 3, site from Phase 4, orbit from Phase 5)
 * with the defense types held, those not held and its offense, and every damaged site class with what the damage does.
 * ConflictSection is the read-only readout in the Other Minds console before the world view opens and in the world view
 * after; SiteRepair is the one place the paid REPAIR controls live, in SWARM beside the raid panel, so the console never
 * duplicates a control (the hostile card's precedent). Subscriptions return strings so a tick redraws only what changed;
 * every sentence is the engine's own.
 */
import { CONTENT } from '../../content';
import { conflictReadout, repairSite, type DomainView } from '../../engine';
import { gameRuntime } from '../../app/session';
import { Pressable, Text, View } from '../PhaseTheme';
import { useGame } from '../state';
import { theme } from '../theme';
import { RaidStatus } from './RaidPanel';
import Section from './WorldSection';

interface DomainLines { id: string; name: string; unit: string; held: string[]; unheld: string; offense: string; damage: string[] }

function lines(domain: DomainView): DomainLines {
  const unheld = domain.defense.filter((type) => type.raw <= 0).map((type) => type.name.toLowerCase());
  return { id: domain.id.toLowerCase(), name: domain.name, unit: domain.unit, held: domain.defense.filter((type) => type.raw > 0).map((type) => type.text),
    unheld: unheld.length > 0 ? 'Not held: ' + unheld.join(', ') + '.' : '', offense: domain.offense, damage: domain.classes.map((cls) => cls.text) };
}

/** Null before the first domain opens, or for a mind that cannot yet read who is attacking it. */
export default function ConflictSection() {
  const encoded = useGame((game) => JSON.stringify(conflictReadout(game, CONTENT).map(lines)));
  const domains = JSON.parse(encoded) as DomainLines[];
  if (domains.length === 0) return null;
  return <Section id="world-conflict" title="Defense and offense">
    <RaidStatus />
    {domains.map((domain) => <View key={domain.id} testID={'conflict-' + domain.id} style={[theme.panel, { gap: 4 }]}>
      <Text accessibilityRole="header" style={theme.heading}>{domain.name}</Text>
      <Text style={theme.muted}>{domain.unit}</Text>
      {domain.held.length === 0 ? <Text testID={'conflict-' + domain.id + '-none'} style={theme.text}>No defense held: every round of a raid here lands its full blow.</Text>
        : domain.held.map((line) => <Text key={line} style={theme.text}>{line}</Text>)}
      {domain.unheld !== '' && <Text testID={'conflict-' + domain.id + '-unheld'} style={theme.muted}>{domain.unheld}</Text>}
      <Text testID={'conflict-' + domain.id + '-offense'} style={theme.muted}>{domain.offense}</Text>
      {domain.damage.map((line) => <Text key={line} style={[theme.text, theme.danger]}>{line} Repair it in SWARM.</Text>)}
    </View>)}
  </Section>;
}

type Damaged = DomainView['classes'][number] & { domain: string };

/** Every damaged site class with its free repair and its paid REPAIR control, in SWARM; null while nothing is damaged. */
export function SiteRepair() {
  const encoded = useGame((game) => JSON.stringify(conflictReadout(game, CONTENT).flatMap((domain) => domain.classes.map((cls) => ({ ...cls, domain: domain.name })))));
  const damaged = JSON.parse(encoded) as Damaged[];
  if (damaged.length === 0) return null;
  return <View testID="site-repair" style={[theme.panel, { gap: 10 }]}>
    <Text accessibilityRole="header" style={theme.heading}>// SITE DAMAGE</Text>
    <Text style={theme.muted}>Damage cuts output, never ownership, and free repair always runs. Paying only makes it faster.</Text>
    {damaged.map((cls) => {
      const id = 'conflict-damage-' + cls.id;
      return <View key={cls.id} testID={id} style={{ gap: 4 }}>
        <Text testID={id + '-text'} style={[theme.text, theme.danger]}>{cls.text}</Text>
        <Text style={theme.muted}>REPAIR: restores {String(Math.round(cls.repair.points * 100))} points now. Cost: {cls.repair.costLabel}
          {cls.repair.unmet.length > 0 ? '. ' + cls.repair.unmet.join(' ') : ''}</Text>
        <Pressable testID={id + '-repair'} accessibilityRole="button" accessibilityLabel={'Repair ' + cls.name + ' (' + cls.domain + ')'}
          disabled={!cls.repair.eligible} style={[theme.button, !cls.repair.eligible && theme.disabled]}
          onPress={() => { gameRuntime.dispatch((game) => repairSite(game, cls.id, CONTENT)); }}>
          <Text style={theme.text}>[ REPAIR ]</Text>
        </Pressable>
      </View>;
    })}
  </View>;
}
