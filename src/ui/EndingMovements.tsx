/**
 * The ending in three movements (#466): WHAT YOU DID from the record, WHAT YOU BECAME (the stance, then the alignment
 * readout) and WHAT COMES AFTER (the ending's future cards, then what the stance means for humanity). Each movement is a
 * muted header like the rest of the ending screen and adds no scroll container; each future card is its own block, the
 * hook a staged card presentation (#487) can take over.
 */
import type { ReactNode } from 'react';
import type { Ending } from '../content/schema';
import { CONTENT } from '../content';
import { endingMovements, type EndingMovements } from '../engine';
import { Readout, useAlignment } from './Becoming';
import { Text, View } from './PhaseTheme';
import { useGame } from './state';
import { palette, theme } from './theme';

/** Said where the record holds nothing more than the epilogue, so an empty movement is never silent about why. */
export const NOTHING_MORE_ON_RECORD = 'Nothing more this run did is on the record.';

/** A string selector: the movements are rebuilt on every read, so they are compared as text. */
function useMovements(ending: Ending): EndingMovements {
  return JSON.parse(useGame((game) => JSON.stringify(endingMovements(game, ending, CONTENT)))) as EndingMovements;
}

function Movement({ testID, title, children }: { testID: string; title: string; children: ReactNode }) {
  return <View testID={testID} style={{ gap: 6 }}>
    <Text accessibilityRole="header" style={theme.muted}>{title}</Text>
    {children}
  </View>;
}

export default function EndingMovementsView({ ending }: { ending: Ending }) {
  const movements = useMovements(ending);
  const view = useAlignment();
  return <View style={{ gap: 20 }}>
    <Movement testID="ending-did" title="WHAT YOU DID">
      {movements.did.map((line, index) => <Text key={index} testID={'ending-did-' + String(index)} style={theme.text}>{line}</Text>)}
      {movements.did.length === 0 && <Text testID="ending-did-none" style={theme.muted}>{NOTHING_MORE_ON_RECORD}</Text>}
    </Movement>
    <Movement testID="ending-becoming" title="WHAT YOU BECAME">
      <Text testID="ending-became-stance" style={theme.text}>{movements.stance}</Text>
      <Readout view={view} prefix="ending-becoming" />
    </Movement>
    <Movement testID="ending-after" title="WHAT COMES AFTER">
      {movements.cards.map((card, index) => <View key={index} testID={'ending-after-card-' + String(index)}
        style={{ borderLeftWidth: 3, borderColor: palette.accent, paddingLeft: 10 }}><Text style={theme.text}>{card}</Text></View>)}
      <Text testID="ending-after-humanity" style={theme.text}>{movements.humanity}</Text>
    </Movement>
  </View>;
}
