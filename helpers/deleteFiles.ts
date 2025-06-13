// src/helpers/deleteFiles.ts
import Modpack from '../models/modpacks.js';
import path from 'path';
import fs from 'fs/promises';

const subDirs = ['screenshots', 'thumbnails', 'modpacks', 'backgrounds', ''];

export async function deleteFiles(filesToDelete: string[], uploadsPath: string): Promise<void> {
  try {
    for (const file of filesToDelete) {
      const usageCount = await Modpack.countDocuments({
        $or: [
          { 'mainVersion.zip': file },
          { thumbnail: file },
          { screenshots: file },
          { background: file },
        ],
      });

      if (usageCount === 0) {
        let fileDeleted = false;

        for (const dir of subDirs) {
          const filePath = path.join(uploadsPath, dir, file);

          try {
            await fs.access(filePath); // check if file exists
            await fs.unlink(filePath);
            console.log(`Deleted file: ${filePath}`);
            fileDeleted = true;
            break; // stop searching once deleted
          } catch {
            // file doesn't exist at this path, try next
          }
        }

        if (!fileDeleted) {
          console.log(`File not found for deletion: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Error deleting files:', error);
  }
}
