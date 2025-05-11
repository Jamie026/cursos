const request = require("supertest");
const app = require("./../server"); 

describe("Fitness Function de Seguridad (Login)", () => {
    let server;
    let agent;
    const testUserLoginSecurity = {
        username: "username" + Date.now().toString(),
        password: "password123"
    };

    beforeAll(async () => {
        server = app.listen(0);
        agent = request.agent(server);
        await agent
            .post("/users/register")
            .send(testUserLoginSecurity);
    });

    afterAll((done) => {
        server.close(done);
    });

    beforeEach(async () => {
        await agent.post("/users/logout"); 
        await agent.post("/users/reset-login-attempts");
    });

    it("Login: N=1 (Caso Exitoso)", async () => {
        const res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: testUserLoginSecurity.password });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("message", "Login exitoso.");
    });

    it("Login: N=2 (OK)", async () => {
        const resFail = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: "wrongpassword" });
        expect(resFail.statusCode).toEqual(401);
        expect(resFail.body.message).toContain("Credenciales inválidas (contraseña incorrecta).");
        expect(resFail.body.message).toContain("2 intento(s) restante(s)."); 

        const resSuccess = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: testUserLoginSecurity.password });
        expect(resSuccess.statusCode).toEqual(200);
        expect(resSuccess.body).toHaveProperty("message", "Login exitoso.");
    });

    it("Login: N>=3 (Bad). Bloqueo de la cuenta después de 3 intentos fallidos", async () => {
        let res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: "wrongpassword1" });
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toContain("2 intento(s) restante(s).");

        res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: "wrongpassword2" });
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toContain("1 intento(s) restante(s).");

        res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: "wrongpassword3" });
        expect(res.statusCode).toEqual(401); 
        expect(res.body.message).toContain("Cuenta bloqueada temporalmente");

        res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: "wrongpassword4" });
        expect(res.statusCode).toEqual(429); 
        expect(res.body.message).toContain("Demasiados intentos fallidos. Intenta de nuevo en unos minutos.");

    });

    it("Login: N>=3 (Bad) - Después del bloqueo, no es posible loguearse inmediatamente", async () => {
        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w1" });
        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w2" });
        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w3" });

        const res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: testUserLoginSecurity.password });
        expect(res.statusCode).toEqual(429);
        expect(res.body.message).toContain("Demasiados intentos fallidos.");
    });

    it("Login: Desbloqueo después del tiempo de bloqueo", async () => {

        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w1" });
        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w2" });
        await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: "w3" });

        let res = await agent.post("/users/login").send({ username: testUserLoginSecurity.username, password: testUserLoginSecurity.password });
        expect(res.statusCode).toEqual(429);
        await agent.post("/users/reset-login-attempts"); 

        res = await agent
            .post("/users/login")
            .send({ username: testUserLoginSecurity.username, password: testUserLoginSecurity.password });
        expect(res.statusCode).toEqual(200); 
        expect(res.body.message).toEqual("Login exitoso.");
    });
});