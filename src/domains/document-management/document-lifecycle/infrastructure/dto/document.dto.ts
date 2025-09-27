import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber, IsBoolean, IsArray, IsEnum, IsDateString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

// Document Types Enum
export enum DocumentType {
  CONTRACT = 'contract',
  INVOICE = 'invoice',
  PROPOSAL = 'proposal',
  REPORT = 'report',
  PRESENTATION = 'presentation',
  SPREADSHEET = 'spreadsheet',
  IMAGE = 'image',
  PDF = 'pdf',
  OTHER = 'other'
}

// Document Status Enum
export enum DocumentStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ARCHIVED = 'archived'
}

// Document Priority Enum
export enum DocumentPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Document Access Level Enum
export enum DocumentAccessLevel {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  PRIVATE = 'private'
}

// Simple HTML tag removal
const stripHTML = (value: string) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/<[^>]*>/g, '');
};

export class CreateDocumentDto {
  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fileHash?: string;

  @ApiPropertyOptional({ enum: DocumentPriority })
  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ enum: DocumentAccessLevel })
  @IsOptional()
  @IsEnum(DocumentAccessLevel)
  accessLevel?: DocumentAccessLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  collaborators?: string[];
}

export class UpdateDocumentDto {
  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @Transform(({ value }) => stripHTML(value?.trim()))
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ enum: DocumentPriority })
  @IsOptional()
  @IsEnum(DocumentPriority)
  priority?: DocumentPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dealId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  customFields?: Record<string, any>;

  @ApiPropertyOptional({ enum: DocumentAccessLevel })
  @IsOptional()
  @IsEnum(DocumentAccessLevel)
  accessLevel?: DocumentAccessLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  collaborators?: string[];
}

export class DocumentCommentDto {
  @ApiProperty()
  @IsString()
  comment: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}

export class DocumentSearchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}