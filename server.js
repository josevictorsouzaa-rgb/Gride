
const express = require('express');
const Firebird = require('node-firebird');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuração do Firebird
const options = {
    host: '127.0.0.1',
    port: 3050,
    database: 'C:\\Users\\DELL G15\\Desktop\\BD\\DATABASE\\DATABASE.FDB',
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false, 
    role: null,
    pageSize: 4096
};

// --- ROTA DE LOGIN ---
app.post('/login', (req, res) => {
    const { usuario_id, senha } = req.body;

    if (!usuario_id || !senha) {
        return res.status(400).json({ error: 'ID e Senha são obrigatórios' });
    }

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro de conexão com banco' });

        // 1. Verificar se o usuário existe e está ativo
        const sqlUser = `SELECT USU_COD, USU_NOME, USU_ATIVO FROM USUARIOS WHERE USU_COD = ?`;
        
        db.query(sqlUser, [usuario_id], (err, resultUser) => {
            if (err) {
                db.detach();
                return res.status(500).json({ error: err.message });
            }

            if (resultUser.length === 0) {
                db.detach();
                return res.status(401).json({ error: 'Usuário não encontrado' });
            }

            const user = resultUser[0];
            const ativo = user.USU_ATIVO ? user.USU_ATIVO.toString() : 'N';

            if (ativo !== 'S') {
                db.detach();
                return res.status(403).json({ error: 'Usuário inativo' });
            }

            // 2. Buscar a última senha cadastrada
            const sqlPwd = `SELECT FIRST 1 PWD_SENHA FROM PASSWORDS WHERE USU_COD = ? ORDER BY PWD_ID DESC`;

            db.query(sqlPwd, [usuario_id], (err, resultPwd) => {
                db.detach();
                if (err) return res.status(500).json({ error: err.message });

                if (resultPwd.length === 0) {
                    return res.status(401).json({ error: 'Senha não cadastrada' });
                }

                // Node-firebird pode retornar buffer, converte para string
                const dbSenha = resultPwd[0].PWD_SENHA ? resultPwd[0].PWD_SENHA.toString() : '';

                if (dbSenha === senha) {
                    const userName = user.USU_NOME ? user.USU_NOME.toString() : 'Usuário';
                    
                    // Retorna dados do usuário logado (Role fictícia pois não informada na tabela USUARIOS)
                    res.json({
                        success: true,
                        user: {
                            id: user.USU_COD.toString(),
                            name: userName,
                            role: 'Colaborador', // Default, já que não temos cargo na tabela USUARIOS
                            avatar: `https://i.pravatar.cc/150?u=${user.USU_COD}`,
                            isAdmin: usuario_id === '18' // Exemplo de regra hardcoded para admin, ajuste conforme necessidade
                        }
                    });
                } else {
                    res.status(401).json({ error: 'Senha incorreta' });
                }
            });
        });
    });
});

// --- ROTA DE CATEGORIAS ---
app.get('/categories', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro de conexão' });

        // Buscar Grupos
        db.query('SELECT GR_COD, GR_DESCRI FROM GRUPOPRODUTOS', [], (err, groups) => {
            if (err) {
                db.detach();
                return res.status(500).json({ error: err.message });
            }

            // Buscar Subgrupos
            db.query('SELECT GR_COD, SG_COD, SG_DESCRI FROM SUBGRUPOPRODUTOS', [], (err, subgroups) => {
                db.detach();
                if (err) return res.status(500).json({ error: err.message });

                // Processar e Montar Árvore
                const categoryTree = groups.map(g => {
                    const groupId = g.GR_COD;
                    
                    // Filtrar subgrupos deste grupo
                    const subs = subgroups.filter(s => s.GR_COD === groupId).map(s => ({
                        id: s.SG_COD.toString(),
                        name: s.SG_DESCRI ? s.SG_DESCRI.toString() : '',
                        count: 0, // Mock, pois precisaria de count(*) na tabela produtos
                        icon: 'circle' // Ícone padrão
                    }));

                    return {
                        id: groupId.toString(),
                        db_id: groupId,
                        label: g.GR_DESCRI ? g.GR_DESCRI.toString() : '',
                        icon: 'inventory_2', // Ícone padrão
                        count: 0, // Mock
                        subcategories: subs
                    };
                });

                res.json(categoryTree);
            });
        });
    });
});

// Rota: Listar Produtos
app.get('/products', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    Firebird.attach(options, (err, db) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Erro ao conectar no banco' });
        }

        let sql = `
            SELECT FIRST ? SKIP ? 
                P.PRO_COD, 
                P.PRO_DESCRI, 
                P.PRO_NRFABRICANTE, 
                P.PRO_EST_ATUAL,
                P.PRO_COD_SIMILAR,
                P.GR_COD,
                P.SG_COD,
                P.MAR_COD
            FROM PRODUTOS P 
            WHERE P.PRO_ATIVO = 'S'
        `;

        const params = [limit, skip];

        if (search) {
            sql += ` AND (P.PRO_DESCRI CONTAINING ? OR P.PRO_NRFABRICANTE CONTAINING ?)`;
            params.push(search);
            params.push(search);
        }

        db.query(sql, params, (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });

            const mapped = result.map(item => {
                const nome = item.PRO_DESCRI ? item.PRO_DESCRI.toString() : '';
                const sku = item.PRO_NRFABRICANTE ? item.PRO_NRFABRICANTE.toString().trim() : '';
                const similarId = item.PRO_COD_SIMILAR ? item.PRO_COD_SIMILAR.toString().trim() : null;

                return {
                    id: item.PRO_COD,
                    name: nome,
                    sku: sku,
                    balance: parseFloat(item.PRO_EST_ATUAL || 0),
                    similar_id: similarId,
                    brand: 'GENÉRICO',
                    location: 'ESTOQUE GERAL',
                    status: 'active'
                };
            });

            res.json(mapped);
        });
    });
});

// Rota: Salvar Contagem (Lastro)
app.post('/save-count', (req, res) => {
    const { sku, nome_produto, usuario_id, usuario_nome, qtd_sistema, qtd_contada, localizacao, status, divergencia_motivo } = req.body;

    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro ao conectar no banco' });

        const sql = `
            INSERT INTO GRIDE_INVENTARIO_LOG 
            (SKU, NOME_PRODUTO, USUARIO_ID, USUARIO_NOME, QTD_SISTEMA, QTD_CONTADA, LOCALIZACAO, STATUS, DIVERGENCIA_MOTIVO, DATA_HORA)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        const params = [
            sku, 
            nome_produto, 
            usuario_id, 
            usuario_nome, 
            qtd_sistema, 
            qtd_contada, 
            localizacao, 
            status,
            divergencia_motivo || ''
        ];

        db.query(sql, params, (err, result) => {
            db.detach();
            if (err) {
                console.error(err);
                return res.status(500).json({ error: 'Erro ao salvar histórico' });
            }
            res.json({ success: true, message: 'Contagem registrada com sucesso' });
        });
    });
});

// Rota: Obter Histórico
app.get('/history', (req, res) => {
    Firebird.attach(options, (err, db) => {
        if (err) return res.status(500).json({ error: 'Erro ao conectar no banco' });

        const sql = `
            SELECT FIRST 200
                ID, SKU, NOME_PRODUTO, USUARIO_NOME, QTD_CONTADA, LOCALIZACAO, STATUS, DATA_HORA
            FROM GRIDE_INVENTARIO_LOG
            ORDER BY DATA_HORA DESC
        `;

        db.query(sql, [], (err, result) => {
            db.detach();
            if (err) return res.status(500).json({ error: err.message });
            
            const safeResult = result.map(r => {
                return {
                    ...r,
                    NOME_PRODUTO: r.NOME_PRODUTO ? r.NOME_PRODUTO.toString() : '',
                    USUARIO_NOME: r.USUARIO_NOME ? r.USUARIO_NOME.toString() : '',
                    STATUS: r.STATUS ? r.STATUS.toString() : '',
                    LOCALIZACAO: r.LOCALIZACAO ? r.LOCALIZACAO.toString() : 'N/A'
                }
            });

            res.json(safeResult);
        });
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor Node Firebird rodando em http://localhost:${port}`);
});
