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

// Створення таблиць
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
db.run(`
  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    type TEXT,
    time_spent INTEGER,
    result TEXT,
    emotion TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS parents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_name TEXT,
    parent_email TEXT,
    child_email TEXT
  )
`);

// Реєстрація учня
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

// Отримання даних учня
app.get('/student/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('Користувача не знайдено.');
    }
    res.json(row);
  });
});

// Збереження взаємодії
app.post('/log-interaction', (req, res) => {
  const { student_id, type, time_spent, result, emotion } = req.body;
  db.run(`
    INSERT INTO interactions (student_id, type, time_spent, result, emotion)
    VALUES (?, ?, ?, ?, ?)
  `, [student_id, type, time_spent, result, emotion], function(err) {
    if (err) {
      console.error('Помилка збереження активності:', err.message);
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Активність збережена!');
  });
});

// Додати батька/матір
app.post('/add-parent', (req, res) => {
  const { parent_name, parent_email, child_email } = req.body;
  if (!parent_email || !child_email) {
    return res.status(400).send('Обовʼязкові поля не заповнені.');
  }

  db.run(`
    INSERT INTO parents (parent_name, parent_email, child_email)
    VALUES (?, ?, ?)
  `, [parent_name, parent_email, child_email], function(err) {
    if (err) {
      console.error('❌ Помилка збереження даних батьків:', err.message);
      return res.status(500).send('Помилка збереження.');
    }
    res.send('Дані батьків збережено!');
  });
});

// Перегляд усіх батьків
app.get('/all-parents', (req, res) => {
  db.all(`SELECT * FROM parents`, [], (err, rows) => {
    if (err) {
      console.error('Помилка отримання батьків:', err.message);
      return res.status(500).send('Помилка сервера.');
    }
    res.json(rows);
  });
});

// Надсилання email-звітів
app.get('/send-reports', (req, res) => {
  db.all(`
    SELECT p.parent_email, s.name AS student_name, i.type, i.time_spent, i.result, i.emotion, i.timestamp
    FROM parents p
    JOIN students s ON p.child_email = s.email
    LEFT JOIN (
      SELECT * FROM interactions
      WHERE timestamp >= datetime('now', '-1 day')
    ) i ON s.id = i.student_id
  `, (err, rows) => {
    if (err) {
      console.error('❌ Помилка запиту:', err.message);
      return res.status(500).send('Помилка отримання звітів.');
    }

    const reports = {};

    rows.forEach(row => {
      if (!reports[row.parent_email]) {
        reports[row.parent_email] = {
          student_name: row.student_name,
          interactions: []
        };
      }

      if (row.type) {
        reports[row.parent_email].interactions.push({
          type: row.type,
          time_spent: row.time_spent,
          result: row.result,
          emotion: row.emotion,
          timestamp: row.timestamp
        });
      }
    });

    // Надсилання email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'your.email@gmail.com', // заміни
        pass: 'your_app_password'     // заміни
      }
    });

    for (const parent in reports) {
      const { student_name, interactions } = reports[parent];

      let htmlContent = `<h2>Звіт про активність ${student_name}</h2>`;
      if (interactions.length === 0) {
        htmlContent += `<p>За останню добу не було активностей на платформі.</p>`;
      } else {
        htmlContent += `<ul>`;
        interactions.forEach(inter => {
          htmlContent += `<li>
            <b>${inter.type}</b>: ${inter.time_spent} cек, результат: ${inter.result || '—'}, емоція: ${inter.emotion || '—'} <br>
            <i>${inter.timestamp}</i>
          </li>`;
        });
        htmlContent += `</ul>`;
      }

      transporter.sendMail({
        from: 'FocusEd Platform <your.email@gmail.com>', // заміни
        to: parent,
        subject: `Звіт про навчання дитини`,
        html: htmlContent
      }, (err, info) => {
        if (err) {
          console.error(`❌ Email не надіслано до ${parent}:`, err.message);
        } else {
          console.log(`✅ Звіт надіслано до ${parent}`);
        }
      });
    }

    res.send('Звіти обробляються');
  });
});

// Перевірка сервера
app.get('/', (req, res) => {
  res.send('🔧 FocusEd сервер працює');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
