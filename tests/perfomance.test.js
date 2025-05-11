const request = require("supertest");
const app = require("./../server");

describe("Fitness Function de Rendimiento", () => {
    let server;

    beforeAll(() => {
        server = app.listen(0);
    });

    afterAll((done) => {
        server.close(done);
    });

    it("Debe medir el tiempo de consulta en la base de datos de cursos", async () => {
        const curso = "testCurso"; 
        const res = await request(server).post("/performance/search/cursos").send({ curso });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("cursosFilter");
        expect(res.body).toHaveProperty("cursosTime");

        const cursosTime = parseFloat(res.body.cursosTime);
        expect(cursosTime).toBeLessThanOrEqual(100);
    });

    it("Debe medir el tiempo de consulta en la base de datos de temas", async () => {
        const tema = "testTema";
        const res = await request(server).post("/performance/search/temas").send({ tema });
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty("temasFilter");
        expect(res.body).toHaveProperty("temasTime");

        const temasTime = parseFloat(res.body.temasTime);
        expect(temasTime).toBeLessThanOrEqual(200);
    });
});
