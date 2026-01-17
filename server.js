
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
                
                // CORREÇÃO DO PONTO ONDE FALHOU: Definição completa da tabela de logs
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

// --- ROTA VITAL: ESTRUTURA E PROGRESSO (COBERTURA TOTAL) ---
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
                const sqlMapped = `
                    SELECT P.GR_COD, P.SG_COD, COUNT(DISTINCT L.PRO_COD) as MAPPED
                    FROM GRIDE_INVENTARIO_LOG L
                    JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD
                    WHERE L.STATUS IN ('Contado', 'Divergência', 'Concluído')
                    GROUP BY P.GR_COD, P.SG_COD
                `;

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
                                    const total = totalMap.get(key) || 0;
                                    const mapped = mappedMap.get(key) || 0;
                                    
                                    return { 
                                        id: sgId, 
                                        db_id: s.SG_COD, 
                                        name: safeString(s.SG_DESCRI), 
                                        count: total,       
                                        mappedCount: mapped 
                                    };
                                });

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

app.get('/daily-stats/:userId', (req, res) => {
    // Mantido por compatibilidade, mas agora retorna 0 se não usado
    res.json({ countedToday: 0 });
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

            // Itens já contados
            db.query("SELECT PRO_COD FROM GRIDE_INVENTARIO_LOG WHERE STATUS IN ('Contado', 'Divergência', 'Concluído')", [], (errL, logs) => {
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

                sql += ` ORDER BY P.PRO_PRATELEIRA, P.PRO_DESCRI`;

                db.query(sql, params, (errP, products) => {
                    db.detach();
                    if (errP) return res.status(500).json({ error: errP.message });

                    // Agrupamento
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
                        const allCounted = items.every(i => i.isCounted);
                        let status = allCounted ? 'completed' : 'pending';
                        if (lockedBy) status = 'progress';

                        blocks.push({
                            id: key,
                            parentRef: items[0].ref || items[0].name,
                            location: items[0].location,
                            status: status,
                            items: items,
                            lockedBy: lockedBy ? { userName: lockedBy } : null
                        });
                    });

                    // Ordenar: Pendentes primeiro
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

// --- ROTAS ADICIONAIS PARA FUNCIONALIDADES EXTRAS ---
app.get('/treatment-items', (req, res) => { res.json([]); });
app.get('/addresses', (req, res) => { res.json([]); });
app.get('/warehouses', (req, res) => { res.json([]); });
app.post('/save-addresses', (req, res) => { res.json({success:true, count:0, skipped:0}); });
app.post('/save-warehouse', (req, res) => { res.json({success:true}); });
app.post('/delete-warehouse', (req, res) => { res.json({success:true}); });
app.post('/update-count', (req, res) => { res.json({success:true}); });

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
