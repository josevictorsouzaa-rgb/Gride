
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

// --- MAPAS DE TRADUÇÃO DE STATUS (FRONTEND <-> BANCO) ---
const TO_DB_STATUS = {
    'pending': 'Pendente',
    'progress': 'Em Andamento',
    'counted': 'Contado',
    'not_located': 'Não Localizado',
    'issue': 'Divergência',
    'divergence_info': 'Divergência',
    'completed': 'Concluído',
    'reserved': 'RESERVADO',
    'released': 'DEVOLVIDO',
    'edited': 'EDIÇÃO'
};

const FROM_DB_STATUS = {
    'Pendente': 'pending',
    'Em Andamento': 'progress',
    'Contado': 'counted',
    'Não Localizado': 'not_located',
    'Divergência': 'divergence_info',
    'Concluído': 'completed',
    'RESERVADO': 'reserved',
    'DEVOLVIDO': 'released',
    'EDIÇÃO': 'edited'
};

// --- HELPER DE QUERY PROMISIFIED ---
const execute = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

// --- HELPER PARA IGNORAR ERROS DE "JÁ EXISTE" ---
const safeExecute = async (db, sql, description) => {
    try {
        console.log(`Executing: ${description}`);
        await execute(db, sql);
        console.log(`   [OK] ${description}`);
    } catch (e) {
        const msg = e.message.toLowerCase();
        if (msg.includes('exists') || msg.includes('unsuccessful metadata update') || msg.includes('already')) {
            // console.log(`   [SKIP] ${description} (Já existe)`);
        } else {
            console.error(`   [ERRO] ${description}:`, e.message);
        }
    }
};

const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && Buffer.isBuffer(value)) return value.toString().trim();
    return String(value).trim();
};

const blobToString = (blob) => {
    if (blob === null || blob === undefined) return null;
    if (Buffer.isBuffer(blob)) return blob.toString('utf8');
    if (typeof blob === 'string') return blob;
    return String(blob);
};

// --- INIT DB ---
const initDb = () => {
    return new Promise((resolve, reject) => {
        console.log(">>> [INIT] Conectando ao Firebird...");
        Firebird.attach(options, async (err, db) => {
            if (err) {
                console.error(">>> [FATAL] Não foi possível conectar ao DB:", err.message);
                return resolve(); 
            }
            try {
                // Tabelas Existentes
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tabela Endereços");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tabela Galpões");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Reservas");
                await safeExecute(db, `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, "Coluna ITEMS_JSON em Reservas");
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR(255), BLOCK_REF VARCHAR(50), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Logs");
                await safeExecute(db, `CREATE TABLE GRIDE_CONTAS_FINALIZADAS (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), PRO_COD INTEGER, QTD_FINAL DECIMAL(15,4), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP, USUARIO_NOME VARCHAR(100), STATUS VARCHAR(20), LOG_ORIGEM_ID INTEGER)`, "Tabela Contas Finalizadas");
                await safeExecute(db, `CREATE TABLE GRIDE_TRATAMENTO (ID INTEGER NOT NULL PRIMARY KEY, LOG_ID INTEGER, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), LOCALIZACAO VARCHAR(100), TIPO_ERRO VARCHAR(50), DESCRICAO_ERRO VARCHAR(255), REPORTADO_POR VARCHAR(100), REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP, STATUS VARCHAR(20) DEFAULT 'PENDING', RESOLVIDO_POR VARCHAR(20), RESOLVIDO_EM TIMESTAMP, RESOLUCAO_NOTA VARCHAR(255))`, "Tabela Tratamento");

                // Generators
                const gens = ['GEN_GRIDE_ENDERECOS_ID', 'GEN_GRIDE_GALPOES_ID', 'GEN_GRIDE_LOG_ID', 'GEN_GRIDE_TRATAMENTO_ID', 'GEN_GRIDE_CONTAS_FIN_ID'];
                for (const g of gens) await safeExecute(db, `CREATE GENERATOR ${g}`, `Generator ${g}`);

                // Triggers
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`, "Trigger Endereços");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`, "Trigger Galpões");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`, "Trigger Logs");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_TRATAMENTO FOR GRIDE_TRATAMENTO ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_TRATAMENTO_ID, 1); END`, "Trigger Tratamento");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_CONTAS_FIN FOR GRIDE_CONTAS_FINALIZADAS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_CONTAS_FIN_ID, 1); END`, "Trigger Contas Finalizadas");

                console.log(">>> [INIT] Banco de dados padronizado.");
            } catch (e) { console.error(">>> [INIT ERROR]", e); } 
            finally { db.detach(); resolve(); }
        });
    });
};

// --- ROTAS ---

app.get('/user-name/:id', (req, res) => {
    const { id } = req.params;
    if (id === '9999') return res.json({ name: 'Gestor de Teste' });
    if (id === '8888') return res.json({ name: 'Colaborador Teste' });
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query(`SELECT USU_NOME FROM USUARIOS WHERE USU_COD = ? AND USU_ATIVO = 'S'`, [id], (err, result) => {
            db.detach();
            if (!err && result.length > 0) res.json({ name: safeString(result[0].USU_NOME) });
            else res.status(404).json({ error: 'Usuário não encontrado' });
        });
    });
});

app.post('/login', (req, res) => {
    const { usuario_id, senha } = req.body;
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

app.get('/users', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT USU_COD, USU_NOME FROM USUARIOS WHERE USU_ATIVO = 'S' ORDER BY USU_NOME`, [], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(u => ({ id: u.USU_COD.toString(), name: safeString(u.USU_NOME), role: 'Colaborador', avatar: '', canTreat: false })));
        });
    });
});

app.get('/categories', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        
        // 1. Grupos e Subgrupos
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (errGroups, groups) => {
            if (errGroups) { db.detach(); return res.json([]); }
            
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (errSub, subgroups) => {
                if (errSub) { db.detach(); return res.json([]); }
                
                // 2. Total de Itens Ativos por Grupo/Subgrupo
                const sqlTotal = `
                    SELECT GR_COD, SG_COD, COUNT(*) as TOTAL 
                    FROM PRODUTOS 
                    WHERE PRO_ATIVO = 'S' 
                    GROUP BY GR_COD, SG_COD
                `;
                
                // 3. Total de Itens Já Mapeados (Com log de contagem ou divergencia)
                const sqlMapped = `
                    SELECT P.GR_COD, P.SG_COD, COUNT(DISTINCT L.PRO_COD) as MAPPED
                    FROM GRIDE_INVENTARIO_LOG L
                    JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD
                    WHERE (L.STATUS = 'Contado' OR L.STATUS = 'Divergência')
                    GROUP BY P.GR_COD, P.SG_COD
                `;

                db.query(sqlTotal, [], (errTotal, totalResult) => {
                    if (errTotal) { db.detach(); return res.json([]); }
                    
                    db.query(sqlMapped, [], (errMapped, mappedResult) => {
                        db.detach();
                        
                        const totalMap = new Map(); // "GR-SG" -> count
                        const mappedMap = new Map(); // "GR-SG" -> count
                        
                        totalResult.forEach(r => totalMap.set(`${String(r.GR_COD).trim()}-${String(r.SG_COD).trim()}`, r.TOTAL));
                        if (!errMapped && mappedResult) {
                            mappedResult.forEach(r => mappedMap.set(`${String(r.GR_COD).trim()}-${String(r.SG_COD).trim()}`, r.MAPPED));
                        }

                        const groupStats = new Map(); // GR_COD -> { total: 0, mapped: 0 }

                        const tree = groups.map(g => {
                            const groupId = String(g.GR_COD).trim();
                            
                            const subs = subgroups.filter(s => String(s.GR_COD).trim() === groupId).map(s => {
                                const subId = String(s.SG_COD).trim();
                                const key = `${groupId}-${subId}`;
                                const total = totalMap.get(key) || 0;
                                const mapped = mappedMap.get(key) || 0;
                                
                                return { 
                                    id: subId, 
                                    db_id: s.SG_COD, 
                                    name: safeString(s.SG_DESCRI), 
                                    count: total, // Total items
                                    mappedCount: mapped, // Counted items
                                    icon: 'circle' 
                                };
                            });

                            const gTotal = subs.reduce((acc, s) => acc + s.count, 0);
                            const gMapped = subs.reduce((acc, s) => acc + s.mappedCount, 0);

                            return { 
                                id: groupId, 
                                db_id: g.GR_COD, 
                                label: safeString(g.GR_DESCRI), 
                                icon: 'inventory_2', 
                                count: gTotal, 
                                mappedCount: gMapped,
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

app.get('/daily-stats/:userId', (req, res) => {
    const { userId } = req.params;
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ countedToday: 0 });
        try {
            const sql = `SELECT COUNT(*) as TOTAL FROM GRIDE_INVENTARIO_LOG WHERE USU_COD = ? AND CAST(DATA_HORA as DATE) = CURRENT_DATE AND (STATUS = 'Contado' OR STATUS = 'Divergência')`;
            const result = await execute(db, sql, [userId]);
            db.detach();
            res.json({ countedToday: result[0].TOTAL });
        } catch (e) {
            db.detach();
            res.json({ countedToday: 0 });
        }
    });
});

// NOVA ROTA: STATUS GLOBAL DE COBERTURA
app.get('/meta-status', (req, res) => {
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalStock: 0, mappedStock: 0 });
        try {
            // 1. Total Produtos Ativos
            const sqlTotal = `SELECT COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S'`;
            const resTotal = await execute(db, sqlTotal);
            const totalStock = resTotal[0].TOTAL;

            // 2. Total Itens Mapeados (Logados com sucesso)
            // Considera itens que já passaram pelo inventário (Contado ou Divergência)
            const sqlMapped = `SELECT COUNT(DISTINCT PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência')`;
            const resMapped = await execute(db, sqlMapped);
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod && !isNaN(parseInt(req.query.gr_cod)) ? parseInt(req.query.gr_cod) : null;
    const sg_cod = req.query.sg_cod && !isNaN(parseInt(req.query.sg_cod)) ? parseInt(req.query.sg_cod) : null;
    const location = req.query.location || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro Conexão' });
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errRes, reservations) => {
            const lockMap = new Map();
            if (!errRes && reservations) {
                reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { userId: safeString(r.USU_COD), userName: safeString(r.USER_NAME), timestamp: r.RESERVED_AT }));
            }
            db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errTreat, treatments) => {
                const treatmentSet = new Set();
                if (!errTreat && treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE)));
                let sql = `SELECT FIRST ? SKIP ? P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA FROM PRODUTOS P LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) WHERE P.PRO_ATIVO = 'S'`;
                const params = [limit * 20, skip]; 
                if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
                if (gr_cod !== null) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                if (sg_cod !== null) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                if (location) { sql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; params.push(location); }
                sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_COD`;
                db.query(sql, params, (errProd, products) => {
                    db.detach();
                    if (errProd) return res.status(500).json({ error: errProd.message });
                    const groups = new Map();
                    products.forEach(p => {
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const sku = safeString(p.PRO_NRFABRICANTE); 
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD), db_pro_cod: p.PRO_COD, name: safeString(p.PRO_DESCRI), ref: sku, 
                            brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'SEM MARCA', balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                            location: safeString(p.PRO_PRATELEIRA) || 'GERAL', inTreatment: treatmentSet.has(sku)
                        });
                    });
                    const blocks = [];
                    groups.forEach((items, key) => {
                        const isLocked = lockMap.get(key);
                        blocks.push({
                            id: key, parentRef: items[0].ref || items[0].name, location: items[0].location, 
                            status: isLocked ? 'progress' : 'pending', date: 'Hoje', items: items, lockedBy: isLocked,
                            addedAt: new Date().toISOString()
                        });
                    });
                    res.json(blocks.slice(0, limit));
                });
            });
        });
    });
});

app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT, ITEMS_JSON FROM GRIDE_RESERVAS WHERE TRIM(USU_COD) = ?', [userId], (err, reservations) => {
            if (err) { db.detach(); return res.json([]); }
            if (reservations.length === 0) { db.detach(); return res.json([]); }
            const blockIds = [];
            const progressMap = new Map();
            reservations.forEach(r => {
                const bId = safeString(r.BLOCK_ID).trim();
                blockIds.push(bId);
                const jsonStr = blobToString(r.ITEMS_JSON);
                if (jsonStr) {
                    try {
                        const savedItems = JSON.parse(jsonStr);
                        if (Array.isArray(savedItems)) {
                            savedItems.forEach(item => {
                                const mappedStatus = FROM_DB_STATUS[item.status] || item.status || 'pending';
                                item.status = mappedStatus;
                                progressMap.set(`${bId}-${String(item.ref).trim()}`, item);
                            });
                        }
                    } catch (e) {}
                }
            });
            const idsList = blockIds.map(id => `'${id}'`).join(',');
            db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errTreat, treatments) => {
                const treatmentSet = new Set();
                if(!errTreat && treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE).trim()));
                const sql = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S' AND (TRIM(P.PRO_COD_SIMILAR) IN (${idsList}) OR (P.PRO_COD_SIMILAR IS NULL AND TRIM(P.PRO_COD) IN (${idsList})))`;
                db.query(sql, [], (errProd, products) => {
                    db.detach();
                    if (errProd) return res.status(500).json({ error: errProd.message });
                    const groups = new Map();
                    products.forEach(p => {
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR).trim() : safeString(p.PRO_COD).trim();
                        const sku = safeString(p.PRO_NRFABRICANTE).trim();
                        const savedProgress = progressMap.get(`${similarId}-${sku}`);
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD).trim(), db_pro_cod: p.PRO_COD, name: safeString(p.PRO_DESCRI), ref: sku, 
                            brand: `MARCA ${p.MAR_COD}`, balance: parseFloat(p.PRO_EST_ATUAL || 0), location: safeString(p.PRO_PRATELEIRA) || 'GERAL', 
                            inTreatment: treatmentSet.has(sku), status: savedProgress?.status || 'pending', countedQty: savedProgress?.countedQty || 0, 
                            divergenceReason: savedProgress?.divergenceReason || '', lastCount: savedProgress?.lastCount || null
                        });
                    });
                    const blocks = [];
                    groups.forEach((items, key) => blocks.push({ id: key, parentRef: items[0].ref || items[0].name, location: items[0].location, status: 'progress', date: 'Hoje', items: items }));
                    res.json(blocks);
                });
            });
        });
    });
});

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body; 
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        // 1. Verifica se já está em tratamento
        db.query(`SELECT 1 FROM GRIDE_TRATAMENTO WHERE PRO_NRFABRICANTE IN (SELECT PRO_NRFABRICANTE FROM PRODUTOS WHERE PRO_COD = ? OR PRO_COD_SIMILAR = ?) AND STATUS = 'PENDING'`, [block_id, block_id], (errT, treatResult) => {
             if (!errT && treatResult && treatResult.length > 0) { db.detach(); return res.json({ success: false, message: 'Item em tratamento pendente.' }); }

             // 2. Verifica se já está reservado
             db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (errR, result) => {
                if (errR) { db.detach(); return res.status(500).json({ success: false, message: errR.message }); }
                if (result && result.length > 0) { db.detach(); return res.json({ success: false, message: `Bloco já reservado por ${safeString(result[0].USER_NAME)}` }); }
                
                const proCodVal = isNaN(parseInt(block_id)) ? 0 : parseInt(block_id);

                // 3. Insere a Reserva (BLOCK_ID é o padronizado)
                db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, PRO_COD, RESERVED_AT, ITEMS_JSON) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)', [block_id, user_id, user_name, proCodVal], (errIns) => {
                    if (errIns) { db.detach(); return res.status(500).json({ success: false, message: 'Erro ao reservar: ' + errIns.message }); }
                    
                    // 4. INSERE O LOG (Lastro de Movimentação)
                    const logSql = `
                        INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA)
                        SELECT FIRST 1 PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, ?, ?, 'RESERVADO', 'Origem: MANUAL', ?, CURRENT_TIMESTAMP
                        FROM PRODUTOS
                        WHERE PRO_COD = ? OR PRO_COD_SIMILAR = ?
                    `;
                    
                    db.query(logSql, [user_id, user_name, block_id, proCodVal, block_id], (errLog) => {
                        db.detach();
                        res.json({ success: true });
                    });
                });
            });
        });
    });
});

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const dbItems = items.map(item => ({ ...item, status: TO_DB_STATUS[item.status] || item.status }));
    const jsonStr = JSON.stringify(dbItems);
    const buffer = Buffer.from(jsonStr, 'utf8');
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [buffer, block_id], (err) => {
            db.detach();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => { 
            db.detach(); 
            res.json({ success: true }); 
        });
    });
});

app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items, parent_ref } = req.body; 
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }

            try {
                const batchId = Date.now().toString();
                const uniqueBlockRef = `${parent_ref || 'BLOCO'}||${batchId}`;

                for (const item of items) {
                    const rows = await new Promise((resolve, reject) => {
                        transaction.query('SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?', [item.ref], (err, res) => {
                            if (err) reject(err); else resolve(res);
                        });
                    });

                    let realProCod = 0;
                    if (rows && rows.length > 0) realProCod = rows[0].PRO_COD;
                    else if (item.db_pro_cod) realProCod = item.db_pro_cod;

                    const qtdContada = item.countedQty !== undefined ? item.countedQty : 0;
                    const statusEN = item.status || 'pending';
                    const statusPT = TO_DB_STATUS[statusEN] || statusEN;
                    const localizacao = (item.lastCount && item.lastCount.location) ? item.lastCount.location : (item.location || 'GERAL');
                    const motivo = item.divergenceReason || '';

                    // 1. INSERE LOG
                    const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING ID`;
                    
                    const resultLog = await new Promise((resolve, reject) => {
                        transaction.query(sqlLog, [realProCod, item.ref, item.name, user_id, user_name, item.balance, qtdContada, localizacao, statusPT, motivo, uniqueBlockRef], (err, res) => { if (err) reject(err); else resolve(res); });
                    });
                    
                    const logId = resultLog.ID;

                    if (statusEN === 'counted' || statusEN === 'divergence_info') {
                        const sqlFinal = `INSERT INTO GRIDE_CONTAS_FINALIZADAS (SKU, PRO_COD, QTD_FINAL, DATA_HORA, USUARIO_NOME, STATUS, LOG_ORIGEM_ID) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'FINALIZADO', ?)`;
                        await new Promise((resolve, reject) => { transaction.query(sqlFinal, [item.ref, realProCod, qtdContada, user_name, logId], (err) => { if(err) reject(err); else resolve(); }); });
                    }

                    // 2. ATUALIZA ESTOQUE
                    const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?`;
                    await new Promise((resolve) => { transaction.query(sqlUpdate, [qtdContada, realProCod], (err) => resolve()); });

                    // 3. VÍNCULO PERMANENTE DE ENDEREÇO (SOLICITADO)
                    if (localizacao && localizacao !== 'GERAL' && localizacao !== '?' && !localizacao.includes('LOC-?-?-?')) {
                        const sqlUpdateLoc = `UPDATE PRODUTOS SET PRO_PRATELEIRA = ? WHERE PRO_COD = ?`;
                        await new Promise((resolve) => { transaction.query(sqlUpdateLoc, [localizacao, realProCod], (err) => resolve()); });
                    }

                    if (statusEN === 'not_located' || statusEN === 'divergence_info' || statusEN === 'issue') {
                        const sqlTreat = `INSERT INTO GRIDE_TRATAMENTO (LOG_ID, PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`;
                        await new Promise((resolve, reject) => { transaction.query(sqlTreat, [logId, realProCod, item.ref, item.name, localizacao, statusPT, motivo || 'Erro reportado', user_name], (err) => { if (err) reject(err); else resolve(); }); });
                    }
                }

                await new Promise((resolve, reject) => { transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => { if (err) return reject(err); resolve(); }); });

                transaction.commit((err) => {
                    db.detach();
                    if (err) return res.status(500).json({ error: 'Commit Error' });
                    res.json({ success: true });
                });

            } catch (processError) {
                transaction.rollback();
                db.detach();
                return res.status(500).json({ error: 'Erro Processamento: ' + processError.message });
            }
        });
    });
});

app.post('/update-count', (req, res) => {
    const { logId, sku, newQty, oldQty, user_name, user_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro Conexão' });
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }
            try {
                const logSql = `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_NRFABRICANTE, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA) VALUES (?, ?, ?, ?, ?, 'EDIÇÃO', 'Ajuste pós-contagem', CURRENT_TIMESTAMP)`;
                await new Promise((resolve, reject) => { transaction.query(logSql, [sku, user_id, user_name, oldQty, newQty], (err) => { if(err) reject(err); else resolve(); }); });

                const updateFinalSql = `UPDATE GRIDE_CONTAS_FINALIZADAS SET QTD_FINAL = ?, STATUS = 'AJUSTE', USUARIO_NOME = ? WHERE LOG_ORIGEM_ID = ?`;
                await new Promise((resolve, reject) => { transaction.query(updateFinalSql, [newQty, user_name, logId], (err) => { if(err) reject(err); else resolve(); }); });

                const updateProdSql = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_NRFABRICANTE = ?`;
                await new Promise((resolve, reject) => { transaction.query(updateProdSql, [newQty, sku], (err) => { if(err) reject(err); else resolve(); }); });

                transaction.commit((err) => { db.detach(); if(err) return res.status(500).json({ error: 'Commit Error' }); res.json({ success: true }); });
            } catch (e) {
                transaction.rollback();
                db.detach();
                res.status(500).json({ error: e.message });
            }
        });
    });
});

app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 300; 
    const skip = (page - 1) * limit;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        const sql = `SELECT FIRST ? SKIP ? L.ID, L.BLOCK_REF, L.DATA_HORA, L.USUARIO_NOME, L.QTD_CONTADA, L.LOCALIZACAO, L.PRO_NRFABRICANTE as SKU, L.NOME_PRODUTO, L.STATUS, T.STATUS as TRATAMENTO_STATUS, P.PRO_COD_SIMILAR, P.PRO_DESCRI as PROD_DESC_ATUAL, P.MAR_COD FROM GRIDE_INVENTARIO_LOG L LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID LEFT JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD ORDER BY L.DATA_HORA DESC`;
        db.query(sql, [limit, skip], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            const mapped = result.map(r => ({ ...r, STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || 'completed' }));
            res.json(mapped);
        });
    });
});

app.get('/treatment-items', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT ID, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, REPORTADO_EM, STATUS FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING' ORDER BY REPORTADO_EM DESC`, [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({ id: r.ID, sku: safeString(r.PRO_NRFABRICANTE), name: safeString(r.NOME_PRODUTO), location: safeString(r.LOCALIZACAO), issueType: FROM_DB_STATUS[safeString(r.TIPO_ERRO)] || 'issue', description: safeString(r.DESCRICAO_ERRO), reportedBy: safeString(r.REPORTADO_POR), reportedAt: r.REPORTADO_EM, status: safeString(r.STATUS) })) : []);
        });
    });
});

app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT L.DATA_HORA, L.USUARIO_NOME, L.QTD_SISTEMA, L.QTD_CONTADA, L.STATUS, L.LOCALIZACAO FROM GRIDE_INVENTARIO_LOG L WHERE L.PRO_NRFABRICANTE = ? ORDER BY L.DATA_HORA DESC`, [sku], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({ ...r, STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || r.STATUS })));
        });
    });
});

app.get('/addresses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT * FROM GRIDE_ENDERECOS', [], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({ id: r.ID, code: safeString(r.CODIGO), description: safeString(r.DESCRICAO), type: safeString(r.TIPO) || 'shelf' })));
        });
    });
});

app.post('/save-addresses', (req, res) => {
    const addresses = req.body; 
    if(!Array.isArray(addresses)) return res.status(400).json({error: 'Invalid format'});
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        let count = 0; let skipped = 0; const total = addresses.length;
        const processNext = (idx) => {
            if(idx >= total) { db.detach(); return res.json({ success: true, count, skipped }); }
            const addr = addresses[idx];
            db.query('SELECT ID FROM GRIDE_ENDERECOS WHERE CODIGO = ?', [addr.code], (err, resExist) => {
                if(!err && resExist.length === 0) {
                    db.query('INSERT INTO GRIDE_ENDERECOS (CODIGO, DESCRICAO, TIPO) VALUES (?, ?, ?)', [addr.code, addr.description, addr.type], (err) => {
                        if(!err) count++; else skipped++;
                        processNext(idx + 1);
                    });
                } else { skipped++; processNext(idx + 1); }
            });
        };
        processNext(0);
    });
});

app.get('/warehouses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT * FROM GRIDE_GALPOES', [], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({ id: r.ID, sigla: safeString(r.SIGLA), descricao: safeString(r.DESCRICAO) })));
        });
    });
});

app.post('/save-warehouse', (req, res) => {
    const { sigla, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('INSERT INTO GRIDE_GALPOES (SIGLA, DESCRICAO) VALUES (?, ?)', [sigla, descricao], (err) => {
            db.detach();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/delete-warehouse', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('DELETE FROM GRIDE_GALPOES WHERE ID = ?', [id], (err) => { db.detach(); res.json({ success: true }); });
    });
});

const startServer = async () => {
    try {
        await initDb();
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor GRIDE Firebird rodando em http://localhost:${port}`);
        });
    } catch (e) {
        console.error("Falha fatal na inicialização:", e);
    }
};

startServer();
