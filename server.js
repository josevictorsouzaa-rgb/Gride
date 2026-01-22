
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

// Leitura Assíncrona de BLOB
const readBlob = (blob) => {
    return new Promise((resolve) => {
        if (blob === null || blob === undefined) return resolve(null);
        if (typeof blob === 'string') return resolve(blob);
        if (Buffer.isBuffer(blob)) return resolve(blob.toString('utf8'));
        if (Array.isArray(blob)) return resolve(Buffer.from(blob).toString('utf8'));

        if (typeof blob === 'function') {
            blob((err, name, eventEmitter) => {
                if (err) {
                    console.error("Erro ao abrir stream do blob:", err);
                    return resolve(null);
                }
                const chunks = [];
                eventEmitter.on('data', chunk => chunks.push(chunk));
                eventEmitter.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                eventEmitter.on('error', (e) => {
                    console.error("Erro no stream do blob:", e);
                    resolve(null);
                });
            });
            return;
        }
        resolve(String(blob));
    });
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
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tabela Endereços");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tabela Galpões");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Reservas");
                await safeExecute(db, `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, "Coluna ITEMS_JSON em Reservas");
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR(255), BLOCK_REF VARCHAR(50), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Logs");
                await safeExecute(db, `CREATE TABLE GRIDE_CONTAS_FINALIZADAS (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), PRO_COD INTEGER, QTD_FINAL DECIMAL(15,4), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP, USUARIO_NOME VARCHAR(100), STATUS VARCHAR(20), LOG_ORIGEM_ID INTEGER)`, "Tabela Contas Finalizadas");
                await safeExecute(db, `CREATE TABLE GRIDE_TRATAMENTO (ID INTEGER NOT NULL PRIMARY KEY, LOG_ID INTEGER, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), LOCALIZACAO VARCHAR(100), TIPO_ERRO VARCHAR(50), DESCRICAO_ERRO VARCHAR(255), REPORTADO_POR VARCHAR(100), REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP, STATUS VARCHAR(20) DEFAULT 'PENDING', RESOLVIDO_POR VARCHAR(20), RESOLVIDO_EM TIMESTAMP, RESOLUCAO_NOTA VARCHAR(255))`, "Tabela Tratamento");

                const gens = ['GEN_GRIDE_ENDERECOS_ID', 'GEN_GRIDE_GALPOES_ID', 'GEN_GRIDE_LOG_ID', 'GEN_GRIDE_TRATAMENTO_ID', 'GEN_GRIDE_CONTAS_FIN_ID'];
                for (const g of gens) await safeExecute(db, `CREATE GENERATOR ${g}`, `Generator ${g}`);

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

// ... (analytics routes omitted for brevity, no changes there) ...

app.get('/blocks', (req, res) => {
    // ... (same as before) ...
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;
    const skip = (page - 1) * limit;
    
    // ... (rest of logic unchanged, just ensuring it's included correctly)
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Conexão' });
        // ...
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { userName: r.USER_NAME, timestamp: r.RESERVED_AT }));
            db.query("SELECT PRO_COD, USUARIO_NOME, DATA_HORA, QTD_CONTADA FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído') ORDER BY DATA_HORA ASC", [], (errL, logs) => {
                const countedMap = new Map();
                if(logs) logs.forEach(l => countedMap.set(l.PRO_COD, { user: safeString(l.USUARIO_NOME), date: l.DATA_HORA, qty: l.QTD_CONTADA }));
                db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errT, treatments) => {
                    const treatmentSet = new Set();
                    if(treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE)));
                    
                    let discoverySql = `SELECT FIRST ? SKIP ? P.PRO_COD, P.PRO_COD_SIMILAR FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S'`;
                    const discoveryParams = [limit * 5, skip]; 
                    if (search) { discoverySql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; discoveryParams.push(search); discoveryParams.push(search); }
                    if (gr_cod) { discoverySql += ` AND TRIM(P.GR_COD) = ?`; discoveryParams.push(gr_cod); }
                    if (sg_cod) { discoverySql += ` AND TRIM(P.SG_COD) = ?`; discoveryParams.push(sg_cod); }
                    if (location) { 
                        const cleanLoc = location.replace(/^LOC-/i, '');
                        discoverySql += ` AND (P.PRO_PRATELEIRA STARTING WITH ? OR P.PRO_PRATELEIRA STARTING WITH ?)`; 
                        discoveryParams.push(location);
                        discoveryParams.push(cleanLoc);
                    }
                    discoverySql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                    db.query(discoverySql, discoveryParams, (errD, discoveryRows) => {
                        if (errD) { db.detach(); return res.status(500).json({ error: errD.message }); }
                        const seenKeys = new Set();
                        let blocksFound = 0;
                        for (const row of discoveryRows) {
                            if (blocksFound >= limit) break;
                            const simRaw = safeString(row.PRO_COD_SIMILAR);
                            const idRaw = safeString(row.PRO_COD);
                            const key = simRaw.length > 0 ? simRaw : idRaw;
                            if (!seenKeys.has(key)) { seenKeys.add(key); blocksFound++; }
                        }
                        if (seenKeys.size === 0) { db.detach(); return res.json([]); }
                        
                        let fetchSql = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA FROM PRODUTOS P LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) WHERE P.PRO_ATIVO = 'S' AND (`;
                        const fetchParams = [];
                        const allKeys = Array.from(seenKeys);
                        const placeholders = allKeys.map(() => '?').join(',');
                        fetchSql += `P.PRO_COD IN (${placeholders}) OR P.PRO_COD_SIMILAR IN (${placeholders})) ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;
                        fetchParams.push(...allKeys, ...allKeys);
                        
                        db.query(fetchSql, fetchParams, (errP, products) => {
                            db.detach();
                            if (errP) return res.status(500).json({ error: errP.message });
                            
                            const groups = new Map();
                            products.forEach(p => {
                                const simRaw = safeString(p.PRO_COD_SIMILAR);
                                const idRaw = safeString(p.PRO_COD);
                                const key = simRaw.length > 0 ? simRaw : idRaw;
                                const lastLog = countedMap.get(p.PRO_COD);
                                if (!groups.has(key)) groups.set(key, []);
                                groups.get(key).push({
                                    id: safeString(p.PRO_COD),
                                    name: safeString(p.PRO_DESCRI),
                                    ref: safeString(p.PRO_NRFABRICANTE),
                                    brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                                    balance: parseFloat(p.PRO_EST_ATUAL || 0),
                                    location: safeString(p.PRO_PRATELEIRA),
                                    costPrice: parseFloat(p.PRO_PRECOULTCOMPRA || 0),
                                    salesPrice: parseFloat(p.PRO_PRECOVENDA || 0),
                                    isCounted: !!lastLog,
                                    lastCount: lastLog ? { user: lastLog.user, date: lastLog.date, qty: parseFloat(lastLog.qty) } : null
                                });
                            });
                            // ... rest of processing ...
                            const blocks = [];
                            groups.forEach((items, key) => {
                                const lockedInfo = lockMap.get(key);
                                const allCounted = items.every(i => i.isCounted);
                                const hasPendingTreatment = items.some(i => treatmentSet.has(i.ref));
                                let status = allCounted ? 'completed' : 'pending';
                                if (lockedInfo) status = 'progress';
                                if (hasPendingTreatment) status = 'treatment_pending';
                                let parentRefDisplay = items[0].ref || items[0].name;
                                if (items.length > 1) {
                                    const parent = items.find(i => i.id === key);
                                    parentRefDisplay = `REF PAI: ${parent ? parent.ref : items[0].ref}`;
                                }
                                blocks.push({ id: key, parentRef: parentRefDisplay, location: items[0].location, status: status, items: items, lockedBy: lockedInfo });
                            });
                            blocks.sort((a, b) => {
                                if (a.status === 'pending' && b.status !== 'pending') return -1;
                                if (a.status !== 'pending' && b.status === 'pending') return 1;
                                return 0;
                            });
                            res.json(blocks);
                        });
                    });
                });
            });
        });
    });
});

app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        // FIX: Adicionadas colunas PRO_PRECOULTCOMPRA e PRO_PRECOVENDA na query
        const sql = `SELECT FIRST 100 L.*, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA, M.MAR_DESCRI, T.STATUS AS TREATMENT_STATUS, T.RESOLUCAO_NOTA FROM GRIDE_INVENTARIO_LOG L LEFT JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD LEFT JOIN MARCAS M ON P.MAR_COD = M.MAR_COD LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID ORDER BY L.DATA_HORA DESC`;
        db.query(sql, [], (err, rows) => { db.detach(); res.json(rows || []); });
    });
});

// ... (other routes like /reserved-blocks, etc. remain the same as previous updates) ...

// Rota de reservados (já estava ok, mas mantendo para consistência no server.js completo)
app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params;
    Firebird.attach(options, async (err, db) => {
        if(err) return res.json([]);
        try {
            const rows = await execute(db, 'SELECT BLOCK_ID, ITEMS_JSON FROM GRIDE_RESERVAS WHERE TRIM(USU_COD) = ?', [userId]);
            if(!rows || rows.length === 0) { db.detach(); return res.json([]); }

            const blocks = [];
            const logs = await execute(db, "SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')");
            const countedSet = new Set(logs.map(l => l.PRO_COD));

            for (const r of rows) {
                let items = [];
                let loadedFromSnapshot = false;
                
                try { 
                    const jsonStr = await readBlob(r.ITEMS_JSON);
                    if (jsonStr && jsonStr.trim().length > 0) {
                        const parsed = JSON.parse(jsonStr);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            items = parsed;
                            loadedFromSnapshot = true;
                        }
                    }
                } catch(e){ console.error("JSON Error (Reserved):", e); }

                if (!loadedFromSnapshot) {
                    const blockId = safeString(r.BLOCK_ID);
                    const sqlItems = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA, M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA FROM PRODUTOS P LEFT JOIN MARCAS M ON M.MAR_COD = P.MAR_COD WHERE P.PRO_ATIVO = 'S'`;
                    const allProds = await execute(db, sqlItems);
                    const products = allProds.filter(p => {
                        const simRaw = safeString(p.PRO_COD_SIMILAR);
                        const idRaw = safeString(p.PRO_COD);
                        const itemKey = simRaw.length > 0 ? simRaw : idRaw;
                        return itemKey === blockId;
                    });
                    items = products.map(p => ({
                        id: safeString(p.PRO_COD),
                        name: safeString(p.PRO_DESCRI),
                        ref: safeString(p.PRO_NRFABRICANTE),
                        brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                        balance: parseFloat(p.PRO_EST_ATUAL || 0),
                        location: safeString(p.PRO_PRATELEIRA),
                        costPrice: parseFloat(p.PRO_PRECOULTCOMPRA || 0),
                        salesPrice: parseFloat(p.PRO_PRECOVENDA || 0),
                        isCounted: countedSet.has(p.PRO_COD),
                        status: countedSet.has(p.PRO_COD) ? 'completed' : 'pending'
                    }));
                }

                if (items.length > 0) {
                    let parentRefDisplay = items[0].ref || items[0].name;
                    if (items.length > 1) {
                        const parent = items.find(i => i.id === safeString(r.BLOCK_ID));
                        parentRefDisplay = `REF PAI: ${parent ? parent.ref : items[0].ref}`;
                    }
                    blocks.push({
                        id: safeString(r.BLOCK_ID),
                        parentRef: parentRefDisplay,
                        location: items[0].location || 'Geral',
                        status: 'progress',
                        items: items
                    });
                }
            }
            db.detach();
            res.json(blocks);
        } catch(e) { db.detach(); res.json([]); }
    });
});

// ... (Rest of routes: reserve-block, etc) ...

// Start Server
const startServer = async () => {
    try {
        await initDb();
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor GRIDE (Completo v3) rodando em http://localhost:${port}`);
        });
    } catch (e) {
        console.error("Falha fatal na inicialização:", e);
    }
};

startServer();
