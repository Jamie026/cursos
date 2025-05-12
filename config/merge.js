const fs = require("fs");
const path = require("path");
const { TEMP_STORAGE_DIR } = require("./government"); 

const isValidMergedFile = (filePath) => {
    if (!fs.existsSync(filePath)) 
        return false; 
    try {
        const stats = fs.statSync(filePath);
        return stats.size > 0;
    } catch (e) {
        return false;
    }
};

const mergeFile = async (fileName) => {
    const sourceBlocksDir = path.join(TEMP_STORAGE_DIR, fileName);
    const mergedFilePath = path.join(TEMP_STORAGE_DIR, fileName + "_merged.txt"); 

    if (!fs.existsSync(sourceBlocksDir) || !fs.lstatSync(sourceBlocksDir).isDirectory())
        return { success: false, error: "Ruta de bloques " + sourceBlocksDir + " no encontrada para el archivo "+ fileName };

    let blockFiles;
    try {
        blockFiles = fs.readdirSync(sourceBlocksDir)
            .filter(f => f.startsWith("block") && f.endsWith(".txt"))
            .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    } catch (e) {
        return { success: false, error: "Error al leer los bloques en la ruta: " + sourceBlocksDir };
    }
    
    if (blockFiles.length === 0)
        return { success: false, error: "No hay bloques en la ruta " + sourceBlocksDir + " para crear el archivo " + fileName};

    let mergedContent = "";
    for (const blockFile of blockFiles) {
        const blockPath = path.join(sourceBlocksDir, blockFile);
        try {
            mergedContent += fs.readFileSync(blockPath, "utf8");
            if (blockFiles.indexOf(blockFile) < blockFiles.length - 1)
                mergedContent += "\n";
        } catch (e) {
            return { success: false, error: "Error leyendo bloque " + blockFile + " durante el merge." };
        }
    }

    try {
        fs.writeFileSync(mergedFilePath, mergedContent, "utf8");
    } catch (e) {
        return { success: false, error: "Error durante el guardado del archivo tras el merge." };
    }

    if (isValidMergedFile(mergedFilePath))
        return { success: true, filePath: mergedFilePath, content: mergedContent };
    else 
        return { success: false, error: "El archivo creado tras merge es inválido o esta vacio." };
};

module.exports = { mergeFile, isValidMergedFile }; 