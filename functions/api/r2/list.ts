// /functions/api/r2/list.ts
// Lists files for the authenticated user
// Returns file metadata with storage tier information based on age

interface Env {
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

interface FileWithTier extends FileMetadata {
  tier: 'standard' | 'infrequent';
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    // Get authenticated user email from Cloudflare Access header
    const userEmail = request.headers.get('cf-access-authenticated-user-email');
    
    if (!userEmail) {
      return new Response('Unauthorized - No authenticated user', { status: 401 });
    }

    // Get user's file list from KV
    const userFilesKey = `user_files:${userEmail}`;
    const userFilesJson = await env.DEMO_KV.get(userFilesKey);
    
    if (!userFilesJson) {
      // User has no files yet
      return Response.json({
        files: [],
        count: 0,
        userEmail
      });
    }

    const fileIds: string[] = JSON.parse(userFilesJson);
    const files: FileWithTier[] = [];

    // Fetch metadata for each file
    for (const fileId of fileIds) {
      const metadataJson = await env.DEMO_KV.get(`file:${fileId}`);
      
      if (metadataJson) {
        const metadata: FileMetadata = JSON.parse(metadataJson);
        
        // Calculate storage tier based on age (30 days = 30 * 24 * 60 * 60 * 1000 ms)
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const fileAge = Date.now() - metadata.uploadedAt;
        const tier: 'standard' | 'infrequent' = fileAge > thirtyDaysMs ? 'infrequent' : 'standard';

        files.push({
          ...metadata,
          tier
        });
      }
    }

    // Sort files by upload date (newest first)
    files.sort((a, b) => b.uploadedAt - a.uploadedAt);

    return Response.json({
      files,
      count: files.length,
      userEmail
    });

  } catch (error) {
    console.error('List files error:', error);
    return new Response('Failed to list files: ' + error.message, { status: 500 });
  }
};