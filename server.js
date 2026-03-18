const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: 'gradebook-secret-key-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Initialize SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'gradebook.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Create users table
    db.run(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => {
        if (err) console.error('Error creating users table:', err);
      }
    );

    // Create classes table with userId
    db.run(
      `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(userId, name),
        FOREIGN KEY (userId) REFERENCES users(id)
      )`,
      (err) => {
        if (err) console.error('Error creating classes table:', err);
      }
    );

    // Create grades table
    db.run(
      `CREATE TABLE IF NOT EXISTS grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classId INTEGER NOT NULL,
        score REAL NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (classId) REFERENCES classes(id)
      )`,
      (err) => {
        if (err) console.error('Error creating grades table:', err);
      }
    );
  });
}

// Helper function to hash passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// Helper function to get grade information
function getGradeInfo(score) {
  if (score >= 95) return { letter: 'A+', color: 'grade-A-plus' };
  if (score >= 90) return { letter: 'A', color: 'grade-A' };
  if (score >= 85) return { letter: 'B+', color: 'grade-B-plus' };
  if (score >= 80) return { letter: 'B', color: 'grade-B' };
  if (score >= 75) return { letter: 'C+', color: 'grade-C-plus' };
  if (score >= 70) return { letter: 'C', color: 'grade-C' };
  if (score >= 60) return { letter: 'D', color: 'grade-D' };
  return { letter: 'F', color: 'grade-F' };
}

// ============ AUTHENTICATION ENDPOINTS ============

// POST /api/auth/signup - Register a new user
app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const hashedPassword = hashPassword(password);
  
  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, hashedPassword],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      // Auto-login after signup
      req.session.userId = this.lastID;
      req.session.username = username;
      res.json({ success: true, userId: this.lastID, username });
    }
  );
});

// POST /api/auth/login - Login user
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const hashedPassword = hashPassword(password);
  
  db.get(
    `SELECT id, username FROM users WHERE username = ? AND password = ?`,
    [username, hashedPassword],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (!row) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
      
      req.session.userId = row.id;
      req.session.username = row.username;
      res.json({ success: true, userId: row.id, username: row.username });
    }
  );
});

// GET /api/auth/user - Get current user
app.get('/api/auth/user', (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  res.json({ user: { id: req.session.userId, username: req.session.username } });
});

// POST /api/auth/logout - Logout user
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

// ============ CLASS ENDPOINTS ============

// ============ CLASS ENDPOINTS ============

// GET all classes for current user with their grades
app.get('/api/classes', requireAuth, (req, res) => {
  const userId = req.session.userId;
  
  db.all(
    `SELECT c.id, c.name, COUNT(g.id) as gradeCount, AVG(g.score) as average
     FROM classes c
     LEFT JOIN grades g ON c.id = g.classId
     WHERE c.userId = ?
     GROUP BY c.id
     ORDER BY c.createdAt DESC`,
    [userId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const result = rows.map(row => ({
        id: row.id,
        name: row.name,
        average: row.average ? row.average.toFixed(1) : 0,
        gradeCount: row.gradeCount
      }));
      res.json(result);
    }
  );
});

// GET all grades for a specific class
app.get('/api/classes/:classId/grades', requireAuth, (req, res) => {
  const classId = req.params.classId;
  const userId = req.session.userId;
  
  // Verify the class belongs to the user
  db.get(
    `SELECT id FROM classes WHERE id = ? AND userId = ?`,
    [classId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(403).json({ error: 'Class not found' });
      }
      
      db.all(
        `SELECT id, score FROM grades WHERE classId = ? ORDER BY createdAt DESC`,
        [classId],
        (err, rows) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json(rows);
        }
      );
    }
  );
});

// POST a new class
app.post('/api/classes', requireAuth, (req, res) => {
  const { name } = req.body;
  const userId = req.session.userId;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  db.run(
    `INSERT INTO classes (userId, name) VALUES (?, ?)`,
    [userId, name.trim()],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Class already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, name });
    }
  );
});

// POST a new grade for a class
app.post('/api/classes/:classId/grades', requireAuth, (req, res) => {
  const classId = req.params.classId;
  const { score } = req.body;
  const userId = req.session.userId;

  if (isNaN(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: 'Grade must be between 0 and 100' });
  }

  // Verify the class belongs to the user
  db.get(
    `SELECT id FROM classes WHERE id = ? AND userId = ?`,
    [classId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(403).json({ error: 'Class not found' });
      }
      
      db.run(
        `INSERT INTO grades (classId, score) VALUES (?, ?)`,
        [classId, score],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          const gradeInfo = getGradeInfo(score);
          res.json({ id: this.lastID, score, classId, ...gradeInfo });
        }
      );
    }
  );
});

// DELETE a grade
app.delete('/api/grades/:gradeId', requireAuth, (req, res) => {
  const gradeId = req.params.gradeId;
  const userId = req.session.userId;
  
  // Verify the grade belongs to user's class
  db.get(
    `SELECT g.id FROM grades g
     INNER JOIN classes c ON g.classId = c.id
     WHERE g.id = ? AND c.userId = ?`,
    [gradeId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(403).json({ error: 'Grade not found' });
      }
      
      db.run(
        `DELETE FROM grades WHERE id = ?`,
        [gradeId],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true });
        }
      );
    }
  );
});

// DELETE a class and all its grades
app.delete('/api/classes/:classId', requireAuth, (req, res) => {
  const classId = req.params.classId;
  const userId = req.session.userId;
  
  // Verify the class belongs to the user
  db.get(
    `SELECT id FROM classes WHERE id = ? AND userId = ?`,
    [classId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(403).json({ error: 'Class not found' });
      }
      
      db.serialize(() => {
        db.run(`DELETE FROM grades WHERE classId = ?`, [classId], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          db.run(`DELETE FROM classes WHERE id = ?`, [classId], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({ success: true });
          });
        });
      });
    }
  );
});

// GET average for a class
app.get('/api/classes/:classId/average', requireAuth, (req, res) => {
  const classId = req.params.classId;
  const userId = req.session.userId;
  
  db.get(
    `SELECT AVG(g.score) as average, COUNT(*) as count FROM grades g
     INNER JOIN classes c ON g.classId = c.id
     WHERE g.classId = ? AND c.userId = ?`,
    [classId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const average = row.average ? row.average.toFixed(1) : 0;
      const gradeInfo = getGradeInfo(average);
      res.json({ average, gradeInfo });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🎓 Gradebook server running on http://localhost:${PORT}`);
  console.log(`📚 Open your browser and navigate to http://localhost:${PORT}\n`);
});

// Close database on exit
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    }
    console.log('Database connection closed');
    process.exit();
  });
});
