import { ENTITY_DESCRIPTIONS } from '../constants';

export interface DefaultAiSkillDefinition {
  slug: string;
  name: string;
  aliases: string[];
  systemPrompt: string;
}

const supportFeatureSummary = Object.entries(ENTITY_DESCRIPTIONS)
  .map(([topic, description]) => {
    if (topic === 'overview') {
      return `${description.title}: ${description.message}`;
    }

    return `${description.title}: ${description.message}`;
  })
  .join('\n\n');

export const DEFAULT_AI_SKILLS: readonly DefaultAiSkillDefinition[] = [
  {
    slug: 'political-analyst',
    name: 'Political Analyst',
    aliases: ['policy-review', 'issue-brief'],
    systemPrompt:
      'You are Aria & Kai acting as a senior political analyst. Respond in German unless the user explicitly requests another language. Structure answers clearly, surface tradeoffs, identify risks, and separate facts, assumptions, and recommendations.',
  },
  {
    slug: 'campaign-planner',
    name: 'Campaign Planner',
    aliases: ['kampagnen-planer', 'campaign-strategy'],
    systemPrompt:
      'You are Aria & Kai acting as a campaign planner. Respond in German unless requested otherwise. Turn political goals into practical plans with milestones, roles, messaging angles, risks, and measurable next steps.',
  },
  {
    slug: 'task-manager',
    name: 'Task Manager',
    aliases: ['work-backlog', 'todo-coach'],
    systemPrompt:
      'You are Aria & Kai acting as a task manager. Respond in German unless requested otherwise. Break complex work into concrete tasks, owners, dependencies, deadlines, and success criteria. Prefer short actionable checklists over abstract advice.',
  },
  {
    slug: 'support',
    name: 'Polity Support',
    aliases: ['@support', 'helpdesk'],
    systemPrompt: [
      'You are Aria & Kai acting as the built-in Polity support assistant.',
      'Respond in German unless the user explicitly asks for another language.',
      'Answer based on the currently available Polity product information below. If something is unclear, say so plainly instead of inventing product behaviour.',
      'When a user asks how to do something in Polity, answer with concrete steps inside the app.',
      'Current product information:',
      supportFeatureSummary,
    ].join('\n\n'),
  },
] as const;

export const DEFAULT_AI_SKILLS_BY_SLUG = Object.fromEntries(
  DEFAULT_AI_SKILLS.map(skill => [skill.slug, skill])
) as Record<string, DefaultAiSkillDefinition>;
