const express = require('express');
const router = express.Router();
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_TIME = 5 * 60 * 1000;
const USERS_FILE_PATH = path.resolve(__dirname, "../database/users.json");

const loadUsers = () => {
    try {
        if (fs.existsSync(USERS_FILE_PATH)) {
            const data = fs.readFileSync(USERS_FILE_PATH, "utf8");
            return data ? JSON.parse(data) : [];
        }
        return [];
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        return [];
    }
};

const saveUsers = (usersData) => {
    try {
        fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(usersData, null, 2));
    } catch (error) {
        console.error("Error al guardar usuarios:", error);
    }
};

router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: "Nombre de usuario y contraseña son requeridos." });

    const usersList = loadUsers();
    if (usersList.find(user => user.username === username))
        return res.status(409).json({ error: "Usuario ya existe" });

    const hashedPassword = await bcrypt.hash(password, 10);
    usersList.push({ username, password: hashedPassword });
    saveUsers(usersList);
    res.status(201).json({ message: "Registro exitoso" });
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: "Nombre de usuario y contraseña son requeridos." });

    if (loginAttempts[username] && loginAttempts[username].attempts >= MAX_LOGIN_ATTEMPTS) {
        const timeSinceLastAttempt = Date.now() - loginAttempts[username].lastAttempt;
        if (timeSinceLastAttempt < LOCKOUT_TIME)
            return res.status(429).json({ message: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." });
        else
            delete loginAttempts[username];
    }

    const usersList = loadUsers();
    const user = usersList.find(user => user.username === username);

    if (!user)
        return res.status(401).json({ error: "Usuario no encontrado o contraseña incorrecta" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        if (!loginAttempts[username]) loginAttempts[username] = { attempts: 0, lastAttempt: null };
        loginAttempts[username].attempts++;
        loginAttempts[username].lastAttempt = Date.now();
        let responseMessage = "Contraseña incorrecta.";
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - loginAttempts[username].attempts;

        if (loginAttempts[username].attempts >= MAX_LOGIN_ATTEMPTS)
            responseMessage = "Contraseña incorrecta. Cuenta bloqueada temporalmente.";
        else if (remainingAttempts > 0)
            responseMessage = `Credenciales inválidas (contraseña incorrecta). ${remainingAttempts} intento(s) restante(s).`;
        else
            responseMessage = `Credenciales inválidas (contraseña incorrecta). Cuenta bloqueada temporalmente.`;
        return res.status(401).json({ message: responseMessage });
    }
    if (loginAttempts[username])
        delete loginAttempts[username];

    req.session.user = { username: user.username };
    res.json({ message: "Login exitoso." });
});

router.post('/reset-login-attempts', (req, res) => {
    for (const key in loginAttempts) 
        delete loginAttempts[key];
    res.status(200).json({ message: "Intentos reiniciados." })
});

router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy(err => {
            if (err) return res.status(500).json({ message: 'No se pudo cerrar sesión.' });
            res.clearCookie('connect.sid');
            return res.status(200).json({ message: 'Logout exitoso.' });
        });
    } 
    else
        return res.status(200).json({ message: 'No hay sesión activa para cerrar.' });
});

module.exports = router;