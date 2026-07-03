'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getProject } from '@/lib/research/queries';
import type { Project } from '@/lib/research/types';
import { ShareProject } from './share-project';

// Project settings — currently collaboration (who can see and edit the project
// and its knowledge board). Kept separate from the work surface so the graph
// stays focused on the research itself.
export function ProjectSettings({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    let live = true;
    getProject(projectId)
      .then((p) => live && setProject(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId]);

  return (
    <section className="mx-auto max-w-2xl space-y-8 p-8" data-testid="project-settings">
      <header className="space-y-1">
        <Link
          href={`/app/projects/${projectId}`}
          className="text-sm text-muted-foreground underline"
        >
          ← {project?.title ?? 'Project'}
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage who can access this project.
        </p>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Collaboration
        </h2>
        <ShareProject projectId={projectId} />
      </div>
    </section>
  );
}
