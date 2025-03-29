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

// 📌 Підключення до БД
const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB error:', err.message);
  else console.log('🟢 SQLite connected');
});

// 📌 Таблиці
db.run(`CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, surname TEXT, dob TEXT,
  email TEXT UNIQUE, password TEXT,
  avatar TEXT, learning_style TEXT, support_tools INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER, type TEXT, time_spent INTEGER,
  result TEXT, emotion TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_name TEXT,
  parent_email TEXT,
  child_email TEXT
)`);

// 📌 Реєстрація
app.post('/register-student', (req, res) => {
  const { name, surname, dob, email, password, avatar, learning_style, support_tools } = req.body;
  if (!email || !password || !name || !surname) return res.status(400).send('Обов’язкові поля');
  const hashed = bcrypt.hashSync(password, 10);
  db.run(`
    INSERT INTO students (name, surname, dob, email, password, avatar, learning_style, support_tools)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, surname, dob, email, hashed, avatar, learning_style, support_tools ? 1 : 0],
    function (err) {
      if (err) return res.status(409).send('Email вже існує');
      res.send('✅ Реєстрація успішна');
    });
});

// 📌 Вхід
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM students WHERE email = ?`, [email], (err, row) => {
    if (!row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ success: false, message: 'Невірна пошта або пароль' });
    }
    res.json({ success: true, student: { id: row.id, name: row.name, avatar: row.avatar, learning_style: row.learning_style } });
  });
});

// 📌 Додавання активності
app.post('/interaction', (req, res) => {
  const { student_id, type, time_spent, result, emotion } = req.body;
  db.run(`INSERT INTO interactions (student_id, type, time_spent, result, emotion) VALUES (?, ?, ?, ?, ?)`,
    [student_id, type, time_spent, result, emotion], (err) => {
      if (err) return res.status(500).send('Помилка збереження');
      res.send('✅ Збережено активність');
    });
});

// 📌 Додавання батьків
app.post('/add-parent', (req, res) => {
  const { parent_name, parent_email, child_email } = req.body;
  if (!parent_name || !parent_email || !child_email) return res.status(400).send('Усі поля обов’язкові');
  db.run(`INSERT INTO parents (parent_name, parent_email, child_email) VALUES (?, ?, ?)`,
    [parent_name, parent_email, child_email], (err) => {
      if (err) return res.status(500).send('Помилка збереження');
      res.send('✅ Дані батьків збережено');
    });
});

// 📌 Перевірка батьків (тільки для тесту)
app.get('/all-parents', (req, res) => {
  db.all(`SELECT * FROM parents`, (err, rows) => {
    if (err) return res.status(500).send('Помилка БД');
    res.json(rows);
  });
});

// 📌 Email-звітність
app.get('/send-reports', (req, res) => {
  db.all(`SELECT * FROM parents`, (err, parents) => {
    if (err) return res.status(500).send('Помилка з батьками');

    parents.forEach((p) => {
      db.all(`SELECT * FROM students WHERE email = ?`, [p.child_email], (err, students) => {
        if (!students?.length) return;
        const student = students[0];

        db.all(`SELECT * FROM interactions WHERE student_id = ? ORDER BY timestamp DESC LIMIT 5`, [student.id], (err, interactions) => {
          if (err) return;

          let message = `<h3>Звіт по ${student.name}:</h3>`;
          if (interactions.length === 0) {
            message += `<p>Діяльності ще не було.</p>`;
          } else {
            interactions.forEach((i) => {
              message += `<p>• ${i.type} — ${i.time_spent}с, Емоція: ${i.emotion || 'немає'}, Час: ${i.timestamp}</p>`;
            });
          }

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'focusedplatform@gmail.com',
              pass: 'gflo fmlg nycn pabc'
            }
          });

          transporter.sendMail({
            from: '"FocusEd Платформа" <YOUR_EMAIL@gmail.com>',
            to: p.parent_email,
            subject: `Звіт по ${student.name}`,
            html: message
          }, (error, info) => {
            if (error) console.error('❌ Email error:', error.message);
            else console.log(`📤 Email sent to ${p.parent_email}: ${info.response}`);
          });
        });
      });
    });

    res.send('✅ Звіти надіслані (якщо знайдені дані)');
  });
});

// 📌 Тест
app.get('/', (req, res) => {
  res.send('🔧 FocusEd сервер працює');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
