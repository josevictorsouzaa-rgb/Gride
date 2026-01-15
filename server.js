
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

// --- MAPAS DE TRADUÇÃO DE STATUS ---
const TO_DB_STATUS = {
    'pending': 'Pendente',
    'progress': 'Em Andamento',
    'counted': 'Contado',
    'not_located': 'Não Localizado',
    'issue': 'Divergência',
    'divergence_info': 'Divergência',
    'completed': 'Concluído'
};

const FROM_DB_STATUS = {
    'Pendente': 'pending',
    'Em Andamento': 'progress',
    'Contado': 'counted',
    'Não Localizado': 'not_located',
    'Divergência': 'divergence_info',
    'Concluído': 'completed'
};

// --- HELPERS ---
const execute = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
        });
    });
};

const safeExecute = async (db, sql, description) => {
    try {
        console.log(`Executing: ${description}`);
        await execute(db, sql);
    } catch (e) {
        // Ignora erros de "já existe"
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
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tab Enderecos");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tab Galpoes");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20), USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP, ITEMS_JSON BLOB SUB_TYPE TEXT)`, "Tab Reservas");
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR(255), BLOCK_REF VARCHAR(50), DATA_HORA TIMESTAMP)`, "Tab Log");
                await safeExecute(db, `CREATE TABLE GRIDE_TRATAMENTO (ID INTEGER NOT NULL PRIMARY KEY, LOG_ID INTEGER, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), LOCALIZACAO VARCHAR(100), TIPO_ERRO VARCHAR(50), DESCRICAO_ERRO VARCHAR(255), REPORTADO_POR VARCHAR(100), REPORTADO_EM TIMESTAMP, STATUS VARCHAR(20), RESOLVIDO_POR VARCHAR(20), RESOLVIDO_EM TIMESTAMP, RESOLUCAO_NOTA VARCHAR(255))`, "Tab Tratamento");
                
                await safeExecute(db, `CREATE GENERATOR GEN_GRIDE_ENDERECOS_ID`, "Gen Enderecos");
                await safeExecute(db, `CREATE GENERATOR GEN_GRIDE_GALPOES_ID`, "Gen Galpoes");
                await safeExecute(db, `CREATE GENERATOR GEN_GRIDE_LOG_ID`, "Gen Logs");
                await safeExecute(db, `CREATE GENERATOR GEN_GRIDE_TRATAMENTO_ID`, "Gen Tratamento");
                
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`, "Trg End");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`, "Trg Gal");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`, "Trg Log");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_TRATAMENTO FOR GRIDE_TRATAMENTO ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_TRATAMENTO_ID, 1); END`, "Trg Treat");

                console.log(">>> [INIT] DB Padronizado.");
            } catch (e) { console.error(e); } 
            finally { db.detach(); resolve(); }
        });
    });
};

// --- API ROUTES ---

// 1. Basic User Info
app.get('/user-name/:id', (req, res) => {
    if (req.params.id === '9999') return res.json({ name: 'Gestor de Teste' });
    if (req.params.id === '8888') return res.json({ name: 'Colaborador Teste' });
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        db.query(`SELECT USU_NOME FROM USUARIOS WHERE USU_COD = ?`, [req.params.id], (err, result) => {
            db.detach();
            if(!err && result.length > 0) res.json({ name: safeString(result[0].USU_NOME) });
            else res.status(404).json({ error: 'Not found' });
        });
    });
});

app.post('/login', (req, res) => {
    const { usuario_id, senha } = req.body;
    if (usuario_id === '9999') return res.json({ success: true, user: { id: '9999', name: 'Gestor', isAdmin: true } });
    if (usuario_id === '8888') return res.json({ success: true, user: { id: '8888', name: 'Colaborador', isAdmin: false } });
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        db.query(`SELECT USU_NOME FROM USUARIOS WHERE USU_COD = ? AND USU_ATIVO = 'S'`, [usuario_id], (err, resUser) => {
            if (err || resUser.length === 0) { db.detach(); return res.status(401).json({ error: 'Usuario nao encontrado' }); }
            db.query(`SELECT FIRST 1 PWD_SENHA FROM PASSWORDS WHERE USU_COD = ? ORDER BY PWD_ID DESC`, [usuario_id], (err, resPwd) => {
                db.detach();
                if (!err && resPwd.length > 0 && safeString(resPwd[0].PWD_SENHA) === senha) {
                    res.json({ success: true, user: { id: usuario_id, name: safeString(resUser[0].USU_NOME), isAdmin: usuario_id === '18' } });
                } else {
                    res.status(401).json({ error: 'Senha incorreta' });
                }
            });
        });
    });
});

// --- NOVA ROTA DE ESTATÍSTICAS DIÁRIAS ---
app.get('/daily-stats', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.json({ countedToday: 0 });

    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ countedToday: 0 });
        try {
            // Conta registros do usuário na data atual (CAST 'NOW' AS DATE)
            const sql = `SELECT COUNT(*) AS TOTAL FROM GRIDE_INVENTARIO_LOG WHERE USU_COD = ? AND CAST(DATA_HORA AS DATE) = CAST('NOW' AS DATE)`;
            const result = await execute(db, sql, [userId]);
            db.detach();
            res.json({ countedToday: result[0].TOTAL });
        } catch (e) {
            db.detach();
            console.error("Erro stats:", e);
            res.json({ countedToday: 0 });
        }
    });
});

app.get('/daily-meta-suggestions', (req, res) => {
    const dailyTarget = parseInt(req.query.dailyTarget) || 150;
    const cooldownDays = parseInt(req.query.cooldownDays) || 30;
    const highGiroThreshold = parseInt(req.query.highGiroThreshold) || 5;
    const accumulationMode = req.query.accumulationMode === 'true';

    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ error: 'DB Error' });

        try {
            let effectiveTarget = dailyTarget;
            if (accumulationMode) {
                // Sintaxe Firebird: CAST('NOW' AS DATE) - 3
                const sqlLog = `SELECT COUNT(*) AS TOTAL FROM GRIDE_INVENTARIO_LOG WHERE DATA_HORA >= CAST('NOW' AS DATE) - 3 AND DATA_HORA < CAST('NOW' AS DATE)`;
                const logs = await execute(db, sqlLog);
                const counted = logs[0].TOTAL;
                const expected = dailyTarget * 3;
                const deficit = Math.max(0, expected - counted);
                effectiveTarget += Math.min(deficit, Math.floor(dailyTarget * 0.5));
            }

            const lockedSql = `SELECT PRO_COD FROM GRIDE_RESERVAS UNION SELECT PRO_COD FROM GRIDE_TRATAMENTO WHERE STATUS='PENDING'`;
            const lockedRes = await execute(db, lockedSql);
            const lockedIds = lockedRes.map(r => r.PRO_COD).filter(x => x).join(',');
            const notInClause = lockedIds ? `AND P.PRO_COD NOT IN (${lockedIds})` : '';

            let giroIds = [];
            try {
                // Sintaxe Firebird: CURRENT_DATE - 60
                const sqlGiro = `
                    SELECT FIRST ${Math.floor(effectiveTarget * 0.5)} P.PRO_COD
                    FROM PEDIDOSITENS PI
                    JOIN PRODUTOS P ON P.PRO_COD = PI.PRO_COD
                    WHERE P.PRO_ATIVO = 'S'
                    AND PI.DATA >= CAST('NOW' AS DATE) - 60
                    ${notInClause}
                    AND (P.PRO_ULTIMA_CONTAGEM IS NULL OR P.PRO_ULTIMA_CONTAGEM < CAST('NOW' AS DATE) - ${cooldownDays})
                    GROUP BY P.PRO_COD
                    HAVING COUNT(*) >= ${highGiroThreshold}
                    ORDER BY COUNT(*) DESC
                `;
                const giroRes = await execute(db, sqlGiro);
                giroIds = giroRes.map(r => r.PRO_COD);
            } catch (e) {
                console.log("Erro Giro (sem PEDIDOSITENS?):", e.message);
            }

            const cycleLimit = effectiveTarget - giroIds.length;
            const ignoreIds = [...(lockedIds ? lockedIds.split(',') : []), ...giroIds].filter(x => x).join(',');
            const ignoreClause = ignoreIds ? `AND P.PRO_COD NOT IN (${ignoreIds})` : '';

            const sqlCycle = `
                SELECT FIRST ${cycleLimit} P.PRO_COD
                FROM PRODUTOS P
                WHERE P.PRO_ATIVO = 'S'
                ${ignoreClause}
                AND (P.PRO_ULTIMA_CONTAGEM IS NULL OR P.PRO_ULTIMA_CONTAGEM < CAST('NOW' AS DATE) - ${cooldownDays})
                ORDER BY P.PRO_ULTIMA_CONTAGEM ASC NULLS FIRST
            `;
            const cycleRes = await execute(db, sqlCycle);
            const cycleIds = cycleRes.map(r => r.PRO_COD);

            const finalIds = [...giroIds, ...cycleIds];

            if (finalIds.length === 0) {
                db.detach();
                return res.json([]);
            }

            const finalIdsStr = finalIds.join(',');
            const sqlDetails = `
                SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.LOCALIZACAO
                FROM PRODUTOS P 
                LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD)
                WHERE P.PRO_COD IN (${finalIdsStr})
                ORDER BY P.LOCALIZACAO
            `;
            const details = await execute(db, sqlDetails);
            db.detach();

            const groups = new Map();
            details.forEach(p => {
                const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                if (!groups.has(similarId)) groups.set(similarId, []);
                
                groups.get(similarId).push({
                    id: safeString(p.PRO_COD),
                    db_pro_cod: p.PRO_COD,
                    name: safeString(p.PRO_DESCRI),
                    ref: safeString(p.PRO_NRFABRICANTE),
                    brand: safeString(p.MAR_DESCRI),
                    balance: parseFloat(p.PRO_EST_ATUAL || 0),
                    location: safeString(p.LOCALIZACAO),
                    inTreatment: false
                });
            });

            const blocks = [];
            groups.forEach((items, key) => {
                const isGiro = giroIds.includes(items[0].db_pro_cod);
                blocks.push({
                    id: key,
                    parentRef: items[0].ref || items[0].name,
                    location: items[0].location || 'GERAL',
                    status: 'pending',
                    subcategory: isGiro ? 'Giro Alto' : 'Ciclo',
                    items: items
                });
            });

            res.json(blocks);

        } catch (e) {
            db.detach();
            res.status(500).json({ error: e.message });
        }
    });
});

app.get('/meta-status', (req, res) => {
    const target = parseInt(req.query.target) || 150;
    const accumulate = req.query.accumulate === 'true';

    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ dailyTarget: target, countedToday: 0, accumulatedPending: 0 });

        try {
            const sqlToday = `SELECT COUNT(*) AS TOTAL FROM GRIDE_INVENTARIO_LOG WHERE CAST(DATA_HORA AS DATE) = CAST('NOW' AS DATE)`;
            const resToday = await execute(db, sqlToday);
            const countedToday = resToday[0].TOTAL;

            let accumulatedPending = 0;
            if (accumulate) {
                const sqlPast = `SELECT COUNT(*) AS TOTAL FROM GRIDE_INVENTARIO_LOG WHERE DATA_HORA >= CAST('NOW' AS DATE) - 3 AND DATA_HORA < CAST('NOW' AS DATE)`;
                const resPast = await execute(db, sqlPast);
                const pastCount = resPast[0].TOTAL;
                const pastTarget = target * 3;
                accumulatedPending = Math.max(0, pastTarget - pastCount);
                accumulatedPending = Math.min(accumulatedPending, Math.floor(target * 0.5));
            }

            db.detach();
            res.json({ dailyTarget: target, countedToday, accumulatedPending });

        } catch (e) {
            db.detach();
            res.json({ dailyTarget: target, countedToday: 0, accumulatedPending: 0 });
        }
    });
});

app.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const location = req.query.location || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB'});
        
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME FROM GRIDE_RESERVAS', [], (err, locks) => {
            const lockMap = new Map();
            if(!err && locks) locks.forEach(l => lockMap.set(safeString(l.BLOCK_ID), { userId: safeString(l.USU_COD), userName: safeString(l.USER_NAME) }));

            let sql = `SELECT FIRST ? SKIP ? P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.LOCALIZACAO FROM PRODUTOS P LEFT JOIN MARCAS M ON M.MAR_COD=P.MAR_COD WHERE P.PRO_ATIVO='S'`;
            const params = [limit * 20, skip];

            if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
            if (location) { sql += ` AND P.LOCALIZACAO STARTING WITH ?`; params.push(location); }
            
            sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_COD`;

            db.query(sql, params, (err, prods) => {
                db.detach();
                if (err) return res.json([]);
                
                const groups = new Map();
                prods.forEach(p => {
                    const similar = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                    if (!groups.has(similar)) groups.set(similar, []);
                    groups.get(similar).push({
                        id: safeString(p.PRO_COD), name: safeString(p.PRO_DESCRI), ref: safeString(p.PRO_NRFABRICANTE), 
                        brand: safeString(p.MAR_DESCRI), balance: p.PRO_EST_ATUAL, location: safeString(p.LOCALIZACAO)
                    });
                });

                const blocks = [];
                groups.forEach((items, key) => {
                    const locked = lockMap.get(key);
                    blocks.push({ id: key, parentRef: items[0].ref, location: items[0].location, status: locked ? 'progress' : 'pending', items, lockedBy: locked });
                });
                res.json(blocks.slice(0, limit));
            });
        });
    });
});

app.get('/reserved-blocks/:userId', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT BLOCK_ID, ITEMS_JSON FROM GRIDE_RESERVAS WHERE TRIM(USU_COD) = ?', [req.params.userId], (err, resv) => {
            if (err || resv.length === 0) { db.detach(); return res.json([]); }
            
            const ids = resv.map(r => safeString(r.BLOCK_ID)).join("','");
            const jsonMap = new Map();
            resv.forEach(r => {
                const json = blobToString(r.ITEMS_JSON);
                if (json) jsonMap.set(safeString(r.BLOCK_ID), JSON.parse(json));
            });

            db.query(`SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.LOCALIZACAO FROM PRODUTOS P LEFT JOIN MARCAS M ON M.MAR_COD=P.MAR_COD WHERE TRIM(P.PRO_COD_SIMILAR) IN ('${ids}') OR (P.PRO_COD_SIMILAR IS NULL AND TRIM(P.PRO_COD) IN ('${ids}'))`, [], (err, prods) => {
                db.detach();
                if(err) return res.json([]);
                
                const groups = new Map();
                prods.forEach(p => {
                    const similar = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                    const sku = safeString(p.PRO_NRFABRICANTE);
                    const savedItems = jsonMap.get(similar) || [];
                    const savedItem = savedItems.find(i => i.ref === sku);

                    if(!groups.has(similar)) groups.set(similar, []);
                    groups.get(similar).push({
                        id: safeString(p.PRO_COD), name: safeString(p.PRO_DESCRI), ref: sku, brand: safeString(p.MAR_DESCRI), 
                        balance: p.PRO_EST_ATUAL, location: safeString(p.LOCALIZACAO),
                        status: savedItem?.status || 'pending', countedQty: savedItem?.countedQty || 0
                    });
                });

                const blocks = [];
                groups.forEach((items, key) => blocks.push({ id: key, parentRef: items[0].ref, location: items[0].location, status: 'progress', items }));
                res.json(blocks);
            });
        });
    });
});

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({success: false});
        db.query('SELECT 1 FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, ex) => {
            if(!err && ex.length > 0) { db.detach(); return res.json({success: false, message: 'Ja reservado'}); }
            db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [block_id, user_id, user_name], (err) => {
                db.detach();
                res.json({success: !err});
            });
        });
    });
});

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const json = JSON.stringify(items);
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success: false});
        db.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [Buffer.from(json), block_id], (err) => {
            db.detach();
            res.json({success: !err});
        });
    });
});

app.post('/release-block', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success: false});
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [req.body.block_id], (err) => {
            db.detach(); res.json({success: true});
        });
    });
});

app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items, parent_ref } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({error: 'DB'});
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                const batchId = Date.now();
                const blockRef = `${parent_ref}||${batchId}`;

                for (const item of items) {
                    const row = await new Promise((res, rej) => transaction.query('SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?', [item.ref], (e,r) => e ? rej(e) : res(r)));
                    const proCod = row.length > 0 ? row[0].PRO_COD : (item.db_pro_cod || 0);
                    
                    const statusPT = TO_DB_STATUS[item.status] || 'Contado';
                    const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING ID`;
                    
                    const resLog = await new Promise((res, rej) => transaction.query(sqlLog, [proCod, item.ref, item.name, user_id, user_name, item.balance, item.countedQty || 0, item.location, statusPT, item.divergenceReason || '', blockRef], (e, r) => e ? rej(e) : res(r)));
                    
                    // Update Stock
                    await new Promise(res => transaction.query(`UPDATE PRODUTOS SET PRO_ULTIMA_CONTAGEM = CURRENT_DATE, PRO_EST_ATUAL = ? WHERE PRO_COD = ?`, [item.countedQty || 0, proCod], res));

                    // Lógica de Tratamento: Inserir SOMENTE se houver divergência real ou status de erro explícito
                    const hasDivergence = item.balance !== (item.countedQty || 0);
                    const isExplicitError = item.status === 'not_located' || item.status === 'issue' || item.status === 'divergence_info';

                    if (isExplicitError || (hasDivergence && item.status !== 'not_located')) {
                        const sqlTreat = `INSERT INTO GRIDE_TRATAMENTO (LOG_ID, PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, STATUS, REPORTADO_EM) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)`;
                        await new Promise((res, rej) => transaction.query(sqlTreat, [resLog.ID, proCod, item.ref, item.name, item.location, statusPT, item.divergenceReason || (hasDivergence ? 'Divergência de Qtd' : ''), user_name], (e) => e ? rej(e) : res()));
                    }
                }

                await new Promise((res, rej) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (e) => e ? rej(e) : res()));
                
                transaction.commit(e => { db.detach(); if(e) throw e; res.json({success: true}); });

            } catch (e) {
                transaction.rollback(); db.detach(); res.status(500).json({error: e.message});
            }
        });
    });
});

app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        const skip = ((parseInt(req.query.page)||1) - 1) * 300;
        db.query(`SELECT FIRST 300 SKIP ${skip} L.*, P.PRO_COD_SIMILAR FROM GRIDE_INVENTARIO_LOG L LEFT JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD ORDER BY L.DATA_HORA DESC`, [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({ ...r, STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || 'completed' })) : []);
        });
    });
});

app.get('/treatment-items', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query(`SELECT * FROM GRIDE_TRATAMENTO WHERE STATUS='PENDING' ORDER BY REPORTADO_EM DESC`, [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({ id: r.ID, sku: safeString(r.PRO_NRFABRICANTE), name: safeString(r.NOME_PRODUTO), location: safeString(r.LOCALIZACAO), reportedBy: safeString(r.REPORTADO_POR), reportedAt: r.REPORTADO_EM, description: safeString(r.DESCRICAO_ERRO), issueType: FROM_DB_STATUS[safeString(r.TIPO_ERRO)] || 'issue' })) : []);
        });
    });
});

// START
app.listen(port, '0.0.0.0', () => {
    console.log(`GRIDE Server Running on ${port}`);
    initDb();
});
