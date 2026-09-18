/**
 * Canonical English dictionary — this object's inferred shape (via `typeof`,
 * deliberately without `as const`, so every leaf widens to `string`) IS the
 * Dictionary type every other locale must satisfy. Add a key here first;
 * uk.ts/ru.ts then fail to compile until they provide it too.
 *
 * Namespaced by UI area, not by literal English wording, so a key never
 * needs to change just because its English copy does. Covers only the
 * system UI that currently exists (Global Shell, Login, Settings, Sales,
 * Orders, Customers, Warehouse, shared status/pagination/table labels).
 * Business data (customer/product/supplier names, order numbers, notes,
 * uploaded documents) is never a dictionary key — it always renders as
 * stored, unaffected by locale.
 */
export const en = {
  common: {
    cancel: "Cancel",
    viewAll: "View all",
    kgUnit: "kg",
    batchLabel: "Batch:",
    warehouseLabel: "Warehouse:",
    notLinked: "Not linked",
    expiresLabel: "Expires",
    reservationsEmptyTitle: "No reservations yet",
    reservationsEmptyDescription: "Reserved stock for this order will appear here.",
    noDueDate: "No due date",
    dueLabel: "Due",
    table: {
      order: "Order",
      customer: "Customer",
      status: "Status",
      date: "Date",
      quantity: "Quantity",
      total: "Total",
      product: "Product",
      sku: "SKU",
      requested: "Requested",
      fulfillment: "Fulfillment",
    },
  },

  nav: {
    sections: {
      overview: "Overview",
      workspace: "Workspace",
      sell: "Sell",
      account: "Account",
    },
    commandCenter: "Command Center",
    sales: "Sales",
    warehouse: "Warehouse",
    orders: "Orders",
    customers: "Customers",
    settings: "Settings",
  },

  header: {
    searchPlaceholderShort: "Search...",
    searchPlaceholderFull: "Search customers, orders, products...",
    searchAriaLabel: "Search",
    notificationsAriaLabel: "Notifications",
    openNavigationAriaLabel: "Open navigation",
    closeNavigationAriaLabel: "Close navigation",
    navigationLabel: "Navigation",
  },

  noWorkspace: {
    title: "No workspace available yet",
    description:
      "Your account doesn't have access to a workspace yet. Contact your administrator if you believe this is a mistake.",
  },

  auth: {
    signInTitle: "Sign in to Germes",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    genericError: "Unable to sign in. Please check your credentials and try again.",
  },

  settings: {
    title: "Settings",
    subtitle: "Manage your personal Germes preferences and account.",
    general: {
      title: "General",
      language: "Language",
    },
    languages: {
      en: "English",
      uk: "Українська",
      ru: "Русский",
    },
    language: {
      current: "Current",
    },
    more: {
      title: "More settings",
      profile: "Profile",
      notifications: "Notifications",
      security: "Security",
    },
    comingSoon: "Coming soon",
    account: {
      title: "Account",
      signOutDescription: "Sign out of your Germes account on this device.",
      signOut: "Sign out",
    },
  },

  pagination: {
    previous: "Previous",
    next: "Next",
    page: "Page",
    of: "of",
  },

  status: {
    order: {
      DRAFT: "Draft",
      CONFIRMED: "Confirmed",
      PROCESSING: "Processing",
      READY: "Ready",
      SHIPPED: "Shipped",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
    customer: {
      ACTIVE: "Active",
      POTENTIAL: "Potential",
      INACTIVE: "Inactive",
      BLOCKED: "Blocked",
    },
    reservation: {
      ACTIVE: "Active",
      RELEASED: "Released",
      EXPIRED: "Expired",
      CONSUMED: "Consumed",
    },
  },

  sales: {
    workspace: {
      title: "Sales Workspace",
      subtitle: "Your customers, orders and actions",
      kpi: {
        needsAttention: "Needs Attention",
        activeOrders: "Active Orders",
        overdueAr: "Overdue AR",
        reserved: "Reserved",
        currenciesUnit: "currencies",
        reservationsNeedReview: "Some reservations need review",
      },
      activeOrdersEmpty: "No active orders right now",
    },
    needsAttention: {
      title: "Needs Attention",
      empty: "All caught up — no customers need attention",
      reasons: {
        nextActionOverdue: "Next action overdue",
        staleContact: "No contact in 21+ days",
        stalePurchase: "No purchase in 45+ days",
      },
    },
    availableStock: {
      title: "Available Stock",
      empty: "No products yet",
      reservedLabel: "Reserved",
    },
    reservationsCard: {
      title: "Reservations",
      empty: "No reservations need attention",
      expiredLabel: "Expired",
      expiringSoonLabel: "Expiring soon",
      activeLabel: "Active",
    },
    receivablesCard: {
      title: "Receivables",
      empty: "No outstanding receivables",
      overdueLabel: "Overdue",
      dueSoonLabel: "Due soon",
    },
  },

  orders: {
    title: "Orders",
    subtitle: "Manage and track your sales orders",
    newOrder: "+ New Order",
    filters: {
      all: "All",
      active: "Active",
      completed: "Completed",
      cancelled: "Cancelled",
      ariaLabel: "Filter orders by status",
    },
    search: {
      placeholder: "Search order # or customer...",
      ariaLabel: "Search orders by order number or customer",
    },
    emptyDefault: "No orders yet",
    emptyFiltered: "No orders match these filters",
    paginationAriaLabel: "Orders pagination",
  },

  orderDetail: {
    backToOrders: "Back to Orders",
    overview: {
      title: "Overview",
      customer: "Customer",
      orderDate: "Order date",
      requestedDelivery: "Requested delivery",
      shipped: "Shipped",
      totalQuantity: "Total quantity",
      totalValue: "Total value",
    },
    items: {
      title: "Items",
      pricePerKg: "Price / kg",
      lineTotal: "Line total",
    },
    notes: {
      title: "Notes",
    },
    receivable: {
      title: "Receivable",
      total: "Total",
      paid: "Paid",
      outstanding: "Outstanding",
      countSuffix: "receivables",
    },
    reservations: {
      title: "Reservations",
      ordered: "Ordered",
      selectBatchWarehouse: "Select batch / warehouse",
      batchAndWarehouseFor: "Batch and warehouse for",
      quantityPlaceholder: "Quantity kg",
      reserve: "Reserve",
      reserving: "Reserving...",
      noAvailableStock: "No available batch / warehouse stock for this item.",
      release: "Release",
      releasing: "Releasing...",
    },
    actions: {
      edit: "Edit",
      confirm: "Confirm",
      confirming: "Confirming…",
      cancelOrder: "Cancel",
      cancelDialog: {
        title: "Cancel order?",
        description:
          "This will cancel the order and release all active stock reservations. This action cannot be undone.",
        keepOrder: "Keep order",
        confirmCancel: "Cancel order",
        cancelling: "Cancelling…",
      },
    },
  },

  orderForm: {
    newTitle: "New Order",
    newSubtitle: "Create a sales order for a customer",
    editTitle: "Edit Order",
    backToOrders: "Back to Orders",
    backToOrder: "Back to Order",
    customer: "Customer",
    selectCustomer: "Select a customer",
    requestedDate: "Requested date",
    selectDate: "Select a date",
    currency: "Currency",
    notes: "Notes",
    notesPlaceholder: "Optional",
    items: "Items",
    addItem: "Add item",
    product: "Product",
    selectProduct: "Select a product",
    quantityPlaceholder: "Qty kg",
    pricePlaceholder: "Price / kg",
    lineTotalMobileLabel: "Line total",
    removeItemAriaLabel: "Remove item",
    orderTotal: "Order total",
    createOrder: "Create Order",
    creating: "Creating…",
    saveChanges: "Save Changes",
    saving: "Saving…",
    cancel: "Cancel",
    previousMonth: "Previous month",
    nextMonth: "Next month",
  },

  reservationActions: {
    selectBatchAndWarehouse: "Select a batch and warehouse.",
    invalidQuantity: "Enter a valid quantity with up to 3 decimals.",
    checkDetails: "Check the reservation details.",
    noPermissionCreate: "You do not have permission to create reservations.",
    noPermissionRelease: "You do not have permission to release reservations.",
    createFailed: "Could not create the reservation.",
    releaseFailed: "Could not release the reservation.",
    createSuccess: "Stock reserved successfully.",
    releaseSuccess: "Reservation released.",
    updateOrderFailed: "Could not update the order. Please try again.",
  },

  orderActions: {
    createGenericError: "Could not create the order. Please try again.",
    saveGenericError: "Could not save changes. Please try again.",
    orderNotEditable: "This order can no longer be edited.",
    staleEdit: "This order was changed elsewhere. Reload the page and try again.",
    customerUnavailable: "Selected customer is unavailable.",
    productUnavailable: "One or more selected products are unavailable.",
  },

  customers: {
    title: "Customers",
    subtitle: "Manage your customer relationships",
    filters: {
      all: "All",
      active: "Active",
      potential: "Potential",
      inactive: "Inactive",
      blocked: "Blocked",
      ariaLabel: "Filter customers by status",
    },
    search: {
      placeholder: "Search customers...",
      ariaLabel: "Search customers by name, code, phone, or email",
    },
    table: {
      lastPurchase: "Last purchase",
      receivable: "Receivable",
      overdue: "Overdue",
      nextAction: "Next action",
    },
    activeOrders: {
      one: "{count} active order",
      few: "{count} active orders",
      many: "{count} active orders",
      other: "{count} active orders",
    },
    emptyDefault: "No customers yet",
    emptyFiltered: "No customers match these filters",
    paginationAriaLabel: "Customers pagination",
  },

  customerDetail: {
    backToCustomers: "Back to Customers",
    newOrder: "New Order",
    overview: {
      title: "Overview",
      contactPerson: "Contact person",
      phone: "Phone",
      email: "Email",
      legalName: "Legal name",
      taxId: "Tax ID",
      country: "Country",
      address: "Address",
      paymentTerms: "Payment terms",
      paymentTermsDays: {
        one: "{count} day",
        few: "{count} days",
        many: "{count} days",
        other: "{count} days",
      },
      creditLimit: "Credit limit",
      lastContact: "Last contact",
      lastPurchase: "Last purchase",
      nextAction: "Next action",
    },
    recentOrders: {
      title: "Recent Orders",
      empty: "No orders yet",
    },
    receivables: {
      title: "Receivables",
      empty: "No outstanding receivables",
      outstanding: "Outstanding",
      overdue: "Overdue",
    },
    notes: {
      title: "Notes",
    },
  },

  warehouse: {
    workspace: {
      title: "Warehouse Workspace",
      subtitle: "Fulfillment queue and warehouse operations",
      kpi: {
        ready: "Ready",
        processing: "Processing",
        confirmed: "Confirmed",
        fullyReserved: "Fully Reserved",
      },
      fulfillmentQueueTitle: "Fulfillment Queue",
    },
    queue: {
      fullyReserved: "Fully reserved",
      itemsReserved: "items reserved",
      empty: "No orders awaiting warehouse fulfillment",
      noRequestedDate: "No requested date",
    },
    orderDetail: {
      backToWarehouse: "Back to Warehouse",
      overview: {
        title: "Overview",
        customer: "Customer",
        customerCode: "Customer code",
        orderDate: "Order date",
        requestedDelivery: "Requested delivery",
        responsible: "Responsible",
        shipped: "Shipped",
      },
      items: {
        title: "Items",
        ordered: "Ordered",
        reserved: "Reserved",
        shipped: "Shipped",
        fullyReserved: "Fully reserved",
        notFullyReserved: "Not fully reserved",
        mobileShippedSuffix: "shipped",
        mobileReservedSuffix: "reserved",
      },
      reservations: {
        title: "Reservations",
        elapsedNote: "Elapsed — no longer counted as usable fulfillment",
      },
      actions: {
        startProcessing: "Start processing",
        starting: "Starting…",
        markReady: "Mark ready",
        markingReady: "Marking ready…",
        shipOrder: "Ship order",
        shipping: "Shipping…",
        confirmShipmentTitle: "Confirm shipment",
        confirmShipmentDescription:
          "This will record the physical stock shipment and consume the active reservations for this order.",
        confirmShipmentButton: "Confirm shipment",
        cancel: "Cancel",
        startProcessingFailed: "Could not start order processing.",
        startProcessingSuccess: "Order processing started.",
        markReadyFailed: "Could not mark the order ready.",
        markReadySuccess: "Order marked ready.",
        shipFailed: "Could not ship the order.",
        shipSuccess: "Order shipped successfully.",
      },
    },
  },

  commandCenter: {
    title: "Command Center",
    periodThisMonth: "This month",
    kpi: {
      cashBanks: "Cash & Banks",
      receivables: "Receivables",
      overdueAr: "Overdue AR",
      payables: "Payables",
      inventoryValue: "Inventory Value",
      grossMargin: "Gross Margin",
      comparisonLabel: "vs last month",
    },
    salesPerformance: {
      title: "Sales Performance",
      viewReportAriaLabel: "View sales report",
      summary: {
        monthlySales: "Monthly sales",
        through: "through",
        trendingUp: "trending up",
        highestAt: "highest at",
      },
    },
    cashFlow: {
      title: "Cash Flow",
      netForLabel: "Net for",
      trendAriaLabel: "Cash flow trend over recent weeks, trending positive",
    },
    inventoryStatus: {
      title: "Inventory Status",
      unitsInStock: "kg / units in stock",
      breakdownAriaLabel: "Inventory breakdown:",
      segments: {
        inStock: "In stock",
        reserved: "Reserved",
        inTransit: "In transit",
        lowStock: "Low stock",
      },
    },
    procurementNeeds: {
      title: "Procurement Needs",
      itemsToReorder: "Items to reorder",
      stockLabel: "Stock:",
      critical: "Critical",
      warning: "Warning",
    },
    needsAttention: {
      title: "Needs Attention",
      overdueCustomerPayments: "Overdue customer payments",
      supplierInvoiceAwaitingApproval: "Supplier invoice awaiting approval",
      lowStockPrefix: "Low stock:",
      supplierPaymentDueTomorrow: "Supplier payment due tomorrow",
      ordersAwaitingShipment: "Orders awaiting shipment",
    },
    recentOrders: {
      title: "Recent Orders",
      todayPrefix: "Today,",
    },
    paymentCalendar: {
      title: "Payment Calendar",
      events: {
        supplierPayment: "Supplier payment",
        taxPayment: "Tax payment",
        customerReceipt: "Customer receipt",
      },
      status: {
        overdue: "Overdue",
        neutral: "Scheduled",
        positive: "Incoming",
        upcoming: "Upcoming",
      },
    },
  },
};

export type Dictionary = typeof en;
