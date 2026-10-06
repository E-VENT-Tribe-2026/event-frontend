import { UserAvatar } from '@/components/UserAvatar';
import type { AdminEventPerson } from '@/lib/adminApi';
import { personUsername } from '@/lib/adminFormat';

interface AdminPersonProps {
  person: AdminEventPerson;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Picture + full name + @username. All text is rendered as plain React text
 * (never as HTML), so names and usernames typed by users can't inject markup.
 */
export default function AdminPerson({ person, size = 'sm' }: AdminPersonProps) {
  const username = personUsername(person);
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <UserAvatar
        src={person.avatar_url}
        srcSecondary={person.avatar_url}
        seed={person.id}
        name={person.full_name}
        size={size}
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{person.full_name}</p>
        {username && <p className="text-[11px] text-muted-foreground truncate">@{username}</p>}
      </div>
    </div>
  );
}
