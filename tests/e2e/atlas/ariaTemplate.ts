/**
 * Partial ARIA baselines (#340): one template line per contract item, the item's own role, name and states with
 * every number turned into a pattern, so a ticking value never changes the baseline but a renamed, re-roled or
 * missing control does. Lines are matched with Playwright's own toMatchAriaSnapshot. The baseline file holds
 * `<stage> <item> <project|*> <template>` lines; `*` means phone and desktop agree. Pure, unit-tested.
 */

/** A number as displayed: digits with any grouping or decimals between them (1,520 and 54.9 alike). */
const NUMBER = /\d[\d.,]*\d|\d/g;
const NUMBER_PATTERN = '\\d[\\d.,]*';
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\/]/g;
/** States that describe geometry or a reference change with layout, never with meaning. */
const LAYOUT_STATE = /^\[(box|ref|cursor)=/;

/** The first line of an aria snapshot without its list marker, undoing YAML single quoting. */
function firstKey(snapshot: string): string | null {
  const line = snapshot.split('\n').find((entry) => entry.trim() !== '');
  if (line === undefined) return null;
  const body = line.trim().replace(/^- /, '');
  if (!body.startsWith("'")) return body;
  // A doubled quote is an escaped quote; the first single one closes the scalar.
  let end = 1;
  while (end < body.length && !(body[end] === "'" && body[end + 1] !== "'")) end += body[end] === "'" ? 2 : 1;
  return body.slice(1, end).replace(/''/g, "'");
}

/** Reads `role "name" [state] [state]...` from the front of a key; any `: content` after it is left out. */
function parseKey(key: string): { role: string; name: string | null; states: string[] } | null {
  const role = /^[a-z]+/.exec(key)?.[0];
  if (role === undefined) return null;
  let rest = key.slice(role.length);
  let name: string | null = null;
  if (rest.startsWith(' "')) {
    let end = 2;
    while (end < rest.length && rest[end] !== '"') end += rest[end] === '\\' ? 2 : 1;
    name = JSON.parse(rest.slice(1, end + 1)) as string;
    rest = rest.slice(end + 1);
  }
  const states: string[] = [];
  for (let state = /^ \[[^\]]*\]/.exec(rest); state !== null; state = /^ \[[^\]]*\]/.exec(rest)) {
    states.push(state[0].trim());
    rest = rest.slice(state[0].length);
  }
  return rest === '' || rest.startsWith(':') ? { role, name, states } : null;
}

/** A quoted accessible name as a pattern when it holds a number, or as it stands otherwise. */
function nameTemplate(name: string): string {
  if (!/\d/.test(name)) return JSON.stringify(name);
  return '/^' + name.split(NUMBER).map((part) => part.replace(REGEX_SPECIAL, '\\$&')).join(NUMBER_PATTERN) + '$/';
}

/**
 * The template line for one item's aria snapshot, or null when the snapshot is empty, unreadable, or bare text: a
 * role-less readout has no node of its own to pin, and the role-less count in the gallery already tracks it.
 */
export function templateLine(snapshot: string): string | null {
  const key = firstKey(snapshot);
  const parsed = key === null ? null : parseKey(key);
  if (parsed === null || parsed.role === 'text') return null;
  const text = [parsed.role + (parsed.name === null ? '' : ' ' + nameTemplate(parsed.name)),
    ...parsed.states.filter((state) => !LAYOUT_STATE.test(state))].join(' ');
  return "- '" + text.replace(/'/g, "''") + "'";
}

export interface BaselineLine { stage: string; item: string; project: string; template: string }

export function parseBaseline(text: string): BaselineLine[] {
  return text.split('\n').filter((line) => line.trim() !== '' && !line.startsWith('#')).map((line) => {
    const [stage = '', item = '', project = '', ...rest] = line.split(' ');
    return { stage, item, project, template: rest.join(' ') };
  });
}

/** The template a cell expects for one item, or undefined when the baseline has none. */
export function expectedTemplate(lines: readonly BaselineLine[], stage: string, item: string, project: string): string | undefined {
  return lines.find((line) => line.stage === stage && line.item === item && (line.project === project || line.project === '*'))?.template;
}

/** Merges per-project lines into the baseline text: one `*` line where every project agrees, else one per project. */
export function renderBaseline(lines: readonly BaselineLine[], projects: readonly string[], header: string): string {
  const groups = new Map<string, BaselineLine[]>();
  for (const line of lines) groups.set(line.stage + ' ' + line.item, [...(groups.get(line.stage + ' ' + line.item) ?? []), line]);
  const out: string[] = [];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const templates = new Set(group.map((line) => line.template));
    const everyProject = projects.every((project) => group.some((line) => line.project === project));
    if (templates.size === 1 && everyProject) out.push(`${key} * ${group[0]?.template ?? ''}`);
    else for (const line of [...group].sort((a, b) => a.project.localeCompare(b.project))) out.push(`${key} ${line.project} ${line.template}`);
  }
  return header + out.join('\n') + '\n';
}
