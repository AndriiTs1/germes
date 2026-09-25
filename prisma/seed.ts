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

  const customer1 = await prisma.customer.upsert({
    where: { code: "CUST-001" },
    update: {
      name: "М'ясний Дім",
      legalName: "ТОВ М'ясний Дім",
      status: "ACTIVE",
      country: "Ukraine",
      creditLimit: 1500000,
      paymentTermDays: 14,
      responsibleId: salesManager.id,
    },
    create: {
      code: "CUST-001",
      name: "М'ясний Дім",
      legalName: "ТОВ М'ясний Дім",
      status: "ACTIVE",
      contactPerson: "Віталій Кравченко",
      phone: "+380501110011",
      email: "office@meathouse.demo",
      country: "Ukraine",
      creditLimit: 1500000,
      paymentTermDays: 14,
      responsibleId: salesManager.id,
      lastContactAt: new Date("2026-09-10T09:30:00Z"),
      lastPurchaseAt: new Date("2026-09-09T12:00:00Z"),
      nextActionAt: new Date("2026-09-15T09:00:00Z"),
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { code: "CUST-002" },
    update: {
      name: "Fresh Market",
      status: "ACTIVE",
      country: "Ukraine",
      creditLimit: 900000,
      paymentTermDays: 10,
      responsibleId: salesManager.id,
    },
    create: {
      code: "CUST-002",
      name: "Fresh Market",
      legalName: "ТОВ Fresh Market",
      status: "ACTIVE",
      contactPerson: "Олег Марченко",
      phone: "+380502220022",
      email: "buy@freshmarket.demo",
      country: "Ukraine",
      creditLimit: 900000,
      paymentTermDays: 10,
      responsibleId: salesManager.id,
      lastContactAt: new Date("2026-09-08T10:00:00Z"),
      lastPurchaseAt: new Date("2026-09-07T12:00:00Z"),
      nextActionAt: new Date("2026-09-14T10:00:00Z"),
    },
  });

  await prisma.customer.upsert({
    where: { code: "CUST-003" },
    update: {
      name: "Ресторан Груп",
      status: "POTENTIAL",
      country: "Ukraine",
      responsibleId: salesManager.id,
    },
    create: {
      code: "CUST-003",
      name: "Ресторан Груп",
      status: "POTENTIAL",
      contactPerson: "Анна Левченко",
      phone: "+380503330033",
      country: "Ukraine",
      responsibleId: salesManager.id,
      lastContactAt: new Date("2026-08-15T10:00:00Z"),
      nextActionAt: new Date("2026-09-12T10:00:00Z"),
    },
  });

  // --------------------------------------------------
  // Suppliers
  // --------------------------------------------------

  const supplier1 = await prisma.supplier.upsert({
    where: { code: "SUP-001" },
    update: {
      name: "Baltic Meat Export",
      status: "ACTIVE",
      country: "Poland",
      paymentTermDays: 21,
      rating: 5,
      responsibleId: procurementManager.id,
    },
    create: {
      code: "SUP-001",
      name: "Baltic Meat Export",
      legalName: "Baltic Meat Export Sp. z o.o.",
      status: "ACTIVE",
      contactPerson: "Piotr Nowak",
      email: "sales@balticmeat.demo",
      country: "Poland",
      paymentTermDays: 21,
      rating: 5,
      responsibleId: procurementManager.id,
      lastContactAt: new Date("2026-09-10T08:00:00Z"),
      nextActionAt: new Date("2026-09-16T08:00:00Z"),
    },
  });

  const supplier2 = await prisma.supplier.upsert({
    where: { code: "SUP-002" },
    update: {
      name: "Danube Foods",
      status: "ACTIVE",
      country: "Romania",
      paymentTermDays: 14,
      rating: 4,
      responsibleId: procurementManager.id,
    },
    create: {
      code: "SUP-002",
      name: "Danube Foods",
      legalName: "Danube Foods SRL",
      status: "ACTIVE",
      contactPerson: "Mihai Popescu",
      email: "export@danubefoods.demo",
      country: "Romania",
      paymentTermDays: 14,
      rating: 4,
      responsibleId: procurementManager.id,
      lastContactAt: new Date("2026-09-09T08:00:00Z"),
      nextActionAt: new Date("2026-09-13T08:00:00Z"),
    },
  });

  // --------------------------------------------------
  // Replace demo transactional data
  // --------------------------------------------------

  await prisma.receivable.deleteMany();
  await prisma.payable.deleteMany();
  await prisma.stockReservation.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.stockMovement.deleteMany();

  // --------------------------------------------------
  // Sales orders
  // --------------------------------------------------

  const order2 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-002",
      customerId: customer2.id,
      responsibleId: salesManager.id,
      status: "CONFIRMED",
      orderDate: new Date("2026-09-10T10:00:00Z"),
      requestedDate: new Date("2026-09-13T08:00:00Z"),
      currency: "UAH",
    },
  });

  const order3 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-003",
      customerId: customer1.id,
      responsibleId: salesManager.id,
      status: "COMPLETED",
      orderDate: new Date("2026-09-04T10:00:00Z"),
      shippedAt: new Date("2026-09-06T12:00:00Z"),
      currency: "UAH",
    },
  });


  const order4 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-004",
      customerId: customer1.id,
      responsibleId: salesManager.id,
      status: "COMPLETED",
      orderDate: new Date("2026-06-15T10:00:00Z"),
      currency: "UAH",
    },
  });

  const order5 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-005",
      customerId: customer2.id,
      responsibleId: salesManager.id,
      status: "COMPLETED",
      orderDate: new Date("2026-07-12T10:00:00Z"),
      currency: "UAH",
    },
  });

  const order6 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-006",
      customerId: customer1.id,
      responsibleId: salesManager.id,
      status: "COMPLETED",
      orderDate: new Date("2026-08-20T10:00:00Z"),
      currency: "UAH",
    },
  });

  // --------------------------------------------------
  // Finance
  // --------------------------------------------------

  await prisma.receivable.createMany({
    data: [
      {
        customerId: customer2.id,
        salesOrderId: order2.id,
        amount: 271500,
        paidAmount: 0,
        currency: "UAH",
        dueDate: new Date("2026-09-20"),
        status: "OPEN",
        reference: "INV-260902",
      },
      {
        customerId: customer1.id,
        salesOrderId: order3.id,
        amount: 327800,
        paidAmount: 180000,
        currency: "UAH",
        dueDate: new Date("2026-09-09"),
        status: "OVERDUE",
        reference: "INV-260870",
      },
    ],
  });

  await prisma.payable.createMany({
    data: [
      {
        supplierId: supplier1.id,
        amount: 1422000,
        paidAmount: 900000,
        currency: "UAH",
        dueDate: new Date("2026-09-17"),
        status: "PARTIALLY_PAID",
        reference: "SUP-INV-PL-901",
      },
      {
        supplierId: supplier2.id,
        amount: 1207000,
        paidAmount: 1207000,
        currency: "UAH",
        dueDate: new Date("2026-09-10"),
        status: "PAID",
        reference: "SUP-INV-RO-902",
      },
      {
        supplierId: supplier1.id,
        amount: 640000,
        paidAmount: 0,
        currency: "UAH",
        dueDate: new Date("2026-09-08"),
        status: "OVERDUE",
        reference: "SUP-INV-PL-880",
      },
    ],
  });

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
