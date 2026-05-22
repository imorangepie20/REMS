import multer from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { ValidationError } from '../errors';

const UPLOAD_DIR = 'uploads';
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `${randomBytes(16).toString('hex')}${ext}`);
  },
});

/** 매물 사진 업로드 미들웨어 — 이미지 1장, 5MB 제한 */
export const photoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) {
      cb(new ValidationError('jpg, png, webp 이미지만 업로드할 수 있습니다'));
      return;
    }
    cb(null, true);
  },
}).single('photo');
