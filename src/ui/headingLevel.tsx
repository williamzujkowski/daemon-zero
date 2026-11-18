/**
 * Heading levels follow nesting, so heading navigation reads the terminal as an outline (#302): the page title is
 * level 1, a widget's title or a node card's title in a pane is a section at level 2, and a heading drawn inside a
 * widget is one level below the widget's title. A heading outside any titled section keeps the level it had.
 */
import { createContext, useContext, type ReactNode } from 'react';

/** A section of a pane, under the page's own level-1 title. */
export const SECTION_LEVEL = 2;

const Level = createContext<number | undefined>(undefined);

/** The level a heading drawn here takes; undefined outside a titled section. */
export function useHeadingLevel(): number | undefined {
  return useContext(Level);
}

/** Headings below this point take `level`; `undefined` resets it, for a dialog that leaves the outline. */
export function HeadingLevel({ level, children }: { level: number | undefined; children: ReactNode }) {
  return <Level value={level}>{children}</Level>;
}

interface HeadingProps { accessibilityRole?: unknown; role?: unknown; 'aria-level'?: unknown }

/** The level to add to a heading that names none, so a heading inside a widget sits below its title. */
export function useInheritedLevel(props: HeadingProps): { 'aria-level'?: number } {
  const level = useHeadingLevel();
  const heading = props.accessibilityRole === 'header' || props.role === 'heading';
  return level !== undefined && heading && props['aria-level'] === undefined ? { 'aria-level': level } : {};
}
