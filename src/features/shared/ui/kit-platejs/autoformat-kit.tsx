import {
  KEYS,
  createSlatePlugin,
  createTextSubstitutionInputRule,
  type TextSubstitutionPattern,
} from 'platejs';

export const isAutoformatRuleEnabled = ({ editor }: { editor: any }) =>
  !editor.api.some({
    match: { type: editor.getType(KEYS.codeBlock) },
  });

const textSubstitutionPatterns: TextSubstitutionPattern[] = [
  { format: '→', match: '->' },
  { format: '⇒', match: '=>' },
  { format: '←', match: '<-' },
  { format: '—', match: '--' },
  { format: '…', match: '...' },
  { format: '©', match: ['(c)', '(C)'] },
  { format: '®', match: ['(r)', '(R)'] },
  { format: '™', match: ['(tm)', '(TM)'] },
  { format: '§', match: ['(s)', '(S)'] },
  { format: '¶', match: ['(p)', '(P)'] },
  { format: '½', match: '1/2' },
  { format: '¼', match: '1/4' },
  { format: '¾', match: '3/4' },
  { format: '≠', match: '!=' },
  { format: '≈', match: '~=' },
  { format: '≤', match: '<=' },
  { format: '≥', match: '>=' },
  { format: ['“', '”'], match: '"' },
  { format: ['‘', '’'], match: "'" },
];

export const AutoformatKit = [
  createSlatePlugin({
    key: 'shortcuts',
    inputRules: [
      createTextSubstitutionInputRule({
        enabled: isAutoformatRuleEnabled,
        patterns: textSubstitutionPatterns,
      }),
    ],
  }),
];
