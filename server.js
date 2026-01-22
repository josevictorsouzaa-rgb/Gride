
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
        if (msg.includes('exists') || msg.includes('unsuccessful metadata update') || msg.includes('already') || msg.includes('duplicate')) {
            // console.log(`   [SKIP] ${description}`);
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
                // Tabelas Core do GRIDE
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tab Endereços");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tab Galpões");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tab Reservas");
                await safeExecute(db, `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, "Col JSON Reservas");
                
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR(255), BLOCK_REF VARCHAR(50), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tab Logs");
                
                // *** TABELA DE CICLOS ***
                await safeExecute(db, `CREATE TABLE GRIDE_CICLOS (ID INTEGER NOT NULL PRIMARY KEY, NOME VARCHAR(100) NOT NULL, DATA_INICIO TIMESTAMP DEFAULT CURRENT_TIMESTAMP, DATA_FIM TIMESTAMP, ATIVO CHAR(1) DEFAULT 'N')`, "Tab Ciclos");
                await safeExecute(db, `CREATE GENERATOR GEN_GRIDE_CICLOS_ID`, "Gen Ciclos");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_CICLOS FOR GRIDE_CICLOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_CICLOS_ID, 1); END`, "Trig Ciclos");
                
                // *** VÍNCULO DE LOG AO CICLO ***
                await safeExecute(db, `ALTER TABLE GRIDE_INVENTARIO_LOG ADD CICLO_ID INTEGER`, "Col CICLO_ID em Logs");

                await safeExecute(db, `CREATE TABLE GRIDE_CONTAS_FINALIZADAS (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), PRO_COD INTEGER, QTD_FINAL DECIMAL(15,4), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP, USUARIO_NOME VARCHAR(100), STATUS VARCHAR(20), LOG_ORIGEM_ID INTEGER)`, "Tab Contas Final");
                await safeExecute(db, `CREATE TABLE GRIDE_TRATAMENTO (ID INTEGER NOT NULL PRIMARY KEY, LOG_ID INTEGER, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), LOCALIZACAO VARCHAR(100), TIPO_ERRO VARCHAR(50), DESCRICAO_ERRO VARCHAR(255), REPORTADO_POR VARCHAR(100), REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP, STATUS VARCHAR(20) DEFAULT 'PENDING', RESOLVIDO_POR VARCHAR(20), RESOLVIDO_EM TIMESTAMP, RESOLUCAO_NOTA VARCHAR(255))`, "Tab Tratamento");

                // TABELA DE PERMISSÕES
                await safeExecute(db, `CREATE TABLE GRIDE_PERFIL_USUARIO (
                    USU_COD VARCHAR(20) NOT NULL PRIMARY KEY,
                    ATIVO CHAR(1) DEFAULT 'S',
                    PERM_TREATMENT CHAR(1) DEFAULT 'N',
                    PERM_ANALYTICS CHAR(1) DEFAULT 'N',
                    PERM_ADDRESSING CHAR(1) DEFAULT 'N',
                    PERM_SETTINGS CHAR(1) DEFAULT 'N'
                )`, "Tab Perfil Usuário");

                // TABELA DE CONFIGURAÇÃO (LAYOUT, ETC)
                await safeExecute(db, `CREATE TABLE GRIDE_CONFIG (KEY_ID VARCHAR(50) NOT NULL PRIMARY KEY, VAL_BLOB BLOB SUB_TYPE TEXT)`, "Tab Config");

                // Generators
                const gens = ['GEN_GRIDE_ENDERECOS_ID', 'GEN_GRIDE_GALPOES_ID', 'GEN_GRIDE_LOG_ID', 'GEN_GRIDE_TRATAMENTO_ID', 'GEN_GRIDE_CONTAS_FIN_ID'];
                for (const g of gens) await safeExecute(db, `CREATE GENERATOR ${g}`, `Gen ${g}`);

                // Triggers
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`, "Trig Endereços");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`, "Trig Galpões");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`, "Trig Logs");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_TRATAMENTO FOR GRIDE_TRATAMENTO ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_TRATAMENTO_ID, 1); END`, "Trig Tratamento");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_CONTAS_FIN FOR GRIDE_CONTAS_FINALIZADAS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_CONTAS_FIN_ID, 1); END`, "Trig Contas Fin");

                // *** GARANTIR CICLO ATIVO INICIAL ***
                const activeCycle = await execute(db, `SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'`);
                if (!activeCycle || activeCycle.length === 0) {
                    console.log(">>> [INIT] Nenhum ciclo ativo. Criando 'Ciclo Inicial'...");
                    await execute(db, `INSERT INTO GRIDE_CICLOS (NOME, ATIVO, DATA_INICIO) VALUES ('Ciclo Inicial', 'S', CURRENT_TIMESTAMP)`);
                }

                console.log(">>> [INIT] Banco de dados padronizado.");
            } catch (e) { 
                console.error(">>> [INIT ERROR]", e); 
            } finally { 
                db.detach(); 
                resolve(); 
            }
        });
    });
};

// ------------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO E USUÁRIOS
// ------------------------------------------------------------------

app.post('/login', (req, res) => {
    const { usuario_id, senha } = req.body;
    if (usuario_id === '9999' && senha === '172500') {
        return res.json({ 
            success: true, 
            user: { id: '9999', name: 'ADM', role: 'Administrador', active: true, isAdmin: true, permissions: { treatment: true, analytics: true, addressing: true, settings: true } } 
        });
    }
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro de conexão com o banco.' });
        const sqlLegacy = `SELECT * FROM USUARIOS WHERE USU_COD = ?`;
        db.query(sqlLegacy, [usuario_id], (err, legacyRows) => {
            if (err || !legacyRows || legacyRows.length === 0) {
                db.detach();
                return res.status(401).json({error: 'Usuário não encontrado.'});
            }
            const userLegacy = legacyRows[0];
            const userName = safeString(userLegacy.USU_NOME || userLegacy.NOME || userLegacy.USUARIO || 'Colaborador');
            if (userLegacy.USU_ATIVO && safeString(userLegacy.USU_ATIVO) === 'N') {
                db.detach();
                return res.status(403).json({error: 'Usuário inativo no sistema legado.'});
            }
            db.query(`SELECT * FROM GRIDE_PERFIL_USUARIO WHERE USU_COD = ?`, [safeString(usuario_id)], (errP, profileRows) => {
                const profile = (profileRows && profileRows.length > 0) ? profileRows[0] : null;
                if (profile && safeString(profile.ATIVO) === 'N') {
                    db.detach();
                    return res.status(403).json({error: 'Acesso bloqueado pelo administrador.'});
                }
                db.query(`SELECT FIRST 1 PWD_SENHA FROM PASSWORDS WHERE USU_COD = ? ORDER BY PWD_ID DESC`, [usuario_id], (errPwd, pwdRows) => {
                    db.detach();
                    if (!errPwd && pwdRows && pwdRows.length > 0 && safeString(pwdRows[0].PWD_SENHA) === senha) {
                        const perms = {
                            treatment: profile ? safeString(profile.PERM_TREATMENT) === 'S' : false,
                            analytics: profile ? safeString(profile.PERM_ANALYTICS) === 'S' : false,
                            addressing: profile ? safeString(profile.PERM_ADDRESSING) === 'S' : false,
                            settings: profile ? safeString(profile.PERM_SETTINGS) === 'S' : false
                        };
                        res.json({ success: true, user: { id: usuario_id, name: userName, role: 'Colaborador', active: true, isAdmin: false, permissions: perms } });
                    } else {
                        res.status(401).json({ error: 'Senha incorreta.' });
                    }
                });
            });
        });
    });
});

app.get('/users', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT USU_COD, USU_NOME, USU_ATIVO FROM USUARIOS ORDER BY USU_NOME`, [], (errU, usersLegacy) => {
            if (errU) { db.detach(); return res.json([]); }
            db.query(`SELECT * FROM GRIDE_PERFIL_USUARIO`, [], (errP, profiles) => {
                db.detach();
                const profileMap = new Map();
                if (profiles) profiles.forEach(p => profileMap.set(safeString(p.USU_COD), p));
                const result = usersLegacy.map(u => {
                    const idStr = safeString(u.USU_COD);
                    const prof = profileMap.get(idStr);
                    const legacyActive = safeString(u.USU_ATIVO) !== 'N';
                    const grideActive = prof ? safeString(prof.ATIVO) !== 'N' : true;
                    return {
                        id: idStr,
                        name: safeString(u.USU_NOME),
                        role: 'Colaborador',
                        avatar: '',
                        active: legacyActive && grideActive,
                        permissions: {
                            treatment: prof ? safeString(prof.PERM_TREATMENT) === 'S' : false,
                            analytics: prof ? safeString(prof.PERM_ANALYTICS) === 'S' : false,
                            addressing: prof ? safeString(prof.PERM_ADDRESSING) === 'S' : false,
                            settings: prof ? safeString(prof.PERM_SETTINGS) === 'S' : false
                        }
                    };
                });
                res.json(result);
            });
        });
    });
});

app.post('/update-user-permissions', (req, res) => {
    const { id, active, permissions } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        const sql = `UPDATE OR INSERT INTO GRIDE_PERFIL_USUARIO (USU_COD, ATIVO, PERM_TREATMENT, PERM_ANALYTICS, PERM_ADDRESSING, PERM_SETTINGS) VALUES (?, ?, ?, ?, ?, ?) MATCHING (USU_COD)`;
        const params = [id, active ? 'S' : 'N', permissions.treatment ? 'S' : 'N', permissions.analytics ? 'S' : 'N', permissions.addressing ? 'S' : 'N', permissions.settings ? 'S' : 'N'];
        db.query(sql, params, (err) => {
            db.detach();
            if (err) return res.json({success:false, error: err.message});
            res.json({success: true});
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
            else res.status(404).json({ error: 'Usuário não encontrado' });
        });
    });
});

// ------------------------------------------------------------------
// ROTAS DE CICLOS
// ------------------------------------------------------------------

app.get('/cycles', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT * FROM GRIDE_CICLOS ORDER BY DATA_INICIO DESC', [], (err, rows) => {
            db.detach();
            if(err) return res.json([]);
            res.json(rows.map(r => ({
                id: r.ID,
                name: safeString(r.NOME),
                startDate: r.DATA_INICIO,
                endDate: r.DATA_FIM,
                active: safeString(r.ATIVO) === 'S'
            })));
        });
    });
});

app.post('/cycles', (req, res) => {
    const { name } = req.body;
    if(!name) return res.status(400).json({success:false, error: "Nome obrigatório"});
    
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                // 1. Fecha ciclo ativo anterior
                await new Promise((resolve, reject) => transaction.query("UPDATE GRIDE_CICLOS SET ATIVO = 'N', DATA_FIM = CURRENT_TIMESTAMP WHERE ATIVO = 'S'", [], (err) => err ? reject(err) : resolve()));
                
                // 2. Cria novo ciclo
                await new Promise((resolve, reject) => transaction.query("INSERT INTO GRIDE_CICLOS (NOME, ATIVO, DATA_INICIO) VALUES (?, 'S', CURRENT_TIMESTAMP)", [name], (err) => err ? reject(err) : resolve()));
                
                transaction.commit(err => {
                    db.detach();
                    if(err) return res.json({success:false, error: err.message});
                    res.json({success: true});
                });
            } catch (e) {
                transaction.rollback();
                db.detach();
                res.json({success:false, error: e.message});
            }
        });
    });
});

// ------------------------------------------------------------------
// ROTAS DE ANALYTICS & DASHBOARD
// ------------------------------------------------------------------

app.get('/analytics/years', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([new Date().getFullYear()]);
        const sql = `SELECT DISTINCT EXTRACT(YEAR FROM DATA_HORA) as ANO FROM GRIDE_INVENTARIO_LOG WHERE STATUS NOT IN ('RESERVADO', 'DEVOLVIDO', 'pending') ORDER BY 1 DESC`;
        db.query(sql, [], (err, rows) => { db.detach(); res.json(rows ? rows.map(r => r.ANO).filter(y => y) : [new Date().getFullYear()]); });
    });
});

app.get('/analytics/kpis', (req, res) => {
    const { cycleId } = req.query;
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 });
        try {
            // Se cycleId for passado e não for 'all', calcula KPIs do CICLO
            if (cycleId && cycleId !== 'all') {
                const sqlVal = `
                    SELECT 
                        SUM(COALESCE(P.PRO_PRECOULTCOMPRA, 0) * L.QTD_CONTADA) as TOTAL_COST, 
                        SUM(COALESCE(P.PRO_PRECOVENDA, 0) * L.QTD_CONTADA) as TOTAL_SALES,
                        COUNT(DISTINCT L.PRO_COD) as ITEMS_COUNT
                    FROM GRIDE_INVENTARIO_LOG L
                    JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD
                    WHERE L.CICLO_ID = ? AND L.STATUS IN ('Contado', 'Divergência', 'Concluído')
                `;
                const resVal = await execute(db, sqlVal, [cycleId]);
                const resIna = await execute(db, `SELECT COUNT(*) as CNT FROM PRODUTOS WHERE PRO_ATIVO <> 'S'`);
                
                db.detach();
                res.json({ 
                    totalCost: resVal[0]?.TOTAL_COST || 0, 
                    totalSales: resVal[0]?.TOTAL_SALES || 0, 
                    totalCount: resVal[0]?.ITEMS_COUNT || 0, 
                    inactiveCount: resIna[0]?.CNT || 0 
                });

            } else {
                // Se não (Global/All), calcula snapshot do estoque ATUAL (Valor Fixo)
                const resValue = await execute(db, `SELECT SUM(COALESCE(PRO_PRECOULTCOMPRA, 0) * COALESCE(PRO_EST_ATUAL, 0)) as TOTAL_COST, SUM(COALESCE(PRO_PRECOVENDA, 0) * COALESCE(PRO_EST_ATUAL, 0)) as TOTAL_SALES FROM PRODUTOS WHERE PRO_ATIVO = 'S'`);
                const resCount = await execute(db, `SELECT SUM(CASE WHEN PRO_ATIVO = 'S' THEN 1 ELSE 0 END) as ACTIVE_COUNT, SUM(CASE WHEN PRO_ATIVO <> 'S' THEN 1 ELSE 0 END) as INACTIVE_COUNT FROM PRODUTOS`);
                db.detach();
                res.json({ totalCost: resValue[0]?.TOTAL_COST || 0, totalSales: resValue[0]?.TOTAL_SALES || 0, totalCount: resCount[0]?.ACTIVE_COUNT || 0, inactiveCount: resCount[0]?.INACTIVE_COUNT || 0 });
            }
        } catch (e) { db.detach(); res.json({ totalCost: 0, totalSales: 0, totalCount: 0, inactiveCount: 0 }); }
    });
});

app.get('/analytics/heatmap', (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const cycleId = req.query.cycleId;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        let sql = `SELECT EXTRACT(MONTH FROM DATA_HORA) as MES, EXTRACT(DAY FROM DATA_HORA) as DIA, COUNT(*) as QTD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')`;
        const params = [];
        if (cycleId && cycleId !== 'all') {
            sql += ` AND CICLO_ID = ?`;
            params.push(cycleId);
        } else {
            sql += ` AND EXTRACT(YEAR FROM DATA_HORA) = ?`;
            params.push(year);
        }
        sql += ` GROUP BY 1, 2`;
        db.query(sql, params, (err, rows) => { db.detach(); res.json(rows ? rows.map(r => ({ month: r.MES, day: r.DIA, count: r.QTD })) : []); });
    });
});

app.get('/analytics/ranking', (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const cycleId = req.query.cycleId;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        let sql = `SELECT USU_COD, USUARIO_NOME, COUNT(*) as TOTAL_CONTAGENS, SUM(CASE WHEN (QTD_SISTEMA - QTD_CONTADA) <> 0 THEN 1 ELSE 0 END) as DIVERGENCIAS FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')`;
        const params = [];
        if (cycleId && cycleId !== 'all') {
            sql += ` AND CICLO_ID = ?`;
            params.push(cycleId);
        } else {
            sql += ` AND EXTRACT(YEAR FROM DATA_HORA) = ?`;
            params.push(year);
        }
        sql += ` GROUP BY USU_COD, USUARIO_NOME ORDER BY 3 DESC`;
        db.query(sql, params, (err, rows) => {
            db.detach();
            res.json(rows ? rows.map(r => ({ name: safeString(r.USUARIO_NOME), counts: r.TOTAL_CONTAGENS || 0, accuracy: r.TOTAL_CONTAGENS > 0 ? ((r.TOTAL_CONTAGENS - (r.DIVERGENCIAS || 0)) / r.TOTAL_CONTAGENS) * 100 : 100, id: r.USU_COD })) : []);
        });
    });
});

app.get('/analytics/top-divergences', (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const cycleId = req.query.cycleId;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        let sql = `SELECT FIRST 100 L.ID, L.PRO_NRFABRICANTE, L.NOME_PRODUTO, L.LOCALIZACAO, L.USUARIO_NOME, L.QTD_SISTEMA, L.QTD_CONTADA, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA, M.MAR_DESCRI, (L.QTD_CONTADA - L.QTD_SISTEMA) as DIFF, ((L.QTD_CONTADA - L.QTD_SISTEMA) * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) as IMPACTO FROM GRIDE_INVENTARIO_LOG L JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD LEFT JOIN MARCAS M ON P.MAR_COD = M.MAR_COD WHERE (L.QTD_CONTADA - L.QTD_SISTEMA) <> 0 AND L.STATUS IN ('Contado', 'Divergência', 'Concluído')`;
        const params = [];
        if (cycleId && cycleId !== 'all') {
            sql += ` AND L.CICLO_ID = ?`;
            params.push(cycleId);
        } else {
            sql += ` AND EXTRACT(YEAR FROM L.DATA_HORA) = ?`;
            params.push(year);
        }
        sql += ` ORDER BY ABS((L.QTD_CONTADA - L.QTD_SISTEMA) * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) DESC`;
        db.query(sql, params, (err, rows) => {
            db.detach();
            res.json(rows ? rows.map(r => ({ id: r.ID, sku: safeString(r.PRO_NRFABRICANTE), name: safeString(r.NOME_PRODUTO), brand: safeString(r.MAR_DESCRI), location: safeString(r.LOCALIZACAO), user: safeString(r.USUARIO_NOME), expected: r.QTD_SISTEMA, counted: r.QTD_CONTADA, costPrice: r.PRO_PRECOULTCOMPRA, salesPrice: r.PRO_PRECOVENDA, diff: r.DIFF, diffValue: r.IMPACTO })) : []);
        });
    });
});

app.get('/analytics/categories-financial', (req, res) => {
    const cycleId = req.query.cycleId;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        let sql = "";
        const params = [];
        if (cycleId && cycleId !== 'all') {
            sql = `SELECT G.GR_COD, G.GR_DESCRI, S.SG_COD, S.SG_DESCRI, COUNT(*) as QTD_FISICA, SUM(L.QTD_CONTADA * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) as VALOR_TOTAL FROM GRIDE_INVENTARIO_LOG L JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD JOIN GRUPOPRODUTOS G ON P.GR_COD = G.GR_COD JOIN SUBGRUPOPRODUTOS S ON P.SG_COD = S.SG_COD AND P.GR_COD = S.GR_COD WHERE L.CICLO_ID = ? AND L.STATUS IN ('Contado', 'Divergência', 'Concluído') GROUP BY G.GR_COD, G.GR_DESCRI, S.SG_COD, S.SG_DESCRI ORDER BY 1, 6 DESC`;
            params.push(cycleId);
        } else {
            sql = `SELECT G.GR_COD, G.GR_DESCRI, S.SG_COD, S.SG_DESCRI, COUNT(*) as QTD_FISICA, SUM(P.PRO_PRECOULTCOMPRA * P.PRO_EST_ATUAL) as VALOR_TOTAL FROM PRODUTOS P JOIN GRUPOPRODUTOS G ON P.GR_COD = G.GR_COD JOIN SUBGRUPOPRODUTOS S ON P.SG_COD = S.SG_COD AND P.GR_COD = S.GR_COD WHERE P.PRO_ATIVO = 'S' GROUP BY G.GR_COD, G.GR_DESCRI, S.SG_COD, S.SG_DESCRI ORDER BY 1, 6 DESC`;
        }
        db.query(sql, params, (err, rows) => {
            db.detach();
            const groupsMap = new Map();
            if(rows) rows.forEach(r => {
                if (!groupsMap.has(r.GR_COD)) groupsMap.set(r.GR_COD, { id: r.GR_COD, name: safeString(r.GR_DESCRI), qty: 0, value: 0, subgroups: [] });
                const group = groupsMap.get(r.GR_COD);
                group.qty += r.QTD_FISICA; group.value += (r.VALOR_TOTAL || 0);
                group.subgroups.push({ id: r.SG_COD, name: safeString(r.SG_DESCRI), qty: r.QTD_FISICA, value: r.VALOR_TOTAL || 0 });
            });
            res.json(Array.from(groupsMap.values()).sort((a, b) => b.value - a.value));
        });
    });
});

app.get('/analytics/financial-items', (req, res) => {
    const { gr_cod, sg_cod, cycleId } = req.query;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        let sql = "";
        const params = [];
        if (cycleId && cycleId !== 'all') {
             sql = `SELECT FIRST 200 L.PRO_NRFABRICANTE, L.NOME_PRODUTO as PRO_DESCRI, L.QTD_CONTADA as PRO_EST_ATUAL, P.PRO_PRECOULTCOMPRA, (L.QTD_CONTADA * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) as VALOR_TOTAL FROM GRIDE_INVENTARIO_LOG L JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD WHERE P.GR_COD = ? AND P.SG_COD = ? AND L.CICLO_ID = ? AND L.STATUS IN ('Contado', 'Divergência', 'Concluído') ORDER BY 5 DESC`;
             params.push(gr_cod, sg_cod, cycleId);
        } else {
             sql = `SELECT FIRST 200 P.PRO_NRFABRICANTE, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_PRECOULTCOMPRA, (P.PRO_EST_ATUAL * COALESCE(P.PRO_PRECOULTCOMPRA, 0)) as VALOR_TOTAL FROM PRODUTOS P WHERE P.GR_COD = ? AND P.SG_COD = ? AND P.PRO_ATIVO = 'S' ORDER BY 5 DESC`;
             params.push(gr_cod, sg_cod);
        }
        db.query(sql, params, (err, rows) => {
            db.detach();
            res.json(rows ? rows.map(r => ({ sku: safeString(r.PRO_NRFABRICANTE), name: safeString(r.PRO_DESCRI), qty: r.PRO_EST_ATUAL, unitPrice: r.PRO_PRECOULTCOMPRA || 0, value: r.VALOR_TOTAL || 0 })) : []);
        });
    });
});

app.get('/analytics/cycle-performance/:cycleId', (req, res) => {
    const { cycleId } = req.params;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({ success: false });
        const sqlChart = `SELECT EXTRACT(DAY FROM DATA_HORA) as DIA, EXTRACT(MONTH FROM DATA_HORA) as MES, EXTRACT(YEAR FROM DATA_HORA) as ANO, COUNT(*) as QTD FROM GRIDE_INVENTARIO_LOG WHERE CICLO_ID = ? AND STATUS IN ('Contado', 'Divergência', 'Concluído') GROUP BY 3, 2, 1 ORDER BY 3, 2, 1`;
        const sqlTotals = `SELECT COUNT(*) as TOTAL, SUM(CASE WHEN STATUS = 'Contado' THEN 1 ELSE 0 END) as CORRETOS, SUM(CASE WHEN STATUS = 'Divergência' OR STATUS = 'Não Localizado' THEN 1 ELSE 0 END) as DIVERGENTES FROM GRIDE_INVENTARIO_LOG WHERE CICLO_ID = ? AND STATUS IN ('Contado', 'Divergência', 'Concluído', 'Não Localizado')`;
        db.query(sqlChart, [cycleId], (errC, chartRows) => {
            if(errC) { db.detach(); return res.json({success:false}); }
            db.query(sqlTotals, [cycleId], (errT, totalRows) => {
                db.detach();
                if(errT) return res.json({success:false});
                const totals = totalRows[0] || { TOTAL: 0, CORRETOS: 0, DIVERGENTES: 0 };
                const chart = chartRows.map(r => ({ date: `${r.DIA}/${r.MES}`, count: r.QTD }));
                res.json({ totalCount: totals.TOTAL, accuracy: totals.TOTAL > 0 ? (totals.CORRETOS / totals.TOTAL) * 100 : 100, divergenceCount: totals.DIVERGENTES, chartData: chart });
            });
        });
    });
});

app.post('/reports/generate', (req, res) => {
    const { cycleId, statuses, users, columns } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({ error: "DB Connect Error" });
        let sql = `SELECT L.ID, L.PRO_NRFABRICANTE, L.NOME_PRODUTO, L.LOCALIZACAO, L.QTD_SISTEMA, L.QTD_CONTADA, L.USUARIO_NOME, L.DATA_HORA, L.STATUS, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA, (L.QTD_CONTADA - L.QTD_SISTEMA) as DIFF_QTD FROM GRIDE_INVENTARIO_LOG L LEFT JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD WHERE 1=1`;
        const params = [];
        if (cycleId && cycleId !== 'all') { sql += ` AND L.CICLO_ID = ?`; params.push(cycleId); }
        if (statuses && Array.isArray(statuses) && statuses.length > 0) {
            const dbStatuses = [];
            if (statuses.includes('ok')) dbStatuses.push("'Contado'", "'Concluído'");
            if (statuses.includes('divergent')) dbStatuses.push("'Divergência'", "'Não Localizado'");
            if (dbStatuses.length > 0) sql += ` AND L.STATUS IN (${dbStatuses.join(',')})`;
        }
        if (users && Array.isArray(users) && users.length > 0) {
            const userPlaceholders = users.map(() => '?').join(',');
            sql += ` AND L.USUARIO_NOME IN (${userPlaceholders})`;
            params.push(...users);
        }
        sql += ` ORDER BY L.DATA_HORA DESC`;
        db.query(sql, params, (err, rows) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });
            const reportData = rows.map(r => {
                const item = {};
                if (columns.includes('sku')) item['SKU'] = safeString(r.PRO_NRFABRICANTE);
                if (columns.includes('product')) item['Produto'] = safeString(r.NOME_PRODUTO);
                if (columns.includes('location')) item['Localização'] = safeString(r.LOCALIZACAO);
                if (columns.includes('systemQty')) item['Qtd Sistema'] = r.QTD_SISTEMA;
                if (columns.includes('countedQty')) item['Qtd Contada'] = r.QTD_CONTADA;
                if (columns.includes('diffQty')) item['Diferença'] = r.DIFF_QTD;
                if (columns.includes('cost')) item['Custo Unit.'] = r.PRO_PRECOULTCOMPRA;
                if (columns.includes('price')) item['Venda Unit.'] = r.PRO_PRECOVENDA;
                if (columns.includes('totalDiff')) item['Impacto R$'] = (r.DIFF_QTD * (r.PRO_PRECOULTCOMPRA || 0)).toFixed(2);
                if (columns.includes('user')) item['Usuário'] = safeString(r.USUARIO_NOME);
                if (columns.includes('date')) item['Data'] = new Date(r.DATA_HORA).toLocaleDateString('pt-BR') + ' ' + new Date(r.DATA_HORA).toLocaleTimeString('pt-BR');
                if (columns.includes('status')) item['Status'] = safeString(r.STATUS);
                return item;
            });
            res.json(reportData);
        });
    });
});

app.get('/meta-status', (req, res) => {
    Firebird.attach(options, async (err, db) => {
        if (err) return res.status(500).json({ totalStock: 0, mappedStock: 0, cycleName: '' });
        try {
            const cicloRes = await execute(db, "SELECT ID, NOME FROM GRIDE_CICLOS WHERE ATIVO = 'S'");
            const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;
            const activeCicloName = (cicloRes && cicloRes.length > 0) ? safeString(cicloRes[0].NOME) : 'Ciclo Inicial';
            const resTotal = await execute(db, "SELECT COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S'");
            let mapSql = "SELECT COUNT(DISTINCT PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')";
            if (activeCicloId) mapSql += ` AND CICLO_ID = ${activeCicloId}`;
            const resMapped = await execute(db, mapSql);
            db.detach(); 
            res.json({ totalStock: resTotal[0].TOTAL, mappedStock: resMapped[0].MAPPED, cycleName: activeCicloName });
        } catch (e) { db.detach(); res.json({ totalStock: 0, mappedStock: 0, cycleName: '' }); }
    });
});

app.get('/categories', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query("SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'", [], (errC, cicloRes) => {
            const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;
            db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (errG, groups) => {
                if (errG) { db.detach(); return res.json([]); }
                db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (errS, subgroups) => {
                    if (errS) { db.detach(); return res.json([]); }
                    const sqlTotal = `SELECT GR_COD, SG_COD, COUNT(*) as TOTAL FROM PRODUTOS WHERE PRO_ATIVO = 'S' GROUP BY GR_COD, SG_COD`;
                    let sqlMapped = `SELECT P.GR_COD, P.SG_COD, COUNT(DISTINCT L.PRO_COD) as MAPPED FROM GRIDE_INVENTARIO_LOG L JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD WHERE L.STATUS IN ('Contado', 'Divergência', 'Concluído')`;
                    if (activeCicloId) sqlMapped += ` AND L.CICLO_ID = ${activeCicloId}`;
                    sqlMapped += ` GROUP BY P.GR_COD, P.SG_COD`;
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
                                const subs = subgroups.filter(s => String(s.GR_COD).trim() === grId).map(s => {
                                    const sgId = String(s.SG_COD).trim();
                                    const key = `${grId}-${sgId}`;
                                    return { id: sgId, db_id: s.SG_COD, name: safeString(s.SG_DESCRI), count: totalMap.get(key) || 0, mappedCount: mappedMap.get(key) || 0 };
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
});

// ------------------------------------------------------------------
// ROTAS DE BLOCOS E OPERAÇÕES
// ------------------------------------------------------------------

app.get('/blocks', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod;
    const sg_cod = req.query.sg_cod;
    const location = req.query.location;
    const skip = (page - 1) * limit;
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Conexão' });
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errR, reservations) => {
            const lockMap = new Map();
            if(reservations) reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { userName: r.USER_NAME, timestamp: r.RESERVED_AT }));
            
            db.query("SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'", [], (errC, cicloRes) => {
                const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;
                
                let logSql = "SELECT PRO_COD, USUARIO_NOME, DATA_HORA, QTD_CONTADA FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')";
                if (activeCicloId) {
                    logSql += ` AND CICLO_ID = ${activeCicloId}`;
                }
                
                db.query(logSql, [], (errL, logs) => {
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
                                res.json(blocks);
                            });
                        });
                    });
                });
            });
        });
    });
});

app.get('/block-counts', (req, res) => {
    const search = req.query.search || ''; const gr_cod = req.query.gr_cod; const sg_cod = req.query.sg_cod; const location = req.query.location;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ pending: 0, progress: 0, completed: 0 });
        
        db.query("SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'", [], (errC, cicloRes) => {
            const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;
            
            db.query('SELECT BLOCK_ID FROM GRIDE_RESERVAS', [], (errR, reservations) => {
                const lockSet = new Set(); if(reservations) reservations.forEach(r => lockSet.add(safeString(r.BLOCK_ID)));
                
                let logSql = "SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')";
                if (activeCicloId) logSql += ` AND CICLO_ID = ${activeCicloId}`;
                
                db.query(logSql, [], (errL, logs) => {
                    const countedSet = new Set(); if(logs) logs.forEach(l => countedSet.add(l.PRO_COD));
                    
                    let sql = `SELECT P.PRO_COD, P.PRO_COD_SIMILAR FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S'`;
                    const params = [];
                    if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
                    if (gr_cod) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                    if (sg_cod) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                    if (location) { const cleanLoc = location.replace(/^LOC-/i, ''); sql += ` AND (P.PRO_PRATELEIRA STARTING WITH ? OR P.PRO_PRATELEIRA STARTING WITH ?)`; params.push(location); params.push(cleanLoc); }
                    
                    db.query(sql, params, (errP, products) => {
                        db.detach(); if (errP) return res.json({ pending: 0, progress: 0, completed: 0 });
                        const blockGroups = new Map(); products.forEach(p => { const simRaw = safeString(p.PRO_COD_SIMILAR); const idRaw = safeString(p.PRO_COD); const key = simRaw.length > 0 ? simRaw : idRaw; if (!blockGroups.has(key)) blockGroups.set(key, []); blockGroups.get(key).push(p.PRO_COD); });
                        let pending = 0, progress = 0, completed = 0;
                        blockGroups.forEach((prodIds, key) => { const isLocked = lockSet.has(key); const allCounted = prodIds.every(id => countedSet.has(id)); if (isLocked) progress++; else if (allCounted) completed++; else pending++; });
                        res.json({ pending, progress, completed });
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
            if(!rows || rows.length === 0) { db.detach(); return res.json([]); }
            const blocks = [];
            
            const cicloRes = await execute(db, "SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'");
            const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;
            
            let logSql = "SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')";
            if (activeCicloId) logSql += ` AND CICLO_ID = ${activeCicloId}`;
            
            const logs = await execute(db, logSql);
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

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                await new Promise((resolve, reject) => transaction.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [block_id, user_id, user_name], (err) => err ? reject(err) : resolve()));
                
                const sqlItems = `SELECT PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, PRO_EST_ATUAL, PRO_PRATELEIRA FROM PRODUTOS WHERE PRO_ATIVO = 'S' AND (PRO_COD = ? OR PRO_COD_SIMILAR = ?)`;
                const prods = await new Promise((resolve) => transaction.query(sqlItems, [block_id, block_id], (err, result) => resolve(result || [])));
                for(const p of prods) {
                    await new Promise((resolve) => transaction.query(`INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'RESERVADO', ?, CURRENT_TIMESTAMP)`, [p.PRO_COD, p.PRO_NRFABRICANTE, p.PRO_DESCRI, user_id, user_name, p.PRO_EST_ATUAL, 0, p.PRO_PRATELEIRA || 'GERAL', block_id], () => resolve()));
                }
                transaction.commit((err) => { db.detach(); res.json({ success: !err }); });
            } catch(e) { transaction.rollback(); db.detach(); res.json({ success: false, error: e.message }); }
        });
    });
});

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const jsonStr = JSON.stringify(items);
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if(err) { db.detach(); return res.json({success:false}); }
            transaction.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [jsonStr, block_id], (err, result) => {
                if(err) { transaction.rollback(); db.detach(); return res.json({success:false}); }
                transaction.commit((err) => { db.detach(); res.json({success: !err}); });
            });
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                const reserva = await new Promise((resolve) => transaction.query('SELECT USU_COD, USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, rows) => resolve(rows && rows.length > 0 ? rows[0] : null)));
                await new Promise((resolve) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => resolve()));
                if (reserva) {
                    const sqlItems = `SELECT PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, PRO_EST_ATUAL, PRO_PRATELEIRA FROM PRODUTOS WHERE PRO_ATIVO = 'S' AND (PRO_COD = ? OR PRO_COD_SIMILAR = ?)`;
                    const prods = await new Promise((resolve) => transaction.query(sqlItems, [block_id, block_id], (err, result) => resolve(result || [])));
                    for(const p of prods) {
                        await new Promise((resolve) => transaction.query(`INSERT INTO GRIDE_INVENTARIO_LOG (PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, BLOCK_REF, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DEVOLVIDO', ?, CURRENT_TIMESTAMP)`, [p.PRO_COD, p.PRO_NRFABRICANTE, p.PRO_DESCRI, reserva.USU_COD, reserva.USER_NAME, p.PRO_EST_ATUAL, 0, p.PRO_PRATELEIRA || 'GERAL', block_id], () => resolve()));
                    }
                }
                transaction.commit((err) => { db.detach(); res.json({success:true}); });
            } catch (e) { transaction.rollback(); db.detach(); res.json({success:false}); }
        });
    });
});

app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items, parent_ref } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'DB' });
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                const cicloRes = await new Promise((resolve) => transaction.query("SELECT ID FROM GRIDE_CICLOS WHERE ATIVO = 'S'", (err, rows) => resolve(rows)));
                const activeCicloId = (cicloRes && cicloRes.length > 0) ? cicloRes[0].ID : null;

                const uniqueRef = `${parent_ref}||${Date.now()}`;
                for(const item of items) {
                    const statusDB = item.status === 'not_located' ? 'Não Localizado' : (item.status === 'divergence_info' ? 'Divergência' : 'Contado');
                    const qtd = item.countedQty || 0;
                    const reason = item.divergenceReason || '';
                    const genRes = await new Promise((resolve, reject) => transaction.query('SELECT GEN_ID(GEN_GRIDE_LOG_ID, 1) as NEW_ID FROM RDB$DATABASE', (err, rows) => err ? reject(err) : resolve(rows[0].NEW_ID)));
                    
                    await new Promise((resolve, reject) => {
                        transaction.query(`INSERT INTO GRIDE_INVENTARIO_LOG (ID, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA, PRO_COD, CICLO_ID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, (SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?), ?)`,
                        [genRes, item.ref, item.name, user_id, user_name, item.balance, qtd, item.lastCount?.location || 'Geral', statusDB, reason, uniqueRef, item.ref, activeCicloId], (err) => err ? reject(err) : resolve());
                    });

                    if (statusDB === 'Divergência' || statusDB === 'Não Localizado') {
                        await new Promise((resolve) => transaction.query(`INSERT INTO GRIDE_TRATAMENTO (LOG_ID, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, REPORTADO_EM, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING')`, [genRes, item.ref, item.name, item.lastCount?.location || 'Geral', statusDB, reason || 'Sem descrição', user_name], () => resolve()));
                    }
                    if (statusDB === 'Contado' || statusDB === 'Divergência') {
                        await new Promise((resolve) => transaction.query(`UPDATE PRODUTOS SET PRO_EST_ATUAL = ?, PRO_PRATELEIRA = ? WHERE PRO_NRFABRICANTE = ?`, [qtd, item.lastCount?.location || 'Geral', item.ref], () => resolve()));
                    }
                }
                await new Promise((resolve) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => resolve()));
                transaction.commit((err) => { db.detach(); res.json({success: true}); });
            } catch(e) { transaction.rollback(); db.detach(); res.json({success: false, error: e.message}); }
        });
    });
});

app.post('/resolve-treatment', (req, res) => {
    const { id, note, user, action } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.query(`UPDATE GRIDE_TRATAMENTO SET STATUS = 'RESOLVED', RESOLUCAO_NOTA = ?, RESOLVIDO_POR = ?, RESOLVIDO_EM = CURRENT_TIMESTAMP WHERE ID = ?`, [note, user, id], (err) => { db.detach(); res.json({success: !err}); });
    });
});

// ------------------------------------------------------------------
// ROTAS RESTAURADAS (HISTORY, TREATMENT, ADDRESSES)
// ------------------------------------------------------------------

// History
app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        const sql = `SELECT FIRST ? SKIP ? L.*, P.PRO_PRECOULTCOMPRA, P.PRO_PRECOVENDA, P.PRO_COD_SIMILAR, M.MAR_DESCRI, T.STATUS as TREATMENT_STATUS FROM GRIDE_INVENTARIO_LOG L LEFT JOIN PRODUTOS P ON L.PRO_COD = P.PRO_COD LEFT JOIN MARCAS M ON P.MAR_COD = M.MAR_COD LEFT JOIN GRIDE_TRATAMENTO T ON L.ID = T.LOG_ID ORDER BY L.DATA_HORA DESC`;
        db.query(sql, [limit, skip], (err, rows) => {
            db.detach();
            if(err) return res.json([]);
            const results = rows.map(r => ({ ...r, ID: r.ID, PRO_NRFABRICANTE: safeString(r.PRO_NRFABRICANTE), NOME_PRODUTO: safeString(r.NOME_PRODUTO), USUARIO_NOME: safeString(r.USUARIO_NOME), LOCALIZACAO: safeString(r.LOCALIZACAO), STATUS: safeString(r.STATUS), MAR_DESCRI: safeString(r.MAR_DESCRI), PRO_COD_SIMILAR: safeString(r.PRO_COD_SIMILAR), TREATMENT_STATUS: safeString(r.TREATMENT_STATUS) }));
            res.json(results);
        });
    });
});

// Product History (Timeline)
app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        const sql = `SELECT * FROM GRIDE_INVENTARIO_LOG WHERE PRO_NRFABRICANTE = ? ORDER BY DATA_HORA DESC`;
        db.query(sql, [sku], (err, rows) => {
            db.detach();
            res.json(rows || []);
        });
    });
});

// Treatment Items
app.get('/treatment-items', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query("SELECT * FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING' ORDER BY REPORTADO_EM DESC", [], (err, rows) => {
            db.detach();
            if(err) return res.json([]);
            res.json(rows.map(r => ({
                id: r.ID,
                sku: safeString(r.PRO_NRFABRICANTE),
                name: safeString(r.NOME_PRODUTO),
                location: safeString(r.LOCALIZACAO),
                issueType: safeString(r.TIPO_ERRO) === 'Não Localizado' ? 'not_located' : 'divergence_info',
                description: safeString(r.DESCRICAO_ERRO),
                reportedBy: safeString(r.REPORTADO_POR),
                reportedAt: r.REPORTADO_EM,
                status: safeString(r.STATUS)
            })));
        });
    });
});

// Addresses
app.get('/addresses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT * FROM GRIDE_ENDERECOS', [], (err, rows) => {
            db.detach();
            res.json(rows ? rows.map(r => ({
                id: r.ID,
                code: safeString(r.CODIGO),
                description: safeString(r.DESCRICAO),
                type: safeString(r.TIPO)
            })) : []);
        });
    });
});

// Save Addresses
app.post('/save-addresses', (req, res) => {
    const addresses = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                let count = 0; let skipped = 0;
                for(const addr of addresses) {
                    const exists = await new Promise((resolve) => transaction.query('SELECT ID FROM GRIDE_ENDERECOS WHERE CODIGO = ?', [addr.code], (err, rows) => resolve(rows && rows.length > 0)));
                    if(!exists) {
                        await new Promise((resolve, reject) => transaction.query('INSERT INTO GRIDE_ENDERECOS (CODIGO, DESCRICAO, TIPO) VALUES (?, ?, ?)', [addr.code, addr.description, addr.type], (err) => err ? reject(err) : resolve()));
                        count++;
                    } else { skipped++; }
                }
                transaction.commit((err) => { db.detach(); res.json({success: true, count, skipped}); });
            } catch(e) { transaction.rollback(); db.detach(); res.json({success:false, error: e.message}); }
        });
    });
});

// Warehouses
app.get('/warehouses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json([]);
        db.query('SELECT * FROM GRIDE_GALPOES', [], (err, rows) => {
            db.detach();
            res.json(rows ? rows.map(r => ({ id: r.ID, sigla: safeString(r.SIGLA), descricao: safeString(r.DESCRICAO) })) : []);
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

// Layout
app.get('/layout', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if(err) return res.json(null);
        db.query("SELECT * FROM RDB$RELATIONS WHERE RDB$RELATION_NAME = 'GRIDE_CONFIG'", [], (err, rows) => {
            if(!rows || rows.length === 0) {
               db.query("CREATE TABLE GRIDE_CONFIG (KEY_ID VARCHAR(50) PRIMARY KEY, VAL_BLOB BLOB SUB_TYPE TEXT)", [], () => { db.detach(); res.json(null); });
            } else {
                db.query("SELECT VAL_BLOB FROM GRIDE_CONFIG WHERE KEY_ID = 'LAYOUT_MAIN'", [], async (err, rows) => {
                    if(!rows || rows.length === 0) { db.detach(); return res.json(null); }
                    const json = await readBlob(rows[0].VAL_BLOB);
                    db.detach();
                    try { res.json(JSON.parse(json)); } catch(e) { res.json(null); }
                });
            }
        });
    });
});

app.post('/layout', (req, res) => {
    const layout = req.body;
    const jsonStr = JSON.stringify(layout);
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.query("UPDATE OR INSERT INTO GRIDE_CONFIG (KEY_ID, VAL_BLOB) VALUES ('LAYOUT_MAIN', ?) MATCHING (KEY_ID)", [jsonStr], (err) => {
            db.detach();
            res.json({success: !err});
        });
    });
});

const startServer = async () => {
    try {
        await initDb();
        app.listen(port, '0.0.0.0', () => {
            console.log(`Servidor GRIDE (Tabela Paralela v5) rodando em http://localhost:${port}`);
        });
    } catch (e) {
        console.error("Falha fatal na inicialização:", e);
    }
};

startServer();
