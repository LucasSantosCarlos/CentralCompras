const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');


const DB_PATH = path.join(__dirname, '..', 'db', 'users.json');

async function readUsers() {
    try {
        const data = await fs.readFile(DB_PATH, 'utf8');
        const parsed = JSON.parse(data || '[]');

        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        if (err.code === 'ENOENT') {
            await writeUsers([]);
            return [];
        }
        throw err;
    }
}

async function writeUsers(users) {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(users, null, 2), 'utf8');
}

function isEmail(str = '') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
function sanitizeLevel(lvl) {
    const ok = ['admin', 'user'];
    return ok.includes(lvl) ? lvl : 'user';
}
function sanitizeStatus(st) {
    const ok = ['on', 'off'];
    return ok.includes(st) ? st : 'on';
}

router.get('/', async (req, res) => {
    const { name } = req.query;
    const users = await readUsers();

    let result = users;
    if (name) {
        const lower = name.toLowerCase();
        result = result.filter(u => u.name.toLowerCase().includes(lower));
    }

    const safe = result.map(({ pwd, ...rest }) => rest);
    res.json(safe);
});


router.get('/:id', async (req, res) => {
    const users = await readUsers();
    const u = users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(u);
});

router.post('/', async (req, res) => {
    const { name, contact_email, user, pwd, level, status } = req.body || {};

    if (!name || !contact_email || !user || !pwd) {
        return res.status(400).json({ error: 'name, e-mail, user e senha são obrigatórios' });
    }
    if (!isEmail(contact_email)) {
        return res.status(400).json({ error: 'e-mail inválido' });
    }

    const users = await readUsers();

    if (users.some(u => u.user === user)) {
        return res.status(409).json({ error: 'user já existe' });
    }
    if (users.some(u => u.contact_email === contact_email)) {
        return res.status(409).json({ error: 'e-mail já cadastrado' });
    }

    const id = randomUUID();
    const pwdHash = await bcrypt.hash(pwd, 10);

    const novo = {
        id,
        name,
        contact_email,
        user,
        pwd: pwdHash,
        level: sanitizeLevel(level),
        status: sanitizeStatus(status)
    };

    users.push(novo);
    await writeUsers(users);

    const { pwd: _, ...safe } = novo;
    res.status(201).json(safe);
});

router.post('/login', async (req, res) => {
    const { user, pwd } = req.body || {};
    if (!user || !pwd) return res.status(400).json({ error: 'user e senha são obrigatórios' });

    const users = await readUsers();
    const u = users.find(x => x.user === user && x.status !== 'off');
    if (!u) return res.status(401).json({ error: 'Credenciais inválidas' });

    const ok = await bcrypt.compare(pwd, u.pwd);
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' });

    const { pwd: _, ...safe } = u;
    res.json({ message: 'ok', user: safe });
});

router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, contact_email, user, pwd, level, status } = req.body || {};

    const users = await readUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (user && users.some(u => u.user === user && u.id !== id)) {
        return res.status(409).json({ error: 'user já existe' });
    }
    if (contact_email) {
        if (!isEmail(contact_email)) {
            return res.status(400).json({ error: 'e-mail inválido' });
        }
        if (users.some(u => u.contact_email === contact_email && u.id !== id)) {
            return res.status(409).json({ error: 'e-mail já cadastrado' });
        }
    }

    if (name !== undefined) users[idx].name = name;
    if (contact_email !== undefined) users[idx].contact_email = contact_email;
    if (user !== undefined) users[idx].user = user;
    if (level !== undefined) users[idx].level = sanitizeLevel(level);
    if (status !== undefined) users[idx].status = sanitizeStatus(status);

    if (pwd !== undefined) {
        users[idx].pwd = await bcrypt.hash(pwd, 10);
    }

    await writeUsers(users);
    const { pwd: _, ...safe } = users[idx];
    res.json(safe);
});


router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    const users = await readUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    users.splice(idx, 1);
    await writeUsers(users);
    res.status(204).send();
});


module.exports = router