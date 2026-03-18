# Gradebook Application

A full-stack gradebook application with a Node.js/Express backend and SQLite database. Track your classes, add grades, and view color-coded feedback based on your performance.

## Features

- ✅ **Add Classes** - Create and manage multiple classes
- ✅ **Add Grades** - Add grades to each class (0-100 scale)
- ✅ **Color-Coded System:**
  - **A+** (95-100): Green
  - **A** (90-94): Light Green
  - **B+** (85-89): Blue
  - **B** (80-84): Light Blue
  - **C+** (75-79): Orange
  - **C** (70-74): Dark Orange
  - **D** (60-69): Red
  - **F** (Below 60): Dark Red
- ✅ **Automatic Average** - Shows your class average with automatic letter grade
- ✅ **Delete Options** - Remove individual grades or entire classes
- ✅ **Persistent Storage** - SQLite database stores all data
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile
- ✅ **RESTful API** - Clean backend API for data management

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **API**: RESTful

## Installation

1. **Install Node.js** (if not already installed)
   - Download from https://nodejs.org/

2. **Install dependencies**
   ```bash
   cd "Gradebook Project"
   npm install
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
(Requires nodemon to be installed globally or as a dev dependency)

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000`

Open your browser and navigate to:
```
http://localhost:3000
```

## API Documentation

### Endpoints

#### Classes
- **GET** `/api/classes` - Get all classes with averages
- **POST** `/api/classes` - Create a new class
  - Body: `{ "name": "Math 101" }`
- **DELETE** `/api/classes/:classId` - Delete a class and all its grades

#### Grades
- **GET** `/api/classes/:classId/grades` - Get all grades for a class
- **POST** `/api/classes/:classId/grades` - Add a grade to a class
  - Body: `{ "score": 95 }`
- **DELETE** `/api/grades/:gradeId` - Delete a specific grade
- **GET** `/api/classes/:classId/average` - Get class average and grade info

## File Structure

```
Gradebook Project/
├── server.js           # Express server and API routes
├── package.json        # Node.js dependencies
├── gradebook.db        # SQLite database (created on first run)
├── public/
│   └── index.html      # Frontend application
└── README.md           # This file
```

## How to Use

1. **Start the server** using one of the commands above
2. **Open your browser** to `http://localhost:3000`
3. **Add a class** by entering its name and clicking "Add Class"
4. **Add grades** by entering a score (0-100) for each class
5. **View your average** - automatically calculated and color-coded
6. **Delete grades or classes** using the delete buttons

## Notes

- All data is persisted in the SQLite database (`gradebook.db`)
- Class names must be unique
- Grades must be between 0 and 100
- The application includes error handling and validation

## Future Enhancements

- User authentication and login
- Multiple users with separate gradebooks
- Class weight/credit hours
- GPA calculation
- Export to PDF
- Grade statistics and charts
- Mobile app version
