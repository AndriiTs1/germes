/**
 * Master catalog referenced by the DEMO 100M dataset — copied verbatim from
 * prisma/seed.ts (customers, suppliers, products, warehouses, users). The
 * generator never creates master data; it only references it by code/SKU.
 * tests/demo-100m/master-data.test.ts parses prisma/seed.ts and fails if
 * this copy ever drifts from it. Real database ids are resolved only by a
 * future apply phase, never here.
 *
 * Users are referenced by a stable logical key (never an email or id).
 */

export type SalesManagerKey = "sales" | "sales2" | "sales3";

/** Demo user keys by role; `sales*` map to prisma/seed.ts salesManager / salesManager2 / salesManager3. */
export const USER_KEYS = {
  sales: ["sales", "sales2", "sales3"] as SalesManagerKey[],
  warehouse: ["warehouse", "warehouse2"],
  accounting: "accounting",
  procurement: "procurement",
} as const;

/**
 * Demo accounts the dataset's users resolve to (by email, as created by
 * prisma/seed.ts) and the role each must hold. Used only by the apply phase
 * to find the real user ids; never printed.
 */
export const USER_ACCOUNTS = {
  sales: { email: "sales@germes.demo", role: "SALES" },
  sales2: { email: "sales2@germes.demo", role: "SALES" },
  sales3: { email: "sales3@germes.demo", role: "SALES" },
  warehouse: { email: "warehouse@germes.demo", role: "WAREHOUSE" },
  warehouse2: { email: "warehouse2@germes.demo", role: "WAREHOUSE" },
  accounting: { email: "accounting@germes.demo", role: "ACCOUNTING" },
  procurement: { email: "procurement@germes.demo", role: "PROCUREMENT" },
} as const;

export type MasterCustomer = { code: string; name: string; responsible: SalesManagerKey };
export type MasterSupplier = { code: string; name: string; country: string | null };
export type MasterProduct = { sku: string; name: string; category: string };

export const WAREHOUSE_CODES = ["WH-KYIV", "WH-LUTSK"] as const;
export type WarehouseCode = (typeof WAREHOUSE_CODES)[number];

export const CUSTOMERS: MasterCustomer[] = [
  { code: "CUST-001", name: "24 РЕСТОРАНИ ТОВ", responsible: "sales2" },
  { code: "CUST-002", name: "Агро Інвест ТОВ", responsible: "sales3" },
  { code: "CUST-003", name: "Агрофірма Столична ТОВ", responsible: "sales2" },
  { code: "CUST-004", name: "Алан ТОВ", responsible: "sales3" },
  { code: "CUST-005", name: "АЛЬФА-ЕТЕКС ТОВ ТД", responsible: "sales" },
  { code: "CUST-006", name: "Амтек трейд ТОВ", responsible: "sales3" },
  { code: "CUST-007", name: "Атлант М'ясний дім ТОВ", responsible: "sales" },
  { code: "CUST-008", name: "Бізнес міт продукт ТОВ", responsible: "sales3" },
  { code: "CUST-009", name: "ВІДЖИ ПРОДАКШН ТОВ", responsible: "sales2" },
  { code: "CUST-010", name: "ВІТА-ПРОДУКТ ТОВ", responsible: "sales2" },
  { code: "CUST-011", name: "ВП СЛОБОЖАНСЬКИЙ ПРОДУКТ ТОВ", responsible: "sales2" },
  { code: "CUST-012", name: "ГАРНА СТРАВА ТОВ", responsible: "sales2" },
  { code: "CUST-013", name: "Глобинський М'ясокомбінат ТОВ", responsible: "sales2" },
  { code: "CUST-014", name: "Голик ФОП", responsible: "sales" },
  { code: "CUST-015", name: "Грін Рей Торговий дім", responsible: "sales" },
  { code: "CUST-016", name: "ДНІПРОМЯСО ТРЕЙД ТОВ", responsible: "sales" },
  { code: "CUST-017", name: "ЕКОВТОРПРОМ ТОВ", responsible: "sales2" },
  { code: "CUST-018", name: "Елікатний смак ТОВ", responsible: "sales" },
  { code: "CUST-019", name: "Житомирський м'ясокомбінат ТОВ", responsible: "sales" },
  { code: "CUST-020", name: "ЗМЖК Ювілейний ТОВ", responsible: "sales2" },
  { code: "CUST-021", name: "Качура А. ФОП", responsible: "sales" },
  { code: "CUST-022", name: "Київський М'ясокомбінат ТОВ", responsible: "sales3" },
  { code: "CUST-023", name: "Клебанський Олексій ФОП", responsible: "sales" },
  { code: "CUST-024", name: "Козацька Ферма ТОВ", responsible: "sales2" },
  { code: "CUST-025", name: "Лакі Мгт ТОВ", responsible: "sales3" },
  { code: "CUST-026", name: "Либідь Проект ТОВ", responsible: "sales" },
  { code: "CUST-027", name: "М'ясний МК ТОВ", responsible: "sales2" },
  { code: "CUST-028", name: "М'ЯСОК КРАФТ ТОВ", responsible: "sales3" },
  { code: "CUST-029", name: "Мітекспорт ТОВ", responsible: "sales3" },
  { code: "CUST-030", name: "МХП КУЛІНАРНЕ ВИРОБНИЦТВО ФІЛІЯ ПАТ МХП", responsible: "sales3" },
  { code: "CUST-031", name: "МХП ПАТ", responsible: "sales3" },
  { code: "CUST-032", name: "МХП ПрАТ \"МХП\" Філія \"М'ясний мультикомплекс\"", responsible: "sales" },
  { code: "CUST-033", name: "Новак ФОП", responsible: "sales3" },
  { code: "CUST-034", name: "Нововолинський м'ясокомбінат ТОВ", responsible: "sales" },
  { code: "CUST-035", name: "Новожановський МК ТОВ", responsible: "sales3" },
  { code: "CUST-036", name: "Павлів Є.В. ФОП", responsible: "sales3" },
  { code: "CUST-037", name: "ПІК І К ТОВ", responsible: "sales2" },
  { code: "CUST-038", name: "Прилуки-Агропереробка ВКП ТОВ", responsible: "sales" },
  { code: "CUST-039", name: "ПРОФУДС КР", responsible: "sales" },
  { code: "CUST-040", name: "Родинна ковбаска ТОВ", responsible: "sales2" },
  { code: "CUST-041", name: "Салтівський МК ТОВ", responsible: "sales2" },
];

export const SUPPLIERS: MasterSupplier[] = [
  { code: "SUP-001", name: "Baltic Meat Supply", country: null },
  { code: "SUP-002", name: "Bernard SA", country: null },
  { code: "SUP-003", name: "CARNIS INTERNATIONAL", country: null },
  { code: "SUP-004", name: "DANISH CROWN", country: "Данія" },
  { code: "SUP-005", name: "ESS-FOOD A/S", country: "Данія" },
  { code: "SUP-006", name: "ETABLISSEMENTS", country: null },
  { code: "SUP-007", name: "GLOBAL MEAT POLAND", country: "Польща" },
  { code: "SUP-008", name: "HAND-FOOD", country: null },
  { code: "SUP-009", name: "HAP Foods Holland B.V.", country: "Нідерланди" },
  { code: "SUP-010", name: "Leomeat", country: null },
  { code: "SUP-011", name: "Mediterranean", country: null },
  { code: "SUP-012", name: "MULTI TRADE", country: null },
  { code: "SUP-013", name: "Orlani Sp.z.o.o", country: "Польща" },
  { code: "SUP-014", name: "P.W.ARAD", country: null },
  { code: "SUP-015", name: "PPM ECO-DAR", country: null },
  { code: "SUP-016", name: "SEGEA LTD", country: null },
  { code: "SUP-017", name: "SKORPOL", country: null },
  { code: "SUP-018", name: "STERVAT", country: null },
  { code: "SUP-019", name: "TECHNO GROUP", country: null },
  { code: "SUP-020", name: "TIMTRANS", country: null },
  { code: "SUP-021", name: "Tonnies Lebensmittel", country: "Німеччина" },
  { code: "SUP-022", name: "Wedlinka Group", country: null },
  { code: "SUP-023", name: "Агроль ТОВ", country: "Україна" },
  { code: "SUP-024", name: "Асорті М", country: null },
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
  { code: "SUP-036", name: "ЕЛІТ МПТ", country: null },
  { code: "SUP-037", name: "Євро-Комерс ТОВ", country: "Україна" },
  { code: "SUP-038", name: "ЗЕВС", country: null },
  { code: "SUP-039", name: "Козятинський МК ПрАТ", country: "Україна" },
  { code: "SUP-040", name: "Конотопм'ясо ТДВ", country: "Україна" },
  { code: "SUP-041", name: "М'ясо БЦ ТОВ", country: "Україна" },
  { code: "SUP-042", name: "Майстер М'яса ТОВ", country: "Україна" },
  { code: "SUP-043", name: "МАФІН ФОП", country: "Україна" },
  { code: "SUP-044", name: "МАЦЮК ФОП", country: "Україна" },
];

export const PRODUCTS: MasterProduct[] = [
  { sku: "POULTRY-001", name: "Жир курячий", category: "Готова продукція" },
  { sku: "POULTRY-002", name: "Курячий каркас", category: "Готова продукція" },
  { sku: "POULTRY-003", name: "ММО", category: "Готова продукція" },
  { sku: "POULTRY-004", name: "Печінка куряча імпорт", category: "Готова продукція" },
  { sku: "POULTRY-005", name: "Філе індиче", category: "Готова продукція" },
  { sku: "POULTRY-006", name: "Шия куряча", category: "Готова продукція" },
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
