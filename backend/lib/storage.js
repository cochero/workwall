import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

let s3 = null;
if (config.storageDriver === 's3') {
  s3 = new S3Client({
    region: config.s3.region || 'us-east-1',
    endpoint: config.s3.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey
    }
  });
}

export const driverName = config.storageDriver;

export function makeKey(projectId, originalName) {
  const safe = String(originalName).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120);
  return `projects/${projectId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`;
}

export async function putObject(key, buffer, mimeType) {
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream'
    }));
  } else {
    const full = localPath(key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buffer);
  }
}

export async function presignedGetUrl(key, filename, inline = false) {
  if (!s3) return null;
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`;
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      ResponseContentDisposition: disposition
    }),
    { expiresIn: 300 }
  );
}

export function localPath(key) {
  const full = path.resolve(UPLOAD_DIR, key);
  if (!full.startsWith(path.resolve(UPLOAD_DIR))) throw new Error('Bad storage key');
  return full;
}

export async function deleteObject(key) {
  try {
    if (s3) {
      await s3.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    } else {
      fs.unlinkSync(localPath(key));
    }
  } catch {
    /* best effort */
  }
}

export function categoryFor(name, mime = '') {
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
  return 'other';
}
