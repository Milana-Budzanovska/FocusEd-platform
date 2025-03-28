const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// 📌 Підключення до бази
const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('🟢 Connected to SQLite database.');
});

// 📌 Таблиця студентів
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

// 📌 Таблиця батьків
db.run(`
  CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_name TEXT,
    parent_email TEXT,
    child_email TEXT
  )
`);

// 📌 Таблиця взаємодій
db.run(`
  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    type TEXT,
    duration INTEGER,
    result TEXT,
    emotion TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ✅ Реєстрація учня
app.post('/register-student', (req, res) => {
  const { name, surname, dob, email, password, avatar, learning_style, support_tools } = req.body;
  if (!email || !password || !name || !surname) {
    return res.status(400).send('Відсутні обов’язкові поля.');
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = `
    INSERT INTO students (name, surname, dob, email, password, avatar, learning_style, support_tools)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(sql, [name, surname, dob, email, hashedPassword, avatar, learning_style, support_tools ? 1 : 0], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).send('Такий email уже існує.');
      }
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Реєстрація успішна!');
  });
});

// ✅ Вхід учня
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM students WHERE email = ?`, [email], (err, row) => {
    if (err || !row) {
      return res.status(401).json({ success: false, message: 'Невірна пошта або пароль.' });
    }
    const match = bcrypt.compareSync(password, row.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Невірна пошта або пароль.' });
    }
    res.json({
      success: true,
      student: {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        learning_style: row.learning_style
      }
    });
  });
});

// ✅ Отримання даних учня
app.get('/student/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('Користувача не знайдено.');
    }
    res.json(row);
  });
});

// ✅ Збереження взаємодії
app.post('/interaction', (req, res) => {
  const { student_id, type, duration, result, emotion } = req.body;
  const sql = `
    INSERT INTO interactions (student_id, type, duration, result, emotion)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.run(sql, [student_id, type, duration, result, emotion], function (err) {
    if (err) {
      console.error('❌ Interaction save error:', err.message);
      return res.status(500).send('Помилка збереження взаємодії.');
    }
    res.send('Взаємодію збережено.');
  });
});

// ✅ Збереження батьків
app.post('/register-parent', (req, res) => {
  const { parent_name, parent_email, child_email } = req.body;
  if (!parent_name || !parent_email || !child_email) {
    return res.status(400).send('Будь ласка, заповніть усі поля.');
  }
  const sql = `
    INSERT INTO parents (parent_name, parent_email, child_email)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [parent_name, parent_email, child_email], function (err) {
    if (err) {
      console.error('❌ Parent save error:', err.message);
      return res.status(500).send('Помилка збереження батьків.');
    }
    res.send('Дані батьків збережено!');
  });
});

// ✅ Перегляд усіх батьків
app.get('/all-parents', (req, res) => {
  db.all(`SELECT * FROM parents`, (err, rows) => {
    if (err) {
      console.error('❌ DB fetch error:', err.message);
      return res.status(500).send('Помилка завантаження батьків.');
    }
    res.json(rows);
  });
});

// ✅ Тестування
app.get('/', (req, res) => {
  res.send('🔧 FocusEd сервер працює');
});

// ✅ Запуск сервера
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
