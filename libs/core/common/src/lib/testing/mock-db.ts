// Drizzle query builders are chainable and await-able. The mock returned here
// behaves like one, with every chain method returning the mock itself, so a
// service under test can run any sequence of `.select().from().where()` calls.
// Stub specific results via the jest.fn handles:
//
//   const db = mockDbConnection();
//   db.execute.mockResolvedValueOnce({ rows: [{ id: '1' }] });
//   db.returning.mockResolvedValueOnce([{ id: 'new' }]);
//
// The default `execute` returns one row so `select 1` style health checks pass.

export interface MockDb {
  select: jest.Mock;
  selectDistinct: jest.Mock;
  from: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  onConflictDoUpdate: jest.Mock;
  onConflictDoNothing: jest.Mock;
  update: jest.Mock;
  set: jest.Mock;
  delete: jest.Mock;
  leftJoin: jest.Mock;
  innerJoin: jest.Mock;
  rightJoin: jest.Mock;
  fullJoin: jest.Mock;
  groupBy: jest.Mock;
  having: jest.Mock;
  with: jest.Mock;
  as: jest.Mock;
  returning: jest.Mock;
  execute: jest.Mock;
  transaction: jest.Mock;
  $client: { end: jest.Mock };
}

export function mockDbConnection(): MockDb {
  const chain = (): jest.Mock => jest.fn(() => db);
  const db: MockDb = {
    select: chain(),
    selectDistinct: chain(),
    from: chain(),
    where: chain(),
    orderBy: chain(),
    limit: chain(),
    offset: chain(),
    insert: chain(),
    into: chain(),
    values: chain(),
    onConflictDoUpdate: chain(),
    onConflictDoNothing: chain(),
    update: chain(),
    set: chain(),
    delete: chain(),
    leftJoin: chain(),
    innerJoin: chain(),
    rightJoin: chain(),
    fullJoin: chain(),
    groupBy: chain(),
    having: chain(),
    with: chain(),
    as: chain(),
    returning: jest.fn().mockResolvedValue([]),
    execute: jest.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    transaction: jest.fn((fn: (tx: MockDb) => unknown) => Promise.resolve(fn(db))),
    $client: { end: jest.fn().mockResolvedValue(undefined) },
  };
  return db;
}
