const fs = require("fs");
const path = require("path");
const app = require("./../server"); 
const request = require("supertest");
const mergeService = require("../config/merge");
const notificationService = require("../config/notifications");
const { generateSimulationData, cleanupSimulation, API_DIR, TEMP_STORAGE_DIR } = require("../config/government");

describe("Flujo de Procesamiento de Datos", () => {
    
    let server;
    let agent;

    beforeAll(() => {
        server = app.listen(0);
        agent = request.agent(server);
        generateSimulationData();
    });

    afterAll(async () => {
        await cleanupSimulation();
        await new Promise(resolve => server.close(resolve));
    });

    beforeEach(() => {
        notificationService.clearNotifications();
        if (fs.existsSync(TEMP_STORAGE_DIR))
            fs.rmSync(TEMP_STORAGE_DIR, { recursive: true, force: true });
        fs.mkdirSync(TEMP_STORAGE_DIR, { recursive: true });
    });

    describe("Lógica de Descarga", () => {
        it("Debe descargar todos los bloques exitosamente para un archivo válido", async () => {
            const fileName = "Matemáticas"; 

            const result = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(result.body).toHaveProperty("success", true);
            expect(result.body).toHaveProperty("message", "Los " + 5 + " bloques para el archivo " + fileName + " se han descargado y almacenado correctamente.");
            expect(result.body.downloadedBlocks.length).toBe(5);
            expect(result.body.failedBlocks.length).toBe(0);
            expect(notificationService.getNotifications().length).toBe(0);

            for (let i = 1; i <= 5; i++) {
                const blockPath = path.join(TEMP_STORAGE_DIR, fileName, "block" + i + ".txt");
                expect(fs.existsSync(blockPath)).toBe(true);
                const content = fs.readFileSync(blockPath, "utf8");
                expect(content).toBe("Contenido de " + fileName + " bloque " + i);
            }
        });

        it("Debe notificar y tener éxito parcial si algunos bloques son inválidos", async () => {
            const fileName = "Lenguaje"; 
            const corruptBlockName = "block2.txt";
            const originalBlockContentPath = path.join(API_DIR, fileName, corruptBlockName);
            let originalBlockContent = "";
            if (fs.existsSync(originalBlockContentPath)) 
                originalBlockContent = fs.readFileSync(originalBlockContentPath, "utf8");
            fs.writeFileSync(originalBlockContentPath, "Contenido de Lenguaje bloque 2 corrupt", "utf8");
            
            const result = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(result.body).toHaveProperty("success", false);
            expect(result.body).toHaveProperty("message", "Se han descargado " + 2 + " de " + 3 + " bloques para el archivo " + fileName + ". Revise las notificaciones para errores.");
            expect(result.body.downloadedBlocks.length).toBe(2);
            expect(result.body.failedBlocks.length).toBe(1);
            expect(result.body.failedBlocks[0].blockName).toBe(corruptBlockName);
            expect(result.body.failedBlocks[0].error).toBe("Bloque con contenido inválido.");

            const notifications = notificationService.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("invalid_block");
            expect(notifications[0].data.fileName).toBe(fileName);
            expect(notifications[0].data.blockName).toBe(corruptBlockName);

            expect(fs.existsSync(path.join(TEMP_STORAGE_DIR, fileName, "block1.txt"))).toBe(true);
            expect(fs.existsSync(path.join(TEMP_STORAGE_DIR, fileName, corruptBlockName))).toBe(false);
            expect(fs.existsSync(path.join(TEMP_STORAGE_DIR, fileName, "block3.txt"))).toBe(true);
            
            if (originalBlockContent) 
                fs.writeFileSync(originalBlockContentPath, originalBlockContent, "utf8");
        });

        it("Debe manejar archivos no existentes en la API", async () => {
            const fileName = "Ciencias"; 
            const expectedApiError = "Archivo " + fileName + " no encontrado.";

            const result = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(result.body).toHaveProperty("success", false);
            expect(result.body).toHaveProperty("message", "Error al obtener la información del archivo " + fileName + ": " + expectedApiError);
            
            const notifications = notificationService.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("api_file_error"); 
            expect(notifications[0].data.fileName).toBe(fileName);
            expect(notifications[0].data.error).toBe(expectedApiError);
        });

        it("Debe manejar archivos existentes en la API pero sin bloques", async () => {
            const fileName = "ArchivoVacio";
            const emptyFileDir = path.join(API_DIR, fileName);
            fs.mkdirSync(emptyFileDir, { recursive: true });

            const result = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(result.body).toHaveProperty("success", false);
            expect(result.body).toHaveProperty("message", "El archivo " + fileName + " esta vacio o no contiene bloques válidos.");
            
            const notifications = notificationService.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("file_empty"); 
            expect(notifications[0].data.fileName).toBe(fileName);

            fs.rmSync(emptyFileDir, { recursive: true, force: true }); 
        });
    });

    describe("Servicio de Merge (config/merge.js)", () => {
        it("Debe unir todos los bloques descargados exitosamente", async () => {
            const fileName = "Matemáticas";
    
            await agent
                .post("/download/file")
                .send({ fileName: fileName});

            const mergeResult = await mergeService.mergeFile(fileName);
            expect(mergeResult.success).toBe(true);
            expect(mergeResult.filePath).toBe(path.join(TEMP_STORAGE_DIR, fileName + "_merged.txt"));
            expect(fs.existsSync(mergeResult.filePath)).toBe(true);
            
            let expectedContent = "";
            for (let i = 1; i <= 5; i++) {
                expectedContent += "Contenido de " + fileName + " bloque " + i;
                if (i < 5) expectedContent += "\n";
            }
            expect(mergeResult.content).toBe(expectedContent);
        });

        it("Debe fallar al unir si no se encuentran bloques en el almacenamiento temporal", async () => {
            const fileName = "InexistenteEnTemp";
            const mergeResult = await mergeService.mergeFile(fileName);

            expect(mergeResult.success).toBe(false);
            const expectedError = "Ruta de bloques " + path.join(TEMP_STORAGE_DIR, fileName) + " no encontrada para el archivo " + fileName;
            expect(mergeResult.error).toBe(expectedError);
        });

        it("Debe indicar fallo si el archivo unido es inválido (ej. archivo vacío)", async () => {
            const fileName = "ArchivoParaMergeInvalidoVacio"; 
            const sourceBlocksDir = path.join(TEMP_STORAGE_DIR, fileName);
            fs.mkdirSync(sourceBlocksDir, { recursive: true });
            fs.writeFileSync(path.join(sourceBlocksDir, "block1.txt"), "", "utf8");

            const mergeResult = await mergeService.mergeFile(fileName);
            expect(mergeResult.success).toBe(false); 
            expect(mergeResult.error).toBe("El archivo creado tras merge es inválido o esta vacio.");
        
            const mergedFilePath = path.join(TEMP_STORAGE_DIR, fileName + "_merged.txt");
            expect(fs.existsSync(mergedFilePath)).toBe(true);
        
            const stats = fs.statSync(mergedFilePath);
            expect(stats.size).toBe(0);
        });
    });

    describe("Simulación de Flujo Completo", () => {
        it("Debe descargar, validar bloques, unir y validar el archivo unido exitosamente", async () => {
            const fileName = "Historia"; 
            
            const downloadResult = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(downloadResult.body).toHaveProperty("success", true);
            expect(downloadResult.body).toHaveProperty("message", "Los " + 7 + " bloques para el archivo " + fileName + " se han descargado y almacenado correctamente.");
            expect(downloadResult.body.downloadedBlocks.length).toBe(7);
            expect(notificationService.getNotifications().length).toBe(0);
            for (let i = 1; i <= 7; i++) 
                expect(fs.existsSync(path.join(TEMP_STORAGE_DIR, fileName, "block" + i + ".txt"))).toBe(true);
            
            const mergeResult = await mergeService.mergeFile(fileName);
            expect(mergeResult.success).toBe(true);
            expect(fs.existsSync(mergeResult.filePath)).toBe(true);
            
            let expectedFullContent = "";
            for (let i = 1; i <= 7; i++) {
                expectedFullContent += "Contenido de " + fileName + " bloque " + i;
                if (i < 7) expectedFullContent += "\n";
            }
            expect(mergeResult.content).toBe(expectedFullContent);
        });

        it("Debe manejar un fallo de validación de bloque y unir parcialmente los bloques válidos", async () => {
            const fileName = "Lenguaje"; 
            const corruptBlockName = "block2.txt";
            const originalBlockContentPath = path.join(API_DIR, fileName, corruptBlockName);
            let originalBlockContent = "";
            if (fs.existsSync(originalBlockContentPath)) 
                originalBlockContent = fs.readFileSync(originalBlockContentPath, "utf8");
            fs.writeFileSync(originalBlockContentPath, "Contenido de Lenguaje bloque 2 corrupt", "utf8");

            const downloadResult = await agent
                .post("/download/file")
                .send({ fileName: fileName});

            expect(downloadResult.body).toHaveProperty("success", false);
            expect(downloadResult.body).toHaveProperty("message", "Se han descargado " + 2 + " de " + 3 + " bloques para el archivo " + fileName + ". Revise las notificaciones para errores.");
            expect(downloadResult.body.downloadedBlocks.length).toBe(2);
            expect(downloadResult.body.failedBlocks.length).toBe(1);
            
            const notifications = notificationService.getNotifications();
            expect(notifications.length).toBe(1);
            expect(notifications[0].type).toBe("invalid_block");
            expect(notifications[0].data.blockName).toBe(corruptBlockName);

            const mergeResult = await mergeService.mergeFile(fileName);
            expect(mergeResult.success).toBe(true); 
            const expectedPartialContent = "Contenido de " + fileName + " bloque " + 1 + "\n" + "Contenido de " + fileName + " bloque " + 3;
            expect(mergeResult.content).toBe(expectedPartialContent);

            if (originalBlockContent)
                fs.writeFileSync(originalBlockContentPath, originalBlockContent, "utf8");
        });
    });
});