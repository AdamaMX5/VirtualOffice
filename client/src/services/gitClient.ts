const GIT_SERVICE_URL = 'https://git.freischule.info';

export interface GitRepo {
  name:     string;
  fullName: string;
  url:      string;
}

export interface CreatedIssue {
  number: number;
  url:    string;
}

/** Fetches all repositories from GitService. Requires a valid JWT. */
export async function listRepos(jwt: string): Promise<GitRepo[]> {
  const res = await fetch(`${GIT_SERVICE_URL}/repos`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(data.error ?? data.message ?? `GitService error ${res.status}`));
  }
  return res.json() as Promise<GitRepo[]>;
}

/** Creates a new GitHub issue via GitService. Requires a valid JWT. */
export async function createIssue(
  jwt:     string,
  repo:    string,
  title:   string,
  body:    string,
  labels?: string[],
): Promise<CreatedIssue> {
  const res = await fetch(`${GIT_SERVICE_URL}/issue`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repo, title, body, labels }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(data.error ?? data.message ?? `GitService error ${res.status}`));
  }
  return res.json() as Promise<CreatedIssue>;
}
