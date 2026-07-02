import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import type { AuthenticatedUser } from '@labda/core-common';
import { LiteratureService } from '../literature.service';

interface AuthedRequest {
  user?: AuthenticatedUser;
}

const searchLiteratureParameters = z.object({
  query: z.string().min(1).describe('Free-text literature search query.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Maximum number of results (default 10).'),
});

type SearchLiteratureParams = z.infer<typeof searchLiteratureParameters>;

@Injectable()
export class SearchLiteratureTool {
  constructor(private readonly literatureService: LiteratureService) {}

  @Tool({
    name: 'search_literature',
    description:
      'Search the published literature (Semantic Scholar corpus) for papers ' +
      'matching a query. Returns title, authors, year, venue and a source link.',
    parameters: searchLiteratureParameters,
  })
  async execute(
    params: SearchLiteratureParams,
    _ctx: unknown,
    req: AuthedRequest,
  ) {
    const user = req?.user;
    if (!user) throw new UnauthorizedException();
    const results = await this.literatureService.searchLiterature(user, params);
    return {
      content: [{ type: 'text', text: JSON.stringify(results) }],
    };
  }
}
