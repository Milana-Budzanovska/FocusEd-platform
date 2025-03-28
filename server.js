// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Підключення до бази даних
const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('🟢 Connected to SQLite database.');
});

// Таблиця студентів
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

// Таблиця для звітності батькам
db.run(`
  CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_name TEXT,
    parent_email TEXT,
    student_email TEXT
  )
`);

// Реєстрація студента
app.post('/register-student', (req, res) => {
  const { name, surname, dob, email, password, avatar, learning_style, support_tools } = req.body;
  if (!email || !password || !name || !surname) {
    return res.status(400).send('Відсутні обов’язкові поля.');
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = `INSERT INTO students (name, surname, dob, email, password, avatar, learning_style, support_tools)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, surname, dob, email, hashedPassword, avatar, learning_style, support_tools ? 1 : 0], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).send('Такий email уже існує.');
      }
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Реєстрація успішна!');
  });
});

// Вхід
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

// Отримання даних студента
app.get('/student/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('Користувача не знайдено.');
    }
    res.json(row);
  });
});

// Підписка батьків на звітність
app.post('/parent-subscribe', (req, res) => {
  const { parent_name, parent_email, student_email } = req.body;
  if (!parent_name || !parent_email || !student_email) {
    return res.status(400).send('Заповніть усі поля.');
  }
  const sql = `INSERT INTO parents (parent_name, parent_email, student_email) VALUES (?, ?, ?)`;
  db.run(sql, [parent_name, parent_email, student_email], function(err) {
    if (err) {
      return res.status(500).send('Помилка збереження підписки.');
    }
    res.send('✅ Ви підписалися на звітність.');
  });
});

// Email-розсилка (налаштування прикладове)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com', // 🔁 Заміни на свою адресу
    pass: 'your-password'         // 🔁 Заміни на свій пароль або app password
  }
});

function sendWeeklyReports() {
  db.all(`SELECT * FROM parents`, [], (err, parents) => {
    if (err) return console.error(err);
    parents.forEach(parent => {
      const mailOptions = {
        from: 'your-email@gmail.com',
        to: parent.parent_email,
        subject: 'Звіт про навчання дитини',
        text: `Шановний(а) ${parent.parent_name},

Це автоматичний звіт про успіхи дитини з платформи FocusEd. У майбутньому тут буде повний звіт.

З повагою,
Команда FocusEd`
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) console.error(error);
        else console.log('📧 Лист відправлено:', info.response);
      });
    });
  });
}

// Можна викликати вручну або по таймеру
// sendWeeklyReports();

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
