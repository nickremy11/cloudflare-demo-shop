// /functions/api/r2/upload.ts
// Handles file uploads to R2 bucket with email-based access control
// Validates file types (PDF, JPG, PNG), size limits (<5MB), and user authorization
// Stores file metadata in KV namespace for fast lookups

interface Env {
  STORAGE_BUCKET: R2Bucket;
  DEMO_KV: KVNamespace;
}

interface FileMetadata {
  fileId: string;
  uploadedBy: string;
  uploadedAt: number;
  originalName: string;
  size: number;
  contentType: string;
  r2Key: string;
  scanStatus: 'pending' | 'clean' | 'malicious';
}

const APPROVED_EMAILS = [
  'nremy@cloudflare.com',
  'mdumblauskas@cloudflare.com',
  'khadija@cloudflare.com',
  'nickremy11@gmail.com'
];

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',  
  'image/png'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Get authenticated user email from Cloudflare Access header
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    
    if (!userEmail) {
      return new Response('Unauthorized - No authenticated user', { status: 401 });
    }

    // Verify email is in approved list
    if (!APPROVED_EMAILS.includes(userEmail)) {
      return new Response('Forbidden - Email not in approved customer list', { status: 403 });
    }

    // Parse the uploaded file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response('No file provided', { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response('Invalid file type. Only PDF, JPG, and PNG files are allowed.', { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response('File too large. Maximum size is 5MB.', { status: 400 });
    }

    // Generate unique file ID and R2 key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const fileId = `${timestamp}_${randomId}`;
    const fileExtension = getFileExtension(file.name);
    const r2Key = `${timestamp}_${randomId}_${sanitizeFilename(file.name)}`;

    // Create file metadata
    const metadata: FileMetadata = {
      fileId,
      uploadedBy: userEmail,
      uploadedAt: timestamp,
      originalName: file.name,
      size: file.size,
      contentType: file.type,
      r2Key,
      scanStatus: 'clean' // For now, mark as clean immediately
    };

    // Upload file to R2 bucket
    const arrayBuffer = await file.arrayBuffer();
    await env.STORAGE_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      },
      customMetadata: {
        uploadedBy: userEmail,
        originalName: file.name,
        fileId
      }
    });

    // Store metadata in KV
    await env.DEMO_KV.put(`file:${fileId}`, JSON.stringify(metadata));

    // Update user's file index
    const userFilesKey = `user_files:${userEmail}`;
    const existingFilesJson = await env.DEMO_KV.get(userFilesKey);
    const existingFiles = existingFilesJson ? JSON.parse(existingFilesJson) : [];
    existingFiles.push(fileId);
    await env.DEMO_KV.put(userFilesKey, JSON.stringify(existingFiles));

    // Return success response
    return Response.json({
      success: true,
      fileId,
      filename: file.name,
      size: file.size,
      uploadedAt: timestamp,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response('Upload failed: ' + error.message, { status: 500 });
  }
};

// ── Helper functions ────────────────────────────────────────────

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > -1 ? filename.substring(lastDotIndex) : '';
}

function sanitizeFilename(filename: string): string {
  // Remove or replace characters that might cause issues in R2 keys
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')  // Replace special chars with underscores
    .replace(/_{2,}/g, '_')           // Replace multiple underscores with single
    .replace(/^_|_$/g, '');           // Remove leading/trailing underscores
}