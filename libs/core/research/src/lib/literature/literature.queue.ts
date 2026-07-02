import { Injectable, Logger } from '@nestjs/common';
import { QueueHandler } from '@labda/core-common';
import { LiteratureService } from './literature.service';
import {
  REFERENCE_EMBED_QUEUE,
  type ReferenceEmbedJob,
} from './literature.models';

// Polls the reference.embed pgmq queue and computes the embedding for each
// attached Reference off the request path.
@Injectable()
export class LiteratureQueue {
  private readonly logger = new Logger(LiteratureQueue.name);

  constructor(private readonly literatureService: LiteratureService) {}

  @QueueHandler(REFERENCE_EMBED_QUEUE, { visibilityTimeoutSec: 60 })
  async handleEmbed(message: ReferenceEmbedJob): Promise<void> {
    this.logger.debug({ message }, 'Embedding Reference');
    await this.literatureService.embedReference(message.referenceId);
  }
}
