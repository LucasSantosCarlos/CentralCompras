const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

// ===== path do "banco"
const DB_PATH = path.join(__dirname, '..', 'db', 'product.json');

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
    const ok = ['on', 'off'];
    return ok.includes(st) ? st : 'on';
}
function toPrice(val) {
    const n = Number.parseFloat(val);
    if (!Number.isFinite(n) || n < 0) return null;
    // fixa 2 casas (salvamos número, não string)
    return Math.round(n * 100) / 100;
}
function toInt(val) {
    const n = Number.parseInt(val, 10);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
}

/**
 * @openapi
 * /product:
 *   get:
 *     tags: [Product]
 *     summary: Lista produtos (ou filtra)
 *     description: Filtros opcionais por nome (parcial), status e supplier_id.
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Filtro parcial por nome do produto
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [on, off]
 *         description: Filtrar por status
 *       - in: query
 *         name: supplier_id
 *         schema: { type: string }
 *         description: Filtrar por fornecedor (UUID)
 *     responses:
 *       200:
 *         description: Lista de produtos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Product' }
 */
router.get('/', async (req, res) => {
    const { name, status, supplier_id } = req.query;
    let items = await readAll();

    if (name) {
        const n = name.toLowerCase();
        items = items.filter(x => (x.name || '').toLowerCase().includes(n));
    }
    if (status) {
        items = items.filter(x => x.status === status);
    }
    if (supplier_id) {
        items = items.filter(x => x.supplier_id === supplier_id);
    }

    res.json(items);
});

/**
 * @openapi
 * /product/{id}:
 *   get:
 *     tags: [Product]
 *     summary: Busca produto por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Produto encontrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', async (req, res) => {
    const items = await readAll();
    const found = items.find(x => x.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(found);
});

/**
 * @openapi
 * /product:
 *   post:
 *     tags: [Product]
 *     summary: Cria produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductCreate' }
 *           examples:
 *             exemplo:
 *               value:
 *                 name: "Teclado e mouse"
 *                 description: "Kit teclado e mouse sem fio"
 *                 price: "200.00"
 *                 stock_quantity: "8"
 *                 supplier_id: "7a6cc1282c5f6ec0235acd2bfa780145aa2a67fd"
 *                 status: "on"
 *     responses:
 *       201:
 *         description: Produto criado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: "Conflito (ex.: produto duplicado)"
 */
router.post('/', async (req, res) => {
    const { name, description, price, stock_quantity, supplier_id, status } = req.body || {};

    if (!name || price === undefined || stock_quantity === undefined || !supplier_id) {
        return res.status(400).json({ error: 'name, price, stock_quantity e supplier_id são obrigatórios' });
    }

    const priceNum = toPrice(price);
    if (priceNum === null) return res.status(400).json({ error: 'price inválido (>= 0)' });

    const stockNum = toInt(stock_quantity);
    if (stockNum === null) return res.status(400).json({ error: 'stock_quantity inválido (inteiro >= 0)' });

    const items = await readAll();

    // Exemplo de unicidade simples: (name + supplier_id)
    if (items.some(x =>
        x.name?.toLowerCase() === String(name).toLowerCase() &&
        x.supplier_id === supplier_id
    )) {
        return res.status(409).json({ error: 'Já existe um produto com esse nome para o mesmo fornecedor' });
    }

    const novo = {
        id: randomUUID(),
        name,
        description: description || '',
        price: priceNum,                // número (ex.: 200)
        stock_quantity: stockNum,       // inteiro (ex.: 8)
        supplier_id,
        status: sanitizeStatus(status)
    };

    items.push(novo);
    await writeAll(items);
    res.status(201).json(novo);
});

/**
 * @openapi
 * /product/{id}:
 *   put:
 *     tags: [Product]
 *     summary: Atualiza produto por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductUpdate' }
 *     responses:
 *       200:
 *         description: Produto atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Product' }
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Produto não encontrado
 *       409:
 *         description: "Conflito (ex.: duplicidade)"
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, description, price, stock_quantity, supplier_id, status } = req.body || {};

    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });

    // validações pontuais
    if (price !== undefined) {
        const p = toPrice(price);
        if (p === null) return res.status(400).json({ error: 'price inválido (>= 0)' });
        items[idx].price = p;
    }
    if (stock_quantity !== undefined) {
        const s = toInt(stock_quantity);
        if (s === null) return res.status(400).json({ error: 'stock_quantity inválido (inteiro >= 0)' });
        items[idx].stock_quantity = s;
    }

    // checa duplicidade se name/supplier_id forem alterados
    const newName = name !== undefined ? name : items[idx].name;
    const newSupplier = supplier_id !== undefined ? supplier_id : items[idx].supplier_id;
    if ((name !== undefined || supplier_id !== undefined) &&
        items.some(x =>
            x.id !== id &&
            x.name?.toLowerCase() === String(newName).toLowerCase() &&
            x.supplier_id === newSupplier
        )) {
        return res.status(409).json({ error: 'Já existe um produto com esse nome para o mesmo fornecedor' });
    }

    if (name !== undefined) items[idx].name = name;
    if (description !== undefined) items[idx].description = description;
    if (supplier_id !== undefined) items[idx].supplier_id = supplier_id;
    if (status !== undefined) items[idx].status = sanitizeStatus(status);

    await writeAll(items);
    res.json(items[idx]);
});

/**
 * @openapi
 * /product/{id}:
 *   delete:
 *     tags: [Product]
 *     summary: Remove produto por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Removido
 *       404:
 *         description: Não encontrado
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });

    items.splice(idx, 1);
    await writeAll(items);
    res.status(204).send();
});

module.exports = router;
