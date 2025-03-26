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
    if (err) console.error('❌ Помилка підключення до БД:', err.message);
    else console.log('🟢 Connected to SQLite database.');
});

// Створення таблиці студентів (якщо ще не створена)
db.run(`
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        surname TEXT,
        dob TEXT,
        email TEXT UNIQUE,
        password TEXT,
        avatar TEXT,
        learning_style TEXT,
        support_tools INTEGER
    )
`);

// Перевірка сервера
app.get('/', (req, res) => {
    res.send('Сервер працює, база даних підключена!');
});

// Реєстрація нового студента
app.post('/register-student', (req, res) => {
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
    ], function(err) {
        if (err) {
            console.error('❌ Помилка збереження в БД:', err.message);
            return res.status(500).send('Помилка при збереженні користувача.');
        }

        console.log('✅ Новий студент зареєстрований:', name, surname);
        res.send('Реєстрація успішна!');
    });
});

// Вхід (логін) користувача
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Введіть email та пароль!');
    }

    const sql = 'SELECT * FROM students WHERE email = ?';
    db.get(sql, [email], (err, user) => {
        if (err) {
            console.error('❌ Помилка при вході:', err.message);
            return res.status(500).send('Помилка сервера.');
        }

        if (!user) {
            return res.status(401).send('Користувача не знайдено.');
        }

        const isMatch = bcrypt.compareSync(password, user.password);
        if (!isMatch) {
            return res.status(401).send('Невірний пароль.');
        }

        console.log('✅ Вхід виконано для:', user.email);
        res.send('Вхід успішний!');
    });
});

// Запуск сервера
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
