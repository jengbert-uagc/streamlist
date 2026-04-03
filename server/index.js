import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PORT = Number(process.env.PORT || 3001);
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

const DEFAULT_USERS = [
  {
    username: 'admin',
    passwordHash: bcrypt.hashSync('password', BCRYPT_ROUNDS)
  }
];

const verifyPassword = async (user, password) => {
  return typeof user.passwordHash === 'string' && bcrypt.compare(password, user.passwordHash);
};

const toBcryptUser = async (user, password) => {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return {
    username: user.username,
    passwordHash
  };
};

const ensureUsersFile = async () => {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(USERS_FILE, 'utf8');
  } catch {
    await writeFile(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2), 'utf8');
  }
};

const getUsers = async () => {
  const usersJson = await readFile(USERS_FILE, 'utf8');
  return JSON.parse(usersJson);
};

const saveUsers = async (users) => {
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
};

const getJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody) {
    return {};
  }
  return JSON.parse(rawBody);
};

await ensureUsersFile();

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    try {
      const { username, password } = await getJsonBody(req);
      if (!username || !password) {
        sendJson(res, 400, { error: 'Username and password are required' });
        return;
      }

      const users = await getUsers();
      const user = users.find((storedUser) => storedUser.username === username);
      if (!user) {
        sendJson(res, 401, { error: 'Invalid username or password' });
        return;
      }

      const isValidPassword = await verifyPassword(user, password);
      if (!isValidPassword) {
        sendJson(res, 401, { error: 'Invalid username or password' });
        return;
      }

      sendJson(res, 200, { username: user.username });
      return;
    } catch {
      sendJson(res, 400, { error: 'Invalid request payload' });
      return;
    }
  }

  if (req.method === 'POST' && req.url === '/api/auth/update-password') {
    try {
      const { username, currentPassword, newPassword } = await getJsonBody(req);
      if (!username || !currentPassword || !newPassword) {
        sendJson(res, 400, { error: 'Username, current password, and new password are required' });
        return;
      }

      const users = await getUsers();
      const userIndex = users.findIndex((storedUser) => storedUser.username === username);
      if (userIndex === -1) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const isValidCurrentPassword = await verifyPassword(users[userIndex], currentPassword);
      if (!isValidCurrentPassword) {
        sendJson(res, 401, { error: 'Current password is incorrect' });
        return;
      }

      users[userIndex] = await toBcryptUser(users[userIndex], newPassword);
      await saveUsers(users);
      sendJson(res, 200, { success: true });
      return;
    } catch {
      sendJson(res, 400, { error: 'Invalid request payload' });
      return;
    }
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});
