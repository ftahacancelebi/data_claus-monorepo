import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('ad_creatives')
export class AdCreative {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'brand_name', type: 'varchar', length: 100 })
  brandName: string;

  @Column({ name: 'image_url', type: 'text' })
  imageUrl: string;

  @Column({ name: 'cta_text', type: 'varchar', length: 100, nullable: true })
  ctaText: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'buyer_id', type: 'uuid', nullable: true })
  buyerId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
