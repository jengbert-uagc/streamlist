import { createHash, randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PORT = Number(process.env.PORT || 3001);

const DEFAULT_USERS = [
  {
    username: 'admin',
    salt: 'somesalt',
    hash: '53d4287d1cad92ab81758a6b99f9d1e015a08d851d3905cca8e1ac5f8e4d6ba55bcbba88ae0a0045cfe1c44a5e1b5cc7d9777a846e6f83c733d8f360098b544d'
  }
];

const hashPassword = (password, salt) => {
  return createHash('sha512').update(password + salt).digest('hex');
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
      if (!user || hashPassword(password, user.salt) !== user.hash) {
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
      if (hashPassword(currentPassword, users[userIndex].salt) !== users[userIndex].hash) {
        sendJson(res, 401, { error: 'Current password is incorrect' });
        return;
      }

      const salt = randomBytes(12).toString('hex');
      users[userIndex] = {
        ...users[userIndex],
        salt,
        hash: hashPassword(newPassword, salt)
      };
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
