const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

// ====== CONFIG ======
const DB_PATH = path.join(__dirname, '..', 'db', 'supplier.json');

// ====== IO helpers ======
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

// ====== validators ======
function isEmail(str = '') {
    // email simples (o teu exemplo "j.heeler@gmail" passará se tiver domínio válido; recomendo usar um domínio completo ex. gmail.com)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}
function sanitizeStatus(st) {
    const ok = ['on', 'off'];
    return ok.includes(st) ? st : 'on';
}
function normalizePhone(str = '') {
    // remove tudo que não é dígito
    return (str || '').replace(/\D+/g, '');
}

/**
 * @openapi
 * /suppliers:
 *   get:
 *     tags: [Suppliers]
 *     summary: Lista fornecedores (ou filtra por nome e categoria)
 *     parameters:
 *       - in: query
 *         name: supplier_name
 *         schema: { type: string }
 *         description: Filtro parcial por nome do fornecedor
 *       - in: query
 *         name: supplier_category
 *         schema: { type: string }
 *         description: Filtro parcial por categoria
 *     responses:
 *       200:
 *         description: Lista de fornecedores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Supplier' }
 */
router.get('/', async (req, res) => {
    const { supplier_name, supplier_category } = req.query;
    let items = await readAll();

    if (supplier_name) {
        const n = supplier_name.toLowerCase();
        items = items.filter(x => (x.supplier_name || '').toLowerCase().includes(n));
    }
    if (supplier_category) {
        const c = supplier_category.toLowerCase();
        items = items.filter(x => (x.supplier_category || '').toLowerCase().includes(c));
    }

    res.json(items);
});

/**
 * @openapi
 * /suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Busca fornecedor por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Fornecedor
 *       404:
 *         description: Não encontrado
 */
router.get('/:id', async (req, res) => {
    const items = await readAll();
    const found = items.find(x => x.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Fornecedor não encontrado' });
    res.json(found);
});

/**
 * @openapi
 * /suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Cria fornecedor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SupplierCreate' }
 *     responses:
 *       201:
 *         description: Criado
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Conflito (unicidade básica)
 */
router.post('/', async (req, res) => {
    const { supplier_name, supplier_category, contact_email, phone_number, status } = req.body || {};

    if (!supplier_name || !contact_email) {
        return res.status(400).json({ error: 'supplier_name e contact_email são obrigatórios' });
    }
    if (!isEmail(contact_email)) {
        return res.status(400).json({ error: 'E-mail inválido (use domínio completo, ex.: gmail.com)' });
    }

    const items = await readAll();

    // unicidade (exemplo simples): mesmo nome + mesmo email
    if (items.some(x =>
        x.supplier_name?.toLowerCase() === supplier_name.toLowerCase() &&
        x.contact_email?.toLowerCase() === contact_email.toLowerCase()
    )) {
        return res.status(409).json({ error: 'Fornecedor já cadastrado com esse nome e e-mail' });
    }

    const novo = {
        id: randomUUID(),
        supplier_name,
        supplier_category: supplier_category || '',
        contact_email,
        phone_number: normalizePhone(phone_number),
        status: sanitizeStatus(status)
    };

    items.push(novo);
    await writeAll(items);
    res.status(201).json(novo);
});

/**
 * @openapi
 * /suppliers/{id}:
 *   put:
 *     tags: [Suppliers]
 *     summary: Atualiza fornecedor por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SupplierUpdate' }
 *     responses:
 *       200:
 *         description: Atualizado
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Não encontrado
 *       409:
 *         description: Conflito
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { supplier_name, supplier_category, contact_email, phone_number, status } = req.body || {};

    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Fornecedor não encontrado' });

    if (contact_email !== undefined && !isEmail(contact_email)) {
        return res.status(400).json({ error: 'E-mail inválido' });
    }

    // Exemplo de conflito: se mudar nome/email para combinação já existente em outro registro
    if (supplier_name !== undefined || contact_email !== undefined) {
        const newName = (supplier_name ?? items[idx].supplier_name) || '';
        const newEmail = (contact_email ?? items[idx].contact_email) || '';
        if (items.some(x =>
            x.id !== id &&
            x.supplier_name?.toLowerCase() === newName.toLowerCase() &&
            x.contact_email?.toLowerCase() === newEmail.toLowerCase()
        )) {
            return res.status(409).json({ error: 'Já existe fornecedor com esse nome e e-mail' });
        }
    }

    if (supplier_name !== undefined) items[idx].supplier_name = supplier_name;
    if (supplier_category !== undefined) items[idx].supplier_category = supplier_category;
    if (contact_email !== undefined) items[idx].contact_email = contact_email;
    if (phone_number !== undefined) items[idx].phone_number = normalizePhone(phone_number);
    if (status !== undefined) items[idx].status = sanitizeStatus(status);

    await writeAll(items);
    res.json(items[idx]);
});

/**
 * @openapi
 * /suppliers/{id}:
 *   delete:
 *     tags: [Suppliers]
 *     summary: Remove fornecedor por ID
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
    if (idx === -1) return res.status(404).json({ error: 'Fornecedor não encontrado' });

    items.splice(idx, 1);
    await writeAll(items);
    res.status(204).send();
});

module.exports = router;
