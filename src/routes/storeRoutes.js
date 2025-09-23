const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'db', 'store.json');

// Helpers de IO
async function readAll() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeAll([]);
      return [];
    }
    throw err;
  }
}

async function writeAll(list) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(list, null, 2), 'utf8');
}

// Validators
function isEmail(str = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
function sanitizeStatus(st) {
  const ok = ['on', 'off'];
  return ok.includes(st) ? st : 'on';
}
function normalizePhone(str = '') {
  return (str || '').replace(/\D+/g, '');
}

/**
 * @openapi
 * /store:
 *   get:
 *     tags: [Store]
 *     summary: Lista lojas (ou filtra por nome)
 *     parameters:
 *       - in: query
 *         name: store_name
 *         schema: { type: string }
 *         description: Filtro parcial por nome da loja
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [on, off]
 *         description: Filtrar por status (on/off)
 *     responses:
 *       200:
 *         description: Lista de lojas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Store' }
 */
router.get('/', async (req, res) => {
  const { store_name, status } = req.query;
  let items = await readAll();

  if (store_name) {
    const n = store_name.toLowerCase();
    items = items.filter(x => (x.store_name || '').toLowerCase().includes(n));
  }
  if (status) {
    items = items.filter(x => x.status === status);
  }

  res.json(items);
});

/**
 * @openapi
 * /store/{id}:
 *   get:
 *     tags: [Store]
 *     summary: Busca loja por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Loja encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Store' }
 *       404:
 *         description: Loja não encontrada
 */
router.get('/:id', async (req, res) => {
  const items = await readAll();
  const found = items.find(x => x.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Loja não encontrada' });
  res.json(found);
});

/**
 * @openapi
 * /store:
 *   post:
 *     tags: [Store]
 *     summary: Cria loja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StoreCreate' }
 *     responses:
 *       201:
 *         description: Loja criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Store' }
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Conflito (CNPJ já existente)
 */
router.post('/', async (req, res) => {
  const { store_name, cnpj, address, phone_number, contact_email, status } = req.body || {};

  if (!store_name || !cnpj || !contact_email) {
    return res.status(400).json({ error: 'store_name, cnpj e contact_email são obrigatórios' });
  }
  if (!isEmail(contact_email)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }

  const items = await readAll();

  if (items.some(x => x.cnpj === cnpj)) {
    return res.status(409).json({ error: 'Já existe loja com esse CNPJ' });
  }

  const novo = {
    id: randomUUID(),
    store_name,
    cnpj,
    address: address || '',
    phone_number: normalizePhone(phone_number),
    contact_email,
    status: sanitizeStatus(status)
  };

  items.push(novo);
  await writeAll(items);
  res.status(201).json(novo);
});

/**
 * @openapi
 * /store/{id}:
 *   put:
 *     tags: [Store]
 *     summary: Atualiza loja por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StoreUpdate' }
 *     responses:
 *       200:
 *         description: Loja atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Store' }
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Loja não encontrada
 *       409:
 *         description: Conflito (CNPJ duplicado)
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { store_name, cnpj, address, phone_number, contact_email, status } = req.body || {};

  const items = await readAll();
  const idx = items.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Loja não encontrada' });

  if (contact_email && !isEmail(contact_email)) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  if (cnpj && items.some(x => x.cnpj === cnpj && x.id !== id)) {
    return res.status(409).json({ error: 'Já existe loja com esse CNPJ' });
  }

  if (store_name !== undefined) items[idx].store_name = store_name;
  if (cnpj !== undefined) items[idx].cnpj = cnpj;
  if (address !== undefined) items[idx].address = address;
  if (phone_number !== undefined) items[idx].phone_number = normalizePhone(phone_number);
  if (contact_email !== undefined) items[idx].contact_email = contact_email;
  if (status !== undefined) items[idx].status = sanitizeStatus(status);

  await writeAll(items);
  res.json(items[idx]);
});

/**
 * @openapi
 * /store/{id}:
 *   delete:
 *     tags: [Store]
 *     summary: Remove loja por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Loja removida
 *       404:
 *         description: Loja não encontrada
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const items = await readAll();
  const idx = items.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Loja não encontrada' });

  items.splice(idx, 1);
  await writeAll(items);
  res.status(204).send();
});

module.exports = router;
