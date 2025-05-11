const express = require("express");
const router = express.Router();
const { performance } = require("perf_hooks");
const path = require("path");
const fs = require("fs");

const CURSOS_PATH = path.resolve(__dirname, "../database/cursos.json");
const TEMAS_PATH = path.resolve(__dirname, "../database/temas.json");

const loadDB = (dbPath) => {
    try {
        if (fs.existsSync(dbPath)) {
            const data = fs.readFileSync(dbPath, "utf8");
            return data ? JSON.parse(data) : [];
        }
        return [];
    } catch (error) {
        console.error("Error al cargar base de datos:", dbPath, error);
        return [];
    }
};

router.post("/search/cursos", (req, res) => {
    const { curso } = req.body;
    if (!curso) return res.status(400).json({ error: "Curso es requerido" });

    const start = performance.now();
    const cursos = loadDB(CURSOS_PATH);
    const cursosFilter = cursos.filter((item) => item.name.includes(curso));
    const cursosTime = performance.now() - start;

    res.json({
        cursosFilter,
        cursosTime: cursosTime.toFixed(2).toString() + "ms",
    });
});

router.post("/search/temas", (req, res) => {
    const { tema } = req.body;
    if (!tema) return res.status(400).json({ error: "Tema es requerido" });

    const start = performance.now();
    const temas = loadDB(TEMAS_PATH);
    const temasFilter = temas.filter((item) => item.name.includes(tema));
    const temasTime = performance.now() - start;

    res.json({
        temasFilter,
        temasTime: temasTime.toFixed(2).toString() + "ms",
    });
});

module.exports = router;