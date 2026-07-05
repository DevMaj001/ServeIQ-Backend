export class CreateNotificationDto {
  branch_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}
