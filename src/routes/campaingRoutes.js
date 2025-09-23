const express = require('express');
const router = express.Router();

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');

const DB_PATH = path.join(__dirname, '..', 'db', 'campaign.json');

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
function parseDate(str) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}
function formatSQLLike(d) {
    // "YYYY-MM-DD HH:mm:ss"
    return d.toISOString().slice(0, 19).replace('T', ' ');
}
function validPercent(v) {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null;
}

/**
 * @openapi
 * /campaign:
 *   get:
 *     tags: [Campaign]
 *     summary: Lista campanhas (filtros opcionais)
 *     description: "Filtra por name (parcial), supplier_id e intervalo de datas (start/end)."
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: "Filtro parcial por nome (case-insensitive)"
 *       - in: query
 *         name: supplier_id
 *         schema: { type: string }
 *         description: "Filtrar por fornecedor"
 *       - in: query
 *         name: start_from
 *         schema: { type: string, format: date-time }
 *         description: "Start date >= start_from"
 *       - in: query
 *         name: start_to
 *         schema: { type: string, format: date-time }
 *         description: "Start date <= start_to"
 *       - in: query
 *         name: end_from
 *         schema: { type: string, format: date-time }
 *         description: "End date >= end_from"
 *       - in: query
 *         name: end_to
 *         schema: { type: string, format: date-time }
 *         description: "End date <= end_to"
 *     responses:
 *       200:
 *         description: "Lista de campanhas"
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Campaign' }
 */
router.get('/', async (req, res) => {
    const { name, supplier_id, start_from, start_to, end_from, end_to } = req.query;
    let items = await readAll();

    if (name) {
        const n = name.toLowerCase();
        items = items.filter(x => (x.name || '').toLowerCase().includes(n));
    }
    if (supplier_id) {
        items = items.filter(x => x.supplier_id === supplier_id);
    }
    if (start_from) {
        const d = parseDate(start_from);
        if (d) items = items.filter(x => parseDate(x.start_date) >= d);
    }
    if (start_to) {
        const d = parseDate(start_to);
        if (d) items = items.filter(x => parseDate(x.start_date) <= d);
    }
    if (end_from) {
        const d = parseDate(end_from);
        if (d) items = items.filter(x => parseDate(x.end_date) >= d);
    }
    if (end_to) {
        const d = parseDate(end_to);
        if (d) items = items.filter(x => parseDate(x.end_date) <= d);
    }

    res.json(items);
});

/**
 * @openapi
 * /campaign/{id}:
 *   get:
 *     tags: [Campaign]
 *     summary: Busca campanha por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: "Campanha encontrada"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Campaign' }
 *       404:
 *         description: "Campanha não encontrada"
 */
router.get('/:id', async (req, res) => {
    const items = await readAll();
    const found = items.find(x => x.id === req.params.id);
    if (!found) return res.status(404).json({ error: 'Campanha não encontrada' });
    res.json(found);
});

/**
 * @openapi
 * /campaign:
 *   post:
 *     tags: [Campaign]
 *     summary: Cria campanha
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CampaignCreate' }
 *           examples:
 *             exemplo:
 *               value:
 *                 supplier_id: "7a6cc1282c5f6ec0235acd2bfa780145aa2a67fd"
 *                 name: "Black Friday"
 *                 start_date: "2023-08-15 16:00:00"
 *                 end_date: "2023-08-20 23:59:59"
 *                 discount_percentage: "20"
 *     responses:
 *       201:
 *         description: "Campanha criada"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Campaign' }
 *       400:
 *         description: "Dados inválidos"
 *       409:
 *         description: "Conflito (nome duplicado no mesmo fornecedor e intervalo)"
 */
router.post('/', async (req, res) => {
    const { supplier_id, name, start_date, end_date, discount_percentage } = req.body || {};

    if (!supplier_id || !name || !start_date || !end_date || discount_percentage === undefined) {
        return res.status(400).json({ error: 'supplier_id, name, start_date, end_date e discount_percentage são obrigatórios' });
    }

    const sd = parseDate(start_date);
    const ed = parseDate(end_date);
    if (!sd || !ed) return res.status(400).json({ error: 'Datas inválidas' });
    if (sd > ed) return res.status(400).json({ error: 'start_date deve ser <= end_date' });

    const pct = validPercent(discount_percentage);
    if (pct === null) return res.status(400).json({ error: 'discount_percentage deve ser entre 0 e 100' });

    const items = await readAll();

    // regra de conflito simples: nome + supplier_id no mesmo intervalo (sobreposição)
    const overlap = items.some(x =>
        x.supplier_id === supplier_id &&
        (x.name || '').toLowerCase() === name.toLowerCase() &&
        // se intervalos se sobrepõem
        parseDate(x.start_date) <= ed && sd <= parseDate(x.end_date)
    );
    if (overlap) {
        return res.status(409).json({ error: 'Já existe campanha com esse nome para o fornecedor nesse intervalo' });
    }

    const novo = {
        id: randomUUID(),
        supplier_id,
        name,
        start_date: formatSQLLike(sd),
        end_date: formatSQLLike(ed),
        discount_percentage: pct
    };

    items.push(novo);
    await writeAll(items);
    res.status(201).json(novo);
});

/**
 * @openapi
 * /campaign/{id}:
 *   put:
 *     tags: [Campaign]
 *     summary: Atualiza campanha por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CampaignUpdate' }
 *     responses:
 *       200:
 *         description: "Campanha atualizada"
 *       400:
 *         description: "Dados inválidos"
 *       404:
 *         description: "Campanha não encontrada"
 *       409:
 *         description: "Conflito (sobreposição de intervalo/nome/fornecedor)"
 */
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { supplier_id, name, start_date, end_date, discount_percentage } = req.body || {};

    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Campanha não encontrada' });

    // valida porcentagem se vier
    if (discount_percentage !== undefined) {
        const pct = validPercent(discount_percentage);
        if (pct === null) return res.status(400).json({ error: 'discount_percentage deve ser entre 0 e 100' });
        items[idx].discount_percentage = pct;
    }

    // valida datas se vierem
    let sd = start_date !== undefined ? parseDate(start_date) : parseDate(items[idx].start_date);
    let ed = end_date !== undefined ? parseDate(end_date) : parseDate(items[idx].end_date);
    if (start_date !== undefined && !sd) return res.status(400).json({ error: 'start_date inválida' });
    if (end_date !== undefined && !ed) return res.status(400).json({ error: 'end_date inválida' });
    if (sd && ed && sd > ed) return res.status(400).json({ error: 'start_date deve ser <= end_date' });

    const newSupplier = supplier_id !== undefined ? supplier_id : items[idx].supplier_id;
    const newName = name !== undefined ? name : items[idx].name;

    // checa sobreposição com outras campanhas do mesmo supplier e mesmo nome
    const conflict = items.some(x =>
        x.id !== id &&
        x.supplier_id === newSupplier &&
        (x.name || '').toLowerCase() === String(newName).toLowerCase() &&
        parseDate(x.start_date) <= ed && sd <= parseDate(x.end_date)
    );
    if (conflict) {
        return res.status(409).json({ error: 'Conflito: já existe campanha com esse nome e intervalo para o fornecedor' });
    }

    if (supplier_id !== undefined) items[idx].supplier_id = supplier_id;
    if (name !== undefined) items[idx].name = name;
    if (start_date !== undefined) items[idx].start_date = formatSQLLike(sd);
    if (end_date !== undefined) items[idx].end_date = formatSQLLike(ed);

    await writeAll(items);
    res.json(items[idx]);
});

/**
 * @openapi
 * /campaign/{id}:
 *   delete:
 *     tags: [Campaign]
 *     summary: Remove campanha por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: "Removida"
 *       404:
 *         description: "Campanha não encontrada"
 */
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    const items = await readAll();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Campanha não encontrada' });

    items.splice(idx, 1);
    await writeAll(items);
    res.status(204).send();
});

module.exports = router;
