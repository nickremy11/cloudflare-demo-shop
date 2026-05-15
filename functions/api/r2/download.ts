// /functions/api/r2/download.ts
// Generates presigned URLs for file downloads
// Validates user ownership before allowing access

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

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const fileId = params.fileId as string;
    
    if (!fileId) {
      return new Response('File ID required', { status: 400 });
    }

    // Get authenticated user email from Cloudflare Access header
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    
    if (!userEmail) {
      return new Response('Unauthorized - No authenticated user', { status: 401 });
    }

    // Get file metadata from KV
    const metadataJson = await env.DEMO_KV.get(`file:${fileId}`);
    
    if (!metadataJson) {
      return new Response('File not found', { status: 404 });
    }

    const metadata: FileMetadata = JSON.parse(metadataJson);

    // Verify user owns this file
    if (metadata.uploadedBy !== userEmail) {
      return new Response('Forbidden - You can only download files you uploaded', { status: 403 });
    }

    // Check scan status (block malicious files)
    if (metadata.scanStatus === 'malicious') {
      return new Response('File blocked - Malicious content detected', { status: 403 });
    }

    // Generate presigned URL (valid for 5 minutes)
    const expiresIn = 5 * 60; // 5 minutes in seconds
    const presignedUrl = await env.STORAGE_BUCKET.sign(metadata.r2Key, {
      method: 'GET',
      expires: Date.now() + (expiresIn * 1000)
    });

    return Response.json({
      url: presignedUrl,
      filename: metadata.originalName,
      size: metadata.size,
      contentType: metadata.contentType,
      expiresIn,
      message: 'Download link generated successfully'
    });

  } catch (error) {
    console.error('Download error:', error);
    return new Response('Failed to generate download link: ' + error.message, { status: 500 });
  }
};