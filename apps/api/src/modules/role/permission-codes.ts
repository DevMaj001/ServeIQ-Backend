export const PERMISSIONS = {
  // Orders
  APPROVE_ORDERS: 'approve_orders',
  DECLINE_ORDERS: 'decline_orders',
  EDIT_ORDERS: 'edit_orders',
  CANCEL_ORDERS: 'cancel_orders',
  ASSIGN_DEPARTMENT: 'assign_department',
  CHANGE_PRIORITY: 'change_priority',
  MARK_READY: 'mark_ready',
  MARK_DELIVERED: 'mark_delivered',

  // Tables
  OPEN_TABLE: 'open_table',
  CLOSE_TABLE: 'close_table',
  MERGE_TABLES: 'merge_tables',
  SPLIT_TABLE: 'split_table',
  TRANSFER_TABLE: 'transfer_table',
  ASSIGN_WAITER: 'assign_waiter',
  VIEW_TABS: 'view_tabs',

  // Payments
  ACCEPT_PAYMENT: 'accept_payment',
  SPLIT_BILL: 'split_bill',
  ISSUE_REFUND: 'issue_refund',
  VOID_PAYMENT: 'void_payment',
  DISCOUNT_BILL: 'discount_bill',
  REOPEN_INVOICE: 'reopen_invoice',

  // Menu
  CREATE_MENU: 'create_menu',
  EDIT_MENU: 'edit_menu',
  DELETE_MENU: 'delete_menu',
  CHANGE_PRICE: 'change_price',
  MARK_UNAVAILABLE: 'mark_unavailable',

  // Inventory
  VIEW_INVENTORY: 'view_inventory',
  UPDATE_INVENTORY: 'update_inventory',
  ADJUST_STOCK: 'adjust_stock',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  VIEW_INVENTORY_AUDIT: 'view_inventory_audit',
  VIEW_INVENTORY_TALLY: 'view_inventory_tally',
  RECONCILE_INVENTORY: 'reconcile_inventory',

  // Reports
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_DAILY_SALES: 'view_daily_sales',
  VIEW_MONTHLY_SALES: 'view_monthly_sales',
  VIEW_PROFIT: 'view_profit',
  EXPORT_REPORTS: 'export_reports',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_BRANCH_ANALYTICS: 'view_branch_analytics',
  VIEW_REPORTS: 'view_reports',
  VIEW_SHIFTS: 'view_shifts',
  VIEW_POS: 'view_pos',
  VIEW_PULSE: 'view_pulse',
  VIEW_PREMIUM_DASHBOARD: 'view_premium_dashboard',

  // Staff
  VIEW_STAFF: 'view_staff',
  CREATE_STAFF: 'create_staff',
  EDIT_STAFF: 'edit_staff',
  DELETE_STAFF: 'delete_staff',
  ASSIGN_ROLES: 'assign_roles',
  RESET_PASSWORD: 'reset_password',
  VIEW_DEPARTMENTS: 'view_departments',
  VIEW_NOTIFICATIONS: 'view_notifications',

  // Customers
  VIEW_TRACKING: 'view_tracking',
  GENERATE_TRACKING: 'generate_tracking',
  MANAGE_RESERVATIONS: 'manage_reservations',
  VIEW_FEEDBACK: 'view_feedback',

  // System
  MANAGE_SUBSCRIPTION: 'manage_subscription',
  PAYMENT_GATEWAY: 'payment_gateway',
  API_KEYS: 'api_keys',
  RESTAURANT_SETTINGS: 'restaurant_settings',
  SECURITY_SETTINGS: 'security_settings',
  BRANDING: 'branding',
  VIEW_BILLING: 'view_billing',
  VIEW_BUSINESS_SETUP: 'view_business_setup',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
