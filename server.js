
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

// CORREÇÃO CRÍTICA: Conversão robusta de BLOB para String JSON
const blobToString = (blob) => {
    if (blob === null || blob === undefined) return null;
    
    // Se já for string
    if (typeof blob === 'string') return blob;
    
    // Se for Buffer
    if (Buffer.isBuffer(blob)) return blob.toString('utf8');
    
    // Se for Array de Bytes (Uint8Array ou similar)
    if (Array.isArray(blob) || (blob.buffer && blob.length)) {
        return Buffer.from(blob).toString('utf8');
    }
    
    // Fallback para conversão direta
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
                // Tabelas Principais (CREATE IF NOT EXISTS lógica via safeExecute)
                await safeExecute(db, `CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`, "Tabela Endereços");
                await safeExecute(db, `CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`, "Tabela Galpões");
                await safeExecute(db, `CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USU_COD VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), PRO_COD INTEGER, RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Reservas");
                await safeExecute(db, `ALTER TABLE GRIDE_RESERVAS ADD ITEMS_JSON BLOB SUB_TYPE TEXT`, "Coluna ITEMS_JSON em Reservas");
                await safeExecute(db, `CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), USU_COD VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(50), DIVERGENCIA_MOTIVO VARCHAR(255), BLOCK_REF VARCHAR(50), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`, "Tabela Logs");
                await safeExecute(db, `CREATE TABLE GRIDE_CONTAS_FINALIZADAS (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), PRO_COD INTEGER, QTD_FINAL DECIMAL(15,4), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP, USUARIO_NOME VARCHAR(100), STATUS VARCHAR(20), LOG_ORIGEM_ID INTEGER)`, "Tabela Contas Finalizadas");
                await safeExecute(db, `CREATE TABLE GRIDE_TRATAMENTO (ID INTEGER NOT NULL PRIMARY KEY, LOG_ID INTEGER, PRO_COD INTEGER, PRO_NRFABRICANTE VARCHAR(50), NOME_PRODUTO VARCHAR(200), LOCALIZACAO VARCHAR(100), TIPO_ERRO VARCHAR(50), DESCRICAO_ERRO VARCHAR(255), REPORTADO_POR VARCHAR(100), REPORTADO_EM TIMESTAMP DEFAULT CURRENT_TIMESTAMP, STATUS VARCHAR(20) DEFAULT 'PENDING', RESOLVIDO_POR VARCHAR(20), RESOLVIDO_EM TIMESTAMP, RESOLUCAO_NOTA VARCHAR(255))`, "Tabela Tratamento");

                // Generators & Triggers (Simplificado para manter foco)
                const gens = ['GEN_GRIDE_ENDERECOS_ID', 'GEN_GRIDE_GALPOES_ID', 'GEN_GRIDE_LOG_ID', 'GEN_GRIDE_TRATAMENTO_ID', 'GEN_GRIDE_CONTAS_FIN_ID'];
                for (const g of gens) await safeExecute(db, `CREATE GENERATOR ${g}`, `Generator ${g}`);
                
                // (Triggers omitidas para brevidade, assumindo já criadas)

                console.log(">>> [INIT] Banco de dados padronizado.");
            } catch (e) { console.error(">>> [INIT ERROR]", e); } 
            finally { db.detach(); resolve(); }
        });
    });
};

// --- ROTAS ESSENCIAIS ---

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
                    if (jsonStr && jsonStr.trim().length > 0) {
                        const parsed = JSON.parse(jsonStr);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            items = parsed;
                            loadedFromSnapshot = true;
                            // console.log(`[DEBUG] Bloco ${r.BLOCK_ID} carregado do JSON (${items.length} itens)`);
                        }
                    }
                } catch(e){ console.error("JSON Parse Error:", e); }

                if (!loadedFromSnapshot) {
                    const blockId = safeString(r.BLOCK_ID);
                    // Fallback: Busca do cadastro original
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
                        const refToShow = parent ? parent.ref : items[0].ref;
                        parentRefDisplay = `REF PAI: ${refToShow}`;
                    }

                    blocks.push({
                        id: safeString(r.BLOCK_ID),
                        parentRef: parentRefDisplay,
                        location: items[0].location,
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

app.post('/update-reservation-progress', (req, res) => {
    const { block_id, items } = req.body;
    const jsonStr = JSON.stringify(items);
    
    Firebird.attach(options, (err, db) => {
        if(err) return res.status(500).json({success:false});
        
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            if(err) { db.detach(); return res.json({success:false}); }

            // Atualiza BLOB usando parâmetros
            transaction.query('UPDATE GRIDE_RESERVAS SET ITEMS_JSON = ? WHERE BLOCK_ID = ?', [jsonStr, block_id], (err, result) => {
                if(err) {
                    console.error("Erro Update Blob:", err);
                    transaction.rollback();
                    db.detach();
                    return res.json({success:false});
                }

                transaction.commit((err) => {
                    db.detach();
                    res.json({success: !err});
                });
            });
        });
    });
});

// Outras rotas permanecem iguais (login, blocks, finalize, etc)...
// Mantendo o código enxuto aqui, assumindo que as outras rotas do server.js anterior
// estão presentes no arquivo final. (Login, Blocks, History, etc)

// ... (Restante do código do servidor igual ao anterior)

// --- ROTAS ADICIONAIS NECESSÁRIAS ---
app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, transaction) => {
            try {
                await new Promise((resolve, reject) => {
                    transaction.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USU_COD, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', 
                    [block_id, user_id, user_name], (err) => err ? reject(err) : resolve());
                });
                transaction.commit((err) => { db.detach(); res.json({ success: !err }); });
            } catch(e) { transaction.rollback(); db.detach(); res.json({ success: false }); }
        });
    });
});

app.post('/release-block', (req, res) => {
    const { block_id } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        db.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => {
            db.detach();
            res.json({success: !err});
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
                    const statusDB = item.status === 'not_located' ? 'Não Localizado' : (item.status === 'divergence_info' ? 'Divergência' : 'Contado');
                    const qtd = item.countedQty || 0;
                    const reason = item.divergenceReason || '';
                    
                    // Log e Atualizações (Lógica resumida igual anterior)
                    await new Promise((resolve) => {
                        transaction.query(
                            `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA, PRO_COD) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, (SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?))`,
                            [item.ref, item.name, user_id, user_name, item.balance, qtd, item.lastCount?.location || 'Geral', statusDB, reason, uniqueRef, item.ref],
                            () => resolve()
                        );
                    });

                    if (statusDB === 'Divergência' || statusDB === 'Não Localizado') {
                        await new Promise((resolve) => transaction.query(`INSERT INTO GRIDE_TRATAMENTO (PRO_NRFABRICANTE, NOME_PRODUTO, LOCALIZACAO, TIPO_ERRO, DESCRICAO_ERRO, REPORTADO_POR, STATUS) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')`, [item.ref, item.name, item.lastCount?.location || 'Geral', statusDB, reason, user_name], () => resolve()));
                    }

                    if (statusDB === 'Contado') {
                        await new Promise((resolve) => transaction.query(`UPDATE PRODUTOS SET PRO_EST_ATUAL = ?, PRO_PRATELEIRA = ? WHERE PRO_NRFABRICANTE = ?`, [qtd, item.lastCount?.location || 'Geral', item.ref], () => resolve()));
                    }
                }

                await new Promise((resolve) => transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], () => resolve()));
                transaction.commit((err) => { db.detach(); res.json({success: !err}); });
            } catch(e) { transaction.rollback(); db.detach(); res.json({success: false}); }
        });
    });
});

app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        db.query(`SELECT FIRST 100 * FROM GRIDE_INVENTARIO_LOG ORDER BY DATA_HORA DESC`, [], (err, rows) => {
            db.detach();
            res.json(rows || []);
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor GRIDE (Correção Snapshot) rodando em http://localhost:${port}`);
});
