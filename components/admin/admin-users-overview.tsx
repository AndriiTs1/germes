import {
  KeyRound,
  TriangleAlert,
  UserCheck,
  UsersRound,
} from "lucide-react";

import { AdminUsersList } from "@/components/admin/admin-users-list";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { AdminUserListItem } from "@/lib/services/admin/list-users";

type AdminUsersOverviewProps = {
  users: AdminUserListItem[];
  dictionary: Dictionary;
};

export function AdminUsersOverview({
  users,
  dictionary,
}: AdminUsersOverviewProps) {
  const t = dictionary.admin.users;

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.isActive).length;
  const authLinkedUsers = users.filter((user) => user.authLinked).length;
  const attentionUsers = users.filter(
    (user) => !user.isActive || !user.authLinked,
  ).length;

  const stats = [
    {
      label: t.stats.total,
      value: totalUsers,
      icon: UsersRound,
      tone: "text-slate-500 bg-slate-100",
    },
    {
      label: t.stats.active,
      value: activeUsers,
      icon: UserCheck,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: t.stats.authLinked,
      value: authLinkedUsers,
      icon: KeyRound,
      tone: "text-blue-700 bg-blue-50",
    },
    {
      label: t.stats.attention,
      value: attentionUsers,
      icon: TriangleAlert,
      tone:
        attentionUsers > 0
          ? "text-amber-700 bg-amber-50"
          : "text-emerald-700 bg-emerald-50",
    },
  ] as const;

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-[15px] font-semibold text-slate-900">
          {t.title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          {t.subtitle}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium text-slate-400">
                  {stat.label}
                </p>
                <p className="mt-2 text-[24px] leading-none font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </p>
              </div>

              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${stat.tone}`}
              >
                <stat.icon className="h-[17px] w-[17px]" strokeWidth={1.75} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <AdminUsersList users={users} dictionary={dictionary} />
    </section>
  );
}
