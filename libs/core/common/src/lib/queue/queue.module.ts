import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DbModule } from '../db/db.module';
import { QueueService } from './queue.service';
import { QueueWorker } from './queue.worker';

@Global()
@Module({
  imports: [DiscoveryModule, DbModule],
  providers: [QueueService, QueueWorker],
  exports: [QueueService],
})
export class QueueModule {}
