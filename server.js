const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3001; // для Render

app.use(cors());
app.use(bodyParser.json());

// Підключення до бази
const db = new sqlite3.Database('./focused.db', (err) => {
    if (err) console.error('❌ DB error:', err.message);
    else console.log('🟢 Connected to SQLite database.');
});

// Створення таблиці студентів
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

// 📌 Реєстрація
app.post('/register-student', (req, res) => {
    const { name, surname, dob, email, password, avatar, learning_style, support_tools } = req.body;

    if (!email || !password || !name || !surname) {
        return res.status(400).send('Заповніть усі обов’язкові поля.');
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = `
        INSERT INTO students (name, surname, dob, email, password, avatar, learning_style, support_tools)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        name, surname, dob, email,
        hashedPassword, avatar, learning_style,
        support_tools ? 1 : 0
    ], function (err) {
        if (err) {
            console.error('❌ DB insert error:', err.message);
            return res.status(500).send('Помилка збереження користувача.');
        }
        console.log('✅ Зареєстровано:', email);
        res.send('Реєстрація успішна!');
    });
});

// 📌 Логін
app.post('/login-student', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM students WHERE email = ?`, [email], (err, row) => {
        if (err) {
            console.error('❌ DB error:', err.message);
            return res.status(500).send('Помилка сервера.');
        }
        if (!row) {
            return res.status(401).send('Невірна електронна пошта або пароль.');
        }

        const isMatch = bcrypt.compareSync(password, row.password);
        if (!isMatch) {
            return res.status(401).send('Невірна електронна пошта або пароль.');
        }

        console.log('🔓 Вхід успішний для:', row.email);
        res.json({
            message: 'Вхід успішний!',
            student: {
                id: row.id,
                name: row.name,
                avatar: row.avatar,
                learning_style: row.learning_style
            }
        });
    });
});

// 📌 Отримання студента по ID
app.get('/student/:id', (req, res) => {
    const id = req.params.id;

    db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('❌ DB get error:', err.message);
            return res.status(500).send('Не вдалося завантажити дані.');
        }
        if (!row) {
            return res.status(404).send('Користувача не знайдено.');
        }
        res.json(row);
    });
});

// Запуск
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
