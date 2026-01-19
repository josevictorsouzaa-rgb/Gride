import express from 'express';
import Firebird from 'node-firebird';
import cors from 'cors';
import bodyParser from 'body-parser';

const app = express();
const port = 8000;

// Configuração do Banco de Dados
const DB_PATH = 'C:\\Users\\DELL G15\\Desktop\\BD\\DATABASE\\DATABASE.FDB';

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const options = {
    host: '127.0.0.1',
    port: 3050,
    database: DB_PATH,
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096
};

// Funções Auxiliares
const safeString = (v) => (v === null || v === undefined) ? '' : String(v).trim();

// --- ROTA DE BLOCOS CORRIGIDA ---
app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro de ligação ao DB' });
        
        // 1. Obter Reservas e Logs para Status
        db.query('SELECT BLOCK_ID, USER_NAME FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), r.USER_NAME));

            db.query("SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')", [], (errL, logs) => {
                const countedSet = new Set();
                if(logs) logs.forEach(l => countedSet.add(l.PRO_COD));

                // ETAPA 1: DESCOBERTA (Encontrar IDs de blocos únicos seguindo os filtros)
                let discoverySql = `SELECT FIRST ? P.PRO_COD, P.PRO_COD_SIMILAR FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S'`;
                const discoveryParams = [limit * 5]; 

                if (search) { discoverySql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; discoveryParams.push(search, search); }
                if (gr_cod) { discoverySql += ` AND TRIM(P.GR_COD) = ?`; discoveryParams.push(gr_cod); }
                if (sg_cod) { discoverySql += ` AND TRIM(P.SG_COD) = ?`; discoveryParams.push(sg_cod); }
                if (location) { discoverySql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; discoveryParams.push(location); }

                db.query(discoverySql, discoveryParams, (errD, discoveryRows) => {
                    if (errD) { db.detach(); return res.status(500).json({ error: errD.message }); }

                    const targetSimilars = new Set();
                    const targetSingles = new Set();
                    const seenKeys = new Set();
                    let blocksFound = 0;

                    for (const row of discoveryRows) {
                        if (blocksFound >= limit) break;
                        const key = row.PRO_COD_SIMILAR ? safeString(row.PRO_COD_SIMILAR) : safeString(row.PRO_COD);
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            if (row.PRO_COD_SIMILAR) targetSimilars.add(safeString(row.PRO_COD_SIMILAR));
                            else targetSingles.add(safeString(row.PRO_COD));
                            blocksFound++;
                        }
                    }

                    if (seenKeys.size === 0) { db.detach(); return res.json([]); }

                    // ETAPA 2: ENRIQUECIMENTO (Buscar todos os itens dos blocos identificados)
                    let fetchSql = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA 
                                    FROM PRODUTOS P LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) 
                                    WHERE P.PRO_ATIVO = 'S' AND (`;
                    
                    const fetchParams = [];
                    const criteria = [];
                    if (targetSimilars.size > 0) {
                        criteria.push(`P.PRO_COD_SIMILAR IN (${Array.from(targetSimilars).map(() => '?').join(',')})`);
                        fetchParams.push(...targetSimilars);
                    }
                    if (targetSingles.size > 0) {
                        criteria.push(`P.PRO_COD IN (${Array.from(targetSingles).map(() => '?').join(',')})`);
                        fetchParams.push(...targetSingles);
                    }
                    fetchSql += criteria.join(' OR ') + `) ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                    db.query(fetchSql, fetchParams, (errP, products) => {
                        db.detach();
                        if (errP) return res.status(500).json({ error: errP.message });

                        const groups = new Map();
                        products.forEach(p => {
                            const key = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                            if (!groups.has(key)) groups.set(key, []);
                            groups.get(key).push({
                                id: safeString(p.PRO_COD),
                                name: safeString(p.PRO_DESCRI),
                                ref: safeString(p.PRO_NRFABRICANTE),
                                brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                                balance: parseFloat(p.PRO_EST_ATUAL || 0),
                                location: safeString(p.PRO_PRATELEIRA) || 'GERAL',
                                isCounted: countedSet.has(p.PRO_COD)
                            });
                        });

                        const blocks = Array.from(groups.entries()).map(([key, items]) => {
                            const lockedBy = lockMap.get(key);
                            return {
                                id: key,
                                parentRef: items[0].ref || items[0].name,
                                location: items[0].location,
                                status: items.every(i => i.isCounted) ? 'completed' : (lockedBy ? 'progress' : 'pending'),
                                items: items,
                                lockedBy: lockedBy ? { userName: lockedBy } : null
                            };
                        });

                        res.json(blocks);
                    });
                });
            });
        });
    });
});

// Outras rotas permanecem iguais...
app.listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
