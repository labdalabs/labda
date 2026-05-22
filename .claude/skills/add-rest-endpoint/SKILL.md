---
name: add-rest-endpoint
description: Use when the user asks to "add a REST controller", "add an HTTP endpoint", "wire an OAuth callback", "add a webhook handler" (Stripe/Slack/GitHub/Linear), "upload endpoint", or any case GraphQL doesn't fit cleanly. Adds a Nest @Controller with class-validator DTOs, auth decorators, and proper status codes.
---

# add-rest-endpoint

Add a NestJS REST controller or endpoint. REST is the escape hatch for cases GraphQL can't handle: OAuth callbacks, third-party webhooks, file uploads (multipart), idempotency-key APIs, redirect endpoints. For ordinary product reads/writes, use GraphQL instead (see `add-graphql-operation`).

## When to use REST (NOT GraphQL)

- **OAuth callback** — provider redirects to a URL we don't control the shape of.
- **Webhook receiver** — Stripe, Slack, GitHub, Linear, Twilio, etc. Requires raw body access for signature verification.
- **File upload** — multipart/form-data.
- **Streaming / SSE / chunked response** — though for AI chat use the assistant-ui flow (`add-in-ui-assistant`).
- **Redirect endpoint** — sign-in initiation, social share URLs, short-link expansion.
- **Provider-driven URL** — the path is dictated by the third party.

If none of those apply, use GraphQL.

## Inputs to confirm

1. **Path** — typically grouped by context: `auth/google/callback`, `webhooks/stripe`, `files/upload`.
2. **HTTP verb(s)** — GET / POST / PUT / DELETE.
3. **Auth** — does it need `@Public()` (webhooks, OAuth callbacks) or default-auth (file uploads from logged-in users)?
4. **Body shape** — class-validator DTO.
5. **Response shape** — typed DTO or redirect.

## Steps

1. **Locate the owning bounded context.** The controller goes in `libs/<area>/<context>/src/lib/`. For shared concerns (health, webhooks fanout) it goes in `libs/core/common/`.

2. **Create the DTO** in `<context>.models.ts` (or `dto/<name>.dto.ts` if you have a dto folder):

   ```ts
   import { IsEmail, IsOptional, IsString } from 'class-validator';

   export class CreateInvoiceDto {
     @IsString() workspaceId!: string;
     @IsString() lineItem!: string;
     @IsOptional() @IsString() reason?: string;
   }
   ```

3. **Create or extend `<context>.controller.ts`**:

   ```ts
   import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
   import type { RawBodyRequest, Request } from 'express';
   import { AuthenticatedUser, CurrentUser, Public, Roles } from '@<project>/core-common';
   import { UserRole } from '@<project>/models';
   import { BillingService } from './billing.service';
   import { CreateInvoiceDto } from './dto/create-invoice.dto';

   @Controller({ version: '1.0', path: 'billing' })
   export class BillingController {
     constructor(private readonly billingService: BillingService) {}

     @Roles(UserRole.WORKSPACE_ADMIN)
     @Post('invoices')
     async createInvoice(
       @CurrentUser() user: AuthenticatedUser,
       @Body() dto: CreateInvoiceDto,
     ) {
       return this.billingService.createInvoice(user, dto);
     }
   }
   ```

4. **Register the controller** in `<context>.module.ts`:

   ```ts
   @Module({
     controllers: [BillingController],
     providers: [BillingService, BillingFacade, /* ... */],
     exports: [BillingFacade],
   })
   export class BillingModule {}
   ```

## OAuth callback pattern

```ts
@Public()
@Get('callback')
async callback(
  @Query('code') code: string,
  @Query('state') state: string,
  @Res() res: Response,
) {
  await this.integrationService.completeOAuth(code, state);
  return res.redirect(`${this.config.frontendUrl}/integrations`);
}
```

- `@Public()` because the user isn't yet authenticated at this step (or the provider doesn't include our session).
- Verify `state` against what we issued.
- Redirect back to the frontend on success / failure.

## Webhook pattern

```ts
@Public()
@Post('stripe')
@HttpCode(200)
async stripeWebhook(
  @Headers('stripe-signature') sig: string,
  @Req() req: RawBodyRequest<Request>,
) {
  if (!req.rawBody) throw new BadRequestException('Raw body required');
  await this.billingService.processStripeWebhook(sig, req.rawBody);
  return { received: true };
}
```

Requirements:

- `@Public()` — Stripe (and other providers) don't have our session.
- `rawBody: true` in `NestFactory.create()` (already set in `apps/core/src/main.ts`). Without it, signature verification fails.
- `@HttpCode(200)` — providers retry on non-200. Acknowledge fast; do work asynchronously if it's heavy (publish a `IntegrationWebhookReceivedEvent` and let a queue handler do the work).
- Verify the signature BEFORE doing anything else. An unverified webhook is a forged request.

## File upload pattern

```ts
@Post('files')
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
async uploadFile(
  @CurrentUser() user: AuthenticatedUser,
  @UploadedFile() file: Express.Multer.File,
) {
  return this.filesService.upload(user, file);
}
```

- Limit file size in the interceptor.
- Validate content-type if you care.
- Store the file (S3, disk, etc.) in the service, not the controller.

## Versioning

The app already enables header-based versioning (`X-API-Version`, default `1.0`). For a breaking change, declare a new version on the controller:

```ts
@Controller({ version: '2.0', path: 'billing' })
```

Run both versions in parallel until clients migrate.

## Rules

- **DO** use class-validator on every DTO field. The global `ValidationPipe` enforces it.
- **DO** use `@Roles()` / `@Public()` / `@CurrentUser()` — don't read the request directly.
- **DO** delegate to a service. The controller is a thin adapter (status codes, redirects, raw-body handling).
- **DO** verify webhook signatures before any side effect.
- **DO** return early on errors with the right HTTP exception (`NotFoundException`, `BadRequestException`, `UnauthorizedException`, `ForbiddenException`).
- **DON'T** use REST for ordinary CRUD when GraphQL is available.
- **DON'T** disable the global `ValidationPipe` per route. The strict default is correct (override per-route only for the assistant-ui chat endpoint — see ADR-0017).
- **DON'T** put business logic in the controller.

## References

- ADR-0007: GraphQL-first API (with REST as escape hatch)
- ADR-0013: Session-based auth (the auth model your controller inherits)
- ADR-0004: Domain module file convention (`<context>.controller.ts` lives here)
