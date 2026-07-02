import { Test, TestingModule } from '@nestjs/testing';
import { ResearchFacade } from '@labda/core-research';
import { ProtocolFacade } from '@labda/core-protocol';
import type { AuthenticatedUser } from '@labda/core-common';
import { CopilotService } from './copilot.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'r@lab.test',
  role: 'authenticated',
};

describe('CopilotService', () => {
  let service: CopilotService;
  let research: { getHypothesis: jest.Mock; listReferences: jest.Mock };
  let protocol: { getProtocol: jest.Mock };
  let module: TestingModule;

  beforeEach(async () => {
    research = { getHypothesis: jest.fn(), listReferences: jest.fn() };
    protocol = { getProtocol: jest.fn() };
    module = await Test.createTestingModule({
      providers: [
        CopilotService,
        { provide: ResearchFacade, useValue: research },
        { provide: ProtocolFacade, useValue: protocol },
      ],
    }).compile();
    service = module.get(CopilotService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('challengeHypothesis returns grounded contradictions + logic gaps', async () => {
    research.getHypothesis.mockResolvedValue({
      id: 'h1',
      statement: 'CRISPR increases crop yield.',
    });
    research.listReferences.mockResolvedValue([
      {
        id: 'ref-1',
        title: 'Field trial',
        abstract: 'CRISPR did not increase crop yield; no significant effect.',
        url: 'http://x/1',
      },
    ]);

    const findings = await service.challengeHypothesis(user, 'h1');
    const contradiction = findings.find((f) => f.kind === 'contradicts');
    expect(contradiction).toBeDefined();
    expect(contradiction!.referenceId).toBe('ref-1');
    expect(contradiction!.quote).toBeTruthy();
    // logic gaps are also grounded push-backs
    expect(findings.some((f) => f.kind === 'logic_gap')).toBe(true);
  });

  it('findContradictingEvidence filters to contradictions only', async () => {
    research.getHypothesis.mockResolvedValue({
      id: 'h1',
      statement: 'X increases Y compared to control because of Z.',
    });
    research.listReferences.mockResolvedValue([
      { id: 'a', title: 'A', abstract: 'X increased Y.', url: null },
      { id: 'b', title: 'B', abstract: 'X did not increase Y; no effect.', url: null },
    ]);
    const findings = await service.findContradictingEvidence(user, 'h1');
    expect(findings.every((f) => f.kind === 'contradicts')).toBe(true);
    expect(findings).toHaveLength(1);
    expect(findings[0].referenceId).toBe('b');
  });

  it('challengeProtocol flags missing steps from the notebook', async () => {
    protocol.getProtocol.mockResolvedValue({
      id: 'p1',
      notebook: JSON.stringify({
        cells: [{ cell_type: 'code', source: 'print("measure plants")' }],
      }),
    });
    const findings = await service.challengeProtocol(user, 'p1');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.kind === 'missing_step')).toBe(true);
  });
});
