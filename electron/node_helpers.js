/**
 *
 * @param {string} folderPath
 */
export async function getFolderFiles(folderPath) {
  if (!electron) return;
  try {
    const fileObjects = [];

    const entries = await electron.invoke("readdirSync", folderPath);

    for (const entry of entries) {
      const filePath = `${folderPath}/${entry}`;

      try {
        const stats = await electron.invoke("statSync", filePath);
        if (stats.isFile()) {
          const data = await electron.invoke("readFileSync", filePath, "utf-8");
          const fileObject = {
            name: entry,
            data: data,
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
