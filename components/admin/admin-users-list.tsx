import { ShieldCheck, UserRound } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { AdminUserListItem } from "@/lib/services/admin/list-users";
import { cn } from "@/lib/utils";

type AdminUsersListProps = {
  users: AdminUserListItem[];
  dictionary: Dictionary;
};

function StatusBadge({
  active,
  dictionary,
}: {
  active: boolean;
  dictionary: Dictionary;
}) {
  const t = dictionary.admin.users.status;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500",
      )}
    >
      {active ? t.active : t.inactive}
    </span>
  );
}

function AuthBadge({
  linked,
  dictionary,
}: {
  linked: boolean;
  dictionary: Dictionary;
}) {
  const t = dictionary.admin.users.auth;

  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-semibold whitespace-nowrap",
        linked
          ? "bg-blue-50 text-blue-700"
          : "bg-amber-50 text-amber-700",
      )}
    >
      {linked ? t.linked : t.unlinked}
    </span>
  );
}

export function AdminUsersList({
  users,
  dictionary,
}: AdminUsersListProps) {
  const t = dictionary.admin.users;

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]">
        <UserRound className="h-5 w-5 text-slate-300" strokeWidth={1.75} />
        <p className="text-[13px] font-medium text-slate-500">{t.empty}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)] lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-medium tracking-[0.04em] text-slate-400 uppercase">
              <th scope="col" className="px-4 py-3">
                {t.table.user}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.email}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.role}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.status}
              </th>
              <th scope="col" className="px-4 py-3">
                {t.table.auth}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr
                key={user.id}
                className="text-[13px] transition-colors hover:bg-slate-50"
              >
                <td className="max-w-[220px] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserRound className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <span className="truncate font-medium text-slate-900">
                      {user.name ?? user.email}
                    </span>
                  </div>
                </td>

                <td className="max-w-[260px] truncate px-4 py-3 text-slate-600">
                  {user.email}
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <StatusBadge
                    active={user.isActive}
                    dictionary={dictionary}
                  />
                </td>

                <td className="px-4 py-3">
                  <AuthBadge
                    linked={user.authLinked}
                    dictionary={dictionary}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 lg:hidden">
        {users.map((user) => (
          <li
            key={user.id}
            className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <UserRound className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">
                    {user.name ?? user.email}
                  </p>
                  <p className="mt-0.5 truncate text-[11.5px] text-slate-400">
                    {user.email}
                  </p>
                </div>
              </div>

              <StatusBadge
                active={user.isActive}
                dictionary={dictionary}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11.5px]">
              <div>
                <p className="text-slate-400">{t.table.role}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-slate-400">{t.table.auth}</p>
                <div className="mt-1">
                  <AuthBadge
                    linked={user.authLinked}
                    dictionary={dictionary}
                  />
                </div>
              </div>
            </div>

            {!user.authLinked ? (
              <div className="mt-3 flex items-center gap-1.5 text-[11.5px] font-medium text-amber-700">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                {t.auth.unlinked}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
