const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// 📌 Підключення до бази даних
const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('🟢 Connected to SQLite database.');
});

// 📌 Створення таблиці студентів, якщо ще не існує
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

// 📌 Реєстрація студента
app.post('/login-student', (req, res) => {
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
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).send('Користувач з такою поштою вже існує.');
      }
      console.error('❌ DB insert error:', err.message);
      return res.status(500).send('Помилка збереження користувача.');
    }
    console.log('✅ Зареєстровано:', email);
    res.send('Реєстрація успішна!');
  });
});

// 📌 Логін студента
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Введіть пошту та пароль.');
  }

  db.get(`SELECT * FROM students WHERE email = ?`, [email], (err, row) => {
    if (err) {
      console.error('❌ DB login error:', err.message);
      return res.status(500).send('Помилка сервера.');
    }

    if (!row) {
      return res.status(401).json({ success: false, message: 'Невірна електронна пошта або пароль.' });
    }

    const isMatch = bcrypt.compareSync(password, row.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Невірна електронна пошта або пароль.' });
    }

    console.log('🔓 Успішний вхід для:', row.email);
    res.json({
      success: true,
      studentId: row.id,
      name: row.name,
      avatar: row.avatar,
      learning_style: row.learning_style
    });
  });
});

// 📌 Отримання даних студента по ID
app.get('/', (req, res) => {
res.send('🔧 FocusEd сервер працює');
});
  const id = req.params.id;

  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('❌ DB fetch error:', err.message);
      return res.status(500).send('Не вдалося завантажити дані.');
    }
    if (!row) {
      return res.status(404).send('Користувача не знайдено.');
    }
    res.json(row);
  });
});

// 📌 Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
