
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

// Configuração do Firebird
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

// --- MAPAS DE TRADUÇÃO ---
const TO_DB_STATUS = {
    'pending': 'Pendente',
    'progress': 'Em Andamento',
    'counted': 'Contado',
    'not_located': 'Não Localizado',
    'issue': 'Divergência',
    'divergence_info': 'Divergência',
    'completed': 'Concluído',
    'reserved': 'RESERVADO'
};

const FROM_DB_STATUS = {
    'Pendente': 'pending',
    'Em Andamento': 'progress',
    'Contado': 'counted',
    'Não Localizado': 'not_located',
    'Divergência': 'divergence_info',
    'Concluído': 'completed',
    'RESERVADO': 'reserved'
};

// --- HELPER DE QUERY ---
const execute = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (Buffer.isBuffer(value)) return value.toString().trim();
    return String(value).trim();
};

const blobToString = (blob) => {
    if (!blob) return null;
    if (Buffer.isBuffer(blob)) return blob.toString('utf8');
    return String(blob);
};

// --- ROTAS ---

app.post('/login', (req, res) => {
    const { usuario_id, senha } = req.body;
    // Login Simples Hardcoded para testes ou DB real
    if (usuario_id === '9999' && senha === 'admin') return res.json({ success: true, user: { id: '9999', name: 'Gestor', role: 'Gerente', isAdmin: true } });
    if (usuario_id === '8888' && senha === 'user') return res.json({ success: true, user: { id: '8888', name: 'Colaborador', role: 'Conferente', isAdmin: false } });

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: err.message });
        db.query(`SELECT USU_COD, USU_NOME, USU_ATIVO FROM USUARIOS WHERE USU_COD = ?`, [usuario_id], (err, resultUser) => {
            if (err || resultUser.length === 0) { db.detach(); return res.status(401).json({error: 'User not found'}); }
            if (safeString(resultUser[0].USU_ATIVO) !== 'S') { db.detach(); return res.status(403).json({error: 'Inactive'}); }
            
            db.query(`SELECT FIRST 1 PWD_SENHA FROM PASSWORDS WHERE USU_COD = ? ORDER BY PWD_ID DESC`, [usuario_id], (err, resultPwd) => {
                db.detach();
                if (!err && resultPwd.length > 0 && safeString(resultPwd[0].PWD_SENHA) === senha) {
                    res.json({ success: true, user: { id: usuario_id, name: safeString(resultUser[0].USU_NOME), role: 'Colaborador', isAdmin: usuario_id === '18' } });
                } else {
                    res.status(401).json({ error: 'Senha incorreta' });
                }
            });
        });
    });
});

app.get('/user-name/:id', (req, res) => {
    const { id } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query(`SELECT USU_NOME FROM USUARIOS WHERE USU_COD = ?`, [id], (err, result) => {
            db.detach();
            if (!err && result.length > 0) res.json({ name: safeString(result[0].USU_NOME) });
            else res.status(404).json({ error: 'Not found' });
        });
    });
});

// --- ROTA VITAL: ESTRUTURA E PROGRESSO ---
app.get('/categories', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        
        // 1. Pegar Grupos
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (errG, groups) => {
            if (errG) { db.detach(); return res.json([]); }
            
            // 2. Pegar Subgrupos
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (errS, subgroups) => {
                if (errS) { db.detach(); return res.json([]); }
                
                // 3. Contar TOTAL de itens ATIVOS por Subgrupo
                const sqlTotal = `
                    SELECT GR_COD, SG_COD, COUNT(*) as TOTAL 
                    FROM PRODUTOS 
                    WHERE PRO_ATIVO = 'S' 
                    GROUP BY GR_COD, SG_COD
                `;
                
                // 4. Contar itens JÁ INVENTARIADOS (Logados) por Subgrupo
                // Consideramos inventariado qualquer item que tenha registro 'Contado' ou 'Divergência'
                const sqlMapped = `
                    SELECT P.GR_COD, P.SG_COD, COUNT(DISTINCT L.PRO_COD) as MAPPED
                    FROM GRIDE_INVENTARIO_LOG L
                    JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD
                    WHERE L.STATUS IN ('Contado', 'Divergência')
                    GROUP BY P.GR_COD, P.SG_COD
                `;

                db.query(sqlTotal, [], (errT, totalRes) => {
                    if (errT) { db.detach(); return res.json([]); }
                    
                    db.query(sqlMapped, [], (errM, mappedRes) => {
                        db.detach();
                        
                        // Mapas para acesso rápido
                        const totalMap = new Map();
                        totalRes.forEach(r => totalMap.set(`${r.GR_COD}-${r.SG_COD}`, r.TOTAL));
                        
                        const mappedMap = new Map();
                        if(mappedRes) mappedRes.forEach(r => mappedMap.set(`${r.GR_COD}-${r.SG_COD}`, r.MAPPED));

                        // Montar Árvore
                        const tree = groups.map(g => {
                            const grId = String(g.GR_COD).trim();
                            
                            // Filtrar e Mapear Subgrupos deste Grupo
                            const subs = subgroups
                                .filter(s => String(s.GR_COD).trim() === grId)
                                .map(s => {
                                    const sgId = String(s.SG_COD).trim();
                                    const key = `${grId}-${sgId}`;
                                    const total = totalMap.get(key) || 0;
                                    const mapped = mappedMap.get(key) || 0;
                                    
                                    return { 
                                        id: sgId, 
                                        db_id: s.SG_COD, 
                                        name: safeString(s.SG_DESCRI), 
                                        count: total,       // Total existente
                                        mappedCount: mapped // Total contado
                                    };
                                });

                            // Somar totais do grupo
                            const groupTotal = subs.reduce((acc, s) => acc + s.count, 0);
                            const groupMapped = subs.reduce((acc, s) => acc + s.mappedCount, 0);

                            return { 
                                id: grId, 
                                db_id: g.GR_COD, 
                                label: safeString(g.GR_DESCRI), 
                                count: groupTotal,
                                mappedCount: groupMapped,
                                subcategories: subs 
                            };
                        });
                        
                        res.json(tree);
                    });
                });
            });
        });
    });
});

// --- STATUS GLOBAL ---
app.get('/meta-status', (req, res) => {
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalStock: 0, mappedStock: 0 });
        try {
            // Total Estoque Ativo
            const resTotal = await execute(db, "SELECT COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S'");
            const totalStock = resTotal[0].TOTAL;

            // Total Único Contado
            const resMapped = await execute(db, "SELECT COUNT(DISTINCT PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência')");
            const mappedStock = resMapped[0].MAPPED;

            db.detach();
            res.json({ totalStock, mappedStock });
        } catch (e) {
            db.detach();
            res.json({ totalStock: 0, mappedStock: 0 });
        }
    });
});

app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Conexão' });
        
        // Reservas Ativas
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), r.USER_NAME));

            // Itens já contados (para marcar visualmente, mas ainda retornamos na lista para conferência se filtrar especificamente)
            db.query("SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência')", [], (errL, logs) => {
                const countedSet = new Set();
                if(logs) logs.forEach(l => countedSet.add(l.PRO_COD));

                let sql = `
                    SELECT FIRST ? 
                    P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, 
                    M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA 
                    FROM PRODUTOS P 
                    LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) 
                    WHERE P.PRO_ATIVO = 'S'
                `;
                
                const params = [limit * 10]; // Busca mais para agrupar depois

                if (search) { 
                    sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; 
                    params.push(search); params.push(search); 
                }
                if (gr_cod) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                if (sg_cod) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                if (location) { sql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; params.push(location); }

                // ORDENAÇÃO INTELIGENTE: Não contados primeiro
                // Firebird antigo não suporta IIF no ORDER BY facilmente, então fazemos no JS se necessário
                // Mas podemos ordenar por Localização para agrupar fisicamente
                sql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                db.query(sql, params, (errP, products) => {
                    db.detach();
                    if (errP) return res.status(500).json({ error: errP.message });

                    // Agrupamento por Similaridade ou ID
                    const groups = new Map();
                    products.forEach(p => {
                        const key = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const isCounted = countedSet.has(p.PRO_COD);
                        
                        if (!groups.has(key)) groups.set(key, []);
                        groups.get(key).push({
                            id: safeString(p.PRO_COD),
                            name: safeString(p.PRO_DESCRI),
                            ref: safeString(p.PRO_NRFABRICANTE),
                            brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                            balance: parseFloat(p.PRO_EST_ATUAL || 0),
                            location: safeString(p.PRO_PRATELEIRA) || 'GERAL',
                            isCounted: isCounted
                        });
                    });

                    const blocks = [];
                    groups.forEach((items, key) => {
                        const lockedBy = lockMap.get(key);
                        // Status do bloco: 'completed' se todos itens contados, 'pending' se nenhum, 'progress' se reservado
                        const allCounted = items.every(i => i.isCounted);
                        let status = allCounted ? 'completed' : 'pending';
                        if (lockedBy) status = 'progress';

                        // SE FILTRO DE BUSCA NÃO ESTIVER ATIVO, PRIORIZAR PENDENTES
                        // Se usuário buscou algo específico, mostra mesmo se concluído.
                        // Se está navegando (sem search), mostra preferencialmente pendentes.
                        if (!search && allCounted && !location) {
                            // Opcional: pular blocos concluídos na navegação geral para focar no que falta
                            // Mas o usuário pediu "saber o que foi contado e o que não", então vamos mandar com status 'completed'
                        }

                        blocks.push({
                            id: key,
                            parentRef: items[0].ref || items[0].name,
                            location: items[0].location,
                            status: status,
                            items: items,
                            lockedBy: lockedBy ? { userName: lockedBy } : null
                        });
                    });

                    // Ordenar no JS: Pendentes primeiro
                    blocks.sort((a, b) => {
                        if (a.status === 'pending' && b.status !== 'pending') return -1;
                        if (a.status !== 'pending' && b.status === 'pending') return 1;
                        return 0;
                    });

                    res.json(blocks.slice(0, limit));
                });
            });
        });
    });
});

// ... (Restante das rotas de reserva, finalização, histórico mantidas iguais, apenas garantindo limpeza) ...
// ROTAS DE OPERAÇÃO (MANTIDAS LIMPAS)
app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT BLOCK_ID, ITEMS_JSON FROM GRIDE_RESERVAS WHERE TRIM(USU_COD) = ?', [userId], (err, rows) => {
            db.detach();
            if(err || !rows) return res.json([]);
            
            const blocks = rows.map(r => {
                let items = [];
                try { items = JSON.parse(blobToString(r.ITEMS_JSON)); } catch(e){}
                return {
                    id: safeString(r.BLOCK_ID),
                    parentRef: items[0]?.ref || 'Reserva',
                    location: items[0]?.location || 'Geral',
                    status: 'progress',
                    items: items
                };
            });
            res.json(blocks);
        });
    });
});

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        // Simplificado: apenas insere reserva se não existir
        db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', 
            [block_id, user_id, user_name], (err) => {
            db.detach();
            res.json({ success: !err });
        });
    });
});

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const buffer = Buffer.from(JSON.stringify(items));
    Firebird.attach(options, (err, db) => {
        db.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [buffer, block_id], () => {
            db.detach(); res.json({success:true});
        });
    });
});

app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items, parent_ref } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'DB' });
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                const uniqueRef = `${parent_ref}||${Date.now()}`;
                
                for(const item of items) {
                    const statusDB = TO_DB_STATUS[item.status] || 'Contado';
                    const qtd = item.countedQty || 0;
                    
                    // 1. Log
                    await new Promise((resolve, reject) => {
                        transaction.query(
                            `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, BLOCK_REF, DATA_HORA, PRO_COD) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, (SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?))`,
                            [item.ref, item.name, user_id, user_name, item.balance, qtd, item.lastCount?.location || 'Geral', statusDB, uniqueRef, item.ref],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    // 2. Atualizar Localização e Estoque se contado
                    if (statusDB === 'Contado') {
                        await new Promise((resolve) => {
                            transaction.query(
                                `UPDATE PRODUTOS SET PRO_EST_ATUAL = ?, PRO_PRATELEIRA = ? WHERE PRO_NRFABRICANTE = ?`,
                                [qtd, item.lastCount?.location || 'Geral', item.ref],
                                () => resolve()
                            );
                        });
                    }
                }

                // 3. Remove Reserva
                await new Promise((resolve) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => resolve()));

                transaction.commit((err) => {
                    db.detach();
                    if(err) res.json({success: false});
                    else res.json({success: true});
                });
            } catch(e) {
                transaction.rollback();
                db.detach();
                res.json({success: false, error: e.message});
            }
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => {
            db.detach(); res.json({success:true});
        });
    });
});

app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        db.query('SELECT FIRST 100 * FROM GRIDE_INVENTARIO_LOG ORDER BY DATA_HORA DESC', [], (err, rows) => {
            db.detach();
            res.json(rows || []);
        });
    });
});

// Iniciando
app.listen(port, '0.0.0.0', () => {
    console.log(`GRIDE Server (Full Stock Mode) running on ${port}`);
});
