import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import Modpack from '../models/modpacks.js';
import Username from '../models/usernames.js';
import { deleteFiles } from '../helpers/deleteFiles.js';
import { authenticateApiKey } from '../middleware/authApiKey.js';
import logger from '../middleware/logger.js';

const router = express.Router();

const uploadsPath = path.join(process.cwd(), '/uploads');
const screenshotsPath = path.join(uploadsPath, 'screenshots');
const thumbnailsPath = path.join(uploadsPath, 'thumbnails');
const backgroundsPath = path.join(uploadsPath, 'backgrounds');
const modpacksPath = path.join(uploadsPath, 'modpacks');

fs.ensureDirSync(uploadsPath);
fs.ensureDirSync(screenshotsPath);
fs.ensureDirSync(thumbnailsPath);
fs.ensureDirSync(backgroundsPath);
fs.ensureDirSync(modpacksPath);

// Multer storage for /upload endpoint only
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let destinationPath = uploadsPath;
    if (file.fieldname.startsWith('screenshot')) {
      destinationPath = screenshotsPath;
    } else if (file.fieldname.startsWith('thumbnail')) {
      destinationPath = thumbnailsPath;
    } else if (file.fieldname.startsWith('versions')) {
      destinationPath = modpacksPath;
    } else if (file.fieldname.startsWith('background')) {
      destinationPath = backgroundsPath;
    }
    cb(null, destinationPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage, limits: { fieldSize: 100 * 10024 * 10024 } });

router.use(logger);

router.get('/', async (req: Request, res: Response) => {
  try {
    const modpacks = await Modpack.find();
    res.json(modpacks);
  } catch (error) {
    console.error('Error fetching mod packs:', error);
    res.status(500).json({ error: 'Error fetching mod packs', detail: error });
  }
});

router.get('/screenshots', async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(screenshotsPath);
    const imageFiles = files.filter(file => /\.(png|jpe?g|webp|gif)(-\d+)?$/i.test(file));
    res.status(200).json({ screenshots: imageFiles });
  } catch (err) {
    console.error('Error reading screenshots directory:', err);
    res.status(500).json({ message: 'Failed to read screenshots' });
  }
});

router.delete('/screenshots/:filename', authenticateApiKey, async (req: Request, res: Response) => {
  const filename = req.params.filename;
  try {
    const filePath = path.join(screenshotsPath, filename);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      res.status(200).json({ message: 'Screenshot deleted successfully' });
    } else {
      res.status(404).json({ message: 'Screenshot not found' });
    }
  } catch (error) {
    console.error('Error deleting screenshot:', error);
    res.status(500).json({ message: 'Error deleting screenshot', error });
  }
});

router.post('/template', authenticateApiKey, async (req: Request, res: Response) => {
  const id = Date.now().toString();
  try {
    const newModpack = new Modpack({ id });
    await newModpack.save();
    res.status(201).json({ message: 'Modpack template created successfully', modpack: newModpack });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// UPDATED: Remove multer and file handling from this endpoint.
// Expect only JSON body with file references (e.g. filename strings)
router.put('/:id', authenticateApiKey, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const selectedModpack = await Modpack.findOne({ id });
    if (!selectedModpack)  {
        console.error(res.status(404).json({ message: 'Modpack not found' }));
        return;
    }
    const updatedModpack = req.body;

    // If client explicitly sends 'empty' string for versions, clear it
    if (updatedModpack.versions === 'empty') {
      updatedModpack.versions = [];
    }

    // Determine files to delete if any old files are replaced
    const versionsToDelete: string[] = [];

    if (updatedModpack.versions && selectedModpack.versions) {
      for (const selectedVersion of selectedModpack.versions) {
        if (!updatedModpack.versions.some((v: any) => v.zip === selectedVersion.zip)) {
          if (selectedVersion.zip) versionsToDelete.push(selectedVersion.zip);
        }
      }
    }

    // Check if thumbnail or background changed (by filename string)
    if (updatedModpack.thumbnail && updatedModpack.thumbnail !== selectedModpack.thumbnail) {
      if (selectedModpack.thumbnail) versionsToDelete.push(selectedModpack.thumbnail);
    }
    if (updatedModpack.background && updatedModpack.background !== selectedModpack.background) {
      if (selectedModpack.background) versionsToDelete.push(selectedModpack.background);
    }

    await Modpack.updateOne({ id }, { $set: updatedModpack });
    await deleteFiles(versionsToDelete.filter(Boolean), uploadsPath);

    const updatedPack = await Modpack.findOne({ id });
    res.status(200).json({ message: 'Modpack updated successfully', modpack: updatedPack });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating modpack' });
  }
});

router.get('/:modpackId/main', async (req: Request, res: Response) => {
  const modpackId = req.params.modpackId;
  try {
    const selectedModpack = await Modpack.findOne({ id: modpackId });
    if (!selectedModpack) {
        console.error(res.status(404).json({ message: 'Modpack not found' }));
        return;
    }
    if (!selectedModpack.mainVersion || !selectedModpack.mainVersion.zip) {
       console.error(res.status(404).json({ message: 'Main version file missing' }));
       return;
    }

    const mainFilePath = path.join(modpacksPath, selectedModpack.mainVersion.zip);
    if (fs.existsSync(mainFilePath)) {
      res.setHeader('Content-Disposition', `attachment; filename=${selectedModpack.mainVersion.zip}`);
      res.setHeader('Content-Type', 'application/octet-stream');
      fs.createReadStream(mainFilePath).pipe(res);
    } else {
      res.status(404).json({ message: 'File not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error downloading modpack' });
  }
});

router.delete('/:id', authenticateApiKey, async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    const packToDelete = await Modpack.findOne({ id });
    if (!packToDelete) {
        console.error(res.status(404).json({ message: 'Modpack not found' }));
        return;
    }
    const filesToDelete: string[] = [
      ...packToDelete.versions.map(v => v.zip).filter((zip): zip is string => Boolean(zip)),
      ...(packToDelete.thumbnail ? [packToDelete.thumbnail] : []),
      ...(packToDelete.background ? [packToDelete.background] : [])
    ];

    await Modpack.deleteOne({ id });
    await deleteFiles(filesToDelete, uploadsPath);

    res.status(200).json({ message: 'Deleted modpack successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting modpack' });
  }
});

router.delete('/:modpackId/versions/:versionId', authenticateApiKey, async (req: Request, res: Response) => {
  const { modpackId, versionId } = req.params;
  try {
    const selectedModpack = await Modpack.findOne({ id: modpackId });
    if (!selectedModpack) { 
        console.error(res.status(404).json({ message: 'Modpack not found' }));
        return;
    }

    const versionIndex = selectedModpack.versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) {
        console.error(res.status(404).json({ message: 'Version not found' }));
        return;
    }

    const [removed] = selectedModpack.versions.splice(versionIndex, 1);
    if (removed.zip) await deleteFiles([removed.zip], uploadsPath);
    await selectedModpack.save();

    res.status(200).json({ message: 'Version deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting version' });
  }
});

// ...existing imports and setup...

// Rename existing upload-zip route
router.post('/upload-zip', upload.single('chunk'), authenticateApiKey, async (req: Request, res: Response) => {
  const file = req.file;
  const { fileName, chunkIndex, totalChunks } = req.body;
  const uploadDir = path.join(uploadsPath, 'modpacks');
  const tempDir = path.join(uploadsPath, 'temp');

  try {
    await fs.ensureDir(uploadDir);
    await fs.ensureDir(tempDir);
    const chunkDir = path.join(tempDir, fileName);
    await fs.ensureDir(chunkDir);

    const chunkPath = path.join(chunkDir, `${chunkIndex}`);
    if (await fs.pathExists(chunkPath)) await fs.remove(chunkPath);
    if (file) await fs.move(file.path, chunkPath);

    if (parseInt(chunkIndex) + 1 === parseInt(totalChunks)) {
      const filePath = path.join(uploadDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      for (let i = 0; i < parseInt(totalChunks); i++) {
        const chunkData = await fs.readFile(path.join(chunkDir, `${i}`));
        writeStream.write(chunkData);
      }

      writeStream.end();
      await fs.remove(chunkDir);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error during file upload:', error);
    res.status(500).json({ message: 'Error during file upload', error: error });
  }
});

router.post('/upload', authenticateApiKey, upload.any(), async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[] | undefined;
  const file = files?.[0];

  if (!file) {
    res.status(400).json({ message: 'No file uploaded' });
    return;
  }

  let destinationDir: string | null = null;

  switch (file.fieldname) {
    case 'thumbnailFile':
      destinationDir = thumbnailsPath;
      break;
    case 'screenshotFile':
      destinationDir = screenshotsPath;
      break;
    case 'backgroundFile':
      destinationDir = backgroundsPath;
      break;
    default:
      console.log('Invalid file field name:', file.fieldname);
      res.status(400).json({ message: 'Invalid file field name' });
      return;
  }

  try {
    await fs.ensureDir(destinationDir);
    const destPath = path.join(destinationDir, file.originalname);

    // Only move file if source and destination are different
    if (path.resolve(file.path) !== path.resolve(destPath)) {
      await fs.move(file.path, destPath, { overwrite: true });
    } else {
      console.warn('Skipping move: source and destination are the same:', file.path);
    }

    res.status(200).json({ message: 'File uploaded successfully', filename: file.originalname });
  } catch (error) {
    console.error('Error moving uploaded file:', error);
    res.status(500).json({ message: 'Error saving uploaded file', error });
  }
});

router.post('/register', authenticateApiKey, async (req: Request, res: Response) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ message: 'Username is required and must be a non-empty string' });
    return;
  }

  try {
    const existing = await Username.findOne({ username: username.trim() });
    if (existing) {
      res.status(409).json({ message: 'Username already exists' });
      return;
    }

    const newUser = new Username({ username: username.trim() });
    await newUser.save();

    res.status(201).json({ message: 'Username registered successfully', username: newUser.username });
  } catch (error) {
    console.error('Error registering username:', error);
    res.status(500).json({ message: 'Error registering username', error });
  }
});

router.get('/usernames', async (req: Request, res: Response) => {
  try {
    const usernames = await Username.find();
    res.status(200).json({ usernames: usernames.map(u => u.username) });
  } catch (error) {
    console.error('Error fetching usernames:', error);
    res.status(500).json({ message: 'Error fetching usernames', error });
  }
});

router.post('/check-username', async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ message: 'Username is required and must be a non-empty string' });
    return;
  }
  try {
    const existing = await Username.findOne({ username: username.trim() });
    if (existing) {
      res.status(200).json(true);
    } else {
      res.status(200).json(false);
    }
  } catch (error) {
    console.error('Error checking username:', error);
    res.status(500).json({ message: 'Error checking username', error });
  }
});

router.post('/delete-username', authenticateApiKey, async (req: Request, res: Response) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ message: 'Username is required and must be a non-empty string' });
    return;
  }
  try {
    const result = await Username.deleteOne({ username: username.trim() });
    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Username not found' });
    } else {
      res.status(200).json({ message: 'Username deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting username:', error);
    res.status(500).json({ message: 'Error deleting username', error });
  }
});



export default router;
