import type { RawLanguageStat } from "./taxonomy.js";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

interface GraphQLResponse {
  data?: {
    user: {
      repositories: {
        nodes: Array<{
          languages: {
            edges: Array<{
              size: number;
              node: {
                name: string;
                color: string | null;
              };
            }>;
          };
        }>;
      };
    } | null;
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetches aggregated language byte counts for a GitHub user via GraphQL.
 * Queries public repositories unless `includePrivate` is explicitly enabled.
 */
export async function fetchUserLanguages(
  username: string,
  token: string,
  includePrivate = false,
): Promise<RawLanguageStat[]> {
  const privacyFilter = includePrivate ? "" : ", privacy: PUBLIC";
  const query = `
    query ($login: String!) {
      user(login: $login) {
        repositories(
          ownerAffiliations: OWNER
          isFork: false
          isArchived: false
          first: 100
          orderBy: { field: PUSHED_AT, direction: DESC }
          ${privacyFilter}
        ) {
          nodes {
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "ez-profile-lang-graphs-action",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GraphQLResponse;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((e) => e.message).join("; "));
  }
  if (!payload.data?.user) {
    throw new Error(`GitHub user "${username}" not found`);
  }

  const totals = new Map<string, RawLanguageStat>();
  for (const repo of payload.data.user.repositories.nodes) {
    for (const edge of repo.languages.edges) {
      const { name, color } = edge.node;
      const existing = totals.get(name);
      if (existing) {
        existing.bytes += edge.size;
      } else {
        totals.set(name, {
          name,
          bytes: edge.size,
          color: color ?? "#6e7681",
        });
      }
    }
  }

  return Array.from(totals.values()).sort((a, b) => b.bytes - a.bytes);
}
