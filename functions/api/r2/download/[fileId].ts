// /functions/api/r2/download/[fileId].ts
// Streams file downloads directly from R2
// Validates user ownership before allowing access
//
// NOTE: Future Enhancement - Presigned URLs
// If you need to generate shareable presigned URLs instead of streaming:
// 1. Install AWS SDK: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
// 2. Create R2 API token with read access
// 3. Use getSignedUrl() from @aws-sdk/s3-request-presigner
// 4. See: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
// Trade-off: Presigned URLs offload bandwidth to R2 but require AWS SDK dependencies

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

    // Try different possible header names for Access user email
    const possibleHeaders = [
      'cf-access-authenticated-user-email',
      'Cf-Access-Authenticated-User-Email', 
      'CF-Access-Authenticated-User-Email',
      'x-forwarded-user'
    ];
    
    let userEmail = null;
    
    for (const headerName of possibleHeaders) {
      userEmail = request.headers.get(headerName);
      if (userEmail) {
        break;
      }
    }
    
    if (!userEmail) {
      return new Response('Unauthorized - No authenticated user found', { status: 401 });
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

    // Fetch the file from R2
    const object = await env.STORAGE_BUCKET.get(metadata.r2Key);
    
    if (!object) {
      return new Response('File not found in storage', { status: 404 });
    }

    // Stream the file directly to the user
    return new Response(object.body, {
      headers: {
        'Content-Type': metadata.contentType,
        'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
        'Content-Length': object.size.toString(),
        'Cache-Control': 'private, no-cache'
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return new Response('Failed to download file: ' + error.message, { status: 500 });
  }
};