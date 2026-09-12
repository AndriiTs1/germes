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
      { userId: owner.id, roleId: roleByCode.OWNER.id },
      { userId: owner.id, roleId: roleByCode.ADMIN.id },
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

  const chicken = await prisma.product.upsert({
    where: { sku: "CHK-FILLET" },
    update: {
      name: "Філе куряче заморожене",
      category: "Poultry",
      brand: "Germes Select",
      unit: "kg",
      isActive: true,
    },
    create: {
      sku: "CHK-FILLET",
      name: "Філе куряче заморожене",
      category: "Poultry",
      brand: "Germes Select",
    },
  });

  const pork = await prisma.product.upsert({
    where: { sku: "PORK-NECK" },
    update: {
      name: "Ошийок свинячий",
      category: "Pork",
      brand: "Germes Select",
      unit: "kg",
      isActive: true,
    },
    create: {
      sku: "PORK-NECK",
      name: "Ошийок свинячий",
      category: "Pork",
      brand: "Germes Select",
    },
  });

  const beef = await prisma.product.upsert({
    where: { sku: "BEEF-TRIM" },
    update: {
      name: "Яловичина Trim 80/20",
      category: "Beef",
      brand: "Germes Select",
      unit: "kg",
      isActive: true,
    },
    create: {
      sku: "BEEF-TRIM",
      name: "Яловичина Trim 80/20",
      category: "Beef",
      brand: "Germes Select",
    },
  });

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
  // Batches
  // --------------------------------------------------

  const batchChicken = await prisma.batch.upsert({
    where: {
      batchNumber_productId: {
        batchNumber: "PL-CHK-260901",
        productId: chicken.id,
      },
    },
    update: {
      receivedKg: 12000,
      status: "AVAILABLE",
      unitCost: 118.5,
    },
    create: {
      batchNumber: "PL-CHK-260901",
      productId: chicken.id,
      receivedKg: 12000,
      productionDate: new Date("2026-08-27"),
      expiryDate: new Date("2027-08-27"),
      manufacturer: "Baltic Meat Export",
      country: "Poland",
      temperature: -18,
      unitCost: 118.5,
      status: "AVAILABLE",
    },
  });

  const batchPork = await prisma.batch.upsert({
    where: {
      batchNumber_productId: {
        batchNumber: "RO-PRK-260902",
        productId: pork.id,
      },
    },
    update: {
      receivedKg: 8500,
      status: "AVAILABLE",
      unitCost: 142,
    },
    create: {
      batchNumber: "RO-PRK-260902",
      productId: pork.id,
      receivedKg: 8500,
      productionDate: new Date("2026-08-29"),
      expiryDate: new Date("2027-02-28"),
      manufacturer: "Danube Foods",
      country: "Romania",
      temperature: -18,
      unitCost: 142,
      status: "AVAILABLE",
    },
  });

  const batchBeef = await prisma.batch.upsert({
    where: {
      batchNumber_productId: {
        batchNumber: "PL-BEEF-260903",
        productId: beef.id,
      },
    },
    update: {
      receivedKg: 6200,
      status: "AVAILABLE",
      unitCost: 184,
    },
    create: {
      batchNumber: "PL-BEEF-260903",
      productId: beef.id,
      receivedKg: 6200,
      productionDate: new Date("2026-08-30"),
      expiryDate: new Date("2027-06-30"),
      manufacturer: "Baltic Meat Export",
      country: "Poland",
      temperature: -18,
      unitCost: 184,
      status: "AVAILABLE",
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
  // Stock movements
  // --------------------------------------------------

  await prisma.stockMovement.createMany({
    data: [
      {
        type: "RECEIPT",
        batchId: batchChicken.id,
        toWarehouseId: warehouseKyiv.id,
        quantityKg: 12000,
        reference: "GRN-260901",
      },
      {
        type: "TRANSFER",
        batchId: batchChicken.id,
        fromWarehouseId: warehouseKyiv.id,
        toWarehouseId: warehouseLviv.id,
        quantityKg: 2500,
        reference: "TR-260905",
      },
      {
        type: "RECEIPT",
        batchId: batchPork.id,
        toWarehouseId: warehouseKyiv.id,
        quantityKg: 8500,
        reference: "GRN-260902",
      },
      {
        type: "RECEIPT",
        batchId: batchBeef.id,
        toWarehouseId: warehouseLviv.id,
        quantityKg: 6200,
        reference: "GRN-260903",
      },
      {
        type: "WRITE_OFF",
        batchId: batchPork.id,
        fromWarehouseId: warehouseKyiv.id,
        quantityKg: 120,
        reference: "WO-260908",
        notes: "Quality adjustment",
      },
    ],
  });

  // --------------------------------------------------
  // Sales orders
  // --------------------------------------------------

  const order1 = await prisma.salesOrder.create({
    data: {
      orderNumber: "SO-2026-001",
      customerId: customer1.id,
      responsibleId: salesManager.id,
      status: "PROCESSING",
      orderDate: new Date("2026-09-09T09:00:00Z"),
      requestedDate: new Date("2026-09-12T08:00:00Z"),
      currency: "UAH",
      notes: "Priority delivery",
    },
  });

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

  await prisma.salesOrderItem.createMany({
    data: [
      {
        salesOrderId: order1.id,
        productId: chicken.id,
        quantityKg: 1800,
        pricePerKg: 151,
      },
      {
        salesOrderId: order1.id,
        productId: beef.id,
        quantityKg: 600,
        pricePerKg: 228,
      },
      {
        salesOrderId: order2.id,
        productId: pork.id,
        quantityKg: 1500,
        pricePerKg: 181,
      },
      {
        salesOrderId: order3.id,
        productId: chicken.id,
        quantityKg: 2200,
        pricePerKg: 149,
      },
    ],
  });

  // --------------------------------------------------
  // Reservations
  // --------------------------------------------------

  await prisma.stockReservation.createMany({
    data: [
      {
        productId: chicken.id,
        batchId: batchChicken.id,
        salesOrderId: order1.id,
        quantityKg: 1800,
        status: "ACTIVE",
        expiresAt: new Date("2026-09-12T18:00:00Z"),
        reference: "RES-SO-001-1",
      },
      {
        productId: beef.id,
        batchId: batchBeef.id,
        salesOrderId: order1.id,
        quantityKg: 600,
        status: "ACTIVE",
        expiresAt: new Date("2026-09-12T18:00:00Z"),
        reference: "RES-SO-001-2",
      },
      {
        productId: pork.id,
        batchId: batchPork.id,
        salesOrderId: order2.id,
        quantityKg: 1500,
        status: "ACTIVE",
        expiresAt: new Date("2026-09-13T18:00:00Z"),
        reference: "RES-SO-002-1",
      },
    ],
  });

  // --------------------------------------------------
  // Finance
  // --------------------------------------------------

  await prisma.receivable.createMany({
    data: [
      {
        customerId: customer1.id,
        salesOrderId: order1.id,
        amount: 408600,
        paidAmount: 100000,
        currency: "UAH",
        dueDate: new Date("2026-09-18"),
        status: "PARTIALLY_PAID",
        reference: "INV-260901",
      },
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
