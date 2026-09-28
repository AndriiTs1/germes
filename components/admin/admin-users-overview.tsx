import { AdminUsersList } from "@/components/admin/admin-users-list";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type {
  AdminAccessOverview,
} from "@/lib/services/admin/get-admin-access-overview";

type AdminUsersOverviewProps = {
  overview: AdminAccessOverview;
  dictionary: Dictionary;
};

export function AdminUsersOverview({
  overview,
  dictionary,
}: AdminUsersOverviewProps) {
  const t = dictionary.admin.users;

  const stats = [
    {
      label: t.stats.total,
      value: overview.metrics.totalUsers,
      tone: "text-slate-900",
    },
    {
      label: t.stats.roles,
      value: overview.metrics.totalRoles,
      tone: "text-slate-900",
    },
    {
      label: t.stats.privileged,
      value: overview.metrics.privilegedUsers,
      tone: "text-slate-900",
    },
    {
      label: t.stats.accessIssues,
      value: overview.health.attentionCount,
      tone:
        overview.health.attentionCount > 0
          ? "text-amber-700"
          : "text-emerald-700",
    },
  ] as const;

  return (
    <section>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.035)]"
          >
            <p className="text-[11.5px] font-medium text-slate-400">
              {stat.label}
            </p>

            <p
              className={`mt-1.5 text-[24px] leading-none font-semibold tracking-tight ${stat.tone}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <AdminUsersList
        users={overview.users}
        dictionary={dictionary}
      />
    </section>
  );
}
