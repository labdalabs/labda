---
name: use-supabase-storage
description: Use when the user asks to "add file uploads", "wire Supabase Storage", "store user content", "serve assets", "resumable upload", "signed URL", or "attach a file". Creates a bucket with RLS, a Drizzle metadata table, and the upload + serve flow (direct browser by default, backend-mediated when justified).
---

# use-supabase-storage

Add file uploads or serve assets via Supabase Storage. Backend stores the file's metadata in a Drizzle table; the bytes live in a Storage bucket. Default to direct browser uploads gated by RLS; use backend-mediated uploads only when there's a specific reason.

## When to use

- A feature needs to attach a file to a domain record (attachment, profile photo, document).
- A feature needs to serve project assets with CDN caching.
- A feature needs gated access to user content (signed URLs).

## Inputs to confirm

1. **Bucket name and visibility** (public assets vs private user content).
2. **Path convention** — typically `<workspace-id>/<resource-id>/<filename>` for tenancy.
3. **File-size limit and allowed MIME types**.
4. **Metadata table** — what Drizzle table will hold the reference.
5. **Upload flow** — direct browser (default) or backend-mediated (justify).

## Steps

### 1. Declare the bucket in a migration

`supabase/migrations/<timestamp>_create_attachments_bucket.sql`:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('attachments', 'attachments', false, 50 * 1024 * 1024, null);
```

Set `public` to `true` for asset buckets (CDN-served, no signed URL needed).

### 2. Write RLS policies for private buckets

```sql
-- Members can read attachments in their workspace.
create policy "members read attachments"
on storage.objects for select using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id from workspace_member where user_id = auth.uid()
  )
);

create policy "members write attachments"
on storage.objects for insert with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id from workspace_member where user_id = auth.uid()
  )
);

create policy "members update their own attachments"
on storage.objects for update using (
  bucket_id = 'attachments'
  and owner = auth.uid()
);

create policy "members delete their own attachments"
on storage.objects for delete using (
  bucket_id = 'attachments'
  and owner = auth.uid()
);
```

Default-deny; only the policies above grant access.

### 3. Add the Drizzle metadata table

In `libs/core/common/src/lib/db/schema.ts`:

```ts
export const attachment = pgTable('attachment', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspace.id),
  uploaderId: uuid('uploader_id').notNull(),
  bucket: text('bucket').notNull(),
  objectPath: text('object_path').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
```

Generate the Drizzle migration (`add-drizzle-table` skill).

### 4. Direct browser upload (default)

`libs/shared/client/ui/src/hooks/use-upload-attachment.ts`:

```ts
'use client';
import { useState } from 'react';
import { browserClient } from '@/lib/supabase';

export function useUploadAttachment(workspaceId: string, resourceId: string) {
  const supabase = browserClient();
  const [uploading, setUploading] = useState(false);

  async function upload(file: File): Promise<{ bucket: string; objectPath: string } | null> {
    setUploading(true);
    const objectPath = `${workspaceId}/${resourceId}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from('attachments')
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) return null;
    return { bucket: 'attachments', objectPath };
  }

  return { upload, uploading };
}
```

After upload succeeds, call a backend mutation to register the attachment row:

```ts
const ref = await upload(file);
if (ref) {
  await registerAttachment({
    workspaceId, resourceId,
    bucket: ref.bucket, objectPath: ref.objectPath,
    fileName: file.name, contentType: file.type, sizeBytes: file.size,
  });
}
```

The backend `register` method validates the user has access and inserts the row.

### 5. Backend-mediated upload (when needed)

When validation, transformation, or strict gating is required, route through Nest. Add a REST controller (see the `add-rest-endpoint` skill):

```ts
@Post('attachments')
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
async upload(
  @CurrentUser() user: AuthenticatedUser,
  @Body('workspaceId') workspaceId: string,
  @Body('resourceId') resourceId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  await this.workspaceAccess.assertCanEdit(user.userId, workspaceId);
  // validate, scan, transform...
  const objectPath = `${workspaceId}/${resourceId}/${randomUUID()}-${file.originalname}`;
  const { error } = await this.supabaseAdmin.storage
    .from('attachments').upload(objectPath, file.buffer, { contentType: file.mimetype });
  if (error) throw new InternalServerErrorException(error.message);
  return this.attachmentService.register({
    workspaceId, resourceId, uploaderId: user.userId,
    bucket: 'attachments', objectPath,
    fileName: file.originalname, contentType: file.mimetype, sizeBytes: file.size,
  });
}
```

The `supabaseAdmin` is a service-role client (created once in a Nest provider).

### 6. Serving files

**Public bucket:**

```ts
const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
return data.publicUrl;
```

**Private bucket (signed URL, 1h expiry):**

```ts
const { data, error } = await supabase.storage
  .from('attachments').createSignedUrl(objectPath, 3600);
if (error) throw new InternalServerErrorException(error.message);
return data.signedUrl;
```

Don't persist signed URLs — they expire. Always re-generate per request.

### 7. Resumable uploads (large files)

For files > 50 MB, use the TUS resumable endpoint:

```ts
import { Upload } from 'tus-js-client';

const upload = new Upload(file, {
  endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
  retryDelays: [0, 3000, 5000, 10000, 20000],
  headers: {
    authorization: `Bearer ${session.access_token}`,
    'x-upsert': 'false',
  },
  chunkSize: 6 * 1024 * 1024,
  metadata: {
    bucketName: 'attachments',
    objectName: objectPath,
    contentType: file.type,
  },
  onSuccess: () => { /* register attachment row */ },
});
upload.start();
```

### 8. Deletion

Use a domain event (`AttachmentDeletedEvent`) so the storage delete happens reliably after the DB delete commits. The owning context's queue consumer calls `supabase.storage.from(bucket).remove([path])` and tolerates "already gone" errors.

## Rules

- **DO** prefix object paths with the tenancy ID (workspace/project) so RLS policies can parse them.
- **DO** write RLS policies for every operation on every private bucket. Default-deny.
- **DO** persist `(bucket, object_path)` — not signed URLs.
- **DO** prefer direct browser uploads. Reach for backend-mediated only when you have a reason.
- **DO** add a domain event for delete; don't try to make DB + storage delete atomic.
- **DON'T** set a bucket public unless you genuinely want every object world-readable.
- **DON'T** store the file size on the client only — verify on the metadata-row insert.

## References

- ADR-0022: Storage via Supabase Storage
- ADR-0019: Supabase as managed infrastructure backbone
- `add-drizzle-table` skill (for the metadata table)
- `add-rest-endpoint` skill (for backend-mediated upload)
- `add-domain-event` skill (for the deletion fan-out)
