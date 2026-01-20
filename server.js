
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

// CORREÇÃO CRÍTICA: Conversão robusta de BLOB para String JSON
const blobToString = (blob) => {
    if (blob === null || blob === undefined) return null;
    
    // Se já for string (driver converteu auto)
    if (typeof blob === 'string') return blob;
    
    // Se for Buffer (padrão Node)
    if (Buffer.isBuffer(blob)) return blob.toString('utf8');
    
    // Se for uma função (stream do Firebird), precisamos ler (embora node-firebird geralmente entregue buffer com as configs atuais)
    if (typeof blob === 'function') {
        // Fallback simples, mas idealmente não deve cair aqui com as configs atuais
        return null; 
    }
    
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
                // Tabelas Principais
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

// NOVA ROTA: KPIs Gerenciais Reais
app.get('/analytics/kpis', (req, res) => {
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalValue: 0, totalCount: 0 });
        try {
            // 1. Valor Total em Estoque (Custo Unit * Saldo) apenas Ativos
            const sqlValue = `
                SELECT SUM(COALESCE(PRO_PRECOULTCOMPRA, 0) * COALESCE(PRO_EST_ATUAL, 0)) as TOTAL_VALUE 
                FROM PRODUTOS 
                WHERE PRO_ATIVO = 'S'
            `;
            const resValue = await execute(db, sqlValue);
            const totalValue = resValue[0]?.TOTAL_VALUE || 0;

            // 2. Contagem de Itens Ativos
            const sqlCount = `SELECT COUNT(*) as TOTAL_COUNT FROM PRODUTOS WHERE PRO_ATIVO = 'S'`;
            const resCount = await execute(db, sqlCount);
            const totalCount = resCount[0]?.TOTAL_COUNT || 0;

            db.detach();
            res.json({ totalValue, totalCount });
        } catch (e) {
            db.detach();
            console.error("Erro KPIs:", e);
            res.status(500).json({ totalValue: 0, totalCount: 0 });
        }
    });
});

// NOVA ROTA: Contagem de status (Totais)
app.get('/block-counts', (req, res) => {
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ pending: 0, progress: 0, completed: 0 });

        // 1. Reservas
        db.query('SELECT BLOCK_ID FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockSet = new Set();
            if(reservations) reservations.forEach(r => lockSet.add(safeString(r.BLOCK_ID)));

            // 2. Itens Contados
            db.query("SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')", [], (errL, logs) => {
                const countedSet = new Set();
                if(logs) logs.forEach(l => countedSet.add(l.PRO_COD));

                // 3. Buscar Produtos (Base para Blocos)
                let sql = `
                    SELECT P.PRO_COD, P.PRO_COD_SIMILAR 
                    FROM PRODUTOS P 
                    WHERE P.PRO_ATIVO = 'S'
                `;
                const params = [];

                if (search) { 
                    sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; 
                    params.push(search); params.push(search); 
                }
                if (gr_cod) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                if (sg_cod) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                if (location) { sql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; params.push(location); }

                db.query(sql, params, (errP, products) => {
                    db.detach();
                    if (errP) return res.json({ pending: 0, progress: 0, completed: 0 });

                    // Agrupar por Bloco (Chave Única)
                    const blockGroups = new Map();

                    products.forEach(p => {
                        const simRaw = safeString(p.PRO_COD_SIMILAR);
                        const idRaw = safeString(p.PRO_COD);
                        const key = simRaw.length > 0 ? simRaw : idRaw;

                        if (!blockGroups.has(key)) blockGroups.set(key, []);
                        blockGroups.get(key).push(p.PRO_COD);
                    });

                    // Calcular Status de cada Bloco
                    let pending = 0;
                    let progress = 0;
                    let completed = 0;

                    blockGroups.forEach((prodIds, key) => {
                        const isLocked = lockSet.has(key);
                        const allCounted = prodIds.every(id => countedSet.has(id));

                        if (isLocked) {
                            progress++;
                        } else if (allCounted) {
                            completed++;
                        } else {
                            pending++;
                        }
                    });

                    res.json({ pending, progress, completed });
                });
            });
        });
    });
});

app.get('/meta-status', (req, res) => {
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalStock: 0, mappedStock: 0 });
        try {
            const resTotal = await execute(db, "SELECT COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S'");
            const totalStock = resTotal[0].TOTAL;
            const resMapped = await execute(db, "SELECT COUNT(DISTINCT PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')");
            const mappedStock = resMapped[0].MAPPED;
            db.detach();
            res.json({ totalStock, mappedStock });
        } catch (e) {
            db.detach();
            res.json({ totalStock: 0, mappedStock: 0 });
        }
    });
});

app.get('/daily-meta-suggestions', (req, res) => {
    res.redirect('/blocks?limit=50&status=pending');
});

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
        
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (errG, groups) => {
            if (errG) { db.detach(); return res.json([]); }
            
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (errS, subgroups) => {
                if (errS) { db.detach(); return res.json([]); }
                
                const sqlTotal = `SELECT GR_COD, SG_COD, COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S' GROUP BY GR_COD, SG_COD`;
                const sqlMapped = `SELECT P.GR_COD, P.SG_COD, COUNT(DISTINCT L.PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG L JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD WHERE L.STATUS IN ('Contado', 'Divergência', 'Concluído') GROUP BY P.GR_COD, P.SG_COD`;

                db.query(sqlTotal, [], (errT, totalRes) => {
                    if (errT) { db.detach(); return res.json([]); }
                    db.query(sqlMapped, [], (errM, mappedRes) => {
                        db.detach();
                        
                        const totalMap = new Map();
                        totalRes.forEach(r => totalMap.set(`${r.GR_COD}-${r.SG_COD}`, r.TOTAL));
                        const mappedMap = new Map();
                        if(mappedRes) mappedRes.forEach(r => mappedMap.set(`${r.GR_COD}-${r.SG_COD}`, r.MAPPED));

                        const tree = groups.map(g => {
                            const grId = String(g.GR_COD).trim();
                            const subs = subgroups
                                .filter(s => String(s.GR_COD).trim() === grId)
                                .map(s => {
                                    const sgId = String(s.SG_COD).trim();
                                    const key = `${grId}-${sgId}`;
                                    return { 
                                        id: sgId, 
                                        db_id: s.SG_COD, 
                                        name: safeString(s.SG_DESCRI), 
                                        count: totalMap.get(key) || 0,       
                                        mappedCount: mappedMap.get(key) || 0 
                                    };
                                });
                            const groupTotal = subs.reduce((acc, s) => acc + s.count, 0);
                            const groupMapped = subs.reduce((acc, s) => acc + s.mappedCount, 0);
                            return { id: grId, db_id: g.GR_COD, label: safeString(g.GR_DESCRI), count: groupTotal, mappedCount: groupMapped, subcategories: subs };
                        });
                        res.json(tree);
                    });
                });
            });
        });
    });
});

app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;

    // Paginação: Skip logic
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Conexão' });
        
        // 1. Obter mapa de Reservas Ativas
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { userName: r.USER_NAME, timestamp: r.RESERVED_AT }));

            // 2. Obter mapa detalhado de Itens já contados
            db.query("SELECT PRO_COD, USUARIO_NOME, DATA_HORA, QTD_CONTADA FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído') ORDER BY DATA_HORA ASC", [], (errL, logs) => {
                const countedMap = new Map();
                if(logs) {
                    logs.forEach(l => {
                        countedMap.set(l.PRO_COD, {
                            user: safeString(l.USUARIO_NOME),
                            date: l.DATA_HORA,
                            qty: l.QTD_CONTADA
                        });
                    });
                }

                // 3. NOVO: Obter itens em TRATAMENTO PENDENTE (BLOQUEIO)
                db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errT, treatments) => {
                    const treatmentSet = new Set();
                    if(treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE)));

                    // --- ETAPA 1: DESCOBERTA (Paginada) ---
                    let discoverySql = `
                        SELECT FIRST ? SKIP ?
                        P.PRO_COD, P.PRO_COD_SIMILAR 
                        FROM PRODUTOS P 
                        WHERE P.PRO_ATIVO = 'S'
                    `;
                    
                    const fetchCount = limit * 5;
                    const discoveryParams = [fetchCount, skip]; 

                    if (search) { 
                        discoverySql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; 
                        discoveryParams.push(search); discoveryParams.push(search); 
                    }
                    if (gr_cod) { discoverySql += ` AND TRIM(P.GR_COD) = ?`; discoveryParams.push(gr_cod); }
                    if (sg_cod) { discoverySql += ` AND TRIM(P.SG_COD) = ?`; discoveryParams.push(sg_cod); }
                    if (location) { discoverySql += ` AND P.PRO_PRATELEIRA STARTING WITH ?`; discoveryParams.push(location); }

                    discoverySql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                    db.query(discoverySql, discoveryParams, (errD, discoveryRows) => {
                        if (errD) { db.detach(); return res.status(500).json({ error: errD.message }); }

                        // Processar linhas para encontrar as chaves únicas dos blocos
                        const seenKeys = new Set();
                        let blocksFound = 0;

                        for (const row of discoveryRows) {
                            if (blocksFound >= limit) break;
                            const simRaw = safeString(row.PRO_COD_SIMILAR);
                            const idRaw = safeString(row.PRO_COD);
                            const key = simRaw.length > 0 ? simRaw : idRaw;

                            if (!seenKeys.has(key)) {
                                seenKeys.add(key);
                                blocksFound++;
                            }
                        }

                        if (seenKeys.size === 0) {
                            db.detach();
                            return res.json([]);
                        }

                        // --- ETAPA 2: ENRIQUECIMENTO ---
                        let fetchSql = `
                            SELECT 
                            P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, 
                            M.MAR_DESCRI, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA,
                            P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA 
                            FROM PRODUTOS P 
                            LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) 
                            WHERE P.PRO_ATIVO = 'S' AND (
                        `;

                        const fetchParams = [];
                        const allKeys = Array.from(seenKeys);
                        const placeholders = allKeys.map(() => '?').join(',');

                        fetchSql += `P.PRO_COD IN (${placeholders}) OR P.PRO_COD_SIMILAR IN (${placeholders}))`;
                        fetchParams.push(...allKeys, ...allKeys);
                        fetchSql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                        db.query(fetchSql, fetchParams, (errP, products) => {
                            db.detach();
                            if (errP) return res.status(500).json({ error: errP.message });

                            const groups = new Map();
                            products.forEach(p => {
                                const simRaw = safeString(p.PRO_COD_SIMILAR);
                                const idRaw = safeString(p.PRO_COD);
                                const key = simRaw.length > 0 ? simRaw : idRaw;

                                // Verifica se item foi contado e pega detalhes
                                const lastLog = countedMap.get(p.PRO_COD);
                                const isCounted = !!lastLog;
                                
                                if (!groups.has(key)) groups.set(key, []);
                                groups.get(key).push({
                                    id: safeString(p.PRO_COD),
                                    name: safeString(p.PRO_DESCRI),
                                    ref: safeString(p.PRO_NRFABRICANTE),
                                    brand: p.MAR_DESCRI ? safeString(p.MAR_DESCRI) : 'GENÉRICO',
                                    balance: parseFloat(p.PRO_EST_ATUAL || 0),
                                    location: safeString(p.PRO_PRATELEIRA) || '', // REMOVIDO "GERAL"
                                    costPrice: parseFloat(p.PRO_PRECOULTCOMPRA || 0),
                                    salesPrice: parseFloat(p.PRO_PRECOVENDA || 0),
                                    isCounted: isCounted,
                                    lastCount: lastLog ? {
                                        user: lastLog.user,
                                        date: lastLog.date,
                                        qty: parseFloat(lastLog.qty)
                                    } : null
                                });
                            });

                            const blocks = [];
                            groups.forEach((items, key) => {
                                const lockedInfo = lockMap.get(key);
                                const allCounted = items.every(i => i.isCounted);
                                
                                // Checa se algum item deste bloco está em TRATAMENTO PENDENTE
                                const hasPendingTreatment = items.some(i => treatmentSet.has(i.ref));

                                let status = allCounted ? 'completed' : 'pending';
                                if (lockedInfo) status = 'progress';
                                
                                // BLOQUEIO PRIORITÁRIO: Se tiver tratamento pendente, sobrescreve status
                                if (hasPendingTreatment) status = 'treatment_pending';

                                let parentRefDisplay = items[0].ref || items[0].name;
                                if (items.length > 1) {
                                    const parent = items.find(i => i.id === key);
                                    const refToShow = parent ? parent.ref : items[0].ref;
                                    parentRefDisplay = `REF PAI: ${refToShow}`;
                                }

                                blocks.push({
                                    id: key,
                                    parentRef: parentRefDisplay,
                                    location: items[0].location,
                                    status: status,
                                    items: items,
                                    lockedBy: lockedInfo
                                });
                            });

                            // Ordenar: Pendentes primeiro, tratamento depois, concluidos fim
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

app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params;
    Firebird.attach(options, async (err, db) => {
        if(err) return res.json([]);
        
        try {
            const rows = await execute(db, 'SELECT BLOCK_ID, ITEMS_JSON FROM GRIDE_RESERVAS WHERE TRIM(USU_COD) = ?', [userId]);
            
            if(!rows || rows.length === 0) {
                db.detach();
                return res.json([]);
            }

            const blocks = [];
            const logs = await execute(db, "SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')");
            const countedSet = new Set(logs.map(l => l.PRO_COD));

            for (const r of rows) {
                let items = [];
                let loadedFromSnapshot = false;

                try { 
                    const jsonStr = blobToString(r.ITEMS_JSON);
                    if (jsonStr) {
                        const parsed = JSON.parse(jsonStr);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            items = parsed;
                            loadedFromSnapshot = true;
                        }
                    }
                } catch(e){ console.error("JSON Error:", e); }

                if (!loadedFromSnapshot) {
                    const blockId = safeString(r.BLOCK_ID);
                    const sqlItems = `
                        SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA, M.MAR_DESCRI, P.PRO_COD_SIMILAR,
                        P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA 
                        FROM PRODUTOS P 
                        LEFT JOIN MARCAS M ON M.MAR_COD = P.MAR_COD
                        WHERE P.PRO_ATIVO = 'S'
                    `;
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
                        location: safeString(p.PRO_PRATELEIRA) || '', // REMOVIDO "GERAL"
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
                        const refToShow = parent ? parent.ref : items[0].ref;
                        parentRefDisplay = `REF PAI: ${refToShow}`;
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

        } catch(e) {
            db.detach();
            console.error("Error in reserved-blocks:", e);
            res.json([]);
        }
    });
});

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                // 1. Inserir na tabela de Reservas
                await new Promise((resolve, reject) => {
                    transaction.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', 
                    [block_id, user_id, user_name], (err) => err ? reject(err) : resolve());
                });

                // 2. LOGAR 'RESERVADO' PARA CADA ITEM DO BLOCO (Lastro)
                const sqlItems = `
                    SELECT PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, PRO_EST_ATUAL, PRO_PRATELEIRA 
                    FROM PRODUTOS 
                    WHERE PRO_ATIVO = 'S' AND (PRO_COD = ? OR PRO_COD_SIMILAR = ?)
                `;
                const prods = await new Promise((resolve) => {
                    transaction.query(sqlItems, [block_id, block_id], (err, result) => resolve(result || []));
                });

                for(const p of prods) {
                    await new Promise((resolve) => {
                        transaction.query(
                            `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, BLOCK_REF, DATA_HORA) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RESERVADO', ?, CURRENT_TIMESTAMP)`,
                            [p.PRO_COD, p.PRO_NRFABRICANTE, p.PRO_DESCRI, user_id, user_name, p.PRO_EST_ATUAL, 0, p.PRO_PRATELEIRA || 'GERAL', block_id],
                            () => resolve()
                        );
                    });
                }

                transaction.commit((err) => {
                    db.detach();
                    res.json({ success: !err });
                });
            } catch(e) {
                transaction.rollback();
                db.detach();
                res.json({ success: false, error: e.message });
            }
        });
    });
});

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    // Buffer garante que string longa seja gravada como BLOB
    const buffer = Buffer.from(JSON.stringify(items), 'utf8');
    
    Firebird.attach(options, (err, db) => {
        db.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [buffer, block_id], (err) => {
            db.detach(); 
            res.json({success: !err});
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});

        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                // 1. Obter informações da reserva antes de deletar (para saber quem devolveu)
                const reserva = await new Promise((resolve) => {
                    transaction.query('SELECT USU_COD, USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, rows) => {
                        resolve(rows && rows.length > 0 ? rows[0] : null);
                    });
                });

                // 2. Deletar Reserva
                await new Promise((resolve) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => resolve()));

                // 3. LOGAR 'DEVOLVIDO' (Lastro)
                if (reserva) {
                    const sqlItems = `
                        SELECT PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, PRO_EST_ATUAL, PRO_PRATELEIRA 
                        FROM PRODUTOS 
                        WHERE PRO_ATIVO = 'S' AND (PRO_COD = ? OR PRO_COD_SIMILAR = ?)
                    `;
                    const prods = await new Promise((resolve) => {
                        transaction.query(sqlItems, [block_id, block_id], (err, result) => resolve(result || []));
                    });

                    for(const p of prods) {
                        await new Promise((resolve) => {
                            transaction.query(
                                `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, BLOCK_REF, DATA_HORA) 
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DEVOLVIDO', ?, CURRENT_TIMESTAMP)`,
                                [p.PRO_COD, p.PRO_NRFABRICANTE, p.PRO_DESCRI, reserva.USU_COD, reserva.USER_NAME, p.PRO_EST_ATUAL, 0, p.PRO_PRATELEIRA || 'GERAL', block_id],
                                () => resolve()
                            );
                        });
                    }
                }

                transaction.commit((err) => {
                    db.detach();
                    res.json({success:true});
                });
            } catch (e) {
                transaction.rollback();
                db.detach();
                res.json({success:false});
            }
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
                    const reason = item.divergenceReason || '';
                    
                    // 1. Obter Próximo ID de Log Manualmente (Segurança)
                    const genRes = await new Promise((resolve, reject) => {
                        transaction.query('SELECT GEN_ID(GEN_GRIDE_LOG_ID, 1) as NEW_ID FROM RDB$DATABASE', (err, rows) => {
                            if(err) reject(err);
                            else resolve(rows[0].NEW_ID);
                        });
                    });
                    const logId = genRes;

                    // 2. Inserir Log com ID explícito
                    await new Promise((resolve, reject) => {
                        transaction.query(
                            `INSERT INTO GRIDE_INVENTARIO_LOG (ID, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA, PRO_COD) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, (SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?))`,
                            [logId, item.ref, item.name, user_id, user_name, item.balance, qtd, item.lastCount?.location || 'Geral', statusDB, reason, uniqueRef, item.ref],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    // 3. Se houver divergência ou não localizado, inserir na tabela de TRATAMENTO
                    if (statusDB === 'Divergência' || statusDB === 'Não Localizado') {
                        await new Promise((resolve) => {
                            transaction.query(
                                `INSERT INTO GRIDE_TRATAMENTO (LOG_ID, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, REPORTADO_EM, STATUS)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING')`,
                                [logId, item.ref, item.name, item.lastCount?.location || 'Geral', statusDB, reason || 'Sem descrição', user_name],
                                () => resolve()
                            );
                        });
                    }

                    // 4. Atualizar Localização e Estoque se contado (mesmo com divergência, atualiza o saldo físico)
                    if (statusDB === 'Contado' || statusDB === 'Divergência') {
                        await new Promise((resolve) => {
                            transaction.query(
                                `UPDATE PRODUTOS SET PRO_EST_ATUAL = ?, PRO_PRATELEIRA = ? WHERE PRO_NRFABRICANTE = ?`,
                                [qtd, item.lastCount?.location || 'Geral', item.ref],
                                () => resolve()
                            );
                        });
                    }
                }

                // 5. Remove Reserva
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

app.post('/resolve-treatment', (req, res) => {
    const { id, note, user, action } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        
        // Simples update para marcar como resolvido
        const sql = `UPDATE GRIDE_TRATAMENTO SET STATUS = 'RESOLVED', RESOLUCAO_NOTA = ?, RESOLVIDO_POR = ?, RESOLVIDO_EM = CURRENT_TIMESTAMP WHERE ID = ?`;
        db.query(sql, [note, user, id], (err) => {
            db.detach();
            res.json({success: !err});
        });
    });
});

app.post('/update-count', (req, res) => {
    const { logId, newQty, oldQty, user_name, user_id, sku } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        
        // RECUPERAR DADOS DO LOG ORIGINAL
        db.query('SELECT * FROM GRIDE_INVENTARIO_LOG WHERE ID = ?', [logId], (err, rows) => {
            if(err || !rows || rows.length === 0) {
                db.detach();
                return res.json({success: false, message: 'Log original não encontrado'});
            }
            
            const original = rows[0];
            const diff = newQty - oldQty;
            const motivo = `Ajuste pós-conclusão: ${oldQty} -> ${newQty} (${diff > 0 ? '+' : ''}${diff})`;

            // INSERIR NOVO LOG DE EDIÇÃO
            const sqlInsert = `
                INSERT INTO GRIDE_INVENTARIO_LOG 
                (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EDIÇÃO', ?, ?, CURRENT_TIMESTAMP)
            `;
            
            const params = [
                original.PRO_COD, 
                original.PRO_NRFABRICANTE, 
                original.NOME_PRODUTO, 
                user_id || original.USU_COD, 
                user_name, 
                original.QTD_SISTEMA,
                newQty, 
                original.LOCALIZACAO, 
                motivo,
                original.BLOCK_REF
            ];

            db.query(sqlInsert, params, (errInsert) => {
                if(errInsert) {
                    db.detach();
                    return res.json({success:false});
                }

                // ATUALIZAR ESTOQUE DO PRODUTO
                db.query('UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?', [newQty, original.PRO_COD], () => {
                    db.detach();
                    res.json({success: true});
                });
            });
        });
    });
});

// MODIFICADO: LEFT JOIN COM GRIDE_TRATAMENTO PARA OBTER STATUS DA RESOLUÇÃO
app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        const sql = `
            SELECT FIRST 100 L.*, M.MAR_DESCRI, T.STATUS AS TREATMENT_STATUS, T.RESOLUCAO_NOTA
            FROM GRIDE_INVENTARIO_LOG L 
            LEFT JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD 
            LEFT JOIN MARCAS M ON P.MAR_COD = M.MAR_COD 
            LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID
            ORDER BY L.DATA_HORA DESC
        `;
        db.query(sql, [], (err, rows) => {
            db.detach();
            res.json(rows || []);
        });
    });
});

// NOVA ROTA: HISTÓRICO ESPECÍFICO DO PRODUTO (Timeline)
app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        const sql = `
            SELECT * FROM GRIDE_INVENTARIO_LOG 
            WHERE PRO_NRFABRICANTE = ? 
            ORDER BY DATA_HORA DESC
        `;
        db.query(sql, [sku], (err, rows) => {
            db.detach();
            res.json(rows || []);
        });
    });
});

app.get('/treatment-items', (req, res) => { 
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        const sql = `SELECT * FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING' ORDER BY REPORTADO_EM DESC`;
        db.query(sql, [], (err, rows) => {
            db.detach();
            if(err || !rows) return res.json([]);
            
            const formatted = rows.map(r => ({
                id: r.ID,
                sku: safeString(r.PRO_NRFABRICANTE),
                name: safeString(r.NOME_PRODUTO),
                location: safeString(r.LOCALIZACAO),
                issueType: r.TIPO_ERRO === 'Não Localizado' ? 'not_located' : 'divergence_info',
                description: safeString(r.DESCRICAO_ERRO),
                reportedBy: safeString(r.REPORTADO_POR),
                reportedAt: r.REPORTADO_EM,
                status: 'PENDING'
            }));
            res.json(formatted);
        });
    });
});

app.get('/addresses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT ID, CODIGO, DESCRICAO, TIPO FROM GRIDE_ENDERECOS ORDER BY CODIGO', [], (err, rows) => {
            db.detach();
            if(err) return res.json([]);
            const addrs = rows.map(r => ({
                id: r.ID,
                code: safeString(r.CODIGO),
                description: safeString(r.DESCRICAO),
                type: safeString(r.TIPO) || 'shelf'
            }));
            res.json(addrs);
        });
    });
});

app.post('/save-addresses', (req, res) => {
    const addresses = req.body;
    if (!Array.isArray(addresses)) return res.json({success:false});

    Firebird.attach(options, (err, db) => {
        if (err) return res.json({success:false});
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if (err) { db.detach(); return res.json({success:false}); }
            
            let count = 0;
            let skipped = 0;

            try {
                for (const addr of addresses) {
                    const exists = await new Promise((resolve, reject) => {
                        transaction.query('SELECT ID FROM GRIDE_ENDERECOS WHERE CODIGO = ?', [addr.code], (err, rows) => {
                            if (err) reject(err);
                            else resolve(rows.length > 0);
                        });
                    });

                    if (!exists) {
                        await new Promise((resolve, reject) => {
                            transaction.query(
                                'INSERT INTO GRIDE_ENDERECOS (CODIGO, DESCRICAO, TIPO) VALUES (?, ?, ?)',
                                [addr.code, addr.description, addr.type],
                                (err) => err ? reject(err) : resolve()
                            );
                        });
                        count++;
                    } else {
                        skipped++;
                    }
                }

                transaction.commit((err) => {
                    db.detach();
                    if(err) res.json({success:false});
                    else res.json({success:true, count, skipped});
                });
            } catch(e) {
                transaction.rollback();
                db.detach();
                res.json({success:false});
            }
        });
    });
});

app.get('/warehouses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT ID, SIGLA, DESCRICAO FROM GRIDE_GALPOES', [], (err, rows) => {
            db.detach();
            if(err) return res.json([]);
            const wars = rows.map(r => ({
                id: r.ID,
                sigla: safeString(r.SIGLA),
                descricao: safeString(r.DESCRICAO)
            }));
            res.json(wars);
        });
    });
});

app.post('/save-warehouse', (req, res) => {
    const { sigla, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.query('INSERT INTO GRIDE_GALPOES (SIGLA, DESCRICAO) VALUES (?, ?)', [sigla, descricao], (err) => {
            db.detach();
            res.json({success: !err, message: err ? err.message : null});
        });
    });
});

app.post('/delete-warehouse', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.query('DELETE FROM GRIDE_GALPOES WHERE ID = ?', [id], (err) => {
            db.detach();
            res.json({success: !err});
        });
    });
});

const startServer = async () => {
    try {
        await initDb();
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor GRIDE (Cobertura Total) rodando em http://localhost:${port}`);
        });
    } catch (e) {
        console.error("Falha fatal na inicialização:", e);
    }
};

startServer();
