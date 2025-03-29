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

const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('🟢 Connected to SQLite database.');
});

// ======= Створення таблиць =======
db.run(`CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  surname TEXT,
  dob TEXT,
  email TEXT UNIQUE,
  password TEXT,
  avatar TEXT,
  learning_style TEXT,
  support_tools INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS parents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_name TEXT,
  parent_email TEXT,
  child_email TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  type TEXT,
  duration INTEGER,
  result TEXT,
  emotion TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ======= Реєстрація =======
app.post('/register-student', (req, res) => {
  const { name, surname, dob, email, password, avatar, learning_style, support_tools } = req.body;
  if (!email || !password || !name || !surname) return res.status(400).send('Відсутні обов’язкові поля.');
  const hashedPassword = bcrypt.hashSync(password, 10);
  const sql = `INSERT INTO students (name, surname, dob, email, password, avatar, learning_style, support_tools)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [name, surname, dob, email, hashedPassword, avatar, learning_style, support_tools ? 1 : 0], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) return res.status(409).send('Такий email уже існує.');
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Реєстрація успішна!');
  });
});

// ======= Вхід =======
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM students WHERE email = ?`, [email], (err, row) => {
    if (err || !row) return res.status(401).json({ success: false, message: 'Невірна пошта або пароль.' });
    const match = bcrypt.compareSync(password, row.password);
    if (!match) return res.status(401).json({ success: false, message: 'Невірна пошта або пароль.' });
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

// ======= Додавання батька =======
app.post('/add-parent', (req, res) => {
  const { parent_name, parent_email, child_email } = req.body;
  if (!parent_name || !parent_email || !child_email) return res.status(400).send('Заповніть усі поля.');
  const sql = `INSERT INTO parents (parent_name, parent_email, child_email) VALUES (?, ?, ?)`;
  db.run(sql, [parent_name, parent_email, child_email], function(err) {
    if (err) {
      console.error('❌ Помилка додавання батька:', err.message);
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Дані батьків збережено!');
  });
});

// ======= Email-звітність =======
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'focusedplatform@gmail.com',
    pass: 'gflo fmlg nycn pabc' // Скопійований app password із Google
  }
});

app.post('/send-reports', (req, res) => {
  const sql = `
    SELECT p.parent_email, s.name AS student_name, i.type, i.duration, i.result, i.emotion, i.timestamp
    FROM parents p
    JOIN students s ON s.email = p.child_email
    JOIN interactions i ON i.student_id = s.id
    WHERE i.timestamp >= datetime('now', '-1 day')
    ORDER BY p.parent_email, i.timestamp DESC
  `;
  db.all(sql, [], async (err, rows) => {
    if (err) {
      console.error('❌ DB report fetch error:', err.message);
      return res.status(500).send('Помилка отримання звітів.');
    }

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.parent_email]) grouped[row.parent_email] = [];
      grouped[row.parent_email].push(row);
    });

    for (const email in grouped) {
      const entries = grouped[email];
      const student = entries[0].student_name;
      const html = `
        <h2>Звіт по ${student}</h2>
        <ul>
          ${entries.map(e => `<li><b>${e.type}</b>: ${e.duration} хв, емоція: ${e.emotion || 'н/д'}, результат: ${e.result || 'н/д'} <i>(${e.timestamp})</i></li>`).join('')}
        </ul>
      `;
      try {
        await transporter.sendMail({
          from: 'FocusEd Звітність <focusedplatform@gmail.com>',
          to: email,
          subject: `Щоденний звіт по ${student}`,
          html
        });
        console.log(`📩 Звіт надіслано: ${email}`);
      } catch (e) {
        console.error(`❌ Помилка надсилання до ${email}:`, e.message);
      }
    }

    res.send('Звіти надіслані!');
  });
});

// ======= GET-версія для тесту через браузер =======
app.get('/send-reports', (req, res) => {
  fetch('https://focused-server.onrender.com/send-reports', {
    method: 'POST'
  })
    .then(r => r.text())
    .then(t => res.send(`<pre>${t}</pre>`))
    .catch(e => res.status(500).send('Помилка запуску звіту: ' + e.message));
});

// ======= Інше =======
app.get('/student/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err || !row) return res.status(404).send('Користувача не знайдено.');
    res.json(row);
  });
});

app.get('/', (req, res) => {
  res.send('🔧 FocusEd сервер працює');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
