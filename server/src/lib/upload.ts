import multer from 'multer';
import { isAllowedMimeType, MAX_FILE_SIZE_BYTES } from './attachmentValidation.js';

/**
 * Multer instance for attachment uploads.
 * - Uses disk storage into server/uploads/ (temp location; file is renamed after validation).
 * - Rejects files whose MIME type is not in the allowed list before they are saved.
 * - Enforces a hard size limit of 5 MB.
 */
export const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMimeType(file.mimetype)) {
      // Pass a typed error so the route handler can distinguish this case
      const err = new Error('UNSUPPORTED_FILE_TYPE') as NodeJS.ErrnoException;
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err as unknown as null, false);
    }
    cb(null, true);
  },
});
