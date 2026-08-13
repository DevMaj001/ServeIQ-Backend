import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

import { Business } from '../modules/business/entities/business.entity';
import { Branch } from '../modules/branch/entities/branch.entity';
import { User } from '../modules/user/entities/user.entity';
import { Role } from '../modules/role/entities/role.entity';
import { Permission } from '../modules/role/entities/permission.entity';
import {
  Table as RestaurantTable,
  TableStatus,
} from '../modules/table/entities/table.entity';
import { MenuItem } from '../modules/menu/entities/menu-item.entity';
import { Tab } from '../modules/tab/entities/tab.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../modules/subscription/entities/subscription.entity';
import { Department } from '../modules/department/entities/department.entity';
import { UserRole } from '../common/shared';
import { PERMISSIONS } from '../modules/role/permission-codes';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/modules/**/*.entity.ts'],
  synchronize: false,
  logging: true,
  ssl:
    process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const businessRepo = AppDataSource.getRepository(Business);
  const branchRepo = AppDataSource.getRepository(Branch);
  const userRepo = AppDataSource.getRepository(User);
  const roleRepo = AppDataSource.getRepository(Role);
  const permissionRepo = AppDataSource.getRepository(Permission);
  const tableRepo = AppDataSource.getRepository(RestaurantTable);
  const menuRepo = AppDataSource.getRepository(MenuItem);
  const tabRepo = AppDataSource.getRepository(Tab);
  const subscriptionRepo = AppDataSource.getRepository(Subscription);
  const departmentRepo = AppDataSource.getRepository(Department);

  // Check if already seeded
  const existingBusiness = await businessRepo.findOne({
    where: { slug: 'demo-restaurant' },
  });
  if (existingBusiness) {
    console.log('Database already seeded');
    return;
  }

  // ===== 1. SEED PERMISSIONS & ROLES =====
  console.log('Seeding permissions and roles...');

  // Define all permissions (matching role-seed.service.ts)
  const allPermissions = [
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
  ];

  // Seed permissions
  const permissionEntities = permissionRepo.create(
    allPermissions.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      category: p.category,
    })),
  );
  await permissionRepo.save(permissionEntities);
  console.log('Created', permissionEntities.length, 'permissions');

  // Define default roles matching spec
  const defaultRoles = [
    {
      name: 'Owner',
      description: 'Full access to all restaurant features',
      isSystem: true,
      permissions: allPermissions.map((p) => p.code),
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
        PERMISSIONS.VIEW_INVENTORY,
        PERMISSIONS.UPDATE_INVENTORY,
        PERMISSIONS.ADJUST_STOCK,
        PERMISSIONS.MARK_UNAVAILABLE,
        PERMISSIONS.VIEW_STAFF,
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
        PERMISSIONS.GENERATE_TRACKING,
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

  // Seed roles
  const roleEntities: Role[] = [];
  for (const def of defaultRoles) {
    const role = roleRepo.create({
      name: def.name,
      description: def.description,
      is_system: def.isSystem,
    });
    role.permissions = def.permissions
      .map((code) => permissionEntities.find((p) => p.code === code))
      .filter(Boolean) as Permission[];
    const savedRole = await roleRepo.save(role);
    roleEntities.push(savedRole);
    console.log('Created role:', savedRole.name);
  }

  // ===== 2. CREATE BUSINESS & USERS =====
  // Create Business
  const business = businessRepo.create({
    name: 'Demo Restaurant',
    slug: 'demo-restaurant',
    type: 'restaurant',
    email: 'owner@demo.com',
  });
  const savedBusiness = await businessRepo.save(business);
  console.log('Created business:', savedBusiness.id);

  // Create Branch
  const branch = branchRepo.create({
    business_id: savedBusiness.id,
    name: 'Main Branch',
    is_active: true,
  });
  const savedBranch = await branchRepo.save(branch);
  console.log('Created branch:', savedBranch.id);

  // Create Trial Subscription
  const subscription = subscriptionRepo.create({
    branch_id: savedBranch.id,
    status: SubscriptionStatus.TRIALING,
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });
  await subscriptionRepo.save(subscription);
  console.log('Created trial subscription for branch:', savedBranch.id);

  // Fetch owner role for user creation
  const ownerRole = roleEntities.find((r) => r.name === 'Owner');

  // Create Owner User
  const salt = await bcrypt.genSalt();
  const passwordHash = await bcrypt.hash('password123', salt);
  const pinHash = await bcrypt.hash('1234', salt);

  const owner = userRepo.create({
    business_id: savedBusiness.id,
    branch_id: savedBranch.id,
    full_name: 'Owner User',
    email: 'owner@demo.com',
    password_hash: passwordHash,
    role: UserRole.OWNER,
    role_id: ownerRole?.id,
    is_active: true,
  });
  const savedOwner = await userRepo.save(owner);
  console.log('Created owner:', savedOwner.id);

  // Update business with owner_id
  savedBusiness.owner_id = savedOwner.id;
  await businessRepo.save(savedBusiness);

  // Create Waiter User
  const waiter = userRepo.create({
    business_id: savedBusiness.id,
    branch_id: savedBranch.id,
    full_name: 'John Waiter',
    email: 'waiter@demo.com',
    password_hash: passwordHash,
    pin_hash: pinHash,
    role: UserRole.WAITER,
    role_id: roleEntities.find((r) => r.name === 'Waiter')?.id,
    is_active: true,
  });
  const savedWaiter = await userRepo.save(waiter);
  console.log('Created waiter:', savedWaiter.id);

  // Create Supervisor User
  const supervisor = userRepo.create({
    business_id: savedBusiness.id,
    branch_id: savedBranch.id,
    full_name: 'Supervisor User',
    email: 'supervisor@demo.com',
    password_hash: passwordHash,
    pin_hash: pinHash,
    role: UserRole.SUPERVISOR,
    role_id: roleEntities.find((r) => r.name === 'Supervisor')?.id,
    is_active: true,
  });
  const savedSupervisor = await userRepo.save(supervisor);
  console.log('Created supervisor:', savedSupervisor.id);

  // Create Manager User
  const manager = userRepo.create({
    business_id: savedBusiness.id,
    branch_id: savedBranch.id,
    full_name: 'Manager User',
    email: 'manager@demo.com',
    password_hash: passwordHash,
    pin_hash: pinHash,
    role: UserRole.MANAGER,
    role_id: roleEntities.find((r) => r.name === 'Manager')?.id,
    is_active: true,
  });
  const savedManager = await userRepo.save(manager);
  console.log('Created manager:', savedManager.id);

  // Create Departments
  const departments = [
    { name: 'Kitchen', branch_id: savedBranch.id },
    { name: 'Bar', branch_id: savedBranch.id },
    { name: 'Grill Station', branch_id: savedBranch.id },
  ];
  for (const dept of departments) {
    await departmentRepo.save(departmentRepo.create(dept));
  }
  console.log('Created', departments.length, 'departments');

  // Create Tables
  const tables = [];
  for (let i = 1; i <= 10; i++) {
    const table = tableRepo.create({
      branch_id: savedBranch.id,
      table_number: `T${i}`,
      capacity: i <= 5 ? 4 : 6,
      status: TableStatus.AVAILABLE,
    });
    tables.push(table);
  }
  const savedTables = await tableRepo.save(tables);
  console.log('Created', savedTables.length, 'tables');

  // Create Menu Items
  const menuItems = [
    {
      name: 'Jollof Rice',
      category: 'Food',
      price_kobo: 5000,
      unit: 'plate',
      sku: 'JOL-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Fried Rice',
      category: 'Food',
      price_kobo: 4500,
      unit: 'plate',
      sku: 'FRI-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Pounded Yam & Egusi',
      category: 'Food',
      price_kobo: 6000,
      unit: 'plate',
      sku: 'PYA-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Chicken Suya',
      category: 'Food',
      price_kobo: 3500,
      unit: 'skewer',
      sku: 'SUY-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Coca Cola',
      category: 'Drinks',
      price_kobo: 800,
      unit: 'bottle',
      sku: 'COC-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Bottled Water',
      category: 'Drinks',
      price_kobo: 500,
      unit: 'bottle',
      sku: 'WAT-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Chapman',
      category: 'Drinks',
      price_kobo: 1500,
      unit: 'glass',
      sku: 'CHA-001',
      image_url: '',
      is_available: true,
    },
    {
      name: 'Ice Cream',
      category: 'Desserts',
      price_kobo: 2000,
      unit: 'scoop',
      sku: 'ICE-001',
      image_url: '',
      is_available: true,
    },
  ];

  const createdMenuItems = [];
  for (const item of menuItems) {
    const menuItem = menuRepo.create({
      ...item,
      branch_id: savedBranch.id,
      created_by: savedOwner.id,
    });
    createdMenuItems.push(await menuRepo.save(menuItem));
  }
  console.log('Created', createdMenuItems.length, 'menu items');

  // Create a Sample Tab (open tab for testing)
  const sampleTab = tabRepo.create({
    branch_id: savedBranch.id,
    table_id: (await tableRepo.find())[0].id,
    waiter_id: (await userRepo.findOne({ where: { email: 'waiter@demo.com' } }))
      ?.id,
    tab_number: 'TAB-DEMO-001',
    customer_name: 'Walk-in Customer',
    party_size: 2,
    status: 'open',
    opened_at: new Date(),
  });
  const savedTab = await tabRepo.save(sampleTab);
  console.log('Created sample tab:', savedTab.id);

  // Update table status to occupied
  const allTables = await tableRepo.find();
  await tableRepo.update(allTables[0].id, { status: TableStatus.OCCUPIED });

  console.log('\n=== SEED COMPLETE ===');
  console.log('Login credentials:');
  console.log('  Owner: owner@demo.com / password123');
  console.log('  Manager: manager@demo.com / password123 (PIN: 1234)');
  console.log('  Waiter: waiter@demo.com / password123 (PIN: 1234)');
  console.log('  Supervisor: supervisor@demo.com / password123 (PIN: 1234)');
  console.log('Sample Tab ID:', savedTab.id);
  console.log('Branch ID:', savedBranch.id);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
