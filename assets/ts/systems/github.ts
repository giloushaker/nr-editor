import type { Catalogue } from "~/assets/shared/battlescribe/bs_main_catalogue";
import { filename } from "~/electron/node_helpers";
import type { BattleScribeFile, BattleScribeRepoData } from "~/assets/shared/battlescribe/bs_import_data";
import { removeSuffix } from "~/assets/shared/battlescribe/bs_helpers";
import { file } from "jszip";
export interface GithubIntegration {
  githubUrl: string;
  githubRepo: string;
  githubOwner: string;
  githubName: string;
  repoData?: BattleScribeRepoData;
}

export function normalizeGithubRepoUrl(input: string): string | null {
  const githubUrlRegex = /^(?:(http(s?)?:\/\/)?github.com\/)?([^\/]+)\/([^\/]+)$/;
  const match = input.match(githubUrlRegex);

  if (!match) {
    return null;
  }

  const [, protocol = "https://", _, user, repo] = match;

  if (!user || !repo) {
    return null;
  }
  return `https://github.com/${user}/${repo}`;
}

async function getFileContentFromRepo(github: GithubIntegration, filePath: string, fallBackPath?: string) {
  try {
    const urlParts = github.githubUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1].replace(".git", "");
    // url component serialzie
    let url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
    let response;
    try {
      console.log(`Querying github api at ${url}`);
      response = await $fetch<{ download_url?: string }>(url, {
        headers: {
          "User-Agent": "New Recruit Data Editor (Electron)",
          Accept: "application/vnd.github.v3+json",
        },
      });
    } catch (e) {
      if (!fallBackPath) throw e;
      url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(fallBackPath)}`;
      console.log(`Querying github api at ${url}`);
      response = await $fetch<{ download_url?: string }>(url, {
        headers: {
          "User-Agent": "New Recruit Data Editor (Electron)",
          Accept: "application/vnd.github.v3+json",
        },
      });
    }
    if (!response || !response?.download_url) {
      throw new Error("No download_url found");
    }
    console.log(`Downloading file at ${response?.download_url}`);

    const content = await $fetch<string>(response.download_url, {
      headers: {
        "User-Agent": "New Recruit Data Editor (Electron)",
        Accept: "application/vnd.github.v3+json",
      },
    });
    console.log(`Downloaded file, length: ${content.length}`);
    return content;
  } catch (error) {
    throw error;
  }
}
export function getRepoFile(github: GithubIntegration, id: string): BattleScribeFile | undefined {
  if (github.repoData) {
    const files = github.repoData.repositoryFiles;
    return files?.find((o) => o.id === id);
  }
}
export async function getNextRevision(github: GithubIntegration, catalogue: Catalogue) {
  if (catalogue.fullFilePath) {
    try {
      const fileName = filename(catalogue.fullFilePath);
      const content = await getFileContentFromRepo(
        github,
        fileName,
        fileName.endsWith("z") ? removeSuffix(fileName, "z") : undefined
      );
      const regex = /revision="(\d+)"/;
      const match = content.match(regex);
      if (match) {
        const resultRevision = (Number(match[1]) || 0) + 1;
        console.log(`Revision of ${catalogue.name}: ${catalogue.revision} -> ${resultRevision}`);
        return resultRevision;
      }
    } catch (e) {
      console.error(e);
    }
  }
  return catalogue.revision || 1;
}
