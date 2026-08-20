import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from './entities/permission.entity';
import { Role } from './entities/role.entity';
import { PERMISSIONS } from './permission-codes';

interface PermissionDef {
  code: string;
  name: string;
  description: string;
  category: string;
}

const ALL_PERMISSIONS: PermissionDef[] = [
  // Orders
  {
    code: PERMISSIONS.APPROVE_ORDERS,
    name: 'Approve Orders',
    description: 'Approve pending orders',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.DECLINE_ORDERS,
    name: 'Decline Orders',
    description: 'Decline pending orders',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.EDIT_ORDERS,
    name: 'Edit Orders',
    description: 'Edit existing orders',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.CANCEL_ORDERS,
    name: 'Cancel Orders',
    description: 'Cancel orders',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.ASSIGN_DEPARTMENT,
    name: 'Assign Department',
    description: 'Assign orders to a department',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.CHANGE_PRIORITY,
    name: 'Change Priority',
    description: 'Change order priority',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.MARK_READY,
    name: 'Mark Ready',
    description: 'Mark order as ready for pickup',
    category: 'Orders',
  },
  {
    code: PERMISSIONS.MARK_DELIVERED,
    name: 'Mark Delivered',
    description: 'Mark order as delivered',
    category: 'Orders',
  },

  // Tables
  {
    code: PERMISSIONS.OPEN_TABLE,
    name: 'Open Table',
    description: 'Open a new table',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.CLOSE_TABLE,
    name: 'Close Table',
    description: 'Close a table',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.MERGE_TABLES,
    name: 'Merge Tables',
    description: 'Merge two or more tables',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.SPLIT_TABLE,
    name: 'Split Table',
    description: 'Split a table into multiple',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.TRANSFER_TABLE,
    name: 'Transfer Table',
    description: 'Transfer table to another waiter',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.ASSIGN_WAITER,
    name: 'Assign Waiter',
    description: 'Assign a waiter to a table',
    category: 'Tables',
  },
  {
    code: PERMISSIONS.VIEW_TABS,
    name: 'View Tabs',
    description: 'View open tabs',
    category: 'Tables',
  },

  // Payments
  {
    code: PERMISSIONS.ACCEPT_PAYMENT,
    name: 'Accept Payment',
    description: 'Accept payments',
    category: 'Payments',
  },
  {
    code: PERMISSIONS.SPLIT_BILL,
    name: 'Split Bill',
    description: 'Split a bill between customers',
    category: 'Payments',
  },
  {
    code: PERMISSIONS.ISSUE_REFUND,
    name: 'Issue Refund',
    description: 'Issue a refund',
    category: 'Payments',
  },
  {
    code: PERMISSIONS.VOID_PAYMENT,
    name: 'Void Payment',
    description: 'Void a payment',
    category: 'Payments',
  },
  {
    code: PERMISSIONS.DISCOUNT_BILL,
    name: 'Discount Bill',
    description: 'Apply a discount to a bill',
    category: 'Payments',
  },
  {
    code: PERMISSIONS.REOPEN_INVOICE,
    name: 'Reopen Invoice',
    description: 'Reopen a closed invoice',
    category: 'Payments',
  },

  // Menu
  {
    code: PERMISSIONS.CREATE_MENU,
    name: 'Create Menu',
    description: 'Create new menu items',
    category: 'Menu',
  },
  {
    code: PERMISSIONS.EDIT_MENU,
    name: 'Edit Menu',
    description: 'Edit existing menu items',
    category: 'Menu',
  },
  {
    code: PERMISSIONS.DELETE_MENU,
    name: 'Delete Menu',
    description: 'Delete menu items',
    category: 'Menu',
  },
  {
    code: PERMISSIONS.CHANGE_PRICE,
    name: 'Change Price',
    description: 'Change menu item prices',
    category: 'Menu',
  },
  {
    code: PERMISSIONS.MARK_UNAVAILABLE,
    name: 'Mark Unavailable',
    description: 'Mark menu items as unavailable',
    category: 'Menu',
  },

  // Inventory
  {
    code: PERMISSIONS.VIEW_INVENTORY,
    name: 'View Inventory',
    description: 'View inventory levels',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.UPDATE_INVENTORY,
    name: 'Update Inventory',
    description: 'Update inventory counts',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.ADJUST_STOCK,
    name: 'Adjust Stock',
    description: 'Adjust stock levels',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.MANAGE_SUPPLIERS,
    name: 'Manage Suppliers',
    description: 'Manage supplier records',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.VIEW_INVENTORY_AUDIT,
    name: 'View Inventory Audit',
    description: 'View inventory audit log',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.VIEW_INVENTORY_TALLY,
    name: 'View Daily Tally',
    description: 'View daily inventory tally',
    category: 'Inventory',
  },
  {
    code: PERMISSIONS.RECONCILE_INVENTORY,
    name: 'Reconcile Inventory',
    description: 'Reconcile inventory levels',
    category: 'Inventory',
  },

  // Reports
  {
    code: PERMISSIONS.VIEW_DASHBOARD,
    name: 'View Dashboard',
    description: 'View the main dashboard',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_DAILY_SALES,
    name: 'View Daily Sales',
    description: 'View daily sales reports',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_MONTHLY_SALES,
    name: 'View Monthly Sales',
    description: 'View monthly sales reports',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_PROFIT,
    name: 'View Profit',
    description: 'View profit reports',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.EXPORT_REPORTS,
    name: 'Export Reports',
    description: 'Export reports to CSV/PDF',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_ANALYTICS,
    name: 'View Analytics',
    description: 'View the analytics dashboard',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_BRANCH_ANALYTICS,
    name: 'View Branch Analytics',
    description: 'View branch-level analytics',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_REPORTS,
    name: 'View Reports',
    description: 'View sales reports',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_SHIFTS,
    name: 'View Shifts',
    description: 'View shift schedules',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.MANAGE_SHIFTS,
    name: 'Manage Shifts',
    description: 'Create, edit, open and close shifts and templates',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.MANAGE_DEVICES,
    name: 'Manage Devices',
    description: 'List, revoke and reactivate registered devices',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_POS,
    name: 'View POS',
    description: 'View the point-of-sale interface',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_PULSE,
    name: 'View Pulse',
    description: 'View the real-time pulse dashboard',
    category: 'Reports',
  },
  {
    code: PERMISSIONS.VIEW_PREMIUM_DASHBOARD,
    name: 'View Premium Dashboard',
    description: 'View the premium dashboard',
    category: 'Reports',
  },

  // Staff
  {
    code: PERMISSIONS.VIEW_STAFF,
    name: 'View Staff',
    description: 'View staff list',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.CREATE_STAFF,
    name: 'Create Staff',
    description: 'Create new staff accounts',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.EDIT_STAFF,
    name: 'Edit Staff',
    description: 'Edit staff profiles',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.DELETE_STAFF,
    name: 'Delete Staff',
    description: 'Delete staff accounts',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.ASSIGN_ROLES,
    name: 'Assign Roles',
    description: 'Assign or change staff roles',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.RESET_PASSWORD,
    name: 'Reset Password',
    description: 'Reset staff passwords and PINs',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.VIEW_DEPARTMENTS,
    name: 'View Departments',
    description: 'View department management',
    category: 'Staff',
  },
  {
    code: PERMISSIONS.VIEW_NOTIFICATIONS,
    name: 'View Notifications',
    description: 'View system notifications',
    category: 'Staff',
  },

  // Customers
  {
    code: PERMISSIONS.VIEW_TRACKING,
    name: 'View Tracking',
    description: 'View order tracking info',
    category: 'Customers',
  },
  {
    code: PERMISSIONS.GENERATE_TRACKING,
    name: 'Generate Tracking',
    description: 'Generate tracking codes',
    category: 'Customers',
  },
  {
    code: PERMISSIONS.MANAGE_RESERVATIONS,
    name: 'Manage Reservations',
    description: 'Manage table reservations',
    category: 'Customers',
  },
  {
    code: PERMISSIONS.VIEW_FEEDBACK,
    name: 'View Feedback',
    description: 'Submit and view feedback',
    category: 'Customers',
  },

  // System
  {
    code: PERMISSIONS.MANAGE_SUBSCRIPTION,
    name: 'Manage Subscription',
    description: 'Manage business subscription',
    category: 'System',
  },
  {
    code: PERMISSIONS.PAYMENT_GATEWAY,
    name: 'Payment Gateway',
    description: 'Configure payment gateway',
    category: 'System',
  },
  {
    code: PERMISSIONS.API_KEYS,
    name: 'API Keys',
    description: 'Manage API keys',
    category: 'System',
  },
  {
    code: PERMISSIONS.RESTAURANT_SETTINGS,
    name: 'Restaurant Settings',
    description: 'Manage restaurant settings',
    category: 'System',
  },
  {
    code: PERMISSIONS.SECURITY_SETTINGS,
    name: 'Security Settings',
    description: 'Manage security settings',
    category: 'System',
  },
  {
    code: PERMISSIONS.BRANDING,
    name: 'Branding',
    description: 'Manage branding and appearance',
    category: 'System',
  },
  {
    code: PERMISSIONS.VIEW_BILLING,
    name: 'View Billing',
    description: 'View billing and subscription',
    category: 'System',
  },
  {
    code: PERMISSIONS.VIEW_BUSINESS_SETUP,
    name: 'View Business Setup',
    description: 'View the business setup wizard',
    category: 'System',
  },
];

const ALL_CODES = ALL_PERMISSIONS.map((p) => p.code);

interface RoleDef {
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

const DEFAULT_ROLES: RoleDef[] = [
  {
    name: 'Owner',
    description: 'Full access to all restaurant features',
    isSystem: true,
    permissions: ALL_CODES,
  },
  {
    name: 'Manager',
    description: 'Oversees daily operations',
    isSystem: true,
    permissions: [
      PERMISSIONS.DECLINE_ORDERS,
      PERMISSIONS.EDIT_ORDERS,
      PERMISSIONS.MARK_READY,
      PERMISSIONS.MARK_DELIVERED,
      PERMISSIONS.OPEN_TABLE,
      PERMISSIONS.CLOSE_TABLE,
      PERMISSIONS.MERGE_TABLES,
      PERMISSIONS.SPLIT_TABLE,
      PERMISSIONS.TRANSFER_TABLE,
      PERMISSIONS.ASSIGN_WAITER,
      PERMISSIONS.ACCEPT_PAYMENT,
      PERMISSIONS.SPLIT_BILL,
      PERMISSIONS.DISCOUNT_BILL,
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_DAILY_SALES,
      PERMISSIONS.VIEW_MONTHLY_SALES,
      PERMISSIONS.VIEW_PROFIT,
      PERMISSIONS.VIEW_ANALYTICS,
      PERMISSIONS.VIEW_BRANCH_ANALYTICS,
      PERMISSIONS.VIEW_REPORTS,
PERMISSIONS.VIEW_SHIFTS,
PERMISSIONS.MANAGE_SHIFTS,
      PERMISSIONS.MANAGE_DEVICES,
      PERMISSIONS.VIEW_POS,
      PERMISSIONS.VIEW_PULSE,
      PERMISSIONS.VIEW_PREMIUM_DASHBOARD,
      PERMISSIONS.VIEW_INVENTORY,
      PERMISSIONS.UPDATE_INVENTORY,
      PERMISSIONS.ADJUST_STOCK,
      PERMISSIONS.VIEW_INVENTORY_AUDIT,
      PERMISSIONS.VIEW_INVENTORY_TALLY,
      PERMISSIONS.RECONCILE_INVENTORY,
      PERMISSIONS.MARK_UNAVAILABLE,
      PERMISSIONS.VIEW_STAFF,
      PERMISSIONS.VIEW_DEPARTMENTS,
      PERMISSIONS.VIEW_NOTIFICATIONS,
      PERMISSIONS.VIEW_TABS,
      PERMISSIONS.VIEW_BILLING,
      PERMISSIONS.VIEW_BUSINESS_SETUP,
      PERMISSIONS.VIEW_TRACKING,
      PERMISSIONS.GENERATE_TRACKING,
      PERMISSIONS.MANAGE_RESERVATIONS,
    ],
  },
  {
    name: 'Supervisor',
    description: 'Approves orders and oversees kitchen flow',
    isSystem: true,
    permissions: [
      PERMISSIONS.APPROVE_ORDERS,
      PERMISSIONS.DECLINE_ORDERS,
      PERMISSIONS.ASSIGN_DEPARTMENT,
      PERMISSIONS.MARK_READY,
      PERMISSIONS.MARK_DELIVERED,
      PERMISSIONS.VIEW_TRACKING,
    ],
  },
  {
    name: 'Waiter',
    description: 'Takes orders and serves customers',
    isSystem: true,
    permissions: [
      PERMISSIONS.OPEN_TABLE,
      PERMISSIONS.ACCEPT_PAYMENT,
      PERMISSIONS.SPLIT_BILL,
      PERMISSIONS.VIEW_TRACKING,
      PERMISSIONS.GENERATE_TRACKING,
    ],
  },
  {
    name: 'Chef',
    description: 'Prepares food in the kitchen',
    isSystem: true,
    permissions: [
      PERMISSIONS.ASSIGN_DEPARTMENT,
      PERMISSIONS.MARK_READY,
      PERMISSIONS.VIEW_TRACKING,
    ],
  },
  {
    name: 'Cashier',
    description: 'Handles payments and billing',
    isSystem: true,
    permissions: [
      PERMISSIONS.ACCEPT_PAYMENT,
      PERMISSIONS.SPLIT_BILL,
      PERMISSIONS.ISSUE_REFUND,
      PERMISSIONS.VOID_PAYMENT,
      PERMISSIONS.DISCOUNT_BILL,
      PERMISSIONS.REOPEN_INVOICE,
    ],
  },
];

@Injectable()
export class RoleSeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async onApplicationBootstrap() {
    await this.seed();
  }

  async seed() {
    const existing = await this.permissionRepo.count();
    if (existing > 0) return;

    // Seed permissions
    const permissionEntities = this.permissionRepo.create(
      ALL_PERMISSIONS.map((p) => ({
        code: p.code,
        name: p.name,
        description: p.description,
        category: p.category,
      })),
    );
    await this.permissionRepo.save(permissionEntities);

    const codeToPermission = new Map(
      permissionEntities.map((p) => [p.code, p]),
    );

    // Seed roles
    for (const def of DEFAULT_ROLES) {
      const role = this.roleRepo.create({
        name: def.name,
        description: def.description,
        is_system: def.isSystem,
      });
      role.permissions = def.permissions
        .map((code) => codeToPermission.get(code))
        .filter(Boolean) as Permission[];
      await this.roleRepo.save(role);
    }

    console.log('[Seed] Permissions and default roles seeded successfully');
  }
}
