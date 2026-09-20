import { v2 as cloudinary } from 'cloudinary';

export const CloudinaryProvider = {
  provide: 'CLOUDINARY',
  useFactory: () => {
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    const api_key = process.env.CLOUDINARY_API_KEY;
    const api_secret = process.env.CLOUDINARY_API_SECRET;
    if (
      process.env.NODE_ENV === 'production' &&
      (!cloud_name || !api_key || !api_secret)
    ) {
      // Fail at boot, not at the first receipt upload: a silently
      // unconfigured Cloudinary turns every upload into a runtime 500.
      throw new Error(
        'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in production.',
      );
    }
    return cloudinary.config({ cloud_name, api_key, api_secret });
  },
};
