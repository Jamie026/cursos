const fs = require("fs");
const path = require("path");
const API_DIR = path.resolve(__dirname, "./../api");
const TEMP_STORAGE_DIR = path.resolve(__dirname, "./../temp");

const ensureDirectoryExists = (dirPath) => {
    if (!fs.existsSync(dirPath))
        fs.mkdirSync(dirPath, { recursive: true });
};

const generateFileWithBlocks = (fileName, numberOfBlocks) => {
    const fileDir = path.join(API_DIR, fileName);
    ensureDirectoryExists(fileDir);
    console.log("Generando archivo simulado:", fileName, "con", numberOfBlocks, "bloques...");
    for (let i = 1; i <= numberOfBlocks; i++) {
        const blockFileName = "block" + i + ".txt";
        const blockFilePath = path.join(fileDir, blockFileName);
        let content = "Contenido de " + fileName + " bloque " + i;
        fs.writeFileSync(blockFilePath, content, "utf8");
    }
    console.log("Generación de", fileName, "finalizada.");
};

const cleanupSimulation = () => {
    if (fs.existsSync(API_DIR)) {
        fs.rmSync(API_DIR, { recursive: true, force: true });
        console.log("Limpiado:", API_DIR);
    }
    if (fs.existsSync(TEMP_STORAGE_DIR)) {
        fs.rmSync(TEMP_STORAGE_DIR, { recursive: true, force: true });
        console.log("Limpiado:", TEMP_STORAGE_DIR);
    }
};

const generateSimulationData = () => {
    cleanupSimulation(); 
    ensureDirectoryExists(API_DIR);
    ensureDirectoryExists(TEMP_STORAGE_DIR);
    generateFileWithBlocks("Matemáticas", 5);
    generateFileWithBlocks("Lenguaje", 3);
    generateFileWithBlocks("Historia", 7);
};

const getFileBlocksInfo = (fileName) => {
    const fileDir = path.join(API_DIR, fileName);
    if (!fs.existsSync(fileDir) || !fs.lstatSync(fileDir).isDirectory()) {
        return { error: "Archivo " + fileName + " no encontrado.", blockCount: 0, blocks: [] };
    }
    try {
        const blockFiles = fs.readdirSync(fileDir)
            .filter(f => f.startsWith("block") && f.endsWith(".txt"))
            .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
        
        return {
            blockCount: blockFiles.length,
            blocks: blockFiles 
        };
    } catch (e) {
        return { error: "Error leyendo bloque para el archivo: " + fileName, blockCount: 0, blocks: [] };
    }
};

const fetchBlockContent = (fileName, blockName) => {
    const blockPath = path.join(API_DIR, fileName, blockName);
    if (!fs.existsSync(blockPath))
        throw new Error("Bloque " + blockName + " para el archivo " + fileName + " no encontrado.");
    return fs.readFileSync(blockPath, "utf8");
};

module.exports = { API_DIR, TEMP_STORAGE_DIR, generateSimulationData, cleanupSimulation, generateFileWithBlocks,  ensureDirectoryExists, getFileBlocksInfo, fetchBlockContent };