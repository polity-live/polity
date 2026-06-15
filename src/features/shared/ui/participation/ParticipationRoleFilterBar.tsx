import type {
  ParticipationLike,
  ParticipationRoleLike,
} from '@/features/shared/types/participation';
import { translate as translateText } from '@/features/shared/hooks/use-translation';
import { cn } from '@/features/shared/utils/utils';
import { BadgeControl } from '@/features/shared/ui/status';

export interface ParticipationRoleFilterBarProps<TRole extends ParticipationRoleLike> {
  roles: readonly TRole[];
  selectedRoleIds: readonly string[];
  onSelectedRoleIdsChange: (roleIds: string[]) => void;
  allLabel?: string;
  label?: string | null;
  className?: string;
}

export function getParticipationDisplayRoles<TRole extends ParticipationRoleLike>(
  participation: ParticipationLike<TRole>
) {
  return participation.roles?.length
    ? participation.roles
    : participation.role
      ? [participation.role]
      : [];
}

export function filterParticipationsByRole<TParticipation extends ParticipationLike>(
  items: readonly TParticipation[],
  selectedRoleIds: readonly string[]
) {
  if (selectedRoleIds.length === 0) {
    return [...items];
  }

  const selectedRoleIdSet = new Set(selectedRoleIds);

  return items.filter(item =>
    getParticipationDisplayRoles(item).some(role => selectedRoleIdSet.has(role.id))
  );
}

export function ParticipationRoleFilterBar<TRole extends ParticipationRoleLike>({
  roles,
  selectedRoleIds,
  onSelectedRoleIdsChange,
  allLabel = translateText('common.allRoles', 'All roles'),
  label = translateText('components.membershipTables.role', 'Roles'),
  className,
}: ParticipationRoleFilterBarProps<TRole>) {
  if (roles.length === 0) {
    return null;
  }

  const selectedRoleIdSet = new Set(selectedRoleIds);

  const toggleRole = (roleId: string) => {
    if (selectedRoleIdSet.has(roleId)) {
      onSelectedRoleIdsChange(selectedRoleIds.filter(selectedRoleId => selectedRoleId !== roleId));
      return;
    }

    onSelectedRoleIdsChange([...selectedRoleIds, roleId]);
  };

  return (
    <div
      data-slot="participation-role-filter"
      className={cn('mb-4 flex flex-wrap items-center gap-2', className)}
    >
      {label ? <span className="text-muted-foreground text-xs font-medium">{label}</span> : null}
      <BadgeControl
        asChild
        variant={selectedRoleIds.length === 0 ? 'default' : 'outline'}
        className={cn('rounded-md', selectedRoleIds.length === 0 && 'shadow-sm')}
      >
        <button
          type="button"
          aria-pressed={selectedRoleIds.length === 0}
          onClick={() => onSelectedRoleIdsChange([])}
        >
          {allLabel}
        </button>
      </BadgeControl>

      {roles.map(role => {
        const selected = selectedRoleIdSet.has(role.id);

        return (
          <BadgeControl
            key={role.id}
            asChild
            variant={selected ? 'default' : 'outline'}
            className={cn('rounded-md', selected && 'shadow-sm')}
          >
            <button type="button" aria-pressed={selected} onClick={() => toggleRole(role.id)}>
              {role.name || translateText('components.membershipTables.roleFallback', 'Role')}
            </button>
          </BadgeControl>
        );
      })}
    </div>
  );
}
