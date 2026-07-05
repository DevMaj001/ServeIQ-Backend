import { Routes } from '@angular/router';
import { WaiterManagementComponent } from './features/waiters/waiter-management.component';
import { MenuManagementComponent } from './features/menu/menu-management.component';
import { TableManagementComponent } from './features/tables/table-management.component';
import { InventoryManagementComponent } from './features/inventory/inventory-management.component';
import { SupplierManagementComponent } from './features/suppliers/supplier-management.component';

export const routes: Routes = [
  { path: '', redirectTo: 'waiters', pathMatch: 'full' },
  { path: 'waiters', component: WaiterManagementComponent },
  { path: 'menu', component: MenuManagementComponent },
  { path: 'tables', component: TableManagementComponent },
  { path: 'inventory', component: InventoryManagementComponent },
  { path: 'suppliers', component: SupplierManagementComponent },
];
