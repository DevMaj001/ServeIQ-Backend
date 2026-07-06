import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ImageUploadComponent } from '../../shared/components/image-upload/image-upload.component';
import { getInitials } from '../../../../../../libs/shared';

@Component({
  selector: 'app-waiter-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploadComponent],
  template: `
    <div class="staff-management-container">
      <header class="header">
        <h1>Staff Management</h1>
        <button class="add-btn" (click)="openAddModal()">+ Add Waiter</button>
      </header>

      <div class="staff-list">
        <div class="staff-card" *ngFor="let waiter of waiters">
          <div class="waiter-info">
            <div class="avatar">
              <img *ngIf="waiter.avatar_url" [src]="waiter.avatar_url" alt="Avatar">
              <span *ngIf="!waiter.avatar_url">{{ getInitials(waiter.fullName) }}</span>
            </div>
            <div class="details">
              <h3>{{ waiter.fullName }}</h3>
              <p>{{ waiter.email }}</p>
            </div>
          </div>
          <div class="actions">
            <button (click)="editWaiter(waiter)">Edit</button>
            <button class="delete" (click)="deleteWaiter(waiter.id)">Delete</button>
          </div>
        </div>
      </div>

      <!-- Add/Edit Modal (Simplified for this task) -->
      <div class="modal" *ngIf="showModal">
        <div class="modal-content">
          <h2>{{ isEditing ? 'Edit' : 'Add' }} Waiter</h2>
          <form (submit)="saveWaiter()">
            <div class="form-group">
              <label>Avatar</label>
              <app-image-upload 
                [imageUrl]="currentWaiter.avatar_url" 
                (imageUploaded)="onImageUploaded($event)"
                (imageRemoved)="onImageRemoved()">
              </app-image-upload>
            </div>
            <div class="form-group">
              <label>Full Name</label>
              <input type="text" [(ngModel)]="currentWaiter.fullName" name="fullName" required>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="currentWaiter.email" name="email">
            </div>
            <div class="modal-actions">
              <button type="button" (click)="closeModal()">Cancel</button>
              <button type="submit" [disabled]="!currentWaiter.fullName">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .staff-management-container { padding: 2rem; background: var(--bg-color, #fff); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .staff-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
    .staff-card { 
      background: white; border-radius: 12px; padding: 1.5rem; 
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); display: flex; justify-content: space-between; align-items: center;
    }
    .waiter-info { display: flex; align-items: center; gap: 1rem; }
    .avatar { 
      width: 48px; height: 48px; border-radius: 50%; background: #f97316; color: white;
      display: flex; justify-content: center; align-items: center; font-weight: bold; overflow: hidden;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .actions { display: flex; gap: 0.5rem; }
    .delete { color: #ef4444; }
    .modal { 
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5);
      display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-content { background: white; padding: 2rem; border-radius: 12px; width: 400px; }
    .form-group { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
    input { padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; }
  `]
})
export class WaiterManagementComponent implements OnInit {
  waiters: any[] = [];
  showModal = false;
  isEditing = false;
  currentWaiter: any = {};
  getInitials = getInitials;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadWaiters();
  }

  loadWaiters() {
    this.http.get<any[]>('/api/v1/user/waiters').subscribe(data => this.waiters = data);
  }

  openAddModal() {
    this.isEditing = false;
    this.currentWaiter = { fullName: '', email: '', avatar_url: null };
    this.showModal = true;
  }

  editWaiter(waiter: any) {
    this.isEditing = true;
    this.currentWaiter = { ...waiter };
    this.showModal = true;
  }

  onImageUploaded(url: string) {
    this.currentWaiter.avatar_url = url;
  }

  onImageRemoved() {
    this.currentWaiter.avatar_url = null;
  }

  saveWaiter() {
    const request = this.isEditing 
      ? this.http.patch(`/api/v1/user/${this.currentWaiter.id}`, this.currentWaiter)
      : this.http.post('/api/v1/user/waiters', this.currentWaiter);

    request.subscribe(() => {
      this.loadWaiters();
      this.closeModal();
    });
  }

  deleteWaiter(id: string) {
    if (confirm('Are you sure?')) {
      this.http.delete(`/api/v1/user/${id}`).subscribe(() => this.loadWaiters());
    }
  }

  closeModal() {
    this.showModal = false;
  }
}
