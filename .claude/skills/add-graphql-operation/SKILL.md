---
name: add-graphql-operation
description: Use when the user asks to "add a GraphQL query", "add a mutation", "add a subscription", "expose X on the GraphQL API", "add a resolver field", or "wire a graphql endpoint". Adds an @ObjectType / @InputType + resolver method with auth, validation, and (when needed) DataLoader.
---

# add-graphql-operation

Add a GraphQL Query, Mutation, Subscription, or resolved field. The codebase uses code-first GraphQL via `@nestjs/apollo` — types are derived from decorated classes.

## When to use

- The user wants to read or write product data from the frontend.
- A new piece of data needs to be reachable from Apollo Client.
- An existing type needs a new resolved field.
- A subscription / live update is needed.

For OAuth callbacks, webhooks, file uploads, redirects — use `add-rest-endpoint` instead.

## Inputs to confirm

1. **Operation kind** — Query, Mutation, Subscription, or ResolveField.
2. **Type name** — return type for queries / mutations.
3. **Input shape** — `@InputType` with class-validator decorators.
4. **Authorization** — `@Public()`, `@Roles()`, or default-auth?
5. **Owning bounded context** — the resolver goes there.

## Steps

1. **Locate `<context>.models.ts`.** Add the output `@ObjectType` (if not already there) and any new `@InputType`:

   ```ts
   import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
   import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
   import { OrderStatus } from '@<project>/models';

   registerEnumType(OrderStatus, { name: 'OrderStatus' });

   @ObjectType()
   export class Order {
     @Field() id!: string;
     @Field() workspaceId!: string;
     @Field(() => OrderStatus) status!: OrderStatus;
     @Field(() => Date) createdAt!: Date;
   }

   @InputType()
   export class CreateOrderInput {
     @Field() @IsUUID() workspaceId!: string;
     @Field() @IsString() name!: string;
     @Field({ nullable: true }) @IsOptional() @IsString() note?: string;
   }
   ```

2. **Add the resolver method** in `<context>.resolver.ts`:

   ```ts
   @Resolver(() => Order)
   export class OrderResolver {
     constructor(private readonly orderService: OrderService) {}

     // Query
     @Roles(UserRole.WORKSPACE_MEMBER, UserRole.WORKSPACE_ADMIN)
     @Query(() => [Order])
     async orders(@CurrentUser() user: AuthenticatedUser): Promise<Order[]> {
       return this.orderService.listOrders(user.userId);
     }

     // Mutation
     @Roles(UserRole.WORKSPACE_ADMIN)
     @Mutation(() => Order)
     async createOrder(
       @CurrentUser() user: AuthenticatedUser,
       @Args('input') input: CreateOrderInput,
     ): Promise<Order> {
       return this.orderService.createOrder(user, input);
     }

     // Resolved field
     @ResolveField(() => [OrderLineItem])
     async lineItems(@Parent() order: Order): Promise<OrderLineItem[]> {
       return this.orderLineItemLoader.load(order.id);
     }
   }
   ```

3. **Implement the service method** — business logic in `<context>.service.ts`. Wrap multi-write operations in `db.transaction`. Publish events when invariants change.

4. **Add a spec case** in `<context>.service.spec.ts` for the new behavior.

5. **For nested fields (`@ResolveField`)** — prevent N+1 with a DataLoader.

## DataLoader (N+1 prevention)

If your `@ResolveField` queries the DB for each parent, Apollo will call it once per parent in a list. Use a DataLoader to batch.

1. **Create `<feature>.dataloader.ts`** in the owning context:

   ```ts
   import { Injectable, Scope } from '@nestjs/common';
   import DataLoader from 'dataloader';

   @Injectable({ scope: Scope.REQUEST })
   export class OrderLineItemLoader extends DataLoader<string, OrderLineItem[]> {
     constructor(private readonly orderService: OrderService) {
       super(async (orderIds) => {
         const items = await orderService.listLineItemsByOrderIds(orderIds as string[]);
         return orderIds.map((id) => items.filter((it) => it.orderId === id));
       });
     }
   }
   ```

2. **Register as a provider** in `<context>.module.ts`.

3. **Inject and use** in the resolver:

   ```ts
   @ResolveField(() => [OrderLineItem])
   async lineItems(@Parent() order: Order): Promise<OrderLineItem[]> {
     return this.orderLineItemLoader.load(order.id);
   }
   ```

The `DataLoaderInterceptor` (registered globally in `CommonModule`) makes the loader request-scoped automatically.

## Subscription

For live updates, use a subscription backed by `graphql-redis-subscriptions`:

```ts
@Subscription(() => Order, {
  filter: (payload, _vars, ctx) => payload.orderUpdated.workspaceId === ctx.currentWorkspaceId,
})
orderUpdated() {
  return this.pubsub.asyncIterator('ORDER_UPDATED');
}
```

Publish from the service when state changes:

```ts
await this.pubsub.publish('ORDER_UPDATED', { orderUpdated: order });
```

Subscription auth inherits from the session — `decorateGQLSubscriptionRequest` (in `apps/core/src/app/session.helper.ts`) replays the session middleware on the websocket upgrade.

## Authorization rules

- **`@Public()`** — only on operations that genuinely have no user context (e.g., redeeming an invitation token).
- **`@Roles(UserRole.X, UserRole.Y)`** — require at least one of the listed roles.
- **`@CurrentUser()`** — injects the authenticated user object.
- **Multi-tenant scope** — guards don't carve workspaces. Every resolver that touches workspace data MUST verify `user.primaryWorkspaceId === resource.workspaceId` (or query within the user's scope).

## Rules

- **DO** decorate every input field with class-validator (`@IsUUID`, `@IsEmail`, `@IsEnum`, `@IsOptional`, `@IsDateString`, ...).
- **DO** register enums with `registerEnumType` once per enum.
- **DO** keep resolvers thin — delegate to the service.
- **DO** add a DataLoader for any nested field that fans out to the DB.
- **DO** verify multi-tenant scope in the resolver or service.
- **DON'T** return raw Drizzle row types. Map to DTOs at the service edge.
- **DON'T** use `any` in resolver signatures. Decorate or type fully.
- **DON'T** add `@Public()` reflexively. Each `@Public()` is a security-review item.

## References

- ADR-0007: GraphQL-first API with Apollo + class-validator
- ADR-0013: Auth decorators (`@CurrentUser`, `@Roles`, `@Public`)
- ADR-0006: Drizzle transactions (for the service layer behind the resolver)
