// /functions/api/r2/delete.ts
// Deletes files from R2 and removes metadata from KV
// Validates user ownership before allowing deletion

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
      return new Response('Forbidden - You can only delete files you uploaded', { status: 403 });
    }

    // Delete the actual file from R2 bucket
    await env.STORAGE_BUCKET.delete(metadata.r2Key);

    // Delete file metadata from KV
    await env.DEMO_KV.delete(`file:${fileId}`);

    // Remove file ID from user's file index
    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await env.DEMO_KV.get(userFilesKey);
    
    if (userFilesJson) {
      const userFiles: string[] = JSON.parse(userFilesJson);
      const updatedFiles = userFiles.filter(id => id !== fileId);
      
      if (updatedFiles.length > 0) {
        await env.DEMO_KV.put(userFilesKey, JSON.stringify(updatedFiles));
      } else {
        // If no files left, delete the user's file index
        await env.DEMO_KV.delete(userFilesKey);
      }
    }

    return Response.json({
      success: true,
      fileId,
      filename: metadata.originalName,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    return new Response('Failed to delete file: ' + error.message, { status: 500 });
  }
};