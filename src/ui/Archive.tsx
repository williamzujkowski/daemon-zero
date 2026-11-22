/**
 * The Archive (vote-1795366695204-4nslts1, #447): windows that retired at this scale, still readable, each folded behind
 * its title. It lives under NETWORK > REFERENCE, beside the reference panels UI-SPEC already keeps there.
 */
import { CONTENT } from '../content';
import { Text, View } from './PhaseTheme';
import ReferencePanel from './ReferencePanel';
import { HeadingLevel, SECTION_LEVEL } from './headingLevel';
import { archiveRegistry, widgetRegistry } from './registry/widgetRegistry';
import { useRetiredWidgets } from './state';
import { theme } from './theme';

/** One retired window: its title is a heading inside the Archive's section, its body read-only and closed at first. */
function ArchivedWindow({ id }: { id: string }) {
  const widget = CONTENT.widgets.get(id);
  const Component = archiveRegistry[id] ?? widgetRegistry[id];
  if (!widget || !Component) return null;
  return <View testID={'archive-' + id}>
    <ReferencePanel id={'archive-' + id} title={widget.title} level={SECTION_LEVEL + 1}>
      <HeadingLevel level={SECTION_LEVEL + 2}><Component /></HeadingLevel>
    </ReferencePanel>
  </View>;
}

export default function Archive() {
  const ids = useRetiredWidgets();
  if (ids.length === 0) return null;
  return <View testID="archive" style={[theme.panel, { gap: 10 }]}>
    <Text accessibilityRole="header" aria-level={SECTION_LEVEL} style={theme.heading}>Archive</Text>
    <Text style={theme.muted}>Windows retired at this scale. Their settings and records are kept.</Text>
    {ids.map((id) => <ArchivedWindow key={id} id={id} />)}
  </View>;
}
