import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inventory-container">
      <header class="header">
        <h1>Inventory</h1>
        <button class="add-btn" (click)="openAddModal()">+ Add Item</button>
      </header>

      <div class="tabs">
        <button [class.active]="tab === 'all'" (click)="tab = 'all'">All Items</button>
        <button [class.active]="tab === 'alerts'" (click)="loadAlerts(); tab = 'alerts'">
          Low Stock <span class="badge" *ngIf="alerts.length">{{ alerts.length }}</span>
        </button>
        <button [class.active]="tab === 'bestsellers'" (click)="loadBestsellers(); tab = 'bestsellers'">Bestsellers</button>
        <button [class.active]="tab === 'variance'" (click)="loadVariance(); tab = 'variance'">Variance</button>
      </div>

      <!-- ALL ITEMS -->
      <div *ngIf="tab === 'all'">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Menu Item</th>
                <th>Category</th>
                <th>In Stock</th>
                <th>Reorder Level</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items">
                <td>{{ item.menu_item?.name || 'Unknown' }}</td>
                <td><span class="cat-tag">{{ item.menu_item?.category }}</span></td>
                <td>{{ item.quantity_in_stock }}</td>
                <td>{{ item.reorder_level }}</td>
                <td>
                  <span class="status" [class.low]="item.is_low_stock" [class.ok]="!item.is_low_stock">
                    {{ item.is_low_stock ? 'Low Stock' : 'OK' }}
                  </span>
                </td>
                <td>
                  <button (click)="openAddStock(item)">Add Stock</button>
                  <button (click)="editItem(item)">Edit</button>
                  <button class="delete" (click)="deleteItem(item.id)">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ALERTS -->
      <div *ngIf="tab === 'alerts'">
        <div class="alert-card" *ngFor="let a of alerts">
          <strong>{{ a.menu_item_name }}</strong> — {{ a.quantity_in_stock }} left (reorder at {{ a.reorder_level }}), deficit {{ a.deficit }}
        </div>
        <p class="empty" *ngIf="alerts.length === 0">No low stock items</p>
      </div>

      <!-- BESTSELLERS -->
      <div *ngIf="tab === 'bestsellers'">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th>Sold</th><th>Revenue</th><th>Stock</th><th>Est. Days Left</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let b of bestsellers.bestsellers">
                <td>{{ b.menu_item_name }}</td><td>{{ b.total_sold }}</td>
                <td>{{ (b.revenue_kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' }) }}</td>
                <td>{{ b.current_stock }}</td><td>{{ b.estimated_days_until_out ?? 'N/A' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- VARIANCE -->
      <div *ngIf="tab === 'variance'">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Item</th><th>Current</th><th>Expected</th><th>Variance</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of variance">
                <td>{{ v.menu_item_name }}</td><td>{{ v.current_stock }}</td>
                <td>{{ v.expected_stock }}</td>
                <td [class.neg]="v.variance < 0" [class.pos]="v.variance > 0">{{ v.variance }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal" *ngIf="showModal">
        <div class="modal-content">
          <h2>{{ isEditing ? 'Edit' : 'Add' }} Inventory Item</h2>
          <form (submit)="saveItem()">
            <div class="form-group">
              <label>Menu Item</label>
              <select [(ngModel)]="currentItem.menu_item_id" name="menu_item_id" required *ngIf="!isEditing">
                <option value="">-- Select --</option>
                <option *ngFor="let m of menuItems" [value]="m.id">{{ m.name }} ({{ m.category }})</option>
              </select>
              <input *ngIf="isEditing" type="text" [value]="itemMenuName" disabled>
            </div>
            <div class="form-group">
              <label>Quantity in Stock</label>
              <input type="number" [(ngModel)]="currentItem.quantity_in_stock" name="qty" min="0">
            </div>
            <div class="form-group">
              <label>Reorder Level</label>
              <input type="number" [(ngModel)]="currentItem.reorder_level" name="reorder" min="0">
            </div>
            <div class="modal-actions">
              <button type="button" (click)="closeModal()">Cancel</button>
              <button type="submit" [disabled]="!currentItem.menu_item_id">Save</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Add Stock Modal -->
      <div class="modal" *ngIf="showStockModal">
        <div class="modal-content">
          <h2>Add Stock — {{ stockItem?.menu_item?.name }}</h2>
          <form (submit)="saveStock()">
            <div class="form-group">
              <label>Quantity</label>
              <input type="number" [(ngModel)]="stockQty" name="stockQty" min="1" required>
            </div>
            <div class="form-group">
              <label>Note (optional — include "wastage" for wastage)</label>
              <input type="text" [(ngModel)]="stockNote" name="stockNote">
            </div>
            <div class="modal-actions">
              <button type="button" (click)="showStockModal = false">Cancel</button>
              <button type="submit" [disabled]="!stockQty || stockQty <= 0">Add</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .inventory-container { padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
    .tabs button { padding: 0.5rem 1.25rem; border: 1px solid #ddd; border-radius: 8px; background: white; cursor: pointer; position: relative; }
    .tabs button.active { background: #1f2937; color: white; border-color: #1f2937; }
    .badge { background: #ef4444; color: white; border-radius: 50%; padding: 1px 6px; font-size: 0.75rem; margin-left: 4px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; }
    th { background: #f9fafb; font-weight: 600; color: #6b7280; font-size: 0.875rem; }
    .cat-tag { background: #fff7ed; color: #f97316; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; }
    .status { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; }
    .status.ok { background: #ecfdf5; color: #10b981; }
    .status.low { background: #fef2f2; color: #ef4444; }
    .alert-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem; }
    .empty { color: #9ca3af; text-align: center; padding: 3rem; }
    .neg { color: #ef4444; }
    .pos { color: #10b981; }
    .delete { color: #ef4444; }
    .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal-content { background: white; padding: 2rem; border-radius: 16px; width: 450px; max-height: 90vh; overflow-y: auto; }
    .form-group { margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
    input, select { padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
  `]
})
export class InventoryManagementComponent implements OnInit {
  tab = 'all';
  items: any[] = [];
  alerts: any[] = [];
  bestsellers: any = { bestsellers: [], slow_movers: [], out_of_stock: [] };
  variance: any[] = [];
  menuItems: any[] = [];
  showModal = false;
  isEditing = false;
  currentItem: any = {};
  itemMenuName = '';

  showStockModal = false;
  stockItem: any = null;
  stockQty = 0;
  stockNote = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadItems();
    this.loadMenuItems();
  }

  loadItems() {
    this.http.get<any[]>('/api/v1/inventory').subscribe(data => this.items = data);
  }

  loadMenuItems() {
    this.http.get<any[]>('/api/v1/menu').subscribe(data => this.menuItems = data);
  }

  loadAlerts() {
    this.http.get<any[]>('/api/v1/inventory/alerts').subscribe(data => this.alerts = data);
  }

  loadBestsellers() {
    this.http.get<any>('/api/v1/inventory/bestsellers').subscribe(data => this.bestsellers = data);
  }

  loadVariance() {
    this.http.get<any[]>('/api/v1/reports/stock-variance').subscribe(data => this.variance = data);
  }

  openAddModal() {
    this.isEditing = false;
    this.currentItem = { menu_item_id: '', quantity_in_stock: 0, reorder_level: 10 };
    this.showModal = true;
  }

  editItem(item: any) {
    this.isEditing = true;
    this.itemMenuName = item.menu_item?.name || 'Unknown';
    this.currentItem = { id: item.id, menu_item_id: item.menu_item_id, reorder_level: item.reorder_level };
    this.showModal = true;
  }

  saveItem() {
    if (this.isEditing) {
      this.http.patch(`/api/v1/inventory/${this.currentItem.id}`, { reorder_level: this.currentItem.reorder_level })
        .subscribe(() => { this.loadItems(); this.closeModal(); });
    } else {
      this.http.post('/api/v1/inventory', this.currentItem)
        .subscribe(() => { this.loadItems(); this.closeModal(); });
    }
  }

  deleteItem(id: string) {
    if (confirm('Delete this inventory item?')) {
      this.http.delete(`/api/v1/inventory/${id}`).subscribe(() => this.loadItems());
    }
  }

  openAddStock(item: any) {
    this.stockItem = item;
    this.stockQty = 0;
    this.stockNote = '';
    this.showStockModal = true;
  }

  saveStock() {
    this.http.post(`/api/v1/inventory/${this.stockItem.id}/stock`, {
      quantity: this.stockQty,
      notes: this.stockNote || undefined,
    }).subscribe(() => {
      this.loadItems();
      this.showStockModal = false;
    });
  }

  closeModal() {
    this.showModal = false;
  }
}
