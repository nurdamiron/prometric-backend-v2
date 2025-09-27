import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { 
  DocumentPersistenceEntity, 
  DocumentCommentEntity, 
  DocumentAccessLogEntity 
} from './infrastructure/persistence/document.persistence.entity';
import { DocumentController } from './infrastructure/controllers/document.controller';
import { S3Service } from '../../../shared/services/s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentPersistenceEntity,
      DocumentCommentEntity,
      DocumentAccessLogEntity
    ]),
    MulterModule.register({
      storage: memoryStorage(), // Use memory storage instead of disk
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
      },
      fileFilter: (req, file, cb) => {
        // Allow all file types for now, can be restricted later
        cb(null, true);
      }
    })
  ],
  controllers: [
    DocumentController
  ],
  providers: [
    S3Service
  ],
  exports: []
})
export class DocumentManagementModule {}