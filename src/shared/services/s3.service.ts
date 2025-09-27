import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;

  constructor() {
    this.region = process.env.S3_REGION || 'eu-north-1';
    this.bucketName = process.env.S3_BUCKET_NAME || 'prometric-documents';
    
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
      },
    });
  }

  /**
   * Upload file to S3 with proper organization structure
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    mimeType: string,
    organizationId: string,
    userId: string,
    documentType?: string,
    category?: string
  ): Promise<{ key: string; url: string; etag: string }> {
    try {
      // Generate unique key with proper structure
      const timestamp = Date.now();
      const hash = crypto.createHash('md5').update(file).digest('hex');
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Structure: org/{orgId}/documents/{type}/{category}/{year}/{month}/{userId}_{timestamp}_{hash}_{filename}
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const type = documentType || 'other';
      const cat = category || 'general';
      
      const key = `org/${organizationId}/documents/${type}/${cat}/${year}/${month}/${userId}_${timestamp}_${hash}_${sanitizedFileName}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        Metadata: {
          organizationId,
          userId,
          originalName: fileName,
          documentType: type,
          category: cat,
          uploadedAt: new Date().toISOString(),
          fileHash: hash,
        },
        // Add server-side encryption
        ServerSideEncryption: 'AES256',
      });

      const result = await this.s3Client.send(command);
      
      // Generate presigned URL for secure access
      const url = await this.generateDownloadUrl(key, 24 * 3600); // 24 hours

      return {
        key,
        url,
        etag: result.ETag || '',
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate presigned URL for file download
   */
  async generateDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('S3 Download URL Error:', error);
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3 Delete Error:', error);
      throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.s3Client.send(command);
      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        metadata: result.Metadata,
      };
    } catch (error) {
      console.error('S3 Metadata Error:', error);
      throw new Error(`Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}