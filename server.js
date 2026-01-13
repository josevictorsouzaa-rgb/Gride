
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

// --- INIT DB (SCHEMA ATUALIZADO PARA PADRÃO LEGADO) ---
const initDb = () => {
    return new Promise((resolve, reject) => {
        console.log(">>> [INIT] Conectando ao Firebird...");
        
        Firebird.attach(options, async (err, db) => {
            if (err) {
                console.error(">>> [FATAL] Não foi possível conectar ao DB:", err.message);
                return resolve(); 
            }

            try {
                // 1. Tabelas Básicas
                await safeExecute(db, 
                    `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, 
                    "Tabela Endereços"
                );
                
                await safeExecute(db, 
                    `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, 
                    "Tabela Galpões"
                );

                // 2. Tabela de Reservas (Atualizado: USU_COD, PRO_COD)
                await safeExecute(db, 
                    `CREATE TABLE GRIDE_RESERVAS (
                        BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, 
                        USU_COD VARCHAR(20) NOT NULL, 
                        USER_NAME VARCHAR(100), 
                        PRO_COD INTEGER, 
                        RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )`, 
                    "Tabela Reservas"
                );
                await safeExecute(db, 
                    `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, 
                    "Coluna ITEMS_JSON em Reservas"
                );
                await safeExecute(db, 
                    `ALTER TABLE GRIDE_RESERVAS ADD PRO_COD INTEGER`, 
                    "Coluna PRO_COD em Reservas"
                );

                // 3. Tabela de Logs (Atualizado: USU_COD, PRO_NRFABRICANTE, PRO_COD, Status PT-BR)
                await safeExecute(db, 
                    `CREATE TABLE GRIDE_INVENTARIO_LOG (
                        ID INTEGER NOT NULL PRIMARY KEY, 
                        PRO_COD INTEGER,
                        PRO_NRFABRICANTE VARCHAR(50), 
                        NOME_PRODUTO VARCHAR(200), 
                        USU_COD VARCHAR(20), 
                        USUARIO_NOME VARCHAR(100), 
                        QTD_SISTEMA DECIMAL(15,4), 
                        QTD_CONTADA DECIMAL(15,4), 
                        LOCALIZACAO VARCHAR(100), 
                        STATUS VARCHAR(50), 
                        DIVERGENCIA_MOTIVO VARCHAR(255), 
                        BLOCK_REF VARCHAR(50), 
                        DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )`, 
                    "Tabela Logs"
                );
                await safeExecute(db, `ALTER TABLE GRIDE_INVENTARIO_LOG ADD PRO_COD INTEGER`, "Coluna PRO_COD em Logs");
                await safeExecute(db, `ALTER TABLE GRIDE_INVENTARIO_LOG ADD PRO_NRFABRICANTE VARCHAR(50)`, "Coluna PRO_NRFABRICANTE em Logs");
                
                // 4. Tabela de Tratamento (Atualizado: PRO_COD, PRO_NRFABRICANTE)
                await safeExecute(db, 
                    `CREATE TABLE GRIDE_TRATAMENTO (
                        ID INTEGER NOT NULL PRIMARY KEY, 
                        LOG_ID INTEGER, 
                        PRO_COD INTEGER,
                        PRO_NRFABRICANTE VARCHAR(50), 
                        NOME_PRODUTO VARCHAR(200), 
                        LOCALIZACAO VARCHAR(100), 
                        TIPO_ERRO VARCHAR(50), 
                        DESCRICAO_ERRO VARCHAR(255), 
                        REPORTADO_POR VARCHAR(100), 
                        REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
                        STATUS VARCHAR(20) DEFAULT 'PENDING', 
                        RESOLVIDO_POR VARCHAR(20), 
                        RESOLVIDO_EM TIMESTAMP, 
                        RESOLUCAO_NOTA VARCHAR(255)
                    )`, 
                    "Tabela Tratamento"
                );
                await safeExecute(db, `ALTER TABLE GRIDE_TRATAMENTO ADD PRO_COD INTEGER`, "Coluna PRO_COD em Tratamento");
                await safeExecute(db, `ALTER TABLE GRIDE_TRATAMENTO ADD PRO_NRFABRICANTE VARCHAR(50)`, "Coluna PRO_NRFABRICANTE em Tratamento");

                // 5. Generators e Triggers
                const gens = ['GEN_GRIDE_ENDERECOS_ID', 'GEN_GRIDE_GALPOES_ID', 'GEN_GRIDE_LOG_ID', 'GEN_GRIDE_TRATAMENTO_ID'];
                for (const g of gens) {
                    await safeExecute(db, `CREATE GENERATOR ${g}`, `Generator ${g}`);
                }

                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`, "Trigger Endereços");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`, "Trigger Galpões");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`, "Trigger Logs");
                await safeExecute(db, `CREATE TRIGGER TR_GRIDE_TRATAMENTO FOR GRIDE_TRATAMENTO ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_TRATAMENTO_ID, 1); END`, "Trigger Tratamento");

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

// --- ROTAS DA API ---

// 1. Identificação do Usuário (Query via USU_COD)
app.get('/user-name/:id', (req, res) => {
    const { id } = req.params;
    if (id === '9999') return res.json({ name: 'Gestor de Teste' });
    if (id === '8888') return res.json({ name: 'Colaborador Teste' });
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        // Alterado para USU_COD
        db.query(`SELECT USU_NOME FROM USUARIOS WHERE USU_COD = ? AND USU_ATIVO = 'S'`, [id], (err, result) => {
            db.detach();
            if (!err && result.length > 0) res.json({ name: safeString(result[0].USU_NOME) });
            else res.status(404).json({ error: 'Usuário não encontrado' });
        });
    });
});

// 2. Login (Query via USU_COD)
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

// 3. Lista de Usuários (Map USU_COD -> id)
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

// 4. Categorias (Mantido, não usa tabelas de usuário/log)
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

// 5. Blocos (Listagem Principal)
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
        
        // Buscar Reservas usando a nova estrutura (USU_COD, PRO_COD no BLOCK_ID)
        db.query('SELECT BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (errRes, reservations) => {
            const lockMap = new Map();
            if (!errRes && reservations) {
                reservations.forEach(r => lockMap.set(safeString(r.BLOCK_ID), { 
                    userId: safeString(r.USU_COD), // Mapeia USU_COD -> userId
                    userName: safeString(r.USER_NAME), 
                    timestamp: r.RESERVED_AT 
                }));
            }

            // Buscar Tratamento usando PRO_NRFABRICANTE (SKU)
            db.query("SELECT PRO_NRFABRICANTE FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (errTreat, treatments) => {
                const treatmentSet = new Set();
                if (!errTreat && treatments) treatments.forEach(t => treatmentSet.add(safeString(t.PRO_NRFABRICANTE)));

                // Query Principal em PRODUTOS
                let sql = `SELECT FIRST ? SKIP ? P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S'`;
                const params = [limit * 20, skip];

                if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
                if (gr_cod !== null) { sql += ` AND TRIM(P.GR_COD) = ?`; params.push(gr_cod); }
                if (sg_cod !== null) { sql += ` AND TRIM(P.SG_COD) = ?`; params.push(sg_cod); }
                if (location) { sql += ` AND P.LOCALIZACAO STARTING WITH ?`; params.push(location); }

                sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_COD`;

                db.query(sql, params, (errProd, products) => {
                    db.detach();
                    if (errProd) return res.status(500).json({ error: errProd.message });
                    
                    const groups = new Map();
                    products.forEach(p => {
                        // Lógica de Agrupamento por Similar ou ID
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const sku = safeString(p.PRO_NRFABRICANTE); // Mapeia PRO_NRFABRICANTE -> sku na lógica interna
                        
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD), // O 'id' do item é o PRO_COD
                            db_pro_cod: p.PRO_COD, 
                            name: safeString(p.PRO_DESCRI), 
                            ref: sku, // Frontend espera 'ref' ou 'sku'
                            brand: `MARCA ${p.MAR_COD}`, 
                            balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                            location: 'GERAL', 
                            inTreatment: treatmentSet.has(sku)
                        });
                    });
                    
                    const blocks = [];
                    groups.forEach((items, key) => {
                        const isLocked = lockMap.get(key);
                        blocks.push({
                            id: key, 
                            parentRef: items[0].ref || items[0].name, 
                            location: items[0].location, 
                            status: isLocked ? 'progress' : 'pending', // Status visual (inglês)
                            date: 'Hoje', 
                            items: items, 
                            lockedBy: isLocked
                        });
                    });
                    res.json(blocks.slice(0, limit));
                });
            });
        });
    });
});

// 6. Blocos Reservados (Pelo Usuário)
app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params; // userId aqui é o USU_COD vindo do front
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        // Query com USU_COD
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
                                // Mapeia status do JSON (que pode estar em EN ou PT) para EN no frontend
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

                const sql = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S' AND (TRIM(P.PRO_COD_SIMILAR) IN (${idsList}) OR (P.PRO_COD_SIMILAR IS NULL AND TRIM(P.PRO_COD) IN (${idsList})))`;
                
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
                            id: safeString(p.PRO_COD).trim(), 
                            db_pro_cod: p.PRO_COD, 
                            name: safeString(p.PRO_DESCRI), 
                            ref: sku, 
                            brand: `MARCA ${p.MAR_COD}`, 
                            balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                            location: 'GERAL', 
                            inTreatment: treatmentSet.has(sku),
                            status: savedProgress?.status || 'pending', 
                            countedQty: savedProgress?.countedQty || 0, 
                            divergenceReason: savedProgress?.divergenceReason || '', 
                            lastCount: savedProgress?.lastCount || null
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

// 7. Reservar Bloco
app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body; // user_id = USU_COD
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        // Verifica tratamento (PRO_NRFABRICANTE)
        db.query(`SELECT 1 FROM GRIDE_TRATAMENTO WHERE PRO_NRFABRICANTE IN (SELECT PRO_NRFABRICANTE FROM PRODUTOS WHERE PRO_COD = ? OR PRO_COD_SIMILAR = ?) AND STATUS = 'PENDING'`, [block_id, block_id], (errT, treatResult) => {
             if (!errT && treatResult && treatResult.length > 0) {
                 db.detach();
                 return res.json({ success: false, message: 'Item em tratamento pendente.' });
             }

             // Verifica reserva
             db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (errR, result) => {
                if (errR) { db.detach(); return res.status(500).json({ success: false, message: errR.message }); }
                if (result && result.length > 0) { 
                    db.detach(); 
                    return res.json({ success: false, message: `Bloco já reservado por ${safeString(result[0].USER_NAME)}` }); 
                }
                
                // Tenta converter block_id para inteiro para salvar em PRO_COD (se for um ID numérico)
                const proCodVal = isNaN(parseInt(block_id)) ? 0 : parseInt(block_id);

                db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, PRO_COD, RESERVED_AT, ITEMS_JSON) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)', [block_id, user_id, user_name, proCodVal], (errIns) => {
                    db.detach();
                    if (errIns) return res.status(500).json({ success: false, message: 'Erro ao reservar: ' + errIns.message });
                    res.json({ success: true });
                });
            });
        });
    });
});

// 8. Atualizar Progresso
app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    // Traduz status EN -> PT antes de salvar no BLOB
    const dbItems = items.map(item => ({
        ...item,
        status: TO_DB_STATUS[item.status] || item.status // Salva 'Contado' ao invés de 'counted'
    }));

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

// 9. Liberar Bloco
app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => { db.detach(); res.json({ success: true }); });
    });
});

// 10. Finalizar Bloco (CRUCIAL: PRO_COD e STATUS PT)
app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items, parent_ref } = req.body; 
    // user_id aqui é o USU_COD vindo do front
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }

            try {
                const batchId = Date.now().toString();
                const uniqueBlockRef = `${parent_ref || 'BLOCO'}||${batchId}`;

                for (const item of items) {
                    // 1. Busca PRO_COD real baseado no SKU (PRO_NRFABRICANTE)
                    const rows = await new Promise((resolve, reject) => {
                        transaction.query('SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?', [item.ref], (err, res) => {
                            if (err) reject(err); else resolve(res);
                        });
                    });

                    let realProCod = 0;
                    if (rows && rows.length > 0) {
                        realProCod = rows[0].PRO_COD;
                    } else if (item.db_pro_cod) {
                        realProCod = item.db_pro_cod;
                    }

                    // 2. Prepara dados para inserção
                    const qtdContada = item.countedQty !== undefined ? item.countedQty : 0;
                    const statusEN = item.status || 'pending';
                    const statusPT = TO_DB_STATUS[statusEN] || statusEN; 
                    const localizacao = (item.lastCount && item.lastCount.location) ? item.lastCount.location : (item.location || 'GERAL');
                    const motivo = item.divergenceReason || '';

                    // 3. Insert Log
                    const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (
                        PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, 
                        QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, 
                        BLOCK_REF, DATA_HORA
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING ID`;
                    
                    const resultLog = await new Promise((resolve, reject) => {
                        transaction.query(sqlLog, [
                            realProCod, item.ref, item.name, user_id, user_name,
                            item.balance, qtdContada, localizacao, statusPT, motivo, uniqueBlockRef
                        ], (err, res) => {
                            if (err) reject(err); else resolve(res);
                        });
                    });
                    
                    const logId = resultLog.ID;

                    // 4. Update Saldo Produto
                    const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?`;
                    await new Promise((resolve) => {
                        transaction.query(sqlUpdate, [qtdContada, realProCod], (err) => {
                            if (err) console.warn("Update stock failed for PRO_COD " + realProCod);
                            resolve();
                        });
                    });

                    // 5. Tratamento se necessário (Including 'issue')
                    if (statusEN === 'not_located' || statusEN === 'divergence_info' || statusEN === 'issue') {
                        const sqlTreat = `INSERT INTO GRIDE_TRATAMENTO (
                            LOG_ID, PRO_COD, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, 
                            TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, STATUS
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`;
                        
                        await new Promise((resolve, reject) => {
                            transaction.query(sqlTreat, [
                                logId, realProCod, item.ref, item.name, localizacao, 
                                statusPT, motivo || 'Erro reportado', user_name
                            ], (err) => {
                                if (err) reject(err); else resolve();
                            });
                        });
                    }
                }

                // Remove Reserva
                await new Promise((resolve, reject) => {
                    transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });

                transaction.commit((err) => {
                    db.detach();
                    if (err) return res.status(500).json({ error: 'Commit Error' });
                    res.json({ success: true });
                });

            } catch (processError) {
                transaction.rollback();
                db.detach();
                console.error(processError);
                return res.status(500).json({ error: 'Erro Processamento em Lote: ' + processError.message });
            }
        });
    });
});

// 11. Histórico (Atualizado com JOIN MARCAS)
app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 300; 
    const skip = (page - 1) * limit;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        const sql = `
            SELECT FIRST ? SKIP ? 
            L.ID, L.BLOCK_REF, L.DATA_HORA, L.USUARIO_NOME, L.QTD_CONTADA, L.LOCALIZACAO, 
            L.PRO_NRFABRICANTE as SKU, 
            L.NOME_PRODUTO,
            L.STATUS, 
            T.STATUS as TRATAMENTO_STATUS, 
            P.PRO_COD_SIMILAR, P.PRO_DESCRI as PROD_DESC_ATUAL, 
            M.MAR_DESCRI as MARCA_NOME 
            FROM GRIDE_INVENTARIO_LOG L 
            LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID 
            LEFT JOIN PRODUTOS P ON P.PRO_COD = L.PRO_COD 
            LEFT JOIN MARCAS M ON M.MAR_COD = P.MAR_COD
            ORDER BY L.DATA_HORA DESC
        `;
        db.query(sql, [limit, skip], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            // Mapeia status PT -> EN para o frontend
            const mapped = result.map(r => ({
                ...r,
                STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || 'completed' // fallback
            }));
            res.json(mapped);
        });
    });
});

// 12. Tratamento (Alias para manter contrato)
app.get('/treatment-items', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT ID, PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, REPORTADO_EM, STATUS FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING' ORDER BY REPORTADO_EM DESC`, [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({ 
                id: r.ID, 
                sku: safeString(r.PRO_NRFABRICANTE), 
                name: safeString(r.NOME_PRODUTO), 
                location: safeString(r.LOCALIZACAO), 
                issueType: FROM_DB_STATUS[safeString(r.TIPO_ERRO)] || 'issue', 
                description: safeString(r.DESCRICAO_ERRO), 
                reportedBy: safeString(r.REPORTADO_POR), 
                reportedAt: r.REPORTADO_EM, 
                status: safeString(r.STATUS) 
            })) : []);
        });
    });
});

// 13. Histórico Produto (Por SKU/Ref)
app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT L.DATA_HORA, L.USUARIO_NOME, L.QTD_SISTEMA, L.QTD_CONTADA, L.STATUS, L.LOCALIZACAO FROM GRIDE_INVENTARIO_LOG L WHERE L.PRO_NRFABRICANTE = ? ORDER BY L.DATA_HORA DESC`, [sku], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({
                ...r,
                STATUS: FROM_DB_STATUS[safeString(r.STATUS)] || 'completed'
            })));
        });
    });
});

// 14. Endereços e Galpões
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

// Rotas Extras para AddressManagerScreen (Adicionadas agora)
app.post('/update-address', (req, res) => {
    const { id, codigo, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('UPDATE GRIDE_ENDERECOS SET CODIGO = ?, DESCRICAO = ? WHERE ID = ?', [codigo, descricao, id], (err) => {
            db.detach();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/delete-address', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('DELETE FROM GRIDE_ENDERECOS WHERE ID = ?', [id], (err) => {
            db.detach();
            if (err) return res.status(500).json({ success: false, message: err.message });
            res.json({ success: true });
        });
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

// START SERVER SEQUENCE
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
