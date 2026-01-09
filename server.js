
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
        
        // Helper para rodar query silenciosamente (ignora erro se tabela ja existe)
        const runQuery = (sql) => {
            db.query(sql, [], (err) => {
                if (err && !err.message.includes('already exists') && !err.message.includes('unsuccessful metadata update')) {
                    // console.log('Info SQL:', err.message); // Opcional: logar erros reais
                }
            });
        };

        // 1. Tabela de Endereços WMS
        runQuery(`
            CREATE TABLE GRIDE_ENDERECOS (
                ID INTEGER NOT NULL PRIMARY KEY,
                CODIGO VARCHAR(50) NOT NULL,
                DESCRICAO VARCHAR(100),
                TIPO VARCHAR(20),
                PRO_COD VARCHAR(20)
            )
        `);
        
        // 2. Tabela de Galpões
        runQuery(`
            CREATE TABLE GRIDE_GALPOES (
                ID INTEGER NOT NULL PRIMARY KEY,
                SIGLA VARCHAR(10) NOT NULL,
                DESCRICAO VARCHAR(50)
            )
        `);

        // 3. Tabela de Reservas (Locks temporários)
        // BLOCK_REF: Referencia o ID do Bloco (Similar ou Pro_Cod raiz)
        runQuery(`
            CREATE TABLE GRIDE_RESERVAS (
                BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY,
                USER_ID VARCHAR(20) NOT NULL,
                USER_NAME VARCHAR(100),
                RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Log de Inventário (Histórico)
        runQuery(`
            CREATE TABLE GRIDE_INVENTARIO_LOG (
                ID INTEGER NOT NULL PRIMARY KEY,
                SKU VARCHAR(50),
                NOME_PRODUTO VARCHAR(200),
                USUARIO_ID VARCHAR(20),
                USUARIO_NOME VARCHAR(100),
                QTD_SISTEMA DECIMAL(15,4),
                QTD_CONTADA DECIMAL(15,4),
                LOCALIZACAO VARCHAR(100),
                STATUS VARCHAR(20),
                DIVERGENCIA_MOTIVO VARCHAR(255),
                DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Generators & Triggers
        runQuery(`CREATE GENERATOR GEN_GRIDE_ENDERECOS_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_GALPOES_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_LOG_ID`);

        runQuery(`
            CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS
            ACTIVE BEFORE INSERT POSITION 0
            AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END
        `);
        runQuery(`
            CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES
            ACTIVE BEFORE INSERT POSITION 0
            AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END
        `);
        runQuery(`
            CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG
            ACTIVE BEFORE INSERT POSITION 0
            AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END
        `);
        
        setTimeout(() => {
            console.log('Database Schema (GRIDE_*) Checked/Created');
            db.detach();
        }, 2000);
    });
};
setTimeout(initDb, 3000);

// Helper seguro para strings
const safeString = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && Buffer.isBuffer(value)) return value.toString().trim();
    return String(value).trim();
};

// --- ROTAS DE AUTENTICAÇÃO E USUÁRIOS (MANTIDAS) ---
app.get('/user-name/:id', (req, res) => { /* Mantido igual */
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

app.post('/login', (req, res) => { /* Mantido igual, apenas encurtado para foco */
    const { usuario_id, senha } = req.body;
    // Mock Users
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

// --- ROTA DE CATEGORIAS (MANTIDA) ---
app.get('/categories', (req, res) => { /* Mantido */
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (err, groups) => {
            if (err) { db.detach(); return res.status(500).json([]); }
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (err, subgroups) => {
                db.detach();
                if (err) return res.status(500).json([]);
                const tree = groups.map(g => ({
                    id: g.GR_COD.toString(),
                    label: safeString(g.GR_DESCRI),
                    icon: 'inventory_2',
                    count: 0,
                    subcategories: subgroups.filter(s => s.GR_COD === g.GR_COD).map(s => ({
                        id: s.SG_COD.toString(), name: safeString(s.SG_DESCRI), count: 0, icon: 'circle'
                    }))
                }));
                res.json(tree);
            });
        });
    });
});

// ==========================================================================
// --- CORE DO SISTEMA: CARREGAMENTO E AGRUPAMENTO DE BLOCOS ---
// ==========================================================================

app.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Carrega em lotes maiores
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });

        // 1. Carregar Reservas Ativas
        db.query('SELECT * FROM GRIDE_RESERVAS', [], (err, reservations) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Reservas' }); }
            
            const lockMap = new Map();
            reservations.forEach(r => {
                lockMap.set(safeString(r.BLOCK_ID), {
                    userId: safeString(r.USER_ID),
                    userName: safeString(r.USER_NAME),
                    timestamp: r.RESERVED_AT
                });
            });

            // 2. Carregar Produtos Ativos
            let sql = `
                SELECT FIRST ? SKIP ?
                    P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_COD_SIMILAR, 
                    P.PRO_NRFABRICANTE, P.GR_COD, P.SG_COD, P.MAR_COD
                FROM PRODUTOS P
                WHERE P.PRO_ATIVO = 'S'
            `;
            const params = [limit * 5, skip]; // Carrega 5x mais itens para garantir agrupamento decente no backend

            if (search) {
                sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`;
                params.push(search);
                params.push(search);
            }
            
            sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_DESCRI`;

            db.query(sql, params, (err, products) => {
                db.detach();
                if (err) return res.status(500).json({ error: err.message });

                // 3. Agrupamento por Similaridade (Lógica de Negócio)
                const groups = new Map();

                products.forEach(p => {
                    const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
                    
                    if (!groups.has(similarId)) {
                        groups.set(similarId, []);
                    }
                    
                    groups.get(similarId).push({
                        id: safeString(p.PRO_COD),
                        db_pro_cod: p.PRO_COD, // ID real para update
                        name: safeString(p.PRO_DESCRI),
                        ref: safeString(p.PRO_NRFABRICANTE),
                        balance: parseFloat(p.PRO_EST_ATUAL || 0),
                        brand: 'GENERICO', // Pode-se fazer um join com MARCAS se necessário
                        location: 'GERAL', // Idealmente viria de PRO_LOCAL ou da tabela GRIDE_ENDERECOS
                        lastCount: null
                    });
                });

                // 4. Formatar Blocos para o Frontend
                const blocks = [];
                let localIdCounter = skip; // Apenas para ID visual se precisar

                groups.forEach((items, key) => {
                    const firstItem = items[0];
                    const blockId = key; // Use o Similar ID como ID do Bloco
                    const isLocked = lockMap.get(blockId);

                    blocks.push({
                        id: blockId, // ID do Bloco = ID do Similar
                        parentRef: items.length > 1 ? `Agrupamento #${blockId}` : firstItem.name,
                        location: firstItem.location,
                        status: isLocked ? 'progress' : 'pending',
                        date: 'Hoje',
                        subcategory: 'Geral',
                        items: items,
                        lockedBy: isLocked ? {
                            userId: isLocked.userId,
                            userName: isLocked.userName,
                            avatar: '', // Pode adicionar URL da foto se tiver
                            timestamp: isLocked.timestamp
                        } : null
                    });
                });

                // Retorna apenas a quantidade solicitada após agrupar
                res.json(blocks.slice(0, limit));
            });
        });
    });
});

// --- SISTEMA DE RESERVAS (LOCKING) ---

app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });

        // Verifica se já está reservado
        db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, result) => {
            if (result && result.length > 0) {
                db.detach();
                const holder = safeString(result[0].USER_NAME);
                // Se for o mesmo usuário, ok (refresh). Se for outro, erro.
                return res.json({ success: false, message: `Bloco já reservado por ${holder}` });
            }

            db.query(
                'INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                [block_id, user_id, user_name],
                (err) => {
                    db.detach();
                    if (err) return res.status(500).json({ success: false, error: err.message });
                    res.json({ success: true });
                }
            );
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

// --- FINALIZAÇÃO DE CONTAGEM (UPDATE PRODUTOS) ---

app.post('/finalize-block', (req, res) => {
    // Recebe um array de itens contados
    // { block_id, user_id, user_name, items: [{ pro_cod, qtd_contada, ... }] }
    const { block_id, user_id, user_name, items } = req.body;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });

        // Usamos uma transação para garantir atomicidade
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }

            const promises = items.map(item => {
                return new Promise((resolve, reject) => {
                    // 1. Update no PRODUTOS (Estoque Atual)
                    const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?`;
                    transaction.query(sqlUpdate, [item.qtd_contada, item.pro_cod], (err) => {
                        if (err) { reject(err); return; }

                        // 2. Insert no Log
                        const sqlLog = `
                            INSERT INTO GRIDE_INVENTARIO_LOG 
                            (SKU, NOME_PRODUTO, USUARIO_ID, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `;
                        // Dados do item podem vir incompletos do frontend, ideal seria buscar do BD antes, 
                        // mas para performance usaremos o que veio ou defaults.
                        const paramsLog = [
                            item.sku || String(item.pro_cod),
                            item.nome || 'Produto Atualizado',
                            user_id,
                            user_name,
                            item.qtd_sistema || 0,
                            item.qtd_contada,
                            item.localizacao || 'GERAL',
                            'completed', // Status
                            '' // Motivo
                        ];

                        transaction.query(sqlLog, paramsLog, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            });

            Promise.all(promises)
                .then(() => {
                    // 3. Remove Reserva
                    transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => {
                        if (err) {
                            transaction.rollback();
                            db.detach();
                            return res.status(500).json({ error: 'Erro ao remover reserva' });
                        }
                        
                        transaction.commit((err) => {
                            db.detach();
                            if (err) return res.status(500).json({ error: 'Erro Commit' });
                            res.json({ success: true });
                        });
                    });
                })
                .catch(err => {
                    transaction.rollback();
                    db.detach();
                    res.status(500).json({ error: 'Erro ao processar itens: ' + err.message });
                });
        });
    });
});

// --- GERENCIAMENTO DE ENDEREÇOS (EDICAO/EXCLUSAO) ---

app.post('/update-address', (req, res) => {
    const { id, codigo, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'Erro DB'});
        // Se houver necessidade de atualizar produtos vinculados a este endereço:
        // Ex: UPDATE PRODUTOS SET LOCAL = ? WHERE LOCAL = (SELECT CODIGO FROM GRIDE_ENDERECOS WHERE ID = ?)
        // Por enquanto, atualizamos apenas a definição do endereço.
        
        db.query('UPDATE GRIDE_ENDERECOS SET CODIGO = ?, DESCRICAO = ? WHERE ID = ?', [codigo, descricao, id], (err) => {
            db.detach();
            if (err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
    });
});

app.post('/delete-address', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'Erro DB'});
        db.query('DELETE FROM GRIDE_ENDERECOS WHERE ID = ?', [id], (err) => {
            db.detach();
            if (err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        });
    });
});

// --- REAPROVEITAMENTO DAS ROTAS EXISTENTES ---
app.get('/addresses', (req, res) => { /* Mantido */
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT FIRST 2000 ID, CODIGO, DESCRICAO, TIPO, PRO_COD FROM GRIDE_ENDERECOS ORDER BY CODIGO', [], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({
                id: r.ID, code: safeString(r.CODIGO), description: safeString(r.DESCRICAO), type: safeString(r.TIPO) || 'shelf'
            })));
        });
    });
});

app.post('/save-addresses', (req, res) => { /* Mantido Batch Insert */
    const addresses = req.body;
    if (!Array.isArray(addresses)) return res.status(400).json({error: 'Expected array'});
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        let processed = 0;
        const processNext = (idx) => {
            if (idx >= addresses.length) { db.detach(); return res.json({ success: true, count: processed }); }
            const item = addresses[idx];
            db.query('SELECT ID FROM GRIDE_ENDERECOS WHERE CODIGO = ?', [item.code], (err, exists) => {
                if (!exists || exists.length === 0) {
                     db.query('INSERT INTO GRIDE_ENDERECOS (CODIGO, DESCRICAO, TIPO) VALUES (?, ?, ?)', [item.code, item.description, item.type], () => {
                         processed++; processNext(idx + 1);
                     });
                } else { processNext(idx + 1); }
            });
        };
        processNext(0);
    });
});

app.get('/warehouses', (req, res) => { /* Mantido */
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT ID, SIGLA, DESCRICAO FROM GRIDE_GALPOES ORDER BY SIGLA', [], (err, result) => {
            db.detach();
            if (err) return res.json([]);
            res.json(result.map(r => ({ id: r.ID, sigla: safeString(r.SIGLA), descricao: safeString(r.DESCRICAO) })));
        });
    });
});

app.post('/save-warehouse', (req, res) => { /* Mantido */
    const { sigla, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        db.query('SELECT ID FROM GRIDE_GALPOES WHERE SIGLA = ?', [sigla], (err, result) => {
            if (result && result.length > 0) { db.detach(); return res.json({ success: false, message: 'Sigla existe' }); }
            db.query('INSERT INTO GRIDE_GALPOES (SIGLA, DESCRICAO) VALUES (?, ?)', [sigla, descricao], (err) => {
                db.detach();
                res.json({ success: true });
            });
        });
    });
});

app.post('/delete-warehouse', (req, res) => { /* Mantido */
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        db.query('DELETE FROM GRIDE_GALPOES WHERE ID = ?', [id], (err) => {
            db.detach();
            res.json({ success: true });
        });
    });
});

// Mantido endpoint para Log Simples se necessário, mas o principal é o finalize-block
app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        const sql = `SELECT FIRST 200 ID, SKU, NOME_PRODUTO, USUARIO_NOME, QTD_CONTADA, LOCALIZACAO, STATUS, DATA_HORA FROM GRIDE_INVENTARIO_LOG ORDER BY DATA_HORA DESC`;
        db.query(sql, [], (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });
            res.json(result.map(r => ({
                ...r, NOME_PRODUTO: safeString(r.NOME_PRODUTO), USUARIO_NOME: safeString(r.USUARIO_NOME), STATUS: safeString(r.STATUS), LOCALIZACAO: safeString(r.LOCALIZACAO)
            })));
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor GRIDE Firebird rodando em http://localhost:${port}`);
});
