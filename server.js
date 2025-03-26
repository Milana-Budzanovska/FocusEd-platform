const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database('./focused.db', (err) => {
    if (err) console.error(err.message);
    else console.log('🟢 Connected to SQLite database.');
});

// Створення таблиці студентів
db.run(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        surname TEXT,
        dob TEXT,
        email TEXT,
        password TEXT,
        avatar TEXT,
        learning_style TEXT,
        support_tools INTEGER
    )
`);

// Роут для перевірки
app.get('/', (req, res) => {
    res.send('Сервер працює, база даних підключена!');
});

// Обробка форми реєстрації студента
app.post('/register-student', async (req, res) => {
    const {
        name, surname, dob, email,
        password, avatar, learning_style, support_tools
    } = req.body;

    if (!name || !surname || !email || !password) {
        return res.status(400).send('Будь ласка, заповніть усі обовʼязкові поля.');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = `INSERT INTO students 
        (name, surname, dob, email, password, avatar, learning_style, support_tools) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        name, surname, dob, email,
        hashedPassword, avatar, learning_style, support_tools ? 1 : 0
    ], (err) => {
        if (err) {
            console.error('❌ Помилка збереження в БД:', err.message);
            return res.status(500).send('Сталася помилка при збереженні.');
        }

        console.log('✅ Новий студент зареєстрований:', name, surname);
        res.send('Реєстрація успішна!');
    });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
