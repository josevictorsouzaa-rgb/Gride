
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

        // Tabelas GRIDE... (Mantidas conforme anterior)
        runQuery(`CREATE TABLE GRIDE_ENDERECOS (ID INTEGER NOT NULL PRIMARY KEY, CODIGO VARCHAR(50) NOT NULL, DESCRICAO VARCHAR(100), TIPO VARCHAR(20), PRO_COD VARCHAR(20))`);
        runQuery(`CREATE TABLE GRIDE_GALPOES (ID INTEGER NOT NULL PRIMARY KEY, SIGLA VARCHAR(10) NOT NULL, DESCRICAO VARCHAR(50))`);
        runQuery(`CREATE TABLE GRIDE_RESERVAS (BLOCK_ID VARCHAR(50) NOT NULL PRIMARY KEY, USER_ID VARCHAR(20) NOT NULL, USER_NAME VARCHAR(100), RESERVED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        runQuery(`CREATE TABLE GRIDE_INVENTARIO_LOG (ID INTEGER NOT NULL PRIMARY KEY, SKU VARCHAR(50), NOME_PRODUTO VARCHAR(200), USUARIO_ID VARCHAR(20), USUARIO_NOME VARCHAR(100), QTD_SISTEMA DECIMAL(15,4), QTD_CONTADA DECIMAL(15,4), LOCALIZACAO VARCHAR(100), STATUS VARCHAR(20), DIVERGENCIA_MOTIVO VARCHAR(255), DATA_HORA TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);

        runQuery(`CREATE GENERATOR GEN_GRIDE_ENDERECOS_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_GALPOES_ID`);
        runQuery(`CREATE GENERATOR GEN_GRIDE_LOG_ID`);

        runQuery(`CREATE TRIGGER TR_GRIDE_ENDERECOS FOR GRIDE_ENDERECOS ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_ENDERECOS_ID, 1); END`);
        runQuery(`CREATE TRIGGER TR_GRIDE_GALPOES FOR GRIDE_GALPOES ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_GALPOES_ID, 1); END`);
        runQuery(`CREATE TRIGGER TR_GRIDE_LOG FOR GRIDE_INVENTARIO_LOG ACTIVE BEFORE INSERT POSITION 0 AS BEGIN IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_GRIDE_LOG_ID, 1); END`);
        
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

// --- ROTA DE CATEGORIAS COM CONTAGEM REAL ---
app.get('/categories', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);

        // 1. Busca Grupos
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (err, groups) => {
            if (err) { db.detach(); return res.status(500).json([]); }

            // 2. Busca Subgrupos
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (err, subgroups) => {
                if (err) { db.detach(); return res.status(500).json([]); }

                // 3. Busca Contagens de Produtos Ativos Agrupados
                const sqlCounts = `
                    SELECT GR_COD, SG_COD, COUNT(*) as TOTAL 
                    FROM PRODUTOS 
                    WHERE PRO_ATIVO = 'S' 
                    GROUP BY GR_COD, SG_COD
                `;
                
                db.query(sqlCounts, [], (err, counts) => {
                    db.detach();
                    if (err) return res.status(500).json([]);

                    // Cria mapa de contagem: "GR-SG" -> Quantidade
                    const countMap = new Map();
                    const groupCountMap = new Map();

                    counts.forEach(row => {
                        const gr = row.GR_COD;
                        const sg = row.SG_COD;
                        const total = row.TOTAL;
                        
                        countMap.set(`${gr}-${sg}`, total);
                        
                        // Soma para o grupo pai
                        const currentGroupTotal = groupCountMap.get(gr) || 0;
                        groupCountMap.set(gr, currentGroupTotal + total);
                    });

                    // Monta a árvore
                    const tree = groups.map(g => {
                        const groupId = g.GR_COD;
                        const groupTotal = groupCountMap.get(groupId) || 0;

                        // Filtra subgrupos deste grupo e mapeia com a contagem real
                        const subs = subgroups
                            .filter(s => s.GR_COD === groupId)
                            .map(s => {
                                const subTotal = countMap.get(`${groupId}-${s.SG_COD}`) || 0;
                                return {
                                    id: s.SG_COD.toString(),
                                    db_id: s.SG_COD,
                                    name: safeString(s.SG_DESCRI),
                                    count: subTotal,
                                    icon: 'circle' // Pode implementar lógica de ícone aqui se desejar
                                };
                            })
                            // Opcional: Filtrar apenas subgrupos com itens? 
                            // .filter(s => s.count > 0); 

                        return {
                            id: groupId.toString(),
                            db_id: groupId,
                            label: safeString(g.GR_DESCRI),
                            icon: 'inventory_2', // Ícone fixo ou mapeado
                            count: groupTotal,
                            subcategories: subs
                        };
                    });

                    // Ordena por quantidade de itens (opcional)
                    // tree.sort((a, b) => b.count - a.count);

                    res.json(tree);
                });
            });
        });
    });
});

// ==========================================================================
// --- CORE DO SISTEMA: BLOCOS ---
// ==========================================================================

// Helper para formatar e agrupar produtos em blocos
const groupProductsToBlocks = (products, lockMap) => {
    const groups = new Map();

    products.forEach(p => {
        const similarId = p.PRO_COD_SIMILAR ? safeString(p.PRO_COD_SIMILAR) : safeString(p.PRO_COD);
        
        if (!groups.has(similarId)) {
            groups.set(similarId, []);
        }
        
        // Tenta ler localizacao do banco se existir, senão 'GERAL'
        const rawLocation = safeString(p.PRO_LOCAL) || 'GERAL';

        groups.get(similarId).push({
            id: safeString(p.PRO_COD),
            db_pro_cod: p.PRO_COD,
            name: safeString(p.PRO_DESCRI),
            ref: safeString(p.PRO_NRFABRICANTE),
            balance: parseFloat(p.PRO_EST_ATUAL || 0),
            brand: 'GENERICO',
            location: rawLocation,
            lastCount: null
        });
    });

    const blocks = [];
    groups.forEach((items, key) => {
        const blockId = key;
        const parentItem = items.find(i => i.id === blockId) || items[0];
        const displayRef = parentItem.ref || 'S/ REF';
        const isLocked = lockMap.get(blockId);

        blocks.push({
            id: blockId,
            parentRef: displayRef,
            location: items[0].location,
            status: isLocked ? 'progress' : 'pending',
            date: 'Hoje',
            subcategory: 'Geral',
            items: items,
            lockedBy: isLocked ? {
                userId: isLocked.userId,
                userName: isLocked.userName,
                timestamp: isLocked.timestamp
            } : null
        });
    });
    return blocks;
};

// Rota Geral de Blocos (Com paginação e filtros)
app.get('/blocks', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const search = req.query.search || '';
    const locationSearch = req.query.location || ''; 
    
    // CONVERSÃO DE TIPOS: Garante que GR_COD e SG_COD sejam inteiros
    const gr_cod = req.query.gr_cod ? parseInt(req.query.gr_cod) : null;
    const sg_cod = req.query.sg_cod ? parseInt(req.query.sg_cod) : null;
    
    // REMOVIDA TRAVA: A trava 'daily_meta' retornava vazio e impedia o carregamento
    // const daily_meta = req.query.daily_meta === 'true';
    // if (daily_meta) { return res.json([]); }

    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });

        // 1. Carregar Reservas
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

            // 2. Query Dinâmica
            // Adicionado PRO_LOCAL na seleção
            let sql = `
                SELECT FIRST ? SKIP ?
                    P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_COD_SIMILAR, 
                    P.PRO_NRFABRICANTE, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_LOCAL
                FROM PRODUTOS P
                WHERE P.PRO_ATIVO = 'S'
            `;
            
            // Carrega 10x o limite para garantir agrupamento correto na visualização
            const params = [limit * 10, skip];

            if (search) {
                sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`;
                params.push(search);
                params.push(search);
            }

            // Novo Filtro de Localização
            if (locationSearch) {
                sql += ` AND P.PRO_LOCAL STARTING WITH ?`;
                params.push(locationSearch);
            }

            if (gr_cod) { sql += ` AND P.GR_COD = ?`; params.push(gr_cod); }
            if (sg_cod) { sql += ` AND P.SG_COD = ?`; params.push(sg_cod); }
            
            sql += ` ORDER BY P.PRO_COD_SIMILAR, P.PRO_DESCRI`;

            db.query(sql, params, (err, products) => {
                db.detach();
                if (err) return res.status(500).json({ error: err.message });
                
                // DEBUG LOG: Verificar se produtos estão chegando
                console.log(`[DEBUG] /blocks: Found ${products.length} products. Filters: GR=${gr_cod}, SG=${sg_cod}, LOC=${locationSearch}`);

                const blocks = groupProductsToBlocks(products, lockMap);
                // Retorna apenas a fatia solicitada após agrupar
                res.json(blocks.slice(0, limit));
            });
        });
    });
});

// --- NOVA ROTA: BLOCOS RESERVADOS PELO USUÁRIO (SEM PAGINAÇÃO) ---
app.get('/reserved-blocks/:userId', (req, res) => {
    const { userId } = req.params;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });

        // 1. Busca IDs bloqueados por este usuário
        db.query('SELECT BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT FROM GRIDE_RESERVAS WHERE USER_ID = ?', [userId], (err, reservations) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Reservas' }); }
            
            if (reservations.length === 0) {
                db.detach();
                return res.json([]); // Sem reservas
            }

            const lockMap = new Map();
            const blockIds = [];
            
            reservations.forEach(r => {
                const bId = safeString(r.BLOCK_ID);
                blockIds.push(bId);
                lockMap.set(bId, {
                    userId: safeString(r.USER_ID),
                    userName: safeString(r.USER_NAME),
                    timestamp: r.RESERVED_AT
                });
            });

            // 2. Busca Produtos desses blocos
            const idsList = blockIds.map(id => `'${id}'`).join(',');
            
            const sql = `
                SELECT P.PRO_COD, P.PRO_DESCRI, P.PRO_EST_ATUAL, P.PRO_COD_SIMILAR, 
                       P.PRO_NRFABRICANTE, P.GR_COD, P.SG_COD, P.MAR_COD, P.PRO_LOCAL
                FROM PRODUTOS P
                WHERE P.PRO_ATIVO = 'S' 
                AND (
                    P.PRO_COD_SIMILAR IN (${idsList}) 
                    OR 
                    (P.PRO_COD_SIMILAR IS NULL AND P.PRO_COD IN (${idsList}))
                )
            `;

            db.query(sql, [], (err, products) => {
                db.detach();
                if (err) return res.status(500).json({ error: err.message });
                
                // Usa a mesma função de agrupamento
                const blocks = groupProductsToBlocks(products, lockMap);
                res.json(blocks);
            });
        });
    });
});

// --- RESERVAS & FINALIZAÇÃO (Mantidos) ---
app.post('/reserve-block', (req, res) => {
    const { block_id, user_id, user_name } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.query('SELECT USER_NAME FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err, result) => {
            if (result && result.length > 0) {
                db.detach();
                return res.json({ success: false, message: `Bloco já reservado por ${safeString(result[0].USER_NAME)}` });
            }
            db.query('INSERT INTO GRIDE_RESERVAS (BLOCK_ID, USER_ID, USER_NAME, RESERVED_AT) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', [block_id, user_id, user_name], (err) => {
                db.detach();
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
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
    const { block_id, user_id, user_name, items } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err, transaction) => {
            if (err) { db.detach(); return res.status(500).json({ error: 'Erro Transação' }); }
            const promises = items.map(item => {
                return new Promise((resolve, reject) => {
                    const sqlUpdate = `UPDATE PRODUTOS SET PRO_EST_ATUAL = ? WHERE PRO_COD = ?`;
                    transaction.query(sqlUpdate, [item.qtd_contada, item.pro_cod], (err) => {
                        if (err) { reject(err); return; }
                        const sqlLog = `INSERT INTO GRIDE_INVENTARIO_LOG (SKU, NOME_PRODUTO, USUARIO_ID, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
                        transaction.query(sqlLog, [item.sku || String(item.pro_cod), item.nome, user_id, user_name, item.qtd_sistema || 0, item.qtd_contada, item.localizacao || 'GERAL', 'completed', ''], (err) => {
                            if (err) reject(err); else resolve();
                        });
                    });
                });
            });
            Promise.all(promises).then(() => {
                transaction.query('DELETE FROM GRIDE_RESERVAS WHERE BLOCK_ID = ?', [block_id], (err) => {
                    transaction.commit((err) => { db.detach(); res.json({ success: true }); });
                });
            }).catch(err => {
                transaction.rollback(); db.detach(); res.status(500).json({ error: err.message });
            });
        });
    });
});

// Outras rotas (Endereços, Galpões, etc) mantidas...
app.get('/addresses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT FIRST 2000 ID, CODIGO, DESCRICAO, TIPO, PRO_COD FROM GRIDE_ENDERECOS ORDER BY CODIGO', [], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({id: r.ID, code: safeString(r.CODIGO), description: safeString(r.DESCRICAO), type: safeString(r.TIPO) || 'shelf'})) : []);
        });
    });
});
app.post('/save-addresses', (req, res) => {
    const addresses = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        let processed = 0;
        const processNext = (idx) => {
            if (idx >= addresses.length) { db.detach(); return res.json({ success: true, count: processed }); }
            const item = addresses[idx];
            db.query('SELECT ID FROM GRIDE_ENDERECOS WHERE CODIGO = ?', [item.code], (err, exists) => {
                if (!exists || exists.length === 0) {
                     db.query('INSERT INTO GRIDE_ENDERECOS (CODIGO, DESCRICAO, TIPO) VALUES (?, ?, ?)', [item.code, item.description, item.type], () => { processed++; processNext(idx + 1); });
                } else { processNext(idx + 1); }
            });
        };
        processNext(0);
    });
});
app.post('/update-address', (req, res) => {
    const { id, codigo, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'Erro DB'});
        db.query('UPDATE GRIDE_ENDERECOS SET CODIGO = ?, DESCRICAO = ? WHERE ID = ?', [codigo, descricao, id], (err) => {
            db.detach(); res.json({ success: true });
        });
    });
});
app.post('/delete-address', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'Erro DB'});
        db.query('DELETE FROM GRIDE_ENDERECOS WHERE ID = ?', [id], (err) => {
            db.detach(); res.json({ success: true });
        });
    });
});
app.get('/warehouses', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json([]);
        db.query('SELECT ID, SIGLA, DESCRICAO FROM GRIDE_GALPOES ORDER BY SIGLA', [], (err, result) => {
            db.detach(); res.json(result ? result.map(r => ({ id: r.ID, sigla: safeString(r.SIGLA), descricao: safeString(r.DESCRICAO) })) : []);
        });
    });
});
app.post('/save-warehouse', (req, res) => {
    const { sigla, descricao } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        db.query('SELECT ID FROM GRIDE_GALPOES WHERE SIGLA = ?', [sigla], (err, result) => {
            if (result && result.length > 0) { db.detach(); return res.json({ success: false, message: 'Sigla existe' }); }
            db.query('INSERT INTO GRIDE_GALPOES (SIGLA, DESCRICAO) VALUES (?, ?)', [sigla, descricao], (err) => { db.detach(); res.json({ success: true }); });
        });
    });
});
app.post('/delete-warehouse', (req, res) => {
    const { id } = req.body;
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({error: 'DB Error'});
        db.query('DELETE FROM GRIDE_GALPOES WHERE ID = ?', [id], (err) => { db.detach(); res.json({ success: true }); });
    });
});
// --- ROTA DE HISTÓRICO ATUALIZADA (COM PAGINAÇÃO) ---
app.get('/history', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro DB' });
        const sql = `
            SELECT FIRST ? SKIP ? 
            ID, SKU, NOME_PRODUTO, USUARIO_NOME, QTD_CONTADA, LOCALIZACAO, STATUS, DATA_HORA, USUARIO_ID 
            FROM GRIDE_INVENTARIO_LOG 
            ORDER BY DATA_HORA DESC
        `;
        db.query(sql, [limit, skip], (err, result) => {
            db.detach();
            res.json(result ? result.map(r => ({ 
                ...r, 
                NOME_PRODUTO: safeString(r.NOME_PRODUTO), 
                USUARIO_NOME: safeString(r.USUARIO_NOME), 
                STATUS: safeString(r.STATUS), 
                LOCALIZACAO: safeString(r.LOCALIZACAO),
                USUARIO_ID: safeString(r.USUARIO_ID)
            })) : []);
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor GRIDE Firebird rodando em http://localhost:${port}`);
});
