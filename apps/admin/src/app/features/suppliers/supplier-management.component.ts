import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-supplier-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="suppliers-container">
      <header class="header">
        <h1>Suppliers</h1>
        <button class="add-btn" (click)="openAddModal()">+ Add Supplier</button>
      </header>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact Person</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of suppliers">
              <td>{{ s.name }}</td>
              <td>{{ s.contact_person || '-' }}</td>
              <td>{{ s.phone || '-' }}</td>
              <td>{{ s.email || '-' }}</td>
              <td>
                <span class="status" [class.active]="s.is_active" [class.inactive]="!s.is_active">
                  {{ s.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <button (click)="editItem(s)">Edit</button>
                <button class="delete" (click)="deleteItem(s.id)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Add/Edit Modal -->
      <div class="modal" *ngIf="showModal">
        <div class="modal-content">
          <h2>{{ isEditing ? 'Edit' : 'Add' }} Supplier</h2>
          <form (submit)="saveItem()">
            <div class="form-group">
              <label>Name *</label>
              <input type="text" [(ngModel)]="currentItem.name" name="name" required>
            </div>
            <div class="form-group">
              <label>Contact Person</label>
              <input type="text" [(ngModel)]="currentItem.contact_person" name="contact">
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="text" [(ngModel)]="currentItem.phone" name="phone">
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="currentItem.email" name="email">
            </div>
            <div class="form-group">
              <label>Address</label>
              <input type="text" [(ngModel)]="currentItem.address" name="address">
            </div>
            <div class="form-group">
              <label>Note</label>
              <textarea [(ngModel)]="currentItem.note" name="note" rows="3"></textarea>
            </div>
            <div class="form-group" *ngIf="isEditing">
              <label>
                <input type="checkbox" [(ngModel)]="currentItem.is_active" name="active">
                Active
              </label>
            </div>
            <div class="modal-actions">
              <button type="button" (click)="closeModal()">Cancel</button>
              <button type="submit" [disabled]="!currentItem.name">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .suppliers-container { padding: 2rem; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; }
    th { background: #f9fafb; font-weight: 600; color: #6b7280; font-size: 0.875rem; }
    .status { font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; }
    .status.active { background: #ecfdf5; color: #10b981; }
    .status.inactive { background: #f3f4f6; color: #9ca3af; }
    .delete { color: #ef4444; }
    .modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal-content { background: white; padding: 2rem; border-radius: 16px; width: 450px; max-height: 90vh; overflow-y: auto; }
    .form-group { margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
    input, textarea, select { padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
  `]
})
export class SupplierManagementComponent implements OnInit {
  suppliers: any[] = [];
  showModal = false;
  isEditing = false;
  currentItem: any = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadSuppliers();
  }

  loadSuppliers() {
    this.http.get<any[]>('/api/v1/suppliers').subscribe(data => this.suppliers = data);
  }

  openAddModal() {
    this.isEditing = false;
    this.currentItem = { name: '', contact_person: '', phone: '', email: '', address: '', note: '', is_active: true };
    this.showModal = true;
  }

  editItem(item: any) {
    this.isEditing = true;
    this.currentItem = { ...item };
    this.showModal = true;
  }

  saveItem() {
    const req = this.isEditing
      ? this.http.patch(`/api/v1/suppliers/${this.currentItem.id}`, this.currentItem)
      : this.http.post('/api/v1/suppliers', this.currentItem);
    req.subscribe(() => {
      this.loadSuppliers();
      this.closeModal();
    });
  }

  deleteItem(id: string) {
    if (confirm('Delete this supplier?')) {
      this.http.delete(`/api/v1/suppliers/${id}`).subscribe(() => this.loadSuppliers());
    }
  }

  closeModal() {
    this.showModal = false;
  }
}
