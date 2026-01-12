
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

// --- INIT DB: Create Tables (GRIDE_ Prefix) ---
const initDb = () => {
    Firebird.attach(options, (err, db) => {
        if (err) {
            console.error("Erro ao conectar no DB para Init:", err);
            return;
        }
        
        // Helper para rodar query silenciosamente
        const runQuery = (sql) => {
            db.query(sql, [], (err) => {
                if (err && !err.message.includes('already exists') && !err.message.includes('unsuccessful metadata update')) {
                    // console.log('Info SQL:', err.message); 
                }
            });
        };

        // Tabelas GRIDE...
        runQuery(`CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`);
        runQuery(`CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`);
        
        // ALTERAÇÃO: Adicionando ITEMS_JSON para persistência temporária
        runQuery(`CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USER_ID VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ITEMS_JSON BLOB SUB_TYPE TEXT)`);
        
        runQuery(`CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), NOME_PRODUTO VARCHAR(200), USUARIO_ID VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(20), DIVERGENCIA_MOTIVO VARCHAR(255), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        
        // NOVA TABELA DE TRATAMENTO
        runQuery(`CREATE TABLE GRIDE_TRATAMENTO (
            ID INTEGER NOT NULL PRIMARY KEY,
            LOG_ID INTEGER,
            SKU VARCHAR(50),
            NOME_PRODUTO VARCHAR(200),
            LOCALIZACAO VARCHAR(100),
            TIPO_ERRO VARCHAR(20),
            DESCRICAO_ERRO VARCHAR(255),
            REPORTADO_POR VARCHAR(100),
            REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            STATUS VARCHAR(20) DEFAULT 'PENDING',
            RESOLVIDO_POR VARCHAR(20),
            RESOLVIDO_EM TIMESTAMP,
            RESOLUCAO_NOTA VARCHAR(255)
        )`);

        runQuery(`CREATE GENERATOR GEN_GRIDE_ENDERECOS_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_GALPOES_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_LOG_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_TRATAMENTO_ID`);

        runQuery(`CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`);
        runQuery(`CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`);
        runQuery(`CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`);
        runQuery(`CREATE TRIGGER TR_GRIDE_TRATAMENTO FOR GRIDE_TRATAMENTO ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_TRATAMENTO_ID, 1); END`);
        
        setTimeout(() => {
            console.log('Database Schema (GRIDE_*) Checked/Created');
            db.detach();
        }, 2000);
    });
};
setTimeout(initDb, 3000);

const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && Buffer.isBuffer(value)) return value.toString().trim();
    return String(value).trim();
};

// Helper para converter Blob Text para String
const blobToString = (blob) => {
    if (!blob) return null;
    if (Buffer.isBuffer(blob)) return blob.toString();
    if (typeof blob === 'function') {
        // Em algumas versoes do driver Firebird, blob é uma função stream
        return null; // Simplificação: assumindo driver configurado para buffer ou string
    }
    return String(blob);
};

// --- ROTAS DE AUTENTICAÇÃO E USUÁRIOS ---
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

// --- ROTA DE BLOCOS ---
app.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const gr_cod = req.query.gr_cod ? parseInt(req.query.gr_cod) : null;
    const sg_cod = req.query.sg_cod ? parseInt(req.query.sg_cod) : null;
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        db.query('SELECT BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS', [], (err, reservations) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Reservas' }); }
            const lockMap = new Map();
            reservations.forEach(r => {
                lockMap.set(safeString(r.BLOCK_ID), { userId: safeString(r.USER_ID), userName: safeString(r.USER_NAME), timestamp: r.RESERVED_AT });
            });

            db.query("SELECT SKU FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (err, treatments) => {
                if (err) { db.detach(); return res.status(500).json({ error: 'Erro Tratamento' }); }
                
                const treatmentSet = new Set();
                treatments.forEach(t => treatmentSet.add(safeString(t.SKU)));

                let sql = `
                    SELECT FIRST ? SKIP ? 
                        P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE 
                    FROM PRODUTOS P 
                    WHERE P.PRO_ATIVO = 'S' 
                `;
                
                const bufferLimit = limit * 20; 
                const params = [bufferLimit, skip];

                if (search) { sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`; params.push(search); params.push(search); }
                if (gr_cod) { sql += ` AND P.GR_COD = ?`; params.push(gr_cod); }
                if (sg_cod) { sql += ` AND P.SG_COD = ?`; params.push(sg_cod); }
                sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_COD`;

                db.query(sql, params, (err, products) => {
                    db.detach();
                    if (err) return res.status(500).json({ error: err.message });
                    
                    const groups = new Map();
                    products.forEach(p => {
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const sku = safeString(p.PRO_NRFABRICANTE);
                        
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD),
                            db_pro_cod: p.PRO_COD,
                            name: safeString(p.PRO_DESCRI),
                            ref: sku,
                            brand: `MARCA ${p.MAR_COD}`,
                            balance: parseFloat(p.PRO_EST_ATUAL || 0),
                            location: 'GERAL',
                            lastCount: null,
                            inTreatment: treatmentSet.has(sku)
                        });
                    });
                    
                    const blocks = [];
                    groups.forEach((items, key) => {
                        const blockId = key;
                        const parentItem = items.find(i => i.id === blockId) || items[0];
                        const displayRef = parentItem.ref || parentItem.name;
                        const isLocked = lockMap.get(blockId);
                        
                        blocks.push({
                            id: blockId, 
                            parentRef: displayRef, 
                            location: items[0].location,
                            status: isLocked ? 'progress' : 'pending', 
                            date: 'Hoje', 
                            subcategory: 'Geral', 
                            items: items,
                            lockedBy: isLocked ? { userId: isLocked.userId, userName: isLocked.userName, timestamp: isLocked.timestamp } : null
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
        
        // 1. Busca quais blocos estão reservados e PEGA O JSON SALVO
        db.query('SELECT BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT, ITEMS_JSON FROM GRIDE_RESERVAS WHERE USER_ID = ?', [userId], (err, reservations) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Reservas' }); }
            if (reservations.length === 0) { db.detach(); return res.json([]); }
            
            const lockMap = new Map();
            const blockIds = [];
            const progressMap = new Map(); // Mapa para guardar o progresso salvo no JSON

            reservations.forEach(r => {
                const bId = safeString(r.BLOCK_ID);
                blockIds.push(bId);
                lockMap.set(bId, { userId: safeString(r.USER_ID), userName: safeString(r.USER_NAME), timestamp: r.RESERVED_AT });
                
                // Parse JSON se existir
                const jsonStr = blobToString(r.ITEMS_JSON);
                if (jsonStr) {
                    try {
                        const savedItems = JSON.parse(jsonStr);
                        // Mapeia por SKU para restaurar status
                        if (Array.isArray(savedItems)) {
                            savedItems.forEach(item => {
                                // Chave composta: BlocoID + SKU para garantir unicidade
                                progressMap.set(`${bId}-${item.ref}`, item);
                            });
                        }
                    } catch (e) {
                        console.error("Erro parse JSON items:", e);
                    }
                }
            });
            const idsList = blockIds.map(id => `'${id}'`).join(',');
            
            db.query("SELECT SKU FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING'", [], (err, treatments) => {
                const treatmentSet = new Set();
                if(treatments) treatments.forEach(t => treatmentSet.add(safeString(t.SKU)));

                const sql = `SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_COD_SIMILAR, P.PRO_NRFABRICANTE FROM PRODUTOS P WHERE P.PRO_ATIVO = 'S' AND (P.PRO_COD_SIMILAR IN (${idsList}) OR (P.PRO_COD_SIMILAR IS NULL AND P.PRO_COD IN (${idsList})))`;
                db.query(sql, [], (err, products) => {
                    db.detach();
                    if (err) return res.status(500).json({ error: err.message });
                    const groups = new Map();
                    products.forEach(p => {
                        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                        const sku = safeString(p.PRO_NRFABRICANTE);
                        
                        // Check Progress from GRIDE_RESERVAS JSON (Using Composite Key)
                        const savedProgress = progressMap.get(`${similarId}-${sku}`);
                        
                        if (!groups.has(similarId)) groups.set(similarId, []);
                        groups.get(similarId).push({
                            id: safeString(p.PRO_COD), 
                            db_pro_cod: p.PRO_COD, 
                            name: safeString(p.PRO_DESCRI), 
                            ref: sku, 
                            brand: `MARCA ${p.MAR_COD}`, 
                            balance: parseFloat(p.PRO_EST_ATUAL || 0), 
                            location: 'GERAL', 
                            inTreatment: treatmentSet.has(sku),
                            // Hydrate with SAVED JSON status if available
                            status: savedProgress ? savedProgress.status : 'pending',
                            countedQty: savedProgress ? savedProgress.countedQty : 0,
                            divergenceReason: savedProgress ? savedProgress.divergenceReason : '',
                            lastCount: savedProgress && savedProgress.lastCount ? savedProgress.lastCount : null
                        });
                    });
                    const blocks = [];
                    groups.forEach((items, key) => {
                        const blockId = key;
                        const parentItem = items.find(i => i.id === blockId) || items[0];
                        const displayRef = parentItem.ref || parentItem.name;
                        const isLocked = lockMap.get(blockId);
                        blocks.push({
                            id: blockId, parentRef: displayRef, location: items[0].location,
                            status: isLocked ? 'progress' : 'pending', date: 'Hoje', subcategory: 'Geral', items: items,
                            lockedBy: isLocked ? { userId: isLocked.userId, userName: isLocked.userName, timestamp: isLocked.timestamp } : null
                        });
                    });
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
        const sqlCheckTreat = `SELECT 1 FROM GRIDE_TRATAMENTO WHERE SKU IN (SELECT PRO_NRFABRICANTE FROM PRODUTOS WHERE PRO_COD = ? OR PRO_COD_SIMILAR = ?) AND STATUS = 'PENDING'`;
        
        db.query(sqlCheckTreat, [block_id, block_id], (err, treatResult) => {
             if (treatResult && treatResult.length > 0) {
                 db.detach();
                 return res.json({ success: false, message: 'Item em tratamento pendente.' });
             }

             db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, result) => {
                if (result && result.length > 0) { db.detach(); return res.json({ success: false, message: `Bloco já reservado por ${safeString(result[0].USER_NAME)}` }); }
                db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT, ITEMS_JSON) VALUES (?, ?, ?, CURRENT_TIMESTAMP, NULL)', [block_id, user_id, user_name], (err) => {
                    db.detach();
                    if (err) return res.status(500).json({ success: false });
                    res.json({ success: true });
                });
            });
        });
    });
});

// NOVO ENDPOINT: Atualiza o progresso do bloco na tabela de reservas
app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const jsonStr = JSON.stringify(items);
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        // Update Blob Column
        const sql = 'UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?';
        db.query(sql, [jsonStr, block_id], (err) => {
            db.detach();
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => { db.detach(); res.json({ success: true }); });
    });
});

// ALTERADO: Finalize agora salva tudo de uma vez
app.post('/finalize-block', (req, res) => {
    const { block_id, user_id, user_name, items } = req.body;
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }

            try {
                // Loop por todos os itens contados do bloco
                for (const item of items) {
                    // 1. Inserir LOG
                    const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (SKU, NOME_PRODUTO, USUARIO_ID, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING ID`;
                    
                    // Normaliza valores
                    const qtdContada = item.countedQty !== undefined ? item.countedQty : 0;
                    const status = item.status || 'pending';
                    const localizacao = (item.lastCount && item.lastCount.location) ? item.lastCount.location : (item.location || 'GERAL');
                    const motivo = item.divergenceReason || '';

                    // Executa Log (usando promisify manual ou callback hell, aqui simplificado com await/promise wrapper ficticio se lib suportasse, mas vamos de callback)
                    await new Promise((resolve, reject) => {
                        transaction.query(sqlLog, [item.ref, item.name, user_id, user_name, item.balance, qtdContada, localizacao, status, motivo], (err, result) => {
                            if (err) return reject(err);
                            
                            const logId = result.ID;
                            
                            // 2. Atualizar Estoque Real (PRODUTOS)
                            const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_NRFABRICANTE = ?`;
                            transaction.query(sqlUpdate, [qtdContada, item.ref], (err) => {
                                if (err) console.warn("Update stock failed for SKU " + item.ref);
                                
                                // 3. Se houver divergência, inserir em TRATAMENTO
                                const needsTreatment = status === 'not_located' || status === 'divergence_info';
                                if (needsTreatment) {
                                    const sqlTreat = `INSERT INTO GRIDE_TRATAMENTO (LOG_ID, SKU, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, STATUS) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`;
                                    transaction.query(sqlTreat, [logId, item.ref, item.name, localizacao, status, motivo || 'Erro reportado', user_name], (err) => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                                } else {
                                    resolve();
                                }
                            });
                        });
                    });
                }

                // 4. Remover Reserva
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
                return res.status(500).json({ error: 'Erro Processamento em Lote' });
            }
        });
    });
});

// --- HISTORY ---
app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    // Aumenta o limite para garantir que todos os itens do mesmo bloco venham juntos na query
    const limit = parseInt(req.query.limit) || 300; 
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        const sql = `
            SELECT FIRST ? SKIP ? 
                L.*, 
                T.STATUS as TRATAMENTO_STATUS,
                P.PRO_COD_SIMILAR,
                P.PRO_DESCRI as PROD_DESC_ATUAL,
                P.MAR_COD
            FROM GRIDE_INVENTARIO_LOG L
            LEFT JOIN GRIDE_TRATAMENTO T ON T.LOG_ID = L.ID
            LEFT JOIN PRODUTOS P ON P.PRO_NRFABRICANTE = L.SKU
            ORDER BY L.DATA_HORA DESC
        `;
        db.query(sql, [limit, skip], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result);
        });
    });
});

app.get('/treatment-items', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query(`SELECT ID, SKU, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, REPORTADO_EM, STATUS FROM GRIDE_TRATAMENTO WHERE STATUS = 'PENDING' ORDER BY REPORTADO_EM DESC`, [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({
                id: r.ID,
                sku: safeString(r.SKU),
                name: safeString(r.NOME_PRODUTO),
                location: safeString(r.LOCALIZACAO),
                issueType: safeString(r.TIPO_ERRO),
                description: safeString(r.DESCRICAO_ERRO),
                reportedBy: safeString(r.REPORTADO_POR),
                reportedAt: r.REPORTADO_EM,
                status: safeString(r.STATUS)
            })) : []);
        });
    });
});

app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        const sql = `
            SELECT L.DATA_HORA, L.USUARIO_NOME, L.QTD_SISTEMA, L.QTD_CONTADA, L.STATUS, L.LOCALIZACAO
            FROM GRIDE_INVENTARIO_LOG L
            WHERE L.SKU = ?
            ORDER BY L.DATA_HORA DESC
        `;
        db.query(sql, [sku], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result);
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor GRIDE Firebird rodando em http://localhost:${port}`);
});
