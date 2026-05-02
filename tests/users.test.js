const request = require('supertest');
const { app, pool } = require('../src/index');
const { Pool } = require('pg');

const testDbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '12345',
    database: process.env.DB_NAME || 'ecommerce_test',
};

describe('POST /users - Integration Tests', () => {
    let testPool;

    beforeAll(async () => {
        testPool = new Pool(testDbConfig);

        await testPool.query(`DROP TABLE IF EXISTS users CASCADE;`);

        await testPool.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    });

    afterEach(async () => {
        await testPool.query('DELETE FROM users');
    });

    afterAll(async () => {
        await testPool.end();
        await pool.end();
    });

    test('should create a new user and store in database', async () => {
        const newUser = {
            name: 'Faizan',
            email: 'faizan@gmail.com',
            password: '123'
        };

        const response = await request(app)
            .post('/users')
            .send(newUser)
            .expect('Content-Type', /json/)
            .expect(201);

        expect(response.body.message).toBe('User created successfully');
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.name).toBe(newUser.name);
        expect(response.body.user.email).toBe(newUser.email);

        const dbResult = await testPool.query(
            'SELECT * FROM users WHERE email = $1',
            [newUser.email]
        );

        expect(dbResult.rows.length).toBe(1);
        expect(dbResult.rows[0].name).toBe(newUser.name);
        expect(dbResult.rows[0].email).toBe(newUser.email);
        expect(dbResult.rows[0].password).toBe(newUser.password);
    });

    test('should return 400 if name is missing', async () => {
        const response = await request(app)
            .post('/users')
            .send({
                email: 'faizanmalik@gmail.com',
                password: 'pass123'
            })
            .expect(400);

        expect(response.body.error).toBe('Name, email, and password are required');
    });

    test('should return 409 if email already exists', async () => {
        const user = {
            name: 'Faizan',
            email: 'faizan@gmail.com',
            password: '123'
        };

        await request(app).post('/users').send(user).expect(201);

        const response = await request(app)
            .post('/users')
            .send(user)
            .expect(409);

        expect(response.body.error).toBe('Email already exists');
    });

    test('should clean up test data after each test', async () => {
        const user1 = {
            name: 'Faizan Test 1',
            email: 'faizi1@gmail.com',
            password: '1234'
        };
        
        const user2 = {
            name: 'Faizan Test 2',
            email: 'faizi2@gmail.com',
            password: '12345'
        };

        await request(app).post('/users').send(user1).expect(201);
        await request(app).post('/users').send(user2).expect(201);

        const dbResult = await testPool.query('SELECT * FROM users');
        expect(dbResult.rows.length).toBe(2);
    });
});