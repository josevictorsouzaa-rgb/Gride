
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
                // Tabelas
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

app.get('/daily-meta-suggestions', (req, res) => {
    const dailyTarget = parseInt(req.query.dailyTarget) || 150;
    const cooldownDays = parseInt(req.query.cooldownDays) || 30;
    const highGiroThreshold = parseInt(req.query.highGiroThreshold) || 5;
    const accumulationMode = req.query.accumulationMode === 'true';

    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro ao conectar ao DB' });

        try {
            let effectiveTarget = dailyTarget;
            if (accumulationMode) {
                const pendingSql = `SELECT COUNT(*) as COUNTED FROM GRIDE_INVENTARIO_LOG WHERE DATA_HORA >= DATEADD(-3 DAY TO CURRENT_DATE) AND DATA_HORA < CURRENT_DATE AND (STATUS = 'Contado' OR STATUS = 'Divergência')`;
                const logsResult = await execute(db, pendingSql);
                const countedLast3Days = logsResult[0].COUNTED || 0;
                const deficit = Math.max(0, (dailyTarget * 3) - countedLast3Days);
                effectiveTarget += Math.min(deficit, Math.floor(dailyTarget * 0.5));
            }

            const exclusionSql = `SELECT PRO_COD FROM GRIDE_RESERVAS UNION SELECT PRO_COD FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'`;
            const exclusions = await execute(db, exclusionSql);
            const excludedIds = exclusions.map(r => r.PRO_COD).filter(id => id).join(',');
            const exclusionClause = excludedIds ? `AND P2.PRO_COD NOT IN (${excludedIds})` : '';

            // 1. Identificar grupos (Retorna um ID representativo - REF_ID - que é MIN(PRO_COD) do grupo)
            // REMOVIDO: WHERE PI.DATA >= ... para evitar erro de coluna inexistente
            const sqlGiroIds = `
                SELECT FIRST ${Math.floor(effectiveTarget * 0.4)} 
                MIN(P2.PRO_COD) as REF_ID
                FROM PEDIDOSITENS PI 
                JOIN PRODUTOS P2 ON P2.PRO_COD = PI.PRO_COD 
                LEFT JOIN GRIDE_INVENTARIO_LOG L ON L.PRO_COD = P2.PRO_COD 
                WHERE 1=1 ${exclusionClause} 
                GROUP BY COALESCE(P2.PRO_COD_SIMILAR, CAST(P2.PRO_COD AS VARCHAR(20)))
                HAVING COUNT(*) >= ${highGiroThreshold} 
                AND (MAX(L.DATA_HORA) IS NULL OR MAX(L.DATA_HORA) < DATEADD(-${cooldownDays} DAY TO CURRENT_DATE))
            `;
            
            const giroGroups = await execute(db, sqlGiroIds);
            const highGiroIds = giroGroups.map(r => Number(r.REF_ID)).filter(n => !isNaN(n));

            const neededForCycle = Math.max(0, effectiveTarget - highGiroIds.length);
            const sqlCycleIds = `
                SELECT FIRST ${neededForCycle} 
                MIN(P2.PRO_COD) as REF_ID
                FROM PRODUTOS P2 
                LEFT JOIN GRIDE_INVENTARIO_LOG L ON L.PRO_COD = P2.PRO_COD 
                WHERE P2.PRO_ATIVO = 'S' ${exclusionClause}
                GROUP BY COALESCE(P2.PRO_COD_SIMILAR, CAST(P2.PRO_COD AS VARCHAR(20)))
                ORDER BY MAX(L.DATA_HORA) ASC NULLS FIRST
            `;
            
            const cycleGroups = await execute(db, sqlCycleIds);
            const cycleIds = cycleGroups.map(r => Number(r.REF_ID)).filter(n => !isNaN(n));

            // Combinar IDs únicos (Numéricos limpos)
            const finalIds = [...new Set([...highGiroIds, ...cycleIds])].map(Number).filter(id => id && !isNaN(id));

            if (finalIds.length === 0) {
                db.detach();
                return res.json([]);
            }

            // 2. Expandir para buscar TODOS os itens dos grupos (Siblings)
            // Query aprimorada para buscar blocos completos baseado no similarId
            const finalIdsStr = finalIds.join(',');
            
            const sqlDetails = `
                SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, M.MAR_DESCRI, 
                       P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE, P.PRO_PRATELEIRA 
                FROM PRODUTOS P 
                LEFT JOIN MARCAS M ON (M.MAR_COD = P.MAR_COD) 
                WHERE P.PRO_COD IN (${finalIdsStr})
                   OR (P.PRO_COD_SIMILAR IS NOT NULL AND P.PRO_COD_SIMILAR IN (
                       SELECT DISTINCT COALESCE(P2.PRO_COD_SIMILAR, CAST(P2.PRO_COD AS VARCHAR(20))) 
                       FROM PRODUTOS P2 
                       WHERE P2.PRO_COD IN (${finalIdsStr})
                   ))
                ORDER BY P.PRO_PRATELEIRA
            `;
            
            const products = await execute(db, sqlDetails);
            db.detach();

            // 3. Agrupar e Formatar
            const groups = new Map();
            const todayFormatted = new Date().toLocaleDateString('pt-BR');
            const highGiroSet = new Set(highGiroIds);

            products.forEach(p => {
                // Chave de agrupamento: Similar ID ou o próprio PRO_COD se não houver similar
                const similarId = p.PRO_COD_SIMILAR ? String(p.PRO_COD_SIMILAR).trim() : String(p.PRO_COD).trim();
                
                if (!groups.has(similarId)) groups.set(similarId, []);
                
                groups.get(similarId).push({
                    id: String(p.PRO_COD).trim(), 
                    db_pro_cod: p.PRO_COD, 
                    name: String(p.PRO_DESCRI || '').trim(), 
                    ref: String(p.PRO_NRFABRICANTE || '').trim(), 
                    brand: p.MAR_DESCRI ? String(p.MAR_DESCRI).trim() : 'SEM MARCA', 
                    balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                    location: String(p.PRO_PRATELEIRA || 'GERAL').trim(), 
                    inTreatment: false 
                });
            });

            const blocks = [];
            groups.forEach((items, key) => {
                // Verifica se algum item do bloco faz parte da lista de Giro Alto original
                const isGiro = items.some(item => highGiroSet.has(item.db_pro_cod));
                
                blocks.push({
                    id: key, 
                    parentRef: items[0].ref || items[0].name, 
                    location: items[0].location, 
                    status: 'pending', 
                    date: todayFormatted, 
                    subcategory: isGiro ? 'Giro Alto' : 'Ciclo', 
                    items: items,
                    addedAt: new Date().toISOString()
                });
            });

            res.json(blocks);
        } catch (e) {
            console.error("ERRO CRÍTICO NA META:", e);
            if (db) db.detach();
            res.status(500).json({ error: e.message });
        }
    });
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
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (errGroups, groups) => {
            if (errGroups) { db.detach(); return res.json([]); }
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (errSub, subgroups) => {
                if (errSub) { db.detach(); return res.json([]); }
                const sqlCounts = `SELECT GR_COD, SG_COD, COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S' GROUP BY GR_COD, SG_COD`;
                db.query(sqlCounts, [], (errCount, counts) => {
                    db.detach();
                    const countMap = new Map();
                    const groupCountMap = new Map();
                    if (!errCount && counts) {
                        counts.forEach(row => {
                            const gr = String(row.GR_COD).trim();
                            const sg = String(row.SG_COD).trim();
                            const total = row.TOTAL;
                            countMap.set(`${gr}-${sg}`, total);
                            groupCountMap.set(gr, (groupCountMap.get(gr) || 0) + total);
                        });
                    }
                    const tree = groups.map(g => {
                        const groupId = String(g.GR_COD).trim();
                        const subs = subgroups.filter(s => String(s.GR_COD).trim() === groupId).map(s => ({ 
                            id: String(s.SG_COD).trim(), 
                            db_id: s.SG_COD, 
                            name: safeString(s.SG_DESCRI), 
                            count: countMap.get(`${groupId}-${String(s.SG_COD).trim()}`) || 0, 
                            icon: 'circle' 
                        }));
                        return { id: groupId, db_id: g.GR_COD, label: safeString(g.GR_DESCRI), icon: 'inventory_2', count: groupCountMap.get(groupId) || 0, subcategories: subs };
                    });
                    res.json(tree);
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

app.get('/meta-status', (req, res) => {
    const dailyTarget = parseInt(req.query.target) || 150;
    const accumulate = req.query.accumulate === 'true';
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ dailyTarget, countedToday: 0, accumulatedPending: 0 });
        try {
            const sqlToday = `SELECT COUNT(*) as TOTAL FROM GRIDE_INVENTARIO_LOG WHERE CAST(DATA_HORA AS DATE) = CAST('NOW' AS DATE) AND (STATUS = 'Contado' OR STATUS = 'Divergência')`;
            const todayRes = await execute(db, sqlToday);
            const countedToday = todayRes[0].TOTAL;
            let accumulatedPending = 0;
            if (accumulate) {
                const sqlPast = `SELECT COUNT(*) as TOTAL FROM GRIDE_INVENTARIO_LOG WHERE DATA_HORA >= DATEADD(-3 DAY TO CAST('NOW' AS DATE)) AND DATA_HORA < CAST('NOW' AS DATE) AND (STATUS = 'Contado' OR STATUS = 'Divergência')`;
                const pastRes = await execute(db, sqlPast);
                const pastCount = pastRes[0].TOTAL;
                const pastTarget = dailyTarget * 3; 
                accumulatedPending = Math.max(0, pastTarget - pastCount);
                accumulatedPending = Math.min(accumulatedPending, Math.floor(dailyTarget * 0.5));
            }
            db.detach();
            res.json({ dailyTarget, countedToday, accumulatedPending });
        } catch (e) {
            db.detach();
            res.json({ dailyTarget, countedToday: 0, accumulatedPending: 0 });
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
        
        db.query(`SELECT 1 FROM GRIDE_TRATAMENTO WHERE PRO_NRFABRICANTE IN (SELECT PRO_NRFABRICANTE FROM PRODUTOS WHERE PRO_COD = ? OR PRO_COD_SIMILAR = ?) AND STATUS = 'PENDING'`, [block_id, block_id], (errT, treatResult) => {
             if (!errT && treatResult && treatResult.length > 0) { db.detach(); return res.json({ success: false, message: 'Item em tratamento pendente.' }); }

             db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (errR, result) => {
                if (errR) { db.detach(); return res.status(500).json({ success: false, message: errR.message }); }
                if (result && result.length > 0) { db.detach(); return res.json({ success: false, message: `Bloco já reservado por ${safeString(result[0].USER_NAME)}` }); }
                
                const proCodVal = isNaN(parseInt(block_id)) ? 0 : parseInt(block_id);

                db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, PRO_COD, RESERVED_AT, ITEMS_JSON) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)', [block_id, user_id, user_name, proCodVal], (errIns) => {
                    if (errIns) { db.detach(); return res.status(500).json({ success: false, message: 'Erro ao reservar: ' + errIns.message }); }
                    
                    const logSql = `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, USU_COD, USUARIO_NOME, STATUS, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, 'RESERVADO', ?, CURRENT_TIMESTAMP)`;
                    db.query(logSql, [proCodVal, user_id, user_name, block_id], (errLog) => {
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

                    const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING ID`;
                    
                    const resultLog = await new Promise((resolve, reject) => {
                        transaction.query(sqlLog, [realProCod, item.ref, item.name, user_id, user_name, item.balance, qtdContada, localizacao, statusPT, motivo, uniqueBlockRef], (err, res) => { if (err) reject(err); else resolve(res); });
                    });
                    
                    const logId = resultLog.ID;

                    if (statusEN === 'counted' || statusEN === 'divergence_info') {
                        const sqlFinal = `INSERT INTO GRIDE_CONTAS_FINALIZADAS (SKU, PRO_COD, QTD_FINAL, DATA_HORA, USUARIO_NOME, STATUS, LOG_ORIGEM_ID) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'FINALIZADO', ?)`;
                        await new Promise((resolve, reject) => { transaction.query(sqlFinal, [item.ref, realProCod, qtdContada, user_name, logId], (err) => { if(err) reject(err); else resolve(); }); });
                    }

                    const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?`;
                    await new Promise((resolve) => { transaction.query(sqlUpdate, [qtdContada, realProCod], (err) => resolve()); });

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
