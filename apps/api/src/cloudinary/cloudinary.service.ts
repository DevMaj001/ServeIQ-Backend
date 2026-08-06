import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

interface UploadResult {
  secure_url: string;
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  return new Error('Cloudinary upload failed');
}

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'serveiq',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error: unknown, result: unknown) => {
          if (error) return reject(toError(error));
          if (!result || typeof result !== 'object')
            return reject(new Error('Upload returned no result'));
          resolve((result as UploadResult).secure_url);
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  async uploadFile(
    buffer: Buffer,
    publicId: string,
    resourceType: 'image' | 'raw' | 'auto' = 'raw',
  ): Promise<{ secure_url: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { public_id: publicId, resource_type: resourceType },
        (error: unknown, result: unknown) => {
          if (error) return reject(toError(error));
          if (!result || typeof result !== 'object')
            return reject(new Error('Upload returned no result'));
          resolve(result as { secure_url: string });
        },
      );
      Readable.from(buffer).pipe(uploadStream);
    });
  }
}
