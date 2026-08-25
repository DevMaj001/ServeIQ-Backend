export class CreateNotificationDto {
  branch_id: string;
  /** Recipient user; omit for a branch-wide broadcast. */
  user_id?: string | null;
  type: string;
  title: string;
  message: string;
  data?: any;
}
