const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'db', 'order.json');

// ===== IO helpers
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

// ===== validators/helpers
function sanitizeStatus(st) {
    const ok = ['Pending', 'Shipped', 'Delivered'];
    return ok.includes(st) ? st : 'Pending';
}
function toAmount(val) {
    const n = Number.parseFloat(val);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
}
function parseDate(str) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * @openapi
 * /order:
 *   get:
 *     tags: [Order]
 *     summary: Lista pedidos (com filtros opcionais)
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema: { type: string }
 *         description: Filtra por loja
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Shipped, Delivered]
 *       - in: query
 *         name: date_from
 *         schema: { type: string, format: date-time }
 *         description: Data inicial (>=)
 *       - in: query
 *         name: date_to
 *         schema: { type: string, format: date-time }
 *         description: Data final (<=)
 *     responses:
 *       200:
 *         description: Lista de pedidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Order' }
 */
router.get('/', async (req, res) => {
    const { store_id, status, date_from, date_to } = req.query;
    let items = await readAll();

    if (store_id) {
        items = items.filter(x => x.store_id === store_id);
    }
    if (status) {
        items = items.filter(x => x.status === status);
    }
    if (date_from) {
        const d1 = parseDate(date_from);
        if (d1) items = items.filter(x => parseDate(x.date) >= d1);
    }
    if (date_to) {
        const d2 = parseDate(date_to);
        if (d2) items = items.filter(x => parseDate(x.date) <= d2);
    }

    res.json(items);
});

/**
 * @openapi
 * /order/{id}:
 *   get:
 *     tags: [Order]
 *     summary: Busca pedido por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       404:
 *         description: Pedido não encontrado
 */
router.get('/:id', async (req, res) => {
    const items = await readAll();
    const found = items.find(x => x.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Pedido não encontrado' });
    res.json(found);
});

/**
 * @openapi
 * /order:
 *   post:
 *     tags: [Order]
 *     summary: Cria pedido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderCreate' }
 *           examples:
 *             exemplo:
 *               value:
 *                 store_id: "7a6cc1282c5f6ec0235acd2bfa780145aa2a67fd"
 *                 item: "[(product_id, quantity, campaign_id, unit_price)]"
 *                 total_amount: "123.00"
 *                 status: "Pending"
 *                 date: "2023-08-15 16:00:00"
 *     responses:
 *       201:
 *         description: Pedido criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Order' }
 *       400:
 *         description: Dados inválidos
 */
router.post('/', async (req, res) => {
    const { store_id, item, total_amount, status, date } = req.body || {};

    if (!store_id || !item || !total_amount) {
        return res.status(400).json({ error: 'store_id, item e total_amount são obrigatórios' });
    }

    const total = toAmount(total_amount);
    if (total === null) return res.status(400).json({ error: 'total_amount inválido' });

    const d = date ? parseDate(date) : new Date();
    if (!d) return res.status(400).json({ error: 'date inválido' });

    const items = await readAll();

    const novo = {
        id: randomUUID(),
        store_id,
        item,
        total_amount: total,
        status: sanitizeStatus(status),
        date: d.toISOString().slice(0, 19).replace('T', ' ')
    };

    items.push(novo);
    await writeAll(items);
    res.status(201).json(novo);
});

/**
 * @openapi
 * /order/{id}:
 *   put:
 *     tags: [Order]
 *     summary: Atualiza pedido por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrderUpdate' }
 *     responses:
 *       200:
 *         description: Pedido atualizado
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Pedido não encontrado
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { store_id, item, total_amount, status, date } = req.body || {};

    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado' });

    if (total_amount !== undefined) {
        const t = toAmount(total_amount);
        if (t === null) return res.status(400).json({ error: 'total_amount inválido' });
        items[idx].total_amount = t;
    }
    if (date !== undefined) {
        const d = parseDate(date);
        if (!d) return res.status(400).json({ error: 'date inválido' });
        items[idx].date = d.toISOString().slice(0, 19).replace('T', ' ');
    }

    if (store_id !== undefined) items[idx].store_id = store_id;
    if (item !== undefined) items[idx].item = item;
    if (status !== undefined) items[idx].status = sanitizeStatus(status);

    await writeAll(items);
    res.json(items[idx]);
});

/**
 * @openapi
 * /order/{id}:
 *   delete:
 *     tags: [Order]
 *     summary: Remove pedido por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Removido
 *       404:
 *         description: Pedido não encontrado
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pedido não encontrado' });

    items.splice(idx, 1);
    await writeAll(items);
    res.status(204).send();
});

module.exports = router;
