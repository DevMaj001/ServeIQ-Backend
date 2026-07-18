import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

import { Business } from '../modules/business/entities/business.entity';
import { Branch } from '../modules/branch/entities/branch.entity';
import { User } from '../modules/user/entities/user.entity';
import { Table as RestaurantTable, TableStatus } from '../modules/table/entities/table.entity';
import { MenuItem } from '../modules/menu/entities/menu-item.entity';
import { Tab } from '../modules/tab/entities/tab.entity';
import { Subscription, SubscriptionStatus } from '../modules/subscription/entities/subscription.entity';
import { Department } from '../modules/department/entities/department.entity';
import { UserRole } from '../common/shared';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/modules/**/*.entity.ts'],
  synchronize: false,
  logging: true,
  ssl: process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false,
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const businessRepo = AppDataSource.getRepository(Business);
  const branchRepo = AppDataSource.getRepository(Branch);
  const userRepo = AppDataSource.getRepository(User);
  const tableRepo = AppDataSource.getRepository(RestaurantTable);
  const menuRepo = AppDataSource.getRepository(MenuItem);
  const tabRepo = AppDataSource.getRepository(Tab);
  const subscriptionRepo = AppDataSource.getRepository(Subscription);

  const salt = await bcrypt.genSalt();
  const passwordHash = await bcrypt.hash('password123', salt);
  const pinHash = await bcrypt.hash('1234', salt);

  // Check if already seeded
  const existingBusiness = await businessRepo.findOne({ where: { slug: 'demo-restaurant' } });
  if (existingBusiness) {
    console.log('Database already seeded');
    await AppDataSource.destroy();
    return;
  }

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

  // Create Owner User
  const owner = userRepo.create({
    business_id: savedBusiness.id,
    branch_id: savedBranch.id,
    full_name: 'Owner User',
    email: 'owner@demo.com',
    password_hash: passwordHash,
    role: UserRole.OWNER,
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
    is_active: true,
  });
  const savedSupervisor = await userRepo.save(supervisor);
  console.log('Created supervisor:', savedSupervisor.id);

  // Create Departments
  const departmentRepo = AppDataSource.getRepository(Department);
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
    { name: 'Jollof Rice', category: 'Food', price_kobo: 5000, unit: 'plate', sku: 'JOL-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Fried Rice', category: 'Food', price_kobo: 4500, unit: 'plate', sku: 'FRI-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Pounded Yam & Egusi', category: 'Food', price_kobo: 6000, unit: 'plate', sku: 'PYA-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Chicken Suya', category: 'Food', price_kobo: 3500, unit: 'skewer', sku: 'SUY-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Coca Cola', category: 'Drinks', price_kobo: 800, unit: 'bottle', sku: 'COC-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Bottled Water', category: 'Drinks', price_kobo: 500, unit: 'bottle', sku: 'WAT-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Chapman', category: 'Drinks', price_kobo: 1500, unit: 'glass', sku: 'CHA-001', image_url: '', is_available: true, created_by: savedOwner.id },
    { name: 'Ice Cream', category: 'Desserts', price_kobo: 2000, unit: 'scoop', sku: 'ICE-001', image_url: '', is_available: true, created_by: savedOwner.id },
  ];

  const createdMenuItems = [];
  for (const item of menuItems) {
    const menuItem = menuRepo.create({
      ...item,
      branch_id: savedBranch.id,
    });
    createdMenuItems.push(await menuRepo.save(menuItem));
  }
  console.log('Created', createdMenuItems.length, 'menu items');

  // Create a Sample Tab (open tab for testing)
  const sampleTab = tabRepo.create({
    branch_id: savedBranch.id,
    table_id: savedTables[0].id,
    waiter_id: savedWaiter.id,
    tab_number: 'TAB-DEMO-001',
    customer_name: 'Walk-in Customer',
    party_size: 2,
    status: 'open',
    opened_at: new Date(),
  });
  const savedTab = await tabRepo.save(sampleTab);
  console.log('Created sample tab:', savedTab.id);

  // Update table status to occupied
  await tableRepo.update(savedTables[0].id, { status: TableStatus.OCCUPIED });

  console.log('\n=== SEED COMPLETE ===');
  console.log('Login credentials:');
  console.log('  Owner: owner@demo.com / password123');
  console.log('  Waiter: waiter@demo.com / password123 (PIN: 1234)');
  console.log('  Supervisor: supervisor@demo.com / password123 (PIN: 1234)');
  console.log('Sample Tab ID:', savedTab.id);
  console.log('Branch ID:', savedBranch.id);

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});