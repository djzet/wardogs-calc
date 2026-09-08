import sharp from 'sharp';
import { readdir, readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';

const maps = ['bakurani', 'ozeti'];
const MAX_RETRIES = 3;
const RETRY_DELAY = 100; // мс

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function optimizeFile(filePath, retries = 0) {
  try {
    // Проверяем существование файла
    if (!await fileExists(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return false;
    }

    // Читаем файл в буфер (не передаем путь в sharp)
    const inputBuffer = await readFile(filePath);
    
    // Обрабатываем буфер
    const optimized = await sharp(inputBuffer)
      .webp({ 
        quality: 70, 
        effort: 4,
        smartSubsample: true
      })
      .toBuffer();
    
    // Записываем обратно
    await writeFile(filePath, optimized);
    return true;
    
  } catch (err) {
    if (retries < MAX_RETRIES && (err.code === 'UNKNOWN' || err.code === 'EBUSY' || err.code === 'EPERM')) {
      console.log(` Retry ${retries + 1}/${MAX_RETRIES} for ${filePath}`);
      await sleep(RETRY_DELAY * (retries + 1));
      return optimizeFile(filePath, retries + 1);
    }
    
    console.error(`❌ Error: ${filePath}`, err.message);
    return false;
  }
}

async function optimize() {
  let totalFiles = 0;
  let successFiles = 0;
  let failedFiles = 0;

  for (const map of maps) {
    const tilesDir = join('maps', map, 'tiles');
    
    try {
      const zooms = await readdir(tilesDir);
      
      for (const zoom of zooms) {
        const zoomPath = join(tilesDir, zoom);
        const files = await readdir(zoomPath);
        
        console.log(`\n📁 Processing ${map}/${zoom} (${files.length} files)`);
        
        for (const file of files) {
          if (!file.endsWith('.webp')) continue;
          
          const filePath = join(zoomPath, file);
          totalFiles++;
          
          const success = await optimizeFile(filePath);
          if (success) {
            successFiles++;
          } else {
            failedFiles++;
          }
        }
        
        console.log(`✅ ${map}/${zoom} done`);
      }
    } catch (err) {
      console.error(`❌ Error processing ${map}:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(` Total: ${totalFiles} files`);
  console.log(`✅ Success: ${successFiles}`);
  console.log(`❌ Failed: ${failedFiles}`);
  console.log('='.repeat(50));
}

optimize();