import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding Germes demo data...");

  // --------------------------------------------------
  // Roles
  // --------------------------------------------------

  const roles = [
    {
      code: "OWNER",
      name: "Owner",
      description: "Full business overview and management access",
    },
    {
      code: "ADMIN",
      name: "Administrator",
      description: "System administration and configuration",
    },
    {
      code: "SALES",
      name: "Sales",
      description: "Clients, sales, orders and reservations",
    },
    {
      code: "PROCUREMENT",
      name: "Procurement",
      description: "Suppliers, purchasing and procurement planning",
    },
    {
      code: "WAREHOUSE",
      name: "Warehouse",
      description: "Inventory, batches, receiving and shipments",
    },
    {
      code: "ACCOUNTING",
      name: "Accounting",
      description: "Finance, payments, receivables and payables",
    },
    {
      code: "SUPPORT",
      name: "Support",
      description: "Internal Germes customer support workspace",
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: role,
      create: role,
    });
  }

  const roleRows = await prisma.role.findMany();
  const roleByCode = Object.fromEntries(roleRows.map((role) => [role.code, role]));

  // --------------------------------------------------
  // Permissions
  //
  // NOTE: The delete-then-recreate RolePermission strategy below is valid
  // ONLY while OWNER/ADMIN/SALES/PROCUREMENT/WAREHOUSE/ACCOUNTING/SUPPORT remain
  // seed-managed system roles and this seed file is the single source of
  // truth for their grants. If Germes later supports runtime/custom role
  // permission editing (an admin screen that grants or revokes permissions
  // per role), this seed MUST stop blindly overwriting RolePermission for
  // those roles, or it will silently discard administrator-configured
  // grants every time the seed runs.
  // --------------------------------------------------

  const permissionCatalog: { code: string; description: string; roles: string[] }[] = [
    {
      code: "dashboard.command_center.read",
      description: "View the Owner Command Center",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "workspace.sales.access",
      description: "See the Sales workspace and its navigation in the sidebar",
      roles: ["OWNER", "ADMIN", "SALES"],
    },
    {
      code: "workspace.warehouse.access",
      description: "See the Warehouse workspace and its navigation in the sidebar",
      roles: ["OWNER", "ADMIN", "WAREHOUSE"],
    },
    {
      code: "workspace.admin.access",
      description: "See the Administration workspace and its navigation in the sidebar",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "support.workspace.access",
      description: "Access the internal Germes support workspace",
      roles: ["SUPPORT"],
    },
    {
      code: "sales.orders.read",
      description: "View sales orders",
      roles: ["OWNER", "ADMIN", "SALES", "WAREHOUSE", "ACCOUNTING"],
    },
    {
      code: "sales.orders.create",
      description: "Create a sales order",
      // OWNER and ADMIN intentionally excluded (RBAC Phase 1): routine sales-rep
      // execution, not an owner-level control. See
      // scripts/sync-workspace-permissions.ts, which must be run against
      // a real database to actually revoke this from existing OWNER/ADMIN
      // grants — this seed file alone never reaches production.
      roles: ["SALES"],
    },
    {
      code: "sales.orders.update",
      description: "Edit or transition a sales order's status",
      // OWNER and ADMIN intentionally excluded (RBAC Phase 2B): edit/confirm/cancel
      // are routine sales-rep execution, not owner-level controls — same
      // reasoning as sales.orders.create in Phase 1. See
      // scripts/sync-workspace-permissions.ts, which must be run against
      // a real database to actually revoke this from existing OWNER/ADMIN
      // grants — this seed file alone never reaches production.
      roles: ["SALES"],
    },
    {
      code: "sales.reservations.read",
      description: "View stock reservations",
      roles: ["OWNER", "ADMIN", "SALES", "WAREHOUSE"],
    },
    {
      code: "sales.reservations.create",
      description: "Reserve stock for a sales order",
      // OWNER and ADMIN intentionally excluded (RBAC Phase 1) — see the note on
      // sales.orders.create above.
      roles: ["SALES"],
    },
    {
      code: "sales.reservations.release",
      description: "Manually release or cancel a stock reservation",
      // OWNER and ADMIN intentionally excluded (RBAC Phase 1) — see the note on
      // sales.orders.create above.
      roles: ["SALES"],
    },
    {
      code: "inventory.shipments.read",
      description: "View a sales order's Warehouse fulfillment detail",
      roles: ["OWNER", "ADMIN", "WAREHOUSE"],
    },
    {
      code: "inventory.shipments.process",
      description: "Mark a sales order as shipped (physical fulfillment)",
      // OWNER and ADMIN intentionally excluded (RBAC Phase 2A): starting/marking
      // ready/shipping are routine warehouse-operator execution, not
      // owner-level controls — same reasoning as sales.orders.update in
      // Phase 2B. OWNER and ADMIN retain read access via inventory.shipments.read
      // above. See scripts/sync-workspace-permissions.ts, which must be
      // run against a real database to actually revoke this from existing
      // OWNER/ADMIN grants — this seed file alone never reaches
      // production.
      roles: ["WAREHOUSE"],
    },
    {
      code: "customers.read",
      description: "View customer records",
      roles: ["OWNER", "ADMIN", "SALES", "ACCOUNTING"],
    },
    {
      code: "customers.create",
      description: "Create a customer",
      roles: ["OWNER", "ADMIN", "SALES"],
    },
    {
      code: "customers.update",
      description: "Edit customer contact/status information",
      roles: ["OWNER", "ADMIN", "SALES"],
    },
    {
      code: "customers.credit_limit.update",
      description: "Change a customer's credit limit or payment terms",
      roles: ["OWNER", "ADMIN", "ACCOUNTING"],
    },
    {
      code: "suppliers.read",
      description: "View supplier records",
      roles: ["OWNER", "ADMIN", "PROCUREMENT", "ACCOUNTING"],
    },
    {
      code: "suppliers.create",
      description: "Create a supplier",
      roles: ["OWNER", "ADMIN", "PROCUREMENT"],
    },
    {
      code: "suppliers.update",
      description: "Edit supplier information",
      roles: ["OWNER", "ADMIN", "PROCUREMENT"],
    },
    {
      code: "procurement.overview.read",
      description: "View procurement planning and reorder dashboards",
      roles: ["OWNER", "ADMIN", "PROCUREMENT"],
    },
    {
      code: "inventory.stock.read",
      description: "View aggregate stock levels (actual, reserved, free)",
      roles: ["OWNER", "ADMIN", "SALES", "PROCUREMENT", "WAREHOUSE", "ACCOUNTING"],
    },
    {
      code: "inventory.batches.read",
      description: "View batch-level traceability detail (expiry, origin, cost)",
      roles: ["OWNER", "ADMIN", "WAREHOUSE", "PROCUREMENT", "ACCOUNTING"],
    },
    {
      code: "inventory.stock_movements.create",
      description: "Record a stock receipt, transfer, write-off, or adjustment",
      roles: ["OWNER", "ADMIN", "WAREHOUSE"],
    },
    {
      code: "inventory.warehouses.read",
      description: "View the warehouse list",
      roles: ["OWNER", "ADMIN", "WAREHOUSE", "PROCUREMENT"],
    },
    {
      code: "inventory.warehouses.manage",
      description: "Create or edit warehouse records",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "finance.receivables.read",
      description: "View accounts receivable",
      roles: ["OWNER", "ADMIN", "ACCOUNTING", "SALES"],
    },
    {
      code: "finance.receivables.update",
      description: "Update accounts receivable records and status",
      // Operational accounting action: OWNER/ADMIN may supervise receivables,
      // but only ACCOUNTING records or changes receivable payment state.
      roles: ["ACCOUNTING"],
    },
    {
      code: "finance.payables.read",
      description: "View accounts payable",
      roles: ["OWNER", "ADMIN", "ACCOUNTING", "PROCUREMENT"],
    },
    {
      code: "finance.payables.update",
      description: "Update accounts payable records and status",
      roles: ["OWNER", "ADMIN", "ACCOUNTING"],
    },
    {
      code: "finance.dashboard.read",
      description: "View finance analytics (cash flow, margin)",
      roles: ["OWNER", "ADMIN", "ACCOUNTING"],
    },
    {
      code: "team.users.read",
      description: "View the user/team list",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "team.users.manage",
      description: "Create or deactivate users and assign roles",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "documents.read",
      description: "View attached documents",
      roles: ["OWNER", "ADMIN", "SALES", "PROCUREMENT", "WAREHOUSE", "ACCOUNTING"],
    },
    {
      code: "documents.manage",
      description: "Upload, attach, or remove documents",
      roles: ["OWNER", "ADMIN", "SALES", "PROCUREMENT", "WAREHOUSE", "ACCOUNTING"],
    },
    {
      code: "settings.roles.manage",
      description: "Manage role-to-permission assignments",
      roles: ["OWNER", "ADMIN"],
    },
    {
      code: "settings.system.read",
      description: "View general settings",
      roles: ["OWNER", "ADMIN"],
    },
  ];

  for (const permission of permissionCatalog) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: { code: permission.code, description: permission.description },
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionByCode = Object.fromEntries(
    permissionRows.map((permission) => [permission.code, permission]),
  );

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: roles.map((role) => roleByCode[role.code].id) },
    },
  });

  const rolePermissionRows = permissionCatalog.flatMap((permission) =>
    permission.roles.map((roleCode) => ({
      roleId: roleByCode[roleCode].id,
      permissionId: permissionByCode[permission.code].id,
    })),
  );

  await prisma.rolePermission.createMany({
    data: rolePermissionRows,
  });

  // --------------------------------------------------
  // Demo users
  // --------------------------------------------------

  const owner = await prisma.user.upsert({
    where: { email: "owner@germes.demo" },
    update: {
      name: "Олександр Коваль",
      isActive: true,
    },
    create: {
      email: "owner@germes.demo",
      name: "Олександр Коваль",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@germes.demo" },
    update: {
      name: "Наталія Романенко",
      isActive: true,
    },
    create: {
      email: "admin@germes.demo",
      name: "Наталія Романенко",
    },
  });

  const salesManager = await prisma.user.upsert({
    where: { email: "sales@germes.demo" },
    update: {
      name: "Ірина Мельник",
      isActive: true,
    },
    create: {
      email: "sales@germes.demo",
      name: "Ірина Мельник",
    },
  });

  // Explicit ids so SALES2_USER_ID / SALES3_USER_ID in .env are known
  // before this row exists — scripts/bootstrap-user.ts selects by id.
  const salesManager2 = await prisma.user.upsert({
    where: { email: "sales2@germes.demo" },
    update: {
      name: "Дмитро Ткаченко",
      isActive: true,
    },
    create: {
      id: "451030fb-4085-47cc-89e4-b8b93a5a779b",
      email: "sales2@germes.demo",
      name: "Дмитро Ткаченко",
    },
  });

  const salesManager3 = await prisma.user.upsert({
    where: { email: "sales3@germes.demo" },
    update: {
      name: "Оксана Литвиненко",
      isActive: true,
    },
    create: {
      id: "95ce9fdc-0a9c-43be-a658-d7e497a1724d",
      email: "sales3@germes.demo",
      name: "Оксана Литвиненко",
    },
  });

  const procurementManager = await prisma.user.upsert({
    where: { email: "procurement@germes.demo" },
    update: {
      name: "Максим Бондар",
      isActive: true,
    },
    create: {
      email: "procurement@germes.demo",
      name: "Максим Бондар",
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: "accounting@germes.demo" },
    update: {
      name: "Олена Шевченко",
      isActive: true,
    },
    create: {
      email: "accounting@germes.demo",
      name: "Олена Шевченко",
    },
  });

  const warehouseManager = await prisma.user.upsert({
    where: { email: "warehouse@germes.demo" },
    update: {
      name: "Андрій Петренко",
      isActive: true,
    },
    create: {
      email: "warehouse@germes.demo",
      name: "Андрій Петренко",
    },
  });

  await prisma.userRole.deleteMany({
    where: {
      userId: {
        in: [
          owner.id,
          admin.id,
          salesManager.id,
          salesManager2.id,
          salesManager3.id,
          procurementManager.id,
          accountant.id,
          warehouseManager.id,
        ],
      },
    },
  });

  await prisma.userRole.createMany({
    data: [
      // owner@germes.demo is OWNER-only (RBAC Phase 1.1) — previously
      // also carried ADMIN, which silently restored every operational
      // permission Phase 1 removed from OWNER via role union. See
      // scripts/sync-workspace-permissions.ts, which must be run against
      // a real database to actually apply this to an existing account —
      // this seed file alone never reaches production.
      { userId: owner.id, roleId: roleByCode.OWNER.id },
      { userId: admin.id, roleId: roleByCode.ADMIN.id },
      { userId: salesManager.id, roleId: roleByCode.SALES.id },
      { userId: salesManager2.id, roleId: roleByCode.SALES.id },
      { userId: salesManager3.id, roleId: roleByCode.SALES.id },
      { userId: procurementManager.id, roleId: roleByCode.PROCUREMENT.id },
      { userId: accountant.id, roleId: roleByCode.ACCOUNTING.id },
      { userId: warehouseManager.id, roleId: roleByCode.WAREHOUSE.id },
    ],
  });

  // --------------------------------------------------
  // Warehouses
  // --------------------------------------------------

  const warehouseKyiv = await prisma.warehouse.upsert({
    where: { code: "WH-KYIV" },
    update: {
      name: "Склад Київ",
      address: "Київ, Україна",
      isActive: true,
    },
    create: {
      code: "WH-KYIV",
      name: "Склад Київ",
      address: "Київ, Україна",
    },
  });

  const warehouseLviv = await prisma.warehouse.upsert({
    where: { code: "WH-LVIV" },
    update: {
      name: "Склад Львів",
      address: "Львів, Україна",
      isActive: true,
    },
    create: {
      code: "WH-LVIV",
      name: "Склад Львів",
      address: "Львів, Україна",
    },
  });

  // --------------------------------------------------
  // Products
  // --------------------------------------------------

  const products: { sku: string; name: string; category: string }[] = [
    // Готова продукція
    { sku: "POULTRY-001", name: "Жир курячий", category: "Готова продукція" },
    { sku: "POULTRY-002", name: "Курячий каркас", category: "Готова продукція" },
    { sku: "POULTRY-003", name: "ММО", category: "Готова продукція" },
    { sku: "POULTRY-004", name: "Печінка куряча імпорт", category: "Готова продукція" },
    { sku: "POULTRY-005", name: "Філе індиче", category: "Готова продукція" },
    { sku: "POULTRY-006", name: "Шия куряча", category: "Готова продукція" },

    // Свинина
    { sku: "PORK-001", name: "Баки (щоковинна) свин.", category: "Свинина" },
    { sku: "PORK-002", name: "Балик св.", category: "Свинина" },
    { sku: "PORK-003", name: "Вуха свинячі (імпорт)", category: "Свинина" },
    { sku: "PORK-004", name: "Грудинка свин.", category: "Свинина" },
    { sku: "PORK-005", name: "Діафрагма свинна імпорт", category: "Свинина" },
    { sku: "PORK-006", name: "Жир сирець свиний внутрішній", category: "Свинина" },
    { sku: "PORK-007", name: "Легені свині", category: "Свинина" },
    { sku: "PORK-008", name: "Легені свині пп", category: "Свинина" },
    { sku: "PORK-009", name: "М'ясо котлетне 70/30 імпорт", category: "Свинина" },
    { sku: "PORK-010", name: "М'ясо котлетне 80/20 імпорт", category: "Свинина" },
    { sku: "PORK-011", name: "М'ясо котлетне 90/10 імпорт", category: "Свинина" },
    { sku: "PORK-012", name: "Нирки свині", category: "Свинина" },
    { sku: "PORK-013", name: "Окорок свинячий імпорт", category: "Свинина" },
    { sku: "PORK-014", name: "Печінка свина", category: "Свинина" },
    { sku: "PORK-015", name: "Печінка свина промка", category: "Свинина" },
    { sku: "PORK-016", name: "Ребро св. імпорт", category: "Свинина" },
    { sku: "PORK-017", name: "Сало іберіка", category: "Свинина" },
    { sku: "PORK-018", name: "Сало хребтове", category: "Свинина" },
    { sku: "PORK-019", name: "Сало хребтове (імпортне)", category: "Свинина" },
    { sku: "PORK-020", name: "Свинина односортна", category: "Свинина" },
    { sku: "PORK-021", name: "Серце свиняче (імпорт)", category: "Свинина" },
    { sku: "PORK-022", name: "Шия свиняча", category: "Свинина" },
    { sku: "PORK-023", name: "Шия свиняча імпорт", category: "Свинина" },
    { sku: "PORK-024", name: "Шкіра свиняча", category: "Свинина" },
    { sku: "PORK-025", name: "Язик свиний (картон) імпорт", category: "Свинина" },
    { sku: "PORK-026", name: "Язик свиний імпорт", category: "Свинина" },

    // Яловичина
    { sku: "BEEF-001", name: "Жилка мембрана імпорт", category: "Яловичина" },
    { sku: "BEEF-002", name: "Жилка яловича", category: "Яловичина" },
    { sku: "BEEF-003", name: "Жилка яловича імпорт", category: "Яловичина" },
    { sku: "BEEF-004", name: "Жир яловичий внутрішній", category: "Яловичина" },
    { sku: "BEEF-005", name: "Жир яловичий кишечний", category: "Яловичина" },
    { sku: "BEEF-006", name: "Печінка яловича імпорт", category: "Яловичина" },
    { sku: "BEEF-007", name: "Серце яловиче", category: "Яловичина" },
    { sku: "BEEF-008", name: "Яловичина в блоках 1/г", category: "Яловичина" },
    { sku: "BEEF-009", name: "Яловичина в блоках 2/г", category: "Яловичина" },
    { sku: "BEEF-010", name: "Яловичина в блоках в/г", category: "Яловичина" },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {
        name: product.name,
        category: product.category,
        unit: "kg",
        isActive: true,
      },
      create: {
        sku: product.sku,
        name: product.name,
        category: product.category,
        unit: "kg",
      },
    });
  }

  // --------------------------------------------------
  // Customers
  // --------------------------------------------------

  // TEMPORARY: responsibleId below is a RANDOM ~even split (14/14/13)
  // across the three demo sales managers, with no selection logic.
  // Replace once the client provides the real "manager → customers"
  // structure. "Кінцевий споживач" (retail placeholder) is intentionally
  // excluded — it will become a separate record type later.
  const customers: { code: string; name: string; responsibleId: string }[] = [
    { code: "CUST-001", name: "24 РЕСТОРАНИ ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-002", name: "Агро Інвест ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-003", name: "Агрофірма Столична ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-004", name: "Алан ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-005", name: "АЛЬФА-ЕТЕКС ТОВ ТД", responsibleId: salesManager.id },
    { code: "CUST-006", name: "Амтек трейд ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-007", name: "Атлант М'ясний дім ТОВ", responsibleId: salesManager.id },
    { code: "CUST-008", name: "Бізнес міт продукт ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-009", name: "ВІДЖИ ПРОДАКШН ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-010", name: "ВІТА-ПРОДУКТ ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-011", name: "ВП СЛОБОЖАНСЬКИЙ ПРОДУКТ ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-012", name: "ГАРНА СТРАВА ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-013", name: "Глобинський М'ясокомбінат ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-014", name: "Голик ФОП", responsibleId: salesManager.id },
    { code: "CUST-015", name: "Грін Рей Торговий дім", responsibleId: salesManager.id },
    { code: "CUST-016", name: "ДНІПРОМЯСО ТРЕЙД ТОВ", responsibleId: salesManager.id },
    { code: "CUST-017", name: "ЕКОВТОРПРОМ ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-018", name: "Елікатний смак ТОВ", responsibleId: salesManager.id },
    { code: "CUST-019", name: "Житомирський м'ясокомбінат ТОВ", responsibleId: salesManager.id },
    { code: "CUST-020", name: "ЗМЖК Ювілейний ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-021", name: "Качура А. ФОП", responsibleId: salesManager.id },
    { code: "CUST-022", name: "Київський М'ясокомбінат ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-023", name: "Клебанський Олексій ФОП", responsibleId: salesManager.id },
    { code: "CUST-024", name: "Козацька Ферма ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-025", name: "Лакі Мгт ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-026", name: "Либідь Проект ТОВ", responsibleId: salesManager.id },
    { code: "CUST-027", name: "М'ясний МК ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-028", name: "М'ЯСОК КРАФТ ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-029", name: "Мітекспорт ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-030", name: "МХП КУЛІНАРНЕ ВИРОБНИЦТВО ФІЛІЯ ПАТ МХП", responsibleId: salesManager3.id },
    { code: "CUST-031", name: "МХП ПАТ", responsibleId: salesManager3.id },
    { code: "CUST-032", name: "МХП ПрАТ \"МХП\" Філія \"М'ясний мультикомплекс\"", responsibleId: salesManager.id },
    { code: "CUST-033", name: "Новак ФОП", responsibleId: salesManager3.id },
    { code: "CUST-034", name: "Нововолинський м'ясокомбінат ТОВ", responsibleId: salesManager.id },
    { code: "CUST-035", name: "Новожановський МК ТОВ", responsibleId: salesManager3.id },
    { code: "CUST-036", name: "Павлів Є.В. ФОП", responsibleId: salesManager3.id },
    { code: "CUST-037", name: "ПІК І К ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-038", name: "Прилуки-Агропереробка ВКП ТОВ", responsibleId: salesManager.id },
    { code: "CUST-039", name: "ПРОФУДС КР", responsibleId: salesManager.id },
    { code: "CUST-040", name: "Родинна ковбаска ТОВ", responsibleId: salesManager2.id },
    { code: "CUST-041", name: "Салтівський МК ТОВ", responsibleId: salesManager2.id },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: {
        name: customer.name,
        status: "ACTIVE",
        country: "Україна",
        responsibleId: customer.responsibleId,
        isActive: true,
      },
      create: {
        code: customer.code,
        name: customer.name,
        status: "ACTIVE",
        country: "Україна",
        responsibleId: customer.responsibleId,
      },
    });
  }

  // --------------------------------------------------
  // Suppliers
  // --------------------------------------------------

  const suppliers: { code: string; name: string; country?: string }[] = [
    { code: "SUP-001", name: "Baltic Meat Supply" },
    { code: "SUP-002", name: "Bernard SA" },
    { code: "SUP-003", name: "CARNIS INTERNATIONAL" },
    { code: "SUP-004", name: "DANISH CROWN", country: "Данія" },
    { code: "SUP-005", name: "ESS-FOOD A/S", country: "Данія" },
    { code: "SUP-006", name: "ETABLISSEMENTS" },
    { code: "SUP-007", name: "GLOBAL MEAT POLAND", country: "Польща" },
    { code: "SUP-008", name: "HAND-FOOD" },
    { code: "SUP-009", name: "HAP Foods Holland B.V.", country: "Нідерланди" },
    { code: "SUP-010", name: "Leomeat" },
    { code: "SUP-011", name: "Mediterranean" },
    { code: "SUP-012", name: "MULTI TRADE" },
    { code: "SUP-013", name: "Orlani Sp.z.o.o", country: "Польща" },
    { code: "SUP-014", name: "P.W.ARAD" },
    { code: "SUP-015", name: "PPM ECO-DAR" },
    { code: "SUP-016", name: "SEGEA LTD" },
    { code: "SUP-017", name: "SKORPOL" },
    { code: "SUP-018", name: "STERVAT" },
    { code: "SUP-019", name: "TECHNO GROUP" },
    { code: "SUP-020", name: "TIMTRANS" },
    { code: "SUP-021", name: "Tonnies Lebensmittel", country: "Німеччина" },
    { code: "SUP-022", name: "Wedlinka Group" },
    { code: "SUP-023", name: "Агроль ТОВ", country: "Україна" },
    { code: "SUP-024", name: "Асорті М" },
    { code: "SUP-025", name: "Атлант М'ясний дім ТОВ", country: "Україна" },
    { code: "SUP-026", name: "Бізнес міт продукт ТОВ", country: "Україна" },
    { code: "SUP-027", name: "Буковина Агро Трейд-2011 ТОВ", country: "Україна" },
    { code: "SUP-028", name: "Вавілон фуд ТОВ", country: "Україна" },
    { code: "SUP-029", name: "ВЕЛ МПТ ТОВ", country: "Україна" },
    { code: "SUP-030", name: "Вербівське ТОВ ВКП", country: "Україна" },
    { code: "SUP-031", name: "ВПТА-ПРОДУКТ ТОВ", country: "Україна" },
    { code: "SUP-032", name: "Деметра ПП", country: "Україна" },
    { code: "SUP-033", name: "ДНІПРОМЯСО ТРЕЙД ТОВ", country: "Україна" },
    { code: "SUP-034", name: "Дуб ФОП", country: "Україна" },
    { code: "SUP-035", name: "Едельвейс СФГ", country: "Україна" },
    { code: "SUP-036", name: "ЕЛІТ МПТ" },
    { code: "SUP-037", name: "Євро-Комерс ТОВ", country: "Україна" },
    { code: "SUP-038", name: "ЗЕВС" },
    { code: "SUP-039", name: "Козятинський МК ПрАТ", country: "Україна" },
    { code: "SUP-040", name: "Конотопм'ясо ТДВ", country: "Україна" },
    { code: "SUP-041", name: "М'ясо БЦ ТОВ", country: "Україна" },
    { code: "SUP-042", name: "Майстер М'яса ТОВ", country: "Україна" },
    { code: "SUP-043", name: "МАФІН ФОП", country: "Україна" },
    { code: "SUP-044", name: "МАЦЮК ФОП", country: "Україна" },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {
        name: supplier.name,
        country: supplier.country ?? null,
        status: "ACTIVE",
        isActive: true,
      },
      create: {
        code: supplier.code,
        name: supplier.name,
        country: supplier.country ?? null,
        status: "ACTIVE",
      },
    });
  }

  // --------------------------------------------------
  // Replace demo transactional data
  // --------------------------------------------------

  await prisma.receivable.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.stockMovement.deleteMany();

  console.log("Germes demo data seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
