/**
 * Lints sample code at real file paths against the project's own eslint.config.mjs, running only the
 * rule a spec proves. Those architectural rules read the syntax tree alone, so the parser skips the
 * TypeScript program build that took most of each lint spec's 30 s budget (#306).
 */
import { ESLint, type Linter } from 'eslint';

// Only how the parser runs changes: every rule setting still comes from eslint.config.mjs unedited.
const WITHOUT_TYPE_INFORMATION: Linter.Config = { languageOptions: { parserOptions: { projectService: false, project: null } } };

export interface RuleLinter {
  /** Every message from linting `code` as if it were saved at `filePath`. */
  messages(filePath: string, code: string): Promise<Linter.LintMessage[]>;
  /** The full rule set the real config gives `filePath`, read with and without the parser change. */
  rulesFor(filePath: string): Promise<{ real: unknown; linted: unknown }>;
}

export function ruleLinter(ruleId: string): RuleLinter {
  const real = new ESLint();
  const lint = new ESLint({ overrideConfig: WITHOUT_TYPE_INFORMATION, ruleFilter: (rule) => rule.ruleId === ruleId });
  return {
    async messages(filePath, code) {
      const results = await lint.lintText(code, { filePath });
      return results.flatMap((file) => file.messages);
    },
    async rulesFor(filePath) {
      const [fromReal, fromLinted] = await Promise.all([real.calculateConfigForFile(filePath), lint.calculateConfigForFile(filePath)]);
      return { real: (fromReal as Linter.Config).rules, linted: (fromLinted as Linter.Config).rules };
    },
  };
}
