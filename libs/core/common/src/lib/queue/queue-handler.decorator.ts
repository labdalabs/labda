import { SetMetadata } from '@nestjs/common';

export const QUEUE_HANDLER_METADATA = 'common:queue-handler';

export interface QueueHandlerOptions {
  // Poll interval in milliseconds. Defaults to 1000.
  pollIntervalMs?: number;
  // Visibility timeout in seconds — how long the message is hidden while in
  // flight. Defaults to 30. Must exceed the worker's expected processing time.
  visibilityTimeoutSec?: number;
  // Max read_ct before pgmq.archive() is called instead of leaving the message
  // for another retry. Defaults to 5. Set to Infinity to never archive.
  maxAttempts?: number;
}

export interface QueueHandlerMetadata extends QueueHandlerOptions {
  queueName: string;
}

// Mark a method as a pgmq queue consumer. The Nest QueueWorker discovers every
// provider on bootstrap, starts one polling loop per (provider, method) pair,
// and dispatches messages to the handler. On success the message is deleted;
// on throw it stays hidden until the visibility timeout expires and is then
// re-read (read_ct increments). Messages whose read_ct exceeds `maxAttempts`
// are archived via pgmq.archive.
//
//   @QueueHandler('user.welcome-email', { visibilityTimeoutSec: 60 })
//   handleWelcomeEmail(message: { userId: string; email: string }) { ... }
export const QueueHandler = (queueName: string, options: QueueHandlerOptions = {}) =>
  SetMetadata(QUEUE_HANDLER_METADATA, { queueName, ...options } satisfies QueueHandlerMetadata);
