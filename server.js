const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database('./focused.db', (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('🟢 Connected to SQLite database.');
});

// ------------------- CREATE TABLES -------------------
db.serialize(() => {
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
      activity TEXT,
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
});

// ------------------- STUDENT ROUTES -------------------
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

app.get('/student/:id', (req, res) => {
  const id = req.params.id;
  db.get(`SELECT id, name, avatar, learning_style FROM students WHERE id = ?`, [id], (err, row) => {
    if (err || !row) {
      return res.status(404).send('Користувача не знайдено.');
    }
    res.json(row);
  });
});

// ------------------- PARENT ROUTES -------------------
app.post('/register-parent', (req, res) => {
  const { parent_name, parent_email, child_email } = req.body;
  const sql = `INSERT INTO parents (parent_name, parent_email, child_email) VALUES (?, ?, ?)`;
  db.run(sql, [parent_name, parent_email, child_email], function(err) {
    if (err) {
      console.error(err.message);
      return res.status(500).send('Помилка збереження батьківських даних.');
    }
    res.send('Дані батьків збережено!');
  });
});

// ------------------- EMAIL LOGIC -------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'focusedplatform@gmail.com',         // ← замінити
    pass: 'gflo fmlg nycn pabc'             // ← App password, не звичайний пароль
  }
});

// ------------------- /send-reports -------------------
app.get('/send-reports', async (req, res) => {
  try {
    db.all(`SELECT * FROM parents`, [], (err, parents) => {
      if (err) return res.status(500).send('Помилка отримання звітів.');

      parents.forEach((parent) => {
        db.all(
          `SELECT * FROM interactions WHERE student_id = (SELECT id FROM students WHERE email = ?) ORDER BY timestamp DESC LIMIT 5`,
          [parent.child_email],
          (err2, interactions) => {
            if (err2 || interactions.length === 0) return;

            const activitySummary = interactions.map(log => 
              `• ${log.activity} (${log.time_spent} сек): ${log.emotion || 'без емоції'}`
            ).join('\n');

            const mailOptions = {
              from: 'fousedplatform@gmail.com',
              to: parent.parent_email,
              subject: `Звіт про активність дитини (${parent.child_email})`,
              text: `Останні взаємодії:\n\n${activitySummary}`
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) console.error(`❌ Email не надіслано:`, error);
              else console.log(`✅ Email надіслано: ${info.response}`);
            });
          }
        );
      });

      res.send('Звіти відправлено.');
    });
  } catch (err) {
    res.status(500).send('Помилка при надсиланні звітів.');
  }
});

// ------------------- АВТОМАТИЧНЕ надсилання о 20:00 -------------------
cron.schedule('0 18 * * *', () => {
  console.log('🕗 Запускається автоматичне надсилання звітів...');
  fetch('https://focused-server.onrender.com/send-reports')
    .then(res => res.text())
    .then(text => console.log('🔔 Відповідь сервера:', text))
    .catch(err => console.error('❌ Помилка fetch:', err.message));
});

// ------------------- ТЕСТ -------------------
app.get('/', (req, res) => {
  res.send('🔧 FocusEd сервер працює');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${port}`);
});
