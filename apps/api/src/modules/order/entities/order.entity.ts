import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  tab_id: string;

  @Index()
  @Column({ type: 'uuid' })
  menu_item_id: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  unit_price_kobo: number;

  @Column({ type: 'integer' })
  subtotal_kobo: number;

  @Column({ default: 1 })
  round_number: number;

  @Column({ type: 'text', nullable: true })
  voice_transcription: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  modifiers: { id: string; name: string; price_kobo: number; qty: number }[];

  @Column()
  created_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
