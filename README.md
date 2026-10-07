# Tasklane – full-stack to-do app (React + Express + MongoDB)

```
todo-app/
├── backend/    Express API, Mongoose models, JWT auth, Jest + Supertest tests
└── frontend/   React (Vite) UI
```

## Features
- Sign up / log in (bcrypt-hashed passwords, JWT, 2h expiry); each user sees only their own tasks
- Add, edit, complete, delete tasks; priority (low/medium/high); due dates; overdue highlighting
- Filter (All / To do / Done / Overdue), priority filter, search, sort (newest, oldest, due, priority)
- Live stats and "Clear completed"
- Stored in MongoDB; login persists across refresh

## Run (Windows, MongoDB service must be running)
Terminal 1 – API
```
cd backend
npm install
npm start
```
Terminal 2 – UI
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Tests
```
cd backend
npm test            # 16 API integration tests (uses database todoapp_test, dropped after the run)
```
With both servers running:
```
cd frontend
npm run smoke       # frontend -> proxy -> API -> MongoDB end-to-end check
```

## API
| Method | Route | Auth | Purpose | Codes |
|---|---|---|---|---|
| POST | /api/auth/register | – | Create account, returns token | 201 400 409 |
| POST | /api/auth/login | – | Log in, returns token | 200 400 401 |
| GET | /api/auth/me | ✔ | Current user | 200 401 |
| GET | /api/todos | ✔ | List (`status`, `priority`, `q`, `sort`) | 200 401 |
| GET | /api/todos/stats | ✔ | total / active / completed / overdue | 200 |
| POST | /api/todos | ✔ | Create | 201 400 |
| PATCH | /api/todos/:id | ✔ | Edit or complete | 200 400 404 |
| DELETE | /api/todos/:id | ✔ | Delete one | 200 404 |
| DELETE | /api/todos/completed | ✔ | Delete all completed | 200 |
