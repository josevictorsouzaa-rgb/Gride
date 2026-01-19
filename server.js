
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

// ... (Restante das rotas de login, users, categories, blocks mantidas iguais, omitidas para brevidade até a parte alterada) ...
// (Mantenha todo o código existente de login, users, categories, blocks, reserved-blocks)

// --- ROTAS ALTERADAS PARA O AUDIT TRAIL ---

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
                // Primeiro buscamos os itens que compõem este bloco
                const sqlItems = `
                    SELECT PRO_COD, PRO_NRFABRICANTE, PRO_DESCRI, PRO_EST_ATUAL, PRO_PRATELEIRA 
                    FROM PRODUTOS 
                    WHERE PRO_ATIVO = 'S' AND (PRO_COD = ? OR PRO_COD_SIMILAR = ?)
                `;
                // block_id pode ser um PRO_COD ou um PRO_COD_SIMILAR
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
                    
                    // 1. Log
                    await new Promise((resolve, reject) => {
                        transaction.query(
                            `INSERT INTO GRIDE_INVENTARIO_LOG (PRO_NRFABRICANTE, NOME_PRODUTO, USU_COD, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, BLOCK_REF, DATA_HORA, PRO_COD) 
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, (SELECT FIRST 1 PRO_COD FROM PRODUTOS WHERE PRO_NRFABRICANTE = ?))`,
                            [item.ref, item.name, user_id, user_name, item.balance, qtd, item.lastCount?.location || 'Geral', statusDB, item.divergenceReason || '', uniqueRef, item.ref],
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

app.post('/update-count', (req, res) => {
    const { logId, newQty, oldQty, user_name, user_id, sku } = req.body;
    Firebird.attach(options, (err, db) => {
        if(err) return res.json({success:false});
        
        // RECUPERAR DADOS DO LOG ORIGINAL PARA MANTER CONSISTÊNCIA
        db.query('SELECT * FROM GRIDE_INVENTARIO_LOG WHERE ID = ?', [logId], (err, rows) => {
            if(err || !rows || rows.length === 0) {
                db.detach();
                return res.json({success: false, message: 'Log original não encontrado'});
            }
            
            const original = rows[0];
            const diff = newQty - oldQty;
            const motivo = `Ajuste pós-conclusão: ${oldQty} -> ${newQty} (${diff > 0 ? '+' : ''}${diff})`;

            // INSERIR NOVO LOG DE EDIÇÃO (PRESERVANDO O HISTÓRICO)
            // Status fixo como 'EDIÇÃO'
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
                original.QTD_SISTEMA, // Mantém a qtd do sistema original como referência
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

                // ATUALIZAR ESTOQUE DO PRODUTO (JÁ QUE FOI UMA EDIÇÃO DE SALDO)
                db.query('UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?', [newQty, original.PRO_COD], () => {
                    db.detach();
                    res.json({success: true});
                });
            });
        });
    });
});

// NOVA ROTA: HISTÓRICO ESPECÍFICO DO PRODUTO (Timeline)
app.get('/product-history/:sku', (req, res) => {
    const { sku } = req.params;
    Firebird.attach(options, (err, db) => {
        if (err) return res.json([]);
        // Busca logs onde o SKU (PRO_NRFABRICANTE) coincide
        // Ordena do mais recente para o mais antigo
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

// ... (Restante do arquivo permanece igual: update-reservation-progress, getHistory geral, tratamento, enderecos, etc.) ...
// Apenas garanta que o arquivo termine com startServer()

// ... (Códigos mantidos omitidos) ...

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
