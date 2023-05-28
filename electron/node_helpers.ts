import type { Stats } from "fs";
import { isZipExtension } from "~/assets/shared/battlescribe/bs_convert";

/**
 *
 * @param {string} folderPath
 */
export async function getFolderFiles(folderPath: string) {
  if (!electron) return;
  try {
    const fileObjects = [];
    const isPathFile = (await electron.invoke("isFile", folderPath)) as Stats;
    if (isPathFile) {
      folderPath = folderPath.replaceAll("\\", "/").split("/").slice(0, -1).join("/");
    }

    const entries = (await electron.invoke("readdirSync", folderPath)) as string[];

    for (const entry of entries) {
      const filePath = `${folderPath}/${entry}`;

      try {
        const isFile = (await electron.invoke("isFile", filePath)) as Stats;
        if (isFile) {
          const data = await electron.invoke("readFileSync", filePath, isZipExtension(entry) ? undefined : "utf-8");
          const fileObject = {
            name: entry,
            data: data,
            path: filePath,
          };
          fileObjects.push(fileObject);
        }
      } catch (error) {
        console.error("Error reading file:", filePath, error);
        continue;
      }
    }

    return fileObjects;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}
export async function showOpenDialog(options: Electron.OpenDialogOptions) {
  if (!electron) return;
  return electron.invoke("showOpenDialog", options) as Electron.OpenDialogReturnValue;
}
