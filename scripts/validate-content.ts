/**
 * Build-time content gate: `pnpm validate:content`.
 * Importing the content module runs schema validation and every integrity check.
 * Exits non-zero and prints each problem if anything is wrong.
 */
import { buildRegistry, ContentError, RAW_CONTENT } from '../src/content';

try {
  const reg = buildRegistry(RAW_CONTENT);
  const counts = [
    `${String(reg.phases.length)} phases`,
    `${String(reg.nodes.size)} nodes`,
    `${String(reg.repeatables.size)} repeatables`,
    `${String(reg.actions.size)} actions`,
    `${String(reg.dilemmas.length)} dilemmas`,
    `${String(reg.endings.length)} endings`,
  ];
  console.log(`[PASS] content valid: ${counts.join(', ')}`);
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`[FAIL] ${String(error.problems.length)} content problem(s):`);
    for (const problem of error.problems) console.error(`  - ${problem}`);
  } else {
    console.error(error);
  }
  process.exit(1);
}
