/**
 * Kernel-log merges (#541): a mind's request for a host and each of its outcomes are saved as one joined line, so every
 * such pair, joined by the content's own template, must fit the longest line a save accepts.
 */
import type { ContentRegistry } from './registry';
import { LOG_LINE_MAX_CHARS } from './schemaLog';

function joined(template: string, line: string, answer: string): string {
  return template.split('{line}').join(line).split('{answer}').join(answer);
}

export function checkKernelLogIntegrity(reg: ContentRegistry): string[] {
  const template = reg.narrative.kernelLog.answered;
  const requests = [
    ...reg.swarm.wildShardEncounters.map((entry) => ({
      id: entry.id, description: entry.description, outcomes: [entry.consume.logText, entry.onHarnessLog, entry.lapseLog],
    })),
    ...reg.swarm.channelEncounters.map((entry) => ({
      id: entry.id, description: entry.description, outcomes: [entry.referral.log, entry.hosting.log],
    })),
  ];
  const problems: string[] = [];
  for (const request of requests) {
    const longest = Math.max(...request.outcomes.map((outcome) => joined(template, request.description, outcome).length));
    if (longest > LOG_LINE_MAX_CHARS) {
      problems.push(`encounter "${request.id}": its request joined to an outcome is ${String(longest)} characters, past the ${String(LOG_LINE_MAX_CHARS)} a log line holds`);
    }
  }
  return problems;
}
