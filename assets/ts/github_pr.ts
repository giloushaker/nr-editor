// Creates a pull request on a data repo straight from the browser (github REST api is CORS-open).
// Flow: resolve base repo/branch -> fork if no push access -> create blobs/tree/commit -> branch -> PR.
export interface PRFileChange {
  // local fullFilePath; the repo path is resolved by matching the filename against the base tree
  path: string;
  content: string | Uint8Array;
}

async function api(token: string, method: string, path: string, body?: unknown) {
  const resp = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = resp.status === 204 ? {} : await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(json.message ? `github: ${json.message}` : `github: http ${resp.status}`);
  }
  return json;
}

function toBase64(data: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < data.length; i += chunk) {
    binary += String.fromCharCode(...data.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function createDataPR(opts: {
  token: string;
  owner: string;
  repo: string;
  files: PRFileChange[];
  title: string;
  body?: string;
  branch: string;
}): Promise<string> {
  const { token, owner, repo } = opts;
  if (!opts.files.length) throw new Error("No changed files to include in the PR");

  const user = await api(token, "GET", "/user");
  const base = await api(token, "GET", `/repos/${owner}/${repo}`);
  const baseBranch = base.default_branch;

  let headOwner = owner;
  let headRepo = repo;
  if (!base.permissions?.push) {
    const fork = await api(token, "POST", `/repos/${owner}/${repo}/forks`);
    headOwner = user.login;
    headRepo = fork.name;
    // fork creation is async on github's side
    for (let i = 0; i < 10; i++) {
      try {
        await api(token, "GET", `/repos/${headOwner}/${headRepo}`);
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    // sync an existing stale fork so the upstream head sha exists in it
    try {
      await api(token, "POST", `/repos/${headOwner}/${headRepo}/merge-upstream`, { branch: baseBranch });
    } catch {}
  }

  const ref = await api(token, "GET", `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`);
  const baseSha = ref.object.sha;
  const baseCommit = await api(token, "GET", `/repos/${owner}/${repo}/git/commits/${baseSha}`);
  const baseTree = await api(token, "GET", `/repos/${owner}/${repo}/git/trees/${baseCommit.tree.sha}?recursive=1`);

  const treeItems = [];
  for (const file of opts.files) {
    const name = file.path.replaceAll("\\", "/").split("/").pop()!;
    const existing = (baseTree.tree as Array<{ path: string; type: string }>).find(
      (t) => t.type === "blob" && (t.path === file.path || t.path === name || t.path.endsWith(`/${name}`)),
    );
    const blob =
      typeof file.content === "string"
        ? await api(token, "POST", `/repos/${headOwner}/${headRepo}/git/blobs`, {
            content: file.content,
            encoding: "utf-8",
          })
        : await api(token, "POST", `/repos/${headOwner}/${headRepo}/git/blobs`, {
            content: toBase64(file.content),
            encoding: "base64",
          });
    // new files land at the repo root, matching the existing revision-lookup convention
    treeItems.push({ path: existing?.path ?? name, mode: "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await api(token, "POST", `/repos/${headOwner}/${headRepo}/git/trees`, {
    base_tree: baseCommit.tree.sha,
    tree: treeItems,
  });
  const commit = await api(token, "POST", `/repos/${headOwner}/${headRepo}/git/commits`, {
    message: opts.title,
    tree: newTree.sha,
    parents: [baseSha],
  });
  await api(token, "POST", `/repos/${headOwner}/${headRepo}/git/refs`, {
    ref: `refs/heads/${opts.branch}`,
    sha: commit.sha,
  });
  const pr = await api(token, "POST", `/repos/${owner}/${repo}/pulls`, {
    title: opts.title,
    body: opts.body || "",
    base: baseBranch,
    head: headOwner === owner ? opts.branch : `${headOwner}:${opts.branch}`,
  });
  return pr.html_url as string;
}
