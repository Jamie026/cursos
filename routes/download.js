const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
const governmentApi = require("../config/government"); 
const notificationService = require("../config/notifications"); 

const isValidBlock = (content) => !content.includes("corrupt");

const downloadAndValidateBlock = async (fileName, blockName, targetDirForBlocks) => {
    try {
        const content = governmentApi.fetchBlockContent(fileName, blockName);
        if (isValidBlock(content)) {
            const tempBlockPath = path.join(targetDirForBlocks, blockName);
            if (!fs.existsSync(path.dirname(tempBlockPath)))
                fs.mkdirSync(path.dirname(tempBlockPath), { recursive: true });
            fs.writeFileSync(tempBlockPath, content, "utf8");
            return { success: true, blockName, path: tempBlockPath };
        } 
        else {
            notificationService.addNotification("invalid_block", { fileName, blockName, reason: "Validación de contenido fallida" });
            return { success: false, blockName, error: "Bloque con contenido inválido." };
        }
    } catch (error) {
        notificationService.addNotification("download_error", { fileName, blockName, error: error.message });
        return { success: false, blockName, error: error.message };
    }
};

const downloadFileInBlocks = async (fileName) => {
    const fileDirInTemp = path.join(governmentApi.TEMP_STORAGE_DIR, fileName);
    if (!fs.existsSync(fileDirInTemp))
        fs.mkdirSync(fileDirInTemp, { recursive: true });

    const { blockCount, blocks, error: apiError } = governmentApi.getFileBlocksInfo(fileName);

    if (apiError) { 
        notificationService.addNotification("api_file_error", { fileName, error: apiError }); 
        return {
            success: false,
            status: 500,
            message: "Error al obtener la información del archivo " + fileName + ": " + apiError,
            downloadedBlocks: [],
            failedBlocks: []
        };
    }

    if (blockCount === 0) { 
        notificationService.addNotification("file_empty", { fileName, reason: "No se encontraron bloques" }); 
        return {
            success: false,
            status: 404,
            message: "El archivo " + fileName + " esta vacio o no contiene bloques válidos.", 
            downloadedBlocks: [],
            failedBlocks: []
        };
    }

    const results = [];
    for (const blockName of blocks)
        results.push(await downloadAndValidateBlock(fileName, blockName, fileDirInTemp));

    const downloadedBlocks = results.filter(res => res.success);
    const failedBlocks = results.filter(res => !res.success);

    if (downloadedBlocks.length === blockCount) {
        return {
            success: true,
            status: 200,
            message: "Los " + blockCount + " bloques para el archivo " + fileName + " se han descargado y almacenado correctamente.",
            downloadedBlocks,
            failedBlocks
        };
    } 
    else {
        return {
            success: false,
            status: downloadedBlocks.length > 0 ? 207 : 500,
            message: "Se han descargado " + downloadedBlocks.length + " de " + blockCount + " bloques para el archivo " + fileName + ". Revise las notificaciones para errores.",
            downloadedBlocks,
            failedBlocks
        };
    }
};

router.post("/file", async (req, res) => {
    const { fileName } = req.body;

    if (!fileName)
        return res.status(400).json({ success: false, message: "El nombre del archivo es requerido." });

    const results = await downloadFileInBlocks(fileName);
    res.status(results.status).json(results);
});

module.exports = router