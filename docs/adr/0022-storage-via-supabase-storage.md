# ADR-0022: Storage via Supabase Storage

## TL;DR

Use Supabase Storage for user-uploaded files and project assets. Buckets are either **public** (assets, profile photos, anything safe to expose) or **private** (user content, gated by RLS or signed URLs). Backend stores file **metadata** in Drizzle tables (with a stable reference to `bucket` + `object_path`); the actual bytes live in Storage. Default to **direct browser-to-Storage uploads** for large files (signed upload URLs + RLS); use **backend-mediated uploads** only when transformation, validation, or strict gating is required.

**Status:** Accepted
**Date:** 2026-05-11
**Applies to:** projects on the Supabase variant (ADR-0019) that handle file uploads or serve assets.

## Context

The standard stack has no documented file-storage decision. Projects ad-hoc reach for S3, R2, GCS, or local disk. Supabase Storage is a managed S3-compatible offering with RLS-aware access control, signed URLs, image transformations, and resumable uploads. It's the natural fit for the Supabase variant.

We need:

- A consistent place to store user uploads (avatars, attachments, document files).
- A way to serve public assets with CDN caching.
- A way to gate private files by user identity / membership.
- A way to handle large files (resumable upload) without backend bottlenecks.
- Schema and policy that travel with our migrations.

## Decision

### Bucket layout

Buckets are top-level namespaces. Create them via `supabase/migrations/*.sql` so they're versioned:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars',      'avatars',      true,  5 * 1024 * 1024, array['image/png','image/jpeg','image/webp']),
  ('attachments',  'attachments',  false, 50 * 1024 * 1024, null),
  ('documents',    'documents',    false, 100 * 1024 * 1024, null);
```

Convention:
- One bucket per **purpose**, not per **tenant**. Tenancy is enforced via RLS on `object_path`.
- Object path follows `<workspace-id>/<resource-id>/<filename>` so RLS policies can parse the path and check membership.
- File-size limits and MIME-type allowlists set at the bucket level — Storage enforces them.

### Metadata in Drizzle

For any file that participates in the domain model (document attachments, message attachments, profile photos with a record), maintain a Drizzle table:

```ts
export const attachment = pgTable('attachment', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull(),
  uploaderId: uuid('uploader_id').notNull(),
  bucket: text('bucket').notNull(),
  objectPath: text('object_path').notNull(),
  fileName: text('file_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});
```

The `(bucket, object_path)` pair is the stable reference into Storage. Never persist signed URLs — they expire.

### Access control

Two layers, parallel to ADR-0019:

- **Public buckets** — content served directly via the public CDN URL. No auth, no signed URL. Use for safe-to-expose assets.
- **Private buckets** with RLS — the browser anon client can upload/download only objects it has access to via RLS policies on `storage.objects`:

```sql
-- Workspace members can read attachments in their workspace.
create policy "members read attachments"
on storage.objects for select using (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id from workspace_member where user_id = auth.uid()
  )
);

-- Workspace members can upload to their own workspace folder.
create policy "members write attachments"
on storage.objects for insert with check (
  bucket_id = 'attachments'
  and (storage.foldername(name))[1]::uuid in (
    select workspace_id from workspace_member where user_id = auth.uid()
  )
);
```

Update / delete policies are written the same way. Default-deny; allow only what's intentional.

### Upload flows

**Direct browser upload (default for large files):**

```ts
const supabase = createBrowserClient(/* url, anon key */);
const { data, error } = await supabase.storage
  .from('attachments')
  .upload(`${workspaceId}/${resourceId}/${fileName}`, file, {
    contentType: file.type,
    upsert: false,
  });
```

RLS gates the upload. After success, the frontend calls a backend mutation to register the attachment row in our DB.

**Backend-mediated upload** (when validation, virus scanning, transformation, or strict server-side gating is required):

```ts
@Post('attachments')
async upload(
  @CurrentUser() user: AuthenticatedUser,
  @UploadedFile() file: Express.Multer.File,
) {
  await this.attachmentAccess.assertCanUpload(user, params.workspaceId);
  const objectPath = `${workspaceId}/${resourceId}/${randomUUID()}-${file.originalname}`;
  const { error } = await this.supabaseAdmin.storage
    .from('attachments').upload(objectPath, file.buffer, { contentType: file.mimetype });
  if (error) throw new InternalServerErrorException(error.message);
  return this.attachmentService.register({ /* ... */ });
}
```

Default to direct uploads; reach for backend-mediated only when there's a concrete reason (server-side validation, transformation, audit trail in `before-upload` posture).

### Serving files

- **Public:** `supabase.storage.from('avatars').getPublicUrl(path)` — stable, CDN-cached.
- **Private:** `supabase.storage.from('attachments').createSignedUrl(path, 3600)` — expires; generate per-request from the backend or from the browser (if RLS allows the lookup).

### Resumable uploads

For files > ~50 MB, use the TUS-protocol resumable upload endpoint (`https://<project>.supabase.co/storage/v1/upload/resumable`). `@supabase/storage-js` supports this. Keep the chunk size reasonable (6 MB default) and write a small retry policy in the frontend.

### Deletion

- **From the backend** when a domain event marks the parent record deleted (e.g., `AttachmentDeletedEvent` → consumer calls `storage.from(bucket).remove([path])`).
- **NOT directly from the browser** unless RLS gates it AND there are no downstream cleanup obligations.

## Consequences

**Accept:**

- One bucket layout, RLS policies in migrations, signed URLs for time-limited access — covers the common cases without inventing per-project storage abstractions.
- Direct browser uploads remove the bottleneck of streaming bytes through Nest.
- Resumable uploads for large files come for free.
- Image transformations (resize, format conversion) supported via Storage's `?transform=...` URL params on Pro plans.

**Live with:**

- **RLS coverage discipline.** A bucket without policies is open. Every private bucket needs select/insert/update/delete policies appropriate to the data. Add policy tests.
- **Metadata-bytes split.** The `(bucket, object_path)` pair must stay in sync with the Drizzle row. Orphans happen (upload succeeds, DB insert fails; or vice versa). Periodic reconciliation job is worth the trouble for high-volume features.
- **No transactional file delete.** Deleting a row in the DB doesn't atomically delete the object. Use a domain event + queue consumer (ADR-0008) to perform the storage delete after commit.
- **Pricing model.** Storage egress and storage-at-rest both cost money. The free tier is generous; outgrow it and the bill is real.
- **Vendor lock-in.** Migrating off Supabase Storage requires byte-copying every object and rewriting RLS as application-level checks. Plan accordingly.

## References

- ADR-0006: Drizzle ORM with Postgres (for the metadata tables)
- ADR-0019: Supabase as managed infrastructure backbone
- ADR-0020: Auth via Supabase (the JWT/anon-key model that RLS leans on)
- `use-supabase-storage` skill in `.claude/skills/`
